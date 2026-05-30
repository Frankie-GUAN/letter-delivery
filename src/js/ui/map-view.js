// 此刻·此地 — 地图罗盘视图
const MapView = {
  _container: null,
  _letters: [],
  _currentPos: null,
  _filterType: null,

  // 渲染地图视图
  render(container) {
    this._container = container;
    container.innerHTML = `
      <div class="map-view">
        <div class="map-top-bar">
          <input type="text" class="map-search" placeholder="搜索地点..." id="map-search-input">
        </div>
        <div class="map-canvas-wrapper" id="map-canvas-wrapper">
          <div class="map-placeholder" id="map-placeholder">
            <div class="map-status-text">正在获取位置...</div>
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
  },

  _bindEvents(container) {
    container.querySelectorAll('.map-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.map-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._filterType = btn.dataset.type || null;
        this._refreshList();
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
      this._updateMapDisplay(pos);
      this._refresh();
    });
  },

  _updateMapDisplay(pos) {
    const statusEl = document.querySelector('#map-placeholder .map-status-text');
    if (statusEl && pos) {
      statusEl.textContent = `📍 已定位 (精度: ${Math.round(pos.accuracy)}m)`;
    }
  },

  async _refresh() {
    if (!this._currentPos) return;
    try {
      this._letters = await LetterManager.getReachableLetters(
        this._currentPos.lat,
        this._currentPos.lng
      );
      this._refreshList();
    } catch (e) {
      console.warn('刷新信件列表失败:', e);
    }
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
          this._onLetterClick(letters[i]);
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
  },
};
