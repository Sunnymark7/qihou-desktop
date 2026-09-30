# GitHub 调研：桌面 3D 天气

## 0.4 桌面小工具调研（2026-09-30）

| 仓库 | 查阅方向 | 本项目实现 |
| --- | --- | --- |
| [Rainmeter](https://github.com/rainmeter/rainmeter) | 桌面皮肤，GPL v2 | 四套受控皮肤；未引入其代码、运行时，不兼容第三方 Rainmeter 皮肤 |
| [StickyTop](https://github.com/tungttse/stickytop) | Electron 便签与倒计时 | 便签、倒数日统一管理和独立面板 |
| [Sticky-Notes](https://github.com/Pusplatasingh/Sticky-Notes) | 有色可编辑便签 | 三种纸张，编辑、复制、删除和显示选择 |
| [win-widget-timer](https://github.com/landenlabs/win-widget-timer) | Windows 计时与位置设置 | 位置记忆和日历倒数，不宣称实现其闹钟 |

查阅 README 和文件列表，仅参考功能思路；未运行第三方项目、复制代码或打包资产。实现自行编写，不执行远程插件、不下载安装任意 GitHub 皮肤。

核对日期：2026-09-11。范围：公开仓库 README、GitHub API 元信息、部分关键源码、供应商官方文档。没有安装或运行这些第三方项目，没有进行完整代码审计。本轮检索未发现可直接满足“地址天气 + 3D 地标 + 透明摆件 + 托盘 + 动态壁纸”全部需求的已验证成品。

## 1. 优先参考的项目

| 项目 | 已核对的能力 | 对本项目的参考价值 | 边界 |
| --- | --- | --- | --- |
| [TranslucentTB](https://github.com/TranslucentTB/TranslucentTB) | Windows 任务栏工具；托盘菜单中的开机启动入口；原生托盘实现 | 常驻生命周期、托盘菜单、Explorer 重启后的图标恢复 | 本身不提供天气、3D 场景或桌面壁纸宿主 |
| [Zebar](https://github.com/glzr-io/zebar) | 基于原生 WebView 的桌面组件；托盘打开管理界面；组件启动配置；天气 provider | Web 场景作为桌面组件的组织方式、配置和托盘分工 | 需另建 3D 天气与地标逻辑；依赖其宿主会改变独立应用的交付方式 |
| [Lively Wallpaper](https://github.com/rocksdanister/lively) | 动态壁纸、网页渲染、多种播放规则；全屏、电池和远程桌面时暂停 | 二期壁纸宿主、暂停策略和 Windows 桌面挂载 | 比单个摆件的范围大，适合作为参考和可选集成对象 |
| [YetAnotherWeatherApp](https://github.com/SkorczanFFF/YetAnotherWeatherApp) | Three.js/R3F 天气场景；雨雪雾、云、太阳/月亮、雷电；位置搜索和天气调试 | 最贴近天气驱动 3D 效果的参考，尤其是把数据映射到粒子和光照 | 网页应用，非托盘桌面成品；本次未确认明确的代码许可证 |
| [weather-vivarium](https://github.com/cportka/weather-vivarium) | 像素天气微缩景观；当地昼夜、天气、地貌和地标匹配 | 最贴近“地点 + 天气 + 微缩地标”产品概念；参考目录和默认回退机制 | 是 2D 像素画，不是 3D 模型方案 |
| [weather-app-threejs](https://github.com/originalsidd/weather-app-threejs) | 3D 地球与城市天气查询 | 经纬度到场景、查询与镜头联动 | 地球仪方向，与桌面地标摆件差距较大；本次未确认明确许可证 |
| [Three.js](https://github.com/mrdoob/three.js) | 3D 渲染基础库 | 自建场景的候选基础依赖 | 不是现成天气产品 |

上述功能来自各项目自己的说明；参考价值及取舍为本次设计判断，不是运行验证结论。

## 2. 仓库状态快照

以下由 GitHub REST API 当次返回，star 数只作为快照，不能证明稳定性。`pushed_at` 是仓库最近推送时间，不等同于正式发布或默认分支最后提交时间。七个仓库当次均未归档。

| 仓库 | Stars | 最近推送（UTC） | GitHub 返回许可证 |
| --- | ---: | --- | --- |
| TranslucentTB/TranslucentTB | 20,301 | 2026-09-10 | GPL-3.0 |
| glzr-io/zebar | 3,054 | 2026-03-31 | GPL-3.0 |
| rocksdanister/lively | 19,583 | 2026-04-30 | GPL-3.0 |
| SkorczanFFF/YetAnotherWeatherApp | 1 | 2026-04-19 | 未识别 |
| cportka/weather-vivarium | 0 | 2026-08-09 | MIT |
| originalsidd/weather-app-threejs | 5 | 2023-03-01 | 未识别 |
| mrdoob/three.js | 115,388 | 2026-09-10 | MIT |

元信息接口格式：`https://api.github.com/repos/{owner}/{repo}`。本轮只参考设计和架构，未复制第三方代码或模型；若以后引入代码，应逐项核对许可证原文，代码许可也不替代模型资产授权。

## 3. 关键源码落点

### 托盘恢复

实际查看了 [TranslucentTB trayicon.cpp，固定提交](https://github.com/TranslucentTB/TranslucentTB/blob/d4636e439865df0a1a1419db408e055740ce5c74/TranslucentTB/tray/trayicon.cpp)。其中使用 `Shell_NotifyIcon`，处理 `TaskbarCreated` 对应消息并进行图标状态恢复。对本项目的结论：不能只验证第一次创建托盘，还要把 Explorer 重启列入验收。

### 桌面挂载

实际查看了 [Lively WinDesktopCore.cs，固定提交](https://github.com/rocksdanister/lively/blob/c1036feb664960722e34bf4309042c247d6a909d/src/Lively/Lively/Core/WinDesktopCore.cs)，存在 WorkerW、Progman、桌面窗口句柄和销毁事件处理。对本项目的结论：壁纸模式有独立的桌面生命周期，不能简单等同于透明窗口置底；其兼容性需针对系统版本验证。

### 天气渲染容器

实际查看了 [YetAnotherWeatherApp WeatherScene.tsx，固定提交](https://github.com/SkorczanFFF/YetAnotherWeatherApp/blob/97df8857ac8be1b39209feb746c794295e4db6b5/src/weather-scene/WeatherScene.tsx)，使用 R3F Canvas。其 README 描述了分离的天气效果、风和场景模块。对本项目的结论：天气语义映射应与窗口宿主分离，便于摆件和壁纸共用。

## 4. 技术选型证据

- Tauri 官方提供[系统托盘 API](https://v2.tauri.app/learn/system-tray/)，支持菜单和托盘事件。可以分别设置左右键行为。
- Tauri [窗口配置](https://v2.tauri.app/reference/config/)包含透明窗口及 `skipTaskbar`。这些 API 的存在不等于本机透明 WebGL 合成、穿透和休眠恢复已通过测试。
- [Tauri 窗口 API](https://v2.tauri.app/reference/javascript/api/namespacewindow/)提供忽略鼠标事件等控制。整体鼠标穿透与按透明像素穿透应分开处理。
- [Tauri issue #15947](https://github.com/tauri-apps/tauri/issues/15947)报告了 Windows 10 上透明 WebGL 窗口在频繁切换鼠标穿透等条件下偶发黑色合成问题。它是问题报告，不是所有设备都会复现或根因已确认的结论。设计因此优先采用明确的“编辑/锁定”模式，避免逐帧切换穿透。

## 5. 天气和地址能力

| 候选 | 核实内容 | 设计含义 |
| --- | --- | --- |
| [Open-Meteo 天气 API](https://open-meteo.com/en/docs) | current 条件基于 15 分钟天气模型数据；支持天气码、降水、风、云量等字段 | 适合原型；连续动画不能标成秒级实测；必须保存时间和单位 |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | 地名检索与坐标信息 | 可作为城市/地点搜索入口，不能直接宣称覆盖任意门牌地址 |
| [Open-Meteo 服务方案](https://open-meteo.com/en/pricing) | 免费 API 面向非商业使用，有限流且无可用性保证；商业端点另有方案 | 发布方案应与商业模式匹配，暂不锁定费用和套餐 |
| [和风天气 City Lookup](https://dev.qweather.com/en/docs/api/geoapi/city-lookup/) | 城市查询、位置 ID、行政区、经纬度、时区等 | 可作为另一位置服务候选；城市检索仍不等同于详细地址解析 |

本轮未用用户的地址发起定位或天气请求，也未实测国内网络质量。供应商选择仍需目标地区的样本验证。首选先统一数据格式，保留替换能力，不在第一版引入复杂的多源融合。

## 6. 研究结论

建议独立实现应用，组合参考：TranslucentTB 的常驻交互、Zebar 的桌面组件组织、YetAnotherWeatherApp 的天气效果分层、weather-vivarium 的地标匹配思路，以及 Lively 的壁纸生命周期。不要把其中任何一个仓库描述为本项目已完成的基础。
