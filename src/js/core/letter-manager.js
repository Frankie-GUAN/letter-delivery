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
