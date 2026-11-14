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
exports.SpotifyPKCEClient = void 0;
exports.generateCodeVerifier = generateCodeVerifier;
exports.deriveCodeChallenge = deriveCodeChallenge;
exports.buildAuthorizationUrl = buildAuthorizationUrl;
exports.parseCallbackUrl = parseCallbackUrl;
const electron_1 = require("electron");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_CLIENT_ID = '996791653ff94b009e4d580f4f9f7405'; // Standard Spotify PKCE client id for desktop
const DEFAULT_REDIRECT_URI = 'http://127.0.0.1/callback';
const DEFAULT_SCOPES = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
];
/**
 * Generate a cryptographically random RFC 7636 PKCE code verifier.
 * Must be between 43 and 128 characters using only [A-Za-z0-9_-].
 */
function generateCodeVerifier(length = 64) {
    const clampedLength = Math.max(43, Math.min(128, length));
    // 96 random bytes provides ample base64url characters
    const raw = crypto.randomBytes(clampedLength).toString('base64url');
    return raw.slice(0, clampedLength);
}
/**
 * Derive an RFC 7636 SHA-256 base64url code challenge from a code verifier.
 */
function deriveCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}
/**
 * Build Spotify Authorization URL with PKCE S256 parameters.
 */
function buildAuthorizationUrl(clientId, redirectUri, challenge, scopes = DEFAULT_SCOPES) {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: scopes.join(' '),
        redirect_uri: redirectUri,
        code_challenge_method: 'S256',
        code_challenge: challenge
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
}
/**
 * Parse redirect callback URL and extract authorization code or error.
 */
