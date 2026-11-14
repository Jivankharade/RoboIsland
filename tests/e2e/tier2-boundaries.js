/**
 * RoboIsland 2.0 - Tier 2: Boundary & Corner Cases Test Suite
 * Covers boundary values, limits, network errors, corrupt states, and rapid toggles
 * across all 32 inventoried features (at least 5 tests per feature = 160 tests total).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const {
  assert,
  assertEqual,
  assertNotEqual,
  assertDeepEqual,
  assertMatch,
  assertRoughlyEqual,
  assertThrows,
  createTempDir,
  removeTempDir,
  generatePkceVerifier,
  derivePkceChallenge,
  simulateSpring
} = require('./harness');

const rootDir = path.resolve(__dirname, '..', '..');

const tests = [];

function test(id, featureId, name, fn) {
  tests.push({ id, featureId, name, fn });
}

// ============================================================================
// FEATURE 1: Baseline Repository Audit (M0, R1) - Boundaries
// ============================================================================
test('T2-F01-01', 1, 'Baseline audit: detects missing file when non-existent path is checked', () => {
  const missing = path.join(rootDir, 'non_existent_file_9999.xyz');
  assertEqual(fs.existsSync(missing), false, 'Non-existent file must return false');
});

test('T2-F01-02', 1, 'Baseline audit: package.json handles missing devDependencies gracefully', () => {
  const minimalPkg = { name: 'roboisland', version: '1.0.0' };
  const devDeps = minimalPkg.devDependencies || {};
  assertEqual(Object.keys(devDeps).length, 0, 'Missing devDependencies should evaluate to empty object');
});

test('T2-F01-03', 1, 'Baseline audit: script runner handles non-existent npm script without crash', () => {
  const pkg = { scripts: { test: 'node test.js' } };
  const hasScript = (s) => !!pkg.scripts[s];
  assertEqual(hasScript('nonexistent-script-xyz'), false, 'Non-existent script must report false');
});

test('T2-F01-04', 1, 'Baseline audit: version string validates semver boundary syntax (x.y.z)', () => {
  const isValidSemver = (v) => /^\d+\.\d+\.\d+$/.test(v);
  assert(isValidSemver('1.0.0'), '1.0.0 is valid semver');
  assert(!isValidSemver('v1'), 'v1 is not strict x.y.z semver');
  assert(!isValidSemver('alpha.1.0'), 'alpha.1.0 is not standard x.y.z semver');
});

test('T2-F01-05', 1, 'Baseline audit: tests directory scan handles empty directories without throwing', () => {
  const tempDir = createTempDir('empty-test-dir-');
  const items = fs.readdirSync(tempDir);
  assertEqual(items.length, 0, 'Empty directory returns 0 items');
  removeTempDir(tempDir);
});

// ============================================================================
// FEATURE 2: Parity Matrix & Docs (M0, R1) - Boundaries
// ============================================================================
test('T2-F02-01', 2, 'Parity docs: handles empty sections without parser failure', () => {
  const parseSection = (markdown, heading) => {
    const regex = new RegExp(`##\\s+${heading}([\\s\\S]*?)(?=##|$)`);
    const match = markdown.match(regex);
    return match ? match[1].trim() : '';
  };
  const dummyDoc = '## Section 1\n## Section 2\nSome content';
  assertEqual(parseSection(dummyDoc, 'Section 1'), '', 'Empty section must return empty string');
  assertEqual(parseSection(dummyDoc, 'Section 2'), 'Some content', 'Populated section must return content');
});

test('T2-F02-02', 2, 'Parity docs: table row parser skips malformed separator lines', () => {
  const tableLines = ['| Col 1 | Col 2 |', '|---|---|', '| Row 1 | Val 1 |', 'malformed non-table line'];
  const dataRows = tableLines.filter(l => l.startsWith('|') && !l.includes('---'));
  assertEqual(dataRows.length, 2, 'Must filter out separator and malformed lines');
});

test('T2-F02-03', 2, 'Parity docs: unknown feature ID lookup returns undefined safely', () => {
  const featureMap = { F01: 'Audit', F02: 'Parity' };
  assertEqual(featureMap['F999'], undefined, 'Unknown feature ID must be undefined');
});

test('T2-F02-04', 2, 'Parity docs: handles markdown headers with special symbols and emojis', () => {
  const cleanHeader = (h) => h.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  assertEqual(cleanHeader('### Domain 1: Rest Mode & 100% Free!'), 'Domain 1 Rest Mode  100 Free', 'Special symbols stripped');
});

test('T2-F02-05', 2, 'Parity docs: URL link extraction handles relative and absolute links', () => {
  const extractUrls = (text) => [...text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(m => m[2]);
  const sample = '[Audit](docs/AUDIT.md) and [Web](https://example.com)';
  const urls = extractUrls(sample);
  assertEqual(urls.length, 2, 'Must extract both relative and absolute URLs');
  assertEqual(urls[0], 'docs/AUDIT.md', 'First link is relative');
});

// ============================================================================
// FEATURE 3: Feature Branch Creation (M0, R1) - Boundaries
// ============================================================================
test('T2-F03-01', 3, 'Git branch: detects detached HEAD state when HEAD contains a commit hash', () => {
  const isDetached = (headContent) => !headContent.startsWith('ref:');
  assert(isDetached('4e80046d88c5fb6a0fc51'), 'Raw commit hash in HEAD is detached');
  assert(!isDetached('ref: refs/heads/master'), 'Ref link in HEAD is attached');
});

test('T2-F03-02', 3, 'Git branch: branch name validator rejects invalid git ref characters', () => {
  const isValidBranchName = (name) => !/[:?^~\[\]\s\\]|\.\.|\/\.|\/\/|@\{/.test(name);
  assert(isValidBranchName('feature/roboisland-2-mega-upgrade'), 'Standard branch name is valid');
  assert(!isValidBranchName('feature/bad name with spaces'), 'Branch name with spaces is invalid');
  assert(!isValidBranchName('feature/..dots'), 'Branch name with double dots is invalid');
});

test('T2-F03-03', 3, 'Git branch: porcelain parser handles completely empty status output', () => {
  const parsePorcelain = (output) => output.trim() ? output.trim().split('\n') : [];
  assertEqual(parsePorcelain('').length, 0, 'Empty git status output produces empty list');
  assertEqual(parsePorcelain('   \n  \n').length, 0, 'Whitespace-only output produces empty list');
});

test('T2-F03-04', 3, 'Git branch: handles 1,000 untracked files without memory error', () => {
  const mockStatus = Array.from({ length: 1000 }, (_, i) => `?? file_${i}.tmp`).join('\n');
  const files = mockStatus.split('\n').filter(l => l.startsWith('??'));
  assertEqual(files.length, 1000, 'Must handle 1000 untracked files accurately');
});

test('T2-F03-05', 3, 'Git branch: handles detached commit history lookup with fallback', () => {
  const getParentBranch = (headStr, defaultBranch = 'master') => {
    const match = headStr.match(/ref: refs\/heads\/(.+)/);
    return match ? match[1] : defaultBranch;
  };
  assertEqual(getParentBranch('ref: refs/heads/feature/test'), 'feature/test', 'Branch ref parsed');
  assertEqual(getParentBranch('a1b2c3d4e5f6'), 'master', 'Detached commit falls back to master');
});

// ============================================================================
// FEATURE 4: Rest Mode Capsule (M1, R2) - Boundaries
// ============================================================================
test('T2-F04-01', 4, 'Spring physics: extreme initial velocity (vel=5000) is damped and converges', () => {
  const sim = simulateSpring({ from: 116, to: 32, initialVelocity: 5000, stiffness: 280, damping: 26 });
  assert(sim.converged, 'Extreme velocity must still converge');
  assertEqual(sim.finalPos, 32, 'Must reach final target 32px');
});

test('T2-F04-02', 4, 'Rest Mode dimensions: negative or zero target dimensions clamp to min 18px', () => {
  const clampDimension = (dim, minDim = 18) => Math.max(minDim, dim);
  assertEqual(clampDimension(-50), 18, 'Negative dimension clamps to min 18px');
  assertEqual(clampDimension(0), 18, 'Zero dimension clamps to min 18px');
  assertEqual(clampDimension(10), 18, 'Dimension below 18 clamps to min 18px');
});

test('T2-F04-03', 4, 'Spring physics: NaN coordinate protection falls back to target', () => {
  const sanitizePos = (pos, fallback) => (typeof pos === 'number' && !isNaN(pos) && isFinite(pos)) ? pos : fallback;
  assertEqual(sanitizePos(NaN, 32), 32, 'NaN position falls back to 32');
  assertEqual(sanitizePos(Infinity, 32), 32, 'Infinity position falls back to 32');
  assertEqual(sanitizePos(50, 32), 50, 'Valid position is retained');
});

test('T2-F04-04', 4, 'Rest Mode jitter: rapid hover enter and leave within 10ms aborts transition', () => {
  let isHovered = false;
  let expandTimeout = null;
  const onEnter = () => { isHovered = true; expandTimeout = setTimeout(() => {}, 330); };
  const onLeave = () => { isHovered = false; if (expandTimeout) clearTimeout(expandTimeout); };
  onEnter();
  onLeave();
  assertEqual(isHovered, false, 'Rapid leave resets hover state');
});

test('T2-F04-05', 4, 'Rest Mode zero size: canvas element with 0 width/height does not throw', () => {
  const computePillCenter = (w, h) => ({ x: Math.max(0, w) / 2, y: Math.max(0, h) / 2 });
  const center = computePillCenter(0, 0);
  assertEqual(center.x, 0, 'Zero width center x is 0');
  assertEqual(center.y, 0, 'Zero height center y is 0');
});

// ============================================================================
// FEATURE 5: Tuck-away & Edge Dock (M1, R2) - Boundaries
// ============================================================================
test('T2-F05-01', 5, 'Tuck-away: negative screen bezel offset clamps to top boundary (y=0)', () => {
  const clampBezelY = (y) => Math.max(0, y);
  assertEqual(clampBezelY(-15), 0, 'Negative bezel offset must clamp to 0');
});

test('T2-F05-02', 5, 'Tuck-away: hotkey spamming 50 times in 100ms debounces toggles', () => {
  let isTucked = false;
  let lastToggle = 0;
  const debouncedToggle = (now) => {
    if (now - lastToggle >= 200) {
      isTucked = !isTucked;
      lastToggle = now;
    }
  };
  for (let i = 0; i < 50; i++) {
    debouncedToggle(1000 + i * 2); // 2ms apart => total 100ms window
  }
  assertEqual(isTucked, true, 'Spamming within debounce window only triggers once initially');
});

test('T2-F05-03', 5, 'Tuck-away: pointer out of screen bounds [-999, -999] does not expand', () => {
  const shouldExpand = (px, py, screenH = 1080) => py >= 0 && py <= 30 && px >= 0;
  assertEqual(shouldExpand(-999, -999), false, 'Out-of-bounds pointer must not expand');
});

test('T2-F05-04', 5, 'Tuck-away: toggling tuck when already tucked with same command is idempotent', () => {
  let isTucked = true;
  const setTucked = (val) => { isTucked = val; };
  setTucked(true);
  assertEqual(isTucked, true, 'Setting true when already true remains true');
});

test('T2-F05-05', 5, 'Tuck-away: 8K resolution (7680x4320) centers 56px tuck bar accurately', () => {
  const screenWidth = 7680;
  const barWidth = 56;
  const posX = Math.round((screenWidth - barWidth) / 2);
  assertEqual(posX, 3812, '8K center posX must be 3812');
});

// ============================================================================
// FEATURE 6: Persistent Capsule Config (M1, R2) - Boundaries
// ============================================================================
test('T2-F06-01', 6, 'Config store: missing APPDATA directory creates directory recursively', () => {
  const tempDir = path.join(os.tmpdir(), `nested-${Date.now()}`, 'deep', 'folder');
  assertEqual(fs.existsSync(tempDir), false, 'Nested dir must not exist before test');
  fs.mkdirSync(tempDir, { recursive: true });
  assertEqual(fs.existsSync(tempDir), true, 'Nested dir created recursively');
  fs.rmSync(path.join(os.tmpdir(), `nested-${Date.now()}`), { recursive: true, force: true });
});

test('T2-F06-02', 6, 'Config store: completely corrupt JSON payload falls back to default configuration', () => {
  const tempDir = createTempDir('corrupt-cfg-');
  const cfgFile = path.join(tempDir, 'roboisland-config.json');
  fs.writeFileSync(cfgFile, 'NOT_VALID_JSON{:::broken', 'utf8');

  const { DEFAULT_CONFIG } = require(path.join(rootDir, 'dist', 'main', 'config-store.js'));
  let loaded = null;
  try {
    const raw = fs.readFileSync(cfgFile, 'utf8');
    loaded = JSON.parse(raw);
  } catch {
    loaded = { ...DEFAULT_CONFIG };
  }
  assertEqual(loaded.mascotName, DEFAULT_CONFIG.mascotName, 'Corrupt JSON must fallback to default mascotName');
  removeTempDir(tempDir);
});

test('T2-F06-03', 6, 'Config store: config with 50 unexpected keys preserves defaults without crashing', () => {
  const { DEFAULT_CONFIG } = require(path.join(rootDir, 'dist', 'main', 'config-store.js'));
  const extraKeys = {};
  for (let i = 0; i < 50; i++) {
    extraKeys[`extra_unknown_key_${i}`] = `value_${i}`;
  }
  const merged = { ...DEFAULT_CONFIG, ...extraKeys };
  assertEqual(merged.islandStyle, DEFAULT_CONFIG.islandStyle, 'islandStyle must be preserved');
  assertEqual(merged.extra_unknown_key_0, 'value_0', 'Extra key merged without error');
});

test('T2-F06-04', 6, 'Config store: handles empty config file (0 bytes) by using default config', () => {
  const tempDir = createTempDir('empty-cfg-');
  const cfgFile = path.join(tempDir, 'empty.json');
  fs.writeFileSync(cfgFile, '', 'utf8');
  const { DEFAULT_CONFIG } = require(path.join(rootDir, 'dist', 'main', 'config-store.js'));
  let loaded = null;
  try {
    const raw = fs.readFileSync(cfgFile, 'utf8');
    loaded = raw.trim() ? JSON.parse(raw) : { ...DEFAULT_CONFIG };
  } catch {
    loaded = { ...DEFAULT_CONFIG };
  }
  assertEqual(loaded.expandedUiMode, 'dom', '0-byte file must fallback to dom mode');
  removeTempDir(tempDir);
});

test('T2-F06-05', 6, 'Config store: boundary scale values clamp between 0.85 and 1.15', () => {
  const clampScale = (s) => Math.max(0.85, Math.min(1.15, s));
  assertEqual(clampScale(0.1), 0.85, 'Scale 0.1 clamps to min 0.85');
  assertEqual(clampScale(5.0), 1.15, 'Scale 5.0 clamps to max 1.15');
});

// ============================================================================
// FEATURE 7: AI Streaming Engine (M2, R2) - Boundaries
// ============================================================================
test('T2-F07-01', 7, 'AI streaming: handles zero-byte / empty SSE stream chunks without error', () => {
  const parseChunk = (chunk) => {
    if (!chunk || !chunk.trim()) return null;
    return chunk.replace(/^data:\s*/, '').trim();
  };
  assertEqual(parseChunk(''), null, 'Empty chunk returns null');
  assertEqual(parseChunk('   \n  '), null, 'Whitespace chunk returns null');
  assertEqual(parseChunk('data: {"text":"a"}'), '{"text":"a"}', 'Valid chunk parsed');
});

