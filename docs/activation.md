# 激活与手动签发

免费长期可用。Plus 解锁精雕夜景、便利贴、倒数日、四套皮肤、8 个收藏地点、7 天记录和 CSV。

## 用户

托盘打开“激活与更新”，复制设备码，提供给发布者，选择 ¥1 / 7 天体验或 ¥5 / 永久方案。人工确认付款后粘贴完整 QH1 激活码，离线验证。购买入口未配置，无自动支付、订单、退款或发码服务。

体验从签发起计 7 天。永久码绑定安装配置中的设备码；重装保留 %APPDATA%/Qihou 则不变，清空配置或迁移需联系重新签发。设备码是随机安装 ID，不采集硬件序列号。

到期回到经典地标和苔庭，增强面板隐藏；笔记仍可查看、复制、删除或 JSON 导出，不被删除。时间回拨超过 5 分钟暂停体验，恢复正确时间后继续；永久码不受此检查影响。

## 发布者

公钥 shared/license-public.pem，私钥本机 %LOCALAPPDATA%/Qihou-Publisher/license-private.pem。私下备份两个发布私钥，不能放到公开仓库、安装器、截图或 Release。

源码目录执行，替换实际设备码：

```powershell
node scripts/publisher.cjs issue --device QH-用户提供的24位十六进制设备码 --plan trial --out "$env:LOCALAPPDATA\Qihou-Publisher\activation-trial.txt"
node scripts/publisher.cjs issue --device QH-用户提供的24位十六进制设备码 --plan lifetime --out "$env:LOCALAPPDATA\Qihou-Publisher\activation-lifetime.txt"
```

文件名按订单区分，拒绝覆盖，只打印路径。自行核款、保存订单并交付内容，脚本不自动收款或发送消息。迁移维护机恢复原私钥，用 QIHOU_PUBLISHER_DIR 指定目录。publisher init 在已有公钥但私钥缺失时拒绝换钥，不能重新生成代替备份。

Ed25519 防伪造签名，不是防破解；客户端可修改、配置可复制，无在线撤销和服务端设备数量控制。
