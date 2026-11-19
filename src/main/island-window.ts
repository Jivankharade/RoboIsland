import { BrowserWindow, ipcMain, screen, app, globalShortcut } from 'electron';
import * as path from 'path';
import { configStore } from './config-store';
import { DisplayManager } from './display-manager';

export class IslandWindow {
  private window: BrowserWindow | null = null;
  private isInteractive = false;
  private isDragging = false;
  private isTucked = false;
  private isLauncherActive = false;
  private currentMode: 'rest' | 'compact' | 'expanded' = 'compact';
  private capsuleBounds: { width: number; height: number; topY: number; isSplit?: boolean; splitSpan?: number } = {
    width: 98,
    height: 26,
    topY: 10,
    isSplit: false,
    splitSpan: 0
  };

  constructor() {
    this.createWindow();
    this.setupIPC();
    this.setupScreenEvents();
  }

  private createWindow(): void {
    const config = configStore.get();
    const pos = DisplayManager.calculatePosition(config.islandScale, config.islandStyle);

    this.cachedBounds = {
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height
    };

    this.window = new BrowserWindow({
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

    this.window.setAlwaysOnTop(true, 'floating');
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
      this.window?.show();
      this.startCursorTracking();
      this.setupGlobalShortcuts();
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

  private cursorTimer: NodeJS.Timeout | null = null;
  private lastCursorKey = '';
  private lastCursorAt = 0;
  private wasInsideWindow = false;
  private cachedBounds: Electron.Rectangle | null = null;
  private lastSentRelX = -9999;
  private lastSentRelY = -9999;
  private lastSentScreenX = -9999;
  private lastSentScreenY = -9999;

  private startCursorTracking(): void {
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    const tick = () => {
      if (!this.window || this.window.isDestroyed() || !this.window.isVisible()) {
        this.cursorTimer = setTimeout(tick, 200);
        return;
      }
      const cursor = screen.getCursorScreenPoint();
      const bounds = this.cachedBounds || (this.cachedBounds = this.window.getBounds());
      const insideWindow = cursor.x >= bounds.x && cursor.x < bounds.x + bounds.width &&
                           cursor.y >= bounds.y && cursor.y < bounds.y + bounds.height;

      // Low-CPU optimization: When outside the window and already reported outside with stationary cursor, avoid redundant IPC spam and back off poll frequency
      if (!insideWindow && !this.wasInsideWindow && Math.abs(cursor.x - this.lastSentScreenX) < 3 && Math.abs(cursor.y - this.lastSentScreenY) < 3 && this.currentMode !== 'expanded' && !this.isInteractive && !this.isLauncherActive) {
        this.cursorTimer = setTimeout(tick, 75);
        return;
      }

      const key = `${cursor.x},${cursor.y},${bounds.x},${bounds.y}`;
      const now = Date.now();
      if (key === this.lastCursorKey && now - this.lastCursorAt < 1000) {
        this.cursorTimer = setTimeout(tick, insideWindow ? 32 : 75);
        return;
      }
      this.lastCursorKey = key;
      this.lastCursorAt = now;

      const config = configStore.get();
      const scale = config.islandScale || 1.0;
      const relX = (cursor.x - bounds.x) / scale;
      const relY = (cursor.y - bounds.y) / scale;
      const cx = (bounds.width / scale) / 2;

      // In expanded or launcher mode, maintain interactive = true
      if (this.currentMode === 'expanded' || this.isLauncherActive || this.isDragging) {
        this.setInteractive(true);
      } else if (this.isTucked) {
        const tuckHalfW = 40;
        const inHoverZone = relX >= (cx - tuckHalfW) && relX <= (cx + tuckHalfW) &&
                            relY >= 0 && relY <= 14;
        this.setInteractive(inHoverZone);
      } else {
        const curW = (this.capsuleBounds.isSplit && this.capsuleBounds.splitSpan)
          ? this.capsuleBounds.splitSpan
          : (this.capsuleBounds.width || (this.currentMode === 'rest' ? 98 : 200));
        const curH = this.capsuleBounds.height || (this.currentMode === 'rest' ? 26 : 36);
        const curTopY = typeof this.capsuleBounds.topY === 'number' ? this.capsuleBounds.topY : 10;
        const halfW = curW / 2;
        // Exact capsule hover zone (+1px subpixel tolerance) - zero dead-zone outside the capsule
        const inHoverZone = relX >= (cx - halfW - 1) && relX <= (cx + halfW + 1) &&
                            relY >= (curTopY - 1) && relY <= (curTopY + curH + 1);
        this.setInteractive(inHoverZone);
      }

      // Avoid redundant IPC when pointer is stationary
      if (insideWindow === this.wasInsideWindow && Math.abs(relX - this.lastSentRelX) < 1.0 && Math.abs(relY - this.lastSentRelY) < 1.0) {
        this.cursorTimer = setTimeout(tick, insideWindow ? 32 : 75);
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
        insideWindow
      });

      this.cursorTimer = setTimeout(tick, insideWindow ? 32 : 75);
    };

    this.cursorTimer = setTimeout(tick, 32);
  }

  public setInteractive(interactive: boolean): void {
    if (!this.window || this.window.isDestroyed()) return;
    // When the island is in expanded mode or launcher is active, maintain setInteractive(true)
    const effectiveInteractive = (this.currentMode === 'expanded' || this.isLauncherActive) ? true : interactive;
    if (this.isInteractive === effectiveInteractive) return;

    this.isInteractive = effectiveInteractive;
    try {
      this.window.setIgnoreMouseEvents(!effectiveInteractive, { forward: true });
    } catch {
      try {
        this.window.setIgnoreMouseEvents(!effectiveInteractive);
      } catch {}
    }
    // Only focus the window in expanded or launcher mode. Never steal OS focus simply on hover in rest/compact mode.
    if (effectiveInteractive && (this.currentMode === 'expanded' || this.isLauncherActive)) {
      try { this.window.focus(); } catch {}
    }
  }

  public reposition(): void {
    if (!this.window || this.window.isDestroyed()) return;
    const config = configStore.get();
    const pos = DisplayManager.calculatePosition(config.islandScale, config.islandStyle);
    const display = DisplayManager.getTargetDisplay();
    
    // When tucked, window docks flush against the screen top bezel (y = display.bounds.y)
    const finalY = this.isTucked ? display.bounds.y : pos.y;
    this.cachedBounds = {
      x: pos.x,
      y: finalY,
      width: pos.width,
      height: pos.height
    };
    this.window.setBounds(this.cachedBounds);
  }

  public setTucked(tucked: boolean): void {
    if (this.isTucked === tucked) return;
    this.isTucked = tucked;
    this.reposition();
    this.window?.webContents.send('island:tucked-state', tucked);
  }

  public getWindow(): BrowserWindow | null {
    return this.window;
  }

  public setOpacity(opacity: number): void {
    if (!this.window || this.window.isDestroyed()) return;
    const num = typeof opacity === 'number' ? opacity : parseFloat(opacity as any);
    const clamped = isNaN(num) ? 1.0 : Math.max(0.1, Math.min(1.0, num));
    this.window.setOpacity(clamped);
    configStore.set('islandOpacity', clamped);
  }

  public setMode(mode: 'rest' | 'compact' | 'expanded'): void {
    this.currentMode = mode;
    if (mode === 'expanded') {
      this.setInteractive(true);
    }
    this.window?.webContents.send('island:set-mode', mode);
  }

  public getMode(): 'rest' | 'compact' | 'expanded' {
    return this.currentMode;
  }

  public getModeBounds(mode: 'rest' | 'compact' | 'expanded'): { width: number; height: number; capsuleWidth: number; capsuleHeight: number } {
    const config = configStore.get();
    if (mode === 'rest') {
      return {
        width: 860,
        height: 340,
        capsuleWidth: config.restCapsuleWidth || 32,
        capsuleHeight: config.restCapsuleHeight || 18
      };
    } else if (mode === 'expanded') {
      return {
        width: 860,
        height: 340,
        capsuleWidth: 520,
        capsuleHeight: 240
      };
    } else {
      return {
        width: 860,
        height: 340,
        capsuleWidth: 300,
        capsuleHeight: 36
      };
    }
  }

  private setupGlobalShortcuts(): void {
    try {
      globalShortcut.register('CommandOrControl+Alt+T', () => {
        if (!this.window || this.window.isDestroyed()) return;
        try {
          const { gameModeManager } = require('./game-mode');
          gameModeManager?.setOverride(true);
        } catch {}
        if (this.isTucked) {
          this.setTucked(false);
          return;
        }
        if (!this.window.isVisible()) {
          this.window.show();
          this.window.webContents.send('island:collapse');
        } else {
          this.window.webContents.send('island:toggle-expand');
        }
      });

      // TwoCode shortcuts-main.cjs parity: Ctrl+Alt+H tucks island away / back
      globalShortcut.register('CommandOrControl+Alt+H', () => {
        if (!this.window || this.window.isDestroyed()) return;
        this.setTucked(!this.isTucked);
      });

      const config = configStore.get();
      const restHotkey = config.restHotkey || 'CommandOrControl+Alt+R';
      globalShortcut.register(restHotkey, () => {
        if (!this.window || this.window.isDestroyed()) return;
        if (this.currentMode === 'rest') {
          this.setMode('compact');
        } else {
          this.setMode('rest');
        }
      });

      // Apple Speedometer Telemetry HUD pop shortcut (Ctrl+Alt+S)
      globalShortcut.register('CommandOrControl+Alt+S', () => {
        if (!this.window || this.window.isDestroyed()) return;
        this.window.webContents.send('island:show-speedometer-hud');
      });

      // Universal Spotlight / Raycast Launcher shortcut (Alt+Space with CommandOrControl+Space fallback) per R2
      try {
        const regAltSpace = globalShortcut.register('Alt+Space', () => {
          this.toggleLauncherShortcut();
        });
        if (!regAltSpace) {
          globalShortcut.register('CommandOrControl+Space', () => {
            this.toggleLauncherShortcut();
          });
        }
      } catch (err) {
        console.warn('[IslandWindow] Failed to register Alt+Space launcher shortcut:', err);
        try {
          globalShortcut.register('CommandOrControl+Space', () => {
            this.toggleLauncherShortcut();
          });
        } catch {}
      }
    } catch (err) {
      console.warn('[IslandWindow] Failed to register global shortcut:', err);
    }
  }

  public toggleLauncherShortcut(): void {
    if (!this.window || this.window.isDestroyed()) return;
    if (this.isTucked) {
      this.setTucked(false);
    }
    if (!this.window.isVisible()) {
      this.window.show();
    }
    try {
      this.window.focus();
    } catch {}
    this.window.webContents.send('island:toggle-launcher');
  }

  private setupScreenEvents(): void {
    screen.on('display-metrics-changed', () => this.reposition());
    screen.on('display-added', () => this.reposition());
    screen.on('display-removed', () => this.reposition());
  }

  private setupIPC(): void {
    ipcMain.on('island:set-interactive', (_event, interactive: boolean) => {
      this.setInteractive(interactive);
    });

    ipcMain.on('island:set-launcher-active', (_event, active: boolean) => {
      this.isLauncherActive = Boolean(active);
      if (this.isLauncherActive) {
        this.setInteractive(true);
        try { this.window?.focus(); } catch {}
      } else if (this.currentMode !== 'expanded') {
        this.setInteractive(false);
      }
    });

    ipcMain.on('island:capsule-bounds', (_event, bounds: { width: number; height: number; topY: number; isSplit?: boolean; splitSpan?: number }) => {
      if (bounds && typeof bounds.width === 'number') {
        this.capsuleBounds = bounds;
      }
    });

    ipcMain.on('island:focus', () => {
      try {
        if (this.window && !this.window.isDestroyed()) {
          this.window.focus();
        }
      } catch {}
    });

    ipcMain.on('island:set-dragging', (_event, dragging: boolean) => {
      this.isDragging = !!dragging;
      if (this.isDragging) {
        this.setInteractive(true);
      }
    });

    ipcMain.on('island:hide', () => {
      this.window?.hide();
    });

    ipcMain.on('island:show-compact', () => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.show();
        this.window.webContents.send('island:collapse');
      }
    });

    ipcMain.on('island:quit', () => {
      app.quit();
    });

    ipcMain.on('island:set-tucked', (_event, tucked: boolean) => {
      this.setTucked(Boolean(tucked));
    });

    ipcMain.on('island:toggle-tuck', () => {
      this.setTucked(!this.isTucked);
    });

    ipcMain.handle('island:get-config', () => {
      return configStore.get();
    });

    ipcMain.handle('island:update-config', (_event, partial) => {
      configStore.update(partial);
      if (typeof partial.islandOpacity === 'number') {
        this.setOpacity(partial.islandOpacity);
      }
      this.reposition();
      return configStore.get();
    });

    ipcMain.handle('island:set-opacity', (_event, opacity: number) => {
      this.setOpacity(opacity);
      return configStore.get().islandOpacity;
    });

    ipcMain.handle('island:get-displays', () => {
      return DisplayManager.getAllDisplays();
    });

    ipcMain.handle('island:set-display', (_event, displayId: string) => {
      configStore.set('selectedDisplayId', displayId);
      this.reposition();
      return true;
    });

    ipcMain.handle('island:set-mode', (_event, mode: 'rest' | 'compact' | 'expanded') => {
      this.setMode(mode);
      return this.currentMode;
    });

    ipcMain.handle('island:get-mode', () => {
      return this.currentMode;
    });

    ipcMain.handle('island:get-mode-bounds', (_event, mode: 'rest' | 'compact' | 'expanded') => {
      return this.getModeBounds(mode);
    });

    ipcMain.on('island:mode-changed', (_event, mode: 'rest' | 'compact' | 'expanded') => {
      this.currentMode = mode;
      if (mode === 'expanded') {
        this.setInteractive(true);
      } else {
        this.setInteractive(false);
      }
    });
  }
}
