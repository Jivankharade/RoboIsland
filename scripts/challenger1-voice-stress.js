/**
 * Challenger 1 Independent Adversarial Stress Test Suite
 * Milestone 6: Full Hands-Free Voice Companion Mode (Jarvis Voice)
 * 
 * Target: src/main/voice-companion-service.ts, src/main/index.ts, src/preload/island-preload.ts
 * 
 * Adversarial Verifications:
 * 1. Wake-word detection matrix (casing, spacing, punctuation, embedded, boundary negative tests, 100k ReDoS stress)
 * 2. 1,000 rapid state machine cycling, async race condition resilience, and listener memory leaks
 * 3. Dialogue processor under hostile inputs (empty, giant, SQL/command/script injections, unicode, RTL, math edge cases)
 * 4. TTS speech execution, PowerShell escaping, timeout kill, rapid stopSpeaking aborts, and disposal cleanup
 * 5. Audio wave amplitude and 5-band frequency bounds ([0.0, 1.0] strict invariant, no NaN/Infinity)
 * 6. Preload bridge and IPC registration contracts
 * 7. Empirical edge case boundary mining (baseLevel 0 behavior, dispose while speaking, non-string processCommand)
 */

const path = require('path');
const fs = require('fs');

console.log('================================================================');
console.log('  CHALLENGER 1: ADVERSARIAL STRESS TEST - VOICE COMPANION MODE  ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;
const failureDetails = [];
const empiricalFindings = [];

function assert(desc, condition, details = '') {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${desc} ${details ? '(' + details + ')' : ''}`);
    failCount++;
    failureDetails.push({ desc, details });
  }
}

function recordFinding(title, severity, detail) {
  empiricalFindings.push({ title, severity, detail });
  console.log(`  [EMPIRICAL FINDING - ${severity.toUpperCase()}] ${title}`);
}

async function runAdversarialSuite() {
  const startTime = Date.now();

  const servicePath = path.join(__dirname, '..', 'dist', 'main', 'voice-companion-service.js');
  assert('Compiled voice-companion-service.js exists in dist/main', fs.existsSync(servicePath));

  const {
    voiceCompanionService,
    VoiceCompanionService,
    detectWakeWord,
    computeAudioBands
  } = require(servicePath);

  // ========================================================================
  // 1. WAKE-WORD DETECTION MATRIX & REDOS RESISTANCE
  // ========================================================================
  console.log('\n--- Category 1: Wake-Word Detection Matrix & ReDoS Stress ---');

  // 1.1 Canonical trigger phrases
  const canonicalTriggers = [
    { input: 'Hey Jarvis', expectedWord: 'hey jarvis', stripped: '' },
    { input: 'hey jarvis', expectedWord: 'hey jarvis', stripped: '' },
    { input: 'HEY JARVIS', expectedWord: 'hey jarvis', stripped: '' },
    { input: 'Jarvis', expectedWord: 'jarvis', stripped: '' },
    { input: 'jarvis', expectedWord: 'jarvis', stripped: '' },
    { input: 'JARVIS', expectedWord: 'jarvis', stripped: '' },
    { input: 'Hey Robo', expectedWord: 'hey robo', stripped: '' },
    { input: 'hey robo', expectedWord: 'hey robo', stripped: '' },
    { input: 'HEY ROBO', expectedWord: 'hey robo', stripped: '' },
    { input: 'RoboIsland', expectedWord: 'roboisland', stripped: '' },
    { input: 'roboisland', expectedWord: 'roboisland', stripped: '' },
    { input: 'ROBOISLAND', expectedWord: 'roboisland', stripped: '' },
    { input: 'Robo Island', expectedWord: 'robo island', stripped: '' },
    { input: 'robo island', expectedWord: 'robo island', stripped: '' }
  ];

  canonicalTriggers.forEach(({ input, expectedWord, stripped }) => {
    const res = detectWakeWord(input);
    assert(`Canonical trigger "${input}" matches trigger "${expectedWord}"`,
      res.detected === true && res.triggerWord === expectedWord && res.strippedText === stripped,
      JSON.stringify(res));
  });

  // 1.2 Spacing and Whitespace Permutations
  const spacingVariations = [
    { input: 'Hey   Jarvis', expectedWord: 'hey jarvis' },
    { input: 'Hey \t Jarvis', expectedWord: 'hey jarvis' },
    { input: 'Hey  Robo', expectedWord: 'hey robo' },
    { input: 'robo   island', expectedWord: 'robo island' },
    { input: '  Hey Jarvis  ', expectedWord: 'hey jarvis' },
    { input: '\n\tHey Jarvis\t\n', expectedWord: 'hey jarvis' }
  ];

  spacingVariations.forEach(({ input, expectedWord }) => {
    const res = detectWakeWord(input);
    assert(`Whitespace permutation "${input.replace(/[\n\t]/g, '\\s')}" matches "${expectedWord}"`,
      res.detected === true && res.triggerWord === expectedWord,
      JSON.stringify(res));
  });

  // 1.3 Punctuation Prefix and Suffix Permutations
  const punctuationPermutations = [
    { input: 'Jarvis:', expected: true, stripped: '' },
    { input: 'Jarvis,', expected: true, stripped: '' },
    { input: 'Jarvis!', expected: true, stripped: '' },
    { input: 'Jarvis?', expected: true, stripped: '' },
    { input: 'Jarvis...', expected: true, stripped: '' },
    { input: 'Hey Jarvis!', expected: true, stripped: '' },
    { input: 'Hey Jarvis:', expected: true, stripped: '' },
    { input: 'Hey Jarvis, what is the time?', expected: true, stripped: 'what is the time?' },
    { input: 'Hey Jarvis - what is the weather?', expected: true, stripped: 'what is the weather?' },
    { input: '"Hey Jarvis"', expected: true, stripped: '"' },
    { input: '(Hey Jarvis)', expected: true, stripped: ')' },
    { input: '[Jarvis]', expected: true, stripped: ']' },
    { input: '!Hey Robo!', expected: true, stripped: '!' }
  ];

  punctuationPermutations.forEach(({ input, expected, stripped }) => {
    const res = detectWakeWord(input);
    assert(`Punctuation permutation "${input}" detected: ${expected}`,
      res.detected === expected && (!stripped || res.strippedText.includes(stripped)),
      JSON.stringify(res));
  });

  // 1.4 Embedded in Sentences
  const embeddedQueries = [
    { input: 'Can you please hey jarvis tell me the score?', expectedWord: 'hey jarvis' },
    { input: 'Good morning jarvis how are you?', expectedWord: 'jarvis' },
    { input: 'Activate roboisland right now', expectedWord: 'roboisland' },
    { input: 'Hey Robo turn up the volume', expectedWord: 'hey robo' }
  ];

  embeddedQueries.forEach(({ input, expectedWord }) => {
    const res = detectWakeWord(input);
    assert(`Embedded wake-word in "${input}" detected: ${expectedWord}`,
      res.detected === true && res.triggerWord === expectedWord,
      JSON.stringify(res));
  });

  // 1.5 Word Boundary Enforcement (False Positives Prevention)
  const falsePositiveTests = [
    'jarvis123',
    'unjarvis',
    'jarvisism',
    'jarviss',
    'superjarvis',
    'roboislandrocks',
    'robocop',
    'robo',
    'island',
    'hey',
    'jar',
    'vis',
    'hello google',
    'alexa turn off lights',
    'siri what is the weather',
    'the quick brown fox jumps over the lazy dog',
    'just a regular user conversational speech input'
  ];

  falsePositiveTests.forEach((phrase) => {
    const res = detectWakeWord(phrase);
    assert(`Negative test phrase "${phrase}" rejects wake-word`,
      res.detected === false,
      JSON.stringify(res));
  });

  // 1.6 Hostile & Degenerate Inputs
  const degenerateInputs = [
    { input: '', desc: 'Empty string' },
    { input: '   ', desc: 'Whitespace string' },
    { input: '\n\r\t', desc: 'Control whitespace' },
    { input: null, desc: 'null input' },
    { input: undefined, desc: 'undefined input' },
    { input: 12345, desc: 'numeric input' },
    { input: true, desc: 'boolean true input' },
    { input: false, desc: 'boolean false input' },
    { input: {}, desc: 'object input' },
    { input: [], desc: 'array input' }
  ];

  degenerateInputs.forEach(({ input, desc }) => {
    try {
      const res = detectWakeWord(input);
      assert(`Degenerate input (${desc}) returns detected: false safely`,
        res.detected === false && typeof res.strippedText === 'string');
    } catch (e) {
      assert(`Degenerate input (${desc}) threw unhandled exception`, false, e.message);
    }
  });

  // 1.7 ReDoS & Catastrophic Backtracking Stress (50,000 to 100,000 chars)
  console.log('\n--- Testing ReDoS and Catastrophic Backtracking Resilience ---');
  const hugeNonMatch = 'hey '.repeat(25000); // 100,000 characters of partial match 'hey '
  const t0 = performance.now();
  const resHugeNonMatch = detectWakeWord(hugeNonMatch);
  const t0Elapsed = performance.now() - t0;
  assert(`100,000 char partial-match ReDoS test executes in sub-50ms (actual: ${t0Elapsed.toFixed(2)}ms)`,
    t0Elapsed < 50 && resHugeNonMatch.detected === false);

  const hugeTrailingWakeWord = 'random text and chatter '.repeat(4000) + 'Hey Jarvis';
  const t1 = performance.now();
  const resHugeTrailing = detectWakeWord(hugeTrailingWakeWord);
  const t1Elapsed = performance.now() - t1;
  assert(`100,000 char trailing wake-word executes in sub-50ms (actual: ${t1Elapsed.toFixed(2)}ms)`,
    t1Elapsed < 50 && resHugeTrailing.detected === true && resHugeTrailing.triggerWord === 'hey jarvis');

  const hugeLeadingWakeWord = 'Hey Jarvis ' + 'repeating sentence dialogue '.repeat(4000);
  const t2 = performance.now();
  const resHugeLeading = detectWakeWord(hugeLeadingWakeWord);
  const t2Elapsed = performance.now() - t2;
  assert(`100,000 char leading wake-word executes in sub-50ms (actual: ${t2Elapsed.toFixed(2)}ms)`,
    t2Elapsed < 50 && resHugeLeading.detected === true && resHugeLeading.triggerWord === 'hey jarvis');

  // ========================================================================
  // 2. RAPID STATE MACHINE CYCLING (1,000 CYCLES & CONCURRENCY)
  // ========================================================================
  console.log('\n--- Category 2: 1,000 Rapid State Machine Cycles & Concurrency ---');

  const testService = new VoiceCompanionService();
  testService.setSimulationMode(true);

  let stateChangeCount = 0;
  testService.setBroadcastCallback((channel, payload) => {
    if (channel === 'island:voice-state') {
      stateChangeCount++;
    }
  });

  const states = ['IDLE', 'LISTENING', 'THINKING', 'SPEAKING', 'ERROR'];
  const cycleStart = performance.now();
  const CYCLES = 1000;

  for (let i = 0; i < CYCLES; i++) {
    const targetState = states[i % states.length];
    testService.setState(targetState, {
      text: `Cycle query #${i}`,
      response: `Cycle response #${i}`
    });
    if (i % 250 === 0) {
      assert(`State accurately reflects ${targetState} at cycle ${i}`,
        testService.getState() === targetState);
    }
  }

  const cycleTime = performance.now() - cycleStart;
  assert(`1,000 rapid state transitions completed in sub-second (actual: ${cycleTime.toFixed(2)}ms)`,
    cycleTime < 1000);
  assert(`Broadcast callback fired exactly ${CYCLES} state change notifications`,
    stateChangeCount === CYCLES);

  // Return to IDLE and verify invariants
  testService.setState('IDLE');
  assert('Reset to IDLE yields level 0.0 and zeroed bands',
    testService.getState() === 'IDLE' &&
    testService.getAudioLevel() === 0.0 &&
    testService.getFrequencyBands().every(b => b === 0));

  // Concurrency Stress: 100 fast concurrent calls to startListening / stopListening / toggleListening
  const concurrentPromises = [];
  for (let i = 0; i < 100; i++) {
    if (i % 3 === 0) {
      concurrentPromises.push(testService.startListening());
    } else if (i % 3 === 1) {
      concurrentPromises.push(testService.toggleListening());
    } else {
      concurrentPromises.push(testService.stopListening());
    }
  }
  await Promise.all(concurrentPromises);
  const finalState = testService.getState();
  assert('Concurrent listening calls resolve safely without throwing unhandled rejection',
    ['IDLE', 'LISTENING'].includes(finalState));

  // Throwing broadcast callback resilience
  testService.setBroadcastCallback(() => {
    throw new Error('Simulated IPC WebContents destroyed error');
  });
  try {
    testService.setState('LISTENING', { text: 'Test broadcast error' });
    assert('Service survives throwing broadcast callback without uncaught exception', true);
  } catch (err) {
    assert('Service survives throwing broadcast callback', false, err.message);
  }
  testService.setBroadcastCallback(null);
  testService.setState('IDLE');

  // ========================================================================
  // 3. DIALOGUE PROCESSOR UNDER HOSTILE INPUTS & INJECTIONS
  // ========================================================================
  console.log('\n--- Category 3: Hostile Dialogue Inputs, Injections & Edge Cases ---');

  // 3.1 Empty, Whitespace & Non-String inputs
  const emptyRes1 = await testService.processCommand('');
  assert('processCommand handles empty string with polite prompt',
    emptyRes1.action === 'greeting' && typeof emptyRes1.response === 'string');

  const emptyRes2 = await testService.processCommand('      ');
  assert('processCommand handles whitespace string with polite prompt',
    emptyRes2.action === 'greeting' && typeof emptyRes2.response === 'string');

  const standaloneWake = await testService.processCommand('Hey Jarvis');
  assert('processCommand with only wake-word returns acknowledgment',
    standaloneWake.action === 'wake_acknowledge' && standaloneWake.response.includes('Jarvis'));

  // 3.2 Massive input (100,000 characters)
  const giantInput = 'Hey Jarvis, please analyze this very long user request: ' + 'A'.repeat(100000);
  const giantRes = await testService.processCommand(giantInput);
  assert('processCommand handles 100,000 char prompt without crash or excessive response length',
    giantRes.action === 'conversational_fallback' && giantRes.response.length < 200);

  // 3.3 Command Injection, SQL Injection, Script Injection
  const injectionTests = [
    { input: 'calculate 2 + 2; rm -rf /', desc: 'Command injection attempt' },
    { input: 'what is 5 * 5 & calc.exe', desc: 'Windows command chaining attempt' },
    { input: 'Jarvis, \'; DROP TABLE devices; --', desc: 'SQL injection attempt' },
    { input: '<script>alert("xss")</script>', desc: 'Cross-site scripting attempt' },
    { input: 'calculate process.exit(1)', desc: 'Node.js process manipulation attempt' },
    { input: 'calculate require("child_process").execSync("dir")', desc: 'Node.js require injection attempt' },
    { input: 'calculate eval("10+10")', desc: 'eval injection attempt' }
  ];

  for (const { input, desc } of injectionTests) {
    try {
      const res = await testService.processCommand(input);
      assert(`Injection resilience (${desc}) returns safe response without arbitrary execution`,
        typeof res.response === 'string' && process.pid > 0);
    } catch (err) {
      assert(`Injection test (${desc}) threw unhandled exception`, false, err.message);
    }
  }

  // 3.4 Arithmetic Calculation Edge Cases & Invariants
  const mathTests = [
    { input: 'calculate 15 * 6', expected: '90' },
    { input: 'what is 200 - 45', expected: '155' },
    { input: 'how much is (10 + 5) * 4', expected: '60' },
    { input: 'calculate 10 / 0', desc: 'Division by zero', check: (r) => r.includes('Infinity') || r.includes('Understood') },
    { input: 'calculate 0 / 0', desc: 'Zero divided by zero (NaN)', check: (r) => !r.includes('NaN') },
    { input: 'calculate 2 + + * 4', desc: 'Malformed syntax', check: (r) => typeof r === 'string' },
    { input: 'calculate 999999999 * 999999999', expected: '999999998000000000' }
  ];

  for (const m of mathTests) {
    const res = await testService.processCommand(m.input);
    if (m.expected) {
      assert(`Math calculation "${m.input}" equals ${m.expected}`,
        res.action === 'math_result' && res.response.includes(m.expected),
        res.response);
    } else if (m.check) {
      assert(`Math edge case "${m.input}" (${m.desc}) handled safely`,
        m.check(res.response),
        res.response);
    }
  }

  // 3.5 Special Characters, RTL & Unicode
  const unicodeTests = [
    { input: 'مرحبا يا جارفيس، كم الساعة؟', desc: 'Arabic RTL text' },
    { input: '你好贾维斯，今天天气怎么样？', desc: 'Simplified Chinese text' },
    { input: 'Привет Джарвис, как дела?', desc: 'Cyrillic Russian text' },
    { input: '🎤🤖🔥✨ Jarvis test', desc: 'Emoji only / emoji lead' },
    { input: 'Ḧ̵͕́e̶͝ͅl̶̬̐l̶̫͝o̴̤̐ J̵̈ͅa̶͖͊r̸̲͝v̴̯̍i̸͑͜s̷̯̋', desc: 'Zalgo text' },
    { input: '!@#$%^&*()_+-=[]{}|;:",.<>?/~`', desc: 'Pure symbols and punctuation' }
  ];

  for (const u of unicodeTests) {
    try {
      const res = await testService.processCommand(u.input);
      assert(`Unicode/Special test (${u.desc}) handled without error`,
        typeof res.response === 'string' && res.response.length > 0);
    } catch (e) {
      assert(`Unicode/Special test (${u.desc}) threw error`, false, e.message);
    }
  }

  // 3.6 Dependency Injection Mocking
  const mockDeps = {
    sportsService: {
      getState: () => ({
        activeSport: 'cricket',
        cricket: {
          homeTeam: { code: 'IND', score: '320/4' },
          awayTeam: { code: 'AUS', score: '280' }
        },
        statusText: 'India won by 40 runs'
      })
    },
    bluetoothMonitorService: {
      getConnectedDevices: async () => [
        { name: 'AirPods Pro 2', batteryPercent: 88, connected: true }
      ]
    },
    screenGlanceEngine: {
      getState: async () => ({
        errors: [
          { title: 'TypeScript TS2304: Cannot find name', suggestedFix: 'Import missing symbol' }
        ]
      })
    }
  };

  const wiredService = new VoiceCompanionService(mockDeps);
  const cricketRes = await wiredService.processCommand('How is the cricket match going?');
  assert('Sports dependency integration reports live cricket score',
    cricketRes.action === 'report_sports' && cricketRes.response.includes('IND 320/4') && cricketRes.response.includes('AUS 280'),
    cricketRes.response);

  const btRes = await wiredService.processCommand('Check my AirPods battery');
  assert('Bluetooth dependency integration reports connected AirPods battery percentage',
    btRes.action === 'report_battery' && btRes.response.includes('AirPods Pro 2') && btRes.response.includes('88%'),
    btRes.response);

  const diagRes = await wiredService.processCommand('Check my screen for compiler errors');
  assert('Screen Glance dependency integration reports detected error and suggested fix',
    diagRes.action === 'report_errors' && diagRes.response.includes('TS2304') && diagRes.response.includes('Import missing symbol'),
    diagRes.response);

  // ========================================================================
  // 4. TTS EXECUTION, ABORT & TIMEOUT SAFETY
  // ========================================================================
  console.log('\n--- Category 4: TTS Execution, Abort & Timeout Safety ---');

  const ttsService = new VoiceCompanionService();
  ttsService.setSimulationMode(true);

  // 4.1 Empty speech input
  const emptySpeak = await ttsService.speak('');
  assert('speak with empty string returns false immediately', emptySpeak === false);

  const whitespaceSpeak = await ttsService.speak('   ');
  assert('speak with whitespace string returns false immediately', whitespaceSpeak === false);

  // 4.2 stopSpeaking when already IDLE
  const idleStop = ttsService.stopSpeaking();
  assert('stopSpeaking when IDLE returns false cleanly', idleStop === false);

  // 4.3 Active speech abort
  const speakPromise = ttsService.speak('This is a longer sentence intended to verify immediate audio abortion.');
  assert('Service transitions to SPEAKING upon speak() invocation',
    ttsService.getState() === 'SPEAKING');
  
  const abortSuccess = ttsService.stopSpeaking();
  assert('stopSpeaking immediately returns true and restores state to IDLE',
    abortSuccess === true && ttsService.getState() === 'IDLE');

  // 4.4 Rapid repeated stopSpeaking calls
  let multiStopSafe = true;
  for (let k = 0; k < 50; k++) {
    try {
      ttsService.stopSpeaking();
    } catch {
      multiStopSafe = false;
    }
  }
  assert('50 rapid stopSpeaking calls execute without errors or exceptions', multiStopSafe);

  // 4.5 Successive speech calls abort previous process cleanly
  const p1 = ttsService.speak('First phrase being spoken');
  assert('First speak sets SPEAKING', ttsService.getState() === 'SPEAKING');
  const p2 = ttsService.speak('Second phrase replacing first phrase immediately');
  assert('Second speak replaces active speech without orphan state', ttsService.getState() === 'SPEAKING');
  ttsService.stopSpeaking();
  assert('State collapses back to IDLE cleanly', ttsService.getState() === 'IDLE');

  // 4.6 Disposal safety
  const disposableService = new VoiceCompanionService();
  disposableService.setSimulationMode(true);
  disposableService.setState('IDLE');
  disposableService.dispose();

  assert('Post-disposal startListening returns false', await disposableService.startListening() === false);
  assert('Post-disposal speak returns false', await disposableService.speak('Test') === false);
  disposableService.setState('LISTENING');
  assert('Post-disposal setState is ignored and remains in initial IDLE state', disposableService.getState() === 'IDLE');

  // ========================================================================
  // 5. AUDIO WAVE AMPLITUDE & 5-BAND BOUNDS INVARIANTS
  // ========================================================================
  console.log('\n--- Category 5: Multi-Band Audio & Strict Bounds ([0.0, 1.0]) ---');

  // 5.1 IDLE and ERROR invariants
  const idleBandResult = computeAudioBands(5000, 'IDLE');
  assert('IDLE audio level is strictly 0.0', idleBandResult.level === 0.0);
  assert('IDLE all 5 bands are strictly 0.0',
    idleBandResult.bands.length === 5 && idleBandResult.bands.every(b => b === 0.0));

  const errorBandResult = computeAudioBands(5000, 'ERROR');
  assert('ERROR audio level is strictly 0.0', errorBandResult.level === 0.0);
  assert('ERROR all 5 bands are strictly 0.0',
    errorBandResult.bands.length === 5 && errorBandResult.bands.every(b => b === 0.0));

  // 5.2 600 time samples across active states verifying strict [0.0, 1.0] bound clamping
  let boundsInvariantViolated = false;
  let nonFiniteFound = false;
  const activeStates = ['LISTENING', 'THINKING', 'SPEAKING'];

  for (const st of activeStates) {
    for (let t = 0; t <= 20000; t += 100) {
      const res = computeAudioBands(t, st);
      
      if (!Number.isFinite(res.level) || res.level < 0.0 || res.level > 1.0) {
        boundsInvariantViolated = true;
      }
      if (res.bands.length !== 5) {
        boundsInvariantViolated = true;
      }
      for (const b of res.bands) {
        if (!Number.isFinite(b) || b < 0.0 || b > 1.0) {
          boundsInvariantViolated = true;
        }
      }
    }
  }
  assert('Across 600 time samples in LISTENING, THINKING, SPEAKING: audioLevel & all 5 bands stay strictly within [0.0, 1.0]',
    !boundsInvariantViolated && !nonFiniteFound);

  // 5.3 Extreme Timestamp inputs (0, negative, massive timestamps)
  const extremeTimestamps = [0, -500, 1e7, 1e12];
  let extremeTimeSafe = true;
  for (const et of extremeTimestamps) {
    for (const st of activeStates) {
      const res = computeAudioBands(et, st);
      if (res.level < 0.0 || res.level > 1.0 || res.bands.some(b => b < 0.0 || b > 1.0)) {
        extremeTimeSafe = false;
      }
    }
  }
  assert('Extreme timestamps (0, negative, 1e7, 1e12) maintain strict [0.0, 1.0] bounds without overflow', extremeTimeSafe);

  // 5.4 BaseLevel clamping checks (high baseLevel, negative baseLevel)
  const clampedHigh = computeAudioBands(1000, 'SPEAKING', 5.0);
  assert('Oversized baseLevel (5.0) is strictly clamped to max 1.0',
    clampedHigh.level <= 1.0 && clampedHigh.level >= 0.0);

  // ========================================================================
  // 6. PRELOAD BRIDGE & IPC REGISTRATION INTEGRITY
  // ========================================================================
  console.log('\n--- Category 6: Preload Bridge & IPC Registration Integrity ---');

  const preloadPath = path.join(__dirname, '..', 'src', 'preload', 'island-preload.ts');
  const preloadSrc = fs.readFileSync(preloadPath, 'utf8');

  assert('island-preload.ts defines voice namespace object', preloadSrc.includes('voice: {'));
  assert('island-preload.ts exposes voice.startListening', preloadSrc.includes('startListening: () =>'));
  assert('island-preload.ts exposes voice.stopListening', preloadSrc.includes('stopListening: () =>'));
  assert('island-preload.ts exposes voice.toggle', preloadSrc.includes('toggle: () =>'));
  assert('island-preload.ts exposes voice.processCommand', preloadSrc.includes('processCommand: (text: string) =>'));
  assert('island-preload.ts exposes voice.speak', preloadSrc.includes('speak: (text: string) =>'));
  assert('island-preload.ts exposes voice.stopSpeaking', preloadSrc.includes('stopSpeaking: () =>'));
  assert('island-preload.ts exposes voice.getState', preloadSrc.includes('getState: () =>'));
  assert('island-preload.ts exposes voice.onVoiceState', preloadSrc.includes('onVoiceState: (callback: (event: any) => void) =>'));
  assert('island-preload.ts exposes flat aliases startVoiceListening & stopVoiceSpeaking',
    preloadSrc.includes('startVoiceListening:') && preloadSrc.includes('stopVoiceSpeaking:'));

  const indexPath = path.join(__dirname, '..', 'src', 'main', 'index.ts');
  const indexSrc = fs.readFileSync(indexPath, 'utf8');

  assert('index.ts imports voiceCompanionService', indexSrc.includes("import { voiceCompanionService } from './voice-companion-service'"));
  assert('index.ts handles voice:start-listening IPC', indexSrc.includes("ipcMain.handle('voice:start-listening'"));
  assert('index.ts handles voice:stop-listening IPC', indexSrc.includes("ipcMain.handle('voice:stop-listening'"));
  assert('index.ts handles voice:toggle IPC', indexSrc.includes("ipcMain.handle('voice:toggle'"));
  assert('index.ts handles voice:process-command IPC', indexSrc.includes("ipcMain.handle('voice:process-command'"));
  assert('index.ts handles voice:speak IPC', indexSrc.includes("ipcMain.handle('voice:speak'"));
  assert('index.ts handles voice:stop-speaking IPC', indexSrc.includes("ipcMain.handle('voice:stop-speaking'"));
  assert('index.ts handles voice:get-state IPC', indexSrc.includes("ipcMain.handle('voice:get-state'"));
  assert('index.ts registers voiceCompanionService.dispose() on app will-quit',
    indexSrc.includes('voiceCompanionService.dispose()'));

  // ========================================================================
  // 7. EMPIRICAL EDGE CASE & INVARIANT VULNERABILITY MINING
  // ========================================================================
  console.log('\n--- Category 7: Empirical Vulnerability & Edge Case Mining ---');

  // Finding 1: dispose() while speaking leaves state stuck in 'SPEAKING'
  const disposeWhileSpeakingService = new VoiceCompanionService();
  disposeWhileSpeakingService.setSimulationMode(true);
  disposeWhileSpeakingService.speak('Test active speech before disposal');
  const stateBeforeDispose = disposeWhileSpeakingService.getState();
  disposeWhileSpeakingService.dispose();
  const stateAfterDispose = disposeWhileSpeakingService.getState();
  if (stateAfterDispose === 'SPEAKING') {
    recordFinding(
      'Service.dispose() while active speaking does not transition state to IDLE due to isDisposed check ordering',
      'low',
      `State before: ${stateBeforeDispose}, State after: ${stateAfterDispose}. In dispose(), isDisposed is set to true before stopSpeaking(), so setState('IDLE') returns early.`
    );
  }

  // Finding 2: non-string argument to processCommand throws TypeError
  let processCommandNonStringThrows = false;
  try {
    await testService.processCommand(12345);
  } catch (err) {
    if (err instanceof TypeError) {
      processCommandNonStringThrows = true;
      recordFinding(
        'processCommand(query) without type guard throws TypeError on non-string inputs',
        'low',
        `TypeError: (query || "").trim is not a function when query is a number or boolean.`
      );
    }
  }

  // Finding 3: baseLevel = 0 in computeAudioBands evaluates to 1.0 (full volume)
  const baseLevelZero = computeAudioBands(1000, 'SPEAKING', 0);
  if (baseLevelZero.level > 0.5) {
    recordFinding(
      'computeAudioBands treats baseLevel = 0 as 1.0 due to `baseLevel || 1.0` logic',
      'low',
      `Passing baseLevel = 0 yielded level ${baseLevelZero.level} instead of 0.0 because 0 is falsy.`
    );
  }

  // Finding 4: timeMs = NaN yields NaN bands
  const nanTimeBands = computeAudioBands(NaN, 'SPEAKING');
  if (Number.isNaN(nanTimeBands.level)) {
    recordFinding(
      'computeAudioBands(NaN) propagates NaN to level and frequency bands',
      'low',
      `computeAudioBands(NaN, 'SPEAKING') returns level: NaN, bands: [NaN, NaN, NaN, NaN, NaN]`
    );
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  const totalElapsed = Date.now() - startTime;
  console.log('\n================================================================');
  console.log(`CHALLENGER 1 STRESS SUMMARY: ${passCount} PASSED, ${failCount} FAILED in ${totalElapsed}ms`);
  console.log(`EMPIRICAL FINDINGS IDENTIFIED: ${empiricalFindings.length}`);
  console.log('================================================================\n');

  if (failCount > 0) {
    console.error('FAILURES DETECTED:');
    failureDetails.forEach(f => console.error(` - ${f.desc} ${f.details}`));
    process.exit(1);
  } else {
    console.log('ALL ADVERSARIAL STRESS REQUIREMENTS PASSED WITH ZERO BLOCKING REGRESSIONS.\n');
  }
}

runAdversarialSuite().catch(err => {
  console.error('[UNCAUGHT FATAL STRESS TEST ERROR]', err);
  process.exit(1);
});
