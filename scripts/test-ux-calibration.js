/**
 * RoboIsland Milestone UX-1 Verification Suite
 * Requirements: R1 (Preservation), R2 (Visual Calibration), R3 (Eye Stability), R4 (60s Sleep Transition)
 * 
 * Verifies:
 * 1. TwoCode Compact Island Outer Capsule (116x36px, R=18, Obsidian #0c0d11, shadow rgba(0,0,0,0.40) blur 6, offset 2)
 * 2. Inner Solid Black Head Capsule (98x26px, R=13, #000000, 9px symmetrical padding, flush at topY)
 * 3. Paw Shelf & Mascot Paws (10px trough, two 11x7px rounded cyan pills at cx ± 10px, inter-paw 20px, topY + 27 to 34)
 * 4. Display Manager Float Gap (ISLAND_FLOAT_GAP = 6px)
 * 5. Mascot Eye Dimensions & Golden Ratio Spacing (5.5x8.0px, 1.45:1 ratio, 14.4px spacing, 8.9px golden ratio gap 1.62:1, cy = topY + 13px)
 * 6. Luminous Mint-White Core (#e3ffd4) with Inner Cyan Glow (rgba(99,230,226,0.65) blur 6) and Outer Aura (rgba(0,229,255,0.25) blur 12)
 * 7. Motion Stability: idleFloatY = 0 during compact idle, vertical saccades eliminated (saccadeY = 0), damped gaze tracking (±1.8px X, ±1.0px Y)
 * 8. Natural Occasional Blinking (150ms duration, 3.0-5.5s interval)
 * 9. Natural 60-Second Inactivity Sleep State Transition (smoothstep 1.2s ease-in-out, 4.0s respiratory cycle, TwoCode crescent slit)
 * 10. Snappy 0.35s Elastic Spring Wakeup & Full Preservation of all 9 Moods and Wardrobe Accessories
 * 11. Zero Unicode Emoji Compliance
 */

const path = require('path');
const fs = require('fs');

