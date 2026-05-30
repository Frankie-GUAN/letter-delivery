# AI时光信 — 未曾寄出的信

抖音AI创变者大赛 · 赛道一 · 互动空间（轻量小游戏）

## 项目概述

一个以"墙"为载体的情感互动作品。用户可以：
- 在**公共墙**上发现陌生人匿名留下的信，留下无声的回响
- 在**私人抽屉**中管理自己寄出的信和徘徊的草稿
- 通过**时光信**将信埋在地点中，好友需打卡拍照才能解锁

## 技术栈

- 纯 HTML/CSS/JS（适配抖音互动空间 8MB / 无网络限制）
- 本地存储（LocalStorage / IndexedDB）
- Camera API + Canvas 照片处理

## 目录结构

```
src/
├── index.html              # 入口
├── css/main.css            # 全局样式
├── js/
│   ├── app.js              # 主路由与初始化
│   ├── shared/             # 共享层
│   │   ├── storage.js      # 数据持久化
│   │   ├── wall.js         # 墙渲染引擎
│   │   ├── letter.js       # 信件组件
│   │   └── camera.js       # 相机与照片处理
│   ├── modules/            # 业务模块
│   │   ├── public-wall/    # 模块一：公共墙
│   │   ├── private-drawer/ # 模块二：私人抽屉
│   │   └── time-letter/    # 模块三：时光信
│   └── data/
│       └── preset-letters.js  # 预设公共信件
└── assets/                 # 图标、纹理等静态资源
```

## 开发方式

本项目采用模块分工开发，详见 `docs/开发规范.md`。
