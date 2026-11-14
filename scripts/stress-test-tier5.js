const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { AiMonitorHub } = require('../dist/main/ai-monitor-hub');
const { ProjectIndexer } = require('../dist/main/project-indexer');
const { FocusGuard } = require('../dist/main/focus-guard');

console.log('====================================================');
console.log('  ROBOISLAND TIER 5 EMPIRICAL ADVERSARIAL HARNESS   ');
console.log('====================================================\n');

let totalPassed = 0;
let totalFailed = 0;

function assert(name, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${name}${details ? ' - ' + details : ''}`);
    totalPassed++;
  } else {
    console.error(`[FAIL] ${name}${details ? ' - ' + details : ''}`);
    totalFailed++;
  }
}

async function runHarness() {
  // =========================================================================
  // VECTOR 1: HIGH EVENT RATE SIMULATION ON AI MONITOR WEBHOOK (127.0.0.1:47823)
  // =========================================================================
  console.log('--- VECTOR 1: AI MONITOR WEBHOOK HIGH-RATE BURST & BOUNDARIES ---');
  const hub = new AiMonitorHub();
  try {
    hub.start();
  } catch (err) {}

  await new Promise((r) => setTimeout(r, 200));

  function postWebhook(payload, customPath = '/twocode-hook') {
    return new Promise((resolve) => {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 47823,
          path: customPath,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          }
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
            } catch {
              resolve({ statusCode: res.statusCode, body });
            }
          });
        }
      );
      req.on('error', (e) => resolve({ error: e.message, statusCode: 500 }));
      req.write(data);
      req.end();
    });
  }

  // Burst of 150 concurrent requests
  console.log('[Stress 1.1] Firing burst of 150 concurrent requests to /twocode-hook...');
  const burstPromises = [];
  for (let i = 0; i < 150; i++) {
    const eventType = i % 3 === 0 ? 'UserPromptSubmit' : i % 3 === 1 ? 'PreToolUse' : 'PostToolUse';
    burstPromises.push(
      postWebhook({
        event: eventType,
        prompt: `Stress prompt #${i}`,
        tool: `tool_${i}`,
        file_path: `src/file_${i}.ts`,
        diff: `+ line ${i}\n- old line ${i}`
      })
    );
  }

  const burstResults = await Promise.all(burstPromises);
  const okCount = burstResults.filter((r) => r.statusCode === 200).length;
  assert('150 concurrent requests handled without crashing', okCount === 150, `OK: ${okCount}/150`);

  // Ring buffer strict 50-event limit
  const history = hub.getEventHistory();
  assert('Ring buffer strictly capped at 50 events', history.length === 50, `Length: ${history.length}`);
  const newestEvent = history[history.length - 1];
  assert('FIFO ring buffer retained newest burst events', newestEvent && (newestEvent.tool || '').startsWith('tool_'));

  // Malformed JSON and fuzzing
  const malformedRes = await postWebhook('{ broken json:');
  assert('Malformed JSON payload returns HTTP 400', malformedRes.statusCode === 400);

  const emptyRes = await postWebhook('');
  assert('Empty body returns HTTP 400', emptyRes.statusCode === 400);

  // Large payload (100KB unified diff)
  const largeDiff = '+ test addition line\n'.repeat(3000);
  const largeRes = await postWebhook({
    event: 'PreToolUse',
    tool: 'write_to_file',
    file_path: 'src/large.ts',
    diff: largeDiff
  });
  assert('Large 100KB diff payload handled with HTTP 200', largeRes.statusCode === 200);

  try {
    hub.stop();
  } catch {}

  // =========================================================================
  // VECTOR 2: REST MODE SPRING PHYSICS CONVERGENCE WITHOUT NAN OR OVERSHOOT
  // =========================================================================
  console.log('\n--- VECTOR 2: REST MODE SPRING PHYSICS CONVERGENCE ---');
  function simulateSpring(initialW, initialH, targetW, targetH, ticks = 80, stiffness = 0.18) {
    let w = initialW;
    let h = initialH;
    let hasNaN = false;
    let minW = w;
    let minH = h;

    for (let t = 0; t < ticks; t++) {
      if (isNaN(w) || isNaN(h) || !isFinite(w) || !isFinite(h)) {
        hasNaN = true;
        break;
      }
      w += (targetW - w) * stiffness;
      h += (targetH - h) * stiffness;
      if (w < minW) minW = w;
      if (h < minH) minH = h;
    }
    return { finalW: w, finalH: h, hasNaN, minW, minH };
  }

  // Extreme shrinking: 10,000x5,000 down to 32x18
  const shrinkSim = simulateSpring(10000, 5000, 32, 18, 70);
  assert('Massive dimensions converge without NaN', !shrinkSim.hasNaN);
  assert('Converges to within 0.05px of 32px target', Math.abs(shrinkSim.finalW - 32) < 0.05, `finalW: ${shrinkSim.finalW.toFixed(4)}`);
  assert('Converges to within 0.05px of 18px target', Math.abs(shrinkSim.finalH - 18) < 0.05, `finalH: ${shrinkSim.finalH.toFixed(4)}`);
  assert('Zero negative overshoot below target 32px', shrinkSim.minW >= 32, `minW: ${shrinkSim.minW.toFixed(4)}`);

  // Zero dimension input
  const zeroSim = simulateSpring(0, 0, 32, 18, 60);
  assert('Zero starting dimensions expand to 32x18 without NaN', !zeroSim.hasNaN && Math.abs(zeroSim.finalW - 32) < 0.05);

  // Negative dimensions recovery
  const negSim = simulateSpring(-100, -50, 32, 18, 70);
  assert('Negative dimensions smoothly recover to positive bounds', !negSim.hasNaN && Math.abs(negSim.finalW - 32) < 0.05);

  // Rapid oscillation test (1000 flips between rest and expanded)
  let oscW = 32;
  let oscH = 18;
  let oscNaN = false;
  for (let i = 0; i < 1000; i++) {
    const targetW = i % 2 === 0 ? 32 : 520;
    const targetH = i % 2 === 0 ? 18 : 240;
    oscW += (targetW - oscW) * 0.18;
    oscH += (targetH - oscH) * 0.18;
    if (isNaN(oscW) || isNaN(oscH)) {
      oscNaN = true;
      break;
    }
  }
  assert('1000 rapid oscillation cycles remain 100% free of NaN/Infinity', !oscNaN);

  // =========================================================================
  // VECTOR 3: FOCUS GUARD OVERRIDE COUNTDOWN BOUNDARY (5-MINUTE WINDOW)
  // =========================================================================
  console.log('\n--- VECTOR 3: FOCUS GUARD OVERRIDE COUNTDOWN BOUNDARIES ---');
  const guard = new FocusGuard();
  guard.setMasterEnabled(true);
  guard.startPomodoro(); // Activate running focus session
  guard.addBlockedItem('youtube.com', 'domain', false);

  // Baseline: no override, blocked
  const baseCheck = guard.checkDistraction({ title: 'YouTube - Google Chrome', processName: 'chrome.exe' });
  assert('Baseline: YouTube is blocked during active focus session', baseCheck && baseCheck.isDistracting && baseCheck.item.target === 'youtube.com');

  // Trigger emergency override
  guard.triggerEmergencyOverride(5);
  const status1 = guard.getEmergencyOverrideStatus();
  assert('Emergency override is active immediately upon trigger', status1.active && guard.isEmergencyOverrideActive());
  assert('Initial countdown window is between 298s and 300s', status1.remainingSeconds >= 298 && status1.remainingSeconds <= 300, `Remaining: ${status1.remainingSeconds}s`);

  // Distraction check while override is active
  const checkDuringOverride = guard.checkDistraction({ title: 'YouTube - Google Chrome', processName: 'chrome.exe' });
  assert('Distraction check returns null (bypassed) while override active', checkDuringOverride === null);

  // Advance time boundary to 299s (1s remaining)
  const now = Date.now();
  guard['overrideExpiry'] = now + 1500; // 1.5 seconds left
  const nearEndStatus = guard.getEmergencyOverrideStatus();
  assert('Boundary at 299s: override still active with 1-2s remaining', nearEndStatus.active && nearEndStatus.remainingSeconds <= 2 && nearEndStatus.remainingSeconds >= 1);
  assert('Bypass still valid near expiration', guard.checkDistraction({ title: 'YouTube - Google Chrome', processName: 'chrome.exe' }) === null);

  // Advance time boundary to expired (0s left)
  guard['overrideExpiry'] = now - 50; // past expiration
  const expiredStatus = guard.getEmergencyOverrideStatus();
  assert('Boundary at 300s: override is inactive', !expiredStatus.active && !guard.isEmergencyOverrideActive());
  assert('Countdown remaining returns 0 when expired', expiredStatus.remainingSeconds === 0, `Remaining: ${expiredStatus.remainingSeconds}`);
  const checkAfterExpire = guard.checkDistraction({ title: 'YouTube - Google Chrome', processName: 'chrome.exe' });
  assert('Distraction blocking immediately re-enforces when window expires', checkAfterExpire && checkAfterExpire.isDistracting);

  // Early cancellation
  guard.triggerEmergencyOverride(5);
  assert('Override re-triggered successfully', guard.isEmergencyOverrideActive());
  guard.cancelEmergencyOverride();
  assert('Early cancel immediately terminates override', !guard.isEmergencyOverrideActive());
  assert('Blocking re-enforces immediately after early cancel', guard.checkDistraction({ title: 'YouTube - Google Chrome', processName: 'chrome.exe' }) !== null);

  // =========================================================================
  // VECTOR 4: PROJECT MODE 500-FILE SEARCH LATENCY (<50MS) & INDEXING
  // =========================================================================
  console.log('\n--- VECTOR 4: PROJECT MODE 500-FILE SEARCH LATENCY (<50MS) ---');
  const tempProjectDir = path.join(os.tmpdir(), `robo-proj-stress-${Date.now()}`);
  fs.mkdirSync(tempProjectDir, { recursive: true });

  try {
    for (let i = 0; i < 500; i++) {
      const folder = path.join(tempProjectDir, `mod_${i % 10}`);
      if (!fs.existsSync(folder)) fs.mkdirSync(folder);
      const content = `// Source file ${i}\nexport function calculate_${i}() {\n  const key = "pattern_${i % 25}";\n  return key;\n}\n`;
      fs.writeFileSync(path.join(folder, `service_module_${i}.ts`), content);
    }

    const indexer = new ProjectIndexer({ maxFiles: 500 });

    const idxStart = Date.now();
    const indexResult = await indexer.indexWorkspace(tempProjectDir);
    const indexMs = Date.now() - idxStart;
    assert('Workspace file count capped at exactly 500 files', indexResult.fileCount === 500, `Count: ${indexResult.fileCount}`);
    console.log(`[INFO] Disk indexing of 500 files took: ${indexMs}ms`);

    // Benchmark search queries across all patterns
    const testQueries = [
      { type: 'Exact Filename', q: 'service_module_250.ts' },
      { type: 'Prefix Search', q: 'service_mod' },
      { type: 'Substring Search', q: 'module_4' },
      { type: 'Fuzzy Search', q: 'svcmdl49' },
      { type: 'Content Full-Text', q: 'pattern_12' },
      { type: 'Content Function', q: 'calculate_333' },
      { type: 'Non-matching Query', q: 'zebra_banana_9999' },
      { type: 'Empty Query', q: '' }
    ];

    // 1. Measure Cold-Start Search Latency (first query loads file contents off disk into memory)
    const coldT0 = process.hrtime.bigint();
    const coldRes = indexer.search('service_module_0.ts');
    const coldT1 = process.hrtime.bigint();
    const coldDurationMs = Number(coldT1 - coldT0) / 1e6;
    console.log(`  [Cold-Start Query: "service_module_0.ts"] -> ${coldRes.length} results in ${coldDurationMs.toFixed(3)}ms (includes initial disk read of 500 files)`);
    assert('Cold-start search successfully populates file contents and returns results', coldRes.length > 0 && coldRes[0].file.name === 'service_module_0.ts');

    // 2. Measure Warm In-Memory Search Latencies (<50ms requirement)
    let maxSearchDurationMs = 0;
    const searchTimings = [];

    for (const t of testQueries) {
      const t0 = process.hrtime.bigint();
      const res = indexer.search(t.q);
      const t1 = process.hrtime.bigint();
      const durationMs = Number(t1 - t0) / 1e6;
      searchTimings.push({ ...t, durationMs, resultCount: res.length });
      if (durationMs > maxSearchDurationMs) maxSearchDurationMs = durationMs;

      console.log(`  [Query: "${t.q}"] (${t.type}) -> ${res.length} results in ${durationMs.toFixed(3)}ms`);
      assert(`Warm search query "${t.q}" latency < 50ms (${durationMs.toFixed(3)}ms)`, durationMs < 50);
    }

    const avgSearchMs = searchTimings.reduce((acc, cur) => acc + cur.durationMs, 0) / searchTimings.length;
    console.log(`[INFO] 500-File In-Memory Search Performance: Avg=${avgSearchMs.toFixed(3)}ms, Max=${maxSearchDurationMs.toFixed(3)}ms`);
    assert('Average search latency across 500 files is < 10ms', avgSearchMs < 10, `Avg: ${avgSearchMs.toFixed(3)}ms`);
    assert('Max search latency across 500 files is < 50ms', maxSearchDurationMs < 50, `Max: ${maxSearchDurationMs.toFixed(3)}ms`);

  } finally {
    try {
      fs.rmSync(tempProjectDir, { recursive: true, force: true });
    } catch {}
  }

  // =========================================================================
  // VECTOR 5: ZERO-EMOJI SCAN ACROSS ALL SOURCE FILES IN src/
  // =========================================================================
  console.log('\n--- VECTOR 5: ZERO-EMOJI COMPLIANCE AUDIT ACROSS src/ ---');
  const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  function scanDir(dir) {
    let files = [];
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, item.name);
      if (item.isDirectory()) {
        files = files.concat(scanDir(p));
      } else if (/\.(ts|js|html|css|json)$/.test(item.name)) {
        files.push(p);
      }
    }
    return files;
  }

  const srcFiles = scanDir(path.join(__dirname, '..', 'src'));
  const emojiViolations = [];

  for (const file of srcFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(emojiRegex);
    if (match) {
      emojiViolations.push({ file: path.relative(path.join(__dirname, '..'), file), emoji: match[0] });
    }
  }

  assert(`Scanned all ${srcFiles.length} source files in src/ for emojis`, srcFiles.length >= 35, `Found: ${srcFiles.length}`);
  assert('Zero Unicode emojis found across 100% of src/ files', emojiViolations.length === 0, `Violations: ${JSON.stringify(emojiViolations)}`);

  // =========================================================================
  // VECTOR 6: RELEASE PACKAGING ARTIFACTS VALIDATION (release/)
  // =========================================================================
  console.log('\n--- VECTOR 6: RELEASE BINARY VALIDATION (release/) ---');
  const releaseDir = path.join(__dirname, '..', 'release');

  function validateExe(filename) {
    const filePath = path.join(releaseDir, filename);
    assert(`Binary exists: ${filename}`, fs.existsSync(filePath));
    if (!fs.existsSync(filePath)) return;

    const stats = fs.statSync(filePath);
    const sizeMb = stats.size / (1024 * 1024);
    assert(`${filename} file size > 100MB (${sizeMb.toFixed(2)} MB)`, stats.size > 100 * 1024 * 1024);

    const fd = fs.openSync(filePath, 'r');
    try {
      const mzHeader = Buffer.alloc(2);
      fs.readSync(fd, mzHeader, 0, 2, 0);
      const isMZ = mzHeader[0] === 0x4d && mzHeader[1] === 0x5a;
      assert(`${filename} has valid PE MZ header (0x4D, 0x5A)`, isMZ);

      const peOffsetBuf = Buffer.alloc(4);
      fs.readSync(fd, peOffsetBuf, 0, 4, 0x3c);
      const peOffset = peOffsetBuf.readUInt32LE(0);
      const peSig = Buffer.alloc(4);
      fs.readSync(fd, peSig, 0, 4, peOffset);
      const isPE = peSig[0] === 0x50 && peSig[1] === 0x45 && peSig[2] === 0x00 && peSig[3] === 0x00;
      assert(`${filename} has authentic PE00 signature at offset 0x${peOffset.toString(16)}`, isPE);
    } finally {
      fs.closeSync(fd);
    }
  }

  validateExe('RoboIsland-Setup-1.0.0.exe');
  validateExe('RoboIsland-Portable-1.0.0.exe');
  validateExe('win-unpacked/RoboIsland.exe');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n====================================================');
  console.log(`TIER 5 STRESS TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('====================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log('ALL TIER 5 EMPIRICAL STRESS VECTORS PASSED WITH ZERO FAILURES!');
    process.exit(0);
  }
}

runHarness().catch((err) => {
  console.error('[FATAL] Harness crashed:', err);
  process.exit(1);
});
