# 此刻·此地 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete "此刻·此地" interactive work — a location-based letter experience with camera viewfinder, AI scene matching, and three letter types (public, self-capsule, secret).

**Architecture:** Clean layered structure — UI views (map/camera/composer/reader) consume core services (letter-manager, feature-engine, location-service), which depend on data layer (storage, templates). All bound together by app.js router. No frameworks, vanilla JS + Canvas.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Canvas API, Geolocation API, MediaDevices API, IndexedDB, LocalStorage

---

### Task 1: Clean old project and create new directory skeleton

**Files:**
- Remove: `src/js/shared/`, `src/js/modules/`, `src/js/data/preset-letters.js`
- Create: `src/js/config.js`, directory structure for `core/`, `ui/`, `data/`, `utils/`

- [ ] **Step 1: Remove old source files**

Run:
```bash
rm -rf "E:\桌面\letter\letter-delivery\src\js\shared" \
       "E:\桌面\letter\letter-delivery\src\js\modules" \
       "E:\桌面\letter\letter-delivery\src\js\data\preset-letters.js"
```

- [ ] **Step 2: Create new directory structure**

Run:
```bash
mkdir -p "E:\桌面\letter\letter-delivery\src\js\core" \
         "E:\桌面\letter\letter-delivery\src\js\ui" \
         "E:\桌面\letter\letter-delivery\src\js\data" \
         "E:\桌面\letter\letter-delivery\src\js\utils"
```

- [ ] **Step 3: Create config.js with all constants**

Write: `src/js/config.js`

```javascript
// 此刻·此地 — 配置常量
const CONFIG = {
  // 定位
  LOCATION: {
    UPDATE_INTERVAL: 5000,        // GPS刷新间隔（ms）
    STALE_THRESHOLD: 30000,       // 位置过期阈值（ms）
    DEFAULT_RADIUS: 20,           // 信件默认可见半径（米）
    NEARBY_RANGE: 10,             // "可打开相机"距离（米）
    FAR_RANGE: 20,                // "可见信封"最大距离（米）
  },

  // 相机
  CAMERA: {
    FACING_MODE: 'environment',   // 后置摄像头
    SAMPLE_INTERVAL: 1000,       // 取景帧采样间隔（ms）
    PHOTO_MAX_WIDTH: 800,        // 拍照最大宽度
    PHOTO_QUALITY: 0.85,         // JPEG压缩质量
  },

  // 特征引擎
  FEATURE: {
    IMAGE_SIZE: 256,              // 特征提取缩放尺寸
    GRID_COLS: 4,                 // 网格列数
    GRID_ROWS: 4,                 // 网格行数
    SOBEL_BINS: 8,                // 边缘方向直方图bin数
    VECTOR_DIMS: 256,             // 特征向量维度 (4*4*16)
    ALIGNMENT_THRESHOLD: 0.90,    // 对齐成功阈值
  },

  // 信件
  LETTER: {
    MAX_TITLE_LENGTH: 50,
    MAX_BODY_LENGTH: 2000,
    MAX_REPLY_LENGTH: 500,
    TYPES: ['public', 'self_capsule', 'secret'],
  },

  // 存储
  STORAGE: {
    DB_NAME: 'cikecidi',
    DB_VERSION: 1,
    LETTERS_STORE: 'letters',
  },

  // 口令
  PASSPHRASE: {
    LENGTH: 8,                    // 口令字符数
    CHARS: 'abcdefghijkmnpqrstuvwxyz23456789',
  },

  // 错误文案
  ERROR_TEXT: '哎呀，出错了，请重启试试吧~',
};

// 冻结防止意外修改
Object.freeze(CONFIG);
Object.freeze(CONFIG.LOCATION);
Object.freeze(CONFIG.CAMERA);
Object.freeze(CONFIG.FEATURE);
Object.freeze(CONFIG.LETTER);
Object.freeze(CONFIG.STORAGE);
Object.freeze(CONFIG.PASSPHRASE);
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: 清理旧项目代码，搭建新项目骨架

移除旧的三个模块（公共墙/私人抽屉/时光信），为「此刻·此地」新项目做准备。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Utility helpers

**Files:**
- Create: `src/js/utils/helpers.js`

- [ ] **Step 1: Write helpers.js**

```javascript
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
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/utils/helpers.js
git commit -m "$(cat <<'EOF'
feat: 添加工具函数模块

包含UUID生成、口令生成、Haversine距离计算、时间格式化等基础工具函数。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Storage service (IndexedDB + LocalStorage)

**Files:**
- Create: `src/js/data/storage.js`

- [ ] **Step 1: Write storage.js**

