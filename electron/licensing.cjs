const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const DAY=86400000;
const DEVICE=/^QH-[A-F0-9]{24}$/;
function verifyActivation(code,publicKey,device,now=Date.now()){
  if(typeof code!=='string'||code.length>4096)throw Error('激活码格式不正确');
  const parts=code.trim().split('.');
  if(parts.length!==3||parts[0]!=='QH1'||!parts.slice(1).every(s=>/^[A-Za-z0-9_-]+$/.test(s)))throw Error('激活码格式不正确');
  const bytes=Buffer.from(parts[1],'base64url'),sig=Buffer.from(parts[2],'base64url');
  if(!crypto.verify(null,bytes,publicKey,sig))throw Error('激活码签名无效，请核对完整内容');
  let p;try{p=JSON.parse(bytes);}catch{throw Error('激活码内容无效');}
  if(p.product!=='qihou'||p.version!==1||!['trial','lifetime'].includes(p.plan)||!DEVICE.test(p.device)||typeof p.id!=='string'||p.id.length>100||!Number.isSafeInteger(p.issuedAt)||p.issuedAt>now+300000)throw Error('激活码内容无效');
  if(p.device!==device)throw Error('此激活码属于另一台设备，请提供当前设备码重新签发');
  if(p.plan==='trial'&&(!Number.isSafeInteger(p.expiresAt)||p.expiresAt-p.issuedAt!==7*DAY))throw Error('体验激活码有效期不正确');
  if(p.plan==='lifetime'&&p.expiresAt!==null)throw Error('永久激活码内容无效');
  return {...p,expired:p.plan==='trial'&&now>=p.expiresAt};
}
function createLicenseStore({directory,publicKey,now=Date.now}){
  const file=path.join(directory,'activation.json');
  let saved;
  try{saved=JSON.parse(fs.readFileSync(file,'utf8'));}catch{saved={};}
  if(!DEVICE.test(saved.device||''))saved={device:'QH-'+crypto.randomBytes(12).toString('hex').toUpperCase(),code:null,lastSeen:0};
  function save(){fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(saved));fs.renameSync(file+'.tmp',file);}
  save();
  function state(){
    const clock=now();let license=null,error=null;
    const rollback=clock+5*60000<(saved.lastSeen||0);
    if(saved.code){try{license=verifyActivation(saved.code,publicKey,saved.device,Math.max(clock,saved.lastSeen||0));}catch(e){error=e.message;}}
    const active=!!license&&!license.expired&&(!rollback||license.plan==='lifetime');
    return {device:saved.device,active,plan:active?license.plan:'free',expiresAt:license?.expiresAt||null,
      status:error?'invalid':rollback&&license?.plan==='trial'?'clock-error':license?.expired?'expired':active?'active':'free',
      message:error||(rollback&&license?.plan==='trial'?'系统时间早于上次运行，请恢复正确时间':license?.expired?'体验已结束，免费功能仍可使用':null)};
  }
  function activate(code){const l=verifyActivation(code,publicKey,saved.device,Math.max(now(),saved.lastSeen||0));if(l.expired)throw Error('该体验激活码已过期');saved.code=code.trim();saved.lastSeen=Math.max(now(),saved.lastSeen||0);save();return state();}
  function tick(){saved.lastSeen=Math.max(now(),saved.lastSeen||0);save();return state();}
  return {state,activate,tick};
}
module.exports={verifyActivation,createLicenseStore,DEVICE};
