import { spawn, exec, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { BrowserWindow, ipcMain, app, net } from 'electron';
import { SpotifyPKCEClient } from './spotify-pkce';
import { configStore, RoboIslandConfig } from './config-store';

export interface MediaState {
  source: 'spotify' | 'smtc' | 'none';
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  supportsControls: boolean;
}

export interface MediaTrackState extends MediaState {
  active: boolean;
  app?: string;
  playing: boolean;
  coverUrl?: string;
}

export interface LyricLine {
  timeMs: number;
  t?: number;
  text: string;
}

export interface SystemVolumeState {
  level: number;
  muted: boolean;
}

export interface SystemNetState {
  wifi?: { on: boolean; ssid?: string; bars?: number };
  bt?: { on: boolean; devices?: string[] };
  wired?: boolean;
}

export class MediaEngine {
  private child: ChildProcess | null = null;
  private spotifyClient: SpotifyPKCEClient;

  // Active Source Tracker: 'spotify' | 'smtc' | 'none'
  private activeSource: 'spotify' | 'smtc' | 'none' = 'none';

  // Windows SMTC State
  private smtcState: {
    active: boolean;
    app: string;
    title: string;
    artist: string;
    album: string;
    playing: boolean;
    positionMs: number;
    durationMs: number;
    coverUrl?: string;
  } = {
    active: false,
    app: '',
    title: '',
    artist: '',
    album: '',
    playing: false,
    positionMs: 0,
    durationMs: 0
  };
  private smtcLastSampleTime = 0;
  private smtcBasePositionMs = 0;
  private smtcDurationMs = 0;

  // Spotify Playback State
  private spotifyState: MediaState | null = null;
  private spotifyLastSampleTime = 0;
  private spotifyPollTimer: NodeJS.Timeout | null = null;

  private currentVolume: SystemVolumeState = { level: -1, muted: false };
  private currentNet: SystemNetState = { wired: true };
  private lyricsCache = new Map<string, LyricLine[]>();
  private coverArtCache = new Map<string, string>();
  private coverArtFetching = new Set<string>();

  private async fetchCoverArt(title: string, artist: string): Promise<string | null> {
    const cleanT = String(title || '').replace(/\s*[([][^)\]]*\b(feat|ft|with|remaster(ed)?|live|version|edit|mix)\b[^)\]]*[)\]]/gi, '').trim();
    const cleanA = String(artist || '').replace(/\s*[([][^)\]]*\b(feat|ft|with)\b[^)\]]*[)\]]/gi, '').trim();
    const key = `${title}|${artist}`.toLowerCase();
    if (this.coverArtCache.has(key)) return this.coverArtCache.get(key)!;
    if (this.coverArtFetching.has(key)) return null;
    this.coverArtFetching.add(key);

    try {
      const q = encodeURIComponent(`${cleanT} ${cleanA}`.trim());
      const res = await net.fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=1`, {
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json && json.results && json.results.length > 0 && json.results[0].artworkUrl100) {
        const highRes = json.results[0].artworkUrl100.replace('100x100bb', '512x512bb');
        this.coverArtCache.set(key, highRes);
        if (this.smtcState.title === title) {
          this.smtcState.coverUrl = highRes;
          this.broadcastMediaState();
        }
        return highRes;
      }
    } catch {
    } finally {
      this.coverArtFetching.delete(key);
    }
    return null;
  }

  constructor() {
    const config = configStore.get();
    this.spotifyClient = new SpotifyPKCEClient({
      clientId: config.spotifyClientId
    });
    this.startWorker();
    this.startSpotifyPolling();
    this.setupIPC();
  }

  public getSpotifyClient(): SpotifyPKCEClient {
    return this.spotifyClient;
  }

  // ==========================================================================
  // Spotify Integration & Polling
  // ==========================================================================
  private startSpotifyPolling(): void {
    if (this.spotifyPollTimer) clearInterval(this.spotifyPollTimer);

    this.spotifyPollTimer = setInterval(async () => {
      await this.pollSpotifyPlayer();
    }, 1200);

    // Initial check
    setTimeout(() => this.pollSpotifyPlayer(), 500);
  }

  public async pollSpotifyPlayer(): Promise<void> {
    if (!this.spotifyClient.isConnected()) {
      if (this.activeSource === 'spotify') {
        this.activeSource = this.smtcState.active ? 'smtc' : 'none';
        this.spotifyState = null;
        this.broadcastMediaState();
      }
      return;
    }

    try {
      const token = await this.spotifyClient.getAccessToken();
      if (!token) {
        if (this.activeSource === 'spotify') {
          this.activeSource = this.smtcState.active ? 'smtc' : 'none';
          this.broadcastMediaState();
        }
        return;
      }

      const response = await fetch('https://api.spotify.com/v1/me/player', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        signal: AbortSignal.timeout(3000)
      });

      if (response.status === 200) {
        const data: any = await response.json();
        if (data && data.item) {
          this.spotifyState = MediaEngine.mapSpotifyToMediaState(
            data.item,
            Boolean(data.is_playing),
            data.progress_ms || 0
          );
          this.spotifyLastSampleTime = Date.now();
          this.activeSource = 'spotify';
          this.broadcastMediaState();
          return;
        } else if (data && data.currently_playing_type === 'ad') {
          this.spotifyState = {
            source: 'spotify',
            title: 'Advertisement',
            artist: 'Spotify',
            album: '',
            albumArtUrl: null,
            isPlaying: Boolean(data.is_playing),
            positionMs: data.progress_ms || 0,
            durationMs: 30000,
            supportsControls: false
          };
          this.spotifyLastSampleTime = Date.now();
          this.activeSource = 'spotify';
          this.broadcastMediaState();
          return;
        }
      } else if (response.status === 403) {
        // Universal Fallback: HTTP 403 (non-developer / restricted account)
        console.warn('[MediaEngine] Spotify returned HTTP 403. Falling back to Windows SMTC.');
        this.activeSource = this.smtcState.active ? 'smtc' : 'none';
        this.spotifyState = null;
        this.broadcastMediaState();
        return;
      } else if (response.status === 204) {
        // No content / nothing currently playing in Spotify
        if (this.activeSource === 'spotify') {
          this.activeSource = this.smtcState.active ? 'smtc' : 'none';
          this.spotifyState = null;
          this.broadcastMediaState();
        }
        return;
      } else if (response.status === 401) {
        await this.spotifyClient.refreshTokens();
      }
    } catch {
      // Network failure or timeout: fallback to SMTC
      if (this.activeSource === 'spotify' && !this.spotifyState?.isPlaying) {
        this.activeSource = this.smtcState.active ? 'smtc' : 'none';
      }
    }
  }

  public static mapSpotifyToMediaState(item: any, isPlaying: boolean, progressMs: number): MediaState {
    const artistName = (item.artists && Array.isArray(item.artists))
      ? item.artists.map((a: any) => a.name).join(', ')
      : (item.artist || '');
    const albumName = item.album?.name || '';
    const images = item.album?.images || [];
    const albumArtUrl = (images.length > 0 && images[0]?.url) ? images[0].url : null;

    return {
      source: 'spotify',
      title: item.name || '',
      artist: artistName,
      album: albumName,
      albumArtUrl,
      isPlaying,
      positionMs: progressMs,
      durationMs: Number(item.duration_ms) || 0,
      supportsControls: true
    };
  }

  public static mapSmtcToMediaState(smtc: {
    title: string;
    artist: string;
    album: string;
    coverUrl?: string;
    playing: boolean;
    positionMs: number;
    durationMs: number;
    active: boolean;
  }): MediaState {
    return {
      source: smtc.active ? 'smtc' : 'none',
      title: smtc.title || '',
      artist: smtc.artist || '',
      album: smtc.album || '',
      albumArtUrl: smtc.coverUrl || null,
      isPlaying: Boolean(smtc.playing),
      positionMs: smtc.positionMs || 0,
      durationMs: smtc.durationMs || 0,
      supportsControls: true
    };
  }

  public static resolveActiveSource(
    spotifyStatus: number | null,
    spotifyItem: any,
    smtcState: { active: boolean }
  ): 'spotify' | 'smtc' | 'none' {
    if (spotifyStatus === 403 || spotifyStatus === null) {
      return smtcState.active ? 'smtc' : 'none';
    }
    if (spotifyStatus === 200 && spotifyItem) {
      return 'spotify';
    }
    return smtcState.active ? 'smtc' : 'none';
  }

  // ==========================================================================
  // Windows SMTC Native Process (PowerShell Helper) & Linux MPRIS2 Worker
  // ==========================================================================
  private linuxMediaTimer: NodeJS.Timeout | null = null;

  private startWorker(): void {
    if (process.platform === 'linux') {
      this.startLinuxMediaWorker();
      return;
    }
    if (process.platform !== 'win32') return;

    let scriptPath = path.join(__dirname, '../native/media-session.ps1');
    scriptPath = scriptPath.replace('app.asar', 'app.asar.unpacked');

    try {
      this.child = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath
      ], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore']
      });

      let buffer = '';
      this.child.stdout?.setEncoding('utf8');
      this.child.stdout?.on('data', (chunk: string) => {
        buffer += chunk;
        let index: number;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (line) this.handleWorkerLine(line);
        }
      });

      this.child.on('error', (err) => {
        console.warn('[MediaEngine] PowerShell process error:', err);
      });

      this.child.on('exit', () => {
        this.child = null;
        setTimeout(() => this.startWorker(), 6000);
      });

      // Request initial network & volume state
      setTimeout(() => {
        this.sendCommand('net');
      }, 1500);
    } catch (err) {
      console.error('[MediaEngine] Failed to spawn PowerShell helper:', err);
    }
  }

  private startLinuxMediaWorker(): void {
    if (this.linuxMediaTimer) {
      clearInterval(this.linuxMediaTimer);
      this.linuxMediaTimer = null;
    }

    const pollLinuxMedia = () => {
      // Query MPRIS2 metadata via playerctl or D-Bus qdbus fallback
      exec(
        `playerctl metadata --format '{"active":true,"playing":"{{lc(status)}}","title":"{{markup_escape(title)}}","artist":"{{markup_escape(artist)}}","album":"{{markup_escape(album)}}","position":{{position}},"art":"{{mpris:artUrl}}"}' 2>/dev/null`,
        (_err, stdout) => {
          if (!stdout || !stdout.trim()) {
            if (this.smtcState.active) {
              this.handleWorkerLine(JSON.stringify({ active: false }));
            }
            return;
          }
          try {
            const parsed = JSON.parse(stdout.trim());
            const isPlaying = parsed.playing === 'playing';
            this.handleWorkerLine(JSON.stringify({
              active: Boolean(parsed.title),
              playing: isPlaying,
              title: parsed.title || '',
              artist: parsed.artist || '',
              album: parsed.album || '',
              // playerctl returns position in microseconds (us); convert to ms
              position: Math.round((Number(parsed.position) || 0) / 1000),
              art: parsed.art || ''
            }));
          } catch {}
        }
      );
    };

    // Low CPU: Poll every 1200ms when running on Linux
    this.linuxMediaTimer = setInterval(pollLinuxMedia, 1200);
    pollLinuxMedia();
  }

  private handleWorkerLine(line: string): void {
    try {
      const data = JSON.parse(line);

      // 1. Windows Audio Volume
      if ('volume' in data) {
        this.currentVolume = {
          level: Number(data.volume) || 0,
          muted: Boolean(data.muted)
        };
        BrowserWindow.getAllWindows().forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('system:volume-changed', this.currentVolume);
          }
        });
        return;
      }

      // 2. Wi-Fi and Bluetooth Network State
      if (data.net) {
        this.currentNet = data.net;
        BrowserWindow.getAllWindows().forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('system:network-changed', this.currentNet);
          }
        });
        return;
      }

      // 3. Focus Guard Foreground Window
      if (data.front) {
        BrowserWindow.getAllWindows().forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('guard:front-changed', data.front);
          }
        });
        return;
      }

      // 4. Windows Toast Notifications (WhatsApp, Mail, Telegram, System Toasts)
      if (data.toast) {
        const t = data.toast;
        BrowserWindow.getAllWindows().forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('island:notify', {
              id: 'toast-' + t.id,
              app: t.app,
              title: t.app && t.title && !t.title.toLowerCase().includes(t.app.toLowerCase()) ? `${t.app}: ${t.title}` : t.title,
              body: t.body,
              kind: t.kind || 'info',
              durationMs: 5000,
              phone: t.phone || '',
              tag: t.tag || ''
            });
          }
        });
        return;
      }

      // 4. Media Playback State (Windows SMTC / Linux MPRIS2: Spotify, YouTube, Browsers)
      if (typeof data.active === 'boolean') {
        let coverUrl = this.smtcState.coverUrl;
        if (data.art) {
          if (data.art.startsWith('http://') || data.art.startsWith('https://') || data.art.startsWith('file://') || data.art.startsWith('data:')) {
            coverUrl = data.art;
          } else {
            const isJpeg = data.art.startsWith('/9j/') || data.art.startsWith('data:image/jpeg');
            coverUrl = `data:image/${isJpeg ? 'jpeg' : 'png'};base64,${data.art}`;
          }
        } else if (data.title !== this.smtcState.title) {
          coverUrl = undefined;
        }

        const songArtKey = `${data.title || ''}|${data.artist || ''}`.toLowerCase();
        if (!coverUrl && data.title && this.coverArtCache.has(songArtKey)) {
          coverUrl = this.coverArtCache.get(songArtKey);
        }

        this.smtcLastSampleTime = Date.now();
        this.smtcBasePositionMs = Number(data.position != null ? data.position : data.positionMs) || 0;
        this.smtcDurationMs = Number(data.duration != null ? data.duration : data.durationMs) || 0;

        const isPlaying = Boolean(data.playing);

        this.smtcState = {
          active: Boolean(data.active && data.title),
          app: data.app || '',
          title: data.title || '',
          artist: data.artist || data.album || '',
          album: data.album || '',
          playing: isPlaying,
          positionMs: this.smtcBasePositionMs,
          durationMs: this.smtcDurationMs,
          coverUrl
        };

        if (!this.smtcState.coverUrl && data.active && data.title) {
          this.fetchCoverArt(data.title, data.artist || '');
        }

        // If Spotify is not actively playing, switch activeSource to SMTC or none
        if (this.activeSource !== 'spotify' || !this.spotifyState?.isPlaying) {
          this.activeSource = this.smtcState.active ? 'smtc' : (this.spotifyState ? 'spotify' : 'none');
          this.broadcastMediaState();
        }
      }
    } catch {}
  }

  // ==========================================================================
  // Unified State & Position Interpolation
  // ==========================================================================
  public getInterpolatedState(): MediaTrackState {
    if (this.activeSource === 'spotify' && this.spotifyState) {
      let pos = this.spotifyState.positionMs;
      if (this.spotifyState.isPlaying) {
        const elapsed = Date.now() - this.spotifyLastSampleTime;
        pos += elapsed;
        if (this.spotifyState.durationMs > 0) {
          pos = Math.min(pos, this.spotifyState.durationMs);
        }
      }
      return {
        source: 'spotify',
        active: true,
        title: this.spotifyState.title,
        artist: this.spotifyState.artist,
        album: this.spotifyState.album,
        albumArtUrl: this.spotifyState.albumArtUrl,
        coverUrl: this.spotifyState.albumArtUrl || undefined,
        isPlaying: this.spotifyState.isPlaying,
        playing: this.spotifyState.isPlaying,
        positionMs: Math.round(pos),
        durationMs: this.spotifyState.durationMs,
        supportsControls: true
      };
    }

    if (this.activeSource === 'smtc' && this.smtcState.active) {
      let pos = this.smtcBasePositionMs;
      if (this.smtcState.playing) {
        const elapsed = Date.now() - this.smtcLastSampleTime;
        pos += elapsed;
        if (this.smtcDurationMs > 0) {
          pos = Math.min(pos, this.smtcDurationMs);
        }
      }
      return {
        source: 'smtc',
        active: true,
        app: this.smtcState.app,
        title: this.smtcState.title,
        artist: this.smtcState.artist,
        album: this.smtcState.album,
        albumArtUrl: this.smtcState.coverUrl || null,
        coverUrl: this.smtcState.coverUrl,
        isPlaying: this.smtcState.playing,
        playing: this.smtcState.playing,
        positionMs: Math.round(pos),
        durationMs: this.smtcDurationMs,
        supportsControls: true
      };
    }

    // Default Inactive Media State
    return {
      source: 'none',
      active: false,
      title: '',
      artist: '',
      album: '',
      albumArtUrl: null,
      coverUrl: undefined,
      isPlaying: false,
      playing: false,
      positionMs: 0,
      durationMs: 0,
      supportsControls: false
    };
  }

  public getUnifiedState(): MediaState {
    const s = this.getInterpolatedState();
    return {
      source: s.source,
      title: s.title,
      artist: s.artist,
      album: s.album,
      albumArtUrl: s.albumArtUrl,
      isPlaying: s.isPlaying,
      positionMs: s.positionMs,
      durationMs: s.durationMs,
      supportsControls: s.supportsControls
    };
  }

  private broadcastMediaState(): void {
    const state = this.getInterpolatedState();
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('media:state-changed', state);
      }
    });
  }

  public sendCommand(cmd: string): void {
    if (process.platform === 'linux') {
      try {
        if (cmd === 'toggle') {
          exec('playerctl play-pause 2>/dev/null || qdbus org.mpris.MediaPlayer2.* /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.PlayPause 2>/dev/null');
        } else if (cmd === 'next') {
          exec('playerctl next 2>/dev/null || qdbus org.mpris.MediaPlayer2.* /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Next 2>/dev/null');
        } else if (cmd === 'previous') {
          exec('playerctl previous 2>/dev/null || qdbus org.mpris.MediaPlayer2.* /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Previous 2>/dev/null');
        } else if (cmd.startsWith('seek ')) {
          const targetMs = Number(cmd.split(' ')[1]) || 0;
          const targetSec = (targetMs / 1000).toFixed(2);
          exec(`playerctl position ${targetSec} 2>/dev/null`);
        } else if (cmd.startsWith('vol ')) {
          const level = Number(cmd.split(' ')[1]) || 0;
          exec(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${level / 100} 2>/dev/null || pactl set-sink-volume @DEFAULT_SINK@ ${level}% 2>/dev/null || amixer set Master ${level}% 2>/dev/null`);
        } else if (cmd.startsWith('mute ')) {
          const isMute = cmd.split(' ')[1] === '1';
          exec(`wpctl set-mute @DEFAULT_AUDIO_SINK@ ${isMute ? '1' : '0'} 2>/dev/null || pactl set-sink-mute @DEFAULT_SINK@ ${isMute ? '1' : '0'} 2>/dev/null`);
        } else if (cmd.startsWith('radio wifi ')) {
          const on = cmd.split(' ')[2] === '1';
          exec(`nmcli radio wifi ${on ? 'on' : 'off'} 2>/dev/null`);
        } else if (cmd.startsWith('radio bt ')) {
          const on = cmd.split(' ')[2] === '1';
          exec(`bluetoothctl power ${on ? 'on' : 'off'} 2>/dev/null || rfkill ${on ? 'unblock' : 'block'} bluetooth 2>/dev/null`);
        }
      } catch (err) {
        console.warn('[MediaEngine] Linux sendCommand error:', err);
      }
      return;
    }

    if (this.child && this.child.stdin && !this.child.stdin.destroyed) {
      try {
        this.child.stdin.write(cmd + '\n');
      } catch {}
    }
  }

  // ==========================================================================
  // Playback Controls (Spotify Web API with SMTC Fallback)
  // ==========================================================================
  public async playPause(): Promise<void> {
    if (this.activeSource === 'spotify' && this.spotifyClient.isConnected()) {
      try {
        const token = await this.spotifyClient.getAccessToken();
        if (token) {
          const action = (this.spotifyState && this.spotifyState.isPlaying) ? 'pause' : 'play';
          const res = await fetch(`https://api.spotify.com/v1/me/player/${action}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok || res.status === 204) {
            if (this.spotifyState) {
              this.spotifyState.isPlaying = !this.spotifyState.isPlaying;
              this.spotifyLastSampleTime = Date.now();
              this.broadcastMediaState();
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[MediaEngine] Spotify play/pause error, falling back to SMTC:', err);
      }
    }

    // Fallback: Windows SMTC toggle
    this.sendCommand('toggle');
  }

  public async next(): Promise<void> {
    if (this.activeSource === 'spotify' && this.spotifyClient.isConnected()) {
      try {
        const token = await this.spotifyClient.getAccessToken();
        if (token) {
          const res = await fetch('https://api.spotify.com/v1/me/player/next', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok || res.status === 204) {
            setTimeout(() => this.pollSpotifyPlayer(), 300);
            return;
          }
        }
      } catch (err) {
        console.warn('[MediaEngine] Spotify next error, falling back to SMTC:', err);
      }
    }

    // Fallback: Windows SMTC next
    this.sendCommand('next');
  }

  public async previous(): Promise<void> {
    if (this.activeSource === 'spotify' && this.spotifyClient.isConnected()) {
      try {
        const token = await this.spotifyClient.getAccessToken();
        if (token) {
          const res = await fetch('https://api.spotify.com/v1/me/player/previous', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok || res.status === 204) {
            setTimeout(() => this.pollSpotifyPlayer(), 300);
            return;
          }
        }
      } catch (err) {
        console.warn('[MediaEngine] Spotify previous error, falling back to SMTC:', err);
      }
    }

    // Fallback: Windows SMTC previous
    this.sendCommand('previous');
  }

  public async seek(positionMs: number): Promise<void> {
    const targetMs = Math.max(0, Math.round(positionMs));

    if (this.activeSource === 'spotify' && this.spotifyClient.isConnected()) {
      try {
        const token = await this.spotifyClient.getAccessToken();
        if (token) {
          const res = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${targetMs}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok || res.status === 204) {
            if (this.spotifyState) {
              this.spotifyState.positionMs = targetMs;
              this.spotifyLastSampleTime = Date.now();
              this.broadcastMediaState();
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[MediaEngine] Spotify seek error, falling back to SMTC:', err);
      }
    }

    // Fallback: Windows SMTC seek
    this.sendCommand(`seek ${targetMs}`);
    this.smtcBasePositionMs = targetMs;
    this.smtcLastSampleTime = Date.now();
    this.broadcastMediaState();
  }

  // ==========================================================================
  // Synced Lyrics (TwoCode LRCLIB + NetEase Cloud Music Fallback Engine)
  // Direct port from c:\Users\hp218\Downloads\resources\app\lyrics-main.cjs
  // ==========================================================================
  private static readonly LYRICS_API = 'https://lrclib.net/api';
  private static readonly NETEASE_API = 'https://music.163.com/api';
  private static readonly SOURCES = 2;
  private static readonly NONE_DAYS = 7;
  private lyricsMemory = new Map<string, any>();
  private lyricsAsking = new Map<string, Promise<any>>();

  private getLyricsFolder(): string {
    return path.join(app.getPath('userData'), 'lyrics');
  }

  private cleanString(s: any, max = 200): string {
    return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  private keyOf(q: { title: string; artist: string; duration?: number }): string {
    return crypto
      .createHash('sha1')
      .update([q.title, q.artist, Math.round(q.duration || 0)].join('|').toLowerCase())
      .digest('hex')
      .slice(0, 24);
  }

  private parseLrc(lrc: string): LyricLine[] {
    const lines: LyricLine[] = [];
    for (const raw of String(lrc || '').split(/\r?\n/)) {
      const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
      if (!stamps.length) continue;
      const text = raw.replace(/\[[^\]]*\]/g, '').trim();
      for (const m of stamps) {
        const ms = Math.round((Number(m[1]) * 60 + Number(m[2].replace(':', '.'))) * 1000);
        lines.push({ timeMs: ms, t: ms, text });
      }
    }
    return lines.sort((a, b) => a.timeMs - b.timeMs);
  }

  private async fetchJson(url: string): Promise<any> {
    const r = await net.fetch(url, {
      headers: { 'User-Agent': `RoboIsland ${app.getVersion()} (https://roboisland.local)` },
      signal: AbortSignal.timeout(10000)
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(new URL(url).host + ' ' + r.status);
    return r.json();
  }

  private simple(s: string): string {
    return String(s || '')
      .toLowerCase()
      .replace(/\s*[([][^)\]]*\b(feat|ft|with|remaster(ed)?|live|version|edit|mix|mono|stereo|deluxe|bonus|from)\b[^)\]]*[)\]]/g, '')
      .replace(/\s+[-–—]\s+.*\b(remaster(ed)?|live|version|edit|mix|mono|stereo|single|from)\b.*$/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  private artists(s: string): string[] {
    return String(s || '')
      .toLowerCase()
      .split(/\s*(?:,|&|\/|;|\bx\b|\bfeat\.?|\bft\.?|\bwith\b)\s*/)
      .map(a => a.replace(/[^\p{L}\p{N}]+/gu, ' ').trim())
      .filter(Boolean);
  }

  private sameArtist(a: string, b: string): boolean {
    return this.artists(a).some(x =>
      this.artists(b).some(y => x === y || (Math.min(x.length, y.length) > 3 && (x.includes(y) || y.includes(x))))
    );
  }

  private sameLength(q: { duration?: number }, sec: number): boolean {
    return !q.duration || !sec || Math.abs(sec - q.duration) <= 3;
  }

  private async fromLrclib(q: { title: string; artist: string; album?: string; duration?: number }): Promise<{ lines: LyricLine[]; instrumental?: boolean }> {
    const params = new URLSearchParams({ track_name: q.title, artist_name: q.artist });
    if (q.album) params.set('album_name', q.album);
    if (q.duration) params.set('duration', String(Math.round(q.duration)));
    let hit: any = await this.fetchJson(`${MediaEngine.LYRICS_API}/get?${params}`).catch(() => null);
    const names = [[q.title, q.artist]], plain = [this.simple(q.title), this.artists(q.artist)[0] || q.artist];
    if (plain[0] && (plain[0] !== q.title.toLowerCase() || plain[1] !== q.artist.toLowerCase())) names.push(plain);
    for (const [title, artist] of names) {
      if (hit?.syncedLyrics || hit?.instrumental) break;
      const found: any = await this.fetchJson(`${MediaEngine.LYRICS_API}/search?${new URLSearchParams({ track_name: title, artist_name: artist })}`).catch(() => null);
      const synced = (Array.isArray(found) ? found : []).filter(x => x.syncedLyrics && this.sameArtist(x.artistName, q.artist));
      hit = synced.find(x => q.duration && this.sameLength(q, x.duration)) || (q.duration ? null : synced[0]) || hit;
    }
    if (hit?.instrumental) return { lines: [], instrumental: true };
    const lines = this.parseLrc(hit?.syncedLyrics);
    return { lines: lines.some(l => l.text) ? lines : [] };
  }

  private static readonly CREDIT = /^\s*[\p{Script=Han}A-Za-z .&/-]{1,24}\s*[:：]\s*\S/u;

  private async fromNetease(q: { title: string; artist: string; album?: string; duration?: number }): Promise<{ lines: LyricLine[]; instrumental?: boolean } | null> {
    const s = `${this.simple(q.title)} ${this.artists(q.artist)[0] || ''}`.trim();
    const found: any = await this.fetchJson(`${MediaEngine.NETEASE_API}/cloudsearch/pc?${new URLSearchParams({ s, type: '1', limit: '10' })}`).catch(() => null);
    const songs = Array.isArray(found?.result?.songs) ? found.result.songs : [], want = this.simple(q.title);
    const hit = songs.find((x: any) => this.simple(x.name) === want && (x.ar || []).some((a: any) => this.sameArtist(a.name, q.artist)) && this.sameLength(q, (x.dt || 0) / 1000));
    if (!hit) return null;
    const lyricRes: any = await this.fetchJson(`${MediaEngine.NETEASE_API}/song/lyric?${new URLSearchParams({ id: String(hit.id), lv: '1' })}`).catch(() => null);
    const lyric = String(lyricRes?.lrc?.lyric || '');
    if (/纯音乐/.test(lyric)) return { lines: [], instrumental: true };
    const lines = this.parseLrc(lyric).filter(l => !(l.timeMs < 40000 && MediaEngine.CREDIT.test(l.text)));
    return lines.some(l => l.text) ? { lines } : null;
  }

  public async lookupLyrics(q: { title: string; artist: string; album?: string; duration?: number }): Promise<{ lines: LyricLine[]; instrumental?: boolean }> {
    let answer: { lines: LyricLine[]; instrumental?: boolean } | null = null, failed = 0;
    try { answer = await this.fromLrclib(q); } catch { failed++; }
    if (!answer?.lines.length && !answer?.instrumental) {
      try { answer = (await this.fromNetease(q)) || answer; } catch { failed++; }
    }
    if (failed && !answer?.lines.length && !answer?.instrumental) throw new Error('A lyrics source could not be reached');
    return answer || { lines: [] };
  }

  public async findLyrics(raw: { title: string; artist: string; album?: string; duration?: number }): Promise<{ lines: LyricLine[]; instrumental?: boolean; synced: boolean; currentLine: string }> {
    const q = {
      title: this.cleanString(raw?.title),
      artist: this.cleanString(raw?.artist),
      album: this.cleanString(raw?.album),
      duration: Math.max(0, Math.min(7200, Number(raw?.duration) || 0))
    };
    if (!q.title || !q.artist) return { lines: [], synced: false, currentLine: '' };

    const key = this.keyOf(q);
    const file = path.join(this.getLyricsFolder(), key + '.json');

    if (this.lyricsMemory.has(key)) {
      const cached = this.lyricsMemory.get(key);
      return this.formatLyricsResponse(cached);
    }

    try {
      if (fs.existsSync(file)) {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (saved.lines?.length || saved.instrumental || (saved.sources >= MediaEngine.SOURCES && Date.now() - (saved.at || 0) < MediaEngine.NONE_DAYS * 864e5)) {
          this.lyricsMemory.set(key, saved);
          return this.formatLyricsResponse(saved);
        }
      }
    } catch {}

    if (this.lyricsAsking.has(key)) {
      const pending = await this.lyricsAsking.get(key);
      return this.formatLyricsResponse(pending);
    }

    const job = this.lookupLyrics(q).then(
      answer => {
        const saved = { ...answer, at: Date.now(), sources: MediaEngine.SOURCES };
        this.lyricsMemory.set(key, saved);
        try {
          fs.mkdirSync(this.getLyricsFolder(), { recursive: true });
          fs.writeFileSync(file, JSON.stringify(saved));
        } catch {}
        return saved;
      },
      () => ({ lines: [], failed: true })
    ).finally(() => this.lyricsAsking.delete(key));

    this.lyricsAsking.set(key, job);
    const result = await job;
    return this.formatLyricsResponse(result);
  }

  private formatLyricsResponse(res: any): { lines: LyricLine[]; instrumental?: boolean; synced: boolean; currentLine: string } {
    const lines: LyricLine[] = Array.isArray(res?.lines) ? res.lines : [];
    const instrumental = Boolean(res?.instrumental);
    const synced = lines.length > 0;
    let currentLine = '';

    if (synced) {
      const currentPos = this.getInterpolatedState().positionMs;
      for (const line of lines) {
        if (line.timeMs <= currentPos) {
          currentLine = line.text;
        } else {
          break;
        }
      }
    }

    return { synced, currentLine, lines, instrumental };
  }

  public async fetchLyrics(title: string, artist: string, duration?: number): Promise<{ synced: boolean; currentLine: string; lines: LyricLine[]; instrumental?: boolean }> {
    return this.findLyrics({ title, artist, duration: duration ? duration / 1000 : undefined });
  }

  // ==========================================================================
  // IPC Setup
  // ==========================================================================
  private setupIPC(): void {
    // 1. Media State
    ipcMain.handle('media:get-state', () => {
      return this.getInterpolatedState();
    });

    // 2. Control Commands (backward-compatible)
    ipcMain.handle('media:control', async (_event, action: string) => {
      if (action === 'playPause' || action === 'toggle') {
        await this.playPause();
        return { ok: true };
      }
      if (action === 'play' || action === 'pause') {
        await this.playPause();
        return { ok: true };
      }
      if (action === 'next') {
        await this.next();
        return { ok: true };
      }
      if (action === 'previous' || action === 'prev') {
        await this.previous();
        return { ok: true };
      }
      return { ok: false, error: 'Unknown action' };
    });

    ipcMain.handle('media:play-pause', async () => {
      await this.playPause();
      return { ok: true };
    });

    ipcMain.handle('media:next', async () => {
      await this.next();
      return { ok: true };
    });

    ipcMain.handle('media:prev', async () => {
      await this.previous();
      return { ok: true };
    });

    ipcMain.handle('media:seek', async (_event, positionMs: number) => {
      await this.seek(positionMs);
      return { ok: true };
    });

    // 3. Spotify PKCE IPC
    ipcMain.handle('media:connect-spotify', async () => {
      const config = configStore.get();
      if (config.spotifyClientId) {
        this.spotifyClient.setClientId(config.spotifyClientId);
      }
      if (!this.spotifyClient.hasValidClientId()) {
        const isSmtcActive = this.smtcState.active;
        if (typeof BrowserWindow !== 'undefined') {
          BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
              win.webContents.send('notification:push', {
                id: 'spotify-info-' + Date.now(),
                title: 'Spotify Integration',
                body: isSmtcActive
                  ? 'Spotify is already active via Windows SMTC! For Spotify Connect Web API, configure Client ID in Settings.'
                  : 'To connect Spotify Web API, enter your Client ID in Settings. Windows SMTC connects automatically when Spotify plays.',
                kind: 'music',
                durationMs: 5000
              });
            }
          });
        }
        return false;
      }
      const success = await this.spotifyClient.startAuthFlow();
      if (success) {
        await this.pollSpotifyPlayer();
      }
      return success;
    });

    ipcMain.handle('media:disconnect-spotify', async () => {
      await this.spotifyClient.disconnect();
      if (this.activeSource === 'spotify') {
        this.activeSource = this.smtcState.active ? 'smtc' : 'none';
        this.spotifyState = null;
        this.broadcastMediaState();
      }
      return { ok: true };
    });

    ipcMain.handle('media:get-spotify-status', () => {
      return this.spotifyClient.getTokenStatus();
    });

    ipcMain.handle('media:spotify-devices', async () => {
      return this.spotifyClient.getDevices();
    });

    ipcMain.handle('media:spotify-transfer', async (_event, deviceId: string) => {
      const ok = await this.spotifyClient.transferPlayback(deviceId);
      return { ok };
    });

    ipcMain.handle('media:get-lyrics', async (_event, query: { title: string; artist: string; duration?: number }) => {
      return this.fetchLyrics(query.title, query.artist, query.duration);
    });

    ipcMain.handle('lyrics:get', async (_event, query: { title: string; artist: string; duration?: number }) => {
      return this.fetchLyrics(query.title, query.artist, query.duration);
    });

    // 4. Windows Volume Controls
    ipcMain.handle('system:get-volume', () => {
      return this.currentVolume;
    });

    ipcMain.handle('system:set-volume', (_event, percent: number) => {
      this.sendCommand(`vol ${Math.round(percent)}`);
      this.currentVolume.level = percent;
      return { ok: true };
    });

    ipcMain.handle('system:set-mute', (_event, muted: boolean) => {
      this.sendCommand(`mute ${muted ? '1' : '0'}`);
      this.currentVolume.muted = muted;
      return { ok: true };
    });

    // 5. Windows Network Controls
    ipcMain.handle('system:get-network', () => {
      this.sendCommand('net');
      return this.currentNet;
    });

    ipcMain.handle('system:set-radio', (_event, kind: 'wifi' | 'bt', on: boolean) => {
      this.sendCommand(`radio ${kind} ${on ? '1' : '0'}`);
      return { ok: true };
    });
  }

  public dispose(): void {
    if (this.spotifyPollTimer) {
      clearInterval(this.spotifyPollTimer);
      this.spotifyPollTimer = null;
    }
    if (this.linuxMediaTimer) {
      clearInterval(this.linuxMediaTimer);
      this.linuxMediaTimer = null;
    }
    try {
      this.sendCommand('quit');
      this.child?.kill();
    } catch {}
  }
}
