const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('       ROBOISLAND HYBRID DOM REGRESSION SUITE       ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(desc, condition, extraInfo = '') {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc} ${extraInfo}`);
    failed++;
  }
}

async function runTests() {
  const root = path.resolve(__dirname, '..');

  // --- TEST 1: Config Store & Feature Flag Rollback ---
  console.log('\n--- 1. Testing Config Store & Rollback Feature Flag ---');
  const { configStore, DEFAULT_CONFIG } = require(path.join(root, 'dist', 'main', 'config-store.js'));

  assert('Default expandedUiMode is "dom"', DEFAULT_CONFIG.expandedUiMode === 'dom');
  assert('Default mascotName is "Robo"', DEFAULT_CONFIG.mascotName === 'Robo');
  assert('Default mascotOutfit is "best" (Screenshot 06)', DEFAULT_CONFIG.mascotOutfit === 'best');
  assert('Default mascotBodyColor is "cloud" (Screenshot 06)', DEFAULT_CONFIG.mascotBodyColor === 'cloud');
  assert('Default mascotEyeColor is "mint" (Screenshot 06)', DEFAULT_CONFIG.mascotEyeColor === 'mint');
  assert('Default trafficLightEyes has working, done, error (Screenshot 05)', 
    DEFAULT_CONFIG.trafficLightEyes && 
    DEFAULT_CONFIG.trafficLightEyes.working === '#ff9500' && 
    DEFAULT_CONFIG.trafficLightEyes.done === '#34c759' && 
    DEFAULT_CONFIG.trafficLightEyes.error === '#ff3b30'
  );

  // Test Rollback Toggle Persistence
  configStore.update({ expandedUiMode: 'canvas' });
  assert('Rollback toggle updates to "canvas"', configStore.get().expandedUiMode === 'canvas');
  configStore.update({ expandedUiMode: 'dom' });
  assert('Rollback toggle restores to "dom"', configStore.get().expandedUiMode === 'dom');

  // Test Settings Persistence
  configStore.update({
    mascotName: 'RoboCompanion',
    mascotOutfit: 'crown',
    mascotBodyColor: 'gold',
    mascotEyeColor: 'purple',
    trafficLightEyes: { preset: 'soft', working: '#af52de', done: '#5ac8fa', error: '#ff2d55' }
  });
  const updatedCfg = configStore.get();
  assert('Settings update: mascotName persisted', updatedCfg.mascotName === 'RoboCompanion');
  assert('Settings update: mascotOutfit persisted', updatedCfg.mascotOutfit === 'crown');
  assert('Settings update: mascotBodyColor persisted', updatedCfg.mascotBodyColor === 'gold');
  assert('Settings update: mascotEyeColor persisted', updatedCfg.mascotEyeColor === 'purple');
  assert('Settings update: trafficLightEyes persisted', updatedCfg.trafficLightEyes.working === '#af52de');

  // Reset back to defaults for clean state
  configStore.update({
    mascotName: 'Robo',
    mascotOutfit: 'best',
    mascotBodyColor: 'cloud',
    mascotEyeColor: 'mint',
    trafficLightEyes: { preset: 'classic', working: '#ff9500', done: '#34c759', error: '#ff3b30' }
  });

  // --- TEST 2: Island DOM HTML Elements (Screenshots 01, 03, 04, 07, 08) ---
  console.log('\n--- 2. Testing Island DOM Overlay Structure & Elements ---');
  const islandHtmlPath = path.join(root, 'dist', 'renderer', 'island', 'index.html');
  const islandHtml = fs.readFileSync(islandHtmlPath, 'utf8');

  // Canvas preservation check
  assert('Canvas engine element #island-canvas preserved', islandHtml.includes('<canvas id="island-canvas">'));

  // DOM Overlay container check
  assert('DOM overlay container #expanded-island-overlay present', islandHtml.includes('id="expanded-island-overlay"'));

  // Screenshot 01: Status bar with time, battery pill, and Wi-Fi button
  assert('Status bar header present without removed battery pill', !islandHtml.includes('id="status-battery-pill"') && islandHtml.includes('id="status-datetime"'));
  assert('Status bar popover button #btn-system-popover present', islandHtml.includes('id="btn-system-popover"'));

  // Screenshot 01: Dashboard Cards
  assert('Dashboard card 1: Claude Code / AI status present', islandHtml.includes('id="card-claude"') && islandHtml.includes('Claude Code'));
  assert('Dashboard card 2: Music / Media player present', islandHtml.includes('id="card-music"') && islandHtml.includes('Music'));
  assert('Dashboard card 3: Focus Session card present', islandHtml.includes('id="card-focus"') && islandHtml.includes('Focus'));

  // Screenshot 01: Bottom Navigation Bar (10 items)
  const navItems = [
    'data-tab="home"',
    'data-tab="ai"',
    'data-tab="music"',
    'data-tab="chat"',
    'data-tab="focus"',
    'data-tab="tray"',
    'data-tab="clipboard"',
    'data-tab="notes"',
    'data-tab="settings"',
    'id="btn-quick-mute"'
  ];
  for (const item of navItems) {
    assert(`Bottom Nav item ${item} present`, islandHtml.includes(item));
  }

  // Screenshot 03: File Tray
  assert('File Tray panel #panel-tray present', islandHtml.includes('id="panel-tray"'));
  assert('File Tray drop prompt and phone button present', islandHtml.includes('Drop files here') && islandHtml.includes('btn-tray-phone'));
  assert('File Tray shelf #tray-files-shelf present', islandHtml.includes('id="tray-files-shelf"'));

  // Screenshot 04: System Popover
  assert('System Popover #system-popover present', islandHtml.includes('id="system-popover"'));
  assert('System Popover Wi-Fi tile present', islandHtml.includes('id="tile-wifi"') && islandHtml.includes('Wi-Fi'));
  assert('System Popover Bluetooth tile present', islandHtml.includes('id="tile-bt"') && islandHtml.includes('Bluetooth'));
  assert('System Popover Wi-Fi networks row present', islandHtml.includes('id="row-wifi-list"'));
  assert('System Popover Bluetooth devices row present', islandHtml.includes('id="row-bt-list"'));

  // Screenshot 07: Clipboard Panel
  assert('Clipboard panel #panel-clipboard present', islandHtml.includes('id="panel-clipboard"'));
  assert('Clipboard empty state and list present', islandHtml.includes('Nothing copied yet') && islandHtml.includes('id="clipboard-list"'));

  // Screenshot 08: Drag and Drop Overlay
  assert('Drag-and-Drop overlay #drag-drop-overlay present', islandHtml.includes('id="drag-drop-overlay"'));
  assert('Drag-and-Drop golden dashed zone and prompt present', islandHtml.includes('drop-zone-border') && islandHtml.includes("Let go, I'll catch it!"));

  // --- TEST 3: CSS Stylesheet Verification ---
  console.log('\n--- 3. Testing CSS Stylesheet ---');
  const islandCssPath = path.join(root, 'dist', 'renderer', 'island', 'island.css');
  const islandCss = fs.readFileSync(islandCssPath, 'utf8');

  assert('CSS contains #expanded-island-overlay styling', islandCss.includes('#expanded-island-overlay'));
  assert('CSS contains dash-card styling', islandCss.includes('.dash-card'));
  assert('CSS contains bottom nav styling', islandCss.includes('#island-bottom-nav'));
  assert('CSS contains golden dashed drop zone styling', islandCss.includes('.drop-zone-border') && islandCss.includes('dashed #f5c518'));
  assert('CSS contains system popover styling', islandCss.includes('.system-popover'));

  // --- TEST 4: Settings Page Elements (Screenshots 05 & 06) ---
  console.log('\n--- 4. Testing Settings HTML & UI Structure ---');
  const settingsHtmlPath = path.join(root, 'dist', 'renderer', 'settings', 'settings.html');
  const settingsHtml = fs.readFileSync(settingsHtmlPath, 'utf8');

  // Screenshot 05: Robo Tab
  assert('Mascot hero card .robo-hero-card present', settingsHtml.includes('robo-hero-card'));
  assert('Mascot name input with Save button present', settingsHtml.includes('id="input-robo-name"') && settingsHtml.includes('id="btn-save-name"'));
  assert('Traffic light eye presets (Classic, Soft, Colour-blind) present', 
    settingsHtml.includes('data-preset="classic"') && 
    settingsHtml.includes('data-preset="soft"') && 
    settingsHtml.includes('data-preset="colorblind"')
  );
  assert('Traffic light state rows (working, done, error) present', 
    settingsHtml.includes('data-target="working"') && 
    settingsHtml.includes('data-target="done"') && 
    settingsHtml.includes('data-target="error"')
  );

  // Screenshot 06: Wardrobe Tab
  assert('Wardrobe outfit grid with 5 outfit cards (Best, None, Party, Sunglasses, Crown) present', 
    settingsHtml.includes('data-outfit="best"') &&
    settingsHtml.includes('data-outfit="none"') &&
    settingsHtml.includes('data-outfit="party"') &&
    settingsHtml.includes('data-outfit="sunglasses"') &&
    settingsHtml.includes('data-outfit="crown"')
  );
  assert('10 body color swatches present', (settingsHtml.match(/data-body=/g) || []).length >= 10);
  assert('6 eye color swatches present', (settingsHtml.match(/data-eye=/g) || []).length >= 6);

  // --- TEST 5: Compact Pill Screenshot 02 Verification ---
  console.log('\n--- 5. Testing Screenshot 02 Compact Focus Indicator in Canvas Engine ---');
  const enginePath = path.join(root, 'dist', 'renderer', 'island', 'bundle.js');
  const engineJs = fs.readFileSync(enginePath, 'utf8');

  assert('Canvas engine renders focus ring progress arc', engineJs.includes('drawCompactContent') && engineJs.includes('Math.PI * 2'));
  assert('Canvas engine renders compact countdown timer format', engineJs.includes('remainingSeconds') || engineJs.includes('padStart'));
  assert('Canvas engine preserves resting capsule eyes in compact mode', engineJs.includes('drawFloatingEyes'));
  assert('Canvas engine has rollback guard for expandedUiMode', engineJs.includes('expandedUiMode'));

  // Summary
  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('[EXCEPTION]', err);
  process.exit(1);
});
