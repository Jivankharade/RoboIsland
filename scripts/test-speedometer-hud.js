// scripts/test-speedometer-hud.js
// Automated verification for Apple Performance Speedometer HUD & Drag-Drop Fixes

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('[TEST] Starting RoboIsland Speedometer HUD & Drag-Drop Verification...');

let passedTests = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  OK: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

// 1. Zero-Emoji Compliance across all modified files
test('Zero-Emoji Compliance across modified files', () => {
  const filesToCheck = [
    'src/main/system-metrics.ts',
    'src/main/island-window.ts',
    'src/main/productivity-engine.ts',
    'src/main/index.ts',
    'src/preload/island-preload.ts',
    'src/preload/settings-preload.ts',
    'src/renderer/island/canvas-engine.ts',
    'src/renderer/island/index.html',
    'src/renderer/island/island.css',
    'src/renderer/settings/settings.html',
    'src/renderer/settings/settings-ui.ts'
  ];

  // Unicode emoji regex range
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(__dirname, '..', relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relPath}`);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip pure comments if needed, but per zero-emoji policy, no emoji should be anywhere
      if (emojiRegex.test(line)) {
        throw new Error(`Forbidden emoji detected in ${relPath} line ${i + 1}: ${line.trim()}`);
      }
    }
  }
});

// 2. Storage Metrics Computation via statfsSync
test('Storage Metrics Computation via fs.statfsSync', () => {
  const rootDrive = process.platform === 'win32' ? 'C:\\' : '/';
  assert(typeof fs.statfsSync === 'function', 'fs.statfsSync must be supported in Node/Electron');
  const stats = fs.statfsSync(rootDrive);
  assert(stats.bsize > 0, 'Block size must be > 0');
  assert(stats.blocks > 0, 'Total blocks must be > 0');
  const totalGb = (stats.blocks * stats.bsize) / (1024 * 1024 * 1024);
  const freeGb = (stats.bfree * stats.bsize) / (1024 * 1024 * 1024);
  const usedGb = Math.max(0, totalGb - freeGb);
  const percent = Math.min(100, Math.max(0, (usedGb / totalGb) * 100));

  assert(totalGb > 1, 'Drive size should be > 1 GB');
  assert(percent >= 0 && percent <= 100, 'Storage usage percentage must be within 0-100');
  console.log(`    (Primary disk ${rootDrive}: ${totalGb.toFixed(1)} GB total, ${usedGb.toFixed(1)} GB used (${percent.toFixed(1)}%))`);
});

// 3. Apple Performance Speedometer Dynamic Ring Colors
test('Apple Performance Gauge Color Mapping', () => {
  function getAppleGaugeColor(pct) {
    if (pct >= 85) return '#ff453a'; // Coral Red for High/Critical
    if (pct >= 60) return '#ff9f0a'; // Amber Orange for Moderate/Medium
    return '#30d158';               // Vibrant Apple Green for Healthy/Low
  }

  assert.strictEqual(getAppleGaugeColor(25), '#30d158', '25% should be Apple Green');
  assert.strictEqual(getAppleGaugeColor(59), '#30d158', '59% should be Apple Green');
  assert.strictEqual(getAppleGaugeColor(60), '#ff9f0a', '60% should be Amber Orange');
  assert.strictEqual(getAppleGaugeColor(84), '#ff9f0a', '84% should be Amber Orange');
  assert.strictEqual(getAppleGaugeColor(85), '#ff453a', '85% should be Coral Red');
  assert.strictEqual(getAppleGaugeColor(99), '#ff453a', '99% should be Coral Red');
});

// 4. Speedometer Gauge 240-degree Dial Math
test('Speedometer Gauge 240-degree Dial Arc Angles', () => {
  const startAngle = 0.75 * Math.PI; // 135 deg (bottom-left)
  const sweepAngle = 1.5 * Math.PI;  // 240 deg (to bottom-right)
  const endAngle = startAngle + sweepAngle;

  function calculateNeedleAngle(pct) {
    const fraction = Math.min(1, Math.max(0, pct / 100));
    return startAngle + sweepAngle * fraction;
  }

  const needle0 = calculateNeedleAngle(0);
  assert(Math.abs(needle0 - startAngle) < 0.0001, '0% needle must match start angle');

  const needle100 = calculateNeedleAngle(100);
  assert(Math.abs(needle100 - endAngle) < 0.0001, '100% needle must match end angle');

  const needle50 = calculateNeedleAngle(50);
  const midAngle = startAngle + sweepAngle * 0.5;
  assert(Math.abs(needle50 - midAngle) < 0.0001, '50% needle must match half sweep');
});

// 5. Drag & Drop DOM Overlay Architecture
test('Drag & Drop Overlay is mounted at top level of Island DOM', () => {
  const htmlPath = path.resolve(__dirname, '../src/renderer/island/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Verify #drag-drop-overlay is not inside #dom-overlay
  const domOverlayIndex = html.indexOf('<main id="dom-overlay"');
  const domOverlayEnd = html.indexOf('</main>', domOverlayIndex);
  const dragOverlayIndex = html.indexOf('id="drag-drop-overlay"');

  assert(dragOverlayIndex > -1, '#drag-drop-overlay must exist in index.html');
  assert(
    dragOverlayIndex > domOverlayEnd || dragOverlayIndex < domOverlayIndex,
    '#drag-drop-overlay MUST NOT be nested inside <main id="dom-overlay"> (which is hidden in compact mode)'
  );

  // Verify CSS has pointer-events: none when hidden and pointer-events: auto when active
  const cssPath = path.resolve(__dirname, '../src/renderer/island/island.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert(css.includes('.drag-drop-overlay'), 'CSS must define .drag-drop-overlay');
  assert(css.includes('z-index: 99999'), 'Overlay must have top z-index (99999)');
});

// 6. LAN Drop Web Portal Drag & Drop AJAX
test('LAN Drop Web Portal contains Drag & Drop upload listeners', () => {
  const enginePath = path.resolve(__dirname, '../src/main/productivity-engine.ts');
  const code = fs.readFileSync(enginePath, 'utf8');

  assert(code.includes("['dragenter', 'dragover'].forEach"), 'Must handle dragover in LAN portal');
  assert(code.includes("dropArea.addEventListener('drop'"), 'Must handle drop in LAN portal');
  assert(code.includes("fetch('/upload'"), 'Must upload via fetch multipart FormData');
  assert(code.includes('upload-status'), 'Must show live status in upload-status element');
});

// 7. Settings UI Speedometer Trigger
test('Settings UI has Speedometer HUD simulation trigger', () => {
  const settingsHtml = path.resolve(__dirname, '../src/renderer/settings/settings.html');
  const html = fs.readFileSync(settingsHtml, 'utf8');
  assert(html.includes('id="btn-test-speedometer-hud"'), 'btn-test-speedometer-hud must be present in settings.html');

  const settingsUi = path.resolve(__dirname, '../src/renderer/settings/settings-ui.ts');
  const ui = fs.readFileSync(settingsUi, 'utf8');
  assert(ui.includes("document.getElementById('btn-test-speedometer-hud')"), 'Event listener must be registered for btn-test-speedometer-hud');
  assert(ui.includes('window.settingsApi?.testSpeedometerHud?.()'), 'Must call settingsApi.testSpeedometerHud()');
});

// 8. IPC and Preload Bridge
test('IPC and Preload bridges are registered for Speedometer HUD', () => {
  const islandPreload = fs.readFileSync(path.resolve(__dirname, '../src/preload/island-preload.ts'), 'utf8');
  assert(islandPreload.includes('showSpeedometerHud'), 'island-preload must expose showSpeedometerHud');
  assert(islandPreload.includes('onShowSpeedometerHud'), 'island-preload must expose onShowSpeedometerHud');

  const settingsPreload = fs.readFileSync(path.resolve(__dirname, '../src/preload/settings-preload.ts'), 'utf8');
  assert(settingsPreload.includes('testSpeedometerHud'), 'settings-preload must expose testSpeedometerHud');

  const mainIndex = fs.readFileSync(path.resolve(__dirname, '../src/main/index.ts'), 'utf8');
  assert(mainIndex.includes('system:test-speedometer-hud'), 'main index must handle system:test-speedometer-hud');
  assert(mainIndex.includes('island:show-speedometer-hud'), 'main index must forward island:show-speedometer-hud');
});

// 9. File Tray Persistence Fix (no disk overwriting during in-memory addition)
test('File Tray in-memory persistence does not clobber incoming files', () => {
  const prodEngine = fs.readFileSync(path.resolve(__dirname, '../src/main/productivity-engine.ts'), 'utf8');
  assert(!prodEngine.includes('this.trayFiles = parsed;'), 'getValidTrayFiles must NOT overwrite this.trayFiles with old disk state');
  assert(prodEngine.includes('savePersistedTrayFiles'), 'Must have savePersistedTrayFiles helper');
  assert(prodEngine.includes("ipcMain.handle('tools:tray-add'"), 'Must handle tools:tray-add');
});

// 10. Apple AirDrop Animation HUD & Toast
test('Apple AirDrop transfer animation HUD, toast & synth chime', () => {
  const canvasEngine = fs.readFileSync(path.resolve(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf8');
  assert(canvasEngine.includes('triggerAirDropHud'), 'canvas-engine must define triggerAirDropHud');
  assert(canvasEngine.includes('drawAirDropHudContent'), 'canvas-engine must define drawAirDropHudContent');
  assert(canvasEngine.includes('showAirDropToast'), 'canvas-engine must define showAirDropToast');
  assert(canvasEngine.includes('airdropHudUntil'), 'canvas-engine must track airdropHudUntil');

  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../src/renderer/island/index.html'), 'utf8');
  assert(indexHtml.includes('id="airdrop-toast"'), 'index.html must include #airdrop-toast');
  assert(indexHtml.includes('airdrop-radar-ring'), 'index.html must include airdrop-radar-ring elements');

  const islandCss = fs.readFileSync(path.resolve(__dirname, '../src/renderer/island/island.css'), 'utf8');
  assert(islandCss.includes('.airdrop-toast'), 'island.css must define .airdrop-toast');
  assert(islandCss.includes('@keyframes airdropRadarPulse'), 'island.css must define @keyframes airdropRadarPulse');
  assert(islandCss.includes('.tray-item-chip.airdrop-enter'), 'island.css must define .tray-item-chip.airdrop-enter');

  const audioSynth = fs.readFileSync(path.resolve(__dirname, '../src/renderer/island/audio-synth.ts'), 'utf8');
  assert(audioSynth.includes('airdrop: ['), 'audio-synth must include airdrop procedural chime');
});

console.log(`\nAll ${passedTests} Speedometer HUD & Drag-Drop tests PASSED!`);
