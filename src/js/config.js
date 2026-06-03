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
    ALIGNMENT_THRESHOLD: 0.90,    // 对齐成功阈值
  },

  // 信件
  LETTER: {
    MAX_TITLE_LENGTH: 50,
    MAX_BODY_LENGTH: 2000,
    MAX_REPLY_LENGTH: 500,
  },

  // 存储
  STORAGE: {
    DB_NAME: 'cikecidi',
    DB_VERSION: 1,
    LETTERS_STORE: 'letters',
  },

  // 同步服务
  SYNC: {
    SERVER_URL: '',                      // 同源部署，使用相对路径
    INTERVAL: 30000,              // 同步间隔（ms）
    NOTIFY_INTERVAL: 15000,       // 通知检查间隔（ms）
  },

  // 口令
  PASSPHRASE: {
    LENGTH: 8,                    // 口令字符数
    CHARS: 'abcdefghijkmnpqrstuvwxyz23456789',
  },

  // 错误文案
  ERROR_TEXT: '哎呀，出错了，请重启试试吧~',
};

// ── 共享常量（避免多文件重复） ──
CONFIG.AVATARS = ['🌲', '🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🐸', '🦁', '🐙', '🌸', '🌟', '🌈', '💎', '🎈', '🎵', '📚', '☕'];
CONFIG.LETTER_TYPE_ICONS = { public: '📮', self_capsule: '⏳', secret: '🔒' };
CONFIG.LETTER_TYPE_LABELS = { public: '公开', self_capsule: '给自己', secret: '密信' };
CONFIG.LETTER_MOODS = ['温柔', '俏皮', '深情', '怀念', '期待', '感谢'];

// 冻结防止意外修改
Object.freeze(CONFIG);
Object.freeze(CONFIG.LOCATION);
Object.freeze(CONFIG.CAMERA);
Object.freeze(CONFIG.FEATURE);
Object.freeze(CONFIG.LETTER);
Object.freeze(CONFIG.STORAGE);
Object.freeze(CONFIG.SYNC);
Object.freeze(CONFIG.PASSPHRASE);
