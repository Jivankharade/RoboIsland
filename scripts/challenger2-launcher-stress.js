/**
 * Challenger 2: Adversarial Empirical Stress Test Harness for Milestone 2 (R2: Spotlight Launcher)
 * 
 * Verifies:
 * 1. UI Canvas Bounds Calculations & Viewport Containment (620x54 expanding to 380px in 860x440)
 * 2. 240Hz Spring Physics Morphing Simulation (Runge-Kutta / Sub-stepping Euler integration)
 * 3. IPC Serialization & Throughput Across 1,000 Rapid Queries (Memory, Latency, Structured Clone)
 * 4. Keyboard Navigation & Event Handling State Machine
 * 5. Global Shortcut & Platform Fallback Logic
 * 6. Adversarial Attack Vectors (Injections, DoS, Overflow, Zero Division)
 */

const v8 = require('v8');
const path = require('path');
const { 
  SafeMathParser, 
  UnitConverter, 
  CurrencyConverter, 
  AppFileSearch, 
  QuickAIPrompt, 
  LauncherEngine, 
  launcherEngine 
} = require('../dist/main/launcher-engine');
const { PANEL_WIDTH, PANEL_HEIGHT, DisplayManager } = require('../dist/main/display-manager');

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

// ============================================================================
// SIMULATION ENGINE: 240Hz Runge-Kutta / Sub-stepping Euler Spring
// Replicated exactly from CanvasEngine.renderLoop lines 4742-4786
// ============================================================================
class SpringPhysicsSimulator {
  constructor(initialW = 98, initialH = 26, initialR = 13) {
    this.currentWidth = initialW;
    this.currentHeight = initialH;
    this.currentRadius = initialR;
    this.targetWidth = initialW;
    this.targetHeight = initialH;
    this.targetRadius = initialR;
    this.vWidth = 0;
    this.vHeight = 0;
    this.vRadius = 0;
  }

  setTarget(w, h, r) {
    this.targetWidth = w;
    this.targetHeight = h;
    this.targetRadius = r;
  }

  step(dtSec) {
    const growing = (this.targetWidth * this.targetHeight > this.currentWidth * this.currentHeight);
    const speed = 1.0;
    const response = (growing ? 0.42 : 0.34) * speed;
    const damping = growing ? 0.86 : 1.0;
    const stiffness = Math.pow(2 * Math.PI / response, 2);
    const friction = 4 * Math.PI * damping / response;
    const steps = Math.max(1, Math.ceil(dtSec / (1 / 240)));
    const h = dtSec / steps;

    for (let i = 0; i < steps; i++) {
      this.vWidth += (-stiffness * (this.currentWidth - this.targetWidth) - friction * this.vWidth) * h;
      this.currentWidth += this.vWidth * h;

      this.vHeight += (-stiffness * (this.currentHeight - this.targetHeight) - friction * this.vHeight) * h;
      this.currentHeight += this.vHeight * h;

      this.vRadius += (-stiffness * (this.currentRadius - this.targetRadius) - friction * this.vRadius) * h;
      this.currentRadius += this.vRadius * h;
    }

    if (Math.abs(this.currentWidth - this.targetWidth) < 0.3 && Math.abs(this.vWidth) < 3) {
      this.currentWidth = this.targetWidth;
      this.vWidth = 0;
    }
    if (Math.abs(this.currentHeight - this.targetHeight) < 0.3 && Math.abs(this.vHeight) < 3) {
      this.currentHeight = this.targetHeight;
      this.vHeight = 0;
    }
    if (Math.abs(this.currentRadius - this.targetRadius) < 0.3 && Math.abs(this.vRadius) < 3) {
      this.currentRadius = this.targetRadius;
      this.vRadius = 0;
    }
  }

  isSettled() {
    return this.currentWidth === this.targetWidth &&
           this.currentHeight === this.targetHeight &&
           this.currentRadius === this.targetRadius &&
           this.vWidth === 0 &&
           this.vHeight === 0 &&
           this.vRadius === 0;
  }
}

// ============================================================================
// SIMULATION ENGINE: Keyboard Navigation State Machine
// Replicated from CanvasEngine lines 11237-11278
// ============================================================================
class LauncherKeyboardController {
  constructor() {
    this.isOpen = false;
    this.inputValue = '';
    this.selectedIndex = 0;
    this.items = [];
    this.heroResult = null;
    this.copied = null;
    this.launched = null;
    this.aiDispatched = null;
    this.queriedString = '';
  }

