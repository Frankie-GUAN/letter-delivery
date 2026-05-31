const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType,
        LevelFormat, AlignmentType: AT, PageNumber, PageBreak } = require('docx');

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 24 } },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial', color: '333333' },
        paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 }
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: '555555' },
        paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 }
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: '777777' },
        paragraph: { spacing: { before: 120, after: 120 }, outlineLevel: 2 }
      },
    ]
  },
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          }
        ]
      },
      {
        reference: 'numbers',
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          }
        ]
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

      // ===== 标题页 =====
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2400, after: 400 },
        children: [new TextRun({ text: '此刻·此地', bold: true, size: 48, font: 'Arial' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: '基于位置的书信发现与投递平台', size: 28, font: 'Arial', color: '888888' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600, after: 400 },
        children: [new TextRun({ text: '项目介绍文档', size: 32, font: 'Arial', bold: true, color: 'C4852A' })]
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // ===== 一、产品定位 =====
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('一、产品定位')] }),
      new Paragraph({
        spacing: { after: 300 },
        children: [new TextRun({ text: '一句话定位：', bold: true }), new TextRun('用相机在真实世界留下和发现信件的情感社交平台')]
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('目标人群')] }),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 3120, 3120],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA }, shading: { fill: 'E8D5B8', type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: '人群', bold: true })] })] }),
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA }, shading: { fill: 'E8D5B8', type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: '典型场景', bold: true })] })] }),
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA }, shading: { fill: 'E8D5B8', type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: '核心价值', bold: true })] })] }),
            ]
          }),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('旅行者 / 城市探索者')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('在陌生城市留下足迹，或发现前人留下的惊喜')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('将旅行记忆锚定在真实坐标，创造"跨越时空的偶遇"')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('情侣 / 密友')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('在共同去过的地方互寄密信')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('用只有彼此知道的口令，在真实地点传递私密情感')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('自我对话者')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('给未来的自己写时光胶囊')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('让时间成为信件的守护者，在合适的时刻自动解锁')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('文艺青年 / 表达者')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('在喜欢的角落留下公开信')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('让文字脱离屏幕，扎根于真实世界的某个角落')] })] }),
          ]}),
        ]
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // ===== 二、解决的痛点 =====
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('二、解决的痛点')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('现有产品的空白')] }),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2340, 3120, 3900],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA }, shading: { fill: 'E8D5B8', type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: '痛点', bold: true })] })] }),
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA }, shading: { fill: 'E8D5B8', type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: '现有产品', bold: true })] })] }),
              new TableCell({ borders, width: { size: 3900, type: WidthType.DXA }, shading: { fill: 'E8D5B8', type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: '此刻·此地的解决方案', bold: true })] })] }),
            ]
          }),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('数字内容无法锚定真实地点')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('微信/朋友圈是基于人的，不是基于地的')] })] }),
            new TableCell({ borders, width: { size: 3900, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('信件与 GPS 坐标强绑定，必须在真实地点才能发现')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('"路过"的惊喜感消失')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('所有内容都是主动刷出来的')] })] }),
            new TableCell({ borders, width: { size: 3900, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('AR 相机模式：走到附近，信封才会从现实中"浮现"')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('时光胶囊缺少仪式感')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('日历提醒/备忘录，打开时没有空间感')] })] }),
            new TableCell({ borders, width: { size: 3900, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('必须人到达那个地方，胶囊才会解锁——地点本身就是钥匙')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('私密传递需要专门工具')] })] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('密信需要另外分享链接/二维码')] })] }),
            new TableCell({ borders, width: { size: 3900, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('生成 8 位口令，对方在相机中"对准那个地方"输入口令即可开启')] })] }),
          ]}),
        ]
      }),

      new Paragraph({ spacing: { before: 400, after: 200 }, heading: HeadingLevel.HEADING_2, children: [new TextRun('用户价值')] }),
      new Paragraph({ numbering: { reference: 'numbers', level: 0 },
        children: [new TextRun({ text: '空间维度的情感连接：', bold: true }), new TextRun('让文字不再漂浮在云端，而是扎根于你走过的土地')] }),
      new Paragraph({ numbering: { reference: 'numbers', level: 0 },
        children: [new TextRun({ text: '偶遇的惊喜：', bold: true }), new TextRun('不是算法推荐，而是你真的走到了那个坐标，才配发现那封信')] }),
      new Paragraph({ numbering: { reference: 'numbers', level: 0 },
        children: [new TextRun({ text: '仪式感：', bold: true }), new TextRun('AR 信封从幽灵→模糊→打开→解锁的四级渐进，让"发现"本身成为体验')] }),
      new Paragraph({ numbering: { reference: 'numbers', level: 0 },
        children: [new TextRun({ text: '零门槛：', bold: true }), new TextRun('无需注册、无需下载，浏览器即可使用')] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ===== 三、实现方案简述 =====
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('三、实现方案简述')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('技术架构')] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '前端：', bold: true }), new TextRun('Vanilla JS + IndexedDB + Web Audio API；CSS 3D Transform 实现 AR（无 WebGL 依赖）')] }),
      new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: '后端：', bold: true }), new TextRun('Node.js + Express + JSON 文件存储；30 秒双向同步')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('核心模块')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun('1. 计算机视觉定位校验（CV Alignment）')] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun('不只依赖 GPS（精度 5-20m），还用 Canvas 2D 提取场景特征向量（256 维），只有当你把相机对准'), new TextRun({ text: '当年拍照时的同一角度', bold: true }), new TextRun('，对齐度 ≥ 90% 才允许开启信件。')] }),
      new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: '流程：', bold: true }), new TextRun('拍照时：场景 → 256维特征向量 → 存入信件；发现时：当前画面 → 256维特征向量 → 余弦相似度计算 → 对齐度%')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun('2. 纯 CSS 3D AR 信封系统')] }),
      new Paragraph({ spacing: { after: 300 }, children: [new TextRun('不依赖 Three.js / WebXR，仅用 CSS transform（rotateY/rotateX/translateZ）+ perspective: 800px 实现 3D 信封，结合 DeviceOrientation API 实现抬头/低头控制视角。')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun('3. 三级书信类型')] }),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2000, 3000, 4360],
        rows: [
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, shading: { fill: 'E8D5B8', type: ShadingType.CLEAR },
              children: [new Paragraph({ children: [new TextRun({ text: '类型', bold: true })] })] }),
            new TableCell({ borders, width: { size: 3000, type: WidthType.DXA }, shading: { fill: 'E8D5B8', type: ShadingType.CLEAR },
              children: [new Paragraph({ children: [new TextRun({ text: '解锁条件', bold: true })] })] }),
            new TableCell({ borders, width: { size: 4360, type: WidthType.DXA }, shading: { fill: 'E8D5B8', type: ShadingType.CLEAR },
              children: [new Paragraph({ children: [new TextRun({ text: '典型场景', bold: true })] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: '公开信', bold: true })] })] }),
            new TableCell({ borders, width: { size: 3000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('距离 < 10m（可选 CV 对齐）')] })] }),
            new TableCell({ borders, width: { size: 4360, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('在景点/咖啡馆留下感悟')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: '时光胶囊', bold: true })] })] }),
            new TableCell({ borders, width: { size: 3000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('到达地点 + 时间已到 + 共埋者全部开启')] })] }),
            new TableCell({ borders, width: { size: 4360, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('给一年后在同一个地方的自己')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: '密信', bold: true })] })] }),
            new TableCell({ borders, width: { size: 3000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('到达地点 + 输入 8 位口令')] })] }),
            new TableCell({ borders, width: { size: 4360, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('给特定人的私密传递')] })] }),
          ]}),
        ]
      }),

      new Paragraph({ spacing: { before: 400 }, heading: HeadingLevel.HEADING_3, children: [new TextRun('4. 程序化音效引擎')] }),
      new Paragraph({ spacing: { after: 300 }, children: [new TextRun('无外部音频文件，全部通过 Web Audio API 实时合成：纸张翻动（棕噪声）、火漆封印（低频闷响+高频碎裂）、快门（白噪声+振动反馈）。支持用户偏好设置（prefers-reduced-motion）。')] }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== 四、核心创新点 =====
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('四、核心创新点')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('创新点一：CV 增强的地理位置校验')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '痛点：', bold: true }), new TextRun('GPS 告诉你"到了"，但 CV 告诉你"你看到的就是当年那个角度"')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('256 维场景特征向量（4×4 网格 × 16 方向直方图）')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('余弦相似度 + Sigmoid 映射为 0-100% 对齐度')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('四级渐进式 AR 信封反馈（Ghost → Faint → Open → Unlocked）')] }),
      new Paragraph({ spacing: { after: 300 }, bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '创新价值：', bold: true }), new TextRun('将"位置"从二维坐标升级为"三维视角+场景外观"，大幅提升信件锚定的精确度与仪式感')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('创新点二：无 WebGL 的纯 CSS 3D AR')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '痛点：', bold: true }), new TextRun('移动端浏览器上，依赖 Three.js / WebXR 会大幅增加包体积和性能开销')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('CSS preserve-3d + rotateY/rotateX 模拟 3D 信封')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('DeviceOrientation API 绑定手机姿态 → 信封视角跟随')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('距离 + 对齐度共同决定信封的透明度/大小/层级')] }),
      new Paragraph({ spacing: { after: 300 }, bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '创新价值：', bold: true }), new TextRun('极低性能开销，千元机也能流畅运行；不依赖 WebXR/ARKit，兼容性极强')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('创新点三：「地点」作为时光胶囊的钥匙')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '传统时光胶囊：', bold: true }), new TextRun('时间到了 → 通知你打开')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '此刻·此地：', bold: true }), new TextRun('时间到了 '), new TextRun({ text: '且', bold: true }), new TextRun(' 你人到了那个地方 → 才能打开')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('时间锁 + 空间锁双重验证')] }),
      new Paragraph({ spacing: { after: 300 }, bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('支持「共埋」：多人各自写一封信，全部就位后才集体解锁')] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('创新点四：程序化音效 + 零音频文件')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '痛点：', bold: true }), new TextRun('音频文件增大部署体积，且难以参数化调整')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('11 种音效（纸张、快门、火漆、翻页、成就和弦等）')] }),
      new Paragraph({ bullet: { reference: 'bullets', level: 0 }, children: [new TextRun('棕噪声 / 白噪声 / 正弦波 / 三角波组合合成')] }),
      new Paragraph({ spacing: { after: 300 }, bullet: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: '创新价值：', bold: true }), new TextRun('降低部署成本，音效可参数化调整，为后续 AI 生成音效留出接口')] }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== 五、项目亮点总结 =====
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('五、项目亮点总结')] }),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 6240],
        rows: [
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA }, shading: { fill: 'E8D5B8', type: ShadingType.CLEAR },
              children: [new Paragraph({ children: [new TextRun({ text: '维度', bold: true })] })] }),
            new TableCell({ borders, width: { size: 6240, type: WidthType.DXA }, shading: { fill: 'E8D5B8', type: ShadingType.CLEAR },
              children: [new Paragraph({ children: [new TextRun({ text: '亮点', bold: true })] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: '体验设计', bold: true })] })] }),
            new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('四级渐进式 AR 信封，让"发现"从瞬间变为过程')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: '技术选型', bold: true })] })] }),
            new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('纯原生 JS，零框架依赖，首屏加载 < 1s')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: '情感设计', bold: true })] })] }),
            new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('三种信件类型覆盖"公开表达 / 自我对话 / 私密传递"全谱系')] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: '可扩展性', bold: true })] })] }),
            new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun('CV 特征向量可升级为神经网络提取；同步协议支持多后端')] })] }),
          ]}),
        ]
      }),

      new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '———', color: 'C4852A' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
        children: [new TextRun({ text: '项目仓库：[填写 GitHub/Gitee 地址]', color: '555555', size: 20 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '在线体验：[填写部署地址]', color: '555555', size: 20 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 },
        children: [new TextRun({ text: '技术栈：Vanilla JS · IndexedDB · Node.js · Web Audio API · CSS 3D Transform', color: '888888', size: 18 })] }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('e:/桌面/letter/letter-delivery/此刻·此地-项目介绍.docx', buffer);
  console.log('文档生成成功：此刻·此地-项目介绍.docx');
}).catch(err => {
  console.error('生成失败：', err);
});
