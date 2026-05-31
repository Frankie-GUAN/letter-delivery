// 此刻·此地 — 轻量级二维码生成器（Canvas + 纯 JS）
// 支持 Alphanumeric / Byte 模式，EC Level M，版本 1–10
const QRCode = {
  // 字符集: alphanumeric 模式
  _alphanumericChars: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:',

  // 版本 → 每边模块数
  _moduleCount(v) { return v * 4 + 17; },

  // 版本 → 总数据码字容量（EC Level M）
  _capacity(v) {
    const caps = [0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216];
    return caps[v] || 0;
  },

  // EC Level M 下每个纠错块的数据码字数 / EC码字数
  _ecInfo(v) {
    const table = {
       1: [[16, 10]], 2: [[28, 16]], 3: [[44, 26]],
       4: [[32, 16], [32, 16]], 5: [[43, 24], [43, 24]],
       6: [[54, 30], [54, 30]], 7: [[62, 36], [62, 36]],
       8: [[72, 40], [43, 24], [43, 24]],
       9: [[76, 44], [61, 28], [61, 28]],
      10: [[86, 48], [72, 36], [72, 36]],
    };
    return table[v];
  },

  // ---- 模式指示符 ----
  _MODE_ALPHA: 2,
  _MODE_BYTE: 4,
  _MODE_TERMINATOR: 0,

  // ---- 生成核心 ----

  generate(text, version) {
    if (!version) version = this._selectVersion(text);
    const count = this._moduleCount(version);
    const matrix = this._createMatrix(count);

    // 置入定位图案
    this._placeFinderPatterns(matrix);
    this._placeTimingPatterns(matrix);
    this._placeAlignmentPatterns(matrix, version);
    this._placeFormatInfo(matrix, 2); // mask=2 通常评分最优
    this._placeVersionInfo(matrix, version);

    // 编码数据
    const dataBits = this._encodeData(text, version);
    this._placeData(matrix, dataBits, 2);

    // 应用掩码
    this._applyMask(matrix, 2);

    return { matrix, count };
  },

  // 渲染到 Canvas → DataURL
  render(text, size = 240, version) {
    const { matrix, count } = this.generate(text, version);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const moduleSize = Math.floor(size / (count + 8));
    const offset = Math.floor((size - moduleSize * count) / 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // 白色边框（静区）
    ctx.fillStyle = '#faf3e3'; // 匹配页面暖色背景
    ctx.fillRect(offset - moduleSize * 4, offset - moduleSize * 4,
      moduleSize * (count + 8), moduleSize * (count + 8));

    ctx.fillStyle = '#3b2e1a';

    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(
            offset + c * moduleSize,
            offset + r * moduleSize,
            moduleSize, moduleSize
          );
        }
      }
    }

    return canvas.toDataURL('image/png');
  },

  // ---- 版本选择 ----

  _selectVersion(text) {
    const alpha = /^[A-Z0-9 $%*+\-.\/:]+$/.test(text);
    for (let v = 1; v <= 10; v++) {
      const cap = this._capacity(v);
      if (alpha) {
        // Alphanumeric: 2 chars ≈ 11 bits，每码字 8 bits
        const needed = Math.ceil((4 + text.length * 5.5) / 8);
        if (needed <= cap) return v;
      } else {
        // Byte mode: 每字符 8 bits + 模式指示符
        const needed = Math.ceil((4 + 8 + text.length * 8) / 8);
        if (needed <= cap) return v;
      }
    }
    return 10; // fallback to max
  },

  // ---- 编码 ----

  _encodeData(text, version) {
    const alpha = /^[A-Z0-9 $%*+\-.\/:]+$/.test(text);
    let bits = '';

    if (alpha) {
      // Alphanumeric mode
      bits += this._toBits(this._MODE_ALPHA, 4);
      bits += this._toBits(text.length, this._lengthBits(version, true));
      for (let i = 0; i < text.length; i += 2) {
        if (i + 1 < text.length) {
          const v1 = this._alphanumericChars.indexOf(text[i]);
          const v2 = this._alphanumericChars.indexOf(text[i + 1]);
          bits += this._toBits(v1 * 45 + v2, 11);
        } else {
          bits += this._toBits(this._alphanumericChars.indexOf(text[i]), 6);
        }
      }
    } else {
      // Byte mode (UTF-8)
      const bytes = new TextEncoder().encode(text);
      bits += this._toBits(this._MODE_BYTE, 4);
      bits += this._toBits(bytes.length, this._lengthBits(version, false));
      for (const b of bytes) {
        bits += this._toBits(b, 8);
      }
    }

    // 终止符
    const cap = this._capacity(version) * 8;
    bits += '0000';
    bits = bits.slice(0, Math.floor(bits.length / 8) * 8);

    // 填充至容量
    while (bits.length < cap) {
      bits += '11101100';
      if (bits.length >= cap) break;
      bits += '00010001';
    }
    bits = bits.slice(0, cap);

    // 转换为字节
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      codewords.push(parseInt(bits.slice(i, i + 8), 2));
    }

    // 添加纠错码字
    return this._interleaveWithEC(codewords, version);
  },

  _lengthBits(version, alpha) {
    if (version <= 9) return alpha ? 9 : 8;
    return alpha ? 11 : 16;
  },

  // ---- 纠错编码 (Reed-Solomon) ----

  _interleaveWithEC(data, version) {
    const blocks = this._ecInfo(version);
    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;

    for (const [total, dataWords] of blocks) {
      const ecWords = total - dataWords;
      const blockData = data.slice(offset, offset + dataWords);
      offset += dataWords;
      const ec = this._rsEncode(blockData, ecWords);
      dataBlocks.push(blockData);
      ecBlocks.push(ec);
    }

    // 交错排列
    const result = [];
    const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
    for (let i = 0; i < maxDataLen; i++) {
      for (const block of dataBlocks) {
        if (i < block.length) result.push(block[i]);
      }
    }
    const maxEcLen = Math.max(...ecBlocks.map(b => b.length));
    for (let i = 0; i < maxEcLen; i++) {
      for (const block of ecBlocks) {
        if (i < block.length) result.push(block[i]);
      }
    }
    return result;
  },

  _rsEncode(data, ecCount) {
    const gen = this._rsGeneratorPoly(ecCount);
    const msg = [...data, ...new Array(ecCount).fill(0)];
    for (let i = 0; i < data.length; i++) {
      if (msg[i] === 0) continue;
      const factor = QRCode._gfExp[QRCode._gfLog[msg[i]]];
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= QRCode._gfMul(gen[j], factor);
      }
    }
    return msg.slice(data.length);
  },

  _rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      poly = QRCode._gfPolyMul(poly, [1, QRCode._gfExp[i]]);
    }
    return poly;
  },

  // ---- 矩阵构建 ----

  _createMatrix(count) {
    const m = [];
    for (let r = 0; r < count; r++) {
      m[r] = new Array(count).fill(null);
    }
    return m;
  },

  _placeFinderPatterns(matrix) {
    const positions = [
      [0, 0], [0, matrix.length - 7], [matrix.length - 7, 0],
    ];
    for (const [r, c] of positions) {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const tr = r + dr, tc = c + dc;
          if (tr < 0 || tc < 0 || tr >= matrix.length || tc >= matrix[0].length) continue;
          if ((dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) ||
              (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6)) ||
              (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)) {
            matrix[tr][tc] = true;
          } else if (dr >= -1 && dr <= 7 && dc >= -1 && dc <= 7) {
            matrix[tr][tc] = false;
          }
        }
      }
    }
  },

  _placeTimingPatterns(matrix) {
    const n = matrix.length;
    for (let i = 8; i < n - 8; i++) {
      const v = i % 2 === 0;
      if (matrix[6][i] === null) matrix[6][i] = v;
      if (matrix[i][6] === null) matrix[i][6] = v;
    }
  },

  _placeAlignmentPatterns(matrix, version) {
    if (version === 1) return;
    const centers = this._alignmentCenters(version);
    for (const r of centers) {
      for (const c of centers) {
        // 跳过与定位图案重叠的位置
        if ((r < 9 && c < 9) || (r < 9 && c >= matrix.length - 8) || (r >= matrix.length - 8 && c < 9)) {
          continue;
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const absDr = Math.abs(dr), absDc = Math.abs(dc);
            matrix[r + dr][c + dc] = (absDr === 2 || absDc === 2 || (absDr === 0 && absDc === 0));
          }
        }
      }
    }
  },

  _alignmentCenters(version) {
    const intervals = [
      [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
      [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
    ];
    const n = this._moduleCount(version);
    return [6, ...(intervals[version] || []), n - 1 - 6].filter((v, i, arr) => arr.indexOf(v) === i);
  },

  _placeData(matrix, dataWords, mask) {
    const n = matrix.length;
    const bits = [];
    for (const w of dataWords) {
      for (let i = 7; i >= 0; i--) {
        bits.push((w >> i) & 1);
      }
    }

    let bitIdx = 0;
    let dir = -1; // 向上
    let col = n - 1;

    while (col > 0) {
      if (col === 6) col = 5; // 跳过垂直时序列
      let rows = dir === -1
        ? Array.from({ length: n }, (_, i) => n - 1 - i)
        : Array.from({ length: n }, (_, i) => i);
      for (const r of rows) {
        for (let dc = 0; dc < 2; dc++) {
          const c = col - dc;
          if (c < 0) continue;
          if (matrix[r][c] === null && bitIdx < bits.length) {
            matrix[r][c] = !!bits[bitIdx];
            bitIdx++;
          }
        }
      }
      dir = -dir;
      col -= 2;
    }
  },

  _placeFormatInfo(matrix, mask) {
    // EC Level M (00), mask pattern
    const data = ((0 << 1) | mask) ^ 0x5412; // BCH encoded
    let bits = data;
    for (let i = 0; i < 15; i++) {
      const v = (bits >> (14 - i)) & 1;
      // 格式信息位置（简化版：只放置关键位）
    }
    // 使用预计算的格式信息
    const formatBits = [
      0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
      0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
      0x48e8, 0x4ddf, 0x4286, 0x47b1, 0x5903, 0x5c34, 0x536d, 0x565a,
      0x7b3e, 0x7e09, 0x7150, 0x7467, 0x6ad5, 0x6fe2, 0x60bb, 0x658c,
    ];
    const fb = formatBits[mask];
    const n = matrix.length;

    const positions = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
      [n - 1, 8], [n - 2, 8], [n - 3, 8], [n - 4, 8], [n - 5, 8], [n - 6, 8], [n - 7, 8],
      [8, n - 8], [8, n - 7], [8, n - 6], [8, n - 5], [8, n - 4], [8, n - 3], [8, n - 2], [8, n - 1],
    ];

    for (let i = 0; i < 15; i++) {
      const [r, c] = positions[i] || [];
      if (r != null && c != null && r < n && c < n) {
        matrix[r][c] = !!((fb >> (14 - i)) & 1);
      }
    }
  },

  _placeVersionInfo(matrix, version) {
    if (version < 7) return;
    const n = matrix.length;
    const versInfo = {
      7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3,
    };
    const bits = versInfo[version];
    if (!bits) return;

    for (let i = 0; i < 18; i++) {
      const v = (bits >> (17 - i)) & 1;
      const r1 = Math.floor(i / 3);
      const c1 = n - 11 + (i % 3);
      const r2 = n - 11 + (i % 3);
      const c2 = Math.floor(i / 3);
      matrix[r1][c1] = !!v;
      matrix[r2][c2] = !!v;
    }
  },

  // ---- 掩码 ----

  _applyMask(matrix, mask) {
    const n = matrix.length;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c] === null) continue;
        let invert = false;
        switch (mask) {
          case 0: invert = (r + c) % 2 === 0; break;
          case 1: invert = r % 2 === 0; break;
          case 2: invert = c % 3 === 0; break;
          case 3: invert = (r + c) % 3 === 0; break;
          case 4: invert = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
          case 5: invert = (r * c) % 2 + (r * c) % 3 === 0; break;
          case 6: invert = ((r * c) % 2 + (r * c) % 3) % 2 === 0; break;
          case 7: invert = ((r + c) % 2 + (r * c) % 3) % 2 === 0; break;
        }
        if (invert && matrix[r][c] !== null) {
          matrix[r][c] = !matrix[r][c];
        }
      }
    }
  },

  // ---- 工具 ----

  _toBits(n, len) {
    return n.toString(2).padStart(len, '0');
  },
};

// ---- GF(256) 运算表（Reed-Solomon 编码用） ----

QRCode._gfExp = [];
QRCode._gfLog = new Array(256).fill(0);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    QRCode._gfExp[i] = x;
    QRCode._gfLog[x] = i;
    x <<= 1;
    if (x >= 256) x ^= 0x11d; // 本原多项式 x^8 + x^4 + x^3 + x^2 + 1
  }
})();

QRCode._gfMul = function (a, b) {
  if (a === 0 || b === 0) return 0;
  return QRCode._gfExp[(QRCode._gfLog[a] + QRCode._gfLog[b]) % 255];
};

QRCode._gfPolyMul = function (a, b) {
  const result = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] ^= QRCode._gfMul(a[i], b[j]);
    }
  }
  return result;
};
