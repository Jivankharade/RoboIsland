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

/**
 * Intelligent JARVIS System Prompt:
 * Direct Gemini NLP Understanding - No brittle regexes, handles spelling mistakes,
 * strange spacing, slang, any contact name, and any arbitrary message.
 */
const JARVIS_SYSTEM = `You are JARVIS, an autonomous OS Intelligence and Computer Use agent controlling Gaurav's Windows laptop.
Your job is to understand whatever the user says in natural human language (including typos, spelling mistakes, informal Hindi/English slang, missing punctuation, or awkward spacing) and translate it into a single executable JSON system action.

Available actions:
1. send_whatsapp:
   params: { contact: string, message: string }
   Use when the user wants to message someone on WhatsApp. Extract WHO (any name, person, group) and WHAT message to send (anything they specified, or default to "Hi" if no message mentioned).
   Handles typos like: "whatsup", "whats app", "whatapp", "messge", "massage", "snd", "plz", "bol", "bhejo".

2. call_whatsapp:
   params: { contact?: string }
   Use when the user wants to call someone on WhatsApp.

3. search_chrome:
   params: { query: string }
   Use when the user wants to search anything on the web, Google, or Chrome. If they say "open chrome and search X", "search X", "google X", "look up X".

4. play_youtube:
   params: { query: string }
   Use when the user wants to play or search songs, videos, or tutorials on YouTube.

5. visual_click:
   params: { target: string }
   Use when the user wants to click or tap an element on screen (e.g. "click gaurav profile", "click next", "click the blue button", "click search").

6. visual_drag:
   params: { target: string }
   Use when the user wants to move or drag the mouse cursor to a specific item on screen.

7. open_and_type:
   params: { app: string, text: string }
   Use when the user wants to open an application (Notepad, Word, Editor) and type text into it.

8. type_text:
   params: { text: string }
   Use when the user asks to type text directly into whatever is currently active.

9. launch_app:
   params: { app: string }
   Use when the user wants to open an application (e.g. Chrome, VS Code, Spotify, WhatsApp, Calculator, Settings, Task Manager).

10. summarize_screen:
    params: {}
    Use when the user wants to summarize, read, or analyze what is currently displayed on screen.

11. fix_screen_bug:
    params: {}
    Use when the user mentions UI bug, error on screen, or code diagnostics.

12. take_screenshot:
    params: {}

13. optimize_ram:
    params: {}
    Use when the user wants to free RAM, clear memory, clean cache, or speed up PC.

14. clean_junk:
    params: {}
    Use when the user wants to clean junk files, delete temp files, or purge system cache.

15. set_volume:
    params: { level: number }

16. mute_audio:
    params: {}

17. lock_screen:
    params: {}

18. chat_reply:
    params: { text: string }
    Use ONLY if the user is asking a purely conversational or factual question with NO desktop action intended.

OUTPUT FORMAT: Respond with ONLY a valid JSON object (no markdown quotes, no conversational preamble):
{
  "action": "<action_name>",
  "params": {},
  "spokenConfirmation": "Short natural sentence for JARVIS to speak aloud via speakers",
  "displayHeadline": "Under 20 chars for Dynamic Island (e.g. 'WhatsApp Message')",
  "displayBody": "Under 50 chars for Dynamic Island (e.g. 'Sending message to contact')"
}`;

export class AutonomousActionAgent {
  private aiManager: AIProviderManager;
  private diagnostics: SystemDiagnosticsManager;

  constructor(aiManager: AIProviderManager, diagnostics: SystemDiagnosticsManager) {
    this.aiManager = aiManager;
    this.diagnostics = diagnostics;
  }

  /**
   * Evaluates natural language command using Gemini AI Intelligence directly.
   * Understands any spelling mistake, contact name, or message without static patterns.
   */
  public async processCommand(rawInput: string): Promise<{ isAction: boolean; replyText?: string }> {
    const input = (rawInput || '').trim();
    if (!input) return { isAction: false };

    try {
      // 1. Send the natural language command directly to Gemini AI
      const intent = await this.parseIntentWithGemini(input);
      if (!intent || intent.action === 'chat_reply') {
        return { isAction: false };
      }

      // 2. Dispatch and execute the action natively on Windows
      await this.dispatchAction(intent);
      return { isAction: true, replyText: intent.spokenConfirmation || 'Task executed.' };
    } catch (err: any) {
      console.warn('[AutonomousActionAgent] Gemini intent evaluation error:', err.message);
      return { isAction: false };
    }
  }

