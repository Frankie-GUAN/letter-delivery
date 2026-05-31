// 此刻·此地 — 数据同步与通知服务
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// 静态文件由 Nginx 提供，Node.js 仅处理 API
const STATIC_DIR = path.join(__dirname, '..', 'src');

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

app.get('/api/letters/nearby', (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: '缺少经纬度参数' });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxRadius = parseFloat(radius) || 50;

    const letters = readJSON(LETTERS_FILE);
    const now = Date.now();

    const nearby = letters.filter(l => {
      if (l.type === 'self_capsule' && l.capsule && now > l.capsule.unlockAt + 7 * 86400000) {
        return false;
      }
      const d = haversine(userLat, userLng, l.location.lat, l.location.lng);
      return d <= maxRadius;
    });

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

app.post('/api/letters', (req, res) => {
  try {
    const { letter } = req.body;
    if (!letter || !letter.id) {
      return res.status(400).json({ error: '无效的信件数据' });
    }

    const letters = readJSON(LETTERS_FILE);
    const idx = letters.findIndex(l => l.id === letter.id);

    if (idx >= 0) {
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

app.post('/api/sync', (req, res) => {
  try {
    const { localLetters, lastSync } = req.body;
    const serverLetters = readJSON(LETTERS_FILE);

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

    const syncTimestamp = lastSync || 0;
    const newLetters = serverLetters.filter(l => l.created >= syncTimestamp);

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

app.get('/api/notifications/check', (req, res) => {
  try {
    const { nickname, lat, lng } = req.query;
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const letters = readJSON(LETTERS_FILE);
    const now = Date.now();
    const events = [];

    const nearbySecrets = letters.filter(l =>
      l.type === 'secret' &&
      l.secret &&
      l.secret.recipients.includes(nickname) &&
      !l.secret.openedBy.includes(nickname)
    );

    if (nearbySecrets.length > 0 && userLat != null && userLng != null && !isNaN(userLat) && !isNaN(userLng)) {
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

    const dueCapsules = letters.filter(l =>
      l.type === 'self_capsule' &&
      l.capsule &&
      now >= l.capsule.unlockAt &&
      !l.capsule.openedBy.includes(nickname) &&
      (l.sender.nickname === nickname || (l.capsule.coBuryWith && l.capsule.coBuryWith.includes(nickname)))
    );

    dueCapsules.forEach(l => {
      events.push({
        type: 'capsule_unlocked',
        letterId: l.id,
        title: l.content.title || '时光胶囊',
        message: '你有一个已经到期的时光胶囊可以打开了',
      });
    });

    const coBuried = letters.filter(l =>
      l.type === 'self_capsule' &&
      l.capsule &&
      l.capsule.allOpened &&
      (l.sender.nickname === nickname || (l.capsule.coBuryWith && l.capsule.coBuryWith.includes(nickname)))
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

// CA证书下载（手机安装用）
app.get('/ca', (req, res) => {
  const caPath = path.join(__dirname, 'rootCA.pem');
  if (fs.existsSync(caPath)) {
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', 'attachment; filename="cikecidi-ca.pem"');
    res.sendFile(caPath);
  } else {
    res.status(404).send('CA cert not found');
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

// 获取服务器局域网IP（优先真实网卡，跳过虚拟机/虚拟网卡）
function getLanIP() {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  const vmVendors = /VMware|VirtualBox|Hyper-V|vEthernet|Docker|WSL/i;
  const candidates = [];

  for (const name of Object.keys(ifaces)) {
    if (vmVendors.test(name)) continue;
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // 优先 WiFi / 以太网
        if (/wlan|wi-fi|en\d|eth|以太网|无线/i.test(name)) {
          return iface.address;
        }
        candidates.push(iface.address);
      }
    }
  }
  return candidates[0] || '127.0.0.1';
}

// 服务器信息（供前端生成扫码链接用）
const HTTPS_PORT = process.env.HTTPS_PORT || 3457;
app.get('/api/server-info', (req, res) => {
  res.json({
    lanIP: getLanIP(),
    httpsPort: HTTPS_PORT,
    url: `https://${getLanIP()}:${HTTPS_PORT}/`,
  });
});

const API_PORT = process.env.API_PORT || 3000;

ensureDataDir();

// 仅监听 127.0.0.1，由 Nginx 反向代理对外
app.listen(API_PORT, '127.0.0.1', () => {
  console.log(`📮 此刻·此地 API 服务已启动 → http://127.0.0.1:${API_PORT}`);
  console.log(`   Nginx HTTPS 代理 → https://<你的IP>:3457`);
  console.log(`   信件API:  GET/POST /api/letters`);
  console.log(`   同步API:  POST /api/sync`);
  console.log(`   通知API:  GET  /api/notifications/check`);
});
