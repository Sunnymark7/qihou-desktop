import type {AppState,Bridge} from './types';
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const when=(t:number|null|undefined)=>t?new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(t):'—';
export function renderEdition(el:Element,state:AppState,bridge:Bridge,changed:(s:AppState)=>void,toast:(s:string)=>void){
  if(el.querySelector('#activation-form')?.contains(document.activeElement))return;
  const a=state.activation,u=state.updates,active=!!a?.active;
  const labels:Record<string,string>={idle:'更新检测待开始',development:'开发预览中',checking:'正在检查 GitHub 发布版本…',current:'已是最新版本',available:'有新版本可用',downloading:`正在下载 ${u?.percent||0}%`,downloaded:'下载完成，可安装并重启',error:'更新暂不可用'};
  el.innerHTML=`<div class="edition-page"><section class="activation-section"><div class="account-heading"><div><h2>${active?a?.plan==='lifetime'?'永久版已激活':'体验版已激活':'让小小天气，多一点细节'}</h2><p>${active?a?.plan==='trial'?`有效期至 ${when(a.expiresAt)}`:'此设备可永久使用增强功能':'免费版随时可用。按需解锁增强功能，安全更新始终免费。'}</p></div><span class="edition-badge">${active?'栖候 Plus':'免费版'}</span></div>
    <div class="plan-options"><div><strong>7 天体验</strong><p><b>¥1</b><span>一次性 · 自激活码签发起 7 天</span></p></div><div><strong>永久激活</strong><p><b>¥5</b><span>一次性 · 当前设备绑定</span></p></div></div>
    <p class="edition-description">增强功能：精雕地标与夜景、桌面便利贴、倒数日、四套场景皮肤、8 个收藏地点、7 天本机历史与 CSV 导出。经典地标、实时天气、24 小时记录和桌面摆件继续免费。</p>
    <ol class="activation-steps"><li>将设备码提供给发布者，并选择体验或永久方案。</li><li>人工确认收款后，发布者签发此设备的激活码。</li><li>在下方粘贴激活码，离线完成验证。</li></ol>
    <div class="device-row"><label>本机设备码<input readonly value="${esc(a?.device||'桌面版中可用')}" aria-label="本机设备码"/></label><button class="subtle-button" data-action="copy-device" ${!a?'disabled':''}>复制设备码</button></div>
    <form id="activation-form"><label for="activation-code">激活码</label><textarea id="activation-code" name="code" rows="3" maxlength="4096" autocomplete="off" placeholder="粘贴完整 QH1 激活码" required></textarea><div><button class="primary-button" ${!state.desktop?'disabled':''}>${active?'更换激活码':'验证并激活'}</button><button type="button" class="subtle-button" data-action="buy" ${!state.edition?.purchaseUrl?'disabled':''}>购买激活码</button></div></form>
    <p class="hint" role="status">${esc(a?.message||(!state.edition?.purchaseUrl?'发布者尚未配置收款入口，当前使用人工收款与签发。':'付款后请向发布者领取激活码。'))}</p></section>
    <section class="update-section"><div class="account-heading"><div><h2>版本与更新</h2><p>当前 ${esc(state.version||'开发版')} · ${esc(labels[u?.status||'development'])}</p></div><button class="subtle-button" data-action="check-update" ${['checking','downloading','downloaded','development'].includes(u?.status||'development')?'disabled':''}>检查更新</button></div>
    ${u?.latest?`<p class="hint">发布版本 ${esc(u.latest)} · 最近检查 ${when(u.lastChecked)}</p>`:''}${u?.error?`<p class="update-error" role="status">${esc(u.error)}</p>`:''}
    ${u?.status==='available'?'<button class="primary-button" data-action="download-update">下载已验证的更新</button>':''}${u?.status==='downloading'?`<progress max="100" value="${u.percent}"></progress>`:''}${u?.status==='downloaded'?'<button class="primary-button" data-action="install-update">安装更新并重启</button>':''}
    <p class="hint">后台每 4 小时检查一次。下载前核验发布签名，安装前校验文件；只在你选择后安装。</p><button class="text-button" data-action="repository">GitHub 源码与发布记录</button></section></div>`;
  el.querySelector<HTMLFormElement>('#activation-form')!.onsubmit=async e=>{e.preventDefault();const form=e.currentTarget as HTMLFormElement;const b=form.querySelector<HTMLButtonElement>('button')!;b.disabled=true;try{const next=await bridge.activate!(String(new FormData(form).get('code')||''));(document.activeElement as HTMLElement)?.blur();changed(next);toast('激活成功，增强功能已解锁');}catch(err){toast((err as Error).message);b.disabled=false;}};
}
