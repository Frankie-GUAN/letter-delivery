/**
 * 模块三：时光信 (Time Letter)
 *
 * 负责人：Claude
 *
 * 将信绑定到真实地点和时间。好友需在正确的时间、站在正确的位置拍照才能解锁。
 * 核心亮点：地点+时间双重锁、照片角度匹配、双照片并置的仪式感。
 */

const TimeLetter = (() => {
    let $boardLetters = null;
    let $modalContent = null;
    let $modalOverlay = null;
    let state = {
        timeLetters: [],
        creating: null,
        countdownTimers: []
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
        renderBoard();
    }

    function hide() {
        state.countdownTimers.forEach(function(t) { clearInterval(t); });
        state.countdownTimers = [];
    }

    // ========== 公告栏渲染 ==========

    function renderBoard() {
        var container = $boardLetters;
        container.innerHTML = '';

        if (state.timeLetters.length === 0) {
            container.innerHTML = `
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:var(--color-ink-faded);z-index:2;">
                    <div style="font-size:40px;margin-bottom:12px;">📌</div>
                    <p style="font-size:14px;">公告栏是空的</p>
                    <p style="font-size:12px;opacity:0.7;">埋下一封时光信吧</p>
                </div>
            `;
            return;
        }

        state.timeLetters.forEach(function(tl, i) {
            var card = createTimeCard(tl, i);
            container.appendChild(card);
        });
    }

    function createTimeCard(tl, index) {
        var card = document.createElement('div');
        card.className = 'time-letter-card fade-in';
        card.style.left = (5 + (index % 3) * 31) + '%';
        card.style.top = (5 + Math.floor(index / 3) * 36) + '%';
        card.style.transform = 'rotate(' + ((Math.random() - 0.5) * 3).toFixed(1) + 'deg)';

        var now = Date.now();
        var canOpen = tl.unlocked || now >= tl.openTime;
        var isLocked = !tl.unlocked && now < tl.openTime;

        if (isLocked) card.classList.add('locked');

        card.innerHTML = `
            <div class="tl-card-pin">📌</div>
            <div class="tl-card-img">
                <img src="${tl.fadedPhoto || tl.photo || ''}" alt=""
                    style="width:100%;height:80px;object-fit:cover;border-radius:2px;filter:${isLocked ? 'brightness(0.6) blur(2px)' : 'none'};">
            </div>
            <div class="tl-card-title">${LetterComponent.escapeHtml(tl.signature || '未署名')}</div>
            <div class="tl-card-status">
                ${tl.unlocked
                    ? '<span style="color:#6b8e5a;">✅ 已打开</span>'
                    : (isLocked
                        ? '<span class="tl-countdown-live" data-open="' + tl.openTime + '">🔒 ' + countdownText(tl.openTime - now) + '</span>'
                        : '<span style="color:#c47a4a;">⏰ 可以打开了</span>')
                }
            </div>
        `;

        card.addEventListener('click', function() {
            handleTimeLetterClick(tl);
        });

        return card;
    }

    // ========== 创建流程 ==========

    function startCreating() {
        state.creating = {};

        $modalContent.innerHTML = `
            <div class="write-panel fade-in" id="tl-create-container">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <h3 class="write-title">埋一封时光信</h3>
                <p class="tl-step-hint">
                    这封信会被锁在一个地方。<br>只有到了那里，到了那个时间，它才会打开。
                </p>

                <div id="tl-step-indicator" class="tl-steps">
                    <span class="tl-step active">① 写下</span>
                    <span class="tl-step-arrow">→</span>
                    <span class="tl-step">② 拍照</span>
                    <span class="tl-step-arrow">→</span>
                    <span class="tl-step">③ 埋下</span>
                </div>

                <textarea id="tl-content" placeholder="你想说的话..." maxlength="500"></textarea>

                <div style="display:flex;gap:12px;margin:8px 0;">
                    <input id="tl-signature" placeholder="署名" maxlength="20"
                        style="flex:1;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);background:var(--color-paper);font-family:var(--font-hand);font-size:14px;border-radius:2px;outline:none;">
                </div>

                <div class="tl-time-setter" style="margin:12px 0;">
                    <label style="display:block;font-size:12px;color:var(--color-ink-faded);margin-bottom:6px;">什么时候打开？</label>
                    <input type="datetime-local" id="tl-open-time"
                        style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);background:var(--color-paper);font-family:var(--font-body);font-size:14px;border-radius:2px;outline:none;">
                </div>

                <div class="tl-char-count" id="tl-char-count">0/500</div>

                <button id="tl-next-btn" class="btn-send">下一步：📷 拍照</button>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');

        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        document.getElementById('tl-content').addEventListener('input', function() {
            document.getElementById('tl-char-count').textContent = this.value.length + '/500';
        });

        document.getElementById('tl-next-btn').addEventListener('click', function() {
            var content = document.getElementById('tl-content').value.trim();
            var signature = document.getElementById('tl-signature').value.trim() || '未署名';
            var openTimeVal = document.getElementById('tl-open-time').value;

            if (!content) { alert('信不能是空的。'); return; }
            if (!openTimeVal) { alert('请选择打开时间。'); return; }

            var openTime = new Date(openTimeVal).getTime();
            if (openTime <= Date.now()) { alert('请选择一个未来的时间。'); return; }

            state.creating.content = content;
            state.creating.signature = signature;
            state.creating.openTime = openTime;

            // 更新步骤指示器
            document.querySelectorAll('.tl-step').forEach(function(s) { s.classList.remove('active'); });
            document.querySelectorAll('.tl-step')[1].classList.add('active');

            step2TakePhoto();
        });
    }

    function step2TakePhoto() {
        // 显示拍照界面
        $modalContent.innerHTML = `
            <div class="write-panel fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <h3 class="write-title">为这封信找一个地方</h3>
                <p class="tl-step-hint">
                    拍一张照片作为"锁"。<br>只有站在同样的位置、用同样的角度拍照的人，才能打开这封信。
                </p>

                <div id="tl-step-indicator" class="tl-steps">
                    <span class="tl-step done">✓ 写下</span>
                    <span class="tl-step-arrow">→</span>
                    <span class="tl-step active">② 拍照</span>
                    <span class="tl-step-arrow">→</span>
                    <span class="tl-step">③ 埋下</span>
                </div>

                <div id="tl-photo-area" style="
                    width:100%; min-height:200px;
                    border:2px dashed rgba(0,0,0,0.15);
                    border-radius:4px;
                    display:flex; align-items:center; justify-content:center;
                    margin:16px 0; cursor:pointer;
                    background:var(--color-paper-aged);
                ">
                    <div style="text-align:center;color:var(--color-ink-faded);">
                        <div style="font-size:32px;margin-bottom:8px;">📷</div>
                        <p>点击这里拍照</p>
                    </div>
                </div>

                <button id="tl-back-btn" class="btn-secondary">← 返回修改</button>
            </div>
        `;
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);

        // 拍照按钮
        var photoArea = document.getElementById('tl-photo-area');
        photoArea.addEventListener('click', async function() {
            photoArea.innerHTML = '<div style="text-align:center;color:var(--color-ink-faded);"><p>处理中…</p></div>';

            try {
                var photo = await Camera.takePhoto();
                state.creating.photo = photo;
                state.creating.features = await Camera.extractFeatures(photo);
                state.creating.fadedPhoto = await Camera.makeFadedPhoto(photo);

                // 显示预览
                photoArea.innerHTML = '<img src="' + state.creating.fadedPhoto + '" alt="" style="max-width:100%;max-height:300px;border-radius:2px;">';
                photoArea.style.border = '2px solid #6b8e5a';
                photoArea.style.padding = '4px';

                // 更新步骤
                document.querySelectorAll('.tl-step').forEach(function(s) { s.classList.remove('active'); });
                document.querySelectorAll('.tl-step')[2].classList.add('active');

                showStep3Preview();
            } catch (e) {
                console.error('[TimeLetter] 拍照失败:', e);
                photoArea.innerHTML = '<div style="text-align:center;color:#c0392b;"><p>拍照失败，点击重试</p></div>';
            }
        });

        document.getElementById('tl-back-btn').addEventListener('click', function() {
            startCreating();
            // 恢复之前填写的内容
            document.getElementById('tl-content').value = state.creating.content || '';
            document.getElementById('tl-signature').value = state.creating.signature || '';
        });
    }

    function showStep3Preview() {
        var d = state.creating;
        var countdown = countdownText(d.openTime - Date.now());

        $modalContent.innerHTML = `
            <div class="write-panel fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <h3 class="write-title">确认你的时光信</h3>

                <div id="tl-step-indicator" class="tl-steps">
                    <span class="tl-step done">✓ 写下</span>
                    <span class="tl-step-arrow">→</span>
                    <span class="tl-step done">✓ 拍照</span>
                    <span class="tl-step-arrow">→</span>
                    <span class="tl-step active">③ 埋下</span>
                </div>

                <div class="tl-preview-card" style="
                    background:var(--color-paper); padding:16px; border-radius:4px;
                    box-shadow:var(--shadow-letter); margin:16px 0;
                ">
                    <img src="${d.fadedPhoto}" alt="" style="width:100%;max-height:180px;object-fit:cover;border-radius:2px;margin-bottom:12px;">
                    <div class="letter-paper" style="margin:0;">
                        <div class="letter-content">${LetterComponent.escapeHtml(d.content.substring(0, 150))}${d.content.length > 150 ? '…' : ''}</div>
                        <div class="letter-signature">—— ${LetterComponent.escapeHtml(d.signature)}</div>
                    </div>
                    <p class="time-countdown" style="margin-top:10px;font-size:13px;color:var(--color-accent-warm);">🔒 ${countdown} 后打开</p>
                </div>

                <div class="tl-actions" style="display:flex;gap:10px;">
                    <button id="tl-confirm-btn" class="btn-send" style="flex:1;">埋下这封信</button>
                    <button id="tl-retake-btn" class="btn-secondary">重新拍照</button>
                </div>
            </div>
        `;
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        document.getElementById('tl-retake-btn').addEventListener('click', step2TakePhoto);
        document.getElementById('tl-confirm-btn').addEventListener('click', confirmCreate);
    }

    function confirmCreate() {
        var d = state.creating;
        var timeLetter = {
            id: 'TL_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            content: d.content,
            signature: d.signature,
            photo: d.photo,
            fadedPhoto: d.fadedPhoto,
            features: d.features,
            openTime: d.openTime,
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
    }

    // ========== 时光信点击 → 三种状态 ==========

    function handleTimeLetterClick(tl) {
        var now = Date.now();

        if (!tl.unlocked && now < tl.openTime) {
            showNotYetView(tl);
        } else if (tl.unlocked) {
            showUnlockedView(tl);
        } else {
            showUnlockPrompt(tl);
        }
    }

    function showNotYetView(tl) {
        var remaining = tl.openTime - Date.now();

        $modalContent.innerHTML = `
            <div class="letter-read-view fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <div style="text-align:center;padding:20px 0;">
                    <img src="${tl.fadedPhoto || tl.photo || ''}" alt=""
                        style="width:100%;max-height:200px;object-fit:cover;border-radius:4px;opacity:0.5;filter:blur(3px);">
                    <div style="margin-top:20px;">
                        <div style="font-size:48px;margin-bottom:12px;">🔒</div>
                        <h3 style="font-family:var(--font-hand);font-size:18px;color:var(--color-ink);">尚未解锁</h3>
                        <p class="tl-countdown-big" style="font-size:24px;color:var(--color-accent-warm);margin:12px 0;">${countdownText(remaining)}</p>
                        <p style="font-size:13px;color:var(--color-ink-faded);">后可以打开</p>
                        <p style="font-size:12px;color:var(--color-ink-faded);margin-top:8px;">届时请到拍照的地点打卡</p>
                    </div>
                </div>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        $modalOverlay.addEventListener('click', function(e) {
            if (e.target === $modalOverlay) closeModal();
        });
    }

    function showUnlockPrompt(tl) {
        $modalContent.innerHTML = `
            <div class="letter-read-view fade-in" id="tl-unlock-view">
                <button class="modal-close" id="modal-close-btn">✕</button>
                <h3 style="text-align:center;font-family:var(--font-hand);">⏰ 时间到了！</h3>
                <p style="text-align:center;font-size:13px;color:var(--color-ink-faded);margin:8px 0 16px;">
                    请站在原来的位置，用同样的角度拍一张照。
                </p>
                <div style="position:relative;">
                    <img src="${tl.fadedPhoto || tl.photo || ''}" alt=""
                        style="width:100%;max-height:200px;object-fit:cover;border-radius:4px;opacity:0.4;">
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:14px;color:var(--color-ink);background:rgba(255,255,255,0.8);padding:4px 12px;border-radius:2px;">
                        参考照片
                    </div>
                </div>
                <button id="tl-unlock-btn" class="btn-send" style="width:100%;margin-top:16px;">📷 拍照解锁</button>
                <div id="tl-unlock-feedback" style="margin-top:12px;text-align:center;"></div>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        document.getElementById('tl-unlock-btn').addEventListener('click', function() {
            attemptUnlock(tl);
        });
    }

    async function attemptUnlock(tl) {
        var btn = document.getElementById('tl-unlock-btn');
        var fb = document.getElementById('tl-unlock-feedback');
        if (btn) { btn.disabled = true; btn.textContent = '处理中…'; }
        if (fb) fb.innerHTML = '';

        try {
            var photo = await Camera.takePhoto();
            var features = await Camera.extractFeatures(photo);
            var similarity = Camera.compareFeatures(tl.features, features);

            if (similarity >= 0.6) {
                var updatedTl = Storage.unlockTimeLetter(tl.id, photo);
                // 同步状态
                tl.unlocked = true;
                tl.unlockPhoto = photo;
                tl.unlockedAt = updatedTl.unlockedAt;
                showUnlockedView(tl);
            } else {
                if (fb) {
                    var hints = generateAngleHints(tl.features, features);
                    fb.innerHTML = `
                        <p style="color:#c0392b;font-size:13px;">角度不太对，${hints}</p>
                        <p style="font-size:12px;color:var(--color-ink-faded);">匹配度：${Math.round(similarity * 100)}%（需要60%以上）</p>
                    `;
                }
                if (btn) { btn.disabled = false; btn.textContent = '📷 再试一次'; }
            }
        } catch (e) {
            console.error('[TimeLetter] 解锁失败:', e);
            if (fb) fb.innerHTML = '<p style="color:#c0392b;">拍照失败，请重试。</p>';
            if (btn) { btn.disabled = false; btn.textContent = '📷 拍照解锁'; }
        }
    }

    function showUnlockedView(tl) {
        var noteText = generateUnlockNote(tl);

        $modalContent.innerHTML = `
            <div class="letter-read-view fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>

                <div class="tl-compare-photos" style="display:flex;gap:8px;margin-bottom:16px;">
                    <div style="flex:1;text-align:center;">
                        <img src="${tl.fadedPhoto || tl.photo || ''}" alt=""
                            style="width:100%;height:140px;object-fit:cover;border-radius:4px;opacity:0.8;">
                        <p style="font-size:10px;color:var(--color-ink-faded);margin-top:4px;">${LetterComponent.formatDate(tl.createdAt)} · 埋信时</p>
                    </div>
                    <div style="flex:1;text-align:center;">
                        <img src="${tl.unlockPhoto || ''}" alt=""
                            style="width:100%;height:140px;object-fit:cover;border-radius:4px;">
                        <p style="font-size:10px;color:var(--color-ink-faded);margin-top:4px;">${tl.unlockedAt ? LetterComponent.formatDate(tl.unlockedAt) : ''} · 打开时</p>
                    </div>
                </div>

                <div class="letter-paper">
                    <div class="letter-content">${LetterComponent.escapeHtml(tl.content)}</div>
                    <div class="letter-signature">—— ${LetterComponent.escapeHtml(tl.signature)}</div>
                </div>

                <p class="tl-unlock-note" style="
                    text-align:center;font-size:12px;color:var(--color-ink-faded);
                    margin-top:14px;font-family:var(--font-hand);line-height:1.8;
                ">${noteText}</p>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        $modalOverlay.addEventListener('click', function(e) {
            if (e.target === $modalOverlay) closeModal();
        });
    }

    // ========== AI 旁白生成 ==========

    function generateUnlockNote(tl) {
        var days = tl.unlockedAt
            ? Math.floor((tl.unlockedAt - tl.createdAt) / (1000 * 60 * 60 * 24))
            : Math.floor((Date.now() - tl.createdAt) / (1000 * 60 * 60 * 24));

        if (!tl.features) {
            return '这两张照片之间隔了 ' + days + ' 天。同一个地方，不同的时间。';
        }

        // 比较光照变化
        var orig = tl.features;
        var centerDiff = Math.abs((orig.center || 0) - (orig.center || 0));
        var avgOrig = (orig.tl + orig.tr + orig.bl + orig.br) / 4;

        // 根据天数选择语气
        if (days === 0) {
            return '当天就打开了。你应该等了很久吧。';
        } else if (days < 7) {
            return '过了 ' + days + ' 天。光还没变，但看这光的人可能变了。';
        } else if (days < 60) {
            return days + ' 天。从埋下到打开，可能隔了一整个季节。有些话需要时间才能读。';
        } else if (days < 365) {
            return days + ' 天前你在这里埋下了这封信。' + Math.floor(days / 30) + ' 个月，足够很多事发生，也足够很多事被原谅。';
        } else {
            return '已经过去 ' + Math.floor(days / 365) + ' 年了。同一个地方，光的角度可能变了，但你还在看这里。';
        }
    }

    function generateAngleHints(original, current) {
        var tlO = original.tl || 0, trO = original.tr || 0, blO = original.bl || 0, brO = original.br || 0;
        var tlC = current.tl || 0, trC = current.tr || 0, blC = current.bl || 0, brC = current.br || 0;

        var diffs = [
            { zone: 'top', diff: Math.abs(tlC - tlO) + Math.abs(trC - trO) },
            { zone: 'bottom', diff: Math.abs(blC - blO) + Math.abs(brC - brO) },
            { zone: 'left', diff: Math.abs(tlC - tlO) + Math.abs(blC - blO) },
            { zone: 'right', diff: Math.abs(trC - trO) + Math.abs(brC - brO) }
        ];

        diffs.sort(function(a, b) { return b.diff - a.diff; });

        var hints = {
            'top': '试着稍微低一点，光线从上面来的太多了',
            'bottom': '稍微抬高一点',
            'left': '往右转一点试试',
            'right': '往左转一点试试'
        };

        return hints[diffs[0].zone] || '试着找到和原来差不多的角度';
    }

    function countdownText(ms) {
        if (ms <= 0) return '现在';
        var days = Math.floor(ms / (1000 * 60 * 60 * 24));
        var hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 30) return Math.floor(days / 30) + '个月' + (days % 30) + '天';
        if (days > 0) return days + '天' + hours + '小时';
        var mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return hours + '小时' + mins + '分钟';
    }

    function closeModal() {
        $modalOverlay.classList.add('hidden');
        $modalContent.innerHTML = '';
    }

    return {
        init: init,
        show: show,
        hide: hide,
        startCreating: startCreating,
        handleTimeLetterClick: handleTimeLetterClick
    };
})();
