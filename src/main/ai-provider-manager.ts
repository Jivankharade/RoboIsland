import { ipcMain, safeStorage, BrowserWindow } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import * as http from 'http';
import * as https from 'https';

export type AIProvider = 'openai' | 'anthropic' | 'custom' | 'ollama';

export interface AICredential {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface EncryptedVault {
  version: number;
  cipher: 'dpapi' | 'aes-gcm';
  data: string; // Base64 encoded payload
  updatedAt: number;
}

/**
 * Parses a single SSE line for OpenAI chat completions format.
 * Returns the delta content token if found, null otherwise, or '[DONE]' on stream termination.
 */
export function parseOpenAISSELine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return null;
  if (trimmed.startsWith('data: ')) {
    const payload = trimmed.slice(6).trim();
    if (payload === '[DONE]') return '[DONE]';
    try {
      const json = JSON.parse(payload);
      const delta = json.choices?.[0]?.delta?.content;
      return typeof delta === 'string' ? delta : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Parses a single SSE line for Anthropic Claude messages format.
 * Returns the text delta if found, null otherwise, or '[DONE]' on stream termination.
 */
export function parseClaudeSSELine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return null;
  if (trimmed.startsWith('data: ')) {
    const payload = trimmed.slice(6).trim();
    try {
      const json = JSON.parse(payload);
      if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
        return json.delta.text || null;
      }
      if (json.type === 'message_stop') {
        return '[DONE]';
      }
      return null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Secure Credential Storage using Electron safeStorage (Windows DPAPI)
 * with automatic fallback to AES-256-GCM using machine-specific salt.
 * No plaintext API keys are ever stored on disk.
 */
export class SecureCredentialStorage {
  private filePath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    } else {
      let baseDir = '';
      try {
        const { app } = require('electron');
        if (app && typeof app.getPath === 'function') {
          baseDir = path.join(app.getPath('userData'), 'secure');
        }
      } catch {
        // App not available yet
      }

      if (!baseDir) {
        const appData = process.env.APPDATA || (process.platform === 'darwin'
          ? path.join(os.homedir(), 'Library', 'Application Support')
          : path.join(os.homedir(), '.config'));
        baseDir = path.join(appData, 'RoboIsland', 'secure');
      }

      try {
        if (!fs.existsSync(baseDir)) {
          fs.mkdirSync(baseDir, { recursive: true });
        }
      } catch {
        baseDir = path.join(os.tmpdir(), 'roboisland-secure');
        if (!fs.existsSync(baseDir)) {
          fs.mkdirSync(baseDir, { recursive: true });
        }
      }

      this.filePath = path.join(baseDir, 'ai_credentials.enc');
    }
  }

  public getFilePath(): string {
    return this.filePath;
  }

  /**
   * Encrypt plaintext string using DPAPI or AES-256-GCM fallback.
   */
  public encrypt(plaintext: string): { cipher: 'dpapi' | 'aes-gcm'; data: string } {
    let dpapiAvailable = false;
    try {
      if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function') {
        dpapiAvailable = safeStorage.isEncryptionAvailable();
      }
    } catch {
      dpapiAvailable = false;
    }

    if (dpapiAvailable) {
      try {
        const encryptedBuffer = safeStorage.encryptString(plaintext);
        return {
          cipher: 'dpapi',
          data: encryptedBuffer.toString('base64')
        };
      } catch (err) {
        console.warn('[SecureCredentialStorage] DPAPI encryption failed, falling back to AES-GCM:', err);
      }
    }

    // AES-256-GCM fallback with machine-specific salt
    const machineSeed = `${os.hostname()}-${os.userInfo().username}-${os.platform()}-${os.arch()}`;
    const salt = crypto.createHash('sha256').update(`roboisland-secure-salt-${machineSeed}`).digest();
    const key = crypto.pbkdf2Sync(machineSeed, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload = JSON.stringify({
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: ciphertext.toString('base64')
    });

    return {
      cipher: 'aes-gcm',
      data: Buffer.from(payload, 'utf8').toString('base64')
    };
  }

  /**
   * Decrypt encrypted payload based on cipher type.
   */
  public decrypt(cipher: 'dpapi' | 'aes-gcm', data: string): string {
    if (cipher === 'dpapi') {
      try {
        const buffer = Buffer.from(data, 'base64');
        return safeStorage.decryptString(buffer);
      } catch (err) {
        throw new Error(`DPAPI decryption failed: ${(err as Error).message}`);
      }
    } else {
      const rawJson = Buffer.from(data, 'base64').toString('utf8');
      const { iv, tag, data: ciphertext } = JSON.parse(rawJson);
      const machineSeed = `${os.hostname()}-${os.userInfo().username}-${os.platform()}-${os.arch()}`;
      const salt = crypto.createHash('sha256').update(`roboisland-secure-salt-${machineSeed}`).digest();
      const key = crypto.pbkdf2Sync(machineSeed, salt, 100000, 32, 'sha256');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
      return decrypted.toString('utf8');
    }
  }

  /**
   * Save credentials record securely.
   */
  public saveCredentials(creds: Record<string, AICredential>): void {
    const plaintext = JSON.stringify(creds);
    const enc = this.encrypt(plaintext);
    const vault: EncryptedVault = {
      version: 1,
      cipher: enc.cipher,
      data: enc.data,
      updatedAt: Date.now()
    };
    fs.writeFileSync(this.filePath, JSON.stringify(vault, null, 2), 'utf8');
  }

  /**
   * Load and decrypt credentials record.
   */
  public loadCredentials(): Record<string, AICredential> {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const vault: EncryptedVault = JSON.parse(raw);
      const decryptedJson = this.decrypt(vault.cipher, vault.data);
      return JSON.parse(decryptedJson);
    } catch (err) {
      console.warn('[SecureCredentialStorage] Could not read encrypted vault:', err);
      return {};
    }
  }
}

/**
 * Multi-provider AI streaming client and manager.
 */
export class AIProviderManager {
  private storage: SecureCredentialStorage;
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(customStoragePath?: string) {
    this.storage = new SecureCredentialStorage(customStoragePath);
  }

