/**
 * 信件组件 (Letter Component)
 *
 * 负责单封信件的渲染：信封外观、正文展开、回响风铃。
 *
 * 信件数据模型:
 * {
 *   id: string,            // 唯一标识
 *   type: 'public'|'private'|'time',
 *   content: string,       // 正文
 *   paperType: 'notebook'|'receipt'|'napkin'|'calendar'|'burned',
 *   slot: 'mailbox'|'door-gap'|'window'|'pipe'|'wall-crack',  // 藏身方式
 *   signature: string,     // 落款（非真名）
 *   createdAt: number,     // 时间戳
 *   sentiment: string      // 情绪标签（可选，用于预设信件）
 * }
 */

const LetterComponent = (() => {
    // 藏身方式 → 视觉位置与CSS类映射
    const SLOT_CONFIG = {
        'mailbox':    { label: '信箱', css: 'slot-mailbox', icon: '📮' },
        'door-gap':   { label: '门缝下', css: 'slot-door', icon: '🚪' },
        'window':     { label: '窗台夹层', css: 'slot-window', icon: '🪟' },
        'pipe':       { label: '暖气管', css: 'slot-pipe', icon: '🔥' },
        'wall-crack': { label: '墙缝里', css: 'slot-crack', icon: '🧱' }
    };

    // 信纸类型 → CSS类
    const PAPER_CSS = {
        'notebook': 'notebook',
        'receipt':  'receipt',
        'napkin':   'napkin',
        'calendar': 'calendar',
        'burned':   'burned'
    };

    // 回响符号映射
    const ECHO_EMOJI = {
        stone:     '🪨',
        leaf:      '🍃',
        lamp:      '💡',
        dandelion: '🪽',
        drop:      '💧'
    };

    /**
     * 渲染信封（墙上的缩略图入口）
     */
    function renderEnvelope(letter, onClick) {
        const el = document.createElement('div');
        el.className = `letter-envelope ${SLOT_CONFIG[letter.slot]?.css || ''}`;
        el.dataset.letterId = letter.id;
        const title = getTitle(letter);
        const preview = buildPreview(title || letter.content || '', 12);

        // 信封外观：颜色/形状因藏身方式而异
        el.innerHTML = `
            <div class="envelope-body">
                <div class="envelope-flap"></div>
                <div class="envelope-preview">
                    <span class="envelope-first-line">${escapeHtml(preview.text)}${preview.truncated ? '...' : ''}</span>
                </div>
            </div>
        `;

        if (onClick) {
            el.addEventListener('click', () => onClick(letter));
        }

        return el;
    }

    /**
     * 渲染信件正文（展开阅读模式）
     */
    function renderContent(letter, echoes = null) {
        const paperClass = PAPER_CSS[letter.paperType] || '';
        const slotLabel = SLOT_CONFIG[letter.slot]?.label || '';
        const title = getTitle(letter);

        let html = `<div class="letter-paper ${paperClass}">`;
        if (title) {
            html += `<div class="letter-title">${escapeHtml(title)}</div>`;
        }
        html += `<div class="letter-content">${escapeHtml(letter.content)}</div>`;
        html += `<div class="letter-signature">—— ${escapeHtml(letter.signature || '')}</div>`;

        // 回响风铃
        if (echoes) {
            html += '<div class="letter-echoes">';
            for (const [type, count] of Object.entries(echoes)) {
                if (count > 0) {
                    html += `<span class="echo-chime">${ECHO_EMOJI[type]}<span class="echo-count">${count}</span></span>`;
                }
            }
            html += '</div>';
        }

        html += `<div class="letter-meta">
            <span>藏在：${slotLabel}</span>
            <span>${formatDate(letter.createdAt)}</span>
        </div>`;

        html += '</div>';
        return html;
    }

    /**
     * 渲染回响选择面板（读完信后的交互）
     */
    function renderEchoPicker(onPick) {
        const echoes = [
            { type: 'stone',     emoji: '🪨', label: '我承得住' },
            { type: 'leaf',      emoji: '🍃', label: '会过去的' },
            { type: 'lamp',      emoji: '💡', label: '我能看见' },
            { type: 'dandelion', emoji: '🪽', label: '去吧' },
            { type: 'drop',      emoji: '💧', label: '我也是' }
        ];

        let html = '<div class="echo-picker"><p class="echo-prompt">留下一样东西</p><div class="echo-options">';
        for (const e of echoes) {
            html += `<button class="echo-btn" data-echo="${e.type}" title="${e.label}">
                <span class="echo-emoji">${e.emoji}</span>
                <span class="echo-label">${e.label}</span>
            </button>`;
        }
        html += '</div></div>';

        // 延迟绑定事件（返回字符串，由调用方处理）
        setTimeout(() => {
            document.querySelectorAll('.echo-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    onPick(this.dataset.echo);
                });
            });
        }, 0);

        return html;
    }

    // 辅助
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(ts) {
        const d = new Date(ts);
        return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function getTitle(letter) {
        if (!letter) return '';
        const title = (letter.title || '').toString().trim();
        if (title) return title;
        const content = (letter.content || '').toString().trim();
        if (!content) return '';
        const firstLine = content.split(/\n+/).map(l => l.trim()).find(Boolean) || content;
        return firstLine.replace(/\s+/g, ' ').trim().slice(0, 18);
    }

    function buildPreview(text, limit) {
        const raw = (text || '').toString().trim();
        if (!raw) return { text: '', truncated: false };
        const clean = raw.replace(/\s+/g, ' ').trim();
        if (clean.length > limit) {
            return { text: clean.slice(0, limit), truncated: true };
        }
        return { text: clean, truncated: false };
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    return {
        SLOT_CONFIG,
        PAPER_CSS,
        ECHO_EMOJI,
        renderEnvelope,
        renderContent,
        renderEchoPicker,
        escapeHtml,
        formatDate,
        getTitle
    };
})();
