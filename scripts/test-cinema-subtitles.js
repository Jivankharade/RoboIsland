const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[TEST] Starting RoboIsland Cinema Mode & Live Subtitle Verification...\n');

// 1. Zero-Emoji Compliance Test
const filesToCheck = [
  'src/main/cinema-detector.ts',
  'src/main/subtitle-engine.ts',
  'src/main/config-store.ts',
  'src/renderer/island/index.html',
  'src/renderer/island/island.css',
  'src/renderer/settings/settings.html',
  'src/renderer/settings/settings-ui.ts'
];

const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

for (const relPath of filesToCheck) {
  const fullPath = path.join(__dirname, '..', relPath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.strictEqual(
      emojiRegex.test(content),
      false,
      `Emoji detected in ${relPath}! Zero-Emoji Policy violated.`
    );
  }
}
console.log('  OK: Zero-Emoji Compliance verified across all Cinema Mode & Subtitle files');

// 2. Unit Testing CinemaDetector logic
const { CinemaDetector } = require('../dist/main/cinema-detector');

// Process matching
assert.strictEqual(CinemaDetector.matchesVideoApp('vlc.exe'), true);
assert.strictEqual(CinemaDetector.matchesVideoApp('C:\\Program Files\\VideoLAN\\VLC\\vlc.exe'), true);
assert.strictEqual(CinemaDetector.matchesVideoApp('mpv.exe'), true);
assert.strictEqual(CinemaDetector.matchesVideoApp('potplayermini64.exe'), true);
assert.strictEqual(CinemaDetector.matchesVideoApp('netflix.exe'), true);
assert.strictEqual(CinemaDetector.matchesVideoApp('notepad.exe'), false);
console.log('  OK: CinemaDetector accurately matches dedicated video player processes');

// Browser matching
assert.strictEqual(CinemaDetector.matchesBrowserApp('chrome.exe'), true);
assert.strictEqual(CinemaDetector.matchesBrowserApp('Google Chrome'), true);
assert.strictEqual(CinemaDetector.matchesBrowserApp('msedge.exe'), true);
assert.strictEqual(CinemaDetector.matchesBrowserApp('firefox.exe'), true);
assert.strictEqual(CinemaDetector.matchesBrowserApp('brave.exe'), true);
assert.strictEqual(CinemaDetector.matchesBrowserApp('opera.exe'), true);
assert.strictEqual(CinemaDetector.matchesBrowserApp('arc.exe'), true);
assert.strictEqual(CinemaDetector.matchesBrowserApp('spotify.exe'), false);
console.log('  OK: CinemaDetector accurately matches all major web browsers');

// Title matching
assert.strictEqual(CinemaDetector.matchesVideoTitle('Stranger Things - Netflix - Google Chrome'), true);
assert.strictEqual(CinemaDetector.matchesVideoTitle('Interstellar (2014) 1080p.mkv - VLC media player'), true);
assert.strictEqual(CinemaDetector.matchesVideoTitle('The Lord of the Rings - Prime Video - Microsoft Edge'), true);
assert.strictEqual(CinemaDetector.matchesVideoTitle('LET\'S SMILE JOKE - NAYA COMPUTER || FUNNY GAMING COMEDY'), true);
assert.strictEqual(CinemaDetector.matchesVideoTitle('Document1 - Word'), false);
console.log('  OK: CinemaDetector accurately matches streaming platforms and video file titles');

// State Evaluation
const r1 = CinemaDetector.evaluateCinemaState('Movie', 'vlc.exe', false, true);
assert.strictEqual(r1.isCinema, true);
assert.strictEqual(r1.reason, 'player');

const r2 = CinemaDetector.evaluateCinemaState('Avatar - Netflix', 'chrome.exe', false, true);
assert.strictEqual(r2.isCinema, true);
assert.strictEqual(r2.reason, 'streaming');

const r3 = CinemaDetector.evaluateCinemaState('Some App', 'app.exe', true, true);
assert.strictEqual(r3.isCinema, true);
assert.strictEqual(r3.reason, 'fullscreen');

const r4 = CinemaDetector.evaluateCinemaState('Music Track', 'spotify.exe', false, true, 'Music');
assert.strictEqual(r4.isCinema, false);

const r5 = CinemaDetector.evaluateCinemaState('Trailer', 'browser.exe', false, true, 'Video');
assert.strictEqual(r5.isCinema, true);
assert.strictEqual(r5.reason, 'smtc');

// User Screenshot Test Case: YouTube Comedy in Chrome
const userCase = CinemaDetector.evaluateCinemaState(
  '(1488) LET\'S SMILE JOKE - NAYA COMPUTER || FUNNY GAMING COMEDY',
  'chrome.exe',
  false,
  true
);
assert.strictEqual(userCase.isCinema, true, 'YouTube comedy video in Chrome must be detected as Cinema Video!');
console.log('  OK: YouTube video playing in Google Chrome correctly triggers Cinema Mode');

// 3rd-Party Streaming Website Test Case (SFlix, FMovies, Anime, etc.)
const thirdPartyCase = CinemaDetector.evaluateCinemaState(
  'Episode 420 Online - AnimeStream',
  'brave.exe',
  false,
  true
);
assert.strictEqual(thirdPartyCase.isCinema, true, '3rd-party video in Brave browser must be detected as Cinema Video!');
console.log('  OK: 3rd-party video streaming websites across browsers correctly trigger Cinema Mode');

// 3. Testing SubtitleEngine logic
const { SubtitleEngine, SUPPORTED_LANGUAGES } = require('../dist/main/subtitle-engine');

assert.strictEqual(Array.isArray(SUPPORTED_LANGUAGES), true);
assert.strictEqual(SUPPORTED_LANGUAGES.some(l => l.code === 'hi'), true);
assert.strictEqual(SUPPORTED_LANGUAGES.some(l => l.code === 'en'), true);
assert.strictEqual(SUPPORTED_LANGUAGES.some(l => l.code === 'mr'), true);
assert.strictEqual(SUPPORTED_LANGUAGES.some(l => l.code === 'es'), true);

const engine = SubtitleEngine.getInstance();

async function runSubtitleTests() {
  // Test translation dictionary
  const hiTrans = await engine.translate('We need to leave now', 'hi', 'en');
  assert.strictEqual(hiTrans.includes('निकलना होगा'), true, `Expected Hindi translation, got: ${hiTrans}`);

  const hiComputer = await engine.translate('new computer', 'hi', 'en');
  assert.strictEqual(hiComputer.includes('नया कंप्यूटर'), true, `Expected Hindi translation for new computer, got: ${hiComputer}`);

  const esTrans = await engine.translate('I have a bad feeling about this', 'es', 'en');
  assert.strictEqual(esTrans.includes('mal presentimiento'), true, `Expected Spanish translation, got: ${esTrans}`);

  const mrTrans = await engine.translate('Where are you going', 'mr', 'en');
  assert.strictEqual(mrTrans.includes('कुठे जात आहात'), true, `Expected Marathi translation, got: ${mrTrans}`);

  // Test push transcript
  const cue = await engine.pushTranscript('Hello', 'en');
  assert.strictEqual(cue.originalText, 'Hello');
  assert.strictEqual(cue.durationMs >= 2500, true);

  console.log('  OK: SubtitleEngine translates cinema dialogues into Hindi, Marathi, Spanish, and English');
  console.log('  OK: Subtitle duration and cue pacing validated');
  console.log('\nAll RoboIsland Cinema Mode & Live Subtitle tests PASSED!\n');
}

runSubtitleTests().catch(err => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
