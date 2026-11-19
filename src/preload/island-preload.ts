import { contextBridge, ipcRenderer, webUtils } from 'electron';

const api = {
  // Island Geometry & Interactivity
  setInteractive: (interactive: boolean) => {
    ipcRenderer.send('island:set-interactive', interactive);
  },
  updateCapsuleBounds: (bounds: { width: number; height: number; topY: number; isSplit?: boolean; splitSpan?: number }) => {
    ipcRenderer.send('island:capsule-bounds', bounds);
  },
  focusWindow: () => {
    ipcRenderer.send('island:focus');
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

  // AI Chat API (OpenAI, Claude, Custom, Ollama, Robo Vision, Document/PDF Reader)
  captureScreen: () => ipcRenderer.invoke('ai-chat:capture-screen'),
  sendAIChatPrompt: (provider: 'openai' | 'anthropic' | 'custom' | 'ollama' | 'gemini' | string, prompt: string, model?: string, imageData?: string, fileText?: string) =>
    ipcRenderer.invoke('ai-chat:send-prompt', { provider, prompt, model, imageData, fileText }),
  readChatFile: (filePath: string) => ipcRenderer.invoke('ai-chat:read-file', filePath),
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
  onDownloadsUpdate: (callback: (data: { count: number; downloads: any[] }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('island:downloads-update', handler);
    return () => ipcRenderer.removeListener('island:downloads-update', handler);
  },
  getActiveDownloads: () => ipcRenderer.invoke('downloads:get-active'),
  simulateDownloads: (count: number = 2) => ipcRenderer.invoke('system:simulate-downloads', count),
  postNotification: (payload: any) => {
    ipcRenderer.send('island:notify', payload);
  },
  getUserName: () => ipcRenderer.invoke('system:get-username'),
  triggerGreeting: (type?: string) => ipcRenderer.send('island:trigger-greeting', type),
  onTriggerGreeting: (callback: (type?: string) => void) => {
    const handler = (_event: any, type: any) => callback(type);
    ipcRenderer.on('island:trigger-greeting', handler);
    return () => ipcRenderer.removeListener('island:trigger-greeting', handler);
  },
  replyWhatsApp: (payload: { contact?: string; phone?: string; tag?: string; text: string }) =>
    ipcRenderer.invoke('whatsapp:reply', payload),
  reactWhatsApp: (payload: { contact?: string; emoji: string }) =>
    ipcRenderer.invoke('whatsapp:react', payload),
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
  getLicenseStatus: () => ipcRenderer.invoke('license:get-status'),
  getSystemVitals: () => ipcRenderer.invoke('diagnostics:get-vitals'),
  optimizeMemory: () => ipcRenderer.invoke('diagnostics:optimize-memory'),
  cleanJunkFiles: () => ipcRenderer.invoke('diagnostics:clean-junk'),
  analyzeScreen: (customPrompt?: string) => ipcRenderer.invoke('diagnostics:analyze-screen', customPrompt),
  dispatchDiagnosticsAction: (actionId: string) => {
    ipcRenderer.send('diagnostics:action', { actionId });
  },
  onVisionQuery: (callback: (data: { prompt: string; dataUrl: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('chat:inject-vision-query', handler);
    return () => ipcRenderer.removeListener('chat:inject-vision-query', handler);
  },

  // Sports API (Cricket, Football, F1)
  sports: {
    getState: () => ipcRenderer.invoke('sports:get-state'),
    toggleSport: (sport?: 'cricket' | 'football' | 'f1') => ipcRenderer.invoke('sports:toggle-match', sport),
    setMode: (mode: 'live' | 'simulated') => ipcRenderer.invoke('sports:set-mode', mode),
    stepSimulation: () => ipcRenderer.invoke('sports:step-simulation'),
    onSportsUpdate: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('island:sports-update', handler);
      return () => ipcRenderer.removeListener('island:sports-update', handler);
    }
  },
  getSportsState: () => ipcRenderer.invoke('sports:get-state'),
  toggleSport: (sport?: 'cricket' | 'football' | 'f1') => ipcRenderer.invoke('sports:toggle-match', sport),
  setSportsMode: (mode: 'live' | 'simulated') => ipcRenderer.invoke('sports:set-mode', mode),
  stepSportsSimulation: () => ipcRenderer.invoke('sports:step-simulation'),
  onSportsUpdate: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('island:sports-update', handler);
    return () => ipcRenderer.removeListener('island:sports-update', handler);
  },

  // Universal Spotlight / Raycast Launcher API (R2)
  launcher: {
    query: (query: string) => ipcRenderer.invoke('launcher:query', { query }),
    launch: (target: string, type: 'app' | 'file' | 'url' = 'app') => ipcRenderer.invoke('launcher:launch', { target, type }),
    hide: () => ipcRenderer.send('launcher:hide'),
    toggle: () => ipcRenderer.send('island:toggle-launcher'),
    setActive: (active: boolean) => ipcRenderer.send('island:set-launcher-active', Boolean(active)),
    onToggleLauncher: (callback: (forceState?: boolean) => void) => {
      const handler = (_event: any, state?: boolean) => callback(state);
      ipcRenderer.on('island:toggle-launcher', handler);
      return () => ipcRenderer.removeListener('island:toggle-launcher', handler);
    }
  },
  queryLauncher: (query: string) => ipcRenderer.invoke('launcher:query', { query }),
  launchLauncherItem: (target: string, type: 'app' | 'file' | 'url' = 'app') => ipcRenderer.invoke('launcher:launch', { target, type }),
  hideLauncher: () => ipcRenderer.send('launcher:hide'),
  toggleLauncher: () => ipcRenderer.send('island:toggle-launcher'),
  onToggleLauncher: (callback: (forceState?: boolean) => void) => {
    const handler = (_event: any, state?: boolean) => callback(state);
    ipcRenderer.on('island:toggle-launcher', handler);
    return () => ipcRenderer.removeListener('island:toggle-launcher', handler);
  },

  // Ambient Screen Glance & Error Fixer API (R3)
  screenGlance: {
    checkErrors: (text?: string) => ipcRenderer.invoke('screen-glance:check-errors', text),
    applyFix: (fixId: string) => ipcRenderer.invoke('screen-glance:apply-fix', { fixId }),
    summarizeActive: (context?: { text?: string; title?: string }) => ipcRenderer.invoke('screen-glance:summarize-active', context),
    getState: () => ipcRenderer.invoke('screen-glance:get-state'),
    clearErrors: () => ipcRenderer.invoke('screen-glance:clear-errors'),
    onGlanceError: (callback: (errors: any[]) => void) => {
      const handler = (_event: any, errors: any) => callback(errors);
      ipcRenderer.on('island:glance-error', handler);
      return () => ipcRenderer.removeListener('island:glance-error', handler);
    },
    onGlanceSummary: (callback: (summary: any) => void) => {
      const handler = (_event: any, summary: any) => callback(summary);
      ipcRenderer.on('island:glance-summary', handler);
      return () => ipcRenderer.removeListener('island:glance-summary', handler);
    }
  },
  checkScreenErrors: (text?: string) => ipcRenderer.invoke('screen-glance:check-errors', text),
  applyScreenFix: (fixId: string) => ipcRenderer.invoke('screen-glance:apply-fix', { fixId }),
  summarizeActiveScreen: (context?: { text?: string; title?: string }) => ipcRenderer.invoke('screen-glance:summarize-active', context),
  getScreenGlanceState: () => ipcRenderer.invoke('screen-glance:get-state'),
  onGlanceError: (callback: (errors: any[]) => void) => {
    const handler = (_event: any, errors: any) => callback(errors);
    ipcRenderer.on('island:glance-error', handler);
    return () => ipcRenderer.removeListener('island:glance-error', handler);
  },
  onGlanceSummary: (callback: (summary: any) => void) => {
    const handler = (_event: any, summary: any) => callback(summary);
    ipcRenderer.on('island:glance-summary', handler);
    return () => ipcRenderer.removeListener('island:glance-summary', handler);
  },

  // WhatsApp AI Smart Replies & Voice Note Reader API (R4)
  whatsapp: {
    getSmartReplies: (message: string, sender?: string) =>
      ipcRenderer.invoke('whatsapp:get-smart-replies', { message, sender }),
    transcribeVoiceNote: (id?: string, duration?: number, context?: string) =>
      ipcRenderer.invoke('whatsapp:transcribe-voice-note', { voiceNoteId: id, durationSeconds: duration, context }),
    simulateIncoming: (payload: { sender: string; body: string; isVoiceNote?: boolean; durationSeconds?: number }) =>
      ipcRenderer.invoke('whatsapp:simulate-incoming', payload),
    onVoiceNoteTranscribed: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('island:whatsapp-voicenote-transcribed', handler);
      return () => ipcRenderer.removeListener('island:whatsapp-voicenote-transcribed', handler);
    },
    onIncomingMessage: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('island:whatsapp-incoming', handler);
      return () => ipcRenderer.removeListener('island:whatsapp-incoming', handler);
    }
  },
  getSmartReplies: (message: string, sender?: string) =>
    ipcRenderer.invoke('whatsapp:get-smart-replies', { message, sender }),
  transcribeVoiceNote: (id?: string, duration?: number, context?: string) =>
    ipcRenderer.invoke('whatsapp:transcribe-voice-note', { voiceNoteId: id, durationSeconds: duration, context }),
  simulateIncomingMessage: (payload: any) =>
    ipcRenderer.invoke('whatsapp:simulate-incoming', payload),
  onVoiceNoteTranscribed: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('island:whatsapp-voicenote-transcribed', handler);
    return () => ipcRenderer.removeListener('island:whatsapp-voicenote-transcribed', handler);
  },
  sendWhatsAppReply: (payload: { contact?: string; phone?: string; tag?: string; text: string }) =>
    ipcRenderer.invoke('whatsapp:reply', payload),

  // AirPods / Bluetooth Battery & Device HUD API (R5)
  bluetooth: {
    getDevices: () => ipcRenderer.invoke('bluetooth:get-devices'),
    simulateEvent: (event: any) => ipcRenderer.invoke('bluetooth:simulate-event', event),
    onHudEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('island:bluetooth-hud', handler);
      return () => ipcRenderer.removeListener('island:bluetooth-hud', handler);
    }
  },
  getBluetoothDevices: () => ipcRenderer.invoke('bluetooth:get-devices'),
  simulateBluetoothEvent: (event: any) => ipcRenderer.invoke('bluetooth:simulate-event', event),
  onBluetoothHudEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('island:bluetooth-hud', handler);
    return () => ipcRenderer.removeListener('island:bluetooth-hud', handler);
  },

  // Full Hands-Free Voice Companion Mode (Jarvis Voice) API (R6)
  voice: {
    startListening: () => ipcRenderer.invoke('voice:start-listening'),
    stopListening: () => ipcRenderer.invoke('voice:stop-listening'),
    toggle: () => ipcRenderer.invoke('voice:toggle'),
    processCommand: (text: string) => ipcRenderer.invoke('voice:process-command', { text }),
    speak: (text: string) => ipcRenderer.invoke('voice:speak', { text }),
    stopSpeaking: () => ipcRenderer.invoke('voice:stop-speaking'),
    getState: () => ipcRenderer.invoke('voice:get-state'),
    onVoiceState: (callback: (event: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('island:voice-state', handler);
      return () => ipcRenderer.removeListener('island:voice-state', handler);
    }
  },
  startVoiceListening: () => ipcRenderer.invoke('voice:start-listening'),
  stopVoiceListening: () => ipcRenderer.invoke('voice:stop-listening'),
  toggleVoice: () => ipcRenderer.invoke('voice:toggle'),
  processVoiceCommand: (text: string) => ipcRenderer.invoke('voice:process-command', { text }),
  speakVoice: (text: string) => ipcRenderer.invoke('voice:speak', { text }),
  stopVoiceSpeaking: () => ipcRenderer.invoke('voice:stop-speaking'),
  onVoiceState: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('island:voice-state', handler);
    return () => ipcRenderer.removeListener('island:voice-state', handler);
  }
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('roboIsland', api);
  contextBridge.exposeInMainWorld('island', api);
  contextBridge.exposeInMainWorld('islandAPI', api);
} else {
  (window as any).roboIsland = api;
  (window as any).island = api;
  (window as any).islandAPI = api;
}
export type RoboIslandApi = typeof api;
