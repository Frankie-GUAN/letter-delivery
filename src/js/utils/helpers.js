// 此刻·此地 — 工具函数
const Helpers = {
  // 生成UUID v4
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  // 生成分享口令
  generatePassphrase(length = CONFIG.PASSPHRASE.LENGTH) {
    const chars = CONFIG.PASSPHRASE.CHARS;
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  },

  // Haversine距离计算（返回米）
  distanceBetween(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
      * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  // 格式化相对时间
  formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return '刚刚';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天前`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}个月前`;
    return `${Math.floor(months / 12)}年前`;
  },

  // 格式化日期
  formatDate(timestamp) {
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  },

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // 节流
  throttle(fn, delay) {
    let last = 0;
    return function throttled(...args) {
      const now = Date.now();
      if (now - last >= delay) {
        last = now;
        fn.apply(this, args);
      }
    };
  },

  // Canvas图像缩放到目标尺寸
  scaleImageToCanvas(source, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, width, height);
    return canvas;
  },

  // 显示错误界面
  showError(msg = CONFIG.ERROR_TEXT) {
    const el = document.getElementById('error-screen');
    if (el) {
      el.style.display = 'flex';
      const p = el.querySelector('p');
      if (p) p.textContent = msg;
    }
  },

  hideError() {
    const el = document.getElementById('error-screen');
    if (el) el.style.display = 'none';
  },

  // 计算用户成就
  getAchievements(allLetters, nickname) {
    if (!nickname) return [];
    const myLetters = allLetters.filter(l => l.sender.nickname === nickname);
    const discovered = allLetters.filter(l => l.sender.nickname !== nickname);
    const myReplies = [];
    myLetters.forEach(l => (l.replies || []).forEach(r => myReplies.push(r)));
    const gotReplies = myLetters.filter(l => (l.replies || []).some(r => r.nickname !== nickname));
    const locations = new Set(myLetters.map(l => `${l.location.lat.toFixed(3)},${l.location.lng.toFixed(3)}`));
    const publicLetters = myLetters.filter(l => l.type === 'public');
    const secretLetters = myLetters.filter(l => l.type === 'secret');
    const hasSecret = secretLetters.length > 0;
    const hasCapsule = myLetters.some(l => l.type === 'self_capsule');
    const openedCapsule = myLetters.some(l => l.type === 'self_capsule' && l.capsule && l.capsule.openedBy.length > 0);
    const replyCount = myLetters.reduce((sum, l) => sum + (l.replies || []).length, 0);

    return [
      { id: 'first_letter', name: '初信', icon: '✉️', earned: myLetters.length > 0 },
      { id: 'treasure_hunter', name: '寻宝者', icon: '🗺️', earned: discovered.length > 0 },
      { id: 'echo_maker', name: '回响者', icon: '💌', earned: gotReplies.length > 0 },
      { id: 'traveler', name: '旅人', icon: '🌍', earned: locations.size >= 3 },
      { id: 'secret_keeper', name: '秘密守护者', icon: '🔒', earned: hasSecret },
      { id: 'time_capsuler', name: '时空旅人', icon: '⏳', earned: hasCapsule },
      { id: 'prolific', name: '笔墨丰盈', icon: '📝', earned: myLetters.length >= 5 },
      { id: 'capsule_opener', name: '解锁者', icon: '🔓', earned: openedCapsule },
      { id: 'public_scribe', name: '公开信使', icon: '📮', earned: publicLetters.length >= 10 },
      { id: 'explorer', name: '探索者', icon: '🧭', earned: locations.size >= 5 },
      { id: 'conversation_starter', name: '谈笑风生', icon: '💬', earned: replyCount >= 5 },
      { id: 'discoverer', name: '发现者', icon: '🔍', earned: discovered.length >= 10 },
      { id: 'master_of_secrets', name: '密信大师', icon: '🗝️', earned: secretLetters.length >= 3 },
    ];
  },

  // 生成30天活跃热力图数据
  getActivityHeatmap(allLetters, nickname) {
    const days = [];
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date(now - i * 86400000).setHours(0, 0, 0, 0);
      const dayEnd = dayStart + 86400000;
      const count = allLetters.filter(l => {
        if (l.sender.nickname !== nickname) return false;
        return l.created >= dayStart && l.created < dayEnd;
      }).length;
      days.push({
        date: dayStart,
        level: count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4,
      });
    }
    return days;
  },

  // 随机取数组元素
  randomFromArray(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  // 共享密信口令弹窗（map-view 和 camera-view 共用）
  showPassphraseModal(letter, { onSuccess }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card passphrase-modal">
        <div class="modal-close" id="modal-close">✕</div>
        <div class="passphrase-icon">🔒</div>
        <h3 class="passphrase-title">这是一封密信</h3>
        <p class="passphrase-hint">由 ${Helpers.escapeHtml(letter.sender.nickname)} 留给 ${(letter.secret.recipients || ['某人']).join('、')}</p>
        <div class="passphrase-input-wrap">
          <input type="text" class="passphrase-input" id="passphrase-input"
                 maxlength="20" placeholder="输入8位口令..." autocomplete="off">
          <div class="passphrase-error" id="passphrase-error" style="display:none;"></div>
        </div>
        <button class="passphrase-submit" id="btn-passphrase-submit">🔍 寻找这封信</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = overlay.querySelector('#modal-close');
    const input = overlay.querySelector('#passphrase-input');
    const submit = overlay.querySelector('#btn-passphrase-submit');
    const errorEl = overlay.querySelector('#passphrase-error');

    const closeModal = () => overlay.remove();
    close.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    submit.addEventListener('click', () => {
      const phrase = input.value.trim();
      if (!phrase) return;
      if (phrase !== letter.secret.passphrase) {
        errorEl.textContent = '口令不正确，再试一次';
        errorEl.style.display = 'block';
        input.classList.add('error');
        return;
      }
      if (onSuccess) {
        onSuccess(letter, overlay);
      } else {
        overlay.remove();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit.click();
    });
    setTimeout(() => input.focus(), 100);
  },
};