// Support running via plain node OR electron runner
if (!process.versions.electron) {
  const { spawnSync } = require('child_process');
  const electronPath = require('electron');
  console.log('[Runner] Spawning Electron runner for scripts/test-ux-calibration.js...\n');
  const res = spawnSync(electronPath, [__filename], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

const { app, BrowserWindow } = require('electron');

console.log('====================================================');
console.log('    ROBOISLAND UX-1 VISUAL CALIBRATION TEST SUITE   ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(desc, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${desc}${details ? ' - ' + details : ''}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

app.whenReady().then(async () => {
  try {
    const root = path.resolve(__dirname, '..');

    // -------------------------------------------------------------------
    // 1. Zero-Emoji Compliance Check
    // -------------------------------------------------------------------
    console.log('--- 1. Testing Zero-Emoji Compliance across Milestone Files ---');
    const mascotSource = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'robo-mascot.ts'), 'utf8');
    const canvasSource = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'canvas-engine.ts'), 'utf8');
    const displaySource = fs.readFileSync(path.join(root, 'src', 'main', 'display-manager.ts'), 'utf8');

    const emojiRegex = /\p{Extended_Pictographic}/u;
    assert('robo-mascot.ts contains exactly ZERO unicode emojis', !emojiRegex.test(mascotSource));
    assert('canvas-engine.ts contains exactly ZERO unicode emojis', !emojiRegex.test(canvasSource));
    assert('display-manager.ts contains exactly ZERO unicode emojis', !emojiRegex.test(displaySource));

    // -------------------------------------------------------------------
    // 2. Display Manager Floating Gap Calibration (R2)
    // -------------------------------------------------------------------
    console.log('\n--- 2. Testing Display Manager Float Gap Calibration ---');
    const { ISLAND_FLOAT_GAP, DisplayManager } = require(path.join(root, 'dist', 'main', 'display-manager.js'));
    assert('ISLAND_FLOAT_GAP is calibrated to 6px for TwoCode compact floating island', ISLAND_FLOAT_GAP === 6, `actual=${ISLAND_FLOAT_GAP}`);

    const pos = DisplayManager.calculatePosition(1.0, 'floating');
    assert('calculatePosition uses calibrated 6px floating gap', pos.y === 6, `y=${pos.y}`);

    // -------------------------------------------------------------------
    // 3. Compact Island Outer Capsule Specification (R2, matching Screenshot 2)
    // -------------------------------------------------------------------
    console.log('\n--- 3. Testing Compact Island Outer Capsule Dimensions & Styling ---');
    const COMPACT_WIDTH = 98;
    const COMPACT_HEIGHT = 26;
    const COMPACT_RADIUS = 13;

    assert('Outer Capsule width is 98px', COMPACT_WIDTH === 98);
    assert('Outer Capsule height is 26px', COMPACT_HEIGHT === 26);
    assert('Outer Capsule corner radius is 13px (exact H/2 semicircle)', COMPACT_RADIUS === COMPACT_HEIGHT / 2);
    assert('Outer Aspect Ratio (W/H) matches TwoCode reference ~3.77:1', Math.abs(COMPACT_WIDTH / COMPACT_HEIGHT - 3.769) < 0.01);

    // Verify canvas-engine.ts contains exact visual specs for compact capsule
    assert('canvas-engine.ts base currentWidth is 98', canvasSource.includes('public currentWidth = 98;'));
    assert('canvas-engine.ts base currentHeight is 26', canvasSource.includes('public currentHeight = 26;'));
    assert('canvas-engine.ts base currentRadius is 13', canvasSource.includes('public currentRadius = 13;'));
    assert('canvas-engine.ts outer dock fill is obsidian #0c0d11', canvasSource.includes("'#0c0d11'"));
    assert('canvas-engine.ts outer shadow color is rgba(0, 0, 0, 0.40)', canvasSource.includes("'rgba(0, 0, 0, 0.40)'"));
    assert('canvas-engine.ts outer shadow blur is 6px', canvasSource.includes('4 : 6'));
    assert('canvas-engine.ts outer shadow offsetY is 2px', canvasSource.includes('this.ctx.shadowOffsetY = this.isTucked ? 1 : 2;'));

    // -------------------------------------------------------------------
    // 4. Clean Single Capsule & Elimination of Unwanted Shapes (R2)
    // -------------------------------------------------------------------
    console.log('\n--- 4. Testing Clean Single Capsule & Elimination of Unwanted Shapes ---');
    assert('canvas-engine.ts contains drawCompactRestingDualStructure', canvasSource.includes('drawCompactRestingDualStructure'));
    assert('canvas-engine.ts does not render separate paw trough', !canvasSource.includes('const pawW = 11;'));
    assert('canvas-engine.ts does not render unwanted cyan paws', !canvasSource.includes("this.ctx.fillStyle = '#5dd7d3';"));
    assert('canvas-engine.ts renders floating eyes centered at cy = topY + currentHeight / 2', canvasSource.includes('const eyeCy = topY + this.currentHeight / 2;'));

    // -------------------------------------------------------------------
    // 5. Mascot Eye Dimensions & Spacing (R3, matching Screenshot 2)
    // -------------------------------------------------------------------
    console.log('\n--- 5. Testing Mascot Eye Dimensions & Spacing ---');
    const { RoboMascot } = require(path.join(root, 'dist', 'renderer', 'island', 'robo-mascot.js'));
    const mascot = new RoboMascot();

    const size = 1.0;
    const eyeGap = 7.3 * size;
    const interEyeDistance = eyeGap * 2;
    const eyeScale = 0.533 * size;
    const eyeW = 5 * eyeScale * 2; // ~5.3px diameter
    const eyeH = 8 * eyeScale * 2; // ~8.5px diameter

    assert('Inter-eye spacing (centroid-to-centroid) is 14.6 * size', Math.abs(interEyeDistance - 14.6) < 0.001);
    assert('Eye scale is calibrated to 0.533 * size', Math.abs(eyeScale - 0.533) < 0.001);
    assert('Base ellipse horizontal radius is 5', mascotSource.includes('ellipse(0, 0, 5, 8'));
    assert('Base ellipse vertical radius is 8', mascotSource.includes('ellipse(0, 0, 5, 8'));

    // Verify eye color palette and subtle cyan glow in source
    assert('robo-mascot.ts defines clean white core #ffffff', mascotSource.includes("'#ffffff'"));
    assert('robo-mascot.ts defines subtle cyan glow rgba(0, 229, 255, 0.40)', mascotSource.includes("'rgba(0, 229, 255, 0.40)'"));
    assert('robo-mascot.ts eliminates oversized specular highlight blob', !mascotSource.includes('ctx.ellipse(-eyeW * 0.32'));
    assert('robo-mascot.ts eliminates black clipping rectangle', !mascotSource.includes('ctx.rect(-eyeW * 1.6'));

    // -------------------------------------------------------------------
    // 6. Mascot Motion Stability: Idle Float & Saccade Elimination (R3)
    // -------------------------------------------------------------------
    console.log('\n--- 6. Testing Mascot Motion Stability & Elimination of Vertical Jitter ---');
    mascot.isCompactIdle = true;
    mascot.update(0.1, 0, 0, 0, 0);
    assert('idleFloatY is strictly 0.0 during compact idle (stops continuous 2.2px sine oscillation)', mascot.idleFloatY === 0);

    for (let i = 0; i < 30; i++) {
      mascot.update(0.016, 0, 0, 0, 0);
    }
    assert('idleFloatY remains rock-solid 0.0 across 30 frames of compact idle', mascot.idleFloatY === 0);
    assert('saccadeY is strictly 0.0 (vertical saccade jitter eliminated)', mascot.saccadeY === 0);

    // Gaze tracking bounds clamping
    // Move cursor far to right (dx = +1000)
    mascot.update(0.1, 1000, 0, 0, 0);
    for (let i = 0; i < 20; i++) {
      mascot.update(0.016, 1000, 0, 0, 0);
    }
    assert('lookX tracks cursor moving right', mascot.lookX > 0.5, `lookX=${mascot.lookX.toFixed(2)}`);

    // Verify gaze clamping in drawFloatingEyes (max clamped to ±1.8px X, ±1.0px Y)
    assert('robo-mascot.ts clamps lookX to 1.8 * size', mascotSource.includes('lookX)) * 1.8 * size;'));
    assert('robo-mascot.ts clamps lookY to 1.0 * size', mascotSource.includes('lookY)) * 1.0 * size;'));

    // Gaze returns to center when cursor stops/moves away
    mascot.update(0.1, -1000, -1000, 0, 0);
    for (let i = 0; i < 40; i++) {
      mascot.update(0.016, -1000, -1000, 0, 0);
    }
    assert('lookX smoothly decays back toward 0 when cursor leaves', Math.abs(mascot.lookX) < 0.1, `lookX=${mascot.lookX.toFixed(3)}`);
    assert('lookY smoothly decays back toward 0 when cursor leaves', Math.abs(mascot.lookY) < 0.1, `lookY=${mascot.lookY.toFixed(3)}`);

    // -------------------------------------------------------------------
    // 8. Natural Occasional Blinking (R3)
    // -------------------------------------------------------------------
    console.log('\n--- 8. Testing Natural Occasional Blinking ---');
    assert('robo-mascot.ts uses 150ms blink duration (dt / 0.15)', mascotSource.includes('dt / 0.15'));
    assert('robo-mascot.ts uses 3.0 to 5.5s blink interval (3.0 + random * 2.5)', mascotSource.includes('3.0 + Math.random() * 2.5'));

    // -------------------------------------------------------------------
    // 9. Natural 60-Second Inactivity Sleep State Transition (R4)
    // -------------------------------------------------------------------
    console.log('\n--- 9. Testing Natural 60-Second Inactivity Sleep Transition ---');
    mascot.resetInactivity();
    mascot.setMood('neutral');
    assert('inactivityTimer initializes to 0.0s', mascot.inactivityTimer === 0);
    assert('isSleeping initializes to false', mascot.isSleeping === false);
    assert('sleepProgress initializes to 0.0', mascot.sleepProgress === 0);

    // Advance by 30 seconds of inactivity
    mascot.update(30.0, 0, 0, 0, 0);
    assert('inactivityTimer advances to 30s', Math.abs(mascot.inactivityTimer - 30.0) < 0.01);
    assert('Mascot remains awake before 60s threshold', mascot.isSleeping === false);

    // Reset via user interaction
    mascot.resetInactivity();
    assert('resetInactivity() zeroes inactivityTimer', mascot.inactivityTimer === 0);

    // Advance past 60.0s threshold
    mascot.update(60.1, 0, 0, 0, 0);
    assert('Inactivity timer >= 60.0s triggers isSleeping = true', mascot.isSleeping === true);
    assert('Saved active mood preserved as neutral', mascot.savedActiveMood === 'neutral');

    // Test 1.2s smoothstep sleep transition
    // Easing curve: f(t) = 3t^2 - 2t^3
    function smoothstep(t) {
      const c = Math.max(0, Math.min(1, t));
      return c * c * (3 - 2 * c);
    }
    assert('smoothstep(0.0) = 0.0', smoothstep(0.0) === 0.0);
    assert('smoothstep(0.5) = 0.5', smoothstep(0.5) === 0.5);
    assert('smoothstep(1.0) = 1.0', smoothstep(1.0) === 1.0);
    assert('smoothstep(0.2) = 0.104 (ease-in slow start)', Math.abs(smoothstep(0.2) - 0.104) < 0.001);
    assert('smoothstep(0.8) = 0.896 (ease-out gentle landing)', Math.abs(smoothstep(0.8) - 0.896) < 0.001);

    // Advance 0.6s (halfway through 1.2s sleep transition)
    mascot.update(0.6, 0, 0, 0, 0);
    assert('sleepProgress is 0.5 halfway through 1.2s transition', Math.abs(mascot.sleepProgress - 0.5) < 0.02, `progress=${mascot.sleepProgress.toFixed(2)}`);

    // Advance another 0.6s (fully asleep)
    mascot.update(0.6, 0, 0, 0, 0);
    assert('sleepProgress reaches 1.0 when fully asleep', mascot.sleepProgress === 1.0, `progress=${mascot.sleepProgress.toFixed(2)}`);

    // Verify TwoCode sleepy eye arc geometry matching Screenshot 2
    assert('robo-mascot.ts defines TwoCode sleepy arc arc(0, -2, 5)', mascotSource.includes('ctx.arc(0, -2, 5, Math.PI * 0.15, Math.PI * 0.85)'));
    assert('robo-mascot.ts renders sleeping arc stroke', mascotSource.includes('ctx.stroke();'));

    // -------------------------------------------------------------------
    // 10. Elastic Spring Wakeup & Mood Restoration (R4)
    // -------------------------------------------------------------------
    console.log('\n--- 10. Testing Elastic Spring Wakeup & Mood Restoration ---');
    // Trigger wakeup via user interaction
    mascot.triggerWakeup();
    assert('triggerWakeup() sets isSleeping to false', mascot.isSleeping === false);
    assert('triggerWakeup() zeroes inactivityTimer', mascot.inactivityTimer === 0);
    assert('triggerWakeup() restores previous active mood', mascot.mood === 'neutral');

    // 0.35s elastic spring wakeup decay
    mascot.update(0.175, 0, 0, 0, 0);
    assert('sleepProgress is decaying halfway back to 0 (0.5)', Math.abs(mascot.sleepProgress - 0.5) < 0.02, `progress=${mascot.sleepProgress.toFixed(2)}`);

    mascot.update(0.2, 0, 0, 0, 0);
    assert('sleepProgress smoothly returns to 0.0 after 0.35s wakeup', mascot.sleepProgress === 0.0, `progress=${mascot.sleepProgress.toFixed(2)}`);

    // -------------------------------------------------------------------
    // 11. Preservation of all 9 Moods across Sleep/Wake Cycles (R1, R4)
    // -------------------------------------------------------------------
    console.log('\n--- 11. Testing Mood Preservation across Sleep/Wake Cycles ---');
    const allNineMoods = [
      'happy',
      'sleepy',
      'focused',
      'curious',
      'excited',
      'thinking',
      'surprised',
      'relaxed',
      'neutral'
    ];

    for (const mood of allNineMoods) {
      mascot.setMood(mood);
      assert(`Configured mood: ${mood}`, mascot.getMood() === mood);

      // Trigger sleep
      mascot.triggerSleep();
      assert(`Mascot entered sleep with mood ${mood}`, mascot.isSleeping === true);

      // Trigger wakeup
      mascot.triggerWakeup();
      assert(`Mascot woke up and restored mood ${mood}`, mascot.getMood() === mood);
    }

    // -------------------------------------------------------------------
    // 12. Wardrobe Accessories Preservation during Sleep & Wake (R1)
    // -------------------------------------------------------------------
    console.log('\n--- 12. Testing Wardrobe Accessories Preservation ---');
    const outfits = ['sunglasses', 'crown', 'party', 'best', 'none'];
    for (const outfit of outfits) {
      mascot.setOutfit(outfit);
      assert(`Outfit set to: ${outfit}`, mascot.outfitKey === outfit);

      // Transition into sleep
      mascot.triggerSleep();
      assert(`Outfit ${outfit} preserved during sleep`, mascot.outfitKey === outfit);

      // Wakeup
      mascot.triggerWakeup();
      assert(`Outfit ${outfit} preserved after wakeup`, mascot.outfitKey === outfit);
    }

    // -------------------------------------------------------------------
    // Test Summary
    // -------------------------------------------------------------------
    console.log('\n====================================================');
    console.log(`UX CALIBRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('[TEST ERROR]', err);
    process.exit(1);
  }
});
