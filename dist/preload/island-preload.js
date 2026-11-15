"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    // Island Geometry & Interactivity
    setInteractive: (interactive) => {
        electron_1.ipcRenderer.send('island:set-interactive', interactive);
    },
    setIslandMode: (mode) => electron_1.ipcRenderer.invoke('island:set-mode', mode),
    getIslandMode: () => electron_1.ipcRenderer.invoke('island:get-mode'),
    getModeBounds: (mode) => electron_1.ipcRenderer.invoke('island:get-mode-bounds', mode),
    notifyModeChanged: (mode) => electron_1.ipcRenderer.send('island:mode-changed', mode),
    toggleTuck: () => {
        electron_1.ipcRenderer.send('island:toggle-tuck');
    },
    setTucked: (tucked) => {
        electron_1.ipcRenderer.send('island:set-tucked', Boolean(tucked));
    },
    getConfig: () => electron_1.ipcRenderer.invoke('island:get-config'),
    updateConfig: (partial) => electron_1.ipcRenderer.invoke('island:update-config', partial),
    getDisplays: () => electron_1.ipcRenderer.invoke('island:get-displays'),
    setDisplay: (displayId) => electron_1.ipcRenderer.invoke('island:set-display', displayId),
    openSettings: (tab) => electron_1.ipcRenderer.send('settings:open', tab),
    hideIsland: () => electron_1.ipcRenderer.send('island:hide'),
    showCompact: () => electron_1.ipcRenderer.send('island:show-compact'),
    quit: () => electron_1.ipcRenderer.send('island:quit'),
    setWindowOpacity: (opacity) => electron_1.ipcRenderer.invoke('island:set-opacity', opacity),
    // Weather & System Metrics API
    getWeatherData: () => electron_1.ipcRenderer.invoke('weather:get-data'),
    refreshWeather: (lat, lon, city) => electron_1.ipcRenderer.invoke('weather:refresh', lat, lon, city),
    getSystemMetrics: () => electron_1.ipcRenderer.invoke('system:get-metrics'),
    getGameModeState: () => electron_1.ipcRenderer.invoke('gamemode:get-state'),
    setGameModeEnabled: (enabled) => electron_1.ipcRenderer.invoke('gamemode:set-enabled', enabled),
    toggleGameModeOverride: () => electron_1.ipcRenderer.invoke('gamemode:toggle-override'),
    // Media API (SMTC & Spotify)
    getMediaState: () => electron_1.ipcRenderer.invoke('media:get-state'),
    mediaControl: (action) => electron_1.ipcRenderer.invoke('media:control', action),
    mediaPlayPause: () => electron_1.ipcRenderer.invoke('media:play-pause'),
    mediaNext: () => electron_1.ipcRenderer.invoke('media:next'),
    mediaPrev: () => electron_1.ipcRenderer.invoke('media:prev'),
    mediaSeek: (positionMs) => electron_1.ipcRenderer.invoke('media:seek', positionMs),
    connectSpotifyPKCE: () => electron_1.ipcRenderer.invoke('media:connect-spotify'),
    disconnectSpotify: () => electron_1.ipcRenderer.invoke('media:disconnect-spotify'),
    getSpotifyStatus: () => electron_1.ipcRenderer.invoke('media:get-spotify-status'),
    getSpotifyDevices: () => electron_1.ipcRenderer.invoke('media:spotify-devices'),
    transferSpotifyPlayback: (deviceId) => electron_1.ipcRenderer.invoke('media:spotify-transfer', deviceId),
    getLyrics: (query) => electron_1.ipcRenderer.invoke('media:get-lyrics', query),
    // System Controls (Volume & Network)
    getVolume: () => electron_1.ipcRenderer.invoke('system:get-volume'),
    setVolume: (level) => electron_1.ipcRenderer.invoke('system:set-volume', level),
    setMute: (muted) => electron_1.ipcRenderer.invoke('system:set-mute', muted),
    getNetwork: () => electron_1.ipcRenderer.invoke('system:get-network'),
    setRadio: (kind, on) => electron_1.ipcRenderer.invoke('system:set-radio', kind, on),
    openExternal: (url) => electron_1.ipcRenderer.invoke('system:open-external', url),
    onVolumeChanged: (callback) => {
        const handler = (_event, vol) => callback(vol);
        electron_1.ipcRenderer.on('system:volume-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('system:volume-changed', handler);
    },
    onNetworkChanged: (callback) => {
        const handler = (_event, net) => callback(net);
        electron_1.ipcRenderer.on('system:network-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('system:network-changed', handler);
    },
    // AI Monitor API (Claude Code & Codex)
    getAiState: () => electron_1.ipcRenderer.invoke('ai:get-state'),
    aiApprove: (sessionId, approved) => electron_1.ipcRenderer.invoke('ai:approve', { sessionId, approved }),
    aiReply: (sessionId, text) => electron_1.ipcRenderer.invoke('ai:reply', { sessionId, text }),
    onAIMonitorEvent: (callback) => {
        const handler = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('ai-monitor:event', handler);
        return () => electron_1.ipcRenderer.removeListener('ai-monitor:event', handler);
    },
    getAIMonitorHistory: () => electron_1.ipcRenderer.invoke('ai-monitor:get-history'),
    controlAIAgent: (action) => electron_1.ipcRenderer.invoke('ai-monitor:control', action),
    // AI Chat API (OpenAI, Claude, Custom, Ollama, Robo Vision)
    captureScreen: () => electron_1.ipcRenderer.invoke('ai-chat:capture-screen'),
    sendAIChatPrompt: (provider, prompt, model, imageData) => electron_1.ipcRenderer.invoke('ai-chat:send-prompt', { provider, prompt, model, imageData }),
    onAIChatChunk: (callback) => {
        const handler = (_event, chunk) => callback(chunk);
        electron_1.ipcRenderer.on('ai-chat:chunk', handler);
        return () => electron_1.ipcRenderer.removeListener('ai-chat:chunk', handler);
    },
    onAIChatDone: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('ai-chat:done', handler);
        return () => electron_1.ipcRenderer.removeListener('ai-chat:done', handler);
    },
    saveAICredentials: (provider, apiKey, baseUrl, model) => electron_1.ipcRenderer.invoke('ai-chat:save-credentials', { provider, apiKey, baseUrl, model }),
    getAICredentialStatus: () => electron_1.ipcRenderer.invoke('ai-chat:get-credential-status'),
    getOllamaModels: () => electron_1.ipcRenderer.invoke('ai-chat:get-ollama-models'),
    triggerVoiceTyping: () => electron_1.ipcRenderer.invoke('ai-chat:voice-typing'),
    speakTTS: (text) => electron_1.ipcRenderer.invoke('ai-chat:speak-tts', text),
    // Buddy & Productivity API
    buddyGrab: (info) => electron_1.ipcRenderer.send('buddy:grab', info),
    buddyDrop: () => electron_1.ipcRenderer.send('buddy:drop'),
    onBuddyHome: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('buddy:home', handler);
        return () => electron_1.ipcRenderer.removeListener('buddy:home', handler);
    },
    trayGetFiles: () => electron_1.ipcRenderer.invoke('tools:tray-get'),
    trayAddFiles: (paths) => electron_1.ipcRenderer.invoke('tools:tray-add', paths),
    trayBrowseFiles: () => electron_1.ipcRenderer.invoke('tools:tray-browse'),
    trayRemoveFile: (idx) => electron_1.ipcRenderer.invoke('tools:tray-remove', idx),
    trayClearFiles: () => electron_1.ipcRenderer.invoke('tools:tray-clear'),
    setDropActiveFile: (filePath) => electron_1.ipcRenderer.invoke('tools:drop-set-active', filePath),
    setDragging: (dragging) => electron_1.ipcRenderer.send('island:set-dragging', dragging),
    startDragOut: (filePath) => electron_1.ipcRenderer.send('tools:tray-drag-out', filePath),
    convertFile: (filePath, targetFormat) => electron_1.ipcRenderer.invoke('tools:convert-file', { filePath, targetFormat }),
    getFilePreviewData: (filePath) => electron_1.ipcRenderer.invoke('tools:file-preview-data', filePath),
    showItemInFolder: (filePath) => electron_1.ipcRenderer.invoke('tools:show-item-in-folder', filePath),
    openPath: (filePath) => electron_1.ipcRenderer.invoke('tools:open-path', filePath),
    getClipboardHistory: () => electron_1.ipcRenderer.invoke('tools:clipboard-get'),
    copyClipboardItem: (item) => electron_1.ipcRenderer.invoke('tools:clipboard-copy', item),
    deleteClipboardItem: (id) => electron_1.ipcRenderer.invoke('tools:clipboard-delete', id),
    clearClipboardHistory: () => electron_1.ipcRenderer.invoke('tools:clipboard-clear'),
    startClipboardDragOut: (filePath) => electron_1.ipcRenderer.send('tools:clipboard-drag-out', filePath),
    onClipboardUpdated: (callback) => {
        const handler = (_event, history) => callback(history);
        electron_1.ipcRenderer.on('tools:clipboard-updated', handler);
        return () => electron_1.ipcRenderer.removeListener('tools:clipboard-updated', handler);
    },
    saveNote: (text) => electron_1.ipcRenderer.invoke('tools:note-save', text),
    getNote: () => electron_1.ipcRenderer.invoke('tools:note-get'),
    getDropInfo: () => electron_1.ipcRenderer.invoke('tools:drop-info'),
    getPathForFile: (file) => {
        try {
            if (electron_1.webUtils && typeof electron_1.webUtils.getPathForFile === 'function') {
                return electron_1.webUtils.getPathForFile(file);
            }
        }
        catch {
            // Fallback
        }
        return file?.path || '';
    },
    onTransferActive: (callback) => {
        const handler = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('tools:transfer-active', handler);
        return () => electron_1.ipcRenderer.removeListener('tools:transfer-active', handler);
    },
    // Event Subscriptions
    onPointer: (callback) => {
        const handler = (_event, pt) => callback(pt);
        electron_1.ipcRenderer.on('companion:pointer', handler);
        return () => electron_1.ipcRenderer.removeListener('companion:pointer', handler);
    },
    onToggleExpand: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('island:toggle-expand', handler);
        return () => electron_1.ipcRenderer.removeListener('island:toggle-expand', handler);
    },
    showSpeedometerHud: () => electron_1.ipcRenderer.send('island:show-speedometer-hud'),
    onShowSpeedometerHud: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('island:show-speedometer-hud', handler);
        return () => electron_1.ipcRenderer.removeListener('island:show-speedometer-hud', handler);
    },
    onNotification: (callback) => {
        const handler = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on('island:notify', handler);
        return () => electron_1.ipcRenderer.removeListener('island:notify', handler);
    },
    onDownloadsUpdate: (callback) => {
        const handler = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('island:downloads-update', handler);
        return () => electron_1.ipcRenderer.removeListener('island:downloads-update', handler);
    },
    getActiveDownloads: () => electron_1.ipcRenderer.invoke('downloads:get-active'),
    simulateDownloads: (count = 2) => electron_1.ipcRenderer.invoke('system:simulate-downloads', count),
    postNotification: (payload) => {
        electron_1.ipcRenderer.send('island:notify', payload);
    },
    replyWhatsApp: (payload) => electron_1.ipcRenderer.invoke('whatsapp:reply', payload),
    onCollapseRequested: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('island:request-collapse', handler);
        return () => electron_1.ipcRenderer.removeListener('island:request-collapse', handler);
    },
    onCollapse: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('island:collapse', handler);
        return () => electron_1.ipcRenderer.removeListener('island:collapse', handler);
    },
    onTuckedState: (callback) => {
        const handler = (_event, tucked) => callback(tucked);
        electron_1.ipcRenderer.on('island:tucked-state', handler);
        return () => electron_1.ipcRenderer.removeListener('island:tucked-state', handler);
    },
    onModeChanged: (callback) => {
        const handler = (_event, mode) => callback(mode);
        electron_1.ipcRenderer.on('island:set-mode', handler);
        return () => electron_1.ipcRenderer.removeListener('island:set-mode', handler);
    },
    onConfigUpdated: (callback) => {
        const handler = (_event, cfg) => callback(cfg);
        electron_1.ipcRenderer.on('island:config-updated', handler);
        return () => electron_1.ipcRenderer.removeListener('island:config-updated', handler);
    },
    onMediaStateChanged: (callback) => {
        const handler = (_event, state) => callback(state);
        electron_1.ipcRenderer.on('media:state-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('media:state-changed', handler);
    },
    onAiStateChanged: (callback) => {
        const handler = (_event, state) => callback(state);
        electron_1.ipcRenderer.on('ai:state-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('ai:state-changed', handler);
    },
    onWeatherUpdated: (callback) => {
        const handler = (_event, weather) => callback(weather);
        electron_1.ipcRenderer.on('weather:updated', handler);
        return () => electron_1.ipcRenderer.removeListener('weather:updated', handler);
    },
    onSystemMetrics: (callback) => {
        const handler = (_event, metrics) => callback(metrics);
        electron_1.ipcRenderer.on('system:metrics', handler);
        return () => electron_1.ipcRenderer.removeListener('system:metrics', handler);
    },
    onGameModeChanged: (callback) => {
        const handler = (_event, state) => callback(state);
        electron_1.ipcRenderer.on('gamemode:state-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('gamemode:state-changed', handler);
    },
    onBatteryStateChanged: (callback) => {
        const handler = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('battery:state-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('battery:state-changed', handler);
    },
    onFocusDistraction: (callback) => {
        const handler = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('focus:distraction', handler);
        return () => electron_1.ipcRenderer.removeListener('focus:distraction', handler);
    },
    snoozeDistraction: (minutes) => electron_1.ipcRenderer.invoke('focus:emergency-override', minutes),
    minimizeDistraction: (pid) => electron_1.ipcRenderer.invoke('focus:minimize', pid),
    getLicenseStatus: () => electron_1.ipcRenderer.invoke('license:get-status')
};
if (process.contextIsolated) {
    electron_1.contextBridge.exposeInMainWorld('roboIsland', api);
}
else {
    window.roboIsland = api;
}
