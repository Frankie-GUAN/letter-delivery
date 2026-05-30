// 此刻·此地 — 读信界面
const LetterReader = {
  _container: null,
  _letter: null,

  async render(container, params = {}) {
    this._container = container;
    try {
      this._letter = await StorageService.getLetterById(params.letterId);
      if (!this._letter) {
        container.innerHTML = '<div class="reader-empty">😕 找不到这封信了</div>';
        return;
      }
    } catch (e) {
      container.innerHTML = '<div class="reader-empty">😕 找不到这封信了</div>';
      return;
    }

    const letter = this._letter;
    SoundEngine.playOpenLetter();

    // 如果是时光胶囊，标记当前用户已打开
    if (letter.type === 'self_capsule' && letter.capsule && Date.now() >= letter.capsule.unlockAt) {
      try {
        this._letter = await LetterManager.openCapsule(letter.id);
      } catch (e) { /* 已打开过则忽略 */ }
    }

    const repliesHtml = letter.replies.length > 0
      ? letter.replies.map(r => `
          <div class="reply-item">
            <span class="reply-avatar">${r.avatar || '💬'}</span>
            <div class="reply-content">
              <div class="reply-author">${Helpers.escapeHtml(r.nickname)} · ${Helpers.formatRelativeTime(r.time)}</div>
              <div class="reply-body">${Helpers.escapeHtml(r.body)}</div>
            </div>
          </div>
        `).join('')
      : '<div class="reader-no-replies">还没有回响，做第一个吧。</div>';

    const settings = StorageService.getUserSettings();
    const isMine = letter.sender.nickname === settings.nickname;

    const typeBadge = {
      public: '📮 公开信',
      self_capsule: '⏳ 时光胶囊',
      secret: '🔒 密信',
    }[letter.type] || '✉️ 信';

    // 时光胶囊共埋状态
    let capsuleStatusHtml = '';
    if (letter.type === 'self_capsule' && letter.capsule && letter.capsule.coBuryWith.length > 0) {
      const allParticipants = [letter.sender.nickname, ...letter.capsule.coBuryWith];
      const openedSet = new Set(letter.capsule.openedBy || []);
      capsuleStatusHtml = `
        <div class="reader-capsule-status ${letter.capsule.allOpened ? 'all-opened' : ''}">
          <div class="capsule-status-title">
            ${letter.capsule.allOpened ? '🎉 所有人都已打开！' : '⏳ 共埋胶囊 · 部分已打开'}
          </div>
          <div class="capsule-participants">
            ${allParticipants.map(n => `
              <span class="capsule-participant ${openedSet.has(n) ? 'opened' : ''}">
                ${openedSet.has(n) ? '✅' : '⏳'} ${Helpers.escapeHtml(n)}
              </span>
            `).join('')}
          </div>
          ${letter.capsule.allOpened ? '<div class="capsule-all-hint">以下可以看到彼此的留言了</div>' : ''}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="reader-view">
        <div class="reader-top-bar">
          <button class="reader-back-btn" id="btn-reader-back">＜ 返回</button>
          <span class="reader-type-badge">${typeBadge}</span>
          ${isMine ? '<button class="reader-delete-btn" id="btn-delete-letter">🗑️</button>' : ''}
        </div>
        <div class="reader-body">
          <div class="reader-photo-section">
            <img src="${letter.photo.thumbnail || letter.photo.dataURL}" alt="信的照片" class="reader-photo">
            <div class="reader-location">📍 ${Helpers.escapeHtml(letter.location.name || '某个地方')}</div>
          </div>
          ${capsuleStatusHtml}
          <div class="reader-content">
            <h2 class="reader-title">${Helpers.escapeHtml(letter.content.title || '无名信')}</h2>
            <div class="reader-sender">
              <span class="sender-avatar">${letter.sender.avatar || '🌲'}</span>
              <span class="sender-name">${Helpers.escapeHtml(letter.sender.nickname)}</span>
              <span class="sender-time">${Helpers.formatDate(letter.created)}</span>
            </div>
            <div class="reader-body-text">${Helpers.escapeHtml(letter.content.body)}</div>
            ${letter.content.mood ? `<div class="reader-mood">情绪：${letter.content.mood}</div>` : ''}
          </div>
          <div class="reader-replies-section">
            <h3 class="replies-title">💌 回响 (${letter.replies.length})</h3>
            <div class="replies-list">${repliesHtml}</div>
          </div>
          <div class="reader-reply-form">
            <textarea class="reply-input" id="reply-input"
                      maxlength="${CONFIG.LETTER.MAX_REPLY_LENGTH}"
                      placeholder="留下你的回响..."></textarea>
            <button class="reply-btn" id="btn-submit-reply">💬 发送回响</button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents(container);
  },

  _bindEvents(container) {
    container.querySelector('#btn-reader-back').addEventListener('click', () => {
      const prev = App.getPreviousView();
      App.navigateTo(prev || 'map');
    });

    // 删除信件
    const deleteBtn = container.querySelector('#btn-delete-letter');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this._confirmDelete(container);
      });
    }

    container.querySelector('#btn-submit-reply').addEventListener('click', async () => {
      const input = container.querySelector('#reply-input');
      const body = input.value.trim();
      if (!body) return;

      try {
        await LetterManager.addReply(this._letter.id, body);
        input.value = '';
        await this.render(container, { letterId: this._letter.id });
      } catch (e) {
        console.error('回响发送失败:', e);
        alert('发送失败，请重试');
      }
    });
  },

  _confirmDelete(container) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" style="text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">🗑️</div>
        <h3 style="font-size:17px;color:var(--text);margin:0 0 8px;">删除这封信？</h3>
        <p style="font-size:13px;color:var(--text-dim);margin:0 0 20px;">删除后无法恢复，回响也会一并消失</p>
        <div style="display:flex;gap:10px;">
          <button class="passphrase-submit" style="flex:1;background:var(--surface);color:var(--text);" id="btn-cancel-delete">取消</button>
          <button class="passphrase-submit" style="flex:1;background:var(--danger);" id="btn-confirm-delete">删除</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#btn-cancel-delete').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#btn-confirm-delete').addEventListener('click', async () => {
      try {
        await StorageService.deleteLetter(this._letter.id);
        overlay.remove();
        App.navigateTo('map');
      } catch (e) {
        alert('删除失败，请重试');
      }
    });
  },
};
