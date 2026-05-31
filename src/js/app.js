// 此刻·此地 — 主路由与初始化
const App = {
  _currentView: null,
  _previousView: null,
  _viewParams: null,

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

      // 首次使用：使用入门引导
      const settings = StorageService.getUserSettings();
      if (!settings.nickname) {
        this.navigateTo('onboarding');
        return;
      }

      this._startApp();
    } catch (e) {
      console.error('初始化失败:', e);
      Helpers.showError();
    }
  },

  async _startApp() {
    // 尝试连接后端同步服务
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

    // 检查本地到期时光胶囊
    this._checkLocalCapsules();

    this.navigateTo('home');
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

  navigateTo(viewName, params = {}) {
    if (!this.views[viewName]) {
      console.error(`未知视图: ${viewName}`);
      return;
    }

    const container = document.getElementById('view-container');
    const direction = this._currentView ? 'forward' : 'forward';
    this._previousView = this._currentView;
    this._currentView = viewName;
    this._viewParams = params;

    // 播放翻页音效
    try { SoundEngine.playPageTurn(); } catch (e) {}

    container.innerHTML = '';

    try {
      this.views[viewName].render(container, params);
      // 新页面滑入动画
      try { AnimationEngine.pageEnter(container.firstElementChild, direction); } catch (e) {}
    } catch (e) {
      console.error(`视图 ${viewName} 渲染失败:`, e);
      Helpers.showError();
    }

    // 通知视图变更
    try {
      document.dispatchEvent(new CustomEvent('viewchange', {
        detail: { view: viewName, previous: this._previousView }
      }));
    } catch (e) {}
  },

  getCurrentView() {
    return this._currentView;
  },

  getPreviousView() {
    return this._previousView;
  },
};

document.addEventListener('DOMContentLoaded', () => {
  App.init().catch(e => {
    console.error('应用启动失败:', e);
    Helpers.showError();
  });
});
