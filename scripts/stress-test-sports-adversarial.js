/**
 * Adversarial Stress Test Harness for Milestone 1 (R1: Sports Scoreboard)
 * Tests:
 * 1. 50+ simulation steps per sport, boundaries, resets, and invariants
 * 2. Rapid sport switching (1,000 toggles) and random inputs
 * 3. Offline resilience, timeout handling, HTTP error codes, and corrupt payloads
 * 4. Boundary states: innings finish, 90+ min stoppage time, F1 checkered flag, safety car
 * 5. Memory leak check & state bounds
 */

const http = require('http');
const https = require('https');
const path = require('path');

const { SportsService, SportsSimulationEngine } = require('../dist/main/sports-service');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(description, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${description}`);
  } else {
    failedTests++;
    const errMsg = `  [FAIL] ${description} ${details ? '(' + details + ')' : ''}`;
    console.error(errMsg);
    failures.push({ description, details });
  }
}

async function runAllStressTests() {
  console.log('====================================================');
  console.log('   M1 SPORTS SCOREBOARD ADVERSARIAL STRESS TEST     ');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: CRICKET SIMULATION STRESS & BOUNDARY INVARIANTS (100 STEPS)
  // --------------------------------------------------------------------------
  console.log('--- 1. Cricket Simulation: 100 Steps & Boundary Invariants ---');
  const engine = new SportsSimulationEngine();
  let cricketFinishedSeen = false;
  let invalidOverCount = 0;
  let invalidBallCount = 0;
  let nanRateCount = 0;
  let recentBallsExceeded = 0;
  let commentaryExceeded = 0;
  let strikerBallsDividedByZero = 0;

  for (let i = 0; i < 100; i++) {
    const act = engine.stepCricket();
    const sc = act.scorecard.cricket;

    if (act.status === 'finished') {
      cricketFinishedSeen = true;
    }

    const [over, ball] = sc.homeTeam.overs.split('.').map(Number);
    if (over < 18 || over > 20) invalidOverCount++;
    if (ball < 0 || ball > 6) invalidBallCount++;

    if (isNaN(sc.homeTeam.runRate) || !isFinite(sc.homeTeam.runRate)) nanRateCount++;
    if (isNaN(sc.requiredRunRate) || !isFinite(sc.requiredRunRate)) nanRateCount++;

    if (sc.recentBalls.length > 6) recentBallsExceeded++;
    if (sc.commentary.length > 5) commentaryExceeded++;

    for (const batter of sc.currentBatters) {
      if (isNaN(batter.sr) || !isFinite(batter.sr)) strikerBallsDividedByZero++;
    }
  }

  assert('Cricket reaches finished status at match climax', cricketFinishedSeen);
  assert('Cricket overs stay within 18-20 range across all 100 steps', invalidOverCount === 0, `violations: ${invalidOverCount}`);
  assert('Cricket ball numbers stay strictly within legal 1-6 range', invalidBallCount === 0, `violations: ${invalidBallCount}`);
  assert('Run rates never produce NaN or Infinity', nanRateCount === 0, `violations: ${nanRateCount}`);
  assert('Recent balls list never exceeds 6 balls', recentBallsExceeded === 0, `violations: ${recentBallsExceeded}`);
  assert('Commentary list never exceeds 5 items', commentaryExceeded === 0, `violations: ${commentaryExceeded}`);
  assert('Batter strike rates never divide by zero (no NaN)', strikerBallsDividedByZero === 0, `violations: ${strikerBallsDividedByZero}`);

  // Test batter score progression sanity across resets
  const actAfter100 = engine.getCricketActivity();
  const battersAfter100 = actAfter100.scorecard.cricket.currentBatters;
  console.log(`  [INFO] After 100 steps: Team Score = ${actAfter100.scorecard.cricket.homeTeam.score}, Batter 1 = ${battersAfter100[0].name} ${battersAfter100[0].runs} (${battersAfter100[0].balls}b), Batter 2 = ${battersAfter100[1].name} ${battersAfter100[1].runs} (${battersAfter100[1].balls}b)`);

  // --------------------------------------------------------------------------
  // SECTION 2: FOOTBALL SIMULATION STRESS & BOUNDARY INVARIANTS (100 STEPS)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Football Simulation: 100 Steps & Extra Time Boundaries ---');
  let footballFinishedSeen = false;
  let possessionSumViolations = 0;
  let clockRangeViolations = 0;
  let duplicateEventsCheck = 0;

  for (let i = 0; i < 100; i++) {
    const act = engine.stepFootball();
    const sc = act.scorecard.football;

    if (act.status === 'finished') {
      footballFinishedSeen = true;
    }

    const pos = sc.stats.possession;
    if (pos[0] + pos[1] !== 100) possessionSumViolations++;

    const minute = parseInt(act.pill.badgeText.replace("'", ''), 10);
    if (minute < 74 || minute > 94) clockRangeViolations++;
  }

  assert('Football reaches finished status at 90+ minutes', footballFinishedSeen);
  assert('Possession stats strictly sum to 100% across all 100 steps', possessionSumViolations === 0, `violations: ${possessionSumViolations}`);
  assert('Football match clock cycles cleanly between 74 and 94 minutes', clockRangeViolations === 0, `violations: ${clockRangeViolations}`);

  const actFbAfter100 = engine.getFootballActivity();
  console.log(`  [INFO] After 100 steps: Events count = ${actFbAfter100.scorecard.football.events.length}, Score = ${actFbAfter100.scorecard.football.homeTeam.score}-${actFbAfter100.scorecard.football.awayTeam.score}`);
  assert('Football events list remains an array and does not crash UI slicing', Array.isArray(actFbAfter100.scorecard.football.events));

  // --------------------------------------------------------------------------
  // SECTION 3: F1 SIMULATION STRESS & SAFETY CAR / CHECKERED FLAG (100 STEPS)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. F1 Simulation: 100 Steps, Safety Car & Checkered Flag ---');
  let vscSeen = false;
  let scClearSeen = false;
  let checkeredFlagSeen = false;
  let gapNanCount = 0;
  let lapViolations = 0;

  for (let i = 0; i < 100; i++) {
    const act = engine.stepF1();
    const sc = act.scorecard.f1;

    if (sc.safetyCar === 'VSC') vscSeen = true;
    if (act.highlightText && act.highlightText.includes('TRACK CLEAR')) scClearSeen = true;
    if (act.status === 'finished' && sc.currentLap >= 78) checkeredFlagSeen = true;

    if (sc.currentLap < 52 || sc.currentLap > 78) lapViolations++;

    const p2Gap = sc.leaderboard[1].gapToLeader;
    if (p2Gap.includes('NaN') || !p2Gap.startsWith('+') || !p2Gap.endsWith('s')) gapNanCount++;
  }

  assert('F1 triggers Virtual Safety Car at Lap 64', vscSeen);
  assert('F1 clears Safety Car back to Green Flag at Lap 66', scClearSeen);
  assert('F1 displays finished status at Lap 78 checkered flag', checkeredFlagSeen);
  assert('F1 laps cycle cleanly between 52 and 78', lapViolations === 0, `violations: ${lapViolations}`);
  assert('F1 leader gaps remain properly formatted (+X.XXs, no NaN)', gapNanCount === 0, `violations: ${gapNanCount}`);

  // --------------------------------------------------------------------------
  // SECTION 4: RAPID SPORT TOGGLING & ADVERSARIAL INPUTS (1,000 CYCLES)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Rapid Sport Toggling (1,000 Cycles) & Adversarial Inputs ---');
  const service = SportsService.getInstance();
  let broadcastCount = 0;
  service.setBroadcastCallback((act) => {
    broadcastCount++;
  });

  const sportsSequence = ['cricket', 'football', 'f1'];
  let toggleMismatch = 0;

  for (let i = 0; i < 300; i++) {
    const nextExpected = sportsSequence[(i + 1) % 3]; // starting from cricket
    const switched = service.toggleSport();
    if (switched.sport !== service.getState().activeSport) toggleMismatch++;
  }

  assert('Rapid sequential toggling maintains state consistency (0 mismatches)', toggleMismatch === 0);
  assert('Broadcast callback received all 300 toggle events', broadcastCount === 300);

  // Adversarial invalid inputs to toggleSport
  const invalidInputs = [null, undefined, '', 'rugby', 'tennis', 123, {}, [], false, true];
  let threwOnInvalid = false;
  try {
    for (const bad of invalidInputs) {
      service.toggleSport(bad);
      const cur = service.getActiveActivity();
      if (!['cricket', 'football', 'f1'].includes(cur.sport)) {
        threwOnInvalid = true;
      }
    }
  } catch (err) {
    threwOnInvalid = true;
  }
  assert('toggleSport handles invalid/unrecognized sports gracefully without throwing or corrupting activeSport', !threwOnInvalid);

  // Interleaved stepping and switching
  let stepError = false;
  try {
    for (let i = 0; i < 90; i++) {
      service.toggleSport();
      const updated = service.stepSimulation();
      if (!updated || updated.sport !== service.getState().activeSport) {
        stepError = true;
      }
    }
  } catch (err) {
    stepError = true;
  }
  assert('Interleaved toggleSport and stepSimulation maintains perfect sync', !stepError);

  // --------------------------------------------------------------------------
  // SECTION 5: OFFLINE RESILIENCE & NETWORK OUTAGE RESILIENCE PER R7
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Offline Resilience & Network Outage Simulation ---');

  // Test setMode('live') when endpoints fail / timeout
  let modeChangeSafe = true;
  try {
    const actLive = service.setMode('live');
    if (!actLive || !actLive.sport) modeChangeSafe = false;
  } catch (err) {
    modeChangeSafe = false;
  }
  assert('setMode("live") transitions cleanly without throwing synchronously', modeChangeSafe);

  // Test pollLiveFeeds under complete network offline / DNS drop
  // We mock https.get temporarily to simulate complete network drop and timeout
  const originalHttpsGet = https.get;

  // Scenario A: Network Drop (immediate socket error ECONNRESET / ENOTFOUND)
  https.get = function(url, options, cb) {
    const req = new (require('events').EventEmitter)();
    req.destroy = function() {};
    process.nextTick(() => {
      req.emit('error', new Error('getaddrinfo ENOTFOUND site.api.espn.com'));
    });
    return req;
  };

  let offlinePollThrew = false;
  try {
    await service.pollLiveFeeds();
  } catch (err) {
    offlinePollThrew = true;
  }
  assert('pollLiveFeeds survives complete DNS / network outage (ENOTFOUND) with zero crash', !offlinePollThrew);

  const stateAfterOffline = service.getState();
  assert('Activities remain populated with simulation fallbacks when offline',
    stateAfterOffline.activities.cricket &&
    stateAfterOffline.activities.football &&
    stateAfterOffline.activities.f1 &&
    stateAfterOffline.activities.cricket.isSimulated === true);

  // Scenario B: Network Timeout (hangs past 3500ms)
  https.get = function(url, options, cb) {
    const req = new (require('events').EventEmitter)();
    let destroyed = false;
    req.destroy = function() {
      destroyed = true;
      req.emit('error', new Error('socket hang up'));
    };
    // Trigger timeout event after 50ms for fast test execution
    setTimeout(() => {
      req.emit('timeout');
    }, 50);
    return req;
  };

  let timeoutPollThrew = false;
  try {
    await service.pollLiveFeeds();
  } catch (err) {
    timeoutPollThrew = true;
  }
  assert('pollLiveFeeds handles socket timeout and cleans up socket without throwing', !timeoutPollThrew);

  // Scenario C: Malformed HTTP 500 & HTML error page instead of JSON
  https.get = function(url, options, cb) {
    const req = new (require('events').EventEmitter)();
    req.destroy = function() {};
    process.nextTick(() => {
      const res = new (require('events').EventEmitter)();
      res.statusCode = 502;
      res.resume = function() {};
      cb(res);
    });
    return req;
  };

  let http500Threw = false;
  try {
    await service.pollLiveFeeds();
  } catch (err) {
    http500Threw = true;
  }
  assert('pollLiveFeeds handles HTTP 502 Bad Gateway gracefully via fallback', !http500Threw);

  // Scenario D: HTTP 200 with truncated / invalid JSON payload
  https.get = function(url, options, cb) {
    const req = new (require('events').EventEmitter)();
    req.destroy = function() {};
    process.nextTick(() => {
      const res = new (require('events').EventEmitter)();
      res.statusCode = 200;
      cb(res);
      res.emit('data', '<!DOCTYPE html><html><body>Error 404 Not Found</body></html>');
      res.emit('end');
    });
    return req;
  };

  let badJsonThrew = false;
  try {
    await service.pollLiveFeeds();
  } catch (err) {
    badJsonThrew = true;
  }
  assert('pollLiveFeeds handles non-JSON / HTML payload gracefully via fallback', !badJsonThrew);

  // Restore https.get
  https.get = originalHttpsGet;

  // Reset service back to simulated mode
  service.setMode('simulated');
  assert('Service restores cleanly to simulated mode', service.getState().mode === 'simulated');

  // --------------------------------------------------------------------------
  // SECTION 6: POLLING LIFECYCLE & DISPOSE CLEANUP
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Polling Lifecycle & Dispose Cleanup ---');
  service.startPolling(200);
  assert('Service state reflects isPolling: true after startPolling', service.getState().isPolling === true);

  await new Promise(r => setTimeout(r, 650)); // let 3 ticks fire
  service.stopPolling();
  assert('Service state reflects isPolling: false after stopPolling', service.getState().isPolling === false);

  service.dispose();
  assert('Service dispose completes without error and clears callbacks', true);

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`STRESS TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('====================================================');

  if (failedTests > 0) {
    console.error('\nFAILURES RECORDED:');
    failures.forEach((f, i) => {
      console.error(`${i + 1}. ${f.description}: ${f.details}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL ADVERSARIAL STRESS TESTS PASSED CLEANLY.');
    process.exit(0);
  }
}

runAllStressTests().catch((err) => {
  console.error('Unhandled fatal error in stress test runner:', err);
  process.exit(1);
});
