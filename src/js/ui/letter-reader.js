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

    const typeBadge = {
      public: '📮 公开信',
      self_capsule: '⏳ 时光胶囊',
      secret: '🔒 密信',
    }[letter.type] || '✉️ 信';

    container.innerHTML = `
      <div class="reader-view">
        <div class="reader-top-bar">
          <button class="reader-back-btn" id="btn-reader-back">＜ 返回</button>
          <span class="reader-type-badge">${typeBadge}</span>
        </div>
        <div class="reader-body">
          <div class="reader-photo-section">
            <img src="${letter.photo.thumbnail || letter.photo.dataURL}" alt="信的照片" class="reader-photo">
            <div class="reader-location">📍 ${Helpers.escapeHtml(letter.location.name || '某个地方')}</div>
          </div>
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
      App.navigateTo('map');
    });

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
};
