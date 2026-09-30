const landmarks = require('../shared/landmarks.json');
const presets = require('../shared/weather-presets.json');
const CONDITIONS = [
  [[0], 'clear', '晴'], [[1, 2], 'cloudy', '多云'], [[3], 'overcast', '阴'],
  [[45, 48], 'fog', '雾'], [[51, 53, 55], 'drizzle', '毛毛雨'],
  [[56, 57, 66, 67], 'freezing-rain', '冻雨'],
  [[61, 63, 80, 81], 'rain', '雨'], [[65, 82], 'heavy-rain', '强降雨'],
  [[71, 73, 77, 85], 'snow', '雪'], [[75, 86], 'heavy-snow', '大雪'],
  [[95], 'storm', '雷雨'], [[96, 99], 'hail', '雷雨伴冰雹'],
];
function condition(code) {
  const match = CONDITIONS.find(([codes]) => codes.includes(code));
  const kind = match?.[1] || 'unknown';
  return { kind, label: match?.[2] || presets.unknown.label, effects: { ...presets[kind] } };
}
function validateLocation(input) {
  if (!input || typeof input !== 'object') throw Error('请选择一个地点');
  const lat = Number(input.latitude), lon = Number(input.longitude);
  if (input.latitude == null || input.longitude == null || input.latitude === '' || input.longitude === '' || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw Error('纬度应为 -90～90，经度应为 -180～180');
  const name = String(input.name || '所选位置').trim().slice(0, 80);
  if (!name) throw Error('请填写地点名称');
  let timezone = 'auto';
  if(typeof input.timezone === 'string' && input.timezone.length < 80) try { new Intl.DateTimeFormat('en',{timeZone:input.timezone});timezone=input.timezone; } catch {}
  return { id: `${lat.toFixed(5)},${lon.toFixed(5)}`, name, admin: String(input.admin || '').slice(0, 100), country: String(input.country || '').slice(0, 60), latitude: lat, longitude: lon, timezone };
}
function landmarkFor(location) {
  if (!location) return null;
  const distance = (lat, lon) => Math.hypot((location.latitude - lat) * 111, (location.longitude - lon) * 111 * Math.cos(lat * Math.PI / 180));
  return landmarks.map(l => ({ ...l, distance: distance(l.latitude, l.longitude) })).filter(l => l.distance < l.radius).sort((a,b) => a.distance-b.distance)[0]?.id || null;
}
function selectedModel(settings) {
  const available = landmarkFor(settings.location);
  if (settings.model === 'default') return 'default';
  if (settings.model === 'landmark' && landmarks.some(l => l.id === settings.landmarkId)) return settings.landmarkId;
  return available || 'default';
}
function normalizeWeather(data, location, fetchedAt = Date.now()) {
  const c = data?.current;
  if (!c || typeof c.temperature_2m !== 'number' || !Number.isFinite(c.temperature_2m) || !Number.isFinite(c.time)) throw Error('天气服务返回了不完整的数据，请稍后重试');
  const finite = (x) => typeof x === 'number' && Number.isFinite(x) ? x : null;
  const descriptor = condition(c.weather_code);
  const now = c.time;
  const hours = (data.hourly?.time || []).map((time, index) => ({ time: time * 1000, temperature: finite(data.hourly.temperature_2m[index]), precipitation: finite(data.hourly.precipitation_probability?.[index]), code: data.hourly.weather_code?.[index] })).filter(h => h.time >= now * 1000 && h.temperature !== null).slice(0, 12);
  return {
    locationId: location.id, fetchedAt, dataTime: c.time * 1000,
    provider: 'Open-Meteo', providerId: 'openmeteo', timezone: data.timezone || 'UTC', dataType: 'model',
    temperature: c.temperature_2m, feelsLike: finite(c.apparent_temperature),
    humidity: finite(c.relative_humidity_2m), wind: finite(c.wind_speed_10m),
    windDirection: finite(c.wind_direction_10m), precipitation: finite(c.precipitation),
    cloudCover: finite(c.cloud_cover), isDay: c.is_day !== 0,
    code: c.weather_code, ...descriptor, hours,
    high: finite(data.daily?.temperature_2m_max?.[0]), low: finite(data.daily?.temperature_2m_min?.[0]),
    sunrise: finite(data.daily?.sunrise?.[0]) === null ? null : data.daily.sunrise[0] * 1000,
    sunset: finite(data.daily?.sunset?.[0]) === null ? null : data.daily.sunset[0] * 1000,
  };
}
function weatherUrl(location) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.search = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), timezone: 'auto', timeformat: 'unixtime', wind_speed_unit: 'ms', forecast_days: '2', current: 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m', hourly: 'temperature_2m,precipitation_probability,weather_code', daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset' }).toString();
  return u.toString();
}
function sanitizeSettings(patch) {
  const out = {};
  for (const key of ['locked', 'alwaysOnTop', 'paused', 'visible', 'reducedMotion', 'pauseOnBattery', 'pauseOnFullscreen', 'showDetails','weatherNotifications']) if (typeof patch?.[key] === 'boolean') out[key] = patch[key];
  if (['auto', 'default', 'landmark'].includes(patch?.model)) out.model = patch.model;
  if (landmarks.some(l => l.id === patch?.landmarkId)) out.landmarkId = patch.landmarkId;
  if (['auto','openmeteo','metno','openweather','qweather'].includes(patch?.weatherSource)) out.weatherSource = patch.weatherSource;
  if(['classic','crafted'].includes(patch?.detail))out.detail=patch.detail;
  if (['economy','balanced','high'].includes(patch?.quality)) out.quality = patch.quality;
  if ([15, 30, 60].includes(patch?.fps)) out.fps = patch.fps;
  if (Number.isFinite(patch?.size)) out.size = Math.round(Math.max(260, Math.min(540, patch.size)));
  return out;
}
function clampBounds(bounds, displays) {
  const matches = displays.find(d => bounds.x + bounds.width > d.x && bounds.x < d.x + d.width && bounds.y + bounds.height > d.y && bounds.y < d.y + d.height) || displays[0];
  return { ...bounds, x: Math.round(Math.max(matches.x, Math.min(bounds.x, matches.x + matches.width - bounds.width))), y: Math.round(Math.max(matches.y, Math.min(bounds.y, matches.y + matches.height - bounds.height))) };
}
module.exports = { condition, validateLocation, landmarkFor, selectedModel, normalizeWeather, weatherUrl, sanitizeSettings, clampBounds };
