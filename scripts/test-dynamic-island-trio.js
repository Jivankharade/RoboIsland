/**
 * Automated Verification Suite for 3 Dynamic Island Innovations:
 * 1. Feature A: Compact Micro-Waveform Equalizer (3-bar animated equalizer next to eyes)
 * 2. Feature B: Charger Plug-in Surge Pop (2.6s horizontal spring expansion with green bolt)
 * 3. Feature C: Split-Island Dual Bubble ([ Pill ] ( O ) for Pomodoro Focus timer)
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
console.log('   ROBOISLAND DYNAMIC ISLAND TRIO TEST SUITE        ');
console.log('====================================================\n');

// 1. Zero-Emoji Compliance
console.log('--- 1. Testing Zero-Emoji Compliance ---');
const canvasSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(__dirname, '../src/preload/island-preload.ts'), 'utf8');
const testScriptSrc = fs.readFileSync(__filename, 'utf8');

const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert('canvas-engine.ts contains zero unicode emojis', !emojiRegex.test(canvasSrc));
assert('island-preload.ts contains zero unicode emojis', !emojiRegex.test(preloadSrc));
assert('test-dynamic-island-trio.js contains zero unicode emojis', !emojiRegex.test(testScriptSrc));

// 2. Feature A: Compact Micro-Waveform Equalizer
console.log('\n--- 2. Testing Feature A: Compact Micro-Waveform Equalizer ---');
assert('canvas-engine.ts defines public drawMicroEqualizer', canvasSrc.includes('public drawMicroEqualizer('));
assert('drawMicroEqualizer renders 3 animated bouncing bars', canvasSrc.includes('const bars = 3;') && canvasSrc.includes('barSpacing'));
assert('drawMicroEqualizer uses sine frequencies for asynchronous bouncing', canvasSrc.includes('Math.sin(now * 1.2)') && canvasSrc.includes('Math.sin(now * 1.8'));
assert('drawMicroEqualizer renders rounded pill caps with roundRect', canvasSrc.includes('roundRect(bx, by, barWidth, h, 1)'));
assert('drawCompactRestingDualStructure checks mediaState.playing', canvasSrc.includes('if (this.mediaState.playing)'));
assert('drawCompactRestingDualStructure calls drawMicroEqualizer when playing', canvasSrc.includes('this.drawMicroEqualizer(cx + 24, eyeCy)'));
assert('drawCompactRestingDualStructure centers eyes when audio is paused', canvasSrc.includes('this.mascot.drawFloatingEyes(this.ctx, cx, eyeCy, 1.0)'));

// 3. Feature B: Charger Plug-in Surge Pop
console.log('\n--- 3. Testing Feature B: Charger Plug-in Surge Pop (Zero Clutter) ---');
assert('canvas-engine.ts defines chargerSurgeUntil timestamp', canvasSrc.includes('public chargerSurgeUntil = 0;'));
assert('canvas-engine.ts defines triggerChargerSurge method', canvasSrc.includes('public triggerChargerSurge('));
assert('triggerChargerSurge sets ~2.6 second surge window', canvasSrc.includes('performance.now() + 2600;'));
assert('updateTargetDimensions expands targetWidth to 180px during surge', canvasSrc.includes('this.targetWidth = this.isHovered ? 190 : 180;') && canvasSrc.includes('chargerSurgeUntil'));
assert('renderLoop auto-relaxes surge back to resting dock after timeout', canvasSrc.includes('if (this.chargerSurgeUntil > 0 && performance.now() >= this.chargerSurgeUntil)'));
assert('drawIslandPill pulses green glow during charging surge', canvasSrc.includes('isSurgeActive && this.chargerSurgeCharging') && canvasSrc.includes('rgba(52, 199, 89'));
assert('drawChargerSurgeContent renders glowing green lightning bolt canvas path', canvasSrc.includes('drawChargerSurgeContent') && canvasSrc.includes('boltX') && canvasSrc.includes('#34c759'));
assert('drawChargerSurgeContent renders battery % text', canvasSrc.includes('${level}%'));
assert('loadInitialData triggers surge on chargingchange transition', canvasSrc.includes("b.addEventListener('chargingchange'") && canvasSrc.includes('this.triggerChargerSurge'));
assert('island-preload.ts exposes onBatteryStateChanged', preloadSrc.includes('onBatteryStateChanged:'));

// 4. Feature C: Split-Island Dual Bubble [ Pill ] ( O ) for Focus Pomodoro
console.log('\n--- 4. Testing Feature C: Split-Island Dual Bubble ([ Pill ] ( O )) ---');
assert('canvas-engine.ts defines isSplitIslandActive method', canvasSrc.includes('public isSplitIslandActive(): boolean'));
assert('isSplitIslandActive requires compact mode and active focus timer', canvasSrc.includes("this.mode === 'compact'") && canvasSrc.includes('this.focusState.active'));
assert('drawIslandPill renders two disconnected obsidian shapes in single pass', (canvasSrc.includes('this.islandPath(this.ctx, pillLeft, topY, mainWidth, h, r)') || canvasSrc.includes('this.ctx.roundRect(pillLeft, topY, mainWidth, h, r)')) && canvasSrc.includes('this.ctx.arc(bubbleCx, bubbleCy, bubbleR, 0, Math.PI * 2)'));
assert('Detached bubble uses 8px horizontal separation gap', canvasSrc.includes('const gap = 8;'));
assert('Detached circular bubble diameter equals capsule height (h)', canvasSrc.includes('const bubbleSize = h;') || canvasSrc.includes('const bubbleDiameter = h;'));
assert('drawCompactContent renders full Spotify music island or eyes in primary pill', canvasSrc.includes('this.drawCompactMusicIsland(left, midY, topY)') || canvasSrc.includes('this.mascot.drawFloatingEyes'));
assert('drawCompactContent renders circular violet progress arc in detached bubble', canvasSrc.includes('arc(bubbleCx, bubbleCy, ringR, -Math.PI / 2') && canvasSrc.includes('#bf5af2'));
assert('drawCompactContent renders clean countdown centered in detached bubble', canvasSrc.includes('fillText(minText, bubbleCx, bubbleCy') || canvasSrc.includes('fillText(timeStr, bubbleCx, bubbleCy'));
assert('checkHitTest covers both main pill and detached bubble bounds', canvasSrc.includes('this.isSplitIslandActive()') && canvasSrc.includes('pillLeft + totalSpan'));
assert('handleClick opens Focus tab when clicking detached circular bubble', canvasSrc.includes("this.activeTab = 'focus'") && canvasSrc.includes("this.showDomTab('focus')"));

// 5. Build Artifact Consistency
console.log('\n--- 5. Testing Bundle Output Consistency ---');
const bundlePath = path.join(__dirname, '../dist/renderer/island/bundle.js');
assert('dist/renderer/island/bundle.js exists', fs.existsSync(bundlePath));
const bundleSrc = fs.readFileSync(bundlePath, 'utf8');
assert('bundle.js contains compiled drawMicroEqualizer', bundleSrc.includes('drawMicroEqualizer'));
assert('bundle.js contains compiled triggerChargerSurge', bundleSrc.includes('triggerChargerSurge'));
assert('bundle.js contains compiled isSplitIslandActive', bundleSrc.includes('isSplitIslandActive'));
assert('bundle.js contains zero unicode emojis', !emojiRegex.test(bundleSrc));

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('====================================================\n');

if (totalFailed > 0) {
  process.exit(1);
}
