// 此刻·此地 — 同步与通知服务（完整版）
const SyncService = {
  _syncTimer: null,
  _notifyTimer: null,
  _retryTimer: null,
  _lastSync: 0,
  _syncInterval: CONFIG.SYNC.INTERVAL,
  _notifyInterval: CONFIG.SYNC.NOTIFY_INTERVAL,

  // 启动同步循环
  start() {
    if (!ApiService.isOnline()) {
      console.warn('后端服务不可用，30s 后重试...');
      this._startRetryLoop();
      return;
    }
    this._lastSync = parseInt(localStorage.getItem('cikecidi_last_sync') || '0');
    this._startSyncLoop();
    this._startNotifyLoop();
  },

  stop() {
    this._stopSyncLoop();
    this._stopNotifyLoop();
    this._stopRetryLoop();
  },

  _startRetryLoop() {
    this._stopRetryLoop();
    this._retryTimer = setInterval(() => {
      if (ApiService.isOnline()) {
        console.log('后端服务已恢复，启动同步');
        this._stopRetryLoop();
        this._lastSync = parseInt(localStorage.getItem('cikecidi_last_sync') || '0');
        this._startSyncLoop();
        this._startNotifyLoop();
      }
    }, 30000);
  },

  _stopRetryLoop() {
    if (this._retryTimer) {
      clearInterval(this._retryTimer);
      this._retryTimer = null;
    }
  },

  _startSyncLoop() {
    this._syncTimer = setInterval(() => this._doSync(), this._syncInterval);
    this._doSync(); // 首次立即同步
  },

  _stopSyncLoop() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  },

  _startNotifyLoop() {
    this._notifyTimer = setInterval(() => this._checkNotifications(), this._notifyInterval);
    this._checkNotifications(); // 首次立即检查
  },

  _stopNotifyLoop() {
    if (this._notifyTimer) {
      clearInterval(this._notifyTimer);
      this._notifyTimer = null;
    }
  },

  // 执行双向同步
  async _doSync() {
    try {
      const localLetters = await StorageService.getUnsyncedLetters();
      const result = await ApiService.sync(localLetters, this._lastSync);

      // 标记本地已同步
      if (localLetters.length > 0) {
        await StorageService.markSynced(localLetters.map(l => l.id));
      }

      // 导入服务器新信件
      if (result.newLetters && result.newLetters.length > 0) {
        for (const letter of result.newLetters) {
          await StorageService.saveLetter(letter);
        }
      }

      this._lastSync = result.serverTime;
      localStorage.setItem('cikecidi_last_sync', String(this._lastSync));
    } catch (e) {
      console.warn('同步失败:', e.message);
    }
  },

  // 检查推送通知
  async _checkNotifications() {
    try {
      const settings = StorageService.getUserSettings();
      if (!settings.nickname) return;

      const pos = LocationService.getCurrent();
      if (!pos) return;

      const result = await ApiService.checkNotifications(
        settings.nickname,
        pos.lat,
        pos.lng
      );

      if (result.events && result.events.length > 0) {
        result.events.forEach(event => this._showNotification(event));
      }
    } catch (e) {
      // 静默失败，不影响用户体验
    }
  },

  // 显示浏览器通知 / 应用内横幅
  _showNotification(event) {
    const shown = new Set(
      JSON.parse(localStorage.getItem('cikecidi_notified') || '[]')
    );

    // 去重：相同事件不重复通知
    const key = `${event.type}-${event.letterId}`;
    if (shown.has(key)) return;

    shown.add(key);
    // 只保留最近100条记录
    if (shown.size > 100) {
      const arr = Array.from(shown);
      arr.slice(arr.length - 100).forEach(k => shown.delete(k));
    }
    localStorage.setItem('cikecidi_notified', JSON.stringify(Array.from(shown)));

    // 优先使用浏览器Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('此刻·此地', { body: event.message, icon: '📮' });
    } else {
      // 降级：应用内横幅
      this._showInAppBanner(event.message);
    }
  },

  _showInAppBanner(message) {
    // 移出已有横幅
    const old = document.querySelector('.sync-banner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.className = 'sync-banner';
    banner.textContent = `📮 ${message}`;
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0;
      background: var(--accent, #c4852a); color: var(--surface, #fff9f0);
      text-align: center; padding: 14px 16px;
      padding-top: max(14px, env(safe-area-inset-top));
      font-size: 14px; font-weight: 600;
      z-index: 10000; cursor: pointer;
      animation: slideDown 0.3s ease;
    `;
    banner.addEventListener('click', () => banner.remove());
    document.body.appendChild(banner);

    // 5秒后自动消失
    setTimeout(() => {
      if (banner.parentNode) banner.remove();
    }, 5000);

  },

  // 请求通知权限
  async requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  },
};
