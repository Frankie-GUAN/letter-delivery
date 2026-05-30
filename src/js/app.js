// 此刻·此地 — 主路由与初始化
const App = {
  _currentView: null,
  _viewParams: null,

  views: {
    map: MapView,
    camera: CameraView,
    compose: LetterComposer,
    read: LetterReader,
  },

  async init() {
    try {
      await StorageService.init();
      LocationService.start();
      this.navigateTo('map');
    } catch (e) {
      console.error('初始化失败:', e);
      Helpers.showError();
    }
  },

  navigateTo(viewName, params = {}) {
    if (!this.views[viewName]) {
      console.error(`未知视图: ${viewName}`);
      return;
    }

    this._currentView = viewName;
    this._viewParams = params;

    const container = document.getElementById('view-container');
    container.innerHTML = '';

    try {
      this.views[viewName].render(container, params);
    } catch (e) {
      console.error(`视图 ${viewName} 渲染失败:`, e);
      Helpers.showError();
    }
  },

  getCurrentView() {
    return this._currentView;
  },
};

document.addEventListener('DOMContentLoaded', () => {
  App.init().catch(e => {
    console.error('应用启动失败:', e);
    Helpers.showError();
  });
});
