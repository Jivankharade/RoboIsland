"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameModeManager = exports.GameModeManager = exports.UserNotificationState = void 0;
exports.isFullScreenNotificationState = isFullScreenNotificationState;
exports.isGameMode = isGameMode;
exports.shouldHideForGame = shouldHideForGame;
exports.checkForegroundBoundsMatch = checkForegroundBoundsMatch;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const config_store_1 = require("./config-store");
var UserNotificationState;
(function (UserNotificationState) {
    UserNotificationState[UserNotificationState["QUNS_NOT_PRESENT"] = 1] = "QUNS_NOT_PRESENT";
    UserNotificationState[UserNotificationState["QUNS_BUSY"] = 2] = "QUNS_BUSY";
    UserNotificationState[UserNotificationState["QUNS_RUNNING_D3D_FULL_SCREEN"] = 3] = "QUNS_RUNNING_D3D_FULL_SCREEN";
    UserNotificationState[UserNotificationState["QUNS_PRESENTATION_MODE"] = 4] = "QUNS_PRESENTATION_MODE";
    UserNotificationState[UserNotificationState["QUNS_ACCEPTS_NOTIFICATIONS"] = 5] = "QUNS_ACCEPTS_NOTIFICATIONS";
    UserNotificationState[UserNotificationState["QUNS_QUIET_TIME"] = 6] = "QUNS_QUIET_TIME";
    UserNotificationState[UserNotificationState["QUNS_APP"] = 7] = "QUNS_APP";
})(UserNotificationState || (exports.UserNotificationState = UserNotificationState = {}));
/**
 * Checks if a Win32 user notification state code indicates an exclusive fullscreen game.
 * State 3 (QUNS_RUNNING_D3D_FULL_SCREEN) represents exclusive 3D fullscreen games.
 * State 2 (QUNS_BUSY) represents busy desktop applications (such as WhatsApp, PowerPoint,
 * video calls, or focus assist) and must NEVER auto-hide the Dynamic Island.
 */
function isFullScreenNotificationState(stateCode) {
    return stateCode === 3;
}
/**
 * Maps state code to game mode boolean.
 * Only exclusive 3D games (code 3) trigger game mode.
 */
function isGameMode(code) {
    return code === 3;
}
/**
 * Multi-display boundary check:
 * Fullscreen on secondary display should NOT hide the island on the primary display.
 */
function shouldHideForGame(gameDisplayId, islandDisplayId) {
    return gameDisplayId === islandDisplayId;
}
/**
 * Checks whether foreground window bounds cover the primary or target display.
 */
function checkForegroundBoundsMatch(winBounds, displayBounds) {
    return (winBounds.x <= displayBounds.x &&
        winBounds.y <= displayBounds.y &&
        winBounds.width >= displayBounds.width &&
        winBounds.height >= displayBounds.height);
}
/**
 * GameModeManager: Detects fullscreen games and automatically manages Dynamic Island visibility.
 */
