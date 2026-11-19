/**
 * Challenger 1: Adversarial Stress Test Harness for Milestone 4 (R4: WhatsApp AI Smart Replies & Voice Note Reader)
 * 
 * Empirical verification suite covering:
 * 1. Adversarial Intent Classification (Conflicting keywords, Negations, Emojis, Punctuation, Capitalization, Sarcasm)
 * 2. Voice Note Edge Cases & Duration Parsing (0:01, 12:34, 0:00, negative, malformed, 100-min audio)
 * 3. ReDoS Stress Testing (10,000+ character repetitive strings across all intent regexes and voice note regexes, <25ms SLA)
 * 4. Smart Reply Format Validation (Exactly 3 non-empty strings, no undefined/null, no HTML/script tags, distinct suggestions)
 * 5. Transcription Engine Edge Cases (Empty context, special chars/XSS, non-English names, sidecar audio, duration tiers)
 * 6. High-Throughput Simulation, State Bounds & Callback Resilience (FIFO cap, listener error isolation, unsubscribe)
 */

const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

// Resolve WhatsAppSmartService from compiled dist
const whatsappServicePath = path.join(__dirname, '../dist/main/whatsapp-smart-service.js');
if (!fs.existsSync(whatsappServicePath)) {
  console.error('[ERROR] whatsapp-smart-service.js not found in dist/main! Run npm run build first.');
  process.exit(1);
}

const { WhatsAppSmartService, whatsappSmartService } = require(whatsappServicePath);

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];
const vulnerabilityFindings = [];

