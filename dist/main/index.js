"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const island_window_1 = require("./island-window");
const tray_manager_1 = require("./tray-manager");
const startup_manager_1 = require("./startup-manager");
const media_engine_1 = require("./media-engine");
const ai_monitor_hub_1 = require("./ai-monitor-hub");
const buddy_manager_1 = require("./buddy-manager");
const productivity_engine_1 = require("./productivity-engine");
const config_store_1 = require("./config-store");
const ai_provider_manager_1 = require("./ai-provider-manager");
const weather_service_1 = require("./weather-service");
const system_metrics_1 = require("./system-metrics");
const game_mode_1 = require("./game-mode");
const license_manager_1 = require("./license-manager");
const download_monitor_1 = require("./download-monitor");
// Enforce single instance lock
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
    process.exit(0);
}
// Memory optimization: Encourage timely V8 garbage collection while maintaining full 60+ FPS animation smoothness
electron_1.app.commandLine.appendSwitch('js-flags', '--max-old-space-size=160');
process.on('uncaughtException', (err) => {
    console.error('[RoboIsland] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[RoboIsland] Unhandled rejection:', reason);
});
let islandWindow = null;
let trayManager = null;
let settingsWindow = null;
let mediaEngine = null;
let aiMonitorHub = null;
let buddyManager = null;
let productivityEngine = null;
let aiProviderManager = null;
let downloadMonitor = null;
electron_1.app.whenReady().then(() => {
    // Initialize config & startup
    startup_manager_1.StartupManager.init();
    // Create Island Window
    islandWindow = new island_window_1.IslandWindow();
    game_mode_1.gameModeManager.setIslandWindow(islandWindow);
    weather_service_1.weatherService.startPolling();
    // Initialize Engines
    mediaEngine = new media_engine_1.MediaEngine();
    downloadMonitor = new download_monitor_1.DownloadMonitor();
    aiMonitorHub = new ai_monitor_hub_1.AiMonitorHub();
    buddyManager = new buddy_manager_1.BuddyManager();
    productivityEngine = new productivity_engine_1.ProductivityEngine();
    aiProviderManager = new ai_provider_manager_1.AIProviderManager();
    (0, ai_provider_manager_1.registerAIProviderIPC)(aiProviderManager);
    // Create System Tray
    trayManager = new tray_manager_1.TrayManager(islandWindow, () => {
        openSettingsWindow();
    });
    // Register Global Keyboard Shortcut (Ctrl+Alt+T) to toggle Dynamic Island
    try {
        electron_1.globalShortcut.register('CommandOrControl+Alt+T', () => {
            const win = islandWindow?.getWindow();
            if (win) {
                win.webContents.send('island:toggle-expand');
            }
        });
    }
    catch (err) {
        console.error('[RoboIsland] Failed to register global shortcut:', err);
    }
    // Handle second-instance launch (user clicked Desktop or Start Menu shortcut while app is running)
    electron_1.app.on('second-instance', () => {
        const win = islandWindow?.getWindow();
        if (win) {
            if (win.isMinimized())
                win.restore();
            win.show();
            win.focus();
            win.webContents.send('island:toggle-expand');
        }
    });
    setupAppIPC();
});
function openSettingsWindow(tab = 'home') {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        if (settingsWindow.isMinimized())
            settingsWindow.restore();
        settingsWindow.show();
        settingsWindow.focus();
        settingsWindow.webContents.send('settings:goto-tab', tab);
        return;
    }
    settingsWindow = new electron_1.BrowserWindow({
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
        if (tab)
            settingsWindow?.webContents.send('settings:goto-tab', tab);
    });
    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}
