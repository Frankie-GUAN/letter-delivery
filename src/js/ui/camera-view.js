// 此刻·此地 — 相机取景器视图（Pokémon GO 风格 AR）
const CameraView = {
  _container: null,
  _video: null,
  _canvas: null,
  _stream: null,
  _sampleTimer: null,
  _targetLetter: null,
  _nearbyLetters: [],
  _letterCache: [],
  _currentAlignment: 0,
  _heading: null,
  _smoothHeading: null,
  _virtualHeading: 0,
  _pitch: 0,
  _fov: 60,
  _lastRenderKey: '',
  _lastOrientationRender: 0,

  async render(container, params = {}) {
    this._container = container;
    container.innerHTML = `
      <div class="camera-view">
        <div class="camera-top-bar">
          <button class="camera-back-btn" id="btn-camera-back">＜ 返回地图</button>
          <div class="camera-gps-indicator" id="camera-gps-indicator">📍 定位中...</div>
          <div class="camera-compass" id="camera-compass">🧭 北</div>
        </div>
        <div class="camera-preview-wrapper">
          <video id="camera-video" autoplay playsinline muted></video>
          <canvas id="camera-overlay" class="camera-overlay"></canvas>
          <div class="camera-ar-layer" id="camera-ar-layer"></div>
          <div class="camera-radar" id="camera-radar"></div>
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
          <div class="hint-text">✨ 这个方向还没有信</div>
          <div class="hint-sub">转动手机探索四周</div>
          <button class="camera-btn primary" id="btn-first-letter">📝 在此留下第一封信</button>
        </div>
      </div>
    `;

    await this._startCamera();
    this._startOrientationTracking();
    this._bindEvents(container);

    this._virtualHeading = 0;
    this._smoothHeading = null;
    this._lastRenderKey = '';

    this._targetLetter = null;
    if (params.targetLetterId) {
      try {
        this._targetLetter = await StorageService.getLetterById(params.targetLetterId);
      } catch (e) { /* 找不到就算了 */ }
    }

    this._startSampleLoop();
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

  // ---- 朝向获取 ----

  _getHeading() {
    if (this._smoothHeading !== null) return this._smoothHeading;
    return this._virtualHeading;
  },

  _compassLabel(deg) {
    const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return dirs[Math.round(deg / 45) % 8];
  },

  _updateCompassUI() {
    const el = document.getElementById('camera-compass');
    if (!el) return;
    const h = this._getHeading();
    el.textContent = `🧭 ${this._compassLabel(h)} ${Math.round(h)}°`;
    el.classList.toggle('virtual', this._smoothHeading === null);
  },

  // ---- 设备方向追踪 ----

  _startOrientationTracking() {
    this._stopOrientationTracking();

    const updateHeading = (rawHeading, beta) => {
      if (rawHeading === null || rawHeading === undefined) return;
      if (this._smoothHeading === null) {
        this._smoothHeading = rawHeading;
      } else {
        const alpha = 0.25;
        let diff = rawHeading - this._smoothHeading;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        this._smoothHeading = (this._smoothHeading + diff * alpha + 360) % 360;
      }
      if (beta !== null && beta !== undefined) this._pitch = beta;
      this._updateCompassUI();

      const now = Date.now();
      if (now - this._lastOrientationRender > 120) {
        this._lastOrientationRender = now;
        this._renderFrame();
      }
    };

    const absHandler = (e) => {
      let h = null;
      if (e.webkitCompassHeading !== undefined) {
        h = (360 - e.webkitCompassHeading + 360) % 360;
      } else if (e.alpha !== null) {
        h = (e.alpha + 360) % 360;
      }
      updateHeading(h, e.beta);
    };

    const relHandler = (e) => {
      if (e.webkitCompassHeading !== undefined) {
        updateHeading((360 - e.webkitCompassHeading + 360) % 360, e.beta);
      }
    };

    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', absHandler, true);
    }
    window.addEventListener('deviceorientation', relHandler, true);
    this._orientationHandler = { abs: absHandler, rel: relHandler };
  },

  _stopOrientationTracking() {
    if (this._orientationHandler) {
      window.removeEventListener('deviceorientationabsolute', this._orientationHandler.abs, true);
      window.removeEventListener('deviceorientation', this._orientationHandler.rel, true);
      this._orientationHandler = null;
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
      this._stopOrientationTracking();
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

    this._handleResize = () => {
      if (!this._stream) return;
      const video = document.getElementById('camera-video');
      const canvas = document.getElementById('camera-overlay');
      if (video && canvas && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    };
    window.addEventListener('resize', this._handleResize);
    window.addEventListener('orientationchange', this._handleResize);
  },

  // ---- 数据循环（1s间隔） ----

  _startSampleLoop() {
    this._stopSampleLoop();
    this._sampleTimer = setInterval(() => this._processFrame(), CONFIG.CAMERA.SAMPLE_INTERVAL);
    this._processFrame();
  },

  _stopSampleLoop() {
    if (this._sampleTimer) {
      clearInterval(this._sampleTimer);
      this._sampleTimer = null;
    }
  },

  // ---- 数据更新：取信 + CV比对（仅此处执行CV） ----

  async _processFrame() {
    if (!this._video) return;

    const pos = LocationService.getCurrent();
    if (!pos) return;

    try {
      const allNearby = await StorageService.getNearbyLetters(pos.lat, pos.lng);
      const now = Date.now();
      this._nearbyLetters = allNearby.filter(l => {
        if (l.type === 'self_capsule' && l.capsule && now < l.capsule.unlockAt) return false;
        return true;
      });
    } catch (e) {
      this._nearbyLetters = [];
    }

    // 桌面端：初始朝向指向最近的信
    if (this._smoothHeading === null && this._nearbyLetters.length > 0 && this._virtualHeading === 0) {
      let nearest = null;
      let nearestD = Infinity;
      this._nearbyLetters.forEach(l => {
        const d = Helpers.distanceBetween(pos.lat, pos.lng, l.location.lat, l.location.lng);
        if (d < nearestD) { nearestD = d; nearest = l; }
      });
      if (nearest) {
        this._virtualHeading = this._bearingBetween(
          pos.lat, pos.lng, nearest.location.lat, nearest.location.lng
        );
        this._updateCompassUI();
      }
    }

    // CV 比对 → 缓存
    let bestLetter = null;
    let bestScore = 0;

    this._letterCache = this._nearbyLetters.map(letter => {
      const d = Helpers.distanceBetween(pos.lat, pos.lng, letter.location.lat, letter.location.lng);
      const bearing = this._bearingBetween(pos.lat, pos.lng, letter.location.lat, letter.location.lng);
      const distRatio = Math.max(0, Math.min(1, 1 - (d / CONFIG.LOCATION.FAR_RANGE)));

      let alignmentPercent = 0;
      const isTarget = this._targetLetter && letter.id === this._targetLetter.id;
      const isNear = d < CONFIG.LOCATION.NEARBY_RANGE;

      if ((isTarget || isNear) && letter.photo.hasAlignment && letter.photo.features.length > 0) {
        try {
          const score = FeatureEngine.computeAlignment(letter.photo.features, this._video);
          alignmentPercent = FeatureEngine.scoreToPercent(score);
          if (alignmentPercent > bestScore) {
            bestScore = alignmentPercent;
            bestLetter = letter;
          }
        } catch (e) { /* 比对失败 */ }
      } else if (!letter.photo.hasAlignment) {
        alignmentPercent = 100;
      }

      const tier = alignmentPercent < 30 ? 1 : alignmentPercent < 60 ? 2 : alignmentPercent < 90 ? 3 : 4;
      return { letter, d, bearing, distRatio, alignmentPercent, tier };
    });

    this._currentAlignment = bestScore;
    this._bestLetter = bestLetter;

    // 数据变化 → 强制重渲染
    this._lastRenderKey = '';
    this._renderFrame();
  },

  // ---- 渲染：比对渲染键避免重复DOM重建（消除闪烁） ----

  _renderFrame() {
    const pos = LocationService.getCurrent();
    if (!pos) return;

    const arLayer = document.getElementById('camera-ar-layer');
    const noHint = document.getElementById('camera-no-letter-hint');
    const bar = document.getElementById('camera-alignment-bar');
    const radar = document.getElementById('camera-radar');

    if (this._letterCache.length === 0) {
      if (arLayer) arLayer.innerHTML = '';
      if (noHint) noHint.style.display = 'block';
      if (bar) bar.style.display = 'none';
      if (radar) radar.innerHTML = '';
      return;
    }

    if (noHint) noHint.style.display = 'none';

    const heading = this._getHeading();

    // 计算朝向相关值
    const renderedLetters = this._letterCache.map(cached => {
      let diff = cached.bearing - heading;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;

      const onScreen = Math.abs(diff) < this._fov / 2;
      const onScreenWide = Math.abs(diff) < this._fov / 2 + 10;
      const xPercent = 50 + (diff / (this._fov / 2)) * 50;
      const isCentered = onScreen && Math.abs(diff) < 15 && cached.d < CONFIG.LOCATION.NEARBY_RANGE;

      return { ...cached, diff, onScreen, onScreenWide, xPercent, isCentered };
    });

    // 对齐条
    if (this._bestLetter && this._currentAlignment > 0) {
      this._updateAlignmentUI(this._currentAlignment);
      if (bar) bar.style.display = 'block';
    } else if (this._targetLetter && this._targetLetter.photo.hasAlignment) {
      if (bar) bar.style.display = 'block';
    } else {
      if (bar) bar.style.display = 'none';
    }

    const onScreenLetters = renderedLetters.filter(r => r.onScreenWide);
    const offScreenLetters = renderedLetters.filter(r => !r.onScreenWide);
    onScreenLetters.sort((a, b) => b.distRatio - a.distRatio);

    // 渲染键：仅当信封位置/状态变化时才重建DOM，消除闪烁
    const renderKey = onScreenLetters.map(r =>
      `${r.letter.id}:${Math.round(r.xPercent / 3)}:${r.tier}:${r.alignmentPercent >= 90 ? 1 : 0}`
    ).join('|');
    if (renderKey === this._lastRenderKey && this._lastRenderKey !== '') return;
    this._lastRenderKey = renderKey;

    // 渲染视野内信封
    if (arLayer) {
      arLayer.innerHTML = onScreenLetters.map((r, i) => this._renderAREnvelope(r, i, onScreenLetters.length)).join('');
    }

    // 雷达：视野外方向提示
    let radarHtml = '';
    if (offScreenLetters.length > 0) {
      radarHtml = offScreenLetters.map(r => {
        const side = r.diff < 0 ? 'left' : 'right';
        const posPct = Math.min(92, Math.max(8, (Math.abs(r.diff) / 180) * 100));
        const emoji = r.letter.type === 'secret' ? '🔒' : r.letter.type === 'self_capsule' ? '⏳' : '✉️';
        return `<div class="radar-dot ${side}" style="${side}:${posPct}%;" title="${Helpers.escapeHtml(r.letter.content.title || '信')} · ${Math.round(r.d)}m">${emoji}</div>`;
      }).join('');
    }
    if (radar) radar.innerHTML = radarHtml;

    this._bindEnvelopeClicks(arLayer, onScreenLetters);
  },

  // ---- 渲染单个 AR 信封 ----

  _renderAREnvelope(r, index, total) {
    const { letter, d, diff, onScreen, xPercent, distRatio, alignmentPercent, tier, isCentered } = r;
    const typeIcon = { public: '📮', self_capsule: '⏳', secret: '🔒' }[letter.type];
    const unlocked = alignmentPercent >= 90;
    const focused = isCentered && alignmentPercent > 0;

    // 3D 深度
    const tz = -280 + distRatio * 480;
    const scale = 0.3 + distRatio * 0.7;
    const zIdx = Math.round(5 + distRatio * 15);

    // 边缘渐隐
    const edgeFade = onScreen ? 1 : Math.max(0, 1 - (Math.abs(diff) - this._fov / 2) / 10);
    const opacity = (0.2 + distRatio * 0.8) * edgeFade;

    const xPos = Math.max(5, Math.min(95, xPercent));
    const ry = (diff / (this._fov / 2)) * 35;
    const rx = this._pitch ? -this._pitch * 0.1 : 0;

    // 稳定动画参数
    const idHash = letter.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const floatDur = 3.0 + (idHash % 7) * 0.35;
    const floatDelay = (idHash % 13) * 0.25;

    // 距离标签
    const distLabel = d < 1000 ? `${Math.round(d)}m` : `${(d/1000).toFixed(1)}km`;

    // ---- Tier 内容（含信封造型） ----
    let inner = '';
    const senderName = Helpers.escapeHtml(letter.sender.nickname);
    const title = Helpers.escapeHtml(letter.content.title || '无名信');

    if (tier === 1) {
      // 远处：幽灵信封轮廓
      inner = `
        <div class="ar-env-shape ghost">
          <div class="ar-env-flap"></div>
          <div class="ar-env-seal">${typeIcon}</div>
        </div>
        <div class="ar-env-label-ghost">${typeIcon}</div>
      `;
    } else if (tier === 2) {
      // 浮现：半透明信封 + 发送者
      inner = `
        <div class="ar-env-shape faint">
          <div class="ar-env-flap"></div>
          <div class="ar-env-seal">${letter.sender.avatar || '✉️'}</div>
        </div>
        <div class="ar-env-sender">${senderName}</div>
        <div class="ar-env-title-faint">${title}</div>
      `;
    } else if (tier === 3) {
      // 展开：信封开口 + 信纸预览
      inner = `
        <div class="ar-env-shape open">
          <div class="ar-env-flap lifted"></div>
          <div class="ar-paper-tease-slim">${Helpers.escapeHtml((letter.content.body || '').slice(0, 30))}...</div>
        </div>
        <div class="ar-env-sender">${senderName}</div>
        <div class="ar-paper-title">${title}</div>
      `;
    } else {
      // 完全清晰：信纸卡片
      inner = `
        <div class="ar-unlocked-card">
          ${letter.photo.thumbnail ? `<img src="${letter.photo.thumbnail}" class="ar-card-photo" alt="">` : ''}
          <div class="ar-card-icon">${letter.sender.avatar || '✉️'}</div>
          <div class="ar-card-sender">${senderName}</div>
          <div class="ar-card-title">${title}</div>
          <div class="ar-card-mood">${letter.content.mood ? letter.content.mood : ''}</div>
          ${unlocked ? '<button class="ar-open-btn">💌 打开这封信</button>' : ''}
        </div>
      `;
    }

    return `
      <div class="ar-envelope tier-${tier} ${unlocked ? 'unlocked' : ''} ${focused ? 'focused' : ''}"
           data-letter-id="${letter.id}"
           data-alignment="${alignmentPercent}"
           style="--lx:${xPos}%; --tz:${tz}px; --op:${opacity}; --zi:${zIdx};">
        <div class="ar-envelope-body" style="--ry:${ry}deg; --rx:${rx}deg; --s:${scale}; --float-dur:${floatDur}s; --float-delay:${floatDelay}s;">
          ${inner}
          <div class="ar-dist-badge">${distLabel}</div>
          ${alignmentPercent > 0 ? `<div class="ar-align-badge">${alignmentPercent}%</div>` : ''}
        </div>
      </div>
    `;
  },

  _bindEnvelopeClicks(arLayer, renderedLetters) {
    if (!arLayer) return;
    arLayer.querySelectorAll('.ar-envelope').forEach(el => {
      const newEl = el.cloneNode(true);
      el.parentNode.replaceChild(newEl, el);

      newEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const letterId = newEl.dataset.letterId;
        const alignment = parseInt(newEl.dataset.alignment) || 0;
        const r = renderedLetters.find(r => r.letter.id === letterId);
        if (!r) return;

        const letter = r.letter;

        if (letter.type === 'secret') {
          this._showSecretModal(letter);
          return;
        }

        if (letter.photo.hasAlignment && alignment < 90) {
          this._targetLetter = letter;
          return;
        }

        this._openLetter(letter);
      });
    });
  },

  // ---- 密信弹窗 ----

  _showSecretModal(letter) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card passphrase-modal">
        <div class="modal-close" id="modal-close">✕</div>
        <div class="passphrase-icon">🔒</div>
        <h3 class="passphrase-title">这是一封密信</h3>
        <p class="passphrase-hint">由 ${Helpers.escapeHtml(letter.sender.nickname)} 留给 ${(letter.secret.recipients || ['某人']).join('、')}</p>
        <div class="passphrase-input-wrap">
          <input type="text" class="passphrase-input" id="passphrase-input"
                 maxlength="20" placeholder="输入8位口令..." autocomplete="off">
          <div class="passphrase-error" id="passphrase-error" style="display:none;"></div>
        </div>
        <button class="passphrase-submit" id="btn-passphrase-submit">🔍 寻找这封信</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = overlay.querySelector('#modal-close');
    const input = overlay.querySelector('#passphrase-input');
    const submit = overlay.querySelector('#btn-passphrase-submit');
    const errorEl = overlay.querySelector('#passphrase-error');

    const closeModal = () => overlay.remove();
    close.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    submit.addEventListener('click', () => {
      const phrase = input.value.trim();
      if (!phrase) return;
      if (phrase !== letter.secret.passphrase) {
        errorEl.textContent = '口令不正确，再试一次';
        errorEl.style.display = 'block';
        input.classList.add('error');
        return;
      }
      overlay.remove();
      this._openLetter(letter);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit.click();
    });
    setTimeout(() => input.focus(), 100);
  },

  // ---- 打开信件 ----

  _openLetter(letter) {
    this._stopSampleLoop();
    this._stopOrientationTracking();
    try { SoundEngine.playOpenLetter(); } catch (e) { /* SoundEngine may not be loaded */ }

    const arLayer = document.getElementById('camera-ar-layer');
    if (arLayer) {
      arLayer.innerHTML = `
        <div class="ar-open-anim">
          <div class="ar-open-flash"></div>
          <div class="ar-open-letter-icon">💌</div>
        </div>
      `;
    }

    setTimeout(() => {
      this._stopCamera();
      App.navigateTo('read', { letterId: letter.id });
    }, 600);
  },

  // ---- 工具函数 ----

  _bearingBetween(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const rLat1 = lat1 * Math.PI / 180;
    const rLat2 = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(rLat2);
    const x = Math.cos(rLat1) * Math.sin(rLat2) - Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLng);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  },

  _headingDiff(letterBearing) {
    const heading = this._getHeading();
    let diff = letterBearing - heading;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  },

  _updateAlignmentUI(percent) {
    const fill = document.getElementById('alignment-fill');
    const label = document.getElementById('alignment-percent');
    if (fill) fill.style.width = `${percent}%`;
    if (label) label.textContent = `${percent}%`;
    if (fill) fill.classList.toggle('success', percent >= 90);
  },

  // ---- 拍照 ----

  _playShutterSound() {
    try { SoundEngine.playShutter(); } catch (e) { /* fallback to built-in */ }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.3;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2000;
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.08);
      if (navigator.vibrate) navigator.vibrate(30);
    } catch (e) { /* 静默失败 */ }
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
      this._stopOrientationTracking();
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
        } catch (e) { /* 不支持 */ }
      }
    }
  },

  _stopCamera() {
    if (this._handleResize) {
      window.removeEventListener('resize', this._handleResize);
      window.removeEventListener('orientationchange', this._handleResize);
      this._handleResize = null;
    }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    this._video = null;
    this._canvas = null;
    this._targetLetter = null;
    this._nearbyLetters = [];
    this._letterCache = [];
    this._bestLetter = null;
    this._currentAlignment = 0;
    this._virtualHeading = 0;
    this._smoothHeading = null;
    this._lastRenderKey = '';
  },
};
