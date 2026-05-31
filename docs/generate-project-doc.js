const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat
} = require("docx");

// ── 颜色常量 ──
const ACCENT = "C4852A";
const DARK_BROWN = "3B2E1A";
const LIGHT_BG = "FAF3E3";
const DIM_TEXT = "8C7B5E";
const BORDER_COLOR = "D4C8A8";

// ── 复用样式 ──
const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function bodyPara(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 360 },
    ...opts,
    children: [new TextRun({ text, font: "Arial", size: 21, color: DARK_BROWN, ...opts.run })]
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, font: "Arial", size: 36, bold: true, color: ACCENT })]
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color: DARK_BROWN })]
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: DARK_BROWN })]
  });
}

function bulletItem(text, ref = "bullets", level = 0) {
  return new Paragraph({
    numbering: { reference: ref, level },
    spacing: { after: 80, line: 340 },
    children: [new TextRun({ text, font: "Arial", size: 21, color: DARK_BROWN })]
  });
}

function numberItem(text, ref = "numbers", level = 0) {
  return new Paragraph({
    numbering: { reference: ref, level },
    spacing: { after: 80, line: 340 },
    children: [new TextRun({ text, font: "Arial", size: 21, color: DARK_BROWN })]
  });
}

function makeCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        children: [new TextRun({ text, font: "Arial", size: opts.size || 20, bold: opts.bold || false, color: DARK_BROWN })]
      })
    ]
  });
}

function accentPara(text) {
  return new Paragraph({
    spacing: { after: 120, line: 360 },
    children: [
      new TextRun({ text, font: "Arial", size: 22, color: ACCENT, italics: true })
    ]
  });
}

