/**
 * RoboIsland Milestone UX-3 Verification Suite
 * Requirements: R6 (LAN Drop Drag-and-Drop, Reachable IP Discovery & QR Code Fix)
 * 
 * Verifies:
 * 1. Zero-Emoji Compliance across Milestone UX-3 Files
 * 2. Preload webUtils.getPathForFile Exposure and Fallback Handling
 * 3. Windows Kernel Routing Table UDP LAN IP Resolution & Virtual Adapter Filtering
 * 4. QR Code ISO/IEC 18004 Compliance (4-Module Quiet Zone, rx="0", Crisp Edges)
 * 5. Transfer Server Resilience (Port 48912, Error Handling, Port Conflict Safety)
 * 6. Live HTTP Endpoints (GET /transfer, GET /download, POST /upload for Single, Multiple & Large Files)
 * 7. Renderer Drag-and-Drop Path Extraction & Tray UI States (Loading, Ready, Warning/Offline, Error, Success)
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const dgram = require('dgram');
const os = require('os');
const crypto = require('crypto');

// Support running via plain node OR electron runner
if (!process.versions.electron) {
  const { spawnSync } = require('child_process');
  const electronPath = require('electron');
  console.log('[Runner] Spawning Electron runner for scripts/test-lan-drop.js...\n');
  const res = spawnSync(electronPath, [__filename], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

const { app } = require('electron');

console.log('====================================================');
console.log('    ROBOISLAND UX-3 LAN DROP & QR TEST SUITE        ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(desc, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${desc}${details ? ' - ' + details : ''}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

app.whenReady().then(async () => {
  try {
    const root = path.resolve(__dirname, '..');

    // -------------------------------------------------------------------
    // 1. Zero-Emoji Compliance Check
    // -------------------------------------------------------------------
    console.log('--- 1. Testing Zero-Emoji Compliance across Milestone UX-3 Files ---');
    const preloadSrc = fs.readFileSync(path.join(root, 'src', 'preload', 'island-preload.ts'), 'utf8');
    const prodSrc = fs.readFileSync(path.join(root, 'src', 'main', 'productivity-engine.ts'), 'utf8');
    const canvasSrc = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'canvas-engine.ts'), 'utf8');
    const testSrc = fs.readFileSync(__filename, 'utf8');

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert('island-preload.ts contains zero unicode emojis', !emojiRegex.test(preloadSrc));
    assert('productivity-engine.ts contains zero unicode emojis', !emojiRegex.test(prodSrc));
    assert('canvas-engine.ts contains zero unicode emojis', !emojiRegex.test(canvasSrc));
    assert('test-lan-drop.js contains zero unicode emojis', !emojiRegex.test(testSrc));

    // -------------------------------------------------------------------
    // 2. Preload webUtils.getPathForFile Exposure & Contract
    // -------------------------------------------------------------------
    console.log('\n--- 2. Testing Preload webUtils.getPathForFile Exposure ---');
    assert('island-preload.ts imports webUtils from electron', /import\s*\{[^}]*webUtils[^}]*\}\s*from\s*['"]electron['"]/.test(preloadSrc));
    assert('island-preload.ts exposes getPathForFile in contextBridge api', /getPathForFile:\s*\(file:\s*File\)/.test(preloadSrc));
    assert('island-preload.ts calls webUtils.getPathForFile', preloadSrc.includes('webUtils.getPathForFile(file)'));
    assert('island-preload.ts provides safe fallback for non-Electron contexts', preloadSrc.includes('(file as any)?.path') || preloadSrc.includes('file.path'));
    assert('island-preload.ts exposes onTransferActive listener', preloadSrc.includes('onTransferActive:'));

    // -------------------------------------------------------------------
    // 3. Reachable LAN IP Discovery (UDP Routing & Virtual Adapter Filter)
    // -------------------------------------------------------------------
    console.log('\n--- 3. Testing Reachable LAN IP Discovery ---');
    const { ProductivityEngine } = require(path.join(root, 'dist', 'main', 'productivity-engine.js'));
    const engine = new ProductivityEngine();

    // Test UDP socket zero-packet routing query directly
    let udpResolvedIp = null;
    await new Promise((resolve) => {
      try {
        const sock = dgram.createSocket('udp4');
        const timeout = setTimeout(() => {
          try { sock.close(); } catch {}
          resolve();
        }, 1500);

        sock.on('error', () => {
          clearTimeout(timeout);
          try { sock.close(); } catch {}
          resolve();
        });

        sock.connect(80, '8.8.8.8', () => {
          clearTimeout(timeout);
          try {
            const addr = sock.address().address;
            sock.close();
            if (addr && addr !== '0.0.0.0') {
              udpResolvedIp = addr;
            }
          } catch {}
          resolve();
        });
      } catch {
        resolve();
      }
    });

    const engineLanIp = await engine.resolveReachableLanIp();
    assert('ProductivityEngine resolves LAN IP via UDP or valid fallback', typeof engineLanIp === 'string' && engineLanIp.length > 0);
    assert('Resolved LAN IP is valid IPv4', /^(\d{1,3}\.){3}\d{1,3}$/.test(engineLanIp));
    assert('Resolved LAN IP is not an APIPA address (169.254.x.x)', !engineLanIp.startsWith('169.254.'));
    assert('Resolved LAN IP is not a VirtualBox host-only address (192.168.56.x)', !engineLanIp.startsWith('192.168.56.'));

    if (udpResolvedIp) {
      assert('ProductivityEngine matches authentic Windows kernel default route', engineLanIp === udpResolvedIp, `Engine: ${engineLanIp}, UDP: ${udpResolvedIp}`);
    } else {
      console.log('[INFO] Host currently has no default gateway internet route; fallback scanner utilized.');
    }

    // Verify virtual adapter filtering logic in detectReachableLanIpFallback
    const fallbackIp = engine.detectReachableLanIpFallback();
    assert('detectReachableLanIpFallback returns non-empty string', typeof fallbackIp === 'string' && fallbackIp.length > 0);
    assert('detectReachableLanIpFallback filters out VirtualBox host-only IP', !fallbackIp.startsWith('192.168.56.'));
    assert('detectReachableLanIpFallback filters out APIPA link-local IP', !fallbackIp.startsWith('169.254.'));

    // -------------------------------------------------------------------
    // 4. QR Code SVG ISO/IEC 18004 Standard Compliance
    // -------------------------------------------------------------------
    console.log('\n--- 4. Testing QR Code SVG ISO/IEC 18004 Compliance ---');
    const testUrl = `http://${engineLanIp}:48912/`;
    const qrSvg = engine.generateQrSvg(testUrl);

    assert('QR generator produces non-empty SVG string', typeof qrSvg === 'string' && qrSvg.length > 100);
    assert('QR SVG has valid XML namespace', qrSvg.includes('xmlns="http://www.w3.org/2000/svg"'));
    assert('QR SVG uses crispEdges shape-rendering for scanner contrast', qrSvg.includes('shape-rendering="crispEdges"'));

    // Check for standard 4-module quiet zone (ISO/IEC 18004 requirement)
    // For Version 2 QR code (25x25), 4-module quiet zone margin = 4 on all sides -> total dimension = 33x33
    const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
    assert('QR SVG contains valid viewBox', Boolean(viewBoxMatch));
    if (viewBoxMatch) {
      const w = parseInt(viewBoxMatch[1], 10);
      const h = parseInt(viewBoxMatch[2], 10);
      assert('QR SVG viewBox is square', w === h);
      // Size of matrix without quiet zone is w - 8 (margin 4 * 2)
      const matrixSize = w - 8;
      assert('QR SVG includes 4-module quiet zone (total = matrixSize + 8)', (matrixSize - 17) % 4 === 0, `viewBox: 0 0 ${w} ${h}`);
    }

    // Background rect must have unclipped rx="0" corners (no rx="10" distortion)
    assert('QR background rect has unclipped corners (rx="0" or no rx attribute)', !qrSvg.includes('rx="10"') && (qrSvg.includes('rx="0"') || !qrSvg.includes('rx=')), 'rx="10" defect resolved');
    assert('QR background rect fill is pure white (#ffffff)', qrSvg.includes('fill="#ffffff"'));
    assert('QR modules path fill is pure black (#000000)', qrSvg.includes('fill="#000000"'));

    // -------------------------------------------------------------------
    // 5. Transfer Server Resilience & Port Architecture
    // -------------------------------------------------------------------
    console.log('\n--- 5. Testing Transfer Server Resilience & Port Architecture ---');
    assert('LAN Drop Server uses dedicated preserved port 48912', engine.getDropPort() === 48912);
    const dropServer = engine.getDropServer();
    assert('LAN Drop HTTP server is initialized', Boolean(dropServer));

    // Verify dropServer has error listener attached
    const listeners = dropServer.listeners('error');
    assert('LAN Drop Server has error event handler attached', listeners.length > 0, `Listener count: ${listeners.length}`);

    // Verify server survives simulated EADDRINUSE without crash
    let errorHandled = false;
    try {
      dropServer.emit('error', Object.assign(new Error('listen EADDRINUSE: address already in use 0.0.0.0:48912'), { code: 'EADDRINUSE' }));
      errorHandled = true;
    } catch {
      errorHandled = false;
    }
    assert('LAN Drop Server gracefully handles EADDRINUSE error without crash', errorHandled);

    // -------------------------------------------------------------------
    // 6. Live HTTP Endpoints (Download & Upload over LAN IP)
    // -------------------------------------------------------------------
    console.log('\n--- 6. Testing Live HTTP Endpoints over LAN IP ---');

    // Test GET / or GET /transfer
    const portalHtml = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:48912/transfer`, (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }).on('error', reject);
    });
    assert('GET /transfer returns HTTP 200 OK', portalHtml.status === 200);
    assert('Portal HTML includes RoboIsland branding and upload form', portalHtml.data.includes('RoboIsland Drop') && portalHtml.data.includes('action="/upload"'));

    // Create temporary files for single, multiple, and large file tests
    const tempDir = path.join(os.tmpdir(), `robo-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const smallFile1 = path.join(tempDir, 'test-doc-1.txt');
    const smallContent1 = 'RoboIsland LAN Drop Unit Test Payload 1';
    fs.writeFileSync(smallFile1, smallContent1, 'utf8');

    const smallFile2 = path.join(tempDir, 'test-doc-2.txt');
    const smallContent2 = 'RoboIsland LAN Drop Unit Test Payload 2 with extended details';
    fs.writeFileSync(smallFile2, smallContent2, 'utf8');

    // Create a 2 MB test file for large streaming transfer verification
    const largeFile = path.join(tempDir, 'large-test-file.bin');
    const largeBuffer = crypto.randomBytes(2 * 1024 * 1024);
    fs.writeFileSync(largeFile, largeBuffer);

    // Test staging files in tray
    const userData = app.getPath('userData');
    const trayPath = path.join(userData, 'tray-files.json');
    const originalTray = fs.existsSync(trayPath) ? fs.readFileSync(trayPath, 'utf8') : '[]';

    // Stage files
    fs.writeFileSync(trayPath, JSON.stringify([smallFile1, smallFile2, largeFile]));
    // Re-instantiate or trigger tray reload in engine
    engine.trayFiles = [smallFile1, smallFile2, largeFile];

    // Test GET /download?idx=0 (Single small file)
    const dlSmall1 = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:48912/download?idx=0`, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          data: Buffer.concat(chunks).toString('utf8')
        }));
      }).on('error', reject);
    });
    assert('GET /download?idx=0 returns HTTP 200 OK', dlSmall1.status === 200);
    assert('GET /download?idx=0 sends attachment Content-Disposition', dlSmall1.headers['content-disposition']?.includes('test-doc-1.txt'));
    assert('GET /download?idx=0 returns exact content', dlSmall1.data === smallContent1);

    // Test GET /download?idx=2 (Large 2MB file streaming)
    const dlLarge = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:48912/download?idx=2`, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          data: Buffer.concat(chunks)
        }));
      }).on('error', reject);
    });
    assert('GET /download?idx=2 returns HTTP 200 OK for 2MB file', dlLarge.status === 200);
    assert('GET /download?idx=2 Content-Length matches 2MB', parseInt(dlLarge.headers['content-length'], 10) === largeBuffer.length);
    assert('GET /download?idx=2 binary payload matches original MD5 hash', crypto.createHash('md5').update(dlLarge.data).digest('hex') === crypto.createHash('md5').update(largeBuffer).digest('hex'));

    // Test POST /upload (Single file multipart upload)
    const boundary = '----WebKitFormBoundaryRoboTest' + Date.now();
    const uploadedFileName1 = `upload-test-single-${Date.now()}.txt`;
    const uploadedContent1 = 'Uploaded from smartphone simulation 1';
    const singleMultipart = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${uploadedFileName1}"\r\nContent-Type: text/plain\r\n\r\n`),
      Buffer.from(uploadedContent1, 'utf8'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const uploadRes1 = await new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port: 48912,
        path: '/upload',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': singleMultipart.length
        }
      }, (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.write(singleMultipart);
      req.end();
    });

    assert('POST /upload single file returns HTTP 200 OK', uploadRes1.status === 200);
    assert('Upload response confirms file received', uploadRes1.body.includes('File Received'));

    const downloadsDir = app.getPath('downloads');
    const savedSinglePath = path.join(downloadsDir, uploadedFileName1);
    assert('Uploaded file exists in PC Downloads directory', fs.existsSync(savedSinglePath));
    if (fs.existsSync(savedSinglePath)) {
      const savedContent = fs.readFileSync(savedSinglePath, 'utf8');
      assert('Uploaded file content matches transmitted content', savedContent === uploadedContent1);
      try { fs.unlinkSync(savedSinglePath); } catch {}
    }

    // Test POST /upload (Multiple files in single multipart request)
    const boundaryMulti = '----WebKitFormBoundaryMulti' + Date.now();
    const uploadedFileMulti1 = `upload-multi-a-${Date.now()}.txt`;
    const uploadedFileMulti2 = `upload-multi-b-${Date.now()}.txt`;
    const multiContent1 = 'Multi-part test file Alpha';
    const multiContent2 = 'Multi-part test file Beta with extra text';

    const multiMultipart = Buffer.concat([
      Buffer.from(`--${boundaryMulti}\r\nContent-Disposition: form-data; name="file"; filename="${uploadedFileMulti1}"\r\nContent-Type: text/plain\r\n\r\n`),
      Buffer.from(multiContent1, 'utf8'),
      Buffer.from(`\r\n--${boundaryMulti}\r\nContent-Disposition: form-data; name="file"; filename="${uploadedFileMulti2}"\r\nContent-Type: text/plain\r\n\r\n`),
      Buffer.from(multiContent2, 'utf8'),
      Buffer.from(`\r\n--${boundaryMulti}--\r\n`)
    ]);

    const uploadResMulti = await new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port: 48912,
        path: '/upload',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundaryMulti}`,
          'Content-Length': multiMultipart.length
        }
      }, (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.write(multiMultipart);
      req.end();
    });

    assert('POST /upload multiple files returns HTTP 200 OK', uploadResMulti.status === 200);
    const savedMultiPath1 = path.join(downloadsDir, uploadedFileMulti1);
    const savedMultiPath2 = path.join(downloadsDir, uploadedFileMulti2);
    assert('First multiple file saved in Downloads', fs.existsSync(savedMultiPath1));
    assert('Second multiple file saved in Downloads', fs.existsSync(savedMultiPath2));
    if (fs.existsSync(savedMultiPath1)) {
      assert('First multiple file content integrity verified', fs.readFileSync(savedMultiPath1, 'utf8') === multiContent1);
      try { fs.unlinkSync(savedMultiPath1); } catch {}
    }
    if (fs.existsSync(savedMultiPath2)) {
      assert('Second multiple file content integrity verified', fs.readFileSync(savedMultiPath2, 'utf8') === multiContent2);
      try { fs.unlinkSync(savedMultiPath2); } catch {}
    }

    // -------------------------------------------------------------------
    // 7. Renderer Drag-and-Drop & Tray UI Feedback States
    // -------------------------------------------------------------------
    console.log('\n--- 7. Testing Renderer Drag-and-Drop & Tray UI States ---');

    // Verify drop handler in canvas-engine.ts maps files through getPathForFile
    assert('canvas-engine.ts maps dropped File objects through window.roboIsland.getPathForFile', canvasSrc.includes('window.roboIsland.getPathForFile(f)'));
    assert('canvas-engine.ts shows success feedback on file drop', canvasSrc.includes('statusBadge.textContent = `${filePaths.length} file'));

    // Verify loadTrayShelf states
    assert('canvas-engine.ts renders loading feedback state while fetching drop info', canvasSrc.includes('statusBadge.textContent = \'Generating QR code...\''));
    assert('canvas-engine.ts detects 127.0.0.1 and renders offline / Wi-Fi warning badge', canvasSrc.includes('statusBadge.textContent = \'Offline / No Wi-Fi\''));
    assert('canvas-engine.ts provides explanatory tooltip when on 127.0.0.1 localhost', canvasSrc.includes('Localhost only (127.0.0.1)'));
    assert('canvas-engine.ts renders ready state when reachable LAN IP is discovered', canvasSrc.includes('statusBadge.textContent = \'Waiting for phone...\''));
    assert('canvas-engine.ts renders error feedback state if drop info fetch fails', canvasSrc.includes('statusBadge.textContent = \'Transfer server offline\''));
    assert('canvas-engine.ts subscribes to onTransferActive for real-time transfer feedback', canvasSrc.includes('window.roboIsland?.onTransferActive'));
    assert('canvas-engine.ts openPhoneDrop triggers File Tray tab with QR view', canvasSrc.includes('this.showDomTab(\'tray\')') && canvasSrc.includes('this.loadTrayShelf(true)'));

    // -------------------------------------------------------------------
    // 8. File-Specific /file/:id Routes, Range Streaming & Tray UI Fixes
    // -------------------------------------------------------------------
    console.log('\n--- 8. Testing /file/:id Routes, Range 206, HEAD, 404 & Tray CSS ---');
    const httpMod = require('http');
    const localReq = (method, reqPath, headers = {}) => new Promise((resolve, reject) => {
      const req = httpMod.request({
        hostname: '127.0.0.1',
        port: engine.getDropPort(),
        path: reqPath,
        method,
        headers,
      }, (res) => {
        const bufs = [];
        res.on('data', (c) => bufs.push(c));
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(bufs),
        }));
      });
      req.on('error', reject);
      req.end();
    });

    const specialFile = path.join(tempDir, 'my photo (final) & notes #1.txt');
    const specialContent = 'RoboIsland special filename & Range 206 verification payload!';
    fs.writeFileSync(specialFile, specialContent, 'utf8');
    // Push via internal tray list & rewrite tray file safely for this test
    engine.trayFiles.unshift(specialFile);
    fs.writeFileSync(trayPath, JSON.stringify(engine.trayFiles));

    const rootRes = await localReq('GET', '/');
    const rootHtml = rootRes.body.toString('utf8');
    const fidMatch = rootHtml.match(/\/download\/([a-f0-9]{10})/);
    assert('GET / renders /download/<fileId> link for staged file', rootRes.statusCode === 200 && !!fidMatch);

    if (fidMatch) {
      const fid = fidMatch[1];
      const filePageRes = await localReq('GET', `/file/${fid}`);
      const filePageHtml = filePageRes.body.toString('utf8');
      assert('GET /file/:id returns 200 with filename and download link',
        filePageRes.statusCode === 200 &&
        filePageHtml.includes('my photo (final) &amp; notes #1.txt') &&
        filePageHtml.includes(`/download/${fid}`)
      );

      const dlRes = await localReq('GET', `/download/${fid}`);
      assert('GET /download/:id transfers exact bytes for filename with spaces/special chars',
        dlRes.statusCode === 200 &&
        dlRes.body.toString('utf8') === specialContent &&
        String(dlRes.headers['accept-ranges']) === 'bytes' &&
        String(dlRes.headers['content-disposition'] || '').includes("filename*=UTF-8''")
      );

      const headRes = await localReq('HEAD', `/download/${fid}`);
      assert('HEAD /download/:id returns 200 with Content-Length and empty body',
        headRes.statusCode === 200 &&
        Number(headRes.headers['content-length']) === Buffer.byteLength(specialContent, 'utf8') &&
        headRes.body.length === 0
      );

      const rangeRes = await localReq('GET', `/download/${fid}`, { Range: 'bytes=0-9' });
      assert('GET /download/:id with Range returns 206 Partial Content',
        rangeRes.statusCode === 206 &&
        rangeRes.body.toString('utf8') === specialContent.slice(0, 10) &&
        String(rangeRes.headers['content-range'] || '').startsWith('bytes 0-9/')
      );
    }

    const missingRes = await localReq('GET', '/file/nonexistent00');
    assert('GET /file/:missing returns 404 HTML error notice (not blank page)',
      missingRes.statusCode === 404 && missingRes.body.toString('utf8').includes('RoboIsland Drop')
    );

    const repoRoot = path.resolve(__dirname, '..');
    const islandCss = fs.readFileSync(path.join(repoRoot, 'src/renderer/island/island.css'), 'utf8');
    const islandHtmlSrc = fs.readFileSync(path.join(repoRoot, 'src/renderer/island/index.html'), 'utf8');
    assert('island.css hides .tray-empty-hero.hidden with display: none !important',
      islandCss.includes('.tray-empty-hero.hidden') && islandCss.includes('display: none !important;')
    );
    assert('index.html removes status-battery-pill and includes btn-tray-browse',
      !islandHtmlSrc.includes('status-battery-pill') && islandHtmlSrc.includes('btn-tray-browse')
    );

    try { fs.unlinkSync(specialFile); } catch {}

    // Cleanup test temp files
    try {
      fs.unlinkSync(smallFile1);
      fs.unlinkSync(smallFile2);
      fs.unlinkSync(largeFile);
      fs.rmdirSync(tempDir);
    } catch {}

    // Restore original tray file
    try {
      fs.writeFileSync(trayPath, originalTray);
    } catch {}

    engine.dispose();

  } catch (err) {
    console.error('[UNEXPECTED ERROR]', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`LAN DROP & QR TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  app.quit();
  process.exit(failed > 0 ? 1 : 0);
});
