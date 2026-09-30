const {app,BrowserWindow,screen}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const desktop=require('../electron/windows.cjs');
app.setPath('userData',path.join(__dirname,'../.test-data/drag-regression-profile'));
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
  const report={displays:screen.getAllDisplays().map(d=>({scale:d.scaleFactor,bounds:d.bounds})),cases:[]};
  for(const thickFrame of [true,false])for(const explicitSize of [false,true]){
    const w=new BrowserWindow({show:false,frame:false,transparent:true,resizable:false,thickFrame,width:360,height:392,x:100,y:100,webPreferences:{sandbox:true}});
    await delay(100);
    const before=w.getBounds(),samples=[];
    for(let i=0;i<20;i++){
      if(explicitSize)w.setBounds({x:100+i%5*3,y:100+i%4*3,width:360,height:392});else w.setPosition(100+i%5*3,100+i%4*3);
      await delay(15);const b=w.getBounds();samples.push(b);
      if(b.width>1800||b.height>1800)break;
    }
    report.cases.push({thickFrame,explicitSize,before,after:w.getBounds(),samples});w.destroy();
  }
  const stable=new BrowserWindow({show:false,frame:false,transparent:true,resizable:false,width:360,height:392,x:100,y:100});
  const before=desktop.windowRect(stable);const samples=[];
  for(let i=0;i<500;i++){desktop.moveOnly(stable,before.left+(i%10)*3,before.top+(i%8)*3);if(i%50===0){await delay(10);samples.push(desktop.windowRect(stable));}}
  const after=desktop.windowRect(stable);
  require('node:assert/strict').equal(after.right-after.left,before.right-before.left);
  require('node:assert/strict').equal(after.bottom-after.top,before.bottom-before.top);
  report.nativeMoveOnly={moves:500,before,after,samples};stable.destroy();
  const output=path.join(__dirname,'../.test-data/drag-regression-'+(process.env.QIHOU_REGRESSION_LABEL||'baseline')+'.json');
  fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.quit();
}).catch(e=>{console.error(e);app.exit(1);});

