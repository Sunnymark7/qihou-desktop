// Publisher-only tools. Private keys live outside the checkout and application.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {DEVICE}=require('../electron/licensing.cjs');
const secretDir=process.env.QIHOU_PUBLISHER_DIR||path.join(process.env.LOCALAPPDATA||os.homedir(),'Qihou-Publisher');
const args=process.argv.slice(2),command=args.shift();
function option(name){const i=args.indexOf('--'+name);return i<0?undefined:args[i+1];}
function key(name){return fs.readFileSync(path.join(secretDir,name+'-private.pem'),'utf8');}
if(command==='init'){
  fs.mkdirSync(secretDir,{recursive:true});
  for(const name of ['license','update']){
    const privatePath=path.join(secretDir,name+'-private.pem'),publicPath=path.resolve('shared',name+'-public.pem');
    if(fs.existsSync(privatePath)){
      const publicKey=crypto.createPublicKey(key(name)).export({type:'spki',format:'pem'});
      if(fs.existsSync(publicPath)&&fs.readFileSync(publicPath,'utf8')!==publicKey)throw Error('公钥与私钥不匹配，未覆盖已有公钥');
      if(!fs.existsSync(publicPath))fs.writeFileSync(publicPath,publicKey);
    }else{
      if(fs.existsSync(publicPath))throw Error('已有公钥但私钥缺失，请恢复原私钥备份，不能自动换钥');
      const pair=crypto.generateKeyPairSync('ed25519');
      fs.writeFileSync(privatePath,pair.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});
      fs.writeFileSync(publicPath,pair.publicKey.export({type:'spki',format:'pem'}));
    }
  }
  console.log('签发与更新密钥已准备，私钥目录：'+secretDir);
}else if(command==='issue'){
  const device=option('device'),plan=option('plan'),out=option('out');
  if(!DEVICE.test(device||'')||!['trial','lifetime'].includes(plan)||!out)throw Error('用法：node scripts/publisher.cjs issue --device QH-设备码 --plan trial|lifetime --out 本机文件.txt');
  const issuedAt=Date.now(),payload={product:'qihou',version:1,id:crypto.randomUUID(),device,plan,issuedAt,expiresAt:plan==='trial'?issuedAt+7*86400000:null};
  const bytes=Buffer.from(JSON.stringify(payload));const code='QH1.'+bytes.toString('base64url')+'.'+crypto.sign(null,bytes,key('license')).toString('base64url');
  fs.writeFileSync(out,code+'\n',{flag:'wx',mode:0o600});console.log('激活码已写入：'+path.resolve(out));
}else if(command==='manifest'){
  const p=require('../package.json'),installer=path.resolve(p.build.directories.output,`Qihou-${p.version}-Setup-x64.exe`);
  const bytes=fs.readFileSync(installer);
  const payload={version:p.version,repository:require('../shared/edition.json').repository,
    file:path.basename(installer),size:bytes.length,sha512:crypto.createHash('sha512').update(bytes).digest('base64')};
  const data=Buffer.from(JSON.stringify(payload)),result={payload:data.toString('base64url'),signature:crypto.sign(null,data,key('update')).toString('base64url')};
  fs.writeFileSync(path.join(p.build.directories.output,'update-manifest.json'),JSON.stringify(result,null,2)+'\n');console.log('发布更新清单已签名');
}else throw Error('命令：init / issue / manifest');
