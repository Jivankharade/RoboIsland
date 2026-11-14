#!/usr/bin/env node
/**
 * RoboIsland 2.0 - Opaque-Box E2E Test Suite Runner
 * 
 * Supports executing tests across Tiers 1-4:
 *   node tests/e2e/runner.js --all
 *   node tests/e2e/runner.js --tier 1
 *   node tests/e2e/runner.js --tier 2
 *   node tests/e2e/runner.js --tier 3
 *   node tests/e2e/runner.js --tier 4
 */

const path = require('path');

const tier1Suite = require('./tier1-features');
const tier2Suite = require('./tier2-boundaries');
const tier3Suite = require('./tier3-combinations');
const tier4Suite = require('./tier4-scenarios');

const allSuites = [
  tier1Suite,
  tier2Suite,
  tier3Suite,
  tier4Suite
];

// CLI Argument Parsing
function parseArgs(args) {
  let runAll = false;
  const tiersToRun = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all' || arg === '-a') {
      runAll = true;
    } else if (arg === '--tier' || arg === '-t') {
      const val = parseInt(args[i + 1], 10);
      if (!isNaN(val) && val >= 1 && val <= 4) {
        tiersToRun.push(val);
        i++;
      }
    } else if (arg.startsWith('--tier=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!isNaN(val) && val >= 1 && val <= 4) {
        tiersToRun.push(val);
      }
    }
  }

  if (runAll || tiersToRun.length === 0) {
    return [1, 2, 3, 4];
  }
  return [...new Set(tiersToRun)].sort();
}

async function run() {
  const selectedTiers = parseArgs(process.argv.slice(2));

  console.log('====================================================');
  console.log('       ROBOISLAND 2.0 OPAQUE-BOX E2E TEST RUNNER    ');
  console.log('====================================================');
  console.log(`Execution Mode: Selected Tier(s): [${selectedTiers.join(', ')}]\n`);

  let totalPassed = 0;
  let totalFailed = 0;
  const suiteResults = [];
  const startTime = Date.now();

  for (const tierNum of selectedTiers) {
    const suite = allSuites.find(s => s.tier === tierNum);
    if (!suite) continue;

    console.log(`\n----------------------------------------------------`);
    console.log(`TIER ${suite.tier}: ${suite.name.toUpperCase()}`);
    console.log(`----------------------------------------------------`);

    let tierPassed = 0;
    let tierFailed = 0;
    const tierStart = Date.now();
    const failures = [];

    for (const testCase of suite.tests) {
      try {
        if (typeof testCase.fn === 'function') {
          const res = testCase.fn();
          if (res && typeof res.then === 'function') {
            await res;
          }
        }
        console.log(`[PASS] ${testCase.id}: ${testCase.name}`);
        tierPassed++;
      } catch (err) {
        console.error(`[FAIL] ${testCase.id}: ${testCase.name}`);
        console.error(`       Error: ${err.message}`);
        tierFailed++;
        failures.push({ testCase, error: err });
      }
    }

    const tierDuration = Date.now() - tierStart;
    totalPassed += tierPassed;
    totalFailed += tierFailed;

    suiteResults.push({
      tier: suite.tier,
      name: suite.name,
      passed: tierPassed,
      failed: tierFailed,
      total: suite.tests.length,
      duration: tierDuration,
      failures
    });

    console.log(`\nTIER ${suite.tier} RESULT: ${tierPassed} PASSED, ${tierFailed} FAILED (${tierDuration}ms)`);
  }

  const totalDuration = Date.now() - startTime;

  console.log('\n====================================================');
  console.log('            OVERALL E2E TEST SUMMARY                ');
  console.log('====================================================');

  for (const res of suiteResults) {
    const status = res.failed === 0 ? 'PASSED' : 'FAILED';
    console.log(`Tier ${res.tier} (${res.name}): ${res.passed}/${res.total} ${status} (${res.duration}ms)`);
  }

  console.log('----------------------------------------------------');
  console.log(`TOTAL: ${totalPassed} PASSED, ${totalFailed} FAILED (${totalDuration}ms)`);
  console.log('====================================================\n');

  if (totalFailed > 0) {
    console.error(`Test run FAILED with ${totalFailed} failure(s).`);
    process.exit(1);
  } else {
    console.log('Test run PASSED: All executed opaque-box tests completed successfully.');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
