/**
 * RoboIsland Settings Persistence & Cold-Restart Verification Suite
 * 
 * Verifies that all configuration saved in Settings persists to disk
 * and is accurately loaded and applied when the application restarts.
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

// If not running inside Electron, spawn Electron runner
if (!process.versions.electron) {
  const electronPath = require('electron');
  console.log('[Runner] Spawning Electron runner for scripts/test-settings-restart.js...\n');
  const res = spawnSync(electronPath, [__filename], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

const { app, BrowserWindow } = require('electron');

console.log('====================================================');
console.log('    ROBOISLAND SETTINGS COLD-RESTART TEST SUITE     ');
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
  const userData = app.getPath('userData');
  const configPath = path.join(userData, 'roboisland-config.json');
  const backupPath = path.join(userData, 'roboisland-config.json.backup_test');

  // 1. Backup existing config
  let hadOriginal = false;
  let originalContent = '';
  if (fs.existsSync(configPath)) {
    hadOriginal = true;
    originalContent = fs.readFileSync(configPath, 'utf8');
    fs.writeFileSync(backupPath, originalContent, 'utf8');
  }

  try {
    // 2. Define custom test settings across all tabs
    const testCustomConfig = {
      mascotName: 'RoboTestBot',
      mascotOutfit: 'party',
      mascotBodyColor: 'gold',
      mascotEyeColor: 'yellow',
      trafficLightEyes: {
        preset: 'colorblind',
        working: '#ff9500',
        done: '#00e5ff',
        error: '#ffffff'
      },
      islandStyle: 'notch',
      islandScale: 1.15,
      visualTexture: 'carbon',
      aiProvider: 'codex',
      openAiApiKey: 'sk-test-key-12345',
      ttsEnabled: false,
      soundEnabled: false,
      theme: 'frosted',
      language: 'hi',
      focusGuardEnabled: true,
      focusGuardBlockedApps: ['youtube.com', 'reddit.com', 'custom-block.exe'],
      focusGuardBlocked: 'youtube.com, reddit.com, custom-block.exe',
      claudeCodeHooksEnabled: false,
      codexHooksEnabled: true,
      appsOff: ['guard', 'battery'],
      profileName: 'Dr. Companion'
    };

    // 3. Write test config to disk to simulate prior session saves
    fs.writeFileSync(configPath, JSON.stringify(testCustomConfig, null, 2), 'utf8');
    assert('Saved custom settings file to disk in userData', fs.existsSync(configPath));

    // 4. Instantiate a fresh ConfigStore (simulating application restart)
    const { configStore } = require(path.join(root, 'dist', 'main', 'config-store.js'));
    // Force reload
    configStore.config = configStore.load();
    const loadedConfig = configStore.get();

    console.log('\n--- 1. Testing ConfigStore Cold-Reload from Disk ---');
    assert('ConfigStore loads custom mascotName on restart', loadedConfig.mascotName === 'RoboTestBot');
    assert('ConfigStore loads custom mascotOutfit on restart', loadedConfig.mascotOutfit === 'party');
    assert('ConfigStore loads custom mascotBodyColor on restart', loadedConfig.mascotBodyColor === 'gold');
    assert('ConfigStore loads custom mascotEyeColor on restart', loadedConfig.mascotEyeColor === 'yellow');
    assert('ConfigStore loads custom trafficLightEyes preset', loadedConfig.trafficLightEyes?.preset === 'colorblind');
    assert('ConfigStore loads custom islandStyle', loadedConfig.islandStyle === 'notch');
    assert('ConfigStore loads custom islandScale', loadedConfig.islandScale === 1.15);
    assert('ConfigStore loads custom visualTexture', loadedConfig.visualTexture === 'carbon');
    assert('ConfigStore loads custom aiProvider', loadedConfig.aiProvider === 'codex');
    assert('ConfigStore loads custom openAiApiKey', loadedConfig.openAiApiKey === 'sk-test-key-12345');
    assert('ConfigStore loads custom language', loadedConfig.language === 'hi');
    assert('ConfigStore loads custom focusGuardBlockedApps', loadedConfig.focusGuardBlockedApps?.includes('custom-block.exe'));
    assert('ConfigStore loads custom claudeCodeHooksEnabled false', loadedConfig.claudeCodeHooksEnabled === false);

    // 5. Open Settings Window to verify UI restoration on restart
    console.log('\n--- 2. Testing Settings UI Form Restoration on Restart ---');
    const settingsWin = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(root, 'dist', 'preload', 'settings-preload.js')
      }
    });

    // Provide mock IPC handlers if not registered
    const { ipcMain } = require('electron');
    ipcMain.removeHandler('settings:get-config');
    ipcMain.handle('settings:get-config', () => configStore.get());
    ipcMain.removeHandler('settings:update-config');
    ipcMain.handle('settings:update-config', (_e, p) => {
      configStore.update(p);
      return configStore.get();
    });

    await settingsWin.loadFile(path.join(root, 'dist', 'renderer', 'settings', 'settings.html'));

    // Wait 250ms for settings-ui initData() to finish populating
    await new Promise((r) => setTimeout(r, 250));

    const settingsUiChecks = await settingsWin.webContents.executeJavaScript(`
      (() => {
        const nameInput = document.getElementById('input-robo-name');
        const roboDisplayName = document.getElementById('robo-display-name');
        const wardrobeNameCaption = document.getElementById('wardrobe-name-caption');
        const wearingCaption = document.getElementById('wardrobe-wearing-caption');
        
        const partyOutfitCard = document.querySelector('.outfit-card[data-outfit="party"]');
        const goldBodyCircle = document.querySelector('.color-circle[data-body="gold"]');
        const yellowEyeCircle = document.querySelector('.color-circle[data-eye="yellow"]');
        
        const colorblindPreset = document.querySelector('.preset-btn[data-preset="colorblind"]');
        const classicPreset = document.querySelector('.preset-btn[data-preset="classic"]');
        
        const claudeHook = document.getElementById('toggle-claude-hook');
        const codexHook = document.getElementById('toggle-codex-hook');
        const aiProvider = document.getElementById('ai-provider-select');
        const aiApiKey = document.getElementById('ai-api-key');
        const aiTts = document.getElementById('toggle-ai-tts');
        
        const themeSelect = document.getElementById('theme-select');
        const langSelect = document.getElementById('language-select');
        const textureSelect = document.getElementById('texture-select');
        
        const styleNotch = document.querySelector('input[name="islandStyle"][value="notch"]');
        const scaleLarge = document.querySelector('input[name="islandScale"][value="1.15"]');
        
        const guardToggle = document.getElementById('toggle-focus-guard');
        const guardText = document.getElementById('guard-blocked-list');
        const profileInput = document.getElementById('profile-name-input');

        return {
          nameValue: nameInput ? nameInput.value : '',
          roboDisplayName: roboDisplayName ? roboDisplayName.textContent : '',
          wardrobeNameCaption: wardrobeNameCaption ? wardrobeNameCaption.textContent : '',
          wearingCaption: wearingCaption ? wearingCaption.textContent : '',
          partyOutfitActive: partyOutfitCard ? partyOutfitCard.classList.contains('active') : false,
          goldBodyActive: goldBodyCircle ? goldBodyCircle.classList.contains('active') : false,
          yellowEyeActive: yellowEyeCircle ? yellowEyeCircle.classList.contains('active') : false,
          colorblindActive: colorblindPreset ? colorblindPreset.classList.contains('active') : false,
          classicInactive: classicPreset ? !classicPreset.classList.contains('active') : false,
          claudeHookOff: claudeHook ? !claudeHook.classList.contains('on') : false,
          codexHookOn: codexHook ? codexHook.classList.contains('on') : false,
          aiProviderValue: aiProvider ? aiProvider.value : '',
          aiApiKeyValue: aiApiKey ? aiApiKey.value : '',
          aiTtsOff: aiTts ? !aiTts.classList.contains('on') : false,
          themeValue: themeSelect ? themeSelect.value : '',
          langValue: langSelect ? langSelect.value : '',
          textureValue: textureSelect ? textureSelect.value : '',
          styleNotchChecked: styleNotch ? styleNotch.checked : false,
          scaleLargeChecked: scaleLarge ? scaleLarge.checked : false,
          guardToggleOn: guardToggle ? guardToggle.classList.contains('on') : false,
          guardTextHasCustom: guardText ? guardText.value.includes('custom-block.exe') : false,
          profileValue: profileInput ? profileInput.value : ''
        };
      })()
    `);

    assert('Settings UI: Mascot name restored to input', settingsUiChecks.nameValue === 'RoboTestBot');
    assert('Settings UI: Hero title restored to RoboTestBot', settingsUiChecks.roboDisplayName === 'RoboTestBot');
    assert('Settings UI: Wardrobe header caption restored to RoboTestBot', settingsUiChecks.wardrobeNameCaption === 'RoboTestBot');
    assert('Settings UI: Wardrobe wearing caption restored to Party hat', settingsUiChecks.wearingCaption.includes('Party hat'));
    assert('Settings UI: Party outfit card marked active', settingsUiChecks.partyOutfitActive === true);
    assert('Settings UI: Gold body color circle marked active', settingsUiChecks.goldBodyActive === true);
    assert('Settings UI: Yellow eye color circle marked active', settingsUiChecks.yellowEyeActive === true);
    assert('Settings UI: Color-blind traffic light preset marked active', settingsUiChecks.colorblindActive === true);
    assert('Settings UI: Classic preset correctly unmarked active', settingsUiChecks.classicInactive === true);
    assert('Settings UI: Claude Code hook switch restored to OFF', settingsUiChecks.claudeHookOff === true);
    assert('Settings UI: OpenAI Codex hook switch restored to ON', settingsUiChecks.codexHookOn === true);
    assert('Settings UI: AI Provider dropdown restored to codex', settingsUiChecks.aiProviderValue === 'codex');
    assert('Settings UI: OpenAI API key restored to input', settingsUiChecks.aiApiKeyValue === 'sk-test-key-12345');
    assert('Settings UI: Speech synthesis toggle restored to OFF', settingsUiChecks.aiTtsOff === true);
    assert('Settings UI: UI theme dropdown restored to frosted', settingsUiChecks.themeValue === 'frosted');
    assert('Settings UI: Language dropdown restored to hi', settingsUiChecks.langValue === 'hi');
    assert('Settings UI: Surface texture restored to carbon', settingsUiChecks.textureValue === 'carbon');
    assert('Settings UI: Attachment mode restored to notch', settingsUiChecks.styleNotchChecked === true);
    assert('Settings UI: Scale mode restored to 1.15', settingsUiChecks.scaleLargeChecked === true);
    assert('Settings UI: Focus Guard toggle restored to ON', settingsUiChecks.guardToggleOn === true);
    assert('Settings UI: Blocked apps list contains custom-block.exe', settingsUiChecks.guardTextHasCustom === true);
    assert('Settings UI: Profile name restored to Dr. Companion', settingsUiChecks.profileValue === 'Dr. Companion');

    // 6. Test making a live change in Settings UI and checking that it persists immediately
    console.log('\n--- 3. Testing Live Setting Update & Instant Disk Persistence ---');
    const updateResult = await settingsWin.webContents.executeJavaScript(`
      (async () => {
        // Change mascot name in UI
        const nameInput = document.getElementById('input-robo-name');
        nameInput.value = 'RoboRenamedLive';
        nameInput.dispatchEvent(new Event('change'));

        // Change outfit to crown
        const crownCard = document.querySelector('.outfit-card[data-outfit="crown"]');
        if (crownCard) crownCard.click();

        // Change island scale to 0.85
        const scaleCompact = document.querySelector('input[name="islandScale"][value="0.85"]');
        if (scaleCompact) {
          scaleCompact.checked = true;
          scaleCompact.dispatchEvent(new Event('change'));
        }

        // Wait 150ms for IPC round-trip
        await new Promise(r => setTimeout(r, 150));

        const savePill = document.getElementById('settings-save-pill');
        const pillVisible = savePill && savePill.classList.contains('show');

        return { pillVisible };
      })()
    `);

    assert('Settings UI: Live change triggered "Saved" toast feedback', updateResult.pillVisible === true);

    // Read back config from disk to confirm real persistence
    const reloadedDiskRaw = fs.readFileSync(configPath, 'utf8');
    const reloadedDiskJson = JSON.parse(reloadedDiskRaw);
    assert('Disk persistence: mascotName was saved to disk', reloadedDiskJson.mascotName === 'RoboRenamedLive');
    assert('Disk persistence: mascotOutfit was saved to disk', reloadedDiskJson.mascotOutfit === 'crown');
    assert('Disk persistence: islandScale was saved to disk', reloadedDiskJson.islandScale === 0.85);

    settingsWin.destroy();

  } catch (err) {
    console.error('[UNEXPECTED ERROR]', err);
    failed++;
  } finally {
    // Restore backup
    if (hadOriginal && originalContent) {
      fs.writeFileSync(configPath, originalContent, 'utf8');
      try { fs.unlinkSync(backupPath); } catch {}
    }
  }

  console.log('\n====================================================');
  console.log(`SETTINGS RESTART TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  app.quit();
  process.exit(failed > 0 ? 1 : 0);
});
