/**
 * Automated Verification Suite for Focus Guard & Pomodoro (Milestone M7 Part A)
 * Tests FocusGuard main engine, foreground inspection, blocklists, Pomodoro cycles,
 * emergency override, productivity metrics, calm breathing modal, and zero-emoji compliance.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// Import compiled FocusGuard engine from dist/main/focus-guard.js
const { FocusGuard, DEFAULT_BLOCKED_ITEMS } = require(path.join(root, 'dist/main/focus-guard.js'));

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failedCount++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failedCount++;
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('       ROBOISLAND FOCUS GUARD & POMODORO SUITE      ');
  console.log('====================================================\n');

  // -----------------------------------------------------------------------------
  // Suite 1: Blocklist Management & Classification
  // -----------------------------------------------------------------------------
  console.log('--- 1. Testing Blocklist Management & Auto-Classification ---');

  const guard = new FocusGuard();

  test('Default blocklist initializes with expected domains and apps', () => {
    const list = guard.getBlocklist();
    assert(list.length >= 7, 'Default blocklist must have at least 7 items');
    const targets = list.map((i) => i.target);
    assert(targets.includes('youtube.com'), 'youtube.com must be in default blocklist');
    assert(targets.includes('discord.exe'), 'discord.exe must be in default blocklist');
    assert(targets.includes('steam.exe'), 'steam.exe must be in default blocklist');
  });

  test('Adding new website domain classifies correctly as domain', () => {
    const item = guard.addBlockedItem('pinterest.com');
    assert.strictEqual(item.target, 'pinterest.com');
    assert.strictEqual(item.type, 'domain');
    assert.strictEqual(item.enabled, true);
    const found = guard.getBlocklist().find((i) => i.target === 'pinterest.com');
    assert(found, 'Added domain must exist in blocklist');
  });

  test('Adding new desktop app classifies correctly as app', () => {
    const item = guard.addBlockedItem('epicgames.exe');
    assert.strictEqual(item.target, 'epicgames.exe');
    assert.strictEqual(item.type, 'app');
    assert.strictEqual(item.enabled, true);
  });

  test('Removing blocked item by target or id works', () => {
    guard.addBlockedItem('temporary-distraction.com');
    assert(guard.getBlocklist().some((i) => i.target === 'temporary-distraction.com'));
    const removed = guard.removeBlockedItem('temporary-distraction.com');
    assert.strictEqual(removed, true);
    assert(!guard.getBlocklist().some((i) => i.target === 'temporary-distraction.com'));
  });

  test('Toggling blocked item status on and off', () => {
    const item = guard.addBlockedItem('toggle-test.com');
    assert.strictEqual(item.enabled, true);
    guard.toggleBlockedItem('toggle-test.com', false);
    const toggledOff = guard.getBlocklist().find((i) => i.target === 'toggle-test.com');
    assert.strictEqual(toggledOff.enabled, false);
    guard.toggleBlockedItem('toggle-test.com', true);
    const toggledOn = guard.getBlocklist().find((i) => i.target === 'toggle-test.com');
    assert.strictEqual(toggledOn.enabled, true);
    guard.removeBlockedItem('toggle-test.com');
  });

  test('Master enable and disable toggling', () => {
    assert.strictEqual(guard.isMasterEnabled(), true);
    guard.setMasterEnabled(false);
    assert.strictEqual(guard.isMasterEnabled(), false);
    guard.setMasterEnabled(true);
    assert.strictEqual(guard.isMasterEnabled(), true);
  });

  // -----------------------------------------------------------------------------
  // Suite 2: Non-Invasive Foreground Window Distraction Matching
  // -----------------------------------------------------------------------------
  console.log('\n--- 2. Testing Non-Invasive Foreground Distraction Matching ---');

  test('Non-distracting development window passes without alert', () => {
    guard.startPomodoro(); // session running, focus mode
    const match = guard.checkDistraction({
      title: 'focus-guard.ts - RoboIsland - Visual Studio Code',
      processName: 'Code'
    });
    assert.strictEqual(match, null, 'VS Code must not trigger distraction alert');
  });

  test('Browser with YouTube title triggers domain distraction match', () => {
    const match = guard.checkDistraction({
      title: 'Watch funny cats online - YouTube - Google Chrome',
      processName: 'chrome'
    });
    assert(match !== null, 'YouTube in Chrome must trigger distraction alert');
    assert.strictEqual(match.isDistracting, true);
    assert.strictEqual(match.matchedOn, 'domain');
    assert.strictEqual(match.item.target, 'youtube.com');
  });

  test('Browser with Reddit in Microsoft Edge triggers domain match', () => {
    const match = guard.checkDistraction({
      title: 'Reddit - Dive into anything - Personal - Microsoft Edge',
      processName: 'msedge'
    });
    assert(match !== null, 'Reddit in Edge must trigger distraction alert');
    assert.strictEqual(match.matchedOn, 'domain');
    assert.strictEqual(match.item.target, 'reddit.com');
  });

  test('Desktop app (Discord.exe) process triggers app distraction match', () => {
    const match = guard.checkDistraction({
      title: '#general | Friends Server - Discord',
      processName: 'Discord'
    });
    assert(match !== null, 'Discord process must trigger distraction alert');
    assert.strictEqual(match.matchedOn, 'process');
    assert.strictEqual(match.item.target, 'discord.exe');
  });

  test('Desktop app (Steam.exe) triggers process distraction match', () => {
    const match = guard.checkDistraction({
      title: 'Steam Library',
      processName: 'steam'
    });
    assert(match !== null, 'Steam process must trigger distraction alert');
    assert.strictEqual(match.matchedOn, 'process');
    assert.strictEqual(match.item.target, 'steam.exe');
  });

  test('Distraction check respects active focus session condition (idle = no match)', () => {
    guard.pausePomodoro(); // session paused
    const matchWhenPaused = guard.checkDistraction({
      title: 'YouTube - Google Chrome',
      processName: 'chrome'
    });
    assert.strictEqual(matchWhenPaused, null, 'Must NOT alert when session is paused');
    guard.resetPomodoro(); // session idle
    const matchWhenIdle = guard.checkDistraction({
      title: 'YouTube - Google Chrome',
      processName: 'chrome'
    });
    assert.strictEqual(matchWhenIdle, null, 'Must NOT alert when session is idle');
  });

  test('Distraction check respects short break mode (break = no match)', () => {
    guard.setPomodoroMode('shortBreak');
    guard.startPomodoro();
    const matchOnBreak = guard.checkDistraction({
      title: 'YouTube - Google Chrome',
      processName: 'chrome'
    });
    assert.strictEqual(matchOnBreak, null, 'Must NOT alert when user is on a scheduled break');
    guard.setPomodoroMode('focus');
    guard.resetPomodoro();
  });

  // -----------------------------------------------------------------------------
  // Suite 3: 5-Minute Emergency Manual Override
  // -----------------------------------------------------------------------------
  console.log('\n--- 3. Testing 5-Minute Emergency Manual Override ---');

  test('Activating emergency override sets 5-minute (300s) expiration', () => {
    const overrideState = guard.triggerEmergencyOverride(5);
    assert.strictEqual(overrideState.active, true);
    assert(overrideState.remainingSeconds >= 298 && overrideState.remainingSeconds <= 300);
    assert.strictEqual(guard.isEmergencyOverrideActive(), true);
  });

  test('Distraction check is completely suspended during active override', () => {
    guard.startPomodoro();
    assert.strictEqual(guard.isEmergencyOverrideActive(), true);
    const match = guard.checkDistraction({
      title: 'YouTube - Google Chrome',
      processName: 'chrome'
    });
    assert.strictEqual(match, null, 'Must return null while emergency override is active');
  });

  test('Early cancellation of emergency override restores protection immediately', () => {
    const cancelled = guard.cancelEmergencyOverride();
    assert.strictEqual(cancelled.active, false);
    assert.strictEqual(cancelled.remainingSeconds, 0);
    assert.strictEqual(guard.isEmergencyOverrideActive(), false);

    // Now distraction matching must be active again
    const match = guard.checkDistraction({
      title: 'YouTube - Google Chrome',
      processName: 'chrome'
    });
    assert(match !== null, 'Distraction alerts must resume immediately after override is cancelled');
    guard.resetPomodoro();
  });

  // -----------------------------------------------------------------------------
  // Suite 4: Pomodoro Cycles & Productivity Metrics
  // -----------------------------------------------------------------------------
  console.log('\n--- 4. Testing Pomodoro Timer & Productivity Metrics ---');

  test('Pomodoro initial state is 25:00 focus session', () => {
    const pState = guard.getPomodoroState();
    assert.strictEqual(pState.mode, 'focus');
    assert.strictEqual(pState.status, 'idle');
    assert.strictEqual(pState.timeRemaining, 1500);
    assert.strictEqual(pState.totalDuration, 1500);
    assert.strictEqual(pState.currentCycle, 1);
    assert.strictEqual(pState.totalCycles, 4);
  });

  test('Pomodoro start, tick decrement, and pause state transitions', () => {
    guard.startPomodoro();
    assert.strictEqual(guard.getPomodoroState().status, 'running');

    // Perform 3 ticks
    guard.tickPomodoro();
    guard.tickPomodoro();
    guard.tickPomodoro();

    const stateAfterTicks = guard.getPomodoroState();
    assert.strictEqual(stateAfterTicks.timeRemaining, 1497);

    guard.pausePomodoro();
    assert.strictEqual(guard.getPomodoroState().status, 'paused');
    assert.strictEqual(guard.getPomodoroState().timeRemaining, 1497);

    guard.resetPomodoro();
    assert.strictEqual(guard.getPomodoroState().timeRemaining, 1500);
    assert.strictEqual(guard.getPomodoroState().status, 'idle');
  });

  test('Productivity stats accumulate focus time and completed sessions', () => {
    guard.resetTodayStats();
    guard.startPomodoro();
    for (let i = 0; i < 5; i++) {
      guard.tickPomodoro();
    }
    const stats = guard.getStats();
    assert(stats.focusTimeSecondsToday >= 5, 'Focus seconds today must accumulate');
    assert(stats.lifetimeFocusTimeSeconds >= 5, 'Lifetime focus seconds must accumulate');

    // Trigger distraction recording
    guard.recordDistractionBlocked();
    guard.recordDistractionBlocked();
    assert.strictEqual(guard.getStats().distractionsBlocked, 2);

    // Trigger session completion recording
    guard.recordSessionCompleted();
    assert.strictEqual(guard.getStats().sessionsCompleted, 1);
    guard.resetPomodoro();
  });

  test('Cycle progression: 4 focus sessions before long break', () => {
    guard.setPomodoroMode('focus');
    assert.strictEqual(guard.getPomodoroState().currentCycle, 1);
    assert.strictEqual(guard.getPomodoroState().mode, 'focus');

    // Skip Focus 1 -> Short Break
    guard.skipPomodoro();
    assert.strictEqual(guard.getPomodoroState().mode, 'shortBreak');

    // Skip Short Break -> Focus 2
    guard.skipPomodoro();
    assert.strictEqual(guard.getPomodoroState().mode, 'focus');
    assert.strictEqual(guard.getPomodoroState().currentCycle, 2);

    // Skip Focus 2 -> Short Break -> Focus 3 -> Short Break -> Focus 4
    guard.skipPomodoro(); // short break
    guard.skipPomodoro(); // focus 3
    assert.strictEqual(guard.getPomodoroState().currentCycle, 3);
    guard.skipPomodoro(); // short break
    guard.skipPomodoro(); // focus 4
    assert.strictEqual(guard.getPomodoroState().currentCycle, 4);

    // Skip Focus 4 -> LONG BREAK!
    guard.skipPomodoro();
    assert.strictEqual(guard.getPomodoroState().mode, 'longBreak', 'Must transition to longBreak after 4 cycles');

    // Skip Long Break -> restarts at Focus cycle 1
    guard.skipPomodoro();
    assert.strictEqual(guard.getPomodoroState().mode, 'focus');
    assert.strictEqual(guard.getPomodoroState().currentCycle, 1);
    guard.resetPomodoro();
  });

  // -----------------------------------------------------------------------------
  // Suite 5: Mock Foreground Polling & Event Emission
  // -----------------------------------------------------------------------------
  console.log('\n--- 5. Testing Mock Foreground Window Polling ---');

  await testAsync('Injected foreground window triggers distraction event', async () => {
    let eventFired = false;
    let receivedMatch = null;

    const onDistraction = (match) => {
      eventFired = true;
      receivedMatch = match;
    };
    guard.on('focus:distraction', onDistraction);

    // Injected mock provider simulating user opening Reddit during focus
    guard.setForegroundProvider(() => ({
      title: 'Reddit - Dive into anything - Google Chrome',
      processName: 'chrome'
    }));

    guard.startPomodoro();
    guard.startForegroundPolling(50); // fast polling for test

    // Wait 120ms for polling tick
    await new Promise((r) => setTimeout(r, 120));

    guard.stopForegroundPolling();
    guard.resetPomodoro();
    guard.removeListener('focus:distraction', onDistraction);
    guard.setForegroundProvider(null);

    assert.strictEqual(eventFired, true, 'Distraction event must fire when mock foreground window matches');
    assert(receivedMatch !== null);
    assert.strictEqual(receivedMatch.item.target, 'reddit.com');
  });

  // -----------------------------------------------------------------------------
  // Suite 6: Strict Zero-Emoji Mandate Compliance
  // -----------------------------------------------------------------------------
  console.log('\n--- 6. Testing Zero-Emoji Compliance across Source Code ---');

  const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  function assertNoEmojiInFile(relPath) {
    const fullPath = path.join(root, relPath);
    assert(fs.existsSync(fullPath), `File must exist: ${relPath}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const match = content.match(EMOJI_REGEX);
    assert(!match, `Emoji detected in ${relPath}: "${match ? match[0] : ''}"`);
  }

  test('src/main/focus-guard.ts has zero emojis', () => {
    assertNoEmojiInFile('src/main/focus-guard.ts');
  });

  test('src/renderer/island/focus-ui.ts has zero emojis', () => {
    assertNoEmojiInFile('src/renderer/island/focus-ui.ts');
  });

  test('scripts/test-focus-guard.js has zero emojis', () => {
    assertNoEmojiInFile('scripts/test-focus-guard.js');
  });

  // -----------------------------------------------------------------------------
  // Suite 7: Non-invasive Windows Integrity Verification
  // -----------------------------------------------------------------------------
  console.log('\n--- 7. Testing Non-Invasive Architecture Integrity ---');

  test('Source code does NOT reference or modify Windows hosts file', () => {
    const mainSrc = fs.readFileSync(path.join(root, 'src/main/focus-guard.ts'), 'utf8');
    assert(!mainSrc.includes('etc/hosts') && !mainSrc.includes('etc\\hosts'), 'Must not reference hosts file');
    assert(!mainSrc.includes('127.0.0.1') || mainSrc.includes('127.0.0.1:'), 'Must not map domains to localhost in hosts');
  });

  // -----------------------------------------------------------------------------
  // Suite 8: Renderer FocusUI Controller & SVG Vector Iconography
  // -----------------------------------------------------------------------------
  console.log('\n--- 8. Testing Renderer FocusUI Controller & SVG Iconography ---');

  const { FocusUI, SVG_ICONS } = require(path.join(root, 'dist/renderer/island/focus-ui.js'));

  test('SVG_ICONS contains 100% pure vector icons with zero emoji', () => {
    const requiredIcons = ['play', 'pause', 'reset', 'skip', 'plus', 'trash', 'globe', 'app', 'clock', 'check', 'shield', 'shieldAlert', 'shieldOff', 'wind', 'close'];
    for (const iconKey of requiredIcons) {
      assert(iconKey in SVG_ICONS, `Missing icon: ${iconKey}`);
      const svg = SVG_ICONS[iconKey];
      assert(svg.startsWith('<svg') && svg.endsWith('</svg>'), `Icon ${iconKey} must be a valid SVG string`);
      assert(!svg.match(EMOJI_REGEX), `Icon ${iconKey} must not contain emoji`);
    }
  });

  test('FocusUI instantiates safely without DOM errors in Node', () => {
    const ui = new FocusUI();
    assert(ui !== null);
    const pState = ui.getPomodoroState();
    assert.strictEqual(pState.mode, 'focus');
    assert.strictEqual(pState.status, 'idle');
    assert.strictEqual(pState.timeRemaining, 1500);
  });

  test('FocusUI timer controls and tick logic', () => {
    const ui = new FocusUI();
    ui.startTimer();
    assert.strictEqual(ui.getPomodoroState().status, 'running');

    ui.tick();
    ui.tick();
    assert.strictEqual(ui.getPomodoroState().timeRemaining, 1498);
    assert(ui.getProductivityStats().focusTimeSecondsToday >= 2);

    ui.pauseTimer();
    assert.strictEqual(ui.getPomodoroState().status, 'paused');

    ui.resetTimer();
    assert.strictEqual(ui.getPomodoroState().status, 'idle');
    assert.strictEqual(ui.getPomodoroState().timeRemaining, 1500);
  });

  test('FocusUI mode switching between focus, shortBreak, and longBreak', () => {
    const ui = new FocusUI();
    ui.switchMode('shortBreak');
    assert.strictEqual(ui.getPomodoroState().mode, 'shortBreak');
    assert.strictEqual(ui.getPomodoroState().timeRemaining, 300);

    ui.switchMode('longBreak');
    assert.strictEqual(ui.getPomodoroState().mode, 'longBreak');
    assert.strictEqual(ui.getPomodoroState().timeRemaining, 900);

    ui.switchMode('focus');
    assert.strictEqual(ui.getPomodoroState().mode, 'focus');
    assert.strictEqual(ui.getPomodoroState().timeRemaining, 1500);
  });

  test('FocusUI emergency override activation and cancellation', () => {
    const ui = new FocusUI();
    ui.activateEmergencyOverride(5);
    const ov = ui.getEmergencyOverrideState();
    assert.strictEqual(ov.active, true);
    assert.strictEqual(ov.remainingSeconds, 300);

    ui.cancelOverride();
    assert.strictEqual(ui.getEmergencyOverrideState().active, false);
  });

  test('FocusUI blocklist management methods', () => {
    const ui = new FocusUI();
    ui.addBlocklistItem('hulu.com');
    assert(ui.getBlocklist().some((b) => b.target === 'hulu.com'));

    ui.toggleBlocklistItem('domain:hulu.com');
    const toggled = ui.getBlocklist().find((b) => b.target === 'hulu.com');
    assert.strictEqual(toggled.enabled, false);

    ui.removeBlocklistItem('domain:hulu.com');
    assert(!ui.getBlocklist().some((b) => b.target === 'hulu.com'));
  });

  // -----------------------------------------------------------------------------
  // Final Summary
  // -----------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('[FATAL] Uncaught error in test suite:', err);
  process.exit(1);
});
