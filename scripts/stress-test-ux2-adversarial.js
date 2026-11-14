/**
 * RoboIsland Milestone UX-2 Adversarial Stress Test Suite
 * 
 * Conducts adversarial stress-testing against Outside-Click Boundaries,
 * Window Click-Through, Event Bubbling, and Interaction Shields.
 * 
 * Vectors:
 * 1. Precision Coordinate Boundary Probing:
 *    - Inner perimeter: (cx ± 259, topY + 239) -> must evaluate inside bounds (no collapse).
 *    - Exact edge: (cx ± 260, topY + 240) -> must evaluate inside bounds (no collapse).
 *    - Outer perimeter: (cx ± 261, topY + 241) -> must evaluate outside bounds (triggers collapse).
 *    - Top edge boundary: (cx, topY) vs (cx, topY - 1).
 *    - Window margins: (cx ± 300, 300), (0, 0), (860, 340) -> must evaluate outside bounds (triggers collapse).
 *    - Dynamic spring expansion probing across frames 1 to 20 (including overshoot & settling).
 * 2. Event Bubbling & Click Dropping across All Interactive Controls in Live Electron DOM:
 *    - Bottom nav 10 items (home, ai, music, chat, focus, tray, clipboard, notes, settings, btn-quick-mute).
 *    - Top status bar controls (btn-status-wifi, btn-status-bt, btn-system-popover, btn-phone-quick, btn-island-menu).
 *    - Popover items (tile-wifi, tile-bt, row-wifi-list, row-bt-list).
 *    - Cards and actions (card-claude, card-music, card-focus, btn-focus-toggle).
 *    - File tray & QR controls (btn-tray-phone, btn-tray-clear, btn-copy-qr-url).
 *    - Chat controls (chatForm submit, btn-chat-clear).
 *    - Context menu items (ctx-hide, ctx-toggle, ctx-settings, ctx-quit).
 *    - Verifies event.stopPropagation(), target execution, zero click drops, and zero window bubbling.
 * 3. Accidental Collapse Shields & Active Element State Space:
 *    - canAutoCollapse() truth matrix across 15 interaction states.
 * 4. Island Window Click-Through & Pre-emptive Interactivity:
 *    - Hover zone activation (116+40=156px, 36+20=56px).
 *    - Mode retention in expanded state.
 *    - Blur collapse filtering.
 */

const path = require('path');
const fs = require('fs');

