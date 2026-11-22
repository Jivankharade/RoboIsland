import { BrowserWindow, ipcMain, screen } from 'electron';
import { spawn } from 'child_process';
import { configStore } from './config-store';

export enum UserNotificationState {
  QUNS_NOT_PRESENT = 1,
  QUNS_BUSY = 2,
  QUNS_RUNNING_D3D_FULL_SCREEN = 3,
  QUNS_PRESENTATION_MODE = 4,
  QUNS_ACCEPTS_NOTIFICATIONS = 5,
  QUNS_QUIET_TIME = 6,
  QUNS_APP = 7
}

export interface GameModeState {
  enabled: boolean;
  inGame: boolean;
  stateCode: number;
  throttledFps: number;
  override: boolean;
  gameDisplayId?: string;
  islandDisplayId?: string;
}

/**
 * Checks if a Win32 user notification state code indicates an exclusive fullscreen game.
 * State 3 (QUNS_RUNNING_D3D_FULL_SCREEN) represents exclusive 3D fullscreen games.
 * State 2 (QUNS_BUSY) represents busy desktop applications (such as WhatsApp, PowerPoint,
 * video calls, or focus assist) and must NEVER auto-hide the Dynamic Island.
 */
export function isFullScreenNotificationState(stateCode: number): boolean {
  return stateCode === 3;
}

/**
 * Maps state code to game mode boolean.
 * Only exclusive 3D games (code 3) trigger game mode.
 */
export function isGameMode(code: number): boolean {
  return code === 3;
}

/**
 * Multi-display boundary check:
 * Fullscreen on secondary display should NOT hide the island on the primary display.
 */
export function shouldHideForGame(gameDisplayId: string, islandDisplayId: string): boolean {
  return gameDisplayId === islandDisplayId;
}

/**
 * Checks whether foreground window bounds cover the primary or target display.
 */
export function checkForegroundBoundsMatch(
  winBounds: { x: number; y: number; width: number; height: number },
  displayBounds: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    winBounds.x <= displayBounds.x &&
    winBounds.y <= displayBounds.y &&
    winBounds.width >= displayBounds.width &&
    winBounds.height >= displayBounds.height
  );
}

/**
 * GameModeManager: Detects fullscreen games and automatically manages Dynamic Island visibility.
 */
export class GameModeManager {
  private timer: NodeJS.Timeout | null = null;
  private pollIntervalMs: number = 30000;
  private inGame: boolean = false;
  private lastStateCode: number = 1;
  private override: boolean = false;
  private targetIslandWindow: any = null;
  private isChecking: boolean = false;

  constructor(islandWindowInstance?: any) {
    this.targetIslandWindow = islandWindowInstance;
    this.setupIPC();
    this.start();
  }

  public handleFullscreenEvent(inGame: boolean, stateCode = inGame ? 3 : 1): void {
    const changed = inGame !== this.inGame || stateCode !== this.lastStateCode;
    this.inGame = inGame;
    this.lastStateCode = stateCode;
    if (changed) {
      this.applyVisibility();
      this.broadcastState();
    }
  }

  public setIslandWindow(win: any): void {
    this.targetIslandWindow = win;
  }

  public getState(): GameModeState {
    const config = configStore.get();
    return {
      enabled: Boolean(config.gameModeEnabled),
      inGame: this.inGame,
      stateCode: this.lastStateCode,
      throttledFps: this.inGame && !this.override ? 0 : 60,
      override: this.override,
      islandDisplayId: config.selectedDisplayId || 'primary'
    };
  }

  public setOverride(override: boolean): void {
    this.override = override;
    this.applyVisibility();
    this.broadcastState();
  }

  public toggleOverride(): void {
    this.setOverride(!this.override);
  }

  /**
   * Queries Windows SHQueryUserNotificationState or foreground window bounds.
   */
  public async detectFullscreenGame(): Promise<{ inGame: boolean; stateCode: number }> {
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
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
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
      } catch {
        resolve({ inGame: false, stateCode: 1 });
      }
    });
  }

  public async poll(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const config = configStore.get();
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
    } finally {
      this.isChecking = false;
    }
  }

  private applyVisibility(): void {
    const config = configStore.get();
    if (!config.gameModeEnabled) return;

    const win = this.targetIslandWindow?.getWindow
      ? this.targetIslandWindow.getWindow()
      : this.targetIslandWindow;

    if (!win || win.isDestroyed()) return;

    if (this.inGame && !this.override) {
      // Fullscreen active: Auto-hide island
      if (win.isVisible()) {
        win.hide();
      }
    } else {
      // Game exited or override enabled: Restore island
      if (!win.isVisible()) {
        win.show();
      }
    }
  }

  public broadcastState(): void {
    const state = this.getState();
    try {
      if (!BrowserWindow || typeof BrowserWindow.getAllWindows !== 'function') return;
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('gamemode:state-changed', state);
        }
      }
    } catch {}
  }

  public start(intervalMs: number = 2500): void {
    if (this.timer) clearInterval(this.timer);
    this.pollIntervalMs = Math.max(1000, intervalMs);
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public dispose(): void {
    this.stop();
  }

  private setupIPC(): void {
    if (!ipcMain || typeof ipcMain.handle !== 'function') return;
    try {
      ipcMain.removeHandler('gamemode:get-state');
    } catch {}
    ipcMain.handle('gamemode:get-state', () => {
      return this.getState();
    });

    try {
      ipcMain.removeHandler('gamemode:set-enabled');
    } catch {}
    ipcMain.handle('gamemode:set-enabled', (_event, enabled: boolean) => {
      configStore.set('gameModeEnabled', Boolean(enabled));
      this.applyVisibility();
      this.broadcastState();
      return this.getState();
    });

    try {
      ipcMain.removeHandler('gamemode:toggle-override');
    } catch {}
    ipcMain.handle('gamemode:toggle-override', () => {
      this.toggleOverride();
      return this.getState();
    });
  }
}

export const gameModeManager = new GameModeManager();
