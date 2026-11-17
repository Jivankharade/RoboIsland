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

    // 1. Fast-path regex checks for instant local actions without API roundtrip
    const lower = input.toLowerCase();

    // YouTube direct open
    if (/^(open|play|launch)\s+youtube/i.test(lower)) {
      const queryMatch = lower.replace(/^(open|play|launch)\s+youtube\s*(and\s*play|and\s*search)?/i, '').trim();
      const targetUrl = queryMatch
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(queryMatch)}`
        : 'https://www.youtube.com';
      await this.executeOpenUrl(targetUrl, 'YouTube');
      return { isAction: true, replyText: 'Opening YouTube for you now.' };
    }

    // Direct Screen Summary
    if (/^(summarise|summarize|read)\s*(my|the)?\s*screen/i.test(lower) || lower === 'summarise' || lower === 'summarize') {
      await this.executeSummarizeScreen();
      return { isAction: true, replyText: 'Analyzing your screen now.' };
    }

    // Direct RAM Optimization
    if (/^(free|optimize|clean|clear)\s*(the\s*)?(ram|memory)/i.test(lower)) {
      await this.diagnostics.optimizeMemory();
      return { isAction: true, replyText: 'Memory optimized successfully.' };
    }

    // Direct Junk Cleanup
    if (/^(clean|purge|delete|clear)\s*(laptop\s*|system\s*)?(junk|temp|cache)/i.test(lower)) {
      await this.diagnostics.cleanJunkFiles();
      return { isAction: true, replyText: 'Temporary junk files cleaned.' };
    }

    // 2. Comprehensive AI Action Intent Parser using Gemini
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
    const systemInstruction = `You are JARVIS, the autonomous OS action agent for Gaurav's Windows laptop.
Translate the user's request into a single executable system action.
Available actions:
1. 'send_whatsapp': params: { contact: string, message: string }
2. 'call_whatsapp': params: { contact?: string }
3. 'open_url': params: { url: string, targetName?: string }
4. 'launch_app': params: { app: string }
5. 'summarize_screen': params: {}
6. 'fix_screen_bug': params: {}
7. 'optimize_ram': params: {}
8. 'clean_junk': params: {}
9. 'chat_reply': params: { text: string } (use only if no system action or task is requested)

