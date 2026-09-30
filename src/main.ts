import './style.css';
import './dashboard.css';
import './product.css';
import './apple.css';
import {mountOnboarding} from './onboarding';
import {mountLocationPicker} from './location-ui';
import {escapeHtml as esc} from './ui-utils';
import appIcon from '../assets/icon.png';
import { WeatherScene } from './scene';
import {renderDeskTools,applySkin} from './desk-tools';
import {renderEdition} from './edition-ui';
import { renderTrends, airLevel } from './trends';
import { getBridge } from './bridge';
import landmarks from '../shared/landmarks.json';
import presets from '../shared/weather-presets.json';
import type { AppState, Kind, Location } from './types';

const paths:Record<string,string>={
  key:'M14 4a6 6 0 1 1-4 10l-6 6H2v-4l6-6a6 6 0 0 1 6-6Zm2 4h.01',
  heart:'M12 21 3 12a5.5 5.5 0 0 1 9-7 5.5 5.5 0 0 1 9 7l-9 9Z',
  storm:'M4 13a4 4 0 0 1 0-8 6 6 0 0 1 11 0 4 4 0 1 1 3 8M12 11l-3 6h5l-3 5',
  rain:'M4 13a4 4 0 0 1 0-8 6 6 0 0 1 11 0 4 4 0 1 1 3 8M7 16l-1 4m7-4-1 4m7-4-1 4',
  snow:'M12 3v18M4 7l16 10M4 17 20 7M9 5l3 3 3-3M9 19l3-3 3 3',
  cloud:'M5 17a4 4 0 0 1-.3-8 6 6 0 0 1 11.5-1A4.5 4.5 0 1 1 18 17Z',
  sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M5.6 18.4l1.4-1.4m10-10 1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  scene:'m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  sliders:'M4 7h7m4 0h5M4 17h3m4 0h9M11 4v6M7 14v6',
  pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Zm-4 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  arrow:'M5 12h14m-5-5 5 5-5 5', close:'m6 6 12 12M6 18 18 6',
  refresh:'M20 11a8 8 0 0 0-14-5L3 9m0-5v5h5M4 13a8 8 0 0 0 14 5l3-3m0 5v-5h-5',
  wind:'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h6a3 3 0 1 1-3 3',
  drop:'M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Z',
  desktop:'M3 4h18v13H3V4Zm9 13v4m-5 0h10',check:'m5 12 4 4L19 6',
  chevron:'m9 5 7 7-7 7', search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6',
  house:'m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8',
  moon:'M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z',
  lock:'M6 10h12v11H6V10Zm2 0V6a4 4 0 0 1 8 0v4',
  pause:'M8 5v14M16 5v14',play:'m8 4 12 8-12 8V4Z',info:'M12 11v6m0-10v1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
};
function icon(name:string,size=20){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.cloud}"/></svg>`;}

