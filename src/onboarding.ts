import type {AppState,Settings} from './types';
import {escapeHtml as esc} from './ui-utils';
import landmarks from '../shared/landmarks.json';

export function mountOnboarding(getState:()=>AppState,save:(patch:Partial<Settings>)=>Promise<void>,choose:()=>void,appIcon:string){
  const dialog=document.createElement('dialog');dialog.id='onboarding-dialog';dialog.className='onboarding';dialog.setAttribute('aria-labelledby','onboarding-title');document.body.append(dialog);
  let step=0,busy=false,returnFromLocation=false;
  async function finish(){if(busy)return;busy=true;try{await save({onboardingComplete:true});dialog.close();}catch{}finally{busy=false;}}
  function render(){
    const s=getState(),place=s.settings.location?.name,model=landmarks.find(l=>l.id===s.availableLandmark);
    const contents=[
      `<h2 id="onboarding-title">让天气住进桌面</h2><p>选择一个城市，栖候会自动匹配地标、昼夜与当地天气。</p><div class="onboarding-place"><strong>${esc(place||'从你的城市开始')}</strong><span>${place?esc(model?`自动匹配 · ${model.name}`:'自动匹配 · 林间小屋'):'也可在地点选择中输入经纬度'}</span><button class="subtle-button" id="onboarding-location">${place?'更换地点':'选择天气地点'}</button></div><small>地点保存在本机。内置城市可离线检索；天气查询需要联网。</small>`,
      `<h2 id="onboarding-title">按你的节奏运行</h2><p>天气持续更新，动画可以更安静，也可以更省电。</p><div class="onboarding-options">${[['visible','显示桌面摆件','关闭后仍可在托盘查看天气'],['pauseOnBattery','电池供电时暂停动画','接通电源后恢复'],['reducedMotion','减少动态效果','用静态场景呈现天气']].map(([key,title,detail])=>`<label class="toggle-row"><span><strong>${title}</strong><small>${detail}</small></span><input type="checkbox" data-guide-setting="${key}" ${s.settings[key as keyof Settings]?'checked':''}/></label>`).join('')}</div>`,
      `<h2 id="onboarding-title">随时回来，一直陪伴</h2><p>关闭控制面板，栖候会继续在后台运行。</p><ol class="onboarding-tips"><li><strong>托盘是控制入口</strong><span>单击图标打开面板；右键切换场景、暂停或退出。</span></li><li><strong>拖到喜欢的位置</strong><span>在桌面拖动建筑移动摆件；在面板拖动建筑旋转预览。</span></li><li><strong>轻松找回摆件</strong><span>按 Ctrl+Alt+W，或从托盘选择“编辑摆件 / 恢复位置”。</span></li></ol>`
    ];
    dialog.innerHTML=`<div class="onboarding-top"><img src="${appIcon}" alt=""/><button class="text-button" id="onboarding-skip">稍后设置</button></div><div class="onboarding-content">${contents[step]}</div><div class="onboarding-footer"><div class="guide-progress" aria-label="第 ${step+1} 步，共 3 步">${[0,1,2].map(i=>`<span class="${i===step?'current':''}"></span>`).join('')}</div><div>${step?'<button class="subtle-button" id="onboarding-back">上一步</button>':''}<button class="primary-button" id="onboarding-next" ${step===0&&!place?'disabled':''}>${step===2?'开始使用':'继续'}</button></div></div>`;
    dialog.querySelector<HTMLButtonElement>('#onboarding-skip')!.onclick=()=>void finish();
    dialog.querySelector<HTMLButtonElement>('#onboarding-next')!.onclick=()=>{if(step===2)void finish();else{step++;render();dialog.querySelector<HTMLButtonElement>('#onboarding-next')?.focus();}};
    const back=dialog.querySelector<HTMLButtonElement>('#onboarding-back');if(back)back.onclick=()=>{step--;render();};
    const location=dialog.querySelector<HTMLButtonElement>('#onboarding-location');if(location)location.onclick=()=>{returnFromLocation=true;dialog.close();choose();};
    dialog.querySelectorAll<HTMLInputElement>('[data-guide-setting]').forEach(input=>input.onchange=async()=>{input.disabled=true;try{await save({[input.dataset.guideSetting!]:input.checked});}catch{input.checked=Boolean(getState().settings[input.dataset.guideSetting as keyof Settings]);}finally{input.disabled=false;}});
  }
  const show=()=>{step=0;render();if(!dialog.open)dialog.showModal();dialog.querySelector<HTMLButtonElement>('#onboarding-location')?.focus();};
  document.querySelector('#location-dialog')?.addEventListener('close',()=>{if(returnFromLocation){returnFromLocation=false;render();dialog.showModal();}});
  dialog.addEventListener('cancel',e=>{e.preventDefault();void finish();});
  return {show,update:()=>{if(dialog.open&&step===0)render();}};
}
