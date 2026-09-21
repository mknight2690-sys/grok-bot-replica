window.addEventListener('DOMContentLoaded', () => {
  const botInfo = document.getElementById('bot-info');
  if (botInfo) {
    window.api = {
      getModelInfo: () => ipcRenderer.invoke('get-model-info'),
      sendMessage: (msg) => ipcRenderer.invoke('send-message', msg),
      openExternal: (url) => ipcRenderer.invoke('open-external', url)
    };
  }
});