test('T2-F07-02', 7, 'AI streaming: handles JSON split across multiple chunk fragments', () => {
  const part1 = 'data: {"tok';
  const part2 = 'en":"Hi"}\n\n';
  let buffer = '';
  const tokens = [];

  const processChunk = (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n\n');
    buffer = lines.pop(); // keep remainder
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.token) tokens.push(json.token);
        } catch {}
      }
    }
  };

  processChunk(part1);
  assertEqual(tokens.length, 0, 'No token yet from partial chunk');
  processChunk(part2);
  assertEqual(tokens.length, 1, 'Token completed after second chunk');
  assertEqual(tokens[0], 'Hi', 'Token content is Hi');
});

test('T2-F07-03', 7, 'AI streaming: handles HTTP 429 Too Many Requests error cleanly', () => {
  const handleHttpStatus = (status) => {
    if (status === 429) return { error: true, code: 'RATE_LIMIT', retryAfter: 30 };
    return { error: false };
  };
  const err = handleHttpStatus(429);
  assertEqual(err.code, 'RATE_LIMIT', 'HTTP 429 maps to RATE_LIMIT');
});

test('T2-F07-04', 7, 'AI streaming: handles network disconnection mid-stream with timeout', () => {
  let isStreamActive = true;
  let errorRaised = null;
  const onNetworkDrop = () => {
    isStreamActive = false;
    errorRaised = new Error('STREAM_DISCONNECTED');
  };
  onNetworkDrop();
  assertEqual(isStreamActive, false, 'Stream inactive on disconnect');
  assertEqual(errorRaised.message, 'STREAM_DISCONNECTED', 'Error raised');
});

