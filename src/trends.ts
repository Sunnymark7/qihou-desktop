import type { AppState } from './types';

type Point={time:number;value:number|null;source?:string};
let period:'forecast'|'history'|'week'='forecast';
let airMetric:'aqi'|'pm25'|'pm10'='aqi';
const selected:Record<string,number>={};
const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const format=(n:number|null)=>n===null?'暂无数据':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(n);
export function airLevel(aqi:number|null|undefined){return aqi==null?'暂无指数':aqi<=50?'良好':aqi<=100?'中等':aqi<=150?'敏感人群不健康':aqi<=200?'不健康':aqi<=300?'非常不健康':'危险';}

function chart(id:string,points:Point[],unit:string,clock:(time:number)=>string,domain:[number,number],nonnegative=false,axisClock=clock){
  const usable=points.filter(p=>p.value!==null);
  if(!usable.length)return `<div class="chart-empty"><p>${period!=='forecast'?'还没有这段时间的记录':'当前来源没有可用预报'}</p><span>${period!=='forecast'?'程序运行时自动积累；离线时段不补造数据。':'已有数据会继续保留，可稍后更新。'}</span></div>`;
  const values=usable.map(p=>p.value!);
  const min=Math.min(...values),max=Math.max(...values),pad=Math.max(1,(max-min)*.15);
  const lo=nonnegative?Math.max(0,Math.floor(min-pad)):Math.floor(min-pad),hi=Math.ceil(max+pad);
  const x=(t:number)=>48+(t-domain[0])/(domain[1]-domain[0])*430;
  const y=(v:number)=>150-(v-lo)/(hi-lo)*122;
  let path='',previous:Point|undefined;
  for(const p of points){
    if(p.value===null){previous=undefined;continue;}
    const connected=previous&&p.time-previous.time<=90*60000&&p.source===previous.source;
    path+=`${connected?'L':'M'}${x(p.time).toFixed(2)},${y(p.value).toFixed(2)} `;previous=p;
  }
  const ticks=Array.from({length:4},(_,i)=>lo+(hi-lo)*i/3);
  let index=points.findIndex(p=>p.time===selected[id]);if(index<0)index=0;
  const p=points[index];
  const label=(p:Point)=>`${clock(p.time)} · ${format(p.value)}${p.value===null?'':` ${unit}`}${p.source?' · '+p.source:''}`;
  return `<div class="chart" data-chart="${id}">
    <output id="${id}-readout" for="${id}-cursor" class="chart-readout">${escape(label(p))}</output>
    <svg class="trend-plot" viewBox="0 0 500 184" role="img" aria-labelledby="${id}-plot-title ${id}-plot-desc">
      <title id="${id}-plot-title">${id==='temperature'?'温度':'空气质量'}趋势，单位 ${escape(unit)}</title><desc id="${id}-plot-desc">${period!=='forecast'?period==='week'?'过去7天已获取记录':'过去24小时已获取记录':'未来12小时模型预报'}。拖动下方时间滑块或使用方向键读取数值，详细数据表位于图表下方。</desc>
      ${ticks.map(v=>`<line x1="48" x2="478" y1="${y(v)}" y2="${y(v)}" class="chart-grid"/><text x="38" y="${y(v)+4}" text-anchor="end">${format(v)}</text>`).join('')}
      ${[0,.5,1].map(f=>`<text x="${48+430*f}" y="176" text-anchor="${f===0?'start':f===1?'end':'middle'}">${axisClock(domain[0]+(domain[1]-domain[0])*f)}</text>`).join('')}
      <path d="${path}" fill="none" class="chart-line"/>
      ${usable.map(p=>`<circle cx="${x(p.time)}" cy="${y(p.value!)}" r="2.6" class="chart-dot"><title>${escape(label(p))}</title></circle>`).join('')}
      <line data-cursor x1="${x(p.time)}" x2="${x(p.time)}" y1="20" y2="150" class="chart-cursor"/>
    </svg>
    <label class="sr-only" for="${id}-cursor">选择${id==='temperature'?'温度':'空气质量'}数据时间</label>
    <input id="${id}-cursor" class="chart-slider" type="range" min="0" max="${points.length-1}" value="${index}" step="1" aria-valuetext="${escape(label(p))}" ${points.length===1?'disabled':''}/>
    <details class="chart-table"><summary>查看 ${points.length} 个时间点</summary><div><table><caption>${period!=='forecast'?'已获取记录':'预报'} · ${escape(unit)}</caption><thead><tr><th scope="col">当地时间</th><th scope="col">数值</th><th scope="col">来源</th></tr></thead><tbody>${points.map(p=>`<tr><td>${clock(p.time)}</td><td>${format(p.value)}</td><td>${escape(p.source||'—')}</td></tr>`).join('')}</tbody></table></div></details>
  </div>`;
}