function parseCallbackUrl(urlStr) {
    try {
        const url = new URL(urlStr);
        const code = url.searchParams.get('code') || undefined;
        const error = url.searchParams.get('error') || undefined;
        return { code, error };
    }
    catch {
        return {};
    }
}
class SpotifyPKCEClient {
    clientId;
    redirectUri;
    scopes;
    storageFile;
    currentTokens = null;
    activeAuthWindow = null;
    constructor(config = {}) {
        this.clientId = config.clientId || DEFAULT_CLIENT_ID;
        this.redirectUri = config.redirectUri || DEFAULT_REDIRECT_URI;
        this.scopes = config.scopes || DEFAULT_SCOPES;
        const baseDir = config.storagePath || ((electron_1.app && typeof electron_1.app.getPath === 'function')
            ? electron_1.app.getPath('userData')
            : (process.env.APPDATA ? path.join(process.env.APPDATA, 'RoboIsland') : path.join(process.cwd(), '.roboisland')));
        try {
            if (!fs.existsSync(baseDir)) {
                fs.mkdirSync(baseDir, { recursive: true });
            }
        }
        catch { }
        this.storageFile = path.join(baseDir, 'spotify-tokens.dat');
        this.loadTokens();
    }
    hasValidClientId() {
        return Boolean(this.clientId && this.clientId.trim() && this.clientId !== DEFAULT_CLIENT_ID);
    }
    setClientId(clientId) {
        if (clientId && clientId.trim()) {
            this.clientId = clientId.trim();
        }
    }
    /**
     * Load securely stored tokens on initialization.
     */
    loadTokens() {
        try {
            if (fs.existsSync(this.storageFile)) {
                const raw = fs.readFileSync(this.storageFile, 'utf8');
                const tokenJson = this.decryptData(raw);
                if (tokenJson) {
                    const parsed = JSON.parse(tokenJson);
                    if (parsed && parsed.accessToken) {
                        this.currentTokens = parsed;
                    }
                }
            }
        }
        catch (err) {
            console.warn('[SpotifyPKCE] Failed to load stored tokens:', err);
            this.currentTokens = null;
        }
    }
    /**
     * Persist tokens securely using safeStorage DPAPI when available.
     */
    saveTokens() {
        try {
            if (!this.currentTokens) {
                if (fs.existsSync(this.storageFile)) {
                    fs.unlinkSync(this.storageFile);
                }
                return;
            }
            const rawJson = JSON.stringify(this.currentTokens);
            const encryptedStr = this.encryptData(rawJson);
            fs.writeFileSync(this.storageFile, encryptedStr, 'utf8');
        }
        catch (err) {
            console.error('[SpotifyPKCE] Failed to save tokens securely:', err);
        }
    }
    encryptData(plainText) {
        try {
            if (electron_1.safeStorage && electron_1.safeStorage.isEncryptionAvailable()) {
                const buffer = electron_1.safeStorage.encryptString(plainText);
                return `dpapi:${buffer.toString('base64')}`;
            }
        }
        catch { }
        // Fallback obfuscation for non-DPAPI environments / test runners
        return `b64:${Buffer.from(plainText, 'utf8').toString('base64')}`;
    }
    decryptData(cipherText) {
        try {
            if (cipherText.startsWith('dpapi:')) {
                if (electron_1.safeStorage && electron_1.safeStorage.isEncryptionAvailable()) {
                    const buf = Buffer.from(cipherText.slice(6), 'base64');
                    return electron_1.safeStorage.decryptString(buf);
                }
            }
            else if (cipherText.startsWith('b64:')) {
                return Buffer.from(cipherText.slice(4), 'base64').toString('utf8');
            }
            else {
                // Plain JSON backward compatibility
                return cipherText;
            }
        }
        catch (err) {
            console.warn('[SpotifyPKCE] Decryption error:', err);
        }
        return null;
    }
    isConnected() {
        return Boolean(this.currentTokens && this.currentTokens.accessToken);
    }
    getTokenStatus() {
        return {
            connected: this.isConnected(),
            expiresAt: this.currentTokens?.expiresAt || 0,
            scope: this.currentTokens?.scope
        };
    }
    /**
     * Launch in-app BrowserWindow and perform RFC 7636 OAuth PKCE authorization.
     */
    async startAuthFlow() {
        if (!this.hasValidClientId()) {
            console.warn('[SpotifyPKCE] Cannot start Spotify Web API auth: Valid Spotify Developer Client ID not configured.');
            return false;
        }
        const verifier = generateCodeVerifier(64);
        const challenge = deriveCodeChallenge(verifier);
        const authUrl = buildAuthorizationUrl(this.clientId, this.redirectUri, challenge, this.scopes);
        return new Promise((resolve) => {
            if (this.activeAuthWindow && !this.activeAuthWindow.isDestroyed()) {
                this.activeAuthWindow.focus();
                resolve(false);
                return;
            }
            this.activeAuthWindow = new electron_1.BrowserWindow({
                width: 520,
                height: 720,
                show: true,
                title: 'Connect Spotify (RoboIsland)',
                autoHideMenuBar: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });
            let resolved = false;
            const finish = async (code, error) => {
                if (resolved)
                    return;
                resolved = true;
                if (this.activeAuthWindow && !this.activeAuthWindow.isDestroyed()) {
                    this.activeAuthWindow.destroy();
                    this.activeAuthWindow = null;
                }
                if (code) {
                    const success = await this.exchangeCodeForTokens(code, verifier);
                    resolve(success);
                }
                else {
                    if (error)
                        console.warn('[SpotifyPKCE] Authorization error:', error);
                    resolve(false);
                }
            };
            const handleNavigation = (url) => {
                if (url.startsWith(this.redirectUri) || url.startsWith('http://127.0.0.1:48913/callback')) {
                    const { code, error } = parseCallbackUrl(url);
                    finish(code, error);
                    return true;
                }
                return false;
            };
            // Intercept redirect navigation before network failure on 127.0.0.1
            this.activeAuthWindow.webContents.on('will-redirect', (event, url) => {
                if (handleNavigation(url)) {
                    event.preventDefault();
                }
            });
            this.activeAuthWindow.webContents.on('will-navigate', (event, url) => {
                if (handleNavigation(url)) {
                    event.preventDefault();
                }
            });
            this.activeAuthWindow.on('closed', () => {
                this.activeAuthWindow = null;
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            });
            this.activeAuthWindow.loadURL(authUrl).catch((err) => {
                console.warn('[SpotifyPKCE] Failed to load auth URL:', err);
                finish(undefined, err.message);
            });
        });
    }
    /**
     * Exchange authorization code for Spotify access & refresh tokens.
     */
    async exchangeCodeForTokens(code, verifier) {
        try {
            const bodyParams = new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: this.clientId,
                code,
                redirect_uri: this.redirectUri,
                code_verifier: verifier
            });
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: bodyParams.toString()
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[SpotifyPKCE] Token exchange failed HTTP', response.status, errorText);
                return false;
            }
            const json = await response.json();
            if (json.access_token) {
                const expiresInSec = Number(json.expires_in) || 3600;
                this.currentTokens = {
                    accessToken: json.access_token,
                    refreshToken: json.refresh_token || (this.currentTokens ? this.currentTokens.refreshToken : ''),
                    expiresAt: Date.now() + expiresInSec * 1000,
                    scope: json.scope
                };
                this.saveTokens();
                return true;
            }
        }
        catch (err) {
            console.error('[SpotifyPKCE] Error exchanging code for tokens:', err);
        }
        return false;
    }
    /**
     * Ensure access token is valid, auto-refreshing if expired or near expiration.
     */
    async getAccessToken() {
        if (!this.currentTokens || !this.currentTokens.accessToken) {
            return null;
        }
        // If token expires in less than 60 seconds, refresh it
        const now = Date.now();
        if (this.currentTokens.expiresAt - now < 60000 && this.currentTokens.refreshToken) {
            const refreshed = await this.refreshTokens();
            if (!refreshed) {
                console.warn('[SpotifyPKCE] Token auto-refresh failed, trying with existing token');
            }
        }
        return this.currentTokens ? this.currentTokens.accessToken : null;
    }
    /**
     * Refresh Spotify tokens using stored refresh_token.
     */
    async refreshTokens() {
        if (!this.currentTokens || !this.currentTokens.refreshToken) {
            return false;
        }
        try {
            const bodyParams = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: this.currentTokens.refreshToken,
                client_id: this.clientId
            });
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: bodyParams.toString()
            });
            if (!response.ok) {
                console.error('[SpotifyPKCE] Refresh token exchange failed HTTP', response.status);
                return false;
            }
            const json = await response.json();
            if (json.access_token) {
                const expiresInSec = Number(json.expires_in) || 3600;
                this.currentTokens.accessToken = json.access_token;
                if (json.refresh_token) {
                    this.currentTokens.refreshToken = json.refresh_token;
                }
                this.currentTokens.expiresAt = Date.now() + expiresInSec * 1000;
                if (json.scope) {
                    this.currentTokens.scope = json.scope;
                }
                this.saveTokens();
                return true;
            }
        }
        catch (err) {
            console.error('[SpotifyPKCE] Token refresh error:', err);
        }
        return false;
    }
    /**
     * Disconnect Spotify account and purge stored credentials.
     */
    async disconnect() {
        this.currentTokens = null;
        this.saveTokens();
    }
    /**
     * Spotify Connect: Fetch active and available playback devices
     */
    async getDevices() {
        const token = await this.getAccessToken();
        if (!token)
            return [];
        try {
            const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const json = await res.json();
                return json.devices || [];
            }
        }
        catch { }
        return [];
    }
    /**
     * Spotify Connect: Seamlessly transfer playback to target device
     */
    async transferPlayback(deviceId) {
        const token = await this.getAccessToken();
        if (!token)
            return false;
        try {
            const res = await fetch('https://api.spotify.com/v1/me/player', {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ device_ids: [deviceId], play: true })
            });
            return res.ok || res.status === 204;
        }
        catch { }
        return false;
    }
    /**
     * Direct token setter for unit testing and offline verification.
     */
    setTokensManually(tokens) {
        this.currentTokens = { ...tokens };
        this.saveTokens();
    }
}
exports.SpotifyPKCEClient = SpotifyPKCEClient;
