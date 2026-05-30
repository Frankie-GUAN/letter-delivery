// 此刻·此地 — 相机取景器视图
const CameraView = {
  _container: null,
  _video: null,
  _canvas: null,
  _stream: null,
  _sampleTimer: null,
  _targetLetter: null,
  _currentAlignment: 0,

  async render(container, params = {}) {
    this._container = container;
    container.innerHTML = `
      <div class="camera-view">
        <div class="camera-top-bar">
          <button class="camera-back-btn" id="btn-camera-back">＜ 返回地图</button>
          <div class="camera-gps-indicator" id="camera-gps-indicator">📍 定位中...</div>
        </div>
        <div class="camera-preview-wrapper">
          <video id="camera-video" autoplay playsinline muted></video>
          <canvas id="camera-overlay" class="camera-overlay"></canvas>
          <div class="camera-ar-layer" id="camera-ar-layer"></div>
        </div>
        <div class="camera-alignment-bar" id="camera-alignment-bar" style="display:none;">
          <div class="alignment-label">🔍 对齐进度</div>
          <div class="alignment-track">
            <div class="alignment-fill" id="alignment-fill"></div>
          </div>
          <div class="alignment-percent" id="alignment-percent">0%</div>
        </div>
        <div class="camera-bottom-bar">
          <button class="camera-btn primary" id="btn-take-photo">📷 拍照写信</button>
          <button class="camera-btn" id="btn-focus">🎯 对焦</button>
        </div>
        <div class="camera-no-letter-hint" id="camera-no-letter-hint" style="display:none;">
          <div class="hint-text">✨ 这里还没有信</div>
          <button class="camera-btn primary" id="btn-first-letter">📝 在此留下第一封信</button>
        </div>
      </div>
    `;

    await this._startCamera();
    this._bindEvents(container);

    if (params.targetLetterId) {
      await this._enterAlignmentMode(params.targetLetterId);
    } else {
      this._startSampleLoop();
    }
  },

  async _startCamera() {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: CONFIG.CAMERA.FACING_MODE, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      this._video = document.getElementById('camera-video');
      this._video.srcObject = this._stream;
      await this._video.play();

      this._canvas = document.getElementById('camera-overlay');
      this._canvas.width = this._video.videoWidth || 640;
      this._canvas.height = this._video.videoHeight || 480;

      this._updateGpsIndicator();
      LocationService.onChange(() => this._updateGpsIndicator());
    } catch (e) {
      console.error('摄像头启动失败:', e);
      this._showCameraError();
    }
  },

  _updateGpsIndicator() {
    const el = document.getElementById('camera-gps-indicator');
    if (!el) return;
    const pos = LocationService.getCurrent();
    if (pos && LocationService.isValid()) {
      el.textContent = `📍 GPS已锁定 (±${Math.round(pos.accuracy)}m)`;
      el.classList.add('locked');
    } else {
      el.textContent = '📍 定位中...';
      el.classList.remove('locked');
    }
  },

  _showCameraError() {
    const arLayer = document.getElementById('camera-ar-layer');
    if (arLayer) {
      arLayer.innerHTML = '<div class="camera-error-msg">📷 无法访问摄像头，请检查权限设置</div>';
    }
  },

  _bindEvents(container) {
    container.querySelector('#btn-camera-back').addEventListener('click', () => {
      this._stopSampleLoop();
      this._stopCamera();
      App.navigateTo('map');
    });

    container.querySelector('#btn-take-photo').addEventListener('click', () => {
      this._captureAndCompose();
    });

    container.querySelector('#btn-focus').addEventListener('click', () => {
      this._refocus();
    });

    const firstLetterBtn = container.querySelector('#btn-first-letter');
    if (firstLetterBtn) {
      firstLetterBtn.addEventListener('click', () => {
        this._captureAndCompose();
      });
    }
  },

  async _enterAlignmentMode(letterId) {
    try {
      this._targetLetter = await StorageService.getLetterById(letterId);
      if (!this._targetLetter) return;

      const bar = document.getElementById('camera-alignment-bar');
      if (bar) bar.style.display = 'block';

      this._startSampleLoop();
    } catch (e) {
      console.warn('进入对齐模式失败:', e);
    }
  },

  _startSampleLoop() {
    this._stopSampleLoop();
    this._sampleTimer = setInterval(() => {
      this._processFrame();
    }, CONFIG.CAMERA.SAMPLE_INTERVAL);
  },

  _stopSampleLoop() {
    if (this._sampleTimer) {
      clearInterval(this._sampleTimer);
      this._sampleTimer = null;
    }
  },

  _processFrame() {
    if (!this._video || !this._canvas || !this._targetLetter) return;

    const pos = LocationService.getCurrent();
    if (!pos) return;

    const d = Helpers.distanceBetween(
      pos.lat, pos.lng,
      this._targetLetter.location.lat, this._targetLetter.location.lng
    );

    const arLayer = document.getElementById('camera-ar-layer');
    const noLetterHint = document.getElementById('camera-no-letter-hint');
    const bar = document.getElementById('camera-alignment-bar');

    // 距离分层
    if (d > CONFIG.LOCATION.FAR_RANGE) {
      // >20m：不显示信封，仅提示太远
      if (arLayer) {
        arLayer.innerHTML = `
          <div class="ar-distance-hint">
            <div class="ar-far-icon">📡</div>
            <div class="ar-far-text">距离目标约 ${Math.round(d)}m</div>
            <div class="ar-far-sub">再走近一些，信封就会出现</div>
          </div>
        `;
      }
      if (bar) bar.style.display = 'none';
      if (noLetterHint) noLetterHint.style.display = 'none';
      return;
    }

    if (d > CONFIG.LOCATION.NEARBY_RANGE) {
      // 10-20m：小光点方向指示
      if (arLayer) {
        arLayer.innerHTML = `
          <div class="ar-distance-hint nearby">
            <div class="ar-nearby-dot"></div>
            <div class="ar-nearby-text">约 ${Math.round(d)}m · 正在接近...</div>
          </div>
        `;
      }
      if (bar) bar.style.display = 'none';
      if (noLetterHint) noLetterHint.style.display = 'none';
      return;
    }

    // <10m：进入对齐模式
    if (noLetterHint) noLetterHint.style.display = 'none';

    if (this._targetLetter.photo.hasAlignment && this._targetLetter.photo.features.length > 0) {
      const score = FeatureEngine.computeAlignment(
        this._targetLetter.photo.features,
        this._video
      );
      this._currentAlignment = FeatureEngine.scoreToPercent(score);
      this._updateAlignmentUI(this._currentAlignment);
      this._updateARLayer(this._currentAlignment);
      if (bar) bar.style.display = 'block';
    } else {
      this._currentAlignment = 100;
      this._updateARLayer(100);
      if (bar) bar.style.display = 'none';
    }
  },

  _updateAlignmentUI(percent) {
    const fill = document.getElementById('alignment-fill');
    const label = document.getElementById('alignment-percent');
    if (fill) fill.style.width = `${percent}%`;
    if (label) label.textContent = `${percent}%`;

    if (percent >= 90) {
      if (fill) fill.classList.add('success');
    } else {
      if (fill) fill.classList.remove('success');
    }
  },

  _updateARLayer(percent) {
    const arLayer = document.getElementById('camera-ar-layer');
    if (!arLayer || !this._targetLetter) return;

    const letter = this._targetLetter;
    const tier = percent < 30 ? 1 : percent < 60 ? 2 : percent < 90 ? 3 : 4;

    // 信封基础样式
    const opacity = 0.2 + (percent / 100) * 0.8;
    const scale = 0.5 + (percent / 100) * 0.5;

    let content = '';

    if (tier === 1) {
      // 0-30%: 虚线轮廓 + 光晕闪烁
      content = `
        <div class="ar-envelope tier-1" style="opacity: ${opacity}; transform: scale(${scale});">
          <div class="ar-ghost-outline"></div>
          <div class="ar-ghost-glow"></div>
          <div class="ar-ghost-label">✉️ 附近有一封信</div>
        </div>
      `;
    } else if (tier === 2) {
      // 30-60%: 轮廓清晰 + 浮现头像 + 标题模糊可见
      content = `
        <div class="ar-envelope tier-2" style="opacity: ${opacity}; transform: scale(${scale});">
          <div class="ar-env-icon">${letter.sender.avatar || '✉️'}</div>
          <div class="ar-env-sender">${Helpers.escapeHtml(letter.sender.nickname)}</div>
          <div class="ar-env-title-faint">${Helpers.escapeHtml(letter.content.title || '...')}</div>
        </div>
      `;
    } else if (tier === 3) {
      // 60-90%: 信纸徐徐展开，文字逐渐可辨
      content = `
        <div class="ar-envelope tier-3" style="opacity: ${opacity}; transform: scale(${scale});">
          <div class="ar-paper-unfolding">
            <div class="ar-paper-crest">${letter.sender.avatar || '✉️'}</div>
            <div class="ar-paper-sender">${Helpers.escapeHtml(letter.sender.nickname)}</div>
            <div class="ar-paper-title">${Helpers.escapeHtml(letter.content.title || '无名信')}</div>
            <div class="ar-paper-tease">${Helpers.escapeHtml((letter.content.body || '').slice(0, 40))}...</div>
          </div>
        </div>
      `;
    } else {
      // 90-100%: 完全清晰 + 照片浮现 + 可打开
      content = `
        <div class="ar-envelope tier-4 unlocked" style="opacity: ${opacity}; transform: scale(${scale});">
          <div class="ar-unlocked-card">
            ${letter.photo.thumbnail ? `<img src="${letter.photo.thumbnail}" class="ar-card-photo" alt="">` : ''}
            <div class="ar-card-icon">${letter.sender.avatar || '✉️'}</div>
            <div class="ar-card-sender">${Helpers.escapeHtml(letter.sender.nickname)}</div>
            <div class="ar-card-title">${Helpers.escapeHtml(letter.content.title || '无名信')}</div>
            <div class="ar-card-mood">${letter.content.mood ? '情绪：' + letter.content.mood : ''}</div>
            <button class="ar-open-btn" id="btn-open-letter">💌 打开这封信</button>
          </div>
        </div>
      `;
    }

    arLayer.innerHTML = content;

    const openBtn = arLayer.querySelector('#btn-open-letter');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        this._openLetter();
      });
    }
  },

  _openLetter() {
    this._stopSampleLoop();
    SoundEngine.playOpenLetter();

    // 信封翻开动画
    const arLayer = document.getElementById('camera-ar-layer');
    if (arLayer) {
      arLayer.innerHTML = `
        <div class="ar-open-anim">
          <div class="ar-open-flash"></div>
          <div class="ar-open-letter-icon">💌</div>
        </div>
      `;
    }

    // 短暂过渡后跳转
    setTimeout(() => {
      this._stopCamera();
      App.navigateTo('read', { letterId: this._targetLetter.id });
    }, 600);
  },

  _playShutterSound() {
    SoundEngine.playShutter();
  },

  async _captureAndCompose() {
    if (!this._video) return;
    try {
      this._playShutterSound();

      const canvas = Helpers.scaleImageToCanvas(
        this._video,
        Math.min(this._video.videoWidth, CONFIG.CAMERA.PHOTO_MAX_WIDTH),
        Math.min(this._video.videoHeight, CONFIG.CAMERA.PHOTO_MAX_WIDTH)
      );
      const dataURL = canvas.toDataURL('image/jpeg', CONFIG.CAMERA.PHOTO_QUALITY);

      const thumbCanvas = Helpers.scaleImageToCanvas(canvas, 128, 128);
      const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);

      const pos = LocationService.getCurrent();
      if (!pos) {
        alert('无法获取当前位置，请检查定位权限');
        return;
      }

      this._stopSampleLoop();
      this._stopCamera();
      App.navigateTo('compose', {
        photoData: { dataURL, thumbnail },
        location: { lat: pos.lat, lng: pos.lng },
      });
    } catch (e) {
      console.error('拍照失败:', e);
      alert('拍照失败，请重试');
    }
  },

  _refocus() {
    if (this._video && this._stream) {
      const track = this._stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        try {
          const caps = track.getCapabilities();
          if (caps.focusMode && caps.focusMode.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch (e) { /* 不支持，静默 */ }
      }
    }
  },

  _stopCamera() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    this._video = null;
    this._canvas = null;
    this._targetLetter = null;
    this._currentAlignment = 0;
  },
};
