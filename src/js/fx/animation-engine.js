// 此刻·此地 — 动效工具库
const AnimationEngine = {
  // ---- 页面过渡 ----

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

  // ---- 尘埃粒子系统 ----
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

    return dustEl;
  },

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};