// ══════════════════════════════════════════════
// 构建文档
// ══════════════════════════════════════════════

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 21 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 }
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: DARK_BROWN },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 }
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: DARK_BROWN },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 }
      }
    ]
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "numbers2",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  sections: [
    // ════════════════════════════════════════════
    // 封面
    // ════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children: [
        new Paragraph({ spacing: { before: 3200 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "此刻·此地", font: "Arial", size: 72, bold: true, color: ACCENT })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "MOMENT · PLACE", font: "Arial", size: 28, color: DIM_TEXT, italics: true })]
        }),
        new Paragraph({ spacing: { before: 600 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: ACCENT, space: 12 } },
          spacing: { before: 300, after: 0 },
          children: [new TextRun({ text: "以相机为媒介的地点信件互动作品", font: "Arial", size: 26, color: DARK_BROWN })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "抖音AI创变者大赛 · 赛道一 · 互动空间", font: "Arial", size: 20, color: DIM_TEXT })]
        }),
        new Paragraph({ spacing: { before: 1200 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: "项目文档 v2.0", font: "Arial", size: 20, color: DIM_TEXT })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "2026年5月", font: "Arial", size: 20, color: DIM_TEXT })]
        })
      ]
    },

    // ════════════════════════════════════════════
    // 正文
    // ════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR, space: 4 } },
            children: [new TextRun({ text: "此刻·此地 · 项目文档", font: "Arial", size: 16, color: DIM_TEXT, italics: true })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR, space: 4 } },
            children: [
              new TextRun({ text: "Page ", font: "Arial", size: 16, color: DIM_TEXT }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: DIM_TEXT })
            ]
          })]
        })
      },
      children: [

        // ════════════════════════════════════════
        // 一、产品定位与目标人群
        // ════════════════════════════════════════
        heading1("一、产品定位与目标人群"),

        heading2("1.1 产品简介"),
        bodyPara("“此刻·此地”是一款基于真实地理位置与AR相机取景器的信件互动应用。用户可以在任意真实地点“投递”一封虚拟信件，后来者必须走到同一地点、举起相机、对准发信人当时的角度，信件才会从取景器中浮现出来——完成一场跨越时空的“寻宝”体验。"),

        bodyPara("产品以“旧物诗学”为美学内核，通过信纸质感界面、火漆封印、尘埃粒子等视觉语言，营造书信年代的仪式感与温度感。"),

        heading2("1.2 目标人群"),

        heading3("核心人群：Z世代（18-28岁）城市青年"),
        bulletItem("热爱探索城市角落，对线下趣味社交有强烈需求"),
        bulletItem("在数字时代长大，对书信、明信片等“慢媒介”有怀旧好感"),
        bulletItem("习惯用短视频记录生活，但渴望更深层的情感连接"),
        bulletItem("活跃于抖音、小红书、朋友圈，乐于分享“发现感”内容"),

        heading3("延伸人群"),
        bulletItem("旅行爱好者：在景点留下专属痕迹，创造私人的“到此一游”"),
        bulletItem("异地恋人/朋友：通过密信功能创造只有彼此知道的秘密联络方式"),
        bulletItem("文艺爱好者：被“旧物诗学”美学和AI辅助创作工具吸引"),
        bulletItem("桌游/密室逃脱爱好者：对“寻宝-对齐-解锁”的玩法循环感到熟悉"),

        heading2("1.3 使用场景"),
        bulletItem("周末Citywalk途中，在咖啡馆转角发现一封陌生人的公开信"),
        bulletItem("毕业季，在校园长椅下给未来的自己埋一颗时光胶囊"),
        bulletItem("异地情侣在初次见面的地点互留密信，只有对方能打开"),
        bulletItem("旅行途中发现景点背后不为人知的情感故事"),

        bodyPara("这些场景的共同特征：发生在真实地理空间中，需要物理移动来触发，强调“此时此刻此地”的在场感。"),

        // ════════════════════════════════════════
        // 二、痛点分析与用户价值
        // ════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading1("二、痛点分析与用户价值"),

        heading2("2.1 核心痛点"),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2800, 3280, 3280],
          rows: [
            new TableRow({
              children: [
                makeCell("痛点", 2800, { bold: true, shading: LIGHT_BG, size: 21 }),
                makeCell("用户感受", 3280, { bold: true, shading: LIGHT_BG, size: 21 }),
                makeCell("本产品解法", 3280, { bold: true, shading: LIGHT_BG, size: 21 })
              ]
            }),
            new TableRow({
              children: [
                makeCell("社交媒体“点赞焦虑”与浅层互动", 2800, { size: 20 }),
                makeCell("发出去的内容追逐点赞，社交变成表演；关系停留在评论和转发，缺乏真正的深度连接", 3280, { size: 20 }),
                makeCell("信件天然是一对一或少量的深度媒介，收信人需要物理移动才能看到，“成本”本身就是诚意的信号", 3280, { size: 20 })
              ]
            }),
            new TableRow({
              children: [
                makeCell("数字内容与物理空间割裂", 2800, { size: 20 }),
                makeCell("手机上什么都有，但走到任何一个地方都感觉“跟我没关系”；数字足迹不附着在真实世界上", 3280, { size: 20 }),
                makeCell("每封信锚定在GPS坐标上，数字内容“长”在了真实地点上，物理空间获得了情感层", 3280, { size: 20 })
              ]
            }),
            new TableRow({
              children: [
                makeCell("表达门槛高，创作焦虑", 2800, { size: 20 }),
                makeCell("想写点什么但不知道怎么写，怕写得不好看；朋友圈和短视频的精致化让人不敢随意表达", 3280, { size: 20 }),
                makeCell("AI润色降低表达门槛：输入大白话→AI按选定情绪（温柔/俏皮/深情/怀念）生成氛围感短笺，让每个人都能写出动人的信", 3280, { size: 20 })
              ]
            }),
            new TableRow({
              children: [
                makeCell("现有AR/地图应用缺乏情感内核", 2800, { size: 20 }),
                makeCell("Pokémon GO是抓宝，AR导航是找路——LBS+AR组合目前几乎都服务于功能和游戏，缺少“为人与人的情感连接”服务的产品", 3280, { size: 20 }),
                makeCell("首创“LBS+AR+书信”三位一体：不是你去找一个虚拟物品，而是去赴一个人的约", 3280, { size: 20 })
              ]
            })
          ]
        }),

        heading2("2.2 用户价值"),

        heading3("情感价值：“被看见的感动”"),
        bulletItem("发现一封陌生人的信，知道有人曾在这里驻足、思考、表达"),
        bulletItem("给未来自己的时光胶囊，穿越时间与过去的自己对话"),
        bulletItem("密信的稀缺性让每一段感情都有了一个“只有我们俩知道的地方”"),

        heading3("社交价值：“有成本的真诚”"),
        bulletItem("物理移动本身就是一种筛选机制——愿意走这段路的人，才看得到你的话"),
        bulletItem("不是算法推荐，不是无限滑动，而是地理位置带来的“缘分感”"),
        bulletItem("回响机制让单向投递变成双向对话，但不强制——你回了，发信人会知道"),

        heading3("创作价值：“AI让每个人都成为诗人”"),
        bulletItem("AI润色不是替代创作，而是降低“开始写”的心理门槛"),
        bulletItem("六种情绪模板覆盖不同表达需求：温柔、俏皮、深情、怀念、日常、诗意"),
        bulletItem("即使离线环境也能降级到本地模板库，保证核心体验不中断"),

        // ════════════════════════════════════════
        // 三、实现方案
        // ════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading1("三、实现方案"),

        heading2("3.1 整体架构"),
        bodyPara("项目采用纯前端SPA多视图架构 + Node.js后端同步服务的混合方案。前端14个JS模块按依赖顺序加载，通过主路由App统一管理7个视图的切换。后端Express服务提供REST API进行信件同步、密信口令解析和推送通知。"),

        heading2("3.2 前端技术栈"),
        bulletItem("纯HTML/CSS/JS，零框架依赖，文件包体可控"),
        bulletItem("IndexedDB本地存储（信件CRUD，含纬度/经度/类型/时间4索引） + LocalStorage用户设置"),
        bulletItem("高德地图JS API 2.0：地图展示、位置搜索、路线导航"),
        bulletItem("Geolocation API：GPS实时定位（watchPosition + 监听器模式 + 过期检测）"),
        bulletItem("MediaDevices API：相机取景器实时视频流采集"),
        bulletItem("Canvas API：实时帧采样与图像特征提取（256维特征向量）"),
        bulletItem("DeepSeek API：AI信件润色（带本地模板降级机制）"),

        heading2("3.3 后端技术栈"),
        bulletItem("Node.js + Express：REST API服务（默认端口3456）"),
        bulletItem("JSON文件存储（letters.json + notifications.json），轻量无需数据库"),
        bulletItem("双向同步：定时（30s）上传本地未同步信件 + 拉取服务器新信件"),
        bulletItem("Web推送通知：Service Worker + Push API注册与推送"),

        heading2("3.4 数据模型"),
        bodyPara("信件是核心数据实体，包含以下关键字段："),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2000, 1600, 5760],
          rows: [
            new TableRow({
              children: [
                makeCell("字段组", 2000, { bold: true, shading: LIGHT_BG, size: 20 }),
                makeCell("关键字段", 1600, { bold: true, shading: LIGHT_BG, size: 20 }),
                makeCell("说明", 5760, { bold: true, shading: LIGHT_BG, size: 20 })
              ]
            }),
            new TableRow({
              children: [
                makeCell("位置信息", 2000, { size: 20 }),
                makeCell("location", 1600, { size: 20 }),
                makeCell("lat/lng/name/radius —— GPS坐标 + 地名 + 可见半径（米）", 5760, { size: 20 })
              ]
            }),
            new TableRow({
              children: [
                makeCell("照片与对齐", 2000, { size: 20 }),
                makeCell("photo", 1600, { size: 20 }),
                makeCell("dataURL + thumbnail + features[256]特征向量 + hasAlignment开关", 5760, { size: 20 })
              ]
            }),
            new TableRow({
              children: [
                makeCell("内容与情绪", 2000, { size: 20 }),
                makeCell("content", 1600, { size: 20 }),
                makeCell("title + body + mood（6种情绪标签）", 5760, { size: 20 })
              ]
            }),
            new TableRow({
              children: [
                makeCell("发信人", 2000, { size: 20 }),
                makeCell("sender", 1600, { size: 20 }),
                makeCell("nickname + avatar（emoji头像系统）", 5760, { size: 20 })
              ]
            }),
            new TableRow({
              children: [
                makeCell("类型扩展", 2000, { size: 20 }),
                makeCell("capsule/secret", 1600, { size: 20 }),
                makeCell("capsule: unlockAt + coBuryWith + allOpened；secret: passphrase + recipients + hintPhoto", 5760, { size: 20 })
              ]
            })
          ]
        }),

        heading2("3.5 三种信件类型实现"),
        heading3("公开信（Public）"),
        bulletItem("创建：拍照 → 写留言 → AI润色 → 投放到当前GPS坐标"),
        bulletItem("发现：地图罗盘点 → 距离排序 → 走近 → 相机对齐 → 阅读"),
        bulletItem("对齐可选：发信人可选择关闭AI对齐，收信人进入范围即直接可读"),

        heading3("时光胶囊（Self-Capsule）"),
        bulletItem("埋下：拍照 → 写留言 → 设定解锁时间 → 可选邀请好友共埋"),
        bulletItem("唤醒：到期本地通知 → 回到原地（可选对齐）→ 信封浮现 → 多人共埋时，全部打开后可看到彼此留言"),

        heading3("密信（Secret）"),
        bulletItem("创建：拍照线索 → 写留言 → 指定接收人 → 生成分享口令"),
        bulletItem("发现：收到口令 → 输入解锁 → 获取线索照片+大范围 → 实地寻找 → 打开阅读"),

        heading2("3.6 AI场景对齐引擎"),
        bodyPara("这是整个产品最核心的技术模块，实现了“必须对准原角度才能看到信”的魔法体验："),
        numberItem("发信时：拍摄参考照片 → Canvas缩放至256×256 → 分4×4网格，每格提取HSV色相/饱和度 + Sobel边缘8方向直方图 + Laplacian亮度梯度 → 拼接为256维特征向量 → 存入信件数据"),
        numberItem("收信时：相机实时帧每秒采样一帧 → 同算法提取256维特征向量 → 余弦相似度比对 → Sigmoid映射为0-100%对齐得分"),
        numberItem("视觉反馈：0-30%虚线光晕 → 30-60%发件人浮现 → 60-90%信纸展开 → 90-100%完全解锁，四档梯度驱动AR信封动画"),
        numberItem("纯前端传统CV方案，无深度学习依赖，单帧提取<50ms，实时可用"),

        // ════════════════════════════════════════
        // 四、核心创新点
        // ════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading1("四、核心创新点"),

        heading2("创新一：相机取景器作为“时空窗口”"),
        bodyPara("与传统AR应用不同，本产品赋予相机取景器全新的语义：它不是拍照工具，而是一扇“窥见过去”的窗户。当你举起相机对准一个场景，你不仅在看见当下的世界，还在看见另一个人在这个地方留下的情感痕迹。这种“叠加现实”不是叠加3D模型，而是叠加一段人的故事——这是AR在情感维度上的全新探索。"),
        bulletItem("首创“场景对齐解锁”机制：不是走近就触发，而是需要对准发信人当时拍摄的角度"),
        bulletItem("四档梯度反馈让“寻找对齐”的过程本身成为一种有仪式感的体验"),
        bulletItem("相机从工具变成了媒介，承载了跨越时空的情感传递"),

        heading2("创新二：LBS + AR + 书信，三位一体新品类"),
        bodyPara("市面上LBS应用（地图/外卖/打车）服务于功能效率，AR应用（滤镜/游戏/测量）服务于视觉刺激，书信应用（邮件/私信/漂流瓶）服务于纯数字交流。本产品将三者融合，开创了“基于物理位置的情感社交”这一新品类："),
        bulletItem("不是向算法要内容，而是向真实世界要相遇 —— 抵制信息茧房"),
        bulletItem("不是滑动刷走，而是走到才能看到 —— 物理成本构建内容稀缺性"),
        bulletItem("不是公域流量池，而是私域情感空间 —— 一封信的读者可能只有几个人，但这正是价值所在"),

        heading2("创新三：“旧物诗学”设计语言"),
        bodyPara("在视觉和交互层面，产品拒绝AI生成式审美（紫渐变、Inter字体、玻璃态卡片），建立了一套独特的“旧物诗学”设计体系："),
        bulletItem("字体体系：宋体系衬线字体（Songti/STSong/Noto Serif SC），坚持文学气质"),
        bulletItem("色彩体系：象牙纸色（#FAF3E3）+ 深墨色（#3B2E1A）+ 火漆金（#C4852A），暖调低饱和"),
        bulletItem("质感体系：纸纹背景 + 噪点叠加 + 毛边阴影 + 火漆封印 + 尘埃粒子动画"),
        bulletItem("交互仪式：撕边卡片、信封启封动画、墨迹渗染效果、信纸展开动画"),

        heading2("创新四：AI的双重角色"),
        bodyPara("产品中AI不仅仅是功能模块，而是被赋予了两种截然不同的“人设”："),
        numberItem("“看门人” —— AI场景匹配引擎：像一个严格的守门人，确保只有“对的人在对的地方”才能看到信。它用计算机视觉判断场景是否对齐，而非用密码"),
        numberItem("“代笔人” —— AI信件润色引擎：像一个会修辞的朋友，把用户的大白话变成有氛围感的短笺。用户只需要表达意图，AI来打磨辞藻"),
        bodyPara("这种AI“冷/热”双面角色的设计，让技术服务于情感而不喧宾夺主。"),

        heading2("创新五：物理世界作为内容分发机制"),
        bodyPara("区别于所有以算法推荐为核心的内容平台，本产品的内容分发机制完全基于物理距离。一封信的“推荐权重”不由算法决定，而由你和这封信之间的地理距离决定。这带来了三个独特的产品特性："),
        bulletItem("“散步即发现” —— 不需要任何主动搜索，移动本身就是内容发现行为"),
        bulletItem("“地点即策展” —— 每个地点自然形成的内容集合，不是机器生成的，而是人们自发在此地留下的"),
        bulletItem("“距离即关系” —— 越近的信越可见，物理空间的邻近性成为社交关系的隐喻"),

        // ════════════════════════════════════════
        // 五、总结与展望
        // ════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading1("五、总结与展望"),

        heading2("5.1 项目现状"),
        bulletItem("前端：7个视图完整实现（首页看板/地图罗盘/相机取景器/写信/读信/信匣/偶遇/入门引导）"),
        bulletItem("后端：Express同步服务 + REST API + 推送通知"),
        bulletItem("AI能力：DeepSeek API润色（已接入）+ 场景特征提取引擎（纯前端CV）"),
        bulletItem("地图能力：高德地图JS API 2.0（已接入）"),
        bulletItem("设计体系：“旧物诗学”完整设计语言 + 排版系统已优化"),

        heading2("5.2 差异化竞争力"),
        numberItem("玩法壁垒：LBS+AR对齐的技术组合难以被简单复制"),
        numberItem("审美壁垒：独特的“旧物诗学”视觉语言形成品牌辨识度"),
        numberItem("内容壁垒：信件锚定在真实地点上，用户越多内容越丰富，形成正循环"),
        numberItem("情感壁垒：“有成本的真诚”筛选出高质量内容和用户"),

        heading2("5.3 未来方向"),
        bulletItem("城市级别的内容运营：与文旅目的地合作，在特定地点预设“官方信”作为种子内容"),
        bulletItem("社交裂变：“密信口令”本身就是天然的分享机制，可扩展为邀请新用户的渠道"),
        bulletItem("AI能力深化：多模态情感识别（从照片内容推断情绪）+ 个性化润色风格学习"),
        bulletItem("跨平台：小程序版本降低使用门槛，让地图发现和写信流程更轻量"),

        new Paragraph({ spacing: { before: 600 } }),
        accentPara("用相机在真实世界留下信，让别人走到那个地方才能看见。"),
        accentPara("不是算法让我们相遇，是这座城市。")

      ]
    }
  ]
});

// ══════════════════════════════════════════════
// 输出
// ══════════════════════════════════════════════
const OUT = "E:/project/AI-letter/docs/此刻此地-项目文档.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("Document written to: " + OUT);
});
