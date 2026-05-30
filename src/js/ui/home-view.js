// 此刻·此地 — 主页面
const HomeView = {
  _container: null,

  async render(container) {
    this._container = container;
    const settings = StorageService.getUserSettings();
    const nickname = settings.nickname || '旅人';
    const avatar = settings.avatar || '🌲';

    // 获取我的信件和回响
    const myLetters = await this._getMyLetters(nickname);
    const recentReplies = this._getRecentReplies(myLetters);

    // 附近信件数（如果有位置）
    let nearbyCount = 0;
    const pos = LocationService.getCurrent();
    if (pos) {
      nearbyCount = (await StorageService.getNearbyLetters(pos.lat, pos.lng)).length;
    }

    container.innerHTML = `
      <div class="home-view" id="home-scroll">
        <!-- 下拉刷新指示器 -->
        <div class="home-refresh-indicator" id="home-refresh-indicator">
          <span class="home-refresh-icon">↓</span>
          <span class="home-refresh-text">下拉刷新</span>
        </div>
        <!-- 背景纹理 -->
        <div class="home-bg-texture"></div>
        <div class="home-bg-grain"></div>

        <!-- 顶部：身份 + 时间 -->
        <div class="home-header">
          <div class="home-header-top">
            <div class="home-avatar" id="btn-home-avatar">${avatar}</div>
            <div class="home-header-right">
              <div class="home-greeting">${this._greeting()}</div>
              <div class="home-nickname">${Helpers.escapeHtml(nickname)}</div>
            </div>
          </div>
          <div class="home-title-block">
            <h1 class="home-title">此刻<span class="home-title-sep">·</span>此地</h1>
            <p class="home-subtitle">用相机在真实世界留下和发现信件</p>
          </div>
        </div>

        <!-- 统计卡片 -->
        <div class="home-stats-row">
          <div class="home-stat-card">
            <div class="home-stat-num">${myLetters.length}</div>
            <div class="home-stat-label">我寄出的信</div>
          </div>
          <div class="home-stat-card">
            <div class="home-stat-num">${recentReplies.length}</div>
            <div class="home-stat-label">收到的回响</div>
          </div>
          <div class="home-stat-card">
            <div class="home-stat-num">${nearbyCount || '?'}</div>
            <div class="home-stat-label">附近信件</div>
          </div>
        </div>

        <!-- 核心操作：探索地图 -->
        <button class="home-explore-btn" id="btn-explore-map">
          <span class="home-explore-icon">🗺️</span>
          <span class="home-explore-text">探索附近地图</span>
          <span class="home-explore-arrow">→</span>
        </button>

        <!-- 我寄出的信 -->
        <div class="home-section">
          <div class="home-section-header">
            <h3 class="home-section-title">📮 我寄出的信</h3>
            ${myLetters.length > 0 ? `<span class="home-section-count">${myLetters.length}封</span>` : ''}
          </div>
          ${myLetters.length > 0
            ? `<div class="home-letter-list">${myLetters.slice(0, 5).map(l => this._renderLetterCard(l)).join('')}</div>
               ${myLetters.length > 5 ? `<button class="home-viewall-btn" id="btn-view-all-letters">查看全部 ${myLetters.length} 封 →</button>` : ''}`
            : `<div class="home-empty">
                <div class="home-empty-icon">✉️</div>
                <p class="home-empty-text">还没有写过信</p>
                <p class="home-empty-sub">去探索地图，在某个地方留下第一封信</p>
               </div>`}
        </div>

        <!-- 最新回响 -->
        ${recentReplies.length > 0 ? `
        <div class="home-section">
          <div class="home-section-header">
            <h3 class="home-section-title">💌 最新回响</h3>
          </div>
          <div class="home-replies-list">
            ${recentReplies.slice(0, 5).map(r => this._renderReplyItem(r)).join('')}
          </div>
        </div>` : ''}

        <!-- 底部安全区 -->
        <div class="home-bottom-spacer"></div>
      </div>
    `;

    this._bindEvents(container, myLetters, recentReplies);
    this._setupPullToRefresh(container);
  },

  _greeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 9) return '早安';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    if (h < 22) return '傍晚好';
    return '夜深了';
  },

  async _getMyLetters(nickname) {
    if (!nickname) return [];
    try {
      const all = await StorageService.getAllLetters();
      return all
        .filter(l => l.sender.nickname === nickname)
        .sort((a, b) => b.created - a.created);
    } catch (e) {
      return [];
    }
  },

  _getRecentReplies(myLetters) {
    const replies = [];
    myLetters.forEach(letter => {
      (letter.replies || []).forEach(reply => {
        replies.push({
          ...reply,
          letterTitle: letter.content.title || '无名信',
          letterId: letter.id,
          letterType: letter.type,
        });
      });
    });
    replies.sort((a, b) => b.time - a.time);
    return replies;
  },

  _renderLetterCard(letter) {
    const typeIcon = { public: '📮', self_capsule: '⏳', secret: '🔒' }[letter.type];
    const typeName = { public: '公开信', self_capsule: '时光胶囊', secret: '密信' }[letter.type];
    const replyCount = letter.replies ? letter.replies.length : 0;

    return `
      <div class="home-letter-card" data-id="${letter.id}">
        <div class="hlc-left">
          <div class="hlc-icon">${typeIcon}</div>
          <div class="hlc-info">
            <div class="hlc-title">${Helpers.escapeHtml(letter.content.title || '无名信')}</div>
            <div class="hlc-meta">
              <span>${typeName}</span>
              <span class="hlc-sep">·</span>
              <span>${Helpers.formatRelativeTime(letter.created)}</span>
              ${letter.location.name ? `<span class="hlc-sep">·</span><span>📍 ${Helpers.escapeHtml(letter.location.name)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="hlc-right">
          ${replyCount > 0 ? `<span class="hlc-replies">${replyCount} 💌</span>` : ''}
          <span class="hlc-arrow">›</span>
        </div>
      </div>
    `;
  },

  _renderReplyItem(reply) {
    return `
      <div class="home-reply-item" data-letter-id="${reply.letterId}">
        <div class="hri-avatar">${reply.avatar || '💬'}</div>
        <div class="hri-body">
          <div class="hri-text">${Helpers.escapeHtml(reply.body)}</div>
          <div class="hri-meta">
            <span class="hri-author">${Helpers.escapeHtml(reply.nickname)}</span>
            <span>回复了</span>
            <span class="hri-letter">「${Helpers.escapeHtml(reply.letterTitle)}」</span>
            <span>${Helpers.formatRelativeTime(reply.time)}</span>
          </div>
        </div>
      </div>
    `;
  },

  _bindEvents(container, myLetters) {
    // 探索地图按钮
    container.querySelector('#btn-explore-map').addEventListener('click', () => {
      App.navigateTo('map');
    });

    // 头像点击 → 编辑资料
    const avatarBtn = container.querySelector('#btn-home-avatar');
    if (avatarBtn) {
      avatarBtn.addEventListener('click', () => {
        this._editProfile(container);
      });
    }

    // 点击信件卡片 → 阅读
    container.querySelectorAll('.home-letter-card').forEach((el, i) => {
      el.addEventListener('click', () => {
        const letters = myLetters.slice(0, 5);
        App.navigateTo('read', { letterId: letters[i].id });
      });
    });

    // 点击回响 → 跳转到对应信件
    container.querySelectorAll('.home-reply-item').forEach(el => {
      el.addEventListener('click', () => {
        const letterId = el.dataset.letterId;
        App.navigateTo('read', { letterId });
      });
    });

    // 查看全部信件
    const viewAllBtn = container.querySelector('#btn-view-all-letters');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.home-letter-card').forEach(el => el.style.display = '');
        viewAllBtn.style.display = 'none';
        // 显示所有信件
        const list = container.querySelector('.home-letter-list');
        if (list) {
          list.innerHTML = myLetters.map(l => this._renderLetterCard(l)).join('');
          list.querySelectorAll('.home-letter-card').forEach((el, i) => {
            el.addEventListener('click', () => {
              App.navigateTo('read', { letterId: myLetters[i].id });
            });
          });
        }
      });
    }
  },

  _editProfile(container) {
    const settings = StorageService.getUserSettings();
    const avatars = ['🌲', '🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🐸', '🦁', '🐙', '🌸', '🌟', '🌈', '💎', '🎈', '🎵', '📚', '☕'];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card profile-modal">
        <div class="modal-close" id="modal-close">✕</div>
        <h3 class="profile-title">编辑资料</h3>
        <label class="setup-label">昵称</label>
        <input type="text" class="setup-input" id="edit-nickname"
               maxlength="12" value="${Helpers.escapeHtml(settings.nickname || '')}">
        <label class="setup-label">头像</label>
        <div class="setup-avatar-grid" id="edit-avatar-grid">
          ${avatars.map(a => `<button class="setup-avatar-btn ${a === settings.avatar ? 'selected' : ''}" data-avatar="${a}">${a}</button>`).join('')}
        </div>
        <button class="setup-btn primary" id="btn-save-profile">保存</button>
      </div>
    `;
    document.body.appendChild(overlay);

    let selectedAvatar = settings.avatar || '🌲';

    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelectorAll('.setup-avatar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.setup-avatar-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAvatar = btn.dataset.avatar;
      });
    });

    overlay.querySelector('#btn-save-profile').addEventListener('click', () => {
      const newNickname = overlay.querySelector('#edit-nickname').value.trim();
      if (!newNickname) return;
      StorageService.saveUserSettings({ nickname: newNickname, avatar: selectedAvatar });
      overlay.remove();
      this.render(container);
    });
  },

  _setupPullToRefresh(container) {
    const scrollEl = container.querySelector('#home-scroll');
    const indicator = container.querySelector('#home-refresh-indicator');
    if (!scrollEl || !indicator) return;

    const THRESHOLD = 60;
    let startY = 0;
    let pulling = false;
    let refreshing = false;

    scrollEl.addEventListener('touchstart', (e) => {
      if (refreshing) return;
      if (scrollEl.scrollTop <= 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    scrollEl.addEventListener('touchmove', (e) => {
      if (!pulling || refreshing) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && scrollEl.scrollTop <= 0) {
        const pull = Math.min(dy * 0.4, THRESHOLD * 1.5);
        indicator.style.height = `${pull}px`;
        indicator.style.opacity = Math.min(pull / THRESHOLD, 1);
        const icon = indicator.querySelector('.home-refresh-icon');
        const text = indicator.querySelector('.home-refresh-text');
        if (pull >= THRESHOLD) {
          if (icon) icon.textContent = '↻';
          if (text) text.textContent = '释放刷新';
        } else {
          if (icon) icon.textContent = '↓';
          if (text) text.textContent = '下拉刷新';
        }
      }
    }, { passive: true });

    scrollEl.addEventListener('touchend', async () => {
      if (!pulling) return;
      pulling = false;
      const currentHeight = parseFloat(indicator.style.height) || 0;
      if (currentHeight >= THRESHOLD && !refreshing) {
        refreshing = true;
        indicator.style.height = '48px';
        indicator.style.opacity = '1';
        const icon = indicator.querySelector('.home-refresh-icon');
        const text = indicator.querySelector('.home-refresh-text');
        if (icon) { icon.textContent = '↻'; icon.classList.add('spinning'); }
        if (text) text.textContent = '刷新中...';
        await this.render(container);
        setTimeout(() => {
          indicator.style.height = '0px';
          indicator.style.opacity = '0';
          if (icon) icon.classList.remove('spinning');
          refreshing = false;
        }, 300);
      } else {
        indicator.style.height = '0px';
        indicator.style.opacity = '0';
      }
    });
  },
};
