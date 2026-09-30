// Narrow Win32 adapter. No shell commands or process injection.
let api;
function native() {
  if (api) return api;
  if (process.platform !== 'win32') throw Error('动态壁纸当前仅支持 Windows');
  const koffi = require('koffi');
  const dll = koffi.load('user32.dll');
  const RECT = koffi.struct('QihouRect', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
  koffi.struct('QihouPoint', { x:'int32', y:'int32' });
  api = {
    find: dll.func('uintptr_t __stdcall FindWindowW(str16, str16)'),
    findEx: dll.func('uintptr_t __stdcall FindWindowExW(uintptr_t, uintptr_t, str16, str16)'),
    send: dll.func('intptr_t __stdcall SendMessageTimeoutW(uintptr_t, uint32, uintptr_t, intptr_t, uint32, uint32, _Out_ uintptr_t *)'),
    parent: dll.func('uintptr_t __stdcall SetParent(uintptr_t, uintptr_t)'),
    getParent: dll.func('uintptr_t __stdcall GetParent(uintptr_t)'),
    valid: dll.func('bool __stdcall IsWindow(uintptr_t)'),
    style: dll.func('intptr_t __stdcall GetWindowLongPtrW(uintptr_t, int)'),
    setStyle: dll.func('intptr_t __stdcall SetWindowLongPtrW(uintptr_t, int, intptr_t)'),
    position: dll.func('bool __stdcall SetWindowPos(uintptr_t, uintptr_t, int, int, int, int, uint32)'),
    foreground: dll.func('uintptr_t __stdcall GetForegroundWindow()'),
    rect: dll.func('bool __stdcall GetWindowRect(uintptr_t, _Out_ QihouRect *)'),
    cursor: dll.func('bool __stdcall GetCursorPos(_Out_ QihouPoint *)'),
    className: dll.func('int __stdcall GetClassNameW(uintptr_t, _Out_ char16_t *, int)'),
  };
  return api;
}
function handle(win) { return Number(win.getNativeWindowHandle().readBigUInt64LE()); }
function hideFromTaskbar(win) {
  const a=native(), hwnd=handle(win), style=Number(a.style(hwnd,-20));
  // Electron's skipTaskbar calls DeleteTab only; TOOLWINDOW also excludes future
  // shell enumeration after show/restore. Keep all unrelated extended styles.
  a.setStyle(hwnd,-20,(style | 0x80) & ~0x40000);
  win.setSkipTaskbar(true);
}
function windowRect(win) { const rect={};if(!native().rect(handle(win),rect))throw Error('无法读取摆件位置');return rect; }
function cursorPoint() { const point={};if(!native().cursor(point))throw Error('无法读取鼠标位置');return point; }
function moveOnly(win,x,y) {
  // Both coordinates are physical pixels. SWP_NOSIZE is essential: Electron's
  // setPosition round-trips the existing size through DIP and grows it on 150% DPI.
  if(!native().position(handle(win),0,Math.round(x),Math.round(y),0,0,0x0001|0x0004|0x0010|0x0200))throw Error('无法移动摆件');
}
function findDesktop() {
  const a = native();
  const progman = a.find('Progman', null);
  if (!progman) throw Error('无法找到 Windows 桌面，请重试');
  const result = [0];
  a.send(progman, 0x052c, 0xD, 0, 2, 1000, result);
  a.send(progman, 0x052c, 0xD, 1, 2, 1000, result);
  // Newer Windows builds host the wallpaper WorkerW under Progman.
  const child = a.findEx(progman, 0, 'WorkerW', null);
  if (child && !a.findEx(child, 0, 'SHELLDLL_DefView', null)) return child;
  let top = 0;
  for (let i = 0; i < 2048; i++) {
    top = a.findEx(0, top, null, null);
    if (!top) break;
    if (a.findEx(top, 0, 'SHELLDLL_DefView', null)) {
      const worker = a.findEx(0, top, 'WorkerW', null);
      if (worker) return worker;
    }
  }
  throw Error('当前桌面布局未找到可用壁纸层，已保留透明摆件');
}
function attach(win, bounds) {
  const a = native(), parent = findDesktop(), hwnd = handle(win);
  const style = Number(a.style(hwnd, -16));
  a.setStyle(hwnd, -16, (style & ~0x80000000) | 0x40000000);
  a.parent(hwnd, parent);
  if (Number(a.getParent(hwnd)) !== Number(parent)) throw Error('壁纸挂载失败，已保留透明摆件');
  const rect = {};
  a.rect(parent, rect);
  a.position(hwnd, 0, bounds.x - rect.left, bounds.y - rect.top, bounds.width, bounds.height, 0x0010 | 0x0020);
  return { parent, hwnd };
}
function isFullscreen(bounds, ownHandles) {
  try {
    const a = native(), hwnd = a.foreground();
    if (!hwnd || ownHandles.includes(Number(hwnd))) return false;
    const buffer = Buffer.alloc(512);
    a.className(hwnd, buffer, 256);
    const cls = buffer.toString('utf16le').split('\0')[0];
    if (['Progman', 'WorkerW', 'Shell_TrayWnd'].includes(cls)) return false;
    const r = {};
    if (!a.rect(hwnd, r)) return false;
    return r.left <= bounds.x && r.top <= bounds.y && r.right >= bounds.x + bounds.width && r.bottom >= bounds.y + bounds.height;
  } catch { return false; }
}
module.exports = { attach, handle, hideFromTaskbar, windowRect, cursorPoint, moveOnly, isFullscreen, isValid: (record) => !!record && native().valid(record.parent) && native().valid(record.hwnd) };