  public getStorage(): SecureCredentialStorage {
    return this.storage;
  }

  public saveCredential(provider: string, apiKey: string, baseUrl?: string, model?: string): boolean {
    const creds = this.storage.loadCredentials();
    creds[provider] = {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl ? baseUrl.trim() : undefined,
      model: model ? model.trim() : undefined
    };
    this.storage.saveCredentials(creds);
    return true;
  }

  public getCredentialStatus(): Record<string, boolean> {
    const creds = this.storage.loadCredentials();
    return {
      openai: Boolean(creds.openai && creds.openai.apiKey && creds.openai.apiKey.length > 0),
      anthropic: Boolean(creds.anthropic && creds.anthropic.apiKey && creds.anthropic.apiKey.length > 0),
      custom: Boolean(creds.custom && (creds.custom.baseUrl || creds.custom.apiKey)),
      ollama: true
    };
  }

  public async getOllamaModels(): Promise<string[]> {
    try {
      const res = await fetch('http://127.0.0.1:11434/api/tags');
      if (res.ok) {
        const json = (await res.json()) as any;
        if (Array.isArray(json?.models) && json.models.length > 0) {
          return json.models.map((m: any) => m.name || m.model);
        }
      }
    } catch {}
    return ['llama3:latest', 'mistral:latest', 'qwen2.5:latest', 'deepseek-coder:latest'];
  }

  public getCredential(provider: string): AICredential | null {
    const creds = this.storage.loadCredentials();
    return creds[provider] || null;
  }

  /**
   * Cancel any active streaming session.
   */
  public abortStream(sessionId = 'default'): void {
    const controller = this.abortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(sessionId);
    }
  }

