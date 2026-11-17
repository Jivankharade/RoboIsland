import { shell, clipboard, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import * as path from 'path';
import { AIProviderManager } from './ai-provider-manager';
import { SystemDiagnosticsManager } from './system-diagnostics';

export interface AgentActionResponse {
  action: string;
  params: Record<string, any>;
  spokenConfirmation?: string;
  displayHeadline?: string;
  displayBody?: string;
}

/** JARVIS system prompt for intent classification */
const JARVIS_SYSTEM = `You are JARVIS, the autonomous OS action agent for Gaurav's Windows laptop.
Translate the user's request into a SINGLE executable system action JSON object.

Available actions (choose the BEST match):
- send_whatsapp:    params: { contact: string, message: string }
- call_whatsapp:    params: { contact?: string }
- open_url:         params: { url: string, targetName?: string }
- launch_app:       params: { app: string }
- search_web:       params: { query: string }
- play_youtube:     params: { query: string }
- open_file:        params: { path?: string }
- summarize_screen: params: {}
- fix_screen_bug:   params: {}
- take_screenshot:  params: {}
- optimize_ram:     params: {}
- clean_junk:       params: {}
- set_volume:       params: { level: number }  (0-100)
- mute_audio:       params: {}
- open_settings:    params: { page?: string }
- lock_screen:      params: {}
- shutdown:         params: {}
- restart:          params: {}
- chat_reply:       params: { text: string }  (use ONLY if no system action fits)

Rules:
- Prefer a specific action over chat_reply whenever possible
- Extract contact name & message for WhatsApp commands
- For YouTube/music, use play_youtube; for general web, use open_url
- For app names, use launch_app

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "action": "<action>",
  "params": {},
  "spokenConfirmation": "Short natural JARVIS response to speak aloud",
  "displayHeadline": "Under 22 chars",
  "displayBody": "Under 60 chars"
}`;

export class AutonomousActionAgent {
  private aiManager: AIProviderManager;
  private diagnostics: SystemDiagnosticsManager;

  constructor(aiManager: AIProviderManager, diagnostics: SystemDiagnosticsManager) {
    this.aiManager = aiManager;
    this.diagnostics = diagnostics;
  }

  /**
   * Evaluates natural language command, determines if an autonomous system action is requested,
   * executes the action natively on Windows, and speaks/displays the result.
   */
  public async processCommand(rawInput: string): Promise<{ isAction: boolean; replyText?: string }> {
    const input = (rawInput || '').trim();
    if (!input) return { isAction: false };

    const lower = input.toLowerCase();

    // ─── FAST-PATH REGEX (zero API calls, instant execution) ─────────────────

    // YouTube
    const ytMatch = lower.match(/^(?:open|play|launch|search|find)\s+youtube(?:\s+(?:and\s+(?:play|search))?\s*(.+))?$/i)
      || input.match(/^(?:play|search)\s+(.+?)\s+on\s+youtube$/i);
    if (ytMatch || /youtube\.com/.test(lower)) {
      const q = (ytMatch?.[1] || '').trim();
      const url = q
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
        : 'https://www.youtube.com';
      await this.executeOpenUrl(url, 'YouTube');
      return { isAction: true, replyText: q ? `Searching YouTube for "${q}".` : 'Opening YouTube.' };
    }

    // WhatsApp SEND — highest priority
    const waSendMatch = input.match(/(?:send|message|msg|text|whatsapp)\s+(?:a\s+)?(?:message\s+)?(?:to\s+)?([A-Za-z]+)(?:\s+(?:saying?|that|on\s+whatsapp)?)?\s+["""']?(.+?)["""']?$/i)
      || input.match(/(?:send|message|msg)\s+["""'](.+?)["""']\s+to\s+([A-Za-z]+)/i)
      || input.match(/(?:whatsapp|wa)\s+([A-Za-z]+)\s+["""']?(.+)["""']?/i);
    if (waSendMatch || /(send|message|msg|text)\s+(.*?)\s+(on\s+)?whatsapp/i.test(lower)) {
      let contact = '';
      let message = 'Hi';
      if (waSendMatch) {
        contact = waSendMatch[1] || waSendMatch[2] || '';
        message = waSendMatch[2] || waSendMatch[1] || 'Hi';
        // Fix if contact is likely the message
        if (contact.split(' ').length > 2) { [contact, message] = [message, contact]; }
      }
      // Better extraction using NLP-style rules
      const contactMatch = input.match(/(?:to|for)\s+([A-Za-z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      const msgMatch = input.match(/(?:say(?:ing)?|message(?:\s+saying)?|that|text)\s+["""']?(.+?)["""']?$/i);
      if (contactMatch) contact = contactMatch[1];
      if (msgMatch) message = msgMatch[1];
      await this.executeSendWhatsApp(contact, message);
      return { isAction: true, replyText: `Sending "${message}" to ${contact || 'your contact'} on WhatsApp.` };
    }

    // WhatsApp CALL
    if (/(call|ring|dial)\s+(.+?)\s+(?:on\s+)?(?:whatsapp|wa)/i.test(lower) || /(whatsapp|wa)\s+call\s+(.+)/i.test(lower)) {
      const callMatch = lower.match(/(?:call|ring|dial)\s+(.+?)\s+(?:on\s+)?(?:whatsapp|wa)/i)
        || lower.match(/(?:whatsapp|wa)\s+call\s+(.+)/i);
      await this.executeCallWhatsApp(callMatch?.[1]?.trim());
      return { isAction: true, replyText: `Calling ${callMatch?.[1] || 'contact'} on WhatsApp.` };
    }

    // Open WhatsApp (plain)
    if (/^(?:open|launch|start)\s+whatsapp$/i.test(lower)) {
      this.safeOpenExternal('whatsapp://');
      this.notifyIsland({ id: 'wa-open', title: 'WhatsApp', body: 'Opening WhatsApp Desktop...', kind: 'whatsapp', durationMs: 3000 });
      return { isAction: true, replyText: 'Opening WhatsApp.' };
    }

    // Screen Summarize
    if (/(?:summar(?:ise|ize)|read|analyze|analyse|describe)\s+(?:my\s+)?(?:the\s+)?screen/i.test(lower) || lower === 'summarise' || lower === 'summarize') {
      await this.executeSummarizeScreen();
      return { isAction: true, replyText: 'Analyzing your screen now.' };
    }

    // RAM/Memory Optimize
    if (/(?:free|optimize|clean|clear|boost)\s+(?:the\s+)?(?:ram|memory|mem)/i.test(lower)) {
      await this.diagnostics.optimizeMemory();
      return { isAction: true, replyText: 'Memory optimized.' };
    }

    // Junk Cleanup
    if (/(?:clean|purge|delete|clear|wipe)\s+(?:laptop\s+|system\s+|my\s+)?(?:junk|temp|cache|trash|garbage)/i.test(lower)
      || /(?:clean|optimize|speed\s+up)\s+(?:my\s+)?(?:laptop|pc|computer|system)$/i.test(lower)) {
      await this.diagnostics.cleanJunkFiles();
      return { isAction: true, replyText: 'Junk files purged. Your laptop is cleaner.' };
    }

    // Lock screen
    if (/^(?:lock|lock\s+(?:my\s+)?(?:screen|computer|pc|laptop))$/i.test(lower)) {
      exec('rundll32.exe user32.dll,LockWorkStation');
      return { isAction: true, replyText: 'Locking your screen.' };
    }

    // Screenshot
    if (/^(?:take|capture|grab)\s+(?:a\s+)?screenshot$/i.test(lower)) {
      exec('powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'%{PRTSC}\')"');
      this.notifyIsland({ id: 'ss', title: 'Screenshot', body: 'Screenshot copied to clipboard.', kind: 'done', durationMs: 3000 });
      return { isAction: true, replyText: 'Screenshot captured.' };
    }

    // Volume control
    const volMatch = lower.match(/(?:set\s+)?(?:volume|vol)\s+(?:to\s+)?(\d{1,3})(?:\s*%)?/i);
    if (volMatch) {
      const level = Math.min(100, Math.max(0, parseInt(volMatch[1])));
      const nircmd = `nircmd setsysvolume ${Math.round(level / 100 * 65535)}`;
      exec(nircmd, () => {});
      exec(`powershell -c "[Audio]::Volume = ${level / 100}"`, () => {});
      return { isAction: true, replyText: `Volume set to ${level}%.` };
    }
    if (/^(?:mute|silence|quiet)(?:\s+(?:audio|sound|volume))?$/i.test(lower)) {
      exec('nircmd mutesysvolume 1', () => {});
      exec('powershell -c "(New-Object -com WScript.Shell).SendKeys([char]173)"', () => {});
      return { isAction: true, replyText: 'Audio muted.' };
    }

    // App launches (Chrome, Edge, Notepad, Calculator, Spotify, VSCode, Terminal, Explorer, Settings)
    const appLaunchMatch = lower.match(/^(?:open|launch|start|run)\s+(.+)$/i);
    if (appLaunchMatch) {
      const appName = appLaunchMatch[1].trim();
      const handled = await this.tryLaunchNamedApp(appName);
      if (handled) return { isAction: true, replyText: `Opening ${appName}.` };
    }

    // Web search
    const webSearchMatch = input.match(/^(?:search|google|look\s+up|find)\s+(.+?)(?:\s+on(?:\s+the\s+web|\s+google))?$/i);
    if (webSearchMatch) {
      const q = webSearchMatch[1].trim();
      await this.executeOpenUrl(`https://www.google.com/search?q=${encodeURIComponent(q)}`, 'Google Search');
      return { isAction: true, replyText: `Searching Google for "${q}".` };
    }

    // Settings
    if (/^(?:open|show)\s+(?:windows\s+)?settings/i.test(lower)) {
      this.safeOpenExternal('ms-settings:');
      return { isAction: true, replyText: 'Opening Windows Settings.' };
    }

    // Task Manager
    if (/(?:open|launch|show)\s+task\s+manager/i.test(lower)) {
      exec('taskmgr', () => {});
      return { isAction: true, replyText: 'Opening Task Manager.' };
    }

    // ─── GEMINI AI INTENT PARSER (fallback for complex commands) ─────────────
    try {
      const intent = await this.parseIntentWithGemini(input);
      if (!intent || intent.action === 'chat_reply') {
        return { isAction: false };
      }
      await this.dispatchAction(intent);
      return { isAction: true, replyText: intent.spokenConfirmation || 'Action executed.' };
    } catch (err: any) {
      console.warn('[AutonomousActionAgent] Action evaluation fallback to chat:', err.message);
      return { isAction: false };
    }
  }

  private async parseIntentWithGemini(userPrompt: string): Promise<AgentActionResponse | null> {
    let responseText = '';

    // Use streamWithSystem so JARVIS instruction is NOT overridden by the default "You are Robo…" system message
    await (this.aiManager as any).streamWithSystem(
      JARVIS_SYSTEM,
      'gemini',
      userPrompt,
      'gemini-3-flash-preview',
      (chunk: string) => { responseText += chunk; },
      undefined,
      'jarvis-intent-' + Date.now()
    );

    // Extract first valid JSON block
    const match = responseText.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]) as AgentActionResponse;
    } catch {
      // Try to extract from ```json block
      const jsonBlock = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonBlock) {
        try { return JSON.parse(jsonBlock[1]) as AgentActionResponse; } catch {}
      }
      return null;
    }
  }

  /**
   * Try to launch a named app. Returns true if the app name was recognized and launched.
   */
  private async tryLaunchNamedApp(appName: string): Promise<boolean> {
    const name = appName.toLowerCase().trim();

    const appMap: Record<string, string> = {
      chrome: 'start chrome',
      'google chrome': 'start chrome',
      edge: 'start msedge',
      'microsoft edge': 'start msedge',
      firefox: 'start firefox',
      notepad: 'notepad',
      'notepad++': 'start notepadplusplus',
      calculator: 'calc',
      calc: 'calc',
      terminal: 'start wt.exe || powershell',
      powershell: 'start powershell',
      cmd: 'start cmd',
      'command prompt': 'start cmd',
      spotify: 'start spotify',
      discord: 'start discord',
      slack: 'start slack',
      zoom: 'start zoom',
      teams: 'start teams',
      'microsoft teams': 'start teams',
      paint: 'mspaint',
      'ms paint': 'mspaint',
      word: 'start winword',
      excel: 'start excel',
      powerpoint: 'start powerpnt',
      outlook: 'start outlook',
      explorer: 'explorer',
      'file explorer': 'explorer',
      files: 'explorer',
      camera: 'start microsoft.windows.camera:',
      photos: 'start ms-photos:',
      store: 'start ms-windows-store:',
      'windows store': 'start ms-windows-store:',
      clock: 'start ms-clock:',
      maps: 'start bingmaps:',
      mail: 'start outlookmail:',
    };

    // VS Code special
    if (name.includes('code') || name.includes('vs code') || name.includes('vscode') || name.includes('visual studio code')) {
      exec('code', () => {});
      this.notifyIsland({ id: 'app-vscode', title: 'VS Code', body: 'Opening Visual Studio Code...', kind: 'terminal', durationMs: 3000 });
      return true;
    }

    // WhatsApp
    if (name.includes('whatsapp') || name === 'wa') {
      this.safeOpenExternal('whatsapp://');
      this.notifyIsland({ id: 'app-wa', title: 'WhatsApp', body: 'Opening WhatsApp Desktop...', kind: 'whatsapp', durationMs: 3000 });
      return true;
    }

    // Task Manager
    if (name.includes('task manager') || name === 'taskmgr') {
      exec('taskmgr', () => {});
      return true;
    }

    // Settings
    if (name === 'settings' || name === 'windows settings') {
      this.safeOpenExternal('ms-settings:');
      return true;
    }

    // Antigravity / this app
    if (name.includes('antigravity') || name.includes('anti gravity')) {
      exec('agy', (err) => {
        if (err) {
          // Try to open from common install paths
          exec('"C:\\Program Files\\Antigravity\\antigravity.exe"', () => {});
        }
      });
      this.notifyIsland({ id: 'app-agy', title: 'Antigravity', body: 'Launching Antigravity...', kind: 'done', durationMs: 3000 });
      return true;
    }

    // Look up in map
    for (const [key, cmd] of Object.entries(appMap)) {
      if (name.includes(key)) {
        exec(cmd, () => {
          this.notifyIsland({ id: 'app-' + key, title: 'App Launched', body: `Started ${appName}.`, kind: 'done', durationMs: 3000 });
        });
        return true;
      }
    }

    // Generic: try `start <appname>` as last resort
    exec(`start "" "${appName}"`, (err) => {
      if (!err) {
        this.notifyIsland({ id: 'app-generic', title: 'Launched', body: `Started ${appName}.`, kind: 'done', durationMs: 3000 });
      }
    });
    return true; // assume we tried
  }

  private async dispatchAction(intent: AgentActionResponse): Promise<void> {
    const action = intent.action;
    const params = intent.params || {};

    // 1. Spoken feedback via TTS
    if (intent.spokenConfirmation) {
      this.aiManager.speakTTS(intent.spokenConfirmation).catch(() => {});
    }

    // 2. Visual island feedback
    if (intent.displayHeadline) {
      this.notifyIsland({
        id: 'agent-' + Date.now(),
        title: intent.displayHeadline,
        body: intent.displayBody || 'Executing action...',
        kind: 'done',
        durationMs: 4000
      });
    }

    // 3. Native Windows Execution
    switch (action) {
      case 'send_whatsapp':
        await this.executeSendWhatsApp(params.contact, params.message);
        break;

      case 'call_whatsapp':
        await this.executeCallWhatsApp(params.contact);
        break;

      case 'open_url':
        await this.executeOpenUrl(params.url, params.targetName);
        break;

      case 'launch_app':
        await this.tryLaunchNamedApp(params.app || '');
        break;

      case 'search_web':
        await this.executeOpenUrl(`https://www.google.com/search?q=${encodeURIComponent(params.query || '')}`, 'Google');
        break;

      case 'play_youtube':
        await this.executeOpenUrl(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(params.query || '')}`,
          'YouTube'
        );
        break;

      case 'summarize_screen':
        await this.executeSummarizeScreen();
        break;

      case 'fix_screen_bug':
        await this.diagnostics.triggerJarvisScreenVision();
        break;

      case 'take_screenshot':
        exec('powershell -command "[System.Windows.Forms.SendKeys]::SendWait(\'%{PRTSC}\')"');
        break;

      case 'optimize_ram':
        await this.diagnostics.optimizeMemory();
        break;

      case 'clean_junk':
        await this.diagnostics.cleanJunkFiles();
        break;

      case 'set_volume':
        if (typeof params.level === 'number') {
          exec(`nircmd setsysvolume ${Math.round(params.level / 100 * 65535)}`);
          exec(`powershell -c "[Audio]::Volume = ${params.level / 100}"`, () => {});
        }
        break;

      case 'mute_audio':
        exec('nircmd mutesysvolume 1', () => {});
        exec('powershell -c "(New-Object -com WScript.Shell).SendKeys([char]173)"', () => {});
        break;

      case 'open_settings':
        this.safeOpenExternal(`ms-settings:${params.page || ''}`);
        break;

      case 'lock_screen':
        exec('rundll32.exe user32.dll,LockWorkStation');
        break;

      case 'shutdown':
        exec('shutdown /s /t 10');
        break;

      case 'restart':
        exec('shutdown /r /t 10');
        break;

      default:
        break;
    }
  }

  private async executeSendWhatsApp(contact: string, message: string): Promise<void> {
    const targetContact = (contact || '').trim();
    const msg = (message || 'Hi').trim();

    // Notify user immediately
    this.notifyIsland({
      id: 'wa-sending-' + Date.now(),
      title: `WhatsApp → ${targetContact || 'Contact'}`,
      body: `Sending: "${msg.slice(0, 40)}"`,
      kind: 'whatsapp',
      durationMs: 6000
    });

    // Invoke native Win32 PowerShell helper for contact search + send
    const scriptPath = path.join(__dirname, '..', 'native', 'whatsapp-sender.ps1');
    const safeText = msg.replace(/'/g, "''");
    const safeContact = targetContact.replace(/'/g, "''");
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Text '${safeText}' -Contact '${safeContact}'`;

    exec(psCmd, (err) => {
      if (err) {
        // Fallback: open WhatsApp protocol with text prefilled (blank chat)
        this.safeOpenExternal(`whatsapp://send?text=${encodeURIComponent(msg)}`);
        this.notifyIsland({
          id: 'wa-fallback-' + Date.now(),
          title: 'WhatsApp Opened',
          body: `Search for ${targetContact} and tap send.`,
          kind: 'whatsapp',
          durationMs: 8000
        });
      } else {
        this.notifyIsland({
          id: 'wa-sent-' + Date.now(),
          title: `✓ Sent to ${targetContact || 'Contact'}`,
          body: `"${msg.slice(0, 50)}"`,
          kind: 'done',
          durationMs: 5000
        });
        this.aiManager.speakTTS(`Message sent to ${targetContact}.`).catch(() => {});
      }
    });
  }

  private async executeCallWhatsApp(contact?: string): Promise<void> {
    this.safeOpenExternal('whatsapp://');
    this.notifyIsland({
      id: 'wa-call-' + Date.now(),
      title: 'WhatsApp Call',
      body: contact ? `Initiating call to ${contact}...` : 'Opening WhatsApp...',
      kind: 'whatsapp',
      durationMs: 5000
    });
    if (contact) {
      this.aiManager.speakTTS(`Calling ${contact} on WhatsApp.`).catch(() => {});
    }
  }

  private async executeOpenUrl(url: string, targetName = 'Browser'): Promise<void> {
    let target = url;
    if (!target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('ms-') && !target.startsWith('whatsapp:')) {
      target = 'https://' + target;
    }
    this.safeOpenExternal(target);

    this.notifyIsland({
      id: 'open-url-' + Date.now(),
      title: `Opened ${targetName}`,
      body: target.slice(0, 60),
      kind: 'chrome',
      durationMs: 4000
    });
  }

  private async executeSummarizeScreen(): Promise<void> {
    this.notifyIsland({
      id: 'screen-summary-scan',
      title: 'JARVIS Screen Reader',
      body: 'Capturing and summarizing desktop...',
      kind: 'terminal',
      durationMs: 8000
    });

    try {
      const capture = await this.aiManager.captureScreen();
      if (!capture.success || !capture.dataUrl) {
        throw new Error('Could not capture display');
      }

      const prompt = `You are JARVIS, Gaurav's autonomous AI.
Observe this full desktop screenshot and provide a concise summary:
- Active Window & Workflow
- Key Information / Errors / Document Content
- Suggested next step if applicable
Keep it under 4 short bullet points + 1-sentence spoken summary.`;

      let summaryOutput = '';
      await this.aiManager.streamPrompt(
        'gemini',
        prompt,
        'gemini-3-flash-preview',
        (chunk) => { summaryOutput += chunk; },
        undefined,
        'screen-summary-' + Date.now(),
        capture.dataUrl
      );

      this.safeWriteClipboard(summaryOutput);

      const firstLine = summaryOutput.split('\n').filter(l => l.trim().length > 0)[0] || 'Desktop summarized.';
      this.notifyIsland({
        id: 'screen-summary-done-' + Date.now(),
        title: 'Screen Summarized',
        body: firstLine.slice(0, 60),
        kind: 'done',
        durationMs: 12000,
        actions: [
          { id: 'copy:' + summaryOutput, label: 'Copy Summary', primary: true }
        ]
      });

      this.aiManager.speakTTS('Screen summary copied to clipboard.').catch(() => {});
    } catch (err: any) {
      this.notifyIsland({
        id: 'screen-summary-err',
        title: 'Screen Reader Error',
        body: err.message || 'Failed to read screen',
        kind: 'error',
        durationMs: 4000
      });
    }
  }

  private safeOpenExternal(targetUrl: string): void {
    try {
      if (shell && typeof shell.openExternal === 'function') {
        shell.openExternal(targetUrl).catch(() => {
          exec(`start "" "${targetUrl}"`);
        });
      } else {
        exec(`start "" "${targetUrl}"`);
      }
    } catch {
      exec(`start "" "${targetUrl}"`);
    }
  }

  private safeWriteClipboard(text: string): void {
    try {
      if (clipboard && typeof clipboard.writeText === 'function') {
        clipboard.writeText(text);
      }
    } catch {}
  }

  private notifyIsland(payload: any): void {
    try {
      if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.webContents.send('island:notify', payload);
          }
        }
      }
    } catch {}
  }
}