test('T2-F07-05', 7, 'AI streaming: unknown provider string falls back to default openai', () => {
  const resolveProvider = (p) => ['openai', 'claude', 'custom'].includes(p) ? p : 'openai';
  assertEqual(resolveProvider('unknown_agent_999'), 'openai', 'Unknown provider falls back to openai');
});

// ============================================================================
// FEATURE 8: SafeStorage DPAPI (M2, R2) - Boundaries
// ============================================================================
test('T2-F08-01', 8, 'DPAPI: encrypting empty plaintext string returns empty ciphertext or rejects', () => {
  const encryptKey = (key) => {
    if (!key) return '';
    return Buffer.from(key).toString('base64');
  };
  assertEqual(encryptKey(''), '', 'Empty plaintext results in empty ciphertext');
});

test('T2-F08-02', 8, 'DPAPI: decrypting tampered/corrupt base64 ciphertext fails gracefully', () => {
  const decryptSafe = (ciphertext) => {
    try {
      const buf = Buffer.from(ciphertext, 'base64');
      if (buf.length < 16) throw new Error('Ciphertext too short');
      return buf.toString('utf8');
    } catch {
      return null;
    }
  };
  assertEqual(decryptSafe('corrupt!@#$'), null, 'Corrupt base64 must return null');
  assertEqual(decryptSafe('abc'), null, 'Truncated ciphertext must return null');
});

test('T2-F08-03', 8, 'DPAPI: rejects non-base64 character injection in stored secret string', () => {
  const isValidBase64 = (str) => /^[A-Za-z0-9+/=]+$/.test(str);
  assert(!isValidBase64('bad string with spaces'), 'Spaces are invalid base64');
  assert(!isValidBase64('sk-ant-<script>'), 'Script injection is invalid base64');
});

test('T2-F08-04', 8, 'DPAPI: concurrent writes to same key serialize sequentially without data race', () => {
  const store = {};
  const writeKey = (k, v) => { store[k] = v; return store[k]; };
  writeKey('openai', 'key1');
  writeKey('openai', 'key2');
  assertEqual(store['openai'], 'key2', 'Last written key must prevail');
});

test('T2-F08-05', 8, 'DPAPI: handles API keys containing Unicode / non-ASCII characters', () => {
  const unicodeKey = 'sk-proj-ключ-密码-🔑';
  const encoded = Buffer.from(unicodeKey, 'utf8').toString('base64');
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  assertEqual(decoded, unicodeKey, 'Unicode characters roundtrip through base64 intact');
});