export function renderTrends(host:Element,state:AppState,clock:(time:number)=>string,rerender:()=>void){
  if(period==='week'&&!state.activation?.active)period='history';
  const now=Date.now(),hour=Math.floor(now/3600000)*3600000;
  const domain:[number,number]=period!=='forecast'?[now-(period==='week'?7:1)*86400000,now]:[hour,hour+12*3600000];
  const w=state.weather,env=state.environment,a=env?.air;
  const filter=(points:Point[])=>points.filter(p=>p.time>=domain[0]&&p.time<=domain[1]).sort((a,b)=>a.time-b.time);
  const temps=filter(period!=='forecast'?(env?.history.weather||[]).map(p=>({time:p.time,value:p.temperature,source:p.source})):(w?.hours||[]).map(p=>({time:p.time,value:p.temperature,source:w?.provider})));
  const air=filter((period!=='forecast'?env?.history.air||[]:a?.hours||[]).map(p=>({time:p.time,value:p[airMetric],source:'Open-Meteo / CAMS'})));
  const unit=airMetric==='aqi'?'US AQI':'µg/m³';
  const dateClock=(t:number)=>{const zone=w?.timezone||state.settings.location?.timezone||'Asia/Shanghai';try{return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:zone}).format(t+(w?.utcOffsetSeconds||0)*1000);}catch{return clock(t);}};
  host.innerHTML=`<div class="section-heading trend-heading"><h2>温度与空气</h2><div class="period-switch" role="group" aria-label="趋势时间范围"><button data-period="forecast" aria-pressed="${period==='forecast'}">未来 12 小时</button><button data-period="history" aria-pressed="${period==='history'}">过去 24 小时记录</button><button data-period="week" aria-pressed="${period==='week'}">7 天 ${state.activation?.active?'':'· Plus'}</button></div></div>
    <div class="trend-grid"><section class="trend-panel" aria-labelledby="temperature-title"><div class="chart-heading"><h3 id="temperature-title">温度 <span>°C</span></h3><span>${period!=='forecast'?'本机积累':escape(w?.provider||'等待天气')}</span></div>${chart('temperature',temps,'°C',dateClock,domain,false,period==='week'?t=>dateClock(t).split(' ')[0]:clock)}</section>
    <section class="trend-panel air-trend" aria-labelledby="air-title"><div class="chart-heading"><h3 id="air-title">空气质量</h3><label><span class="sr-only">空气质量指标</span><select id="air-metric">${[['aqi','AQI · 美国标准'],['pm25','PM2.5 · µg/m³'],['pm10','PM10 · µg/m³']].map(([key,label])=>`<option value="${key}" ${key===airMetric?'selected':''}>${label}</option>`).join('')}</select></label></div>${chart('air',air,unit,dateClock,domain,true,period==='week'?t=>dateClock(t).split(' ')[0]:clock)}</section></div>
    <p class="trend-note" role="status">${env?.loading?'空气质量更新中… ':''}${env?.error?escape(env.error)+(a?' · 显示缓存。 ':'。 '):''}${a?`空气数据 ${dateClock(a.time)} · 获取 ${clock(a.fetchedAt)}${now-a.fetchedAt>30*60000?' · 缓存待更新':''}。 `:''}空气质量为 CAMS 模型估算，AQI 使用美国标准。${period!=='forecast'?'记录按数据时间排列，断档和来源切换不连线。':'预报不代表实测；缺失值不连线。'}</p>
    <div class="trend-attribution"><button class="text-button" data-action="air-source">Open-Meteo 空气数据</button><button class="text-button" data-action="cams-source">Copernicus CAMS</button></div>`;
  host.querySelectorAll<HTMLButtonElement>('[data-period]').forEach(b=>b.onclick=()=>{if(b.dataset.period==='week'&&!state.activation?.active){document.querySelector<HTMLButtonElement>('[data-tab=account]')?.click();return;}period=b.dataset.period as typeof period;rerender();});
  host.querySelector<HTMLSelectElement>('#air-metric')!.onchange=e=>{airMetric=(e.target as HTMLSelectElement).value as typeof airMetric;rerender();};
  for(const [id,points,units] of [['temperature',temps,'°C'],['air',air,unit]] as [string,Point[],string][]){
    const input=host.querySelector<HTMLInputElement>(`#${id}-cursor`);if(!input)continue;
    const update=(index:number)=>{const p=points[index];if(!p)return;selected[id]=p.time;input.value=String(index);const label=`${dateClock(p.time)} · ${format(p.value)}${p.value===null?'':' '+units}${p.source?' · '+p.source:''}`;input.setAttribute('aria-valuetext',label);host.querySelector(`#${id}-readout`)!.textContent=label;const cursor=host.querySelector(`[data-chart="${id}"] [data-cursor]`)!;const x=48+(p.time-domain[0])/(domain[1]-domain[0])*430;cursor.setAttribute('x1',String(x));cursor.setAttribute('x2',String(x));};
    input.oninput=()=>update(Number(input.value));
    const svg=host.querySelector<SVGSVGElement>(`[data-chart="${id}"] svg`)!;
    svg.onpointermove=e=>{const box=svg.getBoundingClientRect(),t=domain[0]+((e.clientX-box.left)/box.width*500-48)/430*(domain[1]-domain[0]);let i=0;points.forEach((p,j)=>{if(Math.abs(p.time-t)<Math.abs(points[i].time-t))i=j;});update(i);};
  }
}
