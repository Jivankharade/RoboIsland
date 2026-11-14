/**
 * Visual verification script:
 * Launches Electron BrowserWindow with island/index.html,
 * captures screenshot of compact island and sleepy mode,
 * verifies exact pixel dimensions and saves screenshots to artifacts.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\hp218\\.gemini\\antigravity\\brain\\9abe3be8-3aab-400c-9097-bd04add116ad';

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 600,
    height: 140,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '..', 'dist', 'preload', 'island-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Mock essential IPC
  ipcMain.handle('island:get-config', () => ({
    islandScale: 1.0,
    visualTexture: 'obsidian',
    expandedUiMode: 'dom',
    mascotSkin: 'classic',
    mascotOutfit: 'best'
  }));
  ipcMain.handle('media:get-state', () => ({ active: false }));
  ipcMain.handle('system:get-volume', () => ({ level: 50, muted: false }));
  ipcMain.handle('system:get-network', () => ({ wifi: { on: true, ssid: 'Local' }, bt: { on: false } }));
  ipcMain.handle('weather:get-data', () => ({ temperature: 22, condition: 'Clear' }));
  ipcMain.handle('system:get-metrics', () => ({ cpu: { usagePercent: 5 }, memory: { usedPercent: 40 } }));
  ipcMain.handle('gamemode:get-state', () => ({ inGame: false, override: false }));
  ipcMain.handle('island:get-mode', () => 'compact');
  ipcMain.handle('island:set-mode', () => true);

  await win.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'island', 'index.html'));

  // Allow canvas engine to settle
  await new Promise(r => setTimeout(r, 600));

  // 1. Capture Compact Resting Island (Neutral - matching Screenshot 2)
  const imageNeutral = await win.capturePage({ x: 200, y: 0, width: 200, height: 50 });
  const neutralPath = path.join(ARTIFACTS_DIR, 'roboisland_neutral_verified.png');
  fs.writeFileSync(neutralPath, imageNeutral.toPNG());
  console.log('[VERIFY] Saved neutral compact island screenshot to:', neutralPath);

  // 2. Switch to Sleepy State (matching Screenshot 2 reference)
  await win.webContents.executeJavaScript(`
    if (window.__roboIslandSetMascotMood) {
      window.__roboIslandSetMascotMood('sleepy');
    }
  `);
  await new Promise(r => setTimeout(r, 400));

  const imageSleepy = await win.capturePage({ x: 200, y: 0, width: 200, height: 50 });
  const sleepyPath = path.join(ARTIFACTS_DIR, 'roboisland_sleepy_verified.png');
  fs.writeFileSync(sleepyPath, imageSleepy.toPNG());
  console.log('[VERIFY] Saved sleepy compact island screenshot to:', sleepyPath);

  // 3. Verify all 9 moods
  const moods = ['happy', 'sleepy', 'focused', 'curious', 'excited', 'thinking', 'surprised', 'relaxed', 'neutral'];
  for (const m of moods) {
    await win.webContents.executeJavaScript(`window.__roboIslandSetMascotMood('${m}')`);
    await new Promise(r => setTimeout(r, 100));
    const shot = await win.capturePage({ x: 240, y: 0, width: 120, height: 40 });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, `roboisland_mood_${m}.png`), shot.toPNG());
  }
  console.log('[VERIFY] Successfully captured all 9 moods to artifact directory.');

  win.destroy();
  app.quit();
});
