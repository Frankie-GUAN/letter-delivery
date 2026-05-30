// 此刻·此地 — 数据同步与通知服务
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ========== 简易JSON文件数据库 ==========

const DATA_DIR = path.join(__dirname, 'data');
const LETTERS_FILE = path.join(DATA_DIR, 'letters.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LETTERS_FILE)) fs.writeFileSync(LETTERS_FILE, '[]');
  if (!fs.existsSync(NOTIFICATIONS_FILE)) fs.writeFileSync(NOTIFICATIONS_FILE, '[]');
}

function readJSON(filepath) {
  try {
    const raw = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ========== 信件API ==========

// 获取附近信件
app.get('/api/letters/nearby', (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: '缺少经纬度参数' });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxRadius = parseFloat(radius) || 50; // 默认50米（服务端扩大范围）

    const letters = readJSON(LETTERS_FILE);
    const now = Date.now();

    const nearby = letters.filter(l => {
      // 过滤未到期的时光胶囊
      if (l.type === 'self_capsule' && l.capsule && now < l.capsule.unlockAt) {
        return false;
      }
      const d = haversine(userLat, userLng, l.location.lat, l.location.lng);
      return d <= maxRadius;
    });

    // 按距离排序
    nearby.sort((a, b) => {
      const dA = haversine(userLat, userLng, a.location.lat, a.location.lng);
      const dB = haversine(userLat, userLng, b.location.lat, b.location.lng);
      return dA - dB;
    });

    res.json({ letters: nearby, count: nearby.length });
  } catch (e) {
    console.error('获取附近信件失败:', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单封信
app.get('/api/letters/:id', (req, res) => {
  try {
    const letters = readJSON(LETTERS_FILE);
    const letter = letters.find(l => l.id === req.params.id);
    if (!letter) return res.status(404).json({ error: '信件不存在' });
    res.json({ letter });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建/更新信件
app.post('/api/letters', (req, res) => {
  try {
    const { letter } = req.body;
    if (!letter || !letter.id) {
      return res.status(400).json({ error: '无效的信件数据' });
    }

    const letters = readJSON(LETTERS_FILE);
    const idx = letters.findIndex(l => l.id === letter.id);

    if (idx >= 0) {
      // 更新已有信件（合并回响和浏览量）
      const existing = letters[idx];
      letter.replies = mergeReplies(existing.replies || [], letter.replies || []);
      letter.views = Math.max(existing.views || 0, letter.views || 0);
      if (letter.capsule && existing.capsule) {
        letter.capsule.openedBy = [...new Set([
          ...(existing.capsule.openedBy || []),
          ...(letter.capsule.openedBy || []),
        ])];
        letter.capsule.allOpened = letter.capsule.allOpened || existing.capsule.allOpened;
      }
      if (letter.secret && existing.secret) {
        letter.secret.openedBy = [...new Set([
          ...(existing.secret.openedBy || []),
          ...(letter.secret.openedBy || []),
        ])];
      }
      letters[idx] = letter;
    } else {
      letters.push(letter);
    }

    writeJSON(LETTERS_FILE, letters);
    res.json({ success: true, letter });
  } catch (e) {
    console.error('保存信件失败:', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 添加回响
app.post('/api/letters/:id/reply', (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply || !reply.body) {
      return res.status(400).json({ error: '无效的回响数据' });
    }

    const letters = readJSON(LETTERS_FILE);
    const letter = letters.find(l => l.id === req.params.id);
    if (!letter) return res.status(404).json({ error: '信件不存在' });

    reply.time = reply.time || Date.now();
    letter.replies.push(reply);

    writeJSON(LETTERS_FILE, letters);
    res.json({ success: true, letter });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 双向同步
app.post('/api/sync', (req, res) => {
  try {
    const { localLetters, lastSync } = req.body;
    const serverLetters = readJSON(LETTERS_FILE);

    // 上传本地新信件到服务器
    if (localLetters && localLetters.length > 0) {
      const allLetters = readJSON(LETTERS_FILE);
      localLetters.forEach(local => {
        const idx = allLetters.findIndex(s => s.id === local.id);
        if (idx >= 0) {
          local.replies = mergeReplies(allLetters[idx].replies || [], local.replies || []);
          local.views = Math.max(allLetters[idx].views || 0, local.views || 0);
          allLetters[idx] = local;
        } else {
          allLetters.push(local);
        }
      });
      writeJSON(LETTERS_FILE, allLetters);
    }

    // 下载服务器上新信件
    const syncTimestamp = lastSync || 0;
    const newLetters = serverLetters.filter(l => l.created > syncTimestamp);

    res.json({
      success: true,
      newLetters,
      serverTime: Date.now(),
    });
  } catch (e) {
    console.error('同步失败:', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 密信口令解析
app.post('/api/secret/resolve', (req, res) => {
  try {
    const { passphrase } = req.body;
    if (!passphrase) {
      return res.status(400).json({ error: '缺少口令' });
    }

    const letters = readJSON(LETTERS_FILE);
    const letter = letters.find(l =>
      l.type === 'secret' && l.secret && l.secret.passphrase === passphrase
    );

    if (!letter) return res.status(404).json({ error: '未找到对应密信' });

    res.json({
      found: true,
      letterId: letter.id,
      location: letter.location,
      hintPhoto: letter.secret.hintPhoto,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ========== 通知API ==========

// 注册通知订阅
app.post('/api/notifications/register', (req, res) => {
  try {
    const { nickname, deviceToken } = req.body;
    if (!nickname) return res.status(400).json({ error: '缺少用户昵称' });

    const notifications = readJSON(NOTIFICATIONS_FILE);
    const idx = notifications.findIndex(n => n.nickname === nickname);

    const sub = { nickname, deviceToken, registeredAt: Date.now() };
    if (idx >= 0) {
      notifications[idx] = sub;
    } else {
      notifications.push(sub);
    }

    writeJSON(NOTIFICATIONS_FILE, notifications);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 轮询检查通知
app.get('/api/notifications/check', (req, res) => {
  try {
    const { nickname, lat, lng } = req.query;
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const letters = readJSON(LETTERS_FILE);
    const now = Date.now();
    const events = [];

    // 1. 检查附近的密信（发给该用户的）
    const nearbySecrets = letters.filter(l =>
      l.type === 'secret' &&
      l.secret &&
      l.secret.recipients.includes(nickname) &&
      !l.secret.openedBy.includes(nickname)
    );

    if (nearbySecrets.length > 0 && userLat && userLng) {
      nearbySecrets.forEach(l => {
        const d = haversine(userLat, userLng, l.location.lat, l.location.lng);
        if (d <= (l.location.radius || 20)) {
          events.push({
            type: 'secret_nearby',
            letterId: l.id,
            title: l.content.title || '一封密信',
            sender: l.sender.nickname,
            message: `你有一封密信在附近${Math.round(d)}m处`,
          });
        }
      });
    }

    // 2. 时光胶囊到期通知
    const dueCapsules = letters.filter(l =>
      l.type === 'self_capsule' &&
      l.capsule &&
      now >= l.capsule.unlockAt &&
      !l.capsule.openedBy.includes(nickname) &&
      (l.sender.nickname === nickname || l.capsule.coBuryWith.includes(nickname))
    );

    dueCapsules.forEach(l => {
      events.push({
        type: 'capsule_unlocked',
        letterId: l.id,
        title: l.content.title || '时光胶囊',
        message: '你有一个已经到期的时光胶囊可以打开了',
      });
    });

    // 3. 共埋胶囊全部打开通知
    const coBuried = letters.filter(l =>
      l.type === 'self_capsule' &&
      l.capsule &&
      l.capsule.allOpened &&
      (l.sender.nickname === nickname || l.capsule.coBuryWith.includes(nickname))
    );

    coBuried.forEach(l => {
      events.push({
        type: 'capsule_all_opened',
        letterId: l.id,
        title: l.content.title || '时光胶囊',
        message: '共埋的时光胶囊所有人都打开了！快去看看大家的留言吧',
      });
    });

    res.json({ events, hasNew: events.length > 0 });
  } catch (e) {
    console.error('通知检查失败:', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ========== 工具函数 ==========

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mergeReplies(existing, incoming) {
  const map = new Map();
  existing.forEach(r => map.set(`${r.nickname}-${r.time}`, r));
  incoming.forEach(r => map.set(`${r.nickname}-${r.time}`, r));
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

// ========== 启动 ==========

ensureDataDir();
app.listen(PORT, () => {
  console.log(`📮 此刻·此地 同步服务已启动 → http://localhost:${PORT}`);
  console.log(`   信件API:    GET/POST /api/letters`);
  console.log(`   同步API:    POST /api/sync`);
  console.log(`   通知API:    GET  /api/notifications/check`);
});
