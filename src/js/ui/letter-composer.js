// 此刻·此地 — 写信界面
const LetterComposer = {
  _container: null,
  _photoData: null,
  _location: null,
  _currentType: 'public',
  _currentMood: '温柔',

  render(container, params = {}) {
    this._container = container;
    this._photoData = params.photoData || null;
    this._location = params.location || null;

    const previewSrc = this._photoData ? this._photoData.thumbnail : '';
    const pos = this._location || LocationService.getCurrent() || {};
    const locationText = pos.lat
      ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`
      : '等待定位...';

    container.innerHTML = `
      <div class="composer-view">
        <div class="composer-top-bar">
          <button class="composer-back-btn" id="btn-composer-back">＜ 返回</button>
          <span class="composer-title">写一封信</span>
        </div>
        <div class="composer-body">
          <div class="composer-photo-preview">
            ${previewSrc
              ? `<img src="${previewSrc}" alt="拍摄照片" class="composer-thumb">`
              : '<div class="composer-no-photo">📷 请先拍照</div>'}
            <div class="composer-location">📍 ${locationText}</div>
          </div>

          <div class="composer-form">
            <label class="composer-label">信的类型</label>
            <div class="composer-type-tabs" id="composer-type-tabs">
              <button class="type-tab active" data-type="public">📮 公开信</button>
              <button class="type-tab" data-type="self_capsule">⏳ 时光胶囊</button>
              <button class="type-tab" data-type="secret">🔒 密信</button>
            </div>

            <label class="composer-label">标题</label>
            <input type="text" class="composer-input" id="composer-title"
                   maxlength="${CONFIG.LETTER.MAX_TITLE_LENGTH}"
                   placeholder="给这封信取个名字...">

            <label class="composer-label">内容</label>
            <textarea class="composer-textarea" id="composer-body"
                      maxlength="${CONFIG.LETTER.MAX_BODY_LENGTH}"
                      placeholder="写下你想说的话..."></textarea>
            <div class="composer-char-count" id="composer-char-count">0/${CONFIG.LETTER.MAX_BODY_LENGTH}</div>

            <label class="composer-label">情绪基调</label>
            <div class="composer-mood-picker" id="composer-mood-picker">
              ${LEditorTemplates.moods.map(m =>
                `<button class="mood-btn" data-mood="${m}">${m}</button>`
              ).join('')}
            </div>
            <button class="composer-ai-btn" id="btn-ai-polish">✨ AI润色</button>

            <!-- 时光胶囊专属 -->
            <div id="capsule-options" style="display:none;">
              <label class="composer-label">解锁时间</label>
              <input type="datetime-local" class="composer-input" id="capsule-unlock-time">
              <label class="composer-label">共埋者（用逗号分隔多个昵称）</label>
              <input type="text" class="composer-input" id="capsule-co-bury" placeholder="输入好友昵称...">
              <label class="composer-check-label">
                <input type="checkbox" id="capsule-alignment" checked>
                开启对齐解锁（必须回到原地才能打开）
              </label>
            </div>

            <!-- 密信专属 -->
            <div id="secret-options" style="display:none;">
              <label class="composer-label">接收人昵称（用逗号分隔多个）</label>
              <input type="text" class="composer-input" id="secret-recipients" placeholder="输入接收人昵称...">
            </div>

            <!-- 公开信选项 -->
            <div id="public-options">
              <label class="composer-check-label">
                <input type="checkbox" id="public-alignment" checked>
                开启对齐解锁（收信人需对准拍摄角度）
              </label>
            </div>

            <label class="composer-label">地点名称（可选）</label>
            <input type="text" class="composer-input" id="composer-location-name"
                   placeholder="给这个地方取个名字，如'咖啡馆转角'">
          </div>
        </div>
        <div class="composer-bottom-bar">
          <button class="composer-btn primary" id="btn-send-letter">📨 投递信件</button>
        </div>
      </div>
    `;

    this._bindEvents(container);
    const firstMood = container.querySelector('.mood-btn');
    if (firstMood) firstMood.classList.add('active');
  },

  _bindEvents(container) {
    container.querySelector('#btn-composer-back').addEventListener('click', () => {
      App.navigateTo('camera');
    });

    container.querySelectorAll('.type-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._currentType = tab.dataset.type;
        this._toggleTypeOptions();
        SoundEngine.playUIHover();
      });
    });

    const bodyEl = container.querySelector('#composer-body');
    bodyEl.addEventListener('input', () => {
      const countEl = container.querySelector('#composer-char-count');
      countEl.textContent = `${bodyEl.value.length}/${CONFIG.LETTER.MAX_BODY_LENGTH}`;
    });

    container.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._currentMood = btn.dataset.mood;
      });
    });

    container.querySelector('#btn-ai-polish').addEventListener('click', () => {
      this._applyAIPolish();
    });

    container.querySelector('#btn-send-letter').addEventListener('click', () => {
      this._sendLetter();
    });
  },

  _toggleTypeOptions() {
    document.getElementById('capsule-options').style.display = this._currentType === 'self_capsule' ? 'block' : 'none';
    document.getElementById('secret-options').style.display = this._currentType === 'secret' ? 'block' : 'none';
    document.getElementById('public-options').style.display = this._currentType === 'public' ? 'block' : 'none';

    if (this._currentType === 'self_capsule') {
      const dtInput = document.getElementById('capsule-unlock-time');
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      dtInput.min = now.toISOString().slice(0, 16);
      if (!dtInput.value) dtInput.value = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    }
  },

  async _applyAIPolish() {
    const bodyEl = document.getElementById('composer-body');
    const inputText = bodyEl.value.trim();
    if (!inputText) {
      alert('先写点什么吧，我来帮你润色~');
      return;
    }

    const btn = document.getElementById('btn-ai-polish');
    btn.textContent = '✨ 润色中...';
    btn.disabled = true;

    try {
      const polished = await AIPolishService.polishWithFallback(inputText, this._currentMood);
      bodyEl.value = polished;
      const countEl = document.getElementById('composer-char-count');
      countEl.textContent = `${polished.length}/${CONFIG.LETTER.MAX_BODY_LENGTH}`;
    } catch (e) {
      console.warn('润色失败:', e);
      alert('润色失败，请重试');
    } finally {
      btn.textContent = '✨ AI润色';
      btn.disabled = false;
    }
  },

  async _sendLetter() {
    try {
      const title = document.getElementById('composer-title').value.trim();
      const body = document.getElementById('composer-body').value.trim();
      const locationName = document.getElementById('composer-location-name').value.trim();

      if (!title && !body) {
        alert('标题和内容至少填一个吧~');
        return;
      }

      if (!this._photoData) {
        alert('请先拍照');
        return;
      }

      const features = FeatureEngine.extractFeatures(
        await this._loadImage(this._photoData.dataURL)
      );

      const photoWithFeatures = {
        ...this._photoData,
        features,
      };

      const location = {
        lat: this._location.lat,
        lng: this._location.lng,
        name: locationName,
      };

      const content = {
        title,
        body,
        mood: this._currentMood,
      };

      let letter;
      let recipients = [];
      switch (this._currentType) {
        case 'public': {
          const hasAlignment = document.getElementById('public-alignment').checked;
          photoWithFeatures.hasAlignment = hasAlignment;
          letter = await LetterManager.createPublicLetter(location, photoWithFeatures, content);
          break;
        }
        case 'self_capsule': {
          const unlockTimeStr = document.getElementById('capsule-unlock-time').value;
          const coBuryRaw = document.getElementById('capsule-co-bury').value.trim();
          const hasAlignment = document.getElementById('capsule-alignment').checked;
          const unlockAt = unlockTimeStr ? new Date(unlockTimeStr).getTime() : (Date.now() + 86400000);
          const coBuryWith = coBuryRaw ? coBuryRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
          photoWithFeatures.hasAlignment = hasAlignment;
          letter = await LetterManager.createCapsule(location, photoWithFeatures, content, {
            unlockAt,
            coBuryWith,
          });
          break;
        }
        case 'secret': {
          const recipientsRaw = document.getElementById('secret-recipients').value.trim();
          recipients = recipientsRaw ? recipientsRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
          photoWithFeatures.hasAlignment = false;
          letter = await LetterManager.createSecret(location, photoWithFeatures, content, recipients);
          break;
        }
      }

      if (letter.type === 'secret') {
        this._sharePassphrase(letter.secret.passphrase, letter.content.title, recipients);
      }

      SoundEngine.playSendLetter();
      App.navigateTo('map');
    } catch (e) {
      console.error('发信失败:', e);
      Helpers.showError('投递失败，请重试');
    }
  },

  _loadImage(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataURL;
    });
  },

  async _sharePassphrase(passphrase, title, recipients) {
    const recipientsStr = (recipients && recipients.length > 0)
      ? `收信人：${recipients.join('、')}`
      : '给你';

    const text = `🔒 我在「此刻·此地」${recipientsStr}留了一封密信\n📮 「${title}」\n🔑 口令：${passphrase}\n\n打开作品，输入口令即可找到这封信`;

    // 尝试 Web Share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: '此刻·此地 — 一封密信',
          text,
        });
        return;
      } catch (e) {
        // 用户取消分享，继续展示口令
      }
    }

    // 降级：复制到剪贴板
    try {
      await navigator.clipboard.writeText(text);
      alert(`密信创建成功！口令「${passphrase}」已复制到剪贴板，分享给收信人吧~`);
    } catch (e) {
      // 最终降级
      alert(`密信创建成功！\n口令：${passphrase}\n\n请将口令分享给收信人。`);
    }
  },
};