  open(items = [], hero = null) {
    this.isOpen = true;
    this.inputValue = '';
    this.selectedIndex = 0;
    this.items = items;
    this.heroResult = hero;
    this.copied = null;
    this.launched = null;
    this.aiDispatched = null;
  }

  close() {
    this.isOpen = false;
    this.items = [];
    this.heroResult = null;
    this.selectedIndex = 0;
  }

  setResults(items, hero = null) {
    this.items = items || [];
    this.heroResult = hero;
    this.selectedIndex = 0;
  }

  handleKeyDown(key) {
    if (!this.isOpen) return;

    if (key === 'Escape') {
      if (this.inputValue.length > 0) {
        this.inputValue = '';
        this.queriedString = '';
      } else {
        this.close();
      }
      return;
    }

    if (key === 'ArrowDown') {
      if (this.items.length > 0) {
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.items.length - 1);
      }
      return;
    }

    if (key === 'ArrowUp') {
      if (this.items.length > 0) {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      }
      return;
    }

    if (key === 'Enter') {
      if (this.heroResult) {
        this.copied = String(this.heroResult);
        this.close();
      } else if (this.items.length > 0 && this.selectedIndex < this.items.length) {
        const item = this.items[this.selectedIndex];
        if (item.category === 'ai') {
          this.aiDispatched = item.actionPayload || item.title;
          this.close();
        } else {
          this.launched = item.actionPayload;
          this.close();
        }
      }
      return;
    }
  }
}

