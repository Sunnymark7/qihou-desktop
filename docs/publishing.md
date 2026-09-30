# GitHub 与 OTA

仓库：https://github.com/Sunnymark7/qihou-desktop 。NSIS 使用 electron-updater 6.8.9 与 GitHub Releases，依据 [electron-builder v26 官方说明](https://www.electron.build/v26/docs/features/auto-update/)。

启动 30 秒、每 4 小时、打开设置距上次检查超过 5 分钟时检测；下载和安装由用户点击，退出不会自动安装。先核验最新正式 Release 的 Ed25519 清单，绑定仓库、标签、版本、文件名、体积、SHA-512，再比对 latest.yml。下载校验 SHA-512，通过后才可交给 NSIS 安装重启。

Windows Authenticode 未签名，清单签名独立；0.3 及更早无 OTA，首次手动安装 0.4。GitHub 可达性和限流影响更新。

## 后续发布

更新 package.json、lockfile 的版本和输出目录，测试、构建并检查打包截图。npm run release:manifest 签名最终安装器，重新构建必须重新签名。提交推送后上传安装器、blockmap、latest.yml、update-manifest.json：

```powershell
gh release create v0.4.0 --repo Sunnymark7/qihou-desktop --target main --title "栖候 0.4.0" --notes-file docs/release-0.4.0.md release-v0.4.0/Qihou-0.4.0-Setup-x64.exe release-v0.4.0/Qihou-0.4.0-Setup-x64.exe.blockmap release-v0.4.0/latest.yml release-v0.4.0/update-manifest.json
```

后续替换版本，不能仅传安装器或混用清单。正式版本不设 draft/prerelease。保留旧 blockmap，差分失败可回退完整下载。

公钥 shared/update-public.pem，私钥 %LOCALAPPDATA%/Qihou-Publisher/update-private.pem。CI 仅测试构建，未上传私钥到 GitHub Secrets。scripts/update-live.cjs 以隔离配置模拟旧版，验证公开下载，不执行安装器，不等同系统安装验证。
