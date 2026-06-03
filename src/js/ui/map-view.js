// 此刻·此地 — 地图罗盘视图（完整版：高德地图SDK）
const MapView = {
  _container: null,
  _letters: [],
  _currentPos: null,
  _filterType: null,
  _map: null,
  _markers: [],
  _userMarker: null,
  _amapReady: false,

  // 动态加载高德地图SDK
  _loadAMap() {
    if (this._amapReady) return Promise.resolve();
    if (this._loadingPromise) return this._loadingPromise;

    this._loadingPromise = new Promise((resolve, reject) => {
      if (window.AMap) {
        this._amapReady = true;
        resolve();
        return;
      }

      if (typeof API_KEYS === 'undefined' || !API_KEYS || !API_KEYS.AMAP_KEY || !API_KEYS.AMAP_SECURITY_CODE) {
        this._loadingPromise = null;
        reject(new Error('高德地图密钥未配置'));
        return;
      }

      // 设置安全密钥（必须在加载SDK前）
      window._AMapSecurityConfig = {
        securityJsCode: API_KEYS.AMAP_SECURITY_CODE,
      };

      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${API_KEYS.AMAP_KEY}`;
      script.onload = () => {
        this._amapReady = true;
        resolve();
      };
      script.onerror = () => {
        this._loadingPromise = null;
        reject(new Error('高德地图加载失败'));
      };
      document.head.appendChild(script);
    });

    return this._loadingPromise;
  },

  async render(container) {
    // 清理旧地图实例（避免内存泄漏）
    if (this._map) {
      try { this._map.destroy(); } catch (e) {}
      this._map = null;
    }
    this._markers = [];
    this._userMarker = null;
    this._accuracyCircle = null;
    this._destMarker = null;
    this._walkingRoute = null;
    this._walkingInstance = null;
    this._container = container;

    // 首次使用：设置昵称
    const settings = StorageService.getUserSettings();
    if (!settings.nickname) {
      this._renderSetup(container);
      return;
    }

    container.innerHTML = `
      <div class="map-view">
        <div class="map-top-bar">
          <button class="map-home-btn" id="btn-map-home" title="返回主页">⌂</button>
          <input type="text" class="map-search" placeholder="搜索地点..." id="map-search-input">
        </div>
        <div class="map-canvas-wrapper" id="map-canvas-wrapper">
          <div id="amap-container" class="amap-container"></div>
          <div class="map-loading" id="map-loading">
            <div class="map-status-text">正在加载地图...</div>
            <div class="map-status-icon">🗺️</div>
          </div>
        </div>
        <div class="map-filters" id="map-filters">
          <button class="map-filter-btn active" data-type="">全部</button>
          <button class="map-filter-btn" data-type="public">公开</button>
          <button class="map-filter-btn" data-type="self_capsule">给自己</button>
          <button class="map-filter-btn" data-type="secret">密信</button>
        </div>
        <div class="map-letter-list" id="map-letter-list">
          <div class="map-list-header">📍 附近没有发现信件</div>
        </div>
        <div class="map-bottom-action" id="map-bottom-action">
          <button class="map-action-btn primary" id="btn-open-camera" style="display:none;">📷 打开相机查看</button>
          <button class="map-action-btn primary" id="btn-write-letter">📝 在此留下第一封信</button>
        </div>
        <button class="map-simulate-btn" id="btn-simulate" title="模拟定位（桌面调试用）">🎯</button>
        <div class="map-simulate-banner" id="map-simulate-banner" style="display:none;">
          ⚠️ 模拟定位中 · 点击地图移动位置
        </div>
      </div>
    `;

    this._bindEvents(container);
    this._startLocationUpdates();

    // 加载地图
    try {
      await this._loadAMap();
      this._initMap();
    } catch (e) {
      console.warn('地图加载失败，使用占位模式:', e);
      document.getElementById('map-loading').innerHTML = `
        <div class="map-status-text">地图加载失败</div>
        <div class="map-status-icon">🗺️</div>
      `;
    }
  },

  _initMap() {
    const mapEl = document.getElementById('amap-container');
    if (!mapEl) return;

    // 默认中心：北京天安门（后续GPS定位会更新）
    const defaultCenter = [116.397428, 39.90923];

    this._map = new AMap.Map('amap-container', {
      zoom: 15,
      center: defaultCenter,
      mapStyle: 'amap://styles/light',  // 浅色主题匹配暖光UI
      showBuildingBlock: false,
      resizeEnable: true,
    });

    document.getElementById('map-loading').style.display = 'none';

    // 模拟模式：点击地图设置位置
    this._map.on('click', (e) => {
      if (!this._simulateActive) return;
      const lat = e.lnglat.getLat();
      const lng = e.lnglat.getLng();
      LocationService.setSimulatedPosition(lat, lng);
      this._currentPos = LocationService.getCurrent();
      this._updateMapCenter(this._currentPos);
      this._refresh();
    });

    // 如果有已知位置，立即定位
    if (this._currentPos) {
      this._updateMapCenter(this._currentPos);
    }
  },

  _updateMapCenter(pos) {
    if (!this._map) return;
    const lnglat = [pos.lng, pos.lat];

    // 首次定位飞行到用户位置
    if (!this._userMarker) {
      this._map.setZoomAndCenter(16, lnglat);

      // 用户位置标记
      this._userMarker = new AMap.Marker({
        position: lnglat,
        icon: new AMap.Icon({
          size: new AMap.Size(24, 24),
          image: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="#4A90D9" stroke="#fff" stroke-width="3" opacity="0.9"/>
              <circle cx="12" cy="12" r="4" fill="#fff"/>
            </svg>
          `),
          imageSize: new AMap.Size(24, 24),
        }),
        zIndex: 100,
        anchor: 'center',
      });
      this._map.add(this._userMarker);

      // 精度圈
      if (pos.accuracy) {
        const circle = new AMap.Circle({
          center: lnglat,
          radius: pos.accuracy,
          fillColor: 'rgba(74, 144, 217, 0.1)',
          strokeColor: 'rgba(74, 144, 217, 0.3)',
          strokeWeight: 1,
          zIndex: 99,
        });
        this._map.add(circle);
        this._accuracyCircle = circle;
      }
    } else {
      this._userMarker.setPosition(lnglat);
      if (this._accuracyCircle) {
        this._accuracyCircle.setCenter(lnglat);
        this._accuracyCircle.setRadius(pos.accuracy || 20);
      }
    }
  },

  _bindEvents(container) {
    container.querySelectorAll('.map-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.map-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._filterType = btn.dataset.type || null;
        this._refreshList();
        this._updateMapMarkers();
        SoundEngine.playPageTurn();
      });
    });

    const homeBtn = container.querySelector('#btn-map-home');
    if (homeBtn) {
      homeBtn.addEventListener('click', () => {
        App.navigateTo('home');
      });
    }

    const searchInput = container.querySelector('#map-search-input');
    searchInput.addEventListener('input', Helpers.throttle(() => {
      this._filterByName(searchInput.value.trim());
    }, 300));

    const cameraBtn = container.querySelector('#btn-open-camera');
    if (cameraBtn) {
      cameraBtn.addEventListener('click', () => {
        // 传第一个附近的可打开信件到相机对齐模式
        const nearby = this._letters.filter(l => {
          if (!this._currentPos) return false;
          const settings2 = StorageService.getUserSettings();
          if (l.sender.nickname === settings2.nickname) return false;
          if (l.type === 'secret') return false;
          const d = Helpers.distanceBetween(
            this._currentPos.lat, this._currentPos.lng,
            l.location.lat, l.location.lng
          );
          return d <= CONFIG.LOCATION.NEARBY_RANGE;
        });
        if (nearby.length > 0) {
          App.navigateTo('camera', { targetLetterId: nearby[0].id });
        } else {
          App.navigateTo('camera');
        }
      });
    }
    const writeBtn = container.querySelector('#btn-write-letter');
    if (writeBtn) {
      writeBtn.addEventListener('click', () => {
        App.navigateTo('camera');
      });
    }

    // 模拟定位
    const simBtn = container.querySelector('#btn-simulate');
    if (simBtn) {
      simBtn.addEventListener('click', () => {
        const wasActive = this._simulateActive;
        this._simulateActive = !wasActive;
        simBtn.classList.toggle('active', this._simulateActive);
        document.getElementById('map-simulate-banner').style.display = this._simulateActive ? 'block' : 'none';

        if (!this._simulateActive) {
          LocationService.clearSimulatedPosition();
          this._refresh();
        } else if (this._currentPos) {
          // 激活时用当前位置初始化模拟
          LocationService.setSimulatedPosition(this._currentPos.lat, this._currentPos.lng);
        }
      });
    }
  },

  _startLocationUpdates() {
    // 先检查是否已有位置
    const existingPos = LocationService.getCurrent();
    if (existingPos) {
      this._currentPos = existingPos;
      this._updateMapCenter(existingPos);
      this._refresh();
    }

    LocationService.onChange((pos) => {
      this._currentPos = pos;
      this._updateMapCenter(pos);
      this._refresh();
    });
  },

  async _refresh() {
    try {
      // 1. 加载附近信件
      let nearbyLetters = [];
      if (this._currentPos) {
        nearbyLetters = await LetterManager.getReachableLetters(
          this._currentPos.lat,
          this._currentPos.lng
        );
      }

      // 2. 加载我自己的信（不管距离多远都显示）
      const settings = StorageService.getUserSettings();
      let myLetters = [];
      if (settings.nickname) {
        const all = await StorageService.getAllLetters();
        myLetters = all.filter(l => l.sender.nickname === settings.nickname);
      }

      // 3. 合并去重
      const idSet = new Set();
      const merged = [];
      // 我自己的信优先
      myLetters.forEach(l => { idSet.add(l.id); merged.push(l); });
      // 附近的信追加（排除已添加的自己的信）
      nearbyLetters.forEach(l => {
        if (!idSet.has(l.id)) {
          idSet.add(l.id);
          merged.push(l);
        }
      });

      this._letters = merged;
      this._refreshList();
      this._updateMapMarkers();
    } catch (e) {
      console.warn('刷新信件列表失败:', e);
    }
  },

  // 更新地图上的信件标记
  _updateMapMarkers() {
    if (!this._map) return;

    // 清除旧标记
    this._markers.forEach(m => this._map.remove(m));
    this._markers = [];
    if (this._destMarker) { this._map.remove(this._destMarker); this._destMarker = null; }
    if (this._walkingRoute) { this._walkingRoute = null; }

    let letters = this._letters;
    if (this._filterType) {
      letters = letters.filter(l => l.type === this._filterType);
    }

    // 按位置分组（5m内视为同一地点）
    const groups = [];
    const GROUP_THRESHOLD = 5; // 米

    letters.forEach(letter => {
      let added = false;
      for (const group of groups) {
        const d = Helpers.distanceBetween(
          letter.location.lat, letter.location.lng,
          group[0].location.lat, group[0].location.lng
        );
        if (d <= GROUP_THRESHOLD) {
          group.push(letter);
          added = true;
          break;
        }
      }
      if (!added) groups.push([letter]);
    });

    groups.forEach(group => {
      const first = group[0];
      const d = this._currentPos
        ? Helpers.distanceBetween(this._currentPos.lat, this._currentPos.lng, first.location.lat, first.location.lng)
        : 0;
      const lnglat = [first.location.lng, first.location.lat];
      const isNearby = d <= CONFIG.LOCATION.NEARBY_RANGE;

      let marker;
      if (group.length > 1) {
        // 折叠标记
        marker = new AMap.Marker({
          position: lnglat,
          icon: new AMap.Icon({
            size: new AMap.Size(36, 44),
            image: this._makeFoldedMarkerSVG(group, isNearby),
            imageSize: new AMap.Size(36, 44),
          }),
          offset: new AMap.Pixel(-18, -44),
          zIndex: 91,
          title: `${group.length}封信在此`,
        });

        marker.on('click', () => this._showLetterPicker(group, d));
      } else {
        // 单封信
        const color = this._getMarkerColor(first.type);
        marker = new AMap.Marker({
          position: lnglat,
          icon: new AMap.Icon({
            size: new AMap.Size(32, 40),
            image: this._makeMarkerSVG(color, first.type, isNearby),
            imageSize: new AMap.Size(32, 40),
          }),
          offset: new AMap.Pixel(-16, -40),
          zIndex: 90,
          title: first.content.title || '无名信',
        });

        marker.on('click', () => this._onLetterClick(first));
      }

      const distanceText = d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
      const labelText = group.length > 1
        ? `${group.length}封信 · ${distanceText}`
        : `${Helpers.escapeHtml(first.content.title || '📮')} · ${distanceText}`;

      marker.setLabel({
        content: `<div style="background:rgba(0,0,0,0.75);color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;white-space:nowrap;">${labelText}</div>`,
        direction: 'top',
        offset: new AMap.Pixel(0, -5),
      });

      this._map.add(marker);
      this._markers.push(marker);
    });

    if (this._markers.length > 0 && this._currentPos) {
      this._map.setFitView(null, false, [60, 60, 60, 200]);
    }
  },

  _makeFoldedMarkerSVG(group, isNearby) {
    const pulseAnim = isNearby ? '<animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/>' : '';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
          </filter>
        </defs>
        <g filter="url(#shadow)">
          <path d="M18 42 C18 42 30 28 30 18 C30 10.82 25.18 6 18 6 C10.82 6 6 10.82 6 18 C6 28 18 42 18 42Z"
                fill="#d4a853" stroke="#fff" stroke-width="1.5" ${pulseAnim}/>
          <circle cx="18" cy="18" r="9" fill="#fff" opacity="0.95"/>
          <text x="18" y="22" text-anchor="middle" font-size="14" fill="#1a1815">✉️</text>
          <circle cx="14" cy="14" r="6" fill="#f0c96d" stroke="#fff" stroke-width="1"/>
          <text x="14" y="17" text-anchor="middle" font-size="8" fill="#1a1815" font-weight="bold">${group.length}</text>
        </g>
      </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim());
  },

  _showLetterPicker(group, distance) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card picker-modal">
        <div class="modal-close" id="modal-close">✕</div>
        <h3 class="picker-title">📍 此处有 ${group.length} 封信</h3>
        <div class="picker-list">
          ${group.map(l => `
            <div class="picker-item" data-id="${l.id}">
              <span class="picker-icon">${l.type === 'secret' ? '🔒' : l.type === 'self_capsule' ? '⏳' : l.photo.hasAlignment ? '✉️' : '📨'}</span>
              <div class="picker-info">
                <div class="picker-name">${Helpers.escapeHtml(l.content.title || '无名信')}</div>
                <div class="picker-sender">${Helpers.escapeHtml(l.sender.nickname)} · ${Helpers.formatRelativeTime(l.created)}</div>
              </div>
              <span class="picker-arrow">›</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelectorAll('.picker-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        overlay.remove();
        this._onLetterClick(group[i]);
      });
    });
  },

  _getMarkerColor(type) {
    switch (type) {
      case 'public': return '#f0c96d';      // 金色
      case 'self_capsule': return '#d4a853'; // 暗金
      case 'secret': return '#4A90D9';       // 蓝色
      default: return '#9a9488';
    }
  },

  _makeMarkerSVG(color, type, isNearby) {
    const iconMap = { public: '📮', self_capsule: '⏳', secret: '🔒' };
    const emoji = iconMap[type] || '✉️';
    const pulseAnim = isNearby ? '<animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/>' : '';

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
          </filter>
        </defs>
        <g filter="url(#shadow)">
          <path d="M16 38 C16 38 28 26 28 16 C28 9.37 22.63 4 16 4 C9.37 4 4 9.37 4 16 C4 26 16 38 16 38Z"
                fill="${color}" stroke="#fff" stroke-width="1.5" ${pulseAnim}/>
          <circle cx="16" cy="16" r="8" fill="#fff" opacity="0.95"/>
        </g>
      </svg>`;

    // 使用data URL避免emoji渲染不一致
    const encoded = svg.replace(/\s+/g, ' ').trim();
    return 'data:image/svg+xml,' + encodeURIComponent(encoded);
  },

  _refreshList() {
    let letters = this._letters;
    if (this._filterType) {
      letters = letters.filter(l => l.type === this._filterType);
    }

    const listEl = document.querySelector('#map-letter-list');
    if (!listEl) return;

    if (letters.length === 0) {
      listEl.innerHTML = '<div class="map-list-header">📍 附近没有发现信件</div>';
    } else {
      listEl.innerHTML = `
        <div class="map-list-header">📍 附近 ${letters.length} 封信</div>
        ${letters.map(l => this._renderLetterItem(l)).join('')}
      `;

      listEl.querySelectorAll('.map-letter-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          const letter = letters[i];
          // 地图聚焦到该信
          if (this._map) {
            this._map.setZoomAndCenter(17, [letter.location.lng, letter.location.lat]);
          }
          // 延迟打开详情，让用户看到地图动画
          setTimeout(() => this._onLetterClick(letter), 300);
        });
      });
    }

    this._updateBottomAction(letters);
  },

  _renderLetterItem(letter) {
    const d = this._currentPos
      ? Helpers.distanceBetween(this._currentPos.lat, this._currentPos.lng, letter.location.lat, letter.location.lng)
      : null;
    const distanceText = d !== null
      ? (d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`)
      : '?';
    const typeLabel = { public: '公开', self_capsule: '给自己', secret: '密信' }[letter.type];
    const typeIcon = {
      public: letter.photo.hasAlignment ? '✉️' : '📨',
      self_capsule: '⏳',
      secret: '🔒',
    }[letter.type];
    const subInfo = letter.replies.length > 0
      ? `${letter.replies.length}回响 · ${Helpers.formatRelativeTime(letter.created)}`
      : Helpers.formatRelativeTime(letter.created);

    const settings = StorageService.getUserSettings();
    const isMine = letter.sender.nickname === settings.nickname;

    // 自己的未到期胶囊标记为锁定
    const isLocked = isMine && letter.type === 'self_capsule' && letter.capsule && Date.now() < letter.capsule.unlockAt;
    const lockedBadge = isLocked ? '<span class="my-letter-badge locked">未解锁</span>' : '';

    return `
      <div class="map-letter-item ${isMine ? 'my-letter' : ''} ${isLocked ? 'locked' : ''}" data-id="${letter.id}">
        <span class="map-letter-icon">${isLocked ? '🔐' : typeIcon}</span>
        <div class="map-letter-info">
          <div class="map-letter-title">
            ${Helpers.escapeHtml(letter.content.title || '无名信')}
            ${isMine && !isLocked ? '<span class="my-letter-badge">我的信</span>' : ''}
            ${lockedBadge}
          </div>
          <div class="map-letter-meta">
            ${isLocked ? `${Helpers.formatDate(letter.capsule.unlockAt)}解锁 · ` : ''}${distanceText} · ${subInfo} · ${typeLabel}
          </div>
        </div>
        <span class="map-letter-arrow">${isLocked ? '🔐' : '›'}</span>
      </div>
    `;
  },

  _onLetterClick(letter) {
    SoundEngine.playUIClick();
    const settings = StorageService.getUserSettings();
    const isMine = letter.sender.nickname === settings.nickname;

    if (isMine) {
      // 时光胶囊：检查解锁时间和对齐要求
      if (letter.type === 'self_capsule' && letter.capsule) {
        if (Date.now() < letter.capsule.unlockAt) {
          alert(`⏳ 胶囊尚未解锁，${Helpers.formatDate(letter.capsule.unlockAt)}后再来打开吧~`);
          return;
        }
        if (letter.photo.hasAlignment) {
          App.navigateTo('camera', { targetLetterId: letter.id });
          return;
        }
      }
      App.navigateTo('read', { letterId: letter.id });
      return;
    }

    // 密信 → 需要口令
    if (letter.type === 'secret') {
      this._showPassphraseInput(letter);
      return;
    }

    // 没有位置信息 → 无法判断距离，直接尝试相机
    if (!this._currentPos) {
      App.navigateTo('camera', { targetLetterId: letter.id });
      return;
    }

    const d = Helpers.distanceBetween(
      this._currentPos.lat, this._currentPos.lng,
      letter.location.lat, letter.location.lng
    );

    if (d <= CONFIG.LOCATION.NEARBY_RANGE) {
      App.navigateTo('camera', { targetLetterId: letter.id });
    } else {
      this._showTooFar(letter, d);
    }
  },

  _showPassphraseInput(letter) {
    const d = this._currentPos
      ? Helpers.distanceBetween(this._currentPos.lat, this._currentPos.lng, letter.location.lat, letter.location.lng)
      : '?';

    Helpers.showPassphraseModal(letter, {
      onSuccess: (_letter, overlay) => {
        this._showCluePhoto(letter, d, overlay);
      },
    });
  },

  _showCluePhoto(letter, distance, overlay) {
    const card = overlay.querySelector('.modal-card');
    card.innerHTML = `
      <div class="modal-close" id="modal-close">✕</div>
      <div class="passphrase-icon">🔓</div>
      <h3 class="passphrase-title">找到了！</h3>
      <p class="clue-info">${Helpers.escapeHtml(letter.sender.nickname)} 在这里为你留了一封信</p>
      ${letter.secret.hintPhoto
        ? `<div class="clue-photo-wrap"><img src="${letter.secret.hintPhoto}" alt="线索照片" class="clue-photo"></div>`
        : ''}
      <div class="clue-meta">
        <div class="clue-distance">📍 大约 ${typeof distance === 'number' ? Math.round(distance) + 'm' : '?'} 外 · ${Helpers.escapeHtml(letter.location.name || '某个地方')}</div>
      </div>
      <button class="passphrase-submit" id="btn-go-find">📷 打开相机寻找</button>
    `;

    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('#btn-go-find').addEventListener('click', () => {
      overlay.remove();
      App.navigateTo('camera', { targetLetterId: letter.id });
    });
  },

  _showTooFar(letter, distance) {
    if (!this._map || !this._currentPos) return;

    // 先聚焦到目标位置
    this._map.setZoomAndCenter(16, [letter.location.lng, letter.location.lat]);

    // 清除旧路线
    if (this._destMarker) { this._map.remove(this._destMarker); this._destMarker = null; }
    if (this._walkingInstance) { this._walkingInstance.clear(); this._walkingInstance = null; }
    this._walkingRoute = null;

    // 绘制步行路线
    const startLngLat = [this._currentPos.lng, this._currentPos.lat];
    const endLngLat = [letter.location.lng, letter.location.lat];

    AMap.plugin('AMap.Walking', () => {
      const walking = new AMap.Walking({ map: this._map });
      this._walkingInstance = walking;
      walking.search(startLngLat, endLngLat, (status, result) => {
        if (status === 'complete' && result.routes && result.routes.length > 0) {
          this._walkingRoute = result;
        }
      });
    });

    // 在目标位置添加终点标记
    if (this._destMarker) this._map.remove(this._destMarker);
    this._destMarker = new AMap.Marker({
      position: endLngLat,
      icon: new AMap.Icon({
        size: new AMap.Size(28, 28),
        image: 'data:image/svg+xml,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="12" fill="none" stroke="#d4a853" stroke-width="2.5" stroke-dasharray="4 2"/>
            <circle cx="14" cy="14" r="6" fill="#d4a853" opacity="0.8"/>
            <circle cx="14" cy="14" r="2" fill="#fff"/>
          </svg>
        `),
        imageSize: new AMap.Size(28, 28),
      }),
      anchor: 'center',
      zIndex: 95,
    });
    this._map.add(this._destMarker);

    // 底部提示
    const actionEl = document.querySelector('#map-bottom-action');
    if (actionEl) {
      const cameraBtn = actionEl.querySelector('#btn-open-camera');
      const writeBtn = actionEl.querySelector('#btn-write-letter');
      if (cameraBtn) cameraBtn.style.display = 'none';
      if (writeBtn) writeBtn.style.display = 'none';
      actionEl.style.display = 'none';
    }
  },

  _updateBottomAction(letters) {
    const actionEl = document.querySelector('#map-bottom-action');
    if (!actionEl) return;
    const cameraBtn = actionEl.querySelector('#btn-open-camera');
    const writeBtn = actionEl.querySelector('#btn-write-letter');

    const hasNearby = letters.some(l => {
      if (!this._currentPos) return false;
      const d = Helpers.distanceBetween(
        this._currentPos.lat, this._currentPos.lng,
        l.location.lat, l.location.lng
      );
      return d <= CONFIG.LOCATION.NEARBY_RANGE;
    });

    if (hasNearby) {
      cameraBtn.style.display = 'block';
      writeBtn.style.display = 'none';
    } else {
      cameraBtn.style.display = 'none';
      writeBtn.style.display = 'block';
    }
  },

  _filterByName(name) {
    if (!name) {
      this._refreshList();
      this._updateMapMarkers();
      return;
    }
    const filtered = this._letters.filter(l =>
      l.content.title.toLowerCase().includes(name.toLowerCase()) ||
      (l.location.name && l.location.name.toLowerCase().includes(name.toLowerCase()))
    );
    const listEl = document.querySelector('#map-letter-list');
    if (!listEl) return;
    listEl.innerHTML = `
      <div class="map-list-header">🔍 搜索"${Helpers.escapeHtml(name)}"结果：${filtered.length} 封</div>
      ${filtered.map(l => this._renderLetterItem(l)).join('')}
    `;
    listEl.querySelectorAll('.map-letter-item').forEach((el, i) => {
      el.addEventListener('click', () => this._onLetterClick(filtered[i]));
    });
  },

  _renderSetup(container) {
    const avatars = ['🌲', '🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🐸', '🦁', '🐙', '🌸', '🌟', '🌈', '💎', '🎈', '🎵', '📚', '☕'];

    container.innerHTML = `
      <div class="setup-view">
        <div class="setup-card">
          <div class="setup-header">
            <h1 class="setup-title">此刻·此地</h1>
            <p class="setup-subtitle">在进入之前，先介绍一下自己吧</p>
          </div>
          <div class="setup-form">
            <label class="setup-label">你的昵称</label>
            <input type="text" class="setup-input" id="setup-nickname"
                   maxlength="12" placeholder="会出现在你写的每封信上...">
            <label class="setup-label">选一个头像</label>
            <div class="setup-avatar-grid" id="setup-avatar-grid">
              ${avatars.map(a => `<button class="setup-avatar-btn" data-avatar="${a}">${a}</button>`).join('')}
            </div>
            <button class="setup-btn primary" id="btn-setup-done" disabled>进入</button>
          </div>
        </div>
      </div>
    `;

    let selectedAvatar = '🌲';
    let nickname = '';

    const nicknameInput = container.querySelector('#setup-nickname');
    const doneBtn = container.querySelector('#btn-setup-done');

    const updateDone = () => {
      doneBtn.disabled = !nickname.trim();
    };

    nicknameInput.addEventListener('input', () => {
      nickname = nicknameInput.value.trim();
      updateDone();
    });

    container.querySelectorAll('.setup-avatar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.setup-avatar-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAvatar = btn.dataset.avatar;
      });
    });

    // 默认选中第一个
    const firstAvatar = container.querySelector('.setup-avatar-btn');
    if (firstAvatar) firstAvatar.classList.add('selected');

    doneBtn.addEventListener('click', () => {
      if (!nickname.trim()) return;
      StorageService.saveUserSettings({ nickname: nickname.trim(), avatar: selectedAvatar });
      this.render(container);
    });
  },
};