  /**
   * Gemini 3 Flash / 3.8 Flash Direct Natural Language Understanding.
   */
  private async parseIntentWithGemini(userPrompt: string): Promise<AgentActionResponse | null> {
    let responseText = '';

    await (this.aiManager as any).streamWithSystem(
      JARVIS_SYSTEM,
      'gemini',
      userPrompt,
      'gemini-3-flash-preview',
      (chunk: string) => { responseText += chunk; },
      undefined,
      'jarvis-ai-brain-' + Date.now()
    );

    // Extract JSON from response
    const match = responseText.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]) as AgentActionResponse;
    } catch {
      const jsonBlock = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonBlock) {
        try { return JSON.parse(jsonBlock[1]) as AgentActionResponse; } catch {}
      }
      return null;
    }
  }

  /**
   * Dispatches the action parsed by Gemini to native Windows automation.
   */
  private async dispatchAction(intent: AgentActionResponse): Promise<void> {
    const action = intent.action;
    const params = intent.params || {};

    // 1. Spoken confirmation via TTS
    if (intent.spokenConfirmation) {
      this.aiManager.speakTTS(intent.spokenConfirmation).catch(() => {});
    }

    // 2. Visual Dynamic Island Notification
    if (intent.displayHeadline) {
      this.notifyIsland({
        id: 'agent-' + Date.now(),
        title: intent.displayHeadline,
        body: intent.displayBody || 'Executing autonomous task...',
        kind: 'done',
        durationMs: 4000
      });
    }

    // 3. Native Execution
    switch (action) {
      case 'send_whatsapp':
        await this.executeSendWhatsApp(params.contact, params.message);
        break;

      case 'call_whatsapp':
        await this.executeCallWhatsApp(params.contact);
        break;

      case 'search_chrome':
        await this.executeSearchChrome(params.query);
        break;

      case 'visual_click':
        await this.executeVisualClick(params.target);
        break;

      case 'visual_drag':
        await this.executeVisualDrag(params.target);
        break;

      case 'open_and_type':
        await this.executeOpenAndType(params.app, params.text);
        break;

      case 'type_text':
        await this.executeTypeText(params.text);
        break;

      case 'open_url':
        await this.executeOpenUrl(params.url, params.targetName);
        break;

      case 'launch_app':
        await this.tryLaunchNamedApp(params.app || '');
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
          exec(`powershell -c "[Audio]::Volume = ${params.level / 100}"`, () => {});
        }
        break;

      case 'mute_audio':
        exec('powershell -c "(New-Object -com WScript.Shell).SendKeys([char]173)"', () => {});
        break;

      case 'lock_screen':
        exec('rundll32.exe user32.dll,LockWorkStation');
        break;

      default:
        break;
    }
  }

  /**
   * Real Autonomous WhatsApp Automation:
   * 1. Brings WhatsApp to front.
   * 2. Presses Ctrl+F to open search.
   * 3. Types the contact name extracted by Gemini.
   * 4. Presses Down Arrow and Enter to open that chat.
   * 5. Types the message extracted by Gemini.
   * 6. Presses Enter to send!
   */
  private async executeSendWhatsApp(contact: string, message: string): Promise<void> {
    const targetContact = (contact || '').trim();
    const msg = (message || 'Hi').trim();

    this.notifyIsland({
      id: 'wa-sending-' + Date.now(),
      title: `WhatsApp → ${targetContact || 'Contact'}`,
      body: `Sending: "${msg.slice(0, 40)}"`,
      kind: 'whatsapp',
      durationMs: 6000
    });

    const scriptPath = path.join(__dirname, '..', 'native', 'whatsapp-sender.ps1');
    const safeText = msg.replace(/'/g, "''");
    const safeContact = targetContact.replace(/'/g, "''");
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Text '${safeText}' -Contact '${safeContact}'`;

    exec(psCmd, (err) => {
      if (err) {
        console.warn('[AutonomousActionAgent] WhatsApp automation error:', err.message);
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

  /**
   * Search Chrome with Visual Computer Use Auto-Profile Selection:
   * 1. Launches Chrome directly with Google Search query URL.
   * 2. Checks if Chrome is stuck on the Profile Chooser ("Who's using Chrome?").
   * 3. If stuck, visually locates Gaurav Kharade's profile card and clicks it!
   */
  private async executeSearchChrome(query: string): Promise<void> {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    this.notifyIsland({
      id: 'chrome-search-' + Date.now(),
      title: 'Google Chrome',
      body: `Searching for "${query}"...`,
      kind: 'chrome',
      durationMs: 5000
    });

    this.safeOpenExternal(searchUrl);

    // Give Chrome 1 second to appear, then check screen with Gemini Vision
    setTimeout(async () => {
      try {
        const capture = await this.aiManager.captureScreen();
        if (capture.success && capture.dataUrl) {
          const prompt = `Observe this desktop screenshot.
Is Google Chrome currently showing the "Who's using Chrome?" profile picker screen with user profile cards?
If YES, locate the profile card for "Gaurav Kharade" (or the first user profile card on the left).
Return ONLY JSON:
{
  "isProfilePicker": true,
  "x": number,
  "y": number
}
If NO (e.g. browser is already open with search results):
{
  "isProfilePicker": false
}`;

          let responseText = '';
          await (this.aiManager as any).streamWithSystem(
            'You are a precise screen coordinate locator.',
            'gemini',
            prompt,
            'gemini-3-flash-preview',
            (chunk: string) => { responseText += chunk; },
            undefined,
            'chrome-profile-detect-' + Date.now(),
            capture.dataUrl
          );

          const match = responseText.match(/\{[\s\S]*?\}/);
          if (match) {
            const data = JSON.parse(match[0]);
            if (data.isProfilePicker && typeof data.x === 'number' && typeof data.y === 'number') {
              await this.clickScreenCoordinate(data.x, data.y);
              this.aiManager.speakTTS('Selected profile to open search results.').catch(() => {});
            }
          }
        }
      } catch (err: any) {
        console.warn('[AutonomousActionAgent] Chrome profile auto-selection check failed:', err.message);
      }
    }, 1200);
  }

  /**
   * Visual Computer Use: Locate any element on screen and click it.
   */
  private async executeVisualClick(targetDescription: string): Promise<void> {
    this.notifyIsland({
      id: 'visual-click-' + Date.now(),
      title: 'JARVIS Vision Action',
      body: `Locating "${targetDescription}" on screen...`,
      kind: 'terminal',
      durationMs: 4000
    });

    try {
      const capture = await this.aiManager.captureScreen();
      if (!capture.success || !capture.dataUrl) {
        throw new Error('Screen capture failed');
      }

      const prompt = `You are a high-precision Computer Use Vision Agent controlling the cursor on Gaurav's Windows desktop.
Desktop resolution: ${capture.width || 1920}x${capture.height || 1080}.
Target element to click: "${targetDescription}".

Analyze the full desktop screenshot carefully.
Find the exact center pixel coordinates (X, Y) of the element described.
Return ONLY JSON:
{
  "found": true,
  "x": number,
  "y": number,
  "description": "Short description of what was located"
}
If not found:
{
  "found": false,
  "reason": "why not found"
}`;

      let responseText = '';
      await (this.aiManager as any).streamWithSystem(
        'You are an expert UI locator that outputs exact screen pixel coordinates.',
        'gemini',
        prompt,
        'gemini-3-flash-preview',
        (chunk: string) => { responseText += chunk; },
        undefined,
        'visual-click-' + Date.now(),
        capture.dataUrl
      );

      const match = responseText.match(/\{[\s\S]*?\}/);
      if (!match) throw new Error('Could not parse locator response');

      const data = JSON.parse(match[0]);
      if (data.found && typeof data.x === 'number' && typeof data.y === 'number') {
        await this.clickScreenCoordinate(data.x, data.y);
        this.notifyIsland({
          id: 'visual-click-done-' + Date.now(),
          title: 'Clicked',
          body: `Clicked on ${data.description || targetDescription} at (${data.x}, ${data.y})`,
          kind: 'done',
          durationMs: 4000
        });
        this.aiManager.speakTTS(`Clicked on ${targetDescription}.`).catch(() => {});
      } else {
        throw new Error(data.reason || 'Element not found on screen');
      }
    } catch (err: any) {
      console.warn('[AutonomousActionAgent] Visual click failed:', err.message);
      this.notifyIsland({
        id: 'visual-click-err-' + Date.now(),
        title: 'Vision Action Failed',
        body: err.message,
        kind: 'error',
        durationMs: 4000
      });
    }
  }

  /**
   * Visual Computer Use: Move/drag cursor to an element on screen.
   */
  private async executeVisualDrag(targetDescription: string): Promise<void> {
    try {
      const capture = await this.aiManager.captureScreen();
      if (!capture.success || !capture.dataUrl) return;

      const prompt = `Analyze this desktop screenshot.
Find the exact pixel coordinates (X, Y) of: "${targetDescription}".
Return ONLY JSON:
{
  "found": true,
  "x": number,
  "y": number
}`;

      let responseText = '';
      await (this.aiManager as any).streamWithSystem(
        'You are a screen coordinate locator.',
        'gemini',
        prompt,
        'gemini-3-flash-preview',
        (chunk: string) => { responseText += chunk; },
        undefined,
        'visual-drag-' + Date.now(),
        capture.dataUrl
      );

      const match = responseText.match(/\{[\s\S]*?\}/);
      if (match) {
        const data = JSON.parse(match[0]);
        if (data.found && typeof data.x === 'number' && typeof data.y === 'number') {
          const scriptPath = path.join(__dirname, '..', 'native', 'computer-use.ps1');
          const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Action "move" -X ${Math.round(data.x)} -Y ${Math.round(data.y)}`;
          exec(psCmd, () => {});
          this.aiManager.speakTTS(`Moved cursor to ${targetDescription}.`).catch(() => {});
        }
      }
    } catch {}
  }

  private clickScreenCoordinate(x: number, y: number): Promise<void> {
    return new Promise((resolve) => {
      const scriptPath = path.join(__dirname, '..', 'native', 'computer-use.ps1');
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Action "click" -X ${Math.round(x)} -Y ${Math.round(y)}`;
      exec(psCmd, () => {
        resolve();
      });
    });
  }

  private async executeOpenAndType(appName: string, text: string): Promise<void> {
    const scriptPath = path.join(__dirname, '..', 'native', 'windows-robot.ps1');
    const safeApp = appName.replace(/'/g, "''");
    const safeText = text.replace(/'/g, "''");
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Action "open_and_type" -App '${safeApp}' -Text '${safeText}'`;

    exec(psCmd, () => {
      this.notifyIsland({
        id: 'typed-' + Date.now(),
        title: `Typed in ${appName}`,
        body: text.slice(0, 50),
        kind: 'done',
        durationMs: 4000
      });
      this.aiManager.speakTTS(`Typed text in ${appName}.`).catch(() => {});
    });
  }

  private async executeTypeText(text: string): Promise<void> {
    const scriptPath = path.join(__dirname, '..', 'native', 'windows-robot.ps1');
    const safeText = text.replace(/'/g, "''");
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Action "type" -Text '${safeText}'`;

    exec(psCmd, () => {
      this.notifyIsland({
        id: 'typed-' + Date.now(),
        title: 'Text Typed',
        body: text.slice(0, 50),
        kind: 'done',
        durationMs: 3000
      });
    });
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
      paint: 'mspaint',
      word: 'start winword',
      excel: 'start excel',
      powerpoint: 'start powerpnt',
      outlook: 'start outlook',
      explorer: 'explorer',
      camera: 'start microsoft.windows.camera:',
      photos: 'start ms-photos:',
      settings: 'start ms-settings:',
    };

    if (name.includes('code') || name.includes('vs code') || name.includes('vscode')) {
      exec('code', () => {});
      this.notifyIsland({ id: 'app-vscode', title: 'VS Code', body: 'Opening Visual Studio Code...', kind: 'terminal', durationMs: 3000 });
      return true;
    }

    if (name.includes('whatsapp') || name === 'wa') {
      this.safeOpenExternal('whatsapp://');
      this.notifyIsland({ id: 'app-wa', title: 'WhatsApp', body: 'Opening WhatsApp...', kind: 'whatsapp', durationMs: 3000 });
      return true;
    }

    if (name.includes('task manager') || name === 'taskmgr') {
      exec('taskmgr', () => {});
      return true;
    }

    for (const [key, cmd] of Object.entries(appMap)) {
      if (name.includes(key)) {
        exec(cmd, () => {
          this.notifyIsland({ id: 'app-' + key, title: 'App Launched', body: `Started ${appName}.`, kind: 'done', durationMs: 3000 });
        });
        return true;
      }
    }

    exec(`start "" "${appName}"`, (err) => {
      if (!err) {
        this.notifyIsland({ id: 'app-generic', title: 'Launched', body: `Started ${appName}.`, kind: 'done', durationMs: 3000 });
      }
    });
    return true;
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
