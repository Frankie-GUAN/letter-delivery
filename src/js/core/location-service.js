// 此刻·此地 — 定位服务
const LocationService = {
  _watchId: null,
  _current: null,       // { lat, lng, accuracy, timestamp }
  _listeners: [],

  // 开始监听位置
  start() {
    // 恢复上次已知位置
    const cached = localStorage.getItem('cikecidi_last_position');
    if (cached) {
      try {
        const saved = JSON.parse(cached);
        this._current = saved;
        // 通知监听者有缓存位置可用
        setTimeout(() => this._notifyListeners(), 100);
      } catch (e) { /* ignore */ }
    }

    if (!navigator.geolocation) {
      console.warn('Geolocation API 不可用，使用缓存位置');
      return;
    }

    this._watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this._current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        // 缓存位置
        localStorage.setItem('cikecidi_last_position', JSON.stringify(this._current));
        this._notifyListeners();
      },
      (err) => {
        console.warn('定位失败:', err.message, '(使用缓存位置)');
        // GPS失败时仍然通知，让地图用缓存位置显示
        if (this._current && !this._notifiedCached) {
          this._notifiedCached = true;
          this._notifyListeners();
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: CONFIG.LOCATION.UPDATE_INTERVAL,
      }
    );
  },

  // 停止监听
  stop() {
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
  },

  // 模拟定位（Demo/桌面调试用）
  _simulated: null,

  setSimulatedPosition(lat, lng) {
    this._simulated = { lat, lng, accuracy: 5, timestamp: Date.now() };
    this._notifyListeners();
  },

  clearSimulatedPosition() {
    this._simulated = null;
    if (this._current) this._notifyListeners();
  },

  isSimulated() {
    return !!this._simulated;
  },

  // 获取上次已知位置（模拟优先）
  getCurrent() {
    return this._simulated || this._current;
  },

  // 位置是否有效（未过期）
  isValid() {
    if (!this._current) return false;
    return (Date.now() - this._current.timestamp) < CONFIG.LOCATION.STALE_THRESHOLD;
  },

  // 监听位置更新
  onChange(fn) {
    this._listeners.push(fn);
  },

  _notifyListeners() {
    this._listeners.forEach(fn => {
      try { fn(this._current); } catch (e) { console.warn('位置监听器异常:', e); }
    });
  },
};
