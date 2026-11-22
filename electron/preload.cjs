/**
 * KuroStream - Windows Desktop Edition (Preload Script)
 * Exposes safe Electron IPC APIs to the renderer window
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isWindowsDesktop: true,
  platform: process.platform,
  version: '2.0.0',
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('is-window-maximized'),
  setDiscordPresence: (details) => ipcRenderer.send('update-discord-presence', details),
  openExternal: (url) => ipcRenderer.send('open-external-url', url),
  getSystemSpecs: () => ({
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
  }),
});
