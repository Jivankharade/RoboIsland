const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

console.log('[SmokeTest] Initializing Electron headless smoke test...');

app.whenReady().then(async () => {
  try {
    console.log('[SmokeTest] Electron app ready. Loading Island window...');
    const win = new BrowserWindow({
      width: 860,
      height: 340,
      show: false,
      frame: false,
      transparent: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[Renderer Console] ${message}`);
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`[SmokeTest FAIL] Failed to load: ${errorDescription} (${errorCode})`);
      process.exit(1);
    });

    win.webContents.on('crashed', () => {
      console.error('[SmokeTest FAIL] WebContents crashed!');
      process.exit(1);
    });

    const indexPath = path.join(__dirname, '..', 'dist', 'renderer', 'island', 'index.html');
    await win.loadFile(indexPath);
    console.log('[SmokeTest PASS] Island index.html loaded successfully!');

    // Check DOM overlay element existence inside renderer
    const islandChecks = await win.webContents.executeJavaScript(`
      ({
        hasOverlay: Boolean(document.getElementById('expanded-island-overlay') && document.getElementById('island-canvas')),
        hasEyeSlot: Boolean(document.getElementById('mascot-eye-slot')),
        hasContextMenu: Boolean(document.getElementById('island-context-menu')),
        hasChatPanel: Boolean(document.getElementById('panel-chat')),
        hasTrayShelf: Boolean(document.getElementById('tray-files-shelf')),
        hasQrCard: Boolean(document.getElementById('tray-qr-container')),
        hasZeroEmojis: !/[\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}]/u.test(document.body.innerHTML)
      })
    `);
    console.log('[SmokeTest] Island DOM Checks:', JSON.stringify(islandChecks, null, 2));
    if (!islandChecks.hasOverlay || !islandChecks.hasEyeSlot || !islandChecks.hasContextMenu || !islandChecks.hasChatPanel) {
      console.error('[SmokeTest FAIL] Island DOM checks failed!');
      process.exit(1);
    }

    // Check Settings window load
    console.log('[SmokeTest] Loading Settings window...');
    const settingsWin = new BrowserWindow({
      width: 780,
      height: 520,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const settingsPath = path.join(__dirname, '..', 'dist', 'renderer', 'settings', 'settings.html');
    await settingsWin.loadFile(settingsPath);
    console.log('[SmokeTest PASS] Settings settings.html loaded successfully!');

    const settingsChecks = await settingsWin.webContents.executeJavaScript(`
      ({
        hasRoboTab: Boolean(document.getElementById('pane-karakter')),
        hasWardrobeTab: Boolean(document.getElementById('pane-wardrobe')),
        hasZeroEmojis: !/[\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}]/u.test(document.body.innerHTML)
      })
    `);
    console.log('[SmokeTest] Settings Checks:', JSON.stringify(settingsChecks, null, 2));
    if (!settingsChecks.hasRoboTab || !settingsChecks.hasWardrobeTab) {
      console.error('[SmokeTest FAIL] Missing Robo or Wardrobe tabs in Settings!');
      process.exit(1);
    }

    console.log('[SmokeTest SUCCESS] All Electron windows loaded without error!');
    setTimeout(() => {
      win.destroy();
      settingsWin.destroy();
      app.quit();
      process.exit(0);
    }, 1000);
  } catch (err) {
    console.error('[SmokeTest EXCEPTION]', err);
    process.exit(1);
  }
});
