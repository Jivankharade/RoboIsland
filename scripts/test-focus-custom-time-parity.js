/**
 * Test Suite: TwoCode Focus Custom Time Selection & Home Card Parity
 * Verifies custom duration picker, preset chips, +5m extension, instant start/pause toggle,
 * single-source-of-truth FocusEngine, and strict Zero-Emoji compliance.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { FocusUI, SVG_ICONS } = require(path.join(root, 'dist/renderer/island/focus-ui.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failed++;
  }
}

console.log('====================================================');
console.log(' TWOCODE FOCUS CUSTOM TIME & HOME CARD TEST SUITE   ');
console.log('====================================================\n');

console.log('--- 1. Testing Zero-Emoji Compliance Across Focus Files ---');
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

function assertNoEmoji(relPath) {
  const content = fs.readFileSync(path.join(root, relPath), 'utf8');
  const match = content.match(EMOJI_REGEX);
  assert(!match, `Emoji detected in ${relPath}: "${match ? match[0] : ''}"`);
}

test('src/renderer/island/focus-ui.ts has zero emojis', () => {
  assertNoEmoji('src/renderer/island/focus-ui.ts');
});

test('src/renderer/island/canvas-engine.ts has zero emojis', () => {
  assertNoEmoji('src/renderer/island/canvas-engine.ts');
});

test('src/renderer/island/index.html has zero emojis', () => {
  assertNoEmoji('src/renderer/island/index.html');
});

test('src/renderer/island/island.css has zero emojis', () => {
  assertNoEmoji('src/renderer/island/island.css');
});

console.log('\n--- 2. Testing Custom Time Selection & Presets ---');

test('FocusUI defaults to 25 minutes (1500s)', () => {
  const ui = new FocusUI();
  const state = ui.getPomodoroState();
  assert.strictEqual(state.timeRemaining, 1500);
  assert.strictEqual(state.totalDuration, 1500);
  assert.strictEqual(state.status, 'idle');
});

test('Choosing custom duration (e.g. 15 min, 45 min, 90 min) updates idle time', () => {
  const ui = new FocusUI();
  ui.chooseDuration(15 * 60);
  assert.strictEqual(ui.getPomodoroState().timeRemaining, 900);
  assert.strictEqual(ui.getPomodoroState().totalDuration, 900);

  ui.chooseDuration(45 * 60);
  assert.strictEqual(ui.getPomodoroState().timeRemaining, 2700);
  assert.strictEqual(ui.getPomodoroState().totalDuration, 2700);

  ui.chooseDuration(90 * 60);
  assert.strictEqual(ui.getPomodoroState().timeRemaining, 5400);
  assert.strictEqual(ui.getPomodoroState().totalDuration, 5400);
});

test('addSeconds (+300s / -300s) adjusts duration by 5 minutes', () => {
  const ui = new FocusUI();
  ui.chooseDuration(25 * 60); // 1500s
  ui.addSeconds(300); // 1800s (30m)
  assert.strictEqual(ui.getPomodoroState().timeRemaining, 1800);

  ui.addSeconds(-300); // 1500s (25m)
  assert.strictEqual(ui.getPomodoroState().timeRemaining, 1500);
});

test('addSeconds while running dynamically extends active session', () => {
  const ui = new FocusUI();
  ui.chooseDuration(1500);
  ui.startTimer();
  assert.strictEqual(ui.getPomodoroState().status, 'running');

  ui.tick(); // 1499s
  assert.strictEqual(ui.getPomodoroState().timeRemaining, 1499);

  // User clicks +5 min button during session
  ui.addSeconds(300);
  assert.strictEqual(ui.getPomodoroState().timeRemaining, 1799);
  assert.strictEqual(ui.getPomodoroState().totalDuration, 1800);
  ui.resetTimer();
});

test('formatLabel handles seconds, minutes, and hours accurately', () => {
  const ui = new FocusUI();
  assert.strictEqual(ui.formatLabel(45), '0:45');
  assert.strictEqual(ui.formatLabel(900), '15:00');
  assert.strictEqual(ui.formatLabel(1500), '25:00');
  assert.strictEqual(ui.formatLabel(3600), '1:00:00');
  assert.strictEqual(ui.formatLabel(3665), '1:01:05');
});

console.log('\n--- 3. Testing TwoCode FocusEngine API Synchronization ---');

test('exposeFocusEngine attaches full TwoCode parity API', () => {
  const mockWin = {};
  global.window = mockWin;
  const ui = new FocusUI();
  ui.exposeFocusEngine();

  assert(mockWin.__roboFocus, 'Must export __roboFocus');
  assert(mockWin.__twocodeFocus, 'Must export __twocodeFocus');

  const f = mockWin.__roboFocus;
  assert.strictEqual(f.active(), false);
  assert.strictEqual(f.chosen(), 1500);
  assert.strictEqual(f.minutes(), 25);
  assert.strictEqual(f.label(), '25:00');

  // Test choose
  f.choose(3000); // 50m
  assert.strictEqual(f.chosen(), 3000);
  assert.strictEqual(f.minutes(), 50);
  assert.strictEqual(f.label(), '50:00');

  // Test toggle start
  f.toggle();
  assert.strictEqual(f.active(), true);

  // Test add
  f.add(300);
  assert.strictEqual(f.chosen(), 3000);

  // Test toggle stop
  f.toggle();
  assert.strictEqual(f.active(), false);
  delete global.window;
});

console.log('\n--- 4. Testing HTML Template & DOM Elements ---');

test('renderTimerBodyHtml renders TwoCode wheel and running views', () => {
  const ui = new FocusUI();
  // Idle view
  const idleHtml = ui.renderTimerBodyHtml();
  assert(idleHtml.includes('fo-wheel'), 'Must contain TwoCode wheel container');
  assert(idleHtml.includes('fo-band'), 'Must contain selection band');
  assert(idleHtml.includes('data-col="h"'), 'Must contain hours column');
  assert(idleHtml.includes('data-col="m"'), 'Must contain minutes column');
  assert(idleHtml.includes('data-set="1500"'), 'Must contain 25m reset button');
  assert(idleHtml.includes('data-start="1"'), 'Must contain start button');
  assert(idleHtml.includes('data-set="300"'), 'Must contain 5 min chip');
  assert(idleHtml.includes('data-set="900"'), 'Must contain 15 min chip');
  assert(idleHtml.includes('data-set="3000"'), 'Must contain 50 min chip');

  // Running view
  ui.startTimer();
  const runHtml = ui.renderTimerBodyHtml();
  assert(runHtml.includes('data-stop="1"'), 'Must contain stop button');
  assert(runHtml.includes('data-plus="300"'), 'Must contain +5 min button');
  assert(runHtml.includes('id="fo-left"'), 'Must contain countdown digits');
  assert(runHtml.includes('id="fo-ring"'), 'Must contain shrinking progress bar');
  assert(runHtml.includes('fo-hint'), 'Must contain hint text');
  ui.resetTimer();
});

test('index.html contains #panel-focus and loads focus-ui.bundle.js', () => {
  const html = fs.readFileSync(path.join(root, 'src/renderer/island/index.html'), 'utf8');
  assert(html.includes('id="panel-focus"'), 'index.html must declare #panel-focus');
  assert(html.includes('src="focus-ui.bundle.js"'), 'index.html must load focus-ui.bundle.js');
});

test('scripts/build.js bundles focus-ui.ts with esbuild', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.js'), 'utf8');
  assert(build.includes('src/renderer/island/focus-ui.ts'), 'build.js must include focus-ui.ts');
  assert(build.includes('dist/renderer/island/focus-ui.bundle.js'), 'build.js must output focus-ui.bundle.js');
});

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) process.exit(1);
