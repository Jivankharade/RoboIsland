import { BrowserWindow, ipcMain, screen } from 'electron';
import { configStore } from './config-store';

export interface CinemaState {
  isCinemaMode: boolean;
  activeApp: string;
  activeTitle: string;
  isForegroundFullscreen: boolean;
  detectedReason: 'player' | 'streaming' | 'fullscreen' | 'smtc' | 'none';
  targetLanguage: string;
  subtitlePosition: 'bottom' | 'top';
  subtitleFontSize: 'small' | 'medium' | 'large';
  timestamp: number;
}

export const KNOWN_VIDEO_PLAYERS: string[] = [
  'vlc',
  'vlc.exe',
  'mpv',
  'mpv.exe',
  'potplayer',
  'potplayer64',
  'potplayermini',
  'potplayermini64',
  'kmplayer',
  'kmplayer.exe',
  'stremio',
  'stremio.exe',
  'plex',
  'plexmediaplayer',
  'netflix',
  'netflix.exe',
  'kodi',
  'kodi.exe',
  'wmplayer',
  'wmplayer.exe',
  'quicktime',
  'iina'
];

export const STREAMING_KEYWORDS: string[] = [
  'netflix',
  'prime video',
  'amazon prime',
  'disney+',
  'hotstar',
  'disney+ hotstar',
  'crunchyroll',
  'hulu',
  'hbo max',
  'max.com',
  'youtube',
  'peacock',
  'apple tv',
  'paramount+',
  'twitch.tv'
];

export const VIDEO_EXTENSIONS: string[] = [
  '.mkv',
  '.mp4',
  '.avi',
  '.mov',
  '.webm',
  '.flv',
  '.wmv',
  '.m4v'
];

export class CinemaDetector {
  private static instance: CinemaDetector;
  private state: CinemaState = {
    isCinemaMode: false,
    activeApp: '',
    activeTitle: '',
    isForegroundFullscreen: false,
    detectedReason: 'none',
    targetLanguage: 'en',
    subtitlePosition: 'bottom',
    subtitleFontSize: 'medium',
    timestamp: Date.now()
  };

  private pollTimer: NodeJS.Timeout | null = null;
  private isAutoDetectEnabled = true;

  constructor() {
    const cfg = configStore.get();
    this.isAutoDetectEnabled = cfg.cinemaAutoDetect !== false;
    this.state.targetLanguage = cfg.subtitleLanguage || 'en';
    this.state.subtitlePosition = cfg.subtitlePosition || 'bottom';
    this.state.subtitleFontSize = cfg.subtitleFontSize || 'medium';
    this.setupIPC();
  }

  public static getInstance(): CinemaDetector {
    if (!CinemaDetector.instance) {
      CinemaDetector.instance = new CinemaDetector();
    }
    return CinemaDetector.instance;
  }

  public static matchesVideoApp(processOrPath: string): boolean {
    if (!processOrPath) return false;
    const lower = processOrPath.toLowerCase().trim();
    return KNOWN_VIDEO_PLAYERS.some((p) => lower.includes(p));
  }

  public static matchesVideoTitle(title: string): boolean {
    if (!title) return false;
    const lower = title.toLowerCase().trim();
    if (STREAMING_KEYWORDS.some((kw) => lower.includes(kw))) {
      return true;
    }
    if (VIDEO_EXTENSIONS.some((ext) => lower.includes(ext))) {
      return true;
    }
    return false;
  }

  /**
   * Pure evaluation function for automated unit testing and real-time state calculation.
   */
  public static evaluateCinemaState(
    windowTitle: string,
    processName: string,
    isFullscreen: boolean,
    isMediaPlaying: boolean,
    smtcMediaType?: string
  ): { isCinema: boolean; reason: 'player' | 'streaming' | 'fullscreen' | 'smtc' | 'none' } {
    // 1. Explicit SMTC Video Session
    if (smtcMediaType === 'Video' && isMediaPlaying) {
      return { isCinema: true, reason: 'smtc' };
    }

    // 2. Dedicated Video Player Process
    if (CinemaDetector.matchesVideoApp(processName)) {
      return { isCinema: true, reason: 'player' };
    }

    // 3. Streaming Site Window Title
    if (CinemaDetector.matchesVideoTitle(windowTitle)) {
      return { isCinema: true, reason: 'streaming' };
    }

    // 4. Fullscreen Video Session
    if (isFullscreen && isMediaPlaying) {
      return { isCinema: true, reason: 'fullscreen' };
    }

    return { isCinema: false, reason: 'none' };
  }

  /**
   * Called by FocusGuard / MediaEngine whenever front process or media changes.
   */
  public updateForegroundContext(
    title: string,
    app: string,
    isFullscreen = false,
    isMediaPlaying = false,
    smtcMediaType?: string
  ): void {
    if (!this.isAutoDetectEnabled) return;

    const evaluation = CinemaDetector.evaluateCinemaState(
      title,
      app,
      isFullscreen,
      isMediaPlaying,
      smtcMediaType
    );

    const changed =
      this.state.isCinemaMode !== evaluation.isCinema ||
      this.state.activeTitle !== title ||
      this.state.activeApp !== app;

    this.state.isCinemaMode = evaluation.isCinema;
    this.state.activeTitle = title;
    this.state.activeApp = app;
    this.state.isForegroundFullscreen = isFullscreen;
    this.state.detectedReason = evaluation.reason;
    this.state.timestamp = Date.now();

    if (changed) {
      this.broadcastState();
    }
  }

  public getState(): CinemaState {
    return { ...this.state };
  }

  public setAutoDetect(enabled: boolean): void {
    this.isAutoDetectEnabled = enabled;
    configStore.set('cinemaAutoDetect', enabled);
    if (!enabled && this.state.isCinemaMode) {
      this.state.isCinemaMode = false;
      this.state.detectedReason = 'none';
      this.broadcastState();
    }
  }

  public setTargetLanguage(lang: string): void {
    this.state.targetLanguage = lang;
    configStore.set('subtitleLanguage', lang);
    this.broadcastState();
  }

  public setPosition(pos: 'bottom' | 'top'): void {
    this.state.subtitlePosition = pos;
    configStore.set('subtitlePosition', pos);
    this.broadcastState();
  }

  public setFontSize(size: 'small' | 'medium' | 'large'): void {
    this.state.subtitleFontSize = size;
    configStore.set('subtitleFontSize', size);
    this.broadcastState();
  }

  private broadcastState(): void {
    if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('cinema:state-changed', this.state);
        }
      });
    }
  }

  private setupIPC(): void {
    if (!ipcMain || typeof ipcMain.handle !== 'function') return;

    ipcMain.handle('cinema:get-state', () => this.getState());

    ipcMain.handle('cinema:set-auto-detect', (_event, enabled: boolean) => {
      this.setAutoDetect(enabled);
      return { success: true, enabled };
    });

    ipcMain.handle('cinema:set-language', (_event, lang: string) => {
      this.setTargetLanguage(lang);
      return { success: true, lang };
    });

    ipcMain.handle('cinema:set-position', (_event, pos: 'bottom' | 'top') => {
      this.setPosition(pos);
      return { success: true, pos };
    });

    ipcMain.handle('cinema:set-font-size', (_event, size: 'small' | 'medium' | 'large') => {
      this.setFontSize(size);
      return { success: true, size };
    });
  }
}

export const cinemaDetector = CinemaDetector.getInstance();
