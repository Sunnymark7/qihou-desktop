---
name: 栖候（暂定）
description: Windows 桌面微缩天气原型的已实现视觉系统
colors:
  green: "#0066d6"
  ink: "#20242b"
  muted: "#626975"
  line: "#dce0e7"
  page-bg: "#f5f6f9"
  surface: "#fff"
  sidebar-bg: "#eaf0f7"
  preview-bg: "#e9eee5"
  nav-selected: "#dce6d5"
  widget-surface: "#f7f9f0eb"
  grass: "#8da979"
  stone: "#c5bca6"
  wood: "#a06943"
  roof: "#bc7255"
  cream: "#f1e7ce"
  leaf: "#527d5c"
  water: "#88b9c0"
typography:
  display:
    fontFamily: "\"Segoe UI Variable\", \"Segoe UI\", \"Microsoft YaHei UI\", sans-serif"
    fontSize: "88px"
    fontWeight: 350
    lineHeight: 1.15
    letterSpacing: "-5px"
  headline:
    fontFamily: "\"Segoe UI Variable\", \"Segoe UI\", \"Microsoft YaHei UI\", sans-serif"
    fontSize: "27px"
    fontWeight: 620
    letterSpacing: "-0.5px"
  title:
    fontFamily: "\"Segoe UI Variable\", \"Segoe UI\", \"Microsoft YaHei UI\", sans-serif"
    fontSize: "18px"
    fontWeight: 600
  body:
    fontFamily: "\"Segoe UI Variable\", \"Segoe UI\", \"Microsoft YaHei UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "\"Segoe UI Variable\", \"Segoe UI\", \"Microsoft YaHei UI\", sans-serif"
    fontSize: "11px"
    fontWeight: 400
  widget-temperature:
    fontFamily: "\"Segoe UI Variable\", \"Segoe UI\", \"Microsoft YaHei UI\", sans-serif"
    fontSize: "31px"
    fontWeight: 450
    lineHeight: 1.2
    letterSpacing: "-1px"
rounded:
  chip: "5px"
  field: "6px"
  control: "7px"
  readout: "10px"
  preview: "12px"
  dialog: "14px"
spacing:
  gap-small: "6px"
  gap-control: "9px"
  gap-field: "10px"
  gap-row: "12px"
  gap-workspace: "28px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
    typography: "{typography.body}"
  button-subtle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
    typography: "{typography.body}"
  button-text:
    textColor: "#536a5a"
    padding: "6px 0"
    typography: "{typography.label}"
  button-icon:
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    width: "32px"
    height: "32px"
  search-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 11px"
    height: "42px"
  nav-item-active:
    backgroundColor: "{colors.nav-selected}"
    textColor: "#294a37"
    rounded: "{rounded.control}"
    padding: "13px 15px"
  weather-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "7px 10px"
    typography: "{typography.label}"
  model-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 12px"
  widget-readout:
    backgroundColor: "{colors.widget-surface}"
    textColor: "#314e32"
    rounded: "{rounded.readout}"
    padding: "11px 15px"
  toggle-switch:
    backgroundColor: "#cbd5c5"
    rounded: "20px"
    width: "30px"
    height: "18px"
---

# Design System: 栖候（暂定）

## Overview

**Creative North Star: "桌面微缩气象园（实现描述，暂定称谓）"**

一块有厚度的微缩岛屿承载小屋或地标，植被、溪流、云层和光照表达地点与天气。设置界面使用浅灰绿底色、细分隔线和系统字体，场景与天气读数形成两个明确的视觉重心。

“栖候”和本页的风格称谓均为实现阶段的可调整默认值；它们不是用户批准的品牌规范。本次直接实现并审阅真实 WebGL / Electron 渲染，未制作或批准图像 comp，这一流程偏差已披露。本文以当前代码和实际截图为准，不将调研阶段提案写成已批准事实。

事实来源：`src/style.css`、`src/main.ts`、`src/scene.ts`，产品与方向依据为 `PRODUCT.md`、`docs/implementation-brief.md`；渲染依据为 `.test-data/settings-compact.png`、`.test-data/widget-cottage.png`、`.test-data/settings-display.png`（2026-09-11）。当前实现采用 Electron、TypeScript 与 Three.js。此文仅归档视觉系统，功能验收记录见 `docs/validation.md`。

**Key Characteristics:**
- 低饱和自然色与暖色屋顶并置。
- 温度大字、细节小字，地点、单位和数据时间分别可读。
- 设置面板以色面和细线分组，桌面摆件使用透明宿主与独立读数。
- 动画服从天气状态、暂停和减少动态效果设置。