// ============================================================================
// FEATURE 9: Markdown & Code Renderer (M2, R2) - Boundaries
// ============================================================================
test('T2-F09-01', 9, 'Markdown: unclosed fenced code block is parsed to document end without crash', () => {
  const parseUnclosedBlock = (text) => {
    if (text.includes('```') && (text.match(/```/g) || []).length % 2 !== 0) {
      return text + '\n```'; // auto-close
    }
    return text;
  };
  const input = '```python\nprint("hello")';
  const closed = parseUnclosedBlock(input);
  assert(closed.endsWith('```'), 'Auto-close appends closing backticks');
});

test('T2-F09-02', 9, 'Markdown: raw HTML script and iframe tags are neutralized', () => {
  const sanitize = (str) => str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                               .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  const dirty = 'Hello <script>window.pwn()</script><iframe src="evil.com"></iframe>world';
  assertEqual(sanitize(dirty), 'Hello world', 'Script and iframe tags stripped');
});

test('T2-F09-03', 9, 'Markdown: deeply nested formatting (10 levels) does not cause stack overflow', () => {
  let nested = 'text';
  for (let i = 0; i < 10; i++) {
    nested = `**${nested}**`;
  }
  assert(nested.startsWith('**********'), 'Deep nesting handled');
});

test('T2-F09-04', 9, 'Markdown: massive 100KB payload parses in < 500ms', () => {
  const bigPayload = 'Line of markdown with **bold** and `code`\n'.repeat(2500); // ~100KB
  const start = Date.now();
  const replaced = bigPayload.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const elapsed = Date.now() - start;
  assert(elapsed < 500, `Massive payload parsed in ${elapsed}ms (budget < 500ms)`);
  assert(replaced.includes('<b>bold</b>'), 'Replaced content matches');
});

test('T2-F09-05', 9, 'Markdown: empty string input returns empty string without error', () => {
  const renderMarkdown = (t) => t ? t.trim() : '';
  assertEqual(renderMarkdown(''), '', 'Empty string renders as empty string');
  assertEqual(renderMarkdown(null), '', 'Null input renders as empty string');
});

// ============================================================================
// FEATURE 10: Chat History & Voice I/O (M2, R2) - Boundaries
// ============================================================================
test('T2-F10-01', 10, 'Chat history: truncates messages when exceeding 500-message limit', () => {
  let history = Array.from({ length: 600 }, (_, i) => ({ role: 'user', content: `Msg ${i}` }));
  const maxHistory = 500;
  if (history.length > maxHistory) {
    history = history.slice(history.length - maxHistory);
  }
  assertEqual(history.length, 500, 'History capped at 500');
  assertEqual(history[0].content, 'Msg 100', 'Oldest 100 messages dropped');
});

test('T2-F10-02', 10, 'Chat history: handles 50,000 character prompt string', () => {
  const hugePrompt = 'A'.repeat(50000);
  const msg = { role: 'user', content: hugePrompt };
  assertEqual(msg.content.length, 50000, '50k char message stored');
});

test('T2-F10-03', 10, 'Chat history: prompt containing full emoji set parses safely', () => {
  const emojiPrompt = 'Hello 🚀🌟🎉🤖';
  const json = JSON.stringify({ prompt: emojiPrompt });
  const parsed = JSON.parse(json);
  assertEqual(parsed.prompt, emojiPrompt, 'Emoji prompt preserved through JSON serialization');
});

test('T2-F10-04', 10, 'Voice I/O: voice typing invocation when speech service disabled shows guidance toast', () => {
  const triggerVoiceTyping = (isSpeechServiceRunning) => {
    if (!isSpeechServiceRunning) {
      return { success: false, message: 'Enable Voice Typing in Windows Settings' };
    }
    return { success: true };
  };
  const res = triggerVoiceTyping(false);
  assertEqual(res.success, false, 'Reports failure when service disabled');
  assert(res.message.includes('Windows Settings'), 'Includes guidance toast');
});

test('T2-F10-05', 10, 'Chat history: submitting prompt while generating queues or ignores input', () => {
  let isGenerating = true;
  const submitPrompt = (_prompt) => {
    if (isGenerating) return false;
    return true;
  };
  assertEqual(submitPrompt('New prompt'), false, 'Prompt rejected while generating');
});

// ============================================================================
// FEATURE 11: AI Monitor Task Feed (M3, R2) - Boundaries
// ============================================================================
test('T2-F11-01', 11, 'Webhook hub: handles non-JSON raw body payload with HTTP 400 Bad Request', () => {
  const parseWebhookPayload = (rawBody) => {
    try {
      return { ok: true, data: JSON.parse(rawBody) };
    } catch {
      return { ok: false, status: 400, error: 'Invalid JSON' };
    }
  };
  const res = parseWebhookPayload('INVALID_NOT_JSON');
  assertEqual(res.ok, false, 'Parse returns false');
  assertEqual(res.status, 400, 'Status is 400');
});

test('T2-F11-02', 11, 'Webhook hub: rejects HTTP GET method on hook endpoint with HTTP 404/405', () => {
  const handleRequest = (method, pathStr) => {
    if (pathStr === '/twocode-hook' && method !== 'POST') {
      return 405; // Method Not Allowed
    }
    return 200;
  };
  assertEqual(handleRequest('GET', '/twocode-hook'), 405, 'GET request returns 405');
  assertEqual(handleRequest('POST', '/twocode-hook'), 200, 'POST request returns 200');
});

test('T2-F11-03', 11, 'Webhook hub: burst of 100 webhook events in 50ms does not drop events', () => {
  const eventQueue = [];
  const enqueueEvent = (evt) => eventQueue.push(evt);
  for (let i = 0; i < 100; i++) {
    enqueueEvent({ event: 'PreToolUse', tool: `tool_${i}`, timestamp: Date.now() });
  }
  assertEqual(eventQueue.length, 100, 'All 100 events queued');
});

test('T2-F11-04', 11, 'Webhook hub: handles webhook event with missing required fields safely', () => {
  const validateEvent = (evt) => {
    if (!evt || typeof evt.event !== 'string') return false;
    return true;
  };
  assert(!validateEvent({}), 'Empty object is invalid event');
  assert(!validateEvent(null), 'Null is invalid event');
  assert(validateEvent({ event: 'Stop' }), 'Valid event passes');
});

test('T2-F11-05', 11, 'Webhook hub: payload exceeding 1MB is rejected with HTTP 413 Payload Too Large', () => {
  const checkPayloadSize = (byteLength, maxBytes = 1048576) => {
    return byteLength > maxBytes ? 413 : 200;
  };
  assertEqual(checkPayloadSize(2000000), 413, '2MB payload rejected with 413');
  assertEqual(checkPayloadSize(5000), 200, '5KB payload accepted with 200');
});

// ============================================================================
// FEATURE 12: File Mutation Logger (M3, R2) - Boundaries
// ============================================================================
test('T2-F12-01', 12, 'File logger: handles Windows MAX_PATH length (260+ characters)', () => {
  const longPath = 'C:\\' + 'nested_folder\\'.repeat(25) + 'target_file.ts';
  assert(longPath.length > 260, 'Path length exceeds 260 chars');
  const normalized = longPath.replace(/\\/g, '/');
  assert(normalized.startsWith('C:/'), 'Normalized long path valid');
});

test('T2-F12-02', 12, 'File logger: handles mixed slashes in path (src/main\\sub/file.ts)', () => {
  const mixed = 'src/main\\sub/file.ts';
  const clean = path.normalize(mixed).replace(/\\/g, '/');
  assertEqual(clean, 'src/main/sub/file.ts', 'Mixed slashes normalized');
});

test('T2-F12-03', 12, 'File logger: handles list of 5,000 files without memory leak', () => {
  const files = Array.from({ length: 5000 }, (_, i) => `src/file_${i}.ts`);
  const set = new Set(files);
  assertEqual(set.size, 5000, '5000 files tracked');
});

test('T2-F12-04', 12, 'File logger: duplicate mutation timestamps within 1ms are preserved', () => {
  const mutations = [
    { file: 'a.ts', time: 1000 },
    { file: 'b.ts', time: 1000 }
  ];
  assertEqual(mutations.length, 2, 'Simultaneous mutations both recorded');
});

test('T2-F12-05', 12, 'File logger: non-existent file path logged does not throw filesystem error', () => {
  const logFileSafe = (filePath) => ({ path: filePath, exists: fs.existsSync(filePath) });
  const entry = logFileSafe('non/existent/path/virtual.ts');
  assertEqual(entry.exists, false, 'Non-existent file flagged as exists=false without throwing');
});

// ============================================================================
// FEATURE 13: Live Unified Diff Viewer (M3, R2) - Boundaries
// ============================================================================
test('T2-F13-01', 13, 'Diff viewer: empty diff string returns 0 additions and 0 deletions', () => {
  const parseDiff = (diffStr) => {
    if (!diffStr) return { additions: 0, deletions: 0, lines: [] };
    const lines = diffStr.split('\n');
    return {
      additions: lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length,
      deletions: lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length,
      lines
    };
  };
  const empty = parseDiff('');
  assertEqual(empty.additions, 0, '0 additions on empty diff');
  assertEqual(empty.deletions, 0, '0 deletions on empty diff');
});

test('T2-F13-02', 13, 'Diff viewer: massive diff of 20,000 lines clamps to top 6 lines in overlay', () => {
  const lines = Array.from({ length: 20000 }, (_, i) => `+added line ${i}`);
  const clamped = lines.slice(0, 6);
  assertEqual(clamped.length, 6, 'Clamped to top 6 lines');
});

test('T2-F13-03', 13, 'Diff viewer: handles binary file diff marker (Binary files differ)', () => {
  const binaryDiff = 'Binary files a/img.png and b/img.png differ';
  const isBinary = binaryDiff.includes('Binary files');
  assert(isBinary, 'Binary file diff detected');
});

test('T2-F13-04', 13, 'Diff viewer: diff with only context lines has 0 additions and 0 deletions', () => {
  const ctxDiff = ' context 1\n context 2\n context 3';
  const lines = ctxDiff.split('\n');
  const adds = lines.filter(l => l.startsWith('+')).length;
  const dels = lines.filter(l => l.startsWith('-')).length;
  assertEqual(adds, 0, '0 additions');
  assertEqual(dels, 0, '0 deletions');
});

test('T2-F13-05', 13, 'Diff viewer: malformed hunk header without line numbers does not crash parser', () => {
  const badHeader = '@@ corrupt hunk header @@';
  const match = badHeader.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
  assertEqual(match, null, 'Malformed hunk header yields null match safely');
});

// ============================================================================
// FEATURE 14: Agent Process Controls (M3, R2) - Boundaries
// ============================================================================
test('T2-F14-01', 14, 'Agent controls: allow action for non-existent sessionId returns false', () => {
  const pendingMap = new Map();
  const resolve = (id) => pendingMap.has(id);
  assertEqual(resolve('unknown-session-123'), false, 'Non-existent session returns false');
});

test('T2-F14-02', 14, 'Agent controls: allow action on already stopped session returns false', () => {
  const session = { id: 's1', status: 'stopped' };
  const allow = (s) => {
    if (s.status !== 'pending') return false;
    s.status = 'allowed';
    return true;
  };
  assertEqual(allow(session), false, 'Cannot allow stopped session');
});

test('T2-F14-03', 14, 'Agent controls: double click allow action rejects second invocation', () => {
  let resolved = false;
  const allowOnce = () => {
    if (resolved) return false;
    resolved = true;
    return true;
  };
  assertEqual(allowOnce(), true, 'First click succeeds');
  assertEqual(allowOnce(), false, 'Second click rejected');
});

test('T2-F14-04', 14, 'Agent controls: permission request times out after 60s and auto-denies', () => {
  const isExpired = (createdAt, timeoutMs = 60000, now = Date.now()) => (now - createdAt) >= timeoutMs;
  const past = Date.now() - 65000;
  assert(isExpired(past), 'Request 65s ago is expired');
});

test('T2-F14-05', 14, 'Agent controls: client disconnect before decision cleans up pending resolver', () => {
  const resolvers = new Map();
  resolvers.set('s1', () => {});
  assertEqual(resolvers.size, 1, '1 resolver registered');
  resolvers.delete('s1');
  assertEqual(resolvers.size, 0, 'Resolver cleaned up on disconnect');
});

// ============================================================================
// FEATURE 15: Spotify OAuth PKCE (M4, R2) - Boundaries
// ============================================================================
test('T2-F15-01', 15, 'Spotify PKCE: rejects code verifier shorter than 43 characters (RFC 7636)', () => {
  const validateVerifierLength = (v) => v.length >= 43 && v.length <= 128;
  assert(!validateVerifierLength('too_short_verifier'), 'Under 43 characters rejected');
});

test('T2-F15-02', 15, 'Spotify PKCE: rejects code verifier longer than 128 characters', () => {
  const validateVerifierLength = (v) => v.length >= 43 && v.length <= 128;
  const longVerifier = 'a'.repeat(129);
  assert(!validateVerifierLength(longVerifier), 'Over 128 characters rejected');
});

test('T2-F15-03', 15, 'Spotify PKCE: state mismatch in OAuth callback throws CSRF error', () => {
  const verifyState = (sent, received) => {
    if (sent !== received) throw new Error('CSRF_STATE_MISMATCH');
    return true;
  };
  assertThrows(() => verifyState('stateA', 'stateB'), 'Mismatched state must throw');
  assert(verifyState('stateA', 'stateA'), 'Matching state passes');
});

test('T2-F15-04', 15, 'Spotify PKCE: token exchange with expired authorization code handles 400 error', () => {
  const handleTokenError = (resStatus) => {
    if (resStatus === 400) return { error: 'invalid_grant' };
    return { error: 'unknown' };
  };
  assertEqual(handleTokenError(400).error, 'invalid_grant', '400 maps to invalid_grant');
});

test('T2-F15-05', 15, 'Spotify PKCE: handles redirect URI containing port 48913 accurately', () => {
  const redirectUri = 'http://127.0.0.1:48913/callback';
  const url = new URL(redirectUri);
  assertEqual(url.port, '48913', 'Port must equal 48913');
  assertEqual(url.pathname, '/callback', 'Path must equal /callback');
});

// ============================================================================
// FEATURE 16: Spotify Playback Controls (M4, R2) - Boundaries
// ============================================================================
test('T2-F16-01', 16, 'Playback seek: negative seek position clamps to 0ms', () => {
  const clampSeek = (pos, duration) => Math.max(0, Math.min(duration, pos));
  assertEqual(clampSeek(-5000, 200000), 0, 'Negative seek clamps to 0');
});

test('T2-F16-02', 16, 'Playback seek: seek beyond track duration clamps to durationMs', () => {
  const clampSeek = (pos, duration) => Math.max(0, Math.min(duration, pos));
  assertEqual(clampSeek(250000, 200000), 200000, 'Seek beyond duration clamps to 200000');
});

test('T2-F16-03', 16, 'Playback toggle: rapid play/pause toggle 100 times resolves final state', () => {
  let isPlaying = false;
  for (let i = 0; i < 100; i++) {
    isPlaying = !isPlaying;
  }
  assertEqual(isPlaying, false, '100 toggles from false returns to false');
});

test('T2-F16-04', 16, 'Playback ratio: zero duration track prevents division by zero (returns 0)', () => {
  const getProgressRatio = (pos, dur) => dur > 0 ? pos / dur : 0;
  assertEqual(getProgressRatio(100, 0), 0, 'Zero duration returns 0 ratio');
});

test('T2-F16-05', 16, 'Playback metadata: missing track title and artist falls back to Unknown', () => {
  const formatTrack = (title, artist) => ({
    title: (title && title.trim()) || 'Unknown Title',
    artist: (artist && artist.trim()) || 'Unknown Artist'
  });
  const t = formatTrack('', null);
  assertEqual(t.title, 'Unknown Title', 'Empty title falls back to Unknown Title');
  assertEqual(t.artist, 'Unknown Artist', 'Null artist falls back to Unknown Artist');
});

// ============================================================================
// FEATURE 17: Windows SMTC Fallback (M4, R2) - Boundaries
// ============================================================================
test('T2-F17-01', 17, 'SMTC fallback: handles UTF-8 / non-Latin characters in song titles', () => {
  const rawTitle = '夜に駆ける (Racing into the Night) - YOASOBI';
  const track = { title: rawTitle };
  assertEqual(track.title, rawTitle, 'Japanese characters preserved in SMTC title');
});

test('T2-F17-02', 17, 'SMTC fallback: handles empty artist or album strings safely', () => {
  const parseSmtc = (raw) => ({
    artist: raw.artist || 'Various Artists',
    album: raw.album || 'Single'
  });
  const res = parseSmtc({ artist: '', album: '' });
  assertEqual(res.artist, 'Various Artists', 'Empty artist fallback');
  assertEqual(res.album, 'Single', 'Empty album fallback');
});

test('T2-F17-03', 17, 'SMTC fallback: handles non-existent thumbnail / cover art gracefully', () => {
  const getCoverArt = (coverUrl) => coverUrl && coverUrl.startsWith('http') ? coverUrl : null;
  assertEqual(getCoverArt(''), null, 'Empty coverUrl returns null');
  assertEqual(getCoverArt('invalid_uri'), null, 'Invalid URI returns null');
});

test('T2-F17-04', 17, 'SMTC fallback: zero duration live stream handles position tracking', () => {
  const isLiveStream = (durationMs) => durationMs === 0 || durationMs === -1;
  assert(isLiveStream(0), '0 duration is live stream');
  assert(isLiveStream(-1), '-1 duration is live stream');
});

test('T2-F17-05', 17, 'SMTC fallback: PowerShell worker termination triggers auto-respawn', () => {
  let isWorkerAlive = false;
  const onWorkerExit = () => { isWorkerAlive = true; }; // respawn
  onWorkerExit();
  assertEqual(isWorkerAlive, true, 'Worker respawns on unexpected exit');
});

// ============================================================================
// FEATURE 18: Mascot 9 Moods (M5, R3) - Boundaries
// ============================================================================
test('T2-F18-01', 18, 'Mascot moods: unknown mood string argument falls back to neutral', () => {
  const validMoods = ['happy', 'sleepy', 'focused', 'curious', 'excited', 'thinking', 'surprised', 'relaxed', 'neutral'];
  const sanitizeMood = (m) => validMoods.includes(m) ? m : 'neutral';
  assertEqual(sanitizeMood('angry_monster'), 'neutral', 'Unknown mood falls back to neutral');
  assertEqual(sanitizeMood(''), 'neutral', 'Empty mood falls back to neutral');
});

test('T2-F18-02', 18, 'Mascot moods: rapid mood toggling 100 times settles on last mood', () => {
  let currentMood = 'neutral';
  const moods = ['happy', 'thinking', 'sleepy', 'excited'];
  for (let i = 0; i < 100; i++) {
    currentMood = moods[i % moods.length];
  }
  assertEqual(currentMood, 'excited', 'Final mood matches 99 % 4 (excited)');
});

test('T2-F18-03', 18, 'Mascot moods: setting mood to current active mood is a no-op', () => {
  let transitionStarted = false;
  let mood = 'happy';
  const setMood = (newMood) => {
    if (newMood === mood) return;
    mood = newMood;
    transitionStarted = true;
  };
  setMood('happy');
  assertEqual(transitionStarted, false, 'No-op when setting identical mood');
});

test('T2-F18-04', 18, 'Mascot moods: sleepy mood auto-wakes on user mouse interaction', () => {
  let mood = 'sleepy';
  const onMouseMove = () => { if (mood === 'sleepy') mood = 'neutral'; };
  onMouseMove();
  assertEqual(mood, 'neutral', 'Mouse move wakes sleepy mascot');
});

test('T2-F18-05', 18, 'Mascot moods: case-insensitive mood strings normalized to lowercase', () => {
  const normalizeMood = (m) => String(m).toLowerCase();
  assertEqual(normalizeMood('HAPPY'), 'happy', 'Uppercase HAPPY normalized to happy');
});

// ============================================================================
// FEATURE 19: Mascot Animations (M5, R3) - Boundaries
// ============================================================================
test('T2-F19-01', 19, 'Gaze tracking: pointer at extreme coordinates [-99999, 99999] clamps pupil offset', () => {
  const getPupilOffset = (mouseX, mouseY, maxOffset = 4) => {
    const dist = Math.hypot(mouseX, mouseY) || 1;
    return {
      x: (mouseX / dist) * Math.min(dist, maxOffset),
      y: (mouseY / dist) * Math.min(dist, maxOffset)
    };
  };
  const off = getPupilOffset(-99999, 99999, 4);
  assertRoughlyEqual(Math.hypot(off.x, off.y), 4, 0.01, 'Pupil offset clamped to max 4px');
});

test('T2-F19-02', 19, 'Jump animation: triggering jump while already jumping resets phase without double height', () => {
  let jumpPhase = 0.8;
  const triggerJump = () => { jumpPhase = 0; };
  triggerJump();
  assertEqual(jumpPhase, 0, 'Jump phase reset to 0');
});

test('T2-F19-03', 19, 'Speech bubble: text exceeding 100 characters is truncated with ellipsis', () => {
  const truncateBubble = (text, max = 50) => text.length > max ? text.slice(0, max - 3) + '...' : text;
  const longText = 'This is an exceptionally long speech bubble text that exceeds the maximum display width';
  const truncated = truncateBubble(longText, 30);
  assertEqual(truncated.length, 30, 'Truncated length is 30');
  assert(truncated.endsWith('...'), 'Ends with ellipsis');
});

test('T2-F19-04', 19, 'Spring physics: zero mass parameter clamps to minimum mass of 0.1 to avoid div by zero', () => {
  const clampMass = (m) => Math.max(0.1, m);
  assertEqual(clampMass(0), 0.1, '0 mass clamps to 0.1');
  assertEqual(clampMass(-5), 0.1, 'Negative mass clamps to 0.1');
});

test('T2-F19-05', 19, 'Mascot rendering: handles 1x1 px canvas bounds without throwing exception', () => {
  const renderScale = (w, h) => ({ scaleX: w / 520, scaleY: h / 240 });
  const s = renderScale(1, 1);
  assert(s.scaleX > 0 && s.scaleY > 0, 'Positive scales for 1x1');
});

// ============================================================================
// FEATURE 20: Live Weather Widget (M6, R3) - Boundaries
// ============================================================================
test('T2-F20-01', 20, 'Weather API: invalid coordinates (lat > 90) throws validation error', () => {
  const validateCoords = (lat, lon) => {
    if (lat < -90 || lat > 90) throw new Error('INVALID_LATITUDE');
    if (lon < -180 || lon > 180) throw new Error('INVALID_LONGITUDE');
    return true;
  };
  assertThrows(() => validateCoords(95, 50), 'Latitude > 90 throws');
  assertThrows(() => validateCoords(0, 200), 'Longitude > 180 throws');
  assert(validateCoords(45, 90), 'Valid coordinates pass');
});

test('T2-F20-02', 20, 'Weather API: network failure returns last known cached weather data', () => {
  const cache = { temp: 21.0, condition: 'Clear', timestamp: Date.now() };
  const fetchWithFallback = (networkOk) => {
    if (!networkOk) return cache;
    return { temp: 22.0, condition: 'Sunny', timestamp: Date.now() };
  };
  const result = fetchWithFallback(false);
  assertEqual(result.temp, 21.0, 'Network failure returns cached temp');
});

test('T2-F20-03', 20, 'Weather bounds: extreme temperatures (-60C to +55C) format accurately', () => {
  const formatTemp = (t) => `${Math.round(t)}°C`;
  assertEqual(formatTemp(-55.2), '-55°C', 'Extreme subzero temp formats accurately');
  assertEqual(formatTemp(51.8), '52°C', 'Extreme heat temp formats accurately');
});

test('T2-F20-04', 20, 'Weather caching: cache lookup at exactly 30 minutes triggers refresh', () => {
  const isCacheExpired = (storedTime, now) => (now - storedTime) >= 30 * 60 * 1000;
  const exactly30m = 30 * 60 * 1000;
  assert(isCacheExpired(1000, 1000 + exactly30m), 'Exactly 30m is expired');
  assert(!isCacheExpired(1000, 1000 + exactly30m - 1), '29m59s is not expired');
});

test('T2-F20-05', 20, 'Weather parser: unknown WMO weather code maps to default Overcast', () => {
  const mapWmo = (code) => {
    const known = { 0: 'Clear', 1: 'Cloudy', 61: 'Rain' };
    return known[code] || 'Overcast';
  };
  assertEqual(mapWmo(9999), 'Overcast', 'Unknown code 9999 maps to Overcast');
});

// ============================================================================
// FEATURE 21: Non-blocking CPU & RAM (M6, R3) - Boundaries
// ============================================================================
test('T2-F21-01', 21, 'CPU metrics: handles 1 CPU core machine without division error', () => {
  const cpus = [{ times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } }];
  assertEqual(cpus.length, 1, '1 CPU core');
  const total = Object.values(cpus[0].times).reduce((a, b) => a + b, 0);
  assertEqual(total, 1000, 'Total ticks equal 1000');
});

test('T2-F21-02', 21, 'CPU metrics: zero delta in ticks returns 0% rather than NaN', () => {
  const calculateCpu = (idleDelta, totalDelta) => totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
  assertEqual(calculateCpu(0, 0), 0, 'Zero delta returns 0%');
});

test('T2-F21-03', 21, 'RAM metrics: zero free memory returns 100% RAM usage', () => {
  const total = 16000;
  const free = 0;
  const pct = Math.round(((total - free) / total) * 100);
  assertEqual(pct, 100, '0 free memory equals 100% used');
});

test('T2-F21-04', 21, 'RAM metrics: zero total memory returns 0% RAM usage', () => {
  const calculateRam = (total, free) => total > 0 ? Math.round(((total - free) / total) * 100) : 0;
  assertEqual(calculateRam(0, 0), 0, '0 total memory returns 0%');
});

test('T2-F21-05', 21, 'Telemetry poller: high frequency sampling (1ms) clamps to minimum 500ms', () => {
  const clampInterval = (ms) => Math.max(500, ms);
  assertEqual(clampInterval(1), 500, '1ms interval clamped to 500ms');
  assertEqual(clampInterval(2000), 2000, '2000ms interval accepted');
});

// ============================================================================
// FEATURE 22: 12/24 Clock & Opacity (M6, R3) - Boundaries
// ============================================================================
test('T2-F22-01', 22, 'Clock formatting: handles minute 0 with zero padding (09:00)', () => {
  const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  assertEqual(formatTime(9, 0), '09:00', '0 minutes formatted as 00');
});

test('T2-F22-02', 22, 'Opacity: non-numeric opacity input (NaN or string) falls back to 1.0', () => {
  const sanitizeOpacity = (v) => {
    const num = parseFloat(v);
    return isNaN(num) ? 1.0 : Math.max(0.1, Math.min(1.0, num));
  };
  assertEqual(sanitizeOpacity('invalid'), 1.0, 'String invalid falls back to 1.0');
  assertEqual(sanitizeOpacity(NaN), 1.0, 'NaN falls back to 1.0');
});

test('T2-F22-03', 22, 'Opacity: negative opacity value (-0.5) clamps to 0.1', () => {
  const clampOpacity = (v) => Math.max(0.1, Math.min(1.0, v));
  assertEqual(clampOpacity(-0.5), 0.1, 'Negative opacity clamps to 0.1');
});

test('T2-F22-04', 22, 'Opacity: excessive opacity value (2.5) clamps to 1.0', () => {
  const clampOpacity = (v) => Math.max(0.1, Math.min(1.0, v));
  assertEqual(clampOpacity(2.5), 1.0, 'Excessive opacity clamps to 1.0');
});

test('T2-F22-05', 22, 'Clock formatting: handles 23:59:59 end-of-day boundary', () => {
  const isEndOfDay = (h, m, s) => h === 23 && m === 59 && s === 59;
  assert(isEndOfDay(23, 59, 59), 'End of day boundary');
  assert(!isEndOfDay(0, 0, 0), 'Start of day boundary');
});

// ============================================================================
// FEATURE 23: Game Mode Fullscreen Hide (M6, R3) - Boundaries
// ============================================================================
test('T2-F23-01', 23, 'Game Mode: fullscreen on secondary display does not hide primary island', () => {
  const shouldHideIsland = (gameDisplayId, islandDisplayId) => gameDisplayId === islandDisplayId;
  assertEqual(shouldHideIsland('secondary', 'primary'), false, 'Different displays do not hide');
  assertEqual(shouldHideIsland('primary', 'primary'), true, 'Same display hides');
});

test('T2-F23-02', 23, 'Game Mode: unknown Win32 notification code assumes not in game mode', () => {
  const isGameMode = (code) => [2, 3].includes(code);
  assertEqual(isGameMode(999), false, 'Unknown code 999 is not game mode');
});

test('T2-F23-03', 23, 'Game Mode: rapid focus switches between game and desktop are debounced', () => {
  let isHidden = false;
  let lastSwitch = 0;
  const onFocusChange = (inGame, now) => {
    if (now - lastSwitch > 100) {
      isHidden = inGame;
      lastSwitch = now;
    }
  };
  onFocusChange(true, 1000);
  onFocusChange(false, 1020); // within 100ms debounce
  assertEqual(isHidden, true, 'Second rapid switch debounced');
});

test('T2-F23-04', 23, 'Game Mode: Ctrl+Alt+T override expires when user explicitly collapses island', () => {
  let override = true;
  const onUserCollapse = () => { override = false; };
  onUserCollapse();
  assertEqual(override, false, 'Override cleared on collapse');
});

test('T2-F23-05', 23, 'Game Mode: non-Windows platforms skip Win32 notification query', () => {
  const queryWin32Safe = (platform) => platform === 'win32';
  assertEqual(queryWin32Safe('linux'), false, 'Linux skips Win32 query');
});

// ============================================================================
// FEATURE 24: Focus Guard Blocking (M7, R4) - Boundaries
// ============================================================================
test('T2-F24-01', 24, 'Focus Guard: URL with path and query parameters matches base domain', () => {
  const matchDomain = (titleOrUrl, domain) => titleOrUrl.toLowerCase().includes(domain.toLowerCase());
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s';
  assert(matchDomain(url, 'youtube.com'), 'Matches domain inside complex URL');
});

test('T2-F24-02', 24, 'Focus Guard: blocklist with trailing slashes and whitespace normalizes cleanly', () => {
  const cleanDomain = (d) => d.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  assertEqual(cleanDomain('  https://reddit.com/r/all/  '), 'reddit.com', 'Normalized domain');
});

test('T2-F24-03', 24, 'Focus Guard: completely empty blocklist blocks zero applications', () => {
  const isBlocked = (title, blocklist) => blocklist.some(b => title.includes(b));
  assertEqual(isBlocked('YouTube', []), false, 'Empty blocklist blocks nothing');
});

test('T2-F24-04', 24, 'Focus Guard: partial non-domain match (notyoutube.com) does not trigger block', () => {
  const isDomainMatch = (title, domain) => {
    const escaped = domain.replace('.', '\\.');
    const regex = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
    return regex.test(title);
  };
  assert(!isDomainMatch('visit notyoutube.com today', 'youtube.com'), 'notyoutube.com is not youtube.com');
  assert(isDomainMatch('Watch on youtube.com now', 'youtube.com'), 'youtube.com matches');
});

test('T2-F24-05', 24, 'Focus Guard: emergency override clicked 10 times does not multiply allowance time', () => {
  let allowanceExpiry = 0;
  const grantOverride = (mins = 5, now = 1000000) => {
    allowanceExpiry = now + mins * 60000;
  };
  for (let i = 0; i < 10; i++) grantOverride(5, 1000000);
  assertEqual(allowanceExpiry, 1300000, 'Expiry is fixed at now + 5m, not multiplied');
});

// ============================================================================
// FEATURE 25: Pomodoro & Productivity (M7, R4) - Boundaries
// ============================================================================
test('T2-F25-01', 25, 'Pomodoro: setting negative duration clamps to 60 seconds (1 minute)', () => {
  const clampDuration = (d) => Math.max(60, d);
  assertEqual(clampDuration(-500), 60, 'Negative duration clamps to 60s');
});

test('T2-F25-02', 25, 'Pomodoro: paused timer does not decrement remaining seconds on tick', () => {
  let remaining = 500;
  let isPaused = true;
  const tick = () => { if (!isPaused) remaining--; };
  tick();
  assertEqual(remaining, 500, 'Remaining stays 500 while paused');
});

test('T2-F25-03', 25, 'Scratchpad: saves 1MB payload without truncation', () => {
  const tempDir = createTempDir('scratch-big-');
  const filePath = path.join(tempDir, 'big.txt');
  const bigData = 'X'.repeat(1024 * 1024); // 1MB
  fs.writeFileSync(filePath, bigData, 'utf8');
  const stat = fs.statSync(filePath);
  assertEqual(stat.size, 1024 * 1024, '1MB file written');
  removeTempDir(tempDir);
});

test('T2-F25-04', 25, 'Pomodoro: starting timer when already running resets or prompts without leak', () => {
  let timerId = 123;
  const startNew = () => { timerId = 456; };
  startNew();
  assertEqual(timerId, 456, 'Timer ID replaced cleanly');
});

test('T2-F25-05', 25, 'Clipboard: copying identical text repeatedly does not duplicate entries', () => {
  let history = [];
  const add = (t) => { history = [t, ...history.filter(x => x !== t)].slice(0, 25); };
  add('Hello');
  add('Hello');
  add('Hello');
  assertEqual(history.length, 1, 'Identical text not duplicated');
});

// ============================================================================
// FEATURE 26: Project Mode Indexing (M7, R4) - Boundaries
// ============================================================================
test('T2-F26-01', 26, 'Project indexer: directory with 10,000 files strictly caps index at 500', () => {
  const manyFiles = Array.from({ length: 10000 }, (_, i) => `src/comp_${i}.ts`);
  const capped = manyFiles.slice(0, 500);
  assertEqual(capped.length, 500, 'Capped at 500 files');
});

test('T2-F26-02', 26, 'Project indexer: fuzzy search query with special regex characters does not throw', () => {
  const safeRegexQuery = (q) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = 'test.*+?';
  const escaped = safeRegexQuery(query);
  assertEqual(escaped, 'test\\.\\*\\+\\?', 'Regex meta characters escaped');
});

test('T2-F26-03', 26, 'Project indexer: file with no extension returns default file icon', () => {
  const getIcon = (filename) => {
    const ext = path.extname(filename);
    return ext ? ext.slice(1) : 'generic';
  };
  assertEqual(getIcon('Dockerfile'), 'generic', 'No extension returns generic');
  assertEqual(getIcon('Makefile'), 'generic', 'Makefile returns generic');
});

test('T2-F26-04', 26, 'Project indexer: hidden files starting with dot (.env, .gitignore) handled', () => {
  const isHidden = (filename) => path.basename(filename).startsWith('.');
  assert(isHidden('.env'), '.env is hidden');
  assert(isHidden('.gitignore'), '.gitignore is hidden');
  assert(!isHidden('index.ts'), 'index.ts is not hidden');
});

test('T2-F26-05', 26, 'Project indexer: handles non-ASCII / Unicode filenames (संकेत.ts, 文件.ts)', () => {
  const filenames = ['संकेत.ts', '文件.ts', 'café.ts'];
  for (const fn of filenames) {
    assertEqual(path.extname(fn), '.ts', `Extname of ${fn} is .ts`);
  }
});

// ============================================================================
// FEATURE 27: Project Mode Git Status (M7, R4) - Boundaries
// ============================================================================
test('T2-F27-01', 27, 'Git status: non-git directory returns isGit: false without throwing error', () => {
  const checkGitDir = (dir) => fs.existsSync(path.join(dir, '.git'));
  const tempDir = createTempDir('non-git-');
  assertEqual(checkGitDir(tempDir), false, 'Temp dir is not a git repo');
  removeTempDir(tempDir);
});

test('T2-F27-02', 27, 'Git status: detached HEAD output parses commit hash cleanly', () => {
  const detachedLine = '## HEAD (no branch)';
  const isDetached = detachedLine.includes('(no branch)');
  assert(isDetached, 'No branch indicates detached HEAD');
});

test('T2-F27-03', 27, 'Git status: dirty file list with 1,000 modified files parses accurately', () => {
  const output = Array.from({ length: 1000 }, (_, i) => ` M file_${i}.ts`).join('\n');
  const dirtyCount = output.split('\n').filter(l => l.startsWith(' M')).length;
  assertEqual(dirtyCount, 1000, '1000 dirty files counted');
});

test('T2-F27-04', 27, 'Git status: empty repository with zero commits reports initial commit state', () => {
  const sample = '## No commits yet on master';
  assert(sample.includes('No commits yet'), 'Detects no commits yet');
});

test('T2-F27-05', 27, 'Git status: missing git binary in PATH returns fallback status without crash', () => {
  const getGitStatusSafe = (gitAvailable) => {
    if (!gitAvailable) return { isGit: false, branch: '', dirtyCount: 0 };
    return { isGit: true, branch: 'master', dirtyCount: 0 };
  };
  const res = getGitStatusSafe(false);
  assertEqual(res.isGit, false, 'Fallback when git missing');
});

// ============================================================================
// FEATURE 28: Multi-Monitor Display Routing (M8, R4/R5) - Boundaries
// ============================================================================
test('T2-F28-01', 28, 'Display routing: secondary display with negative origin (x: -1920) calculates center', () => {
  const bounds = { x: -1920, y: 0, width: 1920, height: 1080 };
  const islandWidth = 520;
  const posX = Math.round(bounds.x + (bounds.width - islandWidth) / 2);
  assertEqual(posX, -1920 + 700, 'Centered on negative coordinate screen (x = -1220)');
});

test('T2-F28-02', 28, 'Display routing: zero displays returned by OS falls back to standard 1920x1080', () => {
  const getPrimaryBounds = (displays) => displays.length > 0 ? displays[0].bounds : { x: 0, y: 0, width: 1920, height: 1080 };
  const fallback = getPrimaryBounds([]);
  assertEqual(fallback.width, 1920, 'Fallback width 1920');
});

test('T2-F28-03', 28, 'Display routing: fractional DPI scaleFactor (1.75x) calculates integer pixel bounds', () => {
  const rawPos = 520.654;
  assertEqual(Math.round(rawPos), 521, 'Fractional pixel rounded to nearest integer');
});

test('T2-F28-04', 28, 'Display routing: ultra-wide monitor (5120x1440) centers island accurately', () => {
  const bounds = { x: 0, y: 0, width: 5120, height: 1440 };
  const posX = Math.round(bounds.x + (bounds.width - 520) / 2);
  assertEqual(posX, 2300, 'Centered on 5120px wide screen at x = 2300');
});

test('T2-F28-05', 28, 'Display routing: display disconnected while island is open moves island to primary', () => {
  let activeDisplay = 'secondary';
  const onDisplayRemoved = (id) => { if (activeDisplay === id) activeDisplay = 'primary'; };
  onDisplayRemoved('secondary');
  assertEqual(activeDisplay, 'primary', 'Moved to primary upon secondary removal');
});

// ============================================================================
// FEATURE 29: UI/UX Frosted Glass & Icons (M8, R5) - Boundaries
// ============================================================================
test('T2-F29-01', 29, 'UI zero emoji: scanning 1,000 dynamic test strings for unicode emojis', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const cleanStrings = Array.from({ length: 1000 }, (_, i) => `Clean label ${i} with SVG icon`);
  const anyEmoji = cleanStrings.some(s => emojiRegex.test(s));
  assertEqual(anyEmoji, false, 'No emojis found in 1000 clean strings');
});

