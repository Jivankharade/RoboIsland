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
exports.MediaEngine = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const electron_1 = require("electron");
const spotify_pkce_1 = require("./spotify-pkce");
const config_store_1 = require("./config-store");
class MediaEngine {
    child = null;
    spotifyClient;
    // Active Source Tracker: 'spotify' | 'smtc' | 'none'
    activeSource = 'none';
    // Windows SMTC State
    smtcState = {
        active: false,
        app: '',
        title: '',
        artist: '',
        album: '',
        playing: false,
        positionMs: 0,
        durationMs: 0
    };
    smtcLastSampleTime = 0;
    smtcBasePositionMs = 0;
    smtcDurationMs = 0;
    // Spotify Playback State
    spotifyState = null;
    spotifyLastSampleTime = 0;
    spotifyPollTimer = null;
    currentVolume = { level: -1, muted: false };
    currentNet = { wired: true };
    lyricsCache = new Map();
    constructor() {
        const config = config_store_1.configStore.get();
        this.spotifyClient = new spotify_pkce_1.SpotifyPKCEClient({
            clientId: config.spotifyClientId
        });
        this.startWorker();
        this.startSpotifyPolling();
        this.setupIPC();
    }
    getSpotifyClient() {
        return this.spotifyClient;
    }
    // ==========================================================================
    // Spotify Integration & Polling
    // ==========================================================================
    startSpotifyPolling() {
        if (this.spotifyPollTimer)
            clearInterval(this.spotifyPollTimer);
        this.spotifyPollTimer = setInterval(async () => {
            await this.pollSpotifyPlayer();
        }, 1200);
        // Initial check
        setTimeout(() => this.pollSpotifyPlayer(), 500);
    }
    async pollSpotifyPlayer() {
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
                const data = await response.json();
                if (data && data.item) {
                    this.spotifyState = MediaEngine.mapSpotifyToMediaState(data.item, Boolean(data.is_playing), data.progress_ms || 0);
                    this.spotifyLastSampleTime = Date.now();
                    this.activeSource = 'spotify';
                    this.broadcastMediaState();
                    return;
                }
                else if (data && data.currently_playing_type === 'ad') {
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
            }
            else if (response.status === 403) {
                // Universal Fallback: HTTP 403 (non-developer / restricted account)
                console.warn('[MediaEngine] Spotify returned HTTP 403. Falling back to Windows SMTC.');
                this.activeSource = this.smtcState.active ? 'smtc' : 'none';
                this.spotifyState = null;
                this.broadcastMediaState();
                return;
            }
            else if (response.status === 204) {
                // No content / nothing currently playing in Spotify
                if (this.activeSource === 'spotify') {
                    this.activeSource = this.smtcState.active ? 'smtc' : 'none';
                    this.spotifyState = null;
                    this.broadcastMediaState();
                }
                return;
            }
            else if (response.status === 401) {
                await this.spotifyClient.refreshTokens();
            }
        }
        catch {
            // Network failure or timeout: fallback to SMTC
            if (this.activeSource === 'spotify' && !this.spotifyState?.isPlaying) {
                this.activeSource = this.smtcState.active ? 'smtc' : 'none';
            }
        }
    }
    static mapSpotifyToMediaState(item, isPlaying, progressMs) {
        const artistName = (item.artists && Array.isArray(item.artists))
            ? item.artists.map((a) => a.name).join(', ')
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
    static mapSmtcToMediaState(smtc) {
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
    static resolveActiveSource(spotifyStatus, spotifyItem, smtcState) {
        if (spotifyStatus === 403 || spotifyStatus === null) {
            return smtcState.active ? 'smtc' : 'none';
        }
        if (spotifyStatus === 200 && spotifyItem) {
            return 'spotify';
        }
        return smtcState.active ? 'smtc' : 'none';
    }
    // ==========================================================================
    // Windows SMTC Native Process (PowerShell Helper)
    // ==========================================================================
    startWorker() {
        if (process.platform !== 'win32')
            return;
        let scriptPath = path.join(__dirname, '../native/media-session.ps1');
        scriptPath = scriptPath.replace('app.asar', 'app.asar.unpacked');
        try {
            this.child = (0, child_process_1.spawn)('powershell.exe', [
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
            this.child.stdout?.on('data', (chunk) => {
                buffer += chunk;
                let index;
                while ((index = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, index).trim();
                    buffer = buffer.slice(index + 1);
                    if (line)
                        this.handleWorkerLine(line);
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
        }
        catch (err) {
            console.error('[MediaEngine] Failed to spawn PowerShell helper:', err);
        }
    }
    handleWorkerLine(line) {
        try {
            const data = JSON.parse(line);
            // 1. Windows Audio Volume
            if ('volume' in data) {
                this.currentVolume = {
                    level: Number(data.volume) || 0,
                    muted: Boolean(data.muted)
                };
                electron_1.BrowserWindow.getAllWindows().forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('system:volume-changed', this.currentVolume);
                    }
                });
                return;
            }
            // 2. Wi-Fi and Bluetooth Network State
            if (data.net) {
                this.currentNet = data.net;
                electron_1.BrowserWindow.getAllWindows().forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('system:network-changed', this.currentNet);
                    }
                });
                return;
            }
            // 3. Focus Guard Foreground Window
            if (data.front) {
                electron_1.BrowserWindow.getAllWindows().forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('guard:front-changed', data.front);
                    }
                });
                return;
            }
            // 4. Media Playback State (Windows SMTC: Spotify, YouTube, Browsers)
            if (typeof data.active === 'boolean') {
                let coverUrl = this.smtcState.coverUrl;
                if (data.art) {
                    const isJpeg = data.art.startsWith('/9j/') || data.art.startsWith('data:image/jpeg');
                    coverUrl = data.art.startsWith('data:') ? data.art : `data:image/${isJpeg ? 'jpeg' : 'png'};base64,${data.art}`;
                }
                else if (data.title !== this.smtcState.title) {
                    coverUrl = undefined;
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
                // If Spotify is not actively playing, switch activeSource to SMTC or none
                if (this.activeSource !== 'spotify' || !this.spotifyState?.isPlaying) {
                    this.activeSource = this.smtcState.active ? 'smtc' : (this.spotifyState ? 'spotify' : 'none');
                    this.broadcastMediaState();
                }
            }
        }
        catch { }
    }
    // ==========================================================================
    // Unified State & Position Interpolation
    // ==========================================================================
    getInterpolatedState() {
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
    getUnifiedState() {
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
    broadcastMediaState() {
        const state = this.getInterpolatedState();
        electron_1.BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('media:state-changed', state);
            }
        });
    }
    sendCommand(cmd) {
        if (this.child && this.child.stdin && !this.child.stdin.destroyed) {
            try {
                this.child.stdin.write(cmd + '\n');
            }
            catch { }
        }
    }
    // ==========================================================================
    // Playback Controls (Spotify Web API with SMTC Fallback)
    // ==========================================================================
    async playPause() {
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
            }
            catch (err) {
                console.warn('[MediaEngine] Spotify play/pause error, falling back to SMTC:', err);
            }
        }
        // Fallback: Windows SMTC toggle
        this.sendCommand('toggle');
    }
    async next() {
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
            }
            catch (err) {
                console.warn('[MediaEngine] Spotify next error, falling back to SMTC:', err);
            }
        }
        // Fallback: Windows SMTC next
        this.sendCommand('next');
    }
    async previous() {
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
            }
            catch (err) {
                console.warn('[MediaEngine] Spotify previous error, falling back to SMTC:', err);
            }
        }
        // Fallback: Windows SMTC previous
        this.sendCommand('previous');
    }
    async seek(positionMs) {
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
            }
            catch (err) {
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
    // Synced Lyrics (LRCLIB)
    // ==========================================================================
    async fetchLyrics(title, artist, duration) {
        const key = `${artist}-${title}`.toLowerCase();
        let lines = this.lyricsCache.get(key);
        if (!lines && title) {
            try {
                const cleanTitle = title.replace(/\s*\(.*?\)/g, '').replace(/\s*\[.*?\]/g, '').trim();
                const params = new URLSearchParams({
                    track_name: cleanTitle,
                    artist_name: artist
                });
                if (duration)
                    params.append('duration', String(Math.round(duration / 1000)));
                const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
                    signal: AbortSignal.timeout(6000)
                });
                if (res.ok) {
                    const json = await res.json();
                    if (json.syncedLyrics) {
                        lines = this.parseLrc(json.syncedLyrics);
                        this.lyricsCache.set(key, lines);
                    }
                }
            }
            catch { }
        }
        if (lines && lines.length > 0) {
            const currentPos = this.getInterpolatedState().positionMs;
            let matched = lines[0].text;
            for (const line of lines) {
                if (line.timeMs <= currentPos) {
                    matched = line.text;
                }
                else {
                    break;
                }
            }
            return { synced: true, currentLine: matched, lines };
        }
        return { synced: false, currentLine: '', lines: [] };
    }
    parseLrc(lrc) {
        const lines = [];
        const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
        let match;
        while ((match = regex.exec(lrc)) !== null) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const frac = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
            const timeMs = minutes * 60000 + seconds * 1000 + frac;
            const text = match[4].trim();
            if (text) {
                lines.push({ timeMs, text });
            }
        }
        return lines.sort((a, b) => a.timeMs - b.timeMs);
    }
    // ==========================================================================
    // IPC Setup
    // ==========================================================================
    setupIPC() {
        // 1. Media State
        electron_1.ipcMain.handle('media:get-state', () => {
            return this.getInterpolatedState();
        });
        // 2. Control Commands (backward-compatible)
        electron_1.ipcMain.handle('media:control', async (_event, action) => {
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
        electron_1.ipcMain.handle('media:play-pause', async () => {
            await this.playPause();
            return { ok: true };
        });
        electron_1.ipcMain.handle('media:next', async () => {
            await this.next();
            return { ok: true };
        });
        electron_1.ipcMain.handle('media:prev', async () => {
            await this.previous();
            return { ok: true };
        });
        electron_1.ipcMain.handle('media:seek', async (_event, positionMs) => {
            await this.seek(positionMs);
            return { ok: true };
        });
        // 3. Spotify PKCE IPC
        electron_1.ipcMain.handle('media:connect-spotify', async () => {
            const config = config_store_1.configStore.get();
            if (config.spotifyClientId) {
                this.spotifyClient.setClientId(config.spotifyClientId);
            }
            if (!this.spotifyClient.hasValidClientId()) {
                const isSmtcActive = this.smtcState.active;
                if (typeof electron_1.BrowserWindow !== 'undefined') {
                    electron_1.BrowserWindow.getAllWindows().forEach((win) => {
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
        electron_1.ipcMain.handle('media:disconnect-spotify', async () => {
            await this.spotifyClient.disconnect();
            if (this.activeSource === 'spotify') {
                this.activeSource = this.smtcState.active ? 'smtc' : 'none';
                this.spotifyState = null;
                this.broadcastMediaState();
            }
            return { ok: true };
        });
        electron_1.ipcMain.handle('media:get-spotify-status', () => {
            return this.spotifyClient.getTokenStatus();
        });
        electron_1.ipcMain.handle('media:spotify-devices', async () => {
            return this.spotifyClient.getDevices();
        });
        electron_1.ipcMain.handle('media:spotify-transfer', async (_event, deviceId) => {
            const ok = await this.spotifyClient.transferPlayback(deviceId);
            return { ok };
        });
        electron_1.ipcMain.handle('media:get-lyrics', async (_event, query) => {
            return this.fetchLyrics(query.title, query.artist, query.duration);
        });
        // 4. Windows Volume Controls
        electron_1.ipcMain.handle('system:get-volume', () => {
            return this.currentVolume;
        });
        electron_1.ipcMain.handle('system:set-volume', (_event, percent) => {
            this.sendCommand(`vol ${Math.round(percent)}`);
            this.currentVolume.level = percent;
            return { ok: true };
        });
        electron_1.ipcMain.handle('system:set-mute', (_event, muted) => {
            this.sendCommand(`mute ${muted ? '1' : '0'}`);
            this.currentVolume.muted = muted;
            return { ok: true };
        });
        // 5. Windows Network Controls
        electron_1.ipcMain.handle('system:get-network', () => {
            this.sendCommand('net');
            return this.currentNet;
        });
        electron_1.ipcMain.handle('system:set-radio', (_event, kind, on) => {
            this.sendCommand(`radio ${kind} ${on ? '1' : '0'}`);
            return { ok: true };
        });
    }
    dispose() {
        if (this.spotifyPollTimer) {
            clearInterval(this.spotifyPollTimer);
            this.spotifyPollTimer = null;
        }
        try {
            this.sendCommand('quit');
            this.child?.kill();
        }
        catch { }
    }
}
exports.MediaEngine = MediaEngine;
