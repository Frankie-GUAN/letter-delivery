// 此刻·此地 — 动效工具库
const AnimationEngine = {
  // ---- 页面过渡 ----

  // 翻页过渡：direction='forward'|'back'
  async pageTransition(oldEl, direction = 'forward') {
    if (!oldEl) return;
    const animOut = direction === 'forward' ? 'slideOutLeft' : 'slideOutRight';
    oldEl.style.animation = `${animOut} 0.22s ease forwards`;
    await this._wait(200);
    oldEl.style.animation = '';
  },

  // 新页面滑入
  pageEnter(el, direction = 'forward') {
    if (!el) return;
    const animIn = direction === 'forward' ? 'slideInRight' : 'slideInLeft';
    el.style.animation = `${animIn} 0.3s ease forwards`;
    setTimeout(() => { el.style.animation = ''; }, 300);
  },

  // ---- 基础动画 ----

  fadeIn(el, duration = 400, delay = 0) {
    if (!el) return;
    el.style.opacity = '0';
    el.style.animation = `fadeIn ${duration}ms ease forwards`;
    if (delay) el.style.animationDelay = `${delay}ms`;
    setTimeout(() => { el.style.opacity = ''; el.style.animation = ''; el.style.animationDelay = ''; }, duration + delay + 50);
  },

  fadeOut(el, duration = 300) {
    if (!el) return;
    el.style.animation = `fadeOut ${duration}ms ease forwards`;
    setTimeout(() => { el.style.animation = ''; }, duration + 50);
  },

  // 交错淡入
  staggerFadeIn(elements, staggerDelay = 50, duration = 400) {
    elements.forEach((el, i) => {
      if (!el) return;
      el.style.opacity = '0';
      el.style.animation = `fadeInUp ${duration}ms ease forwards`;
      el.style.animationDelay = `${i * staggerDelay}ms`;
      const total = i * staggerDelay + duration;
      setTimeout(() => {
        el.style.opacity = '';
        el.style.animation = '';
        el.style.animationDelay = '';
      }, total + 50);
    });
  },

  // ---- 特效动画 ----

  // 墨迹逐字揭示
  inkRevealText(el, text, duration = 800) {
    if (!el || !text) return;
    const chars = [...text];
    const perChar = Math.min(duration / chars.length, 40);

    el.textContent = '';
    el.style.opacity = '1';

    const span = document.createElement('span');
    span.style.display = 'inline';
    el.appendChild(span);

    chars.forEach((ch, i) => {
      setTimeout(() => {
        const charSpan = document.createElement('span');
        charSpan.textContent = ch;
        charSpan.style.cssText = `
          display: inline;
          animation: inkBloom 0.6s ease-out forwards;
          animation-delay: 0s;
        `;
        span.appendChild(charSpan);
      }, i * perChar);
    });
  },

  // 信封启封动画
  async envelopeUnseal(sealEl, flapEl, contentEl) {
    if (sealEl) {
      sealEl.style.animation = 'sealBreak 0.35s ease forwards';
      await this._wait(350);
    }
    if (flapEl) {
      flapEl.style.animation = 'flapLift 0.4s ease-in forwards';
      await this._wait(300);
    }
    if (contentEl) {
      contentEl.style.animation = 'letterSlideOut 0.35s ease-out forwards';
      await this._wait(350);
    }
  },

  // 尘埃粒子系统
  floatingDust(container, count = 20) {
    if (!container) return null;
    // 检查是否应减少动画
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const actualCount = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4 ? 8 : count;

    const dustEl = document.createElement('div');
    dustEl.className = 'dust-container';
    container.appendChild(dustEl);

    for (let i = 0; i < actualCount; i++) {
      const mote = document.createElement('div');
      mote.className = 'dust-mote';
      const size = 1 + Math.random() * 2.5;
      mote.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${Math.random() * 100}%;
        --mote-duration: ${8 + Math.random() * 18}s;
        --mote-delay: -${Math.random() * 15}s;
        --mote-drift: ${(Math.random() - 0.5) * 80}px;
        --mote-opacity: ${0.08 + Math.random() * 0.2};
      `;
      dustEl.appendChild(mote);
    }

    return dustEl; // 返回引用以便移除
  },

  // 移除尘埃粒子
  removeFloatingDust(dustEl) {
    if (dustEl && dustEl.parentNode) {
      dustEl.remove();
    }
  },

  // 卡片翻转
  async cardFlip(frontEl, backEl, duration = 400) {
    if (!frontEl || !backEl) return;
    frontEl.style.transition = `transform ${duration}ms ease, opacity ${duration/2}ms`;
    frontEl.style.transform = 'rotateY(90deg)';
    frontEl.style.opacity = '0';

    await this._wait(duration / 2);

    backEl.style.transition = `transform ${duration}ms ease, opacity ${duration/2}ms`;
    backEl.style.transform = 'rotateY(0deg)';
    backEl.style.opacity = '1';

    await this._wait(duration / 2);
  },

  // 呼吸脉冲
  breathe(el, period = 3000) {
    if (!el) return;
    el.style.animation = `breathe ${period}ms ease-in-out infinite`;
  },

  stopBreathe(el) {
    if (!el) return;
    el.style.animation = '';
  },

  // 星光爆发
  sparkle(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < 6; i++) {
      const spark = document.createElement('div');
      const angle = (Math.PI * 2 * i) / 6;
      const distance = 15 + Math.random() * 20;
      spark.style.cssText = `
        position: fixed;
        left: ${cx}px;
        top: ${cy}px;
        width: 4px; height: 4px;
        border-radius: 50%;
        background: var(--accent-bright, #e8a74c);
        pointer-events: none;
        z-index: 9999;
        animation: sparkle 0.7s ease-out forwards;
        animation-delay: ${i * 0.05}s;
        --sparkle-x: ${Math.cos(angle) * distance}px;
        --sparkle-y: ${Math.sin(angle) * distance}px;
      `;
      document.body.appendChild(spark);
      setTimeout(() => spark.remove(), 800);
    }
  },

  // 波纹点击反馈
  rippleAt(el, x, y) {
    if (!el) return;
    const ripple = document.createElement('div');
    const size = Math.max(el.offsetWidth, el.offsetHeight);
    ripple.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: rgba(196,133,42,0.15);
      transform: translate(-50%, -50%) scale(0);
      pointer-events: none;
      animation: ripple 0.6s ease-out forwards;
    `;
    el.style.position = el.style.position || 'relative';
    el.style.overflow = 'hidden';
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  },

  // ---- 工具 ----

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};