Respond with ONLY valid JSON:
{
  "action": "send_whatsapp" | "call_whatsapp" | "open_url" | "launch_app" | "summarize_screen" | "fix_screen_bug" | "optimize_ram" | "clean_junk" | "chat_reply",
  "params": {},
  "spokenConfirmation": "Short natural sentence for JARVIS to speak aloud via speakers",
  "displayHeadline": "Under 22 chars title for Dynamic Island (e.g. 'Opening YouTube')",
  "displayBody": "Under 60 chars description (e.g. 'Playing songs on YouTube')"
}`;

    let responseText = '';
    await this.aiManager.streamPrompt(
      'gemini',
      userPrompt,
      'gemini-3-flash-preview',
      (chunk) => { responseText += chunk; },
      undefined,
      'intent-parser-' + Date.now()
    );

    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]) as AgentActionResponse;
    } catch {
      return null;
    }
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
        body: intent.displayBody || 'Autonomous action in progress',
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
        await this.executeLaunchApp(params.app);
        break;

      case 'summarize_screen':
        await this.executeSummarizeScreen();
        break;

      case 'fix_screen_bug':
        await this.diagnostics.triggerJarvisScreenVision();
        break;

      case 'optimize_ram':
        await this.diagnostics.optimizeMemory();
        break;

      case 'clean_junk':
        await this.diagnostics.cleanJunkFiles();
        break;

      default:
        break;
    }
  }

  private async executeSendWhatsApp(contact: string, message: string): Promise<void> {
    const targetContact = (contact || '').trim();
    const msg = (message || 'Hi').trim();

    // 1. First trigger WhatsApp desktop app via protocol
    try {
      if (targetContact) {
        // Try searching contact or sending via protocol
        shell.openExternal(`whatsapp://send?text=${encodeURIComponent(msg)}`);
      } else {
        shell.openExternal(`whatsapp://send?text=${encodeURIComponent(msg)}`);
      }
    } catch {}

    // 2. Also invoke native Win32 background helper if WhatsApp is running
    const scriptPath = path.join(__dirname, '..', 'native', 'whatsapp-sender.ps1');
    const safeText = msg.replace(/'/g, "''");
    const safeContact = targetContact.replace(/'/g, "''");
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Text '${safeText}' -Contact '${safeContact}'`;

    exec(psCmd, () => {
      this.notifyIsland({
        id: 'wa-sent-' + Date.now(),
        title: `WhatsApp: ${targetContact || 'Contact'}`,
        body: `Sent: "${msg.slice(0, 50)}"`,
        kind: 'whatsapp',
        durationMs: 5000
      });
    });
  }

  private async executeCallWhatsApp(contact?: string): Promise<void> {
    shell.openExternal('whatsapp://');
    this.notifyIsland({
      id: 'wa-call-' + Date.now(),
      title: 'WhatsApp Call',
      body: contact ? `Initiating call to ${contact}...` : 'Opening WhatsApp calls...',
      kind: 'whatsapp',
      durationMs: 5000
    });
  }

  private async executeOpenUrl(url: string, targetName = 'Browser'): Promise<void> {
    let target = url;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    shell.openExternal(target);

    this.notifyIsland({
      id: 'open-url-' + Date.now(),
      title: `Opened ${targetName}`,
      body: target.slice(0, 60),
      kind: 'chrome',
      durationMs: 4000
    });
  }

  private async executeLaunchApp(appName: string): Promise<void> {
    const name = (appName || '').toLowerCase().trim();
    let cmd = '';

    if (name.includes('code') || name.includes('vs code') || name.includes('vscode')) {
      cmd = 'code';
    } else if (name.includes('chrome')) {
      cmd = 'start chrome';
    } else if (name.includes('edge')) {
      cmd = 'start msedge';
    } else if (name.includes('notepad')) {
      cmd = 'notepad';
    } else if (name.includes('calc') || name.includes('calculator')) {
      cmd = 'calc';
    } else if (name.includes('terminal') || name.includes('powershell')) {
      cmd = 'start wt || start powershell';
    } else if (name.includes('spotify')) {
      cmd = 'start spotify';
    } else if (name.includes('whatsapp')) {
      shell.openExternal('whatsapp://');
      return;
    } else if (name.includes('settings')) {
      shell.openExternal('ms-settings:');
      return;
    } else if (name.includes('task') && name.includes('manager')) {
      cmd = 'taskmgr';
    } else if (name.includes('explorer') || name.includes('files')) {
      cmd = 'explorer';
    } else {
      cmd = `start ${appName}`;
    }

    exec(cmd, () => {
      this.notifyIsland({
        id: 'app-launch-' + Date.now(),
        title: 'App Launched',
        body: `Started ${appName}.`,
        kind: 'done',
        durationMs: 4000
      });
    });
  }

  private async executeSummarizeScreen(): Promise<void> {
    this.notifyIsland({
      id: 'screen-summary-scan',
      title: 'JARVIS Screen Reader',
      body: 'Capturing and summarizing desktop display...',
      kind: 'terminal',
      durationMs: 8000
    });

    try {
      const capture = await this.aiManager.captureScreen();
      if (!capture.success || !capture.dataUrl) {
        throw new Error('Could not capture display');
      }

      const prompt = `You are JARVIS, an autonomous intelligence on Gaurav's laptop.
Observe this full desktop screenshot.
Provide a concise executive summary of what is on Gaurav's screen right now.
Structure:
- Active Window & Workflow
- Key Information / Errors / Document Content
- Suggested next step if applicable

Keep the entire summary under 4 short bullet points. Also provide a 1-sentence spoken summary.`;

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

      // Copy summary to clipboard for instant pasting
      clipboard.writeText(summaryOutput);

      const firstLine = summaryOutput.split('\n').filter(l => l.trim().length > 0)[0] || 'Desktop summarized.';
      this.notifyIsland({
        id: 'screen-summary-done-' + Date.now(),
        title: 'Screen Summarized',
        body: firstLine.slice(0, 60),
        kind: 'done',
        durationMs: 12000,
        actions: [
          { id: 'copy:' + summaryOutput, label: 'Copy Full Summary', primary: true }
        ]
      });

      this.aiManager.speakTTS('I have summarized your screen and copied the breakdown to your clipboard.').catch(() => {});
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

  private notifyIsland(payload: any): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('island:notify', payload);
      }
    }
  }
}
