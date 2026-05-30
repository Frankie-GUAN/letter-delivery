/**
 * 模块二：私人抽屉 (Private Drawer)
 *
 * 负责人：Claude
 *
 * 用户管理自己寄出的信和徘徊的草稿。
 * 功能最轻盈，但承载了"回头看"的情感重量。
 */

const PrivateDrawer = (() => {
    let $drawerContainer = null;
    let $modalContent = null;
    let $modalOverlay = null;
    let state = {
        myLetters: [],
        drafts: []
    };

    function init(drawerEl, modalContentEl, modalOverlayEl) {
        $drawerContainer = drawerEl;
        $modalContent = modalContentEl;
        $modalOverlay = modalOverlayEl;
        console.log('[PrivateDrawer] 初始化完成');
    }

    function show() {
        if (!$drawerContainer) return;
        loadData();
        render();
    }

    function hide() {}

    function loadData() {
        state.myLetters = Storage.getLetters()
            .filter(function(l) {
                return (l.type === 'public' || l.type === 'private') && !isPresetLetter(l);
            })
            .sort(function(a, b) { return b.createdAt - a.createdAt; });

        state.drafts = Storage.getDrafts()
            .sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    }

    function render() {
        var html = '';
        var sentCount = state.myLetters.length;

        // ===== 统计面板 =====
        var stats = Storage.getUserStats();
        html += '<div class="drawer-stats">';
        html += '<span class="stat-item">✉️ 寄出 <strong>' + sentCount + '</strong> 封</span>';
        html += '<span class="stat-item">💫 送出 <strong>' + stats.echoesGiven + '</strong> 个回响</span>';
        html += '<span class="stat-item">📌 埋下 <strong>' + stats.timeLettersCreated + '</strong> 封时光信</span>';
        html += '</div>';

        // ===== 已寄出的信 =====
        html += '<div class="drawer-section">';
        html += '<h3 class="drawer-heading">已寄出的信</h3>';

        if (state.myLetters.length === 0) {
            html += '<div class="drawer-empty-state">';
            html += '<div style="font-size:32px;margin-bottom:8px;">📮</div>';
            html += '<p>还没有寄出过信</p>';
            html += '<p style="font-size:12px;opacity:0.6;">你写的第一封信会出现在这里</p>';
            html += '</div>';
        } else {
            html += '<div class="drawer-letter-list">';
            state.myLetters.forEach(function(letter) {
                var echoes = Storage.getEchoesForLetter(letter.id);
                var echoTotal = 0;
                for (var k in echoes) { echoTotal += echoes[k]; }
                var preview = letter.content.replace(/\n/g, ' ').substring(0, 50);

                html += '<div class="drawer-letter-item fade-in" data-id="' + letter.id + '">';
                html += '<div class="drawer-item-preview">' + LetterComponent.escapeHtml(preview) + '…</div>';
                html += '<div class="drawer-item-meta">';
                html += '<span>' + LetterComponent.formatDate(letter.createdAt) + '</span>';
                html += '<span class="drawer-echo-badge">💫 ' + echoTotal + '</span>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</div>';

        // ===== 徘徊的信（草稿）=====
        html += '<div class="drawer-section">';
        html += '<h3 class="drawer-heading">还在徘徊的信</h3>';

        if (state.drafts.length === 0) {
            html += '<div class="drawer-empty-state">';
            html += '<div style="font-size:24px;margin-bottom:6px;">📝</div>';
            html += '<p style="font-size:13px;">没有草稿，所有信都已寄出</p>';
            html += '</div>';
        } else {
            html += '<div class="drawer-draft-list">';
            state.drafts.forEach(function(draft) {
                var preview = (draft.content || '').replace(/\n/g, ' ').substring(0, 40);
                html += '<div class="drawer-draft-item fade-in" data-id="' + draft.id + '">';
                html += '<div class="draft-preview">' + LetterComponent.escapeHtml(preview) + '…</div>';
                html += '<div class="draft-date">' + LetterComponent.formatDate(draft.updatedAt || Date.now()) + '</div>';
                html += '<div class="draft-actions">';
                html += '<button class="draft-btn edit" data-action="edit">继续写</button>';
                html += '<button class="draft-btn discard" data-action="discard">丢弃</button>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</div>';

        $drawerContainer.innerHTML = html;

        // 绑定事件
        bindEvents();
    }

    function bindEvents() {
        // 点击已寄出的信 → 查看
        $drawerContainer.querySelectorAll('.drawer-letter-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var id = this.dataset.id;
                var letter = state.myLetters.find(function(l) { return l.id === id; });
                if (letter) viewLetter(letter);
            });
        });

        // 草稿操作
        $drawerContainer.querySelectorAll('.draft-btn.edit').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = btn.closest('.drawer-draft-item').dataset.id;
                var draft = state.drafts.find(function(d) { return d.id === id; });
                if (draft) editDraft(draft);
            });
        });

        $drawerContainer.querySelectorAll('.draft-btn.discard').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = btn.closest('.drawer-draft-item').dataset.id;
                var draft = state.drafts.find(function(d) { return d.id === id; });
                if (draft) discardDraft(draft);
            });
        });
    }

    // ========== 查看信件 ==========

    function viewLetter(letter) {
        var echoes = Storage.getEchoesForLetter(letter.id);

        $modalContent.innerHTML = `
            <div class="letter-read-view fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>
                ${LetterComponent.renderContent(letter, echoes)}
                <div style="text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid rgba(0,0,0,0.05);">
                    <p style="font-size:12px;color:var(--color-ink-faded);">
                        这封信已经寄出，无法收回。
                    </p>
                </div>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');

        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        $modalOverlay.addEventListener('click', function(e) {
            if (e.target === $modalOverlay) closeModal();
        });
    }

    // ========== 草稿操作 ==========

    function editDraft(draft) {
        // 关闭抽屉，打开写信面板并预填草稿
        // 委托给 PublicWall 的 startWriting，并预填数据
        if (typeof PublicWall === 'undefined' || !PublicWall.startWriting) {
            alert('写信功能未就绪');
            return;
        }

        PublicWall.startWriting();

        // 延迟填入草稿内容（等待 DOM 就绪）
        setTimeout(function() {
            var textarea = document.getElementById('write-textarea');
            var sigInput = document.getElementById('write-signature');
            var titleInput = document.getElementById('write-title');
            if (textarea) textarea.value = draft.content || '';
            if (sigInput) sigInput.value = draft.signature || '';
            if (titleInput) titleInput.value = draft.title || '';

            // 选对信纸
            if (draft.paperType) {
                document.querySelectorAll('.paper-option').forEach(function(b) {
                    b.classList.remove('selected');
                    if (b.dataset.paper === draft.paperType) b.classList.add('selected');
                });
            }
            // 选对藏身方式
            if (draft.slot) {
                document.querySelectorAll('.slot-option').forEach(function(b) {
                    b.classList.remove('selected');
                    if (b.dataset.slot === draft.slot) b.classList.add('selected');
                });
            }

            // 更新字数
            var counter = document.getElementById('write-char-count');
            if (counter && textarea) counter.textContent = (textarea.value.length) + '/800';

            // 移除旧草稿
            Storage.deleteDraft(draft.id);
        }, 200);
    }

    function discardDraft(draft) {
        if (confirm('确定要丢弃这封草稿吗？')) {
            Storage.deleteDraft(draft.id);
            loadData();
            render();
        }
    }

    function closeModal() {
        $modalOverlay.classList.add('hidden');
        $modalContent.innerHTML = '';
    }

    function isPresetLetter(letter) {
        if (!letter) return false;
        if (letter.source === 'preset') return true;
        if (letter.isPreset) return true;
        return !!letter.sentiment && letter.type === 'public';
    }

    return {
        init: init,
        show: show,
        hide: hide
    };
})();
