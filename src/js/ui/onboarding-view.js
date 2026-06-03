// 此刻·此地 — 初至（入门引导）
const OnboardingView = {
  _container: null,
  _step: 0,
  _nickname: '',
  _avatar: '🌲',

  render(container) {
    this._container = container;
    this._step = 0;

    // 如果已经有昵称，直接跳到首页
    const settings = StorageService.getUserSettings();
    if (settings.nickname) {
      App._startApp();
      return;
    }

    this._renderStep(container);
  },

  _renderStep(container) {
    const steps = [
      this._renderWelcome,
      this._renderConcept,
      this._renderHowTo,
      this._renderProfile,
    ];

    container.innerHTML = `
      <div class="onboarding-view">
        <div class="ob-bg"></div>
        <div class="ob-steps-container" id="ob-steps-container">
          ${steps[this._step].call(this)}
        </div>
        <div class="ob-bottom">
          <div class="dot-indicators" id="ob-dots">
            ${[0,1,2,3].map(i => `
              <div class="dot-indicator ${i === this._step ? 'active' : ''} ${i < this._step ? 'done' : ''}"></div>
            `).join('')}
          </div>
          <div class="ob-nav-row">
            ${this._step > 0 ? '<button class="ob-nav-btn ob-back-btn" id="btn-ob-back">← 上一步</button>' : '<span></span>'}
            ${this._step < 3 ? `
              <button class="ob-nav-btn ob-skip-btn" id="btn-ob-skip">跳过 ›</button>
            ` : ''}
          </div>
          ${this._step < 3 ? `
            <button class="ob-next-btn" id="btn-ob-next">
              ${this._step === 0 ? '开始探索 →' : '下一步 →'}
            </button>
          ` : ''}
        </div>
      </div>
    `;

    if (this._step === 3) {
      this._bindProfileEvents(container);
    } else {
      container.querySelector('#btn-ob-next').addEventListener('click', () => {
        SoundEngine.playPageTurn();
        this._step++;
        this._renderStep(container);
        const stepsEl = container.querySelector('#ob-steps-container');
        if (stepsEl) {
          stepsEl.style.animation = 'slideInRight 0.35s ease forwards';
        }
      });
      // 跳过按钮 — 直接进入首页
      const skipBtn = container.querySelector('#btn-ob-skip');
      if (skipBtn) {
        skipBtn.addEventListener('click', () => {
          StorageService.saveUserSettings({ nickname: '旅人', avatar: '🌲' });
          SoundEngine.playPageTurn();
          App._startApp();
        });
      }
    }

    // 回退按钮
    const backBtn = container.querySelector('#btn-ob-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        SoundEngine.playPageTurn();
        this._step = Math.max(0, this._step - 1);
        this._renderStep(container);
        const stepsEl = container.querySelector('#ob-steps-container');
        if (stepsEl) {
          stepsEl.style.animation = 'slideInLeft 0.35s ease forwards';
        }
      });
    }

    // 更新 dots
    const dotsContainer = container.querySelector('#ob-dots');
    // dots already rendered in HTML above
  },

  _renderWelcome() {
    return `
      <div class="ob-step">
        <div class="ob-icon-large">✉️</div>
        <h1 class="ob-title">
          <span class="ink-text">欢迎来到</span>
        </h1>
        <h1 class="ob-title-main">
          <span class="ob-title-char" style="animation-delay:0.1s">此</span>
          <span class="ob-title-char" style="animation-delay:0.18s">刻</span>
          <span class="ob-title-sep" style="animation-delay:0.24s">·</span>
          <span class="ob-title-char" style="animation-delay:0.3s">此</span>
          <span class="ob-title-char" style="animation-delay:0.38s">地</span>
        </h1>
        <p class="ob-desc">用相机在真实世界留下和发现信件</p>
        <div class="ob-illustration">
          <div class="ob-illu-item">📷</div>
          <div class="ob-illu-arrow">→</div>
          <div class="ob-illu-item">✉️</div>
          <div class="ob-illu-arrow">→</div>
          <div class="ob-illu-item">🗺️</div>
        </div>
      </div>
    `;
  },

  _renderConcept() {
    return `
      <div class="ob-step">
        <div class="ob-icon-large">📍</div>
        <h2 class="ob-step-title">在这里，地点是秘密</h2>
        <p class="ob-step-desc">
          每封信都与一个真实位置绑定。<br>
          只有走到那个地方，举起相机，<br>
          对准拍下这封信的角度——<br>
          信才会从取景器中浮现。
        </p>
        <div class="ob-concept-cards">
          <div class="ob-concept-card">
            <div class="ob-cc-icon">📮</div>
            <div class="ob-cc-title">公开信</div>
            <div class="ob-cc-desc">留给所有路过的人</div>
          </div>
          <div class="ob-concept-card">
            <div class="ob-cc-icon">⏳</div>
            <div class="ob-cc-title">时光胶囊</div>
            <div class="ob-cc-desc">写给未来的自己</div>
          </div>
          <div class="ob-concept-card">
            <div class="ob-cc-icon">🔒</div>
            <div class="ob-cc-title">密信</div>
            <div class="ob-cc-desc">只有Ta能找到</div>
          </div>
        </div>
      </div>
    `;
  },

  _renderHowTo() {
    return `
      <div class="ob-step">
        <div class="ob-icon-large">📷</div>
        <h2 class="ob-step-title">用相机寻找和留下信</h2>
        <div class="ob-howto-steps">
          <div class="ob-howto-item">
            <div class="ob-howto-num">1</div>
            <div class="ob-howto-text">
              <strong>打开地图</strong>
              <span>发现附近的信封标记</span>
            </div>
          </div>
          <div class="ob-howto-item">
            <div class="ob-howto-num">2</div>
            <div class="ob-howto-text">
              <strong>走近目标地点</strong>
              <span>GPS会引导你靠近</span>
            </div>
          </div>
          <div class="ob-howto-item">
            <div class="ob-howto-num">3</div>
            <div class="ob-howto-text">
              <strong>举起相机</strong>
              <span>对准角度，信封会慢慢浮现</span>
            </div>
          </div>
          <div class="ob-howto-item">
            <div class="ob-howto-num">4</div>
            <div class="ob-howto-text">
              <strong>留下你的信</strong>
              <span>拍照、写字、投递——</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _renderProfile() {
    const avatars = ['🌲', '🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🐸', '🦁', '🐙', '🌸', '🌟', '🌈', '💎', '🎈', '🎵', '📚', '☕'];

    return `
      <div class="ob-step">
        <div class="ob-icon-large">👋</div>
        <h2 class="ob-step-title">介绍一下自己吧</h2>
        <p class="ob-step-desc">你的名字和头像会出现在写的每封信上</p>
        <div class="ob-profile-form">
          <label class="setup-label">你的昵称</label>
          <input type="text" class="setup-input" id="ob-nickname"
                 maxlength="12" placeholder="会出现在你写的每封信上...">
          <label class="setup-label">选一个头像</label>
          <div class="setup-avatar-grid" id="ob-avatar-grid">
            ${avatars.map(a => `<button class="setup-avatar-btn ${a === '🌲' ? 'selected' : ''}" data-avatar="${a}">${a}</button>`).join('')}
          </div>
          <button class="setup-btn primary" id="btn-ob-done" disabled>进入 此刻·此地</button>
        </div>
      </div>
    `;
  },

  _bindProfileEvents(container) {
    const nicknameInput = container.querySelector('#ob-nickname');
    const doneBtn = container.querySelector('#btn-ob-done');

    nicknameInput.addEventListener('input', () => {
      this._nickname = nicknameInput.value.trim();
      doneBtn.disabled = !this._nickname;
    });

    container.querySelectorAll('#ob-avatar-grid .setup-avatar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#ob-avatar-grid .setup-avatar-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._avatar = btn.dataset.avatar;
        SoundEngine.playUIHover();
      });
    });

    doneBtn.addEventListener('click', () => {
      if (!this._nickname.trim()) return;
      SoundEngine.playWaxSeal();
      StorageService.saveUserSettings({ nickname: this._nickname.trim(), avatar: this._avatar });
      // 动画过渡
      const view = container.querySelector('.onboarding-view');
      if (view) {
        view.style.transition = 'opacity 0.5s, transform 0.5s';
        view.style.opacity = '0';
        view.style.transform = 'scale(1.05)';
      }
      setTimeout(() => {
        App._startApp();
      }, 400);
    });
  },
};