```javascript
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

  addReply(letterId, reply) {
    return new Promise(async (resolve, reject) => {
      try {
        const letter = await this.getLetterById(letterId);
        if (!letter) return reject(new Error('信件不存在'));
        letter.replies.push(reply);
        await this.saveLetter(letter);
        resolve(letter);
      } catch (e) {
        reject(e);
      }
    });
  },

  // 按位置查询附近信件（简单遍历，后续可优化）
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
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/data/storage.js
git commit -m "$(cat <<'EOF'
feat: 实现数据持久化服务

基于IndexedDB的信件CRUD + LocalStorage用户设置。
支持位置查询、口令查找、回响添加。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: AI润色降级模板库

**Files:**
- Create: `src/js/data/templates.js`

- [ ] **Step 1: Write templates.js**

```javascript
// 此刻·此地 — AI润色降级模板库（Demo版离线使用）
const LEditorTemplates = {
  moods: ['温柔', '俏皮', '深情', '怀念', '期待', '感谢'],

  // 模板结构：{ opening, body, closing }
  templates: {
    '温柔': {
      openings: [
        '轻轻放下这些字，像放下了一片叶子。',
        '风很轻，话也很轻。',
        '在这个角落，想说些柔软的话。',
      ],
      bodies: [
        '每次经过这里，都想起{feeling}。那些细小的瞬间，像光斑一样落在记忆里，暖的。',
        '今天的{weather}让人安静下来。我在想，有些话不用大声说，只要写了，就算寄到了。',
      ],
      closings: [
        '愿你被温柔接住。',
        '像阳光一样，轻轻落在你肩上。',
        '这里有我留下的一片温柔，路过的人，也请轻拿轻放。',
      ],
    },
    '俏皮': {
      openings: [
        '嘿嘿，被我藏在这里了吧！',
        '叮！你发现了一个彩蛋。',
        '警告：前方有可爱出没。',
      ],
      bodies: [
        '我在{place}蹲了好久才决定把信放在这里的！如果你能看到，说明我们有缘——快去买张彩票！',
        '别问我为什么在这里留信，问就是{reason}。对了，你也在这里留一封的话，我们就扯平了。',
      ],
      closings: [
        '找到的人，今天会有好运（认真的）。',
        '记得笑一个，你的笑容值一个亿。',
        '友情提示：此处适合自拍一张。',
      ],
    },
    '深情': {
      openings: [
        '这里是我想你的坐标。',
        '有些话，只适合留在这里。',
        '我把思念埋在这个位置了。',
      ],
      bodies: [
        '他们说{place}的{time_of_day}最美，我来的时候只想一件事：如果你也在就好了。',
        '时间走得好快，但在这里，此刻，我想停一下，认认真真地想一遍你。',
      ],
      closings: [
        '如果你看到了，那就是我想你的信号，穿越了距离。',
        '这封信没有寄出的日期，因为思念没有有效期。',
      ],
    },
    '怀念': {
      openings: [
        '故地重游，物是人非。',
        '有些地方，来了就不想走了。',
        '时光在这里打了个结。',
      ],
      bodies: [
        '记得上次来这里是{time_ago}。那时候{memory}，现在只剩下风还在吹。',
        '{place}还和以前一样，不一样的只是站在这里的人，和那些回不去的事了。',
      ],
      closings: [
        '给过去的自己，也给来过这里的你。',
        '时光会走远，但有些东西不会。',
        '下一个来这里的人，如果你也有想念的事，在这里留一行字吧。',
      ],
    },
    '期待': {
      openings: [
        '给未来的自己，你还好吗？',
        '这是我从{place}发出的信号，给以后的我。',
        '你好，未来。',
      ],
      bodies: [
        '现在的我正站在{place}，想着{goal}。不知道打开这封信的时候，这一切实现了吗？如果实现了，恭喜你；如果还没有，没关系，我还在努力。',
        '给{time_later}后的自己：我希望你变成了一个{adjective}的人。不管你变成了什么样，我都为你骄傲。',
      ],
      closings: [
        '未来见。',
        '当你打开的时候，记得微笑——那是过去的你送给现在的你的礼物。',
        '别怕，往前走。',
      ],
    },
    '感谢': {
      openings: [
        '在此地，说一声谢谢。',
        '这个地方让我想起你。',
        '有些感谢，要写下来才算数。',
      ],
      bodies: [
        '谢谢你{reason}。很多事情当时觉得理所当然，后来才知道，都是因为有人在默默付出。',
        '来{place}的时候，突然想起了你。不是刻意的，就是风吹过来的时候，觉得应该跟你说声谢谢。',
      ],
      closings: [
        '谢谢是你，路过我的生命。',
        '感谢的话不用太长，但一定要真诚。以上，句句真心。',
      ],
    },
  },

  // 生成润色文本
  generate(inputText, mood = '温柔') {
    const t = this.templates[mood] || this.templates['温柔'];
    const opening = t.openings[Math.floor(Math.random() * t.openings.length)];
    const body = t.bodies[Math.floor(Math.random() * t.bodies.length)];
    const closing = t.closings[Math.floor(Math.random() * t.closings.length)];

    // 替换变量
    const vars = {
      feeling: inputText || '那一刻的感觉',
      weather: ['晴天', '雨天', '阴天', '起风了'][Math.floor(Math.random() * 4)],
      place: '这里',
      reason: '缘分',
      time_of_day: ['黄昏', '清晨', '午后', '傍晚'][Math.floor(Math.random() * 4)],
      time_ago: '很久以前',
      memory: '那些日子',
      goal: '那些梦想',
      time_later: '一年',
      adjective: '更好',
    };

    let result = `${opening}\n\n${body}\n\n${closing}`;
    Object.keys(vars).forEach(key => {
      result = result.replace(`{${key}}`, vars[key]);
    });

    return result;
  },

  // 仅用输入文本直接做简单包装（不替换变量）
  wrap(inputText, mood = '温柔') {
    const t = this.templates[mood] || this.templates['温柔'];
    const opening = t.openings[Math.floor(Math.random() * t.openings.length)];
    const closing = t.closings[Math.floor(Math.random() * t.closings.length)];
    return `${opening}\n\n${inputText}\n\n${closing}`;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/data/templates.js
git commit -m "$(cat <<'EOF'
feat: 添加AI润色降级模板库

6种情绪 × 每种3组开篇/正文/结尾模板，Demo版离线使用。
包含generate()生成和wrap()包装两种模式。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Location service

**Files:**
- Create: `src/js/core/location-service.js`

- [ ] **Step 1: Write location-service.js**

```javascript
// 此刻·此地 — 定位服务
const LocationService = {
  _watchId: null,
  _current: null,       // { lat, lng, accuracy, timestamp }
  _listeners: [],

  // 开始监听位置
  start() {
    if (!navigator.geolocation) {
      console.warn('Geolocation API 不可用');
      return;
    }

    this._watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this._current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        this._notifyListeners();
      },
      (err) => {
        console.warn('定位失败:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: CONFIG.LOCATION.UPDATE_INTERVAL,
      }
    );
  },

  // 停止监听
  stop() {
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
  },

  // 获取上次已知位置
  getCurrent() {
    return this._current;
  },

  // 位置是否有效（未过期）
  isValid() {
    if (!this._current) return false;
    return (Date.now() - this._current.timestamp) < CONFIG.LOCATION.STALE_THRESHOLD;
  },

  // 监听位置更新
  onChange(fn) {
    this._listeners.push(fn);
  },

  _notifyListeners() {
    this._listeners.forEach(fn => {
      try { fn(this._current); } catch (e) { console.warn('位置监听器异常:', e); }
    });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/core/location-service.js
git commit -m "$(cat <<'EOF'
feat: 实现定位服务

封装Geolocation API的watchPosition，支持位置监听、有效性检查和过期判断。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: AI feature engine (scene matching)

**Files:**
- Create: `src/js/core/feature-engine.js`

- [ ] **Step 1: Write feature-engine.js**

```javascript
// 此刻·此地 — AI场景特征提取与比对引擎
const FeatureEngine = {
  // 从Image/Video/Canvas提取特征向量
  extractFeatures(source) {
    const SIZE = CONFIG.FEATURE.IMAGE_SIZE;
    const canvas = Helpers.scaleImageToCanvas(source, SIZE, SIZE);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    const pixels = imageData.data;

    const gridCols = CONFIG.FEATURE.GRID_COLS;
    const gridRows = CONFIG.FEATURE.GRID_ROWS;
    const cellW = Math.floor(SIZE / gridCols);
    const cellH = Math.floor(SIZE / gridRows);

    const features = [];

    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        const cellFeatures = this._extractCellFeatures(pixels, SIZE, gx * cellW, gy * cellH, cellW, cellH);
        features.push(...cellFeatures);
      }
    }

    return features;
  },

  // 提取单个网格单元的特征
  _extractCellFeatures(pixels, imageW, startX, startY, w, h) {
    // 累积量
    let sumH = 0, sumS = 0, sumV = 0, count = 0;
    const edgeBins = new Array(CONFIG.FEATURE.SOBEL_BINS).fill(0);
    let sumLaplacian = 0;

    for (let y = startY; y < startY + h && y < imageW; y++) {
      for (let x = startX; x < startX + w && x < imageW; x++) {
        const idx = (y * imageW + x) * 4;
        const r = pixels[idx] / 255;
        const g = pixels[idx + 1] / 255;
        const b = pixels[idx + 2] / 255;

        // RGB → HSV
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let h = 0;
        if (delta > 0.001) {
          if (max === r) h = ((g - b) / delta) % 6;
          else if (max === g) h = (b - r) / delta + 2;
          else h = (r - g) / delta + 4;
          h = h / 6;
          if (h < 0) h += 1;
        }

        const s = max > 0.001 ? delta / max : 0;
        const v = max;

        sumH += h;
        sumS += s;
        sumV += v;
        count++;

        // Sobel边缘（仅对非边缘像素计算）
        if (x > startX && x < startX + w - 1 && y > startY && y < startY + h - 1) {
          const tl = this._luminance(pixels, (y - 1) * imageW + (x - 1));
          const tc = this._luminance(pixels, (y - 1) * imageW + x);
          const tr = this._luminance(pixels, (y - 1) * imageW + (x + 1));
          const ml = this._luminance(pixels, y * imageW + (x - 1));
          const mr = this._luminance(pixels, y * imageW + (x + 1));
          const bl = this._luminance(pixels, (y + 1) * imageW + (x - 1));
          const bc = this._luminance(pixels, (y + 1) * imageW + x);
          const br = this._luminance(pixels, (y + 1) * imageW + (x + 1));

          const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
          const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
          const magnitude = Math.sqrt(gx * gx + gy * gy);
          const angle = Math.atan2(gy, gx);

          if (magnitude > 0.1) {
            const bin = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * CONFIG.FEATURE.SOBEL_BINS);
            edgeBins[Math.min(bin, CONFIG.FEATURE.SOBEL_BINS - 1)] += magnitude;
          }

          // Laplacian
          sumLaplacian += Math.abs(
            4 * this._luminance(pixels, y * imageW + x)
            - this._luminance(pixels, (y - 1) * imageW + x)
            - this._luminance(pixels, (y + 1) * imageW + x)
            - this._luminance(pixels, y * imageW + (x - 1))
            - this._luminance(pixels, y * imageW + (x + 1))
          );
        }
      }
    }

    // 组装该cell的特征
    const avgH = count > 0 ? sumH / count : 0;
    const avgS = count > 0 ? sumS / count : 0;
    const avgV = count > 0 ? sumV / count : 0;

    const totalEdge = edgeBins.reduce((a, b) => a + b, 0);
    const normEdges = totalEdge > 0
      ? edgeBins.map(v => v / totalEdge)
      : edgeBins.map(() => 1 / CONFIG.FEATURE.SOBEL_BINS);

    const avgLaplacian = count > 0 ? sumLaplacian / count : 0;

    // 16维：HSV(3) + 边缘方向(8) + Laplacian(1) + 边缘总量(1) + 亮度方差(1) + 饱和度方差(1) + 色相方差(1)
    // 实际精简到16维
    return [
      avgH, avgS, avgV,
      ...normEdges,
      avgLaplacian,
      totalEdge / count,
      0, 0, 0,  // padding到16维的对齐占位
    ];
  },

  _luminance(pixels, pixelIdx) {
    const i = pixelIdx * 4;
    return 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  },

  // 余弦相似度
  cosineSimilarity(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  },

  // 计算对齐得分（0-1），封装完整的比对过程
  computeAlignment(originalFeatures, currentSource) {
    try {
      const currentFeatures = this.extractFeatures(currentSource);
      return this.cosineSimilarity(originalFeatures, currentFeatures);
    } catch (e) {
      console.warn('特征比对失败:', e);
      return 0;
    }
  },

  // 得分转百分比（应用非线性映射让中间值更灵敏）
  scoreToPercent(score) {
    // sigmoid平滑映射：让0.5-0.9的区间拉开
    const shifted = (score - 0.4) * 5;
    const percent = 1 / (1 + Math.exp(-shifted));
    return Math.round(Math.max(0, Math.min(100, percent * 100)));
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/core/feature-engine.js
git commit -m "$(cat <<'EOF'
feat: 实现AI场景特征提取引擎

4×4网格 × 16维特征的CV特征提取（HSV+边缘方向直方图+Laplacian），
余弦相似度比对，sigmoid得分映射。纯Canvas实现，无外部依赖。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Letter manager

**Files:**
- Create: `src/js/core/letter-manager.js`

- [ ] **Step 1: Write letter-manager.js**

```javascript
// 此刻·此地 — 信件管理服务
const LetterManager = {
  // 创建一封信的基础骨架
  createBaseLetter(type, location, photoData, content) {
    const settings = StorageService.getUserSettings();
    return {
      id: Helpers.uuid(),
      type,
      location: {
        lat: location.lat,
        lng: location.lng,
        name: location.name || '',
        radius: location.radius || CONFIG.LOCATION.DEFAULT_RADIUS,
      },
      photo: {
        dataURL: photoData.dataURL,
        thumbnail: photoData.thumbnail,
        features: photoData.features || [],
        hasAlignment: photoData.hasAlignment !== undefined ? photoData.hasAlignment : true,
      },
      content: {
        title: content.title || '',
        body: content.body || '',
        mood: content.mood || '温柔',
      },
      sender: {
        nickname: settings.nickname || '匿名旅人',
        avatar: settings.avatar || '🌲',
      },
      created: Date.now(),
      capsule: null,
      secret: null,
      replies: [],
      views: 0,
    };
  },

  // 创建公开信
  async createPublicLetter(location, photoData, content) {
    const letter = this.createBaseLetter('public', location, photoData, content);
    return StorageService.saveLetter(letter);
  },

  // 创建时光胶囊
  async createCapsule(location, photoData, content, capsuleConfig) {
    const letter = this.createBaseLetter('self_capsule', location, photoData, content);
    letter.capsule = {
      unlockAt: capsuleConfig.unlockAt || (Date.now() + 86400000), // 默认1天后
      coBuryWith: capsuleConfig.coBuryWith || [],
      allOpened: false,
      openedBy: [],
    };
    return StorageService.saveLetter(letter);
  },

  // 创建密信
  async createSecret(location, photoData, content, recipients) {
    const letter = this.createBaseLetter('secret', location, photoData, content);
    letter.secret = {
      passphrase: Helpers.generatePassphrase(),
      recipients: recipients || [],
      hintPhoto: photoData.thumbnail,
      openedBy: [],
    };
    letter.photo.hasAlignment = false; // 密信默认无对齐
    return StorageService.saveLetter(letter);
  },

  // 打开时光胶囊（检查时间锁）
  async openCapsule(letterId) {
    const letter = await StorageService.getLetterById(letterId);
    if (!letter || letter.type !== 'self_capsule') {
      throw new Error('这不是一个时光胶囊');
    }
    if (Date.now() < letter.capsule.unlockAt) {
      throw new Error('胶囊尚未到解锁时间');
    }
    const settings = StorageService.getUserSettings();
    if (!letter.capsule.openedBy.includes(settings.nickname)) {
      letter.capsule.openedBy.push(settings.nickname);
    }
    if (letter.capsule.coBuryWith.length > 0) {
      const allOpened = letter.capsule.coBuryWith.every(n =>
        letter.capsule.openedBy.includes(n)
      ) && letter.capsule.openedBy.includes(letter.sender.nickname);
      letter.capsule.allOpened = allOpened;
    }
    letter.views++;
    return StorageService.saveLetter(letter);
  },

  // 添加回响
  async addReply(letterId, body) {
    const settings = StorageService.getUserSettings();
    const reply = {
      nickname: settings.nickname || '匿名旅人',
      avatar: settings.avatar || '🌲',
      body,
      time: Date.now(),
    };
    return StorageService.addReply(letterId, reply);
  },

  // 检查当前位置是否有可打开的信
  async getReachableLetters(lat, lng) {
    const nearby = await StorageService.getNearbyLetters(lat, lng);
    const now = Date.now();
    return nearby.filter(letter => {
      // 时光胶囊未到时间不显示
      if (letter.type === 'self_capsule' && letter.capsule && now < letter.capsule.unlockAt) {
        return false;
      }
      return true;
    });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/core/letter-manager.js
git commit -m "$(cat <<'EOF'
feat: 实现信件管理服务

支持三种信件（公开/时光胶囊/密信）的创建、打开和回响添加。
时光胶囊的时间锁检查和共埋逻辑。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Map view

**Files:**
- Create: `src/js/ui/map-view.js`

- [ ] **Step 1: Write map-view.js**

```javascript
// 此刻·此地 — 地图罗盘视图
const MapView = {
  _container: null,
  _letters: [],
  _currentPos: null,
  _filterType: null, // null = all

  // 渲染地图视图
  render(container) {
    this._container = container;
    container.innerHTML = `
      <div class="map-view">
        <div class="map-top-bar">
          <input type="text" class="map-search" placeholder="搜索地点..." id="map-search-input">
        </div>
        <div class="map-canvas-wrapper" id="map-canvas-wrapper">
          <div class="map-placeholder" id="map-placeholder">
            <div class="map-status-text">正在获取位置...</div>
            <div class="map-status-icon">🗺️</div>
          </div>
        </div>
        <div class="map-filters" id="map-filters">
          <button class="map-filter-btn active" data-type="">全部</button>
          <button class="map-filter-btn" data-type="public">公开</button>
          <button class="map-filter-btn" data-type="self_capsule">给自己</button>
          <button class="map-filter-btn" data-type="secret">密信</button>
        </div>
        <div class="map-letter-list" id="map-letter-list">
          <div class="map-list-header">📍 附近没有发现信件</div>
        </div>
        <div class="map-bottom-action" id="map-bottom-action" style="display:none;">
          <button class="map-action-btn primary" id="btn-open-camera">📷 打开相机查看</button>
        </div>
      </div>
    `;

    this._bindEvents(container);
    this._startLocationUpdates();
  },

  _bindEvents(container) {
    // 筛选按钮
    container.querySelectorAll('.map-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.map-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._filterType = btn.dataset.type || null;
        this._refreshList();
      });
    });

    // 搜索
    const searchInput = container.querySelector('#map-search-input');
    searchInput.addEventListener('input', Helpers.throttle(() => {
      this._filterByName(searchInput.value.trim());
    }, 300));

    // 打开相机按钮
    const cameraBtn = container.querySelector('#btn-open-camera');
    if (cameraBtn) {
      cameraBtn.addEventListener('click', () => {
        App.navigateTo('camera');
      });
    }
  },

  _startLocationUpdates() {
    LocationService.onChange((pos) => {
      this._currentPos = pos;
      this._updateMapDisplay(pos);
      this._refresh();
    });
  },

  _updateMapDisplay(pos) {
    const statusEl = document.querySelector('#map-placeholder .map-status-text');
    if (statusEl && pos) {
      statusEl.textContent = `📍 已定位 (精度: ${Math.round(pos.accuracy)}m)`;
    }
  },

  async _refresh() {
    if (!this._currentPos) return;
    try {
      this._letters = await LetterManager.getReachableLetters(
        this._currentPos.lat,
        this._currentPos.lng
      );
      this._refreshList();
    } catch (e) {
      console.warn('刷新信件列表失败:', e);
    }
  },

  _refreshList() {
    let letters = this._letters;
    if (this._filterType) {
      letters = letters.filter(l => l.type === this._filterType);
    }

    const listEl = document.querySelector('#map-letter-list');
    if (!listEl) return;

    if (letters.length === 0) {
      listEl.innerHTML = '<div class="map-list-header">📍 附近没有发现信件</div>';
    } else {
      listEl.innerHTML = `
        <div class="map-list-header">📍 附近 ${letters.length} 封信</div>
        ${letters.map(l => this._renderLetterItem(l)).join('')}
      `;

      // 绑定列表点击
      listEl.querySelectorAll('.map-letter-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          this._onLetterClick(letters[i]);
        });
      });
    }

    // 更新底部按钮
    this._updateBottomAction(letters);
  },

  _renderLetterItem(letter) {
    const d = this._currentPos
      ? Helpers.distanceBetween(this._currentPos.lat, this._currentPos.lng, letter.location.lat, letter.location.lng)
      : 0;
    const distanceText = d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
    const typeLabel = { public: '公开', self_capsule: '给自己', secret: '密信' }[letter.type];
    const typeIcon = {
      public: letter.photo.hasAlignment ? '✉️' : '📨',
      self_capsule: '⏳',
      secret: '🔒',
    }[letter.type];
    const subInfo = letter.replies.length > 0
      ? `${letter.replies.length}回响 · ${Helpers.formatRelativeTime(letter.created)}`
      : Helpers.formatRelativeTime(letter.created);

    return `
      <div class="map-letter-item" data-id="${letter.id}">
        <span class="map-letter-icon">${typeIcon}</span>
        <div class="map-letter-info">
          <div class="map-letter-title">${Helpers.escapeHtml(letter.content.title || '无名信')}</div>
          <div class="map-letter-meta">${distanceText} · ${subInfo} · ${typeLabel}</div>
        </div>
        <span class="map-letter-arrow">›</span>
      </div>
    `;
  },

  _onLetterClick(letter) {
    if (!this._currentPos) return;
    const d = Helpers.distanceBetween(
      this._currentPos.lat, this._currentPos.lng,
      letter.location.lat, letter.location.lng
    );
    if (letter.type === 'secret') {
      // 密信需要口令
      this._showPassphraseInput(letter);
    } else if (d <= CONFIG.LOCATION.NEARBY_RANGE) {
      App.navigateTo('camera', { targetLetterId: letter.id });
    } else {
      this._showTooFar(d);
    }
  },

  _showPassphraseInput(letter) {
    const phrase = prompt('请输入密信口令：');
    if (!phrase) return;
    if (phrase !== letter.secret.passphrase) {
      alert('口令不正确');
      return;
    }
    App.navigateTo('camera', { targetLetterId: letter.id });
  },

  _showTooFar(distance) {
    alert(`距离目标还有 ${Math.round(distance)}m，走近一些再打开相机吧~`);
  },

  _updateBottomAction(letters) {
    const actionEl = document.querySelector('#map-bottom-action');
    if (!actionEl) return;
    const hasNearby = letters.some(l => {
      if (!this._currentPos) return false;
      const d = Helpers.distanceBetween(
        this._currentPos.lat, this._currentPos.lng,
        l.location.lat, l.location.lng
      );
      return d <= CONFIG.LOCATION.NEARBY_RANGE;
    });
    actionEl.style.display = hasNearby ? 'block' : 'none';
  },

  _filterByName(name) {
    if (!name) {
      this._refreshList();
      return;
    }
    const filtered = this._letters.filter(l =>
      l.content.title.toLowerCase().includes(name.toLowerCase()) ||
      (l.location.name && l.location.name.toLowerCase().includes(name.toLowerCase()))
    );
    const listEl = document.querySelector('#map-letter-list');
    if (!listEl) return;
    listEl.innerHTML = `
      <div class="map-list-header">🔍 搜索"${Helpers.escapeHtml(name)}"结果：${filtered.length} 封</div>
      ${filtered.map(l => this._renderLetterItem(l)).join('')}
    `;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/ui/map-view.js
git commit -m "$(cat <<'EOF'
feat: 实现地图罗盘视图

信件列表展示（距离排序）、类型筛选、搜索、近距离相机入口、
密信口令输入、距离提示。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Camera viewfinder view

**Files:**
- Create: `src/js/ui/camera-view.js`

- [ ] **Step 1: Write camera-view.js**

```javascript
// 此刻·此地 — 相机取景器视图
const CameraView = {
  _container: null,
  _video: null,
  _canvas: null,
  _stream: null,
  _sampleTimer: null,
  _targetLetter: null,
  _currentAlignment: 0,

  async render(container, params = {}) {
    this._container = container;
    container.innerHTML = `
      <div class="camera-view">
        <div class="camera-top-bar">
          <button class="camera-back-btn" id="btn-camera-back">＜ 返回地图</button>
          <div class="camera-gps-indicator" id="camera-gps-indicator">📍 定位中...</div>
        </div>
        <div class="camera-preview-wrapper">
          <video id="camera-video" autoplay playsinline muted></video>
          <canvas id="camera-overlay" class="camera-overlay"></canvas>
          <div class="camera-ar-layer" id="camera-ar-layer">
            <!-- AR信封悬浮区域 -->
          </div>
        </div>
        <div class="camera-alignment-bar" id="camera-alignment-bar" style="display:none;">
          <div class="alignment-label">🔍 对齐进度</div>
          <div class="alignment-track">
            <div class="alignment-fill" id="alignment-fill"></div>
          </div>
          <div class="alignment-percent" id="alignment-percent">0%</div>
        </div>
        <div class="camera-bottom-bar">
          <button class="camera-btn primary" id="btn-take-photo">📷 拍照写信</button>
          <button class="camera-btn" id="btn-focus">🎯 对焦</button>
        </div>
        <div class="camera-no-letter-hint" id="camera-no-letter-hint" style="display:none;">
          <div class="hint-text">✨ 这里还没有信</div>
          <button class="camera-btn primary" id="btn-first-letter">📝 在此留下第一封信</button>
        </div>
      </div>
    `;

    await this._startCamera();
    this._bindEvents(container);

    // 如果有指定目标信件，进入对齐模式
    if (params.targetLetterId) {
      await this._enterAlignmentMode(params.targetLetterId);
    } else {
      this._startSampleLoop();
    }
  },

  async _startCamera() {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: CONFIG.CAMERA.FACING_MODE, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      this._video = document.getElementById('camera-video');
      this._video.srcObject = this._stream;
      await this._video.play();

      this._canvas = document.getElementById('camera-overlay');
      this._canvas.width = this._video.videoWidth || 640;
      this._canvas.height = this._video.videoHeight || 480;

      // 更新GPS指示
      this._updateGpsIndicator();
      LocationService.onChange(() => this._updateGpsIndicator());
    } catch (e) {
      console.error('摄像头启动失败:', e);
      this._showCameraError();
    }
  },

  _updateGpsIndicator() {
    const el = document.getElementById('camera-gps-indicator');
    if (!el) return;
    const pos = LocationService.getCurrent();
    if (pos && LocationService.isValid()) {
      el.textContent = `📍 GPS已锁定 (±${Math.round(pos.accuracy)}m)`;
      el.classList.add('locked');
    } else {
      el.textContent = '📍 定位中...';
      el.classList.remove('locked');
    }
  },

  _showCameraError() {
    const arLayer = document.getElementById('camera-ar-layer');
    if (arLayer) {
      arLayer.innerHTML = '<div class="camera-error-msg">📷 无法访问摄像头，请检查权限设置</div>';
    }
  },

  _bindEvents(container) {
    container.querySelector('#btn-camera-back').addEventListener('click', () => {
      this._stopSampleLoop();
      this._stopCamera();
      App.navigateTo('map');
    });

    container.querySelector('#btn-take-photo').addEventListener('click', () => {
      this._captureAndCompose();
    });

    container.querySelector('#btn-focus').addEventListener('click', () => {
      this._refocus();
    });

    const firstLetterBtn = container.querySelector('#btn-first-letter');
    if (firstLetterBtn) {
      firstLetterBtn.addEventListener('click', () => {
        this._captureAndCompose();
      });
    }
  },

  async _enterAlignmentMode(letterId) {
    try {
      this._targetLetter = await StorageService.getLetterById(letterId);
      if (!this._targetLetter) return;

      // 显示对齐条
      const bar = document.getElementById('camera-alignment-bar');
      if (bar) bar.style.display = 'block';

      this._startSampleLoop();
    } catch (e) {
      console.warn('进入对齐模式失败:', e);
    }
  },

  _startSampleLoop() {
    this._stopSampleLoop();
    this._sampleTimer = setInterval(() => {
      this._processFrame();
    }, CONFIG.CAMERA.SAMPLE_INTERVAL);
  },

  _stopSampleLoop() {
    if (this._sampleTimer) {
      clearInterval(this._sampleTimer);
      this._sampleTimer = null;
    }
  },

  _processFrame() {
    if (!this._video || !this._canvas || !this._targetLetter) return;

    // 检查位置是否在范围内
    const pos = LocationService.getCurrent();
    if (!pos) return;

    const d = Helpers.distanceBetween(
      pos.lat, pos.lng,
      this._targetLetter.location.lat, this._targetLetter.location.lng
    );

    const arLayer = document.getElementById('camera-ar-layer');
    const noLetterHint = document.getElementById('camera-no-letter-hint');

    if (d > CONFIG.LOCATION.FAR_RANGE) {
      if (arLayer) arLayer.innerHTML = '';
      if (noLetterHint) noLetterHint.style.display = 'none';
      return;
    }

    // 在范围内，进行特征比对
    if (this._targetLetter.photo.hasAlignment && this._targetLetter.photo.features.length > 0) {
      const score = FeatureEngine.computeAlignment(
        this._targetLetter.photo.features,
        this._video
      );
      this._currentAlignment = FeatureEngine.scoreToPercent(score);
      this._updateAlignmentUI(this._currentAlignment);
      this._updateARLayer(this._currentAlignment);
    } else {
      // 无对齐，直接显示
      this._currentAlignment = 100;
      this._updateARLayer(100);
      const bar = document.getElementById('camera-alignment-bar');
      if (bar) bar.style.display = 'none';
    }

    if (noLetterHint) noLetterHint.style.display = 'none';
  },

  _updateAlignmentUI(percent) {
    const fill = document.getElementById('alignment-fill');
    const label = document.getElementById('alignment-percent');
    if (fill) fill.style.width = `${percent}%`;
    if (label) label.textContent = `${percent}%`;

    if (percent >= 90) {
      if (fill) fill.classList.add('success');
    } else {
      if (fill) fill.classList.remove('success');
    }
  },

  _updateARLayer(percent) {
    const arLayer = document.getElementById('camera-ar-layer');
    if (!arLayer || !this._targetLetter) return;

    const opacity = percent / 100;
    const blurAmount = Math.max(0, (1 - opacity) * 10);
    const scale = 0.6 + opacity * 0.4;

    arLayer.innerHTML = `
      <div class="ar-envelope ${percent >= 90 ? 'unlocked' : ''}"
           style="opacity: ${opacity}; filter: blur(${blurAmount}px); transform: scale(${scale});">
        <div class="ar-envelope-icon">${this._targetLetter.sender.avatar || '✉️'}</div>
        <div class="ar-envelope-sender">${Helpers.escapeHtml(this._targetLetter.sender.nickname)}</div>
        ${percent >= 90 ? `
          <button class="ar-open-btn" id="btn-open-letter">💌 打开这封信</button>
        ` : ''}
      </div>
    `;

    // 绑定打开按钮
    const openBtn = arLayer.querySelector('#btn-open-letter');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        this._openLetter();
      });
    }
  },

  _openLetter() {
    this._stopSampleLoop();
    this._stopCamera();
    App.navigateTo('read', { letterId: this._targetLetter.id });
  },

  async _captureAndCompose() {
    if (!this._video) return;
    try {
      const canvas = Helpers.scaleImageToCanvas(
        this._video,
        Math.min(this._video.videoWidth, CONFIG.CAMERA.PHOTO_MAX_WIDTH),
        Math.min(this._video.videoHeight, CONFIG.CAMERA.PHOTO_MAX_WIDTH)
      );
      const dataURL = canvas.toDataURL('image/jpeg', CONFIG.CAMERA.PHOTO_QUALITY);

      const thumbCanvas = Helpers.scaleImageToCanvas(canvas, 128, 128);
      const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);

      const pos = LocationService.getCurrent();
      if (!pos) {
        alert('无法获取当前位置，请检查定位权限');
        return;
      }

      this._stopSampleLoop();
      this._stopCamera();
      App.navigateTo('compose', {
        photoData: { dataURL, thumbnail },
        location: { lat: pos.lat, lng: pos.lng },
      });
    } catch (e) {
      console.error('拍照失败:', e);
      alert('拍照失败，请重试');
    }
  },

  _refocus() {
    // 重新触发自动对焦（部分移动端支持）
    if (this._video && this._stream) {
      const track = this._stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        try {
          const caps = track.getCapabilities();
          if (caps.focusMode && caps.focusMode.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch (e) { /* 不支持，静默 */ }
      }
    }
  },

  _stopCamera() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    this._video = null;
    this._canvas = null;
    this._targetLetter = null;
    this._currentAlignment = 0;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/ui/camera-view.js
git commit -m "$(cat <<'EOF'
feat: 实现相机取景器视图

摄像头启动、实时取景帧采样、AI对齐进度驱动AR信封浮现、
拍照写信入口、无信时的首次写信引导。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Letter composer (write new letter)

**Files:**
- Create: `src/js/ui/letter-composer.js`

- [ ] **Step 1: Write letter-composer.js**

```javascript
// 此刻·此地 — 写信界面
const LetterComposer = {
  _container: null,
  _photoData: null,
  _location: null,

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

    this._currentType = 'public';
    this._currentMood = '温柔';
    this._bindEvents(container);
  },

  _bindEvents(container) {
    // 返回
    container.querySelector('#btn-composer-back').addEventListener('click', () => {
      App.navigateTo('camera');
    });

    // 类型切换
    container.querySelectorAll('.type-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._currentType = tab.dataset.type;
        this._toggleTypeOptions();
      });
    });

    // 字数统计
    const bodyEl = container.querySelector('#composer-body');
    bodyEl.addEventListener('input', () => {
      const countEl = container.querySelector('#composer-char-count');
      countEl.textContent = `${bodyEl.value.length}/${CONFIG.LETTER.MAX_BODY_LENGTH}`;
    });

    // 情绪选择
    container.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._currentMood = btn.dataset.mood;
      });
    });

    // AI润色
    container.querySelector('#btn-ai-polish').addEventListener('click', () => {
      this._applyAIPolish();
    });

    // 发信
    container.querySelector('#btn-send-letter').addEventListener('click', () => {
      this._sendLetter();
    });

    // 初始选中第一个情绪
    const firstMood = container.querySelector('.mood-btn');
    if (firstMood) firstMood.classList.add('active');
  },

  _toggleTypeOptions() {
    document.getElementById('capsule-options').style.display = this._currentType === 'self_capsule' ? 'block' : 'none';
    document.getElementById('secret-options').style.display = this._currentType === 'secret' ? 'block' : 'none';
    document.getElementById('public-options').style.display = this._currentType === 'public' ? 'block' : 'none';
  },

  _applyAIPolish() {
    const bodyEl = document.getElementById('composer-body');
    const inputText = bodyEl.value.trim();
    if (!inputText) {
      alert('先写点什么吧，我来帮你润色~');
      return;
    }
    const polished = LEditorTemplates.wrap(inputText, this._currentMood);
    bodyEl.value = polished;
    const countEl = document.getElementById('composer-char-count');
    countEl.textContent = `${polished.length}/${CONFIG.LETTER.MAX_BODY_LENGTH}`;
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

      // 提取特征向量
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
          const recipients = recipientsRaw ? recipientsRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
          photoWithFeatures.hasAlignment = false;
          letter = await LetterManager.createSecret(location, photoWithFeatures, content, recipients);
          break;
        }
      }

      // 密信显示口令
      if (letter.type === 'secret') {
        alert(`密信创建成功！口令：${letter.secret.passphrase}\n\n请将口令分享给收信人。`);
      }

      // 回到地图
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
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/ui/letter-composer.js
git commit -m "$(cat <<'EOF'
feat: 实现写信界面

