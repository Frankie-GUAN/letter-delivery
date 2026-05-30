// 此刻·此地 — 偶遇（随机发现）
const DiscoverView = {
  _container: null,
  _currentLetter: null,
  _encounteredIds: [],

  async render(container) {
    this._container = container;
    this._loadEncountered();

    container.innerHTML = `
      <div class="discover-view">
        <div class="vignette-overlay"></div>
        <div class="discover-top">
          <button class="discover-back-btn" id="btn-discover-back">← 返回</button>
          <h1 class="discover-title">偶遇</h1>
          <div class="discover-date">${this._todayString()}</div>
        </div>

        <div class="discover-card-area" id="discover-card-area">
          ${await this._renderRandomCard()}
        </div>

        <div class="discover-actions" id="discover-actions">
          <button class="discover-action secondary" id="btn-discover-shuffle">
            🔄 再换一封
          </button>
          <button class="discover-action primary" id="btn-discover-open">
            📖 打开看看
          </button>
        </div>
        <div class="discover-hint">
          每次打开"偶遇"，都会遇见一封随机信件。<br>
          如果感兴趣，可以去地图查看它在哪里。
        </div>
        <div class="discover-bottom-spacer"></div>
      </div>
    `;

    this._bindEvents(container);

    // 动画
    const card = container.querySelector('.discover-card');
    if (card) AnimationEngine.fadeIn(card, 500, 100);
    const actions = container.querySelector('.discover-actions');
    if (actions) AnimationEngine.fadeIn(actions, 400, 400);
  },

  async _renderRandomCard() {
    const allLetters = await StorageService.getAllLetters();
    const settings = StorageService.getUserSettings();

    // 排除自己的信 + 已偶遇过的
    const available = allLetters.filter(l =>
      l.sender.nickname !== settings.nickname &&
      !this._encounteredIds.includes(l.id)
    );

    // 如果没有新信，重置列表
    let pool = available.length > 0 ? available : allLetters.filter(l =>
      l.sender.nickname !== settings.nickname
    );

    if (pool.length === 0) {
      return `
        <div class="discover-empty">
          <div class="discover-empty-icon">🌍</div>
          <h3>还没有发现其他旅人的信</h3>
          <p>去地图看看附近是否有信件<br>或者等待其他旅人留下印记</p>
          <button class="discover-action primary" id="btn-discover-go-map" style="margin-top:20px;">🗺️ 探索地图</button>
        </div>
      `;
    }

    const letter = pool[Math.floor(Math.random() * pool.length)];
    this._currentLetter = letter;

    // 记录已偶遇
    if (!this._encounteredIds.includes(letter.id)) {
      this._encounteredIds.push(letter.id);
      if (this._encounteredIds.length > 100) this._encounteredIds.shift();
      this._saveEncountered();
    }

    const moodEmoji = { '温柔': '🌸', '俏皮': '🎈', '深情': '💫', '怀念': '🍂', '期待': '🌟', '感谢': '🙏' };
    const mood = letter.content.mood || '温柔';

    return `
      <div class="discover-card">
        <div class="discover-card-inner">
          ${letter.photo.thumbnail ? `
            <div class="discover-photo-wrap">
              <img src="${letter.photo.thumbnail}" alt="" class="discover-photo">
              <div class="discover-photo-blur"></div>
            </div>
          ` : `
            <div class="discover-no-photo">✉️</div>
          `}
          <div class="discover-card-content">
            <div class="discover-mood">${moodEmoji[mood] || '✨'} ${mood}</div>
            <h2 class="discover-card-title">${Helpers.escapeHtml(letter.content.title || '无名信')}</h2>
            <p class="discover-card-preview">${Helpers.escapeHtml((letter.content.body || '这封信没有文字，只有一张照片和一个地点。').slice(0, 80))}...</p>
            <div class="discover-card-meta">
              <span class="discover-meta-item">📍 ${Helpers.escapeHtml(letter.location.name || '某个角落')}</span>
              <span class="discover-meta-sep">·</span>
              <span class="discover-meta-item">🕐 ${Helpers.formatRelativeTime(letter.created)}</span>
              <span class="discover-meta-sep">·</span>
              <span class="discover-meta-item">${letter.type === 'secret' ? '🔒 密信' : letter.type === 'self_capsule' ? '⏳ 胶囊' : '📮 公开信'}</span>
            </div>
            <div class="discover-sender">
              <span>${letter.sender.avatar || '✉️'}</span>
              <span>${Helpers.escapeHtml(letter.sender.nickname)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _bindEvents(container) {
    container.querySelector('#btn-discover-back').addEventListener('click', () => {
      App.navigateTo('home');
    });

    // 洗牌
    const shuffleBtn = container.querySelector('#btn-discover-shuffle');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', async () => {
        SoundEngine.playPageTurn();
        const cardArea = container.querySelector('#discover-card-area');
        const card = cardArea.querySelector('.discover-card');
        if (card) {
          card.style.transition = 'opacity 0.2s, transform 0.2s';
          card.style.opacity = '0';
          card.style.transform = 'translateY(-20px)';
        }
        await new Promise(r => setTimeout(r, 250));
        cardArea.innerHTML = await this._renderRandomCard();
        const newCard = cardArea.querySelector('.discover-card');
        if (newCard) AnimationEngine.fadeIn(newCard, 350);
      });
    }

    // 打开
    const openBtn = container.querySelector('#btn-discover-open');
    if (openBtn && this._currentLetter) {
      openBtn.addEventListener('click', () => {
        SoundEngine.playOpenLetter();
        App.navigateTo('read', { letterId: this._currentLetter.id });
      });
    }

    // 去地图
    const mapBtn = container.querySelector('#btn-discover-go-map');
    if (mapBtn) {
      mapBtn.addEventListener('click', () => {
        SoundEngine.playUIClick();
        App.navigateTo('map');
      });
    }
  },

  _todayString() {
    const d = new Date();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${weekdays[d.getDay()]}`;
  },

  _loadEncountered() {
    try {
      this._encounteredIds = JSON.parse(localStorage.getItem('cikecidi_encountered') || '[]');
    } catch (e) {
      this._encounteredIds = [];
    }
  },

  _saveEncountered() {
    try {
      localStorage.setItem('cikecidi_encountered', JSON.stringify(this._encounteredIds));
    } catch (e) {}
  },
};
