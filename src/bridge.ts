import type { AppState, Bridge, Location, Settings } from './types';

// Browser mode is explicitly a synthetic design preview. Native actions remain unavailable.
export function getBridge(): Bridge {
  if(window.qihou)return window.qihou;
  let current:AppState={
    desktop:false,platform:'browser',packaged:false,autoStart:false,error:null,loading:false,pauseReason:null,availableLandmark:'shanghai',model:'default',
    settings:{location:{id:'demo',name:'上海',admin:'上海市 · 浦东新区',country:'中国',latitude:31.23,longitude:121.47,timezone:'Asia/Shanghai'},model:'default',size:360,fps:30,visible:true,locked:false,alwaysOnTop:false,paused:false,reducedMotion:false,pauseOnBattery:true,pauseOnFullscreen:true,showDetails:true,mode:'widget'},
    weather:{locationId:'demo',fetchedAt:Date.now(),dataTime:Date.now(),provider:'演示数据',timezone:'Asia/Shanghai',temperature:24,feelsLike:25,humidity:68,wind:2.8,windDirection:135,precipitation:0,cloudCover:35,isDay:true,code:2,kind:'cloudy',label:'多云',high:27,low:21,sunrise:null,sunset:null,hours:Array.from({length:12},(_,i)=>({time:Date.now()+i*3600000,temperature:[24,25,26,27,26,24,23,22,22,21,21,21][i],precipitation:10,code:2}))}
  };
  const listeners=new Set<(s:AppState)=>void>();
  const emit=()=>{listeners.forEach(fn=>fn(current));return current;};
  return {
    state:async()=>current,
    credentials:async()=>{throw Error('请在桌面应用中配置天气源');},
    search:async()=>{throw Error('地点搜索在桌面应用中可用。当前为演示预览。');},
    setLocation:async(_l:Partial<Location>)=>{throw Error('请在桌面应用中设置真实地点');},
    settings:async(p:Partial<Settings>)=>{current={...current,settings:{...current.settings,...p}};current.model=current.settings.model==='default'?'default':'shanghai';current.pauseReason=current.settings.paused?'已暂停动画':null;return emit();},
    action:async()=>{throw Error('这是浏览器演示预览；请运行桌面应用使用托盘与窗口功能。');},
    subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}
  };
}