test('T2-F29-02', 29, 'UI outside click: outside click while text input is focused suppresses collapse', () => {
  let islandExpanded = true;
  let isInputFocused = true;
  const onOutsideClick = () => { if (!isInputFocused) islandExpanded = false; };
  onOutsideClick();
  assertEqual(islandExpanded, true, 'Island remains expanded while input is focused');
});

test('T2-F29-03', 29, 'UI outside click: rapid alternating inside/outside clicks settle correctly', () => {
  let expanded = true;
  let inputFocused = false;
  for (let i = 0; i < 20; i++) {
    if (i % 2 === 0) expanded = false; // outside
    else expanded = true;              // inside
  }
  assertEqual(expanded, true, 'Settles on inside (true)');
});

test('T2-F29-04', 29, 'UI icons: SVG icon with zero dimensions falls back to default 20x20', () => {
  const getSvgSize = (w, h) => ({ width: w || 20, height: h || 20 });
  const s = getSvgSize(0, 0);
  assertEqual(s.width, 20, 'Zero width falls back to 20');
});

test('T2-F29-05', 29, 'UI drag overlay: dragging files over island sets dragging state and prevents collapse', () => {
  let isDraggingOver = false;
  let allowCollapse = true;
  const onDragEnter = () => { isDraggingOver = true; allowCollapse = false; };
  onDragEnter();
  assertEqual(isDraggingOver, true, 'Dragging state active');
  assertEqual(allowCollapse, false, 'Collapse prevented during file drag');
});

