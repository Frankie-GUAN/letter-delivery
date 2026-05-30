/**
 * Canvas 渲染引擎 (Canvas Renderer)
 *
 * 将墙面、信封、信纸等核心视觉全部通过 HTML5 Canvas 渲染。
 * 符合大赛规范：HTML5 Canvas 互动作品。
 *
 * 仅处理绘制逻辑，不管理数据状态。
 */

const CanvasRenderer = (() => {
    let canvas = null;
    let ctx = null;
    let dpr = 1;
    let envelopes = []; // { id, x, y, w, h, rotate, letter } 点击检测用

    /**
     * 初始化 Canvas
     * @param {HTMLCanvasElement} canvasEl
     */
    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        dpr = window.devicePixelRatio || 1;
        resize();
        window.addEventListener('resize', resize);
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
    }

    function getW() { return canvas ? canvas.width / dpr : 390; }
    function getH() { return canvas ? canvas.height / dpr : 700; }

    // ========== 墙壁绘制 ==========

    /**
     * 绘制整面墙（背景 + 所有信封）
     * @param {Array} letters
     * @param {object} timeState - 时间段配置
     */
    function drawWall(letters, timeState) {
        if (!ctx) return;
        var w = getW();
        var h = getH();
        ctx.clearRect(0, 0, w, h);

        drawWallBackground(w, h, timeState);
        drawWallTexture(w, h);

        envelopes = [];
        if (letters && letters.length > 0) {
            drawEnvelopes(letters, w, h);
        }
    }

    function drawWallBackground(w, h, timeState) {
        var ts = timeState || { hue: 40, sat: 12, light: 85 };

        // 主渐变
        var grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, hsl(ts.hue, ts.sat, ts.light));
        grad.addColorStop(0.5, hsl(ts.hue + 5, ts.sat + 3, ts.light - 8));
        grad.addColorStop(1, hsl(ts.hue - 3, ts.sat + 5, ts.light - 16));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 光斑
        var spotGrad = ctx.createRadialGradient(w * 0.65, h * 0.2, 0, w * 0.65, h * 0.2, w * 0.8);
        spotGrad.addColorStop(0, 'rgba(255,255,240,0.08)');
        spotGrad.addColorStop(1, 'rgba(255,255,240,0)');
        ctx.fillStyle = spotGrad;
        ctx.fillRect(0, 0, w, h);
    }

    function drawWallTexture(w, h) {
        // 砖缝
        ctx.strokeStyle = 'rgba(0,0,0,0.04)';
        ctx.lineWidth = 0.5;
        var brickH = 50, brickW = 100;
        for (var y = 0; y < h; y += brickH) {
            var offset = (Math.floor(y / brickH) % 2) * brickW / 2;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
            for (var x = offset; x < w; x += brickW) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + brickH);
                ctx.stroke();
            }
        }

        // 污渍/斑点
        ctx.fillStyle = 'rgba(0,0,0,0.02)';
        for (var i = 0; i < 30; i++) {
            var sx = Math.random() * w;
            var sy = Math.random() * h;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.random() * 20 + 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ========== 信封绘制 ==========

    function drawEnvelopes(letters, w, h) {
        // 按藏身方式分配锚点
        var slotAnchors = {
            'mailbox':    { x: w * 0.12, y: h * 0.08, spreadX: w * 0.14, spreadY: h * 0.22 },
            'door-gap':   { x: w * 0.48, y: h * 0.04, spreadX: w * 0.12, spreadY: h * 0.20 },
            'window':     { x: w * 0.25, y: h * 0.1,  spreadX: w * 0.22, spreadY: h * 0.24 },
            'pipe':       { x: w * 0.55, y: h * 0.2,  spreadX: w * 0.18, spreadY: h * 0.22 },
            'wall-crack': { x: w * 0.3,  y: h * 0.35, spreadX: w * 0.28, spreadY: h * 0.28 }
        };

        // 分组
        var groups = {};
        letters.forEach(function(l) {
            var s = l.slot || 'mailbox';
            if (!groups[s]) groups[s] = [];
            groups[s].push(l);
        });

        var envW = 108, envH = 66;

        for (var slot in groups) {
            var anchor = slotAnchors[slot] || slotAnchors['mailbox'];
            var list = groups[slot];
            var cols = Math.min(3, list.length);

            list.forEach(function(letter, i) {
                var col = i % cols;
                var row = Math.floor(i / cols);
                var x = anchor.x + col * anchor.spreadX + (Math.random() - 0.5) * 16;
                var y = anchor.y + row * anchor.spreadY + (Math.random() - 0.5) * 12;
                var rot = (Math.random() - 0.5) * 8;

                // 确保不超出
                x = Math.max(8, Math.min(w - envW - 8, x));
                y = Math.max(8, Math.min(h - envH - 8, y));

                drawEnvelope(x, y, envW, envH, rot, letter);
                envelopes.push({ id: letter.id, x: x, y: y, w: envW, h: envH, rotate: rot, letter: letter });
            });
        }
    }

    function drawEnvelope(x, y, w, h, rotate, letter) {
        ctx.save();
        var cx = x + w / 2, cy = y + h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(rotate * Math.PI / 180);
        ctx.translate(-cx, -cy);

        // 阴影
        ctx.shadowColor = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;

        // 信封主体
        var bodyGrad = ctx.createLinearGradient(x, y, x + w, y + h);
        bodyGrad.addColorStop(0, '#d4c8b0');
        bodyGrad.addColorStop(0.5, '#c8b898');
        bodyGrad.addColorStop(1, '#b0a080');
        ctx.fillStyle = bodyGrad;
        roundRect(x, y, w, h, 3);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // 边框
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.8;
        roundRect(x, y, w, h, 3);
        ctx.stroke();

        // 信封盖（三角形）
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3);
        ctx.lineTo(cx, y + h * 0.4);
        ctx.lineTo(x + w - 3, y + 3);
        ctx.closePath();
        ctx.fill();

        // 预览文字
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.font = '8px "KaiTi", "STKaiti", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var preview = letter.content.substring(0, 18).replace(/\n/g, ' ');
        ctx.fillText(preview + '…', cx, cy + 6);

        // 折痕
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + h / 2);
        ctx.lineTo(x + w - 4, y + h / 2);
        ctx.stroke();

        ctx.restore();
    }

    // ========== 点击检测 ==========

    function hitTest(mx, my) {
        for (var i = envelopes.length - 1; i >= 0; i--) {
            var e = envelopes[i];
            // 简化：不处理旋转，直接矩形检测
            if (mx >= e.x && mx <= e.x + e.w && my >= e.y && my <= e.y + e.h) {
                return e.letter;
            }
        }
        return null;
    }

    // ========== 工具 ==========

    function roundRect(x, y, w, h, r) {
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

    function hsl(h, s, l) {
        return 'hsl(' + h + ',' + s + '%,' + l + '%)';
    }

    return {
        init: init,
        drawWall: drawWall,
        hitTest: hitTest,
        resize: resize
    };
})();
