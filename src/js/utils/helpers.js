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
    const hasSecret = myLetters.some(l => l.type === 'secret');
    const hasCapsule = myLetters.some(l => l.type === 'self_capsule');
    const openedCapsule = myLetters.some(l => l.type === 'self_capsule' && l.capsule && l.capsule.openedBy.length > 0);

    return [
      { id: 'first_letter', name: '初信', icon: '✉️', earned: myLetters.length > 0 },
      { id: 'treasure_hunter', name: '寻宝者', icon: '🗺️', earned: discovered.length > 0 },
      { id: 'echo_maker', name: '回响者', icon: '💌', earned: gotReplies.length > 0 },
      { id: 'traveler', name: '旅人', icon: '🌍', earned: locations.size >= 3 },
      { id: 'secret_keeper', name: '秘密守护者', icon: '🔒', earned: hasSecret },
      { id: 'time_capsuler', name: '时空旅人', icon: '⏳', earned: hasCapsule },
      { id: 'prolific', name: '笔墨丰盈', icon: '📝', earned: myLetters.length >= 5 },
      { id: 'capsule_opener', name: '解锁者', icon: '🔓', earned: openedCapsule },
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
};