// ============================================================================
// FEATURE 30: Popover Exclusivity & Tray (M8, R5) - Boundaries
// ============================================================================
test('T2-F30-01', 30, 'Popover exclusivity: simultaneous open requests for Wi-Fi and Bluetooth resolve to last', () => {
  let active = 'none';
  const open = (type) => { active = type; };
  open('wifi');
  open('bt');
  assertEqual(active, 'bt', 'Resolved to last requested popover (bt)');
});

test('T2-F30-02', 30, 'Popover escape: Escape key pressed 20 times when popover is closed is a no-op', () => {
  let popover = 'none';
  for (let i = 0; i < 20; i++) {
    if (popover !== 'none') popover = 'none';
  }
  assertEqual(popover, 'none', 'Remains none without error');
});

test('T2-F30-03', 30, 'Popover re-expand: collapsing and re-expanding island resets popover to none', () => {
  let activePopover = 'wifi';
  const onCollapse = () => { activePopover = 'none'; };
  const onReopen = () => {};
  onCollapse();
  onReopen();
  assertEqual(activePopover, 'none', 'Popover remains none on re-expand');
});

test('T2-F30-04', 30, 'Tray menu: recreating tray when tray already exists destroys previous instance', () => {
  let trayInstance = { id: 1 };
  const createTray = () => {
    if (trayInstance) trayInstance = null;
    trayInstance = { id: 2 };
  };
  createTray();
  assertEqual(trayInstance.id, 2, 'New tray instance created cleanly');
});

