const fs=require('node:fs');
const path=require('node:path');
const {validateLocation}=require('./weather.cjs');
function createFavorites(file){
  let items=[];try{items=JSON.parse(fs.readFileSync(file,'utf8')).slice(0,8).flatMap(p=>{try{return [validateLocation(p)];}catch{return [];}});}catch{}
  function save(){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(items));fs.renameSync(file+'.tmp',file);}
  return {list:()=>items.map(p=>({...p})),toggle:location=>{
    const p=validateLocation(location),index=items.findIndex(x=>x.id===p.id);
    if(index>=0)items.splice(index,1);else{if(items.length>=8)throw Error('最多收藏 8 个地点，请先移除一个');items.push(p);}save();
  },remove:id=>{items=items.filter(p=>p.id!==id);save();}};
}
function insights(weather,air){
  if(!weather)return [];
  const tips=[];
  const wet=weather.effects?.rain>0||weather.effects?.snow>0||weather.effects?.hail>0;
  const chance=weather.hours?.slice(0,3).find(h=>h.precipitation!==null&&h.precipitation>=50);
  if(wet)tips.push({id:'precipitation',title:'带上雨具',detail:`当前天气：${weather.label}`,level:weather.effects?.thunder?'attention':'normal'});
  else if(chance)tips.push({id:'precipitation',title:'留意降水',detail:`近期预报降水概率 ${chance.precipitation}%`,level:'normal'});
  if(weather.wind>=8)tips.push({id:'wind',title:'风力较强',detail:`当前风速 ${weather.wind.toFixed(1)} m/s`,level:'attention'});
  if(weather.temperature<=5)tips.push({id:'temperature',title:'注意保暖',detail:`当前温度 ${Math.round(weather.temperature)}°C`,level:'normal'});
  else if(weather.temperature>=32)tips.push({id:'temperature',title:'天气较热',detail:`当前温度 ${Math.round(weather.temperature)}°C`,level:'normal'});
  if(air?.aqi>100)tips.push({id:'air',title:'留意空气质量',detail:`US AQI ${Math.round(air.aqi)}，查看空气趋势`,level:'attention'});
  if(!tips.length)tips.push({id:'calm',title:'看看接下来的变化',detail:'温度与空气曲线已准备好',level:'normal'});
  return tips;
}
function historyCsv(environment,location){
  const cell=v=>{let s=v===null||v===undefined?'':String(v);if(/^[=+@\-]/.test(s)&&typeof v!=='number')s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  const rows=[['type','city','time_utc','temperature_c','humidity_pct','wind_ms','us_aqi','pm25_ugm3','pm10_ugm3','source']];
  for(const p of environment.history.weather)rows.push(['weather',location.name,new Date(p.time).toISOString(),p.temperature,p.humidity,p.wind,null,null,null,p.source]);
  for(const p of environment.history.air)rows.push(['air',location.name,new Date(p.time).toISOString(),null,null,null,p.aqi,p.pm25,p.pm10,p.source]);
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
module.exports={createFavorites,insights,historyCsv};
