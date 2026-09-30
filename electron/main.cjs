const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, net, powerMonitor, globalShortcut, Notification, shell, safeStorage, dialog, clipboard } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { validateLocation, landmarkFor, selectedModel, normalizeWeather, weatherUrl, sanitizeSettings, clampBounds } = require('./weather.cjs');
const desktop = require('./windows.cjs');
const { createEnvironment } = require('./environment.cjs');
const {createLicenseStore}=require('./licensing.cjs');
const {createUpdates}=require('./updates.cjs');
const {createFavorites,insights,historyCsv}=require('./tools.cjs');
const {createDeskTools}=require('./desk-tools.cjs');
const edition=require('../shared/edition.json');
const landmarks = require('../shared/landmarks.json');
const {localSearch} = require('./locations.cjs');
const { SOURCES, createWeatherService, validateCredentials } = require('./providers.cjs');

const root = path.join(__dirname, '..');
const smoke = process.env.QIHOU_SMOKE === '1';
const testRoot = smoke && process.env.QIHOU_TEST_DIR ? path.resolve(process.env.QIHOU_TEST_DIR) : root;
if (smoke) app.setPath('userData', path.join(testRoot, '.test-data', `profile-${Date.now()}-${process.pid}`));
app.setName('Qihou');
app.setAppUserModelId('local.qihou.weather');
const defaults = { location: null, model: 'auto', landmarkId: 'beijing', weatherSource: 'auto', quality: 'balanced', detail:'classic', weatherNotifications:false, size: 360, fps: 30, visible: true, locked: false, alwaysOnTop: false, paused: false, reducedMotion: false, pauseOnBattery: true, pauseOnFullscreen: true, showDetails: true, mode: 'widget', position: null };
let credentials = {}, weatherService, environment, licensing, updates, favorites, deskTools, toolWindow, toolDrag, updateTimer, licenseTimer;
function loadCredentials() {
  try { credentials = validateCredentials(JSON.parse(safeStorage.decryptString(fs.readFileSync(path.join(app.getPath('userData'),'credentials.bin'))))); }
  catch(e) { if(e.code !== 'ENOENT') startupError = '天气源密钥未能解密，请重新配置；原文件已保留'; }
}
async function saveCredentials(patch) {
  if(!safeStorage.isEncryptionAvailable()) throw Error('系统加密暂不可用，未保存密钥');
  const next = validateCredentials(patch,credentials);
  const file = path.join(app.getPath('userData'),'credentials.bin');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.tmp',safeStorage.encryptString(JSON.stringify(next)));fs.renameSync(file+'.tmp',file);
  credentials = next; weatherService.reset();
  controller?.abort();++requestVersion;loading=false; await refresh(); return state();
}
let settings = { ...defaults }, weather = null, error = null, loading = false, tray, widget, control, wallpaper, wallpaperRecord;
let exiting = false, lockedScreen = false, suspended = false, onBattery = false, fullscreen = false, requestVersion = 0, controller, refreshTimer, pollTimer, saveTimer;
let lastAttempt = 0, lastSearch = 0, searchCache = new Map(), startupError = null, retryDelay = 60_000, modeQueue = Promise.resolve();
let widgetDrag = null;
function dragWidget(phase) {
  if (!widget || widget.isDestroyed() || settings.locked || settings.mode !== 'widget') { widgetDrag = null; return; }
  if (phase === 'start') widgetDrag = { cursor: desktop.cursorPoint(), rect: desktop.windowRect(widget) };
  if ((phase === 'move' || phase === 'end') && widgetDrag) {
    const cursor = desktop.cursorPoint();
    desktop.moveOnly(widget,widgetDrag.rect.left + cursor.x - widgetDrag.cursor.x,widgetDrag.rect.top + cursor.y - widgetDrag.cursor.y);
  }
  if (phase === 'end') { widgetDrag = null; persist(); }
}
const stateFile = () => path.join(app.getPath('userData'), 'state.json');
function persist() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    const file = stateFile();
    fs.writeFileSync(file + '.tmp', JSON.stringify({ version: 1, settings, weather }));
    fs.renameSync(file + '.tmp', file);
  } catch { error = '设置暂时无法保存，请检查磁盘空间和目录权限'; }
}
function restore() {
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    settings = { ...defaults, ...sanitizeSettings(saved.settings) };
    if (saved.settings?.location) settings.location = validateLocation(saved.settings.location);
    // Existing configured installations do not need to repeat first-run setup.
    if (saved.settings?.onboardingComplete === undefined && settings.location) settings.onboardingComplete = true;
    if (saved.settings?.position && Number.isFinite(saved.settings.position.x) && Number.isFinite(saved.settings.position.y)) settings.position = saved.settings.position;
    if (saved.settings?.mode === 'wallpaper') settings.mode = 'wallpaper';
    if (saved.weather?.locationId === settings.location?.id && Number.isFinite(saved.weather?.fetchedAt) && Number.isFinite(saved.weather?.temperature)) weather = saved.weather;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      const backup = `state.recovery-${Date.now()}.json`;
      try { fs.copyFileSync(stateFile(), path.join(app.getPath('userData'), backup)); startupError = `未能读取上次设置，已恢复默认值；原设置备份为 ${backup}`; }
      catch { startupError = '未能读取上次设置，请检查配置目录权限'; }
    }
  }
}
function state() {
  return { testMode:smoke, version:app.getVersion(), edition, deskTools:deskTools?.state(), activation:licensing?.state(), updates:updates?.state(), favorites:favorites?.list()||[], insights:insights(weather,environment?.state().air), sceneDetail:licensing?.state().active&&settings.detail==='crafted'?'crafted':'classic', environment:environment?.state(licensing?.state().active?7:1), settings, weather, error: error || startupError, loading, sources: weatherService?.statuses() || [], credentialStatus: { openweather:!!credentials.openweather, qweather:!!credentials.qweather, qweatherHost:credentials.qweatherHost || '' }, availableLandmark: landmarkFor(settings.location), model: selectedModel(settings), platform: process.platform, desktop: true, autoStart: app.isPackaged && app.getLoginItemSettings().openAtLogin, packaged: app.isPackaged, pauseReason: lockedScreen ? '屏幕已锁定' : suspended ? '系统休眠' : settings.paused ? '已暂停动画' : onBattery && settings.pauseOnBattery ? '电池节能' : fullscreen && settings.pauseOnFullscreen ? '全屏应用' : null };
}
function broadcast() {
  syncToolWindow();
  for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send('qihou:changed', state());
  rebuildMenu();
}
function notify(message) {
  if (Notification.isSupported()) new Notification({ title: '栖候', body: message, icon: path.join(root, 'assets/icon.png'), silent: true }).show();
}
function createWindow(role, options) {
  const win = new BrowserWindow({ show: false, skipTaskbar: true, icon: path.join(root, 'assets/icon.png'), backgroundColor: role === 'settings' ? '#f5f6f9' : '#00000000', ...options, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  win.qihouRole = role;
  desktop.hideFromTaskbar(win);
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.on('render-process-gone', () => { error = '显示进程已停止，请从托盘重新打开窗口'; broadcast(); });
  win.webContents.on('did-fail-load', (_e, code) => { if (code !== -3) { error = '界面加载失败，请重新启动栖候'; rebuildMenu(); } });
  win.loadFile(path.join(root, 'dist/index.html'), { query: { view: role } });
  return win;
}
function widgetBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  return clampBounds({ x: settings.position?.x ?? area.x + area.width - settings.size - 28, y: settings.position?.y ?? area.y + area.height - settings.size - 52, width: settings.size, height: settings.size + 32 }, screen.getAllDisplays().map(d => d.workArea));
}
function createWidget() {
  widget = createWindow('widget', { ...widgetBounds(), frame: false, transparent: true, hasShadow: false, resizable: false, skipTaskbar: true, alwaysOnTop: settings.alwaysOnTop, focusable: !settings.locked });
  widget.setIgnoreMouseEvents(settings.locked, { forward: true });
  widget.once('ready-to-show', () => { if (settings.visible && settings.mode === 'widget') widget.showInactive(); });
  widget.on('close', event => { if (!exiting) { event.preventDefault(); updateSettings({ visible: false }); } });
  widget.on('move', () => { settings.position = widget.getPosition().reduce((p, v, i) => ({ ...p, [i ? 'y' : 'x']: v }), {}); clearTimeout(saveTimer); saveTimer = setTimeout(persist, 400); });
}
function openSettings() {
  if(!smoke&&updates&&Date.now()-(updates.state().lastChecked||0)>5*60000)void updates.check();
  if (!smoke && settings.location && Date.now()-lastAttempt > 5*60_000) void refresh();
  if (control && !control.isDestroyed()) { control.show(); control.focus(); return; }
  control = createWindow('settings', { width: 1120, height: 780, minWidth: 860, minHeight: 650, title: '栖候 · 桌面天气', autoHideMenuBar: true });
  control.once('ready-to-show', () => { control.show(); control.focus(); });
  control.on('closed', () => { control = null; });
}
function syncToolWindow(){
  if(!deskTools||!licensing)return;
  if(!deskTools.state().visible||!licensing.state().active){if(toolWindow&&!toolWindow.isDestroyed())toolWindow.hide();return;}
  if(!toolWindow||toolWindow.isDestroyed()){
    const saved=deskTools.state().position,area=screen.getPrimaryDisplay().workArea;
    const bounds=clampBounds({x:saved?.x??area.x+40,y:saved?.y??area.y+80,width:320,height:480},screen.getAllDisplays().map(d=>d.workArea));
    toolWindow=createWindow('tools',{...bounds,frame:false,transparent:true,hasShadow:false,resizable:false,alwaysOnTop:false});
    toolWindow.once('ready-to-show',()=>{if(deskTools.state().visible&&licensing.state().active)toolWindow.showInactive();});
    toolWindow.on('close',e=>{if(!exiting){e.preventDefault();deskTools.command({action:'visibility',visible:false});broadcast();}});
    toolWindow.on('closed',()=>{toolWindow=null;});
  }else toolWindow.showInactive();
}
function rebuildMenu() {
  if (!tray || tray.isDestroyed()) return;
  const title = settings.location ? `${settings.location.name} · ${weather ? Math.round(weather.temperature) + '° ' + weather.label : '等待天气'}` : '选择天气地点';
  tray.setToolTip(`栖候 · ${title}${error ? ' · 数据待更新' : ''}`.slice(0, 120));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: title, enabled: false }, { type: 'separator' },
    { label: '打开天气与设置…', click: openSettings },
    { label: '桌面便利贴与倒数日', type:'checkbox', checked:!!deskTools?.state().visible&&!!licensing?.state().active, enabled:!!licensing?.state().active, click:()=>{deskTools.command({action:'visibility',visible:!deskTools.state().visible});broadcast();} },
    { label: '显示桌面天气', type: 'checkbox', checked: settings.visible, click: () => updateSettings({ visible: !settings.visible }) },
    { label: '锁定并穿透鼠标', type: 'checkbox', checked: settings.locked, enabled: settings.mode === 'widget', click: () => updateSettings({ locked: !settings.locked }) },
    { label: '编辑摆件 / 恢复位置', click: resetWidget },
    { label: '场景', submenu: [ { label: '默认小屋', type: 'radio', checked: settings.model === 'default', click: () => updateSettings({ model: 'default' }) }, { label: '自动选择当地地标', type: 'radio', checked: settings.model !== 'default', click: () => updateSettings({ model: 'auto' }) } ] },
    { label: '显示模式', submenu: [ { label: '透明摆件', type: 'radio', checked: settings.mode === 'widget', click: () => setMode('widget').catch(report) }, { label: '动态壁纸（实验性）', type: 'radio', checked: settings.mode === 'wallpaper', click: () => setMode('wallpaper').catch(report) } ] },
    { label: '暂停动画', type: 'checkbox', checked: settings.paused, click: () => updateSettings({ paused: !settings.paused }) },
    { label: loading ? '正在更新…' : '立即刷新天气', enabled: !!settings.location && !loading, click: () => refresh(true) },
    { label: '开机启动', type: 'checkbox', checked: app.isPackaged && app.getLoginItemSettings().openAtLogin, enabled: app.isPackaged, click: item => { app.setLoginItemSettings({ openAtLogin: item.checked, path: app.getPath('exe') }); broadcast(); } },
    { type: 'separator' }, { label: '退出栖候', click: () => app.quit() },
  ]));
}
function report(e) { error = e.message || '操作失败，请重试'; broadcast(); notify(error); }
function requirePlus(){if(!licensing?.state().active)throw Error('此功能需要体验或永久激活，免费天气功能仍可使用');}
function updateSettings(patch) {
  if(patch?.detail==='crafted')requirePlus();
  const before = { ...settings };
  Object.assign(settings, sanitizeSettings(patch));
  if (widget && !widget.isDestroyed()) {
    if (before.alwaysOnTop !== settings.alwaysOnTop) widget.setAlwaysOnTop(settings.alwaysOnTop);
    if (before.locked !== settings.locked) { widget.setFocusable(!settings.locked); desktop.hideFromTaskbar(widget); widget.setIgnoreMouseEvents(settings.locked, { forward: true }); }
    if (before.size !== settings.size) widget.setBounds(widgetBounds());
    if (settings.visible && settings.mode === 'widget') { if (!widget.isVisible()) widget.showInactive(); } else if (widget.isVisible()) widget.hide();
  }
  if (wallpaper && !wallpaper.isDestroyed()) { if (settings.visible) { if (!wallpaper.isVisible()) wallpaper.showInactive(); } else if (wallpaper.isVisible()) wallpaper.hide(); }
  if(before.weatherSource !== settings.weatherSource) { controller?.abort();++requestVersion;loading=false;refresh(); }
  persist(); broadcast(); return state();
}
async function resetWidget() {
  if (settings.mode === 'wallpaper') await setMode('widget');
  settings.position = null;
  updateSettings({ locked: false, visible: true });
  widget.setBounds(widgetBounds());
}
function setMode(mode) {
  const task = modeQueue.then(() => switchMode(mode));
  modeQueue = task.catch(() => {});
  return task;
}
async function switchMode(mode) {
  if (mode === 'widget') {
    wallpaperRecord = null;
    if (wallpaper && !wallpaper.isDestroyed()) wallpaper.destroy();
    wallpaper = null;
    settings.mode = 'widget'; updateSettings({}); return;
  }
  if (wallpaper && !wallpaper.isDestroyed()) return;
  const display = screen.getDisplayMatching(widget.getBounds());
  const win = createWindow('wallpaper', { ...display.bounds, frame: false, transparent: false, backgroundColor: '#c6d9dd', skipTaskbar: true, focusable: false, resizable: false });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('壁纸窗口加载超时')), 15_000);
      win.once('ready-to-show', () => { clearTimeout(timer); resolve(); });
      win.once('closed', () => { clearTimeout(timer); reject(Error('壁纸窗口已关闭')); });
    });
    win.setIgnoreMouseEvents(true);
    const record = desktop.attach(win, screen.dipToScreenRect(null, display.bounds));
    if (settings.visible) win.showInactive(); else win.hide();
    wallpaper = win; wallpaperRecord = record; settings.mode = 'wallpaper';
    widget.hide(); error = null; persist(); broadcast();
  } catch (e) { win.destroy(); settings.mode = 'widget'; updateSettings({}); throw e; }
}
async function fetchJson(url, signal) {
  const response = await net.fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw Error(response.status === 429 ? '天气服务请求较多，请稍后重试' : `天气服务暂不可用（${response.status}）`);
  return response.json();
}
async function refresh(manual = false) {
  if(settings.location) void environment?.refresh(settings.location,manual);
  if (!settings.location || loading) return;
  if (manual && Date.now() - lastAttempt < 10_000) return;
  clearTimeout(refreshTimer); lastAttempt = Date.now(); loading = true; error = null; broadcast();
  const version = ++requestVersion, location = settings.location;
  controller?.abort(); controller = new AbortController();
  const currentController = controller;
  try {
    const next = await weatherService.get(location,settings.weatherSource,currentController.signal);
    if (version !== requestVersion) return;
    weather = next; environment?.record(next);
    if(settings.weatherNotifications&&!smoke&&!next.fallback){const tip=insights(next,environment?.state().air).find(t=>t.level==='attention');if(tip&&tip.id!==settings.lastNotice)notify(tip.title+' · '+tip.detail);settings.lastNotice=tip?.id||null;}
     retryDelay = 60_000; startupError = null; persist();
  } catch (e) {
    if (version !== requestVersion) return;
    error = e.name === 'AbortError' ? '天气请求超时，请检查网络后重试' : e.message || '无法连接天气服务';
  } finally {
    if (version === requestVersion) {
      loading = false; broadcast();
      refreshTimer = setTimeout(refresh, error ? retryDelay : 15 * 60_000 + Math.random()*30_000);
      if (error) retryDelay = Math.min(retryDelay * 2, 15 * 60_000);
    }
  }
}
async function chooseLocation(input) {
  const location = validateLocation(input);
  controller?.abort(); ++requestVersion; loading = false; weather = null; error = null;
  settings.location = location; settings.model = 'auto'; environment?.select(location);
  persist(); broadcast(); await refresh(); return state();
}
const aliases = { '上海': 'Shanghai', '上海市': 'Shanghai', '北京': 'Beijing', '北京市': 'Beijing', '广州': 'Guangzhou', '广州市': 'Guangzhou', '深圳': 'Shenzhen', '杭州': 'Hangzhou', '成都': 'Chengdu', '武汉': 'Wuhan', '南京': 'Nanjing', '重庆': 'Chongqing', '西安': "Xi'an", '苏州': 'Suzhou', '天津': 'Tianjin' };
async function search(query) {
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 120) throw Error('请输入至少两个字符的城市或地区名称');
  query = query.trim();
  const local = localSearch(query);
  if(local.length) return local;
  if (searchCache.has(query)) return searchCache.get(query);
  if (Date.now() - lastSearch < 700) throw Error('请稍等片刻再搜索');
  lastSearch = Date.now();
  const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
  u.search = new URLSearchParams({ name: aliases[query] || query, count: '8', language: 'zh', format: 'json' }).toString();
  const data = await fetchJson(u.toString(), AbortSignal.timeout(12_000));
  const results = (data.results || []).map(r => validateLocation({ name: r.name, latitude: r.latitude, longitude: r.longitude, admin: [r.admin1, r.admin2].filter(Boolean).join(' · '), country: r.country, timezone:r.timezone }));
  if (searchCache.size > 50) searchCache.clear();
  searchCache.set(query, results); return results;
}
function trusted(event, settingOnly = false) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const expected = pathToFileURL(path.join(root, 'dist/index.html')).href;
  if (!win || event.senderFrame !== event.sender.mainFrame || !event.senderFrame.url.startsWith(expected + '?') || (settingOnly && win.qihouRole !== 'settings')) throw Error('此操作只能从栖候设置窗口发起');
}
function ipc(channel, fn, settingOnly = false) {
  ipcMain.handle(channel, async (event, arg) => { trusted(event, settingOnly); return fn(arg); });
}
function setupIpc() {
  ipcMain.handle('qihou:desk-drag',(event,phase)=>{
    trusted(event);if(BrowserWindow.fromWebContents(event.sender)!==toolWindow||!['start','move','end'].includes(phase))throw Error('无效的工具面板拖动');
    if(phase==='start')toolDrag={cursor:desktop.cursorPoint(),rect:desktop.windowRect(toolWindow)};
    if(toolDrag&&phase!=='start'){const cursor=desktop.cursorPoint();desktop.moveOnly(toolWindow,toolDrag.rect.left+cursor.x-toolDrag.cursor.x,toolDrag.rect.top+cursor.y-toolDrag.cursor.y);}
    if(phase==='end'){toolDrag=null;const [x,y]=toolWindow.getPosition();deskTools.command({action:'position',x,y});}
  });
  ipcMain.handle('qihou:drag', (event, phase) => {
    trusted(event);
    if (BrowserWindow.fromWebContents(event.sender) !== widget || !['start','move','end'].includes(phase)) throw Error('无效的摆件拖动');
    dragWidget(phase);
  });
  ipc('qihou:state', state);
  ipc('qihou:search', search, true);
  ipc('qihou:location', chooseLocation, true);
  ipc('qihou:settings', updateSettings, true);
  ipc('qihou:credentials', saveCredentials, true);
  ipc('qihou:activate', code=>{licensing.activate(code);broadcast();return state();},true);
  ipc('qihou:desk-tools',command=>{
    if(command?.action==='copy'){const note=deskTools.state().notes.find(n=>n.id===command.id);if(!note)throw Error('便签不存在');clipboard.writeText(note.title+'\n'+note.text);}
    else {if(!['remove','visibility'].includes(command?.action)&&!(command?.action==='skin'&&command.skin==='garden'))requirePlus();if(command?.action==='visibility'&&command.visible)requirePlus();deskTools.command(command);}
    broadcast();return state();
  });
  ipc('qihou:favorite', async command=>{requirePlus();if(command?.action==='toggle'&&settings.location)favorites.toggle(settings.location);else if(command?.action==='remove')favorites.remove(command.id);else if(command?.action==='select'){const item=favorites.list().find(p=>p.id===command.id);if(!item)throw Error('收藏地点不存在');await chooseLocation(item);}else throw Error('收藏操作无效');broadcast();return state();},true);
  ipc('qihou:action', async name => {
    switch (name) {
      case 'check-update': await updates.check();break;
      case 'download-update': await updates.download();break;
      case 'install-update': updates.install();break;
      case 'copy-device': clipboard.writeText(licensing.state().device);break;
      case 'buy': if(!edition.purchaseUrl)throw Error('购买入口尚未配置，请联系发布者');await shell.openExternal(edition.purchaseUrl);break;
      case 'repository': await shell.openExternal('https://github.com/'+edition.repository);break;
      case 'export': {requirePlus();if(!settings.location)throw Error('请先选择地点');const result=await dialog.showSaveDialog(control,{title:'导出本机历史记录',defaultPath:'Qihou-history.csv',filters:[{name:'CSV',extensions:['csv']}]});if(!result.canceled&&result.filePath)fs.writeFileSync(result.filePath,historyCsv(environment.state(7),settings.location),'utf8');break;}
      case 'backup-tools': {const result=await dialog.showSaveDialog(control,{title:'备份便利贴与倒数日',defaultPath:'Qihou-desk-tools.json',filters:[{name:'JSON',extensions:['json']}]});if(!result.canceled&&result.filePath)fs.writeFileSync(result.filePath,deskTools.backup(),'utf8');break;}
      case 'settings': openSettings(); break;
      case 'refresh': await refresh(true); break;
      case 'reset': await resetWidget(); break;
      case 'hide': updateSettings({ visible: false }); break;
      case 'widget': await setMode('widget'); break;
      case 'wallpaper': await setMode('wallpaper'); break;
      case 'startup': if (!app.isPackaged) throw Error('开机启动在打包版本中可用'); app.setLoginItemSettings({ openAtLogin: !app.getLoginItemSettings().openAtLogin, path: app.getPath('exe') }); break;
      case 'source': await shell.openExternal(SOURCES.find(s=>s.id===weather?.providerId)?.url || 'https://open-meteo.com/'); break;
      case 'air-source': await shell.openExternal('https://open-meteo.com/en/docs/air-quality-api'); break;
      case 'cams-source': await shell.openExternal('https://atmosphere.copernicus.eu/'); break;
      case 'license': await shell.openExternal('https://creativecommons.org/licenses/by/4.0/'); break;
      case 'quit': app.quit(); break;
      default: { const source=SOURCES.find(s=>'source:'+s.id===name);if(source)await shell.openExternal(source.url);else throw Error('未知操作'); }
    }
    broadcast(); return state();
  });
}
async function boot() {
  if (!smoke) { restore(); loadCredentials(); }
  weatherService=createWeatherService({fetch:(...args)=>net.fetch(...args),getCredentials:()=>credentials,cacheDir:path.join(app.getPath('userData'),'weather-cache')});
  licensing=createLicenseStore({directory:app.getPath('userData'),publicKey:fs.readFileSync(path.join(root,'shared/license-public.pem'),'utf8')});
  favorites=createFavorites(path.join(app.getPath('userData'),'favorites.json'));
  deskTools=createDeskTools(path.join(app.getPath('userData'),'desk-tools.json'));
  updates=createUpdates({updater:require('electron-updater').autoUpdater,fetch:(...args)=>net.fetch(...args),publicKey:fs.readFileSync(path.join(root,'shared/update-public.pem'),'utf8'),repository:edition.repository,version:app.getVersion(),enabled:app.isPackaged&&!smoke,onChange:broadcast});
  if(!smoke){setTimeout(()=>void updates.check(),30000).unref();updateTimer=setInterval(()=>void updates.check(),4*3600000);licenseTimer=setInterval(()=>{licensing.tick();broadcast();},5*60000);}
  environment=createEnvironment({fetch:(...args)=>net.fetch(...args),file:path.join(app.getPath('userData'),'environment.json'),onChange:broadcast});
  environment.select(settings.location);
  setupIpc();
  const icon = nativeImage.createFromPath(path.join(root, 'assets/tray.png'));
  tray = new Tray(icon, 'a1df8f06-a590-4f71-b094-f14ff6848d51');
  tray.on('click', openSettings); tray.on('double-click', openSettings);
  createWidget(); rebuildMenu();
  const registered = globalShortcut.register('CommandOrControl+Alt+W', () => { setMode('widget').then(resetWidget).catch(report); });
  if (!registered) startupError = '恢复快捷键 Ctrl+Alt+W 已被占用，仍可从托盘编辑摆件';
  powerMonitor.on('lock-screen', () => { lockedScreen = true; broadcast(); });
  powerMonitor.on('unlock-screen', () => { lockedScreen = false; broadcast(); refresh(); });
  powerMonitor.on('suspend', () => { suspended = true; broadcast(); });
  powerMonitor.on('resume', () => { suspended = false; broadcast(); refresh(); });
  powerMonitor.on('on-battery', () => { onBattery = true; broadcast(); });
  powerMonitor.on('on-ac', () => { onBattery = false; broadcast(); });
  onBattery = powerMonitor.isOnBatteryPower();
  const repairDisplays = () => {
    if (settings.mode === 'wallpaper') setMode('widget').then(() => setMode('wallpaper')).catch(report);
    else widget.setBounds(widgetBounds());
  };
  screen.on('display-removed', repairDisplays); screen.on('display-metrics-changed', repairDisplays);
  pollTimer = setInterval(() => {
    if (wallpaperRecord && !desktop.isValid(wallpaperRecord)) { setMode('widget').catch(report); error = '桌面宿主已变化，已恢复透明摆件，可重新开启壁纸'; broadcast(); }
    const display = screen.getDisplayMatching((wallpaper || widget).getBounds());
    const full = desktop.isFullscreen(screen.dipToScreenRect(null, display.bounds), BrowserWindow.getAllWindows().map(desktop.handle));
    if (full !== fullscreen) { fullscreen = full; broadcast(); }
  }, 2000);
  if (!smoke) {
    if (settings.location) refresh();
    if (settings.mode === 'wallpaper') setMode('wallpaper').catch(report);
  }
  syncToolWindow();
  if (smoke) require('./smoke.cjs').run({ app, root: testRoot, state, widget: () => widget, control: () => control, toolWindow:()=>toolWindow, openSettings, chooseLocation, updateSettings, setMode, desktop, tray, screen, licensing, updates, favorites, deskTools }).catch(e => { console.error(e); app.exit(1); });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', openSettings);
  app.whenReady().then(boot).catch(e => { console.error(e); app.exit(1); });
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => { exiting = true; clearInterval(updateTimer);clearInterval(licenseTimer);licensing?.tick(); environment?.dispose(); clearInterval(pollTimer); clearTimeout(refreshTimer); clearTimeout(saveTimer); controller?.abort(); if (!startupError) persist(); globalShortcut.unregisterAll(); if (wallpaper && !wallpaper.isDestroyed()) wallpaper.destroy(); tray?.destroy(); });
}
