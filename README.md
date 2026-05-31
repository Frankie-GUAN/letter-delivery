# 此刻·此地 — 以相机为媒介的地点信件互动作品

> 抖音AI创变者大赛 · 赛道一 · 互动空间（轻量小游戏）

## 项目概述

**此刻·此地**是一个基于地理位置的信件互动作品。核心体验：用相机在真实世界留下信，让别人走到那个地方、举起相机、对准你拍下的角度，信才会从取景器中浮现——完成一场跨越时空的"寻宝"。

取景器中的 AR 信封采用 Pokémon GO 风格的实时渲染：陀螺仪追踪设备朝向，信封随手机转动锚定在真实方位，距离越近越大越清晰。

### 三种信件类型

| 类型 | 描述 | 核心体验 |
|------|------|---------|
| 📮 **公开信** | 在任意地点留下感想，后来者都能发现 | 众人寻宝 — "我也来过这里" |
| ⏳ **时光胶囊** | 写给未来自己的信，定时解锁，可多人共埋 | 穿越时间 — "一年后的你，还记得吗" |
| 🔒 **密信** | 指定接收人，生成口令分享，Ta循着线索找到 | 两个人的秘密 — "课桌下的留言" |

### 核心交互流程

```
设置昵称头像 → 首页看板 → 探索地图(高德地图SDK) → 走近目标地点
→ 打开相机取景器 → AR信封随距离和对齐度逐渐清晰(4档梯度) → 展开阅读
→ 留下回响 / 拍摄照片写新的信 → 投递
```

---

## 技术架构

### 前端：纯 HTML/CSS/JS（SPA 多视图架构）

```
src/
├── index.html                          # 入口页面，按依赖顺序加载所有JS（支持defer异步）
├── css/
│   ├── main.css                        # 全局样式 — "旧物诗学"设计体系（衬线字体+暖光纸色+火漆金）
│   ├── components.css                  # 共享组件样式（信封卡片/火漆封印/Tab栏/FAB/成就/热力图）
│   └── animations.css                  # 动画关键帧库（淡入/滑入/尘埃/墨迹/信封启封/呼吸脉冲）
└── js/
    ├── config.js                       # 全局配置常量（GPS/相机/特征/信件/同步/口令）
    ├── api-key.js                      # API密钥文件（gitignore，需自行创建）
    ├── app.js                          # 主路由与初始化（8视图路由）
    ├── utils/
    │   ├── helpers.js                  # 工具函数：UUID/口令生成/Haversine距离/节流等
    │   └── qrcode.js                   # 二维码生成工具
    ├── data/
    │   ├── storage.js                  # IndexedDB 封装（信件CRUD）+ localStorage（用户设置）
    │   └── templates.js                # AI润色降级模板库（6种情绪 × 模板段落）
    ├── core/
    │   ├── location-service.js         # GPS定位服务（watchPosition + 缓存 + 模拟定位）
    │   ├── feature-engine.js           # AI场景特征提取与比对（HSV+Sobel+Laplacian, 256维向量）
    │   ├── ai-polish-service.js        # DeepSeek API 信件润色（带本地模板降级）
    │   ├── api-service.js              # 后端API客户端（信件/同步/通知）
    │   ├── sync-service.js             # 双向同步循环 + 推送通知检查
    │   └── letter-manager.js           # 信件业务逻辑（创建公开信/胶囊/密信/回响）
    ├── fx/
    │   ├── animation-engine.js         # 前端动画引擎（粒子/尘埃/交错淡入）
    │   └── ar-three-scene.js           # Three.js 3D AR场景（WebGL渲染信封/光晕/粒子）
    ├── audio/
    │   └── sound-engine.js             # 音效引擎（快门/翻页/UI交互音效）
    └── ui/
        ├── home-view.js                # 首页看板：统计+成就+活动热力图+我的信件+回响+FAB菜单+下拉刷新
        ├── map-view.js                 # 地图视图：高德地图SDK + 信件标记/折叠/筛选/路线导航/密信口令
        ├── camera-view.js              # 相机取景器：Pokémon GO风格AR + 陀螺仪朝向 + 4档对齐解锁
        ├── letter-composer.js          # 写信界面：类型切换/情绪选择/AI润色/胶囊配置/密信配置
        ├── letter-reader.js            # 读信界面：正文+照片+回响列表+胶囊共埋状态
        ├── collection-view.js          # 信匣收藏：4标签页（我的信/发现的/胶囊/密信）+ 排序+长按删除
        ├── onboarding-view.js          # 入门引导：3步概念介绍+资料设置
        └── discover-view.js            # 偶遇视图：随机发现附近信件卡片
```

### 后端：Express 同步服务

