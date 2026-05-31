// 此刻·此地 — AR引擎（Pokémon GO 风格）
// 基于 DeviceOrientation + requestAnimationFrame 的真实AR渲染

// Canvas roundRect polyfill (Safari < 16)
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    this.beginPath();
    this.moveTo(x + r.tl, y);
    this.lineTo(x + w - r.tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    this.lineTo(x + w, y + h - r.br);
    this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    this.lineTo(x + r.bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    this.lineTo(x, y + r.tl);
    this.quadraticCurveTo(x, y, x + r.tl, y);
    this.closePath();
  };
}

const AREngine = {
  // ── 状态 ──
  _video: null,
  _canvas: null,
  _ctx: null,
  _currentPos: null,
  _targets: [],
  _orientation: { alpha: 0, beta: 0, gamma: 0, absolute: false },
  _rafId: null,
  _running: false,
  _smoothAlpha: 0, // 平滑后的指南针值

  // ── 初始化 ──
  async init(videoElement, canvasElement) {
    this._video = videoElement;
    this._canvas = canvasElement;
    this._ctx = canvasElement.getContext('2d', { alpha: false });

    // 尺寸适配
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this._resize(), 300);
    });
  },

  _resize() {
    if (!this._canvas || !this._video) return;
    const vw = this._video.videoWidth || 640;
    const vh = this._video.videoHeight || 480;
    const cw = this._canvas.clientWidth;
    const ch = this._canvas.clientHeight;
    // 保持视频比例填充canvas
    const videoRatio = vw / vh;
    const canvasRatio = cw / ch;
    if (videoRatio > canvasRatio) {
      this._canvas.width = cw;
      this._canvas.height = cw / videoRatio;
    } else {
      this._canvas.width = ch * videoRatio;
      this._canvas.height = ch;
    }
    this._drawW = this._canvas.width;
    this._drawH = this._canvas.height;
  },

  // ── 设备方向追踪 ──
  startOrientationTracking() {
    // iOS 13+ 需要用户主动触发权限请求
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ 权限在 camera-view 中处理
      // 此处仅注册事件，权限请求由调用方处理
    }

    this._onOrientation = (e) => {
      if (e.alpha !== null) {
        // 平滑插值减少抖动
        const target = e.alpha;
        this._smoothAlpha += (target - this._smoothAlpha) * 0.3;
        this._orientation = {
          alpha: this._smoothAlpha,
          beta: e.beta || 0,
          gamma: e.gamma || 0,
          absolute: e.webkitCompassHeading ? true : false,
        };
      }
    };

    window.addEventListener('deviceorientation', this._onOrientation, true);

    // 优先使用绝对方向（需要设备磁力计校准）
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', this._onOrientation, true);
    }
  },

  stopOrientationTracking() {
    if (this._onOrientation) {
      window.removeEventListener('deviceorientation', this._onOrientation, true);
      window.removeEventListener('deviceorientationabsolute', this._onOrientation, true);
      this._onOrientation = null;
    }
  },

  // ── 位置与目标 ──
  updatePosition(lat, lng) {
    this._currentPos = { lat, lng };
  },

  setTargets(targets) {
    this._targets = targets || [];
  },

  // ── 渲染循环 ──
  startRenderLoop(onRender) {
    if (this._running) return;
    this._running = true;
    this._onRenderCallback = onRender || null;

    const render = () => {
      if (!this._running) return;
      this._renderFrame();
      this._rafId = requestAnimationFrame(render);
    };
    render();
  },

  stopRenderLoop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  },

  _renderFrame() {
    if (!this._video || !this._ctx) return;

    const w = this._drawW;
    const h = this._drawH;
    const canvas = this._canvas;

    // 绘制相机画面（镜像）
    this._ctx.save();
    this._ctx.scale(-1, 1);
    this._ctx.drawImage(this._video, -w, 0, w, h);
    this._ctx.restore();

    // 调用外部渲染回调（绘制AR叠加层）
    if (this._onRenderCallback) {
      this._onRenderCallback(this._ctx, w, h);
    }
  },

  // ── 空间计算 ──
  // 计算从当前位置到目标的方向角（0=正北）
  bearingTo(lat, lng) {
    if (!this._currentPos) return 0;
    const lat1 = this._currentPos.lat * Math.PI / 180;
    const lat2 = lat * Math.PI / 180;
    const dLng = (lng - this._currentPos.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  },

  // 将目标方向映射到屏幕X坐标
  // 返回 { x, y, scale, onScreen }
  projectToScreen(targetLat, targetLng, targetDistance) {
    if (!this._currentPos) return { x: -999, y: -999, scale: 0.3, onScreen: false };

    const bearing = this.bearingTo(targetLat, targetLng);
    const phoneHeading = this._orientation.alpha;

    // 计算目标相对于手机指向的角度差
    let relAngle = bearing - phoneHeading;
    if (relAngle > 180) relAngle -= 360;
    if (relAngle < -180) relAngle += 360;

    // FOV映射：±45° 映射到屏幕边缘
    const fov = 55; // 水平FOV（度）
    const halfFov = fov / 2;
    const onScreen = Math.abs(relAngle) <= halfFov + 10;

    const w = this._drawW || this._canvas.width;
    const h = this._drawH || this._canvas.height;

    // 屏幕X: 0=左边, w=右边
    const normX = (relAngle + halfFov) / fov; // 0到1之间（在FOV内）
    const x = normX * w;

    // 屏幕Y: 考虑设备倾斜
    const beta = this._orientation.beta || 0;
    const y = h * 0.45 + (beta - 45) * (h / 180) * 0.3;

    // 距离缩放 (5m ~ 100m → scale 1.5 ~ 0.3)
    const d = Math.max(1, targetDistance || 50);
    const scale = Math.max(0.25, Math.min(1.8, 15 / d));

    return { x, y, scale, onScreen, relAngle, bearing, distance: d };
  },

  // ── 绘制工具 ──
  // 绘制Pokémon GO风格的距离指示箭头
  drawProximityIndicator(ctx, x, y, scale, distance, relAngle, target) {
    const d = distance;
    ctx.save();
    ctx.translate(x, y);

    // 距离颜色
    let color, alpha;
    if (d <= CONFIG.LOCATION.NEARBY_RANGE) {
      color = '#c4852a'; alpha = 0.9; // 金色=已到达
    } else if (d <= 50) {
      color = '#e8c97a'; alpha = 0.8; // 浅金=非常近
    } else if (d <= 200) {
      color = '#d4a853'; alpha = 0.7; // 暗金=中等距离
    } else {
      color = '#8c7b5e'; alpha = 0.5; // 灰=远
    }

    const s = scale;
    const envW = 64 * s;
    const envH = 45 * s;

    // ── 光晕脉冲 ──
    if (d <= CONFIG.LOCATION.NEARBY_RANGE) {
      const pulsePhase = (Date.now() % 1500) / 1500;
      const pulseAlpha = 0.15 + Math.sin(pulsePhase * Math.PI * 2) * 0.15;
      ctx.beginPath();
      ctx.arc(0, -envH * 0.3, envW * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(196, 133, 42, ${pulseAlpha})`;
      ctx.fill();
    }

    // ── 信封主体 ──
    // 阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12 * s;
    ctx.shadowOffsetY = 3 * s;

    // 信封矩形
    const rx = -envW / 2;
    const ry = -envH - envH * 0.15;
    const radius = 8 * s;

    ctx.beginPath();
    ctx.moveTo(rx + radius, ry);
    ctx.lineTo(rx + envW - radius, ry);
    ctx.quadraticCurveTo(rx + envW, ry, rx + envW, ry + radius);
    ctx.lineTo(rx + envW, ry + envH - radius);
    ctx.quadraticCurveTo(rx + envW, ry + envH, rx + envW - radius, ry + envH);
    ctx.lineTo(rx + radius, ry + envH);
    ctx.quadraticCurveTo(rx, ry + envH, rx, ry + envH - radius);
    ctx.lineTo(rx, ry + radius);
    ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
    ctx.closePath();

    // 填充（纸色）
    const bgGrad = ctx.createLinearGradient(rx, ry, rx, ry + envH);
    bgGrad.addColorStop(0, 'rgba(255, 249, 240, 0.95)');
    bgGrad.addColorStop(1, 'rgba(245, 235, 214, 0.95)');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // 边框
    ctx.strokeStyle = `rgba(196, 133, 42, ${alpha * 0.5})`;
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // ── 火漆封印 ──
    const sealR = 10 * s;
    ctx.beginPath();
    ctx.arc(0, -envH * 0.05, sealR, 0, Math.PI * 2);
    const sealGrad = ctx.createRadialGradient(0, -sealR * 0.3, 0, 0, 0, sealR);
    sealGrad.addColorStop(0, '#e8a74c');
    sealGrad.addColorStop(1, '#a0601a');
    ctx.fillStyle = sealGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 96, 26, 0.6)';
    ctx.lineWidth = 1 * s;
    ctx.stroke();

    // 封印图案
    ctx.fillStyle = '#fff';
    ctx.font = `${sealR * 1.2}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(target._icon || '✉️', 0, -envH * 0.05);

    // ── 标题 ──
    if (target._title && scale > 0.5) {
      ctx.fillStyle = '#3b2e1a';
      ctx.font = `bold ${Math.max(10, 11 * s)}px "Songti SC", "STSong", serif`;
      ctx.textAlign = 'center';
      ctx.fillText(target._title, 0, -envH - 6 * s);
    }

    // ── 距离标签 ──
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.max(9, 12 * s)}px Arial`;
    ctx.textAlign = 'center';
    const distText = d < 10 ? `${Math.round(d)}m` : d < 1000 ? `${Math.round(d)}m` : `${(d/1000).toFixed(1)}km`;
    ctx.fillText(distText, 0, envH + 16 * s);

    // ── 方向箭头（如果不在屏幕正前方） ──
    if (Math.abs(relAngle) > 5) {
      const arrowX = relAngle > 0 ? envW * 0.6 : -envW * 0.6;
      ctx.fillStyle = color;
      ctx.font = `${18 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(relAngle > 0 ? '→' : '←', arrowX, -envH * 0.3);
    }

    // ── 对齐进度环（仅在附近且有对齐要求时） ──
    if (target._alignmentScore !== undefined && target._alignmentScore > 0 && d <= CONFIG.LOCATION.NEARBY_RANGE) {
      const score = target._alignmentScore;
      const ringR = sealR + 4 * s;
      ctx.beginPath();
      ctx.arc(0, -envH * 0.05, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * score);
      ctx.strokeStyle = score >= 0.9 ? '#5b8c5a' : '#c4852a';
      ctx.lineWidth = 2.5 * s;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.restore();
  },

  // 绘制无目标时的探索提示
  drawExploreHint(ctx, w, h) {
    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 1.5) * 0.3 + 0.7;

    // 雷达扫描效果
    const cx = w / 2;
    const cy = h * 0.4;
    const r = Math.min(w, h) * 0.25;

    // 雷达圈
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * (0.3 + i * 0.3), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(196, 133, 42, ${0.15 - i * 0.04})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 扫描线
    const scanAngle = (time * 2) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(scanAngle) * r * 0.7,
      cy + Math.sin(scanAngle) * r * 0.7
    );
    ctx.strokeStyle = `rgba(196, 133, 42, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 提示文字
    ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.font = '16px "Songti SC", "STSong", serif';
    ctx.textAlign = 'center';
    ctx.fillText('正在探索周围...', cx, cy + r + 30);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '12px Arial';
    ctx.fillText('走近信件所在位置即可发现', cx, cy + r + 52);
  },

  // 绘制罗盘指示条
  drawCompassBar(ctx, w, h) {
    const barY = h - 50;
    const alpha = this._orientation.alpha || 0;

    ctx.save();
    ctx.translate(w / 2, barY);

    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    const barW = w * 0.8;
    const barH = 4;
    ctx.beginPath();
    ctx.roundRect(-barW / 2, -barH / 2, barW, barH, barH / 2);
    ctx.fill();

    // 方向标记
    const directions = [
      { label: '北', angle: 0 },
      { label: '东', angle: 90 },
      { label: '南', angle: 180 },
      { label: '西', angle: 270 },
    ];

    directions.forEach(dir => {
      let rel = dir.angle - alpha;
      if (rel > 180) rel -= 360;
      if (rel < -180) rel += 360;
      const x = (rel / 55) * (barW / 2);
      if (Math.abs(x) < barW / 2) {
        ctx.fillStyle = dir.angle === 0 ? '#c4852a' : 'rgba(255,255,255,0.5)';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(dir.label, x, -10);
      }
    });

    // 中心指示器
    ctx.fillStyle = '#c4852a';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-6, -2);
    ctx.lineTo(6, -2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  },

  // ── 清理 ──
  destroy() {
    this.stopRenderLoop();
    this.stopOrientationTracking();
    this._video = null;
    this._canvas = null;
    this._ctx = null;
    this._targets = [];
    this._currentPos = null;
  },
};
