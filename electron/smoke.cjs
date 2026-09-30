const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function capture(win){let timer;try{return await Promise.race([win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Screenshot timed out')),8000);})]);}finally{clearTimeout(timer);}}
exports.run=async ctx=>{
  const out=path.join(ctx.root,'.test-data');fs.mkdirSync(out,{recursive:true});
  const watchdog=setTimeout(()=>{console.error('Smoke exceeded 150 seconds');ctx.app.exit(1);},150000);
  const report={date:new Date().toISOString(),checks:[],errors:[],weather:null};
  const getExtendedStyle=require('koffi').load('user32.dll').func('intptr_t __stdcall GetWindowLongPtrW(uintptr_t, int)');
  report.taskbarStyles=[];
  function assertSkipsTaskbar(win,stage){
    const style=Number(getExtendedStyle(ctx.desktop.handle(win),-20));
    report.taskbarStyles.push({role:win.qihouRole,stage,extendedStyle:style});
    assert.ok(style & 0x80,`${stage}: WS_EX_TOOLWINDOW must be set`);
    assert.equal(style & 0x40000,0,`${stage}: WS_EX_APPWINDOW must be cleared`);
  }
  const windows=[];
  function monitor(win){if(windows.includes(win))return;windows.push(win);win.webContents.on('console-message',event=>{if(event.level==='error')report.errors.push(event.message);});win.webContents.on('preload-error',(_e,_p,error)=>report.errors.push(error.message));}
  monitor(ctx.widget());
  await delay(2500);
  assert.ok(ctx.tray&&!ctx.tray.isDestroyed());report.checks.push('Native tray created');
  assert.equal(ctx.widget().isVisible(),true);report.checks.push('Widget visible with settings closed');
  assert.equal(ctx.control(),undefined);
  assertSkipsTaskbar(ctx.widget(),'startup');
  const initial=await capture(ctx.widget());fs.writeFileSync(path.join(out,'widget-unconfigured.png'),initial.toPNG());
  const bitmap=initial.toBitmap();let transparent=0;for(let i=3;i<bitmap.length;i+=4)if(bitmap[i]===0)transparent++;
  report.transparentPixels=transparent;assert.ok(transparent>1000);report.checks.push('Widget capture preserves transparent pixels');
  ctx.updateSettings({locked:true});assert.equal(ctx.state().settings.locked,true);
  ctx.updateSettings({locked:false});assert.equal(ctx.state().settings.locked,false);report.checks.push('Lock/unlock state and native calls');
  ctx.updateSettings({visible:false});assert.equal(ctx.widget().isVisible(),false);
  ctx.updateSettings({visible:true});assert.equal(ctx.widget().isVisible(),true);report.checks.push('Widget hide/restore');
  assertSkipsTaskbar(ctx.widget(),'after lock/unlock and hide/show');
  report.checks.push('Widget native window remains excluded from taskbar across lock and visibility changes');
  assert.equal(await ctx.widget().webContents.executeJavaScript('document.querySelectorAll(".widget-tools,button,[data-action]").length'),0);
  report.checks.push('Desktop has no toolbar or settings buttons; controls stay in tray');
  assert.equal(await ctx.widget().webContents.executeJavaScript('typeof window.qihou.drag'),'function');
  const originalRect=ctx.desktop.windowRect(ctx.widget()), actualCursor=ctx.desktop.cursorPoint;
  let testCursor={x:originalRect.left+100,y:originalRect.top+100};
  ctx.desktop.cursorPoint=()=>testCursor;
  try{
    await ctx.widget().webContents.executeJavaScript('window.qihou.drag("start")');
    for(let i=0;i<300;i++){testCursor={x:originalRect.left+100-(i%10)*3,y:originalRect.top+100-(i%8)*3};await ctx.widget().webContents.executeJavaScript('window.qihou.drag("move")');}
    testCursor={x:originalRect.left+64,y:originalRect.top+64};await ctx.widget().webContents.executeJavaScript('window.qihou.drag("end")');
  }finally{ctx.desktop.cursorPoint=actualCursor;}
  await delay(600);
  const movedRect=ctx.desktop.windowRect(ctx.widget());
  assert.equal(movedRect.right-movedRect.left,originalRect.right-originalRect.left);assert.equal(movedRect.bottom-movedRect.top,originalRect.bottom-originalRect.top);
  assert.equal(movedRect.left,originalRect.left-36);assert.equal(movedRect.top,originalRect.top-36);
  assert.deepEqual(ctx.state().settings.position,{x:ctx.widget().getPosition()[0],y:ctx.widget().getPosition()[1]});
  const saved=JSON.parse(fs.readFileSync(path.join(ctx.app.getPath('userData'),'state.json'),'utf8'));
  assert.deepEqual(saved.settings.position,ctx.state().settings.position);ctx.desktop.moveOnly(ctx.widget(),originalRect.left,originalRect.top);
  report.checks.push('300 renderer IPC drag moves with controlled cursor preserve exact physical width/height and persist new position');
  ctx.openSettings();await delay(2000);monitor(ctx.control());
  const control=ctx.control();
  assertSkipsTaskbar(control,'settings opened');
  control.hide();ctx.openSettings();await delay(150);
  assertSkipsTaskbar(control,'existing settings reopened');
  report.checks.push('Opening and restoring settings preserves native taskbar exclusion');
  assert.ok(await control.webContents.executeJavaScript('(()=>{const img=document.querySelector(".brand-app-icon");return img.complete&&img.naturalWidth===256})()'));report.checks.push('Settings brand displays the generated application icon');
  assert.notEqual(await control.webContents.executeJavaScript('getComputedStyle(document.querySelector("canvas")).getPropertyValue("-webkit-app-region")'),'drag');
  control.setIgnoreMouseEvents(true);ctx.widget().setIgnoreMouseEvents(true);
  // Controlled integration tests execute only our own packaged renderer/API.
  const bridgeAvailable=await control.webContents.executeJavaScript('typeof window.qihou?.state === "function"');assert.ok(bridgeAvailable);report.checks.push('Sandboxed preload bridge is available');
  const rendererState=await control.webContents.executeJavaScript('window.qihou.state()');assert.ok(rendererState.desktop);report.checks.push('Trusted renderer IPC state request');
  assert.equal(rendererState.activation.active,false);
  assert.ok(await control.webContents.executeJavaScript('window.qihou.settings({detail:"crafted"}).then(()=>false,()=>true)'));
  assert.ok(await control.webContents.executeJavaScript('window.qihou.favorite({action:"toggle"}).then(()=>false,()=>true)'));
  assert.ok(await control.webContents.executeJavaScript('window.qihou.deskTools({action:"note",title:"Denied",text:"Denied"}).then(()=>false,()=>true)'));
  assert.ok(await control.webContents.executeJavaScript('window.qihou.deskTools({action:"skin",skin:"coast"}).then(()=>false,()=>true)'));
  report.checks.push('Free edition enforces crafted and favorites gates in main process IPC');
  await control.webContents.executeJavaScript('document.querySelector("[data-tab=account]").click()');await delay(200);
  assert.ok(await control.webContents.executeJavaScript('document.querySelector(".plan-options").textContent.includes("¥1")&&document.querySelector(".plan-options").textContent.includes("¥5")'));
  assert.ok(await control.webContents.executeJavaScript('document.querySelector("[data-action=buy]").disabled'));
  fs.writeFileSync(path.join(out,'account-free.png'),(await capture(control)).toPNG());
  control.setSize(860,740);await delay(200);
  assert.ok(await control.webContents.executeJavaScript('document.documentElement.scrollWidth<=innerWidth'));
  fs.writeFileSync(path.join(out,'account-compact.png'),(await capture(control)).toPNG());control.setSize(1180,820);
  report.checks.push('Account displays actual prices and unconfigured purchase entry, with no compact overflow');
  await control.webContents.executeJavaScript('document.querySelector("[data-tab=weather]").click()');
  try{
    const results=await control.webContents.executeJavaScript('window.qihou.search("上海")');
    assert.ok(results.length);report.checks.push('Offline city catalog returns Shanghai without geocoding dependency');report.searchResult=results[0];
    await control.webContents.executeJavaScript('window.qihou.setLocation({name:"上海",latitude:31.2304,longitude:121.4737,country:"中国",timezone:"Asia/Shanghai"})');
    if(ctx.state().weather){report.weather=ctx.state().weather;report.checks.push('Live weather fetched and normalized');}else report.errors.push('Live weather unavailable: '+ctx.state().error);
  }catch(e){report.errors.push('Live network test: '+e.message);}
  await delay(2200);
  for(let i=0;i<24&&ctx.state().environment?.loading;i++)await delay(500);
  const air=ctx.state().environment?.air;
  if(air){assert.ok(air.hours.length>1);report.air={aqi:air.aqi,pm25:air.pm25,standard:air.standard,dataTime:air.time};report.checks.push('Live Open-Meteo CAMS air data and hourly forecast received independently');}
  else report.errors.push('Live air unavailable: '+ctx.state().environment?.error);
  assert.ok(await control.webContents.executeJavaScript('document.querySelectorAll(".trend-plot").length===2'));
  await control.webContents.executeJavaScript('(()=>{const s=document.querySelector("#air-metric");s.value="pm25";s.dispatchEvent(new Event("change"));const r=document.querySelector("#air-cursor");r.value=r.max;r.dispatchEvent(new Event("input"));})()');
  assert.match(await control.webContents.executeJavaScript('document.querySelector("#air-readout").textContent'),/µg\/m³/);
  await control.webContents.executeJavaScript('document.querySelector("[data-period=history]").click()');
  assert.ok(await control.webContents.executeJavaScript('document.querySelector("[data-period=history]").getAttribute("aria-pressed")==="true"'));
  fs.writeFileSync(path.join(out,'charts-history.png'),(await capture(control)).toPNG());
  await control.webContents.executeJavaScript('document.querySelector("[data-period=forecast]").click();(()=>{const s=document.querySelector("#air-metric");s.value="aqi";s.dispatchEvent(new Event("change"));})()');
  report.checks.push('Trend period and pollutant controls update charts; time slider exposes exact accessible values');
  await control.webContents.executeJavaScript('document.querySelector("#place-desktop").click()');await delay(120);assert.equal(ctx.widget().isVisible(),false);assert.ok(!ctx.tray.isDestroyed());
  await control.webContents.executeJavaScript('document.querySelector("#place-desktop").click()');await delay(120);assert.equal(ctx.widget().isVisible(),true);assertSkipsTaskbar(ctx.widget(),'dashboard visibility toggle');
  report.checks.push('Dashboard toggles widget visibility while background tray remains running');
  fs.writeFileSync(path.join(out,'settings-desktop.png'),(await capture(control)).toPNG());
  fs.writeFileSync(path.join(out,'widget-shanghai.png'),(await capture(ctx.widget())).toPNG());
  ctx.updateSettings({model:'default',visible:true});await delay(1000);
  fs.writeFileSync(path.join(out,'widget-cottage.png'),(await capture(ctx.widget())).toPNG());
  for(let i=0;i<8;i++){
    ctx.updateSettings({model:i%2?'default':'auto'});await delay(220);
    const visibleReadout=await ctx.widget().webContents.executeJavaScript('(()=>{const el=document.querySelector(".widget-readout");const r=el.getBoundingClientRect();return !!el.innerText&&r.top>=0&&r.bottom<=innerHeight&&getComputedStyle(el).display!=="none"})()');
    assert.ok(visibleReadout,'Weather readout must stay inside the widget during model swaps');
    const cap=await capture(ctx.widget());const raw=cap.toBitmap(),size=cap.getSize();let opaque=0;
    for(let y=Math.floor(size.height*.80);y<size.height*.94;y++)for(let x=Math.floor(size.width*.25);x<size.width*.75;x++)if(raw[(y*size.width+x)*4+3]>200)opaque++;
    assert.ok(opaque>size.width*size.height*.02,'Readout must be painted, not only present in DOM');
  }
  report.checks.push('Eight model swaps retain painted weather readout and valid bounds');
  await control.webContents.executeJavaScript('document.querySelector("[data-tab=scene]").click()');await delay(600);
  await control.webContents.executeJavaScript('document.querySelector("[data-demo=snow]").click()');await delay(800);
  fs.writeFileSync(path.join(out,'scene-snow.png'),(await capture(control)).toPNG());
  assert.equal(ctx.state().weather?.kind,report.weather?.kind);report.checks.push('Scene demo does not mutate shared weather');
  const nativeLocation=ctx.state().settings.location.id;
  report.models=[];
  for(const l of require('../shared/landmarks.json')){
    ctx.updateSettings({model:'landmark',landmarkId:l.id});await delay(180);
    const stats=await control.webContents.executeJavaScript('window.qihouTest()');assert.equal(stats.model,l.id);assert.ok(stats.triangles>0);assert.equal(ctx.state().settings.location.id,nativeLocation);
    report.models.push(stats);
    const shot=await capture(ctx.widget()), pixels=shot.toBitmap(), dimensions=shot.getSize();let readoutPixels=0;
    for(let y=Math.floor(dimensions.height*.8);y<dimensions.height*.94;y++)for(let x=Math.floor(dimensions.width*.25);x<dimensions.width*.75;x++)if(pixels[(y*dimensions.width+x)*4+3]>200)readoutPixels++;
    assert.ok(readoutPixels>dimensions.width*dimensions.height*.02,`Weather readout must remain painted for ${l.id}`);
    fs.writeFileSync(path.join(out,'landmark-'+l.id+'.png'),shot.toPNG());
  }
  report.checks.push('All 16 landmark models render without changing weather location');
  if(process.env.QIHOU_TEST_SIGNING_KEY&&fs.existsSync(process.env.QIHOU_TEST_SIGNING_KEY)){
    const crypto=require('node:crypto');
    const payload=Buffer.from(JSON.stringify({product:'qihou',version:1,id:crypto.randomUUID(),device:ctx.licensing.state().device,plan:'trial',issuedAt:Date.now(),expiresAt:Date.now()+7*86400000}));
    // A single timestamp makes the signed seven-day duration exact.
    const parsed=JSON.parse(payload);parsed.expiresAt=parsed.issuedAt+7*86400000;const bytes=Buffer.from(JSON.stringify(parsed));
    const code=`QH1.${bytes.toString('base64url')}.${crypto.sign(null,bytes,fs.readFileSync(process.env.QIHOU_TEST_SIGNING_KEY)).toString('base64url')}`;
    await control.webContents.executeJavaScript('document.querySelector("[data-tab=account]").click()');await delay(100);
    await control.webContents.executeJavaScript(`document.querySelector('#activation-code').value=${JSON.stringify(code)};document.querySelector('#activation-form').requestSubmit()`);await delay(250);
    assert.equal(ctx.state().activation.active,true);assert.equal(ctx.state().activation.plan,'trial');
    assert.ok(await control.webContents.executeJavaScript('document.querySelector(".edition-badge").textContent.includes("Plus")'));
    assert.ok(await control.webContents.executeJavaScript('window.qihou.activate("QH1.invalid.invalid").then(()=>false,()=>true)'));assert.equal(ctx.state().activation.active,true);
    fs.writeFileSync(path.join(out,'account-active.png'),(await capture(control)).toPNG());
    report.checks.push('Real publisher-signed trial activates through the rendered form; invalid replacement preserves valid activation');
    await control.webContents.executeJavaScript('document.querySelector("[data-tab=weather]").click()');await delay(100);
    await control.webContents.executeJavaScript('window.qihou.favorite({action:"toggle"})');assert.equal(ctx.state().favorites.length,1);
    await control.webContents.executeJavaScript('document.querySelector("[data-period=week]").click()');await delay(100);
    assert.ok(await control.webContents.executeJavaScript('document.querySelector("[data-period=week]").getAttribute("aria-pressed")==="true"'));
    fs.writeFileSync(path.join(out,'charts-week.png'),(await capture(control)).toPNG());
    await control.webContents.executeJavaScript('document.querySelector("[data-period=forecast]").click();document.querySelector("[data-tab=scene]").click()');
    report.checks.push('Activated edition enables persistent favorites and seven-day recorded trend selector');
    await control.webContents.executeJavaScript('document.querySelector("[data-tab=tools]").click()');await delay(120);
    await control.webContents.executeJavaScript('(()=>{const f=document.querySelector("#note-form");f.elements.title.value="今天的小事";f.elements.text.value="记得散步。\\n<script>纯文本</script>";f.requestSubmit();})()');await delay(150);
    assert.equal(ctx.state().deskTools.notes.length,1);assert.ok(await control.webContents.executeJavaScript('document.querySelector(".desk-note p").textContent.includes("<script>")'));
    await control.webContents.executeJavaScript('window.qihou.deskTools({action:"note",id:document.querySelector("[data-edit-note]").dataset.editNote,title:"今天的小事",text:"记得散步。\\n把今天的一件小事做好。",pinned:true,color:"cream"})');await delay(100);
    await control.webContents.executeJavaScript('(()=>{const f=document.querySelector("#date-form");f.elements.title.value="下一次出发";f.elements.date.value="2026-12-31";f.requestSubmit();})()');await delay(150);
    assert.equal(ctx.state().deskTools.countdowns.length,1);
    fs.writeFileSync(path.join(out,'tools-settings.png'),(await capture(control)).toPNG());
    control.setSize(860,740);await delay(150);assert.ok(await control.webContents.executeJavaScript('document.documentElement.scrollWidth<=innerWidth'));fs.writeFileSync(path.join(out,'tools-compact.png'),(await capture(control)).toPNG());control.setSize(1180,820);
    await control.webContents.executeJavaScript('document.querySelector("[data-desk-toggle]").click()');await delay(1000);
    const board=ctx.toolWindow();monitor(board);assert.equal(board.isVisible(),true);assertSkipsTaskbar(board,'desk tools opened');
    assert.equal(await board.webContents.executeJavaScript('document.querySelectorAll("canvas").length'),0);
    assert.equal(await board.webContents.executeJavaScript('document.querySelectorAll(".desk-note,.countdown-item").length'),2);
    const boardRect=ctx.desktop.windowRect(board),cursorFn=ctx.desktop.cursorPoint;let boardCursor={x:boardRect.left+40,y:boardRect.top+25};ctx.desktop.cursorPoint=()=>boardCursor;
    try{await board.webContents.executeJavaScript('window.qihou.deskDrag("start")');for(let i=0;i<60;i++){boardCursor={x:boardRect.left+40+i,y:boardRect.top+25+i};await board.webContents.executeJavaScript('window.qihou.deskDrag("move")');}await board.webContents.executeJavaScript('window.qihou.deskDrag("end")');}finally{ctx.desktop.cursorPoint=cursorFn;}
    const boardMoved=ctx.desktop.windowRect(board);assert.equal(boardMoved.right-boardMoved.left,boardRect.right-boardRect.left);assert.equal(boardMoved.bottom-boardMoved.top,boardRect.bottom-boardRect.top);assert.ok(ctx.state().deskTools.position);
    fs.writeFileSync(path.join(out,'tools-desktop.png'),(await capture(board)).toPNG());
    for(const skin of require('../shared/skins.json')){await control.webContents.executeJavaScript(`window.qihou.deskTools({action:'skin',skin:'${skin.id}'})`);await delay(160);assert.equal(await ctx.widget().webContents.executeJavaScript('document.body.dataset.skin'),skin.id);assert.equal(await board.webContents.executeJavaScript('document.body.dataset.skin'),skin.id);fs.writeFileSync(path.join(out,'skin-'+skin.id+'.png'),(await capture(ctx.widget())).toPNG());}
    await control.webContents.executeJavaScript('window.qihou.deskTools({action:"skin",skin:"garden"});window.qihou.deskTools({action:"visibility",visible:false})');await delay(100);assert.equal(board.isVisible(),false);
    report.checks.push('Real note and countdown forms save safely; independent taskbar-free board renders both without WebGL and preserves size during 60 drag moves');
    report.checks.push('All four skins update scene and desktop cards; tool UI fits compact width and board can hide independently');
    await control.webContents.executeJavaScript('document.querySelector("[data-tab=scene]").click()');
    await control.webContents.executeJavaScript('window.qihou.settings({detail:"crafted"})');report.craftedModels=[];
    for(const l of require('../shared/landmarks.json')){
      ctx.updateSettings({model:'landmark',landmarkId:l.id});await delay(220);
      const stats=await control.webContents.executeJavaScript('window.qihouTest()');assert.equal(stats.model,l.id);assert.equal(stats.detail,'crafted');assert.ok(stats.triangles>report.models.find(m=>m.model===l.id).triangles);
      report.craftedModels.push(stats);
      const shot=await capture(ctx.widget()),pixels=shot.toBitmap(),size=shot.getSize();let painted=0;
      for(let y=Math.floor(size.height*.8);y<size.height*.94;y++)for(let x=Math.floor(size.width*.25);x<size.width*.75;x++)if(pixels[(y*size.width+x)*4+3]>200)painted++;
      assert.ok(painted>size.width*size.height*.02,`Crafted ${l.id} must retain painted weather readout`);
      fs.writeFileSync(path.join(out,'crafted-'+l.id+'.png'),shot.toPNG());
    }
    report.checks.push('All 16 crafted landmarks render with additional geometry and preserve the chosen weather location');
    fs.writeFileSync(path.join(out,'scene-crafted.png'),(await capture(control)).toPNG());ctx.updateSettings({detail:'classic'});
  }else report.skipped=['Publisher-signed renderer activation requires owner local private key; unit tests use ephemeral test keys'];
  ctx.updateSettings({model:'landmark',landmarkId:'qingdao'});await delay(200);
  await control.webContents.executeJavaScript('document.querySelector("[data-demo=clear]").click()');await delay(400);
  fs.writeFileSync(path.join(out,'may-wind-detail.png'),(await capture(control)).toPNG());
  report.effects=[];
  const demoSnapshot=JSON.stringify(ctx.state().weather);
  for(const [kind,preset] of Object.entries(require('../shared/weather-presets.json')).filter(([k])=>k!=='unknown')){
    await control.webContents.executeJavaScript(`document.querySelector('[data-demo="${kind}"]').click()`);await delay(240);
    const stats=await control.webContents.executeJavaScript('window.qihouTest()');assert.equal(stats.kind,kind);assert.equal(stats.layers.rain,preset.rain>0);assert.equal(stats.layers.hail,preset.hail>0);assert.equal(stats.layers.lightning,preset.thunder);report.effects.push(stats);
    fs.writeFileSync(path.join(out,'effect-'+kind+'.png'),(await capture(control)).toPNG());
  }
  assert.equal(JSON.stringify(ctx.state().weather),demoSnapshot);report.checks.push('All 15 weather presets render correct independent layers without altering actual weather');
  for(const speed of [0,3,8,15]){
    await control.webContents.executeJavaScript(`(()=>{const el=document.querySelector('#demo-wind');el.value='${speed}';el.dispatchEvent(new Event('change'));})()`);await delay(300);
    const stats=await control.webContents.executeJavaScript('window.qihouTest()');assert.equal(stats.wind,speed);assert.equal(stats.layers.wind,false);assert.equal(stats.layers.windStrength,Math.min(1,speed/12));
  }
  report.checks.push('Wind preview changes windsock and vegetation strength for 0, 3, 8 and 15 m/s; no floating airflow lines');
  const cloudBefore=await control.webContents.executeJavaScript('window.qihouTest().clouds');await delay(1000);
  const cloudAfter=await control.webContents.executeJavaScript('window.qihouTest().clouds');
  assert.notDeepEqual(cloudBefore,cloudAfter,'Clouds must travel over time');
  for(const c of cloudAfter){const [x,,z]=c.position;assert.ok((x*8+z*10)/Math.hypot(8,10)<-3.7,'Clouds must stay behind the island');}
  report.checks.push('Clouds drift continuously in a background corridor behind all landmarks');
  fs.writeFileSync(path.join(out,'effect-wind.png'),(await capture(control)).toPNG());
  ctx.updateSettings({reducedMotion:true});await delay(100);
  const pausedFrames=await control.webContents.executeJavaScript('window.qihouTest().frames');await delay(400);assert.equal(await control.webContents.executeJavaScript('window.qihouTest().frames'),pausedFrames);
  report.checks.push('Reduced-motion mode stops continuous rendering');ctx.updateSettings({reducedMotion:false});
  await control.webContents.executeJavaScript('document.querySelector("[data-tab=sources]").click()');await delay(200);
  fs.writeFileSync(path.join(out,'settings-sources.png'),(await capture(control)).toPNG());
  assert.ok(!JSON.stringify(await control.webContents.executeJavaScript('window.qihou.state()')).includes('credentials.bin'));report.checks.push('Source UI exposes credential presence only');
  // Real independent secondary request with no API key, separate from fixture fault injection.
  const {createWeatherService}=require('./providers.cjs'), {net}=require('electron');
  try{const service=createWeatherService({fetch:(...args)=>net.fetch(...args)});const secondary=await service.get(ctx.state().settings.location,'metno');report.secondary={provider:secondary.providerId,dataTime:secondary.dataTime,temperature:secondary.temperature,note:secondary.sourceNote};if(secondary.providerId==='metno')report.checks.push('Live MET Norway secondary source returns normalized weather');else report.errors.push('MET Norway live test fell back: '+secondary.sourceNote);}catch(e){report.errors.push('Secondary network: '+e.message);}
  await control.webContents.executeJavaScript('document.querySelector("[data-tab=display]").click()');await delay(400);
  fs.writeFileSync(path.join(out,'settings-display.png'),(await capture(control)).toPNG());
  await control.webContents.executeJavaScript('document.querySelector("[data-tab=weather]").click()');
  control.setSize(860,740);await delay(500);
  assert.ok(await control.webContents.executeJavaScript('document.documentElement.scrollWidth<=innerWidth'));
  fs.writeFileSync(path.join(out,'settings-compact.png'),(await capture(control)).toPNG());
  report.checks.push('Compact 860px desktop window has no horizontal overflow');
  const dashboard=await control.webContents.executeJavaScript('(()=>{const plots=[...document.querySelectorAll(".trend-plot")];const hours=[...document.querySelectorAll(".hour")];return {plotBottoms:plots.map(p=>p.getBoundingClientRect().bottom),height:innerHeight,hours:hours.length,visibleHours:hours.filter(h=>getComputedStyle(h).display!=="none").length,scrollable:document.querySelector(".hourly").scrollWidth>document.querySelector(".hourly").clientWidth};})()');
  assert.equal(dashboard.hours,dashboard.visibleHours);assert.ok(dashboard.scrollable);assert.ok(dashboard.plotBottoms.every(bottom=>bottom<=dashboard.height));
  report.dashboard=dashboard;report.checks.push('Both curves fit initial compact viewport; all hourly items retained in scrollable forecast');
  const actualState=ctx.state(),fixture=structuredClone(actualState),base=Math.floor(Date.now()/3600000)*3600000;
  fixture.environment.history={weather:[],air:[]};fixture.environment.air.hours=[0,1,2,3].map((i)=>({time:base+i*3600000,aqi:i===1?null:[0,0,400,450][i],pm25:null,pm10:null}));
  fixture.weather.hours=[0,1,2,3].map(i=>({time:base+i*3600000,temperature:[-20,0,30,45][i],precipitation:null,code:0}));
  control.webContents.send('qihou:changed',fixture);await delay(100);
  assert.ok(await control.webContents.executeJavaScript('document.querySelector("[data-chart=air] .chart-line").getAttribute("d").split("M").length===3'));
  assert.ok(await control.webContents.executeJavaScript('!document.querySelector("[data-chart=temperature] .chart-line").getAttribute("d").includes("NaN")'));
  await control.webContents.executeJavaScript('document.querySelector("[data-period=history]").click()');
  assert.equal(await control.webContents.executeJavaScript('document.querySelectorAll(".chart-empty").length'),2);
  fs.writeFileSync(path.join(out,'charts-empty-fixture.png'),(await capture(control)).toPNG());
  control.webContents.send('qihou:changed',actualState);await delay(100);await control.webContents.executeJavaScript('document.querySelector("[data-period=forecast]").click()');
  report.checks.push('Isolated chart fixtures verify missing-value gaps, wide negative/positive range and honest empty history');
  for(const tab of ['scene','sources','display']){await control.webContents.executeJavaScript(`document.querySelector('[data-tab=${tab}]').click()`);await delay(150);assert.ok(await control.webContents.executeJavaScript('document.documentElement.scrollWidth<=innerWidth'));}
  report.checks.push('Compact scene, source and display tabs have no horizontal overflow');
  ctx.updateSettings({quality:'economy',fps:15});await delay(1000);
  report.economy=await control.webContents.executeJavaScript('window.qihouTest()');report.processMetrics=ctx.app.getAppMetrics().map(p=>({type:p.type,cpu:p.cpu.percentCPUUsage,workingSetKiB:p.memory.workingSetSize}));
  try{
    await ctx.setMode('wallpaper');await delay(1200);assert.equal(ctx.state().settings.mode,'wallpaper');assert.equal(ctx.widget().isVisible(),false);report.checks.push('Native wallpaper layer attachment and widget hide');
    for(const win of require('electron').BrowserWindow.getAllWindows())assertSkipsTaskbar(win,'wallpaper mode');
    report.checks.push('All native windows excluded from taskbar in wallpaper mode');
    await ctx.setMode('widget');assert.equal(ctx.state().settings.mode,'widget');assert.equal(ctx.widget().isVisible(),true);report.checks.push('Wallpaper exit restores widget');
    ctx.updateSettings({visible:false});await ctx.setMode('widget');assert.equal(ctx.widget().isVisible(),false);
    await ctx.setMode('wallpaper');assert.equal(ctx.state().settings.visible,false);
    await ctx.setMode('widget');assert.equal(ctx.widget().isVisible(),false);
    report.checks.push('Mode switches preserve explicitly hidden display');ctx.updateSettings({visible:true});
  }catch(e){report.errors.push('Wallpaper: '+e.message);await ctx.setMode('widget');}
  control.close();await delay(300);assert.ok(!ctx.control());assert.ok(ctx.tray&&!ctx.tray.isDestroyed());assert.ok(ctx.widget().isVisible());report.checks.push('Closing settings keeps tray and widget running');
  ctx.openSettings();await delay(1500);assertSkipsTaskbar(ctx.control(),'settings recreated after close');
  ctx.control().close();await delay(150);
  report.checks.push('Recreating settings after close preserves native taskbar exclusion');
  report.settings=ctx.state().settings;
  fs.writeFileSync(path.join(out,'smoke-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  clearTimeout(watchdog);
  if(report.errors.length)ctx.app.exit(1);else ctx.app.quit();
};
