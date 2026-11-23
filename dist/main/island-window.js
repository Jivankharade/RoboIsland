"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IslandWindow = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const config_store_1 = require("./config-store");
const display_manager_1 = require("./display-manager");
class IslandWindow {
    window = null;
    isInteractive = false;
    isDragging = false;
    isTucked = false;
    isLauncherActive = false;
    isModalActive = false;
    currentMode = 'compact';
    capsuleBounds = {
        width: 200,
        height: 36,
        topY: 0,
        isSplit: false,
        splitSpan: 0
    };
    constructor() {
        this.createWindow();
        this.setupIPC();
        this.setupScreenEvents();
    }
    createWindow() {
        const config = config_store_1.configStore.get();
        const pos = display_manager_1.DisplayManager.calculatePosition(config.islandScale, config.islandStyle);
        this.cachedBounds = {
            x: pos.x,
            y: pos.y,
            width: pos.width,
            height: pos.height
        };
        this.window = new electron_1.BrowserWindow({
            x: pos.x,
            y: pos.y,
            width: pos.width,
            height: pos.height,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            resizable: false,
            movable: false,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            skipTaskbar: true,
            alwaysOnTop: true,
            focusable: true,
            hasShadow: false,
            show: false,
            webPreferences: {
                preload: path.join(__dirname, '../preload/island-preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                backgroundThrottling: false
            }
        });
        // Set highest priority screen-saver topmost level so island overlays WhatsApp and all apps seamlessly
        this.window.setAlwaysOnTop(true, 'screen-saver', 1);
        this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        // Initial click-through mode
        this.setInteractive(false);
        if (typeof config.islandOpacity === 'number') {
            const num = config.islandOpacity;
            this.window.setOpacity(Math.max(0.1, Math.min(1.0, num)));
        }
        // Renderer HTML path
        const htmlPath = path.join(__dirname, '../renderer/island/index.html');
        this.window.loadFile(htmlPath);
        this.window.once('ready-to-show', () => {
            this.reposition();
            this.window?.show();
            this.reposition();
            this.ensureTopmost();
            this.startCursorTracking();
            this.setupGlobalShortcuts();
        });
        this.window.on('move', () => {
            if (this.window && !this.window.isDestroyed()) {
                this.cachedBounds = this.window.getBounds();
            }
        });
        this.window.on('resize', () => {
            if (this.window && !this.window.isDestroyed()) {
                this.cachedBounds = this.window.getBounds();
            }
        });
        this.window.on('blur', () => {
            if (this.currentMode === 'expanded') {
                this.window?.webContents.send('island:request-collapse');
            }
        });
        this.window.on('closed', () => {
            if (this.cursorTimer) {
                clearInterval(this.cursorTimer);
                this.cursorTimer = null;
            }
            this.window = null;
        });
    }
    cursorTimer = null;
    lastCursorKey = '';
    lastCursorAt = 0;
    wasInsideWindow = false;
    cachedBounds = null;
    lastBoundsCheckAt = 0;
    lastTopmostCheckAt = 0;
    lastSentRelX = -9999;
    lastSentRelY = -9999;
    lastSentScreenX = -9999;
    lastSentScreenY = -9999;
    startCursorTracking() {
        if (this.cursorTimer)
            clearTimeout(this.cursorTimer);
        const tick = () => {
            if (!this.window || this.window.isDestroyed() || !this.window.isVisible()) {
                this.cursorTimer = setTimeout(tick, 200);
                return;
            }
            const cursor = electron_1.screen.getCursorScreenPoint();
            if (!this.cachedBounds || performance.now() - this.lastBoundsCheckAt > 1000) {
                this.lastBoundsCheckAt = performance.now();
                try {
                    this.cachedBounds = this.window.getBounds();
                }
                catch { }
            }
            const bounds = this.cachedBounds || this.window.getBounds();
            const insideWindow = cursor.x >= bounds.x && cursor.x < bounds.x + bounds.width &&
                cursor.y >= bounds.y && cursor.y < bounds.y + bounds.height;
            const config = config_store_1.configStore.get();
            const scale = config.islandScale || 1.0;
            const relX = (cursor.x - bounds.x) / scale;
            const relY = (cursor.y - bounds.y) / scale;
            const cx = (bounds.width / scale) / 2;
            // In expanded, launcher, dragging, or modal mode, maintain interactive = true
            let inHoverZone = false;
            if (this.currentMode === 'expanded' || this.isLauncherActive || this.isDragging || this.isModalActive) {
                inHoverZone = true;
            }
            else if (this.isTucked) {
                const tuckHalfW = 40;
                inHoverZone = relX >= (cx - tuckHalfW) && relX <= (cx + tuckHalfW) &&
                    relY >= 0 && relY <= 14;
            }
            else {
                const curW = (this.capsuleBounds.isSplit && this.capsuleBounds.splitSpan)
                    ? this.capsuleBounds.splitSpan
                    : (this.capsuleBounds.width || (this.currentMode === 'rest' ? 98 : 200));
                const curH = this.capsuleBounds.height || (this.currentMode === 'rest' ? 26 : 36);
                const curTopY = typeof this.capsuleBounds.topY === 'number' ? this.capsuleBounds.topY : (config.islandStyle === 'notch' ? 0 : 6);
                const halfW = curW / 2;
                // Exact capsule hover zone (+2px subpixel tolerance) - zero dead-zone outside the capsule
                const minY = config.islandStyle === 'notch' ? 0 : Math.max(0, curTopY - 2);
                const maxY = curTopY + curH + 2;
                inHoverZone = relX >= (cx - halfW - 2) && relX <= (cx + halfW + 2) &&
                    relY >= minY && relY <= maxY;
            }
            this.setInteractive(inHoverZone);
            const deltaScreen = Math.abs(cursor.x - this.lastSentScreenX) + Math.abs(cursor.y - this.lastSentScreenY);
            // Low-CPU optimization: When outside the window and already outside
            if (!insideWindow && !this.wasInsideWindow) {
                if (deltaScreen < 2 && this.currentMode !== 'expanded' && !this.isLauncherActive && !this.isModalActive) {
                    this.cursorTimer = setTimeout(tick, 32);
                    return;
                }
            }
            // Avoid redundant IPC when pointer is stationary (moved less than 1.5px) and hover state didn't change
            if (deltaScreen < 1.5 && insideWindow === this.wasInsideWindow && inHoverZone === this.isInteractive) {
                this.cursorTimer = setTimeout(tick, 32);
                return;
            }
            this.wasInsideWindow = insideWindow;
            this.lastSentRelX = relX;
            this.lastSentRelY = relY;
            this.lastSentScreenX = cursor.x;
            this.lastSentScreenY = cursor.y;
            this.window.webContents.send('companion:pointer', {
                x: relX,
                y: relY,
                insideWindow: inHoverZone
            });
            this.cursorTimer = setTimeout(tick, 32);
        };
        this.cursorTimer = setTimeout(tick, 32);
    }
    setInteractive(interactive) {
        if (!this.window || this.window.isDestroyed())
            return;
        // When the island is in expanded mode, launcher is active, or modal is active, maintain setInteractive(true)
        const effectiveInteractive = (this.currentMode === 'expanded' || this.isLauncherActive || this.isModalActive) ? true : interactive;
        if (this.isInteractive === effectiveInteractive)
            return;
        this.isInteractive = effectiveInteractive;
        try {
            if (process.platform === 'win32') {
                // On Windows, pass ONLY boolean to avoid installing low-level WH_MOUSE_LL hook.
                // Pure setIgnoreMouseEvents(!effectiveInteractive) uses native WS_EX_TRANSPARENT (0% CPU, 0 lag).
                this.window.setIgnoreMouseEvents(!effectiveInteractive);
            }
            else if (process.platform === 'linux') {
                // On Linux / Wayland / KDE Plasma, pure boolean avoids pointer forward protocol crashes
                this.window.setIgnoreMouseEvents(!effectiveInteractive);
            }
            else {
                this.window.setIgnoreMouseEvents(!effectiveInteractive, { forward: true });
            }
        }
        catch {
            try {
                this.window.setIgnoreMouseEvents(!effectiveInteractive);
            }
            catch { }
        }
        // Only focus the window in expanded, launcher, or modal mode. Never steal OS focus simply on hover in rest/compact mode.
        if (effectiveInteractive && (this.currentMode === 'expanded' || this.isLauncherActive || this.isModalActive)) {
            try {
                this.window.focus();
            }
            catch { }
        }
    }
    /**
     * Enforces highest Z-level topmost overlay so Island remains visible
     * even over foreground WinUI / UWP desktop apps like WhatsApp, Chrome, or Settings.
     */
    ensureTopmost() {
        if (!this.window || this.window.isDestroyed())
            return;
        try {
            this.window.setAlwaysOnTop(true, 'screen-saver', 1);
        }
        catch { }
    }
    reposition() {
        if (!this.window || this.window.isDestroyed())
            return;
        const config = config_store_1.configStore.get();
        const pos = display_manager_1.DisplayManager.calculatePosition(config.islandScale, config.islandStyle);
        const display = display_manager_1.DisplayManager.getTargetDisplay();
        // When tucked, window docks flush against the screen top bezel (y = display.bounds.y)
        const finalY = this.isTucked ? display.bounds.y : pos.y;
        this.cachedBounds = {
            x: pos.x,
            y: finalY,
            width: pos.width,
            height: pos.height
        };
        this.window.setBounds(this.cachedBounds);
        this.ensureTopmost();
    }
    setTucked(tucked) {
        if (this.isTucked === tucked)
            return;
        this.isTucked = tucked;
        this.reposition();
        this.window?.webContents.send('island:tucked-state', tucked);
    }
    getWindow() {
        return this.window;
    }
    setOpacity(opacity) {
        if (!this.window || this.window.isDestroyed())
            return;
        const num = typeof opacity === 'number' ? opacity : parseFloat(opacity);
        const clamped = isNaN(num) ? 1.0 : Math.max(0.1, Math.min(1.0, num));
        this.window.setOpacity(clamped);
        config_store_1.configStore.set('islandOpacity', clamped);
    }
    setMode(mode) {
        this.currentMode = mode;
        if (mode === 'expanded') {
            this.setInteractive(true);
        }
        this.window?.webContents.send('island:set-mode', mode);
    }
    getMode() {
        return this.currentMode;
    }
    getModeBounds(mode) {
        const config = config_store_1.configStore.get();
        if (mode === 'rest') {
            return {
                width: 860,
                height: 340,
                capsuleWidth: config.restCapsuleWidth || 32,
                capsuleHeight: config.restCapsuleHeight || 18
            };
        }
        else if (mode === 'expanded') {
            return {
                width: 860,
                height: 340,
                capsuleWidth: 520,
                capsuleHeight: 240
            };
        }
        else {
            return {
                width: 860,
                height: 340,
                capsuleWidth: 300,
                capsuleHeight: 36
            };
        }
    }
    setupGlobalShortcuts() {
        try {
            electron_1.globalShortcut.register('CommandOrControl+Alt+T', () => {
                if (!this.window || this.window.isDestroyed())
                    return;
                if (this.isTucked) {
                    this.setTucked(false);
                    return;
                }
                if (!this.window.isVisible()) {
                    this.window.show();
                    this.window.webContents.send('island:collapse');
                }
                else {
                    this.window.webContents.send('island:toggle-expand');
                }
            });
            // TwoCode shortcuts-main.cjs parity: Ctrl+Alt+H tucks island away / back
            electron_1.globalShortcut.register('CommandOrControl+Alt+H', () => {
                if (!this.window || this.window.isDestroyed())
                    return;
                this.setTucked(!this.isTucked);
            });
            const config = config_store_1.configStore.get();
            const restHotkey = config.restHotkey || 'CommandOrControl+Alt+R';
            electron_1.globalShortcut.register(restHotkey, () => {
                if (!this.window || this.window.isDestroyed())
                    return;
                if (this.currentMode === 'rest') {
                    this.setMode('compact');
                }
                else {
                    this.setMode('rest');
                }
            });
            // Apple Speedometer Telemetry HUD pop shortcut (Ctrl+Alt+S)
            electron_1.globalShortcut.register('CommandOrControl+Alt+S', () => {
                if (!this.window || this.window.isDestroyed())
                    return;
                this.window.webContents.send('island:show-speedometer-hud');
            });
            // Universal Spotlight / Raycast Launcher shortcut
            // Note: 'Alt+Space' is removed because on Fedora Linux (and KDE Plasma), Alt+Space is natively
            // bound to KRunner. Removing Alt+Space prevents hijacking or conflicting with Fedora's native runner.
            // We use CommandOrControl+Shift+Space (Ctrl+Shift+Space) and CommandOrControl+Space instead.
            try {
                electron_1.globalShortcut.register('CommandOrControl+Shift+Space', () => {
                    this.toggleLauncherShortcut();
                });
                electron_1.globalShortcut.register('CommandOrControl+Space', () => {
                    this.toggleLauncherShortcut();
                });
            }
            catch (err) {
                console.warn('[IslandWindow] Failed to register launcher shortcut:', err);
            }
        }
        catch (err) {
            console.warn('[IslandWindow] Failed to register global shortcut:', err);
        }
    }
    toggleLauncherShortcut() {
        if (!this.window || this.window.isDestroyed())
            return;
        if (this.isTucked) {
            this.setTucked(false);
        }
        if (!this.window.isVisible()) {
            this.window.show();
        }
        try {
            this.window.focus();
        }
        catch { }
        this.window.webContents.send('island:toggle-launcher');
    }
    setupScreenEvents() {
        electron_1.screen.on('display-metrics-changed', () => this.reposition());
        electron_1.screen.on('display-added', () => this.reposition());
        electron_1.screen.on('display-removed', () => this.reposition());
    }
    setupIPC() {
        electron_1.ipcMain.on('island:set-interactive', (_event, interactive) => {
            this.setInteractive(interactive);
        });
        electron_1.ipcMain.on('island:set-launcher-active', (_event, active) => {
            this.isLauncherActive = Boolean(active);
            if (this.isLauncherActive) {
                this.setInteractive(true);
                try {
                    this.window?.focus();
                }
                catch { }
            }
            else if (this.currentMode !== 'expanded' && !this.isModalActive) {
                this.setInteractive(false);
            }
        });
        electron_1.ipcMain.on('island:set-modal-active', (_event, active) => {
            this.isModalActive = Boolean(active);
            if (this.isModalActive) {
                this.setInteractive(true);
                try {
                    if (this.window && !this.window.isDestroyed()) {
                        this.window.focus();
                    }
                }
                catch { }
            }
            else if (this.currentMode !== 'expanded' && !this.isLauncherActive) {
                this.setInteractive(false);
            }
        });
        electron_1.ipcMain.on('island:capsule-bounds', (_event, bounds) => {
            if (bounds && typeof bounds.width === 'number') {
                this.capsuleBounds = bounds;
            }
        });
        electron_1.ipcMain.on('island:focus', () => {
            try {
                if (this.window && !this.window.isDestroyed()) {
                    this.ensureTopmost();
                    this.window.focus();
                }
            }
            catch { }
        });
        electron_1.ipcMain.on('island:set-dragging', (_event, dragging) => {
            this.isDragging = !!dragging;
            if (this.isDragging) {
                this.setInteractive(true);
            }
        });
        electron_1.ipcMain.on('island:hide', () => {
            this.window?.hide();
        });
        electron_1.ipcMain.on('island:show-compact', () => {
            if (this.window && !this.window.isDestroyed()) {
                this.ensureTopmost();
                this.window.show();
                this.window.webContents.send('island:collapse');
            }
        });
        electron_1.ipcMain.on('island:quit', () => {
            electron_1.app.quit();
        });
        electron_1.ipcMain.on('island:set-tucked', (_event, tucked) => {
            this.setTucked(Boolean(tucked));
        });
        electron_1.ipcMain.on('island:toggle-tuck', () => {
            this.setTucked(!this.isTucked);
        });
        electron_1.ipcMain.handle('island:get-config', () => {
            return config_store_1.configStore.get();
        });
        electron_1.ipcMain.handle('island:update-config', (_event, partial) => {
            config_store_1.configStore.update(partial);
            if (typeof partial.islandOpacity === 'number') {
                this.setOpacity(partial.islandOpacity);
            }
            this.reposition();
            return config_store_1.configStore.get();
        });
        electron_1.ipcMain.handle('island:set-opacity', (_event, opacity) => {
            this.setOpacity(opacity);
            return config_store_1.configStore.get().islandOpacity;
        });
        electron_1.ipcMain.handle('island:get-displays', () => {
            return display_manager_1.DisplayManager.getAllDisplays();
        });
        electron_1.ipcMain.handle('island:set-display', (_event, displayId) => {
            config_store_1.configStore.set('selectedDisplayId', displayId);
            this.reposition();
            return true;
        });
        electron_1.ipcMain.handle('island:set-mode', (_event, mode) => {
            this.setMode(mode);
            return this.currentMode;
        });
        electron_1.ipcMain.handle('island:get-mode', () => {
            return this.currentMode;
        });
        electron_1.ipcMain.handle('island:get-mode-bounds', (_event, mode) => {
            return this.getModeBounds(mode);
        });
        electron_1.ipcMain.on('island:mode-changed', (_event, mode) => {
            this.currentMode = mode;
            if (mode === 'expanded' || this.isLauncherActive || this.isModalActive) {
                this.setInteractive(true);
            }
            else {
                this.setInteractive(false);
            }
        });
    }
}
exports.IslandWindow = IslandWindow;
