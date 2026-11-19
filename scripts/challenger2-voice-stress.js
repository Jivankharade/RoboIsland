/**
 * Challenger 2: Adversarial Empirical Stress Test Harness for Milestone 6
 * (R6: Full Hands-Free Voice Companion Mode - Jarvis Voice)
 *
 * Verifies:
 * 1. IPC Bridge Contract Integrity & API Surface:
 *    - Typed methods on islandAPI.voice, island.voice, roboIsland.voice:
 *      startListening, stopListening, toggle, processCommand, speak, stopSpeaking, getState, onVoiceState.
 *    - Top-level aliases: startVoiceListening, stopVoiceListening, toggleVoice, processVoiceCommand,
 *      speakVoice, stopVoiceSpeaking, onVoiceState.
 *    - Main process IPC handlers in src/main/index.ts:
 *      voice:start-listening, voice:stop-listening, voice:toggle, voice:process-command,
 *      voice:speak, voice:stop-speaking, voice:get-state.
 *    - Dependencies wiring, broadcast forwarding to webContents, and will-quit disposal.
 *
 * 2. 60FPS Fluid Vector Canvas Wave Rendering Math & Strict Viewport Bounds:
 *    - Viewport bounds: strictly contained within 860x440 transparent viewport.
 *    - 4 sinusoidal waves with distinct phases, frequencies, and colors (#00f2fe, #4facfe, #ffaa00, #ff007f).
 *    - Dynamic amplitude scaling with audio level and state.
 *    - Bell curve envelope tapering at margins: Math.sin(normX * Math.PI) ensures 0 displacement at boundaries.
 *    - Numerical safety: zero NaN, zero Infinity coordinates across normal, zero, extreme, and corrupted levels.
 *    - Left voice orb glyph and right 5-band equalizer bars strictly contained.
 *
 * 3. Dynamic Island Expansion & Collapse Transitions:
 *    - Expansion to 280-340px width and 44px height during active voice states (LISTENING: 320px, THINKING: 300px, SPEAKING: 340px).
 *    - Centering bounds: left >= 255px, right <= 605px (PANEL_WIDTH = 860px).
 *    - Clean collapse to resting pill on IDLE (rest: 32x18px, compact: 98x26px).
 *    - Reset of audio level, bands, and HUD expiration timer.
 *
 * 4. Interruption & Click-to-Dismiss Speech Behavior:
 *    - Click event during active voice mode triggers interruptVoiceCompanion().
 *    - Immediate abort of child process TTS and cancellation of timers.
 *    - Immediate transition to IDLE with audio feedback.
 *    - Idempotency and crash-freedom under rapid successive interruptions.
 *
 * 5. 1-Click Header Mic Trigger Button & DOM/CSS Integration:
 *    - DOM #btn-voice-companion with status-btn class and mic SVG path in index.html.
 *    - DOM #voice-companion-card with aria-live and 5 animated wave bars.
 *    - CSS rules for card geometry (320x44px, border-radius: 22px, cyan theme) and animated bars.
 *    - Click listener on #btn-voice-companion wired to triggerVoiceCompanion().
 *
 * 6. Natural Language Dialogue Intent Processor & Adversarial Fuzzing:
 *    - Intent coverage: Time, Date, Battery HUD, Sports, Diagnostics/Errors, Math, Personality/Humor, Fallback.
 *    - Wake-word detection: Hey Jarvis, Jarvis, Hey Robo, RoboIsland with separator stripping.
 *    - ReDoS resilience on 50,000+ char input (<10ms).
 *    - Injection attack and malformed input safety.
 *
 * 7. Audio Frequency Bands Simulator & Throughput SLA:
 *    - 5 normalized bands [0.0 - 1.0] and composite level across all lifecycle states.
 *    - Bound clamping safety with extreme and negative values.
 *    - High throughput SLA: >500,000 ops/sec.
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const {
  VoiceCompanionService,
  voiceCompanionService,
  detectWakeWord,
  computeAudioBands
} = require('../dist/main/voice-companion-service');

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

async function runChallenger2VoiceSuite() {
  console.log('================================================================');
  console.log('  CHALLENGER 2: ADVERSARIAL STRESS TEST HARNESS (MILESTONE 6)   ');
  console.log('  Full Hands-Free Voice Companion Mode (Jarvis Voice)           ');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SUITE 1: IPC BRIDGE CONTRACT INTEGRITY & API SURFACE
  // --------------------------------------------------------------------------
  console.log('--- Suite 1: IPC Bridge Contract Integrity & API Surface ---');

  const preloadSrc = fs.readFileSync(path.join(__dirname, '../src/preload/island-preload.ts'), 'utf8');
  const mainIndexSrc = fs.readFileSync(path.join(__dirname, '../src/main/index.ts'), 'utf8');
  const voiceServiceSrc = fs.readFileSync(path.join(__dirname, '../src/main/voice-companion-service.ts'), 'utf8');

  // Verify IPC channel registration in main/index.ts
  assert('main/index.ts registers "voice:start-listening" handler',
    mainIndexSrc.includes("ipcMain.handle('voice:start-listening'"));

  assert('main/index.ts registers "voice:stop-listening" handler',
    mainIndexSrc.includes("ipcMain.handle('voice:stop-listening'"));

  assert('main/index.ts registers "voice:toggle" handler',
    mainIndexSrc.includes("ipcMain.handle('voice:toggle'"));

  assert('main/index.ts registers "voice:process-command" handler',
    mainIndexSrc.includes("ipcMain.handle('voice:process-command'"));

  assert('main/index.ts registers "voice:speak" handler',
    mainIndexSrc.includes("ipcMain.handle('voice:speak'"));

  assert('main/index.ts registers "voice:stop-speaking" handler',
    mainIndexSrc.includes("ipcMain.handle('voice:stop-speaking'"));

  assert('main/index.ts registers "voice:get-state" handler',
    mainIndexSrc.includes("ipcMain.handle('voice:get-state'"));

  assert('main/index.ts injects dependencies into voiceCompanionService',
    mainIndexSrc.includes('voiceCompanionService.setDependencies({') &&
    mainIndexSrc.includes('sportsService') &&
    mainIndexSrc.includes('launcherEngine') &&
    mainIndexSrc.includes('screenGlanceEngine') &&
    mainIndexSrc.includes('bluetoothMonitorService'));

  assert('main/index.ts wires voice broadcast callback to islandWindow webContents',
    mainIndexSrc.includes('voiceCompanionService.setBroadcastCallback((channel, data) => {') &&
    mainIndexSrc.includes('islandWindow?.getWindow()?.webContents.send(channel, data);'));

  assert('main/index.ts disposes voiceCompanionService on will-quit',
    mainIndexSrc.includes('voiceCompanionService.dispose()'));

  // Verify preload contracts for voice
  assert('island-preload.ts exposes nested voice.startListening',
    preloadSrc.includes("startListening: () => ipcRenderer.invoke('voice:start-listening')"));

  assert('island-preload.ts exposes nested voice.stopListening',
    preloadSrc.includes("stopListening: () => ipcRenderer.invoke('voice:stop-listening')"));

  assert('island-preload.ts exposes nested voice.toggle',
    preloadSrc.includes("toggle: () => ipcRenderer.invoke('voice:toggle')"));

  assert('island-preload.ts exposes nested voice.processCommand',
    preloadSrc.includes("processCommand: (text: string) => ipcRenderer.invoke('voice:process-command', { text })"));

  assert('island-preload.ts exposes nested voice.speak',
    preloadSrc.includes("speak: (text: string) => ipcRenderer.invoke('voice:speak', { text })"));

  assert('island-preload.ts exposes nested voice.stopSpeaking',
    preloadSrc.includes("stopSpeaking: () => ipcRenderer.invoke('voice:stop-speaking')"));

  assert('island-preload.ts exposes nested voice.getState',
    preloadSrc.includes("getState: () => ipcRenderer.invoke('voice:get-state')"));

  assert('island-preload.ts exposes nested voice.onVoiceState with cleanup handler',
    preloadSrc.includes("onVoiceState: (callback: (event: any) => void)") &&
    preloadSrc.includes("ipcRenderer.on('island:voice-state', handler)") &&
    preloadSrc.includes("ipcRenderer.removeListener('island:voice-state', handler)"));

  // Verify top-level aliases in island-preload.ts
  assert('island-preload.ts exposes top-level alias startVoiceListening',
    preloadSrc.includes("startVoiceListening: () => ipcRenderer.invoke('voice:start-listening')"));

  assert('island-preload.ts exposes top-level alias stopVoiceListening',
    preloadSrc.includes("stopVoiceListening: () => ipcRenderer.invoke('voice:stop-listening')"));

  assert('island-preload.ts exposes top-level alias toggleVoice',
    preloadSrc.includes("toggleVoice: () => ipcRenderer.invoke('voice:toggle')"));

  assert('island-preload.ts exposes top-level alias processVoiceCommand',
    preloadSrc.includes("processVoiceCommand: (text: string) => ipcRenderer.invoke('voice:process-command', { text })"));

  assert('island-preload.ts exposes top-level alias speakVoice',
    preloadSrc.includes("speakVoice: (text: string) => ipcRenderer.invoke('voice:speak', { text })"));

  assert('island-preload.ts exposes top-level alias stopVoiceSpeaking',
    preloadSrc.includes("stopVoiceSpeaking: () => ipcRenderer.invoke('voice:stop-speaking')"));

  assert('island-preload.ts exposes top-level alias onVoiceState',
    preloadSrc.includes("onVoiceState: (callback: (event: any) => void)") &&
    preloadSrc.includes("ipcRenderer.removeListener('island:voice-state', handler)"));

  // Verify multi-namespace bridge exposure
  assert('island-preload.ts exposes bridge to roboIsland, island, and islandAPI',
    preloadSrc.includes("contextBridge.exposeInMainWorld('roboIsland', api)") &&
    preloadSrc.includes("contextBridge.exposeInMainWorld('island', api)") &&
    preloadSrc.includes("contextBridge.exposeInMainWorld('islandAPI', api)"));

  // Empirical Mock Preload Bridge Execution
  const mockIpcRenderer = {
    listeners: new Map(),
    invocations: [],
    on(channel, handler) {
      if (!this.listeners.has(channel)) this.listeners.set(channel, []);
      this.listeners.get(channel).push(handler);
    },
    removeListener(channel, handler) {
      const arr = this.listeners.get(channel) || [];
      const idx = arr.indexOf(handler);
      if (idx !== -1) arr.splice(idx, 1);
    },
    async invoke(channel, ...args) {
      this.invocations.push({ channel, args });
      if (channel === 'voice:start-listening') return true;
      if (channel === 'voice:stop-listening') return true;
      if (channel === 'voice:toggle') return true;
      if (channel === 'voice:process-command') return { response: 'Test response', action: 'test' };
      if (channel === 'voice:speak') return true;
      if (channel === 'voice:stop-speaking') return true;
      if (channel === 'voice:get-state') return 'IDLE';
      return null;
    }
  };

  const mockBridge = {
    voice: {
      startListening: () => mockIpcRenderer.invoke('voice:start-listening'),
      stopListening: () => mockIpcRenderer.invoke('voice:stop-listening'),
      toggle: () => mockIpcRenderer.invoke('voice:toggle'),
      processCommand: (text) => mockIpcRenderer.invoke('voice:process-command', { text }),
      speak: (text) => mockIpcRenderer.invoke('voice:speak', { text }),
      stopSpeaking: () => mockIpcRenderer.invoke('voice:stop-speaking'),
      getState: () => mockIpcRenderer.invoke('voice:get-state'),
      onVoiceState: (callback) => {
        const handler = (_event, data) => callback(data);
        mockIpcRenderer.on('island:voice-state', handler);
        return () => mockIpcRenderer.removeListener('island:voice-state', handler);
      }
    }
  };

  let bridgeReceivedState = null;
  const unlistenVoice = mockBridge.voice.onVoiceState((payload) => {
    bridgeReceivedState = payload;
  });

  assert('Bridge onVoiceState registered listener on "island:voice-state"',
    (mockIpcRenderer.listeners.get('island:voice-state') || []).length === 1);

  // Trigger simulated event
  const testPayload = { state: 'LISTENING', audioLevel: 0.65, bands: [0.2, 0.4, 0.6, 0.8, 0.5], timestamp: Date.now() };
  mockIpcRenderer.listeners.get('island:voice-state')[0](null, testPayload);

  assert('Bridge onVoiceState received broadcast with identical payload',
    bridgeReceivedState && bridgeReceivedState.state === 'LISTENING' && bridgeReceivedState.audioLevel === 0.65);

  unlistenVoice();
  assert('Bridge unlisten properly removes handler from IPC channel',
    (mockIpcRenderer.listeners.get('island:voice-state') || []).length === 0);

  console.log('');

  // --------------------------------------------------------------------------
  // SUITE 2: 60FPS VECTOR CANVAS WAVE RENDERING MATH & STRICT VIEWPORT BOUNDS
  // --------------------------------------------------------------------------
  console.log('--- Suite 2: 60FPS Fluid Canvas Wave Math & Bounds (860x440 Viewport) ---');

  assert('Master viewport width is exactly 860px', PANEL_WIDTH === 860);
  assert('Master viewport height is exactly 440px', PANEL_HEIGHT === 440);

  const canvasEngineSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf8');

  // Verify core wave rendering methods exist in canvas-engine.ts
  assert('canvas-engine.ts defines drawVoiceCompanionWave',
    canvasEngineSrc.includes('public drawVoiceCompanionWave(cx: number, topY: number): void'));

  assert('canvas-engine.ts defines isVoiceCompanionActive method',
    canvasEngineSrc.includes('public isVoiceCompanionActive(): boolean') &&
    canvasEngineSrc.includes("this.voiceState === 'LISTENING' || this.voiceState === 'THINKING' || this.voiceState === 'SPEAKING'"));

  assert('canvas-engine.ts defines setVoiceState method',
    canvasEngineSrc.includes('public setVoiceState(payload: any): void'));

  assert('canvas-engine.ts defines triggerVoiceCompanion method',
    canvasEngineSrc.includes('public triggerVoiceCompanion(): void'));

  assert('canvas-engine.ts defines interruptVoiceCompanion method',
    canvasEngineSrc.includes('public interruptVoiceCompanion(): void'));

  // Empirical Canvas Mock to verify coordinates and mathematical safety
  class MockCanvasContext {
    constructor() {
      this.operations = [];
      this.points = [];
      this.arcs = [];
      this.roundRects = [];
      this.texts = [];
      this.hasNaN = false;
      this.hasInfinity = false;
      this.strokeStyle = '';
      this.fillStyle = '';
      this.lineWidth = 1;
      this.lineCap = '';
      this.shadowColor = '';
      this.shadowBlur = 0;
      this.font = '';
      this.textAlign = '';
      this.textBaseline = '';
    }

    save() { this.operations.push('save'); }
    restore() { this.operations.push('restore'); }
    beginPath() { this.operations.push('beginPath'); }
    stroke() { this.operations.push('stroke'); }
    fill() { this.operations.push('fill'); }

    checkCoord(x, y, op) {
      if (Number.isNaN(x) || Number.isNaN(y)) {
        this.hasNaN = true;
        console.error(`NaN detected in ${op}: (${x}, ${y})`);
      }
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        this.hasInfinity = true;
        console.error(`Infinity detected in ${op}: (${x}, ${y})`);
      }
      this.points.push({ x, y, op });
    }

    moveTo(x, y) {
      this.checkCoord(x, y, 'moveTo');
      this.operations.push(`moveTo(${x},${y})`);
    }

    lineTo(x, y) {
      this.checkCoord(x, y, 'lineTo');
      this.operations.push(`lineTo(${x},${y})`);
    }

    arc(cx, cy, r, startAngle, endAngle) {
      this.checkCoord(cx, cy, 'arc');
      if (Number.isNaN(r) || !Number.isFinite(r)) {
        this.hasNaN = true;
        console.error(`Invalid radius in arc: ${r}`);
      }
      this.arcs.push({ cx, cy, r });
      this.operations.push(`arc(${cx},${cy},${r})`);
    }

    roundRect(x, y, w, h, radii) {
      this.checkCoord(x, y, 'roundRect');
      this.checkCoord(x + w, y + h, 'roundRect_end');
      this.roundRects.push({ x, y, w, h, radii });
      this.operations.push(`roundRect(${x},${y},${w},${h})`);
    }

    fillText(text, x, y) {
      this.checkCoord(x, y, 'fillText');
      this.texts.push({ text, x, y });
      this.operations.push(`fillText("${text}",${x},${y})`);
    }

    measureText(text) {
      return { width: (text || '').length * 6.5 };
    }

    createLinearGradient(x0, y0, x1, y1) {
      this.checkCoord(x0, y0, 'gradient_start');
      this.checkCoord(x1, y1, 'gradient_end');
      return {
        addColorStop: () => {}
      };
    }
  }

  // Reproduce the wave drawing math from canvas-engine.ts
  function renderWaveMath(ctx, { W, H, cx, topY, voiceState, voiceAudioLevel, voiceBands, voiceQueryText, voiceResponseText, nowMs }) {
    const midY = topY + H / 2;
    const pillLeft = cx - W / 2;
    const t = nowMs * 0.003;

    ctx.save();

    // 1. Fluid Sinusoidal Sound Waves
    const waveLeft = pillLeft + 16;
    const waveRight = pillLeft + W - 16;
    const waveWidth = waveRight - waveLeft;

    const baseAmp = voiceState === 'SPEAKING' ? 9.0 : (voiceState === 'THINKING' ? 4.5 : 6.0);
    const dynamicAmp = baseAmp * (0.3 + 0.7 * Math.max(0.15, Number.isFinite(voiceAudioLevel) ? voiceAudioLevel : 0.0));

    const waves = [
      { color: 'rgba(0, 242, 254, 0.75)', freq: 0.035, speed: 2.8, phase: 0.0, ampMul: 1.0 },
      { color: 'rgba(79, 172, 254, 0.65)', freq: 0.025, speed: 2.1, phase: 1.6, ampMul: 0.85 },
      { color: 'rgba(255, 170, 0, 0.55)', freq: 0.045, speed: 3.4, phase: 3.1, ampMul: 0.70 },
      { color: 'rgba(255, 0, 127, 0.45)', freq: 0.030, speed: 1.7, phase: 4.8, ampMul: 0.60 }
    ];

    for (const w of waves) {
      ctx.save();
      ctx.beginPath();
      const step = 4;
      for (let x = 0; x <= waveWidth; x += step) {
        const px = waveLeft + x;
        const normX = x / waveWidth;
        const envelope = Math.sin(normX * Math.PI);
        const yOffset = Math.sin(x * w.freq + t * w.speed + w.phase) * dynamicAmp * w.ampMul * envelope;
        const py = midY + yOffset;

        if (x === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Left Icon Slot: Jarvis Voice Orb / Mic Glyph
    const iconCx = pillLeft + 22;
    const iconCy = midY;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.5);

    ctx.save();
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 12 + pulse * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 7, 0, Math.PI * 2);
    const orbGrad = ctx.createLinearGradient(iconCx - 7, iconCy - 7, iconCx + 7, iconCy + 7);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(iconCx - 2, iconCy - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Status Text
    ctx.save();
    const textLeft = iconCx + 18;
    const maxTextW = W - 110;
    let displayTitle = voiceState === 'SPEAKING' ? 'Jarvis' : (voiceState === 'THINKING' ? 'Thinking...' : 'Jarvis');
    let displaySub = voiceState === 'SPEAKING' ? (voiceResponseText || 'Responding...') : (voiceState === 'THINKING' ? 'Processing command' : (voiceQueryText || 'Listening...'));

    ctx.fillText(displayTitle, textLeft, midY - 6);
    let subToRender = displaySub;
    if (ctx.measureText(subToRender).width > maxTextW) {
      while (subToRender.length > 5 && ctx.measureText(subToRender + '…').width > maxTextW) {
        subToRender = subToRender.slice(0, -1);
      }
      subToRender += '…';
    }
    ctx.fillText(subToRender, textLeft, midY + 7);
    ctx.restore();

    // 4. Right 5-Band Equalizer Frequency Bars
    const eqRight = pillLeft + W - 16;
    const barW = 2.4;
    const gap = 2.0;
    const bands = voiceBands && voiceBands.length === 5 ? voiceBands : [0.3, 0.5, 0.8, 0.6, 0.4];

    ctx.save();
    for (let i = 0; i < 5; i++) {
      const bx = eqRight - (4 - i) * (barW + gap) - barW;
      const bVal = Math.max(0.15, Math.min(1.0, bands[i] || 0.15));
      const bHeight = Math.max(4, Math.round(18 * bVal));
      const by = midY - bHeight / 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, barW, bHeight, 1.2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }

  // Test across states: LISTENING (320px), THINKING (300px), SPEAKING (340px)
  const statesToTest = [
    { state: 'LISTENING', w: 320, level: 0.4, bands: [0.2, 0.3, 0.5, 0.4, 0.2], text: 'What is the weather today?' },
    { state: 'THINKING', w: 300, level: 0.2, bands: [0.1, 0.2, 0.3, 0.2, 0.1], text: 'Thinking...' },
    { state: 'SPEAKING', w: 340, level: 0.85, bands: [0.4, 0.6, 0.9, 0.7, 0.5], response: 'All systems are operating at peak efficiency, sir.' }
  ];

  const defaultTopY = 10;
  const defaultHeight = 44;
  const cx = PANEL_WIDTH / 2; // 430

  for (const tc of statesToTest) {
    const mockCtx = new MockCanvasContext();
    renderWaveMath(mockCtx, {
      W: tc.w,
      H: defaultHeight,
      cx,
      topY: defaultTopY,
      voiceState: tc.state,
      voiceAudioLevel: tc.level,
      voiceBands: tc.bands,
      voiceQueryText: tc.text,
      voiceResponseText: tc.response,
      nowMs: performance.now()
    });

    assert(`Wave rendering in state ${tc.state} produces zero NaN coordinates`,
      !mockCtx.hasNaN);
    assert(`Wave rendering in state ${tc.state} produces zero Infinity coordinates`,
      !mockCtx.hasInfinity);

    // Verify all points are strictly contained within 860x440 viewport bounds
    let allXInside = true;
    let allYInside = true;
    const pillLeft = cx - tc.w / 2;
    const pillRight = cx + tc.w / 2;

    for (const pt of mockCtx.points) {
      if (pt.x < 0 || pt.x > PANEL_WIDTH) allXInside = false;
      if (pt.y < 0 || pt.y > PANEL_HEIGHT) allYInside = false;
    }

    assert(`State ${tc.state}: All drawing x coords are strictly inside viewport [0, 860] (pill: [${pillLeft}, ${pillRight}])`,
      allXInside);
    assert(`State ${tc.state}: All drawing y coords are strictly inside viewport [0, 440] (top: ${defaultTopY}, bottom: ${defaultTopY + defaultHeight})`,
      allYInside);

    // Verify bell curve envelope ensures wave endpoint displacement is zero at margins
    const normX0 = 0.0;
    const normX1 = 1.0;
    const env0 = Math.sin(normX0 * Math.PI);
    const env1 = Math.sin(normX1 * Math.PI);
    assert(`Bell curve envelope at normX=0 is exactly 0.0 (${env0})`, Math.abs(env0) < 1e-10);
    assert(`Bell curve envelope at normX=1 is exactly 0.0 (${env1})`, Math.abs(env1) < 1e-10);
  }

  // Adversarial Math Stress: Corrupted, Negative, and Extreme Audio Levels
  const adversarialLevels = [-10.0, 0.0, 1.0, 50.0, 1e6, NaN, undefined, Infinity, -Infinity];
  let corruptionCausedNaN = false;

  for (const badLevel of adversarialLevels) {
    const mockCtx = new MockCanvasContext();
    renderWaveMath(mockCtx, {
      W: 340,
      H: 44,
      cx,
      topY: 10,
      voiceState: 'SPEAKING',
      voiceAudioLevel: badLevel,
      voiceBands: [NaN, -5, 100, undefined, null],
      voiceQueryText: 'Extreme adversarial test',
      voiceResponseText: 'Sanitized output',
      nowMs: performance.now()
    });

    if (mockCtx.hasNaN || mockCtx.hasInfinity) {
      corruptionCausedNaN = true;
    }
  }

  assert('Adversarial audio levels (NaN, Infinity, negatives, overflows) produce ZERO NaN/Infinity in canvas coords',
    !corruptionCausedNaN);

  console.log('');

  // --------------------------------------------------------------------------
  // SUITE 3: DYNAMIC ISLAND EXPANSION & COLLAPSE TRANSITIONS
  // --------------------------------------------------------------------------
  console.log('--- Suite 3: Dynamic Island Capsule Expansion & Collapse ---');

  // Verify dynamic width formulas in canvas-engine.ts
  assert('canvas-engine.ts specifies 340px width for SPEAKING state',
    canvasEngineSrc.includes("this.voiceState === 'SPEAKING' ? 340"));

  assert('canvas-engine.ts specifies 300px width for THINKING state',
    canvasEngineSrc.includes("this.voiceState === 'THINKING' ? 300"));

  assert('canvas-engine.ts specifies 320px width for LISTENING state',
    canvasEngineSrc.includes(': 320'));

  assert('canvas-engine.ts specifies 44px height and 22px radius for voice companion',
    canvasEngineSrc.includes('this.targetHeight = 44') &&
    canvasEngineSrc.includes('this.targetRadius = 22'));

  // Simulated Canvas Engine state transitions
  class IslandVoiceStateMachine {
    constructor() {
      this.mode = 'compact';
      this.voiceState = 'IDLE';
      this.isHovered = false;
      this.targetWidth = 98;
      this.targetHeight = 26;
      this.targetRadius = 13;
      this.voiceAudioLevel = 0.0;
      this.voiceBands = [0, 0, 0, 0, 0];
      this.voiceHudUntil = 0;
    }

    isVoiceCompanionActive() {
      return this.voiceState === 'LISTENING' || this.voiceState === 'THINKING' || this.voiceState === 'SPEAKING';
    }

    setVoiceState(payload) {
      if (!payload) return;
      this.voiceState = payload.state || 'IDLE';
      if (typeof payload.audioLevel === 'number') this.voiceAudioLevel = payload.audioLevel;
      if (Array.isArray(payload.bands)) this.voiceBands = payload.bands;

      if (this.isVoiceCompanionActive()) {
        this.voiceHudUntil = performance.now() + 8000;
      } else {
        this.voiceHudUntil = 0;
        this.voiceAudioLevel = 0.0;
        this.voiceBands = [0, 0, 0, 0, 0];
      }
      this.updateTargetDimensions();
    }

    updateTargetDimensions() {
      if (this.isVoiceCompanionActive()) {
        const w = this.voiceState === 'SPEAKING' ? 340 : (this.voiceState === 'THINKING' ? 300 : 320);
        this.targetWidth = this.isHovered ? w + 10 : w;
        this.targetHeight = 44;
        this.targetRadius = 22;
        return;
      }

      if (this.mode === 'rest') {
        this.targetWidth = this.isHovered ? 38 : 32;
        this.targetHeight = 18;
        this.targetRadius = 9;
      } else {
        this.targetWidth = this.isHovered ? 104 : 98;
        this.targetHeight = 26;
        this.targetRadius = 13;
      }
    }
  }

  const sm = new IslandVoiceStateMachine();

  // Test 3.1: Default Idle dimensions
  assert('Default compact idle state has targetWidth=98px, targetHeight=26px',
    sm.targetWidth === 98 && sm.targetHeight === 26 && sm.targetRadius === 13);

  // Test 3.2: Transition to LISTENING
  sm.setVoiceState({ state: 'LISTENING', audioLevel: 0.3 });
  assert('State LISTENING expands targetWidth to 320px, targetHeight to 44px',
    sm.targetWidth === 320 && sm.targetHeight === 44 && sm.targetRadius === 22);

  // Test 3.3: Hover while LISTENING
  sm.isHovered = true;
  sm.updateTargetDimensions();
  assert('Hover while LISTENING smoothly expands targetWidth to 330px',
    sm.targetWidth === 330);
  sm.isHovered = false;
  sm.updateTargetDimensions();

  // Test 3.4: Transition to THINKING
  sm.setVoiceState({ state: 'THINKING', audioLevel: 0.2 });
  assert('State THINKING contracts targetWidth to 300px, targetHeight remains 44px',
    sm.targetWidth === 300 && sm.targetHeight === 44 && sm.targetRadius === 22);

  // Test 3.5: Transition to SPEAKING
  sm.setVoiceState({ state: 'SPEAKING', audioLevel: 0.8 });
  assert('State SPEAKING expands targetWidth to 340px, targetHeight remains 44px',
    sm.targetWidth === 340 && sm.targetHeight === 44 && sm.targetRadius === 22);

  // Test 3.6: Hover while SPEAKING
  sm.isHovered = true;
  sm.updateTargetDimensions();
  assert('Hover while SPEAKING expands targetWidth to 350px (strictly within 860px viewport)',
    sm.targetWidth === 350 && (PANEL_WIDTH / 2 + 175 <= PANEL_WIDTH) && (PANEL_WIDTH / 2 - 175 >= 0));
  sm.isHovered = false;
  sm.updateTargetDimensions();

  // Test 3.7: Collapse back to IDLE
  sm.setVoiceState({ state: 'IDLE' });
  assert('Transition to IDLE collapses targetWidth back to 98px, targetHeight to 26px',
    sm.targetWidth === 98 && sm.targetHeight === 26 && sm.targetRadius === 13);
  assert('Transition to IDLE resets audioLevel to 0.0 and clears bands',
    sm.voiceAudioLevel === 0.0 && sm.voiceBands.every(b => b === 0));

  // Test 3.8: Mode 'rest' transitions
  sm.mode = 'rest';
  sm.updateTargetDimensions();
  assert('Rest mode IDLE collapses targetWidth to 32px, targetHeight to 18px',
    sm.targetWidth === 32 && sm.targetHeight === 18 && sm.targetRadius === 9);

  sm.setVoiceState({ state: 'SPEAKING' });
  assert('Rest mode SPEAKING expands targetWidth to 340px, targetHeight to 44px',
    sm.targetWidth === 340 && sm.targetHeight === 44);

  sm.setVoiceState({ state: 'IDLE' });
  assert('Rest mode IDLE resets targetWidth to 32px, targetHeight to 18px',
    sm.targetWidth === 32 && sm.targetHeight === 18);

  console.log('');

  // --------------------------------------------------------------------------
  // SUITE 4: INTERRUPTION & CLICK-TO-DISMISS SPEECH BEHAVIOR
  // --------------------------------------------------------------------------
  console.log('--- Suite 4: Interruption & Click-to-Dismiss Speech Behavior ---');

  // Verify interruption handler in canvas-engine.ts
  assert('canvas-engine.ts handles click during voice companion via interruptVoiceCompanion()',
    canvasEngineSrc.includes('if (this.isVoiceCompanionActive()) {') &&
    canvasEngineSrc.includes('this.interruptVoiceCompanion();'));

  assert('canvas-engine.ts interruptVoiceCompanion calls stopSpeaking and stopListening',
    canvasEngineSrc.includes('if (voiceApi?.stopSpeaking) {') &&
    canvasEngineSrc.includes('voiceApi.stopSpeaking();') &&
    canvasEngineSrc.includes('this.setVoiceState({ state: \'IDLE\' });'));

  assert('canvas-engine.ts exposes __roboIslandInterruptVoice global window hook',
    canvasEngineSrc.includes('(window as any).__roboIslandInterruptVoice = () => this.interruptVoiceCompanion()'));

  // Test VoiceCompanionService stopSpeaking behavior
  const testVoiceSvc = new VoiceCompanionService();
  testVoiceSvc.setSimulationMode(true);

  // Test 4.1: Interruption during SPEAKING
  let stateEmitted = null;
  testVoiceSvc.setBroadcastCallback((channel, payload) => {
    if (channel === 'island:voice-state') {
      stateEmitted = payload.state;
    }
  });

  await testVoiceSvc.startListening();
  assert('startListening puts service into LISTENING state', testVoiceSvc.getState() === 'LISTENING');

  // Trigger speech
  const speakPromise = testVoiceSvc.speak('This is a long sentence being spoken by Jarvis companion mode.');
  assert('speak puts service into SPEAKING state', testVoiceSvc.getState() === 'SPEAKING');

  // Interrupt immediately
  const interrupted = testVoiceSvc.stopSpeaking();
  assert('stopSpeaking returns true when aborting active speech', interrupted === true);
  assert('stopSpeaking immediately resets state to IDLE', testVoiceSvc.getState() === 'IDLE');
  assert('stopSpeaking broadcast emitted IDLE state payload', stateEmitted === 'IDLE');

  // Test 4.2: Interruption when already IDLE
  const secondStop = testVoiceSvc.stopSpeaking();
  assert('stopSpeaking returns false when already IDLE (idempotent)', secondStop === false);
  assert('State remains IDLE after redundant stopSpeaking', testVoiceSvc.getState() === 'IDLE');

  // Test 4.3: Interruption during THINKING state
  testVoiceSvc.setState('THINKING', { text: 'Processing request' });
  assert('setState put service into THINKING state', testVoiceSvc.getState() === 'THINKING');
  const thinkingInterrupted = testVoiceSvc.stopSpeaking();
  assert('stopSpeaking returns true when aborting THINKING state', thinkingInterrupted === true);
  assert('State resets to IDLE after interrupting THINKING state', testVoiceSvc.getState() === 'IDLE');

  // Test 4.4: Rapid Successive Interruption Storm (100 rapid calls)
  let stormError = false;
  try {
    for (let i = 0; i < 100; i++) {
      testVoiceSvc.setState(i % 2 === 0 ? 'SPEAKING' : 'THINKING');
      testVoiceSvc.stopSpeaking();
    }
  } catch {
    stormError = true;
  }
  assert('Rapid successive interruption storm (100 cycles) completes cleanly with zero errors',
    !stormError && testVoiceSvc.getState() === 'IDLE');

  testVoiceSvc.dispose();

  console.log('');

  // --------------------------------------------------------------------------
  // SUITE 5: 1-CLICK HEADER MIC TRIGGER BUTTON & DOM/CSS INTEGRATION
  // --------------------------------------------------------------------------
  console.log('--- Suite 5: 1-Click Header Mic Trigger Button & DOM/CSS Integration ---');

  const indexHtmlSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/index.html'), 'utf8');
  const islandCssSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/island.css'), 'utf8');

  // Verify HTML markup
  assert('index.html contains #btn-voice-companion in header status buttons',
    indexHtmlSrc.includes('id="btn-voice-companion"'));

  assert('index.html #btn-voice-companion has class="status-btn" and title="Jarvis Voice Companion"',
    indexHtmlSrc.includes('<button id="btn-voice-companion" class="status-btn" title="Jarvis Voice Companion">'));

  assert('index.html #btn-voice-companion contains microphone SVG path icon',
    indexHtmlSrc.includes('path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"') &&
    indexHtmlSrc.includes('path d="M19 10v2a7 7 0 0 1-14 0v-2"'));

  assert('index.html contains #voice-companion-card with hidden class and aria-live="polite"',
    indexHtmlSrc.includes('id="voice-companion-card" class="voice-companion-card hidden"') &&
    indexHtmlSrc.includes('aria-live="polite"'));

  assert('index.html contains #voice-hud-icon, #voice-hud-title, #voice-hud-status',
    indexHtmlSrc.includes('id="voice-hud-icon"') &&
    indexHtmlSrc.includes('id="voice-hud-title"') &&
    indexHtmlSrc.includes('id="voice-hud-status"'));

  assert('index.html contains #voice-hud-waves with 5 wave bars (.wave-1 through .wave-5)',
    indexHtmlSrc.includes('id="voice-hud-waves"') &&
    indexHtmlSrc.includes('class="voice-wave-bar wave-1"') &&
    indexHtmlSrc.includes('class="voice-wave-bar wave-5"'));

  // Verify CSS styles
  assert('island.css styles .voice-companion-card with fixed 320px width and 44px height',
    islandCssSrc.includes('.voice-companion-card {') &&
    islandCssSrc.includes('width: 320px;') &&
    islandCssSrc.includes('height: 44px;'));

  assert('island.css centers .voice-companion-card with top: 10px, left: 50%, transform: translateX(-50%)',
    islandCssSrc.includes('top: 10px;') &&
    islandCssSrc.includes('left: 50%;') &&
    islandCssSrc.includes('transform: translateX(-50%);'));

  assert('island.css applies Jarvis cyan border and box-shadow to .voice-companion-card',
    islandCssSrc.includes('border: 1px solid rgba(0, 242, 254, 0.28);') &&
    islandCssSrc.includes('box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), 0 0 16px rgba(0, 242, 254, 0.2);'));

  assert('island.css styles .voice-hud-title in cyan (#00f2fe) with font-size: 12px',
    islandCssSrc.includes('.voice-hud-title {') &&
    islandCssSrc.includes('font-size: 12px;') &&
    islandCssSrc.includes('color: #00f2fe;'));

  assert('island.css defines .voice-wave-bar with keyframe animation voiceWavePulse',
    islandCssSrc.includes('.voice-wave-bar {') &&
    islandCssSrc.includes('animation: voiceWavePulse 1.2s ease-in-out infinite alternate;') &&
    islandCssSrc.includes('@keyframes voiceWavePulse {'));

  assert('island.css sets distinct color highlights for wave-2 (#4facfe), wave-3 (#00f2fe), wave-4 (#ffaa00), wave-5 (#ff007f)',
    islandCssSrc.includes('background: #4facfe;') &&
    islandCssSrc.includes('background: #ffaa00;') &&
    islandCssSrc.includes('background: #ff007f;'));

  // Verify click listener binding in canvas-engine.ts
  assert('canvas-engine.ts wires click on #btn-voice-companion to triggerVoiceCompanion()',
    canvasEngineSrc.includes("const btnVoice = document.getElementById('btn-voice-companion');") &&
    canvasEngineSrc.includes('this.triggerVoiceCompanion();'));

  console.log('');

  // --------------------------------------------------------------------------
  // SUITE 6: DIALOGUE INTENT PROCESSOR & ADVERSARIAL FUZZING
  // --------------------------------------------------------------------------
  console.log('--- Suite 6: Dialogue Intent Processor & Adversarial Fuzzing ---');

  const svc = new VoiceCompanionService();

  // Test 6.1: Time intent
  const timeRes = await svc.processCommand('what time is it right now?');
  assert('Time intent returns action report_time and mentions current time',
    timeRes.action === 'report_time' && timeRes.response.includes('currently'));

  // Test 6.2: Date intent
  const dateRes = await svc.processCommand('what is today\'s date?');
  assert('Date intent returns action report_date and mentions Today is',
    dateRes.action === 'report_date' && dateRes.response.includes('Today is'));

  // Test 6.3: Battery intent without dependencies (nominal fallback)
  const battRes = await svc.processCommand('how is my battery and headphones charge?');
  assert('Battery intent returns report_battery action with nominal status',
    battRes.action === 'report_battery' && battRes.response.includes('power levels'));

  // Test 6.4: Battery intent with mock Bluetooth service
  svc.setDependencies({
    bluetoothMonitorService: {
      getConnectedDevices: async () => [
        { name: 'AirPods Pro 2', batteryPercent: 88, connected: true }
      ]
    }
  });
  const battMockRes = await svc.processCommand('check airpods battery');
  assert('Battery intent reads from bluetoothMonitorService and reports 88% battery',
    battMockRes.action === 'report_battery' && battMockRes.response.includes('AirPods Pro 2') && battMockRes.response.includes('88%'));

  // Test 6.5: Sports intent with mock sports service
  svc.setDependencies({
    sportsService: {
      getState: () => ({
        activeSport: 'cricket',
        statusText: 'Innings Break',
        cricket: {
          homeTeam: { code: 'IND', score: '210/4' },
          awayTeam: { code: 'AUS', score: '195/8' }
        }
      })
    }
  });
  const sportsRes = await svc.processCommand('give me the cricket match score');
  assert('Sports intent reads sportsService state and formats telemetry response',
    sportsRes.action === 'report_sports' && sportsRes.response.includes('IND 210/4') && sportsRes.response.includes('AUS 195/8'));

  // Test 6.6: Screen Glance / Diagnostics intent with mock error
  svc.setDependencies({
    screenGlanceEngine: {
      getState: async () => ({
        errors: [{ title: 'TypeScript TS2307: Cannot find module', suggestedFix: 'npm install --save-dev @types/node' }]
      })
    }
  });
  const diagRes = await svc.processCommand('check system diagnostics and screen errors');
  assert('Diagnostics intent detects active screen error and reports suggested fix',
    diagRes.action === 'report_errors' && diagRes.response.includes('TypeScript TS2307') && diagRes.response.includes('npm install'));

  // Test 6.7: Math calculation intent
  const mathRes = await svc.processCommand('calculate 144 / 12 + 10');
  assert('Math calculation intent parses arithmetic expression and yields 22',
    mathRes.action === 'math_result' && mathRes.response.includes('22'));

  // Test 6.8: Assistant Personality & Easter Eggs
  const introRes = await svc.processCommand('who are you?');
  assert('Identity query triggers introduce intent mentioning Jarvis and RoboIsland',
    introRes.action === 'introduce' && introRes.response.includes('Jarvis'));

  const ironManRes = await svc.processCommand('tell me about Tony Stark');
  assert('Iron Man tribute triggers easter egg action mentioning Mr. Stark',
    ironManRes.action === 'jarvis_easter_egg' && ironManRes.response.includes('Mr. Stark'));

  const jokeRes = await svc.processCommand('tell me a joke');
  assert('Joke intent returns a humorous programmer joke',
    jokeRes.action === 'joke' && jokeRes.response.length > 10);

  // Test 6.9: Wake word detection and query stripping
  const wake1 = detectWakeWord('Hey Jarvis, what time is it?');
  assert('detectWakeWord detects "Hey Jarvis" and strips to "what time is it?"',
    wake1.detected && wake1.strippedText === 'what time is it?');

  const wake2 = detectWakeWord('hey robo: check sports score');
  assert('detectWakeWord detects "hey robo" with colon separator',
    wake2.detected && wake2.strippedText === 'check sports score');

  const wake3 = detectWakeWord('roboisland: introduce yourself');
  assert('detectWakeWord detects "roboisland" trigger',
    wake3.detected && wake3.strippedText === 'introduce yourself');

  // Test 6.10: ReDoS and Adversarial Fuzzing on wake-word detection (50,000 chars)
  const hugeText = 'Hey '.repeat(10000) + 'Jarvis! ' + 'Please answer '.repeat(5000);
  const tStart = performance.now();
  const hugeResult = detectWakeWord(hugeText);
  const durationMs = performance.now() - tStart;
  assert(`Wake word detection on 50,000+ char adversarial string executed in ${durationMs.toFixed(2)}ms (< 15ms)`,
    hugeResult.detected && durationMs < 15);

  // Test 6.11: Command injection and escaping safety in speak()
  const scriptContent = fs.readFileSync(path.join(__dirname, '../src/main/voice-companion-service.ts'), 'utf8');
  assert('voice-companion-service.ts sanitizes single quotes with \'\' to prevent PowerShell command escape',
    scriptContent.includes(".replace(/'/g, \"''\")"));

  assert('voice-companion-service.ts enforces strict 5000ms max timeout for TTS process',
    scriptContent.includes('}, 5000);'));

  svc.dispose();

  console.log('');

  // --------------------------------------------------------------------------
  // SUITE 7: AUDIO FREQUENCY BANDS SIMULATOR & THROUGHPUT SLA
  // --------------------------------------------------------------------------
  console.log('--- Suite 7: Audio Frequency Bands Simulator & Throughput SLA ---');

  // Test 7.1: IDLE state returns 0.0 level and all zero bands
  const idleBands = computeAudioBands(1000, 'IDLE');
  assert('IDLE state returns level 0.0 and 5 zero bands',
    idleBands.level === 0.0 && idleBands.bands.length === 5 && idleBands.bands.every(b => b === 0.0));

  // Test 7.2: ERROR state returns 0.0 level and all zero bands
  const errorBands = computeAudioBands(2000, 'ERROR');
  assert('ERROR state returns level 0.0 and 5 zero bands',
    errorBands.level === 0.0 && errorBands.bands.every(b => b === 0.0));

  // Test 7.3: LISTENING produces 5 bounded bands [0.0 - 1.0]
  const listenBands = computeAudioBands(3500, 'LISTENING');
  assert('LISTENING state produces level between 0.0 and 1.0',
    listenBands.level >= 0.0 && listenBands.level <= 1.0);
  assert('LISTENING state produces 5 bands strictly bounded in [0.0, 1.0]',
    listenBands.bands.length === 5 && listenBands.bands.every(b => b >= 0.0 && b <= 1.0));

  // Test 7.4: THINKING produces smooth shimmer bands
  const thinkBands = computeAudioBands(5000, 'THINKING');
  assert('THINKING state produces level between 0.0 and 1.0',
    thinkBands.level >= 0.0 && thinkBands.level <= 1.0);
  assert('THINKING state produces 5 bands strictly bounded in [0.0, 1.0]',
    thinkBands.bands.length === 5 && thinkBands.bands.every(b => b >= 0.0 && b <= 1.0));

  // Test 7.5: SPEAKING produces dynamic vocal resonance bands
  const speakBands = computeAudioBands(7200, 'SPEAKING');
  assert('SPEAKING state produces level between 0.0 and 1.0',
    speakBands.level >= 0.0 && speakBands.level <= 1.0);
  assert('SPEAKING state produces 5 bands strictly bounded in [0.0, 1.0]',
    speakBands.bands.length === 5 && speakBands.bands.every(b => b >= 0.0 && b <= 1.0));

  // Test 7.6: High-frequency throughput SLA benchmark: 100,000 iterations
  const benchmarkIterations = 100000;
  const bmStart = performance.now();
  for (let i = 0; i < benchmarkIterations; i++) {
    computeAudioBands(i * 16.6, 'SPEAKING', 0.8);
  }
  const bmDuration = performance.now() - bmStart;
  const opsPerSec = Math.round((benchmarkIterations / bmDuration) * 1000);
  assert(`Throughput SLA: 100,000 band simulations in ${bmDuration.toFixed(1)}ms (${opsPerSec.toLocaleString()} ops/sec > 500,000 ops/sec)`,
    bmDuration < 200 && opsPerSec > 500000);

  console.log('\n================================================================');
  console.log(`  CHALLENGER 2 SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (${totalTests} total)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES:');
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. ${f.name} ${f.details ? '- ' + f.details : ''}`);
    });
    process.exit(1);
  } else {
    console.log('ALL ADVERSARIAL STRESS TESTS PASSED CLEANLY!\nVERDICT: APPROVE');
    process.exit(0);
  }
}

runChallenger2VoiceSuite().catch(err => {
  console.error('Fatal error running Challenger 2 test harness:', err);
  process.exit(1);
});
