/**
 * RoboIsland Mega Update Verification Suite (`scripts/test-twocode-mega-features.js`)
 * 
 * Verifies parity with TwoCode:
 * 1. Zero Unicode Emoji Compliance.
 * 2. Procedural Web Audio Engine (12 Melodies, 3 Sound Packs, Confetti).
 * 3. Dynamic Environmental Reactive Textures (Fire/Ice, Spider Web, Overgrown).
 * 4. Configurable Resting Island Telemetry Slots (Battery, Wi-Fi, Bluetooth Glyphs).
 * 5. Spotify Connect Device Switcher UI & IPC transfer methods.
 * 6. Detachable Desktop Buddy drag-out & state management.
 * 7. Focus Guard Mindful Distraction Breathing Interceptor.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`[PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${desc}: ${err.message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('     ROBOISLAND TWOCODE MEGA UPGRADE SUITE          ');
console.log('====================================================\n');

// 1. Zero-Emoji Compliance
console.log('--- 1. Testing Zero-Emoji Compliance ---');
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
const FILES_TO_CHECK = [
  'src/renderer/island/audio-synth.ts',
  'src/renderer/island/texture-engine.ts',
  'src/renderer/island/canvas-engine.ts',
  'src/renderer/island/media-ui.ts',
  'src/renderer/island/index.html',
  'src/renderer/island/island.css',
  'src/renderer/settings/settings.html',
  'src/renderer/settings/settings-ui.ts',
  'src/main/config-store.ts',
  'src/main/buddy-manager.ts',
  'src/main/focus-guard.ts',
  'src/preload/island-preload.ts'
];

FILES_TO_CHECK.forEach((rel) => {
  it(`${rel} contains zero unicode emojis`, () => {
    const full = path.join(ROOT, rel);
    const text = fs.readFileSync(full, 'utf8');
    assert.strictEqual(EMOJI_REGEX.test(text), false, `Emoji found in ${rel}`);
  });
});

// 2. Procedural Web Audio Engine
console.log('\n--- 2. Testing Procedural Web Audio Engine ---');
const audioSynthCode = fs.readFileSync(path.join(ROOT, 'src/renderer/island/audio-synth.ts'), 'utf8');

it('audio-synth.ts defines AudioSynth singleton', () => {
  assert.ok(audioSynthCode.includes('class AudioSynth'));
  assert.ok(audioSynthCode.includes('public static getInstance(): AudioSynth'));
});

it('audio-synth.ts supports all 12 TwoCode melodies', () => {
  const melodies = ['pop', 'done', 'question', 'error', 'party', 'warn', 'hello', 'badge', 'yum', 'send', 'reply', 'fix'];
  melodies.forEach((m) => {
    assert.ok(audioSynthCode.includes(`${m}:`), `Missing melody ${m}`);
  });
});

it('audio-synth.ts supports 3 TwoCode sound packs (klassiek, zacht, belletjes)', () => {
  assert.ok(audioSynthCode.includes('klassiek:'));
  assert.ok(audioSynthCode.includes('zacht:'));
  assert.ok(audioSynthCode.includes('belletjes:'));
});

it('audio-synth.ts provides launchConfetti particle system', () => {
  assert.ok(audioSynthCode.includes('launchConfetti('));
});

// 3. Dynamic Environmental Reactive Textures
console.log('\n--- 3. Testing Dynamic Environmental Reactive Textures ---');
const textureCode = fs.readFileSync(path.join(ROOT, 'src/renderer/island/texture-engine.ts'), 'utf8');

it('texture-engine.ts defines TextureEngine singleton', () => {
  assert.ok(textureCode.includes('class TextureEngine'));
  assert.ok(textureCode.includes('public static getInstance(): TextureEngine'));
});

it('texture-engine.ts implements Fire & Ice reactive shader', () => {
  assert.ok(textureCode.includes('renderFireIceBehind('));
});

it('texture-engine.ts implements Spider Web nighttime shader', () => {
  assert.ok(textureCode.includes('renderWebs('));
});

it('texture-engine.ts implements Overgrown organic session shader', () => {
  assert.ok(textureCode.includes('renderVines('));
});

it('canvas-engine.ts renders texture background in drawIslandPill', () => {
  const canvasCode = fs.readFileSync(path.join(ROOT, 'src/renderer/island/canvas-engine.ts'), 'utf8');
  assert.ok(canvasCode.includes('TextureEngine.getInstance().renderBehind(this.ctx, left, topY, w, h, r)'));
});

// 4. Configurable Resting Telemetry Slots
console.log('\n--- 4. Testing Configurable Resting Telemetry Slots ---');
const canvasCode = fs.readFileSync(path.join(ROOT, 'src/renderer/island/canvas-engine.ts'), 'utf8');

it('canvas-engine.ts defines drawBatteryGlyph vector renderer', () => {
  assert.ok(canvasCode.includes('public drawBatteryGlyph('));
});

it('canvas-engine.ts defines drawWifiGlyph vector renderer', () => {
  assert.ok(canvasCode.includes('public drawWifiGlyph('));
});

it('canvas-engine.ts defines drawBtGlyph vector renderer', () => {
  assert.ok(canvasCode.includes('public drawBtGlyph('));
});

it('canvas-engine.ts measures and renders configurable rest slots', () => {
  assert.ok(canvasCode.includes('public calculateRestWidth(): number'));
  assert.ok(canvasCode.includes('public drawRestTelemetryItem('));
});

// 5. Spotify Connect Device Switcher UI & IPC
console.log('\n--- 5. Testing Spotify Connect Device Switcher ---');
const mediaUiCode = fs.readFileSync(path.join(ROOT, 'src/renderer/island/media-ui.ts'), 'utf8');

it('media-ui.ts contains Spotify device switcher button and popover HTML', () => {
  assert.ok(mediaUiCode.includes('id="btn-spotify-devices"'));
  assert.ok(mediaUiCode.includes('id="spotify-device-picker"'));
});

it('media-ui.ts implements refreshSpotifyDevices and renderDeviceList', () => {
  assert.ok(mediaUiCode.includes('public async refreshSpotifyDevices()'));
  assert.ok(mediaUiCode.includes('private renderDeviceList(devices: any[])'));
});

it('media-ui.ts implements transferToDevice with one-click IPC switch', () => {
  assert.ok(mediaUiCode.includes('public async transferToDevice(deviceId: string, deviceName: string)'));
  assert.ok(mediaUiCode.includes('api.transferSpotifyPlayback(deviceId)'));
});

// 6. Swipe Gestures & Desktop Buddy Drag-Out
console.log('\n--- 6. Testing Swipe Gestures & Desktop Buddy Drag-Out ---');

it('canvas-engine.ts detects trackpad horizontal wheel and mouse swipe for tracks', () => {
  assert.ok(canvasCode.includes('Math.abs(dx) > 48 && Math.abs(dy) < 36 && isMusicActive'));
  assert.ok(canvasCode.includes('Math.abs(e.deltaX) > 60 && Math.abs(e.deltaX) > Math.abs(e.deltaY)'));
});

it('canvas-engine.ts initiates buddyGrab when dragging down on eyes', () => {
  assert.ok(canvasCode.includes('api?.buddyGrab?.()'));
  assert.ok(canvasCode.includes('this.isBuddyOut = true;'));
});

it('canvas-engine.ts hides eyes in capsule while isBuddyOut is true', () => {
  assert.ok(canvasCode.includes('if (this.isBuddyOut)'));
});

it('buddy-manager.ts handles buddy:drop IPC event', () => {
  const buddyMgrCode = fs.readFileSync(path.join(ROOT, 'src/main/buddy-manager.ts'), 'utf8');
  assert.ok(buddyMgrCode.includes("ipcMain.on('buddy:drop', () => {"));
});

// 7. Focus Guard Mindful Distraction Interceptor
console.log('\n--- 7. Testing Focus Guard Mindful Distraction Interceptor ---');
const indexHtmlCode = fs.readFileSync(path.join(ROOT, 'src/renderer/island/index.html'), 'utf8');

it('index.html contains #focus-guard-modal with breathing circle', () => {
  assert.ok(indexHtmlCode.includes('id="focus-guard-modal"'));
  assert.ok(indexHtmlCode.includes('id="guard-breath-ring"'));
  assert.ok(indexHtmlCode.includes('id="btn-guard-back"'));
  assert.ok(indexHtmlCode.includes('id="btn-guard-anyway"'));
});

it('canvas-engine.ts handles onFocusDistraction and triggers breathing pause', () => {
  assert.ok(canvasCode.includes('islandApi.onFocusDistraction('));
  assert.ok(canvasCode.includes('public triggerMindfulDistractionPause('));
});

it('focus-guard.ts supports emergency override and minimize IPC', () => {
  const guardCode = fs.readFileSync(path.join(ROOT, 'src/main/focus-guard.ts'), 'utf8');
  assert.ok(guardCode.includes("ipc.handle('focus:emergency-override'"));
  assert.ok(guardCode.includes("ipc.handle('focus:minimize'"));
});

console.log('\n====================================================');
console.log(`MEGA UPGRADE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
}
