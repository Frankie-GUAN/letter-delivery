/**
 * 模块一：公共墙 (Public Wall)
 *
 * 负责人：Claude
 *
 * 核心体验入口。一面旧公寓的墙，上面散布着陌生人留下的信。
 * 用户可以发现信、读信、留下无声回响，或自己写信投递。
 */

const PublicWall = (() => {
    let state = {
        letters: [],
        selectedLetter: null,
        writing: { slot: 'mailbox', paper: 'notebook' },
        draftTimer: null
    };

    let $wallCanvas = null;
    let $modalContent = null;
    let $modalOverlay = null;

    // 署名占位符轮换
    var SIGNATURE_PLACEHOLDERS = [
        '一个也在等雨停的人',
        '某个周二下午的自己',
        '你对面那栋楼的住户',
        '二楼最后一盏灯',
        '一个不扔东西的人',
        '关东煮不要竹轮卷的那个人',
        '正在等红灯的人'
    ];

    function init(wallCanvasEl, modalContentEl, modalOverlayEl) {
        $wallCanvas = wallCanvasEl;
        $modalContent = modalContentEl;
        $modalOverlay = modalOverlayEl;

        // 初始化 Canvas 渲染器
        if (typeof CanvasRenderer !== 'undefined') {
            CanvasRenderer.init($wallCanvas);

            // Canvas 点击 → 信封检测
            $wallCanvas.addEventListener('click', function(e) {
                var rect = $wallCanvas.getBoundingClientRect();
                var mx = e.clientX - rect.left;
                var my = e.clientY - rect.top;
                var letter = CanvasRenderer.hitTest(mx, my);
                if (letter) handleLetterClick(letter);
            });
        }

        loadLetters();
        console.log('[PublicWall] Canvas 初始化完成，共', state.letters.length, '封信');
    }

    function loadLetters() {
        let stored = Storage.getLetters();
        if (stored.length === 0 && typeof PresetLetters !== 'undefined') {
            PresetLetters.ALL.forEach(l => {
                l.id = generateId();
                l.type = 'public';
                Storage.saveLetter(l);
            });
            stored = Storage.getLetters();
        }
        state.letters = stored.filter(l => l.type === 'public');
    }

    function show() {
        if (!$wallCanvas) return;
        loadLetters();
        if (typeof CanvasRenderer !== 'undefined') {
            CanvasRenderer.resize();
        }
        renderWall();
    }

    function hide() {
        if (state.draftTimer) {
            clearInterval(state.draftTimer);
            state.draftTimer = null;
        }
    }

    // ========== 墙渲染 (Canvas) ==========

    function renderWall() {
        if (typeof CanvasRenderer === 'undefined') return;

        if (state.letters.length === 0) {
            // 空白墙：Canvas 上绘制引导文字
            var canvas = $wallCanvas;
            var ctx = canvas.getContext('2d');
            var w = canvas.width / (window.devicePixelRatio || 1);
            var h = canvas.height / (window.devicePixelRatio || 1);
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#c8baa5';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.font = '16px "KaiTi","STKaiti",serif';
            ctx.textAlign = 'center';
            ctx.fillText('📮', w/2, h/2 - 30);
            ctx.fillText('墙上还没有信。', w/2, h/2 + 10);
            ctx.font = '12px "KaiTi","STKaiti",serif';
            ctx.fillText('你想成为第一个留下什么的人吗？', w/2, h/2 + 36);
            return;
        }

        var timeState = typeof WallEngine !== 'undefined'
            ? WallEngine.getCurrentTimeState()
            : { hue: 40, sat: 12, light: 85, name: '正午', desc: '阳光直射墙面' };

        CanvasRenderer.drawWall(state.letters, timeState);
    }

    // ========== 时间氛围 ==========

    function applyTimeAmbience() {
        const timeState = WallEngine.getCurrentTimeState();
        const surface = document.querySelector('#wall-public .wall-surface');

        if (surface) {
            surface.style.transition = 'background 2s ease';
            surface.style.background = `
                radial-gradient(ellipse at 70% 20%, hsl(${timeState.hue}, ${timeState.sat + 10}%, ${timeState.light + 5}%) 0%, transparent 50%),
                linear-gradient(180deg,
                    hsl(${timeState.hue}, ${timeState.sat}%, ${timeState.light}%) 0%,
                    hsl(${timeState.hue + 5}, ${timeState.sat + 3}%, ${timeState.light - 10}%) 50%,
                    hsl(${timeState.hue - 3}, ${timeState.sat + 5}%, ${timeState.light - 18}%) 100%
                )
            `;
        }

        // 时间标注
        let note = document.getElementById('time-ambience-note');
        if (!note) {
            note = document.createElement('div');
            note.id = 'time-ambience-note';
            note.style.cssText = `
                position: absolute; top: 14px; right: 18px;
                font-size: 10px; color: rgba(255,255,255,0.35);
                z-index: 3; pointer-events: none;
                font-family: var(--font-hand);
            `;
            document.querySelector('#wall-public').appendChild(note);
        }
        note.textContent = timeState.desc;
    }

    // ========== 读信 ==========

    function handleLetterClick(letter) {
        state.selectedLetter = letter;
        const echoes = Storage.getEchoesForLetter(letter.id);

        $modalContent.innerHTML = `
            <div class="letter-read-view fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <div class="letter-open-anim">
                    ${LetterComponent.renderContent(letter, echoes)}
                </div>
                <div class="echo-section">
                    <p class="echo-section-hint">读完，留下一样东西</p>
                    ${LetterComponent.renderEchoPicker(handleEchoPick)}
                </div>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');

        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        $modalOverlay.addEventListener('click', function(e) {
            if (e.target === $modalOverlay) closeModal();
        });
    }

    function handleEchoPick(echoType) {
        if (!state.selectedLetter) return;

        Storage.addEcho(state.selectedLetter.id, echoType);
        Storage.incrementStat('echoesGiven');

        // 刷新回响显示
        const echoes = Storage.getEchoesForLetter(state.selectedLetter.id);
        const letter = state.selectedLetter;

        $modalContent.querySelector('.letter-open-anim').innerHTML =
            LetterComponent.renderContent(letter, echoes);

        // 反馈动画
        const emoji = LetterComponent.ECHO_EMOJI[echoType] || '✨';
        const fb = document.createElement('div');
        fb.textContent = emoji;
        fb.style.cssText = `
            position: fixed; top: 35%; left: 50%; transform: translate(-50%, -50%);
            font-size: 44px; pointer-events: none; z-index: 300;
            animation: echoBounce 1s ease forwards;
        `;
        document.body.appendChild(fb);
        setTimeout(function() { fb.remove(); }, 1000);
    }

    // ========== 写信 ==========

    function startWriting() {
        state.writing = { slot: 'mailbox', paper: 'notebook' };

        $modalContent.innerHTML = `
            <div class="write-panel fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <h3 class="write-title">写一封信</h3>

                <div class="slot-picker" id="write-slot-picker">
                    <p class="picker-label">藏在哪里？</p>
                    <div class="slot-options">
                        ${Object.entries(LetterComponent.SLOT_CONFIG).map(function(entry) {
                            var key = entry[0], cfg = entry[1];
                            return '<button class="slot-option' + (key === 'mailbox' ? ' selected' : '') + '" data-slot="' + key + '">' +
                                '<span class="slot-icon">' + cfg.icon + '</span>' +
                                '<span class="slot-name">' + cfg.label + '</span>' +
                            '</button>';
                        }).join('')}
                    </div>
                </div>

                <div class="paper-picker" id="write-paper-picker">
                    <p class="picker-label">写在什么上面？</p>
                    <div class="paper-options">
                        <button class="paper-option selected" data-paper="notebook">📓 笔记本纸</button>
                        <button class="paper-option" data-paper="receipt">🧾 小票背面</button>
                        <button class="paper-option" data-paper="napkin">🍽️ 餐巾纸</button>
                        <button class="paper-option" data-paper="calendar">📅 日历页</button>
                        <button class="paper-option" data-paper="burned">🔥 烧过的纸</button>
                    </div>
                </div>

                <div class="write-textarea-wrapper" id="write-textarea-wrapper">
                    <textarea id="write-textarea"
                        placeholder="你想说的话…"
                        maxlength="800"></textarea>
                    <span class="write-char-count" id="write-char-count">0/800</span>
                </div>

                <div class="write-signature-row">
                    <input id="write-signature"
                        placeholder="署名：${getRandomPlaceholder()}"
                        maxlength="30">
                </div>

                <div class="write-actions">
                    <button id="write-send-btn" class="btn-send">寄出</button>
                </div>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');

        // 关闭按钮
        document.getElementById('modal-close-btn').addEventListener('click', function() {
            maybeSaveDraft();
            closeModal();
        });

        // 选藏身方式
        document.querySelectorAll('.slot-option').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.slot-option').forEach(function(b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
                state.writing.slot = btn.dataset.slot;
            });
        });

        // 选信纸 + 实时预览
        document.querySelectorAll('.paper-option').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.paper-option').forEach(function(b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
                state.writing.paper = btn.dataset.paper;
                updatePaperPreview(btn.dataset.paper);
            });
        });

        // 字数统计
        var textarea = document.getElementById('write-textarea');
        textarea.addEventListener('input', function() {
            var count = textarea.value.length;
            var counter = document.getElementById('write-char-count');
            counter.textContent = count + '/800';
            counter.style.color = count > 780 ? '#c0392b' : count > 600 ? '#c47a4a' : 'var(--color-ink-faded)';
        });

        // 寄出
        document.getElementById('write-send-btn').addEventListener('click', function() {
            var content = textarea.value.trim();
            var signature = document.getElementById('write-signature').value.trim() ||
                getRandomPlaceholder();

            if (!content) {
                shakeElement(document.getElementById('write-textarea-wrapper'));
                return;
            }

            var letter = {
                id: generateId(),
                type: 'public',
                content: content,
                paperType: state.writing.paper,
                slot: state.writing.slot,
                signature: signature,
                createdAt: Date.now()
            };

            Storage.saveLetter(letter);
            Storage.incrementStat('lettersSent');

            // 寄出动画
            animateSend(state.writing.slot, function() {
                closeModal();
                show();
            });
        });

        // 默认预览
        updatePaperPreview('notebook');

        // 启动草稿定时保存
        startDraftTimer(textarea);
    }

    function updatePaperPreview(paperType) {
        var wrapper = document.getElementById('write-textarea-wrapper');
        if (!wrapper) return;

        // 移除旧样式
        wrapper.classList.remove('paper-notebook', 'paper-receipt', 'paper-napkin', 'paper-calendar', 'paper-burned');
        wrapper.classList.add('paper-' + paperType);
    }

    function startDraftTimer(textarea) {
        if (state.draftTimer) clearInterval(state.draftTimer);
        state.draftTimer = setInterval(function() {
            var content = textarea.value.trim();
            if (content.length > 10) {
                var existing = Storage.getDrafts();
                // 简单去重：内容相似的草稿不重复存
                var duplicate = existing.find(function(d) {
                    return d.content === content;
                });
                if (!duplicate) {
                    Storage.saveDraft({
                        id: 'D_' + Date.now(),
                        content: content,
                        paperType: state.writing.paper,
                        slot: state.writing.slot,
                        signature: document.getElementById('write-signature').value.trim(),
                        updatedAt: Date.now()
                    });
                }
            }
        }, 10000); // 每10秒自动保存
    }

    function maybeSaveDraft() {
        var textarea = document.getElementById('write-textarea');
        if (!textarea) return;
        var content = textarea.value.trim();
        if (content.length > 5) {
            Storage.saveDraft({
                id: 'D_' + Date.now(),
                content: content,
                paperType: state.writing.paper,
                slot: state.writing.slot,
                signature: document.getElementById('write-signature')?.value?.trim() || '',
                updatedAt: Date.now()
            });
        }
    }

    // ========== 动画 ==========

    function animateSend(slot, callback) {
        // 创建信封飞出元素
        var modal = document.getElementById('modal-content');
        if (!modal) { if (callback) callback(); return; }

        var flyingEnvelope = document.createElement('div');
        flyingEnvelope.className = 'flying-envelope';
        flyingEnvelope.textContent = '✉️';
        flyingEnvelope.style.cssText = `
            position: fixed;
            top: 50%; left: 50%;
            font-size: 36px;
            z-index: 250;
            pointer-events: none;
            transition: all 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        `;
        document.body.appendChild(flyingEnvelope);

        // 目标位置：根据slot计算屏幕上的近似位置
        var targetX = slot === 'mailbox' ? 15 : slot === 'door-gap' ? 55 : slot === 'window' ? 30 : slot === 'pipe' ? 60 : 40;
        var targetY = 15;

        // 先缩小再飞
        requestAnimationFrame(function() {
            flyingEnvelope.style.transform = 'scale(0.4)';
            flyingEnvelope.style.opacity = '0.9';
            flyingEnvelope.style.top = targetY + '%';
            flyingEnvelope.style.left = targetX + '%';
        });

        setTimeout(function() {
            flyingEnvelope.remove();
            if (callback) callback();
        }, 750);
    }

    function shakeElement(el) {
        el.style.animation = 'none';
        el.offsetHeight; // reflow
        el.style.animation = 'shake 0.4s ease';
        setTimeout(function() { el.style.animation = ''; }, 400);
    }

    // ========== 工具 ==========

    function getRandomPlaceholder() {
        return SIGNATURE_PLACEHOLDERS[Math.floor(Math.random() * SIGNATURE_PLACEHOLDERS.length)];
    }

    function closeModal() {
        if (state.draftTimer) {
            clearInterval(state.draftTimer);
            state.draftTimer = null;
        }
        $modalOverlay.classList.add('hidden');
        $modalContent.innerHTML = '';
        state.selectedLetter = null;
    }

    function generateId() {
        return 'L_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }

    return {
        init: init,
        show: show,
        hide: hide,
        startWriting: startWriting,
        closeModal: closeModal
    };
})();
