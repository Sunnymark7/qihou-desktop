const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('qihou', {
  deskTools:(command)=>ipcRenderer.invoke('qihou:desk-tools',command),
  deskDrag:(phase)=>ipcRenderer.invoke('qihou:desk-drag',phase),
  activate:(code)=>ipcRenderer.invoke('qihou:activate',code),
  favorite:(command)=>ipcRenderer.invoke('qihou:favorite',command),
  drag: (phase) => ipcRenderer.invoke('qihou:drag', phase),
  state: () => ipcRenderer.invoke('qihou:state'),
  search: (query) => ipcRenderer.invoke('qihou:search', query),
  setLocation: (location) => ipcRenderer.invoke('qihou:location', location),
  settings: (patch) => ipcRenderer.invoke('qihou:settings', patch),
  credentials: (patch) => ipcRenderer.invoke('qihou:credentials', patch),
  action: (name) => ipcRenderer.invoke('qihou:action', name),
  subscribe: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('qihou:changed', listener);
    return () => ipcRenderer.removeListener('qihou:changed', listener);
  },
});