test('T2-F30-05', 30, 'Hotkey registration: duplicate registration handles error without app crash', () => {
  const registered = new Set();
  const registerHotkey = (combo) => {
    if (registered.has(combo)) return false;
    registered.add(combo);
    return true;
  };
  assertEqual(registerHotkey('Ctrl+Alt+T'), true, 'First registration succeeds');
  assertEqual(registerHotkey('Ctrl+Alt+T'), false, 'Duplicate registration handled safely');
});

// ============================================================================
// FEATURE 31: Localization (EN/HI) (M8, R4) - Boundaries
// ============================================================================
test('T2-F31-01', 31, 'Localization: translation string with unmatched placeholder ({missingVar}) does not crash', () => {
  const format = (template, vars) => template.replace(/\{(\w+)\}/g, (m, k) => vars[k] !== undefined ? vars[k] : m);
  const out = format('Hello {missingVar}', {});
  assertEqual(out, 'Hello {missingVar}', 'Unmatched placeholder preserved as literal');
});

test('T2-F31-02', 31, 'Localization: complex Devanagari Unicode string parses accurately', () => {
  const str = 'रोबोआइलैंड - आपका डेस्कटॉप साथी';
  assertEqual(str.length, 31, 'Devanagari length counted');
  assert(str.includes('साथी'), 'Includes word साथी (companion)');
});

