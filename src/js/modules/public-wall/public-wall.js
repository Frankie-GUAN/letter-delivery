/**
 * 模块一：公共墙 (Public Wall)
 *
 * 负责人：[待分配]
 *
 * 职责：
 *   1. 加载并渲染公共墙上的匿名信件
 *   2. 信件发现与阅读交互
 *   3. 回响物件选择与投递
 *   4. 写信 → 选藏身方式 → 选信纸 → 寄出
 *   5. 墙的时间状态变化
 *
 * 依赖：
 *   - Storage (storage.js)
 *   - WallEngine (wall.js)
 *   - LetterComponent (letter.js)
 *   - presetLetters (../data/preset-letters.js)
 *
 * 接口方法（供 app.js 调用）：
 *   PublicWall.init()         - 初始化模块
 *   PublicWall.show()         - 显示公共墙
 *   PublicWall.hide()         - 隐藏
 */

const PublicWall = (() => {
    // 私有状态
    let state = {
        letters: [],       // 当前显示的信件
        selectedLetter: null
    };

    // DOM引用（初始化时绑定）
    let $wallLetters = null;
    let $modalContent = null;
    let $modalOverlay = null;

    /**
     * 初始化
     */
    function init(wallLettersEl, modalContentEl, modalOverlayEl) {
        $wallLetters = wallLettersEl;
        $modalContent = modalContentEl;
        $modalOverlay = modalOverlayEl;

        // 加载预置信件 + 用户投递的公共信
        loadLetters();

        console.log('[PublicWall] 初始化完成，共', state.letters.length, '封信');
    }

    /**
     * 加载所有公共信件
     */
    function loadLetters() {
        // 预置信件（来自 preset-letters.js，首次使用时注入存储）
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

    /**
     * 显示公共墙
     */
    function show() {
        if (!$wallLetters) return;
        loadLetters(); // 刷新数据
        WallEngine.renderPublicWall($wallLetters, state.letters, handleLetterClick);
    }

    function hide() {
        // 清理
    }

    // ========== 交互处理 ==========

    /**
     * 点击信封 → 打开阅读
     */
    function handleLetterClick(letter) {
        state.selectedLetter = letter;

        const echoes = Storage.getEchoesForLetter(letter.id);
        const contentHtml = LetterComponent.renderContent(letter, echoes);

        // 追加回响选择面板
        const echoPickerHtml = LetterComponent.renderEchoPicker(handleEchoPick);

        $modalContent.innerHTML = `
            <div class="letter-read-view fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>
                ${contentHtml}
                ${echoPickerHtml}
            </div>
        `;
        $modalOverlay.classList.remove('hidden');

        // 关闭按钮
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        $modalOverlay.addEventListener('click', function(e) {
            if (e.target === $modalOverlay) closeModal();
        });
    }

    /**
     * 投递回响
     */
    function handleEchoPick(echoType) {
        if (!state.selectedLetter) return;

        Storage.addEcho(state.selectedLetter.id, echoType);
        Storage.incrementStat('echoesGiven');

        // 刷新回响风铃显示
        const echoes = Storage.getEchoesForLetter(state.selectedLetter.id);
        const contentHtml = LetterComponent.renderContent(state.selectedLetter, echoes);
        const echoPickerHtml = LetterComponent.renderEchoPicker(handleEchoPick);

        $modalContent.querySelector('.letter-paper').parentElement.innerHTML = `
            <button class="modal-close" id="modal-close-btn">✕</button>
            ${contentHtml}
            ${echoPickerHtml}
        `;
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);

        // 轻微反馈
        showEchoFeedback(echoType);
    }

    function showEchoFeedback(type) {
        const emoji = LetterComponent.ECHO_EMOJI[type] || '✨';
        const feedback = document.createElement('div');
        feedback.className = 'echo-feedback fade-in';
        feedback.textContent = emoji;
        feedback.style.cssText = `
            position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%);
            font-size: 40px; pointer-events: none; z-index: 300;
            animation: fadeIn 0.4s ease, floatUp 1s ease forwards;
        `;
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 1000);
    }

    /**
     * 写信流程
     * 由 app.js 触发（点击公共墙的"写信"按钮）
     */
    function startWriting() {
        $modalContent.innerHTML = `
            <div class="write-panel fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <h3>写一封信</h3>

                <!-- 选藏身方式 -->
                <div class="slot-picker" id="slot-picker">
                    <p class="picker-label">藏在哪里？</p>
                    <div class="slot-options">
                        ${Object.entries(LetterComponent.SLOT_CONFIG).map(([key, cfg]) => `
                            <button class="slot-option" data-slot="${key}">
                                <span>${cfg.icon}</span><span>${cfg.label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- 选信纸 -->
                <div class="paper-picker" id="paper-picker">
                    <p class="picker-label">写在什么上面？</p>
                    <div class="paper-options">
                        ${Object.entries({
                            notebook: '📓 笔记本纸',
                            receipt: '🧾 小票背面',
                            napkin: '🍽️ 餐巾纸',
                            calendar: '📅 日历页',
                            burned: '🔥 烧过的纸'
                        }).map(([key, label]) => `
                            <button class="paper-option" data-paper="${key}">${label}</button>
                        `).join('')}
                    </div>
                </div>

                <!-- 正文 -->
                <textarea id="write-textarea" placeholder="你想说的话..." maxlength="800"></textarea>

                <!-- 落款 -->
                <input id="write-signature" placeholder="署名（非真名）：一个也在等雨停的人" maxlength="30">

                <button id="write-send-btn" class="btn-send">寄出</button>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);

        // 绑定选藏身方式
        let selectedSlot = 'mailbox';
        document.querySelectorAll('.slot-option').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.slot-option').forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
                selectedSlot = this.dataset.slot;
            });
        });
        document.querySelector('.slot-option').classList.add('selected');

        // 绑定选信纸
        let selectedPaper = 'notebook';
        document.querySelectorAll('.paper-option').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.paper-option').forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
                selectedPaper = this.dataset.paper;
            });
        });
        document.querySelector('.paper-option').classList.add('selected');

        // 寄出按钮
        document.getElementById('write-send-btn').addEventListener('click', () => {
            const content = document.getElementById('write-textarea').value.trim();
            const signature = document.getElementById('write-signature').value.trim() || '未署名';

            if (!content) {
                alert('信不能是空的。');
                return;
            }

            const letter = {
                id: generateId(),
                type: 'public',
                content,
                paperType: selectedPaper,
                slot: selectedSlot,
                signature,
                createdAt: Date.now()
            };

            Storage.saveLetter(letter);
            Storage.incrementStat('lettersSent');

            // 动画：信被塞进墙缝
            animateLetterSend(selectedSlot);

            setTimeout(() => {
                closeModal();
                show(); // 刷新墙
            }, 800);
        });
    }

    function animateLetterSend(slot) {
        // TODO: 信被塞进对应位置的动画
        // 模块开发者可自行设计动画效果
    }

    // ========== 通用 ==========

    function closeModal() {
        $modalOverlay.classList.add('hidden');
        $modalContent.innerHTML = '';
        state.selectedLetter = null;
    }

    function generateId() {
        return 'L_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }

    return {
        init,
        show,
        hide,
        startWriting,
        closeModal
    };
})();
