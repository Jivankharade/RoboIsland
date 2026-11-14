/**
 * RoboIsland Milestone UX-2 Empirical Adversarial Stress Harness
 * 
 * Adversarially challenge and stress-test Milestone UX-2 interaction fixes:
 * 1. Race conditions during spring expansion:
 *    Simulate clicks arriving at t = 0ms, 50ms, 100ms, 150ms, 200ms at
 *    x = cx + 200, cx - 200, cx + 250, cx - 250.
 *    Verify that none of these clicks evaluate as outside clicks or trigger premature collapse.
 *    Also test boundary precision (negative controls at x = cx +/- 261).
 * 2. Internal interaction shields:
 *    Simulate rapid typing in chat, media scrub bar dragging, volume slider adjustment,
 *    opening and switching settings tabs, drag-and-drop hover, text selection, and chips.
 *    Verify that 100% of these states protect against auto-collapse.
 * 3. Rapid expand/collapse cycles:
 *    Cycle expand/collapse 50 times in rapid succession.
 *    Verify zero orphaned timers, zero NaN dimensions, and zero listener leaks.
 */

const path = require('path');
const fs = require('fs');

if (!process.versions.electron) {
  const { spawnSync } = require('child_process');
  const electronPath = require('electron');
  console.log('[Runner] Launching Electron for UX-2 Stress Harness...\n');
  const res = spawnSync(electronPath, [__filename], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

const { app, BrowserWindow } = require('electron');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureLog = [];

function recordTest(desc, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  [PASS] ${desc}${details ? ' - ' + details : ''}`);
  } else {
    failedTests++;
    failureLog.push({ desc, details });
    console.error(`  [FAIL] ${desc}${details ? ' - ' + details : ''}`);
  }
}

app.whenReady().then(async () => {
  try {
    console.log('================================================================');
    console.log('  ROBOISLAND EMPIRICAL ADVERSARIAL STRESS HARNESS (MILESTONE UX-2) ');
    console.log('================================================================\n');

    const rootDir = path.resolve(__dirname, '..');

    const win = new BrowserWindow({
      width: 900,
      height: 500,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <link rel="stylesheet" href="file://${rootDir.replace(/\\/g, '/')}/dist/renderer/island/island.css">
      </head>
      <body>
        <canvas id="island-canvas"></canvas>

        <div id="expanded-island-overlay" class="hidden">
          <header id="island-status-bar">
            <div id="status-left">
              <div id="btn-system-popover" class="status-pills-group">
                <button id="btn-status-wifi"></button>
                <button id="btn-status-bt"></button>
              </div>
              <span id="status-title"></span>
            </div>
            <div id="status-center">
              <div id="mascot-eye-slot"></div>
              <span id="status-datetime"></span>
              <div id="weather-widget">
                <span id="weather-temp">--°C</span>
                <span id="weather-cond">Clear</span>
              </div>
            </div>
            <div id="status-right">
              <button id="btn-phone-quick" class="hidden"></button>
              <div id="status-battery-pill">
                <span id="battery-pct">100%</span>
                <span id="battery-eta">Active</span>
              </div>
              <button id="btn-island-settings"></button>
              <button id="btn-island-close"></button>
            </div>
          </header>

          <main id="island-body">
            <section id="tab-dashboard" class="tab-view active">
              <div id="card-ai-code"><span id="card-ai-status"></span><span id="card-ai-sub"></span></div>
              <div id="card-music"><span id="card-music-title"></span><span id="card-music-sub"></span></div>
              <div id="card-focus"><span id="card-focus-time"></span><span id="card-focus-sub"></span><button id="btn-focus-toggle"></button></div>
            </section>
            <section id="tab-music" class="tab-view hidden">
              <div id="media-scrub-bar" class="media-scrub-bar"></div>
              <input type="range" id="media-vol-slider" class="media-vol-slider" min="0" max="100" value="50">
            </section>
            <section id="tab-chat" class="tab-view hidden">
              <form id="chat-form">
                <input type="text" id="chat-input" placeholder="Ask AI...">
                <select id="chat-provider-select"></select>
                <button type="submit" id="btn-chat-send"></button>
              </form>
              <div id="chat-messages" class="chat-messages"></div>
              <button id="btn-chat-clear"></button>
            </section>
            <section id="tab-tray" class="tab-view hidden">
              <div id="tray-hero-empty"></div>
              <div id="tray-staged-view" class="hidden">
                <span id="tray-files-count"></span>
                <div id="tray-files-shelf" class="tray-shelf"></div>
                <div id="tray-qr-img"></div>
                <span id="tray-qr-url"></span>
              </div>
              <button id="btn-tray-clear"></button>
              <button id="btn-copy-url"></button>
              <button id="btn-open-tray-phone"></button>
            </section>
            <section id="tab-clipboard" class="tab-view hidden">
              <div id="clipboard-list" class="clipboard-list"></div>
              <div id="clipboard-empty"></div>
            </section>
            <section id="tab-system" class="tab-view hidden">
              <div id="tile-wifi"></div>
              <div id="tile-bt"></div>
              <button id="btn-quick-mute"></button>
            </section>
          </main>

          <nav id="island-bottom-nav">
            <button class="nav-tab active" data-tab="dashboard"></button>
            <button class="nav-tab" data-tab="music"></button>
            <button class="nav-tab" data-tab="chat"></button>
            <button class="nav-tab" data-tab="tray"></button>
            <button class="nav-tab" data-tab="clipboard"></button>
            <button class="nav-tab" data-tab="system"></button>
          </nav>
        </div>

        <input type="text" id="island-input" style="display:none;">

        <div id="system-popover" class="system-popover hidden">
          <div id="panel-wifi"><span id="popover-wifi-ssid"></span><div id="row-wifi-toggle"></div></div>
          <div id="panel-bt"><span id="popover-bt-status"></span><div id="row-bt-toggle"></div></div>
        </div>

        <div id="island-context-menu" class="island-context-menu hidden">
          <div id="ctx-hide"></div>
          <div id="ctx-toggle"></div>
          <div id="ctx-settings"></div>
          <div id="ctx-quit"></div>
        </div>

        <div id="drag-drop-overlay" class="drag-drop-overlay hidden"></div>

        <div id="ai-diff-viewer" class="ai-diff-viewer">
          <pre class="ai-diff-content">diff --git a/file.txt b/file.txt</pre>
        </div>
        <div id="ai-task-feed" class="ai-task-feed"></div>

        <script>
          const baseMock = {
            setInteractive: (val) => {},
            notifyModeChanged: (mode) => {},
            getConfig: async () => ({
              clockFormat: '12h',
              restModeEnabled: false,
              expandedUiMode: 'canvas'
            }),
            getMediaState: async () => ({
              active: false,
              playing: false,
              title: '',
              artist: '',
              positionMs: 0,
              durationMs: 0
            }),
            getVolume: async () => ({ level: 65, muted: false }),
            getNetwork: async () => ({
              wifi: { on: true, ssid: 'TestHomeWiFi', bars: 4 },
              bt: { on: true, devices: ['TestAirPods'] }
            }),
            getWeatherData: async () => ({ temp: '22°C', condition: 'Clear' }),
            getSystemMetrics: async () => ({ cpu: 12, ram: 44 }),
            openSettings: (tab) => {},
            trayRemoveFile: async () => {},
            getClipboardHistory: async () => ['Test Clipboard Item 1', 'Test Clipboard Item 2'],
            toggleTuck: () => {},
            hideIsland: () => {},
            showCompact: () => {},
            quit: () => {}
          };
          window.roboIsland = new Proxy(baseMock, {
            get: (target, prop) => {
              if (prop in target) return target[prop];
              if (typeof prop === 'string' && prop.startsWith('on')) {
                return (cb) => () => {};
              }
              return () => {};
            }
          });
        </script>
      </body>
      </html>
    `;

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(testHtml)}`);

    // Initialize CanvasEngine inside the page
    const initRes = await win.webContents.executeJavaScript(`
      (() => {
        try {
          const path = require('path');
          const enginePath = ${JSON.stringify(path.join(rootDir, 'dist', 'renderer', 'island', 'canvas-engine.js'))};
          const { CanvasEngine } = require(enginePath);
          window.__canvasEngine = new CanvasEngine();
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message, stack: e.stack };
        }
      })();
    `);

    if (!initRes.success) {
      console.error('Failed to init CanvasEngine in window:', initRes.error, initRes.stack);
      process.exit(1);
    }

    // =========================================================================
    // SECTION 1: RACE CONDITIONS DURING SPRING EXPANSION
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('SECTION 1: Spring Expansion Hit-Testing Race Conditions');
    console.log('Simulating clicks arriving at t = 0, 50, 100, 150, 200ms');
    console.log('Coordinates: cx + 200, cx - 200, cx + 250, cx - 250');
    console.log('----------------------------------------------------------------');

    const raceResults = await win.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        if (!engine) return { error: 'Engine missing' };

        const results = [];
        const windowWidth = window.innerWidth;
        const cx = windowWidth / 2;
        const topY = engine.isTucked ? 0 : 4;
        const targetW = 520;
        const targetH = 240;

        // Discretized frames corresponding to timestamps (60fps dt ~ 16.67ms)
        const testTimestamps = [
          { tMs: 0, frames: 0 },
          { tMs: 50, frames: 3 },
          { tMs: 100, frames: 6 },
          { tMs: 150, frames: 9 },
          { tMs: 200, frames: 12 }
        ];

        const testOffsets = [
          { name: 'cx + 200', x: cx + 200 },
          { name: 'cx - 200', x: cx - 200 },
          { name: 'cx + 250', x: cx + 250 },
          { name: 'cx - 250', x: cx - 250 }
        ];

        const testYLevels = [
          { name: 'top-bar (topY + 28)', y: topY + 28 },
          { name: 'mid-card (topY + 120)', y: topY + 120 },
          { name: 'bottom-edge (topY + 235)', y: topY + 235 }
        ];

        for (const ts of testTimestamps) {
          // Reset to compact baseline
          engine.collapse();
          engine.currentWidth = 116;
          engine.currentHeight = 36;
          engine.targetWidth = 116;
          engine.targetHeight = 36;

          // Trigger expansion
          engine.expand();

          // Simulate spring physics up to the frame count
          for (let f = 0; f < ts.frames; f++) {
            engine.currentWidth += (engine.targetWidth - engine.currentWidth) * 0.22;
            engine.currentHeight += (engine.targetHeight - engine.currentHeight) * 0.22;
          }

          const currentW = engine.currentWidth;
          const currentH = engine.currentHeight;

          for (const offset of testOffsets) {
            for (const yLevel of testYLevels) {
              const effectiveW = engine.mode === 'expanded' ? Math.max(engine.targetWidth, engine.currentWidth) : engine.currentWidth;
              const effectiveH = engine.mode === 'expanded' ? Math.max(engine.targetHeight, engine.currentHeight) : engine.currentHeight;
              const halfW = effectiveW / 2;

              const inBounds = offset.x >= cx - halfW &&
                               offset.x <= cx + halfW &&
                               yLevel.y >= topY &&
                               yLevel.y <= topY + effectiveH;

              // Fire actual handleClick on engine
              engine.handleClick(offset.x, yLevel.y);

              const modeAfter = engine.getMode();
              const collapsedPrematurely = (modeAfter !== 'expanded');

              results.push({
                tMs: ts.tMs,
                frames: ts.frames,
                currentW: Math.round(currentW),
                currentH: Math.round(currentH),
                effectiveW,
                effectiveH,
                offsetName: offset.name,
                x: offset.x,
                yName: yLevel.name,
                y: yLevel.y,
                inBounds,
                modeAfter,
                collapsedPrematurely
              });
            }
          }
        }

        // Precision Boundary Negative Controls (Points strictly OUTSIDE 520x240 target card)
        const negativeControls = [];
        const outsidePoints = [
          { name: 'outside right (cx + 261)', x: cx + 261, y: topY + 120 },
          { name: 'outside left (cx - 261)', x: cx - 261, y: topY + 120 },
          { name: 'outside bottom (topY + 242)', x: cx, y: topY + 242 },
          { name: 'outside top (topY - 5)', x: cx, y: topY - 5 }
        ];

        for (const opt of outsidePoints) {
          engine.expand();
          engine.currentWidth = 300;
          engine.currentHeight = 150;

          const effectiveW = engine.mode === 'expanded' ? Math.max(engine.targetWidth, engine.currentWidth) : engine.currentWidth;
          const effectiveH = engine.mode === 'expanded' ? Math.max(engine.targetHeight, engine.currentHeight) : engine.currentHeight;
          const halfW = effectiveW / 2;
          const inBounds = opt.x >= cx - halfW && opt.x <= cx + halfW && opt.y >= topY && opt.y <= topY + effectiveH;

          // With canAutoCollapse true, this outside click MUST trigger collapse
          engine.handleClick(opt.x, opt.y);
          const modeAfter = engine.getMode();

          negativeControls.push({
            name: opt.name,
            x: opt.x,
            y: opt.y,
            inBounds,
            modeAfter,
            collapsedCorrectly: (modeAfter === 'compact')
          });
        }

        return { results, negativeControls };
      })();
    `);

    for (const res of raceResults.results) {
      const testName = `t=${res.tMs}ms (w=${res.currentW}px) at ${res.offsetName}, ${res.yName}`;
      const passed = res.inBounds === true && !res.collapsedPrematurely && res.modeAfter === 'expanded';
      recordTest(
        testName,
        passed,
        `inBounds=${res.inBounds}, mode=${res.modeAfter}, effectiveW=${res.effectiveW}px`
      );
    }

    console.log('\n--- Precision Negative Controls (Verifying true outside bounds) ---');
    for (const neg of raceResults.negativeControls) {
      const passed = neg.inBounds === false && neg.collapsedCorrectly;
      recordTest(
        `Genuine outside click collapses island: ${neg.name}`,
        passed,
        `inBounds=${neg.inBounds}, modeAfter=${neg.modeAfter}`
      );
    }

    // =========================================================================
    // SECTION 2: INTERNAL INTERACTION SHIELDS
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 2: Internal Interaction Shields (100% Collapse Protection)');
    console.log('Testing: typing in chat, media scrubbing, volume dragging,');
    console.log('         settings/tabs navigation, drag-drop hover, text selection');
    console.log('----------------------------------------------------------------');

    const shieldResults = await win.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        if (!engine) return { error: 'Engine missing' };

        const shieldTests = [];

        function testShield(name, setup, teardown) {
          engine.expand();
          setup();

          const canCollapse = engine.canAutoCollapse();

          // Attempt outside click while in shielded state
          const cx = window.innerWidth / 2;
          const outsideX = 30;
          const outsideY = 300;
          engine.handleClick(outsideX, outsideY);
          const modeAfterOutsideClick = engine.getMode();

          teardown();

          shieldTests.push({
            name,
            canCollapse,
            shieldActive: !canCollapse,
            preventedCollapse: (modeAfterOutsideClick === 'expanded'),
            modeAfter: modeAfterOutsideClick
          });
        }

        // 1. Rapid typing in chat input (focused)
        const chatInput = document.getElementById('chat-input');
        testShield(
          '1. Rapid typing: focused chat input',
          () => {
            if (chatInput) {
              chatInput.focus();
              chatInput.value = 'Asking AI a question...';
              chatInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          },
          () => {
            if (chatInput) {
              chatInput.value = '';
              chatInput.blur();
            }
          }
        );

        // 2. Chat input containing text while blurred
        testShield(
          '2. Chat input with text while blurred (unfocused drafting)',
          () => {
            if (chatInput) {
              chatInput.value = 'Drafting a prompt...';
              chatInput.blur();
            }
          },
          () => {
            if (chatInput) {
              chatInput.value = '';
            }
          }
        );

        // 3. Media scrub bar dragging
        const scrubBar = document.getElementById('media-scrub-bar');
        testShield(
          '3. Media scrub bar dragging (data-scrubbing="true")',
          () => {
            if (scrubBar) scrubBar.setAttribute('data-scrubbing', 'true');
            window.isMediaScrubbing = true;
          },
          () => {
            if (scrubBar) scrubBar.removeAttribute('data-scrubbing');
            window.isMediaScrubbing = false;
          }
        );

        // 4. Volume slider adjustment
        const volSlider = document.getElementById('media-vol-slider');
        testShield(
          '4. Volume slider dragging (isMediaVolumeDragging)',
          () => {
            window.isMediaVolumeDragging = true;
            if (volSlider) volSlider.focus();
          },
          () => {
            window.isMediaVolumeDragging = false;
            if (volSlider) volSlider.blur();
          }
        );

        // 5. System Popover Open (Wi-Fi / Bluetooth status panel)
        const popover = document.getElementById('system-popover');
        testShield(
          '5. System Popover active (#system-popover open)',
          () => {
            if (popover) popover.classList.remove('hidden');
            engine.activePopover = 'wifi';
          },
          () => {
            if (popover) popover.classList.add('hidden');
            engine.activePopover = 'none';
          }
        );

        // 6. Island Context Menu Open
        const ctxMenu = document.getElementById('island-context-menu');
        testShield(
          '6. Island Context Menu active (#island-context-menu open)',
          () => {
            if (ctxMenu) ctxMenu.classList.remove('hidden');
          },
          () => {
            if (ctxMenu) ctxMenu.classList.add('hidden');
          }
        );

        // 7. Drag-and-drop file hover overlay
        const dropOverlay = document.getElementById('drag-drop-overlay');
        testShield(
          '7. File Drag-and-Drop hover (isDraggingOver & overlay)',
          () => {
            engine.isDraggingOver = true;
            window.isDraggingFiles = true;
            if (dropOverlay) dropOverlay.classList.remove('hidden');
          },
          () => {
            engine.isDraggingOver = false;
            window.isDraggingFiles = false;
            if (dropOverlay) dropOverlay.classList.add('hidden');
          }
        );

        // 8. Switching Settings Tabs (Settings / Tabs interaction)
        testShield(
          '8. Internal interaction class on body (.interacting-internal)',
          () => {
            document.body.classList.add('interacting-internal');
          },
          () => {
            document.body.classList.remove('interacting-internal');
          }
        );

        // 9. Active text selection in diff viewer / messages
        testShield(
          '9. Active text selection (window.getSelection)',
          () => {
            const pre = document.querySelector('.ai-diff-content') || document.body;
            const range = document.createRange();
            range.selectNodeContents(pre);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);
            }
          },
          () => {
            const sel = window.getSelection();
            if (sel) sel.removeAllRanges();
          }
        );

        return { shieldTests };
      })();
    `);

    for (const st of shieldResults.shieldTests) {
      const passed = st.shieldActive && st.preventedCollapse && st.modeAfter === 'expanded';
      recordTest(
        `Interaction Shield: ${st.name}`,
        passed,
        `canCollapse=${st.canCollapse}, preventedCollapse=${st.preventedCollapse}, mode=${st.modeAfter}`
      );
    }

    // =========================================================================
    // SECTION 3: RAPID EXPAND/COLLAPSE CYCLES (50 CYCLES)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 3: Rapid Expand/Collapse Cycles (50 Stress Iterations)');
    console.log('Verifying zero orphaned timers, zero NaN dimensions, zero listener leaks');
    console.log('----------------------------------------------------------------');

    const cycleResults = await win.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        if (!engine) return { error: 'Engine missing' };

        // 1. Setup listener tracking to verify zero leaks
        const listenerStats = {
          added: 0,
          removed: 0
        };

        const origAdd = EventTarget.prototype.addEventListener;
        const origRemove = EventTarget.prototype.removeEventListener;

        EventTarget.prototype.addEventListener = function(type, fn, opts) {
          listenerStats.added++;
          return origAdd.call(this, type, fn, opts);
        };
        EventTarget.prototype.removeEventListener = function(type, fn, opts) {
          listenerStats.removed++;
          return origRemove.call(this, type, fn, opts);
        };

        let anyNanEncountered = false;
        let anyOrphanedTimers = false;

        const CYCLES = 50;

        for (let i = 1; i <= CYCLES; i++) {
          // Rapid Expand
          engine.expand();

          // Step physics frame
          engine.renderLoop(performance.now());

          // Verify dimensions during expand
          const ew = engine.currentWidth;
          const eh = engine.currentHeight;
          const er = engine.currentRadius;
          const etw = engine.targetWidth;
          const eth = engine.targetHeight;
          const etr = engine.targetRadius;

          if (Number.isNaN(ew) || Number.isNaN(eh) || Number.isNaN(er) ||
              Number.isNaN(etw) || Number.isNaN(eth) || Number.isNaN(etr) ||
              !Number.isFinite(ew) || !Number.isFinite(eh) || !Number.isFinite(er)) {
            anyNanEncountered = true;
          }

          // Rapid Collapse
          engine.collapse();

          // Step physics frame
          engine.renderLoop(performance.now() + 16);

          // Verify dimensions during collapse
          const cw = engine.currentWidth;
          const ch = engine.currentHeight;
          const cr = engine.currentRadius;
          const ctw = engine.targetWidth;
          const cth = engine.targetHeight;
          const ctr = engine.targetRadius;

          if (Number.isNaN(cw) || Number.isNaN(ch) || Number.isNaN(cr) ||
              Number.isNaN(ctw) || Number.isNaN(cth) || Number.isNaN(ctr) ||
              !Number.isFinite(cw) || !Number.isFinite(ch) || !Number.isFinite(cr)) {
            anyNanEncountered = true;
          }

          // Check if collapseTimer was improperly left dangling
          if (engine.collapseTimer !== null) {
            anyOrphanedTimers = true;
          }
        }

        // Restore original EventTarget methods
        EventTarget.prototype.addEventListener = origAdd;
        EventTarget.prototype.removeEventListener = origRemove;

        // Final physics settle (45 steps ~ 750ms for complete exponential decay)
        for (let s = 0; s < 45; s++) {
          engine.renderLoop(performance.now() + 16 * s);
        }

        const finalWidth = engine.currentWidth;
        const finalHeight = engine.currentHeight;
        const finalRadius = engine.currentRadius;
        const finalMode = engine.getMode();
        const finalCollapseTimer = engine.collapseTimer;

        return {
          cyclesCompleted: CYCLES,
          anyNanEncountered,
          anyOrphanedTimers,
          finalCollapseTimer,
          finalWidth,
          finalHeight,
          finalRadius,
          finalMode,
          listenerAddedDuringCycles: listenerStats.added,
          listenerRemovedDuringCycles: listenerStats.removed,
          netListenerLeak: listenerStats.added - listenerStats.removed
        };
      })();
    `);

    recordTest(
      '50 rapid expand/collapse cycles completed',
      cycleResults.cyclesCompleted === 50,
      `cycles=${cycleResults.cyclesCompleted}`
    );

    recordTest(
      'Zero NaN or infinite dimensions encountered during 50 cycles',
      !cycleResults.anyNanEncountered,
      `finalWidth=${cycleResults.finalWidth.toFixed(2)}px, finalHeight=${cycleResults.finalHeight.toFixed(2)}px`
    );

    recordTest(
      'Zero orphaned collapse timers during 50 rapid cycles',
      !cycleResults.anyOrphanedTimers && cycleResults.finalCollapseTimer === null,
      `finalTimer=${cycleResults.finalCollapseTimer}`
    );

    recordTest(
      'Zero event listener leaks across 50 expand/collapse cycles',
      cycleResults.netListenerLeak === 0,
      `netAdded=${cycleResults.netListenerLeak} (added=${cycleResults.listenerAddedDuringCycles}, removed=${cycleResults.listenerRemovedDuringCycles})`
    );

    recordTest(
      'Final capsule dimensions cleanly settled to compact baseline (116 x 36 px)',
      Math.abs(cycleResults.finalWidth - 116) < 1.0 && Math.abs(cycleResults.finalHeight - 36) < 1.0,
      `settledWidth=${cycleResults.finalWidth.toFixed(2)}px, settledHeight=${cycleResults.finalHeight.toFixed(2)}px, mode=${cycleResults.finalMode}`
    );

    // =========================================================================
    // FINAL SUMMARY
    // =========================================================================
    console.log('\n================================================================');
    console.log(`STRESS HARNESS SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
    console.log('================================================================\n');

    win.destroy();

    if (failedTests > 0) {
      console.error('[STRESS TEST VERDICT]: FAILED — Failures encountered:');
      failureLog.forEach((f, idx) => console.error(`  ${idx + 1}. ${f.desc} (${f.details})`));
      process.exit(1);
    } else {
      console.log('[STRESS TEST VERDICT]: ALL EMPIRICAL CHALLENGES PASSED SUCCESSFULLY');
      process.exit(0);
    }
  } catch (err) {
    console.error('[Error] Unexpected exception in stress harness:', err);
    process.exit(1);
  }
});
