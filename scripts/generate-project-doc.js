const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType,
        LevelFormat, PageBreak } = require('docx');

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };
const headerShading = { fill: 'E8D5B8', type: ShadingType.CLEAR };

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 24 } },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial', color: 'C4852A' },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 }
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: '6B5A3E' },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 }
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: '3B2E1A' },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 2 }
      },
    ]
  },
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: 'numbers',
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [

      // ========== 封面 ==========
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 200 },
        children: [new TextRun({ text: '此刻·此地', bold: true, size: 72, font: 'Arial', color: 'C4852A' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
        children: [new TextRun({ text: 'MOMENT · PLACE', italics: true, size: 28, font: 'Arial', color: '8C7B5E' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 400 },
        children: [new TextRun({ text: '以相机为媒介的地点信件互动作品', size: 28, font: 'Arial', color: '8C7B5E' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 },
        children: [new TextRun({ text: '抖音AI创变者大赛 · 2026年5月', size: 24, font: 'Arial', color: '999999' })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ============================================================
      // 一、项目概览
      // ============================================================
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('一、项目概览')] }),
      new Paragraph({ spacing: { after: 200 },
        children: [
          new TextRun({ text: '项目名称：', bold: true }),
          new TextRun('此刻·此地（MOMENT · PLACE）'),
        ] }),
      new Paragraph({ spacing: { after: 200 },
        children: [
          new TextRun({ text: '一句话介绍：', bold: true }),
          new TextRun('一款基于真实地理位置与AR相机取景器的书信发现与投递平台——走到那个地方，举起相机，对准当年的角度，信封才会从取景器中浮现。'),
        ] }),
      new Paragraph({ spacing: { after: 300 },
        children: [
          new TextRun({ text: '产品类型：', bold: true }),
          new TextRun('Web App（浏览器即用，无需下载安装）'),
        ] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ============================================================
      // 二、为什么做 (Why)
      // ============================================================
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('二、为什么做（Why）')] }),

      // 2.1 受众
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('1. 受众是谁？')] }),
      new Paragraph({ spacing: { after: 120 },
        children: [
          new TextRun({ text: '核心人群：', bold: true }),
          new TextRun('Z世代城市青年（18-28岁）'),
        ] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('热爱探索城市角落，对线下趣味社交有强烈需求')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('在数字时代长大，对书信、明信片等"慢媒介"有怀旧好感')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('习惯用短视频记录生活，但渴望更深层的情感连接')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('活跃于抖音、小红书、朋友圈，乐于分享"发现感"内容')] }),
      new Paragraph({ spacing: { before: 120, after: 120 },
        children: [
          new TextRun({ text: '延伸人群：', bold: true }),
          new TextRun('旅行爱好者、异地恋人/朋友、文艺爱好者、桌游/密室逃脱爱好者'),
        ] }),
      new Paragraph({ spacing: { after: 200 },
        children: [new TextRun({ text: '使用情境：', bold: true }), new TextRun('周末Citywalk途中的偶遇、毕业季校园长椅下的时光胶囊、异地情侣初次见面地点的密信——所有这些都发生在真实地理空间中，需要物理移动来触发，强调"此时此刻此地"的在场感。')] }),

      // 2.2 创造什么
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('2. 我们想为他们创造什么？')] }),
      new Paragraph({ spacing: { after: 160 },
        children: [new TextRun('我们想创造的是一种"有成本的真诚"。')] }),
      new Paragraph({ spacing: { after: 120 },
        children: [new TextRun({ text: '故事一：', bold: true }), new TextRun('一个在杭州工作的女孩，每次回老家都会在小区门口那棵银杏树下停留片刻。那是她和已故爷爷最后一次散步的地方。如果她能在那里留下一封"时光胶囊"，写给十年后的自己——"爷爷在这里跟你说过，银杏叶黄的时候，记得回家"。十年后，她回到同一棵树下，打开这封信。')] }),
      new Paragraph({ spacing: { after: 120 },
        children: [new TextRun({ text: '故事二：', bold: true }), new TextRun('一对异地恋的情侣，在他们第一次见面的咖啡馆各自留下一封"密信"。每次想念对方的时候，就走到那个咖啡馆，打开相机，对准他们第一次坐的那个角落。在那个角度，对方留的话才会从屏幕里浮现。不是随时可以翻看的微信消息，而是必须"身体在场"才能触碰的情感。')] }),
      new Paragraph({ spacing: { after: 160 },
        children: [new TextRun('我们想传递的核心体验是：在所有人都在追求"更快、更多、更便捷"的时代，有些东西值得你"走过去、等一等、对得准"。物理移动本身就是一种诚意，而诚意本身就是最好的筛选机制。')] }),

      // 2.3 现有方案缺什么
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('3. 现有体验/方案还缺什么？')] }),
      new Paragraph({ spacing: { after: 160 },
        children: [new TextRun('我们观察和研究了几个相关领域，发现了一个共同的空白：数字世界和物理世界之间的情感断层。')] }),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2000, 3200, 4160],
        rows: [
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, shading: headerShading,
              children: [new Paragraph({ children: [new TextRun({ text: '领域', bold: true })] })] }),
            new TableCell({ borders, width: { size: 3200, type: WidthType.DXA }, shading: headerShading,
              children: [new Paragraph({ children: [new TextRun({ text: '现有方案', bold: true })] })] }),
            new TableCell({ borders, width: { size: 4160, type: WidthType.DXA }, shading: headerShading,
              children: [new Paragraph({ children: [new TextRun({ text: '缺了什么', bold: true })] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('社交媒体')] })] }),
            new TableCell({ borders, width: { size: 3200, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('微信朋友圈、抖音、小红书——点赞、评论、转发')] })] }),
            new TableCell({ borders, width: { size: 4160, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('内容漂浮在云端，与物理空间无关。发出去追逐点赞，社交变成表演。缺乏真正的深度连接和"在场感"。')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('LBS+AR 应用')] })] }),
            new TableCell({ borders, width: { size: 3200, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('Pokémon GO（抓宝）、AR导航（找路）、Snapchat（AR滤镜）')] })] }),
            new TableCell({ borders, width: { size: 4160, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('LBS+AR 全部服务于"功能"或"游戏"，没有一款产品用这个技术组合服务于"人与人的情感连接"。')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('书信/漂流瓶')] })] }),
            new TableCell({ borders, width: { size: 3200, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('邮件、私信、匿名漂流瓶、慢递服务')] })] }),
            new TableCell({ borders, width: { size: 4160, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('纯数字交流，缺少"物理地点"这个维度。漂流瓶随机分配给陌生人，没有"去赴一个人的约"的仪式感。慢递有时间的维度，但没有空间的维度。')] })] }),
          ]}),
        ]
      }),
      new Paragraph({ spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: '总结：', bold: true }), new TextRun('现有方案要么把社交变成表演，要么把AR变成工具，要么把书信局限在纯数字空间。我们想做的是让"走到那个地方"本身成为内容发现的方式，让物理移动成为诚意的证明，让相机取景器成为一扇窥见过去的窗。')] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ============================================================
      // 三、做了什么 (What)
      // ============================================================
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('三、做了什么（What）—— 三大核心功能')] }),

      // --- 功能 1 ---
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('功能 1：AR 相机取景器 —— 对准角度才能看见信')] }),
      new Paragraph({ spacing: { after: 120 },
        children: [
          new TextRun({ text: '设计意图 / 解决的问题：', bold: true }),
          new TextRun('GPS 定位精度仅 5-20 米，到达地点后"信在哪里？往哪看？"是核心困惑。我们首创"场景对齐解锁"机制：不仅需要走到地点，还需要把相机对准发信人当时拍照的角度。计算机视觉（CV）特征匹配判断你是否"看见了当年的画面"。'),
        ] }),
      new Paragraph({ spacing: { after: 120 },
        children: [
          new TextRun({ text: '核心流程：', bold: true }),
        ] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '发信时：', bold: true }), new TextRun('拍摄参考照片 → Canvas 缩放至 256×256 → 4×4 网格提取 HSV + Sobel 边缘方向 + Laplacian 亮度梯度 → 拼接为 256 维特征向量 → 存入信件数据')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '收信时：', bold: true }), new TextRun('相机实时帧每秒采样 → 同算法提取 256 维特征向量 → 余弦相似度比对 → Sigmoid 映射为 0-100% 对齐得分')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '视觉反馈：', bold: true }), new TextRun('四档梯度驱动信封动画 —— 0-30% 虚线光晕 → 30-60% 发件人浮现 → 60-90% 信纸展开 → 90%+ 完全解锁。纯前端传统 CV 方案，单帧提取 <50ms')] }),
      new Paragraph({ spacing: { before: 160, after: 120 },
        children: [new TextRun('这个功能将"位置"从二维坐标升级为"三维视角 + 场景外观"，让寻找对齐的过程本身成为一种有仪式感的体验。相机不再是拍照工具，而是一扇窥见过去的窗户。')] }),

      // --- 功能 2 ---
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('功能 2：三种信件类型 —— 覆盖"公开表达 / 自我对话 / 私密传递"全谱系')] }),
      new Paragraph({ spacing: { after: 120 },
        children: [
          new TextRun({ text: '设计意图 / 解决的问题：', bold: true }),
          new TextRun('社交产品往往只有一种互动模式（公开发布或私密聊天）。但现实中人与人的情感连接是多样化的：有些话想对世界说，有些话只想对自己说，有些话只想让特定的人看到。三种信件类型覆盖了这整个谱系。'),
        ] }),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1600, 2400, 2800, 2560],
        rows: [
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 1600, type: WidthType.DXA }, shading: headerShading,
              children: [new Paragraph({ children: [new TextRun({ text: '类型', bold: true })] })] }),
            new TableCell({ borders, width: { size: 2400, type: WidthType.DXA }, shading: headerShading,
              children: [new Paragraph({ children: [new TextRun({ text: '核心玩法', bold: true })] })] }),
            new TableCell({ borders, width: { size: 2800, type: WidthType.DXA }, shading: headerShading,
              children: [new Paragraph({ children: [new TextRun({ text: '解锁条件', bold: true })] })] }),
            new TableCell({ borders, width: { size: 2560, type: WidthType.DXA }, shading: headerShading,
              children: [new Paragraph({ children: [new TextRun({ text: '典型场景', bold: true })] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 1600, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: '公开信', bold: true })] })] }),
            new TableCell({ borders, width: { size: 2400, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('拍照 → 写留言 → AI润色 → 投放到GPS坐标')] })] }),
            new TableCell({ borders, width: { size: 2800, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('距离 < 10m + 可选CV对齐')] })] }),
            new TableCell({ borders, width: { size: 2560, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('景点打卡、咖啡馆留言、城市漫步偶遇')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 1600, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: '时光胶囊', bold: true })] })] }),
            new TableCell({ borders, width: { size: 2400, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('设定解锁时间 + 可选邀请好友共埋')] })] }),
            new TableCell({ borders, width: { size: 2800, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('时间已到 + 人到达地点 + 共埋者全部开启')] })] }),
            new TableCell({ borders, width: { size: 2560, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('毕业季留言、给未来自己的信、好友共同记忆')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 1600, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: '密信', bold: true })] })] }),
            new TableCell({ borders, width: { size: 2400, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('拍照线索 → 指定接收人 → 生成8位口令')] })] }),
            new TableCell({ borders, width: { size: 2800, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('收到口令 → 输入解锁 → 获取线索 → 实地寻找')] })] }),
            new TableCell({ borders, width: { size: 2560, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('异地情侣密信、朋友间的秘密联络')] })] }),
          ]}),
        ]
      }),
      new Paragraph({ spacing: { before: 160, after: 120 },
        children: [new TextRun('三种类型共享同一套底层——CV对齐引擎、AR信封渲染、地图罗盘导航——但每种类型的"解锁仪式"完全不同，让用户在不同场景下选择最合适的情感表达方式。')] }),

      // --- 功能 3 ---
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('功能 3：AI 润色引擎 —— 让每个人都能写出动人的信')] }),
      new Paragraph({ spacing: { after: 120 },
        children: [
          new TextRun({ text: '设计意图 / 解决的问题：', bold: true }),
          new TextRun('很多人想表达但"不会写"——怕写得不好看，怕词不达意。朋友圈和短视频的精致化让人不敢随意表达。AI润色不是替代创作，而是降低"开始写"的心理门槛。'),
        ] }),
      new Paragraph({ spacing: { after: 120 },
        children: [
          new TextRun({ text: '核心流程：', bold: true }),
        ] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '输入大白话：', bold: true }), new TextRun('用户只需写 "在西湖边看到落日，想起了你"，选择情绪标签')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '六种情绪模板：', bold: true }), new TextRun('温柔、俏皮、深情、怀念、日常、诗意 —— 覆盖不同表达需求')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'DeepSeek API 润色：', bold: true }), new TextRun('将大白话 + 情绪标签发送至 DeepSeek，生成氛围感短笺')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '离线降级：', bold: true }), new TextRun('即使网络不可用，也会降级到本地模板库（基于情绪关键词匹配预设句式），保证核心体验不中断')] }),
      new Paragraph({ spacing: { before: 160, after: 120 },
        children: [new TextRun('AI在此产品中扮演双重角色："代笔人"（润色引擎，帮用户把话说得更美）和"看门人"（CV对齐引擎，确保只有对的人在对的地方才能看到信）。一热一冷，技术服务于情感而不喧宾夺主。')] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ============================================================
      // 四、未来规划
      // ============================================================
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('四、未来规划（如果晋级，下一步怎么做）')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('近 3 个月：打磨核心体验 + 冷启动')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'Three.js 3D AR 升级：', bold: true }), new TextRun('将现有 CSS 3D 信封升级为 Three.js WebGL 渲染，增加粒子特效、实时光影、脉冲动画，向 Pokemon GO 级别的 AR 沉浸感靠拢')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'iOS Safari 兼容：', bold: true }), new TextRun('修复 iOS WebKit 下的 DeviceOrientation 权限申请、相机自动对焦、CSS 3D 渲染兼容性问题')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '种子内容运营：', bold: true }), new TextRun('邀请首批 50 位内测用户在各自城市投放"种子信件"，形成初始内容密度')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '分享裂变优化：', bold: true }), new TextRun('密信口令一键分享到微信/抖音，QR 码扫码直达，降低新用户上手门槛')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('中长期（1 年内）：从工具到社区')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '城市合作运营：', bold: true }), new TextRun('与文旅目的地、文创园区合作，在特定地点预设"官方信"作为种子内容。例如：在故宫角楼预设一封关于"紫禁城六百年"的信，游客走到角楼即可发现')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'AI 能力深化：', bold: true }), new TextRun('多模态情感识别——从用户拍摄的照片内容推断情绪倾向，自动推荐合适的润色风格；个性化润色风格学习——记住用户的表达习惯，让 AI 越来越"像你"')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '小程序版本：', bold: true }), new TextRun('微信小程序降低使用门槛，让地图发现和写信流程更轻量。小程序作为"入口"，Web App 作为"完整体验"')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '地理位置内容聚合：', bold: true }), new TextRun('当某个地点的信件密度达到阈值，自动生成"地点故事集"——这个咖啡馆有哪些人留下过什么话？形成"地点即策展"的 UGC 生态')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('商业化或落地设想')] }),
      new Paragraph({ spacing: { after: 120 },
        children: [new TextRun('我们设想了三条商业化路径，按优先级排列：')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '文旅合作（B2B）：', bold: true }), new TextRun('与景区、文创园区、城市地标合作，为特定地点定制"官方信"和 AR 互动体验。这是最自然的商业模式——景区有流量，我们有"让地点会说话"的技术。')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '情感付费（C端）：', bold: true }), new TextRun('高级信纸模板、定制火漆印章样式、AI 润色高级情绪（如"家书体""民国风"）、时光胶囊延长锁定时间等增值服务。核心功能永远免费。')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '品牌联名（B2B）：', bold: true }), new TextRun('与咖啡品牌、书店、潮玩品牌联名，在特定门店埋设"品牌信"——用户走到门店、对准特定角度才能发现限量内容或优惠。让品牌故事"长"在真实地点上。')] }),

      new Paragraph({ children: [new PageBreak()] }),

      // ============================================================
      // 五、队伍分工
      // ============================================================
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('五、队伍分工')] }),
      new Paragraph({ spacing: { after: 160 },
        children: [new TextRun('本项目由两名队员协作完成，各自角色与分工如下：')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('队员A —— 产品设计与前端开发')] }),
      new Paragraph({ spacing: { after: 120 },
        children: [
          new TextRun({ text: '角色定位：', bold: true }),
          new TextRun('产品经理 + 前端工程师'),
        ] }),
      new Paragraph({ spacing: { after: 120 },
        children: [
          new TextRun({ text: '核心职责：', bold: true }),
        ] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('产品定位与需求定义：梳理用户画像、使用场景、核心痛点，输出产品设计文档')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('"旧物诗学"视觉设计：定义色彩体系、字体系统、质感语言，输出 UI 设计稿与交互规范')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('前端核心模块开发：7 个视图（首页/地图/相机/写信/读信/信匣/偶遇）的 HTML/CSS/JS 实现')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('AR 相机取景器：CSS 3D / Three.js 信封渲染、DeviceOrientation 姿态绑定、CV 对齐反馈动画')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('Three.js 3D AR 场景升级：WebGL 信封建模、粒子特效、Raycaster 点击、动画循环')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('程序化音效设计：Web Audio API 实时合成 11 种音效（纸张/快门/火漆/成就和弦等）')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('移动端适配与性能优化：iOS Safari 兼容、WebKit 修复、触摸交互优化')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('队员B —— 后端架构与 AI 能力')] }),
      new Paragraph({ spacing: { after: 120 },
        children: [
          new TextRun({ text: '角色定位：', bold: true }),
          new TextRun('后端工程师 + AI 工程师'),
        ] }),
      new Paragraph({ spacing: { after: 120 },
        children: [
          new TextRun({ text: '核心职责：', bold: true }),
        ] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('后端服务架构：Node.js + Express REST API 设计、JSON 文件数据库、双向同步协议')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('HTTPS 部署与运维：自签名 CA 证书体系、Nginx 反向代理、局域网 HTTPS 服务搭建')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('计算机视觉引擎：256 维场景特征提取算法（HSV + Sobel + Laplacian）、余弦相似度匹配')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('AI 润色服务接入：DeepSeek API 集成、六种情绪模板设计、本地模板降级机制')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('推送通知系统：Service Worker 注册、Push API 事件推送、密信/胶囊到期提醒')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('轻量级 QR 码生成器：Reed-Solomon 纠错编码、GF(256) 运算、ISO 18004 标准兼容')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('项目文档编写：设计文档、技术文档、开发日志维护')] }),

      new Paragraph({ spacing: { before: 200, after: 120 },
        children: [new TextRun({ text: '协作模式：', bold: true }), new TextRun('两人全程紧密协作，通过 Git 分支管理分工开发、Code Review 保证质量。前端与后端通过 REST API 接口约定协同推进，每完成一个功能模块即进行联调测试。')] }),

      new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '———', color: 'C4852A' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: '用相机在真实世界留下信，让别人走到那个地方才能看见。', italics: true, size: 26, color: '8C7B5E' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
        children: [new TextRun({ text: '不是算法让我们相遇，是这座城市。', italics: true, size: 26, color: 'C4852A' })] }),

    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('E:/桌面/letter/letter-delivery/此刻此地-项目文档.docx', buffer);
  console.log('文档生成成功：此刻此地-项目文档.docx');
}).catch(err => {
  console.error('生成失败：', err);
});
