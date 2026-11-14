const path = require('path');
const fs = require('fs');

// Support running via plain node OR npx electron
if (!process.versions.electron) {
  const { spawnSync } = require('child_process');
  const electronPath = require('electron');
  console.log('[Runner] Spawning Electron runner for scripts/test-rest-mode.js...\n');
  const res = spawnSync(electronPath, [__filename], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

const { app, BrowserWindow, ipcMain } = require('electron');

console.log('====================================================');
console.log('       ROBOISLAND REST MODE VERIFICATION SUITE      ');
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
    // 1. Config Store & Persistent Rest Mode Settings
    // -------------------------------------------------------------------
    console.log('--- 1. Testing Config Store Rest Mode Configuration ---');
    const { configStore, DEFAULT_CONFIG } = require(path.join(root, 'dist', 'main', 'config-store.js'));

    assert('DEFAULT_CONFIG contains restModeEnabled', typeof DEFAULT_CONFIG.restModeEnabled === 'boolean');
    assert('Default restModeEnabled is false', DEFAULT_CONFIG.restModeEnabled === false);
    assert('DEFAULT_CONFIG restCapsuleWidth is 32', DEFAULT_CONFIG.restCapsuleWidth === 32);
    assert('DEFAULT_CONFIG restCapsuleHeight is 18', DEFAULT_CONFIG.restCapsuleHeight === 18);
    assert('DEFAULT_CONFIG restHotkey is defined', typeof DEFAULT_CONFIG.restHotkey === 'string' && DEFAULT_CONFIG.restHotkey.length > 0);

    // Test Config persistence
    configStore.update({ restModeEnabled: true, restCapsuleWidth: 36, restCapsuleHeight: 20 });
    let cfg = configStore.get();
    assert('Config update persists restModeEnabled: true', cfg.restModeEnabled === true);
    assert('Config update persists custom rest dimensions (36x20)', cfg.restCapsuleWidth === 36 && cfg.restCapsuleHeight === 20);

    // Restore default
    configStore.update({ restModeEnabled: false, restCapsuleWidth: 32, restCapsuleHeight: 18 });
    cfg = configStore.get();
    assert('Config restored to default rest dimensions (32x18)', cfg.restCapsuleWidth === 32 && cfg.restCapsuleHeight === 18);

    // -------------------------------------------------------------------
    // 2. IslandWindow Mode Bounds & IPC Methods
    // -------------------------------------------------------------------
    console.log('\n--- 2. Testing IslandWindow Mode Bounds & Methods ---');
    const { IslandWindow } = require(path.join(root, 'dist', 'main', 'island-window.js'));
    const islandWinInstance = new IslandWindow();

    const restBounds = islandWinInstance.getModeBounds('rest');
    assert('Rest mode capsule bounds are 32x18 px', restBounds.capsuleWidth === 32 && restBounds.capsuleHeight === 18);
    assert('Rest mode transparent container is 860x340', restBounds.width === 860 && restBounds.height === 340);

    const compactBounds = islandWinInstance.getModeBounds('compact');
    assert('Compact mode capsule bounds are 300x36 px', compactBounds.capsuleWidth === 300 && compactBounds.capsuleHeight === 36);

    const expandedBounds = islandWinInstance.getModeBounds('expanded');
    assert('Expanded mode capsule bounds are 520x240 px', expandedBounds.capsuleWidth === 520 && expandedBounds.capsuleHeight === 240);

    assert('Initial window mode is compact', islandWinInstance.getMode() === 'compact');
    islandWinInstance.setMode('rest');
    assert('islandWinInstance.setMode("rest") updates mode', islandWinInstance.getMode() === 'rest');
    islandWinInstance.setMode('compact');
    assert('islandWinInstance.setMode("compact") restores mode', islandWinInstance.getMode() === 'compact');

    // -------------------------------------------------------------------
    // 3. Live Renderer Canvas Engine Rest Mode Testing
    // -------------------------------------------------------------------
    console.log('\n--- 3. Using Island Window for Canvas Rest Mode Testing ---');
    const liveWin = islandWinInstance.getWindow();
    if (!liveWin) throw new Error('Failed to obtain Island BrowserWindow');
    await new Promise(r => setTimeout(r, 800));

    // Test 3.1: Canvas Engine Initialization
    const initStatus = await liveWin.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        return {
          hasEngine: Boolean(engine),
          mode: engine ? engine.getMode() : null,
          currentWidth: engine ? engine.currentWidth : null,
          currentHeight: engine ? engine.currentHeight : null
        };
      })()
    `);
    assert('Live Canvas Engine initialized', initStatus.hasEngine);
    assert('Default island mode is compact', initStatus.mode === 'compact');

    // Test 3.2: Transition to Rest Mode (32x18 px capsule)
    console.log('\n--- 4. Testing Transition to Rest Mode (32x18 px Capsule) ---');
    const restEnterStatus = await liveWin.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        engine.setMode('rest');
        return {
          mode: engine.getMode(),
          targetWidth: engine.targetWidth,
          targetHeight: engine.targetHeight,
          targetRadius: engine.targetRadius,
          overlayHidden: document.getElementById('expanded-island-overlay').classList.contains('hidden')
        };
      })()
    `);
    assert('Island mode set to "rest"', restEnterStatus.mode === 'rest');
    assert('Rest targetWidth is 32 px', restEnterStatus.targetWidth === 32);
    assert('Rest targetHeight is 18 px', restEnterStatus.targetHeight === 18);
    assert('Rest targetRadius is 9 px (capsule half-height)', restEnterStatus.targetRadius === 9);
    assert('DOM overlay hidden in rest mode', restEnterStatus.overlayHidden === true);

    // Test 3.3: Spring Physics Animation shrinking towards 32x18
    console.log('\n--- 5. Testing Spring Physics Shrinking to 32x18 px ---');
    const springShrink = await liveWin.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        const startW = engine.currentWidth;
        const startH = engine.currentHeight;

        // Run 8 spring physics ticks (dt = 0.016s)
        for (let i = 0; i < 8; i++) {
          engine.renderLoop(performance.now() + i * 16);
        }

        const endW = engine.currentWidth;
        const endH = engine.currentHeight;

        // Verify width moved closer to 32
        const shrunkWidth = Math.abs(endW - 32) < Math.abs(startW - 32);
        // Verify height moved closer to 18
        const shrunkHeight = Math.abs(endH - 18) <= Math.abs(startH - 18);

        return { startW, endW, startH, endH, shrunkWidth, shrunkHeight };
      })()
    `);
    assert('Spring physics smoothly shrinks capsule width towards 32px', springShrink.shrunkWidth, `${springShrink.startW.toFixed(1)}px -> ${springShrink.endW.toFixed(1)}px`);
    assert('Spring physics smoothly shrinks capsule height towards 18px', springShrink.shrunkHeight, `${springShrink.startH.toFixed(1)}px -> ${springShrink.endH.toFixed(1)}px`);

    // Test 3.4: Hovering over the Rest Capsule Restores to Compact
    console.log('\n--- 6. Testing Rest Mode Hover & Click Restoration ---');
    const hoverRestore = await liveWin.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        engine.setMode('rest');

        // Simulate pointer moving inside rest capsule (center: cx = innerWidth / 2, topY = 4)
        const cx = Math.round(window.innerWidth / 2);
        const evt = new MouseEvent('mousemove', {
          bubbles: true,
          clientX: cx,
          clientY: 10
        });
        window.dispatchEvent(evt);

        return {
          restoredMode: engine.getMode(),
          targetWidth: engine.targetWidth,
          targetHeight: engine.targetHeight
        };
      })()
    `);
    assert('Hover on rest capsule smoothly restores mode to compact', hoverRestore.restoredMode === 'compact');
    assert('Compact target width is restored (>= 116px)', hoverRestore.targetWidth >= 116, `${hoverRestore.targetWidth}px`);
    assert('Compact target height is restored (>= 32px)', hoverRestore.targetHeight >= 32, `${hoverRestore.targetHeight}px`);

    // Test 3.5: Click on Rest Capsule Restores to Compact
    const clickRestore = await liveWin.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        engine.setMode('rest');

        const cx = Math.round(window.innerWidth / 2);
        const evt = new MouseEvent('click', {
          bubbles: true,
          clientX: cx,
          clientY: 10
        });
        window.dispatchEvent(evt);
        window.dispatchEvent(new MouseEvent('mouseleave'));

        return {
          modeAfterClick: engine.getMode()
        };
      })()
    `);
    assert('Clicking rest capsule restores mode to compact', clickRestore.modeAfterClick === 'compact');

    // Test 3.6: Transitions: Rest -> Compact -> Expanded -> Rest
    console.log('\n--- 7. Testing Full State Transition Cycle (Rest -> Compact -> Expanded -> Rest) ---');
    const cycleStatus = await liveWin.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new MouseEvent('mouseleave'));
        const engine = window.__canvasEngine;
        const results = [];

        // 1. Enter Rest
        engine.setMode('rest');
        results.push({ step: 'rest', mode: engine.getMode(), w: engine.targetWidth, h: engine.targetHeight });

        // 2. Restore to Compact
        engine.setMode('compact');
        results.push({ step: 'compact', mode: engine.getMode(), w: engine.targetWidth, h: engine.targetHeight });

        // 3. Expand to Hub
        engine.setMode('expanded');
        results.push({ step: 'expanded', mode: engine.getMode(), w: engine.targetWidth, h: engine.targetHeight });

        // 4. Return to Rest
        engine.setMode('rest');
        results.push({ step: 'return_rest', mode: engine.getMode(), w: engine.targetWidth, h: engine.targetHeight });

        return results;
      })()
    `);
    assert('Cycle Step 1: Rest mode (32x18)', cycleStatus[0].mode === 'rest' && cycleStatus[0].w === 32 && cycleStatus[0].h === 18);
    assert('Cycle Step 2: Compact mode (>=116x32)', cycleStatus[1].mode === 'compact' && cycleStatus[1].w >= 116 && cycleStatus[1].h >= 32);
    assert('Cycle Step 3: Expanded mode (520x240)', cycleStatus[2].mode === 'expanded' && cycleStatus[2].w === 520 && cycleStatus[2].h === 240);
    assert('Cycle Step 4: Return to Rest mode (32x18)', cycleStatus[3].mode === 'rest' && cycleStatus[3].w === 32 && cycleStatus[3].h === 18);

    // Test 3.7: Tuck-Away to Screen Top Edge (56x4 px line with hover peek zone)
    console.log('\n--- 8. Testing Screen Edge Tuck-Away (56x4 px Line with Hover Peek) ---');
    const tuckStatus = await liveWin.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new MouseEvent('mouseleave'));
        const engine = window.__canvasEngine;
        engine.setTucked(true);

        const tuckedTargetW = engine.targetWidth;
        const tuckedTargetH = engine.targetHeight;
        const tuckedRadius = engine.targetRadius;

        // Hover peek zone at screen top center
        const cx = Math.round(window.innerWidth / 2);
        const hoverEvt = new MouseEvent('mousemove', {
          bubbles: true,
          clientX: cx,
          clientY: 2
        });
        window.dispatchEvent(hoverEvt);

        const peekTargetW = engine.targetWidth;

        // Leave hover peek
        const leaveEvt = new MouseEvent('mouseleave', { bubbles: true });
        window.dispatchEvent(leaveEvt);

        const unhoverTargetW = engine.targetWidth;

        // Click un-tucks
        const clickEvt = new MouseEvent('click', {
          bubbles: true,
          clientX: cx,
          clientY: 2
        });
        window.dispatchEvent(clickEvt);
        const unTuckedState = engine.getTucked();

        return {
          tuckedTargetW,
          tuckedTargetH,
          tuckedRadius,
          peekTargetW,
          unhoverTargetW,
          unTuckedState
        };
      })()
    `);
    assert('Tucked mode width is 56 px', tuckStatus.tuckedTargetW === 56);
    assert('Tucked mode height is 4 px (minimal top line)', tuckStatus.tuckedTargetH === 4);
    assert('Tucked mode radius is 2 px', tuckStatus.tuckedRadius === 2);
    assert('Hover in peek zone expands tuck line (72 px peek)', tuckStatus.peekTargetW === 72);
    assert('Unhover restores tuck line to 56 px', tuckStatus.unhoverTargetW === 56);
    assert('Clicking tucked line restores island from edge', tuckStatus.unTuckedState === false);

    // Test 3.8: Typed Preload Island API (setIslandMode / getIslandMode / getModeBounds)
    console.log('\n--- 9. Testing Typed IPC & Preload IslandAPI Integration ---');
    const ipcStatus = await liveWin.webContents.executeJavaScript(`
      (async () => {
        const api = window.roboIsland;
        if (!api) return { error: 'window.roboIsland not found' };

        const hasSetIslandMode = typeof api.setIslandMode === 'function';
        const hasGetIslandMode = typeof api.getIslandMode === 'function';
        const hasGetModeBounds = typeof api.getModeBounds === 'function';

        let restBoundsFromIpc = null;
        if (hasGetModeBounds) {
          restBoundsFromIpc = await api.getModeBounds('rest');
        }

        return {
          hasSetIslandMode,
          hasGetIslandMode,
          hasGetModeBounds,
          restBoundsFromIpc
        };
      })()
    `);
    assert('Preload exposes setIslandMode API', ipcStatus.hasSetIslandMode);
    assert('Preload exposes getIslandMode API', ipcStatus.hasGetIslandMode);
    assert('Preload exposes getModeBounds API', ipcStatus.hasGetModeBounds);
    assert('IPC getModeBounds returns 32x18 capsule dimensions',
      ipcStatus.restBoundsFromIpc &&
      ipcStatus.restBoundsFromIpc.capsuleWidth === 32 &&
      ipcStatus.restBoundsFromIpc.capsuleHeight === 18
    );

    // Clean up
    liveWin.destroy();

    // Summary
    console.log('\n====================================================');
    console.log(`REST MODE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    app.quit();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error in test-rest-mode:', err);
    app.quit();
    process.exit(1);
  }
});
