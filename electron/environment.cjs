const fs = require('node:fs');
const path = require('node:path');
const crypto=require('node:crypto');
const valid = n => typeof n === 'number' && Number.isFinite(n);
const value = n => valid(n) && n >= 0 ? n : null;
const HOUR = 3600000;

function airUrl(location) {
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.search = new URLSearchParams({latitude:String(location.latitude),longitude:String(location.longitude),
    current:'us_aqi,pm2_5,pm10',hourly:'us_aqi,pm2_5,pm10',forecast_hours:'24',timeformat:'unixtime',timezone:'GMT'}).toString();
  return url.toString();
}
function normalizeAir(data, location, now=Date.now()) {
  const c=data?.current;
  if(!valid(c?.time) || Math.abs(c.time*1000-now)>6*HOUR) throw Error('空气质量数据时间无效或已过期');
  const point=(r,time)=>({time,aqi:value(r.us_aqi),pm25:value(r.pm2_5),pm10:value(r.pm10)});
  const current=point(c,c.time*1000);
  if([current.aqi,current.pm25,current.pm10].every(v=>v===null))throw Error('空气质量来源暂未提供有效数值');
  const h=data.hourly||{};
  const hours=(Array.isArray(h.time)?h.time:[]).flatMap((t,i)=>valid(t)&&t*1000>=now-HOUR&&t*1000<=now+25*HOUR
    ?[point({us_aqi:h.us_aqi?.[i],pm2_5:h.pm2_5?.[i],pm10:h.pm10?.[i]},t*1000)]:[]).sort((a,b)=>a.time-b.time);
  return {...current,locationId:location.id,fetchedAt:now,provider:'Open-Meteo / CAMS',standard:'US AQI',hours};
}
function appendSample(samples, sample, now=Date.now()) {
  if(!valid(sample.time)||sample.time>now+5*60000)return samples;
  return [...samples.filter(p=>p.time!==sample.time),sample].filter(p=>valid(p.time)&&p.time>=now-7*24*HOUR&&p.time<=now+5*60000)
    .sort((a,b)=>a.time-b.time).slice(-768);
}
function createEnvironment({fetch, file, onChange=()=>{}, now=Date.now}) {
  let activeFile=file,locationId=null, air=null, history={weather:[],air:[]}, error=null, loading=false, controller, version=0, lastAttempt=0;
  function save(){
    if(!file)return;
    try{fs.mkdirSync(path.dirname(activeFile),{recursive:true});fs.writeFileSync(activeFile+'.tmp',JSON.stringify({locationId,air,history}));fs.renameSync(activeFile+'.tmp',activeFile);}
    catch{error='环境记录未能保存，请检查磁盘空间';}
  }
  function select(location){
    if(location?.id===locationId)return;
    if(locationId)save();
    controller?.abort();version++;loading=false;lastAttempt=0;locationId=location?.id||null;air=null;history={weather:[],air:[]};error=null;
    if(!file||!locationId)return;
    activeFile=file+'.'+crypto.createHash('sha256').update(locationId).digest('hex').slice(0,16)+'.json';
    try{
      const saved=JSON.parse(fs.readFileSync(fs.existsSync(activeFile)?activeFile:file,'utf8'));
      if(saved.locationId!==locationId)return;
      for(const key of ['weather','air']){
        const fields=key==='weather'?['temperature','humidity','wind']:['aqi','pm25','pm10'];
        history[key]=(Array.isArray(saved.history?.[key])?saved.history[key]:[]).filter(p=>valid(p.time)&&p.time>=now()-7*24*HOUR&&p.time<=now()+5*60000)
          .map(p=>({time:p.time,source:String(p.source||'').slice(0,80),...Object.fromEntries(fields.map(k=>[k,valid(p[k])?p[k]:null]))})).sort((a,b)=>a.time-b.time).slice(-768);
      }
      if(saved.air?.locationId===locationId&&valid(saved.air.fetchedAt)&&valid(saved.air.time)&&saved.air.fetchedAt<=now()&&now()-saved.air.fetchedAt<48*HOUR){
        const a=saved.air;air={...a,aqi:value(a.aqi),pm25:value(a.pm25),pm10:value(a.pm10),provider:'Open-Meteo / CAMS',standard:'US AQI',hours:(Array.isArray(a.hours)?a.hours:[]).filter(p=>valid(p.time)).slice(0,26).map(p=>({time:p.time,aqi:value(p.aqi),pm25:value(p.pm25),pm10:value(p.pm10)}))};
      }
    }catch(e){if(e.code!=='ENOENT')error='环境记录无法读取，已重新开始记录';}
  }
  function record(weather){
    if(!weather||weather.locationId!==locationId)return;
    history.weather=appendSample(history.weather,{time:weather.dataTime||weather.fetchedAt,temperature:weather.temperature,humidity:weather.humidity,wind:weather.wind,source:weather.provider},now());save();
  }
  async function refresh(location, manual=false){
    select(location);
    if(!location||loading||lastAttempt&&now()-lastAttempt<(manual?10000:15*60000))return;
    const token=++version;controller=new AbortController();const active=controller;
    const timer=setTimeout(()=>active.abort(),12000);lastAttempt=now();loading=true;error=null;onChange();
    try{
      const response=await fetch(airUrl(location),{signal:active.signal});
      if(!response.ok)throw Error(response.status===429?'空气质量服务请求过多，请稍后刷新':`空气质量服务暂不可用（${response.status}）`);
      const next=normalizeAir(await response.json(),location,now());
      if(token!==version)return;
      air=next;history.air=appendSample(history.air,{time:next.time,aqi:next.aqi,pm25:next.pm25,pm10:next.pm10,source:next.provider},now());save();
    }catch(e){if(token===version)error=e.name==='AbortError'?'空气质量请求超时，可稍后刷新':e.message||'空气质量暂不可用';}
    finally{clearTimeout(timer);if(token===version){loading=false;onChange();}}
  }
  return {select,record,refresh,state:(days=7)=>({air,history:{weather:history.weather.filter(p=>p.time>=now()-days*24*HOUR),air:history.air.filter(p=>p.time>=now()-days*24*HOUR)},error,loading}),dispose:()=>{version++;controller?.abort();}};
}
module.exports={airUrl,normalizeAir,appendSample,createEnvironment};