三种信件类型切换、照片预览+地点信息、情绪基调选择、
AI润色调用、时长胶囊配置、密信接收人配置。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Letter reader (read and reply)

**Files:**
- Create: `src/js/ui/letter-reader.js`

- [ ] **Step 1: Write letter-reader.js**

```javascript
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
        // 重新渲染以显示新回响
        await this.render(container, { letterId: this._letter.id });
      } catch (e) {
        console.error('回响发送失败:', e);
        alert('发送失败，请重试');
      }
    });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/ui/letter-reader.js
git commit -m "$(cat <<'EOF'
feat: 实现读信界面

信件内容展示（照片、标题、正文、发信人、地点、情绪），
回响列表和回响发送功能。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: App router and main entry

**Files:**
- Modify: `src/index.html` (rewrite), `src/css/main.css` (rewrite)
- Create: `src/js/app.js`

- [ ] **Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <title>此刻·此地</title>
    <link rel="stylesheet" href="./css/main.css">
</head>
<body>
    <div id="error-screen" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:#1a1815;color:#f0ebe0;display:none;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;text-align:center;padding:20px;">
        <div style="font-size:64px;margin-bottom:24px;">✉️</div>
        <p style="font-size:16px;line-height:1.8;">哎呀，出错了，请重启试试吧~</p>
    </div>

    <div id="app">
        <div id="view-container"></div>
    </div>

    <script src="./js/config.js"></script>
    <script src="./js/utils/helpers.js"></script>
    <script src="./js/data/storage.js"></script>
    <script src="./js/data/templates.js"></script>
    <script src="./js/core/location-service.js"></script>
    <script src="./js/core/feature-engine.js"></script>
    <script src="./js/core/letter-manager.js"></script>
    <script src="./js/ui/map-view.js"></script>
    <script src="./js/ui/camera-view.js"></script>
    <script src="./js/ui/letter-composer.js"></script>
    <script src="./js/ui/letter-reader.js"></script>
    <script src="./js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write app.js**

```javascript
// 此刻·此地 — 主路由与初始化
const App = {
  _currentView: null,
  _viewParams: null,

  views: {
    map: MapView,
    camera: CameraView,
    compose: LetterComposer,
    read: LetterReader,
  },

  async init() {
    try {
      // 初始化存储
      await StorageService.init();

      // 启动定位
      LocationService.start();

      // 渲染初始视图（地图）
      this.navigateTo('map');
    } catch (e) {
      console.error('初始化失败:', e);
      Helpers.showError();
    }
  },

  navigateTo(viewName, params = {}) {
    if (!this.views[viewName]) {
      console.error(`未知视图: ${viewName}`);
      return;
    }

    this._currentView = viewName;
    this._viewParams = params;

    const container = document.getElementById('view-container');
    container.innerHTML = '';

    try {
      this.views[viewName].render(container, params);
    } catch (e) {
      console.error(`视图 ${viewName} 渲染失败:`, e);
      Helpers.showError();
    }
  },

  getCurrentView() {
    return this._currentView;
  },
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  App.init().catch(e => {
    console.error('应用启动失败:', e);
    Helpers.showError();
  });
});
```

- [ ] **Step 3: Write main.css**

```css
/* 此刻·此地 — 全局样式 */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg: #1a1815;
  --surface: #252320;
  --text: #f0ebe0;
  --text-dim: #9a9488;
  --accent: #d4a853;
  --accent-bright: #f0c96d;
  --danger: #e05555;
  --radius: 12px;
  --font: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}

