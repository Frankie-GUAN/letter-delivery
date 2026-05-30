/**
 * 模块三：时光信 (Time Letter)
 *
 * 负责人：[待分配]
 *
 * 职责：
 *   1. 创建时光信：写信 → 拍照 → 设定打开时间 → 生成寻宝卡
 *   2. 公告栏展示所有时光信（自己的 + 收到的）
 *   3. 解锁验证：拍照比对 → 相似度判定 → 打开信件
 *   4. 分享寻宝卡给好友
 *   5. 解锁后的双照片并置展示
 *
 * 依赖：
 *   - Storage (storage.js)
 *   - Camera (camera.js)
 *   - WallEngine (wall.js)
 *   - LetterComponent (letter.js)
 *
 * 与公共墙/私人抽屉的区别：
 *   - 信件绑定地理位置（拍照为凭）
 *   - 有"打开时间锁"
 *   - 分享机制：朋友需到场拍照才能解锁
 *
 * 接口方法：
 *   TimeLetter.init()
 *   TimeLetter.show()
 *   TimeLetter.hide()
 *   TimeLetter.startCreating()
 *   TimeLetter.handleUnlockAttempt(timeLetterId)
 */

const TimeLetter = (() => {
    let $boardLetters = null;
    let $modalContent = null;
    let $modalOverlay = null;
    let state = {
        timeLetters: [],
        creating: null   // 创建中的临时数据
    };

    function init(boardEl, modalContentEl, modalOverlayEl) {
        $boardLetters = boardEl;
        $modalContent = modalContentEl;
        $modalOverlay = modalOverlayEl;

        state.timeLetters = Storage.getTimeLetters();
        console.log('[TimeLetter] 初始化完成，共', state.timeLetters.length, '封时光信');
    }

    function show() {
        if (!$boardLetters) return;
        state.timeLetters = Storage.getTimeLetters();
        WallEngine.renderTimeBoard($boardLetters, state.timeLetters, handleTimeLetterClick);
    }

    function hide() {}

    /**
     * 创建新时光信
     */
    function startCreating() {
        // 步骤1：写信
        $modalContent.innerHTML = `
            <div class="write-panel fade-in" id="tl-create-step1">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <h3>埋一封时光信</h3>
                <p class="tl-step-hint">这封信会被锁在一个地方。只有到了那里，到了那个时间，它才会打开。</p>

                <textarea id="tl-content" placeholder="你想说的话..." maxlength="500"></textarea>
                <input id="tl-signature" placeholder="署名" maxlength="20">

                <div class="tl-time-setter">
                    <label>什么时候打开？</label>
                    <input type="datetime-local" id="tl-open-time">
                </div>

                <button id="tl-next-btn" class="btn-send">下一步：拍照</button>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);

        document.getElementById('tl-next-btn').addEventListener('click', async () => {
            const content = document.getElementById('tl-content').value.trim();
            const signature = document.getElementById('tl-signature').value.trim() || '未署名';
            const openTime = new Date(document.getElementById('tl-open-time').value).getTime();

            if (!content) { alert('信不能是空的。'); return; }
            if (!openTime || openTime <= Date.now()) { alert('请选择一个未来的时间。'); return; }

            state.creating = { content, signature, openTime };
            await step2TakePhoto();
        });
    }

    /**
     * 步骤2：拍照
     */
    async function step2TakePhoto() {
        try {
            const photo = await Camera.takePhoto();
            state.creating.photo = photo;
            state.creating.features = await Camera.extractFeatures(photo);
            state.creating.fadedPhoto = await Camera.makeFadedPhoto(photo);

            showStep3Preview();
        } catch (e) {
            console.error('[TimeLetter] 拍照失败:', e);
            alert('拍照失败，请重试。');
        }
    }

    /**
     * 步骤3：预览→埋下
     */
    function showStep3Preview() {
        const data = state.creating;
        $modalContent.innerHTML = `
            <div class="write-panel fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <h3>预览你的时光信</h3>

                <div class="tl-preview-card">
                    <img src="${data.fadedPhoto}" alt="" style="max-width:100%;margin-bottom:12px;">
                    <div class="letter-paper">
                        <p>${data.content.substring(0, 150)}...</p>
                        <p class="letter-signature">—— ${data.signature}</p>
                    </div>
                    <p class="time-countdown">🔒 ${countdownText(data.openTime - Date.now())} 后打开</p>
                </div>

                <div class="tl-actions">
                    <button id="tl-confirm-btn" class="btn-send">埋下这封信</button>
                    <button id="tl-retake-btn" class="btn-secondary">重新拍照</button>
                </div>
            </div>
        `;
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        document.getElementById('tl-retake-btn').addEventListener('click', step2TakePhoto);
        document.getElementById('tl-confirm-btn').addEventListener('click', confirmCreate);
    }

    function confirmCreate() {
        const data = state.creating;
        const timeLetter = {
            id: 'TL_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            content: data.content,
            signature: data.signature,
            photo: data.photo,
            fadedPhoto: data.fadedPhoto,
            features: data.features,
            openTime: data.openTime,
            createdAt: Date.now(),
            unlocked: false,
            unlockPhoto: null,
            unlockedAt: null
        };

        Storage.saveTimeLetter(timeLetter);
        Storage.incrementStat('timeLettersCreated');
        state.creating = null;
        closeModal();
        show();

        // TODO: 生成分享卡
    }

    /**
     * 点击公告栏上的时光信
     */
    function handleTimeLetterClick(timeLetter) {
        const now = Date.now();

        if (!timeLetter.unlocked && now < timeLetter.openTime) {
            // 还没到时间
            $modalContent.innerHTML = `
                <div class="letter-read-view fade-in">
                    <button class="modal-close" id="modal-close-btn">✕</button>
                    <div class="tl-locked-view">
                        <img src="${timeLetter.fadedPhoto || timeLetter.photo}" alt="" style="max-width:100%;opacity:0.6;">
                        <h3>🔒 尚未解锁</h3>
                        <p>${countdownText(timeLetter.openTime - now)} 后可以打开</p>
                        <p class="tl-hint">届时请到拍照的地点打卡</p>
                    </div>
                </div>
            `;
            $modalOverlay.classList.remove('hidden');
            document.getElementById('modal-close-btn').addEventListener('click', closeModal);
            return;
        }

        if (timeLetter.unlocked) {
            // 已解锁：展示双照片 + 信件
            showUnlockedView(timeLetter);
            return;
        }

        // 时间到了但未解锁：提示拍照解锁
        showUnlockPrompt(timeLetter);
    }

    function showUnlockPrompt(timeLetter) {
        $modalContent.innerHTML = `
            <div class="letter-read-view fade-in" id="tl-unlock-view">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <h3>时间到了！</h3>
                <p>请站在原来的位置，用同样的角度拍一张照。</p>
                <img src="${timeLetter.fadedPhoto}" alt="" style="max-width:100%;margin:12px 0;opacity:0.5;">
                <p class="tl-clue">参考照片（褪色）</p>
                <button id="tl-unlock-btn" class="btn-send">📷 拍照解锁</button>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        document.getElementById('tl-unlock-btn').addEventListener('click', () => attemptUnlock(timeLetter));
    }

    async function attemptUnlock(timeLetter) {
        try {
            const photo = await Camera.takePhoto();
            const features = await Camera.extractFeatures(photo);
            const similarity = Camera.compareFeatures(timeLetter.features, features);

            if (similarity >= 0.6) {
                Storage.unlockTimeLetter(timeLetter.id, photo);
                showUnlockedView(timeLetter);
            } else {
                // 角度不对，给提示
                const hints = generateAngleHints(timeLetter.features, features);
                $modalContent.querySelector('#tl-unlock-view')?.insertAdjacentHTML('beforeend', `
                    <p class="tl-hint-error">角度不太对，${hints}</p>
                    <p class="tl-similarity">匹配度：${Math.round(similarity * 100)}%（需要60%以上）</p>
                `);
            }
        } catch (e) {
            console.error('[TimeLetter] 解锁失败:', e);
        }
    }

    function showUnlockedView(timeLetter) {
        $modalContent.innerHTML = `
            <div class="letter-read-view fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <div class="tl-compare-photos">
                    <div class="tl-photo-original">
                        <img src="${timeLetter.fadedPhoto || timeLetter.photo}" alt="" style="max-width:100%;">
                        <p>${LetterComponent.formatDate(timeLetter.createdAt)} · 埋信时</p>
                    </div>
                    <div class="tl-photo-unlock">
                        <img src="${timeLetter.unlockPhoto}" alt="" style="max-width:100%;">
                        <p>${LetterComponent.formatDate(timeLetter.unlockedAt)} · 打开时</p>
                    </div>
                </div>
                <div class="letter-paper">
                    ${LetterComponent.escapeHtml(timeLetter.content)}
                    <div class="letter-signature">—— ${LetterComponent.escapeHtml(timeLetter.signature)}</div>
                </div>
                <p class="tl-footnote">同一个地方，不同的时间。</p>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    }

    /**
     * 根据特征差异生成角度提示
     */
    function generateAngleHints(original, current) {
        const hints = [];
        if ((current.tl || 0) > (original.tl || 0) * 1.3) hints.push('上方太亮了，稍微低一点');
        else if ((current.bl || 0) > (original.bl || 0) * 1.3) hints.push('下方太亮了，稍微高一点');
        else if ((current.tr || 0) > (original.tr || 0) * 1.3) hints.push('右边太亮了，往左转一点');
        else if ((current.tl || 0) > (original.tl || 0) * 1.3) hints.push('左边太亮了，往右转一点');
        else hints.push('试着调整一下角度，找到和原来差不多的构图');
        return hints[0];
    }

    function countdownText(ms) {
        if (ms <= 0) return '现在';
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}天${hours}小时`;
        const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}小时${mins}分钟`;
    }

    function closeModal() {
        $modalOverlay.classList.add('hidden');
        $modalContent.innerHTML = '';
    }

    return {
        init,
        show,
        hide,
        startCreating,
        handleTimeLetterClick
    };
})();
