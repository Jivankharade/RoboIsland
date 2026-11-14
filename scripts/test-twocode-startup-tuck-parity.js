// scripts/test-twocode-startup-tuck-parity.js
// Verification suite for exact TwoCode Startup Entrance, Spring Physics, Tuck-away Hiding & Idle Life
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const canvasEngineSrc = fs.readFileSync(path.join(ROOT, 'src/renderer/island/canvas-engine.ts'), 'utf-8');
const roboMascotSrc = fs.readFileSync(path.join(ROOT, 'src/renderer/island/robo-mascot.ts'), 'utf-8');
const audioSynthSrc = fs.readFileSync(path.join(ROOT, 'src/renderer/island/audio-synth.ts'), 'utf-8');
const bundleJs = fs.readFileSync(path.join(ROOT, 'dist/renderer/island/bundle.js'), 'utf-8');

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
console.log(' TWOCODE STARTUP, SPRING & TUCK-AWAY PARITY SUITE   ');
console.log('====================================================\n');

// 1. Zero Emoji Check
test('Zero Unicode Emojis in modified files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert(!emojiRegex.test(canvasEngineSrc), 'canvas-engine.ts contains emojis');
  assert(!emojiRegex.test(roboMascotSrc), 'robo-mascot.ts contains emojis');
  assert(!emojiRegex.test(audioSynthSrc), 'audio-synth.ts contains emojis');
  assert(!emojiRegex.test(bundleJs), 'bundle.js contains emojis');
});

// 2. Exact TwoCode 240Hz Sub-Stepping Spring Physics
test('Runge-Kutta / Euler 240Hz sub-stepping spring equation (mascot.html lines 1110-1138)', () => {
  assert(canvasEngineSrc.includes('Math.ceil(springDt / (1 / 240))'), 'Missing 240Hz sub-stepping steps calculation');
  assert(canvasEngineSrc.includes('growing ? 0.42 : 0.34'), 'Missing Apple response values (0.42 growing, 0.34 shrinking)');
  assert(canvasEngineSrc.includes('growing ? 0.86 : 1.0'), 'Missing TwoCode damping values (0.86 growing overshoot, 1.0 critically damped)');
  assert(canvasEngineSrc.includes('stiffness = Math.pow(2 * Math.PI / response, 2)'), 'Missing stiffness calculation');
  assert(canvasEngineSrc.includes('friction = 4 * Math.PI * damping / response'), 'Missing friction calculation');
});

// 3. TwoCode Jelly Wobble (twocode-fun.js lines 347-372)
test('Jelly wobble kicks and spring function', () => {
  assert(canvasEngineSrc.includes('twoCodeSpring(ms: number, amp: number, hz = 3, damp = 6)'), 'Missing twoCodeSpring definition');
  assert(canvasEngineSrc.includes('kickJelly'), 'Missing kickJelly method');
  assert(canvasEngineSrc.includes('currentWidth * (1 + jelly)'), 'Missing width expansion under jelly kick');
  assert(canvasEngineSrc.includes('currentHeight * (1 - jelly * 1.4)'), 'Missing height squash under jelly kick');
});

// 4. TwoCode Windows Startup Entrance Animation (twocode-fun.js lines 305-404)
test('Exact TwoCode startHello sequence & timing (HELLO = { land: 380, hi: 700, tilt: 1300, wink: 2000, end: 2700 })', () => {
  assert(canvasEngineSrc.includes('public startHello(): void'), 'Missing startHello declaration');
  assert(canvasEngineSrc.includes('this.setMode(\'compact\')'), 'startHello must expand to compact');
  assert(canvasEngineSrc.includes('this.kickJelly(0.12)'), 'startHello must kick jelly wobble');
  assert(canvasEngineSrc.includes('blobTone(180, 620, 0.16, 0.06)'), 'startHello bloop opening sound');
  assert(canvasEngineSrc.includes('blobTone(520, 240, 0.08, 0.05)'), 'startHello plop landing sound');
  assert(canvasEngineSrc.includes('AudioSynth.getInstance().sayHi()'), 'startHello sayHi upward chirp');
  assert(canvasEngineSrc.includes('this.mascot.setMood(\'wink\')'), 'startHello wink mood');
  assert(canvasEngineSrc.includes('blobTone(900, 1300, 0.05, 0.025)'), 'startHello wink blip tone');
  assert(canvasEngineSrc.includes('this.setMode(\'rest\')'), 'startHello settle back to rest');
  assert(canvasEngineSrc.includes('this.kickJelly(0.07, 3)'), 'startHello settle wobble');
});

