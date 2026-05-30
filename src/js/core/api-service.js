// 此刻·此地 — API客户端（完整版：连接后端同步服务）
const ApiService = {
  _baseURL: CONFIG.SYNC.SERVER_URL,
  _online: false,

  setServer(url) {
    this._baseURL = url;
  },

  async checkConnection() {
    try {
      const res = await fetch(`${this._baseURL}/api/letters/nearby?lat=0&lng=0&radius=1`);
      this._online = res.ok;
      return this._online;
    } catch (e) {
      this._online = false;
      return false;
    }
  },

  isOnline() {
    return this._online;
  },

  // 获取附近信件
  async getNearbyLetters(lat, lng, radius = 50) {
    const url = `${this._baseURL}/api/letters/nearby?lat=${lat}&lng=${lng}&radius=${radius}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('获取附近信件失败');
    return res.json();
  },

  // 获取单封信
  async getLetter(id) {
    const res = await fetch(`${this._baseURL}/api/letters/${id}`);
    if (!res.ok) throw new Error('获取信件失败');
    return res.json();
  },

  // 保存信件到服务器
  async saveLetter(letter) {
    const res = await fetch(`${this._baseURL}/api/letters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ letter }),
    });
    if (!res.ok) throw new Error('保存信件失败');
    return res.json();
  },

  // 添加回响
  async addReply(letterId, reply) {
    const res = await fetch(`${this._baseURL}/api/letters/${letterId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply }),
    });
    if (!res.ok) throw new Error('添加回响失败');
    return res.json();
  },

  // 双向同步
  async sync(localLetters, lastSync) {
    const res = await fetch(`${this._baseURL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localLetters, lastSync }),
    });
    if (!res.ok) throw new Error('同步失败');
    return res.json();
  },

  // 密信口令解析
  async resolvePassphrase(passphrase) {
    const res = await fetch(`${this._baseURL}/api/secret/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    });
    if (!res.ok) return { found: false };
    return res.json();
  },

  // 注册通知
  async registerNotification(nickname) {
    try {
      await fetch(`${this._baseURL}/api/notifications/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });
    } catch (e) {
      console.warn('通知注册失败:', e);
    }
  },

  // 检查通知
  async checkNotifications(nickname, lat, lng) {
    const url = `${this._baseURL}/api/notifications/check?nickname=${encodeURIComponent(nickname)}&lat=${lat}&lng=${lng}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('通知检查失败');
    return res.json();
  },
};
