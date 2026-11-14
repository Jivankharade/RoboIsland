import { BrowserWindow, safeStorage, app } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
  scope?: string;
}

export interface SpotifyPKCEConfig {
  clientId?: string;
  redirectUri?: string;
  scopes?: string[];
  storagePath?: string;
}

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
export function generateCodeVerifier(length = 64): string {
  const clampedLength = Math.max(43, Math.min(128, length));
  // 96 random bytes provides ample base64url characters
  const raw = crypto.randomBytes(clampedLength).toString('base64url');
  return raw.slice(0, clampedLength);
}

/**
 * Derive an RFC 7636 SHA-256 base64url code challenge from a code verifier.
 */
export function deriveCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Build Spotify Authorization URL with PKCE S256 parameters.
 */
export function buildAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  challenge: string,
  scopes: string[] = DEFAULT_SCOPES
): string {
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
export function parseCallbackUrl(urlStr: string): { code?: string; error?: string } {
  try {
    const url = new URL(urlStr);
    const code = url.searchParams.get('code') || undefined;
    const error = url.searchParams.get('error') || undefined;
    return { code, error };
  } catch {
    return {};
  }
}

export class SpotifyPKCEClient {
  private clientId: string;
  private redirectUri: string;
  private scopes: string[];
  private storageFile: string;
  private currentTokens: SpotifyTokens | null = null;
  private activeAuthWindow: BrowserWindow | null = null;

  constructor(config: SpotifyPKCEConfig = {}) {
    this.clientId = config.clientId || DEFAULT_CLIENT_ID;
    this.redirectUri = config.redirectUri || DEFAULT_REDIRECT_URI;
    this.scopes = config.scopes || DEFAULT_SCOPES;

    const baseDir = config.storagePath || (
      (app && typeof app.getPath === 'function')
        ? app.getPath('userData')
        : (process.env.APPDATA ? path.join(process.env.APPDATA, 'RoboIsland') : path.join(process.cwd(), '.roboisland'))
    );
    try {
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
    } catch {}
    this.storageFile = path.join(baseDir, 'spotify-tokens.dat');
    this.loadTokens();
  }

  public hasValidClientId(): boolean {
    return Boolean(this.clientId && this.clientId.trim() && this.clientId !== DEFAULT_CLIENT_ID);
  }

  public setClientId(clientId: string): void {
    if (clientId && clientId.trim()) {
      this.clientId = clientId.trim();
    }
  }

  /**
   * Load securely stored tokens on initialization.
   */
  private loadTokens(): void {
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
    } catch (err) {
      console.warn('[SpotifyPKCE] Failed to load stored tokens:', err);
      this.currentTokens = null;
    }
  }

  /**
   * Persist tokens securely using safeStorage DPAPI when available.
   */
  private saveTokens(): void {
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
    } catch (err) {
      console.error('[SpotifyPKCE] Failed to save tokens securely:', err);
    }
  }

  private encryptData(plainText: string): string {
    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        const buffer = safeStorage.encryptString(plainText);
        return `dpapi:${buffer.toString('base64')}`;
      }
    } catch {}
    // Fallback obfuscation for non-DPAPI environments / test runners
    return `b64:${Buffer.from(plainText, 'utf8').toString('base64')}`;
  }

  private decryptData(cipherText: string): string | null {
    try {
      if (cipherText.startsWith('dpapi:')) {
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
          const buf = Buffer.from(cipherText.slice(6), 'base64');
          return safeStorage.decryptString(buf);
        }
      } else if (cipherText.startsWith('b64:')) {
        return Buffer.from(cipherText.slice(4), 'base64').toString('utf8');
      } else {
        // Plain JSON backward compatibility
        return cipherText;
      }
    } catch (err) {
      console.warn('[SpotifyPKCE] Decryption error:', err);
    }
    return null;
  }

  public isConnected(): boolean {
    return Boolean(this.currentTokens && this.currentTokens.accessToken);
  }

  public getTokenStatus(): { connected: boolean; expiresAt: number; scope?: string } {
    return {
      connected: this.isConnected(),
      expiresAt: this.currentTokens?.expiresAt || 0,
      scope: this.currentTokens?.scope
    };
  }

  /**
   * Launch in-app BrowserWindow and perform RFC 7636 OAuth PKCE authorization.
   */
  public async startAuthFlow(): Promise<boolean> {
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

      this.activeAuthWindow = new BrowserWindow({
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
      const finish = async (code?: string, error?: string) => {
        if (resolved) return;
        resolved = true;
        if (this.activeAuthWindow && !this.activeAuthWindow.isDestroyed()) {
          this.activeAuthWindow.destroy();
          this.activeAuthWindow = null;
        }

        if (code) {
          const success = await this.exchangeCodeForTokens(code, verifier);
          resolve(success);
        } else {
          if (error) console.warn('[SpotifyPKCE] Authorization error:', error);
          resolve(false);
        }
      };

      const handleNavigation = (url: string) => {
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
  public async exchangeCodeForTokens(code: string, verifier: string): Promise<boolean> {
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

      const json: any = await response.json();
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
    } catch (err) {
      console.error('[SpotifyPKCE] Error exchanging code for tokens:', err);
    }
    return false;
  }

  /**
   * Ensure access token is valid, auto-refreshing if expired or near expiration.
   */
  public async getAccessToken(): Promise<string | null> {
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
  public async refreshTokens(): Promise<boolean> {
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

      const json: any = await response.json();
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
    } catch (err) {
      console.error('[SpotifyPKCE] Token refresh error:', err);
    }
    return false;
  }

  /**
   * Disconnect Spotify account and purge stored credentials.
   */
  public async disconnect(): Promise<void> {
    this.currentTokens = null;
    this.saveTokens();
  }

  /**
   * Spotify Connect: Fetch active and available playback devices
   */
  public async getDevices(): Promise<any[]> {
    const token = await this.getAccessToken();
    if (!token) return [];
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json: any = await res.json();
        return json.devices || [];
      }
    } catch {}
    return [];
  }

  /**
   * Spotify Connect: Seamlessly transfer playback to target device
   */
  public async transferPlayback(deviceId: string): Promise<boolean> {
    const token = await this.getAccessToken();
    if (!token) return false;
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
    } catch {}
    return false;
  }

  /**
   * Direct token setter for unit testing and offline verification.
   */
  public setTokensManually(tokens: SpotifyTokens): void {
    this.currentTokens = { ...tokens };
    this.saveTokens();
  }
}
