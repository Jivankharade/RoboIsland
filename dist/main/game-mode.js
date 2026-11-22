"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameModeManager = exports.GameModeManager = exports.UserNotificationState = void 0;
exports.isFullScreenNotificationState = isFullScreenNotificationState;
exports.isGameMode = isGameMode;
exports.shouldHideForGame = shouldHideForGame;
exports.checkForegroundBoundsMatch = checkForegroundBoundsMatch;
const electron_1 = require("electron");
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
        // Game mode removed: do not run any polling timers or background detection
    }
    handleFullscreenEvent(_inGame, _stateCode = 1) {
        // Game mode removed: island remains permanently visible as overlay
        this.inGame = false;
        this.lastStateCode = 1;
    }
    setIslandWindow(win) {
        this.targetIslandWindow = win;
    }
    getState() {
        return {
            enabled: false,
            inGame: false,
            stateCode: 1,
            throttledFps: 60,
            override: true,
            islandDisplayId: 'primary'
        };
    }
    setOverride(override) {
        this.override = override;
    }
    toggleOverride() {
        this.setOverride(!this.override);
    }
    /**
     * Game mode removed: always resolves inGame: false with zero process spawning.
     */
    async detectFullscreenGame() {
        return { inGame: false, stateCode: 1 };
    }
    async poll() {
        // Game mode removed: zero polling
        this.inGame = false;
        this.lastStateCode = 1;
    }
    applyVisibility() {
        // Game mode removed: never hide the island window
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
    start(_intervalMs = 30000) {
        // Game mode removed: no timer created
        this.stop();
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
