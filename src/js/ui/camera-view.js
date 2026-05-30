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

    if (d > CONFIG.LOCATION.FAR_RANGE) {
      if (arLayer) arLayer.innerHTML = '';
      if (noLetterHint) noLetterHint.style.display = 'none';
      return;
    }

    // 在范围内，进行特征比对
    if (this._targetLetter.photo.hasAlignment && this._targetLetter.photo.features.length > 0) {
      const score = FeatureEngine.computeAlignment(
        this._targetLetter.photo.features,
        this._video
      );
      this._currentAlignment = FeatureEngine.scoreToPercent(score);
      this._updateAlignmentUI(this._currentAlignment);
      this._updateARLayer(this._currentAlignment);
    } else {
      this._currentAlignment = 100;
      this._updateARLayer(100);
      const bar = document.getElementById('camera-alignment-bar');
      if (bar) bar.style.display = 'none';
    }

    if (noLetterHint) noLetterHint.style.display = 'none';
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

    const opacity = percent / 100;
    const blurAmount = Math.max(0, (1 - opacity) * 10);
    const scale = 0.6 + opacity * 0.4;

    arLayer.innerHTML = `
      <div class="ar-envelope ${percent >= 90 ? 'unlocked' : ''}"
           style="opacity: ${opacity}; filter: blur(${blurAmount}px); transform: scale(${scale});">
        <div class="ar-envelope-icon">${this._targetLetter.sender.avatar || '✉️'}</div>
        <div class="ar-envelope-sender">${Helpers.escapeHtml(this._targetLetter.sender.nickname)}</div>
        ${percent >= 90 ? `
          <button class="ar-open-btn" id="btn-open-letter">💌 打开这封信</button>
        ` : ''}
      </div>
    `;

    const openBtn = arLayer.querySelector('#btn-open-letter');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        this._openLetter();
      });
    }
  },

  _openLetter() {
    this._stopSampleLoop();
    this._stopCamera();
    App.navigateTo('read', { letterId: this._targetLetter.id });
  },

  async _captureAndCompose() {
    if (!this._video) return;
    try {
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
