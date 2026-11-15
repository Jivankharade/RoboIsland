import { contextBridge, ipcRenderer, webUtils } from 'electron';

const api = {
  // Island Geometry & Interactivity
  setInteractive: (interactive: boolean) => {
    ipcRenderer.send('island:set-interactive', interactive);
  },
  setIslandMode: (mode: 'rest' | 'compact' | 'expanded') => ipcRenderer.invoke('island:set-mode', mode),
  getIslandMode: () => ipcRenderer.invoke('island:get-mode'),
  getModeBounds: (mode: 'rest' | 'compact' | 'expanded') => ipcRenderer.invoke('island:get-mode-bounds', mode),
  notifyModeChanged: (mode: 'rest' | 'compact' | 'expanded') => ipcRenderer.send('island:mode-changed', mode),
  toggleTuck: () => {
    ipcRenderer.send('island:toggle-tuck');
  },
  setTucked: (tucked: boolean) => {
    ipcRenderer.send('island:set-tucked', Boolean(tucked));
  },
  getConfig: () => ipcRenderer.invoke('island:get-config'),
  updateConfig: (partial: any) => ipcRenderer.invoke('island:update-config', partial),
  getDisplays: () => ipcRenderer.invoke('island:get-displays'),
  setDisplay: (displayId: string) => ipcRenderer.invoke('island:set-display', displayId),
  openSettings: (tab?: string) => ipcRenderer.send('settings:open', tab),
  hideIsland: () => ipcRenderer.send('island:hide'),
  showCompact: () => ipcRenderer.send('island:show-compact'),
  quit: () => ipcRenderer.send('island:quit'),
  setWindowOpacity: (opacity: number) => ipcRenderer.invoke('island:set-opacity', opacity),

  // Weather & System Metrics API
  getWeatherData: () => ipcRenderer.invoke('weather:get-data'),
  refreshWeather: (lat?: number, lon?: number, city?: string) => ipcRenderer.invoke('weather:refresh', lat, lon, city),
  getSystemMetrics: () => ipcRenderer.invoke('system:get-metrics'),
  getGameModeState: () => ipcRenderer.invoke('gamemode:get-state'),
  setGameModeEnabled: (enabled: boolean) => ipcRenderer.invoke('gamemode:set-enabled', enabled),
  toggleGameModeOverride: () => ipcRenderer.invoke('gamemode:toggle-override'),

  // Media API (SMTC & Spotify)
  getMediaState: () => ipcRenderer.invoke('media:get-state'),
  mediaControl: (action: string) => ipcRenderer.invoke('media:control', action),
  mediaPlayPause: () => ipcRenderer.invoke('media:play-pause'),
  mediaNext: () => ipcRenderer.invoke('media:next'),
  mediaPrev: () => ipcRenderer.invoke('media:prev'),
  mediaSeek: (positionMs: number) => ipcRenderer.invoke('media:seek', positionMs),
  connectSpotifyPKCE: () => ipcRenderer.invoke('media:connect-spotify'),
  disconnectSpotify: () => ipcRenderer.invoke('media:disconnect-spotify'),
  getSpotifyStatus: () => ipcRenderer.invoke('media:get-spotify-status'),
  getSpotifyDevices: () => ipcRenderer.invoke('media:spotify-devices'),
  transferSpotifyPlayback: (deviceId: string) => ipcRenderer.invoke('media:spotify-transfer', deviceId),
  getLyrics: (query: { title: string; artist: string; duration?: number }) => ipcRenderer.invoke('media:get-lyrics', query),

  // System Controls (Volume & Network)
  getVolume: () => ipcRenderer.invoke('system:get-volume'),
  setVolume: (level: number) => ipcRenderer.invoke('system:set-volume', level),
  setMute: (muted: boolean) => ipcRenderer.invoke('system:set-mute', muted),
  getNetwork: () => ipcRenderer.invoke('system:get-network'),
  setRadio: (kind: 'wifi' | 'bt', on: boolean) => ipcRenderer.invoke('system:set-radio', kind, on),
  openExternal: (url: string) => ipcRenderer.invoke('system:open-external', url),
  onVolumeChanged: (callback: (vol: any) => void) => {
    const handler = (_event: any, vol: any) => callback(vol);
    ipcRenderer.on('system:volume-changed', handler);
    return () => ipcRenderer.removeListener('system:volume-changed', handler);
  },
  onNetworkChanged: (callback: (net: any) => void) => {
    const handler = (_event: any, net: any) => callback(net);
    ipcRenderer.on('system:network-changed', handler);
    return () => ipcRenderer.removeListener('system:network-changed', handler);
  },

  // AI Monitor API (Claude Code & Codex)
  getAiState: () => ipcRenderer.invoke('ai:get-state'),
  aiApprove: (sessionId: string, approved: boolean) => ipcRenderer.invoke('ai:approve', { sessionId, approved }),
  aiReply: (sessionId: string, text: string) => ipcRenderer.invoke('ai:reply', { sessionId, text }),
  onAIMonitorEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('ai-monitor:event', handler);
    return () => ipcRenderer.removeListener('ai-monitor:event', handler);
  },
  getAIMonitorHistory: () => ipcRenderer.invoke('ai-monitor:get-history'),
  controlAIAgent: (action: 'stop' | 'pause' | 'allow' | 'deny') => ipcRenderer.invoke('ai-monitor:control', action),

  // AI Chat API (OpenAI, Claude, Custom, Ollama, Robo Vision)
  captureScreen: () => ipcRenderer.invoke('ai-chat:capture-screen'),
  sendAIChatPrompt: (provider: 'openai' | 'anthropic' | 'custom' | 'ollama', prompt: string, model?: string, imageData?: string) =>
    ipcRenderer.invoke('ai-chat:send-prompt', { provider, prompt, model, imageData }),
  onAIChatChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: any, chunk: string) => callback(chunk);
    ipcRenderer.on('ai-chat:chunk', handler);
    return () => ipcRenderer.removeListener('ai-chat:chunk', handler);
  },
  onAIChatDone: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('ai-chat:done', handler);
    return () => ipcRenderer.removeListener('ai-chat:done', handler);
  },
  saveAICredentials: (provider: string, apiKey: string, baseUrl?: string, model?: string) =>
    ipcRenderer.invoke('ai-chat:save-credentials', { provider, apiKey, baseUrl, model }),
  getAICredentialStatus: () => ipcRenderer.invoke('ai-chat:get-credential-status'),
  getOllamaModels: () => ipcRenderer.invoke('ai-chat:get-ollama-models'),
  triggerVoiceTyping: () => ipcRenderer.invoke('ai-chat:voice-typing'),
  speakTTS: (text: string) => ipcRenderer.invoke('ai-chat:speak-tts', text),

  // Buddy & Productivity API
  buddyGrab: (info?: any) => ipcRenderer.send('buddy:grab', info),
  buddyDrop: () => ipcRenderer.send('buddy:drop'),
  onBuddyHome: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('buddy:home', handler);
    return () => ipcRenderer.removeListener('buddy:home', handler);
  },
  trayGetFiles: () => ipcRenderer.invoke('tools:tray-get'),
  trayAddFiles: (paths: string[]) => ipcRenderer.invoke('tools:tray-add', paths),
  trayBrowseFiles: () => ipcRenderer.invoke('tools:tray-browse'),
  trayRemoveFile: (idx: number) => ipcRenderer.invoke('tools:tray-remove', idx),
  trayClearFiles: () => ipcRenderer.invoke('tools:tray-clear'),
  setDropActiveFile: (filePath: string | null) => ipcRenderer.invoke('tools:drop-set-active', filePath),
  setDragging: (dragging: boolean) => ipcRenderer.send('island:set-dragging', dragging),
  startDragOut: (filePath: string) => ipcRenderer.send('tools:tray-drag-out', filePath),
  convertFile: (filePath: string, targetFormat: string) => ipcRenderer.invoke('tools:convert-file', { filePath, targetFormat }),
  getFilePreviewData: (filePath: string) => ipcRenderer.invoke('tools:file-preview-data', filePath),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('tools:show-item-in-folder', filePath),
  openPath: (filePath: string) => ipcRenderer.invoke('tools:open-path', filePath),
  getClipboardHistory: () => ipcRenderer.invoke('tools:clipboard-get'),
  copyClipboardItem: (item: any) => ipcRenderer.invoke('tools:clipboard-copy', item),
  deleteClipboardItem: (id: string) => ipcRenderer.invoke('tools:clipboard-delete', id),
  clearClipboardHistory: () => ipcRenderer.invoke('tools:clipboard-clear'),
  startClipboardDragOut: (filePath: string) => ipcRenderer.send('tools:clipboard-drag-out', filePath),
  onClipboardUpdated: (callback: (history: any[]) => void) => {
    const handler = (_event: any, history: any[]) => callback(history);
    ipcRenderer.on('tools:clipboard-updated', handler);
    return () => ipcRenderer.removeListener('tools:clipboard-updated', handler);
  },
  saveNote: (text: string) => ipcRenderer.invoke('tools:note-save', text),
  getNote: () => ipcRenderer.invoke('tools:note-get'),
  getDropInfo: () => ipcRenderer.invoke('tools:drop-info'),
  getPathForFile: (file: File): string => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch {
      // Fallback
    }
    return (file as any)?.path || '';
  },
  onTransferActive: (callback: (data: {
    type: 'download' | 'upload' | 'progress' | 'connected' | 'error';
    direction?: 'download' | 'upload';
    name?: string;
    files?: string[];
    transferred?: number;
    total?: number;
    percent?: number;
  }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('tools:transfer-active', handler);
    return () => ipcRenderer.removeListener('tools:transfer-active', handler);
  },

  // Event Subscriptions
  onPointer: (callback: (pt: { x: number; y: number; insideWindow: boolean }) => void) => {
    const handler = (_event: any, pt: any) => callback(pt);
    ipcRenderer.on('companion:pointer', handler);
    return () => ipcRenderer.removeListener('companion:pointer', handler);
  },
  onToggleExpand: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('island:toggle-expand', handler);
    return () => ipcRenderer.removeListener('island:toggle-expand', handler);
  },
  showSpeedometerHud: () => ipcRenderer.send('island:show-speedometer-hud'),
  onShowSpeedometerHud: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('island:show-speedometer-hud', handler);
    return () => ipcRenderer.removeListener('island:show-speedometer-hud', handler);
  },
  onNotification: (callback: (payload: any) => void) => {
    const handler = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on('island:notify', handler);
    return () => ipcRenderer.removeListener('island:notify', handler);
  },
  postNotification: (payload: any) => {
    ipcRenderer.send('island:notify', payload);
  },
  replyWhatsApp: (payload: { contact?: string; text: string }) =>
    ipcRenderer.invoke('whatsapp:reply', payload),
  onCollapseRequested: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('island:request-collapse', handler);
    return () => ipcRenderer.removeListener('island:request-collapse', handler);
  },
  onCollapse: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('island:collapse', handler);
    return () => ipcRenderer.removeListener('island:collapse', handler);
  },
  onTuckedState: (callback: (tucked: boolean) => void) => {
    const handler = (_event: any, tucked: boolean) => callback(tucked);
    ipcRenderer.on('island:tucked-state', handler);
    return () => ipcRenderer.removeListener('island:tucked-state', handler);
  },
  onModeChanged: (callback: (mode: 'rest' | 'compact' | 'expanded') => void) => {
    const handler = (_event: any, mode: any) => callback(mode);
    ipcRenderer.on('island:set-mode', handler);
    return () => ipcRenderer.removeListener('island:set-mode', handler);
  },
  onConfigUpdated: (callback: (config: any) => void) => {
    const handler = (_event: any, cfg: any) => callback(cfg);
    ipcRenderer.on('island:config-updated', handler);
    return () => ipcRenderer.removeListener('island:config-updated', handler);
  },
  onMediaStateChanged: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on('media:state-changed', handler);
    return () => ipcRenderer.removeListener('media:state-changed', handler);
  },
  onAiStateChanged: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on('ai:state-changed', handler);
    return () => ipcRenderer.removeListener('ai:state-changed', handler);
  },
  onWeatherUpdated: (callback: (weather: any) => void) => {
    const handler = (_event: any, weather: any) => callback(weather);
    ipcRenderer.on('weather:updated', handler);
    return () => ipcRenderer.removeListener('weather:updated', handler);
  },
  onSystemMetrics: (callback: (metrics: any) => void) => {
    const handler = (_event: any, metrics: any) => callback(metrics);
    ipcRenderer.on('system:metrics', handler);
    return () => ipcRenderer.removeListener('system:metrics', handler);
  },
  onGameModeChanged: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on('gamemode:state-changed', handler);
    return () => ipcRenderer.removeListener('gamemode:state-changed', handler);
  },
  onBatteryStateChanged: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('battery:state-changed', handler);
    return () => ipcRenderer.removeListener('battery:state-changed', handler);
  },
  onFocusDistraction: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('focus:distraction', handler);
    return () => ipcRenderer.removeListener('focus:distraction', handler);
  },
  snoozeDistraction: (minutes?: number) => ipcRenderer.invoke('focus:emergency-override', minutes),
  minimizeDistraction: (pid?: number) => ipcRenderer.invoke('focus:minimize', pid),
  getLicenseStatus: () => ipcRenderer.invoke('license:get-status')
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('roboIsland', api);
} else {
  (window as any).roboIsland = api;
}
export type RoboIslandApi = typeof api;
