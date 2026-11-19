/**
 * Reviewer 2 Adversarial Verification & Stress Test Suite
 * Milestone 5: AirPods / Bluetooth Battery & Device HUD
 */

const { performance } = require('perf_hooks');
const {
  BluetoothMonitorService,
  BluetoothSimulator,
  classifyBluetoothDeviceType,
  normalizeBatteryLevel,
  normalizeMultiBattery
} = require('../dist/main/bluetooth-monitor');

let passed = 0;
let failed = 0;
const errors = [];

function check(name, condition, extra = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${name} ${extra ? '(' + extra + ')' : ''}`);
    errors.push({ name, extra });
  }
}

async function runReviewer2Tests() {
  console.log('====================================================');
  console.log('  REVIEWER 2: INDEPENDENT ADVERSARIAL STRESS TEST    ');
  console.log('====================================================\n');

  // Test Suite A: Device Classification Priority Matrix
  console.log('--- Test Suite A: Device Classification Priority Matrix ---');
  check('AirPods priority over Mouse: "AirPods Mouse"',
    classifyBluetoothDeviceType('AirPods Mouse') === 'airpods');
  check('AirPods priority over Earbuds: "AirPods Pro Buds"',
    classifyBluetoothDeviceType('AirPods Pro Buds') === 'airpods');
  check('Earbuds priority over Headphones: "Galaxy Buds Headset"',
    classifyBluetoothDeviceType('Galaxy Buds Headset') === 'earbuds');
  check('Speaker priority over Peripheral: "JBL Soundbar"',
    classifyBluetoothDeviceType('JBL Soundbar') === 'speaker');
  check('Mouse priority over Keyboard: "MX Master Touchpad"',
    classifyBluetoothDeviceType('MX Master Touchpad') === 'mouse');
  check('Class string fallback for empty name: deviceClass="Mouse"',
    classifyBluetoothDeviceType('', 'HID_DEVICE_MOUSE') === 'mouse');
  check('Class string fallback for empty name: deviceClass="Keyboard"',
    classifyBluetoothDeviceType('', 'HID_DEVICE_KEYBOARD') === 'keyboard');
  check('Class string fallback for empty name: deviceClass="Audio"',
    classifyBluetoothDeviceType('', 'BLUETOOTH_AUDIO') === 'peripheral');

  // Test Suite B: Battery Transition Matrix & Edge Cases
  console.log('\n--- Test Suite B: Battery Transition Matrix & Edge Cases ---');
  const service = new BluetoothMonitorService();
  const sim = new BluetoothSimulator();
  let emitted = [];
  service.onDeviceEvent((e) => emitted.push(e));

  // 1. Initial connection
  const d1 = sim.createDevice({ id: 'matrix-dev-1', name: 'Dev 1', connected: true, batteryPercent: 50 });
  emitted = [];
  let evts = service.updateDevices([d1]);
  check('Initial connect emits connected event', evts.length === 1 && evts[0].type === 'connected');

  // 2. Exact 2% battery increase (50 -> 52)
  const d1_52 = { ...d1, batteryPercent: 52 };
  emitted = [];
  evts = service.updateDevices([d1_52]);
  check('Exact +2% battery change triggers battery_change event', evts.length === 1 && evts[0].type === 'battery_change');

  // 3. Exact 1% battery change (52 -> 53): must be suppressed
  const d1_53 = { ...d1_52, batteryPercent: 53 };
  emitted = [];
  evts = service.updateDevices([d1_53]);
  check('1% battery change is suppressed (noise rejection)', evts.length === 0);

  // 4. Exact 2% battery decrease (53 -> 51)
  const d1_51 = { ...d1_53, batteryPercent: 51 };
  emitted = [];
  evts = service.updateDevices([d1_51]);
  check('Exact -2% battery change triggers battery_change event', evts.length === 1 && evts[0].type === 'battery_change');

  // 5. Battery transition null -> 50%
  const dNull = sim.createDevice({ id: 'matrix-dev-null', name: 'Null Dev', connected: true, batteryPercent: null });
  service.updateDevices([dNull]);
  const dNullTo50 = { ...dNull, batteryPercent: 50 };
  emitted = [];
  evts = service.updateDevices([dNullTo50]);
  check('Battery transition from null to 50% triggers battery_change', evts.length === 1 && evts[0].type === 'battery_change');

  // 6. Battery transition 50% -> null
  const d50ToNull = { ...dNullTo50, batteryPercent: null };
  emitted = [];
  evts = service.updateDevices([d50ToNull]);
  check('Battery transition from 50% to null triggers battery_change', evts.length === 1 && evts[0].type === 'battery_change');

  // 7. Same battery (null -> null): must be suppressed
  const dNullToNull = { ...d50ToNull, batteryPercent: null };
  emitted = [];
  evts = service.updateDevices([dNullToNull]);
  check('Battery transition from null to null is suppressed', evts.length === 0);

  // 8. Disconnected device receiving battery update should NOT emit battery_change
  const dDisconn = { ...d1_51, connected: false };
  service.updateDevices([dDisconn]); // emits disconnected
  const dDisconnBat = { ...dDisconn, batteryPercent: 80 };
  emitted = [];
  evts = service.updateDevices([dDisconnBat]);
  check('Disconnected device battery change does NOT emit event', evts.length === 0);

  // Test Suite C: Multi-Device Atomic Batch Transitions
  console.log('\n--- Test Suite C: Multi-Device Atomic Batch Transitions ---');
  const batchDevA = sim.createDevice({ id: 'batch-a', name: 'Batch A', connected: true, batteryPercent: 50 });
  const batchDevB = sim.createDevice({ id: 'batch-b', name: 'Batch B', connected: true, batteryPercent: 50 });
  const batchDevC = sim.createDevice({ id: 'batch-c', name: 'Batch C', connected: true, batteryPercent: 50, isCharging: false });
  service.updateDevices([batchDevA, batchDevB, batchDevC]);

  // Now create batch transition:
  // A: disconnects
  // B: changes battery by +10%
  // C: toggles charging to true
  // D: brand new device connects
  const batchUpdate = [
    { ...batchDevA, connected: false },
    { ...batchDevB, batteryPercent: 60 },
    { ...batchDevC, isCharging: true },
    sim.createDevice({ id: 'batch-d', name: 'Batch D', connected: true, batteryPercent: 90 })
  ];
  emitted = [];
  const batchEvents = service.updateDevices(batchUpdate);
  check('Batch transition emits exactly 4 events for 4 state changes', batchEvents.length === 4);
  check('Batch event 0 is disconnected (Dev A)', batchEvents.some(e => e.type === 'disconnected' && e.device.id === 'batch-a'));
  check('Batch event 1 is battery_change (Dev B, 60%)', batchEvents.some(e => e.type === 'battery_change' && e.device.id === 'batch-b' && e.device.batteryPercent === 60));
  check('Batch event 2 is battery_change (Dev C, isCharging=true)', batchEvents.some(e => e.type === 'battery_change' && e.device.id === 'batch-c' && e.device.isCharging === true));
  check('Batch event 3 is connected (Dev D)', batchEvents.some(e => e.type === 'connected' && e.device.id === 'batch-d'));

  // Test Suite D: Mock Canvas 2D Context Vector Glyphs Execution
  console.log('\n--- Test Suite D: Mock Canvas 2D Context Vector Glyphs Execution ---');
  // Create a minimal mock canvas 2D context to verify drawBluetoothHudContent primitives
  const drawCalls = [];
  const mockCtx = {
    save: () => drawCalls.push('save'),
    restore: () => drawCalls.push('restore'),
    beginPath: () => drawCalls.push('beginPath'),
    arc: (...args) => drawCalls.push(['arc', ...args]),
    fill: () => drawCalls.push('fill'),
    stroke: () => drawCalls.push('stroke'),
    moveTo: (...args) => drawCalls.push(['moveTo', ...args]),
    lineTo: (...args) => drawCalls.push(['lineTo', ...args]),
    roundRect: (...args) => drawCalls.push(['roundRect', ...args]),
    fillRect: (...args) => drawCalls.push(['fillRect', ...args]),
    fillText: (...args) => drawCalls.push(['fillText', ...args]),
    measureText: (txt) => ({ width: txt.length * 7 }),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    textAlign: 'left',
    textBaseline: 'alphabetic'
  };

  // Mock engine instance
  const mockEngine = {
    ctx: mockCtx,
    currentWidth: 368,
    currentHeight: 44,
    activeBluetoothDevice: {
      name: 'AirPods Pro',
      deviceType: 'airpods',
      batteryPercent: 88,
      multiBattery: { left: 85, right: 90, case: 100 },
      connected: true,
      isCharging: false
    },
    truncateText: (txt) => txt
  };

  // Import compiled bundle check
  const fs = require('fs');
  const path = require('path');
  const bundleContent = fs.readFileSync(path.join(__dirname, '../dist/renderer/island/bundle.js'), 'utf8');

  // Dynamically locate drawBluetoothHudContent and extract method body
  const startMarker = 'drawBluetoothHudContent(cx, topY) {';
  const startIndex = bundleContent.indexOf(startMarker);
  let methodBody = '';
  if (startIndex !== -1) {
    const afterStart = bundleContent.slice(startIndex + startMarker.length);
    let depth = 1;
    let endPos = 0;
    for (let i = 0; i < afterStart.length; i++) {
      if (afterStart[i] === '{') depth++;
      else if (afterStart[i] === '}') {
        depth--;
        if (depth === 0) {
          endPos = i;
          break;
        }
      }
    }
    methodBody = afterStart.slice(0, endPos);
  }

  let drawThrew = false;
  try {
    const fn = new Function('cx', 'topY', methodBody);
    fn.call(mockEngine, 430, 10);
  } catch (err) {
    drawThrew = true;
    console.error('Vector drawing threw:', err);
  }

  check('drawBluetoothHudContent executes vector canvas commands without throwing', !drawThrew);
  check('drawBluetoothHudContent executed save & restore pair',
    drawCalls.filter(c => c === 'save').length >= 2 && drawCalls.filter(c => c === 'restore').length >= 2);
  check('drawBluetoothHudContent drew battery roundRects',
    drawCalls.some(c => Array.isArray(c) && c[0] === 'roundRect'));
  check('drawBluetoothHudContent rendered text labels',
    drawCalls.some(c => Array.isArray(c) && c[0] === 'fillText'));

  // Test Suite E: Integrity & Absence of Cheats / Facades
  console.log('\n--- Test Suite E: Integrity & Absence of Cheats / Facades ---');
  const bmSrc = fs.readFileSync(path.join(__dirname, '../src/main/bluetooth-monitor.ts'), 'utf8');
  check('Zero fake test results or hardcoded pass tokens in bluetooth-monitor.ts',
    !bmSrc.includes('[PASS]') && !bmSrc.includes('TEST SUMMARY:'));
  check('Zero hardcoded test strings in bluetooth-monitor.ts',
    !bmSrc.includes('test-trans-1') && !bmSrc.includes('sim-test-device'));
  check('Realistic PowerShell PnP device querying with DEVPKEY is implemented',
    bmSrc.includes('Get-PnpDevice -Class \'Bluetooth\'') &&
    bmSrc.includes('{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2'));
  check('Safe child_process timeout (3000ms) enforced on PowerShell execution',
    bmSrc.includes('timeout: timeoutMs') && bmSrc.includes('windowsHide: true'));

  console.log('\n====================================================');
  console.log(`  REVIEWER 2 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runReviewer2Tests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
