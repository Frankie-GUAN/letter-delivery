// 此刻·此地 — AI场景特征提取与比对引擎
const FeatureEngine = {
  // 从Image/Video/Canvas提取特征向量
  extractFeatures(source) {
    const SIZE = CONFIG.FEATURE.IMAGE_SIZE;
    const canvas = Helpers.scaleImageToCanvas(source, SIZE, SIZE);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    const pixels = imageData.data;

    const gridCols = CONFIG.FEATURE.GRID_COLS;
    const gridRows = CONFIG.FEATURE.GRID_ROWS;
    const cellW = Math.floor(SIZE / gridCols);
    const cellH = Math.floor(SIZE / gridRows);

    const features = [];

    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        const cellFeatures = this._extractCellFeatures(pixels, SIZE, gx * cellW, gy * cellH, cellW, cellH);
        features.push(...cellFeatures);
      }
    }

    return features;
  },

  // 提取单个网格单元的特征
  _extractCellFeatures(pixels, imageW, startX, startY, w, h) {
    let sumH = 0, sumS = 0, sumV = 0, count = 0;
    const edgeBins = new Array(CONFIG.FEATURE.SOBEL_BINS).fill(0);
    let sumLaplacian = 0;

    for (let y = startY; y < startY + h && y < imageW; y++) {
      for (let x = startX; x < startX + w && x < imageW; x++) {
        const idx = (y * imageW + x) * 4;
        const r = pixels[idx] / 255;
        const g = pixels[idx + 1] / 255;
        const b = pixels[idx + 2] / 255;

        // RGB → HSV
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let h = 0;
        if (delta > 0.001) {
          if (max === r) h = ((g - b) / delta) % 6;
          else if (max === g) h = (b - r) / delta + 2;
          else h = (r - g) / delta + 4;
          h = h / 6;
          if (h < 0) h += 1;
        }

        const s = max > 0.001 ? delta / max : 0;
        const v = max;

        sumH += h;
        sumS += s;
        sumV += v;
        count++;

        // Sobel边缘（仅对非边缘像素计算）
        if (x > startX && x < startX + w - 1 && y > startY && y < startY + h - 1) {
          const tl = this._luminance(pixels, (y - 1) * imageW + (x - 1));
          const tc = this._luminance(pixels, (y - 1) * imageW + x);
          const tr = this._luminance(pixels, (y - 1) * imageW + (x + 1));
          const ml = this._luminance(pixels, y * imageW + (x - 1));
          const mr = this._luminance(pixels, y * imageW + (x + 1));
          const bl = this._luminance(pixels, (y + 1) * imageW + (x - 1));
          const bc = this._luminance(pixels, (y + 1) * imageW + x);
          const br = this._luminance(pixels, (y + 1) * imageW + (x + 1));

          const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
          const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
          const magnitude = Math.sqrt(gx * gx + gy * gy);
          const angle = Math.atan2(gy, gx);

          if (magnitude > 0.1) {
            const bin = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * CONFIG.FEATURE.SOBEL_BINS);
            edgeBins[Math.min(bin, CONFIG.FEATURE.SOBEL_BINS - 1)] += magnitude;
          }

          // Laplacian
          sumLaplacian += Math.abs(
            4 * this._luminance(pixels, y * imageW + x)
            - this._luminance(pixels, (y - 1) * imageW + x)
            - this._luminance(pixels, (y + 1) * imageW + x)
            - this._luminance(pixels, y * imageW + (x - 1))
            - this._luminance(pixels, y * imageW + (x + 1))
          );
        }
      }
    }

    // 组装该cell的特征
    const avgH = count > 0 ? sumH / count : 0;
    const avgS = count > 0 ? sumS / count : 0;
    const avgV = count > 0 ? sumV / count : 0;

    const totalEdge = edgeBins.reduce((a, b) => a + b, 0);
    const normEdges = totalEdge > 0
      ? edgeBins.map(v => v / totalEdge)
      : edgeBins.map(() => 1 / CONFIG.FEATURE.SOBEL_BINS);

    const avgLaplacian = count > 0 ? sumLaplacian / count : 0;

    return [
      avgH, avgS, avgV,
      ...normEdges,
      avgLaplacian,
      totalEdge / count,
      0, 0, 0,  // padding到16维
    ];
  },

  _luminance(pixels, pixelIdx) {
    const i = pixelIdx * 4;
    return 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  },

  // 余弦相似度
  cosineSimilarity(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  },

  // 计算对齐得分（0-1），封装完整的比对过程
  computeAlignment(originalFeatures, currentSource) {
    try {
      const currentFeatures = this.extractFeatures(currentSource);
      return this.cosineSimilarity(originalFeatures, currentFeatures);
    } catch (e) {
      console.warn('特征比对失败:', e);
      return 0;
    }
  },

  // 得分转百分比（sigmoid平滑映射）
  scoreToPercent(score) {
    const shifted = (score - 0.4) * 5;
    const percent = 1 / (1 + Math.exp(-shifted));
    return Math.round(Math.max(0, Math.min(100, percent * 100)));
  },
};
