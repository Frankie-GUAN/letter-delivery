// 此刻·此地 — 程序化音效引擎（Web Audio API）
const SoundEngine = {
  _ctx: null,
  _enabled: true,
  _volume: 0.5,
  _initialized: false,

  // ---- 生命周期 ----

  init() {
    if (this._initialized) return;
    try {
      const saved = localStorage.getItem('cikecidi_sound_enabled');
      this._enabled = saved !== 'false'; // 默认开启
      const vol = localStorage.getItem('cikecidi_sound_volume');
      if (vol !== null) this._volume = parseFloat(vol);
    } catch (e) { /* 静默 */ }
    this._initialized = true;
  },

  _getContext() {
    if (!this._ctx) {
      try {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this._enabled = false;
        return null;
      }
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    return this._ctx;
  },

  // ---- 内部生成器 ----

  _createGain(now, volume = 1.0) {
    const ctx = this._getContext();
    if (!ctx) return null;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * this._volume, now);
    gain.connect(ctx.destination);
    return gain;
  },

  // 噪声生成：duration秒，envelope [attack, decay]，filterFreq中心频率，filterQ值
  _createNoise(duration, envelope, filterFreq, filterQ = 0.5) {
    const ctx = this._getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // 棕噪声（-6dB/oct 衰减）
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      // 归一化
      data[i] *= 2.5;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // 滤波器
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    // 包络
    const gain = this._createGain(now, 0);
    if (!gain) return;
    const [attack, decay] = envelope;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this._volume * 0.5, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

    source.connect(filter);
    filter.connect(gain);
    source.start(now);
    source.stop(now + duration + 0.1);
  },

  // 纯音生成
  _createTone(freq, duration, waveType = 'sine', envelope = [0.005, 0.15]) {
    const ctx = this._getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, now);

    const gain = this._createGain(now, 0);
    if (!gain) return;
    const [attack, decay] = envelope;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this._volume * 0.3, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + attack + decay + 0.05);
  },

  // 和声音生成
  _createChime(notes, noteDuration = 0.12, gap = 0.06) {
    const ctx = this._getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    notes.forEach((freq, i) => {
      const startTime = now + i * (noteDuration + gap);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(this._volume * 0.15, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);
      gain.connect(ctx.destination);

      osc.connect(gain);
      osc.start(startTime);
      osc.stop(startTime + noteDuration + 0.05);
    });
  },

  // ---- 音效 ----

  // 相机快门
  playShutter() {
    if (!this._enabled) return;
    const ctx = this._getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 短促白噪声
    const duration = 0.08;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufferSize * 30);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this._volume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    gain.connect(ctx.destination);

    source.connect(filter);
    filter.connect(gain);
    source.start(now);
    source.stop(now + 0.08);

    // 振动反馈
    if (navigator.vibrate) navigator.vibrate(20);
  },

  // 火漆封印
  playWaxSeal() {
    if (!this._enabled) return;
    this._createTone(80, 0.2, 'triangle', [0.01, 0.19]);   // 低频闷响
    setTimeout(() => {
      if (!this._enabled) return;
      this._createNoise(0.1, [0.005, 0.095], 4000, 1.5);     // 高频碎裂
    }, 50);
  },

  // UI 悬停轻触
  playUIHover() {
    if (!this._enabled) return;
    const ctx = this._getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.04);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this._volume * 0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    gain.connect(ctx.destination);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.08);
  },

  // UI 点击
  playUIClick() {
    if (!this._enabled) return;
    this._createTone(800, 0.03, 'square', [0.002, 0.028]);
  },

  // 打开信封
  playOpenLetter() {
    if (!this._enabled) return;
    // 分层噪声模拟信封打开
    this._createNoise(0.35, [0.02, 0.33], 800, 0.4);
    setTimeout(() => {
      if (!this._enabled) return;
      this._createNoise(0.2, [0.01, 0.19], 1500, 0.8);
    }, 100);
  },

  // 寄信
  playSendLetter() {
    if (!this._enabled) return;
    // 风声滑降
    const ctx = this._getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const duration = 0.3;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * white) / 1.02;
      last = data[i];
      data[i] *= 3 * Math.exp(-i / bufferSize * 2);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this._volume * 0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(ctx.destination);

    source.connect(filter);
    filter.connect(gain);
    source.start(now);
    source.stop(now + duration + 0.05);

    // 接火漆封印
    setTimeout(() => this.playWaxSeal(), 200);
  },

  // 翻页过渡
  playPageTurn() {
    if (!this._enabled) return;
    const ctx = this._getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const duration = 0.15;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + 0.03 * white) / 1.03;
      last = data[i];
      data[i] *= 2;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.6;

    // 声像从左到右
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(-0.5, now);
    panner.pan.linearRampToValueAtTime(0.5, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this._volume * 0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(ctx.destination);

    source.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    source.start(now);
    source.stop(now + duration + 0.05);
  },

  // 错误提示
  playError() {
    if (!this._enabled) return;
    this._createTone(150, 0.25, 'triangle', [0.02, 0.23]);
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  },

  // 通知
  playNotification() {
    if (!this._enabled) return;
    const ctx = this._getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [800, 1000].forEach((freq, i) => {
      const startTime = now + i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(this._volume * 0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
      gain.connect(ctx.destination);

      osc.connect(gain);
      osc.start(startTime);
      osc.stop(startTime + 0.18);
    });
  },
};

// 首次用户交互时初始化 AudioContext
document.addEventListener('click', () => SoundEngine.init(), { once: true });
document.addEventListener('touchend', () => SoundEngine.init(), { once: true });
