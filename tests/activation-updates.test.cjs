const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const {verifyActivation,createLicenseStore}=require('../electron/licensing.cjs');
const {verifyManifest,compareVersions,matchesInfo,createUpdates}=require('../electron/updates.cjs');
const {historyCsv,insights,createFavorites}=require('../electron/tools.cjs');
const now=Date.now(),device='QH-0123456789ABCDEF01234567';
const keys=crypto.generateKeyPairSync('ed25519');
function token(plan='trial',changes={}){const payload={version:1,product:'qihou',device,plan,id:'test',issuedAt:now,expiresAt:plan==='trial'?now+7*86400000:null,...changes},bytes=Buffer.from(JSON.stringify(payload));return 'QH1.'+bytes.toString('base64url')+'.'+crypto.sign(null,bytes,keys.privateKey).toString('base64url');}
function envelope(payload){const b=Buffer.from(JSON.stringify(payload));return {payload:b.toString('base64url'),signature:crypto.sign(null,b,keys.privateKey).toString('base64url')};}
const repository='Sunnymark7/qihou-desktop';
const payload={repository,version:'0.4.1',file:'Qihou-0.4.1-Setup-x64.exe',size:1234,sha512:crypto.createHash('sha512').update('installer').digest('base64')};
test('activation rejects tampering, other devices, expired or malformed plans and accepts lifetime',()=>{
  assert.equal(verifyActivation(token(),keys.publicKey,device,now).expired,false);
  assert.equal(verifyActivation(token(),keys.publicKey,device,now+7*86400000).expired,true);
  assert.equal(verifyActivation(token('lifetime'),keys.publicKey,device,now+100*86400000).expired,false);
  assert.throws(()=>verifyActivation(token(),keys.publicKey,'QH-111111111111111111111111',now));
  const parts=token().split('.');parts[1]=Buffer.from('{"plan":"lifetime"}').toString('base64url');assert.throws(()=>verifyActivation(parts.join('.'),keys.publicKey,device,now));
  assert.throws(()=>verifyActivation(token('trial',{expiresAt:now+8*86400000}),keys.publicKey,device,now));
  assert.throws(()=>verifyActivation(token('admin'),keys.publicKey,device,now));
});
test('license persists across restart and detects clock rollback; invalid activation cannot replace valid one',()=>{
  const directory=path.resolve('.test-data','license-unit-'+process.pid);fs.mkdirSync(directory,{recursive:true});let time=now;
  try{
    const store=createLicenseStore({directory,publicKey:keys.publicKey,now:()=>time});const d=store.state().device;
    store.activate(token('trial',{device:d}));time+=3600000;store.tick();time=now;
    assert.equal(store.state().status,'clock-error');assert.equal(store.state().active,false);
    time=now+3600000;assert.throws(()=>store.activate('bad'));assert.equal(store.state().active,true);
    const restored=createLicenseStore({directory,publicKey:keys.publicKey,now:()=>time});assert.equal(restored.state().device,d);assert.equal(restored.state().active,true);
  }finally{for(const file of fs.readdirSync(directory))fs.unlinkSync(path.join(directory,file));fs.rmdirSync(directory);}
});
test('signed updates bind repository, version, safe filename, size and digest; hash-metadata mismatch is refused',()=>{
  assert.equal(verifyManifest(envelope(payload),keys.publicKey,repository).version,'0.4.1');
  const signed=envelope(payload);signed.payload=envelope({...payload,size:1}).payload;assert.throws(()=>verifyManifest(signed,keys.publicKey,repository));
  assert.throws(()=>verifyManifest(envelope({...payload,file:'../evil.exe'}),keys.publicKey,repository));
  assert.throws(()=>verifyManifest(envelope(payload),keys.publicKey,'Other/repo'));
  assert.ok(matchesInfo({version:'0.4.1',files:[{url:payload.file,sha512:payload.sha512,size:payload.size}]},payload));
  assert.equal(matchesInfo({version:'0.4.1',files:[{url:payload.file,sha512:'bad',size:payload.size}]},payload),false);
  assert.equal(compareVersions('0.10.0','0.9.9'),1);assert.throws(()=>compareVersions('v1','0.4.0'));
});
test('OTA checks, verifies, downloads only on request and installs only after verified download',async()=>{
  const updater=new EventEmitter();let checks=0,downloads=0,installs=0;
  updater.checkForUpdates=async()=>{checks++;return {updateInfo:{version:payload.version,files:[{url:payload.file,sha512:payload.sha512,size:payload.size}]}};};
  updater.downloadUpdate=async()=>{downloads++;updater.emit('download-progress',{percent:50});};updater.quitAndInstall=()=>installs++;
  const fetch=async url=>new Response(JSON.stringify(url.includes('api.github')?{tag_name:'v'+payload.version,assets:[{name:'update-manifest.json',size:100,browser_download_url:`https://github.com/${repository}/releases/download/v${payload.version}/update-manifest.json`}]}:envelope(payload)));
  const updates=createUpdates({updater,fetch,publicKey:keys.publicKey,repository,version:'0.4.0'});
  await updates.check();assert.equal(updates.state().status,'available');assert.equal(checks,1);assert.equal(downloads,0);assert.equal(updater.autoInstallOnAppQuit,false);assert.throws(()=>updates.install());
  await updates.download();assert.equal(updates.state().status,'downloaded');updates.install();assert.equal(installs,1);assert.equal(downloads,1);
});
test('OTA refuses mismatched metadata and missing signatures without permitting download',async()=>{
  for(const badManifest of [false,true]){
    const updater=new EventEmitter();let downloads=0;updater.checkForUpdates=async()=>({updateInfo:{version:payload.version,files:[{url:payload.file,sha512:'changed',size:payload.size}]}});updater.downloadUpdate=async()=>downloads++;
    const fetch=async url=>new Response(JSON.stringify(url.includes('api.github')?{tag_name:'v'+payload.version,assets:[{name:'update-manifest.json',size:100,browser_download_url:`https://github.com/${repository}/releases/download/v${payload.version}/update-manifest.json`}]}:badManifest?{}:envelope(payload)));
    const updates=createUpdates({updater,fetch,publicKey:keys.publicKey,repository,version:'0.4.0'});await updates.check();assert.equal(updates.state().status,'error');await assert.rejects(updates.download());assert.equal(downloads,0);
  }
});
test('CSV preserves missing values and prevents formula injection; tips do not invent precipitation',()=>{
  const csv=historyCsv({history:{weather:[{time:now,temperature:-5,humidity:null,wind:0,source:'=HYPERLINK("evil")'}],air:[]}},{name:'@City'});
  assert.ok(csv.includes("'@City"));assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('"-5"'));assert.ok(csv.includes('""'));
  assert.equal(insights({temperature:22,wind:null,hours:[],effects:{rain:0}},null)[0].id,'calm');
});
test('favorite locations are validated, deduplicated, persisted, and bounded',()=>{
  const file=path.resolve('.test-data','favorites-unit-'+process.pid+'.json');
  try{const f=createFavorites(file);for(let i=0;i<8;i++)f.toggle({name:'City '+i,latitude:20+i,longitude:120});assert.equal(f.list().length,8);assert.throws(()=>f.toggle({name:'Extra',latitude:40,longitude:120}));assert.throws(()=>f.toggle({name:'Bad',latitude:200,longitude:1}));const p=f.list()[0];f.toggle(p);assert.equal(createFavorites(file).list().length,7);}finally{if(fs.existsSync(file))fs.unlinkSync(file);}
});
