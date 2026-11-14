import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BrowserWindow, ipcMain } from 'electron';

export interface AIMonitorEvent {
  id: string;
  event: string;
  tool?: string;
  file?: string;
  operation?: 'modified' | 'added' | 'deleted' | 'read' | 'command';
  diff?: string;
  prompt?: string;
  error?: string;
  timestamp: number;
  sessionId?: string;
  status?: 'running' | 'success' | 'failed' | 'question' | 'done' | 'ready' | 'paused' | 'stopped';
  details?: any;
}

export interface AiSessionState {
  connected: boolean;
  agent: 'claude' | 'codex';
  status: 'ready' | 'running' | 'question' | 'error' | 'done' | 'paused' | 'stopped';
  prompt: string;
  currentTool: string;
  filesModified: string[];
  pendingPermission: {
    sessionId: string;
    description: string;
    command?: string;
    tool?: string;
    file?: string;
    diff?: string;
  } | null;
}

const PORT = 47823;
const MAX_HISTORY_EVENTS = 50;

/**
 * Standard Unified Diff Generator using Longest Common Subsequence (LCS).
 * Produces structured unified diffs with header, additions (+), and deletions (-).
 */
export function generateUnifiedDiff(filePath: string, oldContent: string, newContent: string): string {
  const normOld = (oldContent ?? '').replace(/\r\n/g, '\n');
  const normNew = (newContent ?? '').replace(/\r\n/g, '\n');

  const oldLines = normOld ? normOld.split('\n') : [];
  const newLines = normNew ? normNew.split('\n') : [];

  if (oldLines.length === 0 && newLines.length === 0) {
    return `--- a/${filePath}\n+++ b/${filePath}\n@@ -0,0 +0,0 @@\n`;
  }

  if (oldLines.length === 0) {
    const diffLines = newLines.map(line => `+${line}`);
    return `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${newLines.length} @@\n${diffLines.join('\n')}`;
  }

  if (newLines.length === 0) {
    const diffLines = oldLines.map(line => `-${line}`);
    return `--- a/${filePath}\n+++ /dev/null\n@@ -1,${oldLines.length} +0,0 @@\n${diffLines.join('\n')}`;
  }

  // Compute Longest Common Subsequence (LCS) table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to assemble unified diff lines
  const diffLines: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diffLines.push(` ${oldLines[i - 1]}`);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffLines.push(`+${newLines[j - 1]}`);
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diffLines.push(`-${oldLines[i - 1]}`);
      i--;
    }
  }

  diffLines.reverse();
  const header = `--- a/${filePath}\n+++ b/${filePath}\n@@ -1,${oldLines.length} +1,${newLines.length} @@`;
  return `${header}\n${diffLines.join('\n')}`;
}

/**
 * Extracts file path, operation type (modified, added, deleted), and generates diff from tool calls.
 */
export function extractFileMutation(event: any): {
  file?: string;
  operation?: 'modified' | 'added' | 'deleted' | 'read' | 'command';
  diff?: string;
} {
  const tool = String(event.tool || event.tool_name || '').toLowerCase();
  const rawFile = event.file || event.path || event.filePath || event.target ||
    event.tool_input?.TargetFile || event.tool_input?.path || event.tool_input?.file ||
    event.parameters?.TargetFile || event.parameters?.file || event.parameters?.path || '';

  let file = rawFile;
  let operation: 'modified' | 'added' | 'deleted' | 'read' | 'command' | undefined = event.operation;
  let diff: string | undefined = event.diff;

  if (!operation) {
    if (tool.includes('replace') || tool === 'edit' || tool === 'fileedit') {
      operation = 'modified';
    } else if (tool.includes('write') || tool === 'write_to_file') {
      if (file && fs.existsSync(file)) {
        operation = 'modified';
      } else {
        operation = 'added';
      }
    } else if (tool.includes('delete') || tool.includes('unlink') || tool === 'rm') {
      operation = 'deleted';
    } else if (tool.includes('read') || tool.includes('view')) {
      operation = 'read';
    } else if (tool.includes('bash') || tool.includes('run_command') || tool.includes('command')) {
      operation = 'command';
      const cmd = String(event.command || event.tool_input?.CommandLine || event.parameters?.CommandLine || '');
      if (cmd.includes('rm ') || cmd.includes('git rm ')) {
        operation = 'deleted';
      } else if (cmd.includes('touch ')) {
        operation = 'added';
      }
    }
  }

  // Generate diff if not explicitly provided and file info is present
  if (!diff && file) {
    try {
      if (tool.includes('replace_file_content') || tool.includes('replace')) {
        const targetContent = event.tool_input?.TargetContent || event.parameters?.TargetContent || event.targetContent || '';
        const replacementContent = event.tool_input?.ReplacementContent || event.parameters?.ReplacementContent || event.replacementContent || '';
        if (targetContent || replacementContent) {
          diff = generateUnifiedDiff(file, targetContent, replacementContent);
        }
      } else if (tool.includes('write_to_file') || tool === 'write') {
        const newContent = event.tool_input?.CodeContent || event.parameters?.CodeContent || event.content || event.code || '';
        let oldContent = '';
        if (fs.existsSync(file)) {
          oldContent = fs.readFileSync(file, 'utf8');
        }
        diff = generateUnifiedDiff(file, oldContent, newContent);
      } else if (operation === 'deleted') {
        let oldContent = '';
        if (fs.existsSync(file)) {
          oldContent = fs.readFileSync(file, 'utf8');
        }
        diff = generateUnifiedDiff(file, oldContent, '');
      }
    } catch {
      // Gracefully handle unreadable paths
    }
  }

  return { file: file || undefined, operation, diff };
}

