# 此刻·此地 — 以相机为媒介的地点信件互动作品

> 抖音AI创变者大赛 · 赛道一 · 互动空间（轻量小游戏）

## 项目概述

**此刻·此地**是一个基于地理位置的信件互动作品。核心体验：用相机在真实世界留下信，让别人走到那个地方、举起相机、对准你拍下的角度，信才会从取景器中浮现——完成一场跨越时空的"寻宝"。

### 三种信件类型

| 类型 | 描述 | 核心体验 |
|------|------|---------|
| 📮 **公开信** | 在任意地点留下感想，后来者都能发现 | 众人寻宝 — "我也来过这里" |
| ⏳ **时光胶囊** | 写给未来自己的信，定时解锁，可多人共埋 | 穿越时间 — "一年后的你，还记得吗" |
| 🔒 **密信** | 指定接收人，生成口令分享，Ta循着线索找到 | 两个人的秘密 — "课桌下的留言" |

### 核心交互流程

```
设置昵称头像 → 首页看板 → 探索地图(高德地图SDK) → 走近目标地点
→ 打开相机取景器 → AR信封随对齐度逐渐清晰(4档梯度) → 展开阅读
→ 留下回响 / 拍摄照片写新的信 → 投递
```

## 技术架构

### 前端：纯 HTML/CSS/JS（SPA 多视图架构）

```
src/
├── index.html                          # 入口页面，按依赖顺序加载所有JS
├── css/
│   └── main.css                        # 全局样式，深色主题 + 金色强调
└── js/
    ├── config.js                       # 全局配置常量（GPS/相机/特征/信件/同步/口令）
    ├── api-key.js                      # API密钥文件（gitignore，需自行创建）
    ├── app.js                          # 主路由与初始化、首次使用设置向导
    ├── utils/
    │   └── helpers.js                  # 工具函数：UUID/口令生成/Haversine距离/节流等
    ├── data/
    │   ├── storage.js                  # IndexedDB 封装（信件CRUD） + localStorage（用户设置）
    │   └── templates.js                # AI润色降级模板库（6种情绪 × 模板段落）
    ├── core/
    │   ├── location-service.js         # GPS定位服务（watchPosition + 缓存 + 模拟定位）
    │   ├── feature-engine.js           # AI场景特征提取与比对（HSV+Sobel+Laplacian, 256维向量）
    │   ├── ai-polish-service.js        # DeepSeek API 信件润色（带本地模板降级）
    │   ├── api-service.js              # 后端API客户端（信件/同步/通知）
    │   ├── sync-service.js             # 双向同步循环 + 推送通知检查
    │   └── letter-manager.js           # 信件业务逻辑（创建公开信/胶囊/密信/回响）
    └── ui/
        ├── home-view.js                # 首页：统计看板 + 我的信件 + 最新回响 + 下拉刷新
        ├── map-view.js                 # 地图视图：高德地图SDK + 信件标记/筛选/路线导航
        ├── camera-view.js              # 相机取景器：AR信封4档梯度 + 场景对齐进度条
        ├── letter-composer.js          # 写信界面：类型/情绪选择 + AI润色 + 照片预览
        └── letter-reader.js            # 读信界面：正文 + 回响列表 + 胶囊共埋状态
```

### 后端：Express 同步服务

```
server/
├── package.json                        # express + cors
├── server.js                           # REST API服务（信件/同步/密信口令/通知）
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

### 关键技术点

- **场景对齐**：将相机实时帧与原照片进行特征向量余弦相似度比对，转化为0-100%对齐进度
- **AR信封四档梯度**：0-30% 虚线光晕 → 30-60% 发件人浮现 → 60-90% 信纸展开 → 90-100% 完全解锁可打开
- **AI润色**：优先调用 DeepSeek API，失败时自动降级到本地模板库
- **离线支持**：IndexedDB 本地存储，同步服务在检测到后端可用时才启动
- **模拟定位**：桌面调试时可在地图上点击模拟GPS位置
- **双向同步**：定时（30s）将本地未同步信件上传，同时拉取服务器新信件

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

## 已知问题

- `src/js/app.js` 存在 Git 合并冲突未解决（第168-252行），会导致应用无法正常运行
- `src/css/main.css` 存在多处 Git 合并冲突标记，样式可能异常
- `src/js/modules/` 和 `src/js/shared/` 下的文件为旧版代码，引用已删除的依赖，属于遗留死代码，未被 `index.html` 加载

## 环境要求

- 现代浏览器（支持 Geolocation API、MediaDevices API、IndexedDB）
- HTTPS 环境（摄像头需要安全上下文）
- Node.js 14+（后端服务）

## 设计文档

- 设计规范：`docs/superpowers/specs/2026-05-30-此刻此地-design.md`
- 实施计划：`docs/superpowers/plans/2026-05-30-此刻此地-implementation.md`
- 开发日志：`docs/开发日志.md`
