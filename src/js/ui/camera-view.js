// 此刻·此地 — 相机取景器视图（AR引擎版）
const CameraView = {
  _container: null,
  _video: null,
  _stream: null,
  _targetLetter: null,
  _nearbyLetters: [],
  _currentAlignment: 0,
  _arActive: false,
  _arPermissionGranted: false,

  async render(container, params = {}) {
    this._container = container;
    this._currentAlignment = 0;
    this._targetLetter = null;
    this._nearbyLetters = [];

    container.innerHTML = `
      <div class="camera-view">
        <div class="camera-top-bar">
          <button class="camera-back-btn" id="btn-camera-back">＜ 返回</button>
          <div class="camera-gps-indicator" id="camera-gps-indicator">📍 定位中...</div>
        </div>
        <div class="camera-preview-wrapper">
          <video id="camera-video" autoplay playsinline muted
                 style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;"></video>
          <canvas id="camera-overlay" class="camera-overlay"
                  style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;"></canvas>
          <div class="camera-ar-layer" id="camera-ar-layer" style="display:none;"></div>
        </div>
        <div class="camera-alignment-bar" id="camera-alignment-bar" style="display:none;">
          <div class="alignment-label">🔍 场景对齐</div>
          <div class="alignment-track">
            <div class="alignment-fill" id="alignment-fill"></div>
          </div>
          <div class="alignment-percent" id="alignment-percent">0%</div>
        </div>
        <div class="camera-bottom-bar">
          <button class="camera-btn primary" id="btn-take-photo">📷 拍照写信</button>
          <button class="camera-btn" id="btn-toggle-ar" style="display:none;">🌐 AR</button>
        </div>
        <div class="camera-no-letter-hint" id="camera-no-letter-hint" style="display:none;">
          <div class="hint-text">✨ 这里还没有信</div>
          <button class="camera-btn primary" id="btn-first-letter">📝 留下第一封信</button>
        </div>
      </div>
    `;

    try {
      await this._startCamera();
    } catch (e) {
      this._showCameraError();
      return;
    }

    this._bindEvents(container);

    // 加载目标信件或附近信件
    if (params.targetLetterId) {
      await this._enterTargetMode(params.targetLetterId);
    } else {
      await this._enterExploreMode();
    }

    // 启动AR引擎
    await this._bootAR();
  },

  // ── 摄像头 ──
  async _startCamera() {
    this._stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: CONFIG.CAMERA.FACING_MODE, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    this._video = document.getElementById('camera-video');
    this._video.srcObject = this._stream;
    await this._video.play();

    // 等待视频有尺寸
    await new Promise(r => setTimeout(r, 200));
    this._updateGpsIndicator();
    LocationService.onChange(() => this._updateGpsIndicator());
  },

  _updateGpsIndicator() {
    const el = document.getElementById('camera-gps-indicator');
    if (!el) return;
    const pos = LocationService.getCurrent();
    if (pos && LocationService.isValid()) {
      el.textContent = `📍 GPS已锁定 (±${Math.round(pos.accuracy || 10)}m)`;
      el.classList.add('locked');
    } else {
      el.textContent = '📍 定位中...';
      el.classList.remove('locked');
    }
  },

  _showCameraError() {
    const arLayer = document.getElementById('camera-ar-layer');
    if (arLayer) {
      arLayer.style.display = 'flex';
      arLayer.innerHTML = '<div class="camera-error-msg">📷 无法访问摄像头<br>请检查权限设置</div>';
    }
  },

  // ── AR 启动 ──
  async _bootAR() {
    const canvas = document.getElementById('camera-overlay');
    if (!canvas || !this._video) return;

    // iOS 13+ 需要 DeviceOrientation 权限
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm === 'granted') {
          this._arPermissionGranted = true;
        }
      } catch (e) {
        console.warn('DeviceOrientation 权限被拒绝');
      }
    } else {
      this._arPermissionGranted = true;
    }

    // 初始化AR引擎
    await AREngine.init(this._video, canvas);

    if (this._arPermissionGranted) {
      AREngine.startOrientationTracking();
      this._arActive = true;
      const arToggle = document.getElementById('btn-toggle-ar');
      if (arToggle) arToggle.style.display = 'block';
    }

    // 设置AR渲染回调
    AREngine.startRenderLoop((ctx, w, h) => {
      this._arRenderCallback(ctx, w, h);
    });
  },

  // ── AR 渲染回调（每帧调用） ──
  _arRenderCallback(ctx, w, h) {
    const pos = LocationService.getCurrent();
    if (!pos) return;

    AREngine.updatePosition(pos.lat, pos.lng);

    // 同步目标到AR引擎
    this._syncARTargets();

    const targets = AREngine._targets;

    if (targets.length === 0) {
      // 探索模式：雷达扫描
      AREngine.drawExploreHint(ctx, w, h);
      this._updateNearbyHints(null);
    } else {
      // 渲染每个目标
      targets.forEach(target => {
        const projected = AREngine.projectToScreen(
          target.lat, target.lng, target.distance
        );

        if (!projected.onScreen && projected.distance > CONFIG.LOCATION.NEARBY_RANGE) {
          // 不在屏幕内且距离远 → 在屏幕边缘画方向指示
          const edgeX = projected.relAngle > 0 ? w - 30 : 30;
          ctx.save();
          ctx.fillStyle = 'rgba(196, 133, 42, 0.8)';
          ctx.font = '24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(projected.relAngle > 0 ? '→' : '←', edgeX, h * 0.45);
          ctx.font = '12px Arial';
          ctx.fillText(`${Math.round(projected.distance)}m`, edgeX, h * 0.45 + 20);
          ctx.restore();
        } else if (projected.onScreen) {
          AREngine.drawProximityIndicator(
            ctx,
            projected.x,
            projected.y,
            projected.scale,
            projected.distance,
            projected.relAngle,
            target
          );
        }
      });

      // 只对第一个最近的目标更新对齐UI
      const primary = targets[0];
      if (primary && primary._alignmentScore !== undefined) {
        this._updateAlignmentUI(Math.round(primary._alignmentScore * 100));
        this._currentAlignment = Math.round(primary._alignmentScore * 100);
      }

      this._updateNearbyHints(targets[0]);
    }

    // 底部罗盘条
    if (this._arPermissionGranted) {
      AREngine.drawCompassBar(ctx, w, h);
    }
  },

  // 同步目标列表到AR引擎
  _syncARTargets() {
    const pos = LocationService.getCurrent();
    if (!pos) return;

    const targets = [];
    const settings = StorageService.getUserSettings();

    // 1. 如果有追踪中的信件（对齐模式）
    if (this._targetLetter) {
      const d = Helpers.distanceBetween(
        pos.lat, pos.lng,
        this._targetLetter.location.lat, this._targetLetter.location.lng
      );

      const iconMap = { public: '📮', self_capsule: '⏳', secret: '🔒' };

      // 运行对齐检测
      let alignmentScore = 0;
      if (d <= CONFIG.LOCATION.FAR_RANGE &&
          this._targetLetter.photo.hasAlignment &&
          this._targetLetter.photo.features &&
          this._targetLetter.photo.features.length > 0) {
        // 每隔5帧做一次对齐检测（省性能），其余帧用缓存值
        if (!this._alignCheckCounter) this._alignCheckCounter = 0;
        this._alignCheckCounter++;
        if (this._alignCheckCounter % 5 === 0 && this._video) {
          try {
            const score = FeatureEngine.computeAlignment(
              this._targetLetter.photo.features,
              this._video
            );
            this._cachedAlignScore = FeatureEngine.scoreToPercent(score) / 100;
          } catch (e) {
            this._cachedAlignScore = 0;
          }
        }
        alignmentScore = this._cachedAlignScore || 0;
      } else if (!this._targetLetter.photo.hasAlignment) {
        alignmentScore = 1.0; // 无对齐要求的信直接满分
      }

      targets.push({
        id: this._targetLetter.id,
        lat: this._targetLetter.location.lat,
        lng: this._targetLetter.location.lng,
        distance: d,
        _title: this._targetLetter.content.title || '无名信',
        _icon: iconMap[this._targetLetter.type] || '✉️',
        _alignmentScore: alignmentScore,
        _isPrimary: true,
        type: this._targetLetter.type,
      });
    }

    // 2. 探索模式下：添加附近的其他信件
    if (!this._targetLetter && this._nearbyLetters.length > 0) {
      this._nearbyLetters.forEach(letter => {
        const d = Helpers.distanceBetween(
          pos.lat, pos.lng,
          letter.location.lat, letter.location.lng
        );
        const iconMap = { public: '📮', self_capsule: '⏳', secret: '🔒' };
        targets.push({
          id: letter.id,
          lat: letter.location.lat,
          lng: letter.location.lng,
          distance: d,
          _title: letter.content.title || '无名信',
          _icon: iconMap[letter.type] || '✉️',
          _alignmentScore: undefined,
          _isPrimary: false,
          type: letter.type,
        });
      });
    }

    AREngine.setTargets(targets);
  },

  // ── 模式切换 ──
  async _enterTargetMode(letterId) {
    try {
      this._targetLetter = await StorageService.getLetterById(letterId);
      if (!this._targetLetter) return;

      document.getElementById('camera-alignment-bar').style.display = 'block';
      this._cachedAlignScore = 0;
      this._alignCheckCounter = 0;
    } catch (e) {
      console.warn('进入追踪模式失败:', e);
    }
  },

  async _enterExploreMode() {
    const pos = LocationService.getCurrent();
    if (!pos) return;

    try {
      const nearby = await LetterManager.getReachableLetters(pos.lat, pos.lng);
      const settings = StorageService.getUserSettings();
      // 过滤掉自己的信
      this._nearbyLetters = nearby.filter(
        l => l.sender.nickname !== settings.nickname
      ).slice(0, 10);
    } catch (e) {
      this._nearbyLetters = [];
    }
  },

  _updateNearbyHints(primaryTarget) {
    const hint = document.getElementById('camera-no-letter-hint');
    if (!hint) return;

    if (this._targetLetter) {
      // 追踪模式
      const d = primaryTarget ? primaryTarget.distance : 999;
      if (d <= CONFIG.LOCATION.NEARBY_RANGE) {
        hint.style.display = 'none';
      } else if (d <= CONFIG.LOCATION.FAR_RANGE) {
        hint.style.display = 'block';
        hint.querySelector('.hint-text').textContent =
          `📡 距离约 ${Math.round(d)}m · 继续走近`;
      } else {
        hint.style.display = 'block';
        hint.querySelector('.hint-text').textContent =
          `📍 距离约 ${Math.round(d)}m · 到达附近后可见`;
      }
    } else if (this._nearbyLetters.length === 0) {
      hint.style.display = 'block';
      hint.querySelector('.hint-text').textContent = '✨ 这里还没有信';
    } else {
      hint.style.display = 'none';
    }

    // 更新底部按钮
    this._updateBottomAction();
  },

  _updateBottomAction() {
    const pos = LocationService.getCurrent();
    if (!pos) return;

    const cameraBtn = document.getElementById('btn-open-camera-inline');
    if (!this._targetLetter && this._nearbyLetters.length > 0) {
      // 探索模式有信：显示可交互提示
      const hint = document.getElementById('camera-no-letter-hint');
      if (hint && hint.style.display !== 'none') return;

      // 检查最近的信
      const nearest = this._nearbyLetters[0];
      const d = Helpers.distanceBetween(
        pos.lat, pos.lng,
        nearest.location.lat, nearest.location.lng
      );
      if (d <= CONFIG.LOCATION.NEARBY_RANGE && !this._targetLetter) {
        // 自动进入最近信的追踪
        this._targetLetter = nearest;
        this._cachedAlignScore = 0;
        this._alignCheckCounter = 0;
        document.getElementById('camera-alignment-bar').style.display = 'block';
      }
    }
  },

  _updateAlignmentUI(percent) {
    const fill = document.getElementById('alignment-fill');
    const label = document.getElementById('alignment-percent');
    if (fill) fill.style.width = `${percent}%`;
    if (label) label.textContent = `${percent}%`;
    if (fill) fill.classList.toggle('success', percent >= 90);
  },

  // ── 事件绑定 ──
  _bindEvents(container) {
    container.querySelector('#btn-camera-back').addEventListener('click', () => {
      this._cleanup();
      App.navigateTo('map');
    });

    container.querySelector('#btn-take-photo').addEventListener('click', () => {
      this._captureAndCompose();
    });

    const arToggle = container.querySelector('#btn-toggle-ar');
    if (arToggle) {
      arToggle.addEventListener('click', () => {
        this._arActive = !this._arActive;
        arToggle.textContent = this._arActive ? '🌐 AR ON' : '🌐 AR OFF';
        if (this._arActive) {
          AREngine.startOrientationTracking();
          AREngine.startRenderLoop((ctx, w, h) => {
            this._arRenderCallback(ctx, w, h);
          });
        } else {
          AREngine.stopOrientationTracking();
          AREngine.stopRenderLoop();
          // 清空Canvas
          const canvas = document.getElementById('camera-overlay');
          if (canvas) {
            const ctx2 = canvas.getContext('2d');
            ctx2.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      });
    }

    const firstLetterBtn = container.querySelector('#btn-first-letter');
    if (firstLetterBtn) {
      firstLetterBtn.addEventListener('click', () => {
        this._captureAndCompose();
      });
    }

    // 点击Canvas上的信封 → 打开追踪模式
    const canvas = document.getElementById('camera-overlay');
    canvas.addEventListener('click', (e) => {
      if (!this._targetLetter && this._nearbyLetters.length > 0) {
        const pos = LocationService.getCurrent();
        // 找最近的
        const sorted = [...this._nearbyLetters].sort((a, b) => {
          const dA = Helpers.distanceBetween(pos.lat, pos.lng, a.location.lat, a.location.lng);
          const dB = Helpers.distanceBetween(pos.lat, pos.lng, b.location.lat, b.location.lng);
          return dA - dB;
        });
        if (sorted[0]) {
          this._enterTargetMode(sorted[0].id);
          document.getElementById('camera-alignment-bar').style.display = 'block';
        }
      }
    });
  },

  // ── 拍照 ──
  async _captureAndCompose() {
    if (!this._video) return;
    try {
      SoundEngine.playShutter();

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

      this._cleanup();
      App.navigateTo('compose', {
        photoData: { dataURL, thumbnail },
        location: { lat: pos.lat, lng: pos.lng },
      });
    } catch (e) {
      console.error('拍照失败:', e);
      alert('拍照失败，请重试');
    }
  },

  // ── 清理 ──
  _cleanup() {
    AREngine.destroy();
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    this._video = null;
    this._targetLetter = null;
    this._nearbyLetters = [];
    this._currentAlignment = 0;
    this._cachedAlignScore = 0;
    this._alignCheckCounter = 0;
    this._arActive = false;
  },
};
