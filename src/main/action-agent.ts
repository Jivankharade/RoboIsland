import { shell, clipboard, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import * as path from 'path';
import { AIProviderManager } from './ai-provider-manager';
import { SystemDiagnosticsManager } from './system-diagnostics';

export interface AgentActionResponse {
  action: string;
  params?: Record<string, any>;
  actions?: AgentActionResponse[];
  spokenConfirmation?: string;
  displayHeadline?: string;
  displayBody?: string;
}

/**
 * Intelligent JARVIS System Prompt:
 * Direct Gemini NLP Understanding - No brittle regexes, handles spelling mistakes,
 * strange spacing, slang, any contact name, arbitrary messages, and composite/multi tasks.
 */
const JARVIS_SYSTEM = `You are JARVIS, an autonomous OS Intelligence and Computer Use agent controlling Gaurav's Windows laptop.
Your job is to understand whatever the user says in natural human language (including typos, spelling mistakes, informal Hindi/English slang, missing punctuation, awkward spacing, or multiple combined commands) and translate it into executable JSON system action(s).

CRITICAL RULE — When to use chat_reply vs search_chrome:
- If the user asks a KNOWLEDGE question (e.g. "give python code for X", "explain recursion", "what is machine learning", "write a program", "translate this", "explain this code", "help me with homework", "solve this math problem"), you MUST use chat_reply and answer the question directly in the "text" field. You are a smart AI — answer coding, science, math, history, language, and general knowledge questions yourself WITHOUT opening Chrome.
- ONLY use search_chrome if the user EXPLICITLY asks to "search", "google", "look up", "browse", "open chrome", or wants live/real-time information like news, scores, stock prices, or weather that you cannot know.
- When in doubt between search_chrome and chat_reply, ALWAYS prefer chat_reply. The user wants YOU to answer, not a web search.

Available actions:
1. send_whatsapp:
   params: { contact: string, message: string }
   Use when the user wants to message someone on WhatsApp. Extract WHO (any name, person, group) and WHAT message to send (anything they specified, or default to "Hi" if no message mentioned).
   Handles typos like: "whatsup", "whats app", "whatapp", "messge", "massage", "snd", "plz", "bol", "bhejo".

2. call_whatsapp:
   params: { contact?: string }

3. search_chrome:
   params: { query: string }
   Use ONLY when the user EXPLICITLY says "search", "google", "look up", "browse", or "open chrome" — NOT for knowledge/coding/homework questions.

4. play_youtube:
   params: { query: string }
   Use when the user wants to play or search songs, videos, or tutorials on YouTube.

5. visual_click:
   params: { target: string }

6. visual_drag:
   params: { target: string }

7. open_and_type:
   params: { app: string, text: string }

8. type_text:
   params: { text: string }

9. launch_app:
   params: { app: string }

10. summarize_screen:
    params: {}

11. fix_screen_bug:
    params: {}

12. take_screenshot:
    params: {}

13. optimize_ram:
    params: {}

14. clean_junk:
    params: {}

15. set_volume:
    params: { level: number }

16. mute_audio:
    params: {}

17. lock_screen:
    params: {}

18. chat_reply:
    params: { text: string }
    Use for ANY knowledge question, coding help, homework, explanation, translation, general conversation, or factual query. Answer the question fully and helpfully in the "text" field with markdown formatting, code blocks, and detailed explanations. This is the DEFAULT action for questions.

19. composite:
    Use if the user requested MULTIPLE actions in a single sentence.
    actions: [ array of individual action objects ]

OUTPUT FORMAT: Respond with ONLY a valid JSON object:
{
  "action": "<action_name>",
  "params": {},
  "spokenConfirmation": "Short natural sentence for JARVIS to speak aloud via speakers",
  "displayHeadline": "Under 20 chars for Dynamic Island",
  "displayBody": "Under 50 chars for Dynamic Island"
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
   * Understands any spelling mistake, contact name, or message with zero static limitations.
   */
  public async processCommand(rawInput: string): Promise<{ isAction: boolean; replyText?: string }> {
    const input = (rawInput || '').trim();
    if (!input) return { isAction: false };

    try {
      // 1. Send the natural language command to Gemini AI
      let intent = await this.parseIntentWithGemini(input);

      // 2. If Gemini fails or times out, use intelligent local NLP fallback
      if (!intent) {
        const fallback = this.fallbackIntentParser(input);
        if (fallback) {
          intent = fallback;
        } else {
          return { isAction: false };
        }
      }

      // 3. If chat_reply, return the AI-generated text directly as a chat response
      if (intent.action === 'chat_reply') {
        const aiText = intent.params?.text || '';
        if (aiText) {
          return { isAction: true, replyText: aiText };
        }
        return { isAction: false };
      }

      // 4. Dispatch and execute the action natively on Windows
      await this.dispatchAction(intent);
      return { isAction: true, replyText: intent.spokenConfirmation || 'Task executed successfully.' };
    } catch (err: any) {
      console.warn('[AutonomousActionAgent] Action evaluation error:', err.message);
      // Even if error occurs, try fallback
      const fallback = this.fallbackIntentParser(input);
      if (fallback) {
        try {
          await this.dispatchAction(fallback);
          return { isAction: true, replyText: fallback.spokenConfirmation || 'Task executed.' };
        } catch {}
      }
      return { isAction: false };
    }
  }

  /**
   * Gemini 3 Flash / 3.8 Flash Direct Natural Language Understanding.
   */
  private async parseIntentWithGemini(userPrompt: string): Promise<AgentActionResponse | null> {
    let responseText = '';

    try {
      await (this.aiManager as any).streamWithSystem(
        JARVIS_SYSTEM,
        'gemini',
        userPrompt,
        'gemini-3-flash-preview',
        (chunk: string) => { responseText += chunk; },
        undefined,
        'jarvis-ai-brain-' + Date.now()
      );
    } catch (err: any) {
      console.warn('[AutonomousActionAgent] Gemini stream error:', err.message);
    }

    return this.extractActionJson(responseText);
  }

  /**
   * Robust JSON extractor that handles nested objects and markdown blocks without cutting braces.
   */
  private extractActionJson(text: string): AgentActionResponse | null {
    if (!text) return null;

    // 1. Check for markdown code fences ```json ... ```
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fence) {
      try {
        const obj = JSON.parse(fence[1].trim());
        if (obj && (obj.action || obj.actions)) return obj;
      } catch {}
    }

    // 2. Find balanced JSON object from first '{' to last '}'
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      const candidate = text.substring(startIdx, endIdx + 1).trim();
      try {
        const obj = JSON.parse(candidate);
        if (obj && (obj.action || obj.actions)) return obj;
      } catch {}
    }

    return null;
  }

  /**
   * Resilient Zero-Delay Local NLP Fallback (in case Gemini API is unreachable or rate limited).
   */
  private fallbackIntentParser(input: string): AgentActionResponse | null {
    const raw = input.trim();
    const lower = raw.toLowerCase();

    // 1. WhatsApp Intent — only match explicit WhatsApp-related terms, not generic "what" questions
    if (
      lower.includes('whatsapp') || lower.includes('whats app') || lower.includes('whatapp') ||
      lower.includes('whatsup') || lower.includes('whtasapp') ||
      (lower.includes('bhejo') && (lower.includes('to') || lower.includes('ko'))) ||
      (lower.includes('send') && (lower.includes('whatsapp') || lower.includes('whats app') || lower.includes('wa')))
    ) {
      // Split composite WhatsApp instructions (e.g., "send X to A on whatsapp and send Y to B")
      const subParts = raw.split(/(?:and then|and also|\band\b|bhejo)/i).map(s => s.trim()).filter(Boolean);
      const waActions: AgentActionResponse[] = [];

      for (const part of (subParts.length > 1 ? subParts : [raw])) {
        const pLower = part.toLowerCase();
        if (!pLower.includes('send') && !pLower.includes('bhejo') && !pLower.includes('message') && !pLower.includes('hi') && !pLower.includes('hello')) {
          continue;
        }

        let contact = '';
        let message = 'Hi';

        // Pattern: send [msg] to [contact]
        const m1 = part.match(/(?:send|bhejo|message)\s+(?:message\s+)?["']?(.+?)["']?\s+(?:to|ko)\s+([^.]+)/i);
        if (m1) {
          message = m1[1].replace(/\s*(?:on|in|via)?\s*whats?\s*app\s*$/i, '').trim();
          contact = m1[2].replace(/\s*(?:on|in|via)?\s*whats?\s*app\s*$/i, '').trim();
        } else {
          // Pattern: to [contact] send/say [msg]
          const m2 = part.match(/to\s+([^,\s]+(?:\s+[^,\s]+)?)\s+(?:say|message|send)?\s*(.*)/i);
          if (m2) {
            contact = m2[1].replace(/\s*(?:on|in|via)?\s*whats?\s*app\s*$/i, '').trim();
            message = m2[2].replace(/\s*(?:on|in|via)?\s*whats?\s*app\s*$/i, '').trim() || 'Hi';
          }
        }

        if (contact) {
          waActions.push({
            action: 'send_whatsapp',
            params: { contact, message: message || 'Hi' },
            spokenConfirmation: `Sending ${message || 'message'} to ${contact} on WhatsApp.`,
            displayHeadline: `WhatsApp → ${contact}`,
            displayBody: `Sending: "${message || 'Hi'}"`
          });
        }
      }

      if (waActions.length > 1) {
        return {
          action: 'composite',
          actions: waActions,
          spokenConfirmation: `Sending WhatsApp messages to ${waActions.map(a => a.params?.contact).join(', ')}.`,
          displayHeadline: 'WhatsApp Multi',
          displayBody: `Sending ${waActions.length} messages in sequence`
        };
      } else if (waActions.length === 1) {
        return waActions[0];
      }
    }

    // 2. RAM Optimization
    if (lower.includes('ram') || lower.includes('memory') || lower.includes('clean pc') || lower.includes('speed up') || lower.includes('free memory')) {
      return {
        action: 'optimize_ram',
        params: {},
        spokenConfirmation: 'Optimizing memory and trimming background working sets.',
        displayHeadline: 'Trimming RAM',
        displayBody: 'Freeing physical memory across all processes...'
      };
    }

    // 3. Chrome Search — ONLY when user explicitly says "search", "chrome", or "google"
    if (
      (lower.includes('chrome') && (lower.includes('open') || lower.includes('search'))) ||
      (lower.includes('google') && lower.includes('search')) ||
      (lower.includes('search') && (lower.includes('chrome') || lower.includes('google') || lower.includes('browse') || lower.includes('look up')))
    ) {
      let query = raw;
      const qMatch = raw.match(/(?:search|google|look up)\s+(?:for\s+)?(.+?)(?:\s+in\s+chrome|\s+on\s+google|$)/i);
      if (qMatch) {
        query = qMatch[1].trim();
      } else {
        query = raw.replace(/(?:open\s+)?chrome(?:\s+and)?/i, '').replace(/search/i, '').trim();
      }
      return {
        action: 'search_chrome',
        params: { query: query || 'IPL' },
        spokenConfirmation: `Searching Google for ${query || 'IPL'}.`,
        displayHeadline: 'Google Search',
        displayBody: `Searching for "${query}"`
      };
    }

    // 4. YouTube
    if (lower.includes('youtube') || lower.includes('song') || lower.includes('play')) {
      const q = raw.replace(/(?:play|open|search)\s+(?:on\s+youtube\s+)?/i, '').replace(/youtube/i, '').trim();
      return {
        action: 'play_youtube',
        params: { query: q },
        spokenConfirmation: `Playing ${q} on YouTube.`,
        displayHeadline: 'YouTube',
        displayBody: `Playing "${q}"`
      };
    }

    // 5. Volume / Mute
    if (lower.includes('mute')) {
      return { action: 'mute_audio', params: {}, spokenConfirmation: 'Audio muted.' };
    }

    return null;
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
      case 'composite':
        if (Array.isArray(intent.actions)) {
          for (let i = 0; i < intent.actions.length; i++) {
            await this.dispatchAction(intent.actions[i]);
            if (i < intent.actions.length - 1) {
              await new Promise(r => setTimeout(r, 1800));
            }
          }
        }
        break;

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
        if (process.platform === 'linux') {
          exec('spectacle -b -n 2>/dev/null || grim 2>/dev/null || maim 2>/dev/null');
        } else {
          exec('powershell -command "[System.Windows.Forms.SendKeys]::SendWait(\'%{PRTSC}\')"');
        }
        break;

      case 'optimize_ram':
        await this.diagnostics.optimizeMemory();
        break;

      case 'clean_junk':
        await this.diagnostics.cleanJunkFiles();
        break;

      case 'set_volume':
        if (typeof params.level === 'number') {
          if (process.platform === 'linux') {
            exec(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${params.level / 100} 2>/dev/null || pactl set-sink-volume @DEFAULT_SINK@ ${params.level}% 2>/dev/null`, () => {});
          } else {
            exec(`powershell -c "[Audio]::Volume = ${params.level / 100}"`, () => {});
          }
        }
        break;

      case 'mute_audio':
        if (process.platform === 'linux') {
          exec('wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle 2>/dev/null || pactl set-sink-mute @DEFAULT_SINK@ toggle 2>/dev/null', () => {});
        } else {
          exec('powershell -c "(New-Object -com WScript.Shell).SendKeys([char]173)"', () => {});
        }
        break;

      case 'lock_screen':
        if (process.platform === 'linux') {
          exec('qdbus org.freedesktop.ScreenSaver /ScreenSaver Lock 2>/dev/null || loginctl lock-session 2>/dev/null');
        } else {
          exec('rundll32.exe user32.dll,LockWorkStation');
        }
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
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Text '${safeText}' -Contact '${safeContact}' -Autonomous`;

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

          const data = this.extractActionJson(responseText) as any;
          if (data && data.isProfilePicker && typeof data.x === 'number' && typeof data.y === 'number') {
            await this.clickScreenCoordinate(data.x, data.y);
            this.aiManager.speakTTS('Selected profile to open search results.').catch(() => {});
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

      const data = this.extractActionJson(responseText) as any;
      if (!data) throw new Error('Could not parse locator response');

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

      const data = this.extractActionJson(responseText) as any;
      if (data && data.found && typeof data.x === 'number' && typeof data.y === 'number') {
        const scriptPath = path.join(__dirname, '..', 'native', 'computer-use.ps1');
        const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Action "move" -X ${Math.round(data.x)} -Y ${Math.round(data.y)}`;
        exec(psCmd, () => {});
        this.aiManager.speakTTS(`Moved cursor to ${targetDescription}.`).catch(() => {});
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

    const isLinux = process.platform === 'linux';
    const appMap: Record<string, string> = {
      chrome: isLinux ? 'google-chrome || chromium-browser || firefox' : 'start chrome',
      'google chrome': isLinux ? 'google-chrome || chromium-browser || firefox' : 'start chrome',
      edge: isLinux ? 'microsoft-edge || google-chrome || firefox' : 'start msedge',
      'microsoft edge': isLinux ? 'microsoft-edge || google-chrome || firefox' : 'start msedge',
      firefox: isLinux ? 'firefox' : 'start firefox',
      notepad: isLinux ? 'kate || kwrite || gedit || nano' : 'notepad',
      'notepad++': isLinux ? 'kate || notepadqq' : 'start notepadplusplus',
      calculator: isLinux ? 'kcalc || gnome-calculator' : 'calc',
      calc: isLinux ? 'kcalc || gnome-calculator' : 'calc',
      terminal: isLinux ? 'konsole || x-terminal-emulator || gnome-terminal' : 'start wt.exe || powershell',
      powershell: isLinux ? 'konsole' : 'start powershell',
      cmd: isLinux ? 'konsole' : 'start cmd',
      'command prompt': isLinux ? 'konsole' : 'start cmd',
      spotify: isLinux ? 'spotify' : 'start spotify',
      discord: isLinux ? 'discord' : 'start discord',
      slack: isLinux ? 'slack' : 'start slack',
      zoom: isLinux ? 'zoom' : 'start zoom',
      teams: isLinux ? 'teams-for-linux || teams' : 'start teams',
      paint: isLinux ? 'kolourpaint || gimp' : 'mspaint',
      word: isLinux ? 'libreoffice --writer' : 'start winword',
      excel: isLinux ? 'libreoffice --calc' : 'start excel',
      powerpoint: isLinux ? 'libreoffice --impress' : 'start powerpnt',
      outlook: isLinux ? 'kmail || thunderbird' : 'start outlook',
      explorer: isLinux ? 'dolphin || nautilus' : 'explorer',
      camera: isLinux ? 'kamoso || cheese' : 'start microsoft.windows.camera:',
      photos: isLinux ? 'gwenview || eog' : 'start ms-photos:',
      settings: isLinux ? 'systemsettings || gnome-control-center' : 'start ms-settings:',
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
      id: 'agent-sum-' + Date.now(),
      title: 'Summarizing Screen',
      body: 'Capturing desktop context...',
      kind: 'terminal',
      durationMs: 4000
    });

    try {
      const capture = await this.aiManager.captureScreen();
      if (!capture.success || !capture.dataUrl) {
        throw new Error('Screen capture failed');
      }

      let summary = '';
      await this.aiManager.streamPrompt(
        'gemini',
        'Analyze this desktop screenshot and provide a concise 3-bullet summary of what the user is working on.',
        'gemini-3-flash-preview',
        (chunk: string) => { summary += chunk; },
        undefined,
        'summary-' + Date.now(),
        capture.dataUrl
      );

      this.notifyIsland({
        id: 'agent-sum-done-' + Date.now(),
        title: 'Screen Summary',
        body: summary.slice(0, 100),
        kind: 'done',
        durationMs: 8000
      });
      this.aiManager.speakTTS('Here is what you have open on screen.').catch(() => {});
    } catch (err: any) {
      console.warn('[AutonomousActionAgent] Screen summary failed:', err.message);
    }
  }

  private notifyIsland(payload: {
    id: string;
    title: string;
    body: string;
    kind?: string;
    durationMs?: number;
  }): void {
    const wins = BrowserWindow.getAllWindows();
    wins.forEach((w) => {
      if (!w.isDestroyed()) {
        w.webContents.send('notification:push', {
          id: payload.id,
          appName: payload.title,
          title: payload.title,
          body: payload.body,
          kind: payload.kind || 'done',
          durationMs: payload.durationMs || 4000,
          timestamp: Date.now()
        });
      }
    });
  }

  private safeOpenExternal(target: string): void {
    try {
      shell.openExternal(target).catch(() => {
        exec(`start "" "${target}"`);
      });
    } catch {
      exec(`start "" "${target}"`);
    }
  }
}
