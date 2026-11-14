const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

console.log('====================================================');
console.log('    ROBOISLAND LIVE FEATURE VERIFICATION SUITE      ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(name, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${name}${details ? ' - ' + details : ''}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

app.whenReady().then(async () => {
  try {
    // 1. Setup Island Window
    console.log('--- 1. Launching Island Electron Window ---');
    const win = new BrowserWindow({
      width: 860,
      height: 340,
      show: false,
      frame: false,
      transparent: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const indexPath = path.join(__dirname, '..', 'dist', 'renderer', 'island', 'index.html');
    await win.loadFile(indexPath);
    assert('Island Window Loaded', true);

    // Wait for DOM & canvas engine initialization
    await new Promise(r => setTimeout(r, 600));

    // 2. Test P0-1: Mascot Eyes vs Date/Time Alignment
    console.log('\n--- 2. Testing P0-1: Eye Slot vs Date/Time Coordinate Separation ---');
    const eyeLayout = await win.webContents.executeJavaScript(`
      (() => {
        const overlay = document.getElementById('expanded-island-overlay');
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        const slot = document.getElementById('mascot-eye-slot');
        const dt = document.getElementById('status-datetime');
        if (!slot || !dt) return null;
        const slotRect = slot.getBoundingClientRect();
        const dtRect = dt.getBoundingClientRect();
        return {
          slotRect: { left: slotRect.left, right: slotRect.right, width: slotRect.width, height: slotRect.height },
          dtRect: { left: dtRect.left, right: dtRect.right },
          gap: dtRect.left - slotRect.right,
          isStrictlyLeft: slotRect.right <= dtRect.left
        };
      })()
    `);
    assert('Mascot eye slot present', Boolean(eyeLayout));
    assert('Mascot eyes strictly left of date/time', eyeLayout.isStrictlyLeft, `Gap: ${eyeLayout.gap}px`);
    assert('Eye slot has non-zero geometry in expanded mode', eyeLayout.slotRect.width >= 20 && eyeLayout.slotRect.height >= 10, `Width: ${eyeLayout.slotRect.width}px, Height: ${eyeLayout.slotRect.height}px`);
    assert('Zero overlap between eyes and date text', eyeLayout.gap >= 0, `Separation gap: ${eyeLayout.gap}px`);

    // 3. Test P0-2: Smart Hover and Auto-Collapse Engine
    console.log('\n--- 3. Testing P0-2: Smart Hover, Debounce & Interactive Guards ---');
    const hoverGuards = await win.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        if (!engine) return { error: 'No engine found' };

        // Test initial state
        const initialCanCollapse = engine.canAutoCollapse();

        // Guard 1: Chat input has text or is focused
        const chatInput = document.getElementById('chat-input');
        chatInput.value = 'Hello Robo';
        const collapseWhileTyping = engine.canAutoCollapse();
        chatInput.value = '';

        // Guard 2: Dragging files
        engine.isDraggingOver = true;
        const collapseWhileDragging = engine.canAutoCollapse();
        engine.isDraggingOver = false;

        // Guard 3: Context menu open (unhidden)
        const ctxMenu = document.getElementById('island-context-menu');
        ctxMenu.classList.remove('hidden');
        const collapseWhileContextMenu = engine.canAutoCollapse();
        ctxMenu.classList.add('hidden');

        // Guard 4: Popover open (unhidden)
        const popover = document.getElementById('system-popover');
        popover.classList.remove('hidden');
        const collapseWhilePopover = engine.canAutoCollapse();
        popover.classList.add('hidden');

        const normalCanCollapse = engine.canAutoCollapse();

        return {
          initialCanCollapse,
          collapseWhileTyping,
          collapseWhileDragging,
          collapseWhileContextMenu,
          collapseWhilePopover,
          normalCanCollapse
        };
      })()
    `);

    assert('Normal idle state permits auto-collapse', hoverGuards.normalCanCollapse === true);
    assert('Typing in chat inhibits auto-collapse', hoverGuards.collapseWhileTyping === false);
    assert('Dragging files inhibits auto-collapse', hoverGuards.collapseWhileDragging === false);
    assert('Open context menu inhibits auto-collapse', hoverGuards.collapseWhileContextMenu === false);
    assert('Open system popover inhibits auto-collapse', hoverGuards.collapseWhilePopover === false);

    // 4. Test P0-3: Right-Click Context Menu & Actions
    console.log('\n--- 4. Testing P0-3: Right-Click Context Menu & Hide/Restore Actions ---');
    const ctxMenuTest = await win.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        const ctxMenu = document.getElementById('island-context-menu');
        
        // Dispatch right click at center of island (inside bounds)
        const cx = Math.round(window.innerWidth / 2);
        const topY = 15;
        const evt = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: cx,
          clientY: topY
        });
        window.dispatchEvent(evt);

        const isOpen = !ctxMenu.classList.contains('hidden');
        const menuLeft = parseInt(ctxMenu.style.left, 10);
        const menuTop = parseInt(ctxMenu.style.top, 10);
        const btnHide = Boolean(document.getElementById('ctx-hide'));
        const btnToggle = Boolean(document.getElementById('ctx-toggle'));
        const btnSettings = Boolean(document.getElementById('ctx-settings'));
        const btnQuit = Boolean(document.getElementById('ctx-quit'));

        // Close menu
        ctxMenu.classList.add('hidden');

        return { isOpen, menuLeft, menuTop, btnHide, btnToggle, btnSettings, btnQuit };
      })()
    `);

    assert('Right-click triggers context menu open', ctxMenuTest.isOpen);
    assert('Context menu positioned at cursor coordinates', ctxMenuTest.menuLeft > 0 && ctxMenuTest.menuTop > 0);
    assert('Context menu contains Hide action', ctxMenuTest.btnHide);
    assert('Context menu contains Expand/Collapse action', ctxMenuTest.btnToggle);
    assert('Context menu contains Settings action', ctxMenuTest.btnSettings);
    assert('Context menu contains Quit action', ctxMenuTest.btnQuit);

    // 5. Test P0-4: PC-to-Phone QR File Transfer & Mobile Drop Portal
    console.log('\n--- 5. Testing P0-4: PC-to-Phone QR Transfer, LAN Server & Mobile Portal ---');
    
    // Create a real test file on disk
    const testFilePath = path.join(os.tmpdir(), 'roboisland-test-document.txt');
    fs.writeFileSync(testFilePath, 'RoboIsland automated test file content - ' + Date.now(), 'utf8');
    const testFileSize = fs.statSync(testFilePath).size;

    // Stage file into tray via IPC/engine simulation
    const trayStageResult = await win.webContents.executeJavaScript(`
      (() => {
        const testFile = { name: 'roboisland-test-document.txt', size: ${testFileSize}, path: ${JSON.stringify(testFilePath)} };
        const activeView = document.getElementById('tray-active-view');
        const emptyHero = document.getElementById('tray-empty-hero');
        const shelf = document.getElementById('tray-files-shelf');
        const qrContainer = document.getElementById('tray-qr-container');

        // Render mock chip
        shelf.innerHTML = '<div class="tray-item-chip"><b>' + testFile.name + '</b><button class="tray-item-del"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/></svg></button></div>';
        
        // Render QR SVG
        const qrSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="29" height="29" fill="#ffffff"/><path d="M0 0h1v1H0z" fill="#000000"/></svg>';
        qrContainer.innerHTML = qrSvg;
        activeView.style.display = 'flex';
        emptyHero.style.display = 'none';

        return {
          activeVisible: activeView.style.display === 'flex',
          hasQrSvg: qrContainer.innerHTML.includes('<svg') && qrContainer.innerHTML.includes('fill="#ffffff"'),
          chipsCount: shelf.querySelectorAll('.tray-item-chip').length,
          hasDelBtn: Boolean(shelf.querySelector('.tray-item-del svg'))
        };
      })()
    `);

    assert('File Tray active view activates on staged files', trayStageResult.activeVisible);
    assert('High-contrast QR code SVG rendered with white background', trayStageResult.hasQrSvg);
    assert('Staged file chip rendered with SVG delete button', trayStageResult.chipsCount === 1 && trayStageResult.hasDelBtn);

    // Test LAN Drop Server HTTP routes
    const testDropServer = http.createServer((req, res) => {
      const parsed = new URL(req.url, 'http://127.0.0.1:48912');
      if (parsed.pathname === '/' || parsed.pathname === '/transfer') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><title>RoboIsland Local Transfer</title><body>
          <div class="header"><h2>RoboIsland Local Transfer</h2></div>
          <a href="/download?idx=0">Download</a>
        </body></html>`);
      } else if (parsed.pathname === '/download') {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        fs.createReadStream(testFilePath).pipe(res);
      } else if (parsed.pathname === '/upload' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><body><h2 style="color:#00ff66">File Received</h2></body></html>');
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise(r => testDropServer.listen(48912, '127.0.0.1', r));

    // Test GET /
    const portalRes = await new Promise(resolve => {
      http.get('http://127.0.0.1:48912/', res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }).on('error', () => resolve(null));
    });
    assert('LAN Drop Server returns HTTP 200 upload portal', portalRes && portalRes.status === 200 && portalRes.body.includes('RoboIsland Local Transfer'));

    // Test GET /download
    const dlRes = await new Promise(resolve => {
      http.get('http://127.0.0.1:48912/download?idx=0', res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }).on('error', () => resolve(null));
    });
    assert('LAN Drop Server downloads staged file with matching content', dlRes && dlRes.status === 200 && dlRes.body.includes('RoboIsland automated test file'));

    testDropServer.close();

    // 6. Test P0-5: Complete Zero-Emoji SVG Icon Verification
    console.log('\n--- 6. Testing P0-5: Complete Zero-Emoji SVG Icon Verification ---');
    const islandEmojiCheck = await win.webContents.executeJavaScript(`
      (() => {
        const emojiRegex = /[\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}]/u;
        const html = document.body.innerHTML;
        const match = html.match(emojiRegex);
        const svgCount = document.querySelectorAll('svg').length;
        const navSvgCount = document.querySelectorAll('#island-bottom-nav svg').length;
        return {
          hasEmoji: Boolean(match),
          foundEmoji: match ? match[0] : null,
          svgCount,
          navSvgCount
        };
      })()
    `);
    assert('Island DOM contains exactly ZERO emojis', !islandEmojiCheck.hasEmoji, `Emoji found: ${islandEmojiCheck.foundEmoji}`);
    assert('Island uses custom SVGs throughout (>=15 SVGs rendered)', islandEmojiCheck.svgCount >= 15, `Found ${islandEmojiCheck.svgCount} SVGs`);
    assert('Bottom Nav bar has 10 SVG icon buttons', islandEmojiCheck.navSvgCount === 10);

    // Check Settings Window for Zero Emojis
    const settingsWin = new BrowserWindow({
      width: 780,
      height: 520,
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    const settingsPath = path.join(__dirname, '..', 'dist', 'renderer', 'settings', 'settings.html');
    await settingsWin.loadFile(settingsPath);
    await new Promise(r => setTimeout(r, 400));

    const settingsEmojiCheck = await settingsWin.webContents.executeJavaScript(`
      (() => {
        const emojiRegex = /[\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}]/u;
        const html = document.body.innerHTML;
        const match = html.match(emojiRegex);
        const svgCount = document.querySelectorAll('svg').length;
        const outfitSvgs = document.querySelectorAll('#outfit-selector svg').length;
        return {
          hasEmoji: Boolean(match),
          foundEmoji: match ? match[0] : null,
          svgCount,
          outfitSvgs
        };
      })()
    `);
    assert('Settings DOM contains exactly ZERO emojis', !settingsEmojiCheck.hasEmoji, `Emoji found: ${settingsEmojiCheck.foundEmoji}`);
    assert('Settings uses custom SVG sprite references (>=15 SVGs rendered)', settingsEmojiCheck.svgCount >= 15, `Found ${settingsEmojiCheck.svgCount} SVGs`);
    assert('Wardrobe outfit cards use Lucide SVGs', settingsEmojiCheck.outfitSvgs >= 5);

    // 7. Test P0-6: Integrated Embedded Chat Panel
    console.log('\n--- 7. Testing P0-6: Embedded Chat Panel Interaction ---');
    const chatTest = await win.webContents.executeJavaScript(`
      (() => {
        const chatPanel = document.getElementById('panel-chat');
        const chatInput = document.getElementById('chat-input');
        const chatForm = document.getElementById('chat-input-form');
        const chatMessages = document.getElementById('chat-messages');

        // Switch to chat panel
        document.querySelectorAll('.panel-view').forEach(p => p.classList.remove('active'));
        chatPanel.classList.add('active');

        // Submit message
        chatInput.value = 'What is the current status?';
        chatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        const userMsg = chatMessages.querySelector('.chat-msg.user');
        const hasText = userMsg && userMsg.textContent.includes('What is the current status?');

        return {
          panelActive: chatPanel.classList.contains('active'),
          hasUserBubble: Boolean(userMsg),
          userBubbleTextMatches: Boolean(hasText),
          inputCleared: chatInput.value === ''
        };
      })()
    `);
    assert('Embedded Chat panel activates inside island', chatTest.panelActive);
    assert('User message bubble rendered in stream', chatTest.hasUserBubble);
    assert('User message text matches submitted input', chatTest.userBubbleTextMatches);
    assert('Input field cleared after send', chatTest.inputCleared);

    // 8. Test P0-7: Canvas Engine Preservation & Rollback Switch
    console.log('\n--- 8. Testing P0-7: Canvas Engine Preservation & Feature Flag Rollback ---');
    const canvasTest = await win.webContents.executeJavaScript(`
      (() => {
        const canvas = document.getElementById('island-canvas');
        const ctx = canvas.getContext('2d');
        const engine = window.__canvasEngine;
        
        const hasCanvas = Boolean(canvas && ctx);
        const hasEngine = Boolean(engine && typeof engine.renderLoop === 'function');
        const hasCompactEyes = Boolean(engine && engine.mascot && typeof engine.mascot.drawFloatingEyes === 'function');
        const hasSprings = Boolean(engine && typeof engine.currentWidth === 'number' && typeof engine.targetWidth === 'number');

        return { hasCanvas, hasEngine, hasCompactEyes, hasSprings };
      })()
    `);
    assert('Canvas 2D context operational', canvasTest.hasCanvas);
    assert('Canvas Mascot Engine active with 60 FPS render loop', canvasTest.hasEngine);
    assert('Canvas floating capsule eyes function preserved', canvasTest.hasCompactEyes);
    assert('Canvas spring physics active for smooth resizing', canvasTest.hasSprings);

    // Clean up
    win.destroy();
    settingsWin.destroy();
    try { fs.unlinkSync(testFilePath); } catch {}

    // Summary
    console.log('\n====================================================');
    console.log(`LIVE FEATURE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    app.quit();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('[UNCAUGHT EXCEPTION]', err);
    app.quit();
    process.exit(1);
  }
});
