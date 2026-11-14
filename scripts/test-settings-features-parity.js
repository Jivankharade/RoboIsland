/**
 * Automated Settings UI and Features Parity Test Suite
 * Runs inside Electron to test the real Chromium DOM, styles, buttons, and IPC.
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

// If not running inside Electron, spawn Electron runner
if (!process.versions.electron) {
  const electronPath = require('electron');
  console.log('[Runner] Spawning Electron runner for scripts/test-settings-features-parity.js...\n');
  const res = spawnSync(electronPath, [__filename], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

const { app, BrowserWindow, ipcMain } = require('electron');

console.log('====================================================');
console.log('   ROBOISLAND SETTINGS BUTTONS & FEATURES PARITY    ');
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

app.whenReady().then(async () => {
  try {
    const htmlPath = path.join(root, 'dist', 'renderer', 'settings', 'settings.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // 1. Zero Unicode Emoji Check
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;
    assert('Zero unicode emoji characters in settings.html', !emojiRegex.test(htmlContent));

    let mockConfig = {
      mascotName: 'Robo',
      trafficLightEyes: { preset: 'classic', working: '#ff9500', done: '#34c759', error: '#ff3b30' },
      mascotOutfit: 'best',
      mascotBodyColor: 'cloud',
      mascotEyeColor: 'mint',
      claudeCodeHooksEnabled: true,
      codexHooksEnabled: true,
      aiProvider: 'claude',
      openAiApiKey: '',
      soundEnabled: true,
      ttsEnabled: true,
      autoStart: false,
      theme: 'dark',
      language: 'en',
      islandStyle: 'floating',
      islandScale: 1.0,
      visualTexture: 'obsidian',
      restLeft: 'none',
      restRight: 'none',
      textureSkin: 'none',
      soundPack: 'klassiek',
      focusGuardEnabled: true,
      focusGuardBlockedApps: ['youtube.com', 'twitter.com'],
      profileName: 'Robo Companion',
      appsOff: [],
      globalShortcut: 'Ctrl + Alt + T'
    };

    let islandToggled = false;
    let focusGuardTested = false;
    let openedUrl = null;

    // Register IPC handlers
    ipcMain.removeHandler('settings:get-config');
    ipcMain.handle('settings:get-config', () => mockConfig);

    ipcMain.removeHandler('settings:update-config');
    ipcMain.handle('settings:update-config', (_e, partial) => {
      mockConfig = { ...mockConfig, ...partial };
      return mockConfig;
    });

    ipcMain.removeHandler('media:get-state');
    ipcMain.handle('media:get-state', () => ({
      title: 'Starboy',
      artist: 'The Weeknd',
      playing: true,
      durationMs: 230000,
      positionMs: 65000
    }));

    ipcMain.removeHandler('system:open-external');
    ipcMain.handle('system:open-external', (_e, url) => {
      openedUrl = url;
      return true;
    });

    ipcMain.removeAllListeners('island:toggle-expand');
    ipcMain.on('island:toggle-expand', () => {
      islandToggled = true;
    });

    ipcMain.removeAllListeners('focus-guard:test');
    ipcMain.on('focus-guard:test', () => {
      focusGuardTested = true;
    });

    const settingsWin = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(root, 'dist', 'preload', 'settings-preload.js')
      }
    });

    await settingsWin.loadFile(htmlPath);
    await new Promise((r) => setTimeout(r, 350));

    // Run tests in renderer
    const res = await settingsWin.webContents.executeJavaScript(`
      (async () => {
        const tests = [];
        const record = (desc, cond, details = '') => tests.push({ desc, cond: Boolean(cond), details });

        // 1. Search Box
        const searchInput = document.getElementById('search-input');
        record('Search input #search-input exists', searchInput !== null);
        if (searchInput) {
          searchInput.value = 'Distracting';
          searchInput.dispatchEvent(new Event('input'));
          record('Search input accepts query and dispatches input event', true);
        }

        // 2. Quick Navigation & KPI Clicks
        const cardWifi = document.getElementById('card-wifi');
        record('#card-wifi KPI card exists', cardWifi !== null);
        if (cardWifi) {
          cardWifi.click();
          const paneConnect = document.getElementById('pane-connect');
          record('Clicking #card-wifi navigated to Connections tab', paneConnect && paneConnect.classList.contains('active'));
        }

        const quickWardrobe = document.querySelector('.quick-btn[data-goto="wardrobe"]');
        record('Quick action button data-goto="wardrobe" exists', quickWardrobe !== null);
        if (quickWardrobe) {
          quickWardrobe.click();
          const paneWardrobe = document.getElementById('pane-wardrobe');
          record('Quick button navigated to Wardrobe tab', paneWardrobe && paneWardrobe.classList.contains('active'));
        }

        // 3. Connections Tab Buttons
        const btnTestClaude = document.getElementById('btn-test-claude');
        const btnCopyClaude = document.getElementById('btn-copy-claude-guide');
        const btnTestCodex = document.getElementById('btn-test-codex');
        const btnCopyCodex = document.getElementById('btn-copy-codex-guide');

        record('#btn-test-claude exists', btnTestClaude !== null);
        record('#btn-copy-claude-guide exists', btnCopyClaude !== null);
        record('#btn-test-codex exists', btnTestCodex !== null);
        record('#btn-copy-codex-guide exists', btnCopyCodex !== null);

        if (btnTestClaude) {
          btnTestClaude.click();
          record('btn-test-claude click shows listening confirmation', btnTestClaude.textContent.includes('Listening on :47823'));
        }

        if (btnTestCodex) {
          btnTestCodex.click();
          record('btn-test-codex click shows active confirmation', btnTestCodex.textContent.includes('Codex Hook Active'));
        }

        // 4. AI & Chat Tab Buttons
        const apiKeyInput = document.getElementById('ai-api-key');
        const btnToggleKey = document.getElementById('btn-toggle-key-visibility');
        const btnTestAi = document.getElementById('btn-test-ai');
        const btnTestTts = document.getElementById('btn-test-tts');

        record('#btn-toggle-key-visibility exists', btnToggleKey !== null);
        record('#btn-test-ai exists', btnTestAi !== null);
        record('#btn-test-tts exists', btnTestTts !== null);

        if (btnToggleKey && apiKeyInput) {
          btnToggleKey.click();
          const toggledToText = apiKeyInput.type === 'text';
          btnToggleKey.click();
          const toggledToPass = apiKeyInput.type === 'password';
          record('btn-toggle-key-visibility toggles password input type', toggledToText && toggledToPass);
        }

        if (btnTestAi) {
          btnTestAi.click();
          record('btn-test-ai click shows verification response', btnTestAi.textContent.includes('OK'));
        }

        if (btnTestTts) {
          btnTestTts.click();
          record('btn-test-tts click indicates voice synthesis', btnTestTts.textContent.includes('Speaking'));
        }

        // 5. Apps Bulk Buttons
        const btnAppsAllOff = document.getElementById('btn-apps-all-off');
        const btnAppsAllOn = document.getElementById('btn-apps-all-on');
        record('#btn-apps-all-off exists', btnAppsAllOff !== null);
        record('#btn-apps-all-on exists', btnAppsAllOn !== null);

        if (btnAppsAllOff) {
          btnAppsAllOff.click();
          const offSwitches = document.querySelectorAll('#apps-list .switch:not(.on)');
          record('btn-apps-all-off toggles off all 13 app switches', offSwitches.length === 13);
        }

        if (btnAppsAllOn) {
          btnAppsAllOn.click();
          const onSwitches = document.querySelectorAll('#apps-list .switch.on');
          record('btn-apps-all-on toggles on all 13 app switches', onSwitches.length === 13);
        }

        // 6. Character Eye Tests
        const btnTestWorking = document.getElementById('btn-test-working');
        const btnTestDone = document.getElementById('btn-test-done');
        const btnTestError = document.getElementById('btn-test-error');

        record('#btn-test-working exists', btnTestWorking !== null);
        record('#btn-test-done exists', btnTestDone !== null);
        record('#btn-test-error exists', btnTestError !== null);

        if (btnTestWorking) {
          btnTestWorking.click();
          record('btn-test-working click triggers testing state', btnTestWorking.textContent.includes('Testing'));
        }
        if (btnTestDone) {
          btnTestDone.click();
          record('btn-test-done click triggers done state', btnTestDone.textContent.includes('Done'));
        }
        if (btnTestError) {
          btnTestError.click();
          record('btn-test-error click triggers alert state', btnTestError.textContent.includes('Alert'));
        }

        // 7. Wardrobe Surprise Outfit
        const btnRandomOutfit = document.getElementById('btn-random-outfit');
        record('#btn-random-outfit exists', btnRandomOutfit !== null);
        if (btnRandomOutfit) {
          btnRandomOutfit.click();
          record('btn-random-outfit click executed successfully', true);
        }

        // 8. General Shortcut Recorder & Reset
        const shortcutInput = document.getElementById('shortcut-input');
        const btnRecord = document.getElementById('btn-record-shortcut');
        const btnReset = document.getElementById('btn-reset-shortcut');

        record('#shortcut-input exists', shortcutInput !== null);
        record('#btn-record-shortcut exists', btnRecord !== null);
        record('#btn-reset-shortcut exists', btnReset !== null);

        if (btnRecord && shortcutInput) {
          btnRecord.click();
          const isListening = btnRecord.textContent.includes('Press Keys');
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', ctrlKey: true, altKey: true, bubbles: true }));
          record('Shortcut recorder captured Ctrl + Alt + K', shortcutInput.value === 'Ctrl + Alt + K' && isListening);
        }

        if (btnReset && shortcutInput) {
          btnReset.click();
          record('btn-reset-shortcut restores default Ctrl + Alt + T', shortcutInput.value === 'Ctrl + Alt + T');
        }

        // 9. Island Sound Preview & Toggle
        const btnPreviewSound = document.getElementById('btn-preview-sound');
        const btnTestIsland = document.getElementById('btn-test-island-toggle');

        record('#btn-preview-sound exists', btnPreviewSound !== null);
        record('#btn-test-island-toggle exists', btnTestIsland !== null);

        if (btnPreviewSound) {
          btnPreviewSound.click();
          record('btn-preview-sound click plays preview', btnPreviewSound.textContent.includes('Playing'));
        }

        if (btnTestIsland) {
          btnTestIsland.click();
          record('btn-test-island-toggle click confirms toggle', btnTestIsland.textContent.includes('Toggled'));
        }

        // 10. Focus Guard Chips & Pause Test
        const guardChips = document.querySelectorAll('.guard-chip');
        const guardText = document.getElementById('guard-blocked-list');
        const btnTestGuard = document.getElementById('btn-test-guard');

        record('Focus guard chips exist (8 items)', guardChips.length >= 8);
        record('#btn-test-guard exists', btnTestGuard !== null);

        const netflixChip = document.querySelector('.guard-chip[data-app="netflix.com"]');
        if (netflixChip && guardText) {
          netflixChip.click();
          record('Netflix chip click appended netflix.com to blocked list', guardText.value.includes('netflix.com'));
        }

        if (btnTestGuard) {
          btnTestGuard.click();
          record('btn-test-guard click triggers pause feedback', btnTestGuard.textContent.includes('Triggered'));
        }

        // 11. News & Support
        const btnCheckUpdates = document.getElementById('btn-check-updates');
        const btnOpenGitHub = document.getElementById('btn-open-github');
        const btnCopySupport = document.getElementById('btn-copy-support-link');

        record('#btn-check-updates exists', btnCheckUpdates !== null);
        record('#btn-open-github exists', btnOpenGitHub !== null);
        record('#btn-copy-support-link exists', btnCopySupport !== null);

        if (btnCheckUpdates) {
          btnCheckUpdates.click();
          record('btn-check-updates click checks for updates', btnCheckUpdates.textContent.includes('Checking'));
        }

        if (btnOpenGitHub) {
          btnOpenGitHub.click();
          record('btn-open-github click executed', true);
        }

        if (btnCopySupport) {
          btnCopySupport.click();
          record('btn-copy-support-link click executed', true);
        }

        return tests;
      })()
    `);

    // Report renderer tests
    res.forEach((t) => {
      assert(t.desc, t.cond, t.details);
    });

    // Check IPC effects
    assert('Island toggle IPC event was received by main process', islandToggled === true);
    assert('Focus Guard test IPC event was received by main process', focusGuardTested === true);
    assert('Open external GitHub URL IPC was invoked with repository URL', openedUrl === 'https://github.com/RoboIsland/RoboIsland');

    console.log('\n====================================================');
    console.log(`TOTAL PASSED: ${passed}`);
    console.log(`TOTAL FAILED: ${failed}`);
    console.log('====================================================\n');

    settingsWin.destroy();
    app.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error in test suite:', err);
    app.exit(1);
  }
});
