import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, shell, session, desktopCapturer } from 'electron';
import * as path from 'path';
import { IslandWindow } from './island-window';
import { TrayManager } from './tray-manager';
import { StartupManager } from './startup-manager';
import { MediaEngine } from './media-engine';
import { AiMonitorHub } from './ai-monitor-hub';
import { BuddyManager } from './buddy-manager';
import { ProductivityEngine } from './productivity-engine';
import { configStore } from './config-store';
import { AIProviderManager, registerAIProviderIPC } from './ai-provider-manager';
import { weatherService } from './weather-service';
import { systemMetricsEngine } from './system-metrics';
import { gameModeManager } from './game-mode';
import { LicenseManager } from './license-manager';
import { DownloadMonitor } from './download-monitor';

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Memory optimization: Encourage timely V8 garbage collection while maintaining full 60+ FPS animation smoothness
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=160');

process.on('uncaughtException', (err) => {
  console.error('[RoboIsland] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[RoboIsland] Unhandled rejection:', reason);
});

let islandWindow: IslandWindow | null = null;
let trayManager: TrayManager | null = null;
let settingsWindow: BrowserWindow | null = null;

let mediaEngine: MediaEngine | null = null;
let aiMonitorHub: AiMonitorHub | null = null;
let buddyManager: BuddyManager | null = null;
let productivityEngine: ProductivityEngine | null = null;
let aiProviderManager: AIProviderManager | null = null;
let downloadMonitor: DownloadMonitor | null = null;

app.whenReady().then(() => {
  // Initialize config & startup
  StartupManager.init();

  // Configure system loopback audio capture for real-time sound reactive equalizer (TwoCode Parity)
  try {
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
        .then(sources => {
          if (sources && sources.length > 0) {
            callback({ video: sources[0], audio: 'loopback' });
          } else {
            callback({});
          }
        })
        .catch(() => callback({}));
    });
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(true);
    });
    session.defaultSession.setPermissionCheckHandler(() => true);
  } catch (err) {
    console.warn('[RoboIsland] Loopback audio capture handler init error:', err);
  }

  // Setup core application IPC early
  setupAppIPC();

  // Create Island Window
  islandWindow = new IslandWindow();
  gameModeManager.setIslandWindow(islandWindow);
  weatherService.startPolling();

  // Initialize Engines
  mediaEngine = new MediaEngine();
  downloadMonitor = new DownloadMonitor();
  aiMonitorHub = new AiMonitorHub();
  buddyManager = new BuddyManager();
  productivityEngine = new ProductivityEngine();
  aiProviderManager = new AIProviderManager();
  registerAIProviderIPC(aiProviderManager);

  // Create System Tray
  trayManager = new TrayManager(islandWindow, () => {
    openSettingsWindow();
  });

  // Register Global Keyboard Shortcut (Ctrl+Alt+T) to toggle Dynamic Island
  try {
    globalShortcut.register('CommandOrControl+Alt+T', () => {
      const win = islandWindow?.getWindow();
      if (win) {
        win.webContents.send('island:toggle-expand');
      }
    });
  } catch (err) {
    console.error('[RoboIsland] Failed to register global shortcut:', err);
  }

  // Handle second-instance launch (user clicked Desktop or Start Menu shortcut while app is running)
  app.on('second-instance', () => {
    const win = islandWindow?.getWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      win.webContents.send('island:toggle-expand');
    }
  });
});

