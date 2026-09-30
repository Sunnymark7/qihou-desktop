# 软件图标制作记录

2026-09-11 使用 ChatGPT 内置 image_gen 生成正式图标。首次请求返回 HTTP 429；用户再次要求生成后，重试成功。图案为白云、金色太阳、绿色悬浮岛屿及森林绿圆角底板，无文字。透明背景原稿已保存在 assets/icon-master.png。

Windows ICO 由 scripts/prepare-icon.cjs 将原稿转换成 16/24/32/48/64/128/256 像素多尺寸资源，同时生成 256 像素应用 PNG 与 32 像素托盘 PNG，保留透明度。转换只用于打包，不重新绘制图案。高清原稿不随安装包分发。

## 本次实际使用的提示词

Use case: logo-brand. Create the final Windows app icon for 栖候, a desktop 3D miniature weather app. Single centered rounded-square icon, a large sculptural ivory-white cloud with three rounded lobes, a small warm golden sun peeking behind its upper right, above one simple miniature moss-green floating island plinth. Deep forest-green rounded-square backplate (#345f4d), restrained cozy 3D clay material, soft directional lighting, clear silhouette readable at 32 pixels, excellent figure-ground contrast, few large forms. Orthographic near-front view. No buildings or tiny details, no text, no letters, no watermark, no surrounding mockup. Square 1024px master artwork, icon fills 88% of canvas with even margins. Actual transparent alpha outside rounded tile, no checkerboard drawn into image, preserve crisp clean contour.

生成文件：exec-ab471c7e-9697-49ea-b164-d4c147370aef.png。使用内置工具，无外部 CLI/API 调用。