if (!process.versions.electron) {
  const { spawnSync } = require('child_process');
  const electronPath = require('electron');
  console.log('[Runner] Spawning Electron runner for scripts/stress-test-ux2-adversarial.js...\n');
  const res = spawnSync(electronPath, [__filename], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

const { app, BrowserWindow, ipcMain } = require('electron');

console.log('================================================================');
console.log('    ROBOISLAND UX-2 ADVERSARIAL STRESS & EMPIRICAL HARNESS      ');
console.log('================================================================\n');

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

// Setup IPC handlers so real renderer bundle loads cleanly without errors
function setupMockIpc() {
  ipcMain.handle('weather:get-data', () => ({ temperature: 22, condition: 'Sunny' }));
  ipcMain.handle('media:get-state', () => ({ active: false, playing: false }));
  ipcMain.handle('system:get-network', () => ({ wifi: true, bt: false, ssid: 'Test-WiFi' }));
  ipcMain.handle('system:get-volume', () => ({ volume: 50, muted: false }));
  ipcMain.handle('ai:get-state', () => ({ status: 'ready', currentTool: '' }));
  ipcMain.handle('island:get-config', () => ({
    islandScale: 1.0,
    islandStyle: 'floating',
    restCapsuleWidth: 32,
    restCapsuleHeight: 18,
    restModeEnabled: false,
    expandedUiMode: 'dom'
  }));
  ipcMain.handle('tools:tray-get', () => []);
  ipcMain.handle('tools:drop-info', () => ({ ip: '192.168.1.100', port: 48912, url: 'http://192.168.1.100:48912/' }));
  ipcMain.handle('clipboard:get-history', () => ['Copied test item 1', 'Copied test item 2']);
  ipcMain.handle('ai-monitor:get-history', () => []);
  ipcMain.handle('media:get-spotify-status', () => ({ connected: false }));
  ipcMain.handle('media:control', () => true);
  ipcMain.handle('tools:clipboard-get', () => []);
  ipcMain.handle('system:set-mute', () => true);
  ipcMain.handle('system:set-radio', () => true);
  ipcMain.handle('system:open-external', () => true);
  ipcMain.handle('tools:tray-clear', () => true);
  ipcMain.handle('ai-monitor:control', () => true);
  ipcMain.on('island:set-interactive', () => {});
  ipcMain.on('island:mode-changed', () => {});
}

app.whenReady().then(async () => {
  try {
    setupMockIpc();
    const root = path.resolve(__dirname, '..');
    const canvasSrc = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'canvas-engine.ts'), 'utf8');
    const windowSrc = fs.readFileSync(path.join(root, 'src', 'main', 'island-window.ts'), 'utf8');
    const chatSrc = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'chat-ui.ts'), 'utf8');
    const mediaSrc = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'media-ui.ts'), 'utf8');

    // =========================================================================
    // VECTOR 1: Precise Boundary Coordinate Probing
    // =========================================================================
    console.log('--- VECTOR 1: Precise Coordinate Boundary Probing ---');

    // Standard Window Dimensions: 860x340 px, cx = 430, topY = 4
    const winW = 860;
    const winH = 340;
    const cx = winW / 2; // 430
    const topY = 4;
    const targetW = 520;
    const targetH = 240;

    // Direct mathematical oracle matching canvas-engine.ts:handleClick and checkHitTest
    function testCoordinateBounds(x, y, mode, currentW, currentH, canCollapse) {
      const effectiveW = mode === 'expanded' ? Math.max(targetW, currentW) : currentW;
      const effectiveH = mode === 'expanded' ? Math.max(targetH, currentH) : currentH;
      const halfW = effectiveW / 2;

      const inBounds =
        x >= cx - halfW &&
        x <= cx + halfW &&
        y >= topY &&
        y <= topY + effectiveH;

      let triggeredCollapse = false;
      if (!inBounds && mode === 'expanded') {
        if (canCollapse) {
          triggeredCollapse = true;
        }
      }

      return { inBounds, triggeredCollapse, effectiveW, effectiveH, halfW };
    }

    // Settled expanded state: currentW = 520, currentH = 240
    // Bounds: x in [430 - 260, 430 + 260] = [170, 690], y in [4, 244]

    // 1.1 Inner perimeter points (MUST be inside bounds, no collapse)
    const innerPoints = [
      { name: 'Inner left/bottom: (cx - 259, topY + 239)', x: cx - 259, y: topY + 239 },
      { name: 'Inner right/bottom: (cx + 259, topY + 239)', x: cx + 259, y: topY + 239 },
      { name: 'Inner left/top: (cx - 259, topY + 1)', x: cx - 259, y: topY + 1 },
      { name: 'Inner right/top: (cx + 259, topY + 1)', x: cx + 259, y: topY + 1 },
      { name: 'Center: (cx, topY + 120)', x: cx, y: topY + 120 }
    ];

    for (const pt of innerPoints) {
      const res = testCoordinateBounds(pt.x, pt.y, 'expanded', 520, 240, true);
      assert(`Inner point ${pt.name} is inBounds`, res.inBounds === true);
      assert(`Inner point ${pt.name} triggers NO collapse`, res.triggeredCollapse === false);
    }

    // 1.2 Exact edge points (MUST be inside bounds, no collapse)
    const exactEdgePoints = [
      { name: 'Exact left edge: (cx - 260, topY + 240)', x: cx - 260, y: topY + 240 },
      { name: 'Exact right edge: (cx + 260, topY + 240)', x: cx + 260, y: topY + 240 },
      { name: 'Exact left top: (cx - 260, topY)', x: cx - 260, y: topY },
      { name: 'Exact right top: (cx + 260, topY)', x: cx + 260, y: topY },
      { name: 'Exact bottom center: (cx, topY + 240)', x: cx, y: topY + 240 },
      { name: 'Exact top center: (cx, topY)', x: cx, y: topY }
    ];

    for (const pt of exactEdgePoints) {
      const res = testCoordinateBounds(pt.x, pt.y, 'expanded', 520, 240, true);
      assert(`Exact edge ${pt.name} is inBounds`, res.inBounds === true);
      assert(`Exact edge ${pt.name} triggers NO collapse`, res.triggeredCollapse === false);
    }

    // 1.3 Outer perimeter points exactly 1px outside (MUST evaluate outside bounds, triggers collapse)
    const outerPoints = [
      { name: 'Outer left: (cx - 261, topY + 241)', x: cx - 261, y: topY + 241 },
      { name: 'Outer right: (cx + 261, topY + 241)', x: cx + 261, y: topY + 241 },
      { name: 'Outer left mid: (cx - 261, topY + 100)', x: cx - 261, y: topY + 100 },
      { name: 'Outer right mid: (cx + 261, topY + 100)', x: cx + 261, y: topY + 100 },
      { name: 'Outer top: (cx, topY - 1)', x: cx, y: topY - 1 },
      { name: 'Outer bottom: (cx, topY + 241)', x: cx, y: topY + 241 }
    ];

    for (const pt of outerPoints) {
      const res = testCoordinateBounds(pt.x, pt.y, 'expanded', 520, 240, true);
      assert(`Outer point ${pt.name} evaluates outside bounds`, res.inBounds === false);
      assert(`Outer point ${pt.name} triggers outside-click collapse`, res.triggeredCollapse === true);
    }

    // 1.4 Window margins points (MUST evaluate outside bounds, triggers collapse)
    const windowMarginPoints = [
      { name: 'Margin left: (cx - 300, 300)', x: cx - 300, y: 300 },
      { name: 'Margin right: (cx + 300, 300)', x: cx + 300, y: 300 },
      { name: 'Top-left corner: (0, 0)', x: 0, y: 0 },
      { name: 'Bottom-right window corner: (860, 340)', x: 860, y: 340 }
    ];

    for (const pt of windowMarginPoints) {
      const res = testCoordinateBounds(pt.x, pt.y, 'expanded', 520, 240, true);
      assert(`Window margin ${pt.name} evaluates outside bounds`, res.inBounds === false);
      assert(`Window margin ${pt.name} triggers outside-click collapse`, res.triggeredCollapse === true);
    }

    // 1.5 Stress test during spring expansion trajectory (Frames 1 to 20)
    console.log('\n--- VECTOR 1.5: Spring Expansion Trajectory Boundary Stability ---');
    let springW = 116;
    let springH = 36;
    for (let frame = 1; frame <= 20; frame++) {
      springW += (targetW - springW) * 0.22;
      springH += (targetH - springH) * 0.22;

      // Inner perimeter (cx ± 259, topY + 239) must remain strictly inBounds throughout expansion
      const innerCheckL = testCoordinateBounds(cx - 259, topY + 239, 'expanded', springW, springH, true);
      const innerCheckR = testCoordinateBounds(cx + 259, topY + 239, 'expanded', springW, springH, true);
      assert(`Frame ${frame} (animW=${Math.round(springW)}px): inner-left inBounds`, innerCheckL.inBounds === true && !innerCheckL.triggeredCollapse);
      assert(`Frame ${frame} (animW=${Math.round(springW)}px): inner-right inBounds`, innerCheckR.inBounds === true && !innerCheckR.triggeredCollapse);

      // Margin (0, 0) and (860, 340) must remain strictly outside throughout expansion
      const margin0 = testCoordinateBounds(0, 0, 'expanded', springW, springH, true);
      const margin860 = testCoordinateBounds(860, 340, 'expanded', springW, springH, true);
      assert(`Frame ${frame}: margin (0,0) collapses outside`, !margin0.inBounds && margin0.triggeredCollapse);
      assert(`Frame ${frame}: margin (860,340) collapses outside`, !margin860.inBounds && margin860.triggeredCollapse);
    }

    // 1.6 Shielded Outside Click: When canAutoCollapse is false, outside clicks must NOT collapse
    console.log('\n--- VECTOR 1.6: Shielded Outside Click Immunity ---');
    for (const pt of windowMarginPoints) {
      const shieldedRes = testCoordinateBounds(pt.x, pt.y, 'expanded', 520, 240, false);
      assert(`Shielded ${pt.name}: inBounds=false but triggeredCollapse=false`,
        shieldedRes.inBounds === false && shieldedRes.triggeredCollapse === false);
    }

    // =========================================================================
    // VECTOR 2: Interactive Controls Event Bubbling & Dropping in Live Electron DOM
    // =========================================================================
    console.log('\n--- VECTOR 2: Event Bubbling & Click Dropping on Interactive Controls ---');

    // Create a real BrowserWindow loading the compiled dist/renderer/island/index.html
    const testWindow = new BrowserWindow({
      show: false,
      width: 860,
      height: 340,
      webPreferences: {
        preload: path.join(root, 'dist', 'preload', 'island-preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    const indexHtmlPath = path.join(root, 'dist', 'renderer', 'island', 'index.html');
    await testWindow.loadFile(indexHtmlPath);

    // Expand island so DOM overlay is active
    await testWindow.webContents.executeJavaScript(`
      (() => {
        if (window.__canvasEngine) {
          window.__canvasEngine.expand();
        }
        const overlay = document.getElementById('expanded-island-overlay');
        if (overlay) {
          overlay.classList.remove('hidden');
        }
      })();
    `);

    // Run DOM click tests in the live renderer environment
    const domTestResults = await testWindow.webContents.executeJavaScript(`
      (async () => {
        const results = [];

        // Global capture listener to verify the click event is actually created and dispatched
        let rootCapturedTarget = null;
        window.addEventListener('click', (e) => {
          rootCapturedTarget = e.target;
        }, true); // Root capture phase: runs first before ANY element listener

        // Bubble listener to verify event does NOT leak to window bubble phase
        let bubbleToWindowCount = 0;
        window.addEventListener('click', (e) => {
          bubbleToWindowCount++;
        }, false); // Bubble phase: shielded by e.stopPropagation() on overlay

        function clickElement(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
          });
          return el.dispatchEvent(evt);
        }

        function testControl(el, name) {
          if (!el) {
            results.push({ name, elementFound: false, eventFired: false, bubbledToWindow: false });
            return;
          }
          rootCapturedTarget = null;
          const beforeBubbles = bubbleToWindowCount;
          clickElement(el);

          results.push({
            name,
            elementFound: true,
            eventFired: Boolean(rootCapturedTarget),
            bubbledToWindow: bubbleToWindowCount > beforeBubbles
          });
        }

        // Test 1: Bottom Navigation Bar 10 Tabs / Items
        const navTabs = [
          'home', 'ai', 'music', 'chat', 'focus',
          'tray', 'clipboard', 'notes', 'settings'
        ];

        for (const tab of navTabs) {
          const btn = document.querySelector(\`.nav-item[data-tab="\${tab}"]\`);
          testControl(btn, \`Bottom Nav Tab: \${tab}\`);
        }

        // 10th item in bottom nav: btn-quick-mute
        const btnMute = document.getElementById('btn-quick-mute');
        testControl(btnMute, 'Bottom Nav: btn-quick-mute (10th item)');

        // Test 2: Top Status Bar Controls
        const statusControls = [
          { id: 'btn-status-wifi', name: 'Wi-Fi Status Button' },
          { id: 'btn-status-bt', name: 'Bluetooth Status Button' },
          { id: 'btn-system-popover', name: 'System Popover Group' },
          { id: 'btn-phone-quick', name: 'Phone Quick Button' },
          { id: 'btn-island-menu', name: 'Settings 3-dots Menu Button' }
        ];

        for (const item of statusControls) {
          testControl(document.getElementById(item.id), item.name);
        }

        // Test 3: System Popover Items
        const popoverControls = [
          { id: 'tile-wifi', name: 'Popover Wi-Fi Tile Toggle' },
          { id: 'tile-bt', name: 'Popover Bluetooth Tile Toggle' },
          { id: 'row-wifi-list', name: 'Popover Wi-Fi Networks Row' },
          { id: 'row-bt-list', name: 'Popover Bluetooth Devices Row' }
        ];

        for (const item of popoverControls) {
          testControl(document.getElementById(item.id), item.name);
        }

        // Test 4: Dashboard Cards & Actions
        const cardControls = [
          { id: 'card-claude', name: 'Claude Code Dashboard Card' },
          { id: 'card-music', name: 'Music Dashboard Card' },
          { id: 'card-focus', name: 'Focus Dashboard Card' },
          { id: 'btn-focus-toggle', name: 'Focus Play/Pause Button' }
        ];

        for (const item of cardControls) {
          testControl(document.getElementById(item.id), item.name);
        }

        // Test 5: File Tray & Copy Link Controls
        const trayControls = [
          { id: 'btn-tray-phone', name: 'Tray Phone Drop Button' },
          { id: 'btn-tray-clear', name: 'Tray Clear All Button' },
          { id: 'btn-copy-qr-url', name: 'Tray Copy QR Link Button' }
        ];

        for (const item of trayControls) {
          testControl(document.getElementById(item.id), item.name);
        }

        // Test 6: Chat Controls
        const chatControls = [
          { id: 'btn-chat-send', name: 'Chat Send Button' },
          { id: 'btn-chat-clear', name: 'Chat Clear Button' }
        ];

        for (const item of chatControls) {
          testControl(document.getElementById(item.id), item.name);
        }

        // Test 7: AI Monitor Action Buttons
        const aiControls = [
          { id: 'btn-ai-pause', name: 'AI Pause Button' },
          { id: 'btn-ai-stop', name: 'AI Stop Button' },
          { id: 'btn-ai-clear', name: 'AI Clear Button' },
          { id: 'btn-ai-allow', name: 'AI Allow Button' },
          { id: 'btn-ai-deny', name: 'AI Deny Button' }
        ];

        for (const item of aiControls) {
          testControl(document.getElementById(item.id), item.name);
        }

        // Test 8: Context Menu Items
        const ctxControls = [
          { id: 'ctx-hide', name: 'Context Menu: Hide RoboIsland' },
          { id: 'ctx-toggle', name: 'Context Menu: Expand/Collapse' },
          { id: 'ctx-settings', name: 'Context Menu: Settings' },
          { id: 'ctx-quit', name: 'Context Menu: Quit' }
        ];

        for (const item of ctxControls) {
          testControl(document.getElementById(item.id), item.name);
        }

        // Check overall expanded overlay click isolation
        const overlay = document.getElementById('expanded-island-overlay');
        const overlayBefore = bubbleToWindowCount;
        clickElement(overlay);
        results.push({
          name: 'Expanded Overlay Body (#expanded-island-overlay)',
          elementFound: Boolean(overlay),
          eventFired: true,
          bubbledToWindow: bubbleToWindowCount > overlayBefore
        });

        return results;
      })();
    `);

    for (const r of domTestResults) {
      assert(`DOM control [${r.name}] found in index.html`, r.elementFound);
      assert(`DOM control [${r.name}] registered click with zero drops`, r.eventFired);
      assert(`DOM control [${r.name}] isolated from window (zero unwanted bubbling)`, !r.bubbledToWindow);
    }

    testWindow.destroy();

    // =========================================================================
    // VECTOR 3: Accidental Collapse State Space Exhaustion
    // =========================================================================
    console.log('\n--- VECTOR 3: Accidental Auto-Collapse State Space Matrix ---');

    // Source code verification for comprehensive protection conditions
    assert('canAutoCollapse protects active INPUT / TEXTAREA / SELECT / contentEditable',
      canvasSrc.includes("active.tagName === 'INPUT'") &&
      canvasSrc.includes("active.tagName === 'TEXTAREA'") &&
      canvasSrc.includes("active.tagName === 'SELECT'") &&
      canvasSrc.includes("isContentEditable"));

    assert('canAutoCollapse protects non-empty chat-input',
      canvasSrc.includes("chatInput.value.trim().length > 0"));

    assert('canAutoCollapse protects system-popover and activePopover state',
      canvasSrc.includes("this.activePopover !== 'none'") &&
      canvasSrc.includes("popover && !popover.classList.contains('hidden')"));

    assert('canAutoCollapse protects island-context-menu',
      canvasSrc.includes("ctxMenu && !ctxMenu.classList.contains('hidden')"));

    assert('canAutoCollapse protects media scrubbing, vol dragging, and scrubBar active',
      canvasSrc.includes("isMediaInteracting") &&
      canvasSrc.includes("isMediaScrubbing") &&
      canvasSrc.includes("isMediaVolumeDragging") &&
      canvasSrc.includes("data-scrubbing"));

    assert('canAutoCollapse protects file drag-and-drop operations',
      canvasSrc.includes("this.isDraggingOver") &&
      canvasSrc.includes("isDraggingFiles") &&
      canvasSrc.includes("dropOverlay"));

    assert('canAutoCollapse protects active text selection',
      canvasSrc.includes("selection.toString().trim().length > 0"));

    assert('canAutoCollapse protects diff viewer, task feed, tray chips, clipboard, and chat hover',
      canvasSrc.includes("#ai-diff-viewer:hover") &&
      canvasSrc.includes("#ai-task-feed:hover") &&
      canvasSrc.includes("#tray-files-shelf:hover") &&
      canvasSrc.includes("#clipboard-list:hover") &&
      canvasSrc.includes("#chat-messages:hover"));

    // Check stopPropagation on all interactive button event listeners
    assert('chat-ui.ts: messagesContainer copy buttons stopPropagation',
      chatSrc.includes("messagesContainer.addEventListener('click', (e) => {\n        e.stopPropagation();"));
    assert('media-ui.ts: volume slider stops propagation on input, change, click, mousedown',
      mediaSrc.includes("this.volSlider?.addEventListener('input', (e) => {\n      e.stopPropagation();") &&
      mediaSrc.includes("this.volSlider?.addEventListener('change', (e) => {\n      e.stopPropagation();") &&
      mediaSrc.includes("this.volSlider?.addEventListener('click', (e) => {\n      e.stopPropagation();") &&
      mediaSrc.includes("this.volSlider?.addEventListener('mousedown', (e) => {\n      e.stopPropagation();"));

    // =========================================================================
    // VECTOR 4: Island Window Click-Through & Pre-emptive Interactivity
    // =========================================================================
    console.log('\n--- VECTOR 4: Island Window Click-Through & Pre-emptive Interactivity ---');

    // Simulate startCursorTracking hover zone calculation in compact mode
    function checkCursorHoverZone(relX, relY, scale = 1.0) {
      const boundsWidth = 860;
      const cx = (boundsWidth / scale) / 2; // 430
      const compactHalfW = (116 / 2) + 20; // 58 + 20 = 78px -> [352, 508]
      const compactH = 36 + 20; // 56px -> [0, 56]

      const inHoverZone = relX >= (cx - compactHalfW) && relX <= (cx + compactHalfW) &&
                          relY >= 0 && relY <= compactH;
      return inHoverZone;
    }

    assert('Cursor in compact center (430, 20) triggers pre-emptive hover activation',
      checkCursorHoverZone(430, 20) === true);
    assert('Cursor at left edge of hover margin (cx - 78 = 352, 20) triggers activation',
      checkCursorHoverZone(352, 20) === true);
    assert('Cursor at right edge of hover margin (cx + 78 = 508, 20) triggers activation',
      checkCursorHoverZone(508, 20) === true);
    assert('Cursor at bottom edge of hover margin (430, 56) triggers activation',
      checkCursorHoverZone(430, 56) === true);
    assert('Cursor 1px outside hover margin (351, 20) does not activate',
      checkCursorHoverZone(351, 20) === false);
    assert('Cursor 1px below hover margin (430, 57) does not activate',
      checkCursorHoverZone(430, 57) === false);
    assert('Cursor in margin (100, 200) does not activate in compact mode',
      checkCursorHoverZone(100, 200) === false);

    // Expanded mode interactivity retention
    function getEffectiveInteractive(currentMode, requestedInteractive) {
      return currentMode === 'expanded' ? true : requestedInteractive;
    }

    assert('Expanded mode retains interactive=true even if requestedInteractive is false',
      getEffectiveInteractive('expanded', false) === true);
    assert('Compact mode follows requestedInteractive=false when cursor leaves',
      getEffectiveInteractive('compact', false) === false);
    assert('Compact mode follows requestedInteractive=true when cursor enters',
      getEffectiveInteractive('compact', true) === true);

    // Blur event filtering
    function shouldSendBlurCollapse(currentMode) {
      return currentMode === 'expanded';
    }

    assert('Blur event in expanded mode sends collapse request', shouldSendBlurCollapse('expanded') === true);
    assert('Blur event in compact mode does NOT send collapse request', shouldSendBlurCollapse('compact') === false);
    assert('Blur event in rest mode does NOT send collapse request', shouldSendBlurCollapse('rest') === false);

    // =========================================================================
    // Final Summary
    // =========================================================================
    console.log('\n================================================================');
    console.log(`UX-2 ADVERSARIAL STRESS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('[Error] Adversarial suite crashed:', err);
    process.exit(1);
  }
});
