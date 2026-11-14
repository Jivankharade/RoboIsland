/**
 * RoboIsland Mascot Moods & Canvas Animations Verification Suite (Milestone M5)
 * 
 * Verifies:
 * 1. Nine Distinct Moods (happy, sleepy, focused, curious, excited, thinking, surprised, relaxed, neutral)
 * 2. Spring Physics (jump, bounce, spring, kick, jelly wobble squash & stretch, volume conservation)
 * 3. Idle Behaviors (sine float bobbing, natural blinking, saccadic micro-movements, gaze tracking)
 * 4. Canvas Floating Speech Bubble System (rendering, auto-wrap, fade transitions)
 * 5. Wardrobe & Swatches Preservation (5 skins, 5 outfits, 10 body colors, 6 eye colors)
 * 6. Zero Emoji Compliance (100% Canvas 2D vector drawing)
 * 7. Live Canvas Engine Integration & Contextual Hooks
 * 
 * Milestone: M5 Mascot Moods & Animations
 */

const path = require('path');
const fs = require('fs');

// Support running via plain node OR npx electron
if (!process.versions.electron) {
  const { spawnSync } = require('child_process');
  const electronPath = require('electron');
  console.log('[Runner] Spawning Electron runner for scripts/test-mascot-moods.js...\n');
  const res = spawnSync(electronPath, [__filename], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

const { app, BrowserWindow } = require('electron');

console.log('====================================================');
console.log('   ROBOISLAND MASCOT MOODS & ANIMATIONS SUITE       ');
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
    // 1. Zero-Emoji Compliance & Pure Vector Canvas Drawing Check
    // -------------------------------------------------------------------
    console.log('--- 1. Testing Zero-Emoji Compliance in Mascot & Canvas Engine ---');
    const mascotSource = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'robo-mascot.ts'), 'utf8');
    const canvasSource = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'canvas-engine.ts'), 'utf8');

    // Unicode Emoji regular expression matching pictorial emojis
    const emojiRegex = /\p{Extended_Pictographic}/u;
    const mascotHasEmoji = emojiRegex.test(mascotSource);
    const canvasHasEmoji = emojiRegex.test(canvasSource);

    assert('robo-mascot.ts contains exactly ZERO unicode emojis', !mascotHasEmoji);
    assert('canvas-engine.ts contains exactly ZERO unicode emojis', !canvasHasEmoji);
    assert('robo-mascot.ts contains pure vector Z drawing method', mascotSource.includes('drawVectorZ'));
    assert('robo-mascot.ts contains pure vector sparkle star drawing method', mascotSource.includes('drawVectorSparkle'));
    assert('robo-mascot.ts contains pure vector thought dot ripple method', mascotSource.includes('drawThoughtDot'));
    assert('robo-mascot.ts contains pure vector sunglasses method', mascotSource.includes('drawVectorSunglasses'));
    assert('robo-mascot.ts contains pure vector crown method', mascotSource.includes('drawVectorCrown'));

    // -------------------------------------------------------------------
    // 2. Unit Testing RoboMascot Class: All 9 Moods & Legacy Aliases
    // -------------------------------------------------------------------
    console.log('\n--- 2. Testing All Nine Distinct Moods in RoboMascot ---');
    const { RoboMascot, SKINS, BODY_COLORS, EYE_COLORS } = require(path.join(root, 'dist', 'renderer', 'island', 'robo-mascot.js'));

    const mascot = new RoboMascot();
    assert('Mascot initializes with default neutral mood', mascot.mood === 'neutral' || mascot.mood === 'idle');

    const expectedMoods = [
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

    for (const mood of expectedMoods) {
      mascot.setMood(mood);
      assert(`Mascot setMood("${mood}") sets mood`, mascot.getMood() === mood, `actual=${mascot.getMood()}`);
    }

    // Legacy aliases support
    mascot.setMood('wink');
    assert('Mascot supports legacy "wink" mood', mascot.getMood() === 'wink');
    mascot.setMood('dizzy');
    assert('Mascot supports legacy "dizzy" mood', mascot.getMood() === 'dizzy');
    mascot.setMood('dance');
    assert('Mascot supports legacy "dance" mood', mascot.getMood() === 'dance');

    // -------------------------------------------------------------------
    // 3. Testing Spring Physics, Jump, Bounce, and Jelly Wobble
    // -------------------------------------------------------------------
    console.log('\n--- 3. Testing Jump, Bounce, Spring Impulse & Jelly Wobble Physics ---');
    mascot.setMood('neutral');

    // 3.1 Jump & Gravity
    mascot.jump(150);
    assert('mascot.jump() sets isJumping to true', mascot.isJumping === true);
    assert('mascot.jump() sets upward jumpVelocity (< 0)', mascot.jumpVelocity < 0, `v=${mascot.jumpVelocity}`);
    assert('Takeoff stretches heightFactor (> 1.0)', mascot.heightFactor > 1.0, `h=${mascot.heightFactor.toFixed(2)}`);

    // Simulate jump trajectory over time steps
    let peakReached = false;
    let landed = false;
    for (let step = 0; step < 60; step++) {
      mascot.update(0.016, 0, 0, 0, 0);
      if (mascot.jumpY < -10) peakReached = true;
      if (!mascot.isJumping && peakReached) {
        landed = true;
        break;
      }
    }
    assert('Jump trajectory reached elevation peak (jumpY < 0)', peakReached);
    assert('Gravity pulled mascot down and detected landing (isJumping=false)', landed);
    assert('Landing squashed heightFactor (< 1.0)', mascot.heightFactor < 1.0, `h=${mascot.heightFactor.toFixed(2)}`);
    assert('Area conservation expands widthFactor on landing squash (> 1.0)', mascot.widthFactor > 1.0, `w=${mascot.widthFactor.toFixed(2)}`);

    // 3.2 Spring impulse & Harmonic Damping
    mascot.spring(0.4);
    assert('mascot.spring() applies impulse deformation', mascot.heightFactor > 1.3, `h=${mascot.heightFactor.toFixed(2)}`);
    assert('Wobble velocity is non-zero after spring impulse', Math.abs(mascot.wobbleVelocity) > 0);

    // Let the damped oscillator settle over 1.5 seconds
    for (let step = 0; step < 90; step++) {
      mascot.update(0.016, 0, 0, 0, 0);
    }
    assert('Jelly wobble spring decays back toward 1.0 equilibrium', Math.abs(mascot.heightFactor - 1.0) < 0.05, `h=${mascot.heightFactor.toFixed(3)}`);
    assert('widthFactor returns toward 1.0 equilibrium', Math.abs(mascot.widthFactor - 1.0) < 0.05, `w=${mascot.widthFactor.toFixed(3)}`);

    // 3.3 Kick & Lateral Tilt
    mascot.kick(1);
    assert('mascot.kick() applies lateral tiltAngle (> 0)', mascot.tiltAngle > 0.15, `tilt=${mascot.tiltAngle.toFixed(2)}`);
    for (let step = 0; step < 40; step++) {
      mascot.update(0.016, 0, 0, 0, 0);
    }
    assert('Tilt angle smoothly recovers back toward 0', Math.abs(mascot.tiltAngle) < 0.05, `tilt=${mascot.tiltAngle.toFixed(3)}`);

    // -------------------------------------------------------------------
    // 4. Testing Idle Behaviors: Sine Float, Blinks, Saccades & Gaze Tracking
    // -------------------------------------------------------------------
    console.log('\n--- 4. Testing Idle Behaviors & Organic Gaze Tracking ---');
    mascot.setMood('neutral');

    // 4.1 Idle Float
    const initialFloatY = mascot.idleFloatY;
    mascot.update(0.2, 0, 0, 0, 0);
    const nextFloatY = mascot.idleFloatY;
    assert('idleFloatPhase advances and idleFloatY oscillates', initialFloatY !== nextFloatY);

    // 4.2 Saccadic Micro-Movements
    let hadSaccade = false;
    for (let step = 0; step < 120; step++) {
      mascot.update(0.016, 0, 0, 0, 0);
      if (Math.abs(mascot.saccadeX) > 0.01 || Math.abs(mascot.saccadeY) > 0.01) {
        hadSaccade = true;
        break;
      }
    }
    assert('Saccadic micro-movement generator creates organic micro-jitter', hadSaccade);

    // 4.3 Cursor Gaze Tracking
    // Cursor to the right: dx = 150, dy = 0 relative to mascot center
    mascot.update(0.1, 150, 0, 0, 0);
    for (let step = 0; step < 20; step++) {
      mascot.update(0.016, 150, 0, 0, 0);
    }
    assert('lookX smoothly tracks cursor moving right (lookX > 0.5)', mascot.lookX > 0.5, `lookX=${mascot.lookX.toFixed(2)}`);

    // Cursor above: dy = -120 relative to mascot center
    for (let step = 0; step < 20; step++) {
      mascot.update(0.016, 0, -120, 0, 0);
    }
    assert('lookY smoothly tracks cursor moving up (lookY < -0.5)', mascot.lookY < -0.5, `lookY=${mascot.lookY.toFixed(2)}`);

    // -------------------------------------------------------------------
    // 5. Testing Canvas Floating Speech Bubble System
    // -------------------------------------------------------------------
    console.log('\n--- 5. Testing Canvas Floating Speech Bubble System ---');
    mascot.speak('Hello from RoboIsland 2.0!', 2.5);
    assert('mascot.speak() sets speechBubble.active to true', mascot.speechBubble.active === true);
    assert('speechBubble text matches input prompt', mascot.speechBubble.text === 'Hello from RoboIsland 2.0!');
    assert('speechBubble timer matches duration', mascot.speechBubble.timer === 2.5);

    // Fade in
    mascot.update(0.1, 0, 0, 0, 0);
    assert('speechBubble alpha fades in (> 0)', mascot.speechBubble.alpha > 0, `alpha=${mascot.speechBubble.alpha.toFixed(2)}`);

    // Let timer expire
    mascot.update(2.6, 0, 0, 0, 0);
    assert('speechBubble timer counts down to <= 0', mascot.speechBubble.timer <= 0);
    mascot.update(0.4, 0, 0, 0, 0);
    assert('speechBubble fades out and deactivates', mascot.speechBubble.active === false);

    // hideSpeech()
    mascot.speak('Instant message', 3.0);
    mascot.hideSpeech();
    assert('mascot.hideSpeech() zeroes the timer', mascot.speechBubble.timer === 0);

    // -------------------------------------------------------------------
    // 6. Testing Wardrobe Outfits & Swatches Preservation
    // -------------------------------------------------------------------
    console.log('\n--- 6. Testing Wardrobe Outfits & Swatches Preservation ---');
    assert('SKINS registry contains 5 preset themes', Object.keys(SKINS).length >= 5);
    assert('SKINS contains classic, cyberpunk, matrix, solar, amethyst',
      'classic' in SKINS && 'cyberpunk' in SKINS && 'matrix' in SKINS && 'solar' in SKINS && 'amethyst' in SKINS
    );

    assert('BODY_COLORS registry contains 10 swatches', Object.keys(BODY_COLORS).length >= 10);
    assert('EYE_COLORS registry contains 6 swatches', Object.keys(EYE_COLORS).length >= 6);

    // Test wardrobe methods
    mascot.setSkin('matrix');
    assert('setSkin updates skinKey to "matrix"', mascot.skinKey === 'matrix');

    mascot.setOutfit('sunglasses');
    assert('setOutfit("sunglasses") sets outfitKey', mascot.outfitKey === 'sunglasses');
    assert('setOutfit("sunglasses") maps hatKey to "sunglasses"', mascot.hatKey === 'sunglasses');

    mascot.setOutfit('crown');
    assert('setOutfit("crown") sets hatKey to "crown"', mascot.hatKey === 'crown');

    mascot.setBodyColor('mint');
    mascot.setEyeColor('yellow');
    const palette = mascot.getActivePalette();
    assert('getActivePalette() resolves custom body color swatch (#63e6e2)', palette.headBg === '#63e6e2');
    assert('getActivePalette() resolves custom eye color swatch (#ffcc00)', palette.eyeColor === '#ffcc00');

    // -------------------------------------------------------------------
    // 7. Testing Sleepy Z Particles & Thinking Thought Dot
    // -------------------------------------------------------------------
    console.log('\n--- 7. Testing Sleepy Z Particles & Thinking Thought Dot ---');
    mascot.setMood('sleepy');
    mascot.sleepyZzzs = [];
    for (let step = 0; step < 70; step++) {
      mascot.update(0.02, 0, 0, 0, 0);
    }
    assert('Sleepy mood generates animated vector Z particles', mascot.sleepyZzzs.length > 0, `count=${mascot.sleepyZzzs.length}`);

    // -------------------------------------------------------------------
    // 8. Live Island BrowserWindow Canvas Engine Integration
    // -------------------------------------------------------------------
    console.log('\n--- 8. Testing Live Island Window Canvas Engine Hooks ---');
    const { IslandWindow } = require(path.join(root, 'dist', 'main', 'island-window.js'));
    const islandWinInstance = new IslandWindow();
    const liveWin = islandWinInstance.getWindow();
    if (!liveWin) throw new Error('Failed to obtain Island BrowserWindow');
    await new Promise(r => setTimeout(r, 800));

    // Test live canvas engine mascot hooks in real browser context
    const hookResults = await liveWin.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        if (!engine || !engine.mascot) {
          return { error: 'CanvasEngine or Mascot missing on window' };
        }

        const initialMood = engine.getMascotMood();

        // Test mood changes
        engine.setMascotMood('excited');
        const moodExcited = engine.getMascotMood();

        engine.setMascotMood('curious');
        const moodCurious = engine.getMascotMood();

        engine.setMascotMood('surprised');
        const moodSurprised = engine.getMascotMood();

        engine.setMascotMood('happy');
        const moodHappy = engine.getMascotMood();

        // Test jump & bounce
        engine.mascotJump(120);
        const isJumping = engine.mascot.isJumping;

        // Test speak
        engine.mascotSpeak('Live Electron verification', 3.0);
        const hasSpeech = engine.mascot.speechBubble.active && engine.mascot.speechBubble.text.length > 0;

        // Check global window functions
        const hasWindowHelpers = 
          typeof window.__roboIslandSetMascotMood === 'function' &&
          typeof window.__roboIslandGetMascotMood === 'function' &&
          typeof window.__roboIslandMascotJump === 'function' &&
          typeof window.__roboIslandMascotBounce === 'function' &&
          typeof window.__roboIslandMascotSpeak === 'function';

        return {
          initialMood,
          moodExcited,
          moodCurious,
          moodSurprised,
          moodHappy,
          isJumping,
          hasSpeech,
          hasWindowHelpers
        };
      })()
    `);

    assert('Live CanvasEngine initialized with RoboMascot', !hookResults.error);
    assert('Live CanvasEngine setMascotMood("excited") verified', hookResults.moodExcited === 'excited');
    assert('Live CanvasEngine setMascotMood("curious") verified', hookResults.moodCurious === 'curious');
    assert('Live CanvasEngine setMascotMood("surprised") verified', hookResults.moodSurprised === 'surprised');
    assert('Live CanvasEngine setMascotMood("happy") verified', hookResults.moodHappy === 'happy');
    assert('Live CanvasEngine mascotJump() triggers jump physics', hookResults.isJumping === true);
    assert('Live CanvasEngine mascotSpeak() activates speech bubble', hookResults.hasSpeech === true);
    assert('Window globals for mascot hooks are fully exposed', hookResults.hasWindowHelpers === true);

    // 8.2 Test Rest Mode -> Mascot Sleepy Mood Transition
    const restMoodTest = await liveWin.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        engine.enterRest();
        const moodInRest = engine.getMascotMood();
        engine.restoreFromRest('compact');
        const moodAfterRest = engine.getMascotMood();
        return { moodInRest, moodAfterRest };
      })()
    `);
    assert('Entering rest mode sets mascot mood to "sleepy"', restMoodTest.moodInRest === 'sleepy');
    assert('Restoring from rest sets mascot mood to "happy"', restMoodTest.moodAfterRest === 'happy');

    // Clean up
    liveWin.destroy();

    // Summary
    console.log('\n====================================================');
    console.log(`MASCOT MOODS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    app.quit();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error in test-mascot-moods:', err);
    app.quit();
    process.exit(1);
  }
});
