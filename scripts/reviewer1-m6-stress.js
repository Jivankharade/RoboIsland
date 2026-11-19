/**
 * Reviewer 1 Adversarial Stress Test Suite for Milestone 6
 * (Full Hands-Free Voice Companion Mode - Jarvis Voice)
 */

const assert = require('assert');
const {
  VoiceCompanionService,
  detectWakeWord,
  computeAudioBands
} = require('../dist/main/voice-companion-service');

async function runStressTests() {
  console.log('=== Reviewer 1 M6 Adversarial Stress Testing ===');

  // Test 1: ReDoS & Malformed Wake Word Stress
  console.log('[1/5] Testing Wake Word ReDoS & Boundary Resilience...');
  const t0 = Date.now();
  const evilInputs = [
    'hey '.repeat(2000) + 'jarvis',
    'hey   \t\n  jarvis:::   what time is it?',
    'ROBOISLAND'.repeat(500),
    'hey robo '.repeat(500) + 'island',
    '\u0000\u0001\u0002 hey jarvis \uFFFF',
    '   ',
    null,
    undefined,
    12345,
    { text: 'hey jarvis' }
  ];

  for (const input of evilInputs) {
    const res = detectWakeWord(input);
    assert(typeof res === 'object');
    assert(typeof res.detected === 'boolean');
    assert(typeof res.strippedText === 'string');
  }
  const dt1 = Date.now() - t0;
  console.log(`✓ Wake word stress passed in ${dt1}ms`);

  // Test 2: Audio Band Computation Edge Values
  console.log('[2/5] Testing Audio Band Simulator Edge Values...');
  const testTimes = [-1000, 0, 1, 999999999, 1e12];
  const states = ['IDLE', 'LISTENING', 'THINKING', 'SPEAKING', 'ERROR'];

  for (const st of states) {
    for (const t of testTimes) {
      const res = computeAudioBands(t, st, 1.0);
      assert(typeof res.level === 'number' && !isNaN(res.level));
      assert(res.level >= 0.0 && res.level <= 1.0);
      assert(Array.isArray(res.bands) && res.bands.length === 5);
      for (const b of res.bands) {
        assert(typeof b === 'number' && !isNaN(b));
        assert(b >= 0.0 && b <= 1.0);
      }
    }
  }
  console.log('✓ Audio band simulator bounds verified [0.0 - 1.0]');

  // Test 3: Rapid FSM Thrashing & Concurrent Calls
  console.log('[3/5] Testing Rapid FSM State Thrashing...');
  const svc = new VoiceCompanionService();
  svc.setSimulationMode(true);

  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(svc.startListening());
    promises.push(svc.toggleListening());
    promises.push(svc.speak(`Thrash test iteration ${i}`));
    promises.push(Promise.resolve(svc.stopSpeaking()));
  }
  await Promise.all(promises);
  assert(['IDLE', 'LISTENING', 'SPEAKING', 'THINKING', 'ERROR'].includes(svc.getState()));
  console.log(`✓ FSM survived 200 concurrent transitions without unhandled rejection; final state: ${svc.getState()}`);

  // Test 4: Adversarial Intent & Query Processing
  console.log('[4/5] Testing Adversarial Intent Processing...');
  const evilQueries = [
    '',
    '    ',
    '\n\n\t',
    'calculate 1/0',
    'calculate ' + '('.repeat(500) + '1' + ')'.repeat(500),
    'calculate 99999999999999999999999999999999999999 * 999999999999999999999999999',
    'who are you '.repeat(200),
    'battery status with sports error glance 12345',
    '😊🎉🚀 jarvis 🔥⚡',
    '<script>alert("xss")</script>',
    "'; DROP TABLE users; --"
  ];

  for (const q of evilQueries) {
    const res = await svc.processCommand(q);
    assert(res && typeof res.response === 'string' && res.response.length > 0);
    assert(typeof res.action === 'string');
  }
  console.log('✓ All 11 adversarial queries handled gracefully');

  // Test 5: Safe Disposal & Post-Disposal Calls
  console.log('[5/5] Testing Lifecycle Disposal & Post-Disposal Safety...');
  svc.dispose();
  svc.dispose(); // Duplicate dispose should be idempotent

  // Post-disposal methods must not throw
  assert(await svc.startListening() === false);
  assert(await svc.stopListening() === false);
  assert(await svc.speak('hello') === false);
  const postDisposalRes = await svc.handleVoiceInput('hello');
  assert(postDisposalRes.response.includes('offline'));
  console.log('✓ Idempotent disposal and post-disposal safety confirmed');

  console.log('\n=== ALL ADVERSARIAL STRESS TESTS PASSED ===\n');
}

runStressTests().catch((err) => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
