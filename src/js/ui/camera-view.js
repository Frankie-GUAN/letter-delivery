// 此刻·此地 — 相机取景器视图（Pokémon GO 风格 AR）
const CameraView = {
  _container: null,
  _video: null,
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
    // iOS 13+ 需要用户手势触发权限请求
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      this._showOrientationPermissionPrompt();
    } else {
      this._startOrientationTracking();
    }
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
      const constraints = {
        video: { facingMode: CONFIG.CAMERA.FACING_MODE, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };
      try {
        this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e1) {
        // 降级：放宽分辨率限制
        console.warn('高分辨率摄像头不可用，尝试降级:', e1.message);
        constraints.video.width = { ideal: 640 };
        constraints.video.height = { ideal: 480 };
        this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      this._video = document.getElementById('camera-video');
      this._video.srcObject = this._stream;
      this._video.setAttribute('playsinline', '');
      this._video.setAttribute('muted', '');
      try {
        await this._video.play();
      } catch (playErr) {
        // iOS 可能需要用户手势才能播放，提供手动启动按钮
        console.warn('自动播放失败，等待用户手势:', playErr.message);
        this._showPlayButton();
        return;
      }

      this._updateGpsIndicator();
      LocationService.onChange(() => this._updateGpsIndicator());
    } catch (e) {
      console.error('摄像头启动失败:', e);
      this._showCameraError();
    }
  },

  _showPlayButton() {
    const wrapper = document.querySelector('.camera-preview-wrapper');
    if (!wrapper) return;
    const btn = document.createElement('button');
    btn.id = 'btn-start-preview';
    btn.textContent = '📷 点击启动相机';
    btn.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: var(--accent, #c4852a); color: #fff; border: none;
      border-radius: 12px; padding: 16px 32px; font-size: 18px;
      font-family: sans-serif; z-index: 30; cursor: pointer;
    `;
    btn.addEventListener('click', async () => {
      btn.remove();
      try {
        await this._video.play();
        this._updateGpsIndicator();
        LocationService.onChange(() => this._updateGpsIndicator());
      } catch (err) {
        this._showCameraError();
      }
    }, { once: true });
    wrapper.appendChild(btn);
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

  _showOrientationPermissionPrompt() {
    const arLayer = document.getElementById('camera-ar-layer');
    if (!arLayer) return;
    arLayer.innerHTML = `
      <div class="camera-perm-overlay">
        <div class="camera-perm-card">
          <div class="camera-perm-icon">🧭</div>
          <h3 class="camera-perm-title">允许使用方向传感器</h3>
          <p class="camera-perm-desc">需要访问设备方向才能在AR中看到漂浮的信封</p>
          <button class="camera-perm-btn" id="btn-orientation-perm">允许</button>
        </div>
      </div>
    `;
    document.getElementById('btn-orientation-perm').addEventListener('click', () => {
      this._handleOrientationPermission();
    });
  },

  async _handleOrientationPermission() {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== 'granted') {
        console.warn('方向权限被拒，使用虚拟朝向降级');
      }
    } catch (e) {
      console.warn('方向权限请求失败:', e);
    }
    // 无论结果如何，清除权限提示遮罩并继续（支持设备使用真实朝向，不支持则用虚拟朝向降级）
    const arLayer = document.getElementById('camera-ar-layer');
    if (arLayer) arLayer.innerHTML = '';
    this._startOrientationTracking();
  },

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
      if (video && video.videoWidth) {
        video.play().catch(() => {});
      }
    };
    window.addEventListener('resize', this._handleResize);
    window.addEventListener('orientationchange', this._handleResize);

    // 桌面端：键盘旋转虚拟朝向
    this._handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        this._virtualHeading = (this._virtualHeading - 10 + 360) % 360;
        this._lastRenderKey = '';
        this._updateCompassUI();
        this._renderFrame();
      } else if (e.key === 'ArrowRight') {
        this._virtualHeading = (this._virtualHeading + 10) % 360;
        this._lastRenderKey = '';
        this._updateCompassUI();
        this._renderFrame();
      }
    };
    window.addEventListener('keydown', this._handleKeyDown);

    // 桌面端：点击指南针旋转
    const compass = container.querySelector('#camera-compass');
    if (compass) {
      compass.addEventListener('click', () => {
        this._virtualHeading = (this._virtualHeading + 45) % 360;
        this._lastRenderKey = '';
        this._updateCompassUI();
        this._renderFrame();
      });
      compass.style.cursor = 'pointer';
      compass.title = '点击旋转朝向（桌面端）';
    }
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
        // 过期胶囊才过滤（超过解锁时间后7天自动消失）
        if (l.type === 'self_capsule' && l.capsule && now > l.capsule.unlockAt + 7 * 86400000) return false;
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
        alignmentPercent = Math.round(distRatio * 100);
      } else if (d < CONFIG.LOCATION.FAR_RANGE && letter.photo.features.length > 0) {
        // 超出近距范围但仍在可见范围内的对齐信件，尝试 CV 比对
        try {
          const score = FeatureEngine.computeAlignment(letter.photo.features, this._video);
          alignmentPercent = FeatureEngine.scoreToPercent(score);
        } catch (e) { /* 比对失败 */ }
      }

      const alignGoal = CONFIG.FEATURE.ALIGNMENT_THRESHOLD * 100;
      const tier = alignmentPercent < 30 ? 1 : alignmentPercent < 60 ? 2 : alignmentPercent < alignGoal ? 3 : 4;
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
      `${r.letter.id}:${Math.round(r.xPercent / 2)}:${r.tier}:${r.alignmentPercent >= CONFIG.FEATURE.ALIGNMENT_THRESHOLD * 100 ? 1 : 0}`
    ).join('|');
    if (renderKey === this._lastRenderKey && this._lastRenderKey !== '') return;
    this._lastRenderKey = renderKey;

    // 渲染视野内信封
    if (arLayer) {
      arLayer.innerHTML = onScreenLetters.map((r, i) => this._renderAREnvelope(r, i, onScreenLetters.length)).join('');
      if (onScreenLetters.length > 0) this._spawnParticles(arLayer);
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
    const unlocked = alignmentPercent >= CONFIG.FEATURE.ALIGNMENT_THRESHOLD * 100;
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

  _spawnParticles(arLayer) {
    const existing = arLayer.querySelectorAll('.ar-particle');
    if (existing.length >= 15) return;
    const toAdd = Math.min(8, 15 - existing.length);
    for (let i = 0; i < toAdd; i++) {
      const p = document.createElement('div');
      p.className = 'ar-particle';
      p.style.setProperty('--p-dur', `${1.5 + Math.random() * 2.5}s`);
      p.style.setProperty('--p-delay', `${Math.random() * 2}s`);
      p.style.setProperty('--p-drift', `${(Math.random() - 0.5) * 20}px`);
      p.style.left = `${10 + Math.random() * 80}%`;
      p.style.top = `${20 + Math.random() * 60}%`;
      arLayer.appendChild(p);
    }
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

        // 检查时光胶囊是否已解锁
        if (letter.type === 'self_capsule' && letter.capsule && Date.now() < letter.capsule.unlockAt) {
          const remaining = Math.round((letter.capsule.unlockAt - Date.now()) / 86400000);
          this._showCapsuleLockedHint(letter, remaining);
          return;
        }

        if (letter.type === 'secret') {
          this._showSecretModal(letter);
          return;
        }

        if (letter.photo.hasAlignment && alignment < CONFIG.FEATURE.ALIGNMENT_THRESHOLD * 100) {
          this._targetLetter = letter;
          return;
        }

        this._openLetter(letter);
      });
    });
  },

  // ---- 胶囊锁定提示 ----

  _showCapsuleLockedHint(letter, daysRemaining) {
    const arLayer = document.getElementById('camera-ar-layer');
    if (!arLayer) return;
    const existing = arLayer.querySelector('.capsule-locked-hint');
    if (existing) existing.remove();
    const hint = document.createElement('div');
    hint.className = 'capsule-locked-hint';
    hint.innerHTML = `<span>⏳</span><span>${daysRemaining > 0 ? `${daysRemaining}天后解锁` : '即将解锁'}</span>`;
    hint.style.cssText = `
      position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(26,24,21,0.85); color: #d4a853; padding: 10px 20px;
      border-radius: 20px; font-size: 14px; z-index: 25; pointer-events: none;
      border: 1px solid rgba(212,168,83,0.4); text-align: center;
    `;
    arLayer.appendChild(hint);
    setTimeout(() => hint.remove(), 2500);
  },

  // ---- 密信弹窗 ----

  _showSecretModal(letter) {
    Helpers.showPassphraseModal(letter, {
      onSuccess: (_letter, overlay) => {
        overlay.remove();
        this._openLetter(letter);
      },
    });
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
    if (fill) fill.classList.toggle('success', percent >= CONFIG.FEATURE.ALIGNMENT_THRESHOLD * 100);
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

      const maxW = Math.min(this._video.videoWidth, CONFIG.CAMERA.PHOTO_MAX_WIDTH);
      const maxH = Math.min(this._video.videoHeight, CONFIG.CAMERA.PHOTO_MAX_WIDTH);
      const canvas = Helpers.scaleImageToCanvas(this._video, maxW, maxH);
      const ctx = canvas.getContext('2d');

      // 叠加 AR 信封
      const heading = this._getHeading();
      const pos = LocationService.getCurrent();
      if (pos && this._letterCache.length > 0) {
        const fov = this._fov;
        this._letterCache.forEach(cached => {
          let diff = cached.bearing - heading;
          while (diff > 180) diff -= 360;
          while (diff < -180) diff += 360;
          if (Math.abs(diff) >= fov / 2 + 5) return;

          const xPercent = 50 + (diff / (fov / 2)) * 50;
          const cx = (xPercent / 100) * maxW;
          const cy = maxH * (0.15 + (1 - cached.distRatio) * 0.55);

          // 信封图标
          const emoji = cached.letter.type === 'secret' ? '🔒' : cached.letter.type === 'self_capsule' ? '⏳' : '✉️';
          ctx.font = `${Math.round(24 + cached.distRatio * 20)}px serif`;
          ctx.textAlign = 'center';
          ctx.fillText(emoji, cx, cy);

          // 距离标签
          if (cached.distRatio > 0.3) {
            ctx.font = `${Math.round(11 + cached.distRatio * 4)}px sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 3;
            ctx.fillText(`${Math.round(cached.d)}m`, cx, cy + 24 + cached.distRatio * 10);
            ctx.shadowBlur = 0;
          }
        });
      }

      const dataURL = canvas.toDataURL('image/jpeg', CONFIG.CAMERA.PHOTO_QUALITY);

      const thumbCanvas = Helpers.scaleImageToCanvas(canvas, 128, 128);
      const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);

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
    if (this._handleKeyDown) {
      window.removeEventListener('keydown', this._handleKeyDown);
      this._handleKeyDown = null;
    }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    this._video = null;
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
