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
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const island_window_1 = require("./island-window");
const tray_manager_1 = require("./tray-manager");
const startup_manager_1 = require("./startup-manager");
const media_engine_1 = require("./media-engine");
const ai_monitor_hub_1 = require("./ai-monitor-hub");
const buddy_manager_1 = require("./buddy-manager");
const productivity_engine_1 = require("./productivity-engine");
const config_store_1 = require("./config-store");
const ai_provider_manager_1 = require("./ai-provider-manager");
const system_diagnostics_1 = require("./system-diagnostics");
const action_agent_1 = require("./action-agent");
const weather_service_1 = require("./weather-service");
const system_metrics_1 = require("./system-metrics");
const game_mode_1 = require("./game-mode");
const license_manager_1 = require("./license-manager");
const download_monitor_1 = require("./download-monitor");
const sports_service_1 = require("./sports-service");
const launcher_engine_1 = require("./launcher-engine");
const screen_glance_engine_1 = require("./screen-glance-engine");
const whatsapp_smart_service_1 = require("./whatsapp-smart-service");
const bluetooth_monitor_1 = require("./bluetooth-monitor");
const voice_companion_service_1 = require("./voice-companion-service");
// Enforce single instance lock
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
    process.exit(0);
}
// Memory & CPU runtime optimization: Enforce proactive V8 garbage collection & low RAM usage
electron_1.app.commandLine.appendSwitch('js-flags', '--max-old-space-size=128');
electron_1.app.commandLine.appendSwitch('renderer-process-limit', '4');
electron_1.app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
// Linux Fedora / KDE Plasma / Wayland compatibility:
// Auto-detect Wayland vs X11/XWayland with smooth compositor integration & window decorations
if (process.platform === 'linux') {
    electron_1.app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
    electron_1.app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
}
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
let diagnosticsManager = null;
let actionAgent = null;
electron_1.app.whenReady().then(() => {
    // Initialize config & startup
    startup_manager_1.StartupManager.init();
    // Configure system loopback audio capture for real-time sound reactive equalizer (TwoCode Parity)
    try {
        electron_1.session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
            electron_1.desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
                .then(sources => {
                if (sources && sources.length > 0) {
                    callback({ video: sources[0], audio: 'loopback' });
                }
                else {
                    callback({});
                }
            })
                .catch(() => callback({}));
        });
        electron_1.session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
            callback(true);
        });
        electron_1.session.defaultSession.setPermissionCheckHandler(() => true);
    }
    catch (err) {
        console.warn('[RoboIsland] Loopback audio capture handler init error:', err);
    }
    // Setup core application IPC early
    setupAppIPC();
    // Create Island Window
    islandWindow = new island_window_1.IslandWindow();
    game_mode_1.gameModeManager.setIslandWindow(islandWindow);
    weather_service_1.weatherService.startPolling();
    sports_service_1.sportsService.setBroadcastCallback((data) => {
        islandWindow?.getWindow()?.webContents.send('island:sports-update', data);
    });
    sports_service_1.sportsService.startPolling(4000);
    screen_glance_engine_1.screenGlanceEngine.onErrorsChanged((errors) => {
        islandWindow?.getWindow()?.webContents.send('island:glance-error', errors);
    });
    // Initialize Engines
    mediaEngine = new media_engine_1.MediaEngine();
    downloadMonitor = new download_monitor_1.DownloadMonitor();
    aiMonitorHub = new ai_monitor_hub_1.AiMonitorHub();
    buddyManager = new buddy_manager_1.BuddyManager();
    productivityEngine = new productivity_engine_1.ProductivityEngine();
    aiProviderManager = new ai_provider_manager_1.AIProviderManager();
    diagnosticsManager = new system_diagnostics_1.SystemDiagnosticsManager(aiProviderManager);
    actionAgent = new action_agent_1.AutonomousActionAgent(aiProviderManager, diagnosticsManager);
    (0, ai_provider_manager_1.registerAIProviderIPC)(aiProviderManager, actionAgent);
    whatsapp_smart_service_1.whatsappSmartService.setAIProviderManager(aiProviderManager);
    whatsapp_smart_service_1.whatsappSmartService.setBroadcastCallback((channel, data) => {
        islandWindow?.getWindow()?.webContents.send(channel, data);
    });
    bluetooth_monitor_1.bluetoothMonitorService.setBroadcastCallback((channel, data) => {
        islandWindow?.getWindow()?.webContents.send(channel, data);
    });
    bluetooth_monitor_1.bluetoothMonitorService.startPolling(8000);
    voice_companion_service_1.voiceCompanionService.setDependencies({
        sportsService: sports_service_1.sportsService,
        launcherEngine: launcher_engine_1.launcherEngine,
        screenGlanceEngine: screen_glance_engine_1.screenGlanceEngine,
        bluetoothMonitorService: bluetooth_monitor_1.bluetoothMonitorService
    });
    voice_companion_service_1.voiceCompanionService.setBroadcastCallback((channel, data) => {
        islandWindow?.getWindow()?.webContents.send(channel, data);
    });
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
            if (process.platform === 'linux') {
                const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                await electron_1.shell.openExternal(url).catch(() => { });
                return true;
            }
            // Direct background send without popping up or stealing focus with WhatsApp
            const scriptPath = path.join(__dirname, '../native/whatsapp-sender.ps1');
            if (fs.existsSync(scriptPath)) {
                return await new Promise((resolve) => {
                    const contact = payload?.contact || '';
                    const phone = payload?.phone || '';
                    const tag = payload?.tag || '';
                    const ps = (0, child_process_1.spawn)('powershell.exe', [
                        '-NoProfile',
                        '-NonInteractive',
                        '-ExecutionPolicy',
                        'Bypass',
                        '-File',
                        scriptPath,
                        '-Text',
                        text,
                        '-Contact',
                        contact,
                        '-Phone',
                        phone,
                        '-Tag',
                        tag,
                        '-Autonomous'
                    ], {
                        windowsHide: true,
                        stdio: ['ignore', 'pipe', 'pipe']
                    });
                    let stdoutData = '';
                    ps.stdout?.on('data', (d) => { stdoutData += d.toString(); });
                    const timeout = setTimeout(() => {
                        try {
                            ps.kill();
                        }
                        catch { }
                        resolve(true);
                    }, 15000);
                    ps.on('close', (code) => {
                        clearTimeout(timeout);
                        if (code === 0 && stdoutData.includes('OK')) {
                            resolve(true);
                        }
                        else {
                            // Silent completion - do NOT pop open WhatsApp visibly on the user screen
                            console.log('[WhatsAppReply] Silent send completed:', stdoutData.trim());
                            resolve(true);
                        }
                    });
                    ps.on('error', (err) => {
                        clearTimeout(timeout);
                        console.warn('[WhatsAppReply] PowerShell spawn error:', err);
                        resolve(true);
                    });
                });
            }
            return true;
        }
        catch (err) {
            console.warn('[WhatsAppReply] Failed to dispatch reply:', err);
            return false;
        }
    });
    electron_1.ipcMain.handle('whatsapp:react', async (_event, payload) => {
        const emoji = payload?.emoji || '👍';
        const contact = payload?.contact || '';
        if (!contact)
            return false;
        // Send emoji reaction directly
        const scriptPath = path.join(__dirname, '../native/whatsapp-sender.ps1');
        if (fs.existsSync(scriptPath)) {
            return await new Promise((resolve) => {
                const ps = (0, child_process_1.spawn)('powershell.exe', [
                    '-NoProfile',
                    '-NonInteractive',
                    '-ExecutionPolicy',
                    'Bypass',
                    '-File',
                    scriptPath,
                    '-Text',
                    emoji,
                    '-Contact',
                    contact,
                    '-Autonomous'
                ], {
                    windowsHide: true,
                    stdio: ['ignore', 'pipe', 'pipe']
                });
                const timeout = setTimeout(() => { try {
                    ps.kill();
                }
                catch { } resolve(true); }, 15000);
                ps.on('close', () => { clearTimeout(timeout); resolve(true); });
                ps.on('error', () => { clearTimeout(timeout); resolve(true); });
            });
        }
        return true;
    });
    // WhatsApp Smart Replies & Voice Note Reader IPC (R4)
    electron_1.ipcMain.handle('whatsapp:get-smart-replies', async (_event, payload) => {
        return whatsapp_smart_service_1.whatsappSmartService.getSmartReplies(payload?.message || '', payload?.sender);
    });
    electron_1.ipcMain.handle('whatsapp:transcribe-voice-note', async (_event, payload) => {
        return whatsapp_smart_service_1.whatsappSmartService.transcribeVoiceNote(payload?.voiceNoteId, payload?.durationSeconds, payload?.context);
    });
    electron_1.ipcMain.handle('whatsapp:simulate-incoming', async (_event, payload) => {
        return whatsapp_smart_service_1.whatsappSmartService.simulateIncomingMessage(payload?.sender, payload?.body, payload?.isVoiceNote, payload?.durationSeconds);
    });
    electron_1.ipcMain.handle('system:open-external', (_event, url) => {
        if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('ms-settings:'))) {
            electron_1.shell.openExternal(url).catch(() => { });
            return true;
        }
        return false;
    });
    electron_1.ipcMain.handle('sports:get-state', () => {
        return sports_service_1.sportsService.getState();
    });
    electron_1.ipcMain.handle('sports:toggle-match', (_event, sport) => {
        return sports_service_1.sportsService.toggleSport(sport);
    });
    electron_1.ipcMain.handle('sports:toggle-sport', (_event, sport) => {
        return sports_service_1.sportsService.toggleSport(sport);
    });
    electron_1.ipcMain.handle('sports:switch-sport', (_event, sport) => {
        return sports_service_1.sportsService.toggleSport(sport);
    });
    electron_1.ipcMain.handle('sports:set-mode', (_event, mode) => {
        return sports_service_1.sportsService.setMode(mode);
    });
    electron_1.ipcMain.handle('sports:step-simulation', () => {
        return sports_service_1.sportsService.stepSimulation();
    });
    // Spotlight / Raycast Launcher IPC (R2)
    electron_1.ipcMain.handle('launcher:query', async (_event, payload) => {
        return launcher_engine_1.launcherEngine.query(payload?.query || '');
    });
    electron_1.ipcMain.handle('launcher:launch', async (_event, payload) => {
        return launcher_engine_1.launcherEngine.launch(payload?.target, payload?.type || 'app');
    });
    electron_1.ipcMain.on('launcher:hide', () => {
        islandWindow?.getWindow()?.webContents.send('island:toggle-launcher', false);
    });
    electron_1.ipcMain.on('island:toggle-launcher', () => {
        islandWindow?.getWindow()?.webContents.send('island:toggle-launcher');
    });
    // Ambient Screen Glance & Error Fixer IPC (R3)
    electron_1.ipcMain.handle('screen-glance:check-errors', async (_event, customText) => {
        return screen_glance_engine_1.screenGlanceEngine.checkErrors(customText);
    });
    electron_1.ipcMain.handle('screen-glance:apply-fix', async (_event, payload) => {
        return screen_glance_engine_1.screenGlanceEngine.applyFix(payload?.fixId);
    });
    electron_1.ipcMain.handle('screen-glance:summarize-active', async (event, context) => {
        const summary = await screen_glance_engine_1.screenGlanceEngine.summarizeActive({
            ...context,
            senderWebContents: event.sender
        });
        islandWindow?.getWindow()?.webContents.send('island:glance-summary', summary);
        return summary;
    });
    electron_1.ipcMain.handle('screen-glance:get-state', async () => {
        return screen_glance_engine_1.screenGlanceEngine.getState();
    });
    electron_1.ipcMain.handle('screen-glance:clear-errors', async () => {
        screen_glance_engine_1.screenGlanceEngine.clearErrors();
        return true;
    });
    // Bluetooth Battery & Device HUD IPC (R5)
    electron_1.ipcMain.handle('bluetooth:get-devices', async () => {
        return bluetooth_monitor_1.bluetoothMonitorService.getConnectedDevices();
    });
    electron_1.ipcMain.handle('bluetooth:simulate-event', async (_event, payload) => {
        return bluetooth_monitor_1.bluetoothMonitorService.simulateEvent(payload);
    });
    // Voice Companion Mode IPC (R6)
    electron_1.ipcMain.handle('voice:start-listening', async () => {
        return voice_companion_service_1.voiceCompanionService.startListening();
    });
    electron_1.ipcMain.handle('voice:stop-listening', async () => {
        return voice_companion_service_1.voiceCompanionService.stopListening();
    });
    electron_1.ipcMain.handle('voice:toggle', async () => {
        return voice_companion_service_1.voiceCompanionService.toggleListening();
    });
    electron_1.ipcMain.handle('voice:process-command', async (_event, payload) => {
        const text = typeof payload === 'string' ? payload : (payload?.text || '');
        return voice_companion_service_1.voiceCompanionService.handleVoiceInput(text);
    });
    electron_1.ipcMain.handle('voice:speak', async (_event, payload) => {
        const text = typeof payload === 'string' ? payload : (payload?.text || '');
        return voice_companion_service_1.voiceCompanionService.speak(text);
    });
    electron_1.ipcMain.handle('voice:stop-speaking', async () => {
        return voice_companion_service_1.voiceCompanionService.stopSpeaking();
    });
    electron_1.ipcMain.handle('voice:get-state', async () => {
        return voice_companion_service_1.voiceCompanionService.getState();
    });
    electron_1.ipcMain.on('app:quit', () => {
        electron_1.app.quit();
    });
}
electron_1.app.on('will-quit', () => {
    electron_1.globalShortcut.unregisterAll();
    sports_service_1.sportsService.dispose();
    bluetooth_monitor_1.bluetoothMonitorService.dispose();
    voice_companion_service_1.voiceCompanionService.dispose();
    mediaEngine?.dispose();
    aiMonitorHub?.dispose();
    productivityEngine?.dispose();
    downloadMonitor?.dispose();
    aiProviderManager?.abortStream();
    diagnosticsManager?.dispose();
    weather_service_1.weatherService.dispose();
    system_metrics_1.systemMetricsEngine.dispose();
    game_mode_1.gameModeManager.dispose();
});
electron_1.app.on('window-all-closed', () => {
    // Stay resident in the system tray on Windows
});
