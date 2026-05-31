// 此刻·此地 — Three.js AR 3D 场景管理器
const ARThreeScene = {
  _renderer: null,
  _scene: null,
  _camera: null,
  _envelopes: [],
  _particles: null,
  _raycaster: null,
  _clock: null,
  _animFrameId: null,
  _onEnvelopeClick: null,
  _wrapper: null,

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

    this._renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(this._wrapper.clientWidth, this._wrapper.clientHeight);
    this._renderer.setClearColor(0x000000, 0);
    this._renderer.domElement.style.position = 'absolute';
    this._renderer.domElement.style.top = '0';
    this._renderer.domElement.style.left = '0';
    this._renderer.domElement.style.width = '100%';
    this._renderer.domElement.style.height = '100%';
    this._renderer.domElement.style.pointerEvents = 'auto';
    this._renderer.domElement.style.zIndex = '5';
    this._renderer.domElement.style.touchAction = 'manipulation';
    this._renderer.domElement.classList.add('ar-three-canvas');
    this._wrapper.appendChild(this._renderer.domElement);

    this._scene = new THREE.Scene();

    var aspect = this._wrapper.clientWidth / this._wrapper.clientHeight;
    this._camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 1000);
    this._camera.position.set(0, 0, 0);

    var ambient = new THREE.AmbientLight(0xffeedd, 0.7);
    this._scene.add(ambient);
    var directional = new THREE.DirectionalLight(0xffffff, 0.9);
    directional.position.set(5, 10, 5);
    this._scene.add(directional);
    var backLight = new THREE.DirectionalLight(0xffccaa, 0.4);
    backLight.position.set(-3, -1, -3);
    this._scene.add(backLight);

    this._raycaster = new THREE.Raycaster();
    this._raycaster.far = 500;

    this._initParticles();
    this._bindClick();
    this._bindResize();

    return true;
  },

  _bindResize() {
    this._resizeHandler = () => {
      if (!this._renderer || !this._camera || !this._wrapper) return;
      this._renderer.setSize(this._wrapper.clientWidth, this._wrapper.clientHeight);
      this._camera.aspect = this._wrapper.clientWidth / this._wrapper.clientHeight;
      this._camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('orientationchange', this._resizeHandler);
  },

  _envelopeColor(type) {
    if (type === 'secret') return 0xe8d5c4;
    if (type === 'self_capsule') return 0xd4c5b0;
    return 0xf5e6d3;
  },

  _sealColor(type) {
    if (type === 'secret') return 0xcc3333;
    if (type === 'self_capsule') return 0xd4a853;
    return 0xc4852a;
  },

  _createEnvelopeMesh(letter) {
    var group = new THREE.Group();

    var bodyGeo = new THREE.BoxGeometry(1.0, 0.6, 0.04);
    var bodyMat = new THREE.MeshPhongMaterial({
      color: this._envelopeColor(letter.type),
      specular: 0x111111,
      shininess: 10,
      transparent: true,
      opacity: 0.85,
    });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // 封口三角
    var flapShape = new THREE.Shape();
    flapShape.moveTo(0, 0);
    flapShape.lineTo(0.5, 0.35);
    flapShape.lineTo(-0.5, 0.35);
    flapShape.closePath();
    var flapGeo = new THREE.ShapeGeometry(flapShape);
    var flapMat = new THREE.MeshPhongMaterial({
      color: this._envelopeColor(letter.type),
      specular: 0x111111,
      shininess: 8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    var flap = new THREE.Mesh(flapGeo, flapMat);
    flap.position.set(0, -0.3, 0.021);
    flap.name = 'flap';
    group.add(flap);

    // 火漆印章
    var sealGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.01, 16);
    var sealColor = this._sealColor(letter.type);
    var sealMat = new THREE.MeshPhongMaterial({
      color: sealColor,
      emissive: sealColor,
      emissiveIntensity: 0.3,
      specular: 0xffffff,
      shininess: 60,
    });
    var seal = new THREE.Mesh(sealGeo, sealMat);
    seal.position.set(0, -0.02, 0.026);
    seal.name = 'seal';
    group.add(seal);

    // 信纸预览（tier 3+）
    var paperGeo = new THREE.PlaneGeometry(0.85, 0.22);
    var paperMat = new THREE.MeshBasicMaterial({
      color: 0xfff8f0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    var paper = new THREE.Mesh(paperGeo, paperMat);
    paper.position.set(0, -0.5, 0.03);
    paper.name = 'paper';
    group.add(paper);

    group.userData = {
      letterId: letter.id,
      letterType: letter.type,
      bodyMat: bodyMat,
      flapMat: flapMat,
      sealMat: sealMat,
      paperMat: paperMat,
      flap: flap,
      seal: seal,
      paper: paper,
      tier: 0,
      alignmentPercent: 0,
      distRatio: 0,
      isCentered: false,
    };

    return group;
  },

  _placeEnvelope(group, cached, heading) {
    var diff = cached.bearing - heading;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    var radius = 10;
    var angleRad = (diff * Math.PI) / 180;
    var x = Math.sin(angleRad) * radius;
    var z = -Math.cos(angleRad) * radius;
    var y = 0.3 + (1 - cached.distRatio) * 3.0;

    group.position.set(x, y, z);
    group.lookAt(0, y, -radius * 2);

    var baseScale = 0.4 + cached.distRatio * 1.6;
    group.scale.setScalar(baseScale);

    var onScreen = Math.abs(diff) < 32.5;
    var edgeFade = onScreen ? 1 : Math.max(0, 1 - (Math.abs(diff) - 32.5) / 10);

    group.userData.bodyMat.opacity = 0.2 + cached.distRatio * 0.65 * edgeFade;
    group.userData.flapMat.opacity = 0.18 + cached.distRatio * 0.72 * edgeFade;
    group.userData.tier = cached.tier;
    group.userData.alignmentPercent = cached.alignmentPercent;
    group.userData.distRatio = cached.distRatio;
    group.userData.isCentered = cached.isCentered;
    group.visible = edgeFade > 0.05 && cached.distRatio > 0.05;
  },

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

  _initParticles() {
    var count = 50;
    var positions = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = Math.random() * 6;
      positions[i * 3 + 2] = -(Math.random() * 15);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.06,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._particles = new THREE.Points(geo, mat);
    this._scene.add(this._particles);
  },

  _updateParticles(dt) {
    if (!this._particles) return;
    var pos = this._particles.geometry.attributes.position;
    var t = performance.now() * 0.001;
    for (var i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 1] += Math.sin(t + i * 0.7) * dt * 0.3;
      if (pos.array[i * 3 + 1] > 6) pos.array[i * 3 + 1] = 0;
      if (pos.array[i * 3 + 1] < 0) pos.array[i * 3 + 1] = 6;
    }
    pos.needsUpdate = true;
  },

  _animateEnvelopes(dt) {
    if (!this._envelopes.length) return;
    var time = this._clock ? this._clock.getElapsedTime() : performance.now() / 1000;

    this._envelopes.forEach(function(group, i) {
      var ud = group.userData;
      if (!ud || !ud.letterId) return;
      var hash = 0;
      for (var k = 0; k < ud.letterId.length; k++) {
        hash = (hash * 31 + ud.letterId.charCodeAt(k)) & 0x7fffffff;
      }

      // 漂浮晃动
      var floatSpeed = 0.8 + (hash % 7) * 0.15;
      var floatAmp = 0.03 + (hash % 5) * 0.015;
      group.position.y += Math.sin(time * floatSpeed + hash) * floatAmp * dt * 3;

      // 缓慢自转
      var rotSpeed = 0.3 + (hash % 11) * 0.08;
      group.rotation.y += Math.sin(time * rotSpeed + hash * 0.1) * 0.008 * dt * 3;

      // Tier 视觉效果
      var isTier4 = ud.tier >= 4 && ud.alignmentPercent >= CONFIG.FEATURE.ALIGNMENT_THRESHOLD * 100;

      if (isTier4) {
        // 脉冲缩放
        var pulse = 1 + Math.sin(time * 3 + hash) * 0.1;
        var baseS = 0.4 + ud.distRatio * 1.6;
        group.scale.setScalar(baseS * pulse);
        // 发光增强
        ud.sealMat.emissiveIntensity = 0.5 + Math.sin(time * 3 + hash) * 0.3;
        ud.bodyMat.emissive = new THREE.Color(0xffd700);
        ud.bodyMat.emissiveIntensity = 0.15 + Math.sin(time * 3 + hash) * 0.08;
      } else {
        ud.sealMat.emissiveIntensity = 0.3;
        ud.bodyMat.emissive = new THREE.Color(0x000000);
        ud.bodyMat.emissiveIntensity = 0;
      }

      // 封口动画（tier 3+ 微开）
      if (ud.flap && ud.tier >= 3) {
        ud.flap.rotation.x = -0.2 + Math.sin(time * 1.5 + hash) * 0.05;
      } else if (ud.flap) {
        ud.flap.rotation.x = 0;
      }

      // 信纸透明度（tier 3+ 可见）
      if (ud.paperMat) {
        var targetPaperOpacity = ud.tier >= 3 ? 0.8 : 0;
        ud.paperMat.opacity += (targetPaperOpacity - ud.paperMat.opacity) * dt * 4;
      }

      // 居中高亮
      if (ud.isCentered && ud.tier >= 3) {
        ud.seal.scale.setScalar(1 + Math.sin(time * 4 + hash) * 0.3);
      } else if (ud.seal) {
        ud.seal.scale.setScalar(1);
      }
    });
  },

  startLoop() {
    if (this._animFrameId) return;
    var self = this;
    function loop() {
      self._animFrameId = requestAnimationFrame(loop);
      var dt = Math.min(self._clock.getDelta(), 0.1);
      self._animateEnvelopes(dt);
      self._updateParticles(dt);
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

  setClickHandler(fn) {
    this._onEnvelopeClick = fn;
  },

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
