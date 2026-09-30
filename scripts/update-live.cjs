// Explicit release probe: isolated updater cache, real network, no installation.
const path=require('node:path'),fs=require('node:fs');
if(!process.versions.electron){
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=require('node:child_process').spawn(require('electron'),[__filename],{env,stdio:'inherit',windowsHide:true});child.on('exit',code=>process.exit(code??1));
}else{
  const {app,net}=require('electron');const root=path.resolve(__dirname,'..'),profile=path.join(root,'.test-data',`ota-probe-${Date.now()}`);fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);
  const watchdog=setTimeout(()=>{console.error('OTA probe timed out');app.exit(1);},180000);
  app.whenReady().then(async()=>{
    const version='0.3.9',repository=require('../shared/edition.json').repository,config=require('../package.json');
    const {NsisUpdater}=require('electron-updater'),updater=new NsisUpdater({provider:'github',owner:repository.split('/')[0],repo:repository.split('/')[1]});
    updater.currentVersion=require('semver').parse(version);updater.disableDifferentialDownload=true;
    Object.defineProperties(updater.app,{version:{get:()=>version},isPackaged:{get:()=>true},baseCachePath:{get:()=>profile},appUpdateConfigPath:{get:()=>path.join(root,config.build.directories.output,'win-unpacked/resources/app-update.yml')}});
    const {createUpdates}=require('../electron/updates.cjs');
    const service=createUpdates({updater,fetch:(...args)=>net.fetch(...args),publicKey:fs.readFileSync(path.join(root,'shared/update-public.pem'),'utf8'),repository,version});
    await service.check();if(service.state().status!=='available')throw Error(service.state().error||'Expected newer release');
    await service.download();if(service.state().status!=='downloaded')throw Error(service.state().error||'Download failed');
    const file=updater.downloadedUpdateHelper.file,bytes=fs.readFileSync(file),digest=require('node:crypto').createHash('sha512').update(bytes).digest('base64');
    const report={date:new Date().toISOString(),simulatedVersion:version,release:service.state().latest,status:service.state().status,downloadedBytes:bytes.length,sha512:digest,installed:false,cache:profile};
    fs.writeFileSync(path.join(root,'.test-data','ota-live-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));clearTimeout(watchdog);app.quit();
  }).catch(e=>{console.error(e.message);clearTimeout(watchdog);app.exit(1);});
}