const number=(n:number|null|undefined,unit='')=>n===null||n===undefined?'—':`${Math.round(n)}${unit}`;
const bridge=getBridge();
let state=await bridge.state();
const view=new URLSearchParams(location.search).get('view')||'settings';
document.body.className=`view-${view}`;
document.documentElement.className=`view-${view}`;
const app=document.querySelector<HTMLDivElement>('#app')!;
let tab='weather',demo:Kind|undefined,demoNight=false,scene:WeatherScene|undefined;
let demoWind:number|undefined,lastReadout='';
let guide:ReturnType<typeof mountOnboarding>|undefined,picker:ReturnType<typeof mountLocationPicker>|undefined;
let toastTimer:ReturnType<typeof setTimeout>;
function clock(time:number|null|undefined){if(!time)return '—';try{return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:state.weather?.timezone||'Asia/Shanghai'}).format(time+(state.weather?.utcOffsetSeconds||0)*1000);}catch{return '—';}}
function freshness(){if(!state.weather)return state.loading?'正在获取天气…':'尚未获取天气';if(state.error)return `缓存 · ${clock(state.weather.dataTime||state.weather.fetchedAt)}`;if(!state.weather.dataTime)return `获取 ${clock(state.weather.fetchedAt)} · 源未提供观测时刻`;if(Date.now()-state.weather.dataTime>90*60_000)return `待更新 · 数据 ${clock(state.weather.dataTime)}`;return `数据 ${clock(state.weather.dataTime)}`;}
function toast(message:string){const el=document.querySelector<HTMLElement>('#toast');if(!el)return;el.textContent=message.replace(/^Error invoking remote method '[^']+': (Error: )?/,'');el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,6500);}
async function action(name:string){try{state=await bridge.action(name);render();}catch(e){toast((e as Error).message);}}
async function settings(patch:Record<string,unknown>){try{state=await bridge.settings(patch);render();}catch(e){toast((e as Error).message);}}

if(view==='settings') {
  app.innerHTML=`
  <aside class="sidebar">
    <div class="brand"><img class="brand-app-icon" src="${appIcon}" alt="" /><div><strong>栖候</strong><span>桌面上的小小天气</span></div></div>
    <nav aria-label="设置导航"><button class="nav-item active" data-tab="weather">${icon('sun')}此刻天气</button><button class="nav-item" data-tab="scene">${icon('scene')}我的场景</button><button class="nav-item" data-tab="display">${icon('sliders')}桌面与运行</button><button class="nav-item" data-tab="sources">${icon('cloud')}天气来源</button><button class="nav-item" data-tab="tools">${icon('scene')}桌面小工具</button><button class="nav-item" data-tab="account">${icon('key')}激活与更新</button></nav>
    <div class="sidebar-bottom"><span class="quiet-status"><i></i><span id="resident-label">在托盘中陪伴</span></span><button class="text-button" id="guide-button">使用引导</button><small>栖候 ${esc(state.version||'0.4')} · Windows</small><button class="text-button" data-action="source">天气数据与来源 ${icon('chevron',13)}</button></div>
  </aside>
  <main class="main">
    <div id="browser-banner" class="browser-banner" hidden>浏览器设计预览 · 当前数值为演示数据，托盘与真实地点请在桌面版使用。</div>
    <header class="page-header"><div><h1 id="page-title">此刻的天气</h1><p id="page-description">让窗外的变化，住进桌面的一角。</p></div><button class="subtle-button" id="location-button" data-action="location">${icon('pin',17)}<span id="header-location">选择地点</span>${icon('chevron',14)}</button></header>
    <div id="error-banner" class="error-banner" role="status" hidden></div>
    <div class="workspace">
      <section class="preview-panel" aria-label="场景预览">
        <div class="preview-top"><span id="preview-location">默认小屋</span><span class="preview-tag" id="preview-tag">场景预览</span></div>
        <div id="scene-host" class="scene-host"></div>
        <div class="preview-caption"><span id="model-caption">林间小屋</span><span>拖动景观，换个角度</span></div>
        <div class="preview-controls"><button class="icon-button" id="pause-button" aria-label="暂停动画">${icon('pause',18)}</button><span id="preview-status">随当地天气变化</span><button class="text-button" data-action="reset">恢复摆件 ${icon('arrow',15)}</button></div>
      </section>
      <aside id="inspector" class="inspector"></aside>
    </div>
    <section id="lower-panel" class="lower-panel"></section>
    <footer class="footer"><span id="source-line">天气由 Open-Meteo 提供 · 更新以数据源为准</span><button class="text-button" id="refresh-button" data-action="refresh">${icon('refresh',14)}更新天气</button></footer>
  </main>
  <dialog id="location-dialog" aria-labelledby="location-title"><div class="dialog-heading"><div><h2 id="location-title">天气，来自哪里？</h2><p>搜索城市或地区，再选择准确的位置。</p></div><button class="icon-button" id="close-dialog" aria-label="关闭地点选择">${icon('close')}</button></div><form id="search-form" class="search-form"><label for="location-query" class="sr-only">城市或地区名称</label><div class="search-input">${icon('search',19)}<input id="location-query" autocomplete="off" placeholder="例如：上海、杭州、London" maxlength="120" required minlength="2" /></div><button class="primary-button" id="search-button">搜索</button></form><div id="search-feedback" role="status" class="search-feedback">搜索结果会显示所属行政区，避免选错同名地点。</div><div id="search-results" class="search-results"></div><details class="coordinates"><summary>详细地址未找到？使用经纬度定位</summary><p>天气服务不提供所有门牌地址。可从地图获取 WGS84 坐标，纬度在前、经度在后；精确坐标不代表门牌级天气观测。</p><form id="coordinate-form"><label>地点名称<input name="name" placeholder="例如：我的家" maxlength="80" required /></label><div class="field-pair"><label>纬度<input name="latitude" type="number" step="any" min="-90" max="90" placeholder="31.2304" required /></label><label>经度<input name="longitude" type="number" step="any" min="-180" max="180" placeholder="121.4737" required /></label></div><button class="primary-button" type="submit">使用这个位置</button></form></details><p class="privacy-note">地点保存在本机；城市目录可离线检索，其他搜索词发送给 Open-Meteo，查询坐标发送给当前天气源和 Open-Meteo 空气质量服务。</p></dialog>
  <div id="toast" class="toast" role="status" hidden></div>`;
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab!;if(tab!=='scene'){demo=undefined;demoWind=undefined;}render();});
  document.querySelector<HTMLButtonElement>('#pause-button')!.onclick=()=>settings({paused:!state.settings.paused});
  picker=mountLocationPicker(bridge,async location=>{state=await bridge.setLocation(location);render();});
  guide=mountOnboarding(()=>state,async patch=>{try{state=await bridge.settings(patch);render();}catch(e){toast((e as Error).message);throw e;}},()=>picker!.show(),appIcon);
  document.querySelector<HTMLButtonElement>('#guide-button')!.onclick=()=>guide!.show();
}else if(view==='tools'){
  app.innerHTML='<main id="desk-board" class="desk-board"></main><div id="toast" class="toast" role="status" hidden></div>';
}else{
  app.innerHTML=`<main class="desktop-widget"><div id="scene-host" class="scene-host"></div><div class="widget-info" id="widget-info"></div></main><div id="toast" class="toast" role="status" hidden></div>`;
}
function openLocation(){picker?.show();}
if((view==='widget'&&window.qihou?.drag)||(view==='tools'&&window.qihou?.deskDrag)){
  const host=document.querySelector<HTMLElement>(view==='tools'?'#desk-board':'#scene-host')!;
  let dragging=false,frame=0;
  const send=(phase:'start'|'move'|'end')=>(view==='tools'?window.qihou!.deskDrag!(phase):window.qihou!.drag!(phase)).catch(()=>{dragging=false;});
  const end=()=>{if(!dragging)return;dragging=false;cancelAnimationFrame(frame);frame=0;void send('end');};
  host.addEventListener('pointerdown',e=>{if(e.button!==0||(view==='widget'&&state.settings.locked)||(view==='tools'&&(!(e.target as HTMLElement).closest('.desk-board-header')||(e.target as HTMLElement).closest('button'))))return;e.preventDefault();dragging=true;host.setPointerCapture(e.pointerId);void send('start');});
  host.addEventListener('pointermove',e=>{if(!dragging)return;if(!(e.buttons&1)){end();return;}if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(dragging)void send('move');});});
  host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);host.addEventListener('lostpointercapture',end);window.addEventListener('blur',end);
}

