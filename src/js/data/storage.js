// 此刻·此地 — 数据持久化服务
const StorageService = {
  _db: null,

  // 初始化数据库
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.STORAGE.DB_NAME, CONFIG.STORAGE.DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(CONFIG.STORAGE.LETTERS_STORE)) {
          const store = db.createObjectStore(CONFIG.STORAGE.LETTERS_STORE, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('location', ['location.lat', 'location.lng'], { unique: false });
          store.createIndex('created', 'created', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this._db = e.target.result;
        this._migrateUserSettings();
        resolve();
      };

      request.onerror = () => reject(new Error('无法打开数据库'));
    });
  },

  // 迁移旧版用户设置
  _migrateUserSettings() {
    if (!localStorage.getItem('cikecidi_nickname')) {
      localStorage.setItem('cikecidi_nickname', '');
    }
    if (!localStorage.getItem('cikecidi_avatar')) {
      localStorage.setItem('cikecidi_avatar', '🌲');
    }
  },

  // ---- 信件CRUD ----

  getAllLetters() {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(CONFIG.STORAGE.LETTERS_STORE, 'readonly');
      const store = tx.objectStore(CONFIG.STORAGE.LETTERS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('读取信件失败'));
    });
  },

  getLetterById(id) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(CONFIG.STORAGE.LETTERS_STORE, 'readonly');
      const store = tx.objectStore(CONFIG.STORAGE.LETTERS_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('读取信件失败'));
    });
  },

  saveLetter(letter) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(CONFIG.STORAGE.LETTERS_STORE, 'readwrite');
      const store = tx.objectStore(CONFIG.STORAGE.LETTERS_STORE);
      const request = store.put(letter);
      request.onsuccess = () => resolve(letter);
      request.onerror = () => reject(new Error('保存信件失败'));
    });
  },

  deleteLetter(id) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(CONFIG.STORAGE.LETTERS_STORE, 'readwrite');
      const store = tx.objectStore(CONFIG.STORAGE.LETTERS_STORE);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('删除信件失败'));
    });
  },

  async addReply(letterId, reply) {
    const letter = await this.getLetterById(letterId);
    if (!letter) throw new Error('信件不存在');
    letter.replies.push(reply);
    return this.saveLetter(letter);
  },

  // 按位置查询附近信件
  async getNearbyLetters(lat, lng, maxDistance = CONFIG.LOCATION.FAR_RANGE) {
    const all = await this.getAllLetters();
    return all.filter(letter => {
      const d = Helpers.distanceBetween(lat, lng, letter.location.lat, letter.location.lng);
      return d <= maxDistance;
    }).sort((a, b) => {
      const dA = Helpers.distanceBetween(lat, lng, a.location.lat, a.location.lng);
      const dB = Helpers.distanceBetween(lat, lng, b.location.lat, b.location.lng);
      return dA - dB;
    });
  },

  // 按口令查找密信
  async getLetterByPassphrase(passphrase) {
    const all = await this.getAllLetters();
    return all.find(l => l.secret && l.secret.passphrase === passphrase) || null;
  },

  // ---- 用户设置 ----

  getUserSettings() {
    return {
      nickname: localStorage.getItem('cikecidi_nickname') || '',
      avatar: localStorage.getItem('cikecidi_avatar') || '🌲',
    };
  },

  saveUserSettings(settings) {
    if (settings.nickname !== undefined) {
      localStorage.setItem('cikecidi_nickname', settings.nickname);
    }
    if (settings.avatar !== undefined) {
      localStorage.setItem('cikecidi_avatar', settings.avatar);
    }
  },

  // ---- 同步追踪 ----

  async getUnsyncedLetters() {
    const all = await this.getAllLetters();
    return all.filter(l => !l._synced);
  },

  async markSynced(ids) {
    const tx = this._db.transaction(CONFIG.STORAGE.LETTERS_STORE, 'readwrite');
    const store = tx.objectStore(CONFIG.STORAGE.LETTERS_STORE);
    for (const id of ids) {
      const letter = await new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (letter) {
        letter._synced = true;
        store.put(letter);
      }
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('标记同步失败'));
    });
  },
};
