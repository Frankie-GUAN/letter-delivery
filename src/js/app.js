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

    // DOM 元素
    const $wallPublic   = document.getElementById('wall-public');
    const $wallDrawer   = document.getElementById('wall-drawer');
    const $modalContent = document.getElementById('modal-content');
    const $modalOverlay = document.getElementById('modal-overlay');

    const $navPublic   = document.getElementById('nav-public');
    const $navDrawer   = document.getElementById('nav-drawer');

    // 墙的信封/内容容器
    const $wallLetters    = $wallPublic?.querySelector('.wall-letters');
    const $drawerInterior = $wallDrawer?.querySelector('.drawer-interior');
    const $timeboardSurface = document.getElementById('wall-timeboard')?.querySelector('.timeboard-surface');

    let currentLayer = 'wall-public';

    // ========== 初始化 ==========

    function init() {
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
        $navPublic?.addEventListener('click', () => switchLayer('wall-public'));
        $navDrawer?.addEventListener('click', () => switchLayer('wall-drawer'));

        // 全局写信按钮（可放在公共墙上）
        setupWriteButton();

        // 默认显示公共墙
        switchLayer('wall-public');

        // 应用墙的时间状态
        applyTimeState();

        console.log('[App] 就绪。');
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
                break;
            case 'wall-drawer':
                if (typeof PrivateDrawer !== 'undefined') PrivateDrawer.show();
                break;
        }
    }

    // ========== 写信按钮 ==========

    function setupWriteButton() {
        // 在公共墙上添加写信入口
        const writeBtn = document.createElement('button');
        writeBtn.id = 'write-letter-btn';
        writeBtn.className = 'write-fab fade-in';
        writeBtn.innerHTML = '✉️';
        writeBtn.title = '写一封信';
        writeBtn.style.cssText = `
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
            transition: transform 0.2s;
        `;
        writeBtn.addEventListener('click', () => {
            // 根据当前所在层判断写信类型
            if (currentLayer === 'wall-public' && typeof PublicWall !== 'undefined') {
                PublicWall.startWriting();
            }
            // 时光信创建可从公告栏触发
        });
        document.body.appendChild(writeBtn);
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
