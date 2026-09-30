# 0.2 天气来源与回退

0.4 公开发布的 MET User-Agent 已更新为 QihouWeather/0.4.0，并包含维护仓库链接 https://github.com/Sunnymark7/qihou-desktop 。旧文中的原型标识和发行前事项应以当前代码为准。付费激活不包含服务商商用额度，正式收款前需确定天气、空气和地理编码的适用服务方案。

文档核对与实现日期：2026-09-11。请求在 Electron 主进程发送，renderer 只能通过固定 IPC 操作配置；不会把 API 密钥放入前端状态。所有来源使用相同地点，但不把来源不同的实况、逐小时预报和日最高温混成一份数据。

| 来源 | 接口与访问方式 | 当前接入范围 | 验证 |
| --- | --- | --- | --- |
| Open-Meteo | `/v1/forecast`，无需密钥 | 当前模型天气、12 小时趋势、日最高/最低、日出/日落 | 上海坐标实网通过 |
| MET Norway | Locationforecast 2.0 compact，无需密钥、标识应用的 User-Agent | 当前时段模型预报、未来 12 小时内的可用温度时点 | 独立实网请求通过 |
| 和风天气 | 当前 v1 坐标接口，个人 API Host 和 API Key | 当前天气；不额外调用收费预报产品 | 官方结构样例与错误输入测试通过；无用户密钥，未做账户实网验证 |
| OpenWeather | Current Weather 2.5，个人 API Key | 当前天气；不额外调用其他产品 | 结构、天气码、单位与缺失值测试通过；无用户密钥，未做账户实网验证 |

## 顺序与故障处理

自动顺序为 Open-Meteo → MET Norway → 已配置的和风天气 → 已配置的 OpenWeather。指定优先源后先尝试它，再尝试其余源。没有配置密钥的源直接跳过。

每个源有独立的 9 秒超时。网络失败、无效结构和超过 3 小时偏差的数据都触发回退。失败源按 1、2、4…分钟冷却，普通失败最多 15 分钟；HTTP 429 至少冷却 15 分钟，并遵循更长的 Retry-After。全部失败保留上次有效天气，并显示错误；不会自动变成晴天。修改地点会取消旧请求，旧结果不覆盖新地点。

正常轮询约每 15 分钟一次，另加最多 30 秒随机偏移。MET 响应按 Expires 缓存在本地，过期后带 If-Modified-Since 进行条件请求。当前状态页展示已发生的请求结果；“等待请求”不等于已验证在线。

16 个内置城市可在断网时检索到城市中心坐标。其他城市仍使用 Open-Meteo 地理编码，也可手动输入 WGS84 经纬度。内置坐标用于城市匹配，不表示建筑测绘坐标或门牌精度。

## 数据语义

- WMO 96/99 才映射为雷雨伴冰雹；95 映射雷雨，不推断冰雹。MET 的雨夹雪、雷雪和降水强度分别归一化；冻雨和雨夹雪不作为冰雹显示。
- MET 是当前时段预报，界面明确标注。六小时累计降水不换名为一小时降水；没有体感、日极值、日落或降水概率时显示缺失。
- OpenWeather 当前接口的 temp_min/temp_max 不是全天极值，故不填入“最高/最低”。时区使用响应中的 UTC 秒偏移。
- 和风当前 v1 的公开结构未提供观测时间，因此 dataTime 为 null，界面标注获取时间及“源未提供观测时刻”。湿度 0–1 转为百分数，温度和风速校验单位后再使用。
- 无 day/night 字段时，根据时间与经度估计昼夜，仅用于渲染，不能当作精确日出/日落。未获得位置时区时使用 UTC，不伪造当地时区。
- 风向为气象“来向”：0° 来自北，90° 来自东。粒子和风向袋沿下风向运动。

## 密钥与服务条件

“天气来源”页可保存或移除密钥。Windows safeStorage 加密写入 `%APPDATA%/Qihou/credentials.bin`；renderer 只收到是否已配置和和风 API Host，不收到已保存的密钥。和风 Host 限定为 `*.qweatherapi.com`；不支持任意代理地址。网络错误过滤请求 URL 和响应正文，防止密钥进入错误信息。

本项目不代用户注册账号、购买额度或提供公用密钥。免费服务也可能不可达或限流，多源不能保证永远在线。MET 请求使用真实应用名称 `QihouWeather/0.2.0` 标识；公开发行前应加入维护者的真实联系方式，并按总流量要求安排缓存代理。

Open-Meteo 免费端点用于非商业原型。MET Norway 数据采用 CC BY 4.0，界面与许可文件署名，并说明已做归一化处理。和风与 OpenWeather 额度、权限及商业条件以个人账号为准。

## 官方依据

- [Open-Meteo 天气文档](https://open-meteo.com/en/docs)与[服务方案](https://open-meteo.com/en/pricing)。
- [MET 数据模型](https://docs.api.met.no/doc/locationforecast/datamodel.html)与[使用条款](https://docs.api.met.no/doc/TermsOfService)。
- [和风当前坐标接口](https://dev.qweather.com/en/docs/api/weather/weather-current/)、[API Host](https://dev.qweather.com/en/docs/configuration/api-host/)、[API Key 认证](https://dev.qweather.com/en/docs/configuration/authentication/)。未采用即将弃用的 v7 城市实况接口。
- [OpenWeather 当前天气](https://openweathermap.org/api/current?collection=current_forecast)与[天气状况文档](https://openweathermap.org/api/weather-conditions)。
