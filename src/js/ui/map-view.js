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
    this._container = container;
    container.innerHTML = `
      <div class="map-view">
        <div class="map-top-bar">
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
        <div class="map-bottom-action" id="map-bottom-action" style="display:none;">
          <button class="map-action-btn primary" id="btn-open-camera">📷 打开相机查看</button>
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
      mapStyle: 'amap://styles/dark',  // 深色主题匹配整体UI
      showBuildingBlock: false,
      resizeEnable: true,
    });

    document.getElementById('map-loading').style.display = 'none';

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
      });
    });

    const searchInput = container.querySelector('#map-search-input');
    searchInput.addEventListener('input', Helpers.throttle(() => {
      this._filterByName(searchInput.value.trim());
    }, 300));

    const cameraBtn = container.querySelector('#btn-open-camera');
    if (cameraBtn) {
      cameraBtn.addEventListener('click', () => {
        App.navigateTo('camera');
      });
    }
  },

  _startLocationUpdates() {
    LocationService.onChange((pos) => {
      this._currentPos = pos;
      this._updateMapCenter(pos);
      this._refresh();
    });
  },

  async _refresh() {
    if (!this._currentPos) return;
    try {
      this._letters = await LetterManager.getReachableLetters(
        this._currentPos.lat,
        this._currentPos.lng
      );
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

    let letters = this._letters;
    if (this._filterType) {
      letters = letters.filter(l => l.type === this._filterType);
    }

    letters.forEach(letter => {
      const d = this._currentPos
        ? Helpers.distanceBetween(this._currentPos.lat, this._currentPos.lng, letter.location.lat, letter.location.lng)
        : 0;

      const color = this._getMarkerColor(letter.type);
      const lnglat = [letter.location.lng, letter.location.lat];

      const marker = new AMap.Marker({
        position: lnglat,
        icon: new AMap.Icon({
          size: new AMap.Size(32, 40),
          image: this._makeMarkerSVG(color, letter.type, d <= CONFIG.LOCATION.NEARBY_RANGE),
          imageSize: new AMap.Size(32, 40),
        }),
        offset: new AMap.Pixel(-16, -40),
        zIndex: 90,
        title: letter.content.title || '无名信',
      });

      // 点击标记
      marker.on('click', () => {
        this._onLetterClick(letter);
      });

      // 创建信息窗体（悬浮预览）
      const distanceText = d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
      marker.setLabel({
        content: `<div style="background:rgba(0,0,0,0.75);color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;white-space:nowrap;">${Helpers.escapeHtml(letter.content.title || '📮')} · ${distanceText}</div>`,
        direction: 'top',
        offset: new AMap.Pixel(0, -5),
      });

      this._map.add(marker);
      this._markers.push(marker);
    });

    // 调整视野以显示所有标记
    if (this._markers.length > 0 && this._currentPos) {
      this._map.setFitView(null, false, [60, 60, 60, 200]);
    }
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
      : 0;
    const distanceText = d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
    const typeLabel = { public: '公开', self_capsule: '给自己', secret: '密信' }[letter.type];
    const typeIcon = {
      public: letter.photo.hasAlignment ? '✉️' : '📨',
      self_capsule: '⏳',
      secret: '🔒',
    }[letter.type];
    const subInfo = letter.replies.length > 0
      ? `${letter.replies.length}回响 · ${Helpers.formatRelativeTime(letter.created)}`
      : Helpers.formatRelativeTime(letter.created);

    return `
      <div class="map-letter-item" data-id="${letter.id}">
        <span class="map-letter-icon">${typeIcon}</span>
        <div class="map-letter-info">
          <div class="map-letter-title">${Helpers.escapeHtml(letter.content.title || '无名信')}</div>
          <div class="map-letter-meta">${distanceText} · ${subInfo} · ${typeLabel}</div>
        </div>
        <span class="map-letter-arrow">›</span>
      </div>
    `;
  },

  _onLetterClick(letter) {
    if (!this._currentPos) return;
    const d = Helpers.distanceBetween(
      this._currentPos.lat, this._currentPos.lng,
      letter.location.lat, letter.location.lng
    );
    if (letter.type === 'secret') {
      this._showPassphraseInput(letter);
    } else if (d <= CONFIG.LOCATION.NEARBY_RANGE) {
      App.navigateTo('camera', { targetLetterId: letter.id });
    } else {
      this._showTooFar(d);
    }
  },

  _showPassphraseInput(letter) {
    const phrase = prompt('请输入密信口令：');
    if (!phrase) return;
    if (phrase !== letter.secret.passphrase) {
      alert('口令不正确');
      return;
    }
    App.navigateTo('camera', { targetLetterId: letter.id });
  },

  _showTooFar(distance) {
    alert(`距离目标还有 ${Math.round(distance)}m，走近一些再打开相机吧~`);
  },

  _updateBottomAction(letters) {
    const actionEl = document.querySelector('#map-bottom-action');
    if (!actionEl) return;
    const hasNearby = letters.some(l => {
      if (!this._currentPos) return false;
      const d = Helpers.distanceBetween(
        this._currentPos.lat, this._currentPos.lng,
        l.location.lat, l.location.lng
      );
      return d <= CONFIG.LOCATION.NEARBY_RANGE;
    });
    actionEl.style.display = hasNearby ? 'block' : 'none';
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
};
