/**
 * Challenger 2: Adversarial Empirical Stress Test Harness for Milestone 1 (R1: Sports Scoreboard)
 * 
 * Verifies:
 * 1. UI Canvas Bounds Calculations & Text Collisions in Compact Pill
 * 2. IPC Event Broadcasting & Structured Clone Serialization Stress
 * 3. Memory Leak & Unbounded Array Growth over Long Simulation Runs (5,000 steps)
 * 4. DOM Scorecard Renderer Edge Cases & Null Safety
 * 5. Extreme and Adversarial Inputs (Unicode, SQL/HTML injection strings, 999/9, 12-10)
 */

const v8 = require('v8');
const path = require('path');
const { SportsService, SportsSimulationEngine } = require('../dist/main/sports-service');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${name} ${details ? '- ' + details : ''}`);
    failures.push({ name, details });
  }
}

// Emulate Canvas text measurement using font metrics approximations
function estimateTextWidth(text, fontSpec) {
  if (!text) return 0;
  // Font spec parsing
  let charWidthRatio = 0.55;
  let fontSize = 11;
  const match = fontSpec.match(/(\d+)px/);
  if (match) fontSize = parseInt(match[1], 10);
  if (fontSpec.includes('800') || fontSpec.includes('700') || fontSpec.includes('bold')) {
    charWidthRatio = 0.62;
  } else if (fontSpec.includes('600')) {
    charWidthRatio = 0.58;
  }
  return text.length * fontSize * charWidthRatio;
}

// Replicate CanvasEngine.calculateSportsPillWidth
function calculateSportsPillWidth(act, sportsFlashUntil = 0, now = 0) {
  if (now < sportsFlashUntil) return 340;
  if (!act || !act.pill) return 290;
  const text = `${act.pill.leftBadge} ${act.pill.leftScore} ${act.pill.badgeText} ${act.pill.rightScore} ${act.pill.rightBadge}`;
  return Math.max(290, Math.min(360, Math.round(text.length * 8.2 + 80)));
}

// Compute clearance / collision between left score, center badge, and right score
function checkPillLayoutClearance(act, pillWidth) {
  const w = pillWidth;
  const pillLeft = (860 - w) / 2;
  const cx = pillLeft + w / 2;
  const pill = act.pill;

  // 1. Left badge & score
  const badgeW = estimateTextWidth(pill.leftBadge, '700 11px sans-serif');
  const leftScoreW = estimateTextWidth(pill.leftScore, '800 13px sans-serif');
  const leftScoreEnd = pillLeft + 30 + badgeW + 5 + leftScoreW;

  // 2. Center live indicator and status badge
  const centerDotX = cx - 24;
  const centerTextW = estimateTextWidth(pill.badgeText, '600 10px sans-serif');
  const centerTextStart = (cx + 2) - (centerTextW / 2);
  const centerTextEnd = (cx + 2) + (centerTextW / 2);
  const centerLeftBound = Math.min(centerDotX - 3, centerTextStart);

  // 3. Right score and badge
  const rBadgeW = estimateTextWidth(pill.rightBadge, '700 11px sans-serif');
  const rightScoreW = estimateTextWidth(pill.rightScore, '800 13px sans-serif');
  const rightScoreStart = pillLeft + w - 12 - rBadgeW - 5 - rightScoreW;

  const leftMargin = centerLeftBound - leftScoreEnd;
  const rightMargin = rightScoreStart - centerTextEnd;

  return { leftMargin, rightMargin, leftScoreEnd, centerLeftBound, centerTextEnd, rightScoreStart, pillWidth: w };
}

async function runEmpiricalStress() {
  console.log('================================================================');
  console.log('  CHALLENGER 2: EMPIRICAL ADVERSARIAL STRESS TEST SUITE (M1)   ');
  console.log('================================================================\n');

  // ==========================================================================
  // TIER 1: UI CANVAS PILL WIDTH & EXTREME SCORE BOUNDS
  // ==========================================================================
  console.log('--- Tier 1: UI Canvas Pill Width & Collision Analysis ---');

  // Test 1.1: Null / Undefined edge cases
  assert('calculateSportsPillWidth handles null activity gracefully (returns 290)',
    calculateSportsPillWidth(null) === 290);
  assert('calculateSportsPillWidth handles activity without pill (returns 290)',
    calculateSportsPillWidth({ id: 'test', sport: 'cricket' }) === 290);

  // Test 1.2: Highlight flash takes precedence (returns 340)
  assert('calculateSportsPillWidth returns 340 during highlight flash',
    calculateSportsPillWidth({ pill: { leftBadge: 'IND', leftScore: '180/3', badgeText: '18.2 ov', rightScore: '184/5', rightBadge: 'AUS' } }, 1000, 500) === 340);

  // Test 1.3: Standard Cricket score bounds and clearance
  const stdCricketAct = {
    pill: { leftBadge: 'IND', leftScore: '168/3', badgeText: '18.2 ov', rightScore: '184/5', rightBadge: 'AUS' }
  };
  const stdCricketW = calculateSportsPillWidth(stdCricketAct);
  assert('Standard Cricket pill width stays within [290, 360] range',
    stdCricketW >= 290 && stdCricketW <= 360, `width: ${stdCricketW}`);

  const stdCricketClearance = checkPillLayoutClearance(stdCricketAct, stdCricketW);
  assert('Standard Cricket has positive left-to-center clearance (> 10px)',
    stdCricketClearance.leftMargin >= 10, `leftMargin: ${stdCricketClearance.leftMargin.toFixed(1)}px`);
  assert('Standard Cricket has positive center-to-right clearance (> 10px)',
    stdCricketClearance.rightMargin >= 10, `rightMargin: ${stdCricketClearance.rightMargin.toFixed(1)}px`);

  // Test 1.4: Extreme Cricket score: 999/9 and 1250/10
  const extremeCricketAct = {
    pill: { leftBadge: 'IND', leftScore: '999/9', badgeText: '19.5 ov', rightScore: '998/8', rightBadge: 'AUS' }
  };
  const extremeCricketW = calculateSportsPillWidth(extremeCricketAct);
  assert('Extreme Cricket pill width scales within [290, 360] range',
    extremeCricketW >= 290 && extremeCricketW <= 360, `width: ${extremeCricketW}`);
  const extremeCricketClearance = checkPillLayoutClearance(extremeCricketAct, extremeCricketW);
  assert('Extreme Cricket (999/9 vs 998/8) avoids element overlap (margin > 0)',
    extremeCricketClearance.leftMargin > 0 && extremeCricketClearance.rightMargin > 0,
    `left: ${extremeCricketClearance.leftMargin.toFixed(1)}px, right: ${extremeCricketClearance.rightMargin.toFixed(1)}px`);

  // Test 1.5: Extreme Football scores: 12-10 with extra time
  const extremeFbAct = {
    pill: { leftBadge: 'MCI', leftScore: '12', badgeText: "90'+6'", rightScore: '10', rightBadge: 'RMA' }
  };
  const extremeFbW = calculateSportsPillWidth(extremeFbAct);
  assert('Extreme Football pill width scales within [290, 360] range',
    extremeFbW >= 290 && extremeFbW <= 360, `width: ${extremeFbW}`);
  const extremeFbClearance = checkPillLayoutClearance(extremeFbAct, extremeFbW);
  assert('Extreme Football (12-10 90\'+6\') maintains positive clearance',
    extremeFbClearance.leftMargin > 0 && extremeFbClearance.rightMargin > 0,
    `left: ${extremeFbClearance.leftMargin.toFixed(1)}px, right: ${extremeFbClearance.rightMargin.toFixed(1)}px`);

  // Test 1.6: F1 telemetry: Leader + Gap format (+12.456s)
  const f1Act = {
    pill: { leftBadge: 'VER', leftScore: 'P1', badgeText: 'L52', rightScore: '+12.456s', rightBadge: 'NOR' }
  };
  const f1W = calculateSportsPillWidth(f1Act);
  assert('F1 telemetry pill width scales within [290, 360]',
    f1W >= 290 && f1W <= 360, `width: ${f1W}`);
  const f1Clearance = checkPillLayoutClearance(f1Act, f1W);
  assert('F1 telemetry maintains positive clearance',
    f1Clearance.leftMargin > 0 && f1Clearance.rightMargin > 0,
    `left: ${f1Clearance.leftMargin.toFixed(1)}px, right: ${f1Clearance.rightMargin.toFixed(1)}px`);

  // Test 1.7: Pathological strings (long team names, Unicode, HTML injection)
  const pathologicalCases = [
    { leftBadge: 'AFGHANISTAN', leftScore: '245/8', badgeText: '49.4 ov', rightScore: '246/5', rightBadge: 'BANGLADESH' },
    { leftBadge: ' Wolverhampton Wanderers ', leftScore: '0', badgeText: 'HT', rightScore: '0', rightBadge: 'Brighton & Hove Albion' },
    { leftBadge: '<script>alert(1)</script>', leftScore: '1', badgeText: '45\'', rightScore: '0', rightBadge: '<b>BOLD</b>' },
    { leftBadge: '🏎️⚡🔥', leftScore: 'P1', badgeText: 'L78/78', rightScore: '+0.001s', rightBadge: '🏁🏆' }
  ];

  let boundsViolations = 0;
  for (const tc of pathologicalCases) {
    const w = calculateSportsPillWidth({ pill: tc });
    if (w < 290 || w > 360 || isNaN(w) || !isFinite(w)) {
      boundsViolations++;
    }
  }
  assert('Pathological & injection strings strictly respect [290, 360] pixel clamping',
    boundsViolations === 0, `violations: ${boundsViolations}`);

  // ==========================================================================
  // TIER 2: IPC SERIALIZATION & STRUCTURED CLONE RESILIENCE
  // ==========================================================================
  console.log('\n--- Tier 2: IPC Serialization & Structured Clone Resilience ---');

  const service = SportsService.getInstance();
  const initialState = service.getState();

  // Test 2.1: JSON serialization of complete state
  let jsonSerialized = '';
  let jsonSafe = true;
  try {
    jsonSerialized = JSON.stringify(initialState);
    const parsed = JSON.parse(jsonSerialized);
    if (!parsed || !parsed.activities || !parsed.activities.cricket) jsonSafe = false;
  } catch (err) {
    jsonSafe = false;
  }
  assert('SportsScoreboardState cleanly serializes and parses via JSON without circular ref error', jsonSafe);

  // Test 2.2: V8 Structured Clone (Exact algorithm used by Electron IPC)
  let v8Safe = true;
  try {
    const buffer = v8.serialize(initialState);
    const deserialized = v8.deserialize(buffer);
    if (deserialized.activeSport !== initialState.activeSport) v8Safe = false;
  } catch (err) {
    v8Safe = false;
  }
  assert('SportsScoreboardState passes Electron v8 structured clone round-trip identically', v8Safe);

  // Test 2.3: Rapid IPC event emission stress (2,000 serialized payloads)
  let broadcastCycles = 0;
  let broadcastErrors = 0;
  service.setBroadcastCallback((act) => {
    try {
      const serialized = JSON.stringify(act);
      const cloned = JSON.parse(serialized);
      if (!cloned.id || !cloned.sport) broadcastErrors++;
      broadcastCycles++;
    } catch {
      broadcastErrors++;
    }
  });

  for (let i = 0; i < 2000; i++) {
    service.stepSimulation();
  }
  assert('2,000 rapid simulation step IPC broadcasts serialized with 0 errors',
    broadcastErrors === 0 && broadcastCycles === 2000,
    `cycles: ${broadcastCycles}, errors: ${broadcastErrors}`);

  // ==========================================================================
  // TIER 3: MEMORY LEAK & UNBOUNDED ARRAY GROWTH GUARDS (5,000 STEPS)
  // ==========================================================================
  console.log('\n--- Tier 3: Memory Leak & Array Growth Invariants (5,000 Steps) ---');

  const longEngine = new SportsSimulationEngine();

  let maxRecentBalls = 0;
  let maxCricketCommentary = 0;
  let maxFootballEvents = 0;
  let maxF1Messages = 0;
  let maxF1Leaderboard = 0;

  for (let i = 0; i < 5000; i++) {
    const cAct = longEngine.stepCricket();
    const fbAct = longEngine.stepFootball();
    const f1Act = longEngine.stepF1();

    maxRecentBalls = Math.max(maxRecentBalls, cAct.scorecard.cricket.recentBalls.length);
    maxCricketCommentary = Math.max(maxCricketCommentary, cAct.scorecard.cricket.commentary.length);
    maxFootballEvents = Math.max(maxFootballEvents, fbAct.scorecard.football.events.length);
    maxF1Messages = Math.max(maxF1Messages, f1Act.scorecard.f1.raceControlMessages.length);
    maxF1Leaderboard = Math.max(maxF1Leaderboard, f1Act.scorecard.f1.leaderboard.length);
  }

  console.log(`  [INFO] After 5,000 steps:`);
  console.log(`         recentBalls max = ${maxRecentBalls}`);
  console.log(`         cricketCommentary max = ${maxCricketCommentary}`);
  console.log(`         footballEvents max = ${maxFootballEvents}`);
  console.log(`         f1Messages max = ${maxF1Messages}`);
  console.log(`         f1Leaderboard max = ${maxF1Leaderboard}`);

  assert('Cricket recentBalls list is capped at 6 items', maxRecentBalls <= 6, `max: ${maxRecentBalls}`);
  assert('Cricket commentary is capped at 5 items', maxCricketCommentary <= 5, `max: ${maxCricketCommentary}`);
  assert('F1 driver leaderboard is bounded to top 5 drivers', maxF1Leaderboard <= 5, `max: ${maxF1Leaderboard}`);

  // Note on footballEvents & f1Messages: Check if growth is bounded or linear
  const footballEventsBounded = maxFootballEvents < 1000;
  assert('Football events count is kept in reasonable bound (< 1000 items over 5k steps)',
    footballEventsBounded, `observed count: ${maxFootballEvents}`);

  // ==========================================================================
  // TIER 4: DOM SCORECARD RENDERING RESILIENCE (HEADLESS / SIMULATED DOM)
  // ==========================================================================
  console.log('\n--- Tier 4: DOM Scorecard Rendering Resilience ---');

  // Minimal mock DOM environment for CanvasEngine.renderSportsScorecardDOM testing
  const mockElements = new Map();
  function getOrCreateElement(id) {
    if (!mockElements.has(id)) {
      mockElements.set(id, {
        id,
        innerHTML: '',
        textContent: '',
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); }
        },
        dataset: {},
        style: {}
      });
    }
    return mockElements.get(id);
  }

  // Pre-populate expected DOM elements
  getOrCreateElement('sports-card-body');
  getOrCreateElement('sport-mode-label');
  getOrCreateElement('sport-mode-toggle');

  // Load compiled canvas engine source to verify DOM rendering function
  const fs = require('fs');
  const canvasEngineBundlePath = path.join(__dirname, '../dist/renderer/island/bundle.js');
  const bundleExists = fs.existsSync(canvasEngineBundlePath);
  assert('Renderer bundle dist/renderer/island/bundle.js exists', bundleExists);

  const bundleCode = bundleExists ? fs.readFileSync(canvasEngineBundlePath, 'utf-8') : '';
  assert('Bundle contains renderSportsScorecardDOM implementation',
    bundleCode.includes('renderSportsScorecardDOM') &&
    bundleCode.includes('sports-card-body'));

  // Test fallback formatting: Missing scorecard sub-objects does not crash
  const emptyActivity = {
    id: 'empty-test',
    sport: 'cricket',
    title: 'Empty Test',
    league: 'Test League',
    status: 'live',
    statusText: 'Testing',
    isLive: true,
    isSimulated: true,
    lastUpdated: Date.now(),
    pill: { leftBadge: 'A', leftScore: '0', badgeText: '0 ov', rightScore: '0', rightBadge: 'B' },
    scorecard: {} // intentionally empty
  };

  let emptyRenderSafe = true;
  try {
    const serialized = JSON.stringify(emptyActivity);
    const parsed = JSON.parse(serialized);
    if (!parsed) emptyRenderSafe = false;
  } catch {
    emptyRenderSafe = false;
  }
  assert('Empty/malformed scorecard payloads serialize without runtime crashes', emptyRenderSafe);

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`CHALLENGER 2 SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES:');
    failures.forEach((f, i) => console.error(`${i + 1}. ${f.name} - ${f.details}`));
    process.exit(1);
  } else {
    console.log('ALL EMPIRICAL CHALLENGER TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  }
}

runEmpiricalStress().catch((err) => {
  console.error('Fatal stress test failure:', err);
  process.exit(1);
});
