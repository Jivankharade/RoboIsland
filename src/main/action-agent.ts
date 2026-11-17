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

/** JARVIS system prompt for autonomous Windows OS action interpretation */
const JARVIS_SYSTEM = `You are JARVIS, an autonomous OS Computer Use agent controlling Gaurav's Windows laptop.
Translate the user's natural language request into a single executable JSON action.

Available actions:
- send_whatsapp:    params: { contact: string, message: string }
- call_whatsapp:    params: { contact?: string }
- visual_click:     params: { target: string } (e.g. "click gaurav profile", "click search button", "click next")
- visual_drag:      params: { target: string } (e.g. "drag cursor to gaurav profile", "drag window")
- search_chrome:    params: { query: string } (e.g. "search ipl on chrome", "open chrome search ipl")
- open_and_type:    params: { app: string, text: string }
- type_text:        params: { text: string }
- open_url:         params: { url: string, targetName?: string }
- launch_app:       params: { app: string }
- play_youtube:     params: { query: string }
- summarize_screen: params: {}
- fix_screen_bug:   params: {}
- take_screenshot:  params: {}
- optimize_ram:     params: {}
- clean_junk:       params: {}
- set_volume:       params: { level: number }
- mute_audio:       params: {}
- lock_screen:      params: {}
- chat_reply:       params: { text: string } (use ONLY if request is pure factual discussion with no action on PC)

CRITICAL RULES:
- If user asks to search on chrome / google: action "search_chrome" with query.
- If user asks to click, drag cursor, or select something visible on screen: action "visual_click" or "visual_drag".
- If user asks to send a message on WhatsApp: action "send_whatsapp" with contact and message.

Respond with ONLY valid JSON:
{
  "action": "<action>",
  "params": {},
  "spokenConfirmation": "Natural JARVIS spoken confirmation to say aloud",
  "displayHeadline": "Under 22 chars for Dynamic Island",
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

    // ─── 1. FAST-PATH: WHATSAPP SEND & CALL ─────────────────────────────────
    const waParsed = this.extractWhatsAppIntent(input);
    if (waParsed) {
      await this.executeSendWhatsApp(waParsed.contact, waParsed.message);
      return {
        isAction: true,
        replyText: `Sending "${waParsed.message}" to ${waParsed.contact} on WhatsApp.`
      };
    }

    if (/(?:call|ring|dial)\s+(.+?)\s+(?:on\s+)?(?:whatsapp|wa)/i.test(lower) || /^(?:whatsapp|wa)\s+call\s+(.+)/i.test(lower)) {
      const callMatch = lower.match(/(?:call|ring|dial)\s+(.+?)\s+(?:on\s+)?(?:whatsapp|wa)/i)
        || lower.match(/(?:whatsapp|wa)\s+call\s+(.+)/i);
      const contact = callMatch?.[1]?.trim() || '';
      await this.executeCallWhatsApp(contact);
      return { isAction: true, replyText: `Calling ${contact || 'contact'} on WhatsApp.` };
    }

    if (/^(?:open|launch|start)\s+(?:whats\s*app|wa)$/i.test(lower)) {
      this.safeOpenExternal('whatsapp://');
      this.notifyIsland({ id: 'wa-open', title: 'WhatsApp', body: 'Opening WhatsApp Desktop...', kind: 'whatsapp', durationMs: 3000 });
      return { isAction: true, replyText: 'Opening WhatsApp.' };
    }

    // ─── 2. FAST-PATH: CHROME & WEB SEARCH (IPL, Movies, Google) ───────────
    const chromeSearchMatch = input.match(/^(?:open\s+)?(?:chrome|google\s+chrome|browser)\s+(?:and\s+)?(?:search|find|look\s+up)\s+(?:for\s+)?(.+)$/i)
      || input.match(/^(?:search|look\s+up|find)\s+(?:for\s+)?(.+?)\s+on\s+(?:chrome|google|browser)$/i)
      || input.match(/^(?:search|google|look\s+up|find)\s+(.+)$/i);

    if (chromeSearchMatch) {
      const q = chromeSearchMatch[1].trim();
      if (q && !/^(?:youtube|whatsapp)$/i.test(q)) {
        await this.executeSearchChrome(q);
        return { isAction: true, replyText: `Searching for "${q}" on Google Chrome.` };
      }
    }

    // ─── 3. FAST-PATH: YOUTUBE DIRECT ───────────────────────────────────────
    const ytMatch = lower.match(/^(?:open|play|launch|search|find)\s+youtube(?:\s+(?:and\s+(?:play|search))?\s*(.+))?$/i)
      || input.match(/^(?:play|search)\s+(.+?)\s+on\s+youtube$/i);
    if (ytMatch || /youtube\.com/.test(lower)) {
      const q = (ytMatch?.[1] || '').trim();
      const url = q
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
        : 'https://www.youtube.com';
      await this.executeOpenUrl(url, 'YouTube');
      return { isAction: true, replyText: q ? `Playing "${q}" on YouTube.` : 'Opening YouTube.' };
    }

    // ─── 4. FAST-PATH: VISUAL COMPUTER USE (Click / Drag on Screen) ──────────
    const clickMatch = input.match(/^(?:click|tap|press)\s+(?:on\s+)?(?:the\s+)?(.+)$/i);
    if (clickMatch) {
      const targetDesc = clickMatch[1].trim();
      await this.executeVisualClick(targetDesc);
      return { isAction: true, replyText: `Interacting with ${targetDesc} on screen.` };
    }

    const dragMatch = input.match(/^(?:drag|move)\s+(?:the\s+)?cursor\s+to\s+(?:the\s+)?(.+)$/i);
    if (dragMatch) {
      const targetDesc = dragMatch[1].trim();
      await this.executeVisualDrag(targetDesc);
      return { isAction: true, replyText: `Moving cursor to ${targetDesc}.` };
    }

    const profileMatch = input.match(/^(?:select|choose|click)\s+(?:the\s+)?profile\s*(.*)$/i);
    if (profileMatch) {
      const profileName = profileMatch[1].trim() || 'Gaurav Kharade';
      await this.executeVisualClick(`profile card for ${profileName}`);
      return { isAction: true, replyText: `Selecting profile ${profileName}.` };
    }

    // ─── 5. FAST-PATH: OPEN & TYPE IN APPS ──────────────────────────────────
    const openTypeMatch = input.match(/^(?:open\s+([A-Za-z0-9]+)\s+and\s+type|type\s+(.+?)\s+in\s+([A-Za-z0-9]+))\s*(.*)$/i);
    if (openTypeMatch) {
      let app = '';
      let text = '';
      if (input.toLowerCase().startsWith('open')) {
        app = openTypeMatch[1];
        text = openTypeMatch[4] || '';
      } else {
        text = openTypeMatch[2] || '';
        app = openTypeMatch[3] || '';
      }
      if (app && text) {
        await this.executeOpenAndType(app, text);
        return { isAction: true, replyText: `Typing your text in ${app}.` };
      }
    }

    // ─── 6. FAST-PATH: SCREEN VISION & SUMMARIZE ────────────────────────────
    if (/(?:summar(?:ise|ize)|read|analyze|analyse|describe)\s+(?:my\s+)?(?:the\s+)?screen/i.test(lower) || lower === 'summarise' || lower === 'summarize') {
      await this.executeSummarizeScreen();
      return { isAction: true, replyText: 'Analyzing your screen now.' };
    }

    if (/fix\s+(?:screen\s+|ui\s+)?bug|screen\s+diagnostics/i.test(lower)) {
      await this.diagnostics.triggerJarvisScreenVision();
      return { isAction: true, replyText: 'Inspecting screen for UI bugs and errors.' };
    }

    // ─── 7. FAST-PATH: SYSTEM OPTIMIZATION ─────────────────────────────────
    if (/(?:free|optimize|clean|clear|boost)\s+(?:the\s+)?(?:ram|memory|mem)/i.test(lower)) {
      await this.diagnostics.optimizeMemory();
      return { isAction: true, replyText: 'Memory optimized successfully.' };
    }

    if (/(?:clean|purge|delete|clear|wipe)\s+(?:laptop\s+|system\s+|my\s+)?(?:junk|temp|cache|trash|garbage)/i.test(lower)
      || /(?:clean|optimize|speed\s+up)\s+(?:my\s+)?(?:laptop|pc|computer|system)$/i.test(lower)) {
      await this.diagnostics.cleanJunkFiles();
      return { isAction: true, replyText: 'Junk files cleaned from your laptop.' };
    }

    if (/^(?:lock|lock\s+(?:my\s+)?(?:screen|computer|pc|laptop))$/i.test(lower)) {
      exec('rundll32.exe user32.dll,LockWorkStation');
      return { isAction: true, replyText: 'Locking your screen.' };
    }

    if (/^(?:take|capture|grab)\s+(?:a\s+)?screenshot$/i.test(lower)) {
      exec('powershell -command "[System.Windows.Forms.SendKeys]::SendWait(\'%{PRTSC}\')"');
      this.notifyIsland({ id: 'ss', title: 'Screenshot', body: 'Screenshot copied to clipboard.', kind: 'done', durationMs: 3000 });
      return { isAction: true, replyText: 'Screenshot captured to clipboard.' };
    }

    // ─── 8. FAST-PATH: APP LAUNCHES ─────────────────────────────────────────
    const appLaunchMatch = lower.match(/^(?:open|launch|start|run)\s+(.+)$/i);
    if (appLaunchMatch) {
      const appName = appLaunchMatch[1].trim();
      const handled = await this.tryLaunchNamedApp(appName);
      if (handled) return { isAction: true, replyText: `Opening ${appName}.` };
    }

    // ─── 9. GEMINI AI INTENT PARSER (Visual Computer Use fallback) ─────────
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

  /**
   * Robust NLP extractor for WhatsApp sending commands.
   */
  private extractWhatsAppIntent(raw: string): { contact: string; message: string } | null {
    const text = raw.trim();
    const lower = text.toLowerCase();

    if (!lower.includes('whatsapp') && !lower.includes('whats app') && !lower.includes('wa ') && !lower.startsWith('send ')) {
      return null;
    }

    const cleaned = text.replace(/^(?:please\s+)?(?:open\s+(?:whats\s*app|wa)\s*(?:and\s+)?|go\s+to\s+whatsapp\s+and\s+)/i, '').trim();

    const m1 = cleaned.match(/^send\s+(?:a\s+)?message\s+to\s+([A-Za-z0-9\s]+?)(?:\s+(?:on\s+whatsapp\s+)?(?:saying|that|with\s+text|say)\s+)(.+)$/i);
    if (m1) {
      return { contact: m1[1].trim(), message: m1[2].trim() };
    }

    const m2 = cleaned.match(/^send\s+(?:a\s+)?(?:message\s+)?["']?(.+?)["']?\s+to\s+([A-Za-z0-9\s]+?)(?:\s+on\s+whatsapp)?$/i);
    if (m2) {
      let msg = m2[1].replace(/^(?:saying|message)\s+/i, '').replace(/\s+message$/i, '').trim();
      let contact = m2[2].replace(/\s+on\s+whatsapp$/i, '').trim();
      if (contact && msg) {
        return { contact, message: msg };
      }
    }

    const m3 = cleaned.match(/^tell\s+([A-Za-z0-9\s]+?)\s+(?:on\s+whatsapp\s+)?(?:that\s+)?(.+)$/i);
    if (m3 && lower.includes('whatsapp')) {
      return { contact: m3[1].trim(), message: m3[2].trim() };
    }

    const m4 = cleaned.match(/^(?:whatsapp|wa|msg)\s+([A-Za-z0-9\s]+?)\s+["']?([A-Za-z0-9].+?)["']?$/i);
    if (m4) {
      return { contact: m4[1].trim(), message: m4[2].trim() };
    }

    return null;
  }

  private async parseIntentWithGemini(userPrompt: string): Promise<AgentActionResponse | null> {
    let responseText = '';

    await (this.aiManager as any).streamWithSystem(
      JARVIS_SYSTEM,
      'gemini',
      userPrompt,
      'gemini-3-flash-preview',
      (chunk: string) => { responseText += chunk; },
      undefined,
      'jarvis-intent-' + Date.now()
    );

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

  private async dispatchAction(intent: AgentActionResponse): Promise<void> {
    const action = intent.action;
    const params = intent.params || {};

    if (intent.spokenConfirmation) {
      this.aiManager.speakTTS(intent.spokenConfirmation).catch(() => {});
    }

    if (intent.displayHeadline) {
      this.notifyIsland({
        id: 'agent-' + Date.now(),
        title: intent.displayHeadline,
        body: intent.displayBody || 'Executing autonomous action...',
        kind: 'done',
        durationMs: 4000
      });
    }

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
   * Search Chrome with Visual Computer Use Auto-Profile Selection:
   * 1. Launches Chrome directly with Google Search query URL.
   * 2. Waits 1000ms.
   * 3. Checks if Chrome is stuck on the Profile Chooser ("Who's using Chrome?").
   * 4. If stuck, visually locates Gaurav Kharade's profile card and clicks it!
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

    // Wait for Chrome to load and check if it gets stuck on the Profile Chooser modal
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
              // Click the profile card
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

  /**
   * Real Autonomous WhatsApp Automation:
   * 1. Brings WhatsApp to the front.
   * 2. Presses Ctrl+F to open search.
   * 3. Pastes/types contact name.
   * 4. Presses Enter to open chat.
   * 5. Pastes/types message.
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
