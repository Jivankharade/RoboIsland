/**
 * RoboIsland - TwoCode Home Dashboard & UI Parity Test Suite
 *
 * Verifies exact parity with TwoCode's Home dashboard visual craftsmanship:
 * 1. Zero-Emoji Compliance across all modified files.
 * 2. Music Tile Parity:
 *    - 44x44px album cover art with 10px radius and ambient glow shadow.
 *    - Mini 4-bar equalizer next to "Music" label.
 *    - Dedicated 30px round white Play/Pause button with black media icon.
 * 3. Focus Tile Parity:
 *    - Running: Circular gauge ring running empty with 10x10px white stop box inside.
 *    - Idle: Round white button with purple play triangle.
 *    - Bold 28px countdown digits and "X min left" / "Ready to start" subtext.
 * 4. Claude Code / AI Tile Parity:
 *    - Circular gauge ring with rotating Claude asterisk during execution.
 *    - 26px bold status and subtext.
 * 5. Visual Styling:
 *    - Pitch OLED black background (#0c0d10), 22px card border radius, dynamic bottom-rising glow.
 * 6. Top Header Parity:
 *    - Mini 4-bar equalizer next to menu dots when music plays on other tabs.
 * 7. Bottom Navigation & Volume Scrubber Parity:
 *    - Capsule tab indicator with 20% alpha tint.
 *    - Slide-out 76px volume scrubber on speaker hover/drag.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const rootDir = path.resolve(__dirname, '..');
const htmlFile = path.join(rootDir, 'src/renderer/island/index.html');
const cssFile = path.join(rootDir, 'src/renderer/island/island.css');
const tsFile = path.join(rootDir, 'src/renderer/island/canvas-engine.ts');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('   TWOCODE HOME DASHBOARD PARITY TEST SUITE         ');
console.log('====================================================\n');

// 1. Zero-Emoji Compliance
console.log('--- 1. Testing Zero-Emoji Compliance ---');
const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;

[htmlFile, cssFile, tsFile].forEach((f) => {
  const rel = path.relative(rootDir, f);
  test(`${rel} contains zero unicode emojis`, () => {
    const content = fs.readFileSync(f, 'utf8');
    assert.strictEqual(emojiRegex.test(content), false, `Found unicode emoji in ${rel}`);
  });
});

// 2. Music Tile Parity
console.log('\n--- 2. Music Tile Parity ---');
const htmlContent = fs.readFileSync(htmlFile, 'utf8');
const cssContent = fs.readFileSync(cssFile, 'utf8');
const tsContent = fs.readFileSync(tsFile, 'utf8');

test('HTML contains card-music-cover img and card-music-viz', () => {
  assert.ok(htmlContent.includes('id="card-music-cover"'), 'Missing #card-music-cover');
  assert.ok(htmlContent.includes('id="card-music-viz"'), 'Missing #card-music-viz');
  assert.ok(htmlContent.includes('id="btn-home-music-play"'), 'Missing #btn-home-music-play');
});

test('CSS styles card-music-cover with 44px size, 10px radius, and ambient glow', () => {
  assert.ok(cssContent.includes('.card-music-cover'), 'Missing .card-music-cover rule');
  assert.ok(cssContent.includes('width: 44px;'), 'Missing 44px width');
  assert.ok(cssContent.includes('height: 44px;'), 'Missing 44px height');
  assert.ok(cssContent.includes('border-radius: 10px;'), 'Missing 10px border radius');
  assert.ok(cssContent.includes('box-shadow: 0 5px 18px rgba(var(--album-tint-rgb'), 'Missing ambient glow shadow');
});

test('CSS styles 30px round white play/pause button', () => {
  assert.ok(cssContent.includes('.home-play-btn'), 'Missing .home-play-btn');
  assert.ok(cssContent.includes('width: 30px;'), 'Missing 30px width');
  assert.ok(cssContent.includes('height: 30px;'), 'Missing 30px height');
  assert.ok(cssContent.includes('border-radius: 50%;'), 'Missing 50% border radius');
});

test('TypeScript updates music cover art, equalizer visibility, and play/pause button', () => {
  assert.ok(tsContent.includes('card-music-cover'), 'Missing card-music-cover reference in TS');
  assert.ok(tsContent.includes('card-music-viz'), 'Missing card-music-viz reference in TS');
  assert.ok(tsContent.includes('btn-home-music-play'), 'Missing btn-home-music-play reference in TS');
  assert.ok(tsContent.includes("mediaControl('playPause')"), 'Missing playPause trigger');
});

// 3. Focus Tile Parity
console.log('\n--- 3. Focus Tile Parity ---');
test('Focus card has 28px bold digits and dynamic button slot', () => {
  assert.ok(cssContent.includes('#card-focus-time'), 'Missing #card-focus-time');
  assert.ok(cssContent.includes('font-size: 28px;'), 'Missing 28px font size for focus time');
  assert.ok(htmlContent.includes('id="btn-focus-toggle"'), 'Missing #btn-focus-toggle');
});

test('TypeScript renders TwoCode empty-running progress ring with 10x10 white stop box when active', () => {
  assert.ok(tsContent.includes('<rect x="13" y="13" width="10" height="10" rx="2.5" fill="#ffffff"/>'), 'Missing 10x10 white stop box');
  assert.ok(tsContent.includes('stroke-dashoffset'), 'Missing stroke-dashoffset calculation');
});

test('TypeScript renders TwoCode round white button with purple play triangle when idle', () => {
  assert.ok(tsContent.includes('<circle cx="18" cy="18" r="18" fill="#ffffff"/>'), 'Missing round white button');
  assert.ok(tsContent.includes('fill="#bf5af2"'), 'Missing TwoCode purple fill');
  assert.ok(tsContent.includes('polygon points="15 12 25 18 15 24"'), 'Missing play triangle');
});

// 4. Claude Code / AI Tile Parity
console.log('\n--- 4. Claude Code / AI Tile Parity ---');
test('HTML contains circular gauge bar and Claude mark icon', () => {
  assert.ok(htmlContent.includes('id="card-ai-gauge-bar"'), 'Missing #card-ai-gauge-bar');
  assert.ok(htmlContent.includes('id="card-ai-mark"'), 'Missing #card-ai-mark');
});

test('CSS defines spinning keyframe animation matching performance.now() / 1100', () => {
  assert.ok(cssContent.includes('@keyframes claude-spin'), 'Missing @keyframes claude-spin');
  assert.ok(cssContent.includes('animation: claude-spin 1.1s linear infinite;'), 'Missing 1.1s linear infinite spin');
});

test('TypeScript spins Claude mark and fills gauge bar during running status', () => {
  assert.ok(tsContent.includes("aiMark.classList.toggle('spinning', isRunning)"), 'Missing spinning toggle');
  assert.ok(tsContent.includes('aiGaugeBar.style.strokeDashoffset'), 'Missing gauge fill calculation');
});

// 5. Visual Styling Parity
console.log('\n--- 5. Visual Styling Parity ---');
test('Tiles have 22px border radius and OLED black background #0c0d10', () => {
  assert.ok(cssContent.includes('border-radius: 22px;'), 'Missing 22px border radius');
  assert.ok(cssContent.includes('background: #0c0d10;'), 'Missing #0c0d10 background');
  assert.ok(cssContent.includes('border: 1px solid rgba(255, 255, 255, 0.1);'), 'Missing subtle rim stroke');
});

test('Tiles implement breathing dynamic bottom-rising gradient keyframes', () => {
  assert.ok(cssContent.includes('@keyframes card-music-breathe'), 'Missing card-music-breathe');
  assert.ok(cssContent.includes('@keyframes card-ai-breathe'), 'Missing card-ai-breathe');
  assert.ok(cssContent.includes('@keyframes card-focus-breathe'), 'Missing card-focus-breathe');
});

// 6. Top Header & Bottom Nav Parity
console.log('\n--- 6. Header & Bottom Nav Parity ---');
test('Header contains mini equalizer button #btn-header-music next to menu', () => {
  assert.ok(htmlContent.includes('id="btn-header-music"'), 'Missing #btn-header-music in HTML');
  assert.ok(tsContent.includes('btnHeaderMusic.classList.remove(\'hidden\')'), 'Missing header eq show logic in TS');
  assert.ok(tsContent.includes("this.showDomTab('music')"), 'Missing header eq navigation in TS');
});

test('Bottom Nav contains 76px slide-out volume scrubber', () => {
  assert.ok(htmlContent.includes('id="nav-vol-container"'), 'Missing #nav-vol-container in HTML');
  assert.ok(htmlContent.includes('id="nav-vol-track"'), 'Missing #nav-vol-track in HTML');
  assert.ok(cssContent.includes('width: 76px;'), 'Missing 76px slide-out width');
  assert.ok(tsContent.includes("window.roboIsland?.setVolume(level)"), 'Missing setVolume IPC trigger');
});

test('Bottom Nav tabs style active capsule with TwoCode tint colors', () => {
  assert.ok(cssContent.includes('.nav-item.active[data-tab="home"]'), 'Missing home tab capsule');
  assert.ok(cssContent.includes('.nav-item.active[data-tab="ai"]'), 'Missing ai tab capsule');
  assert.ok(cssContent.includes('.nav-item.active[data-tab="music"]'), 'Missing music tab capsule');
  assert.ok(cssContent.includes('.nav-item.active[data-tab="focus"]'), 'Missing focus tab capsule');
});

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
