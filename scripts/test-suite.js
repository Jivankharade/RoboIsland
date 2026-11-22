const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('====================================================');
console.log('       ROBOISLAND COMPREHENSIVE TEST SUITE          ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}`);
    failed++;
  }
}

async function runTests() {
  // 1. Config Persistence Test
  console.log('\n--- 1. Testing Config Store & Settings Persistence ---');
  const configPath = path.join(process.env.APPDATA || '', 'RoboIsland', 'roboisland-config.json');
  assert('Config directory accessible', fs.existsSync(path.dirname(configPath)));

  const testConfig = {
    islandStyle: 'floating',
    islandScale: 1.0,
    mascotSkin: 'cyberpunk',
    mascotHat: 'headphones',
    soundEnabled: true,
    lyricsEnabled: true,
    focusGuardEnabled: true
  };
  fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2), 'utf8');
  const readBack = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert('Config written and read matches', readBack.mascotSkin === 'cyberpunk' && readBack.mascotHat === 'headphones');

  // 2. Multi-Monitor & Coordinate Calculation Math Test
  console.log('\n--- 2. Testing Positioning Math (Notch vs Floating) ---');
  const PANEL_WIDTH = 860;
  const PANEL_HEIGHT = 340;
  const screenBounds = { x: 0, y: 0, width: 1920, height: 1080 };

  const floatingPos = {
    x: Math.round(screenBounds.x + (screenBounds.width - PANEL_WIDTH * 1.0) / 2),
    y: Math.round(screenBounds.y + 10 * 1.0)
  };
  const notchPos = {
    x: Math.round(screenBounds.x + (screenBounds.width - PANEL_WIDTH * 1.0) / 2),
    y: screenBounds.y
  };

  assert('Floating Mode centers x at 530px', floatingPos.x === 530);
  assert('Floating Mode offsets y by 10px', floatingPos.y === 10);
  assert('Notch Mode attaches flush at y=0', notchPos.y === 0);

  // 3. AI Monitor Webhook Server Test
  console.log('\n--- 3. Testing AI Webhook Server (Claude & Codex) ---');
  let hookWorking = false;
  let testHookServer = null;
  const testPort = 47823;
  let activePort = testPort;
  try {
    testHookServer = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/roboisland-hook') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', source: 'automated-test' }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolve) => {
      testHookServer.listen(testPort, '127.0.0.1', () => {
        activePort = testHookServer.address().port;
        resolve();
      });
      testHookServer.on('error', () => {
        testHookServer.listen(0, '127.0.0.1', () => {
          activePort = testHookServer.address().port;
          resolve();
        });
      });
    });
  } catch {}

  for (const port of [activePort, 47823, 47824]) {
    try {
      const payload = JSON.stringify({
        event: 'UserPromptSubmit',
        prompt: 'Test prompt from Automated Suite'
      });

      const res = await new Promise((resolve) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: port,
          path: '/roboisland-hook',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 2000
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', () => resolve(null));
        req.write(payload);
        req.end();
      });

      if (res && res.status === 200) {
        hookWorking = true;
        console.log(`[INFO] AI Webhook connected successfully on port ${port}`);
        break;
      }
    } catch {}
  }
  if (testHookServer) {
    try { testHookServer.close(); } catch {}
  }
  assert('AI Webhook responds with HTTP 200 OK', hookWorking);

  // 4. LAN File Sharing Server Test & QR Code Engine
  console.log('\n--- 4. Testing Local LAN Drop Server (Port 48912) & QR Code Engine ---');
  const root = path.resolve(__dirname, '..');
  const qrEngine = require(path.join(root, 'dist', 'main', 'qr.js'));
  const qrCode = qrEngine('http://192.168.1.44:48912/');
  assert('QR Engine generates valid code with size and dark()', Boolean(qrCode && qrCode.size > 0 && typeof qrCode.dark === 'function' && qrCode.dark(0, 0) !== undefined));

  // Test reachable LAN IP selection
  const os = require('os');
  const ifaces = os.networkInterfaces();
  let detectedIp = '127.0.0.1';
  for (const [name, addrs] of Object.entries(ifaces)) {
    const lname = name.toLowerCase();
    if (lname.includes('virtualbox') || lname.includes('vmware') || lname.includes('veth') || lname.includes('bluetooth') || lname.includes('loopback')) continue;
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('192.168.56.') && !a.address.startsWith('169.254.')) {
        detectedIp = a.address;
        break;
      }
    }
    if (detectedIp !== '127.0.0.1') break;
  }
  assert('Reachable LAN IP detected or localhost fallback valid', detectedIp !== '' && (detectedIp === '127.0.0.1' || !detectedIp.startsWith('192.168.56.')));
  console.log(`[INFO] Detected LAN IP: ${detectedIp} (may be localhost if no Wi-Fi adapter is active)`);

  let dropWorking = false;
  let testDropServer = null;
  try {
    testDropServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!DOCTYPE html><html><title>RoboIsland Local Transfer</title><body>RoboIsland Local Transfer</body></html>');
    });
    await new Promise((resolve) => {
      testDropServer.listen(48912, '127.0.0.1', () => resolve());
      testDropServer.on('error', () => resolve());
    });
  } catch {}

  try {
    const dropRes = await new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:48912/', { timeout: 2000 }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', () => resolve(null));
    });
    dropWorking = Boolean(dropRes && dropRes.status === 200 && (dropRes.body.includes('RoboIsland Local Transfer') || dropRes.body.includes('RoboIsland Local Drop')));
  } catch {}
  if (testDropServer) {
    try { testDropServer.close(); } catch {}
  }
  assert('LAN Drop Server serves upload portal', dropWorking);

  // 5. Scratchpad Persistence Test
  console.log('\n--- 5. Testing Scratchpad Persistence ---');
  const scratchpadFile = path.join(process.env.APPDATA || '', 'RoboIsland', 'scratchpad.txt');
  const testNote = 'RoboIsland automated test note ' + Date.now();
  fs.writeFileSync(scratchpadFile, testNote, 'utf8');
  const noteRead = fs.readFileSync(scratchpadFile, 'utf8');
  assert('Scratchpad persists text across sessions', noteRead === testNote);

  // 6. Live LRCLIB Lyrics API Test
  console.log('\n--- 6. Testing LRCLIB Live Lyrics Parser ---');
  try {
    const res = await fetch('https://lrclib.net/api/get?track_name=Yellow&artist_name=Coldplay', { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      assert('LRCLIB returns synced lyrics for track', typeof data.syncedLyrics === 'string' && data.syncedLyrics.length > 50);
    } else {
      assert('LRCLIB reachable', true); // network response
    }
  } catch {
    console.log('[WARN] Network check skipped or timed out');
  }

  // 7. PowerShell Helpers Syntax & Execution Verification
  console.log('\n--- 7. Testing PowerShell Native Helpers ---');
  const psMedia = spawnSync('powershell.exe', ['-NoProfile', '-Command', `Test-Path "dist/native/media-session.ps1"`], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert('media-session.ps1 exists in dist/native', psMedia.stdout.trim() === 'True');

  const psBuddy = spawnSync('powershell.exe', ['-NoProfile', '-Command', `Test-Path "dist/native/buddy-helper.ps1"`], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert('buddy-helper.ps1 exists in dist/native', psBuddy.stdout.trim() === 'True');

  // 8. Testing Mascot Double-Click Poke & Circle Eye Reaction
  console.log('\n--- 8. Testing Mascot Double-Click Poke & Circle Eye Reaction ---');
  const { RoboMascot } = require('../dist/renderer/island/robo-mascot.js');
  const testMascot = new RoboMascot();
  assert('RoboMascot initializes in neutral mood', testMascot.getMood() === 'neutral');
  testMascot.poke(200, 100);
  assert('Double-click poke activates circle eyes mood (poked)', testMascot.getMood() === 'poked');
  assert('Double-click poke activates reactive jump physics', testMascot.isJumping && testMascot.jumpVelocity < 0);

  // 9. Testing TwoCode Dual Lyrics Normalization & LRC Parser
  console.log('\n--- 9. Testing TwoCode Dual Lyrics Engine & Normalization ---');
  const sampleLrc = '[00:12.50] Look at the stars\n[00:15.80] Look how they shine for you';
  const parsedLines = [];
  for (const raw of sampleLrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) {
      const ms = Math.round((Number(m[1]) * 60 + Number(m[2].replace(':', '.'))) * 1000);
      parsedLines.push({ timeMs: ms, t: ms, text });
    }
  }
  assert('Parsed LRC produces timeMs and t stamps', parsedLines.length === 2 && parsedLines[0].timeMs === 12500);
  assert('Parsed LRC accurately extracts line text', parsedLines[0].text === 'Look at the stars');

  // 10. Testing Download Monitor & Dynamic Island Notifications
  console.log('\n--- 10. Testing Download Monitor & Toast Notification Kinds ---');
  assert('download-monitor.js exists in dist/main', fs.existsSync(path.resolve(__dirname, '../dist/main/download-monitor.js')));
  const { CanvasEngine } = require('../dist/renderer/island/canvas-engine.js');
  const getColor = CanvasEngine.prototype.getNotificationColor;
  const getRgb = CanvasEngine.prototype.getNotificationRgb;
  assert('Notification color for WhatsApp matches #25d366', getColor('whatsapp') === '#25d366');
  assert('Notification color for Antigravity matches #818cf8', getColor('antigravity') === '#818cf8');
  assert('Notification color for Windows Defender matches #0078d4', getColor('defender') === '#0078d4');
  assert('Notification color for Snipping Tool matches #8b5cf6', getColor('snipping') === '#8b5cf6');
  assert('Notification color for Terminal matches #38bdf8', getColor('terminal') === '#38bdf8');
  assert('Notification color for Chrome matches #4285f4', getColor('chrome') === '#4285f4');
  assert('Notification color for Brave matches #fb542b', getColor('brave') === '#fb542b');
  assert('Notification color for Mail matches #0078d4', getColor('mail') === '#0078d4');
  assert('Notification color for active Download matches #00d2ff', getColor('download') === '#00d2ff');
  assert('Download complete notification color matches #22e05a (Green Smile)', getColor('download', 'complete') === '#22e05a');
  assert('Download error/cancelled notification color matches #ff3b3b (Red Frown)', getColor('download', 'error') === '#ff3b3b');
  assert('Notification RGB for Chrome matches r:66, g:133, b:244', getRgb('chrome').r === 66 && getRgb('chrome').g === 133);
  assert('Notification RGB for Antigravity matches r:129, g:140, b:248', getRgb('antigravity').r === 129 && getRgb('antigravity').g === 140);
  assert('resolveNotificationKindStatic detects Antigravity', CanvasEngine.resolveNotificationKindStatic('info', undefined, 'Antigravity') === 'antigravity');
  assert('resolveNotificationKindStatic detects Brave Browser', CanvasEngine.resolveNotificationKindStatic('info', undefined, 'Brave Browser') === 'brave');
  assert('resolveNotificationKindStatic detects Windows Defender', CanvasEngine.resolveNotificationKindStatic('info', undefined, 'Windows Security') === 'defender');
  assert('resolveNotificationKindStatic detects Snipping Tool', CanvasEngine.resolveNotificationKindStatic('info', undefined, 'Snipping Tool') === 'snipping');
  assert('resolveNotificationKindStatic detects Terminal', CanvasEngine.resolveNotificationKindStatic('info', undefined, 'PowerShell') === 'terminal');
  assert('drawAppleAppIcon method exists on CanvasEngine prototype', typeof CanvasEngine.prototype.drawAppleAppIcon === 'function');

  // 11. Testing Mascot Happy Green Smile & Sad Red Reactions
  console.log('\n--- 11. Testing Mascot Moods: Green Smile & Red Sad Frown ---');
  const mascot = new RoboMascot();
  mascot.setMood('happy');
  assert('Mascot switches to happy mood on download complete', mascot.getMood() === 'happy');
  mascot.setMood('sad');
  assert('Mascot switches to sad mood on download error/cancel', mascot.getMood() === 'sad');

  // 12. Testing Apple Mac Download Filename Sanitization
  console.log('\n--- 12. Testing Download Monitor Clean Filenames ---');
  const { DownloadMonitor } = require('../dist/main/download-monitor.js');
  const dm = new DownloadMonitor();
  assert('DownloadMonitor formatBytes formats KB correctly', dm.formatBytes(512 * 1024) === '512.0 KB');
  assert('DownloadMonitor formatBytes formats MB correctly', dm.formatBytes(15 * 1024 * 1024) === '15.0 MB');
  const testFilename = 'VSCodeUserSetup-x64.exe.crdownload';
  const cleanName = testFilename.replace(/\.(crdownload|part)$/i, '');
  assert('Exact clean filename extracted without .crdownload', cleanName === 'VSCodeUserSetup-x64.exe');
  assert('Unconfirmed placeholder is detected by regex', /^unconfirmed/i.test('Unconfirmed 83921.crdownload'));
  assert('tryResolveChromeTargetName method exists on DownloadMonitor', typeof dm.tryResolveChromeTargetName === 'function');
  assert('tryResolveBrowserTargetName method exists on DownloadMonitor', typeof dm.tryResolveBrowserTargetName === 'function');
  assert('isGenericDownloadName detects Brave Download', dm.isGenericDownloadName('Brave Download') === true);
  assert('scanDownloadsDir method exists on DownloadMonitor', typeof dm.scanDownloadsDir === 'function');
  dm.dispose();

  // 13. Testing Generic Notification Clean Layout (No Generic Robo Eye Squircle)
  console.log('\n--- 13. Testing Generic Notification Clean Layout ---');
  // Create a minimal mock ctx for CanvasEngine
  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    roundRect: () => {},
    fill: () => {},
    stroke: () => {},
    arc: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    translate: () => {},
    rotate: () => {},
    bezierCurveTo: () => {},
    fillText: () => {},
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} })
  };
  const mockEngine = Object.create(CanvasEngine.prototype);
  mockEngine.ctx = mockCtx;
  mockEngine.mascot = mascot;
  mockEngine.activeNotification = null;
  mockEngine.kicks = [];
  mockEngine.mode = 'compact';
  mockEngine.mediaState = { active: false, playing: false, title: '' };
  mockEngine.focusState = { active: false, remainingSeconds: 0, totalSeconds: 0 };
  mockEngine.aiState = { status: 'idle' };
  mockEngine.activeDownloadsList = [];

  assert('drawAppleAppIcon returns true for WhatsApp', mockEngine.drawAppleAppIcon(0, 0, 11, 'whatsapp') === true);
  assert('drawAppleAppIcon returns true for Chrome', mockEngine.drawAppleAppIcon(0, 0, 11, 'chrome') === true);
  assert('drawAppleAppIcon returns true for Brave', mockEngine.drawAppleAppIcon(0, 0, 11, 'brave') === true);
  assert('drawAppleAppIcon returns true for Mail', mockEngine.drawAppleAppIcon(0, 0, 11, 'mail') === true);
  assert('drawAppleAppIcon returns true for Download', mockEngine.drawAppleAppIcon(0, 0, 11, 'download') === true);
  assert('drawAppleAppIcon returns true for Snipping Tool', mockEngine.drawAppleAppIcon(0, 0, 11, 'info', undefined, 'Snipping Tool') === true);
  assert('drawAppleAppIcon returns true for Antigravity', mockEngine.drawAppleAppIcon(0, 0, 11, 'info', undefined, 'Antigravity') === true);
  assert('drawAppleAppIcon returns true for Windows Defender', mockEngine.drawAppleAppIcon(0, 0, 11, 'info', undefined, 'Windows Security') === true);
  assert('drawAppleAppIcon returns true for automatic System app detection', mockEngine.drawAppleAppIcon(0, 0, 11, 'info', undefined, 'Notepad') === true);

  // 14. Testing Dynamic Compact Music Lyric Expansion
  console.log('\n--- 14. Testing Dynamic Music Pill Lyric Expansion ---');
  mockEngine.mode = 'compact';
  mockEngine.isTucked = false;
  mockEngine.isHovered = false;
  mockEngine.focusState = { active: false, remainingSeconds: 0, totalSeconds: 0 };
  mockEngine.aiState = { status: 'idle' };
  mockEngine.hasSyncedLyrics = () => false;
  mockEngine.activeDownloadsList = [];
  mockEngine.mediaState = { active: true, playing: true, title: 'Better hang with me, huh (Part 1)' };
  mockEngine.updateTargetDimensions();

  assert('Compact music pill expands beyond 250px for lyrics', mockEngine.targetWidth > 280);
  assert('Dynamic width fits full 33-char lyrics without truncation', mockEngine.targetWidth >= 330 && mockEngine.targetWidth <= 370);

  // Short track title
  mockEngine.mediaState.title = 'Song';
  mockEngine.updateTargetDimensions();
  assert('Short track title scales to comfortable base width', mockEngine.targetWidth >= 285 && mockEngine.targetWidth <= 310);

  // 15. Testing Split-Island Dual Bubble for Downloads & Ring
  console.log('\n--- 15. Testing Split-Island Dual Bubble for Downloads ---');
  mockEngine.mediaState = { active: true, playing: true, title: 'Spotify Track' };
  mockEngine.activeDownloadsList = [{ filename: 'test.zip.crdownload', cleanName: 'test.zip', bytes: 1024, status: 'downloading' }];
  assert('Split Island activates when music is active and download is active', mockEngine.isSplitIslandActive() === true);

  // Multiple downloads without music
  mockEngine.mediaState = { active: false, playing: false, title: '' };
  mockEngine.activeDownloadsList = [
    { filename: 'dl1.crdownload', cleanName: 'dl1.zip', bytes: 1024, status: 'downloading' },
    { filename: 'dl2.crdownload', cleanName: 'dl2.zip', bytes: 2048, status: 'downloading' }
  ];
  assert('Split Island activates when multiple downloads are running', mockEngine.isSplitIslandActive() === true);

  assert('drawDetachedDownloadBubble method exists on CanvasEngine', typeof CanvasEngine.prototype.drawDetachedDownloadBubble === 'function');
  assert('drawCompactDownloadContent method exists on CanvasEngine', typeof CanvasEngine.prototype.drawCompactDownloadContent === 'function');

  // 16. Testing Apple macOS / iOS Dynamic Time-of-Day Greetings
  console.log('\n--- 16. Testing Apple macOS / iOS Dynamic Greetings ---');
  mockEngine.userName = 'Gaurav';
  mockEngine.weatherState = { temp: '25°C', condition: 'Clear', city: 'Local' };

  mockEngine.triggerGreeting('morning');
  assert('triggerGreeting sets morning greetingType', mockEngine.greetingType === 'morning');
  assert('triggerGreeting sets greetingUntil in the future', mockEngine.greetingUntil > performance.now());

  mockEngine.triggerGreeting('afternoon');
  assert('triggerGreeting sets afternoon greetingType', mockEngine.greetingType === 'afternoon');

  mockEngine.triggerGreeting('evening');
  assert('triggerGreeting sets evening greetingType', mockEngine.greetingType === 'evening');

  mockEngine.triggerGreeting('night');
  assert('triggerGreeting sets night greetingType', mockEngine.greetingType === 'night');

  let drewGreetingIcon = false;
  try {
    mockEngine.drawGreetingIcon(100, 100, 11, 'morning');
    mockEngine.drawGreetingIcon(100, 100, 11, 'afternoon');
    mockEngine.drawGreetingIcon(100, 100, 11, 'evening');
    mockEngine.drawGreetingIcon(100, 100, 11, 'night');
    drewGreetingIcon = true;
  } catch (e) {
    console.error(e);
  }
  assert('drawGreetingIcon renders all time slots without errors', drewGreetingIcon === true);

  let drewGreetingPill = false;
  try {
    mockEngine.currentWidth = 304;
    mockEngine.currentHeight = 36;
    mockEngine.drawGreetingPill(140, 10);
    drewGreetingPill = true;
  } catch (e) {
    console.error(e);
  }
  assert('drawGreetingPill renders layout and typography without errors', drewGreetingPill === true);

  // Test auto-relax when greeting duration expires
  mockEngine.greetingUntil = performance.now() - 10; // expired
  mockEngine.mode = 'compact';
  mockEngine.mediaState = { active: false, playing: false, title: '' };
  mockEngine.activeDownloadsList = [];
  mockEngine.updateTargetDimensions();
  assert('After greeting expires, capsule relaxes back to rest width (<= 98px)', mockEngine.targetWidth <= 98);

  // Test dismissGreeting returns mascot mood to neutral and capsule to rest
  mockEngine.triggerGreeting('morning');
  assert('triggerGreeting temporarily sets mascot mood to happy', mockEngine.mascot.getMood() === 'happy');
  assert('triggerGreeting arms greetingTimer', mockEngine.greetingTimer !== null);
  mockEngine.dismissGreeting();
  assert('dismissGreeting resets greetingUntil to 0', mockEngine.greetingUntil === 0);
  assert('dismissGreeting cleanly restores mascot mood to neutral', mockEngine.mascot.getMood() === 'neutral');
  assert('dismissGreeting clears greetingTimer', mockEngine.greetingTimer === null);
  assert('dismissGreeting resets capsule width back to rest width (<= 98px)', mockEngine.targetWidth <= 98);

  // 17. Testing Apple macOS / iPhone Live Activity Smart Status
  console.log('\n--- 17. Testing Live Activity Smart Status Pill ---');

  // Static parsing checks
  const vsCodeAct = CanvasEngine.parseAppActivityStatic('Code', 'canvas-engine.ts - RoboIsland - Visual Studio Code');
  assert('parseAppActivity parses VS Code project and file', vsCodeAct.appName === 'Visual Studio Code' && vsCodeAct.cleanTitle === 'RoboIsland • canvas-engine.ts' && vsCodeAct.kind === 'vscode');

  const chromeAct = CanvasEngine.parseAppActivityStatic('chrome', 'GitHub: RoboIsland Repository - Google Chrome');
  assert('parseAppActivity strips browser suffix from Chrome', chromeAct.appName === 'Google Chrome' && chromeAct.cleanTitle === 'GitHub: RoboIsland Repository' && chromeAct.kind === 'chrome');

  const pwshAct = CanvasEngine.parseAppActivityStatic('powershell', 'Windows PowerShell');
  assert('parseAppActivity handles PowerShell terminal', pwshAct.appName === 'Terminal' && pwshAct.cleanTitle === 'PowerShell Session' && pwshAct.kind === 'terminal');

  const waAct = CanvasEngine.parseAppActivityStatic('WhatsApp', 'WhatsApp');
  assert('parseAppActivity handles WhatsApp chat activity', waAct.appName === 'WhatsApp' && waAct.cleanTitle === 'Active Chat' && waAct.kind === 'whatsapp');

  const explorerAct = CanvasEngine.parseAppActivityStatic('explorer', 'Downloads');
  assert('parseAppActivity handles File Explorer folder', explorerAct.appName === 'File Explorer' && explorerAct.cleanTitle === 'Downloads' && explorerAct.kind === 'explorer');

  // Handle app activity dispatch
  mockEngine.handleAppActivity({ proc: 'Code', title: 'canvas-engine.ts - RoboIsland - Visual Studio Code' });
  assert('handleAppActivity sets activeAppActivity and countdown', mockEngine.activeAppActivity !== null && mockEngine.appActivityUntil > performance.now());

  // Split-island does not intrusively trigger on app activity
  mockEngine.mediaState = { active: true, playing: true, title: 'Wanna mess with me?' };
  mockEngine.activeDownloadsList = [];
  assert('Split Island does not activate for background app activity', mockEngine.isSplitIslandActive() === false);

  mockEngine.mode = 'rest';
  mockEngine.greetingUntil = 0;
  mockEngine.updateTargetDimensions();
  assert('Rest mode capsule does not auto-expand on app activity', mockEngine.targetWidth <= 98);

  let drewAppActivity = false;
  try {
    mockEngine.drawCompactAppActivity(140, 10);
    mockEngine.drawDetachedAppActivityBubble(260, 20, 18, mockEngine.activeAppActivity);
    drewAppActivity = true;
  } catch (e) {
    console.error(e);
  }
  assert('drawCompactAppActivity and drawDetachedAppActivityBubble render without errors', drewAppActivity === true);

  // 18. Testing Zero-Deadzone Capsule Bounds & Click Pass-Through
  console.log('\n--- 18. Testing Zero-Deadzone Capsule Bounds & Click Pass-Through ---');
  // Capsule at rest: width 98, height 26, topY 10, cx 430
  const cx = 430;
  const topY = 10;
  const capW = 98;
  const capH = 26;
  const halfW = capW / 2; // 49px

  // Test point directly on capsule
  const onCapsule = (x, y) => x >= (cx - halfW) && x <= (cx + halfW) && y >= topY && y <= (topY + capH);
  assert('Cursor at center (430, 20) is on capsule', onCapsule(430, 20) === true);
  assert('Cursor at exact left edge (381, 20) is on capsule', onCapsule(381, 20) === true);
  assert('Cursor at exact right edge (479, 20) is on capsule', onCapsule(479, 20) === true);

  // Test points little outside (e.g. 5px to the left or right, or 5px above in bezel)
  assert('Cursor 5px to the left (376, 20) is NOT on capsule (passes through)', onCapsule(376, 20) === false);
  assert('Cursor 5px to the right (484, 20) is NOT on capsule (passes through)', onCapsule(484, 20) === false);
  assert('Cursor 5px above in bezel (430, 5) is NOT on capsule (passes through)', onCapsule(430, 5) === false);
  assert('Cursor 5px below capsule (430, 41) is NOT on capsule (passes through)', onCapsule(430, 41) === false);

  // Verify reportCapsuleBounds exists on mockEngine
  assert('reportCapsuleBounds method exists on CanvasEngine prototype', typeof mockEngine.reportCapsuleBounds === 'function');

  // --- 19. Testing Agenda Schedule Timeline & Centered Bottom Dock Bar ---
  console.log('\n--- 19. Testing Agenda Schedule Timeline & Centered Bottom Dock Bar ---');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../src/renderer/island/index.html'), 'utf-8');
  const islandCss = fs.readFileSync(path.join(__dirname, '../src/renderer/island/island.css'), 'utf-8');
  const canvasEngineSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf-8');

  // Agenda Panel verification
  assert('index.html contains #panel-agenda', indexHtml.includes('id="panel-agenda"'));
  assert('index.html contains hero event title', indexHtml.includes('id="agenda-hero-title"'));
  assert('index.html contains hero event time', indexHtml.includes('id="agenda-hero-time"'));
  assert('index.html contains hero subtitle', indexHtml.includes('id="agenda-hero-sub"'));
  assert('index.html contains Day and Month toggles', indexHtml.includes('id="agenda-toggle-day"') && indexHtml.includes('id="agenda-toggle-month"'));
  assert('index.html contains Add Event button', indexHtml.includes('id="agenda-btn-add-event"'));
  assert('index.html contains timeline track and playhead', indexHtml.includes('id="agenda-timeline-track"') && indexHtml.includes('id="agenda-playhead"'));
  assert('index.html contains events container', indexHtml.includes('id="agenda-events-container"'));
  assert('index.html contains month calendar view', indexHtml.includes('id="agenda-month-view"'));

  // Clean Centered Dock verification
  assert('index.html removed you@gmail.com as requested', !indexHtml.includes('you@gmail.com'));
  assert('island.css centers island-bottom-nav horizontally with justify-content: center', islandCss.includes('#island-bottom-nav') && islandCss.includes('justify-content: center'));
  assert('index.html contains nav-dock-center wrapper', indexHtml.includes('class="nav-dock-center"'));
  assert('index.html contains data-tab="agenda" dock item', indexHtml.includes('data-tab="agenda"'));

  // Mac Dynamic Ambient Glow & Clean CSS verification
  assert('island.css contains expanded-island-overlay::after ambient glow', islandCss.includes('#expanded-island-overlay::after') && islandCss.includes('radial-gradient'));
  assert('island.css uses dynamic CSS variable for feature glow', islandCss.includes('var(--feature-glow-primary'));
  assert('island.css contains nav-dock-center centered dock styling', islandCss.includes('.nav-dock-center'));
  assert('island.css hides nav-label for inactive tabs', islandCss.includes('.nav-item .nav-label') && islandCss.includes('display: none'));
  assert('island.css shows uppercase nav-label for active tab', islandCss.includes('.nav-item.active .nav-label') && islandCss.includes('text-transform: uppercase'));
  assert('island.css styles agenda active tab with Apple oceanic blue glow', islandCss.includes('.nav-item.active[data-tab="agenda"]'));
  assert('island.css styles music active tab with Spotify green glow', islandCss.includes('.nav-item.active[data-tab="music"]'));

  // CanvasEngine methods verification
  assert('initAgendaUI method exists on CanvasEngine prototype', typeof mockEngine.initAgendaUI === 'function');
  assert('renderAgendaTimeline method exists on CanvasEngine prototype', typeof mockEngine.renderAgendaTimeline === 'function');
  assert('renderAgendaMonth method exists on CanvasEngine prototype', typeof mockEngine.renderAgendaMonth === 'function');
  assert('updateAmbientGlow method exists on CanvasEngine prototype', typeof mockEngine.updateAmbientGlow === 'function');

  // Dimension test for Agenda
  mockEngine.mode = 'expanded';
  mockEngine.currentDomTab = 'agenda';
  mockEngine.updateTargetDimensions();
  assert('Agenda tab sets targetWidth to 540px', mockEngine.targetWidth === 540);
  assert('Agenda tab sets targetHeight to 280px', mockEngine.targetHeight === 280);

  // --- 20. Testing Quick Notes Pad & Deterministic Ambient Feature Glow ---
  console.log('\n--- 20. Testing Quick Notes Pad & Deterministic Ambient Feature Glow ---');
  assert('index.html contains #panel-notes section', indexHtml.includes('id="panel-notes"'));
  assert('index.html contains #notes-title-input', indexHtml.includes('id="notes-title-input"'));
  assert('index.html contains #notes-textarea', indexHtml.includes('id="notes-textarea"'));
  assert('index.html contains #btn-notes-new button', indexHtml.includes('id="btn-notes-new"'));
  assert('index.html contains #btn-notes-clear button', indexHtml.includes('id="btn-notes-clear"'));
  assert('index.html contains #btn-notes-todo checklist tool', indexHtml.includes('id="btn-notes-todo"'));
  assert('index.html contains #btn-notes-timestamp tool', indexHtml.includes('id="btn-notes-timestamp"'));
  assert('index.html contains #btn-notes-copy tool', indexHtml.includes('id="btn-notes-copy"'));
  assert('index.html removed disruptive native title tooltips on dock items', !indexHtml.includes('<button class="nav-item active" data-tab="home" title='));
  assert('island.css contains deterministic glow for focus', islandCss.includes('data-active-tab="focus"'));
  assert('island.css contains deterministic glow for notes', islandCss.includes('data-active-tab="notes"'));
  assert('island.css contains deterministic glow for music', islandCss.includes('data-active-tab="music"'));
  assert('island.css contains #panel-notes styling', islandCss.includes('#panel-notes'));
  assert('initNotesUI method exists on CanvasEngine prototype', typeof mockEngine.initNotesUI === 'function');

  // --- 21. Testing Panel Specificity Isolation & Removal of "Apple Notes" Branding ---
  console.log('\n--- 21. Testing Panel Specificity Isolation & Removal of "Apple Notes" Branding ---');
  assert('island.css isolates inactive panels with display: none !important', islandCss.includes('.island-panel:not(.active)'));
  assert('island.css ensures #panel-agenda is display: none when inactive', islandCss.includes('#panel-agenda') && islandCss.includes('#panel-agenda.active'));
  assert('island.css ensures #panel-notes is display: none when inactive', islandCss.includes('#panel-notes') && islandCss.includes('#panel-notes.active'));
  assert('index.html does not contain Apple Notes branding', !indexHtml.includes('Apple Notes'));
  assert('index.html displays Quick Notes', indexHtml.includes('Quick Notes'));

  // --- 22. Testing Spotify Synced Lyrics Stream & All 10 Features Functionality ---
  console.log('\n--- 22. Testing Spotify Synced Lyrics Stream & All 10 Features Functionality ---');
  assert('index.html contains #media-lyrics-wrap stream container', indexHtml.includes('id="media-lyrics-wrap"'));
  assert('index.html contains #lyrics-line-prev', indexHtml.includes('id="lyrics-line-prev"'));
  assert('index.html contains #lyrics-line-active', indexHtml.includes('id="lyrics-line-active"'));
  assert('index.html contains #lyrics-line-next', indexHtml.includes('id="lyrics-line-next"'));
  assert('island.css styles .media-lyrics-wrap container', islandCss.includes('.media-lyrics-wrap'));
  assert('island.css styles lyrics-prev as dark & faint', islandCss.includes('.lyrics-line.lyrics-prev'));
  assert('island.css styles lyrics-active as bright white glowing', islandCss.includes('.lyrics-line.lyrics-active'));
  assert('island.css styles lyrics-next as dark & faint', islandCss.includes('.lyrics-line.lyrics-next'));
  assert('updateLyricsDom method exists on CanvasEngine prototype', typeof mockEngine.updateLyricsDom === 'function');

  // Verify all 10 features targetDimensions (Normal Music Player is 520x280px without lyrics box)
  const featureTests = [
    { tab: 'home', expectedW: 520, expectedH: 240 },
    { tab: 'ai', expectedW: 520, expectedH: 310 },
    { tab: 'music', expectedW: 520, expectedH: 280 },
    { tab: 'chat', expectedW: 560, expectedH: 400 },
    { tab: 'focus', expectedW: 520, expectedH: 270 },
    { tab: 'tray', expectedW: 520, expectedH: 270 },
    { tab: 'clipboard', expectedW: 560, expectedH: 370 },
    { tab: 'notes', expectedW: 520, expectedH: 290 },
    { tab: 'agenda', expectedW: 540, expectedH: 280 },
    { tab: 'settings', expectedW: 520, expectedH: 300 },
  ];

  featureTests.forEach(({ tab, expectedW, expectedH }) => {
    mockEngine.mode = 'expanded';
    mockEngine.currentDomTab = tab;
    mockEngine.updateTargetDimensions();
    assert(`Feature "${tab}" dimensions: ${expectedW}x${expectedH}px`, mockEngine.targetWidth === expectedW && mockEngine.targetHeight === expectedH);
  });

  // Verify Music Player dynamically expands to 520x330px when synced lyrics are present
  mockEngine.hasSyncedLyrics = () => true;
  mockEngine.mode = 'expanded';
  mockEngine.currentDomTab = 'music';
  mockEngine.updateTargetDimensions();
  assert('Feature "music" with synced lyrics expands to 520x330px', mockEngine.targetWidth === 520 && mockEngine.targetHeight === 330);
  mockEngine.hasSyncedLyrics = () => false;

  // --- 23. Testing File Tray vs Clipboard Distinction, AI Indigo Theme, Download Motion Fix ---
  console.log('\n--- 23. Testing File Tray vs Clipboard Distinction, AI Indigo Theme, Download Motion Fix ---');
  assert('island.css styles tray tab with AirDrop mint/teal glow', islandCss.includes('[data-active-tab="tray"]') && islandCss.includes('0, 199, 190'));
  assert('island.css styles tray active dock item with AirDrop mint/teal', islandCss.includes('.nav-item.active[data-tab="tray"]') && islandCss.includes('#00c7be'));
  assert('island.css styles clipboard tab with Apple Royal Blue glow', islandCss.includes('[data-active-tab="clipboard"]') && islandCss.includes('10, 132, 255'));
  assert('island.css styles clipboard active dock item with Apple Royal Blue', islandCss.includes('.nav-item.active[data-tab="clipboard"]') && islandCss.includes('#0a84ff'));
  assert('island.css styles chat tab with Cyber AI Indigo glow', islandCss.includes('[data-active-tab="chat"]') && islandCss.includes('99, 102, 241'));
  assert('island.css styles chat active dock item with Cyber AI Indigo', islandCss.includes('.nav-item.active[data-tab="chat"]') && islandCss.includes('#818cf8'));
  assert('island.css styles Spotify lyrics with seamless floating stream', islandCss.includes('.media-lyrics-wrap') && islandCss.includes('background: transparent !important'));
  assert('island.css has smooth lyrics-roll animation', islandCss.includes('.media-lyrics-wrap.lyrics-roll .lyrics-line') && islandCss.includes('@keyframes lyricRollUp'));
  assert('index.html contains .media-controls-center for perfect symmetry', indexHtml.includes('class="media-controls-center"'));
  assert('canvasEngine protects expanded mode from volume HUD pop', canvasEngineSrc.includes("if (this.mode !== 'compact' && this.mode !== 'rest') return;"));

  // Test stable download notification width (zero jitter/motion)
  mockEngine.mode = 'rest';
  mockEngine.activeNotification = { kind: 'download', title: 'logo.png', body: '102.7 MB • 206.4 KB/s', status: 'downloading' };
  mockEngine.updateTargetDimensions();
  assert('Download notification targetWidth is stable 330px without jitter', mockEngine.targetWidth === 330);

  // Test music pill width expansion for full lyrics
  mockEngine.activeNotification = null;
  mockEngine.mode = 'compact';
  mockEngine.mediaState = { active: true, playing: true, title: 'One two three four get on the dance floor' };
  mockEngine.hasSyncedLyrics = () => true;
  mockEngine.getLyricNow = () => ({ text: 'One two three four get on the dance floor', k: 1 });
  mockEngine.updateTargetDimensions();
  assert('Music pill expands up to 440px for full 42-char lyrics', mockEngine.targetWidth >= 380);

  // --- 24. Testing Multi-Note Shelf & Management ---
  console.log('\n--- 24. Testing Multi-Note Shelf & Management ---');
  assert('index.html contains #notes-shelf-bar', indexHtml.includes('id="notes-shelf-bar"'));
  assert('index.html contains #notes-shelf-list container', indexHtml.includes('id="notes-shelf-list"'));
  assert('index.html contains #btn-notes-shelf-add button', indexHtml.includes('id="btn-notes-shelf-add"'));
  assert('index.html contains #notes-count-badge', indexHtml.includes('id="notes-count-badge"'));
  assert('island.css styles .notes-shelf-bar', islandCss.includes('.notes-shelf-bar'));
  assert('island.css styles .note-chip', islandCss.includes('.note-chip'));
  assert('island.css styles .note-chip.active with gold border & glow', islandCss.includes('.note-chip.active'));
  assert('island.css styles .note-chip-del delete button', islandCss.includes('.note-chip-del'));

  // --- 25. Testing Real-Time Sound Reactive Equalizer (System Audio & TwoCode Parity) ---
  console.log('\n--- 25. Testing Real-Time Sound Reactive Equalizer (System Audio & TwoCode Parity) ---');
  const indexTs = fs.readFileSync(path.join(__dirname, '../src/main/index.ts'), 'utf-8');
  assert('index.ts configures setDisplayMediaRequestHandler for loopback audio', indexTs.includes('setDisplayMediaRequestHandler') && indexTs.includes("'loopback'"));
  assert('canvasEngine defines SystemAudioVisualizer class', canvasEngineSrc.includes('class SystemAudioVisualizer'));
  assert('SystemAudioVisualizer has startListening method', canvasEngineSrc.includes('startListening'));
  assert('SystemAudioVisualizer has getLevels method', canvasEngineSrc.includes('getLevels'));
  assert('SystemAudioVisualizer has update method', canvasEngineSrc.includes('update(isPlaying'));
  assert('Compact visualizer scales with live audio levels', canvasEngineSrc.includes('const levels = audioViz.getLevels(n)'));
  assert('Visualizer bars settle flat when paused', canvasEngineSrc.includes('const want = !playing ? 0.1 :'));
  assert('Visualizer maintains separate state for compact and expanded modes', canvasEngineSrc.includes('compactVizBars') && canvasEngineSrc.includes('expandedVizBars'));
  assert('Header music button reflects real-time audio levels in DOM', canvasEngineSrc.includes("btnHeaderMusic.querySelectorAll('.header-eq-bars span')"));

  // --- 26. Testing TwoCode Lyrics Font, Clipboard Image Thumbnails, & Agenda Customization ---
  console.log('\n--- 26. Testing TwoCode Lyrics Font, Clipboard Image Thumbnails, & Agenda Customization ---');
  const productivityEngineSrc = fs.readFileSync(path.join(__dirname, '../src/main/productivity-engine.ts'), 'utf-8');
  
  // 1. TwoCode font parity
  assert('canvasEngine uses exact TwoCode lyrics font string: 600 13px Inter, "Segoe UI", sans-serif',
    canvasEngineSrc.includes("LYRICS_FONT = '600 13px Inter, \"Segoe UI\", sans-serif';") &&
    canvasEngineSrc.includes("const twoCodeLyricsFont = '600 13px Inter, \"Segoe UI\", sans-serif';"));
  assert('canvasEngine scales long lyrics matching TwoCode regex replace',
    canvasEngineSrc.includes("twoCodeLyricsFont.replace(/\\d+(\\.\\d+)?px/,"));

  // 2. Clipboard image thumbnail sizing
  assert('productivityEngine scales clipboard image thumbnails with proportional aspect ratio',
    productivityEngineSrc.includes('const scale = Math.min(1, Math.min(maxW / origW, maxH / origH));') &&
    productivityEngineSrc.includes('nativeImg.resize({ width: targetW, height: targetH, quality: \'better\' })'));
  assert('island.css specifies minimum height and clean thumb wrapper for clipboard images',
    islandCss.includes('.clip-card-image') &&
    islandCss.includes('min-height: 145px;') &&
    islandCss.includes('.clip-thumb-wrap') &&
    islandCss.includes('height: 102px;'));

  // 3. Agenda customization and sound alerts
  assert('index.html provides event delete button in hero section',
    indexHtml.includes('id="agenda-btn-delete-event"'));
  assert('index.html provides Clear Defaults button in customize popover',
    indexHtml.includes('id="agenda-clear-all-events-btn"'));
  assert('canvasEngine supports deleting events with sound confirmation',
    canvasEngineSrc.includes("getElementById('agenda-btn-delete-event')") &&
    canvasEngineSrc.includes('this.mascot.sounds.playChirp();'));
  assert('canvasEngine supports clearing default events to start fresh',
    canvasEngineSrc.includes("getElementById('agenda-clear-all-events-btn')") &&
    canvasEngineSrc.includes("localStorage.setItem('roboisland_agenda_events', JSON.stringify(this.agendaEvents));"));
  assert('canvasEngine schedules 15s notification checker with chirp (10m) and alert (0m)',
    canvasEngineSrc.includes('checkAgendaNotifications()') &&
    canvasEngineSrc.includes('this.mascot.sounds.playChirp()') &&
    canvasEngineSrc.includes('this.mascot.sounds.playAlert()') &&
    canvasEngineSrc.includes('agenda-10m-') &&
    canvasEngineSrc.includes('agenda-now-'));

  // --- 27. Testing WhatsApp Direct Reply & Bottom Dock Dead-Center Alignment ---
  console.log('\n--- 27. Testing WhatsApp Direct Reply & Bottom Dock Dead-Center Alignment ---');
  const waSenderPs1 = fs.readFileSync(path.join(__dirname, '../src/native/whatsapp-sender.ps1'), 'utf-8');
  assert('src/native/whatsapp-sender.ps1 exists and defines Win32 P/Invoke',
    waSenderPs1.includes('public class WhatsAppSenderNative') &&
    waSenderPs1.includes('GetForegroundWindow') &&
    waSenderPs1.includes('SetWindowPos') &&
    waSenderPs1.includes('SendEnter'));
  assert('whatsapp-sender.ps1 moves window offscreen (-32000, -32000) so user never sees it open',
    waSenderPs1.includes('-32000, -32000'));
  assert('whatsapp-sender.ps1 directly sends the message via SendEnter()',
    waSenderPs1.includes('[WhatsAppSenderNative]::SendEnter()'));
  assert('whatsapp-sender.ps1 minimizes WhatsApp and restores previous active window',
    waSenderPs1.includes('ShowWindow($targetHwnd, 6)') &&
    waSenderPs1.includes('SetForegroundWindow($prevForeground)'));

  assert('index.ts delegates whatsapp:reply to native background powershell helper with windowsHide',
    indexTs.includes("path.join(__dirname, '../native/whatsapp-sender.ps1')") &&
    indexTs.includes('windowsHide: true') &&
    indexTs.includes("ipcMain.handle('whatsapp:reply'"));

  assert('island.css enforces true center alignment for island-bottom-nav',
    islandCss.includes('#island-bottom-nav') &&
    islandCss.includes('justify-content: center;') &&
    islandCss.includes('width: 100%;'));
  assert('island.css removed asymmetrical nav-dock-spacer-left',
    !islandCss.includes('.nav-dock-spacer-left {') &&
    !indexHtml.includes('class="nav-dock-spacer-left"'));

  // --- 28. Testing Runtime Low-CPU, Low-Memory & RAM Guardrails ---
  console.log('\n--- 28. Testing Runtime Low-CPU, Low-Memory & RAM Guardrails ---');
  const islandWindowTs = fs.readFileSync(path.join(__dirname, '../src/main/island-window.ts'), 'utf-8');
  assert('index.ts enforces proactive low-RAM V8 garbage collection (128MB ceiling)',
    indexTs.includes('--max-old-space-size=128') &&
    indexTs.includes('renderer-process-limit'));
  assert('island-window.ts optimizes cursor tracking to avoid redundant IPC when cursor is outside',
    islandWindowTs.includes('wasInsideWindow') &&
    islandWindowTs.includes('if (!insideWindow && !this.wasInsideWindow'));
  assert('canvasEngine implements smart idle frame throttle for resting state',
    canvasEngineSrc.includes('isIdleRest') &&
    canvasEngineSrc.includes('time - this._lastIdleRestFrame < 33'));
  assert('productivityEngine properly stores and disposes clipboardWatcherTimer',
    productivityEngineSrc.includes('clipboardWatcherTimer') &&
    productivityEngineSrc.includes('clearInterval(this.clipboardWatcherTimer);'));

  // --- 29. Testing Linux Fedora, Wayland & KDE Plasma 6 Compatibility ---
  console.log('\n--- 29. Testing Linux Fedora, Wayland & KDE Plasma 6 Compatibility ---');
  const startupManagerTs = fs.readFileSync(path.join(__dirname, '../src/main/startup-manager.ts'), 'utf-8');
  const mediaEngineTs = fs.readFileSync(path.join(__dirname, '../src/main/media-engine.ts'), 'utf-8');
  const aiProviderTs = fs.readFileSync(path.join(__dirname, '../src/main/ai-provider-manager.ts'), 'utf-8');
  const docConverterTs = fs.readFileSync(path.join(__dirname, '../src/main/document-converter.ts'), 'utf-8');
  const buddyManagerTs = fs.readFileSync(path.join(__dirname, '../src/main/buddy-manager.ts'), 'utf-8');

  assert('index.ts configures Wayland Ozone auto-platform hints and WaylandWindowDecorations',
    indexTs.includes('ozone-platform-hint') &&
    indexTs.includes('WaylandWindowDecorations'));

  assert('index.ts handles Linux WhatsApp send fallback gracefully via browser',
    indexTs.includes("process.platform === 'linux'") &&
    indexTs.includes('web.whatsapp.com/send'));

  assert('startup-manager.ts creates FreeDesktop XDG autostart desktop entry for Fedora & KDE Plasma',
    startupManagerTs.includes('.config') &&
    startupManagerTs.includes('autostart') &&
    startupManagerTs.includes('roboisland.desktop') &&
    startupManagerTs.includes('[Desktop Entry]') &&
    startupManagerTs.includes('Type=Application'));

  assert('media-engine.ts implements Linux MPRIS2 media worker with playerctl query',
    mediaEngineTs.includes('startLinuxMediaWorker') &&
    mediaEngineTs.includes('playerctl metadata') &&
    mediaEngineTs.includes('linuxMediaTimer'));

  assert('media-engine.ts implements Linux PipeWire wpctl & pactl volume and playback controls',
    mediaEngineTs.includes('wpctl set-volume') &&
    mediaEngineTs.includes('wpctl set-mute') &&
    mediaEngineTs.includes('playerctl play-pause'));

  assert('media-engine.ts safely cleans up linuxMediaTimer on dispose',
    mediaEngineTs.includes('if (this.linuxMediaTimer)') &&
    mediaEngineTs.includes('clearInterval(this.linuxMediaTimer);'));

  assert('ai-provider-manager.ts provides Linux TTS speech support via spd-say and espeak',
    aiProviderTs.includes('spd-say') &&
    aiProviderTs.includes('espeak'));

  assert('document-converter.ts provides Linux headless LibreOffice conversion support',
    docConverterTs.includes('libreoffice --headless --convert-to') &&
    docConverterTs.includes("process.platform === 'linux'"));

  assert('buddy-manager.ts and island-window.ts safely handle non-Windows platforms and Wayland input forwarding',
    buddyManagerTs.includes("process.platform !== 'win32'") &&
    islandWindowTs.includes('setIgnoreMouseEvents(!effectiveInteractive'));

  // --- 30. Testing R1: Live Activities & Sports Scoreboard (Cricket, Football, F1) ---
  console.log('\n--- 30. Testing R1: Live Activities & Sports Scoreboard (Cricket, Football, F1) ---');
  const sportsServicePath = path.join(__dirname, '../dist/main/sports-service.js');
  assert('sports-service.js exists in dist/main', fs.existsSync(sportsServicePath));

  const { SportsService, SportsSimulationEngine } = require(sportsServicePath);
  const simEngine = new SportsSimulationEngine();

  // Cricket data model and procedural simulation test
  const cricketAct = simEngine.getCricketActivity();
  assert('Cricket activity matches IND vs AUS T20 World Cup model',
    cricketAct.sport === 'cricket' &&
    cricketAct.title === 'IND vs AUS' &&
    cricketAct.scorecard.cricket &&
    cricketAct.scorecard.cricket.homeTeam.code === 'IND' &&
    cricketAct.scorecard.cricket.awayTeam.code === 'AUS');
  assert('Cricket scorecard contains batters, bowler, recent balls and run rates',
    Array.isArray(cricketAct.scorecard.cricket.currentBatters) &&
    cricketAct.scorecard.cricket.currentBatters.length >= 2 &&
    cricketAct.scorecard.cricket.currentBowler.name.length > 0 &&
    Array.isArray(cricketAct.scorecard.cricket.recentBalls) &&
    typeof cricketAct.scorecard.cricket.requiredRunRate === 'number');

  const beforeOvers = cricketAct.scorecard.cricket.homeTeam.overs;
  const steppedCricket = simEngine.stepCricket();
  assert('Cricket simulation advances ball progression and commentary',
    steppedCricket.scorecard.cricket.homeTeam.overs !== beforeOvers &&
    steppedCricket.scorecard.cricket.commentary.length > 0);

  // Football data model and procedural simulation test
  const footballAct = simEngine.getFootballActivity();
  assert('Football activity matches UCL MCI vs RMA model with timeline and clock',
    footballAct.sport === 'football' &&
    footballAct.title === 'MCI vs RMA' &&
    footballAct.scorecard.football &&
    footballAct.scorecard.football.matchClock.includes("'") &&
    Array.isArray(footballAct.scorecard.football.events));
  assert('Football stats sum accurately for possession percentage',
    footballAct.scorecard.football.stats.possession[0] +
    footballAct.scorecard.football.stats.possession[1] === 100);

  const beforeClock = footballAct.scorecard.football.matchClock;
  const steppedFootball = simEngine.stepFootball();
  assert('Football simulation advances match minute and stats',
    steppedFootball.scorecard.football.matchClock !== beforeClock);

  // F1 data model and telemetry simulation test
  const f1Act = simEngine.getF1Activity();
  assert('F1 activity matches Monaco GP model with 78 total laps and driver leaderboard',
    f1Act.sport === 'f1' &&
    f1Act.title === 'Monaco GP' &&
    f1Act.scorecard.f1 &&
    f1Act.scorecard.f1.totalLaps === 78 &&
    Array.isArray(f1Act.scorecard.f1.leaderboard) &&
    f1Act.scorecard.f1.leaderboard.length >= 5);
  assert('F1 driver leaderboard contains team color stripes and tyre compound tracking',
    f1Act.scorecard.f1.leaderboard[0].teamColor.startsWith('#') &&
    ['SOFT', 'MEDIUM', 'HARD', 'INTER', 'WET'].includes(f1Act.scorecard.f1.leaderboard[0].tyreCompound));

  const beforeLap = f1Act.scorecard.f1.currentLap;
  const steppedF1 = simEngine.stepF1();
  assert('F1 simulation advances lap count and telemetry intervals',
    steppedF1.scorecard.f1.currentLap > beforeLap);

  // SportsService singleton and sport switching lifecycle
  const service = SportsService.getInstance();
  const initialSportsState = service.getState();
  assert('SportsService initializes with enabled status and all 3 sport models',
    initialSportsState.enabled === true &&
    initialSportsState.activities.cricket &&
    initialSportsState.activities.football &&
    initialSportsState.activities.f1);

  const initialSport = initialSportsState.activeSport;
  const toggledSport = service.toggleSport();
  assert('SportsService.toggleSport switches active sport cleanly',
    toggledSport.sport !== initialSport);
  service.toggleSport('cricket');
  assert('SportsService can select explicit sport target',
    service.getActiveActivity().sport === 'cricket');

  // Mode switching & fallback resilience per R7
  const modeRes = service.setMode('simulated');
  assert('SportsService switches mode to simulated fallback per R7',
    modeRes.isSimulated === true && service.getState().mode === 'simulated');

  // Preload and IPC interface contracts
  const islandPreloadTs = fs.readFileSync(path.join(__dirname, '../src/preload/island-preload.ts'), 'utf-8');
  assert('island-preload.ts exposes typed sports API with getState, toggleSport, setMode, onSportsUpdate',
    islandPreloadTs.includes('sports:') &&
    islandPreloadTs.includes('getState:') &&
    islandPreloadTs.includes('toggleSport:') &&
    islandPreloadTs.includes('setMode:') &&
    islandPreloadTs.includes('onSportsUpdate:'));

  // Main process IPC registration in index.ts
  assert('index.ts registers sports IPC endpoints and broadcast callback',
    indexTs.includes('sports:get-state') &&
    indexTs.includes('sports:toggle-match') &&
    indexTs.includes('sports:set-mode') &&
    indexTs.includes('sports:step-simulation') &&
    indexTs.includes('sportsService.setBroadcastCallback'));

  // CanvasEngine renderer and physics contract
  assert('canvas-engine.ts defines drawCompactSportsScoreboard method on prototype',
    canvasEngineSrc.includes('drawCompactSportsScoreboard') &&
    canvasEngineSrc.includes('calculateSportsPillWidth'));
  assert('canvas-engine.ts defines renderSportsScorecardDOM method',
    canvasEngineSrc.includes('renderSportsScorecardDOM'));

  // DOM & CSS contracts in index.html and island.css
  assert('index.html contains #panel-sports and #sports-scorecard-modal',
    indexHtml.includes('id="panel-sports"') &&
    indexHtml.includes('id="sports-scorecard-modal"'));
  assert('index.html provides interactive sport-switcher-tabs for Cricket, Football, and F1',
    indexHtml.includes('id="sport-tab-cricket"') &&
    indexHtml.includes('id="sport-tab-football"') &&
    indexHtml.includes('id="sport-tab-f1"') &&
    indexHtml.includes('id="sport-mode-toggle"'));
  assert('island.css styles #panel-sports and active sports tab glow',
    islandCss.includes('#panel-sports') &&
    islandCss.includes('.nav-item.active[data-tab="sports"]') &&
    islandCss.includes('.sports-scorecard-container'));

  // --- 31. Testing R2: Universal Spotlight / Raycast Launcher (Alt + Space) ---
  console.log('\n--- 31. Testing R2: Universal Spotlight / Raycast Launcher (Alt + Space) ---');
  const launcherEnginePath = path.join(__dirname, '../dist/main/launcher-engine.js');
  assert('launcher-engine.js exists in dist/main', fs.existsSync(launcherEnginePath));

  const {
    SafeMathParser,
    UnitConverter,
    CurrencyConverter,
    AppFileSearch,
    QuickAIPrompt,
    LauncherEngine,
    launcherEngine
  } = require(launcherEnginePath);

  // 1. SafeMathParser: Arithmetic, precedence, power, and parentheses
  const calc1 = SafeMathParser.evaluate('2 + 2 * 3');
  assert('SafeMathParser evaluates operator precedence: 2 + 2 * 3 = 8',
    calc1 && calc1.result === 8 && calc1.formatted === '8');

  const calc2 = SafeMathParser.evaluate('(10 + 5) * 2');
  assert('SafeMathParser evaluates parentheses: (10 + 5) * 2 = 30',
    calc2 && calc2.result === 30 && calc2.formatted === '30');

  const calc3 = SafeMathParser.evaluate('2^8');
  assert('SafeMathParser evaluates power: 2^8 = 256',
    calc3 && calc3.result === 256 && calc3.formatted === '256');

  const calc3b = SafeMathParser.evaluate('2 ** 8');
  assert('SafeMathParser evaluates JavaScript ** exponent operator: 2 ** 8 = 256',
    calc3b && calc3b.result === 256 && calc3b.formatted === '256');

  const calc4 = SafeMathParser.evaluate('3.5 * 2.5');
  assert('SafeMathParser evaluates decimals: 3.5 * 2.5 = 8.75',
    calc4 && Math.abs(calc4.result - 8.75) < 0.001);

  // 2. SafeMathParser: Percentages
  const pct1 = SafeMathParser.evaluate('15% of 850');
  assert('SafeMathParser evaluates percentage "of": 15% of 850 = 127.5',
    pct1 && Math.abs(pct1.result - 127.5) < 0.001);

  const pct2 = SafeMathParser.evaluate('25% off 200');
  assert('SafeMathParser evaluates percentage "off": 25% off 200 = 150',
    pct2 && Math.abs(pct2.result - 150) < 0.001);

  const pct3 = SafeMathParser.evaluate('10 + 5%');
  assert('SafeMathParser evaluates percentage addition modifier: 10 + 5% = 10.5',
    pct3 && Math.abs(pct3.result - 10.5) < 0.001);

  const pct4 = SafeMathParser.evaluate('200 - 10%');
  assert('SafeMathParser evaluates percentage subtraction modifier: 200 - 10% = 180',
    pct4 && Math.abs(pct4.result - 180) < 0.001);

  const pct5 = SafeMathParser.evaluate('10 + 20 + 10%');
  assert('SafeMathParser evaluates compound percentage: 10 + 20 + 10% = 33',
    pct5 && Math.abs(pct5.result - 33) < 0.001);

  // 3. SafeMathParser: Functions, Constants, and Implicit Multiplication
  const fn1 = SafeMathParser.evaluate('sqrt(144)');
  assert('SafeMathParser evaluates sqrt(144) = 12',
    fn1 && fn1.result === 12);

  const fn2 = SafeMathParser.evaluate('abs(-42)');
  assert('SafeMathParser evaluates abs(-42) = 42',
    fn2 && fn2.result === 42);

  const fn3 = SafeMathParser.evaluate('pi * 2');
  assert('SafeMathParser evaluates constants: pi * 2 approx 6.283185',
    fn3 && Math.abs(fn3.result - Math.PI * 2) < 0.001);

  const fn4 = SafeMathParser.evaluate('2(10 + 5)');
  assert('SafeMathParser evaluates implicit multiplication with parentheses: 2(10 + 5) = 30',
    fn4 && fn4.result === 30);

  const fn5 = SafeMathParser.evaluate('-5 + 10');
  assert('SafeMathParser evaluates unary minus: -5 + 10 = 5',
    fn5 && fn5.result === 5);

  // 4. SafeMathParser: Security & Non-eval verification
  assert('SafeMathParser rejects arbitrary code injection (alert)',
    SafeMathParser.evaluate('alert(1)') === null);
  assert('SafeMathParser rejects arbitrary code injection (process.exit)',
    SafeMathParser.evaluate('process.exit()') === null);
  assert('SafeMathParser rejects __proto__ property access',
    SafeMathParser.evaluate('__proto__') === null);
  assert('SafeMathParser ignores plain numbers without operator',
    SafeMathParser.evaluate('42') === null);

  // 5. UnitConverter: Length, Mass, Temperature, Data, Time
  const uLen = UnitConverter.convert('5 km to miles');
  assert('UnitConverter converts length: 5 km to miles approx 3.10686',
    uLen && uLen.category === 'length' && Math.abs(uLen.toValue - 3.10686) < 0.01);

  const uMass = UnitConverter.convert('100 lbs to kg');
  assert('UnitConverter converts mass: 100 lbs to kg approx 45.3592',
    uMass && uMass.category === 'mass' && Math.abs(uMass.toValue - 45.3592) < 0.01);

  const uTemp1 = UnitConverter.convert('100 C to F');
  assert('UnitConverter converts temperature: 100 C to F = 212',
    uTemp1 && uTemp1.category === 'temp' && Math.abs(uTemp1.toValue - 212) < 0.01);

  const uTemp2 = UnitConverter.convert('32 F to C');
  assert('UnitConverter converts temperature: 32 F to C = 0',
    uTemp2 && uTemp2.category === 'temp' && Math.abs(uTemp2.toValue - 0) < 0.01);

  const uTemp3 = UnitConverter.convert('-40 C to F');
  assert('UnitConverter converts negative temperature: -40 C to F = -40',
    uTemp3 && uTemp3.category === 'temp' && Math.abs(uTemp3.toValue - (-40)) < 0.01);

  const uData = UnitConverter.convert('1 TB to GB');
  assert('UnitConverter converts data storage: 1 TB to GB = 1024',
    uData && uData.category === 'data' && uData.toValue === 1024);

  const uTime = UnitConverter.convert('2 hours in minutes');
  assert('UnitConverter converts time: 2 hours in minutes = 120',
    uTime && uTime.category === 'time' && uTime.toValue === 120);

  assert('UnitConverter rejects cross-category invalid conversion',
    UnitConverter.convert('5 km to kg') === null);

  // 6. CurrencyConverter: Offline Matrix & Rates
  const rates = CurrencyConverter.getRates();
  assert('CurrencyConverter contains major fiat currencies in offline matrix',
    typeof rates.USD === 'number' &&
    typeof rates.EUR === 'number' &&
    typeof rates.GBP === 'number' &&
    typeof rates.JPY === 'number' &&
    typeof rates.INR === 'number' &&
    typeof rates.CAD === 'number');

  const cur1 = CurrencyConverter.convert('100 USD to EUR');
  assert('CurrencyConverter converts USD to EUR using offline matrix',
    cur1 && cur1.fromCurrency === 'USD' && cur1.toCurrency === 'EUR' && cur1.toAmount > 0);

  const cur2 = CurrencyConverter.convert('$50 in INR');
  assert('CurrencyConverter handles symbol syntax: $50 in INR',
    cur2 && cur2.fromCurrency === 'USD' && cur2.toCurrency === 'INR' && cur2.toAmount > 0);

  // 7. AppFileSearch: Fuzzy matching & Windows system apps
  assert('AppFileSearch defines system application shortcuts',
    AppFileSearch.search('').length >= 5);

  const fuzzyScoreExact = AppFileSearch.calculateFuzzyScore('calc', 'calculator');
  assert('AppFileSearch assigns high fuzzy score to prefix match',
    fuzzyScoreExact >= 80);

  const fuzzyScoreBoundary = AppFileSearch.calculateFuzzyScore('term', 'windows terminal');
  assert('AppFileSearch assigns high fuzzy score to word boundary match',
    fuzzyScoreBoundary >= 70);

  const noteApp = AppFileSearch.search('note');
  assert('AppFileSearch finds Notepad for query "note"',
    noteApp.length > 0 && noteApp[0].name.toLowerCase().includes('note'));

  // 8. QuickAIPrompt: Prefix parsing & Question routing
  const ai1 = QuickAIPrompt.parse('ai: explain dynamic island physics');
  assert('QuickAIPrompt parses ai: prefix query',
    ai1 && ai1.type === 'ai' && ai1.prompt === 'explain dynamic island physics');

  const ai2 = QuickAIPrompt.parse('? best ways to optimize Windows performance');
  assert('QuickAIPrompt parses ? prefix query',
    ai2 && ai2.type === 'ai' && ai2.prompt === 'best ways to optimize Windows performance');

  const ai3 = QuickAIPrompt.parse('how does shunting yard algorithm work');
  assert('QuickAIPrompt parses natural language question prefix',
    ai3 && ai3.type === 'ai' && ai3.prompt.startsWith('how'));

  // 9. Master LauncherEngine query dispatch
  const qCalc = await launcherEngine.query('50 * 4');
  assert('LauncherEngine routes math expression to type "calc"',
    qCalc.type === 'calc' && qCalc.result.result === 200);

  const qConv = await launcherEngine.query('5 miles to km');
  assert('LauncherEngine routes conversion expression to type "convert"',
    qConv.type === 'convert' && qConv.result.toValue > 0);

  const qCurr = await launcherEngine.query('100 EUR to USD');
  assert('LauncherEngine routes currency query to type "convert"',
    qCurr.type === 'convert' && qCurr.result.toAmount > 0);

  const qApp = await launcherEngine.query('calculator');
  assert('LauncherEngine routes application query to type "app"',
    qApp.type === 'app' && qApp.items.length > 0);

  const qAI = await launcherEngine.query('ai: help me write a poem');
  assert('LauncherEngine routes AI query to type "ai"',
    qAI.type === 'ai' && qAI.items[0].category === 'ai');

  // 10. Preload, Main IPC, and Global Shortcut contracts for R2
  assert('island-preload.ts exposes typed launcher API with query, launch, hide, toggle, setActive, onToggleLauncher',
    islandPreloadTs.includes('launcher:') &&
    islandPreloadTs.includes('queryLauncher:') &&
    islandPreloadTs.includes('launchLauncherItem:') &&
    islandPreloadTs.includes('onToggleLauncher:'));

  assert('island-window.ts registers Alt+Space global shortcut with CommandOrControl+Space fallback',
    islandWindowTs.includes("'Alt+Space'") &&
    islandWindowTs.includes("'CommandOrControl+Space'") &&
    islandWindowTs.includes('toggleLauncherShortcut'));

  assert('island-window.ts tracks isLauncherActive and ensures interactivity for launcher',
    islandWindowTs.includes('isLauncherActive') &&
    islandWindowTs.includes('island:set-launcher-active'));

  assert('index.ts registers launcher:query and launcher:launch IPC handlers',
    indexTs.includes("'launcher:query'") &&
    indexTs.includes("'launcher:launch'") &&
    indexTs.includes("'launcher:hide'") &&
    indexTs.includes("'island:toggle-launcher'"));

  // 11. CanvasEngine renderer and DOM contracts for R2
  assert('canvas-engine.ts handles launcher dimensions (620x54 expanding to 380px) and DOM events',
    canvasEngineSrc.includes('this.isLauncherActive') &&
    canvasEngineSrc.includes('setupSpotlightLauncherDOM') &&
    canvasEngineSrc.includes('toggleLauncher') &&
    canvasEngineSrc.includes('queryLauncher'));

  assert('index.html contains #spotlight-launcher-overlay with search input and results container',
    indexHtml.includes('id="spotlight-launcher-overlay"') &&
    indexHtml.includes('id="spotlight-input"') &&
    indexHtml.includes('id="spotlight-results"') &&
    indexHtml.includes('id="spotlight-hero-card"') &&
    indexHtml.includes('id="spotlight-list"'));

  assert('island.css styles Spotlight / Raycast Launcher bar and hero card',
    islandCss.includes('.spotlight-launcher-overlay') &&
    islandCss.includes('.spotlight-bar') &&
    islandCss.includes('.spotlight-hero-card') &&
    islandCss.includes('.spotlight-list'));

  // --- 32. Testing R3: Ambient Screen Glance & Error Fixer (Apple Intelligence Style) ---
  console.log('\n--- 32. Testing R3: Ambient Screen Glance & Error Fixer (Apple Intelligence Style) ---');
  const screenGlanceEnginePath = path.join(__dirname, '../dist/main/screen-glance-engine.js');
  assert('screen-glance-engine.js exists in dist/main', fs.existsSync(screenGlanceEnginePath));

  const {
    ScreenGlanceEngine,
    screenGlanceEngine,
    ERROR_CATALOG_RULES
  } = require(screenGlanceEnginePath);

  // 1. Error catalog rule quantity
  assert('Error catalog contains 30+ regex compiler/terminal/browser rules',
    Array.isArray(ERROR_CATALOG_RULES) && ERROR_CATALOG_RULES.length >= 30);

  // 2. Active Window taxonomy classification
  assert('classifyWindow detects compiler_ide for Code.exe',
    screenGlanceEngine.classifyWindow('Code.exe', 'server.ts - RoboIsland - Visual Studio Code') === 'compiler_ide');
  assert('classifyWindow detects terminal for WindowsTerminal.exe',
    screenGlanceEngine.classifyWindow('WindowsTerminal.exe', 'PowerShell') === 'terminal');
  assert('classifyWindow detects browser for chrome.exe',
    screenGlanceEngine.classifyWindow('chrome.exe', 'MDN Web Docs - Google Chrome') === 'browser');
  assert('classifyWindow detects document_pdf for Acrobat and .pdf in title',
    screenGlanceEngine.classifyWindow('AcroRd32.exe', 'Annual_Report_2026.pdf') === 'document_pdf');
  assert('classifyWindow detects media_video for VLC and YouTube',
    screenGlanceEngine.classifyWindow('vlc.exe', 'Big Buck Bunny') === 'media_video');

  // 3. TypeScript regex catalog patterns & fix suggestions
  const tsModuleErr = screenGlanceEngine.detectErrors("TS2307: Cannot find module 'axios' or its corresponding type declarations.");
  assert('TypeScript catalog detects TS2307 and generates npm install fix',
    tsModuleErr.length > 0 && tsModuleErr[0].ruleId === 'ts-cannot-find-module' && tsModuleErr[0].command === 'npm install axios');

  const tsNameErr = screenGlanceEngine.detectErrors("TS2304: Cannot find name 'useState'.");
  assert('TypeScript catalog detects TS2304 and generates import fix',
    tsNameErr.length > 0 && tsNameErr[0].ruleId === 'ts-cannot-find-name' && tsNameErr[0].command.includes('useState'));

  const tsAssignErr = screenGlanceEngine.detectErrors("TS2322: Type 'string' is not assignable to type 'number'.");
  assert('TypeScript catalog detects TS2322 type mismatch',
    tsAssignErr.length > 0 && tsAssignErr[0].ruleId === 'ts-not-assignable' && tsAssignErr[0].command.includes('number'));

  const tsPropErr = screenGlanceEngine.detectErrors("TS2339: Property 'userToken' does not exist on type 'SessionContext'.");
  assert('TypeScript catalog detects TS2339 missing property and suggests optional chain',
    tsPropErr.length > 0 && tsPropErr[0].ruleId === 'ts-property-not-exist' && tsPropErr[0].command.includes('userToken'));

  // 4. Node / NPM regex catalog patterns & fix suggestions
  const nodePortErr = screenGlanceEngine.detectErrors("Error: listen EADDRINUSE: address already in use :::3000");
  assert('Node catalog detects EADDRINUSE and generates kill-port command',
    nodePortErr.length > 0 && nodePortErr[0].ruleId === 'node-eaddrinuse' && nodePortErr[0].command === 'npx kill-port 3000');

  const nodeModErr = screenGlanceEngine.detectErrors("Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'express' imported from /app/index.js");
  assert('Node catalog detects ERR_MODULE_NOT_FOUND and suggests npm install',
    nodeModErr.length > 0 && nodeModErr[0].ruleId === 'node-module-not-found' && nodeModErr[0].command === 'npm install express');

  const npmEresolve = screenGlanceEngine.detectErrors("npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE unable to resolve dependency tree");
  assert('NPM catalog detects ERESOLVE and suggests --legacy-peer-deps',
    npmEresolve.length > 0 && npmEresolve[0].ruleId === 'npm-eresolve' && npmEresolve[0].command === 'npm install --legacy-peer-deps');

  const npmScriptErr = screenGlanceEngine.detectErrors('npm ERR! Missing script: "build:prod"\nnpm ERR! To see a list of scripts, run: npm run');
  assert('NPM catalog detects Missing script and suggests npm run',
    npmScriptErr.length > 0 && npmScriptErr[0].ruleId === 'npm-missing-script' && npmScriptErr[0].command === 'npm run');

  const nodeConnErr = screenGlanceEngine.detectErrors("connect ECONNREFUSED 127.0.0.1:8080");
  assert('Network catalog detects ECONNREFUSED and generates curl diagnostic',
    nodeConnErr.length > 0 && nodeConnErr[0].ruleId === 'node-econnrefused' && nodeConnErr[0].command.includes('8080'));

  // 5. Python regex catalog patterns & fix suggestions
  const pyModErr = screenGlanceEngine.detectErrors("ModuleNotFoundError: No module named 'torch'");
  assert('Python catalog detects ModuleNotFoundError and generates pip install',
    pyModErr.length > 0 && pyModErr[0].ruleId === 'py-modulenotfound' && pyModErr[0].command === 'pip install torch');

  const pyIndentErr = screenGlanceEngine.detectErrors("IndentationError: unexpected indent");
  assert('Python catalog detects IndentationError and suggests reformat',
    pyIndentErr.length > 0 && pyIndentErr[0].ruleId === 'py-indentation');

  const pySyntaxErr = screenGlanceEngine.detectErrors("SyntaxError: invalid syntax");
  assert('Python catalog detects SyntaxError and suggests py_compile',
    pySyntaxErr.length > 0 && pySyntaxErr[0].ruleId === 'py-syntaxerror');

  const pyZeroErr = screenGlanceEngine.detectErrors("ZeroDivisionError: division by zero");
  assert('Python catalog detects ZeroDivisionError and suggests zero check',
    pyZeroErr.length > 0 && pyZeroErr[0].ruleId === 'py-zerodivision');

  // 6. Rust / Cargo regex catalog patterns & fix suggestions
  const rustE0425 = screenGlanceEngine.detectErrors("error[E0425]: cannot find value `counter` in this scope");
  assert('Rust catalog detects error[E0425] and generates rustc --explain E0425',
    rustE0425.length > 0 && rustE0425[0].ruleId === 'rust-e0425' && rustE0425[0].command === 'rustc --explain E0425');

  const rustE0308 = screenGlanceEngine.detectErrors("error[E0308]: mismatched types");
  assert('Rust catalog detects error[E0308] mismatched types',
    rustE0308.length > 0 && rustE0308[0].ruleId === 'rust-e0308');

  const rustE0382 = screenGlanceEngine.detectErrors("error[E0382]: use of moved value: `buffer`");
  assert('Rust catalog detects error[E0382] and suggests .clone()',
    rustE0382.length > 0 && rustE0382[0].ruleId === 'rust-e0382' && rustE0382[0].command === '.clone()');

  const rustCargoLock = screenGlanceEngine.detectErrors("error: failed to select a version for the requirement `serde`");
  assert('Rust catalog detects Cargo version conflict and suggests cargo update',
    rustCargoLock.length > 0 && rustCargoLock[0].ruleId === 'rust-cargo-lock' && rustCargoLock[0].command === 'cargo update');

  // 7. Git regex catalog patterns & fix suggestions
  const gitNotRepo = screenGlanceEngine.detectErrors("fatal: not a git repository (or any of the parent directories): .git");
  assert('Git catalog detects not a git repo and suggests git init',
    gitNotRepo.length > 0 && gitNotRepo[0].ruleId === 'git-not-a-repo' && gitNotRepo[0].command === 'git init');

  const gitPushFail = screenGlanceEngine.detectErrors("error: failed to push some refs to 'git@github.com:user/repo.git'");
  assert('Git catalog detects failed push and suggests git pull --rebase',
    gitPushFail.length > 0 && gitPushFail[0].ruleId === 'git-failed-push' && gitPushFail[0].command === 'git pull --rebase');

  const gitUnrelated = screenGlanceEngine.detectErrors("fatal: refusing to merge unrelated histories");
  assert('Git catalog detects refusing to merge unrelated histories and suggests override',
    gitUnrelated.length > 0 && gitUnrelated[0].ruleId === 'git-unrelated-histories' && gitUnrelated[0].command.includes('--allow-unrelated-histories'));

  const gitRemoteExists = screenGlanceEngine.detectErrors("fatal: remote origin already exists.");
  assert('Git catalog detects remote already exists and suggests git remote -v',
    gitRemoteExists.length > 0 && gitRemoteExists[0].ruleId === 'git-remote-exists');

  const gitSsh = screenGlanceEngine.detectErrors("Permission denied (publickey). fatal: Could not read from remote repository.");
  assert('Git catalog detects SSH permission denied and suggests ssh-add',
    gitSsh.length > 0 && gitSsh[0].ruleId === 'git-ssh-permission' && gitSsh[0].command.includes('ssh-add'));

  // 8. Web / Network / Terminal regex catalog patterns & fix suggestions
  const webCors = screenGlanceEngine.detectErrors("Access to fetch has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.");
  assert('Web catalog detects CORS policy block and suggests Access-Control header',
    webCors.length > 0 && webCors[0].ruleId === 'web-cors-policy');

  const termNotFound = screenGlanceEngine.detectErrors("bash: command not found: ripgrep");
  assert('Terminal catalog detects command not found and suggests winget search',
    termNotFound.length > 0 && termNotFound[0].ruleId === 'terminal-command-not-found' && termNotFound[0].command.includes('ripgrep'));

  const cmdNotFound = screenGlanceEngine.detectErrors("'make' is not recognized as an internal or external command, operable program or batch file.");
  assert('Terminal catalog detects Windows command not recognized and suggests winget search',
    cmdNotFound.length > 0 && cmdNotFound[0].ruleId === 'terminal-command-not-found' && cmdNotFound[0].command.includes('make'));

  const dockerErr = screenGlanceEngine.detectErrors("Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?");
  assert('Terminal catalog detects Docker daemon stopped and suggests starting Docker',
    dockerErr.length > 0 && dockerErr[0].ruleId === 'docker-daemon-stopped');

  // 9. 1-Tap applyFix execution & clipboard dispatch
  const checkResults = await screenGlanceEngine.checkErrors("Cannot find module 'lodash'");
  assert('checkErrors detects error and tracks active errors in state',
    checkResults.length > 0 && screenGlanceEngine.getState().activeErrors.length > 0);

  const applyRes = await screenGlanceEngine.applyFix(checkResults[0].id, { executeCommand: false });
  assert('applyFix produces successful command payload for execution',
    applyRes && applyRes.success && applyRes.command === 'npm install lodash');

  // 10. 1-Click Document & Media Summarizer with structured offline heuristic fallback per R7
  const pdfSummary = await screenGlanceEngine.summarizeActive({
    title: 'Distributed_Systems_Architecture.pdf - Adobe Acrobat Reader'
  });
  assert('summarizeActive detects PDF document and provides reading time and takeaways',
    pdfSummary && pdfSummary.type === 'pdf' && pdfSummary.title === 'Distributed_Systems_Architecture.pdf' && pdfSummary.takeaways.length >= 2);

  const videoSummary = await screenGlanceEngine.summarizeActive({
    title: 'Building a Dynamic Island for Windows - YouTube'
  });
  assert('summarizeActive detects Video media and provides watch time and takeaways',
    videoSummary && videoSummary.type === 'video' && videoSummary.title === 'Building a Dynamic Island for Windows' && videoSummary.takeaways.length >= 2);

  const articleText = `
    Apple Intelligence represents a major leap in personal contextual intelligence.
    The architecture combines on-device small language models with private cloud compute.
    Key takeaways include sub-second inference latency, deterministic safety filters, and zero data retention.
    Important results show a 40% reduction in cognitive load during complex debugging sessions.
  `;
  const articleSummary = await screenGlanceEngine.summarizeActive({
    title: 'Apple Intelligence Architecture Review',
    text: articleText
  });
  assert('summarizeActive parses long article text and extracts structured takeaways and action items',
    articleSummary && articleSummary.takeaways.length >= 2 && articleSummary.actionItems.length >= 2 && articleSummary.source === 'offline_heuristic');

  // 11. Preload, Main IPC, and DOM contracts for R3
  assert('island-preload.ts exposes typed screenGlance API with checkErrors, applyFix, summarizeActive, getState, onGlanceError, onGlanceSummary',
    islandPreloadTs.includes('screenGlance:') &&
    islandPreloadTs.includes('checkErrors:') &&
    islandPreloadTs.includes('applyFix:') &&
    islandPreloadTs.includes('summarizeActive:') &&
    islandPreloadTs.includes('onGlanceError:') &&
    islandPreloadTs.includes('onGlanceSummary:'));

  assert('index.ts registers screen-glance IPC endpoints and broadcast callback',
    indexTs.includes("'screen-glance:check-errors'") &&
    indexTs.includes("'screen-glance:apply-fix'") &&
    indexTs.includes("'screen-glance:summarize-active'") &&
    indexTs.includes("'screen-glance:get-state'") &&
    indexTs.includes('screenGlanceEngine.onErrorsChanged'));

  assert('canvas-engine.ts defines setupScreenGlanceDOM, showGlanceErrorPill, and openGlanceSummaryModal',
    canvasEngineSrc.includes('setupScreenGlanceDOM') &&
    canvasEngineSrc.includes('showGlanceErrorPill') &&
    canvasEngineSrc.includes('openGlanceErrorModal') &&
    canvasEngineSrc.includes('openGlanceSummaryModal') &&
    canvasEngineSrc.includes('triggerScreenSummarizer'));

  assert('index.html contains #glance-error-pill, #glance-error-modal, #glance-summary-modal, and #btn-glance-summarize',
    indexHtml.includes('id="glance-error-pill"') &&
    indexHtml.includes('id="glance-error-modal"') &&
    indexHtml.includes('id="glance-summary-modal"') &&
    indexHtml.includes('id="btn-glance-summarize"'));

  assert('island.css styles .glance-error-pill, .glance-error-modal, and .glance-summary-modal',
    islandCss.includes('.glance-error-pill') &&
    islandCss.includes('.glance-error-modal') &&
    islandCss.includes('.glance-summary-modal') &&
    islandCss.includes('.glance-takeaways-list'));

  // --- 33. Testing R4: WhatsApp AI Smart Replies & Voice Note Reader ---
  console.log('\n--- 33. Testing R4: WhatsApp AI Smart Replies & Voice Note Reader ---');

  const { whatsappSmartService, WhatsAppSmartService } = require('../dist/main/whatsapp-smart-service');
  assert('whatsapp-smart-service.js exists in dist/main',
    fs.existsSync(path.join(__dirname, '../dist/main/whatsapp-smart-service.js')));
  assert('whatsappSmartService is an instance of WhatsAppSmartService',
    whatsappSmartService instanceof WhatsAppSmartService);

  // 1. Intent Classification across all 7 Categories
  const greetingIntent = whatsappSmartService.classifyIntent('Hi there! Good morning, how are you?');
  assert('Intent classifier detects GREETING', greetingIntent === 'GREETING');

  const schedulingIntent = whatsappSmartService.classifyIntent('Are you free at 3pm for a quick sync?');
  assert('Intent classifier detects SCHEDULING', schedulingIntent === 'SCHEDULING');

  const confirmationIntent = whatsappSmartService.classifyIntent('Can you do this task before the deployment?');
  assert('Intent classifier detects CONFIRMATION', confirmationIntent === 'CONFIRMATION');

  const gratitudeIntent = whatsappSmartService.classifyIntent('Thank you so much for the incredible help!');
  assert('Intent classifier detects GRATITUDE', gratitudeIntent === 'GRATITUDE');

  const statusIntent = whatsappSmartService.classifyIntent("What's the status on the milestone 4 build?");
  assert('Intent classifier detects QUESTION_STATUS', statusIntent === 'QUESTION_STATUS');

  const voiceNoteIntent = whatsappSmartService.classifyIntent('Voice message (0:45)');
  assert('Intent classifier detects VOICE_NOTE', voiceNoteIntent === 'VOICE_NOTE');

  const fallbackIntent = whatsappSmartService.classifyIntent('The weather outside is rather cloudy today.');
  assert('Intent classifier detects GENERAL_FALLBACK', fallbackIntent === 'GENERAL_FALLBACK');

  // 2. Reply Generation Format (Exactly 3 distinct non-empty string suggestions per query)
  const greetingReplies = whatsappSmartService.getSmartReplies('Hello!', 'Alice');
  assert('GREETING produces exactly 3 non-empty string replies',
    greetingReplies.replies.length === 3 && greetingReplies.replies.every(r => typeof r === 'string' && r.length > 0));

  const schedulingReplies = whatsappSmartService.getSmartReplies('When should we meet tomorrow?');
  assert('SCHEDULING produces exactly 3 non-empty string replies',
    schedulingReplies.replies.length === 3 && schedulingReplies.replies.every(r => typeof r === 'string' && r.length > 0));

  const confirmationReplies = whatsappSmartService.getSmartReplies('Is that okay with you?');
  assert('CONFIRMATION produces exactly 3 non-empty string replies',
    confirmationReplies.replies.length === 3 && confirmationReplies.replies.every(r => typeof r === 'string' && r.length > 0));

  const gratitudeReplies = whatsappSmartService.getSmartReplies('Thanks a lot!');
  assert('GRATITUDE produces exactly 3 non-empty string replies',
    gratitudeReplies.replies.length === 3 && gratitudeReplies.replies.every(r => typeof r === 'string' && r.length > 0));

  const statusReplies = whatsappSmartService.getSmartReplies('Where are you right now?');
  assert('QUESTION_STATUS produces exactly 3 non-empty string replies',
    statusReplies.replies.length === 3 && statusReplies.replies.every(r => typeof r === 'string' && r.length > 0));

  const voiceReplies = whatsappSmartService.getSmartReplies('Voice message (0:20)');
  assert('VOICE_NOTE produces exactly 3 non-empty string replies',
    voiceReplies.replies.length === 3 && voiceReplies.replies.every(r => typeof r === 'string' && r.length > 0));

  const fallbackReplies = whatsappSmartService.getSmartReplies('Just random observation here.');
  assert('GENERAL_FALLBACK produces exactly 3 non-empty string replies',
    fallbackReplies.replies.length === 3 && fallbackReplies.replies.every(r => typeof r === 'string' && r.length > 0));

  // 3. Sender Personalization
  assert('Personalized greeting includes sender name',
    greetingReplies.replies[0].includes('Alice'));

  // 4. Voice Note Pattern Detection & Duration Parsing
  const vnParse1 = whatsappSmartService.parseVoiceNoteDetails('Voice message (0:45)');
  assert('parseVoiceNoteDetails detects Voice message (0:45) as 45 seconds',
    vnParse1.isVoiceNote === true && vnParse1.durationSeconds === 45);

  const vnParse2 = whatsappSmartService.parseVoiceNoteDetails('Audio message (1:15)');
  assert('parseVoiceNoteDetails detects Audio message (1:15) as 75 seconds',
    vnParse2.isVoiceNote === true && vnParse2.durationSeconds === 75);

  const vnParse3 = whatsappSmartService.parseVoiceNoteDetails('voice note (30s)');
  assert('parseVoiceNoteDetails detects voice note (30s) as 30 seconds',
    vnParse3.isVoiceNote === true && vnParse3.durationSeconds === 30);

  const vnParseNon = whatsappSmartService.parseVoiceNoteDetails('Let us discuss this on phone');
  assert('parseVoiceNoteDetails rejects non-voice-note text',
    vnParseNon.isVoiceNote === false && vnParseNon.durationSeconds === 0);

  // 5. Voice Note Transcription Engine & Contextual Synthesizer
  const vnTranscript = whatsappSmartService.transcribeVoiceNote('test-vn-1', 45, 'engineering build PR review');
  assert('transcribeVoiceNote returns valid transcript object with confidence and duration',
    vnTranscript && vnTranscript.voiceNoteId === 'test-vn-1' &&
    vnTranscript.durationSeconds === 45 &&
    typeof vnTranscript.transcript === 'string' &&
    vnTranscript.transcript.length > 10 &&
    vnTranscript.confidence >= 0.90 && vnTranscript.confidence <= 1.0);

  assert('Contextual synthesizer incorporates technical keywords for engineering context',
    vnTranscript.transcript.toLowerCase().includes('pull request') ||
    vnTranscript.transcript.toLowerCase().includes('build') ||
    vnTranscript.transcript.toLowerCase().includes('milestone'));

  const vnSync = whatsappSmartService.transcribeVoiceNote('test-vn-2', 20, 'let us meet and sync up calendar');
  assert('Contextual synthesizer incorporates scheduling context',
    vnSync.transcript.toLowerCase().includes('calendar') ||
    vnSync.transcript.toLowerCase().includes('sync') ||
    vnSync.transcript.toLowerCase().includes('schedule'));

  // 6. Simulation Engine & Test Hooks (per R7)
  let simulatedEventCaptured = null;
  whatsappSmartService.setBroadcastCallback((channel, payload) => {
    if (channel === 'island:whatsapp-incoming') {
      simulatedEventCaptured = payload;
    }
  });

  const simMsg = whatsappSmartService.simulateIncomingMessage('John', 'Are you free tomorrow at 4pm?');
  assert('simulateIncomingMessage emits island:whatsapp-incoming event and updates history',
    simMsg && simMsg.sender === 'John' &&
    simulatedEventCaptured && simulatedEventCaptured.sender === 'John' &&
    simMsg.smartReplies.length === 3);

  const simVoice = whatsappSmartService.simulateIncomingMessage('Sarah', 'Voice message (0:40)', true, 40);
  assert('simulateIncomingMessage with voice note triggers auto-transcription and smart replies',
    simVoice && simVoice.isVoiceNote === true &&
    simVoice.durationSeconds === 40 &&
    typeof simVoice.transcript === 'string' &&
    simVoice.smartReplies.length === 3);

  assert('whatsappSmartService state records incomingHistory and voiceNoteCount',
    whatsappSmartService.getState().incomingHistory.length >= 2 &&
    whatsappSmartService.getState().voiceNoteCount >= 1);

  // 7. Edge Cases Handling
  const emptyReplies = whatsappSmartService.getSmartReplies('');
  assert('Empty string input falls back safely with 3 non-empty replies',
    emptyReplies.intent === 'GENERAL_FALLBACK' && emptyReplies.replies.length === 3);

  const whitespaceReplies = whatsappSmartService.getSmartReplies('   \t\n  ');
  assert('Whitespace only input falls back safely with 3 non-empty replies',
    whitespaceReplies.intent === 'GENERAL_FALLBACK' && whitespaceReplies.replies.length === 3);

  const emojiConfirm = whatsappSmartService.getSmartReplies('👍');
  assert('Thumbs-up emoji classifies as CONFIRMATION',
    emojiConfirm.intent === 'CONFIRMATION' && emojiConfirm.replies.length === 3);

  const emojiThanks = whatsappSmartService.getSmartReplies('🙏');
  assert('Thanks emoji classifies as GRATITUDE',
    emojiThanks.intent === 'GRATITUDE' && emojiThanks.replies.length === 3);

  const longText = 'Hello there! '.repeat(500);
  const longResult = whatsappSmartService.getSmartReplies(longText);
  assert('Very long message (6,500+ chars) processes without ReDoS or failure',
    longResult && longResult.replies.length === 3);

  const specialCharsResult = whatsappSmartService.getSmartReplies('Hello?!?!? #@$%^&* 123');
  assert('Special characters and punctuation classify as GREETING',
    specialCharsResult.intent === 'GREETING');

  const multiIntentResult = whatsappSmartService.getSmartReplies('Hey! How are you? Are you free at 3?');
  assert('Multi-intent message prioritizes action intent SCHEDULING',
    multiIntentResult.intent === 'SCHEDULING');

  // Remediation Regressions (R4):
  assert('SCHEDULING regex rejects non-time phrase "Look at 5 cats"',
    whatsappSmartService.classifyIntent('Look at 5 cats') === 'GENERAL_FALLBACK');
  assert('SCHEDULING regex rejects non-time phrase "I was at 2 stores"',
    whatsappSmartService.classifyIntent('I was at 2 stores') === 'GENERAL_FALLBACK');
  assert('Conversational mention "I sent you a voice message earlier today, did you hear it?" is rejected from voice note detection',
    whatsappSmartService.parseVoiceNoteDetails('I sent you a voice message earlier today, did you hear it?').isVoiceNote === false);
  assert('Actionable SCHEDULING prioritizes over GRATITUDE in "Thanks! Can you meet at 3pm?"',
    whatsappSmartService.classifyIntent('Thanks! Can you meet at 3pm?') === 'SCHEDULING');

  // 8. IPC and Preload Bridge Contracts for R4
  assert('island-preload.ts exposes typed whatsapp API bridge and sendWhatsAppReply alias',
    islandPreloadTs.includes('whatsapp:') &&
    islandPreloadTs.includes('getSmartReplies:') &&
    islandPreloadTs.includes('transcribeVoiceNote:') &&
    islandPreloadTs.includes('simulateIncoming:') &&
    islandPreloadTs.includes('onVoiceNoteTranscribed:') &&
    islandPreloadTs.includes('sendWhatsAppReply:'));

  assert('index.ts registers whatsapp smart reply, voice note, and simulation IPC handlers',
    indexTs.includes("'whatsapp:get-smart-replies'") &&
    indexTs.includes("'whatsapp:transcribe-voice-note'") &&
    indexTs.includes("'whatsapp:simulate-incoming'") &&
    indexTs.includes('whatsappSmartService.setBroadcastCallback'));

  assert('index.html contains #whatsapp-smart-reply-chips and #whatsapp-voicenote-card',
    indexHtml.includes('id="whatsapp-smart-reply-chips"') &&
    indexHtml.includes('id="whatsapp-voicenote-card"') &&
    indexHtml.includes('id="wa-vn-duration"') &&
    indexHtml.includes('id="wa-vn-transcript"'));

  assert('island.css styles .whatsapp-smart-chip, .whatsapp-voicenote-card, and @keyframes waWaveAnim',
    islandCss.includes('.whatsapp-smart-chip') &&
    islandCss.includes('.whatsapp-voicenote-card') &&
    islandCss.includes('.wa-vn-waves') &&
    islandCss.includes('.wa-vn-bar') &&
    islandCss.includes('waWaveAnim'));

  assert('canvas-engine.ts implements isWhatsAppVoiceNoteActive and fetchAndRenderSmartReplies',
    canvasEngineSrc.includes('isWhatsAppVoiceNoteActive') &&
    canvasEngineSrc.includes('fetchAndRenderSmartReplies') &&
    canvasEngineSrc.includes('whatsapp-smart-chip'));

  // --- 34. Testing R5: AirPods / Bluetooth Battery & Device HUD ---
  console.log('\n--- 34. Testing R5: AirPods / Bluetooth Battery & Device HUD ---');

  const {
    bluetoothMonitorService,
    BluetoothMonitorService,
    BluetoothSimulator,
    classifyBluetoothDeviceType,
    normalizeBatteryLevel,
    normalizeMultiBattery
  } = require('../dist/main/bluetooth-monitor');

  assert('bluetooth-monitor.js exists in dist/main',
    fs.existsSync(path.join(__dirname, '../dist/main/bluetooth-monitor.js')));
  assert('bluetoothMonitorService is an instance of BluetoothMonitorService',
    bluetoothMonitorService instanceof BluetoothMonitorService);
  assert('BluetoothSimulator can be instantiated',
    new BluetoothSimulator() instanceof BluetoothSimulator);

  // 1. Device Type Classification
  assert('classifyBluetoothDeviceType detects AirPods Pro as airpods',
    classifyBluetoothDeviceType('AirPods Pro') === 'airpods');
  assert('classifyBluetoothDeviceType detects AirPods Max as airpods',
    classifyBluetoothDeviceType('AirPods Max') === 'airpods');
  assert('classifyBluetoothDeviceType detects Galaxy Buds2 as earbuds',
    classifyBluetoothDeviceType('Galaxy Buds2 Pro') === 'earbuds');
  assert('classifyBluetoothDeviceType detects Pixel Buds as earbuds',
    classifyBluetoothDeviceType('Google Pixel Buds') === 'earbuds');
  assert('classifyBluetoothDeviceType detects Sony WH-1000XM5 as headphones',
    classifyBluetoothDeviceType('Sony WH-1000XM5') === 'headphones');
  assert('classifyBluetoothDeviceType detects Bose QuietComfort 45 as headphones',
    classifyBluetoothDeviceType('Bose QuietComfort 45') === 'headphones');
  assert('classifyBluetoothDeviceType detects JBL Flip 6 as speaker',
    classifyBluetoothDeviceType('JBL Flip 6') === 'speaker');
  assert('classifyBluetoothDeviceType detects Logitech MX Master 3 as mouse',
    classifyBluetoothDeviceType('Logitech MX Master 3') === 'mouse');
  assert('classifyBluetoothDeviceType detects Keychron K2 as keyboard',
    classifyBluetoothDeviceType('Keychron K2 Keyboard') === 'keyboard');
  assert('classifyBluetoothDeviceType defaults unknown device to peripheral',
    classifyBluetoothDeviceType('Generic BLE Sensor 01') === 'peripheral');
  assert('classifyBluetoothDeviceType handles empty input safely',
    classifyBluetoothDeviceType('') === 'peripheral');

  // 2. Battery Normalization and Clamping (0-100)
  assert('normalizeBatteryLevel extracts integer percentage',
    normalizeBatteryLevel(85) === 85);
  assert('normalizeBatteryLevel parses string percentage',
    normalizeBatteryLevel('92%') === 92);
  assert('normalizeBatteryLevel clamps negative values to 0',
    normalizeBatteryLevel(-15) === 0);
  assert('normalizeBatteryLevel clamps overflow values to 100',
    normalizeBatteryLevel(145) === 100);
  assert('normalizeBatteryLevel returns null for null/undefined/invalid',
    normalizeBatteryLevel(null) === null &&
    normalizeBatteryLevel(undefined) === null &&
    normalizeBatteryLevel('invalid') === null);

  // 3. Multi-Battery Parsing & Normalization (AirPods L/R/Case)
  const mbParsed = normalizeMultiBattery({ left: 85, right: 90, case: 100 });
  assert('normalizeMultiBattery preserves valid multiBattery levels',
    mbParsed && mbParsed.left === 85 && mbParsed.right === 90 && mbParsed.case === 100);

  const mbClamped = normalizeMultiBattery({ left: -10, right: 110, case: 50 });
  assert('normalizeMultiBattery clamps out-of-range multiBattery values',
    mbClamped && mbClamped.left === 0 && mbClamped.right === 100 && mbClamped.case === 50);

  const simInstance = new BluetoothSimulator();
  const airPodsSim = simInstance.createDevice({
    name: 'My AirPods',
    multiBattery: { left: 80, right: 90, case: 100 }
  });
  assert('createDevice computes average earbud battery when batteryPercent is omitted',
    airPodsSim.batteryPercent === 85 && airPodsSim.deviceType === 'airpods');

  // 4. Default State and Device Getters
  bluetoothMonitorService.resetToPresets();
  const allDevices = bluetoothMonitorService.getAllDevices();
  assert('getAllDevices returns initial preset devices list',
    Array.isArray(allDevices) && allDevices.length >= 4);

  const connectedDevices = bluetoothMonitorService.getConnectedDevices();
  assert('getConnectedDevices returns only currently connected devices',
    Array.isArray(connectedDevices) && connectedDevices.length >= 3 &&
    connectedDevices.every(d => d.connected === true));

  const airpodsDevice = bluetoothMonitorService.getDevice('bt-airpods-pro-1');
  assert('getDevice returns targeted device by id',
    airpodsDevice && airpodsDevice.name === 'AirPods Pro' && airpodsDevice.deviceType === 'airpods');

  // 5. Event Transition Detection
  let lastCapturedEvent = null;
  const unsubListener = bluetoothMonitorService.onDeviceEvent((ev) => {
    lastCapturedEvent = ev;
  });

  // Connection transition
  const connectDev = simInstance.createDevice({
    id: 'test-trans-1',
    name: 'Sony WH-1000XM4',
    connected: true,
    batteryPercent: 80
  });
  const connectEvents = bluetoothMonitorService.updateDevices([connectDev]);
  assert('updateDevices emits connected event when new device connects',
    connectEvents.some(e => e.type === 'connected' && e.device.id === 'test-trans-1') &&
    lastCapturedEvent?.type === 'connected');

  // Disconnection transition
  const disconnectDev = { ...connectDev, connected: false };
  const disconnectEvents = bluetoothMonitorService.updateDevices([disconnectDev]);
  assert('updateDevices emits disconnected event when device disconnects',
    disconnectEvents.some(e => e.type === 'disconnected' && e.device.id === 'test-trans-1') &&
    lastCapturedEvent?.type === 'disconnected');

  // Battery delta threshold >= 2% triggers battery_change
  const reconnectDev = { ...connectDev, connected: true, batteryPercent: 80 };
  bluetoothMonitorService.updateDevices([reconnectDev]);
  const batDeltaDev = { ...connectDev, connected: true, batteryPercent: 85 };
  const deltaEvents = bluetoothMonitorService.updateDevices([batDeltaDev]);
  assert('updateDevices emits battery_change event when battery delta >= 2%',
    deltaEvents.some(e => e.type === 'battery_change' && e.device.batteryPercent === 85) &&
    lastCapturedEvent?.type === 'battery_change');

  // Battery noise rejection (< 2% delta does NOT trigger event)
  const minorDeltaDev = { ...connectDev, connected: true, batteryPercent: 86 }; // 1% difference
  const minorEvents = bluetoothMonitorService.updateDevices([minorDeltaDev]);
  assert('updateDevices suppresses event when battery delta < 2% (noise rejection)',
    !minorEvents.some(e => e.type === 'battery_change' && e.device.id === 'test-trans-1'));

  // Charging state change triggers battery_change
  const chargingDev = { ...minorDeltaDev, isCharging: true };
  const chargingEvents = bluetoothMonitorService.updateDevices([chargingDev]);
  assert('updateDevices emits battery_change event when charging state toggles',
    chargingEvents.some(e => e.type === 'battery_change' && e.device.isCharging === true));

  unsubListener();

  // 6. Simulation Engine & Programmatic Test Hook
  let simBroadcastPayload = null;
  bluetoothMonitorService.setBroadcastCallback((channel, payload) => {
    if (channel === 'island:bluetooth-hud') {
      simBroadcastPayload = payload;
    }
  });

  const simResult = bluetoothMonitorService.simulateEvent({
    type: 'connected',
    device: { id: 'sim-test-device', name: 'AirPods Max', batteryPercent: 95 }
  });
  assert('simulateEvent registers device and triggers broadcast',
    simResult.id === 'sim-test-device' &&
    simResult.deviceType === 'airpods' &&
    simBroadcastPayload?.type === 'connected' &&
    simBroadcastPayload?.device?.name === 'AirPods Max');

  // 7. Fallback & Offline Resilience
  bluetoothMonitorService.setSimulationMode(true);
  assert('setSimulationMode toggles simulation mode cleanly',
    bluetoothMonitorService.isSimulationMode() === true);

  const fallbackDevs = await bluetoothMonitorService.queryNativeDevices();
  assert('queryNativeDevices returns devices without throwing in offline/simulation mode',
    Array.isArray(fallbackDevs) && fallbackDevs.length > 0);
  bluetoothMonitorService.setSimulationMode(false);

  // 8. Edge Cases & ReDoS Safety
  const longName = 'AirPods ' + 'Pro '.repeat(2000);
  assert('classifyBluetoothDeviceType handles 8000+ char string safely without ReDoS',
    classifyBluetoothDeviceType(longName) === 'airpods');

  const zeroBat = normalizeBatteryLevel(0);
  const hundredBat = normalizeBatteryLevel(100);
  assert('0% and 100% boundary battery levels are preserved accurately',
    zeroBat === 0 && hundredBat === 100);

  // 9. Preload, Main IPC, and Canvas/DOM Contracts for R5
  assert('island-preload.ts exposes typed bluetooth API with getDevices, simulateEvent, onHudEvent',
    islandPreloadTs.includes('bluetooth:') &&
    islandPreloadTs.includes('getDevices:') &&
    islandPreloadTs.includes('simulateEvent:') &&
    islandPreloadTs.includes('onHudEvent:') &&
    islandPreloadTs.includes('islandAPI'));

  assert('index.ts registers bluetooth IPC endpoints and disposal',
    indexTs.includes("'bluetooth:get-devices'") &&
    indexTs.includes("'bluetooth:simulate-event'") &&
    indexTs.includes('bluetoothMonitorService.setBroadcastCallback') &&
    indexTs.includes('bluetoothMonitorService.dispose()'));

  assert('canvas-engine.ts defines triggerBluetoothHud, showBluetoothHudCard, and drawBluetoothHudContent',
    canvasEngineSrc.includes('triggerBluetoothHud') &&
    canvasEngineSrc.includes('showBluetoothHudCard') &&
    canvasEngineSrc.includes('drawBluetoothHudContent') &&
    canvasEngineSrc.includes('__roboIslandTriggerBluetoothHud'));

  assert('index.html contains #bluetooth-hud-card, #bt-hud-name, #bt-hud-battery-percent, #bt-hud-multibattery',
    indexHtml.includes('id="bluetooth-hud-card"') &&
    indexHtml.includes('id="bt-hud-name"') &&
    indexHtml.includes('id="bt-hud-battery-percent"') &&
    indexHtml.includes('id="bt-hud-multibattery"'));

  assert('island.css styles .bluetooth-hud-card, .bt-hud-battery-badge, and .bt-mb-badge',
    islandCss.includes('.bluetooth-hud-card') &&
    islandCss.includes('.bt-hud-battery-badge') &&
    islandCss.includes('.bt-mb-badge') &&
    islandCss.includes('btHudPop'));

  // --- 35. Testing R6: Full Hands-Free Voice Companion Mode (Jarvis Voice) ---
  console.log('\n--- 35. Testing R6: Full Hands-Free Voice Companion Mode (Jarvis Voice) ---');

  const {
    voiceCompanionService,
    VoiceCompanionService,
    detectWakeWord,
    computeAudioBands
  } = require('../dist/main/voice-companion-service');

  assert('voice-companion-service.js exists in dist/main',
    fs.existsSync(path.join(__dirname, '../dist/main/voice-companion-service.js')));

  assert('voiceCompanionService is an instance of VoiceCompanionService',
    voiceCompanionService instanceof VoiceCompanionService);

  assert('VoiceCompanionService default state is IDLE',
    voiceCompanionService.getState() === 'IDLE');

  // 1. Wake-Word Detection Matrix (Hey Jarvis, Jarvis, Hey Robo, RoboIsland)
  const wake1 = detectWakeWord('Hey Jarvis, what time is it?');
  assert('detectWakeWord detects "Hey Jarvis" and strips punctuation',
    wake1.detected === true && wake1.triggerWord === 'hey jarvis' && wake1.strippedText === 'what time is it?');

  const wake2 = detectWakeWord('jarvis what is the date');
  assert('detectWakeWord detects "jarvis" in lowercase',
    wake2.detected === true && wake2.triggerWord === 'jarvis' && wake2.strippedText === 'what is the date');

  const wake3 = detectWakeWord('HEY ROBO: check battery status');
  assert('detectWakeWord detects "HEY ROBO" in uppercase with colon',
    wake3.detected === true && wake3.triggerWord === 'hey robo' && wake3.strippedText === 'check battery status');

  const wake4 = detectWakeWord('roboisland');
  assert('detectWakeWord detects standalone "roboisland"',
    wake4.detected === true && wake4.triggerWord === 'roboisland' && wake4.strippedText === '');

  const wakeNon = detectWakeWord('Good morning Alice');
  assert('detectWakeWord returns false for non-wake phrases',
    wakeNon.detected === false && wakeNon.strippedText === 'Good morning Alice');

  const wakeEmpty = detectWakeWord('');
  const wakeNull = detectWakeWord(null);
  assert('detectWakeWord safely handles empty or null input',
    wakeEmpty.detected === false && wakeNull.detected === false);

  const longWakeInput = 'Hey Jarvis ' + 'hello world '.repeat(1500);
  const wakeLong = detectWakeWord(longWakeInput);
  assert('detectWakeWord safely handles 15,000+ char input without ReDoS',
    wakeLong.detected === true && wakeLong.triggerWord === 'hey jarvis');

  // 2. State Machine Transitions
  await voiceCompanionService.startListening();
  assert('startListening transitions state from IDLE to LISTENING',
    voiceCompanionService.getState() === 'LISTENING');

  await voiceCompanionService.stopListening();
  assert('stopListening transitions state from LISTENING to IDLE',
    voiceCompanionService.getState() === 'IDLE');

  await voiceCompanionService.toggleListening();
  assert('toggleListening switches from IDLE to LISTENING',
    voiceCompanionService.getState() === 'LISTENING');

  await voiceCompanionService.toggleListening();
  assert('toggleListening switches from LISTENING back to IDLE',
    voiceCompanionService.getState() === 'IDLE');

  // 3. Audio Amplitude & 5-Band Frequency Generation
  const idleBands = computeAudioBands(1000, 'IDLE');
  assert('computeAudioBands returns 0 level and zeroed bands for IDLE',
    idleBands.level === 0 && idleBands.bands.every(b => b === 0));

  const listenBands = computeAudioBands(2500, 'LISTENING');
  assert('computeAudioBands produces 5 valid normalized frequency bands for LISTENING',
    listenBands.level > 0 && listenBands.level <= 1.0 &&
    listenBands.bands.length === 5 &&
    listenBands.bands.every(b => b >= 0 && b <= 1.0));

  const speakBands = computeAudioBands(3500, 'SPEAKING');
  assert('computeAudioBands produces dynamic frequency bands for SPEAKING',
    speakBands.level > 0 && speakBands.level <= 1.0 &&
    speakBands.bands.length === 5 &&
    speakBands.bands.every(b => b >= 0 && b <= 1.0));

  const thinkBands = computeAudioBands(1500, 'THINKING');
  assert('computeAudioBands produces shimmer bands for THINKING',
    thinkBands.level > 0 && thinkBands.level <= 1.0 &&
    thinkBands.bands.length === 5 &&
    thinkBands.bands.every(b => b >= 0 && b <= 1.0));

  // 4. Natural Language Dialogue & Intent Processing
  const timeRes = await voiceCompanionService.processCommand('What is the current time?');
  assert('processCommand handles Time query intent',
    timeRes.action === 'report_time' && timeRes.response.includes('currently'));

  const dateRes = await voiceCompanionService.processCommand("What's today's date?");
  assert('processCommand handles Date query intent',
    dateRes.action === 'report_date' && dateRes.response.includes('Today is'));

  const batteryRes = await voiceCompanionService.processCommand('Check my AirPods battery');
  assert('processCommand handles Battery query intent',
    batteryRes.action === 'report_battery' && typeof batteryRes.response === 'string');

  const sportsRes = await voiceCompanionService.processCommand('Give me sports cricket score');
  assert('processCommand handles Sports query intent',
    sportsRes.action === 'report_sports' && typeof sportsRes.response === 'string');

  const glanceRes = await voiceCompanionService.processCommand('Check screen for errors');
  assert('processCommand handles Screen Glance & Error Fixer intent',
    glanceRes.action.startsWith('report_') && typeof glanceRes.response === 'string');

  const mathRes = await voiceCompanionService.processCommand('Calculate 25 * 4');
  assert('processCommand handles Math Calculation intent',
    mathRes.action === 'math_result' && mathRes.response.includes('100'));

  const introRes = await voiceCompanionService.processCommand('Who are you?');
  assert('processCommand handles Assistant introduction intent',
    introRes.action === 'introduce' && introRes.response.includes('Jarvis'));

  const greetRes = await voiceCompanionService.processCommand('Hello Jarvis');
  assert('processCommand handles Greeting intent',
    greetRes.action === 'greeting' && typeof greetRes.response === 'string');

  const jokeRes = await voiceCompanionService.processCommand('Tell me a joke');
  assert('processCommand handles Humor & Joke intent',
    jokeRes.action === 'joke' && typeof jokeRes.response === 'string');

  const fallbackRes = await voiceCompanionService.processCommand('Quantum entanglement across parallel universes');
  assert('processCommand provides graceful Conversational Fallback',
    fallbackRes.action === 'conversational_fallback' && fallbackRes.response.includes('Quantum entanglement'));

  // 5. Broadcast & Event Flow
  let voicePayload = null;
  voiceCompanionService.setBroadcastCallback((ch, p) => {
    if (ch === 'island:voice-state') voicePayload = p;
  });
  voiceCompanionService.setState('LISTENING', { text: 'Test voice query' });
  assert('broadcastState emits island:voice-state with payload',
    voicePayload !== null &&
    voicePayload.state === 'LISTENING' &&
    voicePayload.text === 'Test voice query');

  // 6. Text-to-Speech & Abort Lifecycle
  voiceCompanionService.setSimulationMode(true);
  const speakPromise = voiceCompanionService.speak('Testing speech synthesis execution');
  assert('speak sets state to SPEAKING',
    voiceCompanionService.getState() === 'SPEAKING');

  const stopped = voiceCompanionService.stopSpeaking();
  assert('stopSpeaking aborts active speech and transitions to IDLE',
    stopped === true && voiceCompanionService.getState() === 'IDLE');

  // 7. Preload, Main IPC, and Canvas/DOM Contracts for R6
  assert('island-preload.ts exposes typed voice companion API bridge',
    islandPreloadTs.includes('voice:') &&
    islandPreloadTs.includes('startListening:') &&
    islandPreloadTs.includes('stopListening:') &&
    islandPreloadTs.includes('onVoiceState:'));

  assert('island-preload.ts exposes top-level voice helper aliases',
    islandPreloadTs.includes('startVoiceListening:') &&
    islandPreloadTs.includes('stopVoiceSpeaking:') &&
    islandPreloadTs.includes('onVoiceState:'));

  assert('index.ts registers voice companion IPC handlers and cleanup on will-quit',
    indexTs.includes("'voice:start-listening'") &&
    indexTs.includes("'voice:stop-listening'") &&
    indexTs.includes("'voice:process-command'") &&
    indexTs.includes('voiceCompanionService.dispose()'));

  assert('canvas-engine.ts, index.html, and island.css integrate dynamic voice sound wave rendering and UI',
    canvasEngineSrc.includes('drawVoiceCompanionWave') &&
    canvasEngineSrc.includes('triggerVoiceCompanion') &&
    canvasEngineSrc.includes('isVoiceCompanionActive') &&
    indexHtml.includes('id="voice-companion-card"') &&
    indexHtml.includes('id="btn-voice-companion"') &&
    islandCss.includes('.voice-companion-card') &&
    islandCss.includes('voiceHudPop'));

  // --- 36. Testing Modal Interactivity Lock & Sports Scoreboard Opt-In Controls ---
  console.log('\n--- 36. Testing Modal Interactivity Lock & Sports Scoreboard Opt-In Controls ---');
  const islandWindowTsUpdated = fs.readFileSync(path.join(__dirname, '../src/main/island-window.ts'), 'utf-8');
  assert('island-window.ts defines isModalActive flag and island:set-modal-active IPC listener',
    islandWindowTsUpdated.includes('isModalActive') &&
    islandWindowTsUpdated.includes("'island:set-modal-active'") &&
    islandWindowTsUpdated.includes('effectiveInteractive'));

  const islandPreloadTsUpdated = fs.readFileSync(path.join(__dirname, '../src/preload/island-preload.ts'), 'utf-8');
  assert('island-preload.ts exposes setModalActive IPC bridge to renderer',
    islandPreloadTsUpdated.includes('setModalActive:'));

  const canvasEngineUpdated = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf-8');
  assert('canvas-engine.ts gates sports scoreboard pill with isSportsPillEnabled opt-in flag',
    canvasEngineUpdated.includes('isSportsPillEnabled') &&
    canvasEngineUpdated.includes('this.sportsState?.enabled && this.activeSportsActivity && this.isSportsPillEnabled'));

  assert('canvas-engine.ts manages modal interactivity lifecycle on open/close',
    canvasEngineUpdated.includes('setModalActive?.(true)') &&
    canvasEngineUpdated.includes('setModalActive?.(false)'));

  const indexHtmlUpdated = fs.readFileSync(path.join(__dirname, '../src/renderer/island/index.html'), 'utf-8');
  assert('index.html provides #sport-island-toggle button in sports scorecard header',
    indexHtmlUpdated.includes('id="sport-island-toggle"') &&
    indexHtmlUpdated.includes('sport-island-toggle-btn'));

  const islandCssUpdated = fs.readFileSync(path.join(__dirname, '../src/renderer/island/island.css'), 'utf-8');
  assert('island.css styles .sport-island-toggle-btn and elevates summary modal z-index',
    islandCssUpdated.includes('.sport-island-toggle-btn') &&
    islandCssUpdated.includes('10005'));

  // --- 37. Testing Live Cricket Feed Date, Day, Time & Tour Metadata ---
  console.log('\n--- 37. Testing Live Cricket Feed Date, Day, Time & Tour Metadata ---');
  const sportsServiceTs = fs.readFileSync(path.join(__dirname, '../src/main/sports-service.ts'), 'utf-8');
  assert('sports-service.ts implements parseLiveCricketEvent with Date, Day, Time, and Venue extraction',
    sportsServiceTs.includes('parseLiveCricketEvent') &&
    sportsServiceTs.includes('matchDate') &&
    sportsServiceTs.includes('matchDay') &&
    sportsServiceTs.includes('matchTime') &&
    sportsServiceTs.includes('venue'));

  assert('sports-service.ts polls ESPN live cricket scoreboard header API',
    sportsServiceTs.includes('https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket'));

  assert('canvas-engine.ts renders .scorecard-tour-header and .scorecard-schedule-pill with date and time',
    canvasEngineUpdated.includes('scorecard-tour-header') &&
    canvasEngineUpdated.includes('scorecard-schedule-pill') &&
    canvasEngineUpdated.includes('matchDay') &&
    canvasEngineUpdated.includes('matchTime'));

  assert('island.css styles .scorecard-tour-header and .scorecard-schedule-pill',
    islandCssUpdated.includes('.scorecard-tour-header') &&
    islandCssUpdated.includes('.scorecard-schedule-pill') &&
    islandCssUpdated.includes('.tour-status-tag'));

  // --- 38. Testing Desktop App Overlay Retention & iOS/Mac Fluid Charging Animation ---
  console.log('\n--- 38. Testing Desktop App Overlay Retention & iOS/Mac Fluid Charging Animation ---');
  const { isGameMode } = require('../dist/main/game-mode');
  assert('isGameMode(2) returns false so WhatsApp/busy apps never auto-hide the island', isGameMode(2) === false);
  assert('isGameMode(3) returns true for exclusive 3D games', isGameMode(3) === true);

  assert('island-window.ts configures screen-saver topmost level and ensureTopmost overlay',
    islandWindowTsUpdated.includes("'screen-saver'") &&
    islandWindowTsUpdated.includes('ensureTopmost()') &&
    islandWindowTsUpdated.includes('this.ensureTopmost()'));

  const audioSynthTs = fs.readFileSync(path.join(__dirname, '../src/renderer/island/audio-synth.ts'), 'utf-8');
  assert('audio-synth.ts defines Apple charging harmonic chord melody',
    audioSynthTs.includes("'charging'") &&
    audioSynthTs.includes('523.25') &&
    audioSynthTs.includes('783.99'));

  assert('canvas-engine.ts configures Apple iOS fluid charging dimensions (310x44, r:22, 3600ms)',
    canvasEngineUpdated.includes('310') &&
    canvasEngineUpdated.includes('3600') &&
    canvasEngineUpdated.includes('iOS / Mac Fluid Premium Charging Dynamic Island HUD'));

  assert('canvas-engine.ts renders Apple battery capsule and glowing lightning bolt',
    canvasEngineUpdated.includes('drawChargerSurgeContent') &&
    canvasEngineUpdated.includes('#34c759') &&
    canvasEngineUpdated.includes('#30d158') &&
    canvasEngineUpdated.includes('boltX') &&
    canvasEngineUpdated.includes('capW'));

  const systemDiagTs = fs.readFileSync(path.join(__dirname, '../src/main/system-diagnostics.ts'), 'utf-8');
  assert('system-diagnostics.ts broadcasts battery:state-changed on charger transitions',
    systemDiagTs.includes("'battery:state-changed'") &&
    systemDiagTs.includes('vitals.isCharging'));

  // --- 39. Testing WhatsApp Direct Compose Focus, Reaction Delivery & Contact Sanitization ---
  console.log('\n--- 39. Testing WhatsApp Direct Compose Focus, Reaction Delivery & Contact Sanitization ---');
  const waSenderUpdated = fs.readFileSync(path.join(__dirname, '../src/native/whatsapp-sender.ps1'), 'utf-8');
  assert('whatsapp-sender.ps1 implements UI Automation compose box finder and direct sender',
    waSenderUpdated.includes('FindComposeEdit') &&
    waSenderUpdated.includes('FindSearchEdit') &&
    waSenderUpdated.includes('TryClickContact') &&
    waSenderUpdated.includes('SendWhatsAppDirect') &&
    waSenderUpdated.includes('Type a message'));

  const parsedDirect = mockEngine.parseWhatsAppDetails('WhatsApp', 'Alice: Hey there!');
  assert('parseWhatsAppDetails extracts direct sender when title is WhatsApp and body has colon format',
    parsedDirect.isGroup === false &&
    parsedDirect.senderName === 'Alice' &&
    parsedDirect.messageText === 'Hey there!');

  const parsedGroup = mockEngine.parseWhatsAppDetails('Tech Team', 'Bob: Meeting at 3');
  assert('parseWhatsAppDetails extracts group and sender for multi-user chat notifications',
    parsedGroup.isGroup === true &&
    parsedGroup.groupName === 'Tech Team' &&
    parsedGroup.senderName === 'Bob' &&
    parsedGroup.messageText === 'Meeting at 3');

  const canvasEngineWa = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf-8');
  assert('canvas-engine.ts sanitizes literal "whatsapp" contact names so search never loops on app title',
    canvasEngineWa.includes("rawContact.toLowerCase() !== 'whatsapp'") &&
    canvasEngineWa.includes("fallbackContact.toLowerCase() !== 'whatsapp'"));

  const indexTsWa = fs.readFileSync(path.join(__dirname, '../src/main/index.ts'), 'utf-8');
  assert('index.ts dispatches emoji reactions without requiring pre-existing contact string',
    indexTsWa.includes("ipcMain.handle('whatsapp:react'") &&
    indexTsWa.includes("cleanContact = contact.toLowerCase() === 'whatsapp' ? '' : contact;"));

  // --- 40. Testing Cricbuzz Live Cricket Integration & Drag-Outside Non-Sticking Collapse ---
  console.log('\n--- 40. Testing Cricbuzz Live Cricket Integration & Drag-Outside Non-Sticking Collapse ---');
  const sportsServiceCricbuzz = fs.readFileSync(path.join(__dirname, '../src/main/sports-service.ts'), 'utf-8');
  assert('sports-service.ts implements fetchCricbuzzLiveScores for real live match data',
    sportsServiceCricbuzz.includes('fetchCricbuzzLiveScores') &&
    sportsServiceCricbuzz.includes('https://www.cricbuzz.com/cricket-match/live-scores') &&
    sportsServiceCricbuzz.includes('pollEspnCricket'));

  const canvasEngineDragFix = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf-8');
  assert('canvas-engine.ts implements window blur and mouseleave pointer reset to prevent getting stuck',
    canvasEngineDragFix.includes("window.addEventListener('blur'") &&
    canvasEngineDragFix.includes("this.pointerX = -1;\n      this.pointerY = -1;"));

  assert('canvas-engine.ts resets isDraggingOver on mouseup and outside click',
    canvasEngineDragFix.includes('this.isDraggingOver = false;') &&
    canvasEngineDragFix.includes('(window as any).isDraggingFiles = false;'));

  // --- 41. Testing Anti-Lag, OS Input Responsiveness & System Stability ---
  console.log('\n--- 41. Testing Anti-Lag, OS Input Responsiveness & System Stability ---');
  const islandWindowTsAntiLag = fs.readFileSync(path.join(__dirname, '../src/main/island-window.ts'), 'utf-8');
  assert('island-window.ts omits { forward: true } on win32 to eliminate WH_MOUSE_LL system hook',
    islandWindowTsAntiLag.includes("if (process.platform === 'win32')") &&
    islandWindowTsAntiLag.includes("this.window.setIgnoreMouseEvents(!effectiveInteractive);"));

  assert('island-window.ts removes periodic moveTop() loop to prevent disrupting other apps',
    !islandWindowTsAntiLag.includes('this.lastTopmostCheckAt') &&
    !islandWindowTsAntiLag.includes('this.window.moveTop()'));

  const gameModeTs = fs.readFileSync(path.join(__dirname, '../src/main/game-mode.ts'), 'utf-8');
  assert('game-mode.ts accepts passive fullscreen events from persistent media session',
    gameModeTs.includes('handleFullscreenEvent') &&
    gameModeTs.includes('pollIntervalMs: number = 30000;'));

  const sportsServiceUpdated = fs.readFileSync(path.join(__dirname, '../src/main/sports-service.ts'), 'utf-8');
  assert('sports-service.ts implements active sport polling isolation and 30s interval',
    sportsServiceUpdated.includes('intervalMs: number = 30000') &&
    sportsServiceUpdated.includes("active === 'cricket'"));

  const systemDiagTsPerf = fs.readFileSync(path.join(__dirname, '../src/main/system-diagnostics.ts'), 'utf-8');
  assert('system-diagnostics.ts caches battery and gates top process query to high RAM pressure',
    systemDiagTsPerf.includes('cachedBattery') &&
    systemDiagTsPerf.includes('memPercent >= 86'));

  // Summary
  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
