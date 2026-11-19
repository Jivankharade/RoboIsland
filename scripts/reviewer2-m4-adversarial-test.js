/**
 * Reviewer 2 Adversarial Stress Test Suite for Milestone 4 (R4: WhatsApp AI Smart Replies & Voice Note Reader)
 */

const fs = require('fs');
const path = require('path');
const { whatsappSmartService, WhatsAppSmartService } = require('../dist/main/whatsapp-smart-service');

let passed = 0;
let failed = 0;
const findings = [];

function assert(description, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${description}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${description} ${detail ? '--> ' + detail : ''}`);
    findings.push({ description, detail });
  }
}

console.log('======================================================================');
console.log('   REVIEWER 2: MILESTONE 4 (R4) ADVERSARIAL STRESS TEST & AUDIT       ');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// 1. Backend Service Integrity & Core Logic Verification
// ---------------------------------------------------------------------------
console.log('--- 1. Backend Service & Intent Classifier Edge Cases ---');

// Check package.json zero runtime dependencies
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
assert('Zero external runtime dependencies in package.json', Object.keys(pkg.dependencies || {}).length === 0);

// Edge case inputs
assert('Null input handled gracefully', whatsappSmartService.classifyIntent(null) === 'GENERAL_FALLBACK');
assert('Undefined input handled gracefully', whatsappSmartService.classifyIntent(undefined) === 'GENERAL_FALLBACK');
assert('Empty string handled gracefully', whatsappSmartService.classifyIntent('') === 'GENERAL_FALLBACK');
assert('Whitespace only handled gracefully', whatsappSmartService.classifyIntent('   \n\t  ') === 'GENERAL_FALLBACK');
assert('Number passed instead of string', whatsappSmartService.classifyIntent(42) === 'GENERAL_FALLBACK');
assert('Object passed instead of string', whatsappSmartService.classifyIntent({}) === 'GENERAL_FALLBACK');

// Giant string ReDoS probe
const giantInput = 'Are you free '.repeat(10000) + 'at 3pm?';
const t0 = process.hrtime.bigint();
const giantIntent = whatsappSmartService.classifyIntent(giantInput);
const t1 = process.hrtime.bigint();
const elapsedMs = Number(t1 - t0) / 1e6;
assert('Giant 130KB input classified within 20ms without ReDoS', elapsedMs < 20 && giantIntent === 'SCHEDULING', `Elapsed: ${elapsedMs.toFixed(2)}ms`);

// Intent Priority Order Stress
// If a user says "Thanks! Can you meet at 3pm?", is it gratitude or scheduling?
const thanksSchedule = whatsappSmartService.classifyIntent('Thanks! Can you meet at 3pm?');
assert('Multi-intent: Actionable SCHEDULING should be prioritized over GRATITUDE', thanksSchedule === 'SCHEDULING', `Classified as ${thanksSchedule}`);

// Voice note detection in various WhatsApp notification formats
const vn1 = whatsappSmartService.parseVoiceNoteDetails('Voice message (0:45)');
assert('VN format "Voice message (0:45)" -> 45s', vn1.isVoiceNote && vn1.durationSeconds === 45);

const vn2 = whatsappSmartService.parseVoiceNoteDetails('Audio message (1:15)');
assert('VN format "Audio message (1:15)" -> 75s', vn2.isVoiceNote && vn2.durationSeconds === 75);

const vn3 = whatsappSmartService.parseVoiceNoteDetails('Voice message (2:05)');
assert('VN format "Voice message (2:05)" -> 125s', vn3.isVoiceNote && vn3.durationSeconds === 125);

const vn4 = whatsappSmartService.parseVoiceNoteDetails('voice note (30s)');
assert('VN format "voice note (30s)" -> 30s', vn4.isVoiceNote && vn4.durationSeconds === 30);

const vn5 = whatsappSmartService.parseVoiceNoteDetails('audio clip (10 seconds)');
assert('VN format "audio clip (10 seconds)" -> 10s', vn5.isVoiceNote && vn5.durationSeconds === 10);

const vn6 = whatsappSmartService.parseVoiceNoteDetails('ptt-20261118-audio');
assert('VN format "ptt-20261118-audio" -> 15s default', vn6.isVoiceNote && vn6.durationSeconds === 15);

const nonVn = whatsappSmartService.parseVoiceNoteDetails('Can you give me a voice call?');
assert('Non-VN phrase "voice call" rejected', !nonVn.isVoiceNote);

// ---------------------------------------------------------------------------
// 2. Transcription Engine Verification
// ---------------------------------------------------------------------------
console.log('\n--- 2. Transcription Engine & Contextual Synthesizer ---');

const shortTx = whatsappSmartService.transcribeVoiceNote('vn-short', 5);
assert('Short voice note transcript duration <= 8s generated', typeof shortTx.transcript === 'string' && shortTx.transcript.length > 5);

const techTx = whatsappSmartService.transcribeVoiceNote('vn-tech', 25, 'bug in deploy script');
assert('Technical context generates engineering transcript', techTx.transcript.toLowerCase().includes('dynamic island') || techTx.transcript.toLowerCase().includes('build'));

const meetingTx = whatsappSmartService.transcribeVoiceNote('vn-meet', 25, 'agenda for our call');
assert('Meeting context generates scheduling transcript', meetingTx.transcript.toLowerCase().includes('calendar') || meetingTx.transcript.toLowerCase().includes('schedule'));

// Sidecar text file check
const tmpSidecar = path.join(__dirname, 'temp_test_audio.ogg');
const tmpTxt = path.join(__dirname, 'temp_test_audio.txt');
fs.writeFileSync(tmpSidecar, 'dummy audio binary');
fs.writeFileSync(tmpTxt, 'Actual local transcribed voice note text from disk.');
try {
  const localTx = whatsappSmartService.transcribeVoiceNote(tmpSidecar, 12);
  assert('Local sidecar .txt file reads disk transcript with source=local_audio', localTx.source === 'local_audio' && localTx.transcript === 'Actual local transcribed voice note text from disk.');
} finally {
  try { fs.unlinkSync(tmpSidecar); } catch {}
  try { fs.unlinkSync(tmpTxt); } catch {}
}

// ---------------------------------------------------------------------------
// 3. UI Wiring & Integrity Audit in canvas-engine.ts, index.html, island.css
// ---------------------------------------------------------------------------
console.log('\n--- 3. UI Wiring & Integrity Audit in Canvas Engine & DOM ---');

const canvasEngineSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf8');
const indexHtmlSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/index.html'), 'utf8');
const islandCssSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/island.css'), 'utf8');

// Check DOM elements exist in HTML
assert('index.html contains #whatsapp-smart-reply-chips', indexHtmlSrc.includes('id="whatsapp-smart-reply-chips"'));
assert('index.html contains #whatsapp-voicenote-card', indexHtmlSrc.includes('id="whatsapp-voicenote-card"'));
assert('index.html contains #wa-vn-duration', indexHtmlSrc.includes('id="wa-vn-duration"'));
assert('index.html contains #wa-vn-transcript', indexHtmlSrc.includes('id="wa-vn-transcript"'));

// Check CSS styling
assert('island.css styles .whatsapp-smart-chip', islandCssSrc.includes('.whatsapp-smart-chip'));
assert('island.css styles .whatsapp-voicenote-card', islandCssSrc.includes('.whatsapp-voicenote-card'));
assert('island.css styles @keyframes waWaveAnim', islandCssSrc.includes('@keyframes waWaveAnim'));

// CRITICAL INTEGRITY CHECKS IN CANVAS-ENGINE:
// 1. Is fetchAndRenderSmartReplies called inside openWhatsAppReply() or anywhere?
const openReplyIndex = canvasEngineSrc.indexOf('openWhatsAppReply()');
const openReplyBlock = canvasEngineSrc.slice(openReplyIndex, openReplyIndex + 1500);
const callsFetchSmartReplies = openReplyBlock.includes('fetchAndRenderSmartReplies');
assert('CanvasEngine calls fetchAndRenderSmartReplies() in openWhatsAppReply()', callsFetchSmartReplies, 'CRITICAL: fetchAndRenderSmartReplies is defined but NEVER called in openWhatsAppReply()!');

// 2. Is isWhatsAppVoiceNoteActive called anywhere in canvas-engine?
const matchesVoiceNoteActive = canvasEngineSrc.match(/isWhatsAppVoiceNoteActive\s*\(/g);
const isVoiceNoteActiveCalled = matchesVoiceNoteActive && matchesVoiceNoteActive.length > 1; // 1 is the definition
assert('isWhatsAppVoiceNoteActive() is called in canvas-engine', isVoiceNoteActiveCalled, 'CRITICAL: isWhatsAppVoiceNoteActive() is defined but NEVER called anywhere in canvas-engine.ts!');

// 3. Is whatsapp-voicenote-card unhidden or manipulated in canvas-engine?
const manipulatesVnCard = canvasEngineSrc.includes('whatsapp-voicenote-card');
assert('CanvasEngine controls #whatsapp-voicenote-card visibility / content', manipulatesVnCard, 'CRITICAL: #whatsapp-voicenote-card is never accessed or unhidden in canvas-engine.ts!');

// 4. Did worker implement "four dynamic oscillating bars ... in WhatsApp green (#25d366) on the capsule" in drawNotificationContent?
const drawNotifIndex = canvasEngineSrc.indexOf('drawNotificationContent');
const drawNotifBlock = canvasEngineSrc.slice(drawNotifIndex, drawNotifIndex + 8000);
const drawsOscillatingBars = drawNotifBlock.includes('isWhatsAppVoiceNoteActive') || (drawNotifBlock.includes('isVoiceNote') && drawNotifBlock.includes('#25d366'));
assert('drawNotificationContent renders dynamic oscillating voice note bars on capsule', drawsOscillatingBars, 'CRITICAL: Worker claimed 4 oscillating green bars are drawn on capsule, but no such code exists!');

// 5. Does renderer listen to island:whatsapp-incoming or island:whatsapp-voicenote-transcribed?
const listensIncoming = canvasEngineSrc.includes('onIncomingMessage') || canvasEngineSrc.includes('whatsapp-incoming');
assert('Renderer listens to incoming WhatsApp events', listensIncoming, 'Renderer does not register listeners for incoming simulated WhatsApp messages/voice notes');

console.log('\n======================================================================');
console.log(`TOTAL ADVERSARIAL ASSERTIONS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('======================================================================\n');

if (findings.length > 0) {
  console.log('CRITICAL INTEGRITY FINDINGS:');
  findings.forEach((f, idx) => {
    console.log(`  ${idx + 1}. [FAIL] ${f.description}`);
    if (f.detail) console.log(`     -> ${f.detail}`);
  });
}