app.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');if(!b)return;if(b.dataset.action==='edition'){tab='account';render();}else if(b.dataset.action==='location')openLocation();else action(b.dataset.action!);});
function toggle(key:string,label:string,description:string,checked:boolean,disabled=false){return `<label class="toggle-row"><span><strong>${label}</strong><small>${description}</small></span><input type="checkbox" role="switch" data-setting="${key}" ${checked?'checked':''} ${disabled?'disabled':''}/></label>`;}
const landmarkLabel=(id:string|null|undefined)=>{const l=landmarks.find(l=>l.id===id);return l?`${l.city} · ${l.name}`:'尚未收录，自动使用林间小屋';};
const modelName=()=>state.model==='default'?'林间小屋':landmarkLabel(state.model);
const weatherIcon=(w:AppState['weather'])=>!w?'cloud':w.effects?.thunder||['storm','hail','thunder-snow'].includes(w.kind)?'storm':w.kind.includes('rain')||w.kind==='drizzle'?'rain':w.kind.includes('snow')||w.kind==='sleet'?'snow':w.kind==='clear'?(w.isDay?'sun':'moon'):'cloud';
function renderInspector(){
  const el=document.querySelector('#inspector')!;const w=state.weather;
  if(tab==='weather'){
    const a=state.environment?.air;
    el.innerHTML=w?`<div class="current-overview"><div class="weather-summary"><div class="weather-place">${icon('pin',15)}<span>${esc(state.settings.location?.name)}</span></div><div class="temperature">${Math.round(w.temperature)}<span>°C</span></div><p class="condition">${icon(weatherIcon(w),21)}${esc(w.label)}<span>体感 ${number(w.feelsLike,'°')}</span></p><p class="high-low">最高 ${number(w.high,'°')}<span>最低 ${number(w.low,'°')}</span></p></div><dl class="weather-details"><div><dt>空气 · US AQI${a&&Date.now()-a.fetchedAt>30*60000?' · 缓存':''}</dt><dd>${number(a?.aqi)}<span>${airLevel(a?.aqi)}</span></dd></div><div><dt>PM2.5</dt><dd>${a?.pm25==null?'—':a.pm25.toFixed(1)}<span>µg/m³</span></dd></div><div><dt>${icon('wind',16)}风速</dt><dd>${w.wind===null?'—':w.wind.toFixed(1)}<span>m/s</span></dd></div><div><dt>${icon('drop',16)}湿度</dt><dd>${number(w.humidity)}<span>%</span></dd></div></dl></div><div class="data-time">${esc(freshness())}<span>约 15 分钟更新</span></div>`:
    `<div class="empty-weather"><h2>${state.loading?'正在获取当地天气':'先选择天气地点'}</h2><p>选择城市后，这里会显示当前天气、温度趋势和空气质量。</p><button class="primary-button" data-action="location">${icon('pin',17)}${state.settings.location?'更换地点':'选择天气地点'}</button>${state.settings.location?'<button class="text-button" data-action="refresh">重新获取天气</button>':''}</div>`;
    el.insertAdjacentHTML('beforeend',`<div class="resident-strip"><span>${state.desktop?'已在托盘后台运行':'浏览器演示'}</span><button class="subtle-button" id="place-desktop" aria-pressed="${state.settings.visible}">${icon('desktop',16)}${state.settings.visible?'隐藏桌面天气':'显示桌面天气'}</button></div><p class="hint">关闭窗口后继续更新；桌面显示可独立开关。</p>`);
    el.querySelector<HTMLButtonElement>('#place-desktop')!.onclick=()=>{if(state.desktop)void settings({visible:!state.settings.visible});else toast('请运行桌面应用使用此功能');};
  }else if(tab==='scene'){
    el.innerHTML=`<h2>城市，藏在轮廓里</h2><div class="detail-switch" role="group" aria-label="建筑细节"><button id="detail-classic" aria-pressed="${state.sceneDetail!=='crafted'}">经典</button><button id="detail-crafted" aria-pressed="${state.sceneDetail==='crafted'}">精雕 ${state.activation?.active?'':'· Plus'}</button></div><p class="section-intro">天气地点：${esc(state.settings.location?.name||'尚未设置')}。更换建筑不会改变天气地点。</p><div class="model-options"><button class="model-option ${state.settings.model==='default'?'selected':''}" aria-pressed="${state.settings.model==='default'}" data-model="default"><span class="model-symbol">${icon('house',25)}</span><span><strong>林间小屋</strong><small>所有地点通用 · 默认场景</small></span>${state.settings.model==='default'?icon('check',18):''}</button><button class="model-option ${state.settings.model==='auto'?'selected':''}" aria-pressed="${state.settings.model==='auto'}" data-model="auto"><span class="model-symbol">${icon('scene',25)}</span><span><strong>当地地标</strong><small>${esc(landmarkLabel(state.availableLandmark))}</small></span>${state.settings.model==='auto'?icon('check',18):''}</button></div><label class="landmark-select">指定地标<select id="landmark-select"><option value="">选择城市与建筑…</option>${landmarks.map(l=>`<option value="${l.id}" ${state.settings.model==='landmark'&&state.settings.landmarkId===l.id?'selected':''}>${l.city} · ${l.name}</option>`).join('')}</select></label><p class="asset-note">内置模型为原创程序化示意模型。现已收录 ${landmarks.length} 个中国城市；可跟随位置，也可自由选择。</p><div class="divider"></div><div class="section-heading"><h3>天气效果预览</h3><span class="demo-note">仅影响此预览</span></div><div class="weather-groups">${([['天空与能见度',['','clear','cloudy','overcast','fog','dust']],['降雨与强对流',['drizzle','rain','heavy-rain','freezing-rain','storm','hail']],['降雪',['sleet','snow','heavy-snow','thunder-snow']]] as [string,string[]][]).map(([label,kinds])=>`<fieldset><legend>${label}</legend><div class="weather-picker">${kinds.map(kind=>`<button class="weather-chip ${demo===kind||!demo&&!kind?'selected':''}" aria-pressed="${demo===kind||!demo&&!kind}" data-demo="${kind}">${kind?presets[kind as Kind].label:'当地实况'}</button>`).join('')}</div></fieldset>`).join('')}</div><label class="landmark-select">风力预览<select id="demo-wind">${[['','当地风速'],['0','无风'],['3','微风 · 3 m/s'],['8','劲风 · 8 m/s'],['15','强风 · 15 m/s']].map(([v,l])=>`<option value="${v}" ${String(demoWind??'')===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="night-toggle"><input id="demo-night" type="checkbox" ${demoNight?'checked':''} ${!demo?'disabled':''}/>夜间光照</label><p class="hint">演示不会改变桌面上的真实天气。</p>`;
    el.querySelector<HTMLButtonElement>('#detail-classic')!.onclick=()=>settings({detail:'classic'});
    el.querySelector<HTMLButtonElement>('#detail-crafted')!.onclick=()=>{if(state.activation?.active)void settings({detail:'crafted'});else{tab='account';render();}};
    el.querySelector<HTMLSelectElement>('#landmark-select')!.onchange=e=>{const id=(e.target as HTMLSelectElement).value;if(id)settings({model:'landmark',landmarkId:id});};
    el.querySelectorAll<HTMLButtonElement>('[data-model]').forEach(b=>b.onclick=()=>settings({model:b.dataset.model}));
    el.querySelectorAll<HTMLButtonElement>('[data-demo]').forEach(b=>b.onclick=()=>{demo=(b.dataset.demo||undefined) as Kind|undefined;render();});
    el.querySelector<HTMLSelectElement>('#demo-wind')!.onchange=e=>{const v=(e.target as HTMLSelectElement).value;demoWind=v===''?undefined:Number(v);render();};
    el.querySelector<HTMLInputElement>('#demo-night')!.onchange=e=>{demoNight=(e.target as HTMLInputElement).checked;render();};
  }else if(tab==='tools'){
    renderDeskTools(el,state,bridge,next=>{state=next;render();},toast);
  }else if(tab==='account'){
    renderEdition(el,state,bridge,next=>{state=next;render();},toast);
  }else if(tab==='sources'){
    renderSources(el);
  }else{
    el.innerHTML=`<h2>桌面与后台运行</h2><p class="section-intro">${state.desktop?'已在托盘后台运行。关闭设置窗口不会退出。':'当前为浏览器预览。'}</p>${toggle('visible','显示桌面天气','只控制摆件或壁纸，隐藏后仍在后台更新',state.settings.visible)}<div class="mode-switch" aria-label="显示模式"><button aria-pressed="${state.settings.mode==='widget'}" class="${state.settings.mode==='widget'?'selected':''}" data-action="widget">透明摆件</button><button aria-pressed="${state.settings.mode==='wallpaper'}" class="${state.settings.mode==='wallpaper'?'selected':''}" data-action="wallpaper">动态壁纸</button></div><p class="hint">壁纸为实验性功能；挂载失败自动保留摆件。</p><label class="size-label">摆件大小 <span>${state.settings.size} px</span><input type="range" id="widget-size" min="260" max="540" step="20" value="${state.settings.size}" /></label><section class="settings-group"><h3>操作与提醒</h3><div class="toggle-list">${toggle('weatherNotifications','天气提醒','出现强风或强对流时发送一次桌面提示',!!state.settings.weatherNotifications)}${toggle('locked','锁定并穿透鼠标','从托盘或 Ctrl+Alt+W 恢复编辑',state.settings.locked,state.settings.mode==='wallpaper')}${toggle('alwaysOnTop','始终置顶','摆件显示在其他窗口前方',state.settings.alwaysOnTop)}${toggle('showDetails','显示天气文字','在场景下方显示温度与地点',state.settings.showDetails)}</div></section><section class="settings-group"><h3>动画与节能</h3><div class="toggle-list">${toggle('pauseOnFullscreen','全屏时暂停','减少游戏或视频播放时的占用',state.settings.pauseOnFullscreen)}${toggle('pauseOnBattery','电池供电时暂停','接通电源后恢复动画',state.settings.pauseOnBattery)}${toggle('reducedMotion','减少动态效果','保留静态天气与数据更新',state.settings.reducedMotion)}</div></section><details class="advanced-settings"><summary>渲染质量与帧率</summary><div class="frame-row"><label for="quality">渲染质量</label><select id="quality">${[['economy','节能 · 无实时阴影'],['balanced','均衡 · 推荐'],['high','精细']].map(([v,l])=>`<option value="${v}" ${(state.settings.quality||'balanced')===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="frame-row"><label for="fps">动画帧率</label><select id="fps">${[15,30,60].map(n=>`<option value="${n}" ${state.settings.fps===n?'selected':''}>${n} FPS${n===30?' · 推荐':''}</option>`).join('')}</select></div></details><button class="subtle-button startup-button" data-action="startup" ${!state.packaged?'disabled':''}>${state.autoStart?'开机启动：已开启 · 点击关闭':'开机启动：已关闭 · 点击开启'}</button>${!state.packaged?'<p class="hint">开机启动在打包版本中可用。</p>':''}`;
    el.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(i=>i.onchange=()=>settings({[i.dataset.setting!]:i.checked}));
    el.querySelector<HTMLInputElement>('#widget-size')!.onchange=e=>settings({size:Number((e.target as HTMLInputElement).value)});
    el.querySelector<HTMLSelectElement>('#quality')!.onchange=e=>settings({quality:(e.target as HTMLSelectElement).value});
    el.querySelector<HTMLSelectElement>('#fps')!.onchange=e=>settings({fps:Number((e.target as HTMLSelectElement).value)});
  }
}

function renderSources(el:Element){
  if(el.querySelector('#provider-form')?.contains(document.activeElement))return;
  const names=[['openmeteo','Open-Meteo'],['metno','MET Norway'],['qweather','和风天气'],['openweather','OpenWeather']];
  const c=state.credentialStatus;
  el.innerHTML=`<h2>天气源与故障切换</h2><p class="section-intro">两个免密钥源开箱可用。配置个人密钥后，可加入更多备用源。</p><label class="landmark-select">优先来源<select id="weather-source">${[['auto','自动 · 推荐'],...names].map(([v,n])=>`<option value="${v}" ${(state.settings.weatherSource||'auto')===v?'selected':''}>${n}</option>`).join('')}</select></label><p class="hint">优先源不可用时，仍会尝试其他已配置来源。</p><ul class="source-status">${names.map(([id,name])=>{const s=state.sources?.find(s=>s.id===id);return `<li><strong>${name}</strong><span>${esc(s?.detail||(s?.configured===false?'尚未配置':'等待请求'))}</span></li>`;}).join('')}</ul><div class="divider"></div><h3>空气质量来源</h3><p class="hint">独立使用 Open-Meteo / CAMS 模型数据，约每 15 分钟获取一次。AQI 使用美国标准；服务不可用时保留缓存，暂不参与天气源故障切换。</p><button class="text-button" data-action="air-source">空气质量数据说明</button><form id="provider-form" class="provider-form"><h3>添加个人 API 密钥</h3><label>OpenWeather<input name="openweather" type="password" autocomplete="new-password" maxlength="512" placeholder="${c?.openweather?'已配置 · 留空保留':'输入 API Key'}" /></label><label>和风天气 API Host<input name="qweatherHost" autocomplete="off" maxlength="160" value="${esc(c?.qweatherHost||'')}" placeholder="控制台中的 xxx.qweatherapi.com" /></label><label>和风天气 API Key<input name="qweather" type="password" autocomplete="new-password" maxlength="512" placeholder="${c?.qweather?'已配置 · 留空保留':'输入 API Key'}" /></label><p class="hint">密钥经 Windows 加密保存在本机，仅向对应服务发送。服务额度以个人账号为准。</p><button class="primary-button" ${!state.desktop?'disabled':''}>保存配置并更新</button><div class="credential-remove">${c?.openweather?'<button type="button" class="text-button" data-remove-key="openweather">移除 OpenWeather 密钥</button>':''}${c?.qweather?'<button type="button" class="text-button" data-remove-key="qweather">移除和风密钥</button>':''}</div></form><p class="asset-note">MET Norway 数据按 CC BY 4.0 归一化展示；模型预报不等同于实测。和风当前接口没有观测时间时仅标注获取时间。</p><div class="source-links">${names.map(([id,n])=>`<button class="text-button" data-action="source:${id}">${n} 官网</button>`).join('')}<button class="text-button" data-action="license">CC BY 4.0 许可</button></div>`;
  el.querySelector<HTMLSelectElement>('#weather-source')!.onchange=e=>settings({weatherSource:(e.target as HTMLSelectElement).value});
  el.querySelector<HTMLFormElement>('#provider-form')!.onsubmit=async e=>{e.preventDefault();const form=e.currentTarget as HTMLFormElement,data=new FormData(form),patch:Record<string,string|null>={qweatherHost:String(data.get('qweatherHost')||'')};for(const key of ['openweather','qweather']){const v=String(data.get(key)||'').trim();if(v)patch[key]=v;}const button=form.querySelector<HTMLButtonElement>('button')!;button.disabled=true;try{state=await bridge.credentials(patch);form.reset();(document.activeElement as HTMLElement)?.blur();render();toast('天气源配置已保存');}catch(err){toast((err as Error).message);button.disabled=false;}};
  el.querySelectorAll<HTMLButtonElement>('[data-remove-key]').forEach(b=>b.onclick=async()=>{try{state=await bridge.credentials({[b.dataset.removeKey!]:null});(document.activeElement as HTMLElement)?.blur();render();}catch(e){toast((e as Error).message);}});
}

function render(){
  applySkin(state);
  document.body.classList.toggle('reduce-motion',state.settings.reducedMotion);
  guide?.update();
  if(view==='tools'){renderDeskTools(document.querySelector('#desk-board')!,state,bridge,next=>{state=next;render();},toast,true);return;}
  const focusId=(document.activeElement as HTMLElement)?.id;
  if(view==='settings') {
    document.body.dataset.tab=tab;
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});
    document.querySelector('#page-title')!.textContent={weather:'此刻的天气',scene:'我的场景',display:'桌面与运行',sources:'天气来源',account:'激活与更新',tools:'桌面小工具'}[tab]!;
    document.querySelector('#page-description')!.textContent={weather:'看此刻的变化，也看接下来的趋势。',scene:'一个熟悉的地标，或一间安静的小屋。',display:'保留风景，把打扰减到最少。',sources:'一个服务暂时离线，天气仍有下一条来路。',account:'按需解锁，安心更新。',tools:'记下小事，也期待重要的日子。'}[tab]!;
    document.querySelector('#header-location')!.textContent=state.settings.location?.name||'选择地点';
    document.querySelector('#preview-location')!.textContent=state.settings.location?`${state.settings.location.name} · ${state.weather?.timezone?clock(Date.now()):'等待天气'}`:'尚未设置地点';
    document.querySelector('#preview-tag')!.textContent=demo||demoWind!==undefined?'演示天气 / 风力':'场景预览';
    document.querySelector('#preview-tag')!.classList.toggle('demo',!!demo||demoWind!==undefined);
    document.querySelector('#model-caption')!.textContent=modelName();
    const currentLandmark=landmarks.find(l=>l.id===state.model);document.querySelector('.preview-caption span:last-child')!.textContent=currentLandmark?currentLandmark.signature+' · 拖动旋转':'拖动景观，换个角度';
    document.querySelector('#preview-status')!.textContent=state.pauseReason||(state.settings.reducedMotion?'已减少动态效果':demo?'正在预览演示天气':'随当地天气变化');
    const pause=document.querySelector<HTMLButtonElement>('#pause-button')!;pause.innerHTML=icon(state.settings.paused?'play':'pause',18);pause.setAttribute('aria-label',state.settings.paused?'恢复动画':'暂停动画');
    const error=document.querySelector<HTMLElement>('#error-banner')!;error.hidden=!state.error;error.textContent=state.error?`${state.error}${state.weather?' · 已保留最后有效天气':''}`:'';
    document.querySelector<HTMLElement>('#browser-banner')!.hidden=state.desktop;
    document.querySelector('#resident-label')!.textContent=state.desktop?'在托盘中陪伴':'浏览器演示预览';
    renderInspector();
    const lower=document.querySelector('#lower-panel')!;
    if(tab==='weather') {
      renderTrends(lower,state,clock,render);
      const hours=(state.weather?.hours||[]).filter(h=>h.time>=Date.now()-3600000);
      lower.insertAdjacentHTML('beforeend',`<section class="forecast-strip"><div class="section-heading"><h2>逐时天气</h2><span>${hours.length?'已提供 '+hours.length+' 个时段 · 当地时间':'等待逐时预报'}</span></div>${hours.length?`<div class="hourly" tabindex="0" role="region" aria-label="逐时天气，可横向滚动">${hours.map(h=>`<div class="hour"><span>${clock(h.time)}</span>${icon(h.code>=95?'storm':h.code>=71&&h.code<=77?'snow':h.code>=51?'rain':h.code<=1?'sun':'cloud',18)}<strong>${Math.round(h.temperature)}°</strong><small>${h.precipitation===null?'—':h.precipitation+'%'} 降水</small></div>`).join('')}</div>`:'<p class="forecast-empty">当前天气源未提供逐时预报，未填造数据。</p>'}</section>`);
    } else {lower.innerHTML=`<div class="bottom-note">${icon(tab==='scene'?'info':'lock',18)}<p>${tab==='scene'?'天气预览只用于查看效果。返回“当地”，就会继续跟随所选位置的天气。':tab==='sources'?'自动模式依次尝试 Open-Meteo、MET Norway、已配置的和风天气和 OpenWeather。优先源失败仍会切换，全部失败保留缓存。':'摆件不见了？在系统托盘右键栖候，选择“编辑摆件 / 恢复位置”，或按 Ctrl+Alt+W。'}</p></div>`;}
    if(tab==='weather'){
      lower.insertAdjacentHTML('beforeend',`<section class="daily-tools"><div class="insight-list">${(state.insights||[]).slice(0,3).map(t=>`<div><strong>${esc(t.title)}</strong><span>${esc(t.detail)}</span></div>`).join('')}</div><div class="favorite-heading"><h2>常用地点</h2><button class="text-button" id="favorite-current">${icon('heart',16)}${state.favorites?.some(p=>p.id===state.settings.location?.id)?'取消当前收藏':'收藏当前地点'}${state.activation?.active?'':' · Plus'}</button></div><div class="favorite-list">${state.favorites?.length?state.favorites.map(p=>`<button class="subtle-button" data-favorite-id="${esc(p.id)}">${icon('pin',14)}${esc(p.name)}</button>`).join(''):'<p class="hint">把家、工作地与旅行城市留在这里，一键切换。</p>'}</div><button class="text-button" id="export-history">导出本机记录 · CSV ${state.activation?.active?'':'· Plus'}</button></section>`);
      const gate=()=>{if(state.activation?.active)return true;tab='account';render();return false;};
      lower.querySelector<HTMLButtonElement>('#favorite-current')!.onclick=async()=>{if(!gate())return;if(!state.settings.location){openLocation();return;}try{state=await bridge.favorite!({action:'toggle'});render();}catch(e){toast((e as Error).message);}};
      lower.querySelectorAll<HTMLButtonElement>('[data-favorite-id]').forEach(b=>b.onclick=async()=>{if(!gate())return;try{state=await bridge.favorite!({action:'select',id:b.dataset.favoriteId});render();}catch(e){toast((e as Error).message);}});
      lower.querySelector<HTMLButtonElement>('#export-history')!.onclick=()=>{if(gate())void action('export');};
    }else if(tab==='scene'){
      lower.insertAdjacentHTML('beforeend',`<section class="city-library"><div class="section-heading"><h2>${landmarks.length} 座城市 · 各有一个轮廓</h2><span>经典模型全部免费</span></div><label class="city-filter">筛选地标<input id="city-filter" placeholder="城市或建筑名称" autocomplete="off"/><span id="city-count">${landmarks.length} 个地标</span></label><div class="city-grid">${landmarks.map(l=>`<button data-city="${l.id}" aria-pressed="${state.model===l.id}"><strong>${l.city}</strong><span>${l.name}</span><small>${l.signature}</small></button>`).join('')}</div><p class="hint">${esc(landmarks.find(l=>l.id===state.model)?.story||'从熟悉的城市开始。')} · 原创微缩示意模型</p></section>`);
      lower.querySelector<HTMLInputElement>('#city-filter')!.oninput=e=>{const q=(e.target as HTMLInputElement).value.trim().toLowerCase();let count=0;lower.querySelectorAll<HTMLButtonElement>('[data-city]').forEach(b=>{const l=landmarks.find(l=>l.id===b.dataset.city)!;b.hidden=![l.city,l.name,l.en].some(v=>v.toLowerCase().includes(q));if(!b.hidden)count++;});lower.querySelector('#city-count')!.textContent=count?`${count} 个地标`:'暂无匹配地标';};
      lower.querySelectorAll<HTMLButtonElement>('[data-city]').forEach(b=>b.onclick=()=>settings({model:'landmark',landmarkId:b.dataset.city}));
    }
    document.querySelector('#source-line')!.textContent=state.desktop?(state.weather?`${state.weather.provider} · ${state.weather.dataType==='forecast'?'当前时段预报':state.weather.dataType==='model'?'天气模型数据':'当前天气'} · 获取 ${clock(state.weather.fetchedAt)}${state.weather.sourceNote?' · '+state.weather.sourceNote:''}`:'等待天气源返回数据'):'浏览器预览使用演示数据';
    const refresh=document.querySelector<HTMLButtonElement>('#refresh-button')!;refresh.disabled=state.loading||!state.settings.location;refresh.innerHTML=icon('refresh',14)+(state.loading?'正在更新…':'更新天气');
  }else{
    const w=state.weather;document.querySelector<HTMLElement>('#widget-info')!.hidden=!state.settings.showDetails;
    const readout=w?`<div class="widget-readout"><span class="widget-place">${esc(state.settings.location?.name)}</span><strong>${number(w.temperature,'°')}</strong><span class="widget-condition">${esc(w.label)} · 体感 ${number(w.feelsLike,'°')}</span><small>${esc(freshness())}${state.pauseReason?' · '+esc(state.pauseReason):''}</small></div>`:`<div class="widget-readout unconfigured"><strong>栖候</strong><span>${state.loading?'正在获取天气…':state.settings.location?'天气暂不可用':'右键托盘图标，选择天气地点'}</span>${state.error?`<small>${esc(state.error)}</small>`:''}</div>`;
    if(readout!==lastReadout){document.querySelector('#widget-info')!.innerHTML=readout;lastReadout=readout;}
  }
  if(focusId){const focus=document.getElementById(focusId);if(focus&&focus!==document.activeElement)focus.focus({preventScroll:true});}
  scene?.update(state,view==='settings'?demo:undefined,demoNight,view==='settings'?demoWind:undefined);
}
try{if(view!=='tools')scene=new WeatherScene(document.querySelector('#scene-host')!,view);}catch(e){document.querySelector('#scene-host')!.innerHTML='<div class="scene-fallback">3D 渲染不可用<br><small>请检查显卡驱动；天气文字仍可使用。</small></div>';console.error(e);}
if(state.testMode)Object.defineProperty(window,'qihouTest',{value:()=>scene?.stats()});
bridge.subscribe(next=>{state=next;render();});
render();
if(view==='settings'&&state.desktop&&!state.settings.onboardingComplete)guide?.show();
const clockTimer=setInterval(()=>{if(!document.hidden)render();},60_000);
window.addEventListener('beforeunload',()=>{clearInterval(clockTimer);scene?.dispose();});