  /**
   * Multi-provider streaming method.
   * Connects via SSE and streams chunks as they arrive.
   */
  public async streamPrompt(
    provider: AIProvider | string,
    prompt: string,
    model?: string,
    onChunk?: (chunk: string) => void,
    onDone?: () => void,
    sessionId = 'default'
  ): Promise<string> {
    const cred = this.getCredential(provider);
    const controller = new AbortController();
    this.abortControllers.set(sessionId, controller);

    let fullOutput = '';
    const chunkEmitter = (chunk: string) => {
      fullOutput += chunk;
      if (onChunk) onChunk(chunk);
    };

    try {
      if (provider === 'anthropic') {
        await this.streamAnthropic(cred, prompt, model, chunkEmitter, controller.signal);
      } else if (provider === 'openai' || provider === 'custom' || provider === 'ollama') {
        await this.streamOpenAICompatible(provider, cred, prompt, model, chunkEmitter, controller.signal);
      } else {
        throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (err: any) {
      if (controller.signal.aborted) {
        chunkEmitter('\n[Request canceled]');
      } else {
        const msg = err.message || 'Unknown network error';
        if (provider === 'ollama' && (msg.includes('fetch failed') || msg.includes('ECONNREFUSED'))) {
          chunkEmitter('\n[Ollama is not running. Please start Ollama (`ollama serve`) to chat offline with local models.]');
        } else {
          chunkEmitter(`\n[AI Error: ${msg}]`);
        }
      }
    } finally {
      this.abortControllers.delete(sessionId);
      if (onDone) onDone();
    }

    return fullOutput;
  }

  private async streamOpenAICompatible(
    provider: string,
    cred: AICredential | null,
    prompt: string,
    requestedModel: string | undefined,
    onChunk: (chunk: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    const apiKey = cred?.apiKey || '';
    let baseUrl = cred?.baseUrl;

    if (!baseUrl) {
      if (provider === 'openai') {
        baseUrl = 'https://api.openai.com/v1';
      } else if (provider === 'ollama') {
        baseUrl = 'http://127.0.0.1:11434/v1';
      } else {
        baseUrl = 'http://localhost:11434/v1'; // Default Ollama endpoint
      }
    }
    baseUrl = baseUrl.replace(/\/+$/, '');

    if (provider === 'openai' && !apiKey) {
      onChunk('No API key configured for OpenAI. Please configure your API key in Settings.');
      return;
    }

    const endpoint = `${baseUrl}/chat/completions`;
    const model = requestedModel || cred?.model || (provider === 'openai' ? 'gpt-4o' : (provider === 'ollama' ? 'llama3:latest' : 'llama3'));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const payload = {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are Robo, a concise and friendly Windows Dynamic Island companion. Provide helpful answers with markdown formatting and code snippets when requested.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: true
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      let errBody = '';
      try {
        errBody = await response.text();
      } catch {}
      throw new Error(`HTTP ${response.status} ${response.statusText}${errBody ? `: ${errBody.slice(0, 150)}` : ''}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const token = parseOpenAISSELine(line);
        if (token === '[DONE]') {
          return;
        }
        if (token) {
          onChunk(token);
        }
      }
    }

    if (buffer.trim()) {
      const token = parseOpenAISSELine(buffer);
      if (token && token !== '[DONE]') {
        onChunk(token);
      }
    }
  }

  private async streamAnthropic(
    cred: AICredential | null,
    prompt: string,
    requestedModel: string | undefined,
    onChunk: (chunk: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    const apiKey = cred?.apiKey;
    if (!apiKey) {
      onChunk('No API key configured for Anthropic Claude. Please configure your API key in Settings.');
      return;
    }

    let baseUrl = cred?.baseUrl || 'https://api.anthropic.com/v1';
    baseUrl = baseUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/messages`;
    const model = requestedModel || cred?.model || 'claude-3-5-sonnet-20241022';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };

    const payload = {
      model,
      max_tokens: 4096,
      system: 'You are Robo, a concise and friendly Windows Dynamic Island companion. Provide helpful answers with markdown formatting and code snippets when requested.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: true
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      let errBody = '';
      try {
        errBody = await response.text();
      } catch {}
      throw new Error(`HTTP ${response.status} ${response.statusText}${errBody ? `: ${errBody.slice(0, 150)}` : ''}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const token = parseClaudeSSELine(line);
        if (token === '[DONE]') {
          return;
        }
        if (token) {
          onChunk(token);
        }
      }
    }

    if (buffer.trim()) {
      const token = parseClaudeSSELine(buffer);
      if (token && token !== '[DONE]') {
        onChunk(token);
      }
    }
  }

  /**
   * Triggers Windows Voice Typing (`Win + H`) via simulated user32 keybd_event.
   */
  public triggerVoiceTyping(): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') {
        resolve({ success: false, message: 'Windows Voice Typing (Win+H) is only supported on Windows.' });
        return;
      }

      const script = `
try {
  Add-Type -Namespace RoboWin -Name Keys -MemberDefinition @'
[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
'@
  # 0x5B = VK_LWIN, 0x48 = 'H'
  [RoboWin.Keys]::keybd_event(0x5B, 0, 0, [UIntPtr]::Zero)
  [RoboWin.Keys]::keybd_event(0x48, 0, 0, [UIntPtr]::Zero)
  [RoboWin.Keys]::keybd_event(0x48, 0, 2, [UIntPtr]::Zero)
  [RoboWin.Keys]::keybd_event(0x5B, 0, 2, [UIntPtr]::Zero)
  Write-Output "OK"
} catch {
  Write-Error $_.Exception.Message
}
`;

      child_process.exec(`powershell -NoProfile -NonInteractive -Command "${script.replace(/\r?\n/g, ' ')}"`, (err, stdout) => {
        if (err) {
          resolve({ success: false, message: err.message });
        } else {
          resolve({ success: true, message: stdout.trim() });
        }
      });
    });
  }

  /**
   * Speaks response aloud using Windows SpeechSynthesizer.
   */
  public speakTTS(text: string): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      if (!text || text.trim().length === 0) {
        resolve({ success: true });
        return;
      }

      if (process.platform !== 'win32') {
        resolve({ success: true, message: 'Platform fallback' });
        return;
      }

      const safeText = text.replace(/["'`$\\]/g, ' ').substring(0, 500);
      const script = `
try {
  Add-Type -AssemblyName System.Speech
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.Rate = 1
  $synth.Speak('${safeText}')
} catch {}
`;

      child_process.exec(`powershell -NoProfile -NonInteractive -Command "${script.replace(/\r?\n/g, ' ')}"`, (err) => {
        if (err) {
          resolve({ success: false, message: err.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }
}

/**
 * Register Main Process IPC Handlers for AI Chat.
 */
export function registerAIProviderIPC(manager: AIProviderManager): void {
  ipcMain.handle('ai-chat:send-prompt', async (event, args: { provider: AIProvider; prompt: string; model?: string }) => {
    const { provider, prompt, model } = args || {};
    const win = BrowserWindow.fromWebContents(event.sender);

    let result = '';
    await manager.streamPrompt(
      provider || 'openai',
      prompt || '',
      model,
      (chunk: string) => {
        result += chunk;
        if (win && !win.isDestroyed()) {
          win.webContents.send('ai-chat:chunk', chunk);
        }
      },
      () => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('ai-chat:done');
        }
      }
    );

    return result;
  });

  ipcMain.handle('ai-chat:save-credentials', async (_event, args: { provider: string; apiKey: string; baseUrl?: string; model?: string }) => {
    if (!args || !args.provider) return false;
    return manager.saveCredential(args.provider, args.apiKey || '', args.baseUrl, args.model);
  });

  ipcMain.handle('ai-chat:get-credential-status', async () => {
    return manager.getCredentialStatus();
  });

  ipcMain.handle('ai-chat:get-ollama-models', async () => {
    return manager.getOllamaModels();
  });

  ipcMain.handle('ai-chat:voice-typing', async () => {
    return manager.triggerVoiceTyping();
  });

  ipcMain.handle('ai-chat:speak-tts', async (_event, text: string) => {
    return manager.speakTTS(text || '');
  });
}
