const { normalizeWeather, weatherUrl } = require('./weather.cjs');
const presets = require('../shared/weather-presets.json');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SOURCES = [
  { id: 'openmeteo', name: 'Open-Meteo', url: 'https://open-meteo.com/' },
  { id: 'metno', name: 'MET Norway', url: 'https://www.met.no/en' },
  { id: 'qweather', name: '和风天气', url: 'https://www.qweather.com/' },
  { id: 'openweather', name: 'OpenWeather', url: 'https://openweathermap.org/' },
];
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const descriptor = (kind, label, extra = {}) => ({ kind, label: label || presets[kind].label, effects: { ...presets[kind], ...extra } });
function metCondition(symbol = '') {
  const thunder = symbol.includes('thunder');
  let kind = 'unknown';
  if (symbol.includes('sleet')) kind = 'sleet';
  else if (symbol.includes('snow')) kind = thunder ? 'thunder-snow' : symbol.includes('heavy') ? 'heavy-snow' : 'snow';
  else if (symbol.includes('rain')) kind = thunder ? 'storm' : symbol.includes('heavy') ? 'heavy-rain' : symbol.includes('light') ? 'drizzle' : 'rain';
  else if (symbol.startsWith('clearsky')) kind = 'clear';
  else if (/^(fair|partlycloudy)/.test(symbol)) kind = 'cloudy';
  else if (symbol.startsWith('cloudy')) kind = 'overcast';
  else if (symbol.startsWith('fog')) kind = 'fog';
  return descriptor(kind, kind === 'sleet' && thunder ? '雷雨夹雪' : undefined, { thunder });
}
function owmCondition(code) {
  if (code >= 200 && code < 300) return descriptor('storm');
  if (code >= 300 && code < 400) return descriptor('drizzle');
  if (code === 511) return descriptor('freezing-rain');
  if ([502,503,504,522,531].includes(code)) return descriptor('heavy-rain');
  if (code >= 500 && code < 600) return descriptor('rain');
  if ([611,612,613,615,616].includes(code)) return descriptor('sleet');
  if ([602,622].includes(code)) return descriptor('heavy-snow');
  if (code >= 600 && code < 700) return descriptor('snow');
  if ([731,751,761,762].includes(code)) return descriptor('dust');
  if ([701,711,721,741].includes(code)) return descriptor('fog');
  if (code === 800) return descriptor('clear');
  if ([801,802,803].includes(code)) return descriptor('cloudy');
  if (code === 804) return descriptor('overcast');
  return descriptor('unknown');
}
function qwCondition(code) {
  if ([100,150].includes(code)) return descriptor('clear');
  if ([101,102,103,151,152,153].includes(code)) return descriptor('cloudy');
  if (code === 104) return descriptor('overcast');
  if (code === 304) return descriptor('hail');
  if ([302,303].includes(code)) return descriptor('storm');
  if (code === 313) return descriptor('freezing-rain');
  if ([404,405,406,456].includes(code)) return descriptor('sleet');
  if ([402,403,410].includes(code)) return descriptor('heavy-snow');
  if (code >= 400 && code < 500) return descriptor('snow');
  if ([307,308,310,311,312,316,317,318].includes(code)) return descriptor('heavy-rain');
  if (code === 309) return descriptor('drizzle');
  if (code >= 300 && code < 400) return descriptor('rain');
  if ([503,504,507,508].includes(code)) return descriptor('dust');
  if (code >= 500 && code < 600) return descriptor('fog');
  return descriptor('unknown');
}
function zone(location) {
  if (location.timezone && location.timezone !== 'auto') return location.timezone;
  // Explicit timezone fallback; no invented IANA timezone from longitude.
  return location.country === '中国' ? 'Asia/Shanghai' : 'UTC';
}
function daylight(time, longitude) {
  const hour = (new Date(time).getUTCHours() + longitude / 15 + 24) % 24;
  return hour >= 6 && hour < 18; // Rendering estimate only when source has no day/night field.
}
function base(location, source, at) {
  return { locationId: location.id, fetchedAt: at, dataTime: null, provider: SOURCES.find(s => s.id === source).name, providerId: source, timezone: zone(location), dataType: 'current',
    feelsLike: null, humidity: null, wind: null, windDirection: null, precipitation: null, cloudCover: null, high: null, low: null, sunrise: null, sunset: null,
    isDay: daylight(at, location.longitude), dayEstimated: true, hours: [], code: -1 };
}
function normalizeMet(data, location, at = Date.now()) {
  const series = data?.properties?.timeseries;
  if (!Array.isArray(series)) throw Error('返回格式不完整');
  const available = series.filter(p => Number.isFinite(Date.parse(p.time)) && finite(p.data?.instant?.details?.air_temperature) !== null);
  const point = available.reduce((best, p) => !best || Math.abs(Date.parse(p.time)-at)<Math.abs(Date.parse(best.time)-at) ? p : best, null);
  if (!point || Math.abs(Date.parse(point.time)-at) > 3*3600000) throw Error('没有当前时段的有效预报');
  const d = point.data.instant.details, period = point.data.next_1_hours || point.data.next_6_hours;
  const symbol = period?.summary?.symbol_code || '';
  return { ...base(location,'metno',at), ...metCondition(symbol), dataTime: Date.parse(point.time), modelUpdatedAt: Date.parse(data.properties.meta?.updated_at) || null, dataType: 'forecast', temperature: d.air_temperature,
    humidity: finite(d.relative_humidity), wind: finite(d.wind_speed), windDirection: finite(d.wind_from_direction), cloudCover: finite(d.cloud_area_fraction),
    // A six-hour accumulation must never be labeled as one-hour precipitation.
    precipitation: finite(point.data.next_1_hours?.details?.precipitation_amount),
    isDay: symbol.endsWith('_night') ? false : symbol.endsWith('_day') ? true : daylight(at, location.longitude), dayEstimated: !/_(night|day)$/.test(symbol),
    hours: available.filter(p => Date.parse(p.time)>=at && Date.parse(p.time)<=at+12*3600000).map(p => ({time:Date.parse(p.time),temperature:p.data.instant.details.air_temperature,precipitation:null,code:-1})) };
}
function normalizeOwm(data, location, at = Date.now()) {
  if (finite(data?.main?.temp) === null || !Number.isFinite(data?.dt)) throw Error('返回格式不完整');
  const code = data.weather?.[0]?.id;
  return { ...base(location,'openweather',at), ...owmCondition(code), temperature:data.main.temp, dataTime:data.dt*1000,
    timezone:'UTC', utcOffsetSeconds: finite(data.timezone) ?? 0, code:code ?? -1,
    feelsLike:finite(data.main.feels_like), humidity:finite(data.main.humidity), wind:finite(data.wind?.speed), windDirection:finite(data.wind?.deg),
    precipitation:finite(data.rain?.['1h']), cloudCover:finite(data.clouds?.all),
    sunrise:finite(data.sys?.sunrise)===null?null:data.sys.sunrise*1000, sunset:finite(data.sys?.sunset)===null?null:data.sys.sunset*1000,
    isDay: data.weather?.[0]?.icon ? data.weather[0].icon.endsWith('d') : daylight(at,location.longitude), dayEstimated:!data.weather?.[0]?.icon };
}
function normalizeQw(data, location, at = Date.now()) {
  if (finite(data?.temperature?.value) === null || data.temperature.unit !== '°C') throw Error('返回格式或温度单位不正确');
  const code = Number(data.condition?.code), d = qwCondition(code);
  // Current v1 has no observation timestamp. Keep null and label retrieval time in UI.
  return { ...base(location,'qweather',at), ...d, code, temperature:data.temperature.value,
    feelsLike:data.feelsLike?.unit==='°C'?finite(data.feelsLike.value):null, humidity:finite(data.humidity)===null?null:data.humidity*100,
    wind:data.wind?.speed?.unit==='m/s'?finite(data.wind.speed.value):null, windDirection:finite(data.wind?.direction?.degree),
    precipitation:data.precipitation?.amount?.unit==='mm'?finite(data.precipitation.amount.value):null, cloudCover:finite(data.cloudCover)===null?null:data.cloudCover*100,
    isDay:[150,151,152,153,350,351,456,457].includes(code)?false:daylight(at,location.longitude),
    attribution: '和风天气 · 数据归一化展示；https://developer.qweather.com/attribution.html' };
}
function validateCredentials(input, previous = {}) {
  const result = { ...previous };
  for (const id of ['openweather','qweather']) if (Object.hasOwn(input || {}, id)) {
    const value = input[id];
    if (value !== null && (typeof value !== 'string' || !/^[A-Za-z0-9._-]{8,512}$/.test(value))) throw Error('密钥格式无效');
    if (value === null) delete result[id]; else result[id] = value;
  }
  if (Object.hasOwn(input || {},'qweatherHost')) {
    const host = String(input.qweatherHost || '').trim().toLowerCase();
    if (host && !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.qweatherapi\.com$/.test(host)) throw Error('请填写控制台提供的 qweatherapi.com API Host（不含 https:// 或路径）');
    result.qweatherHost = host;
  }
  return result;
}
function createWeatherService({ fetch, getCredentials = () => ({}), cacheDir, timeoutMs = 9000, now = Date.now, onStatus = () => {} }) {
  const cache = new Map(), failures = new Map(), statuses = new Map();
  function status(id, state, detail) { statuses.set(id, {id,state,detail,at:now()}); onStatus(); }
  function credentialsReady(id, c) { return id==='openweather'?!!c.openweather:id==='qweather'?!!(c.qweather&&c.qweatherHost):true; }
  async function request(id, location, signal, credentials) {
    let url, headers = { Accept:'application/json' };
    if (id==='openmeteo') url=weatherUrl(location);
    if (id==='metno') {
      url=`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`;
      headers['User-Agent']='QihouWeather/0.4.0 (+https://github.com/Sunnymark7/qihou-desktop)';
    }
    if (id==='openweather') url=`https://api.openweathermap.org/data/2.5/weather?lat=${location.latitude}&lon=${location.longitude}&units=metric&lang=zh_cn&appid=${encodeURIComponent(credentials.openweather)}`;
    if (id==='qweather') { url=`https://${credentials.qweatherHost}/weather/v1/current/${location.latitude}/${location.longitude}?lang=zh`; headers['X-QW-Api-Key']=credentials.qweather; }
    const cacheFile=cacheDir&&id==='metno'?path.join(cacheDir,crypto.createHash('sha256').update(url).digest('hex')+'.json'):null;
    let cached=cache.get(url);
    if (!cached && cacheFile) { try {cached=JSON.parse(fs.readFileSync(cacheFile,'utf8'));cache.set(url,cached);} catch {} }
    if (cached?.expires>now()) return cached.data;
    if (cached?.lastModified) headers['If-Modified-Since']=cached.lastModified;
    const own = new AbortController(), abort=()=>own.abort();
    signal?.addEventListener('abort',abort,{once:true});
    if (signal?.aborted) own.abort();
    const timer=setTimeout(()=>own.abort(),timeoutMs);
    try {
      const response=await fetch(url,{signal:own.signal,headers,redirect:'error'});
      if (response.status===429) {
        const value=response.headers.get('retry-after');
        const seconds=Number(value); const wait=value && Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now();
        const error=Error('请求限流，已暂时停用此源');error.cooldown=Math.max(15*60000,Number.isFinite(wait)?wait:0);throw error;
      }
      if (!response.ok && response.status!==304) throw Error(`HTTP ${response.status}`);
      const data=response.status===304&&cached?cached.data:await response.json();
      if (id==='metno') {
        const entry={data,lastModified:response.headers.get('last-modified')||cached?.lastModified,expires:Math.max(now()+60000,Date.parse(response.headers.get('expires'))||now()+15*60000)};
        if (cache.size>=24) cache.delete(cache.keys().next().value);cache.set(url,entry);
        if(cacheFile)try{fs.mkdirSync(cacheDir,{recursive:true});fs.writeFileSync(cacheFile,JSON.stringify(entry));}catch{}
      }
      return data;
    } catch(e) {
      if(signal?.aborted)throw signal.reason||Error('已取消');
      if(e.name==='AbortError')throw Error('请求超时');
      // Do not propagate URLs or provider bodies: they may contain a key.
      if(e.cooldown||/^HTTP \d+$/.test(e.message))throw e;
      throw Error('网络连接或响应异常');
    } finally { clearTimeout(timer);signal?.removeEventListener('abort',abort); }
  }
  return {
    statuses:()=>SOURCES.map(s=>({...s,...statuses.get(s.id),configured:credentialsReady(s.id,getCredentials()),retryAt:failures.get(s.id)?.until||null})),
    reset:()=>{failures.clear();statuses.clear();},
    async get(location, preferred='auto', signal) {
      const credentials=getCredentials();
      const ordered=preferred==='auto'?SOURCES:[...SOURCES.filter(s=>s.id===preferred),...SOURCES.filter(s=>s.id!==preferred)];
      const messages=[];
      for(const source of ordered) {
        if(signal?.aborted)throw signal.reason||Error('已取消');
        const id=source.id;
        if(!credentialsReady(id,credentials)){status(id,'unconfigured','尚未配置密钥');continue;}
        if(failures.get(id)?.until>now()){messages.push(source.name+'冷却中');continue;}
        status(id,'loading','正在连接');
        try {
          const data=await request(id,location,signal,credentials);
          if(signal?.aborted)throw signal.reason||Error('已取消');
          const normalizers={openmeteo:normalizeWeather,metno:normalizeMet,openweather:normalizeOwm,qweather:normalizeQw};
          const weather=normalizers[id](data,location,now());
          if(weather.dataTime!==null && Math.abs(weather.dataTime-now())>3*3600000)throw Error('数据时刻已过期');
          failures.delete(id);status(id,'ok','连接正常');
          return {...weather, fallback:messages.length>0, sourceNote:messages.length?`已切换至 ${source.name}；${messages.join('；')}`:null};
        }catch(e){
          if(signal?.aborted)throw e;
          const count=(failures.get(id)?.count||0)+1;
          failures.set(id,{count,until:now()+(e.cooldown||Math.min(60000*2**(count-1),15*60000))});
          const reason=/^(HTTP \d+|请求超时|请求限流|数据时刻|返回格式|没有当前)/.test(e.message)?e.message:'连接失败或数据无效';
          status(id,'error',reason);messages.push(source.name+'：'+reason);
        }
      }
      throw Error('可用天气源均未成功，保留上次数据。'+messages.join('；'));
    }
  };
}
module.exports={SOURCES,createWeatherService,normalizeMet,normalizeOwm,normalizeQw,metCondition,owmCondition,qwCondition,validateCredentials};
