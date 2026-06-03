// 此刻·此地 — 主路由与初始化
const App = {
  _currentView: null,
  _historyStack: [],
  _historyIndex: -1,
  _viewParams: null,
  _historyBound: false,

  views: {
    home: HomeView,
    map: MapView,
    camera: CameraView,
    compose: LetterComposer,
    read: LetterReader,
    collection: CollectionView,
    discover: DiscoverView,
    onboarding: OnboardingView,
  },

  async init() {
    try {
      await StorageService.init();
      LocationService.start();
      this._bindHistory();

      // 首次使用 → 入门引导
      const settings = StorageService.getUserSettings();
      if (!settings.nickname) {
        this.navigateTo('onboarding', {}, { replace: true });
        return;
      }

      this._startApp();
    } catch (e) {
      console.error('初始化失败:', e);
      Helpers.showError();
    }
  },

  async _startApp() {
    // 先渲染首页，让用户尽快看到界面
    this.navigateTo('home', {}, { replace: true });

    // 后台异步：尝试连接后端同步服务（不阻塞UI）
    this._initBackend();
  },

  async _initBackend() {
    try {
      const isOnline = await ApiService.checkConnection();
      if (isOnline) {
        SyncService.start();
        SyncService.requestNotificationPermission();

        // 注册当前用户
        const settings = StorageService.getUserSettings();
        if (settings.nickname) {
          ApiService.registerNotification(settings.nickname);
        }
      }
    } catch (e) {
      // 后端不可用，离线使用
    }

    // 检查本地到期时光胶囊
    this._checkLocalCapsules();
  },

  async _checkLocalCapsules() {
    try {
      const all = await StorageService.getAllLetters();
      const now = Date.now();
      const settings = StorageService.getUserSettings();
      const nickname = settings.nickname;

      const dueCapsules = all.filter(l =>
        l.type === 'self_capsule' &&
        l.capsule &&
        now >= l.capsule.unlockAt &&
        !l.capsule.openedBy.includes(nickname)
      );

      if (dueCapsules.length > 0) {
        try { SoundEngine.playNotification(); } catch (e) {}
        // 浏览器通知
        if ('Notification' in window && Notification.permission === 'granted') {
          dueCapsules.forEach(l => {
            new Notification('⏳ 时光胶囊已到期', {
              body: `「${l.content.title || '无名信'}」可以打开了`,
              icon: '⏳',
            });
          });
        }
      }
    } catch (e) {
      // 静默
    }
  },

  async navigateTo(viewName, params = {}, options = {}) {
    if (!this.views[viewName]) {
      console.error(`未知视图: ${viewName}`);
      return;
    }

    const { replace = false, skipHistory = false, direction = 'forward' } = options;
    const container = document.getElementById('view-container');
    const previousView = this._currentView;
    const previousViewObj = previousView ? this.views[previousView] : null;
    const previousEl = container ? container.querySelector('.view-root') : null;

    // 播放翻页音效
    try { SoundEngine.playPageTurn(); } catch (e) {}

    try {
      if (previousViewObj && typeof previousViewObj.destroy === 'function') {
        try { previousViewObj.destroy(); } catch (e) {}
      }

      if (!container) throw new Error('缺少视图容器');
      const viewRoot = document.createElement('div');
      viewRoot.className = 'view-root';
      viewRoot.dataset.view = viewName;
      container.appendChild(viewRoot);

      this._currentView = viewName;
      this._viewParams = params;

      await Promise.resolve(this.views[viewName].render(viewRoot, params));

      try { AnimationEngine.pageEnter(viewRoot, direction === 'back' ? 'back' : 'forward'); } catch (e) {}
      if (previousEl) {
        previousEl.classList.add('view-exit');
        setTimeout(() => { if (previousEl.parentNode) previousEl.remove(); }, 320);
      }

      if (!skipHistory) {
        this._pushHistory(viewName, params, replace);
      }
    } catch (e) {
      console.error(`视图 ${viewName} 渲染失败:`, e);
      Helpers.showError();
    }

    // 通知视图变更
    try {
      document.dispatchEvent(new CustomEvent('viewchange', {
        detail: { view: viewName, previous: previousView }
      }));
    } catch (e) {}
  },

  goBack(fallbackView = 'home') {
    if (this._isHistorySupported() && this._historyIndex > 0) {
      history.back();
      return;
    }
    const target = this._historyStack[this._historyIndex - 1];
    if (target && target.view) {
      this._historyIndex = Math.max(0, this._historyIndex - 1);
      this.navigateTo(target.view, target.params || {}, { skipHistory: true, direction: 'back' });
      return;
    }
    this.navigateTo(fallbackView);
  },

  _isHistorySupported() {
    return typeof history !== 'undefined' && typeof history.pushState === 'function';
  },

  _bindHistory() {
    if (this._historyBound || !this._isHistorySupported()) return;
    this._historyBound = true;
    window.addEventListener('popstate', (event) => {
      const idx = event.state && typeof event.state.index === 'number'
        ? event.state.index
        : null;
      if (idx === null || idx === this._historyIndex) return;
      const entry = this._historyStack[idx];
      if (!entry) return;
      const direction = idx < this._historyIndex ? 'back' : 'forward';
      this._historyIndex = idx;
      this.navigateTo(entry.view, entry.params || {}, { skipHistory: true, direction });
    });
  },

  _pushHistory(viewName, params, replace = false) {
    if (this._historyIndex < this._historyStack.length - 1) {
      this._historyStack = this._historyStack.slice(0, this._historyIndex + 1);
    }
    const entry = { view: viewName, params };
    if (replace) {
      if (this._historyIndex < 0) {
        this._historyStack = [entry];
        this._historyIndex = 0;
        if (this._isHistorySupported()) {
          history.replaceState({ index: 0 }, '', window.location.href);
        }
        return;
      }
      this._historyStack[this._historyIndex] = entry;
      if (this._isHistorySupported()) {
        history.replaceState({ index: this._historyIndex }, '', window.location.href);
      }
      return;
    }
    this._historyStack.push(entry);
    this._historyIndex = this._historyStack.length - 1;
    if (this._isHistorySupported()) {
      history.pushState({ index: this._historyIndex }, '', window.location.href);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  App.init().catch(e => {
    console.error('应用启动失败:', e);
    Helpers.showError();
  });
});