// 5. Mascot Ease-Out-Back Pop & Squash & Stretch During Entrance (twocode-fun.js lines 569-598)
test('Ease-out-back pop & squash & stretch math', () => {
  assert(canvasEngineSrc.includes('1 + 2.70158 * Math.pow(pop - 1, 3) + 1.70158 * Math.pow(pop - 1, 2)'), 'Missing ease-out-back pop formula');
  assert(canvasEngineSrc.includes('twoCodeSpring(k - 380, 0.3, 3.2, 7)'), 'Missing land squash spring');
  assert(canvasEngineSrc.includes('twoCodeSpring(k - 700, -0.22, 3, 6)'), 'Missing hi stretch spring');
  assert(canvasEngineSrc.includes('Math.sin(hop * Math.PI) * 7'), 'Missing hi hop jump');
  assert(canvasEngineSrc.includes('Math.sin(hehe * Math.PI * 2) * 0.22 * (1 - hehe)'), 'Missing cute head tilt');
  assert(canvasEngineSrc.includes('\'#ff7eb6\''), 'Missing floating pink heart color');
  assert(canvasEngineSrc.includes('bezierCurveTo(-9, -3, -5, -11, 0, -6)'), 'Missing exact TwoCode pink heart bezier geometry');
});

// 6. TwoCode Tuck-Away Feature (tuck-ui.js lines 1-80)
test('TwoCode tuck-away hiding feature and full click-through', () => {
  assert(canvasEngineSrc.includes('public setTucked(tucked: boolean)'), 'Missing setTucked declaration');
  assert(canvasEngineSrc.includes('this.tuckChangedAt = performance.now()'), 'Missing tuckChangedAt timestamp');
  assert(canvasEngineSrc.includes('this.tuckArmed = false'), 'Missing tuckArmed flag');
  assert(canvasEngineSrc.includes('ZONE_W = 160, ZONE_H = 10, BACK_AFTER = 450'), 'Missing TwoCode tuck zone constants in hit-test');
  assert(canvasEngineSrc.includes('this.setTucked(false)'), 'Missing auto-restore after 450ms hover');
  assert(canvasEngineSrc.includes('roundRect(cx - w / 2, 2, w, 4, 2)'), 'Missing 56x4px line rendering');
  assert(canvasEngineSrc.includes('window.roboIsland.setInteractive(shouldBeInteractive)'), 'Missing setInteractive forwarding for click-through');
  assert(canvasEngineSrc.includes('window.addEventListener(\'contextmenu\''), 'Missing right-click contextmenu event listener');
});

// 7. TwoCode Idle Life Random Blinking and Winking (twocode-fun.js lines 537-546 & mascot.html lines 1999-2043)
test('TwoCode idleLife random blinking and winking', () => {
  assert(roboMascotSrc.includes('public idleLife(t: number, mood: MascotMood): MascotMood'), 'Missing idleLife method');
  assert(roboMascotSrc.includes('Math.random() < 0.004 ? \'wink\' : \'blink\''), 'Missing TwoCode wink vs blink random selector');
  assert(roboMascotSrc.includes('arc(0, -2, 5, Math.PI * 0.15, Math.PI * 0.85)'), 'Missing exact TwoCode sleep/blink eye arc');
  assert(roboMascotSrc.includes('moveTo(-5, 2)') && roboMascotSrc.includes('lineTo(5, 2)'), 'Missing exact TwoCode wink flat line');
});

// 8. Procedural Chirp and Audio Synth
test('Procedural chirp and Kirby-like sayHi audio', () => {
  assert(audioSynthSrc.includes('public chirp(at: number, from: number, to: number, dur: number'), 'Missing chirp method');
  assert(audioSynthSrc.includes('chirp(0, 760, 1180, 0.09)'), 'Missing first harmonic of sayHi');
  assert(audioSynthSrc.includes('chirp(0.085, 1180, 1580, 0.2, 28)'), 'Missing second trill of sayHi');
  assert(audioSynthSrc.includes('public blobTone('), 'Missing blobTone method');
});

console.log(`\n====================================================`);
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`====================================================\n`);

if (failed > 0) {
  process.exit(1);
}
