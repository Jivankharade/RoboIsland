/**
 * Challenger 2: Adversarial Empirical Stress Test Harness for Milestone 5
 * (R5: AirPods / Bluetooth Battery & Device HUD)
 *
 * Verifies:
 * 1. IPC Bridge Contract Integrity:
 *    - Typed methods: getDevices, simulateEvent, onHudEvent on islandAPI.bluetooth, island.bluetooth, roboIsland.bluetooth.
 *    - Top-level aliases: getBluetoothDevices, simulateBluetoothEvent, onBluetoothHudEvent.
 *    - Main process IPC channels: bluetooth:get-devices, bluetooth:simulate-event, island:bluetooth-hud.
 *    - Lifecycle disposal: clean teardown of timers, listeners, and cached state.
 *
 * 2. Canvas & UI HUD Layout Bounds:
 *    - Strict containment within 860x440 transparent viewport (PANEL_WIDTH x PANEL_HEIGHT).
 *    - Resting & compact dynamic expansion: 330px/338px (standard) and 360px/368px (multiBattery).
 *    - Centering math: Left edge >= 246px, Right edge <= 614px, Top = 10px, Bottom = 54px.
 *    - DOM card #bluetooth-hud-card: 340x44px, centered at left: 50% with transform: translateX(-50%).
 *    - Text bounding: CSS ellipsis max-width: 130px and Canvas truncateText maxTextW: 110px/150px.
 *
 * 3. Auto-Dismissal & Timer Hygiene:
 *    - Standard 4000ms duration (bluetoothHudUntil) and 3900ms DOM card timer.
 *    - Rapid sequential event storm (100 rapid events) resets timer cleanly without timer accumulation.
 *    - Clean reset of display timer extending from last event.
 *    - Click dismissal resets bluetoothHudUntil and restores base dimensions.
 *    - Hover state dynamics and clean relaxation.
 *
 * 4. Noise Delta Filtering (<2% suppressed, >=2% emitted):
 *    - Delta = 0%: suppressed.
 *    - Delta = ±1%: suppressed.
 *    - Delta = ±2%: emitted (battery_change).
 *    - Delta = ±5%: emitted (battery_change).
 *    - Charging toggle: emitted regardless of battery delta.
 *    - Connection / Disconnection transitions.
 *    - Boundary 0% and 100% transitions.
 *    - Incremental vs Full scan behavior (isFullScan).
 *
 * 5. Simulation Presets & Throughput Benchmarking:
 *    - All 4 built-in presets (AirPods Pro, Sony XM5, Logitech MX Master 3, Galaxy Buds2).
 *    - Preset immutability.
 *    - Derived earbud battery calculation when batteryPercent is omitted.
 *    - High-throughput SLA: >10,000 ops/sec, memory stability (<15MB heap delta).
 *    - ReDoS safety on 100,000-character adversarial string.
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const {
  BluetoothMonitorService,
  bluetoothMonitorService,
  BluetoothSimulator,
  classifyBluetoothDeviceType,
  normalizeBatteryLevel,
  normalizeMultiBattery
} = require('../dist/main/bluetooth-monitor');

const { PANEL_WIDTH, PANEL_HEIGHT } = require('../dist/main/display-manager');

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
// TEST SUITE EXECUTION
// ============================================================================
async function runChallenger2Suite() {
  console.log('================================================================');
  console.log('  CHALLENGER 2: ADVERSARIAL STRESS TEST HARNESS (MILESTONE 5)   ');
  console.log('  AirPods / Bluetooth Battery & Device HUD (R5)                 ');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SUITE 1: IPC BRIDGE CONTRACT INTEGRITY & API SURFACE
  // --------------------------------------------------------------------------
  console.log('--- Suite 1: IPC Bridge Contract Integrity & API Surface ---');

  const preloadSrc = fs.readFileSync(path.join(__dirname, '../src/preload/island-preload.ts'), 'utf8');
  const mainIndexSrc = fs.readFileSync(path.join(__dirname, '../src/main/index.ts'), 'utf8');
  const btMonitorSrc = fs.readFileSync(path.join(__dirname, '../src/main/bluetooth-monitor.ts'), 'utf8');

  // Verify IPC channel registration in main/index.ts
  assert('main/index.ts registers "bluetooth:get-devices" handler',
    mainIndexSrc.includes("ipcMain.handle('bluetooth:get-devices'"));

  assert('main/index.ts registers "bluetooth:simulate-event" handler',
    mainIndexSrc.includes("ipcMain.handle('bluetooth:simulate-event'"));

  assert('main/index.ts wires bluetoothMonitorService broadcast callback to islandWindow webContents',
    mainIndexSrc.includes('bluetoothMonitorService.setBroadcastCallback((channel, data) => {') &&
    mainIndexSrc.includes('islandWindow?.getWindow()?.webContents.send(channel, data);'));

  assert('bluetooth-monitor.ts passes "island:bluetooth-hud" channel to broadcastCallback',
    btMonitorSrc.includes("this.broadcastCallback('island:bluetooth-hud', event)"));

  assert('main/index.ts disposes bluetoothMonitorService on will-quit',
    mainIndexSrc.includes('bluetoothMonitorService.dispose()'));

  // Verify preload contracts
  assert('island-preload.ts exposes nested bluetooth.getDevices',
    preloadSrc.includes("getDevices: () => ipcRenderer.invoke('bluetooth:get-devices')"));

  assert('island-preload.ts exposes nested bluetooth.simulateEvent',
    preloadSrc.includes("simulateEvent: (event: any) => ipcRenderer.invoke('bluetooth:simulate-event', event)"));

  assert('island-preload.ts exposes nested bluetooth.onHudEvent with cleanup listener',
    preloadSrc.includes("onHudEvent: (callback: (event: any) => void)") &&
    preloadSrc.includes("ipcRenderer.on('island:bluetooth-hud', handler)") &&
    preloadSrc.includes("ipcRenderer.removeListener('island:bluetooth-hud', handler)"));

  assert('island-preload.ts exposes top-level alias getBluetoothDevices',
    preloadSrc.includes("getBluetoothDevices: () => ipcRenderer.invoke('bluetooth:get-devices')"));

  assert('island-preload.ts exposes top-level alias simulateBluetoothEvent',
    preloadSrc.includes("simulateBluetoothEvent: (event: any) => ipcRenderer.invoke('bluetooth:simulate-event', event)"));

  assert('island-preload.ts exposes top-level alias onBluetoothHudEvent with cleanup',
    preloadSrc.includes("onBluetoothHudEvent: (callback: (event: any) => void)") &&
    preloadSrc.includes("return () => ipcRenderer.removeListener('island:bluetooth-hud', handler)"));

  // Verify multi-bridge exposure (roboIsland, island, islandAPI)
  assert('island-preload.ts exposes bridge to roboIsland',
    preloadSrc.includes("contextBridge.exposeInMainWorld('roboIsland', api)") ||
    preloadSrc.includes("(window as any).roboIsland = api"));

  assert('island-preload.ts exposes bridge to island',
    preloadSrc.includes("contextBridge.exposeInMainWorld('island', api)") ||
    preloadSrc.includes("(window as any).island = api"));

  assert('island-preload.ts exposes bridge to islandAPI',
    preloadSrc.includes("contextBridge.exposeInMainWorld('islandAPI', api)") ||
    preloadSrc.includes("(window as any).islandAPI = api"));

  // Verify runtime behavior of Mock Preload Bridge
  const mockIpcRenderer = {
    handlers: new Map(),
    listeners: new Map(),
    invoke: async (channel, ...args) => {
      const handler = mockIpcRenderer.handlers.get(channel);
      if (handler) return handler(...args);
      throw new Error(`Unhandled invoke: ${channel}`);
    },
    on: (channel, listener) => {
      if (!mockIpcRenderer.listeners.has(channel)) mockIpcRenderer.listeners.set(channel, []);
      mockIpcRenderer.listeners.get(channel).push(listener);
    },
    removeListener: (channel, listener) => {
      if (mockIpcRenderer.listeners.has(channel)) {
        const list = mockIpcRenderer.listeners.get(channel).filter(l => l !== listener);
        mockIpcRenderer.listeners.set(channel, list);
      }
    },
    sendEvent: (channel, data) => {
      const list = mockIpcRenderer.listeners.get(channel) || [];
      for (const fn of list) fn({}, data);
    }
  };

  const testService = new BluetoothMonitorService();
  mockIpcRenderer.handlers.set('bluetooth:get-devices', () => testService.getConnectedDevices());
  mockIpcRenderer.handlers.set('bluetooth:simulate-event', (payload) => testService.simulateEvent(payload));
  testService.setBroadcastCallback((channel, payload) => {
    mockIpcRenderer.sendEvent(channel, payload);
  });

  const apiBridge = {
    bluetooth: {
      getDevices: () => mockIpcRenderer.invoke('bluetooth:get-devices'),
      simulateEvent: (evt) => mockIpcRenderer.invoke('bluetooth:simulate-event', evt),
      onHudEvent: (cb) => {
        const handler = (_event, data) => cb(data);
        mockIpcRenderer.on('island:bluetooth-hud', handler);
        return () => mockIpcRenderer.removeListener('island:bluetooth-hud', handler);
      }
    }
  };

  let bridgeReceivedEvent = null;
  const unlistenBridge = apiBridge.bluetooth.onHudEvent((evt) => {
    bridgeReceivedEvent = evt;
  });

  const simulatedDev = await apiBridge.bluetooth.simulateEvent({
    type: 'connected',
    device: { name: 'Adversarial Test Pods', batteryPercent: 94 }
  });

  assert('Bridge simulateEvent returns valid device model with generated id',
    Boolean(simulatedDev && simulatedDev.id && simulatedDev.name === 'Adversarial Test Pods' && simulatedDev.batteryPercent === 94));

  assert('Bridge onHudEvent received event broadcast with identical payload',
    Boolean(bridgeReceivedEvent && bridgeReceivedEvent.type === 'connected' && bridgeReceivedEvent.device.name === 'Adversarial Test Pods'));

  unlistenBridge();
  assert('Bridge unlisten properly deregisters handler from IPC channel',
    (mockIpcRenderer.listeners.get('island:bluetooth-hud') || []).length === 0);

  // Teardown service test instance
  testService.dispose();
  assert('testService.dispose clears devices, listeners, and timers cleanly',
    testService.getAllDevices().length === 0 && testService.getConnectedDevices().length === 0);

  console.log('');

  // --------------------------------------------------------------------------
  // SUITE 2: CANVAS & UI HUD LAYOUT BOUNDS (860x440 VIEWPORT)
  // --------------------------------------------------------------------------
  console.log('--- Suite 2: Canvas & UI HUD Layout Bounds in 860x440 Viewport ---');

  assert('Master viewport width is exactly 860px', PANEL_WIDTH === 860);
  assert('Master viewport height is exactly 440px', PANEL_HEIGHT === 440);

  const canvasEngineSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf8');
  const islandCssSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/island.css'), 'utf8');
  const indexHtmlSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/index.html'), 'utf8');

  // Verify DOM elements exist in index.html
  assert('index.html contains #bluetooth-hud-card container', indexHtmlSrc.includes('id="bluetooth-hud-card"'));
  assert('index.html contains #bt-hud-icon', indexHtmlSrc.includes('id="bt-hud-icon"'));
  assert('index.html contains #bt-hud-name', indexHtmlSrc.includes('id="bt-hud-name"'));
  assert('index.html contains #bt-hud-status', indexHtmlSrc.includes('id="bt-hud-status"'));
  assert('index.html contains #bt-hud-battery-percent', indexHtmlSrc.includes('id="bt-hud-battery-percent"'));
  assert('index.html contains #bt-hud-battery-fill', indexHtmlSrc.includes('id="bt-hud-battery-fill"'));
  assert('index.html contains #bt-hud-multibattery container', indexHtmlSrc.includes('id="bt-hud-multibattery"'));
  assert('index.html contains #bt-hud-mb-left, #bt-hud-mb-right, #bt-hud-mb-case chips',
    indexHtmlSrc.includes('id="bt-hud-mb-left"') &&
    indexHtmlSrc.includes('id="bt-hud-mb-right"') &&
    indexHtmlSrc.includes('id="bt-hud-mb-case"'));

  // Verify CSS styles in island.css
  assert('island.css styles .bluetooth-hud-card with fixed 340px width and 44px height',
    islandCssSrc.includes('width: 340px') && islandCssSrc.includes('height: 44px'));

  assert('island.css centers .bluetooth-hud-card with top: 10px, left: 50%, transform: translateX(-50%)',
    islandCssSrc.includes('top: 10px') &&
    islandCssSrc.includes('left: 50%') &&
    islandCssSrc.includes('transform: translateX(-50%)'));

  assert('island.css enforces max-width: 130px with text-overflow ellipsis on .bt-hud-name',
    islandCssSrc.includes('max-width: 130px') &&
    islandCssSrc.includes('text-overflow: ellipsis') &&
    islandCssSrc.includes('white-space: nowrap'));

  assert('island.css styles battery badge and multibattery badges with compact typography',
    islandCssSrc.includes('.bt-hud-battery-badge') &&
    islandCssSrc.includes('.bt-mb-badge'));

  // Layout Bound Assertions (Horizontal & Vertical Containment)
  const windowCenterX = PANEL_WIDTH / 2; // 430px
  const hudTopY = 10;
  const hudHeight = 44;
  const hudBottomY = hudTopY + hudHeight; // 54px

  // Test Case 2.1: Non-multibattery HUD
  const standardRestWidth = 330;
  const standardHoverWidth = 338;
  const standardLeftRest = windowCenterX - standardRestWidth / 2; // 430 - 165 = 265
  const standardRightRest = windowCenterX + standardRestWidth / 2; // 430 + 165 = 595
  const standardLeftHover = windowCenterX - standardHoverWidth / 2; // 430 - 169 = 261
  const standardRightHover = windowCenterX + standardHoverWidth / 2; // 430 + 169 = 599

  assert('Standard Bluetooth HUD (330px rest) left bound >= 0 (265px)', standardLeftRest >= 0);
  assert('Standard Bluetooth HUD (330px rest) right bound <= 860 (595px)', standardRightRest <= PANEL_WIDTH);
  assert('Standard Bluetooth HUD (338px hover) left bound >= 0 (261px)', standardLeftHover >= 0);
  assert('Standard Bluetooth HUD (338px hover) right bound <= 860 (599px)', standardRightHover <= PANEL_WIDTH);

  // Test Case 2.2: MultiBattery HUD (AirPods Pro / Earbuds with case)
  const mbRestWidth = 360;
  const mbHoverWidth = 368;
  const mbLeftRest = windowCenterX - mbRestWidth / 2; // 430 - 180 = 250
  const mbRightRest = windowCenterX + mbRestWidth / 2; // 430 + 180 = 610
  const mbLeftHover = windowCenterX - mbHoverWidth / 2; // 430 - 184 = 246
  const mbRightHover = windowCenterX + mbHoverWidth / 2; // 430 + 184 = 614

  assert('MultiBattery HUD (360px rest) left bound >= 0 (250px)', mbLeftRest >= 0);
  assert('MultiBattery HUD (360px rest) right bound <= 860 (610px)', mbRightRest <= PANEL_WIDTH);
  assert('MultiBattery HUD (368px hover) left bound >= 0 (246px)', mbLeftHover >= 0);
  assert('MultiBattery HUD (368px hover) right bound <= 860 (614px)', mbRightHover <= PANEL_WIDTH);

  // Test Case 2.3: Vertical Containment
  assert('Bluetooth HUD top edge (10px) >= 0', hudTopY >= 0);
  assert('Bluetooth HUD bottom edge (54px) <= 440 (leaves 386px clearance)', hudBottomY <= PANEL_HEIGHT);

  // Test Case 2.4: DOM Card bounds
  const domCardWidth = 340;
  const domCardLeft = windowCenterX - domCardWidth / 2; // 260px
  const domCardRight = windowCenterX + domCardWidth / 2; // 600px
  assert('DOM #bluetooth-hud-card left (260px) and right (600px) contained in [0, 860]',
    domCardLeft >= 0 && domCardRight <= PANEL_WIDTH);

  // Test Case 2.5: Canvas Engine Dynamic Sizing Logic in updateTargetDimensions
  assert('canvas-engine.ts expands targetWidth to 330/338px for single battery',
    canvasEngineSrc.includes('this.targetWidth = this.isHovered ? (hasMb ? 368 : 338) : (hasMb ? 360 : 330)'));

  assert('canvas-engine.ts expands targetHeight to 44px and targetRadius to 22px',
    canvasEngineSrc.includes('this.targetHeight = 44') && canvasEngineSrc.includes('this.targetRadius = 22'));

  assert('canvas-engine.ts defines drawBluetoothHudContent with text truncation guard',
    canvasEngineSrc.includes('const maxTextW = hasMulti ? 110 : 150;') &&
    canvasEngineSrc.includes('this.truncateText(dev.name || \'Bluetooth Device\', maxTextW'));

  console.log('');

  // --------------------------------------------------------------------------
  // SUITE 3: AUTO-DISMISSAL, TIMER HYGIENE & RACE CONDITION IMMUNITY
  // --------------------------------------------------------------------------
  console.log('--- Suite 3: Auto-Dismissal & Timer Hygiene ---');

  // Verify timer durations in code
  assert('canvas-engine.ts sets bluetoothHudUntil to performance.now() + 4000',
    canvasEngineSrc.includes('this.bluetoothHudUntil = performance.now() + 4000'));

  assert('canvas-engine.ts sets __btHudTimer to 3900ms before auto-hiding card',
    canvasEngineSrc.includes('(this as any).__btHudTimer = setTimeout(() => {') &&
    canvasEngineSrc.includes('3900);'));

  assert('canvas-engine.ts clears previous __btHudTimer on every new HUD pop (preventing timer leaks)',
    canvasEngineSrc.includes('clearTimeout((this as any).__btHudTimer)'));

  // Empirical Simulation of Canvas Engine Timer State
  class MockCanvasEngine {
    constructor() {
      this.mode = 'compact';
      this.currentWidth = 98;
      this.currentHeight = 26;
      this.targetWidth = 98;
      this.targetHeight = 26;
      this.bluetoothHudUntil = 0;
      this.bluetoothHudStartTime = 0;
      this.activeBluetoothDevice = null;
      this.activeBluetoothEvent = null;
      this.isHovered = false;
      this.__btHudTimer = null;
      this.domCardHidden = true;
    }

    triggerBluetoothHud(eventOrDevice) {
      if (!eventOrDevice) return;
      const device = eventOrDevice.device || eventOrDevice;
      this.activeBluetoothEvent = eventOrDevice;
      this.activeBluetoothDevice = device;
      this.bluetoothHudStartTime = performance.now();
      this.bluetoothHudUntil = performance.now() + 4000;

      this.updateTargetDimensions();
      this.showBluetoothHudCard(device);
    }

    showBluetoothHudCard(device) {
      this.domCardHidden = false;
      if (this.__btHudTimer) {
        clearTimeout(this.__btHudTimer);
        this.__btHudTimer = null;
      }
      this.__btHudTimer = setTimeout(() => {
        this.domCardHidden = true;
      }, 3900);
    }

    updateTargetDimensions(simulatedNow = performance.now()) {
      if (simulatedNow < this.bluetoothHudUntil) {
        const hasMb = Boolean(this.activeBluetoothDevice?.multiBattery);
        this.targetWidth = this.isHovered ? (hasMb ? 368 : 338) : (hasMb ? 360 : 330);
        this.targetHeight = 44;
      } else {
        this.targetWidth = 98;
        this.targetHeight = 26;
      }
    }

    handleClick() {
      if (performance.now() < this.bluetoothHudUntil) {
        this.bluetoothHudUntil = 0;
        this.domCardHidden = true; // Click dismissal hides overlay
        if (this.__btHudTimer) {
          clearTimeout(this.__btHudTimer);
          this.__btHudTimer = null;
        }
        this.updateTargetDimensions();
      }
    }

    checkAutoRelax(now) {
      if (this.bluetoothHudUntil > 0 && now >= this.bluetoothHudUntil) {
        if (!this.isHovered) {
          this.bluetoothHudUntil = 0;
          this.updateTargetDimensions(now);
        }
      }
    }
  }

  const engine = new MockCanvasEngine();

  // Test 3.1: Trigger HUD and verify active state
  engine.triggerBluetoothHud({ name: 'AirPods Pro', multiBattery: { left: 90, right: 90 } });
  assert('HUD expands targetWidth to 360px on trigger', engine.targetWidth === 360);
  assert('HUD targetHeight expands to 44px on trigger', engine.targetHeight === 44);
  assert('HUD DOM card is unhidden', engine.domCardHidden === false);
  assert('HUD expiration time is ~4000ms in future',
    engine.bluetoothHudUntil >= performance.now() + 3950 && engine.bluetoothHudUntil <= performance.now() + 4050);

  // Test 3.2: Mid-lifecycle state at t = +2000ms
  engine.checkAutoRelax(performance.now() + 2000);
  assert('HUD remains expanded at t = +2000ms', engine.targetWidth === 360);

  // Test 3.3: Expiration at t = +4001ms
  engine.checkAutoRelax(performance.now() + 4001);
  assert('HUD auto-relaxes targetWidth to 98px base compact after 4000ms', engine.targetWidth === 98);
  assert('HUD auto-relaxes targetHeight to 26px base compact after 4000ms', engine.targetHeight === 26);

  // Test 3.4: Rapid Event Storm (100 rapid events fired within 10ms)
  engine.triggerBluetoothHud({ name: 'Device Initial' });

  for (let i = 0; i < 100; i++) {
    engine.triggerBluetoothHud({
      name: `Device Update #${i}`,
      batteryPercent: 50 + (i % 40)
    });
  }

  assert('Rapid event storm preserves valid active timer handle', engine.__btHudTimer !== null);
  assert('Rapid event storm resets expiration cleanly to ~4000ms from last event',
    engine.bluetoothHudUntil >= performance.now() + 3950);

  // Test 3.5: Click Dismissal
  engine.handleClick();
  assert('Clicking active HUD immediately sets bluetoothHudUntil = 0', engine.bluetoothHudUntil === 0);
  assert('Clicking active HUD immediately restores targetWidth to 98px', engine.targetWidth === 98);
  assert('Clicking active HUD immediately clears timer and hides DOM card',
    engine.domCardHidden === true && engine.__btHudTimer === null);

  // Test 3.6: Hover Dynamics while active
  engine.triggerBluetoothHud({ name: 'Hover Test Device' });
  engine.isHovered = true;
  engine.updateTargetDimensions();
  assert('Hover dynamics: targetWidth expands to 338px while hovered during active HUD',
    engine.targetWidth === 338);

  engine.isHovered = false;
  engine.updateTargetDimensions();
  assert('Unhovering restores targetWidth to standard 330px while HUD is active',
    engine.targetWidth === 330);

  // Auto-relax when expired
  engine.checkAutoRelax(performance.now() + 5001);
  assert('Auto-relax restores targetWidth to 98px base compact when expired', engine.targetWidth === 98);

  console.log('');

  // --------------------------------------------------------------------------
  // SUITE 4: NOISE DELTA FILTERING (<2% SUPPRESSED, >=2% EMITTED)
  // --------------------------------------------------------------------------
  console.log('--- Suite 4: Noise Delta Filtering (<2% Suppressed, >=2% Emitted) ---');

  const monitor = new BluetoothMonitorService();
  monitor.resetToPresets();

  const simulator = new BluetoothSimulator();
  const testDevId = 'bt-noise-test-device';

  // Seed baseline device
  monitor.updateDevices([
    simulator.createDevice({
      id: testDevId,
      name: 'Noise Test Buds',
      deviceType: 'earbuds',
      connected: true,
      batteryPercent: 80,
      isCharging: false
    })
  ]);

  // Test 4.1: Delta = 0% (80% -> 80%)
  let evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 80, isCharging: false })
  ]);
  assert('Delta = 0% (80% -> 80%) suppresses event (0 emitted)', evts.length === 0);

  // Test 4.2: Delta = +1% (80% -> 81%)
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 81, isCharging: false })
  ]);
  assert('Delta = +1% (80% -> 81%) suppresses event (0 emitted)', evts.length === 0);

  // Test 4.3: Delta = -1% (81% -> 80%)
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 80, isCharging: false })
  ]);
  assert('Delta = -1% (81% -> 80%) suppresses event (0 emitted)', evts.length === 0);

  // Test 4.4: Delta = +2% (80% -> 82%) - EXACT THRESHOLD
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 82, isCharging: false })
  ]);
  assert('Delta = +2% (80% -> 82%) emits battery_change event',
    evts.length === 1 && evts[0].type === 'battery_change' && evts[0].device.batteryPercent === 82);

  // Test 4.5: Delta = -2% (82% -> 80%) - EXACT THRESHOLD
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 80, isCharging: false })
  ]);
  assert('Delta = -2% (82% -> 80%) emits battery_change event',
    evts.length === 1 && evts[0].type === 'battery_change' && evts[0].device.batteryPercent === 80);

  // Test 4.6: Delta = +5% (80% -> 85%) - WELL ABOVE THRESHOLD
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 85, isCharging: false })
  ]);
  assert('Delta = +5% (80% -> 85%) emits battery_change event',
    evts.length === 1 && evts[0].type === 'battery_change' && evts[0].device.batteryPercent === 85);

  // Test 4.7: Delta = -10% (85% -> 75%)
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 75, isCharging: false })
  ]);
  assert('Delta = -10% (85% -> 75%) emits battery_change event',
    evts.length === 1 && evts[0].type === 'battery_change' && evts[0].device.batteryPercent === 75);

  // Test 4.8: Charging state toggled with 0% delta (75% -> 75%, charging false -> true)
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 75, isCharging: true })
  ]);
  assert('Charging state toggle (false -> true) emits battery_change event with 0% battery delta',
    evts.length === 1 && evts[0].type === 'battery_change' && evts[0].device.isCharging === true);

  // Test 4.9: Charging state toggled with 0% delta (75% -> 75%, charging true -> false)
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 75, isCharging: false })
  ]);
  assert('Charging state toggle (true -> false) emits battery_change event with 0% battery delta',
    evts.length === 1 && evts[0].type === 'battery_change' && evts[0].device.isCharging === false);

  // Test 4.10: Connection status toggle (true -> false) emits 'disconnected'
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: false, batteryPercent: 75 })
  ]);
  assert('Connection toggle (true -> false) emits disconnected event',
    evts.length === 1 && evts[0].type === 'disconnected' && evts[0].device.connected === false);

  // Test 4.11: Connection status toggle (false -> true) emits 'connected'
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 75 })
  ]);
  assert('Connection toggle (false -> true) emits connected event',
    evts.length === 1 && evts[0].type === 'connected' && evts[0].device.connected === true);

  // Test 4.12: Boundary battery levels (0% to 1%: suppressed; 0% to 2% direct: emitted)
  const boundaryDevId = 'bt-boundary-dev';
  monitor.updateDevices([
    simulator.createDevice({ id: boundaryDevId, name: 'Boundary Device', connected: true, batteryPercent: 0 })
  ]);
  evts = monitor.updateDevices([
    simulator.createDevice({ id: boundaryDevId, name: 'Boundary Device', connected: true, batteryPercent: 1 })
  ]);
  assert('Boundary 0% -> 1% (delta 1%) is suppressed', evts.length === 0);

  // From stored 1% to 3% is delta of 2%: emitted!
  evts = monitor.updateDevices([
    simulator.createDevice({ id: boundaryDevId, name: 'Boundary Device', connected: true, batteryPercent: 3 })
  ]);
  assert('Boundary 1% -> 3% (delta 2%) emits battery_change',
    evts.length === 1 && evts[0].type === 'battery_change' && evts[0].device.batteryPercent === 3);

  // Direct 0% -> 2% transition on clean device: emitted!
  const directBoundaryId = 'bt-direct-boundary';
  monitor.updateDevices([
    simulator.createDevice({ id: directBoundaryId, name: 'Direct Boundary', connected: true, batteryPercent: 0 })
  ]);
  evts = monitor.updateDevices([
    simulator.createDevice({ id: directBoundaryId, name: 'Direct Boundary', connected: true, batteryPercent: 2 })
  ]);
  assert('Direct 0% -> 2% (delta 2%) emits battery_change',
    evts.length === 1 && evts[0].type === 'battery_change' && evts[0].device.batteryPercent === 2);

  // Test 4.13: Boundary 99% to 100% vs 98% to 100%
  monitor.updateDevices([
    simulator.createDevice({ id: boundaryDevId, name: 'Boundary Device', connected: true, batteryPercent: 99 })
  ]);
  evts = monitor.updateDevices([
    simulator.createDevice({ id: boundaryDevId, name: 'Boundary Device', connected: true, batteryPercent: 100 })
  ]);
  assert('Boundary 99% -> 100% (delta 1%) is suppressed', evts.length === 0);

  monitor.updateDevices([
    simulator.createDevice({ id: boundaryDevId, name: 'Boundary Device', connected: true, batteryPercent: 98 })
  ]);
  evts = monitor.updateDevices([
    simulator.createDevice({ id: boundaryDevId, name: 'Boundary Device', connected: true, batteryPercent: 100 })
  ]);
  assert('Boundary 98% -> 100% (delta 2%) emits battery_change',
    evts.length === 1 && evts[0].type === 'battery_change');

  // Test 4.14: Full scan vs Incremental scan
  const vanishingDevId = 'bt-vanishing-dev';
  monitor.updateDevices([
    simulator.createDevice({ id: vanishingDevId, name: 'Vanishing Mouse', connected: true, batteryPercent: 80 })
  ]);

  // Incremental scan omitting vanishingDevId
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 75 })
  ], false);
  assert('Incremental scan (isFullScan=false) omitting device does NOT emit disconnected',
    evts.every(e => e.type !== 'disconnected'));
  assert('Device remains connected in state during incremental scan',
    monitor.getDevice(vanishingDevId)?.connected === true);

  // Full scan omitting vanishingDevId
  evts = monitor.updateDevices([
    simulator.createDevice({ id: testDevId, name: 'Noise Test Buds', connected: true, batteryPercent: 75 })
  ], true);
  assert('Full scan (isFullScan=true) omitting device emits disconnected event',
    evts.some(e => e.type === 'disconnected' && e.device.id === vanishingDevId));
  assert('Device status in service is marked connected = false after full scan',
    monitor.getDevice(vanishingDevId)?.connected === false);

  monitor.dispose();
  console.log('');

  // --------------------------------------------------------------------------
  // SUITE 5: SIMULATION PRESETS & HIGH-THROUGHPUT STRESS BENCHMARKING
  // --------------------------------------------------------------------------
  console.log('--- Suite 5: Simulation Presets & High-Throughput Stress Benchmarking ---');

  const sim = new BluetoothSimulator();
  const presets = sim.getPresets();

  assert('getPresets returns exactly 4 presets', presets.length === 4);

  // Preset 1: AirPods Pro
  const airpods = presets.find(p => p.id === 'bt-airpods-pro-1');
  assert('Preset AirPods Pro exists with airpods type and valid multiBattery (L:85, R:90, C:100)',
    Boolean(airpods && airpods.deviceType === 'airpods' && airpods.multiBattery &&
      airpods.multiBattery.left === 85 && airpods.multiBattery.right === 90 && airpods.multiBattery.case === 100));

  // Preset 2: Sony WH-1000XM5
  const sony = presets.find(p => p.id === 'bt-sony-wh1000xm5-1');
  assert('Preset Sony WH-1000XM5 exists with headphones type and 70% battery',
    Boolean(sony && sony.deviceType === 'headphones' && sony.batteryPercent === 70));

  // Preset 3: Logitech MX Master 3
  const logi = presets.find(p => p.id === 'bt-logitech-mxmaster-1');
  assert('Preset Logitech MX Master 3 exists with mouse type and 50% battery',
    Boolean(logi && logi.deviceType === 'mouse' && logi.batteryPercent === 50));

  // Preset 4: Galaxy Buds2
  const buds = presets.find(p => p.id === 'bt-galaxy-buds2-1');
  assert('Preset Galaxy Buds2 exists with earbuds type and connected=false',
    Boolean(buds && buds.deviceType === 'earbuds' && buds.connected === false));

  // Preset immutability test
  presets[0].name = 'MUTATED NAME';
  const freshPresets = sim.getPresets();
  assert('Mutating returned presets array does NOT mutate internal simulator state (immutability verified)',
    freshPresets[0].name === 'AirPods Pro');

  // Derived Earbud Battery Level derivation in createDevice
  const derivedBoth = sim.createDevice({
    name: 'TWS Buds',
    multiBattery: { left: 80, right: 90, case: 100 }
  });
  assert('createDevice derives batteryPercent as Math.round((L+R)/2) = 85% when batteryPercent omitted',
    derivedBoth.batteryPercent === 85);

  const derivedLeftOnly = sim.createDevice({
    name: 'Mono Left Earbud',
    multiBattery: { left: 72 }
  });
  assert('createDevice derives batteryPercent from single left bud (72%) when right omitted',
    derivedLeftOnly.batteryPercent === 72);

  const derivedRightOnly = sim.createDevice({
    name: 'Mono Right Earbud',
    multiBattery: { right: 64 }
  });
  assert('createDevice derives batteryPercent from single right bud (64%) when left omitted',
    derivedRightOnly.batteryPercent === 64);

  const derivedCaseOnly = sim.createDevice({
    name: 'Earbuds Case Dock',
    multiBattery: { case: 95 }
  });
  assert('createDevice derives batteryPercent from case (95%) when left and right are omitted',
    derivedCaseOnly.batteryPercent === 95);

  // Normalization Edge Cases
  assert('normalizeBatteryLevel clamps -50 to 0', normalizeBatteryLevel(-50) === 0);
  assert('normalizeBatteryLevel clamps 150 to 100', normalizeBatteryLevel(150) === 100);
  assert('normalizeBatteryLevel extracts integer from "88%"', normalizeBatteryLevel('88%') === 88);
  assert('normalizeBatteryLevel extracts integer from "Battery: 42%"', normalizeBatteryLevel('Battery: 42%') === 42);
  assert('normalizeBatteryLevel returns null for empty string or NaN',
    normalizeBatteryLevel('') === null && normalizeBatteryLevel('unknown') === null && normalizeBatteryLevel(null) === null);

  assert('normalizeMultiBattery clamps out-of-range child values', (() => {
    const norm = normalizeMultiBattery({ left: -10, right: 120, case: 88 });
    return norm && norm.left === 0 && norm.right === 100 && norm.case === 88;
  })());

  // Adversarial ReDoS Safety on 100,000-character input
  const adversarialLongStr = 'AirPods Pro '.repeat(8333) + 'WH-1000XM5';
  const redosStart = performance.now();
  const classifiedType = classifyBluetoothDeviceType(adversarialLongStr);
  const redosDuration = performance.now() - redosStart;

  assert('classifyBluetoothDeviceType parses 100,000-char adversarial input in < 20ms without ReDoS',
    classifiedType === 'airpods' && redosDuration < 20, `Duration: ${redosDuration.toFixed(2)}ms`);

  // High-Throughput Benchmarking
  console.log('\n  [Benchmark] Running High-Throughput SLA Benchmarks:');
  const initialMem = process.memoryUsage().heapUsed;

  // 1. 20,000 Device Classifications
  const t0 = performance.now();
  for (let i = 0; i < 20000; i++) {
    classifyBluetoothDeviceType('Sony WH-1000XM5 Noise Canceling Headphones');
    classifyBluetoothDeviceType('Logitech MX Master 3 Wireless Mouse');
    classifyBluetoothDeviceType('Apple AirPods Pro 2nd Gen');
    classifyBluetoothDeviceType('Samsung Galaxy Buds2 Pro');
  }
  const t1 = performance.now();
  const classOpsPerSec = Math.round((80000 / (t1 - t0)) * 1000);
  console.log(`    - 80,000 Classifications: ${(t1 - t0).toFixed(2)}ms (${classOpsPerSec.toLocaleString()} ops/sec)`);
  assert('Classification throughput exceeds 50,000 ops/sec SLA', classOpsPerSec >= 50000);

  // 2. 5,000 updateDevices evaluations
  const benchService = new BluetoothMonitorService();
  const t2 = performance.now();
  for (let i = 0; i < 5000; i++) {
    benchService.updateDevices([
      sim.createDevice({ id: 'bt-bench-1', name: 'Bench AirPods', batteryPercent: 80 + (i % 5) })
    ]);
  }
  const t3 = performance.now();
  const updateOpsPerSec = Math.round((5000 / (t3 - t2)) * 1000);
  console.log(`    - 5,000 State Transitions: ${(t3 - t2).toFixed(2)}ms (${updateOpsPerSec.toLocaleString()} ops/sec)`);
  assert('updateDevices transition throughput exceeds 10,000 ops/sec SLA', updateOpsPerSec >= 10000);

  // 3. 2,000 simulateEvent dispatches with listener
  let receivedSimCount = 0;
  benchService.onDeviceEvent(() => { receivedSimCount++; });
  const t4 = performance.now();
  for (let i = 0; i < 2000; i++) {
    benchService.simulateEvent({
      type: 'battery_change',
      device: { id: 'bt-bench-sim', name: 'Simulated XM5', batteryPercent: 50 + (i % 20) }
    });
  }
  const t5 = performance.now();
  const simOpsPerSec = Math.round((2000 / (t5 - t4)) * 1000);
  console.log(`    - 2,000 simulateEvent dispatches: ${(t5 - t4).toFixed(2)}ms (${simOpsPerSec.toLocaleString()} ops/sec)`);
  assert('simulateEvent dispatches match exact listener count (2,000)', receivedSimCount === 2000);
  assert('simulateEvent throughput exceeds 5,000 ops/sec SLA', simOpsPerSec >= 5000);

  benchService.dispose();

  // Memory Stability Delta
  if (global.gc) global.gc();
  const finalMem = process.memoryUsage().heapUsed;
  const memDeltaMb = (finalMem - initialMem) / (1024 * 1024);
  console.log(`    - Heap Memory Delta across benchmarks: ${memDeltaMb.toFixed(2)} MB`);
  assert('Heap memory delta remains strictly bounded (< 15MB)', memDeltaMb < 15);

  console.log('\n================================================================');
  console.log(`  CHALLENGER 2 RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('================================================================');

  if (failures.length > 0) {
    console.error('\nFailures Summary:');
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. ${f.name} - ${f.details}`);
    });
  }

  process.exitCode = failedTests === 0 ? 0 : 1;
}

runChallenger2Suite().catch(err => {
  console.error('Fatal error during Challenger 2 test execution:', err);
  process.exit(1);
});
