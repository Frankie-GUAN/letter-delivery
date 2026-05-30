/**
 * Canvas 渲染引擎 — 旧物诗学
 *
 * 将公共墙渲染为一面上世纪老公寓的外墙。
 * 砖缝、青苔、光斑、灰尘——每处细节都在说"这里有过时间"。
 */

const CanvasRenderer = (() => {
    let canvas = null;
    let ctx = null;
    let dpr = 1;
    let envelopes = [];
    let dustParticles = [];
    let animFrame = null;
    let timeCache = null;

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        dpr = window.devicePixelRatio || 1;
        resize();
        window.addEventListener('resize', resize);
        initDust();
        startDustLoop();
    }

    function resize() {
        if (!canvas) return;
        var rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        initDust();
    }

    function getW() { return canvas ? canvas.width / dpr : 390; }
    function getH() { return canvas ? canvas.height / dpr : 700; }

    // ========== 灰尘粒子 ==========

    function initDust() {
        dustParticles = [];
        var w = getW();
        var h = getH();
        for (var i = 0; i < 40; i++) {
            dustParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                r: Math.random() * 1.2 + 0.3,
                speedX: (Math.random() - 0.5) * 0.15,
                speedY: (Math.random() - 0.5) * 0.1 - 0.05,
                opacity: Math.random() * 0.5 + 0.1,
                life: Math.random() * 300,
                maxLife: 300 + Math.random() * 400
            });
        }
    }

    function updateDust() {
        for (var i = 0; i < dustParticles.length; i++) {
            var p = dustParticles[i];
            p.x += p.speedX;
            p.y += p.speedY;
            p.life--;

            if (p.life <= 0) {
                p.x = Math.random() * getW();
                p.y = Math.random() * getH();
                p.life = p.maxLife;
                p.opacity = Math.random() * 0.5 + 0.1;
            }
            // 光区粒子更亮
            p.opacity = Math.sin(p.life / p.maxLife * Math.PI) * 0.5 + 0.1;
        }
    }

    function drawDust() {
        for (var i = 0; i < dustParticles.length; i++) {
            var p = dustParticles[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,248,220,' + p.opacity + ')';
            ctx.fill();
        }
    }

    function startDustLoop() {
        if (animFrame) cancelAnimationFrame(animFrame);
        function loop() {
            updateDust();
            if (ctx && canvas) {
                // 仅在墙上重新绘制灰尘层（避免过度绘制）
            }
            animFrame = requestAnimationFrame(loop);
        }
        animFrame = requestAnimationFrame(loop);
    }

    // ========== 墙面绘制 ==========

    function drawWall(letters, timeState) {
        if (!ctx) return;
        var w = getW();
        var h = getH();
        ctx.clearRect(0, 0, w, h);

        timeCache = timeState || { hue: 38, sat: 12, light: 82, name: '正午' };

        drawBrickWall(w, h);
        drawMortarLines(w, h);
        drawWearAndStains(w, h);
        drawWallArtifacts(w, h);
        drawLightBeam(w, h);
        drawDust();
        drawVignette(w, h);

        envelopes = [];
        if (letters && letters.length > 0) {
            drawEnvelopes(letters, w, h);
        }

        drawTimeStamp(w, h);
    }

    // ========== 砖墙 ==========

    function drawBrickWall(w, h) {
        var ts = timeCache;
        var brickW = 90, brickH = 42, mortarW = 3;

        for (var row = 0; row < h / brickH + 1; row++) {
            var offsetX = (row % 2) * (brickW / 2);
            for (var col = -1; col < w / brickW + 1; col++) {
                var bx = col * brickW + offsetX + mortarW / 2;
                var by = row * brickH + mortarW / 2;
                var bw = brickW - mortarW;
                var bh = brickH - mortarW;

                // 每块砖颜色略有差异
                var hueVar = (Math.random() * 6 - 3);
                var satVar = (Math.random() * 4 - 2);
                var lightVar = (Math.random() * 8 - 4);

                var bHue = ts.hue + hueVar;
                var bSat = ts.sat + satVar;
                var bLight = ts.light + lightVar;

                ctx.fillStyle = 'hsl(' + bHue + ',' + bSat + '%,' + bLight + '%)';
                ctx.fillRect(bx, by, bw, bh);

                // 砖面微纹理
                ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.03) + ')';
                ctx.fillRect(bx + Math.random() * bw * 0.6, by + Math.random() * bh * 0.5, bw * 0.3, bh * 0.3);
            }
        }
    }

    function drawMortarLines(w, h) {
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 2.5;
        var brickH = 42;
        for (var y = 0; y < h; y += brickH) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            // 灰缝不均
            ctx.lineWidth = 2 + Math.sin(y * 0.3) * 0.5;
            ctx.stroke();
        }
        ctx.lineWidth = 1;
    }

    // ========== 磨损与污渍 ==========

    function drawWearAndStains(w, h) {
        // 墙角青苔
        var mossGrad = ctx.createRadialGradient(w * 0.05, h - 20, 0, w * 0.05, h - 20, w * 0.5);
        mossGrad.addColorStop(0, 'rgba(90,110,60,0.12)');
        mossGrad.addColorStop(0.4, 'rgba(90,110,60,0.06)');
        mossGrad.addColorStop(1, 'rgba(90,110,60,0)');
        ctx.fillStyle = mossGrad;
        ctx.fillRect(0, h * 0.6, w * 0.5, h * 0.4);

        // 水渍
        ctx.fillStyle = 'rgba(180,170,150,0.06)';
        ctx.beginPath();
        ctx.ellipse(w * 0.3, h * 0.45, 120, 80, 0, 0, Math.PI * 2);
        ctx.fill();

        // 随机霉斑
        ctx.fillStyle = 'rgba(60,50,40,0.04)';
        for (var i = 0; i < 12; i++) {
            var sx = Math.random() * w;
            var sy = Math.random() * h;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.random() * 15 + 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // 墙皮剥落纹理
        ctx.strokeStyle = 'rgba(0,0,0,0.03)';
        ctx.lineWidth = 0.5;
        for (i = 0; i < 5; i++) {
            ctx.beginPath();
            var cx2 = Math.random() * w;
            var cy2 = Math.random() * h;
            ctx.moveTo(cx2, cy2);
            ctx.quadraticCurveTo(cx2 + 20, cy2 - 10, cx2 + 35, cy2 + 5);
            ctx.quadraticCurveTo(cx2 + 25, cy2 + 15, cx2 + 5, cy2 + 12);
            ctx.stroke();
        }
    }

    function drawWallArtifacts(w, h) {
        // 旧海报与胶带
        drawPoster(w * 0.08, h * 0.58, 96, 128, -2.2);
        drawPoster(w * 0.70, h * 0.28, 84, 112, 2.4);

        // 轻微粉笔划痕
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w * 0.22, h * 0.18);
        ctx.lineTo(w * 0.34, h * 0.20);
        ctx.lineTo(w * 0.31, h * 0.24);
        ctx.stroke();
        ctx.restore();
    }

    function drawPoster(x, y, pw, ph, rotate) {
        ctx.save();
        ctx.translate(x + pw / 2, y + ph / 2);
        ctx.rotate(rotate * Math.PI / 180);
        ctx.translate(-pw / 2, -ph / 2);

        var grad = ctx.createLinearGradient(0, 0, pw, ph);
        grad.addColorStop(0, 'rgba(250,245,235,0.7)');
        grad.addColorStop(0.5, 'rgba(242,233,220,0.75)');
        grad.addColorStop(1, 'rgba(232,220,200,0.7)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, pw, ph);

        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, pw - 1, ph - 1);

        // 纸张撕裂边
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.beginPath();
        ctx.moveTo(0, ph * 0.18);
        ctx.quadraticCurveTo(pw * 0.3, ph * 0.22, pw * 0.55, ph * 0.12);
        ctx.quadraticCurveTo(pw * 0.72, ph * 0.05, pw, ph * 0.14);
        ctx.stroke();

        // 胶带
        ctx.fillStyle = 'rgba(220,210,180,0.55)';
        ctx.fillRect(pw * 0.1, -6, pw * 0.22, 12);
        ctx.fillRect(pw * 0.68, ph - 6, pw * 0.22, 12);

        ctx.restore();
    }

    // ========== 光束 ==========

    function drawLightBeam(w, h) {
        var ts = timeCache;
        var lightHue = ts.hue + 5;
        var intensity = 0;

        // 不同时段光强不同
        switch (ts.name) {
            case '清晨': intensity = 0.06; break;
            case '正午': intensity = 0.10; break;
            case '傍晚': intensity = 0.12; lightHue = ts.hue + 10; break;
            case '深夜': intensity = 0.03; lightHue = 210; break;
            default: intensity = 0.08;
        }

        // 主光斑（模拟窗口光）
        var grad = ctx.createRadialGradient(w * 0.55, h * 0.15, 0, w * 0.55, h * 0.15, w * 0.6);
        grad.addColorStop(0, 'hsla(' + lightHue + ',20%,95%,' + intensity + ')');
        grad.addColorStop(0.3, 'hsla(' + lightHue + ',15%,90%,' + intensity * 0.6 + ')');
        grad.addColorStop(0.7, 'hsla(' + lightHue + ',10%,80%,' + intensity * 0.2 + ')');
        grad.addColorStop(1, 'hsla(' + lightHue + ',5%,70%,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 光束线条
        ctx.strokeStyle = 'rgba(255,248,220,0.04)';
        ctx.lineWidth = 20;
        for (var i = 0; i < 3; i++) {
            ctx.beginPath();
            var bx = w * 0.55;
            var by = h * 0.15;
            ctx.moveTo(bx - 20 + i * 15, by);
            ctx.lineTo(bx - 100 + i * 80, by + h * 0.6);
            ctx.stroke();
        }
    }

    // ========== 暗角 ==========

    function drawVignette(w, h) {
        var grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.45, w / 2, h / 2, w * 0.8);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0.02)');
        grad.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    // ========== 时间戳文字 ==========

    function drawTimeStamp(w, h) {
        var ts = timeCache;
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '10px "KaiTi","STKaiti","楷体",serif';
        ctx.textAlign = 'right';
        ctx.fillText(ts.desc || '', w - 16, h - 12);
    }

    // ========== 信封绘制 ==========

    function drawEnvelopes(letters, w, h) {
        var cols = w > 520 ? 4 : 3;
        var rows = Math.max(1, Math.ceil(letters.length / cols));
        var padX = 18;
        var padY = 16;
        var areaW = w - padX * 2;
        var areaH = h - padY * 2;
        var cellW = areaW / cols;
        var cellH = areaH / rows;

        var envW = Math.min(112, cellW * 0.78);
        envW = Math.max(64, envW);
        if (envW > cellW * 0.9) envW = cellW * 0.9;

        var envH = envW * 0.6;
        if (envH > cellH * 0.7) {
            envH = cellH * 0.7;
            envW = envH / 0.6;
        }
        envH = Math.max(40, envH);

        letters.forEach(function(letter, i) {
            var row = Math.floor(i / cols);
            var col = i % cols;
            var jitterX = (Math.random() - 0.5) * cellW * 0.22;
            var jitterY = (Math.random() - 0.5) * cellH * 0.18;
            var x = padX + col * cellW + (cellW - envW) / 2 + jitterX;
            var y = padY + row * cellH + (cellH - envH) / 2 + jitterY;
            var rot = (Math.random() - 0.5) * 6;

            x = Math.max(6, Math.min(w - envW - 6, x));
            y = Math.max(6, Math.min(h - envH - 6, y));

            drawSingleEnvelope(x, y, envW, envH, rot, letter);
            envelopes.push({ id: letter.id, x: x, y: y, w: envW, h: envH, rotate: rot, letter: letter });
        });
    }

    function drawSingleEnvelope(x, y, w, h, rotate, letter) {
        ctx.save();
        var cx = x + w / 2, cy = y + h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(rotate * Math.PI / 180);
        ctx.translate(-cx, -cy);

        // 信封阴影
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 4;

        // 信封主体 — 米黄到浅棕
        var bodyGrad = ctx.createLinearGradient(x, y, x + w, y + h);
        bodyGrad.addColorStop(0, '#f2ece0');
        bodyGrad.addColorStop(0.4, '#e8ddd0');
        bodyGrad.addColorStop(0.7, '#dcd0c0');
        bodyGrad.addColorStop(1, '#c8b8a5');
        ctx.fillStyle = bodyGrad;
        roundRectPath(x, y, w, h, 4);
        ctx.fill();

        // 消除阴影防止污染后续绘制
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // 边框
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        roundRectPath(x, y, w, h, 4);
        ctx.stroke();

        // 信封盖（三角翻盖）
        ctx.fillStyle = 'rgba(220,200,180,0.7)';
        ctx.beginPath();
        ctx.moveTo(x + w * 0.1, y + 2);
        ctx.lineTo(cx, y + h * 0.45);
        ctx.lineTo(x + w * 0.9, y + 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.stroke();

        // 翻盖折痕
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.1, y + 2);
        ctx.lineTo(x + w * 0.9, y + 2);
        ctx.stroke();

        // 标题预览文字
        var title = '';
        if (typeof LetterComponent !== 'undefined' && LetterComponent.getTitle) {
            title = LetterComponent.getTitle(letter);
        } else {
            title = (letter.title || letter.content || '').toString().trim();
        }
        var preview = title.replace(/\s+/g, ' ').trim();
        var isTruncated = false;
        if (preview.length > 10) {
            preview = preview.slice(0, 10);
            isTruncated = true;
        }

        ctx.save();
        roundRectPath(x + 6, y + 16, w - 12, h - 24, 2);
        ctx.clip();
        ctx.fillStyle = 'rgba(50,40,30,0.45)';
        ctx.font = '9px "KaiTi","STKaiti","楷体",serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(preview + (isTruncated ? '...' : ''), cx, cy + 8);
        ctx.restore();

        // 中间折痕
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + h / 2);
        ctx.lineTo(x + w - 5, y + h / 2);
        ctx.stroke();

        // 纸质纹理（细微横线）
        ctx.strokeStyle = 'rgba(0,0,0,0.03)';
        ctx.lineWidth = 0.3;
        for (var ly = y + 20; ly < y + h - 8; ly += 8) {
            ctx.beginPath();
            ctx.moveTo(x + 10, ly);
            ctx.lineTo(x + w - 10, ly + (Math.random() - 0.5) * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    // ========== 点击检测 ==========

    function hitTest(mx, my) {
        for (var i = envelopes.length - 1; i >= 0; i--) {
            var e = envelopes[i];
            // 简化矩形检测（忽略旋转，容差+5px）
            if (mx >= e.x - 5 && mx <= e.x + e.w + 5 && my >= e.y - 5 && my <= e.y + e.h + 5) {
                return e.letter;
            }
        }
        return null;
    }

    // ========== 绘图工具 ==========

    function roundRectPath(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    return {
        init: init,
        drawWall: drawWall,
        hitTest: hitTest,
        resize: resize
    };
})();
