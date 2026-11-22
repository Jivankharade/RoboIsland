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
    // Game mode removed: do not run any polling timers or background detection
  }

  public handleFullscreenEvent(_inGame: boolean, _stateCode = 1): void {
    // Game mode removed: island remains permanently visible as overlay
    this.inGame = false;
    this.lastStateCode = 1;
  }

  public setIslandWindow(win: any): void {
    this.targetIslandWindow = win;
  }

  public getState(): GameModeState {
    return {
      enabled: false,
      inGame: false,
      stateCode: 1,
      throttledFps: 60,
      override: true,
      islandDisplayId: 'primary'
    };
  }

  public setOverride(override: boolean): void {
    this.override = override;
  }

  public toggleOverride(): void {
    this.setOverride(!this.override);
  }

  /**
   * Game mode removed: always resolves inGame: false with zero process spawning.
   */
  public async detectFullscreenGame(): Promise<{ inGame: boolean; stateCode: number }> {
    return { inGame: false, stateCode: 1 };
  }

  public async poll(): Promise<void> {
    // Game mode removed: zero polling
    this.inGame = false;
    this.lastStateCode = 1;
  }

  private applyVisibility(): void {
    // Game mode removed: never hide the island window
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

  public start(_intervalMs: number = 30000): void {
    // Game mode removed: no timer created
    this.stop();
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