function setupAppIPC() {
    electron_1.ipcMain.on('settings:open', (_event, tab) => {
        openSettingsWindow(tab || 'home');
    });
    electron_1.ipcMain.handle('settings:get-config', () => {
        return config_store_1.configStore.get();
    });
    electron_1.ipcMain.handle('settings:update-config', (_event, partial) => {
        config_store_1.configStore.update(partial);
        if (typeof partial.islandOpacity === 'number') {
            islandWindow?.setOpacity(partial.islandOpacity);
        }
        if (typeof partial.autoStart === 'boolean') {
            try {
                startup_manager_1.StartupManager.setEnabled(partial.autoStart);
            }
            catch (err) {
                console.warn('[RoboIsland] Failed to update startup settings:', err);
            }
        }
        islandWindow?.reposition();
        trayManager?.updateContextMenu();
        islandWindow?.getWindow()?.webContents.send('island:config-updated', config_store_1.configStore.get());
        return config_store_1.configStore.get();
    });
    electron_1.ipcMain.on('island:toggle-expand', () => {
        islandWindow?.getWindow()?.webContents.send('island:toggle-expand');
    });
    electron_1.ipcMain.on('island:focus', () => {
        const win = islandWindow?.getWindow();
        if (win && !win.isDestroyed()) {
            win.show();
            win.focus();
        }
    });
    electron_1.ipcMain.on('island:notify', (_event, payload) => {
        islandWindow?.getWindow()?.webContents.send('island:notify', payload);
    });
    electron_1.ipcMain.on('focus-guard:test', () => {
        islandWindow?.getWindow()?.webContents.send('focus-guard:trigger', {
            appName: 'YouTube',
            title: 'YouTube (Mindful Distraction Test)'
        });
    });
    electron_1.ipcMain.on('system:test-volume-pop', (_event, data) => {
        islandWindow?.getWindow()?.webContents.send('system:volume-changed', data || { level: 65, muted: false });
    });
    electron_1.ipcMain.on('system:test-charger-surge', (_event, data) => {
        islandWindow?.getWindow()?.webContents.send('battery:state-changed', data || { charging: true, level: 85 });
    });
    electron_1.ipcMain.on('system:test-speedometer-hud', () => {
        islandWindow?.getWindow()?.webContents.send('island:show-speedometer-hud');
    });
    electron_1.ipcMain.on('island:show-speedometer-hud', () => {
        islandWindow?.getWindow()?.webContents.send('island:show-speedometer-hud');
    });
    electron_1.ipcMain.handle('system:get-username', () => {
        const full = process.env.USERNAME || process.env.USER || 'Gaurav';
        return full.split(' ')[0] || 'Gaurav';
    });
    electron_1.ipcMain.on('island:trigger-greeting', (_event, type) => {
        islandWindow?.getWindow()?.webContents.send('island:trigger-greeting', type);
    });
    electron_1.ipcMain.on('island:trigger-app-activity', (_event, act) => {
        islandWindow?.getWindow()?.webContents.send('island:app-activity', act);
    });
    electron_1.ipcMain.handle('license:get-status', () => {
        return license_manager_1.LicenseManager.getInstance().getLicenseStatus();
    });
    electron_1.ipcMain.handle('license:activate', (_event, key) => {
        return license_manager_1.LicenseManager.getInstance().activateKey(key);
    });
    electron_1.ipcMain.handle('license:generate-key', (_event, customer) => {
        if (!license_manager_1.LicenseManager.getInstance().isCurrentMachineOwner()) {
            return { success: false, error: 'Unauthorized: Owner license required to generate keys.' };
        }
        const key = license_manager_1.LicenseManager.getInstance().generateCustomerKey(customer);
        return { success: true, key };
    });
    electron_1.ipcMain.handle('whatsapp:reply', async (_event, payload) => {
        const text = payload?.text || '';
        if (!text)
            return false;
        try {
            electron_1.clipboard.writeText(text);
            const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
            await electron_1.shell.openExternal(url).catch(() => {
                electron_1.shell.openExternal(`https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`);
            });
            return true;
        }
        catch (err) {
            console.warn('[WhatsAppReply] Failed to dispatch reply:', err);
            return false;
        }
    });
    electron_1.ipcMain.handle('system:open-external', (_event, url) => {
        if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('ms-settings:'))) {
            electron_1.shell.openExternal(url).catch(() => { });
            return true;
        }
        return false;
    });
    electron_1.ipcMain.on('app:quit', () => {
        electron_1.app.quit();
    });
}
electron_1.app.on('will-quit', () => {
    electron_1.globalShortcut.unregisterAll();
    mediaEngine?.dispose();
    aiMonitorHub?.dispose();
    productivityEngine?.dispose();
    aiProviderManager?.abortStream();
    weather_service_1.weatherService.dispose();
    system_metrics_1.systemMetricsEngine.dispose();
    game_mode_1.gameModeManager.dispose();
});
electron_1.app.on('window-all-closed', () => {
    // Stay resident in the system tray on Windows
});
