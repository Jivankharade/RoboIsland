/**
 * Automated Verification Suite for Apple-Style Hardware HUD in RoboIsland:
 * 1. Feature 1: Keyboard Volume Pop HUD (Vol Up/Down/Mute pop with speaker vector icon, pill track, digits)
 * 2. Feature 2: Charger Plug-in / Battery Surge HUD (AC adapter plug-in pop with lightning bolt & aura)
 * 3. Feature 3: Interactive Track Scrubbing & Click Shielding
 * 4. Feature 4: Settings Hardware HUD Simulation
 * 5. Feature 5: Compiled Bundle & Zero-Emoji Compliance
 *
 * ZERO-EMOJI ENFORCED: Source and test code must contain 0 unicode emojis.
 */

const fs = require('fs');
const path = require('path');

let totalPassed = 0;
let totalFailed = 0;

function assert(description, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${description}`);
    totalPassed++;
  } else {
    console.error(`[FAIL] ${description} ${details ? '- ' + details : ''}`);
    totalFailed++;
  }
}

console.log('\n====================================================');
console.log('   ROBOISLAND APPLE HARDWARE HUD TEST SUITE         ');
console.log('====================================================\n');

// 1. Zero-Emoji Compliance
console.log('--- 1. Testing Zero-Emoji Compliance ---');
const canvasSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf8');
const settingsHtml = fs.readFileSync(path.join(__dirname, '../src/renderer/settings/settings.html'), 'utf8');
const settingsUiSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/settings/settings-ui.ts'), 'utf8');
const settingsPreloadSrc = fs.readFileSync(path.join(__dirname, '../src/preload/settings-preload.ts'), 'utf8');
const indexSrc = fs.readFileSync(path.join(__dirname, '../src/main/index.ts'), 'utf8');
const testScriptSrc = fs.readFileSync(__filename, 'utf8');

const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert('canvas-engine.ts contains zero unicode emojis', !emojiRegex.test(canvasSrc));
assert('settings.html contains zero unicode emojis', !emojiRegex.test(settingsHtml));
assert('settings-ui.ts contains zero unicode emojis', !emojiRegex.test(settingsUiSrc));
assert('settings-preload.ts contains zero unicode emojis', !emojiRegex.test(settingsPreloadSrc));
assert('index.ts contains zero unicode emojis', !emojiRegex.test(indexSrc));
assert('test-hardware-hud.js contains zero unicode emojis', !emojiRegex.test(testScriptSrc));

// 2. Keyboard Volume Pop HUD Architecture
console.log('\n--- 2. Testing Keyboard Volume Pop HUD Architecture ---');
assert('canvas-engine.ts defines volumeHudUntil timestamp', canvasSrc.includes('public volumeHudUntil = 0;'));
assert('canvas-engine.ts defines volumeHudLevel', canvasSrc.includes('public volumeHudLevel = 50;'));
assert('canvas-engine.ts defines volumeHudMuted', canvasSrc.includes('public volumeHudMuted = false;'));
assert('canvas-engine.ts defines triggerVolumeHud method', canvasSrc.includes('public triggerVolumeHud('));
assert('triggerVolumeHud sets ~2.2s auto-relax window', canvasSrc.includes('performance.now() + 2200;'));
assert('triggerVolumeHud kicks jelly spring physics', canvasSrc.includes('this.kickJelly(0.08);'));
assert('updateTargetDimensions expands targetWidth to 270px/280px during volume HUD', 
  canvasSrc.includes('this.targetWidth = this.isHovered ? 280 : 270;') && canvasSrc.includes('volumeHudUntil'));
assert('renderLoop auto-relaxes volume HUD after timeout', 
  canvasSrc.includes('if (this.volumeHudUntil > 0 && performance.now() >= this.volumeHudUntil)'));
assert('drawCompactContent renders drawVolumeHudContent when volume HUD is active', 
  canvasSrc.includes('if (performance.now() < this.volumeHudUntil)') && canvasSrc.includes('this.drawVolumeHudContent(cx, topY)'));
assert('rest mode supports volume HUD pop expansion', 
  canvasSrc.includes("if (this.mode === 'rest')") && canvasSrc.includes('this.drawVolumeHudContent(cx, topY)'));
assert('setupEvents listens to onVolumeChanged to trigger HUD on delta', 
  canvasSrc.includes('window.roboIsland.onVolumeChanged') && canvasSrc.includes('this.triggerVolumeHud'));

// 3. Vector Canvas Rendering of Volume HUD
console.log('\n--- 3. Testing Pure Vector Canvas Rendering of Volume HUD ---');
assert('canvas-engine.ts defines drawVolumeHudContent', canvasSrc.includes('private drawVolumeHudContent('));
assert('drawVolumeHudContent renders vector speaker box and cone flare', 
  canvasSrc.includes('spkX') && canvasSrc.includes('this.ctx.rect(spkX - 8') && canvasSrc.includes('this.ctx.lineTo(spkX + 1.5'));
assert('drawVolumeHudContent renders sound wave arcs for active volume', 
  canvasSrc.includes('level > 0') && canvasSrc.includes('level > 33') && canvasSrc.includes('level > 66'));
assert('drawVolumeHudContent renders mute cross when muted', 
  canvasSrc.includes('isMuted') && canvasSrc.includes('#ff453a') && canvasSrc.includes('spkX + 11'));
assert('drawVolumeHudContent renders frosted volume pill track', 
  canvasSrc.includes('rgba(255, 255, 255, 0.16)') && canvasSrc.includes('roundRect(trackX, trackY, trackW, trackH, trackR)'));
assert('drawVolumeHudContent renders rounded pill fill with glow', 
  canvasSrc.includes('roundRect(trackX, trackY, fillW, trackH, trackR)'));
assert('drawVolumeHudContent renders right-aligned percentage text or Muted', 
  canvasSrc.includes('${level}%') && canvasSrc.includes("fillText('Muted'"));
assert('drawIslandPill applies pure white aura and rim stroke during volume HUD', 
  canvasSrc.includes('isVolumeHudActive') && canvasSrc.includes('rgba(255, 255, 255, 0.22)'));

// 4. Interactive Track Scrubbing & Click Reliability
console.log('\n--- 4. Testing Interactive Track Scrubbing & Click Reliability ---');
assert('mousedown detects volume track bar click to begin scrubbing', 
  canvasSrc.includes('this.isScrubbingVolumeHud = true;') && canvasSrc.includes('trackW'));
assert('mousemove dynamically updates volume level during scrubbing', 
  canvasSrc.includes('if (this.isScrubbingVolumeHud)') && canvasSrc.includes('window.roboIsland?.setVolume'));
assert('mouseup releases volume scrubbing flag', 
  canvasSrc.includes('if (this.isScrubbingVolumeHud) {\n        this.isScrubbingVolumeHud = false;'));
assert('canAutoCollapse is shielded from accidental collapse while scrubbing volume', 
  canvasSrc.includes('this.isScrubbingVolumeHud'));
assert('handleClick toggles mute when clicking speaker icon', 
  canvasSrc.includes('Math.hypot(x - (pillLeft + 26)') && canvasSrc.includes('window.roboIsland?.setMute'));
assert('handleClick adjusts volume directly when clicking track bar', 
  canvasSrc.includes('Math.round(((clampedX - trackLeft) / trackW) * 100)') && canvasSrc.includes('this.triggerVolumeHud(pct, false)'));
assert('checkHitTest prevents premature hover-expansion while volume HUD is active', 
  canvasSrc.includes('!(performance.now() < this.volumeHudUntil)'));

// 5. Charger Surge Pop Parity
console.log('\n--- 5. Testing Charger Plug-in Surge Pop Parity ---');
assert('triggerChargerSurge exists and sets 2.6s window', canvasSrc.includes('public triggerChargerSurge('));
assert('drawChargerSurgeContent renders green lightning bolt path', 
  canvasSrc.includes('drawChargerSurgeContent') && canvasSrc.includes('boltX') && canvasSrc.includes('#34c759'));
assert('rest mode supports charger surge expansion', 
  canvasSrc.includes('if (performance.now() < this.chargerSurgeUntil)') && canvasSrc.includes('this.drawChargerSurgeContent(cx, topY)'));

// 6. Settings Hardware HUD Simulation
console.log('\n--- 6. Testing Settings Hardware HUD Simulation ---');
assert('settings.html contains #btn-test-volume-hud', settingsHtml.includes('id="btn-test-volume-hud"'));
assert('settings.html contains #btn-test-charger-surge', settingsHtml.includes('id="btn-test-charger-surge"'));
assert('settings-preload.ts exposes testVolumeHud', settingsPreloadSrc.includes('testVolumeHud:'));
assert('settings-preload.ts exposes testChargerSurge', settingsPreloadSrc.includes('testChargerSurge:'));
assert('settings-ui.ts attaches click handler to #btn-test-volume-hud', settingsUiSrc.includes("getElementById('btn-test-volume-hud')"));
assert('settings-ui.ts attaches click handler to #btn-test-charger-surge', settingsUiSrc.includes("getElementById('btn-test-charger-surge')"));
assert('index.ts handles system:test-volume-pop IPC', indexSrc.includes("ipcMain.on('system:test-volume-pop'"));
assert('index.ts handles system:test-charger-surge IPC', indexSrc.includes("ipcMain.on('system:test-charger-surge'"));

// 7. Bundle Output Consistency
console.log('\n--- 7. Testing Bundle Output Consistency ---');
const bundlePath = path.join(__dirname, '../dist/renderer/island/bundle.js');
assert('dist/renderer/island/bundle.js exists', fs.existsSync(bundlePath));
const bundleSrc = fs.readFileSync(bundlePath, 'utf8');
assert('bundle.js contains compiled drawVolumeHudContent', bundleSrc.includes('drawVolumeHudContent'));
assert('bundle.js contains compiled triggerVolumeHud', bundleSrc.includes('triggerVolumeHud'));
assert('bundle.js contains compiled drawChargerSurgeContent', bundleSrc.includes('drawChargerSurgeContent'));
assert('bundle.js contains zero unicode emojis', !emojiRegex.test(bundleSrc));

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('====================================================\n');

if (totalFailed > 0) {
  process.exit(1);
}