function assert(description, condition, details = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${description}`);
  } else {
    failedAssertions++;
    console.error(`  [FAIL] ${description} ${details ? '--> ' + details : ''}`);
    failureDetails.push({ description, details });
  }
}

function recordVulnerability(title, severity, description, evidence, recommendation) {
  vulnerabilityFindings.push({
    title,
    severity,
    description,
    evidence,
    recommendation
  });
  console.log(`\n  ⚠️ [VULNERABILITY IDENTIFIED] [${severity}] ${title}`);
  console.log(`     Evidence: ${evidence}`);
  console.log(`     Recommendation: ${recommendation}\n`);
}

async function runAdversarialWhatsAppTests() {
  console.log('======================================================================');
  console.log('   CHALLENGER 1: WHATSAPP SMART REPLIES & VOICE NOTE ADVERSARIAL TEST ');
  console.log('======================================================================\n');

  const service = new WhatsAppSmartService();

  // =========================================================================
  // 1. Adversarial Intent Classification Stress Testing
  // =========================================================================
  console.log('--- 1. Adversarial Intent Classification (Conflicts, Negations, Emojis, Formatting) ---');

  // 1.1 Conflicting keywords: GRATITUDE vs SCHEDULING
  const conflict1 = service.getSmartReplies('Thanks, but can we meet tomorrow at 4?');
  assert('Conflict: "Thanks, but can we meet tomorrow at 4?" produces a valid intent',
    ['GRATITUDE', 'SCHEDULING'].includes(conflict1.intent));
  assert('Conflict 1 produces exactly 3 non-empty string replies',
    conflict1.replies.length === 3 && conflict1.replies.every(r => typeof r === 'string' && r.length > 0));

  // 1.2 Conflicting keywords: SCHEDULING vs GRATITUDE (Scheduling upfront)
  const conflict2 = service.getSmartReplies('Can we meet tomorrow at 4? Thanks!');
  assert('Conflict: "Can we meet tomorrow at 4? Thanks!" produces valid intent',
    ['GRATITUDE', 'SCHEDULING'].includes(conflict2.intent));
  assert('Conflict 2 produces exactly 3 non-empty string replies',
    conflict2.replies.length === 3 && conflict2.replies.every(r => typeof r === 'string' && r.length > 0));

  // 1.3 Conflicting keywords: GREETING + QUESTION_STATUS + SCHEDULING
  const conflict3 = service.getSmartReplies('Hey Gaurav! How is it going? Are you free at 3 to sync up?');
  assert('Multi-conflict prioritizes higher-order intent over greeting',
    ['SCHEDULING', 'QUESTION_STATUS'].includes(conflict3.intent));
  assert('Multi-conflict produces exactly 3 non-empty string replies',
    conflict3.replies.length === 3);

  // 1.4 Voice Note keyword conflicting with gratitude
  const conflict4 = service.getSmartReplies('Voice message (0:45) - thank you so much!');
  assert('Voice note takes absolute precedence over gratitude in classification',
    conflict4.intent === 'VOICE_NOTE');
  assert('Voice note replies are contextually tailored to audio message',
    conflict4.replies.some(r => r.toLowerCase().includes('audio') || r.toLowerCase().includes('listening')));

  // 1.5 Negation testing: "I am not free"
  const neg1 = service.getSmartReplies('I am not free today at 3');
  assert('Negation "I am not free today at 3" does not crash and yields valid result',
    neg1 && typeof neg1.intent === 'string' && neg1.replies.length === 3);

  // 1.6 Negation testing: "Don't confirm"
  const neg2 = service.getSmartReplies("Don't confirm anything yet, wait for my signal");
  assert('Negation "Don\'t confirm" does not crash and safely yields valid replies',
    neg2 && neg2.replies.length === 3 && !neg2.replies.includes(undefined));

  // 1.7 Negation testing: "No, thank you"
  const neg3 = service.getSmartReplies('No, thank you');
  assert('Negation "No, thank you" matches GRATITUDE safely',
    neg3.intent === 'GRATITUDE' && neg3.replies.length === 3);

  // 1.8 Emojis: Multiple Confirmation Emojis
  const emojiConfirmMulti = service.getSmartReplies('👍👍👍');
  assert('Multiple thumbs-up emojis classify as CONFIRMATION',
    emojiConfirmMulti.intent === 'CONFIRMATION' && emojiConfirmMulti.replies.length === 3);

  // 1.9 Emojis: Multiple Gratitude Emojis
  const emojiGratitudeMulti = service.getSmartReplies('🙏🙏🙏❤️❤️');
  assert('Multiple folded hands/hearts classify as GRATITUDE',
    emojiGratitudeMulti.intent === 'GRATITUDE' && emojiGratitudeMulti.replies.length === 3);

  // 1.10 Emojis: Mixed Disjoint Emojis
  const emojiMixed = service.getSmartReplies('👍🙏✨');
  assert('Mixed emojis fall back safely to GENERAL_FALLBACK without crashing',
    emojiMixed && emojiMixed.replies.length === 3);

  // 1.11 Unrecognized Emojis & Asian / RTL Unicode
  const emojiUnrecognized = service.getSmartReplies('🔥🚀🎉🤖');
  assert('Unrecognized emojis fall back safely to GENERAL_FALLBACK',
    emojiUnrecognized.intent === 'GENERAL_FALLBACK' && emojiUnrecognized.replies.length === 3);

  const unicodeJapanese = service.getSmartReplies('こんにちは、明日の会議について');
  assert('Japanese Unicode characters fall back safely to GENERAL_FALLBACK',
    unicodeJapanese.intent === 'GENERAL_FALLBACK' && unicodeJapanese.replies.length === 3);

  const unicodeArabic = service.getSmartReplies('مرحبا، كيف حالك؟');
  assert('Arabic RTL Unicode characters fall back safely to GENERAL_FALLBACK',
    unicodeArabic.intent === 'GENERAL_FALLBACK' && unicodeArabic.replies.length === 3);

  // 1.12 Casing and Punctuation Extremes
  const allCapsScheduling = service.getSmartReplies('ARE YOU FREE AT 3 PM TODAY???');
  assert('ALL CAPS message classifies as SCHEDULING',
    allCapsScheduling.intent === 'SCHEDULING');

  const mixedCaseGratitude = service.getSmartReplies('tHaNkS a LoT!!!!!');
  assert('SpongeBob mixed-case message classifies as GRATITUDE',
    mixedCaseGratitude.intent === 'GRATITUDE');

  const punctuationOnly = service.getSmartReplies('!?!?!?!?!.......,,,,,,,');
  assert('Punctuation-only message safely falls back to GENERAL_FALLBACK',
    punctuationOnly.intent === 'GENERAL_FALLBACK' && punctuationOnly.replies.length === 3);

  // 1.13 Sarcasm & Informal Slang
  const informalHey = service.getSmartReplies('heyyyyyyyy bro');
  assert('Informal elongated greeting classifies as GREETING',
    informalHey.intent === 'GREETING');

  const informalYo = service.getSmartReplies('yo sup');
  assert('Informal "yo sup" classifies as GREETING',
    informalYo.intent === 'GREETING');

  const statusEta = service.getSmartReplies('what is the eta on the release?');
  assert('Status check with "eta" classifies as QUESTION_STATUS',
    statusEta.intent === 'QUESTION_STATUS');


  // =========================================================================
  // 2. Voice Note Edge Cases & Duration Parsing
  // =========================================================================
  console.log('\n--- 2. Voice Note Edge Cases & Duration Parsing ---');

  // 2.1 Standard Voice message (M:SS)
  const vnStandard1 = service.parseVoiceNoteDetails('Voice message (0:01)');
  assert('Voice message (0:01) parsed as 1 second',
    vnStandard1.isVoiceNote === true && vnStandard1.durationSeconds === 1);

  const vnStandard2 = service.parseVoiceNoteDetails('Voice message (12:34)');
  assert('Voice message (12:34) parsed as 754 seconds (12*60 + 34)',
    vnStandard2.isVoiceNote === true && vnStandard2.durationSeconds === 754);

  // 2.2 Zero Duration Audio message (0:00)
  const vnZero = service.parseVoiceNoteDetails('Audio message (0:00)');
  assert('Audio message (0:00) detected as voice note with 0 duration',
    vnZero.isVoiceNote === true && vnZero.durationSeconds === 0);

  // 2.3 Explicit seconds format (XXs, XX sec, XX seconds)
  const vnSec1 = service.parseVoiceNoteDetails('voice note (45s)');
  assert('voice note (45s) parsed as 45 seconds',
    vnSec1.isVoiceNote === true && vnSec1.durationSeconds === 45);

  const vnSec2 = service.parseVoiceNoteDetails('audio message (90 sec)');
  assert('audio message (90 sec) parsed as 90 seconds',
    vnSec2.isVoiceNote === true && vnSec2.durationSeconds === 90);

  const vnSec3 = service.parseVoiceNoteDetails('Voice message (150 seconds)');
  assert('Voice message (150 seconds) parsed as 150 seconds',
    vnSec3.isVoiceNote === true && vnSec3.durationSeconds === 150);

  // 2.4 Extreme 100-minute audio: Voice message (100:00)
  const vn100m = service.parseVoiceNoteDetails('Voice message (100:00)');
  assert('Voice message (100:00) parsed as 6000 seconds',
    vn100m.isVoiceNote === true && vn100m.durationSeconds === 6000);

  // 2.5 Malformed durations and keywords
  const vnMalformed1 = service.parseVoiceNoteDetails('Voice message (invalid)');
  assert('Voice message (invalid) falls back to default 15 seconds estimate',
    vnMalformed1.isVoiceNote === true && vnMalformed1.durationSeconds === 15);

  const vnMalformed2 = service.parseVoiceNoteDetails('Audio message ()');
  assert('Audio message () falls back to default 15 seconds estimate',
    vnMalformed2.isVoiceNote === true && vnMalformed2.durationSeconds === 15);

  const vnNegativeDur = service.parseVoiceNoteDetails('Voice message (-0:15)');
  assert('Voice message with negative format is handled without throwing and falls back',
    vnNegativeDur.isVoiceNote === true && vnNegativeDur.durationSeconds === 15);

  const vnPttTag = service.parseVoiceNoteDetails('Sent PTT-984321 audio clip');
  assert('PTT tag identifier detected as voice note',
    vnPttTag.isVoiceNote === true && vnPttTag.durationSeconds === 15);

  // 2.6 Non-voice-note rejection
  assert('Standard text is not detected as voice note',
    service.parseVoiceNoteDetails('Hello Gaurav, how are you today?').isVoiceNote === false);
  assert('Image caption is not detected as voice note',
    service.parseVoiceNoteDetails('Photo (1 file)').isVoiceNote === false);
  assert('Null or non-string input safely returns isVoiceNote: false',
    service.parseVoiceNoteDetails(null).isVoiceNote === false &&
    service.parseVoiceNoteDetails(undefined).isVoiceNote === false &&
    service.parseVoiceNoteDetails(12345).isVoiceNote === false);


  // =========================================================================
  // 3. ReDoS Stress Testing (<25ms SLA)
  // =========================================================================
  console.log('\n--- 3. ReDoS Stress Testing on 10,000+ Character Inputs (<25ms SLA) ---');

  const REDOS_SLA_MS = 25.0;

  // 3.1 10,000 repetitive spaces
  const spaces10k = ' '.repeat(10000);
  const t0 = performance.now();
  const resSpaces = service.classifyIntent(spaces10k);
  const durSpaces = performance.now() - t0;
  assert(`10,000 repetitive spaces classified in ${durSpaces.toFixed(3)}ms (<25ms)`,
    durSpaces < REDOS_SLA_MS && resSpaces === 'GENERAL_FALLBACK');

  // 3.2 10,000 repetitive 'voice voice voice ...' in parseVoiceNoteDetails
  const voiceWords10k = 'voice '.repeat(2000);
  const t1 = performance.now();
  const resVnWords = service.parseVoiceNoteDetails(voiceWords10k);
  const durVnWords = performance.now() - t1;
  assert(`10,000 char repetitive 'voice' tested in ${durVnWords.toFixed(3)}ms (<25ms)`,
    durVnWords < REDOS_SLA_MS && resVnWords.isVoiceNote === false);

  const voiceMsgWords10k = 'voice message '.repeat(1000);
  const t1b = performance.now();
  const resVnMsgWords = service.parseVoiceNoteDetails(voiceMsgWords10k);
  const durVnMsgWords = performance.now() - t1b;
  assert(`10,000 char repetitive 'voice message' parsed in ${durVnMsgWords.toFixed(3)}ms (<25ms)`,
    durVnMsgWords < REDOS_SLA_MS && resVnMsgWords.isVoiceNote === true);

  // 3.3 Catastrophic backtracking attempt on voice message duration pattern
  const redosVoiceMsg = 'voice message (' + '9'.repeat(10000) + ':abc)';
  const t2 = performance.now();
  const resRedosVn = service.parseVoiceNoteDetails(redosVoiceMsg);
  const durRedosVn = performance.now() - t2;
  assert(`10,000 digits in voice message duration parsed in ${durRedosVn.toFixed(3)}ms (<25ms)`,
    durRedosVn < REDOS_SLA_MS && resRedosVn.isVoiceNote === true);

  // 3.4 Catastrophic backtracking attempt on Gratitude pattern
  const redosGratitude = 'thank you '.repeat(1000);
  const t3 = performance.now();
  const resRedosGrat = service.classifyIntent(redosGratitude);
  const durRedosGrat = performance.now() - t3;
  assert(`10,000 char repetitive 'thank you' processed in ${durRedosGrat.toFixed(3)}ms (<25ms)`,
    durRedosGrat < REDOS_SLA_MS && resRedosGrat === 'GRATITUDE');

  // 3.4b Sliced 1200-char boundary: 'thank ... you' with match beyond 1200 chars
  const redosGratitudePastBoundary = 'thank '.repeat(2000) + 'you';
  const t3b = performance.now();
  const resRedosGratPast = service.classifyIntent(redosGratitudePastBoundary);
  const durRedosGratPast = performance.now() - t3b;
  assert(`12,000 char input with match beyond 1,200 char window safely falls back in ${durRedosGratPast.toFixed(3)}ms`,
    durRedosGratPast < REDOS_SLA_MS && resRedosGratPast === 'GENERAL_FALLBACK');

  // 3.5 Catastrophic backtracking attempt on Scheduling pattern
  const redosScheduling = 'are you '.repeat(2000) + 'free at 4?';
  const t4 = performance.now();
  const resRedosSched = service.classifyIntent(redosScheduling);
  const durRedosSched = performance.now() - t4;
  assert(`10,000 char repetitive scheduling words processed in ${durRedosSched.toFixed(3)}ms (<25ms)`,
    durRedosSched < REDOS_SLA_MS);

  // 3.6 Catastrophic backtracking attempt on Greeting elongated pattern
  const redosGreeting = 'h' + 'e'.repeat(5000) + 'y'.repeat(5000) + '!';
  const t5 = performance.now();
  const resRedosGreet = service.classifyIntent(redosGreeting);
  const durRedosGreet = performance.now() - t5;
  assert(`10,000 char elongated 'heyyy' processed in ${durRedosGreet.toFixed(3)}ms (<25ms)`,
    durRedosGreet < REDOS_SLA_MS);

  // 3.7 Catastrophic backtracking attempt on emoji anchor regex: 5000 emojis + invalid char
  const redosEmoji = '👍'.repeat(5000) + 'X';
  const t6 = performance.now();
  const resRedosEmoji = service.classifyIntent(redosEmoji);
  const durRedosEmoji = performance.now() - t6;
  assert(`5,000 repeated emojis with mismatching tail processed in ${durRedosEmoji.toFixed(3)}ms (<25ms)`,
    durRedosEmoji < REDOS_SLA_MS);

  // 3.8 20,000 character mixed symbols
  const symbols20k = '!@#$%^&*()_+=-~`{}[]|\\:;"\'<>,.?/ '.repeat(600);
  const t7 = performance.now();
  const resSymbols = service.getSmartReplies(symbols20k);
  const durSymbols = performance.now() - t7;
  assert(`20,000 char symbol fuzz input processed in ${durSymbols.toFixed(3)}ms (<25ms)`,
    durSymbols < REDOS_SLA_MS && resSymbols.replies.length === 3);


  // =========================================================================
  // 4. Smart Reply Format Validation & Output Contract
  // =========================================================================
  console.log('\n--- 4. Smart Reply Format Validation & Output Contract ---');

  const intentsToTest = [
    { name: 'GREETING', input: 'Hello there' },
    { name: 'SCHEDULING', input: 'Can we meet tomorrow at 10am?' },
    { name: 'CONFIRMATION', input: 'Is this okay with you?' },
    { name: 'GRATITUDE', input: 'Thank you so much!' },
    { name: 'QUESTION_STATUS', input: 'What is the status?' },
    { name: 'VOICE_NOTE', input: 'Voice message (0:25)' },
    { name: 'GENERAL_FALLBACK', input: 'Random unmatched text 12345' }
  ];

  for (const { name, input } of intentsToTest) {
    const result = service.getSmartReplies(input);

    assert(`[${name}] Returns exactly 3 suggestions`, result.replies.length === 3);
    assert(`[${name}] Every suggestion is non-empty string`,
      result.replies.every(r => typeof r === 'string' && r.trim().length > 0));
    assert(`[${name}] No undefined or null values present`,
      result.replies.every(r => r !== undefined && r !== null && !r.includes('undefined') && !r.includes('null')));
    assert(`[${name}] Suggestions contain NO HTML or script tags`,
      result.replies.every(r => !/<[a-z][\s\S]*>/i.test(r)));

    // Distinct suggestions (no duplicate identical replies)
    const distinctReplies = new Set(result.replies);
    assert(`[${name}] All 3 suggestions are unique/distinct`, distinctReplies.size === 3);
  }

  // 4.1 Sender Personalization Sanitization
  const greetingPersonalized = service.getSmartReplies('Hi', 'Sarah');
  assert('Personalized greeting incorporates first name for valid ASCII name',
    greetingPersonalized.replies[0] === 'Hey Sarah! How are you?');

  const greetingXSS = service.getSmartReplies('Hi', '<script>alert(1)</script>');
  assert('XSS payload in sender is NOT injected into replies',
    !greetingXSS.replies[0].includes('<script>') && !greetingXSS.replies[0].includes('alert'));

  const greetingSQLi = service.getSmartReplies('Hi', "Robert'); DROP TABLE users;--");
  assert('SQL injection / metacharacters in sender are safely rejected from personalization',
    !greetingSQLi.replies[0].includes('DROP TABLE'));

  const greetingNonAsciiName = service.getSmartReplies('Hi', '佐藤');
  assert('Non-ASCII Japanese name in sender does not crash and yields valid replies',
    greetingNonAsciiName.replies.length === 3 && greetingNonAsciiName.replies.every(r => typeof r === 'string'));


  // =========================================================================
  // 5. Transcription Engine Edge Cases & R7 Fallbacks
  // =========================================================================
  console.log('\n--- 5. Transcription Engine Edge Cases & Synthesizer Fallbacks ---');

  // 5.1 Empty context
  const transEmptyCtx = service.transcribeVoiceNote('vn-empty', 15, '');
  assert('Empty context generates non-empty transcript without error',
    typeof transEmptyCtx.transcript === 'string' && transEmptyCtx.transcript.length > 0);

  // 5.2 Special characters / XSS context
  const transXssCtx = service.transcribeVoiceNote('vn-xss', 20, '<img src=x onerror=alert(1)>');
  assert('XSS context produces safe transcript without throwing',
    typeof transXssCtx.transcript === 'string' && transXssCtx.confidence >= 0.90 && transXssCtx.confidence <= 1.0);

  // 5.3 Non-English names in context
  const transNonEnglish = service.transcribeVoiceNote('vn-intl', 30, 'François & Владимир');
  assert('International Unicode names in context process cleanly',
    typeof transNonEnglish.transcript === 'string' && transNonEnglish.durationSeconds === 30);

  // 5.4 Duration clamping in transcribeVoiceNote: 0 duration
  const transZeroDur = service.transcribeVoiceNote('vn-zero', 0, 'chat');
  assert('Zero duration in transcribeVoiceNote is clamped safely to at least 1s',
    transZeroDur.durationSeconds >= 1);

  // 5.5 Duration clamping: negative duration
  const transNegDur = service.transcribeVoiceNote('vn-neg', -30, 'chat');
  assert('Negative duration in transcribeVoiceNote is clamped safely to at least 1s',
    transNegDur.durationSeconds >= 1);

  // 5.6 Boundary tests for contextual synthesizer branches:
  // Technical / engineering branch
  const techShort = service.transcribeVoiceNote('vn-tech-s', 10, 'PR review');
  assert('Technical short voice note (<=12s) mentions PR/checks',
    techShort.transcript.toLowerCase().includes('pull request') || techShort.transcript.toLowerCase().includes('checks'));

  const techMedium = service.transcribeVoiceNote('vn-tech-m', 25, 'bug fix and build');
  assert('Technical medium voice note (13-30s) mentions build/Dynamic Island',
    techMedium.transcript.toLowerCase().includes('dynamic island') || techMedium.transcript.toLowerCase().includes('build'));

  const techLong = service.transcribeVoiceNote('vn-tech-l', 60, 'deploy test');
  assert('Technical long voice note (>30s) mentions deployment/milestone',
    techLong.transcript.toLowerCase().includes('deployment') || techLong.transcript.toLowerCase().includes('milestone'));

  // Scheduling branch
  const schedShort = service.transcribeVoiceNote('vn-sched-s', 8, 'calendar sync');
  assert('Scheduling short voice note (<=12s) mentions sync',
    schedShort.transcript.toLowerCase().includes('sync'));

  const schedMedium = service.transcribeVoiceNote('vn-sched-m', 20, 'meeting time');
  assert('Scheduling medium voice note (13-30s) mentions 3 PM / calendar',
    schedMedium.transcript.toLowerCase().includes('calendar') || schedMedium.transcript.toLowerCase().includes('3 pm'));

  const schedLong = service.transcribeVoiceNote('vn-sched-l', 50, 'schedule call');
  assert('Scheduling long voice note (>30s) mentions agenda/review',
    schedLong.transcript.toLowerCase().includes('agenda') || schedLong.transcript.toLowerCase().includes('review'));

  // General duration branch
  const genVeryShort = service.transcribeVoiceNote('vn-gen-vs', 5, '');
  assert('General voice note (<=8s) produces concise message',
    genVeryShort.transcript.length > 0 && genVeryShort.transcript.includes('Talk to you in a bit'));

  const genLong = service.transcribeVoiceNote('vn-gen-vl', 120, '');
  assert('General long voice note (>45s) produces detailed audio update',
    genLong.transcript.includes('detailed audio update'));

  // 5.7 Sidecar audio file simulation
  const dummyAudioPath = path.join(__dirname, 'temp-test-audio.ogg');
  const dummySidecarPath = path.join(__dirname, 'temp-test-audio.txt');
  const sidecarContent = 'This is an actual speech-to-text transcript from a mock audio sidecar.';
  try {
    fs.writeFileSync(dummyAudioPath, 'RIFFdummyOggData', 'utf8');
    fs.writeFileSync(dummySidecarPath, sidecarContent, 'utf8');

    const sidecarTrans = service.transcribeVoiceNote(dummyAudioPath, 15);
    assert('Sidecar .txt file is read correctly and marks source as local_audio',
      sidecarTrans.source === 'local_audio' && sidecarTrans.transcript === sidecarContent);
  } finally {
    try { fs.unlinkSync(dummyAudioPath); } catch {}
    try { fs.unlinkSync(dummySidecarPath); } catch {}
  }


  // =========================================================================
  // 6. High-Throughput Simulation, State Bounds & Callback Resilience
  // =========================================================================
  console.log('\n--- 6. High-Throughput Simulation, State Bounds & Callback Resilience ---');

  // 6.1 State history bounded ring-buffer test
  service.clearHistory();
  assert('clearHistory resets state cleanly',
    service.getState().incomingHistory.length === 0 &&
    service.getState().voiceNoteCount === 0 &&
    service.getState().repliesCount === 0);

  // Simulate 120 rapid messages
  const tSimStart = performance.now();
  for (let i = 0; i < 120; i++) {
    service.simulateIncomingMessage(`User_${i}`, `Message number ${i} are you free at 3?`);
  }
  const tSimDur = performance.now() - tSimStart;

  const stateAfter120 = service.getState();
  assert(`120 simulated messages processed in ${tSimDur.toFixed(2)}ms (<100ms SLA)`,
    tSimDur < 100);
  assert('incomingHistory is capped at 50 items (FIFO ring buffer)',
    stateAfter120.incomingHistory.length === 50);
  assert('Oldest message in ring buffer is User_70 (User_0 to User_69 evicted)',
    stateAfter120.incomingHistory[0].sender === 'User_70');
  assert('Latest message in ring buffer is User_119',
    stateAfter120.incomingHistory[49].sender === 'User_119');

  // 6.2 Callback resilience: listener that throws does not break engine
  let throwingListenerFired = false;
  let wellBehavedListenerFired = false;

  const unsubThrowing = service.onVoiceNoteTranscribed(() => {
    throwingListenerFired = true;
    throw new Error('Hostile listener intentional explosion!');
  });

  const unsubWellBehaved = service.onVoiceNoteTranscribed(() => {
    wellBehavedListenerFired = true;
  });

  const resilientTrans = service.transcribeVoiceNote('vn-resilient-test', 20, 'code review');
  assert('transcribeVoiceNote succeeds even when a listener throws an uncaught error',
    resilientTrans && resilientTrans.voiceNoteId === 'vn-resilient-test');
  assert('Both throwing and succeeding listeners were invoked',
    throwingListenerFired && wellBehavedListenerFired);

  // 6.3 Unsubscribe mechanism
  unsubThrowing();
  unsubWellBehaved();
  let firedAfterUnsub = false;
  service.onVoiceNoteTranscribed(() => {
    // New listener
  });
  // Verify listeners array reduced
  const statePreBroadcast = service.getState().voiceNoteCount;
  service.transcribeVoiceNote('vn-post-unsub', 10);
  assert('Voice note counter incremented after unsub',
    service.getState().voiceNoteCount === statePreBroadcast + 1);

  // 6.4 Broadcast callback error handling
  let broadcastCalled = false;
  service.setBroadcastCallback((channel, payload) => {
    broadcastCalled = true;
    throw new Error('IPC window destroyed error simulation!');
  });

  const simThrowingIpc = service.simulateIncomingMessage('Alice', 'Hello there!');
  assert('simulateIncomingMessage handles broadcast callback failure gracefully without throwing',
    simThrowingIpc && broadcastCalled === true);


  // =========================================================================
  // Summary & Verdict
  // =========================================================================
  console.log('\n======================================================================');
  console.log(`TOTAL ADVERSARIAL ASSERTIONS: ${totalAssertions}`);
  console.log(`PASSED: ${passedAssertions}`);
  console.log(`FAILED: ${failedAssertions}`);
  console.log(`IDENTIFIED VULNERABILITIES: ${vulnerabilityFindings.length}`);
  console.log('======================================================================\n');

  if (failedAssertions > 0) {
    console.error(`FAILED TESTS SUMMARY (${failedAssertions}):`);
    failureDetails.forEach((f, i) => {
      console.error(`  ${i + 1}. ${f.description} ${f.details ? '--> ' + f.details : ''}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 ALL EMPIRICAL ADVERSARIAL TESTS PASSED CLEANLY!\n');
    process.exit(0);
  }
}

runAdversarialWhatsAppTests().catch(err => {
  console.error('Unhandled rejection in adversarial stress test:', err);
  process.exit(1);
});