export class AiMonitorHub {
  private server: http.Server | null = null;
  private pendingResolvers = new Map<string, (decision: { behavior: 'allow' | 'deny'; action?: string }) => void>();
  private eventHistory: AIMonitorEvent[] = [];
  private isPaused = false;
  private isStopped = false;
  private activePort: number = PORT;

  private currentState: AiSessionState = {
    connected: false,
    agent: 'claude',
    status: 'ready',
    prompt: '',
    currentTool: '',
    filesModified: [],
    pendingPermission: null
  };

  constructor(customPort?: number) {
    this.startServer(customPort || PORT);
    this.setupIPC();
    this.installHooksIfEnabled();
  }

  public getPort(): number {
    return this.activePort;
  }

  private startServer(targetPort = PORT): void {
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${targetPort}`);

      // Handle webhook events from Claude Code and external agents
      if (req.method === 'POST' && (url.pathname === '/twocode-hook' || url.pathname === '/roboisland-hook')) {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          this.handleHookEvent(body, res);
        });
        return;
      }

      // Status check endpoint
      if ((req.method === 'GET' || req.method === 'POST') && (url.pathname === '/twocode-status' || url.pathname === '/roboisland-status')) {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            status: this.currentState.status,
            agent: this.currentState.agent,
            paused: this.isPaused,
            stopped: this.isStopped,
            filesCount: this.currentState.filesModified.length,
            eventsCount: this.eventHistory.length
          }));
        });
        return;
      }

      // External Agent Process Control polling / command endpoint
      if ((req.method === 'GET' || req.method === 'POST') && (url.pathname === '/agent-control' || url.pathname === '/twocode-control')) {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          if (req.method === 'POST' && body) {
            try {
              const parsed = JSON.parse(body);
              if (parsed.action) {
                this.controlAgent(parsed.action);
              }
            } catch {}
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            paused: this.isPaused,
            stopped: this.isStopped,
            status: this.currentState.status,
            pendingPermission: this.currentState.pendingPermission
          }));
        });
        return;
      }

      // Event history inspection endpoint
      if (req.method === 'GET' && url.pathname === '/ai-events') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          events: this.eventHistory,
          state: this.currentState
        }));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    this.server.listen(targetPort, '127.0.0.1', () => {
      this.activePort = targetPort;
      this.currentState.connected = true;
      this.broadcastState();
      console.log(`[AiMonitorHub] Listening on 127.0.0.1:${targetPort}`);
    });

    this.server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && targetPort === PORT) {
        console.warn(`[AiMonitorHub] Port ${PORT} in use, trying fallback port ${PORT + 1}...`);
        this.startServer(PORT + 1);
      }
    });
  }

  private addEvent(event: AIMonitorEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > MAX_HISTORY_EVENTS) {
      this.eventHistory.shift();
    }
    this.broadcastEvent(event);
  }

  private handleHookEvent(rawJson: string, res: http.ServerResponse): void {
    try {
      const event = JSON.parse(rawJson);
      const eventType = event.event || event.type || '';
      const sessionId = event.sessionId || event.session_id || 'session-default';
      const timestamp = event.timestamp || Date.now();
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // Check if paused or stopped
      if (this.isStopped && eventType !== 'Stop' && eventType !== 'SessionEnd') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, stopped: true, action: 'stop' }));
        return;
      }

      if (eventType === 'UserPromptSubmit') {
        this.isStopped = false;
        this.isPaused = false;
        this.currentState.status = 'running';
        this.currentState.prompt = event.prompt || '';
        this.currentState.currentTool = 'Processing query...';

        const monitorEvent: AIMonitorEvent = {
          id,
          event: 'UserPromptSubmit',
          prompt: event.prompt || '',
          sessionId,
          timestamp,
          status: 'running',
          details: event
        };
        this.addEvent(monitorEvent);
        this.broadcastState();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (eventType === 'PreToolUse') {
        this.currentState.status = 'running';
        const toolName = event.tool || event.tool_name || 'Tool';
        const mutation = extractFileMutation(event);
        const target = mutation.file || event.target || event.path || event.command || '';
        this.currentState.currentTool = `${toolName} ${target}`.trim();

        const monitorEvent: AIMonitorEvent = {
          id,
          event: 'PreToolUse',
          tool: toolName,
          file: mutation.file,
          operation: mutation.operation,
          diff: mutation.diff,
          sessionId,
          timestamp,
          status: 'running',
          details: event
        };
        this.addEvent(monitorEvent);
        this.broadcastState();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, paused: this.isPaused }));
        return;
      }

      if (eventType === 'PostToolUse') {
        const toolName = event.tool || event.tool_name || 'Tool';
        const mutation = extractFileMutation(event);

        if (mutation.file && !this.currentState.filesModified.includes(mutation.file)) {
          this.currentState.filesModified.push(mutation.file);
        }

        const monitorEvent: AIMonitorEvent = {
          id,
          event: 'PostToolUse',
          tool: toolName,
          file: mutation.file,
          operation: mutation.operation,
          diff: mutation.diff,
          sessionId,
          timestamp,
          status: 'success',
          details: event
        };
        this.addEvent(monitorEvent);
        this.broadcastState();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (eventType === 'PermissionRequest') {
        this.currentState.status = 'question';
        const description = event.description || event.message || 'Claude requests permission to execute an action.';
        const mutation = extractFileMutation(event);
        const command = event.command || mutation.diff || '';

        this.currentState.pendingPermission = {
          sessionId,
          description,
          command,
          tool: event.tool || event.tool_name,
          file: mutation.file,
          diff: mutation.diff
        };

        const monitorEvent: AIMonitorEvent = {
          id,
          event: 'PermissionRequest',
          tool: event.tool || event.tool_name,
          file: mutation.file,
          operation: mutation.operation,
          diff: mutation.diff,
          sessionId,
          timestamp,
          status: 'question',
          details: { description, command }
        };
        this.addEvent(monitorEvent);
        this.broadcastState();

        // Hold HTTP request open until user clicks Allow or Deny (up to 300s)
        const timeout = setTimeout(() => {
          this.pendingResolvers.delete(sessionId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ behavior: 'deny' }));
        }, 300000);

        this.pendingResolvers.set(sessionId, decision => {
          clearTimeout(timeout);
          this.pendingResolvers.delete(sessionId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ behavior: decision.behavior, action: decision.action }));
        });
        return;
      }

      if (eventType === 'Stop' || eventType === 'SessionEnd') {
        this.currentState.status = 'done';
        this.currentState.currentTool = 'Task Completed';
        this.currentState.pendingPermission = null;

        const monitorEvent: AIMonitorEvent = {
          id,
          event: eventType,
          sessionId,
          timestamp,
          status: 'done',
          details: event
        };
        this.addEvent(monitorEvent);
        this.broadcastState();

        // Reset to ready after 4 seconds
        setTimeout(() => {
          if (this.currentState.status === 'done') {
            this.currentState.status = 'ready';
            this.currentState.currentTool = '';
            this.broadcastState();
          }
        }, 4000);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (eventType === 'PostToolUseFailure' || eventType === 'StopFailure') {
        this.currentState.status = 'error';
        const errMsg = event.error || event.message || 'Execution Error';
        this.currentState.currentTool = errMsg;

        const monitorEvent: AIMonitorEvent = {
          id,
          event: 'PostToolUseFailure',
          tool: event.tool || event.tool_name,
          error: errMsg,
          sessionId,
          timestamp,
          status: 'failed',
          details: event
        };
        this.addEvent(monitorEvent);
        this.broadcastState();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400);
      res.end('Bad Request');
    }
  }

  /**
   * Approves or denies a waiting permission request from agent.
   */
  public resolvePermission(sessionId: string, approved: boolean): void {
    const resolver = this.pendingResolvers.get(sessionId);
    if (resolver) {
      resolver({ behavior: approved ? 'allow' : 'deny' });
    } else {
      // Resolve any pending if default sessionId
      for (const [key, res] of this.pendingResolvers.entries()) {
        res({ behavior: approved ? 'allow' : 'deny' });
        this.pendingResolvers.delete(key);
      }
    }
    this.currentState.pendingPermission = null;
    this.currentState.status = approved ? 'running' : 'ready';
    this.broadcastState();
  }

  /**
   * Process control: stop, pause, allow, deny.
   */
  public controlAgent(action: 'stop' | 'pause' | 'allow' | 'deny'): boolean {
    const timestamp = Date.now();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (action === 'allow' || action === 'deny') {
      const approved = action === 'allow';
      const pendingSession = this.currentState.pendingPermission?.sessionId || 'session-default';
      this.resolvePermission(pendingSession, approved);

      this.addEvent({
        id,
        event: approved ? 'PermissionAllowed' : 'PermissionDenied',
        timestamp,
        status: approved ? 'running' : 'ready',
        details: { action }
      });
      return true;
    }

    if (action === 'pause') {
      this.isPaused = !this.isPaused;
      this.currentState.status = this.isPaused ? 'paused' : 'running';
      this.addEvent({
        id,
        event: this.isPaused ? 'AgentPaused' : 'AgentResumed',
        timestamp,
        status: this.isPaused ? 'paused' : 'running',
        details: { paused: this.isPaused }
      });
      this.broadcastState();
      return true;
    }

    if (action === 'stop') {
      this.isStopped = true;
      // Deny any pending permission requests immediately
      for (const [key, resolver] of this.pendingResolvers.entries()) {
        resolver({ behavior: 'deny', action: 'stop' });
        this.pendingResolvers.delete(key);
      }
      this.currentState.pendingPermission = null;
      this.currentState.status = 'stopped';
      this.currentState.currentTool = 'Task Stopped by User';

      this.addEvent({
        id,
        event: 'Stop',
        timestamp,
        status: 'stopped',
        details: { stopped: true }
      });
      this.broadcastState();
      return true;
    }

    return false;
  }

  /**
   * Returns current 50-event history ring buffer.
   */
  public getEventHistory(): AIMonitorEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Resets process controls (clears stopped/paused state for a new session).
   */
  public resetControls(): void {
    this.isStopped = false;
    this.isPaused = false;
    this.currentState.status = 'ready';
    this.broadcastState();
  }

  private broadcastState(): void {
    try {
      if (typeof BrowserWindow !== 'undefined' && BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        BrowserWindow.getAllWindows().forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('ai:state-changed', this.currentState);
          }
        });
      }
    } catch {}
  }

  private broadcastEvent(event: AIMonitorEvent): void {
    try {
      if (typeof BrowserWindow !== 'undefined' && BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        BrowserWindow.getAllWindows().forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('ai-monitor:event', event);
          }
        });
      }
    } catch {}
  }

  private installHooksIfEnabled(): void {
    // Non-destructive check & setup for ~/.claude/settings.json
    try {
      const claudeDir = path.join(os.homedir(), '.claude');
      const settingsPath = path.join(claudeDir, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(raw);
        settings.hooks = settings.hooks || {};
        
        const hookUrl = `http://127.0.0.1:${PORT}/roboisland-hook`;
        const events = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop'];

        let changed = false;
        events.forEach(evt => {
          settings.hooks[evt] = settings.hooks[evt] || [];
          const exists = settings.hooks[evt].some((group: any) =>
            (group.hooks || []).some((h: any) => typeof h.url === 'string' && h.url.includes(String(PORT)))
          );
          if (!exists) {
            settings.hooks[evt].push({
              hooks: [{ type: 'http', url: hookUrl }]
            });
            changed = true;
          }
        });

        if (changed) {
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        }
      }
    } catch {}
  }

  private setupIPC(): void {
    try {
      if (typeof ipcMain !== 'undefined' && ipcMain && typeof ipcMain.handle === 'function') {
        // AI Monitor Hub typed channels
        ipcMain.handle('ai-monitor:get-history', () => {
          return this.getEventHistory();
        });

        ipcMain.handle('ai-monitor:control', (_event, action: 'stop' | 'pause' | 'allow' | 'deny') => {
          return this.controlAgent(action);
        });

        // Backward compatibility channels
        ipcMain.handle('ai:get-state', () => {
          return this.currentState;
        });

        ipcMain.handle('ai:approve', (_event, payload: { sessionId: string; approved: boolean }) => {
          this.resolvePermission(payload.sessionId, payload.approved);
          return { ok: true };
        });
      }
    } catch {}
  }

  public dispose(): void {
    this.server?.close();
  }
}