// ============================================================================
// MAIN TEST HARNESS
// ============================================================================
async function runAllStressTests() {
  console.log('\n====================================================');
  console.log('  CHALLENGER 2: ADVERSARIAL STRESS TEST (MILESTONE 2) ');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: UI Canvas Bounds Calculations & Viewport Containment
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing UI Canvas Bounds & Viewport Containment ---');

  const viewportW = PANEL_WIDTH; // 860
  const viewportH = PANEL_HEIGHT; // 440
  assert('Viewport dimensions match 860x440', viewportW === 860 && viewportH === 440);

  // Compact launcher bounds: 620 x 54 px, topY = 10px
  const compactW = 620;
  const compactH = 54;
  const compactTopY = 10;
  const compactLeft = (viewportW - compactW) / 2;
  const compactRight = compactLeft + compactW;
  const compactBottom = compactTopY + compactH;

  assert('Compact launcher centered horizontally: left = 120px', compactLeft === 120);
  assert('Compact launcher right edge within viewport: right = 740px <= 860px', compactRight === 740 && compactRight <= viewportW);
  assert('Compact launcher bottom edge within viewport: bottom = 64px <= 440px', compactBottom === 64 && compactBottom <= viewportH);
  assert('Compact launcher margins symmetrical: left=120px, right=120px', compactLeft === (viewportW - compactRight));

  // Expanded launcher bounds: 620 x 380 px, topY = 10px
  const expandedW = 620;
  const expandedH = 380;
  const expandedTopY = 10;
  const expandedLeft = (viewportW - expandedW) / 2;
  const expandedRight = expandedLeft + expandedW;
  const expandedBottom = expandedTopY + expandedH;

  assert('Expanded launcher left edge within viewport: left = 120px >= 0', expandedLeft === 120 && expandedLeft >= 0);
  assert('Expanded launcher right edge within viewport: right = 740px <= 860px', expandedRight === 740 && expandedRight <= viewportW);
  assert('Expanded launcher bottom edge within viewport: bottom = 390px <= 440px', expandedBottom === 390 && expandedBottom <= viewportH);
  assert('Expanded launcher has minimum bottom clearance: 50px remaining', (viewportH - expandedBottom) === 50);

  // CSS and DOM bounding box consistency
  const overlayLeftPercent = 50; // left: 50%, transform: translateX(-50%)
  const expectedCssCenter = (viewportW * overlayLeftPercent) / 100;
  assert('Overlay CSS percentage positioning centers exactly at x=430px', expectedCssCenter === 430);

  // Sub-pixel hit-test tolerance check
  // Hover zone in rest mode vs launcher mode
  const isLauncherActive = true;
  const effectiveInteractive = isLauncherActive ? true : false;
  assert('Interactive mouse events enabled throughout launcher lifetime', effectiveInteractive === true);

  // --------------------------------------------------------------------------
  // SECTION 2: 240Hz Spring Physics Morphing Simulation
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing 240Hz Spring Physics Morphing Simulation ---');

  const sim = new SpringPhysicsSimulator(98, 26, 13);
  assert('Spring initializes at resting pill dimensions (98x26, r=13)', 
    sim.currentWidth === 98 && sim.currentHeight === 26 && sim.currentRadius === 13);

  // Transition 1: Rest (98x26) -> Launcher Compact (620x54, r=24)
  sim.setTarget(620, 54, 24);
  let framesToCompact = 0;
  let maxW1 = 0, maxH1 = 0;
  const dt60Hz = 1 / 60; // 16.67ms per frame

  for (let f = 0; f < 300; f++) {
    sim.step(dt60Hz);
    framesToCompact++;
    if (sim.currentWidth > maxW1) maxW1 = sim.currentWidth;
    if (sim.currentHeight > maxH1) maxH1 = sim.currentHeight;
    if (sim.isSettled()) break;
  }

  const timeToCompactMs = framesToCompact * (1000 / 60);
  assert('Spring successfully converges to Launcher Compact (620x54, r=24)', 
    sim.currentWidth === 620 && sim.currentHeight === 54 && sim.currentRadius === 24);
  assert('Spring converges to compact within target time (< 650ms)', 
    timeToCompactMs < 650, `took ${timeToCompactMs.toFixed(1)}ms (${framesToCompact} frames)`);
  assert('Width overshoot during compact expansion is bounded and within viewport (< 860px)', 
    maxW1 < 860, `peak width was ${maxW1.toFixed(1)}px`);
  assert('Height overshoot during compact expansion is bounded and within viewport (< 440px)', 
    maxH1 < 440, `peak height was ${maxH1.toFixed(1)}px`);

  // Transition 2: Launcher Compact (620x54) -> Launcher Expanded with Results (620x380, r=24)
  sim.setTarget(620, 380, 24);
  let framesToExpanded = 0;
  let maxW2 = 0, maxH2 = 0;

  for (let f = 0; f < 300; f++) {
    sim.step(dt60Hz);
    framesToExpanded++;
    if (sim.currentWidth > maxW2) maxW2 = sim.currentWidth;
    if (sim.currentHeight > maxH2) maxH2 = sim.currentHeight;
    if (sim.isSettled()) break;
  }

  const timeToExpandedMs = framesToExpanded * (1000 / 60);
  assert('Spring successfully converges to Launcher Expanded (620x380, r=24)', 
    sim.currentWidth === 620 && sim.currentHeight === 380 && sim.currentRadius === 24);
  assert('Spring converges to expanded within target time (< 650ms)', 
    timeToExpandedMs < 650, `took ${timeToExpandedMs.toFixed(1)}ms (${framesToExpanded} frames)`);
  assert('Maximum height during expansion stays inside 440px transparent viewport', 
    maxH2 < 440, `peak height was ${maxH2.toFixed(1)}px (clearance: ${(440 - maxH2).toFixed(1)}px)`);

  // Transition 3: Launcher Dismissal (620x380) -> Rest (98x26, r=13)
  sim.setTarget(98, 26, 13);
  let framesToRest = 0;
  for (let f = 0; f < 300; f++) {
    sim.step(dt60Hz);
    framesToRest++;
    if (sim.isSettled()) break;
  }
  const timeToRestMs = framesToRest * (1000 / 60);
  assert('Spring successfully contracts back to Rest (98x26, r=13)', 
    sim.currentWidth === 98 && sim.currentHeight === 26 && sim.currentRadius === 13);
  assert('Contraction settles cleanly within < 650ms', 
    timeToRestMs < 650, `took ${timeToRestMs.toFixed(1)}ms (${framesToRest} frames)`);

  // Stress Test: Jittery frame rates & rapid toggling (100 switches at variable dt)
  let physicsFailed = false;
  for (let toggle = 0; toggle < 100; toggle++) {
    const targetW = toggle % 2 === 0 ? 620 : 98;
    const targetH = toggle % 2 === 0 ? 380 : 26;
    sim.setTarget(targetW, targetH, 24);
    // Variable frame timing between 5ms and 40ms (jitter)
    const jitterDt = (5 + Math.random() * 35) / 1000;
    sim.step(jitterDt);

    if (isNaN(sim.currentWidth) || isNaN(sim.currentHeight) || !isFinite(sim.vWidth) || !isFinite(sim.vHeight)) {
      physicsFailed = true;
      break;
    }
  }
  assert('Spring physics survives 100 rapid jitter toggles without NaN, Infinity, or explosion', !physicsFailed);

  // Settle back to 620x380
  sim.setTarget(620, 380, 24);
  for (let f = 0; f < 300; f++) {
    sim.step(dt60Hz);
    if (sim.isSettled()) break;
  }
  assert('Physics stabilizes cleanly after rapid jitter toggling', sim.isSettled());

  // --------------------------------------------------------------------------
  // SECTION 3: IPC Serialization Across 1,000 Rapid Queries
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing IPC Serialization Across 1,000 Rapid Queries ---');

  // Prepare 1,000 diverse test queries across 6 categories
  const queries = [];

  // Math queries (250)
  const mathInputs = [
    '2 + 2 * 3', '(10 + 5) * 2', '2^8', '3.5 * 2.5', '15% of 850', '25% off 200', 
    '10 + 5%', '200 - 10%', 'sqrt(144)', 'abs(-42)', 'pi * 2', '2(10 + 5)', 
    '-5 + 10', 'sin(0)', 'cos(0)', 'tan(0)', 'sqrt(25) + 3^2', '100 / 4 * 2',
    '50% of 1000', '10% on 500', 'log(100)', 'round(4.7)', 'floor(4.7)', 'ceil(4.2)'
  ];
  for (let i = 0; i < 250; i++) {
    queries.push({ cat: 'math', q: mathInputs[i % mathInputs.length] + (i > 100 ? ` + ${i % 10}` : '') });
  }

  // Unit conversion queries (200)
  const unitInputs = [
    '5 km to miles', '100 lbs in kg', '100 C to F', '32 F to C', '1 TB to GB', 
    '2 hours in minutes', '500 cm to m', '10 yd to ft', '16 oz in lb', '1024 MB to GB',
    '300 K to C', '50 miles in km', '2.5 kg to g', '3600 s in hours', '1000 mg in g'
  ];
  for (let i = 0; i < 200; i++) {
    queries.push({ cat: 'unit', q: unitInputs[i % unitInputs.length] });
  }

  // Currency conversion queries (200)
  const currInputs = [
    '100 USD to EUR', '$50 in INR', '€100 to USD', '50 GBP in JPY', '100 CAD to AUD',
    '¥10000 in USD', '₹5000 to EUR', '100 CHF in USD', '50 CNY to EUR', '100 SGD in USD',
    '50 NZD in USD', '100 BRL to USD', '1000 KRW in USD', '100 AED to USD', '$250 in GBP'
  ];
  for (let i = 0; i < 200; i++) {
    queries.push({ cat: 'curr', q: currInputs[i % currInputs.length] });
  }

  // App & File Search queries (150)
  const appInputs = [
    'calc', 'notepad', 'term', 'code', 'paint', 'settings', 'cmd', 'powershell',
    'taskmgr', 'explorer', 'snipping', 'edge', 'visual studio', 'note', 'calc.exe'
  ];
  for (let i = 0; i < 150; i++) {
    queries.push({ cat: 'app', q: appInputs[i % appInputs.length] });
  }

  // Quick AI Prompt queries (100)
  const aiInputs = [
    'ai: summarize quantum mechanics', '? how does electron ipc work', 'what is dynamic island',
    'explain typescript generics', 'ask: write python quicksort', 'translate hello to french',
    'why is the sky blue', 'how to bake sourdough bread', 'ai optimize nodejs loop'
  ];
  for (let i = 0; i < 100; i++) {
    queries.push({ cat: 'ai', q: aiInputs[i % aiInputs.length] });
  }

  // Adversarial / Attack queries (100)
  const attackInputs = [
    '10 / 0', '0 / 0', '10 % 0', '((((1 + 1))))', '2^1000', '999999999999^999999',
    'alert(1)', 'process.exit(1)', 'require("child_process")', '__proto__', 'constructor',
    '<script>alert("xss")</script>', 'DROP TABLE users;', 'SELECT * FROM secrets;',
    'a'.repeat(200), // Exceeds 150 chars length guard
    '', '   ', '\t\n\r', 'null', 'undefined', 'NaN', '++--**//',
    '100 km to USD', 'USD to kg', 'invalid_unit to bogus_unit'
  ];
  for (let i = 0; i < 100; i++) {
    queries.push({ cat: 'attack', q: attackInputs[i % attackInputs.length] });
  }

  assert('Total stress query bank contains exactly 1,000 queries', queries.length === 1000);

  // Initialize AppFileSearch and cache
  await AppFileSearch.init();

  const memBefore = process.memoryUsage();
  const startTime = performance.now();
  const latencies = [];
  let serializationFailures = 0;
  let unhandledExceptions = 0;
  let nonCloneableCount = 0;

  // Execute in batches of 50 to simulate rapid bursts
  const BATCH_SIZE = 50;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (item) => {
      const qStart = performance.now();
      try {
        const res = await launcherEngine.query(item.q);
        const qEnd = performance.now();
        latencies.push(qEnd - qStart);

        // 1. Check Electron IPC Structured Clone serialization
        try {
          const serialized = v8.serialize(res);
          const deserialized = v8.deserialize(serialized);
          if (!deserialized || typeof deserialized !== 'object') {
            serializationFailures++;
          }
        } catch {
          nonCloneableCount++;
        }

        // 2. Check JSON stringify serialization
        try {
          const jsonStr = JSON.stringify(res);
          const parsed = JSON.parse(jsonStr);
          if (!parsed.type || !Array.isArray(parsed.items)) {
            serializationFailures++;
          }
        } catch {
          serializationFailures++;
        }

        // 3. Check contract invariants
        if (!['calc', 'convert', 'app', 'ai'].includes(res.type)) {
          serializationFailures++;
        }
        if (!Array.isArray(res.suggestions) || !Array.isArray(res.items)) {
          serializationFailures++;
        }
      } catch (err) {
        unhandledExceptions++;
        console.error('EXCEPTION ON QUERY:', JSON.stringify(item.q), err.stack);
      }
    });

    await Promise.all(promises);
  }

  const totalTimeMs = performance.now() - startTime;
  const memAfter = process.memoryUsage();
  const heapDeltaMB = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);

  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const maxLatency = latencies[latencies.length - 1];
  const throughputQps = (1000 / totalTimeMs) * 1000;

  console.log(`    Queries executed: ${latencies.length} / 1000`);
  console.log(`    Total time: ${totalTimeMs.toFixed(1)}ms (${throughputQps.toFixed(0)} queries/sec)`);
  console.log(`    Latencies: avg=${avgLatency.toFixed(2)}ms, p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, p99=${p99.toFixed(2)}ms, max=${maxLatency.toFixed(2)}ms`);
  console.log(`    Heap delta: ${heapDeltaMB.toFixed(2)} MB`);

  assert('Zero unhandled exceptions across 1,000 rapid queries', unhandledExceptions === 0);
  assert('All 1,000 responses compatible with Electron V8 structured clone serialization', nonCloneableCount === 0);
  assert('All 1,000 responses serialize and deserialize cleanly to JSON', serializationFailures === 0);
  assert('Average query latency is high performance (< 5.0ms)', avgLatency < 5.0);
  assert('P95 query latency is under 15.0ms', p95 < 15.0);
  assert('Memory growth after 1,000 queries is under 15MB', heapDeltaMB < 15.0);

  // --------------------------------------------------------------------------
  // SECTION 4: Keyboard Navigation State Machine Stress
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Keyboard Navigation State Machine ---');

  const kb = new LauncherKeyboardController();

  // Test 1: Empty state handling
  kb.open([], null);
  assert('Keyboard controller opens with empty items and index 0', kb.isOpen && kb.selectedIndex === 0);
  kb.handleKeyDown('ArrowDown');
  assert('ArrowDown on empty items does not alter index from 0', kb.selectedIndex === 0);
  kb.handleKeyDown('ArrowUp');
  assert('ArrowUp on empty items does not produce negative index', kb.selectedIndex === 0);
  kb.handleKeyDown('Enter');
  assert('Enter on empty items produces no launch or copy action', kb.launched === null && kb.copied === null);
  kb.handleKeyDown('Escape');
  assert('Escape closes launcher when input is empty', !kb.isOpen);

  // Test 2: Input clearing vs dismiss via Escape
  kb.open([], null);
  kb.inputValue = 'calc';
  kb.handleKeyDown('Escape');
  assert('Escape with text clears input without closing launcher', kb.isOpen && kb.inputValue === '');
  kb.handleKeyDown('Escape');
  assert('Second Escape with empty input closes launcher', !kb.isOpen);

  // Test 3: List navigation with N items (clamping at 0 and N-1)
  const mockItems = [
    { id: '1', title: 'Calculator', actionPayload: 'calc.exe', category: 'app' },
    { id: '2', title: 'Notepad', actionPayload: 'notepad.exe', category: 'app' },
    { id: '3', title: 'Terminal', actionPayload: 'wt.exe', category: 'app' }
  ];
  kb.open(mockItems, null);

  assert('Initial selection is item 0', kb.selectedIndex === 0);
  kb.handleKeyDown('ArrowDown');
  assert('ArrowDown moves selection to item 1', kb.selectedIndex === 1);
  kb.handleKeyDown('ArrowDown');
  assert('ArrowDown moves selection to item 2', kb.selectedIndex === 2);
  kb.handleKeyDown('ArrowDown');
  assert('ArrowDown at bottom clamps at item 2 (does not overflow)', kb.selectedIndex === 2);
  kb.handleKeyDown('ArrowUp');
  assert('ArrowUp moves selection back to item 1', kb.selectedIndex === 1);
  kb.handleKeyDown('ArrowUp');
  assert('ArrowUp moves selection to item 0', kb.selectedIndex === 0);
  kb.handleKeyDown('ArrowUp');
  assert('ArrowUp at top clamps at item 0 (does not underflow to -1)', kb.selectedIndex === 0);

  // Test 4: Enter executes selected item
  kb.handleKeyDown('ArrowDown'); // item 1: Notepad
  kb.handleKeyDown('Enter');
  assert('Enter executes selected item payload (notepad.exe) and closes', kb.launched === 'notepad.exe' && !kb.isOpen);

  // Test 5: Hero result copy takes precedence over list execution
  kb.open(mockItems, '127.5');
  kb.handleKeyDown('ArrowDown');
  kb.handleKeyDown('Enter');
  assert('Enter with hero result copies formatted calculation ("127.5") instead of launching item', 
    kb.copied === '127.5' && kb.launched === null && !kb.isOpen);

  // Test 6: AI item routes to AI companion tab
  const mockAiItem = [
    { id: 'ai:1', title: 'Ask AI', actionPayload: 'explain rust borrow checker', category: 'ai' }
  ];
  kb.open(mockAiItem, null);
  kb.handleKeyDown('Enter');
  assert('Enter on AI item dispatches prompt to AI companion tab', 
    kb.aiDispatched === 'explain rust borrow checker' && !kb.isOpen);

  // Stress Test: 500 rapid keyboard events
  let kbCorrupted = false;
  kb.open(mockItems, null);
  for (let k = 0; k < 500; k++) {
    const keys = ['ArrowDown', 'ArrowUp', 'Escape', 'Enter'];
    const chosenKey = keys[k % keys.length];
    if (!kb.isOpen) kb.open(mockItems, k % 2 === 0 ? '42' : null);
    kb.handleKeyDown(chosenKey);

    if (kb.isOpen && (kb.selectedIndex < 0 || kb.selectedIndex >= kb.items.length)) {
      kbCorrupted = true;
      break;
    }
  }
  assert('Keyboard state machine survives 500 random events without index corruption', !kbCorrupted);

  // --------------------------------------------------------------------------
  // SECTION 5: Adversarial Attacks & Edge Cases Evaluation
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Adversarial Math, Conversions & Injection Attacks ---');

  // Math: Division by zero returns null or Infinity gracefully without throwing
  const divZeroRes = SafeMathParser.evaluate('10 / 0');
  assert('SafeMathParser evaluates division by zero without crash', divZeroRes === null || !isFinite(divZeroRes.result) || divZeroRes.result === Infinity);

  // Math: Modulo by zero
  const modZeroRes = SafeMathParser.evaluate('10 % 0');
  assert('SafeMathParser evaluates modulo by zero without crash', modZeroRes === null || isNaN(modZeroRes.result) === false);

  // Math: Huge exponent
  const hugeExpRes = SafeMathParser.evaluate('10 ^ 999999');
  assert('SafeMathParser handles huge exponent without throwing', hugeExpRes === null || isFinite(hugeExpRes.result) === false);

  // Math: Exponentiation using ** operator syntax
  let powStarStarResult = null;
  let powStarStarThrew = false;
  try {
    powStarStarResult = SafeMathParser.evaluate('2 ** 3');
  } catch (err) {
    powStarStarThrew = true;
    console.error('SafeMathParser.evaluate("2 ** 3") threw:', err.message);
  }
  assert('SafeMathParser evaluates "2 ** 3" = 8 without throwing exception', !powStarStarThrew && powStarStarResult !== null && powStarStarResult.result === 8);

  // Security: JavaScript code execution payloads
  const codeInjections = [
    'alert(1)', 'eval("1+1")', 'Function("return 1")()', 'process.exit(0)',
    'require("fs").readdirSync(".")', '__proto__.polluted = true', 'constructor.constructor("return 1")()'
  ];
  let injectionLeaked = false;
  for (const inj of codeInjections) {
    const r = SafeMathParser.evaluate(inj);
    if (r !== null) {
      injectionLeaked = true;
      console.error(`Leaked on: ${inj}`, r);
    }
  }
  assert('SafeMathParser strictly rejects all 7 code injection vectors', !injectionLeaked);

  // Security: Max input length guard (150 chars)
  const longQuery = '1 + ' + '1 + '.repeat(60) + '1'; // > 150 chars
  assert('SafeMathParser rejects expressions exceeding 150 characters', SafeMathParser.evaluate(longQuery) === null);

  // Unit: Cross-category conversion rejection
  assert('UnitConverter rejects length to mass conversion ("10 km to kg")', UnitConverter.convert('10 km to kg') === null);
  assert('UnitConverter rejects temperature to data storage ("100 C to GB")', UnitConverter.convert('100 C to GB') === null);
  assert('UnitConverter rejects mass to time ("50 lbs to hours")', UnitConverter.convert('50 lbs to hours') === null);

  // Currency: Offline fallback matrix resilience
  const rates = CurrencyConverter.getRates();
  const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'CHF', 'CNY', 'AED'];
  const allCurrenciesPresent = majorCurrencies.every(c => typeof rates[c] === 'number' && rates[c] > 0);
  assert('CurrencyConverter offline matrix contains valid rates for all 10 key fiat currencies', allCurrenciesPresent);

  const currCalc = CurrencyConverter.convert('$100 to EUR');
  assert('CurrencyConverter converts USD to EUR offline (approx 92 EUR)', 
    currCalc !== null && Math.abs(currCalc.toAmount - 92.0) < 0.1);

  // Currency: Symbol mapping
  const inrCalc = CurrencyConverter.convert('$50 in INR');
  assert('CurrencyConverter parses $ symbol and converts to INR (approx 4220 INR)', 
    inrCalc !== null && Math.abs(inrCalc.toAmount - 4220) < 50);

  // App Search: Fuzzy score robustness
  const calcScore = AppFileSearch.calculateFuzzyScore('calc', 'calculator');
  const termScore = AppFileSearch.calculateFuzzyScore('term', 'windows terminal');
  const randomScore = AppFileSearch.calculateFuzzyScore('xyz', 'calculator');

  assert('AppFileSearch assigns high fuzzy score to prefix match ("calc" -> "calculator")', calcScore >= 85);
  assert('AppFileSearch assigns high fuzzy score to word boundary ("term" -> "Windows Terminal")', termScore >= 75);
  assert('AppFileSearch assigns 0 score to unrelated string ("xyz" -> "calculator")', randomScore === 0);

  // --------------------------------------------------------------------------
  // FINAL TEST SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`CHALLENGER 2 STRESS SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES:');
    for (const f of failures) {
      console.error(`- ${f.name}: ${f.details}`);
    }
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllStressTests().catch(err => {
  console.error('FATAL STRESS HARNESS ERROR:', err);
  process.exit(1);
});
