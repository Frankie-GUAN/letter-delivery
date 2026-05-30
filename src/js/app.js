/**
 * 主应用入口 (Application Entry)
 *
 * 负责人：框架搭建者
 *
 * 职责：
 *   1. 页面初始化
 *   2. 模块加载与路由切换
 *   3. 全局事件调度（导航栏、写信按钮、模态层关闭）
 *   4. 墙的时间状态管理
 *
 * 三条导航：
 *   - 公共墙 (nav-public)     → PublicWall
 *   - 我的抽屉 (nav-drawer)   → PrivateDrawer
 *   - 公告栏在公共墙或我的抽屉内部显示时光信入口
 */

(function() {
    'use strict';

    // ========== 全局错误处理 ==========

    function showErrorScreen() {
        var $error = document.getElementById('error-screen');
        if ($error) {
            $error.style.display = 'flex';
        }
        // 隐藏正常 UI
        var $app = document.getElementById('app');
        if ($app) {
            $app.style.display = 'none';
        }
    }

    // 捕获未处理的异常
    window.addEventListener('error', function(e) {
        console.error('[App] 全局异常:', e.error || e.message);
        try { showErrorScreen(); } catch (_) {}
    });

    // 捕获 Promise 异常
    window.addEventListener('unhandledrejection', function(e) {
        console.error('[App] 未处理的Promise异常:', e.reason);
        try { showErrorScreen(); } catch (_) {}
    });

    // ========== DOM 元素 ==========

    var $wallPublic   = document.getElementById('wall-public');
    var $wallDrawer   = document.getElementById('wall-drawer');
    var $modalContent = document.getElementById('modal-content');
    var $modalOverlay = document.getElementById('modal-overlay');

    var $navPublic   = document.getElementById('nav-public');
    var $navDrawer   = document.getElementById('nav-drawer');
    var $navTimeletter = document.getElementById('nav-timeletter');

    // 墙的信封/内容容器
    var $wallLetters    = $wallPublic?.querySelector('.wall-letters');
    var $drawerInterior = $wallDrawer?.querySelector('.drawer-interior');
    var $timeboardSurface = document.getElementById('wall-timeboard')?.querySelector('.timeboard-surface');

    var currentLayer = 'wall-public';

    // ========== 初始化 ==========

    function init() {
        try {
            console.log('[App] 未曾寄出的信 — 正在打开...');

            // 初始化各模块
            if (typeof PublicWall !== 'undefined') {
                PublicWall.init($wallLetters, $modalContent, $modalOverlay);
            }
            if (typeof PrivateDrawer !== 'undefined') {
                PrivateDrawer.init($drawerInterior, $modalContent, $modalOverlay);
            }
            if (typeof TimeLetter !== 'undefined') {
                TimeLetter.init($timeboardSurface, $modalContent, $modalOverlay);
            }

            // 绑定导航
            if ($navPublic) $navPublic.addEventListener('click', function() { switchLayer('wall-public'); });
            if ($navDrawer) $navDrawer.addEventListener('click', function() { switchLayer('wall-drawer'); });
            if ($navTimeletter) $navTimeletter.addEventListener('click', function() { switchLayer('wall-timeboard'); });

            // 全局写信按钮
            setupWriteButton();

            // 默认显示公共墙
            switchLayer('wall-public');

            // 应用墙的时间状态
            applyTimeState();

            console.log('[App] 就绪。');
        } catch (e) {
            console.error('[App] 初始化失败:', e);
            showErrorScreen();
        }
    }

    // ========== 页面切换 ==========

    function switchLayer(targetId) {
        document.querySelectorAll('.wall-layer').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('active');

        const navBtn = document.querySelector(`[data-target="${targetId}"]`);
        if (navBtn) navBtn.classList.add('active');

        currentLayer = targetId;

        // 激活模块
        switch (targetId) {
            case 'wall-public':
                if (typeof PublicWall !== 'undefined') PublicWall.show();
                updateFab('write');
                break;
            case 'wall-drawer':
                if (typeof PrivateDrawer !== 'undefined') PrivateDrawer.show();
                updateFab('none');
                break;
            case 'wall-timeboard':
                if (typeof TimeLetter !== 'undefined') TimeLetter.show();
                updateFab('timeletter');
                break;
        }
    }

    // ========== 写信按钮 ==========

    var $fab = null;

    function setupWriteButton() {
        $fab = document.createElement('button');
        $fab.id = 'write-letter-btn';
        $fab.className = 'write-fab fade-in';
        $fab.title = '写一封信';
        $fab.style.cssText = `
            position: fixed;
            bottom: 80px; right: 16px;
            width: 50px; height: 50px;
            border-radius: 50%;
            border: none;
            background: var(--color-accent-warm);
            color: white;
            font-size: 24px;
            cursor: pointer;
            z-index: 50;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: transform 0.2s, opacity 0.2s;
        `;
        document.body.appendChild($fab);
        updateFab('write');
    }

    function updateFab(mode) {
        if (!$fab) return;
        // 清除旧的点击事件：用 clone 替换
        var newFab = $fab.cloneNode(true);
        $fab.parentNode.replaceChild(newFab, $fab);
        $fab = newFab;

        if (mode === 'write') {
            $fab.innerHTML = '✉️';
            $fab.title = '写一封信';
            $fab.style.display = '';
            $fab.addEventListener('click', function() {
                if (typeof PublicWall !== 'undefined') PublicWall.startWriting();
            });
        } else if (mode === 'timeletter') {
            $fab.innerHTML = '📌';
            $fab.title = '埋一封时光信';
            $fab.style.display = '';
            $fab.addEventListener('click', function() {
                if (typeof TimeLetter !== 'undefined') TimeLetter.startCreating();
            });
        } else {
            $fab.style.display = 'none';
        }
    }

    // ========== 时间状态 ==========

    function applyTimeState() {
        if (typeof WallEngine === 'undefined') return;

        const timeState = WallEngine.getCurrentTimeState();
        const wallSurface = document.querySelector('.wall-surface');
        if (wallSurface) {
            wallSurface.style.background = `
                linear-gradient(180deg,
                    hsl(${timeState.hue}, ${timeState.sat}%, ${timeState.light}%) 0%,
                    hsl(${timeState.hue + 5}, ${timeState.sat + 5}%, ${timeState.light - 8}%) 50%,
                    hsl(${timeState.hue - 3}, ${timeState.sat + 2}%, ${timeState.light - 15}%) 100%
                )
            `;
        }

        // 角落的描述文字
        let timeNote = document.getElementById('time-note');
        if (!timeNote) {
            timeNote = document.createElement('div');
            timeNote.id = 'time-note';
            timeNote.style.cssText = `
                position: fixed;
                top: 12px; right: 16px;
                font-size: 10px; color: rgba(255,255,255,0.4);
                z-index: 10; pointer-events: none;
            `;
            document.body.appendChild(timeNote);
        }
        timeNote.textContent = timeState.desc;
    }

    // 定时刷新时间状态
    setInterval(applyTimeState, 60000);

    // ========== 启动 ==========

    document.addEventListener('DOMContentLoaded', init);
})();
