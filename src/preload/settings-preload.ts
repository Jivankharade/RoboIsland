import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('settingsApi', {
  getConfig: () => ipcRenderer.invoke('settings:get-config'),
  updateConfig: (partial: any) => ipcRenderer.invoke('settings:update-config', partial),
  onGotoTab: (callback: (tab: string) => void) => {
    ipcRenderer.on('settings:goto-tab', (_event, tab) => callback(tab));
  },
  openExternal: (url: string) => ipcRenderer.invoke('system:open-external', url),
  toggleIsland: () => ipcRenderer.send('island:toggle-expand'),
  testFocusGuard: () => ipcRenderer.send('focus-guard:test'),
  testVolumeHud: (level = 65, muted = false) => ipcRenderer.send('system:test-volume-pop', { level, muted }),
  testChargerSurge: (charging = true, level = 85) => ipcRenderer.send('system:test-charger-surge', { charging, level }),
  testSpeedometerHud: () => ipcRenderer.send('system:test-speedometer-hud'),
  postNotification: (payload: any) => ipcRenderer.send('island:notify', payload),

  // Media
  getMediaState: () => ipcRenderer.invoke('media:get-state'),
  mediaControl: (action: string) => ipcRenderer.invoke('media:control', action),
  onMediaStateChanged: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on('media:state-changed', handler);
    return () => ipcRenderer.removeListener('media:state-changed', handler);
  },

  // System Volume
  getVolume: () => ipcRenderer.invoke('system:get-volume'),
  setVolume: (level: number) => ipcRenderer.invoke('system:set-volume', level),
  setMute: (muted: boolean) => ipcRenderer.invoke('system:set-mute', muted),
  onVolumeChanged: (callback: (vol: any) => void) => {
    const handler = (_event: any, vol: any) => callback(vol);
    ipcRenderer.on('system:volume-changed', handler);
    return () => ipcRenderer.removeListener('system:volume-changed', handler);
  },

  // System Radios (Wi-Fi & Bluetooth)
  getNetwork: () => ipcRenderer.invoke('system:get-network'),
  setRadio: (kind: 'wifi' | 'bt', on: boolean) => ipcRenderer.invoke('system:set-radio', kind, on),
  onNetworkChanged: (callback: (net: any) => void) => {
    const handler = (_event: any, net: any) => callback(net);
    ipcRenderer.on('system:network-changed', handler);
    return () => ipcRenderer.removeListener('system:network-changed', handler);
  },

  // Pro Licensing & Owner Creator Hub
  getLicenseStatus: () => ipcRenderer.invoke('license:get-status'),
  activateLicense: (key: string) => ipcRenderer.invoke('license:activate', key),
  generateCustomerKey: (customer: string) => ipcRenderer.invoke('license:generate-key', customer),

  // AI & Autonomous Diagnostics
  saveAICredential: (provider: string, apiKey: string, baseUrl?: string, model?: string) =>
    ipcRenderer.invoke('ai-chat:save-credential', { provider, apiKey, baseUrl, model }),
  getAICredentialStatus: () => ipcRenderer.invoke('ai-chat:get-status'),
  optimizeMemory: () => ipcRenderer.invoke('diagnostics:optimize-memory')
});