## Colors

绿色组织控件与植被，石色承托场景，暖色屋顶构成模型的主要色彩对比；颜色精确值以 frontmatter 为准。

### Primary

- **操作深绿（green）**：主要按钮、链接与输入光标；选中导航使用更浅的 **选择灰绿（nav-selected）**。
- **植被绿（grass / leaf）**：分别用于地表与树冠，不替代控件状态色。

### Secondary

- **瓦陶色（roof）与木色（wood）**：小屋屋顶、树干等场景材质，增强模型辨认度。
- **溪水蓝（water）**：微缩岛屿的水道。

### Neutral

- **文字墨绿（ink）与说明灰绿（muted）**：主要文字和辅助说明。
- **页面浅灰（page-bg）、白色控件（surface）、侧栏灰绿（sidebar-bg）与预览浅绿（preview-bg）**：用明度区分操作区域。
- **分隔线灰绿（line）**：天气详情、运行选项和内容分区的细线。
- **半透明读数底（widget-surface）**：覆盖在桌面上的地点与温度容器。
- **地台石色（stone）与墙面奶油色（cream）**：3D 材质的基础色；屏幕结果受光照与色调映射影响，不能拿截图取色替代材质值。

## Typography

**Display Font / Body Font:** Segoe UI Variable、Segoe UI、Microsoft YaHei UI 与系统 sans-serif 回退。无独立展示字体或等宽字体。字号是 CSS 像素；截图受 Windows 缩放影响，不用截图像素倒推 token。

### Hierarchy

- **Display**：天气页温度，使用 frontmatter 的 display 角色；等宽数字、紧字距和轻字重强调读数。千像素以内降至（75px），窄屏为（73px）；度数另用上对齐的小字号。
- **Headline**：页面标题使用 headline；窄屏降至（23px）。
- **Title**：检查器标题使用 title；场景说明与小标题另有（16px / 14px / 13px）层级。
- **Body**：页面说明和表单正文采用 body；实际行高随上下文在（1.6–1.9）之间变化，无统一比例字号尺度。
- **Label**：控件说明、来源、数据时间和逐小时标签采用 label；当前实现统一最低常用字号为（11px）。
- **Widget temperature**：桌面读数使用独立角色；壁纸模式放大到（43px）。

## Layout

设置页是窄导航加内容区。默认侧栏宽（190px），主内容内边距（31px 34px 18px）、最大宽（1600px）；场景与检查器按（1.5:1）分栏，间隔使用 gap-workspace。场景区高（390px），检查器有（465px）最大高度与独立纵向滚动。逐小时区域位于主区底部，采用细竖条、温度和降水概率的横向序列。

- 宽度至少（1300px）：主区内边距（40px 50px 25px），分栏比（1.7:1）、间隔（38px），场景高（460px），检查器最大高（535px）。
- 宽度不超过（1000px）：侧栏收至（158px），分栏比（1.25:1）、间隔（20px），场景高（365px），检查器最大高（440px），小时序列仅显示前九项。
- 宽度不超过（760px）：导航横排置顶，场景与详情单列，检查器取消高度限制；小时序列仅显示前七项，天气指标横排。
- 宽度不超过（440px）：隐藏品牌图标、缩小横向留白，地点按钮文字截断，场景高（330px）。

摆件宿主透明，3D 区域高度为窗口高度减（60px），天气读数居于底部；读数最大宽度（88%），地点过长以省略号处理。工具条在悬停或键盘焦点进入时显现。壁纸模式填满宿主，读数位于距底部（8vh）处。截图中透明区域被查看器显示成黑色，不属于界面色板。

## Elevation & Depth

设置页主要以浅色色面和细边线表达层级，没有为每个设置项添加阴影。浮层与桌面读数使用有限的柔和阴影；真实 3D 场景则通过地台厚度、投影、正交相机和材质粗糙度建立体积。

### Shadow Vocabulary

- **桌面读数**（`0 5px 20px #192d2114`）：将信息牌从背景中轻轻托起。
- **临时消息**（`0 7px 25px #162b2226`）：固定底部提示的局部层次。
- **地点对话框**（`0 24px 80px #243d3233`）：模态浮层；遮罩带（3px）背景模糊。

3D 模型主要使用粗糙度（0.82）的标准材质，水道使用更光滑的材质；采用软阴影、ACES 色调映射与（1.1）曝光。夜间、阴雨和晴天使用不同的实际光照强度。

## Shapes

控件以小圆角为主：天气选项、输入、动作按钮分别复用 chip、field、control；预览容器与对话框使用更大圆角，桌面读数居中。圆形仅用于状态点、开关滑块和空状态图形等局部元素。分隔线一般为（1px）。3D 地台为圆角矩形厚板，植物为低面几何体，云层由柔和球体组合。

