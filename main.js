const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const bot = require('./bot.js');

const isHeadless = process.argv.includes('--headless') || process.env.ELECTRON_HEADLESS;

if (isHeadless) {
  // Headless mode: skip GUI, just run bot loop
  bot.init();
  bot.runLoop();
  return;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  bot.init();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    bot.shutdown();
    app.quit();
  }
});

ipcMain.handle('get-model-info', async () => {
  return bot.getModelInfo();
});

ipcMain.handle('send-message', async (event, message) => {
  return await bot.sendMessage(message);
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});