#app, #view-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* ---- 地图视图 ---- */
.map-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.map-top-bar {
  padding: 12px 16px;
  background: var(--surface);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.map-search {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: var(--text);
  font-size: 15px;
  outline: none;
}

.map-search::placeholder {
  color: var(--text-dim);
}

.map-canvas-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1c1a15;
  min-height: 200px;
}

.map-placeholder {
  text-align: center;
  color: var(--text-dim);
}

.map-status-icon {
  font-size: 48px;
  margin-top: 12px;
}

.map-filters {
  display: flex;
  padding: 10px 16px;
  gap: 8px;
  background: var(--surface);
  border-top: 1px solid rgba(255,255,255,0.06);
  overflow-x: auto;
}

.map-filter-btn {
  padding: 6px 16px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 20px;
  background: transparent;
  color: var(--text-dim);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.map-filter-btn.active {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}

.map-letter-list {
  flex: 0 0 auto;
  max-height: 40vh;
  overflow-y: auto;
  background: var(--surface);
  border-top: 1px solid rgba(255,255,255,0.06);
}

.map-list-header {
  padding: 12px 16px;
  font-size: 14px;
  color: var(--text-dim);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.map-letter-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  cursor: pointer;
  transition: background 0.15s;
}

.map-letter-item:active {
  background: rgba(255,255,255,0.04);
}

.map-letter-icon {
  font-size: 28px;
  margin-right: 12px;
  flex-shrink: 0;
}

.map-letter-info {
  flex: 1;
  min-width: 0;
}

.map-letter-title {
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.map-letter-meta {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 2px;
}

.map-letter-arrow {
  font-size: 20px;
  color: var(--text-dim);
  flex-shrink: 0;
}

.map-bottom-action {
  padding: 16px;
  background: var(--surface);
  border-top: 1px solid rgba(255,255,255,0.06);
}

.map-action-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: var(--radius);
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
}

.map-action-btn.primary {
  background: var(--accent);
  color: var(--bg);
}

/* ---- 相机视图 ---- */
.camera-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000;
  position: relative;
}

