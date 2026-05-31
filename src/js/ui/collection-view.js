// 此刻·此地 — 信匣（收藏视图）
const CollectionView = {
  _container: null,
  _activeTab: 'sent',
  _sortBy: 'newest',

  async render(container) {
    this._container = container;
    const settings = StorageService.getUserSettings();
    const nickname = settings.nickname;
    const allLetters = await StorageService.getAllLetters();

    const myLetters = allLetters
      .filter(l => l.sender.nickname === nickname)
      .sort((a, b) => b.created - a.created);

    const discovered = allLetters
      .filter(l => l.sender.nickname !== nickname)
      .sort((a, b) => b.created - a.created);

    const capsules = allLetters
      .filter(l => l.type === 'self_capsule')
      .sort((a, b) => b.created - a.created);

    const secrets = allLetters
      .filter(l => l.type === 'secret')
      .sort((a, b) => b.created - a.created);

    container.innerHTML = `
      <div class="collection-view" id="collection-scroll">
        <div class="vignette-overlay"></div>
        <div class="collection-top">
          <button class="collection-back-btn" id="btn-collection-back">← 返回</button>
          <h1 class="collection-title">信匣</h1>
          <div class="collection-sort" id="btn-collection-sort">${this._sortIcon()}</div>
        </div>

        <div class="collection-tabs">
          <div class="tab-bar">
            <button class="tab-btn ${this._activeTab === 'sent' ? 'active' : ''}" data-tab="sent">
              📮 我的信 <span class="tab-count">${myLetters.length}</span>
            </button>
            <button class="tab-btn ${this._activeTab === 'discovered' ? 'active' : ''}" data-tab="discovered">
              🗺️ 发现的 <span class="tab-count">${discovered.length}</span>
            </button>
            <button class="tab-btn ${this._activeTab === 'capsules' ? 'active' : ''}" data-tab="capsules">
              ⏳ 胶囊 <span class="tab-count">${capsules.length}</span>
            </button>
            <button class="tab-btn ${this._activeTab === 'secrets' ? 'active' : ''}" data-tab="secrets">
              🔒 密信 <span class="tab-count">${secrets.length}</span>
            </button>
          </div>
        </div>

        <div class="collection-grid" id="collection-grid">
          ${this._renderGrid(this._getActiveLetters(myLetters, discovered, capsules, secrets))}
        </div>

        <div class="collection-bottom-spacer"></div>
      </div>
    `;

    this._bindEvents(container, { myLetters, discovered, capsules, secrets });

    // 交错淡入效果
    const cards = container.querySelectorAll('.envelope-card');
    AnimationEngine.staggerFadeIn(Array.from(cards), 40, 350);

    // 尘埃粒子
    if (this._dust && this._dust.parentNode) this._dust.remove();
    this._dust = AnimationEngine.floatingDust(container.querySelector('.collection-view'), 15);
  },

  _renderGrid(letters) {
    if (letters.length === 0) {
      const messages = {
        sent: '还没有寄出过信<br><small>去探索地图，留下第一封信吧</small>',
        discovered: '还没有发现过别人的信<br><small>去附近的地图看看吧</small>',
        capsules: '还没有时光胶囊<br><small>写一封给未来自己的信吧</small>',
        secrets: '还没有密信<br><small>写一封只有特定的人才能打开的信吧</small>',
      };
      return `
        <div class="collection-empty">
          <div class="collection-empty-icon">${this._activeTab === 'sent' ? '📮' : this._activeTab === 'capsules' ? '⏳' : this._activeTab === 'secrets' ? '🔒' : '🗺️'}</div>
          <p>${messages[this._activeTab] || '空空如也'}</p>
        </div>
      `;
    }

    return letters.map((l, i) => this._renderCard(l, i)).join('');
  },

  _renderCard(letter, index) {
    const typeIcon = { public: '📮', self_capsule: '⏳', secret: '🔒' }[letter.type];
    const replyCount = letter.replies ? letter.replies.length : 0;
    const sealClass = { public: 'public', self_capsule: 'capsule', secret: 'secret' }[letter.type];
    const settings = StorageService.getUserSettings();
    const isMine = letter.sender.nickname === settings.nickname;
    const finalSealClass = isMine ? 'mine' : sealClass;

    return `
      <div class="envelope-card ${index % 3 === 1 ? 'torn-edge' : ''}" data-id="${letter.id}">
        <div class="env-card-top">
          <div class="envelope-seal ${finalSealClass}">${typeIcon}</div>
          <div class="env-card-badges">
            ${replyCount > 0 ? `<span class="seal-badge public">💌 ${replyCount}</span>` : ''}
          </div>
        </div>
        <div class="env-card-title">${Helpers.escapeHtml(letter.content.title || '无名信')}</div>
        <div class="env-card-meta">
          <span>${letter.location.name ? '📍 ' + Helpers.escapeHtml(letter.location.name) : '某处'}</span>
          <span>${Helpers.formatRelativeTime(letter.created)}</span>
        </div>
        <div class="env-card-sender">
          <span>${letter.sender.avatar || '✉️'}</span>
          <span>${Helpers.escapeHtml(letter.sender.nickname)}</span>
        </div>
        ${letter.photo.thumbnail ? `
          <div class="env-card-thumb">
            <img src="${letter.photo.thumbnail}" alt="" loading="lazy">
          </div>
        ` : ''}
      </div>
    `;
  },

  _bindEvents(container, { myLetters, discovered, capsules, secrets }) {
    container.querySelector('#btn-collection-back').addEventListener('click', () => {
      App.navigateTo('home');
    });

    container.querySelector('#btn-collection-sort').addEventListener('click', () => {
      SoundEngine.playUIHover();
      const sorts = ['newest', 'oldest', 'mood'];
      const idx = sorts.indexOf(this._sortBy);
      this._sortBy = sorts[(idx + 1) % sorts.length];
      container.querySelector('#btn-collection-sort').innerHTML = this._sortIcon();
      this._refreshGrid(myLetters, discovered, capsules, secrets);
    });

    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundEngine.playUIHover();
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._activeTab = btn.dataset.tab;
        this._refreshGrid(myLetters, discovered, capsules, secrets);
      });
    });

    container.querySelectorAll('.envelope-card').forEach(card => {
      card.addEventListener('click', () => {
        SoundEngine.playUIClick();
        App.navigateTo('read', { letterId: card.dataset.id });
      });

      // 长按删除（仅自己的信）
      let longPressTimer;
      card.addEventListener('touchstart', () => {
        longPressTimer = setTimeout(() => {
          const id = card.dataset.id;
          const letter = [...myLetters, ...discovered, ...capsules, ...secrets].find(l => l.id === id);
          if (letter && letter.sender.nickname === StorageService.getUserSettings().nickname) {
            this._confirmDelete(id, container);
          }
        }, 600);
      });
      card.addEventListener('touchend', () => clearTimeout(longPressTimer));
      card.addEventListener('touchmove', () => clearTimeout(longPressTimer));
    });
  },

  _refreshGrid(myLetters, discovered, capsules, secrets) {
    const grid = document.getElementById('collection-grid');
    if (!grid) return;
    const letters = this._getActiveLetters(myLetters, discovered, capsules, secrets);
    grid.innerHTML = this._renderGrid(letters);
    const cards = grid.querySelectorAll('.envelope-card');
    AnimationEngine.staggerFadeIn(Array.from(cards), 30, 300);
    // 只重新绑定卡片事件，不绑定顶栏持久元素（避免重复绑定额外回调）
    this._bindCardEvents(grid, { myLetters, discovered, capsules, secrets });
  },

  _bindCardEvents(grid, { myLetters, discovered, capsules, secrets }) {
    grid.querySelectorAll('.envelope-card').forEach(card => {
      card.addEventListener('click', () => {
        SoundEngine.playUIClick();
        App.navigateTo('read', { letterId: card.dataset.id });
      });
      let longPressTimer;
      card.addEventListener('touchstart', () => {
        longPressTimer = setTimeout(() => {
          const id = card.dataset.id;
          const letter = [...myLetters, ...discovered, ...capsules, ...(secrets || [])].find(l => l.id === id);
          if (letter && letter.sender.nickname === StorageService.getUserSettings().nickname) {
            this._confirmDelete(id, this._container);
          }
        }, 600);
      });
      card.addEventListener('touchend', () => clearTimeout(longPressTimer));
      card.addEventListener('touchmove', () => clearTimeout(longPressTimer));
    });
  },

  _getActiveLetters(myLetters, discovered, capsules, secrets) {
    let letters;
    switch (this._activeTab) {
      case 'sent': letters = myLetters; break;
      case 'discovered': letters = discovered; break;
      case 'capsules': letters = capsules; break;
      case 'secrets': letters = secrets; break;
      default: letters = myLetters;
    }

    if (this._sortBy === 'oldest') letters = [...letters].reverse();
    else if (this._sortBy === 'mood') {
      const moodOrder = ['温柔', '俏皮', '深情', '怀念', '期待', '感谢'];
      letters = [...letters].sort((a, b) => {
        const ia = moodOrder.indexOf(a.content.mood);
        const ib = moodOrder.indexOf(b.content.mood);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    }
    return letters;
  },

  _sortIcon() {
    const icons = { newest: '🕐', oldest: '📅', mood: '🎭' };
    const labels = { newest: '最新', oldest: '最早', mood: '情绪' };
    return `${icons[this._sortBy]} ${labels[this._sortBy]}`;
  },

  _confirmDelete(letterId, container) {
    SoundEngine.playError();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" style="text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">🗑️</div>
        <h3 style="font-size:17px;color:var(--text);margin:0 0 8px;">删除这封信？</h3>
        <p style="font-size:13px;color:var(--text-dim);margin:0 0 20px;">删除后无法恢复</p>
        <div style="display:flex;gap:10px;">
          <button class="passphrase-submit" style="flex:1;background:var(--bg);color:var(--text);" id="btn-cancel-delete">取消</button>
          <button class="passphrase-submit" style="flex:1;background:var(--danger);" id="btn-confirm-delete">删除</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#btn-cancel-delete').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#btn-confirm-delete').addEventListener('click', async () => {
      await StorageService.deleteLetter(letterId);
      overlay.remove();
      this.render(container);
    });
  },
};
