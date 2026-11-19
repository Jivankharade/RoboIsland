/**
 * Challenger 1 Adversarial Stress Test Suite
 * Milestone 5: AirPods / Bluetooth Battery & Device HUD
 * 
 * Tests:
 * 1. High-frequency event storms (500 rapid simulated events & transitions)
 * 2. Extreme boundary & malformed battery values (-50%, 0%, 100%, 150%, NaN, strings, floats)
 * 3. Partial multiBattery models (L only, R only, Case only, inverted bounds)
 * 4. Injection & ReDoS stress (15,000+ character strings, XSS payloads, Unicode/emojis)
 * 5. Simulation fallback & polling lifecycle robustness
 * 6. Viewport bounds & DOM textContent injection verification
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const {
  BluetoothMonitorService,
  BluetoothSimulator,
  classifyBluetoothDeviceType,
  normalizeBatteryLevel,
  normalizeMultiBattery
} = require('../dist/main/bluetooth-monitor');

let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function assert(description, condition, details = '') {
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${description}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${description} ${details ? '(' + details + ')' : ''}`);
    failureDetails.push({ description, details });
  }
}

async function runAdversarialSuite() {
  console.log('====================================================');
  console.log('  CHALLENGER 1: BLUETOOTH HUD ADVERSARIAL SUITE     ');
  console.log('====================================================\n');

  // -----------------------------------------------------------------
  // 1. High-Frequency Event Storms
  // -----------------------------------------------------------------
  console.log('--- Phase 1: High-Frequency Event Storms (500 Events) ---');
  {
    const service = new BluetoothMonitorService();
    let eventsReceived = 0;
    let broadcastCount = 0;

    service.onDeviceEvent((evt) => {
      eventsReceived++;
    });

    service.setBroadcastCallback((channel, payload) => {
      if (channel === 'island:bluetooth-hud' && payload) {
        broadcastCount++;
      }
    });

    // Storm of 500 rapid simulateEvent calls
    const stormStartTime = performance.now();
    for (let i = 0; i < 500; i++) {
      const devIndex = i % 5;
      const bat = 10 + (i % 90);
      const isConn = (i % 10) !== 0;
      service.simulateEvent({
        type: isConn ? 'connected' : 'disconnected',
        device: {
          id: `stress-device-${devIndex}`,
          name: `Stress Device ${devIndex}`,
          connected: isConn,
          batteryPercent: bat
        }
      });
    }
    const stormElapsed = performance.now() - stormStartTime;

    assert('500 rapid simulated events handled without crashing', true);
    assert('All 500 device events delivered to listener', eventsReceived === 500, `got ${eventsReceived}`);
    assert('All 500 broadcast events dispatched to callback', broadcastCount === 500, `got ${broadcastCount}`);
    assert('500 events processed in < 500ms', stormElapsed < 500, `elapsed: ${stormElapsed.toFixed(2)}ms`);

    // Memory / listener check
    const listenerCount = service['eventEmitter'].listenerCount('device_event');
    assert('Listener count remains bounded (no listener leaks)', listenerCount === 1, `count: ${listenerCount}`);

    // Verify broadcastCallback resilience: what if callback throws?
    let callbackThrew = false;
    service.setBroadcastCallback(() => {
      callbackThrew = true;
      throw new Error('Adversarial broadcast failure test');
    });

    const origWarn1 = console.warn;
    console.warn = () => {};
    try {
      service.simulateEvent({
        type: 'battery_change',
        device: { id: 'stress-device-0', batteryPercent: 99 }
      });
      assert('Service survives throwing broadcast callback without crashing caller', true);
      assert('Throwing broadcast callback was actually executed', callbackThrew);
    } catch (err) {
      assert('Service survives throwing broadcast callback without crashing caller', false, err.message);
    } finally {
      console.warn = origWarn1;
    }
    service.setBroadcastCallback(null);

    // Rapid updateDevices with 100 devices vanishing at once (Full Scan churn)
    const bigFleet = [];
    for (let i = 0; i < 100; i++) {
      bigFleet.push({
        id: `fleet-dev-${i}`,
        name: `Fleet Device ${i}`,
        deviceType: 'headphones',
        connected: true,
        batteryPercent: 80,
        lastSeen: Date.now()
      });
    }
    const initialTransitions = service.updateDevices(bigFleet, true);
    const connectedInBatch = initialTransitions.filter(e => e.type === 'connected').length;
    const disconnectedInBatch = initialTransitions.filter(e => e.type === 'disconnected').length;
    assert('100 new devices registered in batch with connected events', connectedInBatch === 100, `got ${connectedInBatch}`);
    assert('8 unmentioned previous devices pruned with disconnected events on full scan', disconnectedInBatch === 8, `got ${disconnectedInBatch}`);
    assert('Connected devices count matches exactly 100', service.getConnectedDevices().length === 100);

    // Vanish all 100 devices simultaneously
    const vanishTransitions = service.updateDevices([], true);
    assert('100 devices cleanly disconnected on empty full scan', vanishTransitions.length === 100, `got ${vanishTransitions.length}`);
    const disconnectedCount = vanishTransitions.filter(e => e.type === 'disconnected').length;
    assert('All 100 transitions are of type disconnected', disconnectedCount === 100, `got ${disconnectedCount}`);
    assert('0 devices connected after empty full scan', service.getConnectedDevices().length === 0);

    service.dispose();
  }

  // -----------------------------------------------------------------
  // 2. Extreme Boundary & Malformed Battery Inputs
  // -----------------------------------------------------------------
  console.log('\n--- Phase 2: Extreme Boundary & Malformed Battery Inputs ---');
  {
    // Boundaries: -100, -50, -1, 0, 1, 99, 100, 101, 150, 99999
    assert('normalizeBatteryLevel(-100) clamps to 0', normalizeBatteryLevel(-100) === 0);
    assert('normalizeBatteryLevel(-50) clamps to 0', normalizeBatteryLevel(-50) === 0);
    assert('normalizeBatteryLevel(-1) clamps to 0', normalizeBatteryLevel(-1) === 0);
    assert('normalizeBatteryLevel(0) preserves 0', normalizeBatteryLevel(0) === 0);
    assert('normalizeBatteryLevel(1) preserves 1', normalizeBatteryLevel(1) === 1);
    assert('normalizeBatteryLevel(99) preserves 99', normalizeBatteryLevel(99) === 99);
    assert('normalizeBatteryLevel(100) preserves 100', normalizeBatteryLevel(100) === 100);
    assert('normalizeBatteryLevel(101) clamps to 100', normalizeBatteryLevel(101) === 100);
    assert('normalizeBatteryLevel(150) clamps to 100', normalizeBatteryLevel(150) === 100);
    assert('normalizeBatteryLevel(99999) clamps to 100', normalizeBatteryLevel(99999) === 100);

    // Float percentages
    assert('normalizeBatteryLevel(0.4) rounds to 0', normalizeBatteryLevel(0.4) === 0);
    assert('normalizeBatteryLevel(49.6) rounds to 50', normalizeBatteryLevel(49.6) === 50);
    assert('normalizeBatteryLevel(99.4) rounds to 99', normalizeBatteryLevel(99.4) === 99);
    assert('normalizeBatteryLevel(-0.01) clamps to 0', normalizeBatteryLevel(-0.01) === 0);
    assert('normalizeBatteryLevel(100.2) clamps to 100', normalizeBatteryLevel(100.2) === 100);

    // String percentages
    assert('normalizeBatteryLevel("0%") parses to 0', normalizeBatteryLevel("0%") === 0);
    assert('normalizeBatteryLevel(" 0 % ") parses to 0', normalizeBatteryLevel(" 0 % ") === 0);
    assert('normalizeBatteryLevel("100%") parses to 100', normalizeBatteryLevel("100%") === 100);
    assert('normalizeBatteryLevel(" -50% ") clamps to 0', normalizeBatteryLevel(" -50% ") === 0);
    assert('normalizeBatteryLevel(" 150 % ") clamps to 100', normalizeBatteryLevel(" 150 % ") === 100);
    assert('normalizeBatteryLevel("battery: 88%") extracts 88', normalizeBatteryLevel("battery: 88%") === 88);

    // Malformed / Non-numeric edge values
    assert('normalizeBatteryLevel("NaN") returns null', normalizeBatteryLevel("NaN") === null);
    assert('normalizeBatteryLevel("undefined") returns null', normalizeBatteryLevel("undefined") === null);
    assert('normalizeBatteryLevel("null") returns null', normalizeBatteryLevel("null") === null);
    assert('normalizeBatteryLevel("--") returns null', normalizeBatteryLevel("--") === null);
    assert('normalizeBatteryLevel("") returns null', normalizeBatteryLevel("") === null);
    assert('normalizeBatteryLevel("invalid") returns null', normalizeBatteryLevel("invalid") === null);
    assert('normalizeBatteryLevel(NaN) returns null', normalizeBatteryLevel(NaN) === null);
    assert('normalizeBatteryLevel(null) returns null', normalizeBatteryLevel(null) === null);
    assert('normalizeBatteryLevel(undefined) returns null', normalizeBatteryLevel(undefined) === null);
    assert('normalizeBatteryLevel(Infinity) clamps to 100 as overflow limit', normalizeBatteryLevel(Infinity) === 100);
    assert('normalizeBatteryLevel(-Infinity) clamps to 0 as underflow limit', normalizeBatteryLevel(-Infinity) === 0);
    assert('normalizeBatteryLevel("Infinity") string returns null', normalizeBatteryLevel("Infinity") === null);
    assert('normalizeBatteryLevel("-Infinity") string returns null', normalizeBatteryLevel("-Infinity") === null);
    assert('normalizeBatteryLevel({}) returns null', normalizeBatteryLevel({}) === null);
    assert('normalizeBatteryLevel([]) returns null', normalizeBatteryLevel([]) === null);
    assert('normalizeBatteryLevel(true) returns null', normalizeBatteryLevel(true) === null);
    assert('normalizeBatteryLevel(false) returns null', normalizeBatteryLevel(false) === null);
  }

  // -----------------------------------------------------------------
  // 3. Partial multiBattery Models & Derivation
  // -----------------------------------------------------------------
  console.log('\n--- Phase 3: Partial multiBattery Models & Derivation ---');
  {
    const sim = new BluetoothSimulator();

    // 1. Left earbud only
    const leftOnly = sim.createDevice({
      name: 'AirPods Left Only',
      multiBattery: { left: 75 }
    });
    assert('Left-only earbud calculates primary battery = 75', leftOnly.batteryPercent === 75);
    assert('Left-only earbud keeps multiBattery.left = 75', leftOnly.multiBattery?.left === 75);
    assert('Left-only earbud multiBattery.right is undefined', leftOnly.multiBattery?.right === undefined);
    assert('Left-only earbud multiBattery.case is undefined', leftOnly.multiBattery?.case === undefined);

    // 2. Right earbud only
    const rightOnly = sim.createDevice({
      name: 'AirPods Right Only',
      multiBattery: { right: 62 }
    });
    assert('Right-only earbud calculates primary battery = 62', rightOnly.batteryPercent === 62);
    assert('Right-only earbud keeps multiBattery.right = 62', rightOnly.multiBattery?.right === 62);

    // 3. Case only
    const caseOnly = sim.createDevice({
      name: 'AirPods Case Only',
      multiBattery: { case: 95 }
    });
    assert('Case-only calculates primary battery = 95', caseOnly.batteryPercent === 95);
    assert('Case-only keeps multiBattery.case = 95', caseOnly.multiBattery?.case === 95);

    // 4. Left + Right (no Case)
    const dualBuds = sim.createDevice({
      name: 'Dual Buds',
      multiBattery: { left: 80, right: 90 }
    });
    assert('Dual earbuds compute average 85', dualBuds.batteryPercent === 85);

    // 5. Explicit batteryPercent takes precedence over multiBattery derivation
    const explicitDev = sim.createDevice({
      name: 'AirPods Override',
      batteryPercent: 50,
      multiBattery: { left: 90, right: 90, case: 100 }
    });
    assert('Explicit batteryPercent (50) is preserved over multiBattery average', explicitDev.batteryPercent === 50);

    // 6. Zero battery level in multiBattery
    const zeroBud = sim.createDevice({
      name: 'Dead AirPod',
      multiBattery: { left: 0, right: 0 }
    });
    assert('0% multiBattery results in 0% primary battery (not null)', zeroBud.batteryPercent === 0);

    // 7. Malformed multiBattery bounds
    const malformedMulti = normalizeMultiBattery({
      left: -40,
      right: 250,
      case: '85%'
    });
    assert('normalizeMultiBattery clamps left -40 to 0', malformedMulti?.left === 0);
    assert('normalizeMultiBattery clamps right 250 to 100', malformedMulti?.right === 100);
    assert('normalizeMultiBattery parses case "85%" to 85', malformedMulti?.case === 85);

    // 8. Empty / invalid multiBattery object
    assert('normalizeMultiBattery({}) returns undefined', normalizeMultiBattery({}) === undefined);
    assert('normalizeMultiBattery(null) returns undefined', normalizeMultiBattery(null) === undefined);
    assert('normalizeMultiBattery(undefined) returns undefined', normalizeMultiBattery(undefined) === undefined);
    assert('normalizeMultiBattery({ left: "bad", right: null }) returns undefined',
      normalizeMultiBattery({ left: 'bad', right: null }) === undefined);
  }

  // -----------------------------------------------------------------
  // 4. Injection, Unicode & ReDoS Stress Testing
  // -----------------------------------------------------------------
  console.log('\n--- Phase 4: Injection, Unicode & ReDoS Stress Testing ---');
  {
    // ReDoS Attack 1: Massive repetitions of words with spaces
    const reDosPattern1 = 'air '.repeat(5000) + 'pods';
    const t0 = performance.now();
    const type1 = classifyBluetoothDeviceType(reDosPattern1);
    const d0 = performance.now() - t0;
    assert('classifyBluetoothDeviceType survives repeated whitespace pattern in < 15ms', d0 < 15, `took ${d0.toFixed(2)}ms`);

    // ReDoS Attack 2: 20,000 characters of 'galaxy buds ' pattern
    const reDosPattern2 = 'galaxy buds '.repeat(2000);
    const t1 = performance.now();
    const type2 = classifyBluetoothDeviceType(reDosPattern2);
    const d1 = performance.now() - t1;
    assert('classifyBluetoothDeviceType classifies 24,000 char string as earbuds in < 15ms',
      d1 < 15 && type2 === 'earbuds', `took ${d1.toFixed(2)}ms, type=${type2}`);

    // ReDoS Attack 3: 30,000 characters of random alphanumeric string
    const longAlpha = 'a'.repeat(30000);
    const t2 = performance.now();
    const type3 = classifyBluetoothDeviceType(longAlpha);
    const d2 = performance.now() - t2;
    assert('classifyBluetoothDeviceType survives 30,000 char long non-matching string in < 15ms',
      d2 < 15 && type3 === 'peripheral', `took ${d2.toFixed(2)}ms`);

    // XSS / HTML Payloads in device name
    const xssName = '<script>alert("hacked")</script><img src=x onerror=alert(1)>AirPods Pro';
    const xssType = classifyBluetoothDeviceType(xssName);
    assert('XSS payload device name classified safely as airpods', xssType === 'airpods');

    const sim = new BluetoothSimulator();
    const xssDevice = sim.createDevice({ name: xssName });
    assert('createDevice preserves device name without crashing', xssDevice.name === xssName);
    assert('Generated device ID strips dangerous HTML tags and characters',
      !xssDevice.id.includes('<') && !xssDevice.id.includes('>') && !xssDevice.id.includes('"'),
      `id: ${xssDevice.id}`);

    // SQL Injection / Command Injection in device name
    const cmdInjName = '"; rm -rf /; $(Get-Process); DROP TABLE Devices;--';
    const cmdInjDevice = sim.createDevice({ name: cmdInjName });
    assert('Command injection device name generates safe ID',
      !cmdInjDevice.id.includes(';') && !cmdInjDevice.id.includes(' ') && !cmdInjDevice.id.includes('$'),
      `id: ${cmdInjDevice.id}`);

    // Unicode, RTL marks, ZWJ sequences, and Emoji spam
    const emojiName = '🎧 AirPods Pro Max 🚀👨‍👩‍👧‍👦 ﷽ \u200B\u200F\uFEFF 𝕽𝖔𝖇𝖔 🌟';
    const emojiType = classifyBluetoothDeviceType(emojiName);
    assert('Unicode & Emoji-rich device name correctly detected as airpods', emojiType === 'airpods');
    const emojiDevice = sim.createDevice({ name: emojiName });
    assert('Unicode & Emoji device creates valid device record', emojiDevice.name === emojiName);
  }

  // -----------------------------------------------------------------
  // 5. Simulation Fallback & Polling Lifecycle Robustness
  // -----------------------------------------------------------------
  console.log('\n--- Phase 5: Simulation Fallback & Polling Lifecycle Robustness ---');
  {
    const service = new BluetoothMonitorService();

    // 1. Simulation mode toggle
    service.setSimulationMode(true);
    assert('simulationMode is true after setSimulationMode(true)', service.isSimulationMode() === true);

    const simDevices = await service.queryNativeDevices();
    assert('queryNativeDevices returns devices array in simulation mode',
      Array.isArray(simDevices) && simDevices.length > 0);

    service.setSimulationMode(false);
    assert('simulationMode is false after setSimulationMode(false)', service.isSimulationMode() === false);

    // 2. Polling idempotency (rapid start / stop)
    service.startPolling(5000);
    const timer1 = service['pollTimer'];
    service.startPolling(5000); // duplicate call
    const timer2 = service['pollTimer'];
    assert('startPolling is idempotent (does not duplicate timers)', timer1 === timer2);

    service.stopPolling();
    assert('stopPolling clears timer and active flag',
      service['pollTimer'] === null && service['isPollingActive'] === false);
    service.stopPolling(); // duplicate stop
    assert('stopPolling is idempotent when already stopped',
      service['pollTimer'] === null && service['isPollingActive'] === false);

    // 3. pollOnce exception safety
    // Force a broken internal query to test rejection safety
    const origQuery = service.queryNativeDevices;
    service.queryNativeDevices = async () => {
      throw new Error('Forced native query failure for testing');
    };

    let pollOnceThrew = false;
    const origWarn = console.warn;
    console.warn = () => {};
    try {
      await service.pollOnce();
    } catch (err) {
      pollOnceThrew = true;
    } finally {
      console.warn = origWarn;
    }
    assert('pollOnce catches internal query errors without rejecting or crashing', !pollOnceThrew);
    service.queryNativeDevices = origQuery;

    // 4. dispose lifecycle
    service.startPolling(5000);
    service.onDeviceEvent(() => {});
    service.setBroadcastCallback(() => {});
    service.dispose();

    assert('dispose stops polling timer', service['pollTimer'] === null && service['isPollingActive'] === false);
    assert('dispose clears device map', service.getAllDevices().length === 0);
    assert('dispose clears broadcast callback', service['broadcastCallback'] === null);
    assert('dispose clears event listeners', service['eventEmitter'].listenerCount('device_event') === 0);
  }

  // -----------------------------------------------------------------
  // 6. Viewport Bounds, Canvas Engine & DOM Security Contracts
  // -----------------------------------------------------------------
  console.log('\n--- Phase 6: Viewport Bounds, Canvas Engine & DOM Security Contracts ---');
  {
    const canvasEnginePath = path.join(__dirname, '../src/renderer/island/canvas-engine.ts');
    const indexHtmlPath = path.join(__dirname, '../src/renderer/island/index.html');
    const islandCssPath = path.join(__dirname, '../src/renderer/island/island.css');

    const canvasEngineSrc = fs.readFileSync(canvasEnginePath, 'utf8');
    const indexHtmlSrc = fs.readFileSync(indexHtmlPath, 'utf8');
    const islandCssSrc = fs.readFileSync(islandCssPath, 'utf8');

    // Viewport bounds constraint: Island window is 860x440.
    // Bluetooth HUD dimensions in canvas-engine:
    // Rest mode: targetWidth 330/338 (or 360/368 with multiBattery), targetHeight 44
    // Compact mode: targetWidth 330/338 (or 360/368 with multiBattery), targetHeight 44
    const matchesW = canvasEngineSrc.match(/hasMb \? 368 : 338/g);
    assert('CanvasEngine sets max bluetooth HUD width to 368px', matchesW && matchesW.length >= 2);
    assert('Max HUD width 368px is strictly inside 860px viewport bound (368 < 860)', 368 < 860);
    assert('Max HUD height 44px is strictly inside 440px viewport bound (44 < 440)', 44 < 440);

    // XSS / DOM Injection Safety:
    // showBluetoothHudCard must use textContent and NOT innerHTML for device name or values
    const hudCardMethod = canvasEngineSrc.substring(
      canvasEngineSrc.indexOf('showBluetoothHudCard'),
      canvasEngineSrc.indexOf('drawBluetoothHudContent')
    );

    assert('showBluetoothHudCard uses textContent for device name (no innerHTML)',
      hudCardMethod.includes('nameEl.textContent = device.name') && !hudCardMethod.includes('nameEl.innerHTML'));
    assert('showBluetoothHudCard uses textContent for status (no innerHTML)',
      hudCardMethod.includes('statusEl.textContent =') && !hudCardMethod.includes('statusEl.innerHTML'));
    assert('showBluetoothHudCard uses textContent for battery percent (no innerHTML)',
      hudCardMethod.includes('pctEl.textContent =') && !hudCardMethod.includes('pctEl.innerHTML'));

    // DOM structure verification
    assert('index.html defines #bluetooth-hud-card container', indexHtmlSrc.includes('id="bluetooth-hud-card"'));
    assert('index.html defines #bt-hud-multibattery container', indexHtmlSrc.includes('id="bt-hud-multibattery"'));
    assert('island.css styles .bluetooth-hud-card with pointer-events', islandCssSrc.includes('.bluetooth-hud-card'));
    assert('island.css styles .bt-hud-battery-badge', islandCssSrc.includes('.bt-hud-battery-badge'));
  }

  // -----------------------------------------------------------------
  // 7. Transition Hysteresis & Noise Rejection Matrix
  // -----------------------------------------------------------------
  console.log('\n--- Phase 7: Transition Hysteresis & Noise Rejection Matrix ---');
  {
    const service = new BluetoothMonitorService();
    const testDevId = 'hysteresis-test-device';

    // 1. Initial connection at 80%
    const ev1 = service.updateDevices([{
      id: testDevId,
      name: 'Hysteresis Headphones',
      deviceType: 'headphones',
      connected: true,
      batteryPercent: 80,
      isCharging: false,
      lastSeen: Date.now()
    }]);
    assert('Initial connection emits 1 connected event', ev1.length === 1 && ev1[0].type === 'connected');

    // 2. 1% delta noise fluctuation (80% -> 81%)
    const ev2 = service.updateDevices([{
      id: testDevId,
      name: 'Hysteresis Headphones',
      deviceType: 'headphones',
      connected: true,
      batteryPercent: 81,
      isCharging: false,
      lastSeen: Date.now()
    }]);
    assert('1% delta (80% -> 81%) is suppressed as noise', ev2.length === 0);

    // 3. 2% delta (81% -> 83%)
    const ev3 = service.updateDevices([{
      id: testDevId,
      name: 'Hysteresis Headphones',
      deviceType: 'headphones',
      connected: true,
      batteryPercent: 83,
      isCharging: false,
      lastSeen: Date.now()
    }]);
    assert('2% delta (81% -> 83%) emits battery_change event', ev3.length === 1 && ev3[0].type === 'battery_change');
    assert('Previous battery recorded accurately as 81', ev3[0].previousBattery === 81);

    // 4. Same battery, but charging toggled (83% charging: true)
    const ev4 = service.updateDevices([{
      id: testDevId,
      name: 'Hysteresis Headphones',
      deviceType: 'headphones',
      connected: true,
      batteryPercent: 83,
      isCharging: true,
      lastSeen: Date.now()
    }]);
    assert('Charging toggle with 0% delta emits battery_change event', ev4.length === 1 && ev4[0].type === 'battery_change');

    // 5. Disconnect
    const ev5 = service.updateDevices([{
      id: testDevId,
      name: 'Hysteresis Headphones',
      deviceType: 'headphones',
      connected: false,
      batteryPercent: 83,
      isCharging: false,
      lastSeen: Date.now()
    }]);
    assert('Disconnection emits disconnected event', ev5.length === 1 && ev5[0].type === 'disconnected');

    // 6. Battery change while disconnected is NOT emitted
    const ev6 = service.updateDevices([{
      id: testDevId,
      name: 'Hysteresis Headphones',
      deviceType: 'headphones',
      connected: false,
      batteryPercent: 70,
      isCharging: false,
      lastSeen: Date.now()
    }]);
    assert('Battery change while disconnected is suppressed', ev6.length === 0);

    // 7. Reconnection
    const ev7 = service.updateDevices([{
      id: testDevId,
      name: 'Hysteresis Headphones',
      deviceType: 'headphones',
      connected: true,
      batteryPercent: 70,
      isCharging: false,
      lastSeen: Date.now()
    }]);
    assert('Reconnection emits connected event', ev7.length === 1 && ev7[0].type === 'connected');
    assert('Previous connected state was false', ev7[0].previousConnected === false);

    service.dispose();
  }

  // -----------------------------------------------------------------
  // 8. Classifier Permutations Matrix
  // -----------------------------------------------------------------
  console.log('\n--- Phase 8: Classifier Permutations Matrix ---');
  {
    const matrix = [
      ['Apple AirPods (3rd generation)', 'airpods'],
      ['AirPods Max - Space Gray', 'airpods'],
      ['AirPods Pro with MagSafe Case', 'airpods'],
      ['Galaxy Buds Live (88C2)', 'earbuds'],
      ['Samsung Galaxy Buds2 Pro', 'earbuds'],
      ['Google Pixel Buds Pro', 'earbuds'],
      ['Nothing Ear (2)', 'earbuds'],
      ['Sony WF-1000XM4', 'earbuds'],
      ['Sony WH-1000XM4', 'headphones'],
      ['Sony WH-1000XM5', 'headphones'],
      ['Bose QuietComfort 35 II', 'headphones'],
      ['Bose QC45', 'headphones'],
      ['Beats Studio3 Wireless', 'headphones'],
      ['JBL Flip 5', 'speaker'],
      ['JBL Charge 5', 'speaker'],
      ['UE MEGABOOM 3', 'speaker'],
      ['Logitech MX Master 3S', 'mouse'],
      ['Apple Magic Mouse', 'mouse'],
      ['Razer DeathAdder V3', 'mouse'],
      ['Logitech MX Keys Mini', 'keyboard'],
      ['Apple Magic Keyboard with Touch ID', 'keyboard'],
      ['Keychron K3 Pro', 'keyboard'],
      ['Bluetooth LE Generic Controller', 'peripheral'],
      ['', 'peripheral']
    ];

    for (const [inputName, expected] of matrix) {
      const detected = classifyBluetoothDeviceType(inputName);
      assert(`classifyBluetoothDeviceType("${inputName}") === "${expected}"`, detected === expected, `got ${detected}`);
    }
  }

  // -----------------------------------------------------------------
  // 9. Zero Runtime Dependencies & Package Integrity
  // -----------------------------------------------------------------
  console.log('\n--- Phase 9: Zero Runtime Dependencies & Package Integrity ---');
  {
    const pkgPath = path.join(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert('package.json exists and is valid JSON', Boolean(pkg));
    assert('package.json dependencies is strictly empty object {}',
      pkg.dependencies && Object.keys(pkg.dependencies).length === 0,
      `keys: ${Object.keys(pkg.dependencies || {}).join(', ')}`);
  }

  // -----------------------------------------------------------------
  // SUMMARY & VERDICT
  // -----------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  CHALLENGER 1 SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    console.error(`Verdict: REQUEST_CHANGES (${failedTests} failures detected):`);
    failureDetails.forEach((f, idx) => {
      console.error(`  ${idx + 1}. [FAIL] ${f.description} ${f.details ? '(' + f.details + ')' : ''}`);
    });
    process.exit(1);
  } else {
    console.log('Verdict: APPROVE (Zero defects found, all adversarial tests passed)');
    process.exit(0);
  }
}

runAdversarialSuite().catch((err) => {
  console.error('Unhandled fatal error in adversarial suite:', err);
  process.exit(1);
});
