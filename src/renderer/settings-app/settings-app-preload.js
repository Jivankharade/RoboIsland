// The settings app (settings-app.html): the island's lists and clicks, the AI choice, our news, and Robo's live face.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('settingsApp', {
  get: req => ipcRenderer.invoke('settings-app:get', req),
  dirty: on => ipcRenderer.send('settings-app:dirty', !!on),
  theme: name => ipcRenderer.send('settings-app:theme', name),
  news: () => ipcRenderer.invoke('settings-app:news'),
  // updates from twocode.nl (auto-update.cjs)
  update: () => ipcRenderer.invoke('update:state'),
  installUpdate: () => ipcRenderer.send('update:install'),
  onUpdate: callback => { const fn = (_e, v) => callback(v); ipcRenderer.on('update:state', fn); return () => ipcRenderer.removeListener('update:state', fn); },
  home: () => ipcRenderer.invoke('settings-app:home'),
  connections: () => ipcRenderer.invoke('settings-app:connections'),
  connect: (id, on) => ipcRenderer.invoke('settings-app:connect', { id, on }),
  // Algemeen → Sneltoetsen: {} = the list, { do: 'set', id, keys }, { do: 'reset' }, { do: 'pause', on }
  shortcuts: req => ipcRenderer.invoke('settings-app:shortcuts', req || {}),
  openUrl: url => ipcRenderer.send('settings-app:open-url', url),
  // Apps → Your links (links-main.cjs)
  links: { get: () => ipcRenderer.invoke('links:get'), set: list => ipcRenderer.invoke('links:set', list) },
  // packs bought on twocode.nl (license-main.cjs)
  license: {
    get: () => ipcRenderer.invoke('license:get'),
    activate: code => ipcRenderer.invoke('license:activate', String(code || '')),
    remove: () => ipcRenderer.invoke('license:remove'),
    buy: app => ipcRenderer.invoke('license:buy', String(app || '')),
    tryFree: email => ipcRenderer.invoke('license:try', String(email || '')),
    trialCode: email => ipcRenderer.invoke('license:trial-code', String(email || '')),
    trialVerify: code => ipcRenderer.invoke('license:trial-verify', String(code || '')),
    claim: () => ipcRenderer.invoke('license:claim'),
    // your account: an e-mail address and a password (beta 50); a new one is confirmed with a link in a mail
    register: (email, password) => ipcRenderer.invoke('license:register', String(email || ''), String(password || '')),
    login: (email, password, replace) => ipcRenderer.invoke('license:login', String(email || ''), String(password || ''), replace === true),
    forgot: email => ipcRenderer.invoke('license:forgot', String(email || '')),
    claimAccount: password => ipcRenderer.invoke('license:claim-account', String(password || '')), // after paying on this PC: only a password
    resend: () => ipcRenderer.invoke('license:resend'),
    cancelWait: () => ipcRenderer.invoke('license:cancel-wait'),
    logout: () => ipcRenderer.invoke('license:logout'),
    demo: kind => ipcRenderer.send('texture:demo', String(kind || 'tour')), // Texture pack: see it on your island
    onChange: callback => { const fn = (_e, v) => callback(v); ipcRenderer.on('license:changed', fn); return () => ipcRenderer.removeListener('license:changed', fn); }
  },
  // AI & Chat: the same settings the project chat and Robo the buddy use (project-mode-main.js)
  ai: {
    get: check => ipcRenderer.invoke('ai-settings:get', { check: check === true }), // check: really ask Codex (can take a moment)
    setProvider: provider => ipcRenderer.invoke('ai-settings:set-provider', provider),
    setKey: (type, key) => ipcRenderer.invoke('ai-settings:set-key', { type, key }),
    clearKey: type => ipcRenderer.invoke('ai-settings:clear-key', type),
    setModel: model => ipcRenderer.invoke('ai-settings:set-model', model),
    test: () => ipcRenderer.invoke('ai-settings:test'),
    chatgptLogin: () => ipcRenderer.invoke('ai-settings:chatgpt-login'),
    chatgptCancel: () => ipcRenderer.invoke('ai-settings:chatgpt-cancel'),
    chatgptLogout: () => ipcRenderer.invoke('ai-settings:chatgpt-logout')
  },
  onGoto: callback => { const fn = (_e, tab) => callback(tab); ipcRenderer.on('settings-app:goto', fn); return () => ipcRenderer.removeListener('settings-app:goto', fn); },
  onFace: callback => { const fn = (_e, url) => callback(url); ipcRenderer.on('settings-app:face', fn); return () => ipcRenderer.removeListener('settings-app:face', fn); }
});
