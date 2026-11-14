/**
 * Automated Island Notification Parity Test Suite
 * Tests TwoCode notification UI, sound melodies, jelly spring animation, rim glow, and Allow/Deny actions.
 * Runs inside Electron to test real Chromium DOM and Canvas.
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

// If not running inside Electron, spawn Electron runner
if (!process.versions.electron) {
  const electronPath = require('electron');
  console.log('[Runner] Spawning Electron runner for scripts/test-island-notification-parity.js...\n');
  const res = spawnSync(electronPath, [__filename], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

const { app, BrowserWindow, ipcMain } = require('electron');

console.log('====================================================');
console.log('     ROBOISLAND NOTIFICATION PARITY TEST SUITE      ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(desc, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}${details ? ` - ${details}` : ''}`);
    failed++;
  }
}

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.whenReady().then(async () => {
  try {
    // Register mock IPC handlers
    const mockConfig = {
      mascotName: 'Robo',
      soundEnabled: true,
      soundPack: 'klassiek',
      islandStyle: 'floating'
    };

    ipcMain.handle('settings:get-config', () => mockConfig);
    ipcMain.handle('island:get-config', () => mockConfig);
    ipcMain.handle('media:get-state', () => ({ active: false, playing: false }));
    ipcMain.handle('media:get-spotify-status', () => ({ available: false }));
    ipcMain.handle('weather:get-data', () => ({ temp: 22, condition: 'Sunny' }));
    ipcMain.handle('ai:get-state', () => ({ status: 'ready' }));
    ipcMain.handle('system:get-volume', () => ({ level: 50, muted: false }));
    ipcMain.handle('system:get-network', () => ({ wifi: { connected: true }, bt: { enabled: true } }));
    ipcMain.handle('ai-monitor:get-history', () => []);
    
    let approvedPayload = null;
    ipcMain.handle('ai:approve', (_e, payload) => {
      approvedPayload = payload;
      return true;
    });

    let lastPostedNotification = null;
    ipcMain.on('island:notify', (_event, payload) => {
      lastPostedNotification = payload;
    });

    // 1. Zero Unicode Emoji Check across touched files
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;
    
    const touchedFiles = [
      path.join(root, 'src', 'main', 'index.ts'),
      path.join(root, 'src', 'preload', 'island-preload.ts'),
      path.join(root, 'src', 'preload', 'settings-preload.ts'),
      path.join(root, 'src', 'renderer', 'island', 'canvas-engine.ts'),
      path.join(root, 'src', 'renderer', 'settings', 'settings.html'),
      path.join(root, 'src', 'renderer', 'settings', 'settings-ui.ts')
    ];

    touchedFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      assert(`Zero unicode emoji in ${path.basename(file)}`, !emojiRegex.test(content));
    });

    // 2. Headless Island Window Test
    const win = new BrowserWindow({
      width: 800,
      height: 400,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(root, 'dist', 'preload', 'island-preload.js')
      }
    });

    await win.loadFile(path.join(root, 'dist', 'renderer', 'island', 'index.html'));

    // Wait slightly for canvas engine initialization
    await new Promise(r => setTimeout(r, 200));

    const result = await win.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        if (!engine) return { error: '__canvasEngine not found on window' };

        const tests = [];

        // Test A: Notification sound melodies exist in AudioSynth
        tests.push({
          desc: 'kickJelly and triggerNotification methods exist',
          passed: typeof engine.kickJelly === 'function' && typeof engine.triggerNotification === 'function'
        });

        // Test B: Notification state color matching
        tests.push({
          desc: 'getNotificationColor returns #22e05a for done',
          passed: engine.getNotificationColor('done') === '#22e05a'
        });
        tests.push({
          desc: 'getNotificationColor returns #ff9a1f for question',
          passed: engine.getNotificationColor('question') === '#ff9a1f'
        });
        tests.push({
          desc: 'getNotificationColor returns #ff3b3b for error',
          passed: engine.getNotificationColor('error') === '#ff3b3b'
        });
        tests.push({
          desc: 'getNotificationColor returns #00d2ff for info/pop',
          passed: engine.getNotificationColor('info') === '#00d2ff' && engine.getNotificationColor('pop') === '#00d2ff'
        });
        tests.push({
          desc: 'getNotificationColor returns #bf5af2 for badge',
          passed: engine.getNotificationColor('badge') === '#bf5af2'
        });

        // Test C: Triggering Action Notification (Allow / Deny)
        engine.triggerNotification({
          id: 'test-perm-1',
          title: 'npm install test',
          body: 'Permission prompt',
          kind: 'question',
          sessionId: 'session-xyz',
          actions: [
            { id: 'deny', label: 'Deny', primary: false },
            { id: 'allow', label: 'Allow', primary: true }
          ]
        });

        tests.push({
          desc: 'isNotificationActive is true after triggerNotification',
          passed: engine.isNotificationActive() === true
        });

        tests.push({
          desc: 'Island expands to 430px targetWidth for action notification',
          passed: engine.targetWidth === 430
        });

        tests.push({
          desc: 'Spring jelly kick recorded in engine.kicks',
          passed: engine.kicks.length > 0
        });

        // Test D: Render notification frame and verify hit targets
        engine.currentWidth = 430;
        engine.currentHeight = 36;
        engine.drawNotificationContent(200, 20, 2);

        tests.push({
          desc: 'Interactive cAllow hit rect registered',
          passed: Boolean(engine.notificationHits['cAllow'] && engine.notificationHits['cAllow'].width === 76)
        });

        tests.push({
          desc: 'Interactive cDeny hit rect registered',
          passed: Boolean(engine.notificationHits['cDeny'] && engine.notificationHits['cDeny'].width === 76)
        });

        // Test E: Clicking Allow action triggers resolution and clears notification
        const allowRect = engine.notificationHits['cAllow'];
        engine.handleClick(allowRect.x + 10, allowRect.y + 10);

        tests.push({
          desc: 'Notification is cleared after Allow click',
          passed: engine.isNotificationActive() === false
        });

        // Test F: Standard Done Notification with Auto-dismiss
        engine.triggerNotification({
          id: 'test-done-1',
          title: 'Task Finished',
          body: 'All features built',
          kind: 'done',
          durationMs: 50
        });

        tests.push({
          desc: 'Target dimensions adapt to standard notification',
          passed: engine.targetWidth >= 260 && engine.targetWidth <= 390
        });

        // Test G: Text truncation helper
        const trunc = engine.truncateText('VeryLongToolExecutionNameThatExceedsBoundaries', 60, '12px sans-serif');
        tests.push({
          desc: 'truncateText appends ellipsis',
          passed: trunc.endsWith('...') && trunc.length < 'VeryLongToolExecutionNameThatExceedsBoundaries'.length
        });

        return { tests };
      })()
    `);

    if (result.error) {
      assert('Execute JavaScript in Island Window', false, result.error);
    } else {
      result.tests.forEach(t => {
        assert(t.desc, t.passed);
      });
    }

    // Wait slightly for IPC promise
    await new Promise(r => setTimeout(r, 100));
    assert('Clicking Allow invokes aiApprove IPC with sessionId "session-xyz" and true', 
      Boolean(approvedPayload && approvedPayload.sessionId === 'session-xyz' && approvedPayload.approved === true));

    win.destroy();

    // 3. Settings UI Notification Buttons Check
    const settingsWin = new BrowserWindow({
      width: 900,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(root, 'dist', 'preload', 'settings-preload.js')
      }
    });

    await settingsWin.loadFile(path.join(root, 'dist', 'renderer', 'settings', 'settings.html'));

    const settingsResult = await settingsWin.webContents.executeJavaScript(`
      (() => {
        const btnDone = document.getElementById('btn-test-notification');
        const btnQuestion = document.getElementById('btn-test-question-notification');
        
        btnDone?.click();
        btnQuestion?.click();

        return {
          btnDoneExists: Boolean(btnDone),
          btnDoneText: btnDone?.textContent?.trim(),
          btnQuestionExists: Boolean(btnQuestion),
          btnQuestionText: btnQuestion?.textContent?.trim(),
          hasPostNotification: typeof window.settingsApi?.postNotification === 'function'
        };
      })()
    `);

    assert('Settings UI has #btn-test-notification', settingsResult.btnDoneExists);
    assert('Settings UI #btn-test-notification text is "Test Done" or "Triggered!"', settingsResult.btnDoneText === 'Test Done' || settingsResult.btnDoneText === 'Triggered!');
    assert('Settings UI has #btn-test-question-notification', settingsResult.btnQuestionExists);
    assert('Settings UI #btn-test-question-notification text is "Test Question" or "Triggered!"', settingsResult.btnQuestionText === 'Test Question' || settingsResult.btnQuestionText === 'Triggered!');
    assert('settingsApi.postNotification is exposed in preload', settingsResult.hasPostNotification);
    assert('Clicking notification button invokes settingsApi.postNotification', lastPostedNotification !== null);

    settingsWin.destroy();

    console.log('\n----------------------------------------------------');
    console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('----------------------------------------------------\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
});
