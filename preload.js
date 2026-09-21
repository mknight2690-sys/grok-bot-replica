const { ipcRenderer } = require('electron');

window.api = {
  getModelInfo: () => ipcRenderer.invoke('get-model-info'),
  sendMessage: (msg) => ipcRenderer.invoke('send-message', msg),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
};