// 此刻·此地 — Three.js AR 3D 场景管理器（Level 1 视觉增强版）
const ARThreeScene = {
  _renderer: null,
  _scene: null,
  _camera: null,
  _envelopes: [],
  _particles: null,
  _particleData: [],
  _glowRings: [],
  _raycaster: null,
  _clock: null,
  _animFrameId: null,
  _onEnvelopeClick: null,
  _wrapper: null,
  _fxOverlay: null,
  _fxCtx: null,

  // ── 初始化 ──
  init(container) {
    this._wrapper = container.querySelector('.camera-preview-wrapper');
    if (!this._wrapper) return false;

    try {
      var testCanvas = document.createElement('canvas');
      var gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) return false;
    } catch (e) { return false; }

    if (typeof THREE === 'undefined') return false;

    this._clock = new THREE.Clock();

    // ── 渲染器 ──
    this._renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(this._wrapper.clientWidth, this._wrapper.clientHeight);
    this._renderer.setClearColor(0x000000, 0);
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.2;
    this._renderer.domElement.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:auto;z-index:5;touch-action:manipulation;';
    this._renderer.domElement.classList.add('ar-three-canvas');
    this._wrapper.appendChild(this._renderer.domElement);

    // ── 场景 ──
    this._scene = new THREE.Scene();
    this._scene.fog = new THREE.FogExp2(0x000000, 0.00015);

    var aspect = this._wrapper.clientWidth / this._wrapper.clientHeight;
    this._camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 1000);
    this._camera.position.set(0, 0, 0);

    // ── 光照系统 ──
    var hemiLight = new THREE.HemisphereLight(0xffeedd, 0x3a2a1a, 0.6);
    this._scene.add(hemiLight);

    var keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(8, 12, 8);
    this._scene.add(keyLight);

    var fillLight = new THREE.DirectionalLight(0xffccaa, 0.5);
    fillLight.position.set(-4, 2, -4);
    this._scene.add(fillLight);

    // 封印高光点光源（动态跟随最近的信封）
    this._sealLight = new THREE.PointLight(0xd4a853, 0, 15);
    this._sealLight.position.set(0, 5, 0);
    this._scene.add(this._sealLight);

    // ── 射线检测 ──
    this._raycaster = new THREE.Raycaster();
    this._raycaster.far = 500;

    // ── 粒子系统 ──
    this._initTrailParticles();

    // ── 屏幕特效叠加层 ──
    this._initFXOverlay();

    this._bindClick();
    this._bindResize();

    return true;
  },

  // ── 屏幕空间特效叠加（CSS Canvas） ──
  _initFXOverlay() {
    var canvas = document.createElement('canvas');
    canvas.className = 'ar-fx-overlay';
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:6;';
    this._wrapper.appendChild(canvas);
    this._fxOverlay = canvas;
    this._fxCtx = canvas.getContext('2d');
  },

  _updateFXOverlay(dt) {
    var canvas = this._fxOverlay;
    if (!canvas || !this._fxCtx) return;
    var ctx = this._fxCtx;
    var w = this._wrapper.clientWidth;
    var h = this._wrapper.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);

    // ── 暗角 ──
    var vignetteGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75);
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, w, h);

    // ── 扫描线 ──
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (var y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    // ── 胶片噪点 ──
    var noiseAlpha = 0.025;
    var imageData = ctx.getImageData(0, 0, w, h);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      var noise = (Math.random() - 0.5) * 255 * noiseAlpha;
      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);

    // ── 全局Bloom辉光（模拟） ──
    if (this._envelopes.length > 0) {
      var bloomAlpha = 0.03 + Math.sin(performance.now() * 0.002) * 0.01;
      var bloomGrad = ctx.createRadialGradient(w / 2, h * 0.42, w * 0.05, w / 2, h * 0.42, w * 0.3);
      bloomGrad.addColorStop(0, 'rgba(212,168,83,' + bloomAlpha + ')');
      bloomGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bloomGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // ── 动态扫描线 ──
    var scanY = (performance.now() * 0.03) % h;
    ctx.fillStyle = 'rgba(212,168,83,0.03)';
    ctx.fillRect(0, scanY, w, 2);
  },

  // ── 信封颜色 ──
  _envelopeColor(type) {
    if (type === 'secret') return 0xe8d5c4;
    if (type === 'self_capsule') return 0xd4c5b0;
    return 0xfaf0e0;
  },
  _sealColor(type) {
    if (type === 'secret') return 0xcc3333;
    if (type === 'self_capsule') return 0xb8860b;
    return 0xc4852a;
  },

  // ── 创建信封Mesh（PBR材质 + 精细几何体） ──
  _createEnvelopeMesh(letter) {
    var group = new THREE.Group();

    // 信封主体 — RoundedBox（用ExtrudeGeometry做圆角）
    var shape = new THREE.Shape();
    var r = 0.04, bw = 0.5, bh = 0.3;
    shape.moveTo(-bw + r, -bh);
    shape.lineTo(bw - r, -bh);
    shape.quadraticCurveTo(bw, -bh, bw, -bh + r);
    shape.lineTo(bw, bh - r);
    shape.quadraticCurveTo(bw, bh, bw - r, bh);
    shape.lineTo(-bw + r, bh);
    shape.quadraticCurveTo(-bw, bh, -bw, bh - r);
    shape.lineTo(-bw, -bh + r);
    shape.quadraticCurveTo(-bw, -bh, -bw + r, -bh);

    var extrudeSettings = { steps: 1, depth: 0.04, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 3 };
    var bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    bodyGeo.translate(0, 0, -0.02);
    var envColor = this._envelopeColor(letter.type);
    var bodyMat = new THREE.MeshStandardMaterial({
      color: envColor,
      roughness: 0.65,
      metalness: 0.05,
      transparent: true,
      opacity: 0.9,
    });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    // 封口三角（ExtrudeGeometry做厚度）
    var flapShape = new THREE.Shape();
    flapShape.moveTo(0, 0.32);
    flapShape.lineTo(0.42, -0.16);
    flapShape.lineTo(-0.42, -0.16);
    flapShape.closePath();
    var flapGeo = new THREE.ExtrudeGeometry(flapShape, { steps: 1, depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2 });
    flapGeo.translate(0, 0, 0.005);
    var flapMat = new THREE.MeshStandardMaterial({
      color: envColor,
      roughness: 0.55,
      metalness: 0.08,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    var flap = new THREE.Mesh(flapGeo, flapMat);
    flap.position.set(0, -0.28, 0.022);
    flap.name = 'flap';
    group.add(flap);

    // 火漆印章（SphereGeometry + 圆环）
    var sealGeo = new THREE.SphereGeometry(0.07, 24, 16);
    sealGeo.scale(1, 1, 0.35);
    var sealColor = this._sealColor(letter.type);
    var sealMat = new THREE.MeshStandardMaterial({
      color: sealColor,
      roughness: 0.3,
      metalness: 0.6,
      emissive: sealColor,
      emissiveIntensity: 0.4,
    });
    var seal = new THREE.Mesh(sealGeo, sealMat);
    seal.position.set(0, -0.02, 0.030);
    seal.name = 'seal';
    group.add(seal);

    // 封印圆环
    var ringGeo = new THREE.TorusGeometry(0.08, 0.012, 12, 24);
    var ringMat = new THREE.MeshStandardMaterial({
      color: 0xd4a853,
      roughness: 0.25,
      metalness: 0.8,
      emissive: 0xd4a853,
      emissiveIntensity: 0.5,
    });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(seal.position);
    ring.rotation.x = Math.PI / 2;
    ring.name = 'sealRing';
    group.add(ring);

    // 信纸预览
    var paperGeo = new THREE.PlaneGeometry(0.8, 0.2);
    var paperMat = new THREE.MeshBasicMaterial({
      color: 0xfff8f0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    var paper = new THREE.Mesh(paperGeo, paperMat);
    paper.position.set(0, -0.52, 0.035);
    paper.name = 'paper';
    group.add(paper);

    // 光晕环（距离近时可见）
    var glowGeo = new THREE.TorusGeometry(0.38, 0.015, 16, 48);
    var glowMat = new THREE.MeshBasicMaterial({
      color: 0xd4a853,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    var glowRing = new THREE.Mesh(glowGeo, glowMat);
    glowRing.name = 'glowRing';
    group.add(glowRing);

    group.userData = {
      letterId: letter.id,
      letterType: letter.type,
      bodyMat: bodyMat,
      flapMat: flapMat,
      sealMat: sealMat,
      ringMat: ringMat,
      paperMat: paperMat,
      glowMat: glowMat,
      flap: flap,
      seal: seal,
      sealRing: ring,
      paper: paper,
      glowRing: glowRing,
      tier: 0,
      alignmentPercent: 0,
      distRatio: 0,
      isCentered: false,
    };

    return group;
  },

  // ── 放置信封 ──
  _placeEnvelope(group, cached, heading) {
    var diff = cached.bearing - heading;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    var radius = 10;
    var angleRad = (diff * Math.PI) / 180;
    var x = Math.sin(angleRad) * radius;
    var z = -Math.cos(angleRad) * radius;
    var y = 0.3 + (1 - cached.distRatio) * 3.5;

    group.position.set(x, y, z);
    group.lookAt(0, y, -radius * 2);

    var baseScale = 0.35 + cached.distRatio * 1.8;
    group.scale.setScalar(baseScale);

    var onScreen = Math.abs(diff) < 32.5;
    var edgeFade = onScreen ? 1 : Math.max(0, 1 - (Math.abs(diff) - 32.5) / 10);

    var ud = group.userData;
    ud.tier = cached.tier;
    ud.alignmentPercent = cached.alignmentPercent;
    ud.distRatio = cached.distRatio;
    ud.isCentered = cached.isCentered;

    ud.bodyMat.opacity = 0.25 + cached.distRatio * 0.65 * edgeFade;
    ud.flapMat.opacity = 0.2 + cached.distRatio * 0.72 * edgeFade;
    group.visible = edgeFade > 0.04 && cached.distRatio > 0.04;
  },

  // ── 更新信封列表 ──
  updateEnvelopes(letterCache, heading) {
    if (!this._scene) return;

    var currentIds = {};
    letterCache.forEach(function(c) { currentIds[c.letter.id] = true; });

    this._envelopes = this._envelopes.filter(function(env) {
      if (!currentIds[env.userData.letterId]) {
        this._scene.remove(env);
        this._disposeGroup(env);
        return false;
      }
      return true;
    }.bind(this));

    var existingIds = {};
    this._envelopes.forEach(function(e) { existingIds[e.userData.letterId] = true; });

    letterCache.forEach(function(cached) {
      if (existingIds[cached.letter.id]) {
        var env = null;
        for (var i = 0; i < this._envelopes.length; i++) {
          if (this._envelopes[i].userData.letterId === cached.letter.id) {
            env = this._envelopes[i];
            break;
          }
        }
        if (env) this._placeEnvelope(env, cached, heading);
      } else {
        var group = this._createEnvelopeMesh(cached.letter);
        this._placeEnvelope(group, cached, heading);
        this._scene.add(group);
        this._envelopes.push(group);
      }
    }.bind(this));
  },

  _disposeGroup(group) {
    group.traverse(function(child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(m) { m.dispose(); });
        } else {
          child.material.dispose();
        }
      }
    });
  },

  // ── 粒子拖尾系统 ──
  _initTrailParticles() {
    var count = 80;
    var positions = new Float32Array(count * 3);
    var colors = new Float32Array(count * 3);
    var sizes = new Float32Array(count);
    this._particleData = [];

    for (var i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = Math.random() * 5;
      positions[i * 3 + 2] = -(Math.random() * 12);
      colors[i * 3] = 0.9 + Math.random() * 0.1;
      colors[i * 3 + 1] = 0.6 + Math.random() * 0.2;
      colors[i * 3 + 2] = 0.2 + Math.random() * 0.15;
      sizes[i] = 1.5 + Math.random() * 2.5;
      this._particleData.push({
        orbitAngle: Math.random() * Math.PI * 2,
        orbitSpeed: 0.3 + Math.random() * 0.8,
        orbitRadius: 0.2 + Math.random() * 0.6,
        verticalPhase: Math.random() * Math.PI * 2,
        life: Math.random(),
        decay: 0.003 + Math.random() * 0.008,
      });
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    var mat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.55,
      map: this._createGlowTexture(),
    });
    this._particles = new THREE.Points(geo, mat);
    this._scene.add(this._particles);
  },

  _createGlowTexture() {
    var c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    var ctx = c.getContext('2d');
    var grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,220,150,0.8)');
    grad.addColorStop(0.5, 'rgba(212,168,83,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  },

  _updateParticles(dt, time) {
    if (!this._particles) return;
    var pos = this._particles.geometry.attributes.position;
    var count = pos.count;

    // 粒子围绕最近的信封旋转
    var centerX = 0, centerY = 1.5, centerZ = -10;
    if (this._envelopes.length > 0) {
      var nearest = this._envelopes[0];
      var minD = 999;
      this._envelopes.forEach(function(e) {
        if (e.userData.distRatio > 0.1 && e.userData.distRatio < minD) {
          minD = e.userData.distRatio;
          nearest = e;
        }
      });
      centerX = nearest.position.x;
      centerY = nearest.position.y;
      centerZ = nearest.position.z;
    }

    for (var i = 0; i < count; i++) {
      var pd = this._particleData[i];
      pd.life += pd.decay;
      if (pd.life > 1) { pd.life = 0; pd.orbitAngle = Math.random() * Math.PI * 2; }

      pd.orbitAngle += pd.orbitSpeed * dt;
      var px = centerX + Math.cos(pd.orbitAngle) * pd.orbitRadius;
      var py = centerY + Math.sin(pd.verticalPhase + time * 1.5) * pd.orbitRadius * 0.6;
      var pz = centerZ + Math.sin(pd.orbitAngle) * pd.orbitRadius;

      pos.array[i * 3] = px;
      pos.array[i * 3 + 1] = py + pd.life * 1.5;
      pos.array[i * 3 + 2] = pz;
    }
    pos.needsUpdate = true;

    // 粒子透明度随信封数量变化
    var targetOpacity = this._envelopes.length > 0 ? 0.55 : 0.15;
    this._particles.material.opacity += (targetOpacity - this._particles.material.opacity) * dt * 2;
  },

  // ── 信封动画 ──
  _animateEnvelopes(dt) {
    if (!this._envelopes.length) return;
    var time = this._clock ? this._clock.getElapsedTime() : performance.now() / 1000;
    var nearestSeal = null, nearestDist = 999;

    this._envelopes.forEach(function(group, i) {
      var ud = group.userData;
      if (!ud || !ud.letterId) return;
      var hash = 0;
      for (var k = 0; k < ud.letterId.length; k++) {
        hash = (hash * 31 + ud.letterId.charCodeAt(k)) & 0x7fffffff;
      }

      // 有机漂浮（多重正弦叠加）
      var float1 = Math.sin(time * 0.7 + hash) * 0.04;
      var float2 = Math.cos(time * 1.1 + hash * 0.3) * 0.03;
      var float3 = Math.sin(time * 0.5 + hash * 0.7) * 0.02;
      group.position.y += (float1 + float2 + float3) * dt * 3;
      group.position.x += Math.cos(time * 0.6 + hash * 0.5) * 0.015 * dt * 3;

      // 缓慢自转
      var rotSpeed = 0.25 + (hash % 13) * 0.06;
      group.rotation.y += Math.sin(time * rotSpeed + hash * 0.1) * 0.006 * dt * 3;
      group.rotation.z += Math.cos(time * rotSpeed * 0.7 + hash) * 0.003 * dt * 3;

      var isTier4 = ud.tier >= 4;
      var isTier3 = ud.tier >= 3;

      // ── Tier 4: 解锁状态 ──
      if (isTier4) {
        var pulse = 1 + Math.sin(time * 3.5 + hash) * 0.12;
        var baseS = 0.35 + ud.distRatio * 1.8;
        group.scale.setScalar(baseS * pulse);
        ud.sealMat.emissiveIntensity = 0.6 + Math.sin(time * 3.5 + hash) * 0.3;
        ud.sealMat.roughness = 0.15;
        ud.bodyMat.emissive = new THREE.Color(0xffd700);
        ud.bodyMat.emissiveIntensity = 0.2 + Math.sin(time * 3 + hash) * 0.1;
        ud.glowMat.opacity = 0.3 + Math.sin(time * 3 + hash) * 0.15;
        ud.bodyMat.opacity = 0.95;

        // 追踪最近的解锁信封用于封印光
        if (ud.distRatio < nearestDist) {
          nearestDist = ud.distRatio;
          nearestSeal = group;
        }
      } else {
        ud.sealMat.emissiveIntensity = 0.4;
        ud.sealMat.roughness = 0.3;
        ud.bodyMat.emissive = new THREE.Color(0x000000);
        ud.bodyMat.emissiveIntensity = 0;
        ud.glowMat.opacity = 0;
      }

      // ── Tier 3+: 封口微开 + 信纸可见 ──
      if (ud.flap && isTier3) {
        ud.flap.rotation.x = -0.25 + Math.sin(time * 1.5 + hash) * 0.06;
      } else if (ud.flap) {
        ud.flap.rotation.x += (0 - ud.flap.rotation.x) * dt * 3;
      }
      if (ud.paperMat) {
        var tp = isTier3 ? 0.85 : 0;
        ud.paperMat.opacity += (tp - ud.paperMat.opacity) * dt * 4;
      }

      // ── 封印环旋转 + 居中放大 ──
      if (ud.sealRing) {
        ud.sealRing.rotation.z += dt * 0.8;
        var ringScale = ud.isCentered && isTier3 ? 1.3 : 0.95;
        ud.sealRing.scale.lerp(
          new THREE.Vector3(ringScale, ringScale, ringScale), dt * 3
        );
        ud.ringMat.emissiveIntensity = isTier4 ? 0.7 + Math.sin(time * 2.5) * 0.3 : 0.4;
      }

      // ── 光晕环脉冲 ──
      if (ud.glowRing && isTier4) {
        ud.glowRing.rotation.z += dt * 0.5;
        ud.glowRing.rotation.x += dt * 0.3;
        ud.glowRing.scale.setScalar(1 + Math.sin(time * 3 + hash) * 0.2);
      }
    });

    // 封印点光源跟随最近的信封
    if (nearestSeal && this._sealLight) {
      var targetIntensity = 0.6;
      this._sealLight.intensity += (targetIntensity - this._sealLight.intensity) * dt * 3;
      this._sealLight.position.lerp(nearestSeal.position, dt * 2);
    } else if (this._sealLight) {
      this._sealLight.intensity += (0 - this._sealLight.intensity) * dt * 3;
    }
  },

  // ── 渲染循环 ──
  startLoop() {
    if (this._animFrameId) return;
    var self = this;
    function loop() {
      self._animFrameId = requestAnimationFrame(loop);
      var dt = Math.min(self._clock.getDelta(), 0.1);
      var time = self._clock.getElapsedTime();

      self._animateEnvelopes(dt);
      self._updateParticles(dt, time);
      self._updateFXOverlay(dt);

      if (self._renderer && self._scene && self._camera) {
        self._renderer.render(self._scene, self._camera);
      }
    }
    loop();
  },

  stopLoop() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
  },

  // ── 点击检测 ──
  _bindClick() {
    if (!this._renderer) return;
    var self = this;
    var canvas = this._renderer.domElement;
    canvas.addEventListener('click', function(e) {
      if (!self._raycaster || !self._camera || !self._envelopes.length) return;
      var rect = canvas.getBoundingClientRect();
      var mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      self._raycaster.setFromCamera(mouse, self._camera);
      var targets = self._envelopes.filter(function(env) { return env.visible !== false; });
      var intersects = self._raycaster.intersectObjects(targets, true);
      if (intersects.length > 0) {
        var obj = intersects[0].object;
        while (obj && !(obj.userData && obj.userData.letterId)) {
          obj = obj.parent;
        }
        if (obj && obj.userData && obj.userData.letterId && self._onEnvelopeClick) {
          self._onEnvelopeClick(obj.userData.letterId);
        }
      }
    });
  },

  _bindResize() {
    this._resizeHandler = function() {
      if (!this._renderer || !this._camera || !this._wrapper) return;
      this._renderer.setSize(this._wrapper.clientWidth, this._wrapper.clientHeight);
      this._camera.aspect = this._wrapper.clientWidth / this._wrapper.clientHeight;
      this._camera.updateProjectionMatrix();
    }.bind(this);
    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('orientationchange', this._resizeHandler);
  },

  setClickHandler(fn) {
    this._onEnvelopeClick = fn;
  },

  // ── 销毁 ──
  destroy() {
    this.stopLoop();
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      window.removeEventListener('orientationchange', this._resizeHandler);
      this._resizeHandler = null;
    }
    this._envelopes.forEach(function(env) {
      this._scene.remove(env);
      this._disposeGroup(env);
    }.bind(this));
    this._envelopes = [];
    if (this._particles) {
      this._scene.remove(this._particles);
      this._particles.geometry.dispose();
      this._particles.material.dispose();
      this._particles = null;
    }
    if (this._sealLight) {
      this._scene.remove(this._sealLight);
      this._sealLight = null;
    }
    if (this._fxOverlay) {
      this._fxOverlay.remove();
      this._fxOverlay = null;
      this._fxCtx = null;
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
    this._wrapper = null;
  },
};
