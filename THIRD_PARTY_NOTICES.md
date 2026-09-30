# Third-party notices

本项目没有复制调研仓库中的业务代码或模型。内置三维几何和图标由本项目代码创建。

主要运行依赖：

- Three.js — MIT. https://github.com/mrdoob/three.js
- Electron — MIT，且随发行包包含 Chromium 及其他第三方许可文件。https://github.com/electron/electron
- Koffi — MIT. https://github.com/Koromix/koffi
- electron-updater / electron-builder — MIT. https://github.com/electron-userland/electron-builder

具体依赖版本见 package-lock.json。Three.js 原文另存于 assets/LICENSE.three.txt（随 app.asar 打包）；Koffi 保留原生依赖许可。发行文件夹中的 LICENSE.electron.txt 和 LICENSES.chromium.html 应随程序一同保留。

天气/地理编码：Open-Meteo，https://open-meteo.com/ 。数据来源、署名与商业服务条件以其官方条款为准；本原型使用免费端点，不因此获得无限额或商业服务授权。

MET Norway — https://www.met.no/en 。数据采用 Creative Commons Attribution 4.0（https://creativecommons.org/licenses/by/4.0/），本项目对字段、单位及天气描述做归一化处理，提供方不背书本应用。使用规则见 https://docs.api.met.no/doc/TermsOfService 。

和风天气 — https://www.qweather.com/ ，数据署名与声明：https://developer.qweather.com/attribution.html 。使用个人 API Host 与密钥，按个人账号授权和配额访问。

OpenWeather — https://openweathermap.org/ ，使用个人 API Key，按个人账号的订阅与条款访问。接入当前天气接口不代表已取得其他产品授权。

五月的风模型参考实物照片观察轮廓后由程序化几何创建；未将摄影作品或第三方模型打包。具体来源见 docs/may-wind.md。调研来源见源工作区 docs/github-research.md。
