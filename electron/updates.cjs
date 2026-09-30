const crypto=require('node:crypto');
function compareVersions(a,b){
  const parse=v=>{if(typeof v!=='string'||!/^\d+\.\d+\.\d+$/.test(v))throw Error('版本格式无效');return v.split('.').map(Number);};
  const x=parse(a),y=parse(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;
}
function verifyManifest(envelope,publicKey,repository){
  if(typeof envelope?.payload!=='string'||envelope.payload.length>16000||typeof envelope?.signature!=='string')throw Error('更新清单格式无效');
  const bytes=Buffer.from(envelope.payload,'base64url');
  if(!crypto.verify(null,bytes,publicKey,Buffer.from(envelope.signature,'base64url')))throw Error('更新清单签名无效，已停止更新');
  let p;try{p=JSON.parse(bytes);}catch{throw Error('更新清单内容无效');}
  compareVersions(p.version,'0.0.0');
  if(p.repository!==repository||p.file!==`Qihou-${p.version}-Setup-x64.exe`||!Number.isSafeInteger(p.size)||p.size<=0||p.size>1024**3||typeof p.sha512!=='string'||Buffer.from(p.sha512,'base64').length!==64)throw Error('更新清单与应用不匹配');
  return p;
}
function matchesInfo(info,signed){
  return info?.version===signed.version&&Array.isArray(info.files)&&info.files.length===1&&
    info.files[0].url===signed.file&&info.files[0].sha512===signed.sha512&&info.files[0].size===signed.size;
}
function createUpdates({updater,fetch,publicKey,repository,version,enabled=true,onChange=()=>{}}){
  let current={status:enabled?'idle':'development',version,latest:null,percent:0,error:null,lastChecked:null},signed=null,busy=false;
  function patch(p){current={...current,...p};onChange();}
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
  updater.on('error',e=>patch({status:'error',error:e.message||'更新暂不可用'}));
  updater.on('download-progress',p=>patch({status:'downloading',percent:Math.round(p.percent)}));
  async function check(){
    if(!enabled||busy||current.status==='downloaded'||current.status==='downloading')return;
    busy=true;signed=null;patch({status:'checking',error:null});
    try{
      const response=await fetch(`https://api.github.com/repos/${repository}/releases/latest`,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/vnd.github+json','User-Agent':'Qihou-desktop'}});
      if(!response.ok)throw Error(response.status===404?'尚无已发布版本':response.status===403?'GitHub 暂时限流，请稍后检查':'无法连接 GitHub 更新服务');
      const release=await response.json();const asset=release.assets?.find(a=>a.name==='update-manifest.json');
      const base=`https://github.com/${repository}/releases/download/`;
      if(!asset?.browser_download_url?.startsWith(base)||asset.size>20000)throw Error('发布版本缺少可信更新清单');
      const mr=await fetch(asset.browser_download_url,{signal:AbortSignal.timeout(15000)});if(!mr.ok)throw Error('更新清单获取失败');
      const manifest=verifyManifest(await mr.json(),publicKey,repository);
      if(release.tag_name!==`v${manifest.version}`)throw Error('更新清单版本与发布标签不一致');
      if(compareVersions(manifest.version,version)<=0){patch({status:'current',lastChecked:Date.now(),latest:manifest.version});return;}
      const result=await updater.checkForUpdates();
      if(!matchesInfo(result?.updateInfo,manifest))throw Error('更新文件与签名清单不一致，已停止下载');
      signed=manifest;patch({status:'available',latest:manifest.version,lastChecked:Date.now(),percent:0});
    }catch(e){patch({status:'error',error:e.message||'更新检查失败'});}
    finally{busy=false;}
  }
  async function download(){
    if(current.status!=='available'||!signed)throw Error('请先检查可用更新');
    busy=true;patch({status:'downloading',error:null,percent:0});
    try{await updater.downloadUpdate();patch({status:'downloaded',percent:100});}
    catch(e){patch({status:'error',error:e.message||'下载失败，可重新检查更新'});}
    finally{busy=false;}
  }
  function install(){if(current.status!=='downloaded'||!signed)throw Error('更新尚未下载完成');updater.quitAndInstall(false,true);}
  return {state:()=>current,check,download,install};
}
module.exports={compareVersions,verifyManifest,matchesInfo,createUpdates};
