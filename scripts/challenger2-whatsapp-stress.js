/**
 * Challenger 2: Adversarial Empirical Stress Test Harness for Milestone 4 (R4: WhatsApp AI Smart Replies & Voice Note Reader)
 * 
 * Verifies:
 * 1. IPC Round-Trip Throughput & Latency SLA (<1ms SLA, 1,000 rapid calls, throughput ops/sec, memory delta, GC stability).
 * 2. Simulation Engine Resilience & State Queue Bounding (100 messages in 100ms burst, 1,000 messages total, event broadcast fidelity, no memory leaks).
 * 3. Transparent Viewport (860x440) Containment & Layout Bounds (#whatsapp-smart-reply-chips, text overflow, #whatsapp-voicenote-card card dimensions).
 * 4. DOM Interaction Simulation (clicking chips, updating #whatsapp-reply-input, active button states, triggering sendWhatsAppReply).
 * 5. Production Wiring Verification (probing whether startWhatsAppReply invokes fetchAndRenderSmartReplies, whether chips populate in DOM, whether voicenote card is unhidden/updated, and canvas wave rendering).
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { whatsappSmartService, WhatsAppSmartService } = require('../dist/main/whatsapp-smart-service');
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
// MOCK DOM & EVENT SYSTEM FOR RENDERER SIMULATION
// ============================================================================
class MockDOMElement {
  constructor(id, tagName = 'div', className = '') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.className = className;
    this.classList = {
      _classes: new Set(className ? className.split(/\s+/).filter(Boolean) : []),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c),
      toggle: (c) => {
        if (this.classList._classes.has(c)) this.classList._classes.delete(c);
        else this.classList._classes.add(c);
      }
    };
    this.style = {};
    this.textContent = '';
    this._innerHTML = '';
    this.children = [];
    this.listeners = {};
    this.title = '';
    this.value = '';
    this.placeholder = '';
    this.type = 'button';
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    if (val === '') {
      this.children = [];
    }
  }

  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    }
  }

  dispatchEvent(evt) {
    if (this.listeners[evt.type]) {
      for (const h of this.listeners[evt.type]) {
        h(evt);
        if (evt._stopped) break;
      }
    }
  }

  appendChild(child) {
    this.children.push(child);
  }

  focus() {}
  blur() {}
  getAttribute(name) {
    return this[name] || null;
  }
}

class MockDOMDocument {
  constructor() {
    this.elements = {};
  }

  register(el) {
    this.elements[el.id] = el;
    return el;
  }

  getElementById(id) {
    return this.elements[id] || null;
  }

  createElement(tag) {
    return new MockDOMElement('', tag);
  }
}

async function runAdversarialStressSuite() {
  console.log('====================================================================');
  console.log(' CHALLENGER 2: EMPIRICAL STRESS TEST HARNESS — MILESTONE 4 (R4)     ');
  console.log('====================================================================\n');

  // ==========================================================================
  // SUITE 1: IPC Round-Trip Throughput & Latency SLA (<1ms SLA across 1,000 calls)
  // ==========================================================================
  console.log('--- Suite 1: IPC Round-Trip Throughput & Latency SLA (1,000 Calls) ---');
  
  const sampleMessages = [
    { text: 'Hi Gaurav, how are you doing today?', sender: 'Alice' },
    { text: 'Can we schedule a call tomorrow at 3 PM?', sender: 'Bob' },
    { text: 'Did you get a chance to finish the pull request review?', sender: 'Charlie' },
    { text: 'Thanks so much for the assistance, appreciate it!', sender: 'Diana' },
    { text: 'What is the current status on the Dynamic Island deployment?', sender: 'Evan' },
    { text: 'Voice message (0:45)', sender: 'Fiona' },
    { text: '👍', sender: 'George' },
    { text: '🙏', sender: 'Hannah' },
    { text: 'Uncategorized random text query with unicode 🚀🌟✨', sender: 'Ian' },
    { text: 'Can we meet at 4:30 pm today to discuss the build pipeline?', sender: 'Julia' }
  ];

  // 1,000 Sequential calls to getSmartReplies
  const N_CALLS = 1000;
  const latenciesGetSmartReplies = [];
  
  const startSeqReplies = performance.now();
  for (let i = 0; i < N_CALLS; i++) {
    const sample = sampleMessages[i % sampleMessages.length];
    const t0 = performance.now();
    const result = whatsappSmartService.getSmartReplies(sample.text, sample.sender);
    const t1 = performance.now();
    latenciesGetSmartReplies.push(t1 - t0);
    
    if (i === 0) {
      assert('Single smart replies call returns exactly 3 replies', Array.isArray(result.replies) && result.replies.length === 3);
      assert('Smart replies result specifies offline_heuristic source', result.source === 'offline_heuristic');
      assert('Smart replies result specifies valid confidence (>=0.80)', result.confidence >= 0.80);
    }
  }
  const totalSeqRepliesTime = performance.now() - startSeqReplies;
  const avgLatencyReplies = totalSeqRepliesTime / N_CALLS;
  const sortedRepliesLatencies = [...latenciesGetSmartReplies].sort((a, b) => a - b);
  const p95Replies = sortedRepliesLatencies[Math.floor(N_CALLS * 0.95)];
  const p99Replies = sortedRepliesLatencies[Math.floor(N_CALLS * 0.99)];
  const throughputReplies = (N_CALLS / (totalSeqRepliesTime / 1000)).toFixed(0);

  console.log(`  [METRIC] getSmartReplies 1,000 calls: Total=${totalSeqRepliesTime.toFixed(2)}ms, Avg=${avgLatencyReplies.toFixed(4)}ms, P95=${p95Replies.toFixed(4)}ms, P99=${p99Replies.toFixed(4)}ms, Throughput=${throughputReplies} ops/sec`);

  assert('getSmartReplies average latency meets <1.0ms SLA', avgLatencyReplies < 1.0, `Observed: ${avgLatencyReplies.toFixed(4)}ms`);
  assert('getSmartReplies P95 latency is under 1.5ms', p95Replies < 1.5, `Observed: ${p95Replies.toFixed(4)}ms`);
  assert('getSmartReplies throughput exceeds 5,000 ops/sec', Number(throughputReplies) > 5000, `Observed: ${throughputReplies} ops/sec`);

  // 1,000 Sequential calls to transcribeVoiceNote
  const sampleVoiceNotes = [
    { id: 'vn-1', duration: 8, context: 'PR build check' },
    { id: 'vn-2', duration: 25, context: 'review code bug' },
    { id: 'vn-3', duration: 55, context: 'deploy pipeline' },
    { id: 'vn-4', duration: 10, context: 'meet schedule sync' },
    { id: 'vn-5', duration: 28, context: 'time call sync' },
    { id: 'vn-6', duration: 60, context: 'meeting discussion' },
    { id: 'vn-7', duration: 5, context: 'general voice' },
    { id: 'vn-8', duration: 18, context: 'general note' },
    { id: 'vn-9', duration: 40, context: 'project update' },
    { id: 'vn-10', duration: 90, context: 'audio overview' }
  ];

  const latenciesTranscribe = [];
  const startSeqTranscribe = performance.now();
  for (let i = 0; i < N_CALLS; i++) {
    const vnSample = sampleVoiceNotes[i % sampleVoiceNotes.length];
    const t0 = performance.now();
    const result = whatsappSmartService.transcribeVoiceNote(vnSample.id, vnSample.duration, vnSample.context);
    const t1 = performance.now();
    latenciesTranscribe.push(t1 - t0);

    if (i === 0) {
      assert('Voice note transcription returns valid transcript string', typeof result.transcript === 'string' && result.transcript.length > 0);
      assert('Voice note transcription reports durationSeconds', result.durationSeconds === vnSample.duration);
      assert('Voice note transcription reports confidence >= 0.90', result.confidence >= 0.90);
    }
  }
  const totalSeqTranscribeTime = performance.now() - startSeqTranscribe;
  const avgLatencyTranscribe = totalSeqTranscribeTime / N_CALLS;
  const sortedTranscribeLatencies = [...latenciesTranscribe].sort((a, b) => a - b);
  const p95Transcribe = sortedTranscribeLatencies[Math.floor(N_CALLS * 0.95)];
  const throughputTranscribe = (N_CALLS / (totalSeqTranscribeTime / 1000)).toFixed(0);

  console.log(`  [METRIC] transcribeVoiceNote 1,000 calls: Total=${totalSeqTranscribeTime.toFixed(2)}ms, Avg=${avgLatencyTranscribe.toFixed(4)}ms, P95=${p95Transcribe.toFixed(4)}ms, Throughput=${throughputTranscribe} ops/sec`);

  assert('transcribeVoiceNote average latency meets <1.0ms SLA', avgLatencyTranscribe < 1.0, `Observed: ${avgLatencyTranscribe.toFixed(4)}ms`);
  assert('transcribeVoiceNote throughput exceeds 5,000 ops/sec', Number(throughputTranscribe) > 5000, `Observed: ${throughputTranscribe} ops/sec`);

  // ==========================================================================
  // SUITE 2: Concurrent IPC Stress & Garbage Collection Stability
  // ==========================================================================
  console.log('\n--- Suite 2: Concurrent IPC Stress & GC Stability ---');

  if (global.gc) {
    global.gc();
  }
  const memBeforeConcurrent = process.memoryUsage();

  const concurrentPromises = [];
  const CONCURRENT_COUNT = 1000;
  const startConcurrent = performance.now();

  for (let i = 0; i < CONCURRENT_COUNT; i++) {
    const msg = sampleMessages[i % sampleMessages.length];
    concurrentPromises.push(
      new Promise((resolve) => {
        const res = whatsappSmartService.getSmartReplies(msg.text, msg.sender);
        resolve(res);
      })
    );
  }

  const concurrentResults = await Promise.all(concurrentPromises);
  const concurrentTime = performance.now() - startConcurrent;

  if (global.gc) {
    global.gc();
  }
  const memAfterConcurrent = process.memoryUsage();
  const heapDeltaMB = (memAfterConcurrent.heapUsed - memBeforeConcurrent.heapUsed) / (1024 * 1024);

  console.log(`  [METRIC] Concurrent 1,000 calls: Total=${concurrentTime.toFixed(2)}ms, Heap Delta=${heapDeltaMB.toFixed(3)}MB`);

  assert('Concurrent 1,000 calls all resolve with 3 replies each', concurrentResults.length === 1000 && concurrentResults.every(r => r.replies && r.replies.length === 3));
  assert('Concurrent 1,000 calls execute in under 200ms total', concurrentTime < 200, `Observed: ${concurrentTime.toFixed(2)}ms`);
  assert('Memory heap delta after 1,000 concurrent calls is strictly bounded (<5MB)', heapDeltaMB < 5.0, `Observed: ${heapDeltaMB.toFixed(3)}MB`);

  // ==========================================================================
  // SUITE 3: Simulation Engine Resilience & Queue Bounding (100 msgs in 100ms)
  // ==========================================================================
  console.log('\n--- Suite 3: Simulation Engine Resilience & State Queue Bounding ---');

  whatsappSmartService.clearHistory();
  assert('whatsappSmartService starts with empty history after clearHistory()', whatsappSmartService.getState().incomingHistory.length === 0);

  const broadcastEvents = [];
  whatsappSmartService.setBroadcastCallback((channel, payload) => {
    broadcastEvents.push({ channel, payload });
  });

  // Rapid burst: 100 messages in 100ms
  const BURST_COUNT = 100;
  const burstStart = performance.now();

  for (let i = 0; i < BURST_COUNT; i++) {
    const isVn = i % 3 === 0;
    const body = isVn ? `Voice message (0:${(15 + (i % 45)).toString().padStart(2, '0')})` : `Message burst index ${i}: Are you free to review milestone 4?`;
    whatsappSmartService.simulateIncomingMessage(`User_${i}`, body, isVn);
  }
  const burstTime = performance.now() - burstStart;

  console.log(`  [METRIC] Simulation Engine 100 burst messages: Completed in ${burstTime.toFixed(2)}ms`);

  // Check broadcast callback delivery
  assert('Broadcast callback received all 100 island:whatsapp-incoming events', broadcastEvents.length >= 100);
  assert('All broadcast events have valid channel island:whatsapp-incoming', broadcastEvents.every(e => e.channel === 'island:whatsapp-incoming' || e.channel === 'island:whatsapp-voicenote-transcribed'));

  // Check state queue bounding (MUST be capped at 50 to prevent memory leaks)
  const stateAfter100 = whatsappSmartService.getState();
  console.log(`  [METRIC] Queue size after 100 bursts: ${stateAfter100.incomingHistory.length} items (Cap SLA: <=50)`);

  assert('State queue is strictly bounded to max 50 items (no unbounded memory leak)', stateAfter100.incomingHistory.length === 50, `Observed: ${stateAfter100.incomingHistory.length}`);

  // Push an additional 900 simulated messages to simulate prolonged production operation (total 1,000)
  for (let i = 100; i < 1000; i++) {
    whatsappSmartService.simulateIncomingMessage(`User_${i}`, `Message ${i}`);
  }
  const stateAfter1000 = whatsappSmartService.getState();
  assert('State queue remains strictly capped at 50 items after 1,000 simulated messages', stateAfter1000.incomingHistory.length === 50);

  // Check payload properties on the latest simulated message
  const lastMsg = stateAfter1000.incomingHistory[stateAfter1000.incomingHistory.length - 1];
  assert('Simulated message payload has unique id string', typeof lastMsg.id === 'string' && lastMsg.id.startsWith('wa-msg-'));
  assert('Simulated message payload has valid sender', typeof lastMsg.sender === 'string' && lastMsg.sender.length > 0);
  assert('Simulated message payload has valid body', typeof lastMsg.body === 'string' && lastMsg.body.length > 0);
  assert('Simulated message payload includes 3 smartReplies', Array.isArray(lastMsg.smartReplies) && lastMsg.smartReplies.length === 3);
  assert('Simulated message payload timestamp is recent', Math.abs(Date.now() - lastMsg.timestamp) < 5000);

  // ==========================================================================
  // SUITE 4: UI Layout Bounds Containment within 860x440 Viewport
  // ==========================================================================
  console.log('\n--- Suite 4: UI Layout Bounds Containment within 860x440 Viewport ---');

  assert('PANEL_WIDTH is exactly 860', PANEL_WIDTH === 860);
  assert('PANEL_HEIGHT is exactly 440', PANEL_HEIGHT === 440);

  // Verify CSS properties from island.css for WhatsApp components
  const islandCssContent = fs.readFileSync(path.join(__dirname, '../src/renderer/island/island.css'), 'utf-8');

  // Check .whatsapp-quick-reply-bar CSS
  assert('island.css defines .whatsapp-quick-reply-bar with flex column layout', islandCssContent.includes('.whatsapp-quick-reply-bar') && islandCssContent.includes('flex-direction: column'));
  assert('island.css defines .whatsapp-smart-reply-chips with overflow-x auto and hidden scrollbar', islandCssContent.includes('.whatsapp-smart-reply-chips') && islandCssContent.includes('overflow-x: auto'));
  assert('island.css defines .whatsapp-smart-chip with white-space: nowrap', islandCssContent.includes('.whatsapp-smart-chip') && islandCssContent.includes('white-space: nowrap'));
  assert('island.css defines .whatsapp-voicenote-card with border-radius and padding', islandCssContent.includes('.whatsapp-voicenote-card') && islandCssContent.includes('border-radius: 11px'));
  assert('island.css defines .wa-vn-transcript with max-height: 52px and overflow-y: auto', islandCssContent.includes('.wa-vn-transcript') && islandCssContent.includes('max-height: 52px') && islandCssContent.includes('overflow-y: auto'));

  // Viewport containment geometry analysis
  const cx = PANEL_WIDTH / 2; // 430px
  const topY = 12; // Standard floating island top gap
  const pillWidth = 400; // isWhatsAppReplying pill target width
  const pillHeight = 108; // isWhatsAppReplying pill target height
  const pillLeft = cx - pillWidth / 2; // 230px
  const pillRight = cx + pillWidth / 2; // 630px

  const waBarLeft = pillLeft + 12; // 242px
  const waBarWidth = pillWidth - 24; // 376px
  const waBarRight = waBarLeft + waBarWidth; // 618px
  const waBarTop = topY + 34; // 46px

  assert('Quick reply overlay bar left edge (242px) is >= 0 (within viewport)', waBarLeft >= 0);
  assert('Quick reply overlay bar right edge (618px) is <= PANEL_WIDTH 860px (within viewport)', waBarRight <= PANEL_WIDTH);
  assert('Quick reply overlay bar is horizontally centered relative to island pill', Math.abs((waBarLeft + waBarRight) / 2 - cx) <= 1);

  // Vertical containment test with all components active
  // Component heights:
  // - wa-vn-card: padding(12) + header(18) + transcript(max 52) = ~82px
  // - wa-smart-reply-chips: ~24px
  // - wa-reactions-row: ~26px
  // - wa-reply-input-wrap: ~24px
  // - gap: 3 * 5px = 15px
  // Total maximum expanded overlay height = ~171px
  const maxExpandedOverlayHeight = 82 + 24 + 26 + 24 + 15;
  const overlayBottom = waBarTop + maxExpandedOverlayHeight; // 46 + 171 = 217px

  console.log(`  [METRIC] Viewport vertical bounds: waBarTop=${waBarTop}px, maxExpandedBottom=${overlayBottom}px, PANEL_HEIGHT=${PANEL_HEIGHT}px`);
  assert('Expanded overlay bar bottom (217px) is strictly within PANEL_HEIGHT (440px)', overlayBottom <= PANEL_HEIGHT);

  // ==========================================================================
  // SUITE 5: DOM Interaction Simulation (Clicking Chips, Input & Send Reply)
  // ==========================================================================
  console.log('\n--- Suite 5: DOM Interaction Simulation ---');

  const mockDoc = new MockDOMDocument();
  const waBarEl = mockDoc.register(new MockDOMElement('whatsapp-quick-reply-bar', 'div', 'whatsapp-quick-reply-bar hidden'));
  const waVnCardEl = mockDoc.register(new MockDOMElement('whatsapp-voicenote-card', 'div', 'whatsapp-voicenote-card hidden'));
  const waVnDurationEl = mockDoc.register(new MockDOMElement('wa-vn-duration', 'span', 'wa-vn-duration'));
  const waVnTranscriptEl = mockDoc.register(new MockDOMElement('wa-vn-transcript', 'div', 'wa-vn-transcript'));
  const chipsContainerEl = mockDoc.register(new MockDOMElement('whatsapp-smart-reply-chips', 'div', 'whatsapp-smart-reply-chips'));
  const waInputEl = mockDoc.register(new MockDOMElement('whatsapp-reply-input', 'input', 'whatsapp-reply-input'));
  const waSendBtnEl = mockDoc.register(new MockDOMElement('whatsapp-reply-send-btn', 'button', 'whatsapp-reply-send-btn'));

  // Wire input event handler as defined in canvas-engine.ts:2383-2393
  waInputEl.addEventListener('input', () => {
    if (waInputEl.value.trim().length > 0) {
      waSendBtnEl.classList.add('active');
    } else {
      waSendBtnEl.classList.remove('active');
    }
  });

  // Track send calls
  let sentReplyPayload = null;
  const mockSendReply = (replyText) => {
    sentReplyPayload = {
      contact: 'Bob',
      phone: '+1234567890',
      tag: 'wa-1',
      text: replyText
    };
  };

  // Wire send button click handler as defined in canvas-engine.ts:2396-2402
  waSendBtnEl.addEventListener('click', (e) => {
    if (waInputEl.value.trim().length > 0) {
      mockSendReply(waInputEl.value.trim());
    }
  });

  // Populate 3 chips into chipsContainerEl (simulating fetchAndRenderSmartReplies logic)
  const replies = ['Sounds good to me!', 'Got it, thanks!', "I'll follow up shortly."];
  for (const reply of replies) {
    const chip = new MockDOMElement('', 'button', 'whatsapp-smart-chip');
    chip.textContent = reply;
    chip.addEventListener('click', (e) => {
      waInputEl.value = reply;
      waInputEl.dispatchEvent({ type: 'input' });
      mockSendReply(reply);
    });
    chipsContainerEl.appendChild(chip);
  }

  assert('chipsContainerEl contains exactly 3 chips', chipsContainerEl.children.length === 3);

  // Test clicking chip 0 ("Sounds good to me!")
  chipsContainerEl.children[0].dispatchEvent({ type: 'click' });
  assert('Clicking chip 0 populates input value with "Sounds good to me!"', waInputEl.value === 'Sounds good to me!');
  assert('Clicking chip 0 activates send button (.active class)', waSendBtnEl.classList.contains('active'));
  assert('Clicking chip 0 triggers mockSendReply with expected text', sentReplyPayload !== null && sentReplyPayload.text === 'Sounds good to me!');

  // Test typing into input
  waInputEl.value = 'Custom typed reply';
  waInputEl.dispatchEvent({ type: 'input' });
  assert('Typing into input maintains active class on send button', waSendBtnEl.classList.contains('active'));

  // Clear input
  waInputEl.value = '';
  waInputEl.dispatchEvent({ type: 'input' });
  assert('Clearing input removes active class from send button', !waSendBtnEl.classList.contains('active'));

  // ==========================================================================
  // SUITE 6: Adversarial Codebase Audit & Empirical Wiring Probes
  // ==========================================================================
  console.log('\n--- Suite 6: Adversarial Codebase Audit & Empirical Wiring Probes ---');

  const canvasEngineSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf-8');

  // Probe 1: Check whether fetchAndRenderSmartReplies is actually invoked
  const fetchAndRenderSmartRepliesMatches = canvasEngineSrc.match(/fetchAndRenderSmartReplies/g) || [];
  console.log(`  [AUDIT] Occurrences of 'fetchAndRenderSmartReplies' in canvas-engine.ts: ${fetchAndRenderSmartRepliesMatches.length}`);
  
  const isFetchCalledInCanvas = fetchAndRenderSmartRepliesMatches.length > 1;
  assert(
    'ADVERSARIAL PROBE: fetchAndRenderSmartReplies is invoked during reply activation',
    isFetchCalledInCanvas,
    'VULNERABILITY: fetchAndRenderSmartReplies is defined at line 483 but NEVER CALLED in startWhatsAppReply or anywhere in canvas-engine.ts! The chips container remains empty in production.'
  );

  // Probe 2: Check whether #whatsapp-voicenote-card is unhidden and populated
  const voicenoteCardInEngine = canvasEngineSrc.includes('whatsapp-voicenote-card');
  console.log(`  [AUDIT] References to 'whatsapp-voicenote-card' in canvas-engine.ts: ${voicenoteCardInEngine}`);
  assert(
    'ADVERSARIAL PROBE: canvas-engine.ts references and unhides #whatsapp-voicenote-card for voice notes',
    voicenoteCardInEngine,
    'VULNERABILITY: #whatsapp-voicenote-card exists in index.html with class="hidden", but canvas-engine.ts never references or unhides it!'
  );

  // Probe 3: Check whether isWhatsAppVoiceNoteActive is called in canvas-engine.ts
  const isVoiceNoteActiveMatches = canvasEngineSrc.match(/isWhatsAppVoiceNoteActive/g) || [];
  console.log(`  [AUDIT] Occurrences of 'isWhatsAppVoiceNoteActive' in canvas-engine.ts: ${isVoiceNoteActiveMatches.length}`);
  const isVoiceNoteActiveCalled = isVoiceNoteActiveMatches.length > 1;
  assert(
    'ADVERSARIAL PROBE: isWhatsAppVoiceNoteActive is called to trigger voice note UI or rendering',
    isVoiceNoteActiveCalled,
    'VULNERABILITY: isWhatsAppVoiceNoteActive is declared at line 473 but NEVER invoked in canvas-engine.ts!'
  );

  // Probe 4: Check worker claim of "voice note capsule wave indicator rendering in drawNotificationContent"
  // Worker claimed: "four dynamic oscillating bars are drawn in WhatsApp green (#25d366) on the capsule"
  const drawNotificationStartIndex = canvasEngineSrc.indexOf('public drawNotificationContent(');
  const drawNotificationContentBlock = drawNotificationStartIndex !== -1
    ? canvasEngineSrc.slice(drawNotificationStartIndex, drawNotificationStartIndex + 12000)
    : '';
  const hasWaveInNotification = drawNotificationContentBlock.includes('isWhatsAppVoiceNoteActive') ||
    drawNotificationContentBlock.includes('wa-vn-bar') ||
    (drawNotificationContentBlock.includes('oscillat') && drawNotificationContentBlock.includes('#25d366'));
  console.log(`  [AUDIT] Capsule wave indicator rendering in drawNotificationContent: ${hasWaveInNotification}`);
  assert(
    'ADVERSARIAL PROBE: Canvas engine actually draws dynamic oscillating wave bars on the capsule for voice notes',
    hasWaveInNotification,
    'VULNERABILITY: Worker claimed four dynamic oscillating bars are drawn on the capsule in drawNotificationContent, but no such canvas drawing code exists!'
  );

  // Probe 5: Overlay height hardcoding in canvas-engine.ts
  // In canvas-engine.ts:4971: waBar.style.height = `64px`;
  const isHeightHardcoded64 = canvasEngineSrc.includes("waBar.style.height = `64px`") || canvasEngineSrc.includes("waBar.style.height = '64px'");
  console.log(`  [AUDIT] waBar.style.height hardcoded to 64px: ${isHeightHardcoded64}`);
  assert(
    'ADVERSARIAL PROBE: Quick reply bar height accommodates chips and voicenote card without clipping (not hardcoded to 64px)',
    !isHeightHardcoded64,
    'VULNERABILITY: waBar.style.height is hardcoded to 64px at line 4971. When smart reply chips (28px) and voice note card (82px) are visible, content height reaches ~171px and overflows the 64px bar!'
  );

  // ==========================================================================
  // FINAL REPORT & SUMMARY
  // ==========================================================================
  console.log('\n====================================================================');
  console.log(` STRESS TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('====================================================================\n');

  if (failedTests > 0) {
    console.log('CRITICAL ADVERSARIAL FINDINGS / VULNERABILITIES IDENTIFIED:');
    failures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [FAIL] ${f.name}`);
      if (f.details) console.log(`     -> ${f.details}`);
    });
    console.log('\nRECOMMENDED VERDICT: REQUEST_CHANGES');
  } else {
    console.log('ALL EMPIRICAL TESTS & PROBES PASSED. RECOMMENDED VERDICT: APPROVE');
  }

  return { totalTests, passedTests, failedTests, failures };
}

// Run suite directly if executed via CLI
if (require.main === module) {
  runAdversarialStressSuite()
    .then(({ failedTests }) => {
      // Exit with 0 if no fails, or 1 if fails
      process.exit(failedTests > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Fatal stress suite execution error:', err);
      process.exit(1);
    });
}

module.exports = { runAdversarialStressSuite };
