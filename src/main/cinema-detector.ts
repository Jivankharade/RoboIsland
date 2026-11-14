import { BrowserWindow, ipcMain, screen } from 'electron';
import { configStore } from './config-store';

export type CinemaReason = 'player' | 'streaming' | 'browser' | 'fullscreen' | 'smtc' | 'generic_video' | 'none';

export interface CinemaState {
  isCinemaMode: boolean;
  activeApp: string;
  activeTitle: string;
  isForegroundFullscreen: boolean;
  detectedReason: CinemaReason;
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
  'iina',
  'mpc-hc',
  'mpc-be',
  'zunevideo',
  'movies & tv',
  'films & tv'
];

export const KNOWN_BROWSER_APPS: string[] = [
  'chrome',
  'google chrome',
  'chrome.exe',
  'msedge',
  'edge',
  'msedge.exe',
  'firefox',
  'firefox.exe',
  'brave',
  'brave.exe',
  'opera',
  'opera.exe',
  'opera gx',
  'vivaldi',
  'vivaldi.exe',
  'arc',
  'arc.exe',
  'chromium',
  'chromium.exe',
  'waterfox',
  'librewolf',
  'sidekick',
  'zen',
  'browser'
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
  'youtu.be',
  'peacock',
  'apple tv',
  'paramount+',
  'twitch',
  'twitch.tv',
  'dailymotion',
  'vimeo',
  'bilibili',
  'sflix',
  'fmovies',
  '123movies',
  'putlocker',
  'gogoanime',
  '9anime',
  'aniwatch',
  'zoro.to',
  'hianime',
  'animepahe',
  'kick.com',
  'rumble.com',
  'streamtape',
  'doodstream',
  'vidcloud',
  'upcloud',
  'megacloud'
];

export const VIDEO_TITLE_PATTERNS: string[] = [
  'episode',
  'ep.',
  'season',
  's0',
  'e0',
  'full movie',
  'official video',
  'official trailer',
  'teaser',
  'clip',
  'scene',
  'comedy',
  'live stream',
  'stream',
  'watch online',
  '1080p',
  '720p',
  '4k',
  'web-dl',
  'webrip',
  'bluray',
  'camrip'
];

export const VIDEO_EXTENSIONS: string[] = [
  '.mkv',
  '.mp4',
  '.avi',
  '.mov',
  '.webm',
  '.flv',
  '.wmv',
  '.m4v',
  '.ts',
  '.m2ts',
  '.3gp'
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

  public static matchesBrowserApp(processOrPath: string): boolean {
    if (!processOrPath) return false;
    const lower = processOrPath.toLowerCase().trim();
    return KNOWN_BROWSER_APPS.some((b) => lower.includes(b));
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
    if (VIDEO_TITLE_PATTERNS.some((pat) => lower.includes(pat))) {
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
  ): { isCinema: boolean; reason: CinemaReason } {
    const app = (processName || '').toLowerCase().trim();
    const title = (windowTitle || '').toLowerCase().trim();

    // 1. Explicit SMTC Video Session
    if (smtcMediaType === 'Video' && isMediaPlaying) {
      return { isCinema: true, reason: 'smtc' };
    }

    // 2. Dedicated Video Player Process
    if (CinemaDetector.matchesVideoApp(app)) {
      return { isCinema: true, reason: 'player' };
    }

    // 3. Known Streaming Domain, Video Keyword, or Video File Title
    if (CinemaDetector.matchesVideoTitle(title)) {
      return { isCinema: true, reason: 'streaming' };
    }

    // 4. Any Web Browser Playing Media (YouTube, Chrome, Edge, 3rd party streaming websites)
    if (CinemaDetector.matchesBrowserApp(app) && isMediaPlaying) {
      return { isCinema: true, reason: 'browser' };
    }

    // 5. Fullscreen Video Session
    if (isFullscreen && isMediaPlaying) {
      return { isCinema: true, reason: 'fullscreen' };
    }

    // 6. Generic Video/Media Playback (non-music app)
    if (isMediaPlaying && app && !app.includes('spotify') && !app.includes('applemusic') && !app.includes('itunes')) {
      return { isCinema: true, reason: 'generic_video' };
    }

    return { isCinema: false, reason: 'none' };
  }

  private lastPromptSession = '';

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

    const sessionKey = `${app}|${title}`;
    const isNewVideoSession = evaluation.isCinema && isMediaPlaying && sessionKey !== this.lastPromptSession;

    this.state.isCinemaMode = evaluation.isCinema;
    this.state.activeTitle = title;
    this.state.activeApp = app;
    this.state.isForegroundFullscreen = isFullscreen;
    this.state.detectedReason = evaluation.reason;
    this.state.timestamp = Date.now();

    if (changed) {
      this.broadcastState();
    }

    if (isNewVideoSession) {
      this.lastPromptSession = sessionKey;
      this.broadcastSubtitlePrompt({
        title,
        app,
        reason: evaluation.reason,
        targetLanguage: this.state.targetLanguage || 'en',
        sourceLang: 'en'
      });
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

  public broadcastSubtitlePrompt(promptData: {
    title: string;
    app: string;
    reason: CinemaReason;
    targetLanguage: string;
    sourceLang: string;
  }): void {
    if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('cinema:prompt-subtitles', promptData);
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

    ipcMain.handle('cinema:trigger-prompt-check', () => {
      if (this.state.isCinemaMode) {
        this.broadcastSubtitlePrompt({
          title: this.state.activeTitle,
          app: this.state.activeApp,
          reason: this.state.detectedReason,
          targetLanguage: this.state.targetLanguage || 'en',
          sourceLang: 'en'
        });
      }
      return { success: true, isCinema: this.state.isCinemaMode };
    });
  }
}

export const cinemaDetector = CinemaDetector.getInstance();