.camera-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
}

.camera-back-btn {
  background: rgba(0,0,0,0.5);
  border: none;
  color: #fff;
  font-size: 15px;
  padding: 8px 14px;
  border-radius: 20px;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.camera-gps-indicator {
  background: rgba(0,0,0,0.5);
  color: #fff;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}

.camera-gps-indicator.locked {
  background: rgba(50, 180, 50, 0.5);
}

.camera-preview-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

#camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.camera-ar-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.ar-envelope {
  text-align: center;
  transition: all 0.4s ease;
  pointer-events: auto;
}

.ar-envelope.unlocked {
  animation: envelope-pulse 1.5s ease infinite;
}

@keyframes envelope-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.ar-envelope-icon {
  font-size: 56px;
  margin-bottom: 8px;
}

.ar-envelope-sender {
  font-size: 16px;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
}

.ar-open-btn {
  display: block;
  margin: 16px auto 0;
  padding: 12px 32px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: 24px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  pointer-events: auto;
}

.camera-alignment-bar {
  position: absolute;
  bottom: 120px;
  left: 16px;
  right: 16px;
  z-index: 10;
  background: rgba(0,0,0,0.6);
  border-radius: 12px;
  padding: 12px 16px;
  backdrop-filter: blur(10px);
}

.alignment-label {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.alignment-track {
  height: 6px;
  background: rgba(255,255,255,0.15);
  border-radius: 3px;
  overflow: hidden;
}

.alignment-fill {
  height: 100%;
  width: 0%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.alignment-fill.success {
  background: #4caf50;
}

.alignment-percent {
  text-align: right;
  font-size: 14px;
  color: var(--text);
  margin-top: 4px;
}

.camera-bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  gap: 12px;
  padding: 20px 16px;
  padding-bottom: max(20px, env(safe-area-inset-bottom));
}

.camera-btn {
  flex: 1;
  padding: 14px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: var(--radius);
  background: rgba(0,0,0,0.5);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.camera-btn.primary {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}

.camera-no-letter-hint {
  position: absolute;
  bottom: 100px;
  left: 16px;
  right: 16px;
  z-index: 10;
  text-align: center;
}

.hint-text {
  font-size: 18px;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
  margin-bottom: 16px;
}

.camera-error-msg {
  color: #fff;
  font-size: 16px;
  text-align: center;
  padding: 20px;
}

/* ---- 写信视图 ---- */
.composer-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.composer-top-bar {
  display: flex;
  align-items: center;
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  background: var(--surface);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.composer-back-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 15px;
  cursor: pointer;
  padding: 4px 0;
}

.composer-title {
  flex: 1;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  margin-right: 40px;
}

.composer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.composer-photo-preview {
  text-align: center;
  margin-bottom: 20px;
}

.composer-thumb {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: var(--radius);
  border: 2px solid rgba(255,255,255,0.1);
}

.composer-no-photo {
  width: 120px;
  height: 120px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border-radius: var(--radius);
  color: var(--text-dim);
  font-size: 14px;
}

.composer-location {
  font-size: 13px;
  color: var(--text-dim);
  margin-top: 8px;
}

.composer-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.composer-label {
  font-size: 13px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.composer-type-tabs {
  display: flex;
  gap: 8px;
}

.type-tab {
  flex: 1;
  padding: 10px 8px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  background: transparent;
  color: var(--text-dim);
  font-size: 13px;
  cursor: pointer;
  text-align: center;
}

.type-tab.active {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}

.composer-input,
.composer-textarea {
  width: 100%;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: var(--text);
  font-size: 15px;
  font-family: var(--font);
  outline: none;
  resize: none;
}

.composer-input::placeholder,
.composer-textarea::placeholder {
  color: var(--text-dim);
}

.composer-textarea {
  height: 120px;
  line-height: 1.8;
}

.composer-char-count {
  text-align: right;
  font-size: 12px;
  color: var(--text-dim);
}

.composer-mood-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mood-btn {
  padding: 6px 14px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  background: transparent;
  color: var(--text-dim);
  font-size: 13px;
  cursor: pointer;
}

.mood-btn.active {
  background: rgba(212,168,83,0.2);
  color: var(--accent-bright);
  border-color: var(--accent);
}

.composer-ai-btn {
  padding: 10px;
  background: rgba(212,168,83,0.1);
  border: 1px dashed var(--accent);
  border-radius: 8px;
  color: var(--accent);
  font-size: 14px;
  cursor: pointer;
}

.composer-check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}

.composer-bottom-bar {
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  background: var(--surface);
  border-top: 1px solid rgba(255,255,255,0.06);
}

.composer-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: var(--radius);
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
}

.composer-btn.primary {
  background: var(--accent);
  color: var(--bg);
}

/* ---- 读信视图 ---- */
.reader-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.reader-top-bar {
  display: flex;
  align-items: center;
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  background: var(--surface);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.reader-back-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 15px;
  cursor: pointer;
}

.reader-type-badge {
  flex: 1;
  text-align: center;
  font-size: 13px;
  color: var(--text-dim);
  margin-right: 40px;
}

.reader-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
}

.reader-photo-section {
  text-align: center;
  margin-bottom: 24px;
}

.reader-photo {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: var(--radius);
  border: 2px solid rgba(255,255,255,0.08);
}

.reader-location {
  font-size: 13px;
  color: var(--text-dim);
  margin-top: 8px;
}

.reader-content {
  margin-bottom: 32px;
}

.reader-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--accent-bright);
}

