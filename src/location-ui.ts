import type {Bridge,Location} from './types';
import {escapeHtml as esc} from './ui-utils';
import landmarks from '../shared/landmarks.json';

export function mountLocationPicker(bridge:Bridge,apply:(location:Partial<Location>)=>Promise<void>){
  const dialog=document.querySelector<HTMLDialogElement>('#location-dialog')!;
  const form=dialog.querySelector<HTMLFormElement>('#search-form')!,query=dialog.querySelector<HTMLInputElement>('#location-query')!;
  const feedback=dialog.querySelector<HTMLElement>('#search-feedback')!,results=dialog.querySelector<HTMLElement>('#search-results')!,button=dialog.querySelector<HTMLButtonElement>('#search-button')!;
  let version=0,locations:Location[]=[],choosing=false;
  const message=(e:unknown)=>(e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  async function select(location:Partial<Location>){
    if(choosing)return;choosing=true;version++;feedback.textContent='正在应用地点并获取天气…';
    dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);
    try{await apply(location);dialog.close();}catch(e){feedback.textContent=message(e);}finally{choosing=false;dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=false);button.textContent='搜索';}
  }
  async function search(){
    const text=query.value.trim();if(text.length<2)return;const request=++version;button.disabled=true;button.textContent='搜索中…';feedback.textContent='正在查找地点…';results.replaceChildren();
    try{
      const found=await bridge.search(text);if(request!==version)return;locations=found;
      feedback.textContent=found.length?`找到 ${found.length} 个地点。选择后自动匹配当地场景。`:'未找到，请试试城市名或下方经纬度定位。';
      results.innerHTML=found.map((l,i)=>{const landmark=landmarks.find(item=>item.city===l.name.replace(/市$/,''));return `<button class="location-result" data-location="${i}"><span><strong>${esc(l.name)}</strong><small>${esc([l.admin,l.country].filter(Boolean).join(' · '))}</small><small class="location-match">${landmark?`当地地标 · ${esc(landmark.name)}`:'按坐标匹配 · 无适用地标时显示小屋'}</small></span><span aria-hidden="true">→</span></button>`;}).join('');
    }catch(e){if(request===version)feedback.textContent=message(e);}finally{if(request===version){button.disabled=false;button.textContent='搜索';}}
  }
  form.onsubmit=e=>{e.preventDefault();void search();};
  results.addEventListener('click',e=>{const target=(e.target as HTMLElement).closest<HTMLElement>('[data-location]');if(target)void select(locations[Number(target.dataset.location)]);});
  dialog.querySelector<HTMLFormElement>('#coordinate-form')!.onsubmit=e=>{e.preventDefault();const data=new FormData(e.currentTarget as HTMLFormElement);void select({name:String(data.get('name')),latitude:Number(data.get('latitude')),longitude:Number(data.get('longitude'))});};
  dialog.querySelector<HTMLButtonElement>('#close-dialog')!.onclick=()=>dialog.close();
  const quick=document.createElement('div');quick.className='quick-cities';quick.innerHTML='<span>快速选择</span>'+['北京','上海','青岛','哈尔滨','南昌','拉萨','昆明','乌鲁木齐'].map(c=>`<button type="button" class="subtle-button" data-quick-city="${c}">${c}</button>`).join('');form.after(quick);
  quick.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.onclick=()=>{query.value=b.dataset.quickCity!;void search();});
  dialog.addEventListener('close',()=>{version++;button.disabled=false;button.textContent='搜索';});
  return {show:()=>{if(!dialog.open)dialog.showModal();query.focus();},choose:select};
}
