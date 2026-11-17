"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('settingsApi', {
    getConfig: () => electron_1.ipcRenderer.invoke('settings:get-config'),
    updateConfig: (partial) => electron_1.ipcRenderer.invoke('settings:update-config', partial),
    onGotoTab: (callback) => {
        electron_1.ipcRenderer.on('settings:goto-tab', (_event, tab) => callback(tab));
    },
    openExternal: (url) => electron_1.ipcRenderer.invoke('system:open-external', url),
    toggleIsland: () => electron_1.ipcRenderer.send('island:toggle-expand'),
    testFocusGuard: () => electron_1.ipcRenderer.send('focus-guard:test'),
    testVolumeHud: (level = 65, muted = false) => electron_1.ipcRenderer.send('system:test-volume-pop', { level, muted }),
    testChargerSurge: (charging = true, level = 85) => electron_1.ipcRenderer.send('system:test-charger-surge', { charging, level }),
    testSpeedometerHud: () => electron_1.ipcRenderer.send('system:test-speedometer-hud'),
    postNotification: (payload) => electron_1.ipcRenderer.send('island:notify', payload),
    // Media
    getMediaState: () => electron_1.ipcRenderer.invoke('media:get-state'),
    mediaControl: (action) => electron_1.ipcRenderer.invoke('media:control', action),
    onMediaStateChanged: (callback) => {
        const handler = (_event, state) => callback(state);
        electron_1.ipcRenderer.on('media:state-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('media:state-changed', handler);
    },
    // System Volume
    getVolume: () => electron_1.ipcRenderer.invoke('system:get-volume'),
    setVolume: (level) => electron_1.ipcRenderer.invoke('system:set-volume', level),
    setMute: (muted) => electron_1.ipcRenderer.invoke('system:set-mute', muted),
    onVolumeChanged: (callback) => {
        const handler = (_event, vol) => callback(vol);
        electron_1.ipcRenderer.on('system:volume-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('system:volume-changed', handler);
    },
    // System Radios (Wi-Fi & Bluetooth)
    getNetwork: () => electron_1.ipcRenderer.invoke('system:get-network'),
    setRadio: (kind, on) => electron_1.ipcRenderer.invoke('system:set-radio', kind, on),
    onNetworkChanged: (callback) => {
        const handler = (_event, net) => callback(net);
        electron_1.ipcRenderer.on('system:network-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('system:network-changed', handler);
    },
    // Pro Licensing & Owner Creator Hub
    getLicenseStatus: () => electron_1.ipcRenderer.invoke('license:get-status'),
    activateLicense: (key) => electron_1.ipcRenderer.invoke('license:activate', key),
    generateCustomerKey: (customer) => electron_1.ipcRenderer.invoke('license:generate-key', customer),
    // AI & Autonomous Diagnostics
    saveAICredential: (provider, apiKey, baseUrl, model) => electron_1.ipcRenderer.invoke('ai-chat:save-credential', { provider, apiKey, baseUrl, model }),
    getAICredentialStatus: () => electron_1.ipcRenderer.invoke('ai-chat:get-status'),
    optimizeMemory: () => electron_1.ipcRenderer.invoke('diagnostics:optimize-memory'),
    cleanJunkFiles: () => electron_1.ipcRenderer.invoke('diagnostics:clean-junk'),
    analyzeScreen: () => electron_1.ipcRenderer.invoke('diagnostics:analyze-screen')
});