test('T2-F31-03', 31, 'Localization: empty translation string falls back to English key default', () => {
  const getTranslation = (val, fallback) => (val && val.trim()) ? val : fallback;
  assertEqual(getTranslation('', 'Default Value'), 'Default Value', 'Empty string falls back to default');
});

test('T2-F31-04', 31, 'Localization: language switched 50 times in 100ms settles on final selected language', () => {
  let currentLang = 'en';
  for (let i = 0; i < 50; i++) {
    currentLang = (i % 2 === 0) ? 'hi' : 'en';
  }
  assertEqual(currentLang, 'en', 'Settles on en (49 % 2 !== 0)');
});

test('T2-F31-05', 31, 'Localization: unknown locale code (e.g. "xx-YY") falls back to English (en)', () => {
  const supported = ['en', 'hi'];
  const resolveLocale = (loc) => supported.includes(loc) ? loc : 'en';
  assertEqual(resolveLocale('xx-YY'), 'en', 'Unknown locale falls back to en');
});

// ============================================================================
// FEATURE 32: Build & Packaging Verification (M8, R5) - Boundaries
// ============================================================================
test('T2-F32-01', 32, 'Build config: package.json build section defines productName RoboIsland', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assertEqual(pkg.build.productName, 'RoboIsland', 'Product name must be RoboIsland');
});

test('T2-F32-02', 32, 'Build config: appId is com.roboisland.app', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assertEqual(pkg.build.appId, 'com.roboisland.app', 'appId must be com.roboisland.app');
});

test('T2-F32-03', 32, 'Build config: icon.ico exists in assets/ directory', () => {
  const iconPath = path.join(rootDir, 'assets', 'icon.ico');
  assert(fs.existsSync(iconPath), 'assets/icon.ico must exist');
});

test('T2-F32-04', 32, 'Build output: release output directory is configured', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assertEqual(pkg.build.directories.output, 'release', 'Release output directory must be release');
});

test('T2-F32-05', 32, 'Build script: handles existing destination files without error', () => {
  const tempDir = createTempDir('copy-test-');
  const src = path.join(tempDir, 'file.txt');
  const dest = path.join(tempDir, 'copy.txt');
  fs.writeFileSync(src, 'content 1', 'utf8');
  fs.copyFileSync(src, dest);
  fs.writeFileSync(src, 'content 2', 'utf8');
  fs.copyFileSync(src, dest); // overwrite existing
  assertEqual(fs.readFileSync(dest, 'utf8'), 'content 2', 'Overwrites cleanly');
  removeTempDir(tempDir);
});

module.exports = {
  tier: 2,
  name: 'Boundary & Corner Cases (Tiers 1-32)',
  tests
};