```
server/
├── package.json                        # express + cors
├── server.js                           # REST API服务（信件/同步/密信口令/通知）
├── nginx/                              # Nginx反向代理配置（组员配置）
└── data/
    ├── letters.json                    # 信件JSON存储（自动创建）
    └── notifications.json             # 通知订阅存储（自动创建）
```

#### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/letters/nearby` | 按经纬度+半径查询附近信件 |
| GET | `/api/letters/:id` | 获取单封信 |
| POST | `/api/letters` | 创建/更新信件（支持合并回复等） |
| POST | `/api/letters/:id/reply` | 添加回响 |
| POST | `/api/sync` | 双向同步（上传本地+下载新信） |
| POST | `/api/secret/resolve` | 密信口令解析 |
| POST | `/api/notifications/register` | 注册推送通知 |
| GET | `/api/notifications/check` | 检查通知（附近密信/到期胶囊） |

---

## AR 系统

AR 基于 Three.js WebGL 引擎，camera-view 在支持 WebGL 的设备上自动启用 3D 渲染：

| 引擎 | 文件 | 技术 | 特性 |
|------|------|------|------|
| Three.js AR | `ar-three-scene.js` | WebGL + Three.js 0.160 | 3D信封建模、光照、粒子特效、射线检测 |

**AR 核心能力（看齐 Pokémon GO）：**
- 陀螺仪空间感知 —— DeviceOrientation API 追踪手机朝向
- 实时渲染循环 —— requestAnimationFrame 60fps
- 空间投影 —— 将GPS目标映射到屏幕坐标（方位角+FOV+距离缩放）
- 四档梯度对齐 —— 0-30%虚线光晕 → 30-60%头像浮现 → 60-90%信纸展开 → 90-100%完全解锁
- 方向指示 —— 目标不在屏幕内时边缘箭头引导
- 罗盘指示 —— 底部方向条实时显示北/东/南/西

### 关键技术点

- **AR 信封锚定**：将GPS坐标转换为相对于手机朝向的屏幕位置，信封"漂浮"在真实世界中
- **场景对齐**：将相机实时帧与原照片进行特征向量余弦相似度比对，转化为0-100%对齐进度
- **AI润色**：优先调用 DeepSeek API，失败时自动降级到本地模板库
- **离线支持**：IndexedDB 本地存储，同步服务在检测到后端可用时才启动
- **模拟定位**：桌面调试时可在地图上点击模拟GPS位置
- **双向同步**：定时（30s）将本地未同步信件上传，同时拉取服务器新信件

---

## 设计体系

### "旧物诗学"视觉语言

| 维度 | 规范 |
|------|------|
| **字体** | 显示字体：`Songti SC` / `STSong` — 宋体系衬线字体，拒绝AI审美 |
| | 正文字体：`Noto Serif SC` → `PMingLiU` → `serif` 降级链 |
| **色彩** | 象牙纸色 `#FAF3E3` + 深墨色 `#3B2E1A` + 火漆金 `#C4852A` |
| **质感** | 纸纹背景 + 噪点叠加 + 毛边阴影 + 火漆封印 + 尘埃粒子动画 |
| **交互** | 撕边卡片、信封启封动画、墨迹渗染效果、信纸展开动画 |

---

## 快速开始

### 1. 配置 API 密钥

在 `src/js/` 目录下创建 `api-key.js` 文件：

```js
const API_KEYS = {
  DEEPSEEK: 'your-deepseek-api-key',       // AI润色
  AMAP_KEY: 'your-amap-key',               // 高德地图JS API key
  AMAP_SECURITY_CODE: 'your-amap-sec-code', // 高德安全密钥
};
```

### 2. 启动后端服务

```bash
cd server
npm install
npm start
```

服务默认监听 `http://localhost:3456`，如有SSL证书则同时启动 HTTPS（3457端口）。

### 3. 打开前端

直接浏览器访问 `http://localhost:3456`（后端托管静态文件），或使用任意静态服务器打开 `src/` 目录。

> **注意**：摄像头需要 HTTPS 安全上下文。本地开发可使用 `localhost`（浏览器对 localhost 放宽限制）。

---

## 环境要求

- 现代浏览器（支持 Geolocation API、MediaDevices API、IndexedDB、WebGL）
- HTTPS 环境（摄像头需要安全上下文；localhost 除外）
- 移动端需要 DeviceOrientation API 支持（AR 体验）
- Node.js 14+（后端服务）
- Three.js 0.160（本地 vendor 引入）

---

## 设计文档

- 设计规范：`docs/superpowers/specs/2026-05-30-此刻此地-design.md`
- AR 规划：`docs/superpowers/plans/2026-05-31-threejs-ar-envelopes.md`
- 开发日志：`docs/开发日志.md`
- 项目文档：`docs/此刻此地-项目文档.docx`