class GameModeManager {
    timer = null;
    pollIntervalMs = 30000;
    inGame = false;
    lastStateCode = 1;
    override = false;
    targetIslandWindow = null;
    isChecking = false;
    constructor(islandWindowInstance) {
        this.targetIslandWindow = islandWindowInstance;
        this.setupIPC();
        this.start();
    }
    handleFullscreenEvent(inGame, stateCode = inGame ? 3 : 1) {
        const changed = inGame !== this.inGame || stateCode !== this.lastStateCode;
        this.inGame = inGame;
        this.lastStateCode = stateCode;
        if (changed) {
            this.applyVisibility();
            this.broadcastState();
        }
    }
    setIslandWindow(win) {
        this.targetIslandWindow = win;
    }
    getState() {
        const config = config_store_1.configStore.get();
        return {
            enabled: Boolean(config.gameModeEnabled),
            inGame: this.inGame,
            stateCode: this.lastStateCode,
            throttledFps: this.inGame && !this.override ? 0 : 60,
            override: this.override,
            islandDisplayId: config.selectedDisplayId || 'primary'
        };
    }
    setOverride(override) {
        this.override = override;
        this.applyVisibility();
        this.broadcastState();
    }
    toggleOverride() {
        this.setOverride(!this.override);
    }
    /**
     * Queries Windows SHQueryUserNotificationState or foreground window bounds.
     */
    async detectFullscreenGame() {
        if (process.platform !== 'win32') {
            return { inGame: false, stateCode: 1 };
        }
        return new Promise((resolve) => {
            // Execute fast Win32 P/Invoke query via powershell
            const psCommand = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32Shell {
          [DllImport("shell32.dll")]
          public static extern int SHQueryUserNotificationState(out int pquns);
        }
"@ -ErrorAction SilentlyContinue
        $state = 0
        [Win32Shell]::SHQueryUserNotificationState([ref]$state) | Out-Null
        Write-Output $state
      `;
            try {
                const child = (0, child_process_1.spawn)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
                    windowsHide: true,
                    timeout: 2000
                });
                let output = '';
                child.stdout?.on('data', (data) => { output += data.toString(); });
                child.on('close', (code) => {
                    if (code === 0) {
                        const parsed = parseInt(output.trim(), 10);
                        if (!isNaN(parsed)) {
                            resolve({ inGame: isGameMode(parsed), stateCode: parsed });
                            return;
                        }
                    }
                    // Fallback if P/Invoke failed
                    resolve({ inGame: false, stateCode: 1 });
                });
                child.on('error', () => {
                    resolve({ inGame: false, stateCode: 1 });
                });
            }
            catch {
                resolve({ inGame: false, stateCode: 1 });
            }
        });
    }
    async poll() {
        if (this.isChecking)
            return;
        this.isChecking = true;
        try {
            const config = config_store_1.configStore.get();
            if (!config.gameModeEnabled) {
                if (this.inGame) {
                    this.inGame = false;
                    this.applyVisibility();
                    this.broadcastState();
                }
                return;
            }
            const result = await this.detectFullscreenGame();
            const changed = result.inGame !== this.inGame || result.stateCode !== this.lastStateCode;
            this.lastStateCode = result.stateCode;
            this.inGame = result.inGame;
            if (changed) {
                this.applyVisibility();
                this.broadcastState();
            }
        }
        finally {
            this.isChecking = false;
        }
    }
    applyVisibility() {
        const config = config_store_1.configStore.get();
        if (!config.gameModeEnabled)
            return;
        const win = this.targetIslandWindow?.getWindow
            ? this.targetIslandWindow.getWindow()
            : this.targetIslandWindow;
        if (!win || win.isDestroyed())
            return;
        if (this.inGame && !this.override) {
            // Fullscreen active: Auto-hide island
            if (win.isVisible()) {
                win.hide();
            }
        }
        else {
            // Game exited or override enabled: Restore island
            if (!win.isVisible()) {
                win.show();
            }
        }
    }
    broadcastState() {
        const state = this.getState();
        try {
            if (!electron_1.BrowserWindow || typeof electron_1.BrowserWindow.getAllWindows !== 'function')
                return;
            const windows = electron_1.BrowserWindow.getAllWindows();
            for (const win of windows) {
                if (!win.isDestroyed()) {
                    win.webContents.send('gamemode:state-changed', state);
                }
            }
        }
        catch { }
    }
    start(intervalMs = 2500) {
        if (this.timer)
            clearInterval(this.timer);
        this.pollIntervalMs = Math.max(1000, intervalMs);
        this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
        if (this.timer && typeof this.timer.unref === 'function') {
            this.timer.unref();
        }
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    dispose() {
        this.stop();
    }
    setupIPC() {
        if (!electron_1.ipcMain || typeof electron_1.ipcMain.handle !== 'function')
            return;
        try {
            electron_1.ipcMain.removeHandler('gamemode:get-state');
        }
        catch { }
        electron_1.ipcMain.handle('gamemode:get-state', () => {
            return this.getState();
        });
        try {
            electron_1.ipcMain.removeHandler('gamemode:set-enabled');
        }
        catch { }
        electron_1.ipcMain.handle('gamemode:set-enabled', (_event, enabled) => {
            config_store_1.configStore.set('gameModeEnabled', Boolean(enabled));
            this.applyVisibility();
            this.broadcastState();
            return this.getState();
        });
        try {
            electron_1.ipcMain.removeHandler('gamemode:toggle-override');
        }
        catch { }
        electron_1.ipcMain.handle('gamemode:toggle-override', () => {
            this.toggleOverride();
            return this.getState();
        });
    }
}
exports.GameModeManager = GameModeManager;
exports.gameModeManager = new GameModeManager();
