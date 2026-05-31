# Three.js AR 信封系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Three.js WebGL 3D 渲染替换当前 CSS div 叠加的 AR 信封系统，实现 Pokémon GO 级别的沉浸式 AR 体验。

**Architecture:** 新增 `ar-three-scene.js` 封装 Three.js 场景；修改 `camera-view.js` 调用 Three.js 渲染管线（保留 CSS 降级路径）；在 `index.html` 添加 Three.js CDN 脚本。3D 信封模型由 BoxGeometry + ShapeGeometry 搭建，使用 Raycaster 处理点击交互。

**Tech Stack:** Three.js v0.160 (CDN global `THREE`), vanilla JS, WebGL, DeviceOrientation API

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/js/fx/ar-three-scene.js` (新建) | Three.js 场景初始化、信封 3D 模型创建、渲染循环、Raycaster 交互 |
| `src/js/ui/camera-view.js` (修改) | 调用 ARThreeScene 替代 CSS div 渲染；保留 CSS 降级逻辑 |
| `src/index.html` (修改) | 添加 Three.js CDN `<script>` 和 `ar-three-scene.js` `<script>` |
| `src/css/main.css` (修改) | 添加 Three.js canvas 样式 |

---

### Task 1: 添加 Three.js 依赖和文件引用

**Files:**
- Modify: `src/index.html`
- Create: `src/js/fx/ar-three-scene.js` (空骨架)

- [ ] **Step 1: 在 index.html 中添加 Three.js CDN 和 ar-three-scene.js**

在 `src/index.html` 的 `<script>` 区域，在 `animation-engine.js` 之后、`home-view.js` 之前添加：

```html
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js" defer></script>
<script src="./js/fx/ar-three-scene.js" defer></script>
```

同时修改 `animation-engine.js` 的引用路径确认无误（它原本就在 fx 目录下）。

- [ ] **Step 2: 创建 ar-three-scene.js 空骨架**

```javascript
// 此刻·此地 — Three.js AR 3D 场景管理器
const ARThreeScene = {
  _renderer: null,
  _scene: null,
  _camera: null,
  _envelopes: [],
  _raycaster: null,
  _clock: null,
  _animFrameId: null,

  init(container) {
    // 占位，后续任务实现
  },

  updateEnvelopes(letterCache, heading, pos) {
    // 占位，后续任务实现
  },

  render() {
    // 占位，后续任务实现
  },

  destroy() {
    // 占位，后续任务实现
  },
};
```

- [ ] **Step 3: 验证 Three.js 加载**

```bash
# 启动服务器
cd E:/桌面/letter/letter-delivery
# 确认 nginx 运行，访问 https://127.0.0.1:3457/
# 打开浏览器控制台，输入 typeof THREE 应返回 'object'
```

- [ ] **Step 4: Commit**

```bash
git add src/index.html src/js/fx/ar-three-scene.js
git commit -m "feat: add Three.js CDN dependency and AR scene skeleton"
```

---

### Task 2: Three.js 场景初始化（渲染器、相机、光照）

**Files:**
- Modify: `src/js/fx/ar-three-scene.js`

- [ ] **Step 1: 实现 init() 方法**

```javascript
init(container) {
  const wrapper = container.querySelector('.camera-preview-wrapper');
  if (!wrapper) return false;

  // 检查 WebGL 支持
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (!gl) return false;
  } catch (e) { return false; }

  this._clock = new THREE.Clock();

  // 渲染器：透明背景，叠加在视频上
  this._renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  this._renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
  this._renderer.setClearColor(0x000000, 0);
  this._renderer.domElement.style.position = 'absolute';
  this._renderer.domElement.style.top = '0';
  this._renderer.domElement.style.left = '0';
  this._renderer.domElement.style.width = '100%';
  this._renderer.domElement.style.height = '100%';
  this._renderer.domElement.style.pointerEvents = 'auto';
  this._renderer.domElement.style.zIndex = '5';
  this._renderer.domElement.classList.add('ar-three-canvas');
  wrapper.appendChild(this._renderer.domElement);

  // 场景
  this._scene = new THREE.Scene();

  // 相机：FOV 与手机摄像头相近 (~65°)
  const aspect = wrapper.clientWidth / wrapper.clientHeight;
  this._camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 1000);
  this._camera.position.set(0, 0, 0);

  // 光照
  const ambient = new THREE.AmbientLight(0xffeedd, 0.6);
  this._scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(5, 10, 5);
  this._scene.add(directional);

  // Raycaster（交互）
  this._raycaster = new THREE.Raycaster();
  this._raycaster.far = 500;

  // 点击事件绑定
  this._bindClick();

  return true;
},
```

- [ ] **Step 2: 实现窗口大小响应**

```javascript
_handleResize(wrapper) {
  if (!this._renderer || !this._camera) return;
  this._renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
  this._camera.aspect = wrapper.clientWidth / wrapper.clientHeight;
  this._camera.updateProjectionMatrix();
},
```

- [ ] **Step 3: 验证场景渲染**

在浏览器控制台中执行：
```javascript
// 场景应渲染为透明背景，可以看到下面的视频
// 检查 canvas.ar-three-canvas 是否在 DOM 中
```

- [ ] **Step 4: Commit**

```bash
git add src/js/fx/ar-three-scene.js
git commit -m "feat: Three.js scene init with renderer, camera, lighting"
```

---

### Task 3: 3D 信封模型创建

**Files:**
- Modify: `src/js/fx/ar-three-scene.js`

- [ ] **Step 1: 实现信封模型构建函数**

```javascript
_createEnvelopeMesh(letter) {
  const group = new THREE.Group();

  // 信封身体 (扁平矩形)
  const bodyGeo = new THREE.BoxGeometry(1.0, 0.6, 0.04);
  const bodyMat = new THREE.MeshPhongMaterial({
    color: this._envelopeColor(letter.type),
    specular: 0x111111,
    shininess: 10,
    transparent: true,
    opacity: 0.85,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  // 封口三角 (下方折翼)
  const flapShape = new THREE.Shape();
  flapShape.moveTo(0, 0);
  flapShape.lineTo(0.5, 0.35);
  flapShape.lineTo(-0.5, 0.35);
  flapShape.closePath();
  const flapGeo = new THREE.ShapeGeometry(flapShape);
  const flapMat = new THREE.MeshPhongMaterial({
    color: this._envelopeColor(letter.type),
    specular: 0x111111,
    shininess: 8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const flap = new THREE.Mesh(flapGeo, flapMat);
  flap.position.set(0, -0.3, 0.021);
  flap.rotation.x = 0;
  flap.name = 'flap';
  group.add(flap);

  // 火漆印章 (小圆片)
  const sealGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.01, 16);
  const sealColor = letter.type === 'secret' ? 0xcc3333 : letter.type === 'self_capsule' ? 0xd4a853 : 0xc4852a;
  const sealMat = new THREE.MeshPhongMaterial({
    color: sealColor,
    emissive: sealColor,
    emissiveIntensity: 0.3,
    specular: 0xffffff,
    shininess: 60,
  });
  const seal = new THREE.Mesh(sealGeo, sealMat);
  seal.position.set(0, -0.02, 0.026);
  seal.name = 'seal';
  group.add(seal);

  // 存储材质引用供后续动画使用
  group.userData = {
    letterId: letter.id,
    letterType: letter.type,
    bodyMat: bodyMat,
    flapMat: flapMat,
    sealMat: sealMat,
    flap: flap,
    seal: seal,
  };

  return group;
},

_envelopeColor(type) {
  if (type === 'secret') return 0xe8d5c4;
  if (type === 'self_capsule') return 0xd4c5b0;
  return 0xf5e6d3; // public — 暖米色
},
```

- [ ] **Step 2: 实现信封放置函数（GPS坐标 → 3D世界坐标）**

```javascript
_placeEnvelope(group, cached, heading) {
  // bearing 差 → X 轴旋转
  let diff = cached.bearing - heading;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;

  // 圆柱面投影
  const radius = 10; // 基准半径
  const angleRad = (diff * Math.PI) / 180;
  const x = Math.sin(angleRad) * radius;
  const z = -Math.cos(angleRad) * radius;
  const y = 0.5 + (1 - cached.distRatio) * 2.5; // 远处飘更高

  group.position.set(x, y, z);
  group.lookAt(0, y, -radius * 2); // 面向用户

  // 距离缩放
  const scale = 0.4 + cached.distRatio * 1.6;
  group.scale.setScalar(scale);

  // 透明度
  const onScreen = Math.abs(diff) < 32.5;
  const edgeFade = onScreen ? 1 : Math.max(0, 1 - (Math.abs(diff) - 32.5) / 10);
  group.userData.bodyMat.opacity = 0.2 + cached.distRatio * 0.65 * edgeFade;
  group.visible = edgeFade > 0.05;
},
```

- [ ] **Step 3: Commit**

```bash
git add src/js/fx/ar-three-scene.js
git commit -m "feat: 3D envelope mesh creation and GPS-to-world positioning"
```

---

### Task 4: updateEnvelopes — 数据驱动的信封更新

**Files:**
- Modify: `src/js/fx/ar-three-scene.js`

- [ ] **Step 1: 实现 updateEnvelopes()**

```javascript
updateEnvelopes(letterCache, heading, pos) {
  if (!this._scene) return;

  const currentIds = new Set(letterCache.map(c => c.letter.id));

  // 移除不存在的信封
  this._envelopes = this._envelopes.filter(env => {
    if (!currentIds.has(env.userData.letterId)) {
      this._scene.remove(env);
      if (env.userData.bodyMat) env.userData.bodyMat.dispose();
      if (env.userData.flapMat) env.userData.flapMat.dispose();
      if (env.userData.sealMat) env.userData.sealMat.dispose();
      return false;
    }
    return true;
  });

  // 更新或创建信封
  const existingIds = new Set(this._envelopes.map(e => e.userData.letterId));
  letterCache.forEach(cached => {
    if (existingIds.has(cached.letter.id)) {
      // 更新位置
      const env = this._envelopes.find(e => e.userData.letterId === cached.letter.id);
      if (env) this._placeEnvelope(env, cached, heading);
    } else {
      // 创建新信封
      const group = this._createEnvelopeMesh(cached.letter);
      this._placeEnvelope(group, cached, heading);
      this._scene.add(group);
      this._envelopes.push(group);
    }
  });
},
```

- [ ] **Step 2: Commit**

```bash
git add src/js/fx/ar-three-scene.js
git commit -m "feat: updateEnvelopes — sync scene with live letter cache"
```

---

### Task 5: 动画系统（漂浮、旋转、脉冲）

**Files:**
- Modify: `src/js/fx/ar-three-scene.js`

- [ ] **Step 1: 实现动画更新循环**

```javascript
_animateEnvelopes(dt) {
  if (!this._envelopes.length) return;
  const time = this._clock ? this._clock.getElapsedTime() : performance.now() / 1000;

  this._envelopes.forEach((group, i) => {
    const ud = group.userData;
    const hash = ud.letterId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    // 漂浮晃动
    const floatSpeed = 0.8 + (hash % 7) * 0.15;
    const floatAmp = 0.05 + (hash % 5) * 0.02;
    group.position.y += Math.sin(time * floatSpeed + hash) * floatAmp * dt * 3;

    // 缓慢自转（绕 Y 轴）
    const rotSpeed = 0.3 + (hash % 11) * 0.08;
    group.rotation.y += Math.sin(time * rotSpeed + hash * 0.1) * 0.01 * dt * 3;

    // 对齐脉冲 (tier 4)
    if (ud.alignmentPercent >= CONFIG.FEATURE.ALIGNMENT_THRESHOLD * 100) {
      const pulse = 1 + Math.sin(time * 3 + hash) * 0.08;
      group.scale.multiplyScalar(pulse / group.scale.x * (0.4 + ud.distRatio * 1.6));
    }

    // 封口动画 (tier 3 时微开)
    if (ud.flap && ud.tier >= 3) {
      ud.flap.rotation.x = -0.2 + Math.sin(time * 1.5 + hash) * 0.05;
    }
  });
},
```

- [ ] **Step 2: 实现粒子特效**

```javascript
_initParticles() {
  const count = 40;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = Math.random() * 6;
    positions[i * 3 + 2] = -(Math.random() * 15);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffd700,
    size: 0.06,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  this._particles = new THREE.Points(geo, mat);
  this._scene.add(this._particles);
},

_updateParticles(dt) {
  if (!this._particles) return;
  const pos = this._particles.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.array[i * 3 + 1] += Math.sin(Date.now() * 0.001 + i) * 0.003;
    if (pos.array[i * 3 + 1] > 6) pos.array[i * 3 + 1] = 0;
    if (pos.array[i * 3 + 1] < 0) pos.array[i * 3 + 1] = 6;
  }
  pos.needsUpdate = true;
},
```

- [ ] **Step 3: Commit**

```bash
git add src/js/fx/ar-three-scene.js
git commit -m "feat: envelope animation loop — float, rotate, pulse, particles"
```

---

### Task 6: 渲染循环与 Raycaster 交互

**Files:**
- Modify: `src/js/fx/ar-three-scene.js`

- [ ] **Step 1: 实现主渲染循环和点击处理**

```javascript
startLoop() {
  if (this._animFrameId) return;
  const loop = () => {
    this._animFrameId = requestAnimationFrame(loop);
    const dt = Math.min(this._clock.getDelta(), 0.1);
    this._animateEnvelopes(dt);
    this._updateParticles(dt);
    if (this._renderer && this._scene && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
  };
  loop();
},

stopLoop() {
  if (this._animFrameId) {
    cancelAnimationFrame(this._animFrameId);
    this._animFrameId = null;
  }
},

_bindClick() {
  if (!this._renderer) return;
  const canvas = this._renderer.domElement;
  canvas.addEventListener('click', (e) => {
    if (!this._raycaster || !this._camera || !this._envelopes.length) return;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this._raycaster.setFromCamera(mouse, this._camera);
    const targets = this._envelopes.filter(env => env.visible !== false);
    const intersects = this._raycaster.intersectObjects(targets, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData.letterId) obj = obj.parent;
      if (obj && obj.userData.letterId && this._onEnvelopeClick) {
        this._onEnvelopeClick(obj.userData.letterId);
      }
    }
  });
},

setClickHandler(fn) {
  this._onEnvelopeClick = fn;
},
```

- [ ] **Step 2: 实现 destroy() 清理**

```javascript
destroy() {
  this.stopLoop();
  this._envelopes.forEach(env => {
    this._scene.remove(env);
    if (env.userData.bodyMat) env.userData.bodyMat.dispose();
    if (env.userData.flapMat) env.userData.flapMat.dispose();
    if (env.userData.sealMat) env.userData.sealMat.dispose();
  });
  this._envelopes = [];
  if (this._particles) {
    this._scene.remove(this._particles);
    this._particles.geometry.dispose();
    this._particles.material.dispose();
    this._particles = null;
  }
  if (this._renderer) {
    this._renderer.domElement.remove();
    this._renderer.dispose();
    this._renderer = null;
  }
  this._scene = null;
  this._camera = null;
  this._raycaster = null;
  this._clock = null;
},
```

- [ ] **Step 3: Commit**

```bash
git add src/js/fx/ar-three-scene.js
git commit -m "feat: render loop, raycaster click handling, and cleanup"
```

---

### Task 7: 集成到 camera-view.js

**Files:**
- Modify: `src/js/ui/camera-view.js`

- [ ] **Step 1: 添加 AR 模式检测和初始化**

在 `camera-view.js` 文件顶部（`const CameraView = {` 内部开头）添加：

```javascript
_useThreeJS: false,
_arScene: null,
```

在 `_startCamera()` 成功后（`.then` 或 `await` 之后），添加 Three.js 初始化：

```javascript
// 尝试初始化 Three.js AR
if (typeof ARThreeScene !== 'undefined' && ARThreeScene.init) {
  const success = ARThreeScene.init(this._container);
  if (success) {
    this._useThreeJS = true;
    ARThreeScene.setClickHandler((letterId) => {
      this._handleEnvelopeClick(letterId);
    });
    ARThreeScene.startLoop();
  }
}
```

- [ ] **Step 2: 修改 _renderFrame 调用 Three.js**

在 `_renderFrame()` 开头添加分支：

```javascript
_renderFrame() {
  const pos = LocationService.getCurrent();
  if (!pos) return;

  /* --- 新增：Three.js 渲染路径 --- */
  if (this._useThreeJS && ARThreeScene && this._letterCache.length > 0) {
    const heading = this._getHeading();
    ARThreeScene.updateEnvelopes(this._letterCache, heading, pos);
    const noHint = document.getElementById('camera-no-letter-hint');
    if (noHint) noHint.style.display = 'none';
    const bar = document.getElementById('camera-alignment-bar');
    // 对齐条更新
    if (this._bestLetter && this._currentAlignment > 0) {
      this._updateAlignmentUI(this._currentAlignment);
      if (bar) bar.style.display = 'block';
    } else if (this._targetLetter && this._targetLetter.photo.hasAlignment) {
      if (bar) bar.style.display = 'block';
    } else {
      if (bar) bar.style.display = 'none';
    }
    const radar = document.getElementById('camera-radar');
    if (radar) radar.innerHTML = '';
    return;
  }
  /* --- 新增结束 --- */

  // ... 原有 CSS AR 渲染代码不变 ...
```

- [ ] **Step 3: 添加 _handleEnvelopeClick 方法**

```javascript
_handleEnvelopeClick(letterId) {
  const cached = this._letterCache.find(c => c.letter.id === letterId);
  if (!cached) return;
  const letter = cached.letter;

  if (letter.type === 'self_capsule' && letter.capsule && Date.now() < letter.capsule.unlockAt) {
    const remaining = Math.round((letter.capsule.unlockAt - Date.now()) / 86400000);
    this._showCapsuleLockedHint(letter, remaining);
    return;
  }
  if (letter.type === 'secret') {
    this._showSecretModal(letter);
    return;
  }
  if (letter.photo.hasAlignment && cached.alignmentPercent < CONFIG.FEATURE.ALIGNMENT_THRESHOLD * 100) {
    this._targetLetter = letter;
    return;
  }
  this._openLetter(letter);
},
```

- [ ] **Step 4: 修改 _stopCamera 清理 ARThreeScene**

在 `_stopCamera()` 末尾添加：

```javascript
if (this._useThreeJS && typeof ARThreeScene !== 'undefined') {
  ARThreeScene.destroy();
  this._useThreeJS = false;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/js/ui/camera-view.js
git commit -m "feat: integrate Three.js AR into camera view with CSS fallback"
```

---

### Task 8: CSS 调整

**Files:**
- Modify: `src/css/main.css`

- [ ] **Step 1: 添加 Three.js canvas 样式**

在 `main.css` 的 `.camera-ar-layer` 附近添加：

```css
/* Three.js AR canvas overlay */
.ar-three-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
  pointer-events: auto;
  touch-action: manipulation;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/css/main.css
git commit -m "style: add Three.js canvas overlay CSS"
```

---

### Task 9: 端到端测试与调试

**Files:** (验证所有文件正确集成)

- [ ] **Step 1: 启动服务并测试桌面端**

```bash
# 确认 nginx 和 node 服务运行
# 浏览器打开 https://127.0.0.1:3457/
# 进入相机视图
# 按 ← → 键旋转朝向，确认 3D 信封可见
# 点击信封确认交互正常
# 检查控制台无报错
```

- [ ] **Step 2: 测试移动端**

在手机浏览器打开 `https://<局域网IP>:3457/`：
- 授予摄像头权限
- 授予方向传感器权限（iOS）
- 确认信封随手机旋转而移动
- 确认信封有漂浮动画
- 确认粒子特效可见
- 确认点击信封能打开

- [ ] **Step 3: 测试降级路径**

```bash
# 在浏览器控制台执行以下代码模拟 Three.js 不可用：
# delete window.THREE
# 重新进入相机视图，应回退到 CSS AR 模式
```

- [ ] **Step 4: Commit（如有修复）**

```bash
git add src/js/fx/ar-three-scene.js src/js/ui/camera-view.js
git commit -m "fix: Three.js AR integration fixes from testing"
```

---

## 自审清单

1. **Spec覆盖**: ✅ 每个设计需求都有对应Task（场景初始化→Task2，信封模型→Task3，空间定位→Task3 Step2，动画→Task5，交互→Task6，降级→Task7）
2. **无占位符**: ✅ 所有代码均为完整实现，无TBD/TODO
3. **类型一致性**: ✅ `updateEnvelopes(letterCache, heading, pos)` 签名在 Task4 定义、Task7 调用一致；`setClickHandler(fn)` 在 Task6 定义、Task7 调用一致
