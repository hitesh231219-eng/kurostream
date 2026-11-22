/**
 * KuroStream - Windows Desktop Edition (Electron Main Process)
 * Runs the full-stack KuroStream Express + WebSocket server locally inside Electron
 * and renders the frameless Windows 11 desktop client with System Tray & OAuth support.
 */

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let embeddedServer = null;
let isQuitting = false;

// Ensure single instance on Windows
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

// GPU Hardware Acceleration flags for smooth video & UI playback
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,single-on-top,underlay');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

function resolveIconPath() {
  const candidates = [
    path.join(__dirname, 'icon.ico'),
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, '../public/favicon.ico'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function isAllowedAuthPopup(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'accounts.google.com' ||
      host.endsWith('.google.com') ||
      host.endsWith('.firebaseapp.com') ||
      host.endsWith('.web.app') ||
      host === '127.0.0.1' ||
      host === 'localhost'
    );
  } catch {
    return false;
  }
}

async function resolveStartUrl() {
  const isDevServerMode = process.env.NODE_ENV === 'development' && !app.isPackaged;
  if (isDevServerMode && process.env.KURO_DEV_URL) {
    return process.env.KURO_DEV_URL;
  }

  const distDir = path.join(__dirname, '../dist');
  const embeddedPath = path.join(__dirname, 'embedded-server.cjs');
  const { startEmbeddedDesktopServer } = require(embeddedPath);
  embeddedServer = await startEmbeddedDesktopServer({
    distDir,
    preferredPort: 38421,
  });
  return embeddedServer.url;
}

function registerIpcHandlers() {
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('is-window-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  ipcMain.on('update-discord-presence', (_event, presenceData) => {
    console.log('[KuroStream Desktop] Activity:', presenceData);
  });

  ipcMain.on('open-external-url', (_event, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
  });
}

function setupTray(iconPath) {
  if (!iconPath || tray) return;
  try {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open KuroStream',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Minimize to Tray',
        click: () => {
          if (mainWindow) mainWindow.hide();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit KuroStream',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setToolTip('KuroStream Desktop');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch {
    // Tray icon optional
  }
}

async function createWindow() {
  const iconPath = resolveIconPath();
  const startUrl = await resolveStartUrl();

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#08090d',
    title: 'KuroStream — Windows Desktop Edition',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows cross-origin embedded anime players
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAuthPopup(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 540,
          height: 700,
          autoHideMenuBar: true,
          backgroundColor: '#08090d',
        },
      };
    }
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  await mainWindow.loadURL(startUrl);
  setupTray(iconPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  try {
    await createWindow();
  } catch (err) {
    dialog.showErrorBox(
      'KuroStream Startup Error',
      err && err.message ? err.message : 'Unable to start KuroStream Desktop server.'
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', async () => {
  if (embeddedServer) {
    try {
      await embeddedServer.close();
    } catch {}
    embeddedServer = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isQuitting) {
    app.quit();
  }
});
