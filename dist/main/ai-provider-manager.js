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
exports.AIProviderManager = exports.SecureCredentialStorage = void 0;
exports.parseOpenAISSELine = parseOpenAISSELine;
exports.parseClaudeSSELine = parseClaudeSSELine;
exports.registerAIProviderIPC = registerAIProviderIPC;
const electron_1 = require("electron");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process = __importStar(require("child_process"));
/**
 * Parses a single SSE line for OpenAI chat completions format.
 * Returns the delta content token if found, null otherwise, or '[DONE]' on stream termination.
 */
function parseOpenAISSELine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':'))
        return null;
    if (trimmed.startsWith('data: ')) {
        const payload = trimmed.slice(6).trim();
        if (payload === '[DONE]')
            return '[DONE]';
        try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            return typeof delta === 'string' ? delta : null;
        }
        catch {
            return null;
        }
    }
    return null;
}
/**
 * Parses a single SSE line for Anthropic Claude messages format.
 * Returns the text delta if found, null otherwise, or '[DONE]' on stream termination.
 */
function parseClaudeSSELine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':'))
        return null;
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
        }
        catch {
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
class SecureCredentialStorage {
    filePath;
    constructor(customPath) {
        if (customPath) {
            this.filePath = customPath;
        }
        else {
            let baseDir = '';
            try {
                const { app } = require('electron');
                if (app && typeof app.getPath === 'function') {
                    baseDir = path.join(app.getPath('userData'), 'secure');
                }
            }
            catch {
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
            }
            catch {
                baseDir = path.join(os.tmpdir(), 'roboisland-secure');
                if (!fs.existsSync(baseDir)) {
                    fs.mkdirSync(baseDir, { recursive: true });
                }
            }
            this.filePath = path.join(baseDir, 'ai_credentials.enc');
        }
    }
    getFilePath() {
        return this.filePath;
    }
    /**
     * Encrypt plaintext string using DPAPI or AES-256-GCM fallback.
     */
    encrypt(plaintext) {
        let dpapiAvailable = false;
        try {
            if (electron_1.safeStorage && typeof electron_1.safeStorage.isEncryptionAvailable === 'function') {
                dpapiAvailable = electron_1.safeStorage.isEncryptionAvailable();
            }
        }
        catch {
            dpapiAvailable = false;
        }
        if (dpapiAvailable) {
            try {
                const encryptedBuffer = electron_1.safeStorage.encryptString(plaintext);
                return {
                    cipher: 'dpapi',
                    data: encryptedBuffer.toString('base64')
                };
            }
            catch (err) {
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
    decrypt(cipher, data) {
        if (cipher === 'dpapi') {
            try {
                const buffer = Buffer.from(data, 'base64');
                return electron_1.safeStorage.decryptString(buffer);
            }
            catch (err) {
                throw new Error(`DPAPI decryption failed: ${err.message}`);
            }
        }
        else {
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
    saveCredentials(creds) {
        const plaintext = JSON.stringify(creds);
        const enc = this.encrypt(plaintext);
        const vault = {
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
    loadCredentials() {
        if (!fs.existsSync(this.filePath)) {
            return {};
        }
        try {
            const raw = fs.readFileSync(this.filePath, 'utf8');
            const vault = JSON.parse(raw);
            const decryptedJson = this.decrypt(vault.cipher, vault.data);
            return JSON.parse(decryptedJson);
        }
        catch (err) {
            console.warn('[SecureCredentialStorage] Could not read encrypted vault:', err);
            return {};
        }
    }
}
exports.SecureCredentialStorage = SecureCredentialStorage;
/**
 * Multi-provider AI streaming client and manager.
 */
class AIProviderManager {
    storage;
    abortControllers = new Map();
    constructor(customStoragePath) {
        this.storage = new SecureCredentialStorage(customStoragePath);
    }
    getStorage() {
        return this.storage;
    }
    saveCredential(provider, apiKey, baseUrl, model) {
        const creds = this.storage.loadCredentials();
        creds[provider] = {
            apiKey: apiKey.trim(),
            baseUrl: baseUrl ? baseUrl.trim() : undefined,
            model: model ? model.trim() : undefined
        };
        this.storage.saveCredentials(creds);
        return true;
    }
    getCredentialStatus() {
        const creds = this.storage.loadCredentials();
        return {
            openai: Boolean(creds.openai && creds.openai.apiKey && creds.openai.apiKey.length > 0),
            anthropic: Boolean(creds.anthropic && creds.anthropic.apiKey && creds.anthropic.apiKey.length > 0),
            custom: Boolean(creds.custom && (creds.custom.baseUrl || creds.custom.apiKey)),
            ollama: true,
            gemini: Boolean(creds.gemini && creds.gemini.apiKey && creds.gemini.apiKey.length > 0)
        };
    }
    async getOllamaModels() {
        try {
            const res = await fetch('http://127.0.0.1:11434/api/tags');
            if (res.ok) {
                const json = (await res.json());
                if (Array.isArray(json?.models) && json.models.length > 0) {
                    return json.models.map((m) => m.name || m.model);
                }
            }
        }
        catch { }
        return ['llama3:latest', 'mistral:latest', 'qwen2.5:latest', 'deepseek-coder:latest'];
    }
    getCredential(provider) {
        const creds = this.storage.loadCredentials();
        return creds[provider] || null;
    }
    /**
     * Cancel any active streaming session.
     */
    abortStream(sessionId = 'default') {
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
    async streamPrompt(provider, prompt, model, onChunk, onDone, sessionId = 'default', imageData) {
        const cred = this.getCredential(provider);
        const controller = new AbortController();
        this.abortControllers.set(sessionId, controller);
        let fullOutput = '';
        const chunkEmitter = (chunk) => {
            fullOutput += chunk;
            if (onChunk)
                onChunk(chunk);
        };
        try {
            if (provider === 'anthropic') {
                await this.streamAnthropic(cred, prompt, model, chunkEmitter, controller.signal, imageData);
            }
            else if (provider === 'openai' || provider === 'custom' || provider === 'ollama' || provider === 'gemini') {
                await this.streamOpenAICompatible(provider, cred, prompt, model, chunkEmitter, controller.signal, imageData, undefined);
            }
            else {
                throw new Error(`Unsupported AI provider: ${provider}`);
            }
        }
        catch (err) {
            if (controller.signal.aborted) {
                chunkEmitter('\n[Request canceled]');
            }
            else {
                const msg = err.message || 'Unknown network error';
                if (provider === 'ollama' && (msg.includes('fetch failed') || msg.includes('ECONNREFUSED'))) {
                    chunkEmitter('\n[Ollama is not running. Please start Ollama (`ollama serve`) to chat offline with local models.]');
                }
                else {
                    chunkEmitter(`\n[AI Error: ${msg}]`);
                }
            }
        }
        finally {
            this.abortControllers.delete(sessionId);
            if (onDone)
                onDone();
        }
        return fullOutput;
    }
    /**
     * Stream with a custom system prompt — used by the autonomous action agent
     * so its JARVIS system instruction is not overridden by the default "You are Robo…" message.
     */
    async streamWithSystem(systemPrompt, provider, userPrompt, model, onChunk, onDone, sessionId) {
        const cred = this.getCredential(provider);
        const sid = sessionId || 'sys-' + Date.now();
        const controller = new AbortController();
        this.abortControllers.set(sid, controller);
        let fullOutput = '';
        const chunkEmitter = (chunk) => {
            fullOutput += chunk;
            if (onChunk)
                onChunk(chunk);
        };
        try {
            await this.streamOpenAICompatible(provider, cred, userPrompt, model, chunkEmitter, controller.signal, undefined, systemPrompt);
        }
        catch (err) {
            chunkEmitter(`[Error: ${err.message}]`);
        }
        finally {
            this.abortControllers.delete(sid);
            if (onDone)
                onDone();
        }
        return fullOutput;
    }
    async streamOpenAICompatible(provider, cred, prompt, requestedModel, onChunk, signal, imageData, overrideSystemPrompt) {
        const apiKey = cred?.apiKey || '';
        let baseUrl = cred?.baseUrl;
        if (!baseUrl) {
            if (provider === 'openai') {
                baseUrl = 'https://api.openai.com/v1';
            }
            else if (provider === 'gemini') {
                baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
            }
            else if (provider === 'ollama') {
                baseUrl = 'http://127.0.0.1:11434/v1';
            }
            else {
                baseUrl = 'http://localhost:11434/v1'; // Default Ollama endpoint
            }
        }
        baseUrl = baseUrl.replace(/\/+$/, '');
        if (provider === 'openai' && !apiKey) {
            onChunk('No API key configured for OpenAI. Please configure your API key in Settings.');
            return;
        }
        if (provider === 'gemini' && !apiKey) {
            onChunk('No API key configured for Google Gemini. Please paste your free Gemini API key in Settings (get one at aistudio.google.com).');
            return;
        }
        const endpoint = `${baseUrl}/chat/completions`;
        let model = requestedModel || cred?.model || (provider === 'openai' ? 'gpt-4o' : (provider === 'gemini' ? 'gemini-3-flash-preview' : (provider === 'ollama' ? 'llama3:latest' : 'llama3')));
        if (provider === 'gemini' && (!model || model === 'gemini-1.5-flash' || model === 'gemini-2.0-flash')) {
            model = 'gemini-3-flash-preview';
        }
        const headers = {
            'Content-Type': 'application/json'
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        const userContent = imageData ? [
            {
                type: 'text',
                text: prompt || 'Analyze what is visible on my screen and provide concise, helpful insights or troubleshooting steps.'
            },
            {
                type: 'image_url',
                image_url: {
                    url: imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`
                }
            }
        ] : prompt;
        const systemMessage = overrideSystemPrompt
            ? overrideSystemPrompt
            : 'You are Robo, Gaurav\'s autonomous Windows Dynamic Island assistant. You possess native OS automation and Computer Use tools (WhatsApp messaging, Chrome search, RAM optimization, app launching, screen vision, and keyboard/mouse control). Assist Gaurav enthusiastically and execute desktop tasks autonomously.';
        const payload = {
            model,
            messages: [
                {
                    role: 'system',
                    content: systemMessage
                },
                {
                    role: 'user',
                    content: userContent
                }
            ],
            stream: true
        };
        const candidateModels = provider === 'gemini'
            ? Array.from(new Set([
                model,
                'gemini-3-flash-preview',
                'gemini-3.1-flash-lite-preview',
                'gemini-3.8-flash',
                'gemini-flash-latest'
            ]))
            : [model];
        let response = null;
        let lastError = null;
        for (let i = 0; i < candidateModels.length; i++) {
            const currentModel = candidateModels[i];
            payload.model = currentModel;
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    signal
                });
                if (res.ok) {
                    response = res;
                    break;
                }
                let errBody = '';
                try {
                    errBody = await res.text();
                }
                catch { }
                lastError = new Error(`HTTP ${res.status} ${res.statusText}${errBody ? `: ${errBody.slice(0, 150)}` : ''}`);
                // If 503 (high demand) or 429 or 500, attempt failover to next candidate model
                if ((res.status === 503 || res.status === 429 || res.status >= 500) && i < candidateModels.length - 1) {
                    console.warn(`[AIProviderManager] Model ${currentModel} returned ${res.status}. Failing over to ${candidateModels[i + 1]}...`);
                    await new Promise((r) => setTimeout(r, 600));
                    continue;
                }
                throw lastError;
            }
            catch (err) {
                if (signal.aborted)
                    throw err;
                lastError = err;
                if (i < candidateModels.length - 1) {
                    continue;
                }
                throw lastError;
            }
        }
        if (!response || !response.ok) {
            throw lastError || new Error('All model attempts failed');
        }
        if (!response.body) {
            throw new Error('Response body is null');
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
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
    async streamAnthropic(cred, prompt, requestedModel, onChunk, signal, imageData) {
        const apiKey = cred?.apiKey;
        if (!apiKey) {
            onChunk('No API key configured for Anthropic Claude. Please configure your API key in Settings.');
            return;
        }
        let baseUrl = cred?.baseUrl || 'https://api.anthropic.com/v1';
        baseUrl = baseUrl.replace(/\/+$/, '');
        const endpoint = `${baseUrl}/messages`;
        const model = requestedModel || cred?.model || 'claude-3-5-sonnet-20241022';
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        };
        let userContent = prompt;
        if (imageData) {
            const base64Data = imageData.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
            userContent = [
                {
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: 'image/jpeg',
                        data: base64Data
                    }
                },
                {
                    type: 'text',
                    text: prompt || 'Analyze what is visible on my screen and provide concise, helpful insights or troubleshooting steps.'
                }
            ];
        }
        const payload = {
            model,
            max_tokens: 4096,
            system: 'You are Robo, Gaurav\'s autonomous Windows Dynamic Island assistant. You possess native OS automation and Computer Use tools (WhatsApp messaging, Chrome search, RAM optimization, app launching, screen vision, and keyboard/mouse control). Assist Gaurav enthusiastically and execute desktop tasks autonomously.',
            messages: [
                {
                    role: 'user',
                    content: userContent
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
            }
            catch { }
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
            if (done)
                break;
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
    triggerVoiceTyping() {
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
                }
                else {
                    resolve({ success: true, message: stdout.trim() });
                }
            });
        });
    }
    /**
     * Speaks response aloud using Windows SpeechSynthesizer.
     */
    speakTTS(text) {
        return new Promise((resolve) => {
            if (!text || text.trim().length === 0) {
                resolve({ success: true });
                return;
            }
            if (process.platform === 'linux') {
                const safeText = text.replace(/["'`$\\]/g, ' ').substring(0, 500);
                child_process.exec(`spd-say "${safeText}" 2>/dev/null || espeak "${safeText}" 2>/dev/null`, (err) => {
                    resolve({ success: !err });
                });
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
                }
                else {
                    resolve({ success: true });
                }
            });
        });
    }
    /**
     * Captures the primary desktop screen for Robo Vision.
     * Briefly sets Island window opacity to 0 so it does not obscure desktop content.
     */
    async captureScreen(senderWebContents) {
        try {
            let win = null;
            if (senderWebContents) {
                win = electron_1.BrowserWindow.fromWebContents(senderWebContents);
            }
            const wasVisible = win && !win.isDestroyed() && win.isVisible();
            if (win && wasVisible) {
                win.setOpacity(0);
            }
            // Small delay to let the DWM compositor present the clean desktop
            await new Promise((r) => setTimeout(r, 120));
            const sources = await electron_1.desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 }
            });
            if (win && wasVisible && !win.isDestroyed()) {
                win.setOpacity(1);
            }
            if (!sources || sources.length === 0) {
                return { success: false, error: 'No display sources found.' };
            }
            // Primary screen source
            const primarySource = sources[0];
            const thumbnail = primarySource.thumbnail;
            if (!thumbnail || thumbnail.isEmpty()) {
                return { success: false, error: 'Failed to capture screenshot.' };
            }
            const jpegBuffer = thumbnail.toJPEG(85);
            const dataUrl = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
            const size = thumbnail.getSize();
            return {
                success: true,
                dataUrl,
                width: size.width,
                height: size.height
            };
        }
        catch (err) {
            return { success: false, error: err.message || 'Screen capture failed' };
        }
    }
}
exports.AIProviderManager = AIProviderManager;
/**
 * Register Main Process IPC Handlers for AI Chat.
 */
function registerAIProviderIPC(manager, actionAgent) {
    electron_1.ipcMain.handle('ai-chat:capture-screen', async (event) => {
        return manager.captureScreen(event.sender);
    });
    electron_1.ipcMain.handle('ai-chat:send-prompt', async (event, args) => {
        const { provider, prompt, model, imageData, fileText } = args || {};
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        // If a file (PDF/text) was attached, prepend its content to the prompt
        const enrichedPrompt = fileText
            ? `The user attached a document with the following content:\n\n---\n${fileText}\n---\n\nUser question: ${prompt}`
            : prompt;
        // Autonomous Agent Action Interceptor (Zero-click execution on Windows)
        if (actionAgent && !imageData && !fileText && typeof actionAgent.processCommand === 'function') {
            try {
                const actionResult = await actionAgent.processCommand(prompt);
                if (actionResult && actionResult.isAction) {
                    const reply = actionResult.replyText || 'Task executed successfully.';
                    if (win && !win.isDestroyed()) {
                        win.webContents.send('ai-chat:chunk', reply);
                        win.webContents.send('ai-chat:done');
                    }
                    return reply;
                }
            }
            catch (err) {
                console.warn('[AIProviderManager] Action agent interceptor error:', err);
            }
        }
        let result = '';
        await manager.streamPrompt(provider || 'openai', enrichedPrompt || '', model, (chunk) => {
            result += chunk;
            if (win && !win.isDestroyed()) {
                win.webContents.send('ai-chat:chunk', chunk);
            }
        }, () => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('ai-chat:done');
            }
        }, 'default', imageData);
        return result;
    });
    electron_1.ipcMain.handle('ai-chat:save-credentials', async (_event, args) => {
        if (!args || !args.provider)
            return false;
        return manager.saveCredential(args.provider, args.apiKey || '', args.baseUrl, args.model);
    });
    // PDF / Text File Reader — extracts text content from uploaded documents
    electron_1.ipcMain.handle('ai-chat:read-file', async (_event, filePath) => {
        try {
            const ext = filePath.toLowerCase().split('.').pop() || '';
            if (['txt', 'md', 'csv', 'json', 'xml', 'html', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'css', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'log', 'sql', 'sh', 'bat', 'ps1'].includes(ext)) {
                // Plain text file — read directly
                const content = fs.readFileSync(filePath, 'utf-8');
                return { success: true, text: content, name: path.basename(filePath) };
            }
            else if (ext === 'pdf') {
                // PDF — extract text via PowerShell + .NET
                return await new Promise((resolve) => {
                    const safePath = filePath.replace(/'/g, "''");
                    const psScript = `
            Add-Type -Path "$env:windir\\Microsoft.NET\\Framework64\\v4.0.30319\\System.dll" -ErrorAction SilentlyContinue
            try {
              Add-Type -AssemblyName 'System.Windows.Forms' -ErrorAction SilentlyContinue
              $pdfPath = '${safePath}'
              $sb = New-Object System.Text.StringBuilder
              # Use iTextSharp-like approach via Shell.Application
              $shell = New-Object -ComObject Shell.Application
              $folder = $shell.Namespace([System.IO.Path]::GetDirectoryName($pdfPath))
              $file = $folder.ParseName([System.IO.Path]::GetFileName($pdfPath))
              # Fallback: read raw bytes and extract ASCII text between stream markers
              $bytes = [System.IO.File]::ReadAllBytes($pdfPath)
              $raw = [System.Text.Encoding]::UTF8.GetString($bytes)
              # Extract text between BT...ET markers (PDF text objects)
              $matches = [regex]::Matches($raw, '\\(([^)]+)\\)')
              $textParts = @()
              foreach ($m in $matches) {
                $val = $m.Groups[1].Value
                if ($val.Length -gt 2 -and $val -notmatch '^[\\x00-\\x1f]+$') {
                  $textParts += $val
                }
              }
              $result = ($textParts -join ' ').Trim()
              if ($result.Length -lt 50) {
                # If regex extraction fails, try reading with pdftotext if available
                $pdfToText = Get-Command pdftotext -ErrorAction SilentlyContinue
                if ($pdfToText) {
                  $tmpFile = [System.IO.Path]::GetTempFileName()
                  & pdftotext '${safePath}' $tmpFile 2>$null
                  $result = Get-Content $tmpFile -Raw -ErrorAction SilentlyContinue
                  Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
                }
              }
              if ($result.Length -gt 0) {
                Write-Output $result
              } else {
                Write-Output "[PDF text extraction limited. The document may contain scanned images. Try a text-based PDF.]"
              }
            } catch {
              Write-Output "[Error reading PDF: $_]"
            }
          `;
                    const { spawn } = require('child_process');
                    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
                        windowsHide: true,
                        stdio: ['ignore', 'pipe', 'pipe']
                    });
                    let stdout = '';
                    ps.stdout?.on('data', (d) => { stdout += d.toString(); });
                    ps.on('close', () => {
                        resolve({ success: true, text: stdout.trim() || '[Could not extract PDF text]', name: path.basename(filePath) });
                    });
                    ps.on('error', () => {
                        resolve({ success: false, text: '[PDF read error]', name: path.basename(filePath) });
                    });
                });
            }
            else {
                // Unsupported file type — try reading as text
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    return { success: true, text: content, name: path.basename(filePath) };
                }
                catch {
                    return { success: false, text: `[Unsupported file type: .${ext}]`, name: path.basename(filePath) };
                }
            }
        }
        catch (err) {
            return { success: false, text: `[Error: ${err.message}]`, name: path.basename(filePath) };
        }
    });
    electron_1.ipcMain.handle('ai-chat:get-credential-status', async () => {
        return manager.getCredentialStatus();
    });
    electron_1.ipcMain.handle('ai-chat:get-ollama-models', async () => {
        return manager.getOllamaModels();
    });
    electron_1.ipcMain.handle('ai-chat:voice-typing', async () => {
        return manager.triggerVoiceTyping();
    });
    electron_1.ipcMain.handle('ai-chat:speak-tts', async (_event, text) => {
        return manager.speakTTS(text || '');
    });
}
