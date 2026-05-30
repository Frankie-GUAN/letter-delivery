/**
 * 墙渲染引擎 (Wall Rendering Engine)
 *
 * 负责三类"墙"的视觉渲染:
 *   - 公共墙：旧公寓外墙，信封随机分布
 *   - 私人抽屉：木抽屉内部，整齐排列
 *   - 公告栏：软木板，时光信钉在上面
 *
 * 同时管理墙的时间状态（清晨/正午/傍晚/深夜）。
 */

const WallEngine = (() => {
    // 时间状态
    const TIME_STATES = {
        morning: { name: '清晨',   hue: 38,  sat: 15, light: 88, desc: '空气里有灰尘的味道' },
        noon:    { name: '正午',   hue: 42,  sat: 10, light: 92, desc: '阳光直射墙面' },
        evening: { name: '傍晚',   hue: 30,  sat: 25, light: 75, desc: '余晖把墙染成暖黄' },
        night:   { name: '深夜',   hue: 220, sat: 8,  light: 40, desc: '只有路灯照着这面墙' }
    };

    /**
     * 根据当前时间获取时间段状态
     */
    function getCurrentTimeState() {
        const h = new Date().getHours();
        if (h >= 5 && h < 10)  return TIME_STATES.morning;
        if (h >= 10 && h < 16) return TIME_STATES.noon;
        if (h >= 16 && h < 20) return TIME_STATES.evening;
        return TIME_STATES.night;
    }

    /**
     * 在公共墙上渲染所有信封
     * @param {HTMLElement} container - 信封容器
     * @param {Array} letters - 信件数组
     * @param {Function} onLetterClick - 点击回调
     */
    function renderPublicWall(container, letters, onLetterClick) {
        container.innerHTML = '';

        if (!letters || letters.length === 0) {
            container.innerHTML = '<div class="wall-empty fade-in">墙上还没有信。你想成为第一个吗？</div>';
            return;
        }

        // 根据信件藏身方式计算位置
        const positions = calculateEnvelopePositions(letters, container);

        letters.forEach((letter, i) => {
            const pos = positions[i];
            const envelope = LetterComponent.renderEnvelope(letter, onLetterClick);
            envelope.style.left = pos.x + '%';
            envelope.style.top = pos.y + '%';
            envelope.style.transform = `rotate(${pos.rotate}deg)`;
            container.appendChild(envelope);
        });
    }

    /**
     * 计算信封在墙上的分布
     * 模拟真实旧墙上的不规则排列
     */
    function calculateEnvelopePositions(letters, container) {
        const positions = [];
        const usedSlots = {};

        for (let i = 0; i < letters.length; i++) {
            const slot = letters[i].slot || 'mailbox';
            // 同类型藏身方式应聚集
            const baseX = {
                'mailbox':    20 + Math.random() * 25,
                'door-gap':   55 + Math.random() * 20,
                'window':     15 + Math.random() * 30,
                'pipe':       60 + Math.random() * 25,
                'wall-crack': 30 + Math.random() * 40
            }[slot] || (10 + Math.random() * 80);

            const baseY = 5 + i * 22 + Math.random() * 10;

            positions.push({
                x: Math.min(85, Math.max(5, baseX)),
                y: Math.min(90, baseY),
                rotate: (Math.random() - 0.5) * 6
            });
        }

        return positions;
    }

    /**
     * 在公告栏上渲染时光信卡片
     * @param {HTMLElement} container
     * @param {Array} timeLetters
     * @param {Function} onClick
     */
    function renderTimeBoard(container, timeLetters, onClick) {
        container.innerHTML = '';

        if (!timeLetters || timeLetters.length === 0) {
            container.innerHTML = '<div class="wall-empty fade-in">公告栏是空的。埋下一封时光信吧。</div>';
            return;
        }

        timeLetters.forEach((tl, i) => {
            const card = document.createElement('div');
            card.className = `time-letter-card ${tl.unlocked ? '' : 'locked'} fade-in`;
            card.style.left = (5 + (i % 3) * 32) + '%';
            card.style.top = (5 + Math.floor(i / 3) * 35) + '%';
            card.style.transform = `rotate(${(Math.random() - 0.5) * 3}deg)`;

            const openDate = new Date(tl.openTime);
            const now = Date.now();
            const canOpen = now >= openDate;

            card.innerHTML = `
                <div class="tl-card-img">
                    <img src="${tl.fadedPhoto || tl.photo}" alt="" style="max-width:100%;height:auto;">
                </div>
                <div class="tl-card-title">${escapeHtml(tl.signature || '未署名')}</div>
                <div class="time-countdown">
                    ${canOpen ? '✅ 可打开' : '🔒 ' + countdownText(openDate - now)}
                </div>
            `;

            card.addEventListener('click', () => onClick(tl));
            container.appendChild(card);
        });
    }

    /**
     * 渲染私人抽屉
     * @param {HTMLElement} container
     * @param {Array} myLetters - 我写的信
     * @param {Array} drafts - 草稿
     * @param {Function} onLetterClick
     * @param {Function} onDraftClick
     */
    function renderDrawer(container, myLetters, drafts, onLetterClick, onDraftClick) {
        container.innerHTML = '';

        // 已寄出的信
        const sentSection = document.createElement('div');
        sentSection.className = 'drawer-section';
        sentSection.innerHTML = '<h3 class="drawer-heading">已寄出的信</h3>';

        if (myLetters.length === 0) {
            sentSection.innerHTML += '<p class="drawer-empty">还没有寄出过信</p>';
        } else {
            const sentList = document.createElement('div');
            sentList.className = 'sent-letters-list';
            myLetters.forEach(letter => {
                const item = document.createElement('div');
                item.className = 'drawer-letter-item fade-in';
                item.innerHTML = `
                    <div class="drawer-letter-preview">${escapeHtml(letter.content.substring(0, 50))}...</div>
                    <div class="drawer-letter-meta">
                        <span>${LetterComponent.formatDate(letter.createdAt)}</span>
                        <span>收到 ${getEchoCount(letter.id)} 个回响</span>
                    </div>
                `;
                item.addEventListener('click', () => onLetterClick(letter));
                sentList.appendChild(item);
            });
            sentSection.appendChild(sentList);
        }
        container.appendChild(sentSection);

        // 草稿（徘徊的信）
        const draftSection = document.createElement('div');
        draftSection.className = 'drawer-section';
        draftSection.innerHTML = '<h3 class="drawer-heading">还在徘徊的信</h3>';

        if (drafts.length === 0) {
            draftSection.innerHTML += '<p class="drawer-empty">所有信都已寄出</p>';
        } else {
            const draftList = document.createElement('div');
            draftList.className = 'draft-list';
            drafts.forEach(draft => {
                const item = document.createElement('div');
                item.className = 'drawer-draft-item fade-in';
                item.innerHTML = `
                    <div class="draft-preview">${escapeHtml(draft.content.substring(0, 40))}...</div>
                    <div class="draft-date">${LetterComponent.formatDate(draft.updatedAt)}</div>
                `;
                item.addEventListener('click', () => onDraftClick(draft));
                draftList.appendChild(item);
            });
            draftSection.appendChild(draftList);
        }
        container.appendChild(draftSection);
    }

    // 辅助
    function countdownText(ms) {
        if (ms <= 0) return '可打开';
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}天 ${hours}小时后`;
        const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}小时 ${mins}分钟后`;
    }

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function getEchoCount(letterId) {
        const echoes = Storage.getEchoesForLetter(letterId);
        return Object.values(echoes).reduce((s, v) => s + v, 0);
    }

    return {
        TIME_STATES,
        getCurrentTimeState,
        renderPublicWall,
        renderTimeBoard,
        renderDrawer
    };
})();