function openSettingsWindow(tab = 'home'): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.focus();
    settingsWindow.webContents.send('settings:goto-tab', tab);
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 840,
    minHeight: 560,
    show: false,
    title: 'RoboIsland Settings (100% Free)',
    backgroundColor: '#0e1015',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0e1015',
      symbolColor: '#e6e6ea',
      height: 40
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/settings-preload.js')
    }
  });

  settingsWindow.setMenuBarVisibility(false);

  // Load Settings HTML
  const settingsHtmlPath = path.join(__dirname, '../renderer/settings/settings.html');
  settingsWindow.loadFile(settingsHtmlPath);

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
    settingsWindow?.focus();
    if (tab) settingsWindow?.webContents.send('settings:goto-tab', tab);
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function setupAppIPC(): void {
  ipcMain.on('settings:open', (_event, tab?: string) => {
    openSettingsWindow(tab || 'home');
  });

  ipcMain.handle('settings:get-config', () => {
    return configStore.get();
  });

  ipcMain.handle('settings:update-config', (_event, partial: any) => {
    configStore.update(partial);
    if (typeof partial.islandOpacity === 'number') {
      islandWindow?.setOpacity(partial.islandOpacity);
    }
    if (typeof partial.autoStart === 'boolean') {
      try {
        StartupManager.setEnabled(partial.autoStart);
      } catch (err) {
        console.warn('[RoboIsland] Failed to update startup settings:', err);
      }
    }
    islandWindow?.reposition();
    trayManager?.updateContextMenu();
    islandWindow?.getWindow()?.webContents.send('island:config-updated', configStore.get());
    return configStore.get();
  });

  ipcMain.on('island:toggle-expand', () => {
    islandWindow?.getWindow()?.webContents.send('island:toggle-expand');
  });

  ipcMain.on('island:focus', () => {
    const win = islandWindow?.getWindow();
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });

  ipcMain.on('island:notify', (_event, payload) => {
    islandWindow?.getWindow()?.webContents.send('island:notify', payload);
  });

  ipcMain.on('focus-guard:test', () => {
    islandWindow?.getWindow()?.webContents.send('focus-guard:trigger', {
      appName: 'YouTube',
      title: 'YouTube (Mindful Distraction Test)'
    });
  });

  ipcMain.on('system:test-volume-pop', (_event, data) => {
    islandWindow?.getWindow()?.webContents.send('system:volume-changed', data || { level: 65, muted: false });
  });

  ipcMain.on('system:test-charger-surge', (_event, data) => {
    islandWindow?.getWindow()?.webContents.send('battery:state-changed', data || { charging: true, level: 85 });
  });

  ipcMain.on('system:test-speedometer-hud', () => {
    islandWindow?.getWindow()?.webContents.send('island:show-speedometer-hud');
  });

  ipcMain.on('island:show-speedometer-hud', () => {
    islandWindow?.getWindow()?.webContents.send('island:show-speedometer-hud');
  });

  ipcMain.handle('system:get-username', () => {
    const full = process.env.USERNAME || process.env.USER || 'Gaurav';
    return full.split(' ')[0] || 'Gaurav';
  });

  ipcMain.on('island:trigger-greeting', (_event, type?: string) => {
    islandWindow?.getWindow()?.webContents.send('island:trigger-greeting', type);
  });

  ipcMain.handle('license:get-status', () => {
    return LicenseManager.getInstance().getLicenseStatus();
  });

  ipcMain.handle('license:activate', (_event, key: string) => {
    return LicenseManager.getInstance().activateKey(key);
  });

  ipcMain.handle('license:generate-key', (_event, customer: string) => {
    if (!LicenseManager.getInstance().isCurrentMachineOwner()) {
      return { success: false, error: 'Unauthorized: Owner license required to generate keys.' };
    }
    const key = LicenseManager.getInstance().generateCustomerKey(customer);
    return { success: true, key };
  });

  ipcMain.handle('whatsapp:reply', async (_event, payload: { contact?: string; text: string }) => {
    const text = payload?.text || '';
    if (!text) return false;
    try {
      clipboard.writeText(text);
      const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
      await shell.openExternal(url).catch(() => {
        shell.openExternal(`https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`);
      });
      return true;
    } catch (err) {
      console.warn('[WhatsAppReply] Failed to dispatch reply:', err);
      return false;
    }
  });

  ipcMain.handle('system:open-external', (_event, url: string) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('ms-settings:'))) {
      shell.openExternal(url).catch(() => {});
      return true;
    }
    return false;
  });

  ipcMain.on('app:quit', () => {
    app.quit();
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  mediaEngine?.dispose();
  aiMonitorHub?.dispose();
  productivityEngine?.dispose();
  aiProviderManager?.abortStream();
  weatherService.dispose();
  systemMetricsEngine.dispose();
  gameModeManager.dispose();
});

app.on('window-all-closed', () => {
  // Stay resident in the system tray on Windows
});
