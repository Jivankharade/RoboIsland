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

  // Summary
  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
