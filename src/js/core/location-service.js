// 此刻·此地 — 定位服务
const LocationService = {
  _watchId: null,
  _current: null,       // { lat, lng, accuracy, timestamp }
  _listeners: [],

  // 开始监听位置
  start() {
    if (!navigator.geolocation) {
      console.warn('Geolocation API 不可用');
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
        this._notifyListeners();
      },
      (err) => {
        console.warn('定位失败:', err.message);
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

  // 获取上次已知位置
  getCurrent() {
    return this._current;
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
