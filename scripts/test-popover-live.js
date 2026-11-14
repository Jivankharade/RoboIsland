const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

console.log('====================================================');
console.log('    ROBOISLAND SYSTEM POPOVER VERIFICATION SUITE   ');
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

const screenshotsDir = 'C:\\Users\\hp218\\.gemini\\antigravity\\brain\\9abe3be8-3aab-400c-9097-bd04add116ad';

app.whenReady().then(async () => {
  try {
    console.log('--- 1. Launching Island Electron Window ---');
    const win = new BrowserWindow({
      width: 600,
      height: 300,
      show: true,
      frame: false,
      transparent: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    win.webContents.on('console-message', (e, level, message) => {
      console.log(`[RENDERER LOG ${level}]: ${message}`);
    });

    const indexPath = path.join(__dirname, '..', 'dist', 'renderer', 'island', 'index.html');
    await win.loadFile(indexPath);
    assert('Island Window Loaded', true);

    // Wait for DOM & canvas engine initialization
    await new Promise(r => setTimeout(r, 600));

    // Capture screenshot helper
    async function capture(filename) {
      const img = await win.webContents.capturePage();
      const targetPath = path.join(screenshotsDir, filename);
      fs.writeFileSync(targetPath, img.toPNG());
      console.log(`[CAPTURE] Saved screenshot: ${filename}`);
      return targetPath;
    }

    // REQUIREMENT 1 & 2: Startup initialization — Popovers CLOSED by default
    console.log('\n--- 2. Testing Req 1 & 2: Closed by Default on Startup ---');
    const initStatus = await win.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        const popover = document.getElementById('system-popover');
        const panelWifi = document.getElementById('popover-panel-wifi');
        const panelBt = document.getElementById('popover-panel-bt');
        const btnWifi = document.getElementById('btn-status-wifi');
        const btnBt = document.getElementById('btn-status-bt');
        const popoverStyle = window.getComputedStyle(popover);

        return {
          activePopover: engine.activePopover,
          popoverHasHidden: popover.classList.contains('hidden'),
          wifiHasHidden: panelWifi.classList.contains('hidden'),
          btHasHidden: panelBt.classList.contains('hidden'),
          popoverDisplay: popoverStyle.display,
          wifiBtnActive: btnWifi.classList.contains('active'),
          btBtnActive: btnBt.classList.contains('active')
        };
      })()
    `);

    assert('Active popover is "none" at startup', initStatus.activePopover === 'none');
    assert('Popover element has "hidden" class', initStatus.popoverHasHidden === true);
    assert('Popover computed display is "none"', initStatus.popoverDisplay === 'none');
    assert('Wi-Fi panel has "hidden" class', initStatus.wifiHasHidden === true);
    assert('Bluetooth panel has "hidden" class', initStatus.btHasHidden === true);
    assert('Status bar Wi-Fi button not active', initStatus.wifiBtnActive === false);
    assert('Status bar Bluetooth button not active', initStatus.btBtnActive === false);

    // REQUIREMENT: Device Status Independence (Wi-Fi connected / BT active != popover open)
    console.log('\n--- 3. Testing Device Status Independence (Connected != Open) ---');
    const statusIndependence = await win.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        // Simulate active network update
        engine.netState.wifiOn = true;
        engine.netState.ssid = 'Office_5G';
        engine.netState.btOn = true;
        engine.netState.btDevice = 'AirPods Pro';
        engine.updateNetworkDom();

        const popover = document.getElementById('system-popover');
        const popoverStyle = window.getComputedStyle(popover);
        const tileWifi = document.getElementById('tile-wifi');
        const tileBt = document.getElementById('tile-bt');
        const wifiSsid = document.getElementById('popover-wifi-ssid');
        const btStatus = document.getElementById('popover-bt-status');

        return {
          popoverHidden: popover.classList.contains('hidden'),
          popoverDisplay: popoverStyle.display,
          tileWifiActive: tileWifi.classList.contains('active'),
          tileBtActive: tileBt.classList.contains('active'),
          wifiSsidText: wifiSsid ? wifiSsid.textContent : '',
          btStatusText: btStatus ? btStatus.textContent : ''
        };
      })()
    `);

    assert('Device status updated correctly for Wi-Fi', statusIndependence.wifiSsidText === 'Office_5G');
    assert('Device status updated correctly for Bluetooth', statusIndependence.btStatusText === 'AirPods Pro');
    assert('Popover remains strictly hidden when network active', statusIndependence.popoverHidden === true && statusIndependence.popoverDisplay === 'none');

    // REQUIREMENT 3: Expanding Island does NOT automatically open popover
    console.log('\n--- 4. Testing Req 3: Island Expansion Leaves Popover Closed ---');
    const expandStatus = await win.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        engine.expand();

        const overlay = document.getElementById('expanded-island-overlay');
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';

        const popover = document.getElementById('system-popover');
        const popoverStyle = window.getComputedStyle(popover);

        return {
          mode: engine.mode,
          activePopover: engine.activePopover,
          popoverHidden: popover.classList.contains('hidden'),
          popoverDisplay: popoverStyle.display
        };
      })()
    `);

    assert('Island expanded successfully', expandStatus.mode === 'expanded');
    assert('Active popover remains "none" after expansion', expandStatus.activePopover === 'none');
    assert('Popover remains hidden after expansion', expandStatus.popoverHidden === true && expandStatus.popoverDisplay === 'none');

    await new Promise(r => setTimeout(r, 200));
    await capture('popover_fix_expanded_dashboard.png');

    // REQUIREMENT: Tab switching (Chat tab does NOT open popover, contrasts with bug screenshot)
    console.log('\n--- 5. Testing Tab Switch to Chat / AI (Popover Must NOT Cover Chat) ---');
    const chatTabStatus = await win.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        engine.showDomTab('chat');

        const chatPanel = document.getElementById('panel-chat');
        const popover = document.getElementById('system-popover');
        const popoverStyle = window.getComputedStyle(popover);

        return {
          chatActive: chatPanel.classList.contains('active'),
          activePopover: engine.activePopover,
          popoverHidden: popover.classList.contains('hidden'),
          popoverDisplay: popoverStyle.display
        };
      })()
    `);

    assert('Chat panel activated', chatTabStatus.chatActive === true);
    assert('Popover remains strictly closed on Chat tab', chatTabStatus.activePopover === 'none' && chatTabStatus.popoverHidden === true && chatTabStatus.popoverDisplay === 'none');

    await new Promise(r => setTimeout(r, 200));
    await capture('popover_fix_chat_tab_clean.png');

    // Switch back to home
    await win.webContents.executeJavaScript(`window.__canvasEngine.showDomTab('home');`);

    // REQUIREMENT 4: Clicking Wi-Fi opens Wi-Fi panel ONLY
    console.log('\n--- 6. Testing Req 4: Clicking Wi-Fi Icon Opens Only Wi-Fi Panel ---');
    const wifiClickStatus = await win.webContents.executeJavaScript(`
      (() => {
        const btnWifi = document.getElementById('btn-status-wifi');
        btnWifi.click();

        const engine = window.__canvasEngine;
        const popover = document.getElementById('system-popover');
        const panelWifi = document.getElementById('popover-panel-wifi');
        const panelBt = document.getElementById('popover-panel-bt');
        const popoverStyle = window.getComputedStyle(popover);
        const wifiStyle = window.getComputedStyle(panelWifi);
        const btStyle = window.getComputedStyle(panelBt);

        return {
          activePopover: engine.activePopover,
          popoverDisplay: popoverStyle.display,
          wifiDisplay: wifiStyle.display,
          btDisplay: btStyle.display,
          wifiHidden: panelWifi.classList.contains('hidden'),
          btHidden: panelBt.classList.contains('hidden'),
          btnWifiActive: btnWifi.classList.contains('active')
        };
      })()
    `);

    assert('Active popover is "wifi"', wifiClickStatus.activePopover === 'wifi');
    assert('Popover container displayed (flex)', wifiClickStatus.popoverDisplay === 'flex');
    assert('Wi-Fi panel displayed (flex)', wifiClickStatus.wifiDisplay === 'flex');
    assert('Bluetooth panel hidden (display: none)', wifiClickStatus.btDisplay === 'none' && wifiClickStatus.btHidden === true);
    assert('Wi-Fi button has active class', wifiClickStatus.btnWifiActive === true);

    await new Promise(r => setTimeout(r, 200));
    await capture('popover_wifi_panel_open.png');

    // REQUIREMENT 5 & 7: Clicking Bluetooth icon opens Bluetooth panel ONLY and closes Wi-Fi (Only ONE at a time)
    console.log('\n--- 7. Testing Req 5 & 7: Switching to Bluetooth (Only One Open at a Time) ---');
    const btClickStatus = await win.webContents.executeJavaScript(`
      (() => {
        const btnBt = document.getElementById('btn-status-bt');
        btnBt.click();

        const engine = window.__canvasEngine;
        const popover = document.getElementById('system-popover');
        const panelWifi = document.getElementById('popover-panel-wifi');
        const panelBt = document.getElementById('popover-panel-bt');
        const btnWifi = document.getElementById('btn-status-wifi');
        const popoverStyle = window.getComputedStyle(popover);
        const wifiStyle = window.getComputedStyle(panelWifi);
        const btStyle = window.getComputedStyle(panelBt);

        return {
          activePopover: engine.activePopover,
          popoverDisplay: popoverStyle.display,
          wifiDisplay: wifiStyle.display,
          btDisplay: btStyle.display,
          wifiHidden: panelWifi.classList.contains('hidden'),
          btHidden: panelBt.classList.contains('hidden'),
          btnWifiActive: btnWifi.classList.contains('active'),
          btnBtActive: btnBt.classList.contains('active')
        };
      })()
    `);

    assert('Active popover switched to "bt"', btClickStatus.activePopover === 'bt');
    assert('Bluetooth panel displayed (flex)', btClickStatus.btDisplay === 'flex');
    assert('Wi-Fi panel hidden (display: none)', btClickStatus.wifiDisplay === 'none' && btClickStatus.wifiHidden === true);
    assert('Wi-Fi button is no longer active', btClickStatus.btnWifiActive === false);
    assert('Bluetooth button is active', btClickStatus.btnBtActive === true);

    await new Promise(r => setTimeout(r, 200));
    await capture('popover_bt_panel_open.png');

    // REQUIREMENT 6: Clicking an already-open icon closes its panel
    console.log('\n--- 8. Testing Req 6: Toggle Off When Clicking Already-Open Icon ---');
    const toggleOffStatus = await win.webContents.executeJavaScript(`
      (() => {
        const btnBt = document.getElementById('btn-status-bt');
        btnBt.click(); // Click BT again to toggle off

        const engine = window.__canvasEngine;
        const popover = document.getElementById('system-popover');
        const popoverStyle = window.getComputedStyle(popover);

        return {
          activePopover: engine.activePopover,
          popoverHidden: popover.classList.contains('hidden'),
          popoverDisplay: popoverStyle.display,
          btnBtActive: btnBt.classList.contains('active')
        };
      })()
    `);

    assert('Active popover is "none" after second click', toggleOffStatus.activePopover === 'none');
    assert('Popover closed and hidden', toggleOffStatus.popoverHidden === true && toggleOffStatus.popoverDisplay === 'none');
    assert('Bluetooth button active class removed', toggleOffStatus.btnBtActive === false);

    // REQUIREMENT 8: Outside click closes the active popover
    console.log('\n--- 9. Testing Req 8: Outside Click Closes Active Popover ---');
    const outsideClickStatus = await win.webContents.executeJavaScript(`
      (() => {
        // Open Wi-Fi first
        const btnWifi = document.getElementById('btn-status-wifi');
        btnWifi.click();

        const beforeClickActive = window.__canvasEngine.activePopover;

        // Click outside on the card-music element
        const cardMusic = document.getElementById('card-music');
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: 300,
          clientY: 100
        });
        (cardMusic || window).dispatchEvent(clickEvent);

        const engine = window.__canvasEngine;
        const popover = document.getElementById('system-popover');
        const popoverStyle = window.getComputedStyle(popover);

        return {
          beforeClickActive,
          afterClickActive: engine.activePopover,
          popoverHidden: popover.classList.contains('hidden'),
          popoverDisplay: popoverStyle.display
        };
      })()
    `);

    assert('Wi-Fi opened prior to outside click', outsideClickStatus.beforeClickActive === 'wifi');
    assert('Outside click reset activePopover to "none"', outsideClickStatus.afterClickActive === 'none');
    assert('Popover hidden after outside click', outsideClickStatus.popoverHidden === true && outsideClickStatus.popoverDisplay === 'none');

    await new Promise(r => setTimeout(r, 200));
    await capture('popover_after_outside_click.png');

    // REQUIREMENT 9: Pressing Escape closes the active popover
    console.log('\n--- 10. Testing Req 9: Escape Key Closes Active Popover ---');
    const escapeStatus = await win.webContents.executeJavaScript(`
      (() => {
        // Open BT
        const btnBt = document.getElementById('btn-status-bt');
        btnBt.click();
        const beforeEscapeActive = window.__canvasEngine.activePopover;

        // Press Escape
        const escapeEvent = new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(escapeEvent);

        const engine = window.__canvasEngine;
        const popover = document.getElementById('system-popover');
        const popoverStyle = window.getComputedStyle(popover);

        return {
          beforeEscapeActive,
          afterEscapeActive: engine.activePopover,
          popoverHidden: popover.classList.contains('hidden'),
          popoverDisplay: popoverStyle.display,
          islandMode: engine.mode
        };
      })()
    `);

    assert('Bluetooth opened prior to Escape', escapeStatus.beforeEscapeActive === 'bt');
    assert('Escape reset activePopover to "none"', escapeStatus.afterEscapeActive === 'none');
    assert('Popover hidden after Escape', escapeStatus.popoverHidden === true && escapeStatus.popoverDisplay === 'none');
    assert('Island remains expanded on first Escape (only popover closes)', escapeStatus.islandMode === 'expanded');

    await new Promise(r => setTimeout(r, 200));
    await capture('popover_after_escape_key.png');

    // REQUIREMENT 10: Closing / reopening Island resets popover state
    console.log('\n--- 11. Testing Req 10: Collapse & Re-Expand Reset Popover State ---');
    const reopenStatus = await win.webContents.executeJavaScript(`
      (() => {
        const engine = window.__canvasEngine;
        // Open Wi-Fi
        document.getElementById('btn-status-wifi').click();

        // Collapse island
        engine.collapse();
        const collapseActive = engine.activePopover;

        // Re-expand island
        engine.expand();
        const expandActive = engine.activePopover;
        const popover = document.getElementById('system-popover');
        const popoverStyle = window.getComputedStyle(popover);

        return {
          collapseActive,
          expandActive,
          popoverHidden: popover.classList.contains('hidden'),
          popoverDisplay: popoverStyle.display
        };
      })()
    `);

    assert('Active popover reset to "none" on collapse', reopenStatus.collapseActive === 'none');
    assert('Active popover remains "none" on re-expand', reopenStatus.expandActive === 'none');
    assert('Popover element remains hidden on re-expand', reopenStatus.popoverHidden === true && reopenStatus.popoverDisplay === 'none');

    await new Promise(r => setTimeout(r, 200));
    await capture('popover_after_reopen.png');

    // Summary
    console.log('\n====================================================');
    console.log(`POPOVER TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    win.destroy();
    app.quit();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    app.quit();
    process.exit(1);
  }
});
