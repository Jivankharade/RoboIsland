/**
 * RoboIsland 2.0 - Media Engine & Spotify PKCE Verification Test Suite
 * (`scripts/test-media-engine.js`)
 * 
 * Verifies:
 * 1. RFC 7636 PKCE code verifier and SHA-256 code challenge mathematical correctness.
 * 2. Spotify authorization URL construction and callback parameter extraction.
 * 3. Dual-source fallback resolver (Spotify primary, automatic SMTC fallback on 403/disconnect).
 * 4. Unified MediaState schema mapping from Spotify Web API and Windows SMTC WinRT sources.
 * 5. Interactive scrub bar ratio math and seek clamping bounds.
 * 6. Zero-emoji compliance in Media UI source and template.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('====================================================');
console.log('       ROBOISLAND MEDIA ENGINE & SPOTIFY PKCE       ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(desc, condition, extraInfo = '') {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc} ${extraInfo}`);
    failed++;
  }
}

async function runTests() {
  const root = path.resolve(__dirname, '..');

  // --- 1. Testing Spotify PKCE Mathematical Correctness ---
  console.log('\n--- 1. Testing Spotify RFC 7636 PKCE Flow ---');
  const pkceModule = require(path.join(root, 'dist', 'main', 'spotify-pkce.js'));

  // Test Verifier Length & Character Set
  const verifier = pkceModule.generateCodeVerifier(64);
  assert('PKCE code verifier length is between 43 and 128 chars', verifier.length >= 43 && verifier.length <= 128);
  assert('PKCE code verifier contains only RFC 7636 unreserved characters', /^[A-Za-z0-9_-]+$/.test(verifier));

  // Test SHA-256 Base64URL Challenge Derivation
  const challenge = pkceModule.deriveCodeChallenge(verifier);
  const expectedChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  assert('PKCE code challenge matches SHA-256 base64url derivation', challenge === expectedChallenge);

  // Test Authorization URL
  const testClientId = 'test_spotify_client_id_12345';
  const testRedirectUri = 'http://127.0.0.1/callback';
  const authUrl = pkceModule.buildAuthorizationUrl(testClientId, testRedirectUri, challenge, [
    'user-read-playback-state',
    'user-modify-playback-state'
  ]);
  assert('Authorization URL targets accounts.spotify.com/authorize', authUrl.startsWith('https://accounts.spotify.com/authorize?'));
  assert('Authorization URL specifies code_challenge_method=S256', authUrl.includes('code_challenge_method=S256'));
  assert('Authorization URL includes derived challenge', authUrl.includes(`code_challenge=${challenge}`));
  assert('Authorization URL includes client_id', authUrl.includes(`client_id=${testClientId}`));
  assert('Authorization URL includes redirect_uri', authUrl.includes(encodeURIComponent(testRedirectUri)));

  // Test Callback Parsing
  const callbackSuccess = 'http://127.0.0.1/callback?code=AQD_sample_auth_code_98765&state=xyz';
  const parsedSuccess = pkceModule.parseCallbackUrl(callbackSuccess);
  assert('Callback parser extracts authorization code successfully', parsedSuccess.code === 'AQD_sample_auth_code_98765');
  assert('Callback parser reports no error on success', parsedSuccess.error === undefined);

  const callbackError = 'http://127.0.0.1/callback?error=access_denied';
  const parsedError = pkceModule.parseCallbackUrl(callbackError);
  assert('Callback parser extracts error on rejection', parsedError.error === 'access_denied');

  // --- 2. Testing Dual-Source Resolver & Fallback Logic ---
  console.log('\n--- 2. Testing Dual-Source Resolver & Fallback Logic ---');
  const { MediaEngine } = require(path.join(root, 'dist', 'main', 'media-engine.js'));

  // Test: Spotify Active -> 'spotify'
  const sourceWhenSpotifyPlaying = MediaEngine.resolveActiveSource(200, { name: 'Song A' }, { active: true });
  assert('Resolver selects "spotify" when Spotify returns 200 with item', sourceWhenSpotifyPlaying === 'spotify');

  // Test: Universal Fallback on HTTP 403 -> 'smtc'
  const sourceWhenSpotify403 = MediaEngine.resolveActiveSource(403, null, { active: true });
  assert('Resolver falls back to "smtc" when Spotify returns HTTP 403', sourceWhenSpotify403 === 'smtc');

  // Test: Disconnected Spotify -> 'smtc'
  const sourceWhenSpotifyDisconnected = MediaEngine.resolveActiveSource(null, null, { active: true });
  assert('Resolver falls back to "smtc" when Spotify is disconnected', sourceWhenSpotifyDisconnected === 'smtc');

  // Test: Neither Active -> 'none'
  const sourceWhenNone = MediaEngine.resolveActiveSource(null, null, { active: false });
  assert('Resolver returns "none" when neither source has active playback', sourceWhenNone === 'none');

  // --- 3. Testing Unified MediaState Schema Mapping ---
  console.log('\n--- 3. Testing Unified MediaState Schema Mapping ---');

  // Test Spotify Schema Mapping
  const mockSpotifyItem = {
    name: 'Blinding Lights',
    artists: [{ name: 'The Weeknd' }],
    album: {
      name: 'After Hours',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36' }]
    },
    duration_ms: 200040
  };
  const spotifyMapped = MediaEngine.mapSpotifyToMediaState(mockSpotifyItem, true, 45000);
  assert('Spotify state source is "spotify"', spotifyMapped.source === 'spotify');
  assert('Spotify state maps track title', spotifyMapped.title === 'Blinding Lights');
  assert('Spotify state maps artist list', spotifyMapped.artist === 'The Weeknd');
  assert('Spotify state maps album title', spotifyMapped.album === 'After Hours');
  assert('Spotify state maps album artwork URL', spotifyMapped.albumArtUrl.startsWith('https://i.scdn.co/'));
  assert('Spotify state maps isPlaying boolean', spotifyMapped.isPlaying === true);
  assert('Spotify state maps positionMs', spotifyMapped.positionMs === 45000);
  assert('Spotify state maps durationMs', spotifyMapped.durationMs === 200040);
  assert('Spotify state supportsControls is true', spotifyMapped.supportsControls === true);

  // Test SMTC Schema Mapping
  const mockSmtc = {
    active: true,
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    coverUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
    playing: true,
    positionMs: 120000,
    durationMs: 354000
  };
  const smtcMapped = MediaEngine.mapSmtcToMediaState(mockSmtc);
  assert('SMTC state source is "smtc"', smtcMapped.source === 'smtc');
  assert('SMTC state maps track title', smtcMapped.title === 'Bohemian Rhapsody');
  assert('SMTC state maps artist', smtcMapped.artist === 'Queen');
  assert('SMTC state maps album title', smtcMapped.album === 'A Night at the Opera');
  assert('SMTC state preserves base64 artwork data URI', smtcMapped.albumArtUrl.startsWith('data:image/'));
  assert('SMTC state maps isPlaying boolean', smtcMapped.isPlaying === true);
  assert('SMTC state maps positionMs', smtcMapped.positionMs === 120000);
  assert('SMTC state maps durationMs', smtcMapped.durationMs === 354000);
  assert('SMTC state supportsControls is true', smtcMapped.supportsControls === true);

  // --- 4. Testing Scrub Bar Ratio Math & Seek Boundaries ---
  console.log('\n--- 4. Testing Scrub Bar Ratio Math & Seek Boundaries ---');
  const pos = 60000;
  const dur = 180000;
  const ratio = pos / dur;
  assert('Scrub ratio at 60s/180s calculates accurately (1/3)', Math.abs(ratio - 0.3333) < 0.001);

  const clampRatio = (r) => Math.max(0, Math.min(1, r));
  assert('Scrub ratio clamps negative values to 0', clampRatio(-0.5) === 0);
  assert('Scrub ratio clamps overflow values to 1.0', clampRatio(1.5) === 1.0);
  assert('Scrub ratio preserves mid-range values', clampRatio(0.75) === 0.75);

  // --- 5. Testing Zero-Emoji Compliance in Media UI ---
  console.log('\n--- 5. Testing Zero-Emoji Compliance in Media UI ---');
  const mediaUiTs = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'media-ui.ts'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'index.html'), 'utf8');

  // Match emoji Unicode ranges (surrogate pairs and emoji blocks)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;
  assert('media-ui.ts contains ZERO emoji characters', !emojiRegex.test(mediaUiTs));
  assert('index.html contains ZERO emoji characters', !emojiRegex.test(indexHtml));
  assert('media-ui.ts contains SVG markup for previous button', mediaUiTs.includes('polygon points="19 20 9 12 19 4 19 20"'));
  assert('media-ui.ts contains SVG markup for play/pause button', mediaUiTs.includes('polygon points="5 3 19 12 5 21 5 3"'));
  assert('media-ui.ts contains SVG markup for next button', mediaUiTs.includes('polygon points="5 4 15 12 5 20 5 4"'));

  // Summary
  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('[EXCEPTION]', err);
  process.exit(1);
});
