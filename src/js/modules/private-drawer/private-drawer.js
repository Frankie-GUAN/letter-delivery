/**
 * 模块二：私人抽屉 (Private Drawer)
 *
 * 负责人：[待分配]
 *
 * 职责：
 *   1. 展示用户寄出的所有信
 *   2. 展示每封信收到的回响
 *   3. 展示"徘徊的信"（未完成的草稿）
 *   4. 继续编辑草稿或丢弃草稿
 *   5. 统计面板（写信数、收到回响数等）
 *
 * 依赖：
 *   - Storage (storage.js)
 *   - WallEngine (wall.js)
 *   - LetterComponent (letter.js)
 *
 * 接口方法：
 *   PrivateDrawer.init()
 *   PrivateDrawer.show()
 *   PrivateDrawer.hide()
 */

const PrivateDrawer = (() => {
    let $drawerContainer = null;
    let $modalContent = null;
    let $modalOverlay = null;

    function init(drawerEl, modalContentEl, modalOverlayEl) {
        $drawerContainer = drawerEl;
        $modalContent = modalContentEl;
        $modalOverlay = modalOverlayEl;
        console.log('[PrivateDrawer] 初始化完成');
    }

    function show() {
        if (!$drawerContainer) return;

        const myLetters = Storage.getLetters().filter(l => l.type === 'public' || l.type === 'private');
        const drafts = Storage.getDrafts();

        WallEngine.renderDrawer(
            $drawerContainer,
            myLetters,
            drafts,
            handleViewLetter,
            handleEditDraft
        );
    }

    function hide() {}

    /**
     * 查看信件详情（点击已寄出的信）
     */
    function handleViewLetter(letter) {
        const echoes = Storage.getEchoesForLetter(letter.id);
        const contentHtml = LetterComponent.renderContent(letter, echoes);

        $modalContent.innerHTML = `
            <div class="letter-read-view fade-in">
                <button class="modal-close" id="modal-close-btn">✕</button>
                ${contentHtml}
                <p class="drawer-note">这封信已经寄出，无法收回。</p>
            </div>
        `;
        $modalOverlay.classList.remove('hidden');

        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        $modalOverlay.addEventListener('click', function(e) {
            if (e.target === $modalOverlay) closeModal();
        });
    }

    /**
     * 继续编辑草稿
     */
    function handleEditDraft(draft) {
        // TODO: 打开写信面板，预填草稿内容
        // 模块开发者实现
    }

    function closeModal() {
        $modalOverlay.classList.add('hidden');
        $modalContent.innerHTML = '';
    }

    return {
        init,
        show,
        hide
    };
})();