## Components

### Buttons

主要动作是深绿实底、白字、control 圆角、最小高（40px），hover 加深为（#274d3d）。次要动作使用白底细边框，hover 为浅绿。文字按钮用于更新、恢复与来源；图标按钮默认透明，仅悬停时显底。

按钮的背景、文字与边框过渡为（160ms）；按下移动（1px）。键盘焦点为（2px）绿色轮廓并外偏移（4px）；禁用按钮透明度（0.48）。系统减少动态效果开启后移除 CSS transition。

### Inputs / Fields

地点搜索以图标加无边框输入组合在 field 圆角容器内，输入高（42px），容器 focus-within 使用（2px）轮廓和（2px）偏移。坐标输入为独立白底细边框字段。占位文字与真实输入分色，搜索状态和错误由相邻文字表达。运行选项保留原生 range / select 行为；自定义开关为（30×18px），滑块直径（12px），选中后位移（12px），transition 为（150ms）。

### Navigation

三个文本加线性 SVG 图标的导航项分别对应天气、场景、桌面与运行；选中项浅绿实底、较深文字和加粗。默认字号（13px），hover 为浅绿色面；当前页写入 aria-current，窄屏改为横向排列。图标为圆头圆角连线，标准描边（1.6）。

### Chips

天气效果选择使用小矩形圆角按钮；默认白底细边框，选中为（#3e614b）实底白字。演示状态另外显示带暖色边框与底色的“演示天气”标签，不能只凭 chip 颜色区分真实天气和演示。

### Cards / Containers

场景预览使用 preview 圆角、浅绿底与细边框，画布、标题和底部控制区共同构成容器。模型选项为全宽按钮式卡片，白底、control 圆角、最小高（78px）；选中后改变边框与背景并显示对勾。桌面天气读数是可打开设置的按钮，使用半透明底、readout 圆角与轻阴影。

### Weather Scene

正交视角俯看统一岛屿，默认小屋、上海东方明珠和广州塔共享植被、水道与路径。设置预览可水平拖动旋转；连续动态表达云层、雨雪及风向。天气文字独立于 WebGL；渲染失败保留文字退路。暂停、减少动态效果或宿主隐藏会影响动画调度，天气数据更新保持独立。sidecar 只提取真实 DOM 控件，不以静态 CSS 仿造 WebGL 模型。

## Do's and Don'ts

### Do:

- Do 沿用现有绿色动作与选择状态、浅色设置底面及自然材质场景。
- Do 保留真实天气、演示天气、离线缓存和数据时间的可辨认文字。
- Do 让按钮与输入保留键盘焦点，并在减少动态效果时保留静态天气与数据更新。
- Do 将新增模型放入同一微缩岛屿、正交视角和柔和光照体系中。

### Don't:

- Don't 把暂定产品名、风格描述或程序化示意模型写成用户批准的最终品牌。
- Don't 将透明摆件截图中的黑色显示底当成产品背景色。
- Don't 用装饰动画替代数据新旧说明，或让演示天气改变桌面真实天气。
- Don't 把文档中的合成色阶用于新增界面状态；它们仅供文档面板展示。

## 0.2.2 扩展

保留原有深绿与浅灰界面。导航扩展为天气、场景、桌面与运行、天气来源；场景含 16 城市、15 天气效果及风力预览。桌面模型可直接拖动位置，设置预览拖动旋转。云朵在岛屿后方持续漂移。程序图标使用 ChatGPT 生成的白云、金色太阳与绿色悬浮岛屿，原稿见 assets/icon-master.png。NSIS 安装向导支持选择目录及用户范围。

## 0.2.3 修订

桌面不含工具条或可点击读数，只保留模型拖动与天气显示，设置从托盘进入。设置左上角使用应用 PNG 图标。雨滴有实际几何粗细，雪花固定屏幕像素，雾层低处漂移；保留后方云层避免遮挡地标。

## 0.5 Apple 设计方向

用户明确指定的设计方向：系统字体、清晰层级、蓝色操作色、功能分组和轻量材质。侧栏使用结构性半透明，操作区与图表使用实色；不叠加玻璃卡片，不仿制 macOS 窗口按钮。src/apple.css 为此方向的集中样式；旧场景与皮肤颜色保留。响应按钮在按下时反馈，预览旋转直接跟随指针并支持惯性、方向键与 Home；系统或设置减少动态时禁用惯性。首次引导三步，支持跳过、返回、更换地点和重看。