.reader-sender {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  font-size: 14px;
  color: var(--text-dim);
}

.reader-body-text {
  font-size: 16px;
  line-height: 2;
  white-space: pre-wrap;
}

.reader-mood {
  margin-top: 16px;
  font-size: 13px;
  color: var(--accent);
}

.reader-replies-section {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 20px;
  margin-bottom: 24px;
}

.replies-title {
  font-size: 15px;
  margin-bottom: 16px;
}

.reply-item {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.reply-content {
  flex: 1;
}

.reply-author {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.reply-body {
  font-size: 15px;
  white-space: pre-wrap;
}

.reader-no-replies {
  text-align: center;
  color: var(--text-dim);
  padding: 20px;
  font-size: 14px;
}

.reader-reply-form {
  display: flex;
  gap: 8px;
}

.reply-input {
  flex: 1;
  padding: 10px 14px;
  background: var(--surface);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: var(--text);
  font-size: 14px;
  font-family: var(--font);
  outline: none;
  resize: none;
  height: 44px;
}

.reply-input::placeholder {
  color: var(--text-dim);
}

.reply-btn {
  padding: 10px 20px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.reader-empty {
  text-align: center;
  padding: 60px 20px;
  font-size: 16px;
  color: var(--text-dim);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/index.html src/css/main.css src/js/app.js
git commit -m "$(cat <<'EOF'
feat: 实现主入口、路由和全局样式

App初始化和视图路由，深色主题CSS，移动端适配，
four views (map/camera/compose/reader) 完整样式。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Integration verification

**Files:**
- No new files — verify the complete project structure

- [ ] **Step 1: Verify project structure**

Run:
```bash
find "E:\桌面\letter\letter-delivery\src" -type f | sort
```

Expected output:
```
src/index.html
src/css/main.css
src/js/app.js
src/js/config.js
src/js/core/feature-engine.js
src/js/core/letter-manager.js
src/js/core/location-service.js
src/js/data/storage.js
src/js/data/templates.js
src/js/ui/camera-view.js
src/js/ui/letter-composer.js
src/js/ui/letter-reader.js
src/js/ui/map-view.js
src/js/utils/helpers.js
```

- [ ] **Step 2: Verify script loading order matches index.html dependencies**

Check that the script loading order in `index.html` respects dependency chain:
```
config.js         (no deps)
helpers.js        (depends on config)
storage.js        (depends on helpers, config)
templates.js      (no deps)
location-service.js (depends on config)
feature-engine.js (depends on config, helpers)
letter-manager.js (depends on storage, helpers, config)
map-view.js       (depends on letter-manager, location-service, helpers, config)
camera-view.js    (depends on feature-engine, storage, location-service, letter-manager, helpers, config)
letter-composer.js (depends on feature-engine, letter-manager, location-service, helpers, config, templates)
letter-reader.js  (depends on letter-manager, storage, helpers, config)
app.js            (depends on all above)
```

- [ ] **Step 3: Basic smoke test — open in browser**

Open `src/index.html` in a browser. Expected:
- No JS errors in console
- Map view renders with "正在获取位置..." text
- If on a device with GPS + camera: clicking around navigates between views

- [ ] **Step 4: Commit verification results**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: 验证项目结构完整性

所有文件就位，依赖链正确，可正常加载。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Update development log

**Files:**
- Modify: `docs/开发日志.md`

- [ ] **Step 1: Append today's implementation record**

Add to `docs/开发日志.md`:

```markdown

---

## 2026-05-30 (实现阶段)

### 完成
- 搭建完整项目骨架（目录结构、入口文件）
- config.js: 全局配置常量
- helpers.js: UUID/口令/Haversine距离/时间格式化/节流/错误处理
- storage.js: IndexedDB信件CRUD + LocalStorage用户设置
- templates.js: 6种情绪 × 组合模板的AI润色降级方案
- location-service.js: Geolocation API封装，支持位置监听
- feature-engine.js: 4×4网格CV特征提取（HSV+Sobel+Laplacian），余弦相似度比对
- letter-manager.js: 三种信件创建/胶囊时间锁/回响管理
- map-view.js: 地图罗盘视图（筛选/搜索/距离提示/密信口令）
- camera-view.js: 相机取景器（实时对齐/AR信封浮现/拍照写信）
- letter-composer.js: 写信界面（类型切换/AI润色/胶囊配置/密信配置）
- letter-reader.js: 读信界面（内容展示/回响列表/回响发送）
- app.js: 主路由与初始化
- main.css: 全局深色主题样式，移动端适配
- index.html: 入口文件，完整脚本加载链

### 下一步
- [ ] 在真机上测试 GPS + 相机全流程
- [ ] 对齐算法的角度灵敏度调优
- [ ] 完整版：接入高德地图SDK
- [ ] 完整版：接入大模型API做AI润色
- [ ] Demo版：缓存Leaflet瓦片 + 压缩至8MB以内
```

- [ ] **Step 2: Commit**

```bash
git add docs/开发日志.md
git commit -m "$(cat <<'EOF'
docs: 更新开发日志，记录实现阶段完成情况

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Plan Summary

**Total tasks:** 14
**Files created:** 12 new JS files + 1 HTML + 1 CSS
**Files removed:** 8 old files (shared/, modules/, preset-letters.js)

**Key technical decisions:**
1. No build tools, no frameworks — all vanilla JS
2. Feature engine uses traditional CV (Sobel edges + color histograms) — no ML model dependencies
3. IndexedDB for letter storage — works offline, no server needed
4. Map view uses placeholder UI — ready for Leaflet/AMap SDK swap
5. Camera view does real-time frame sampling at 1fps — balanced for performance
6. All components communicate through a simple global `App` router — no event bus needed at this scale
