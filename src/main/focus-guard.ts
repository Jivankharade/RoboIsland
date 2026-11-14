/**
 * RoboIsland 2.0 - Focus Guard & Pomodoro Engine (`src/main/focus-guard.ts`)
 * 
 * Capabilities:
 * 1. User-controlled website & desktop app blocklists.
 * 2. Non-invasive GetForegroundWindow user-space inspection (zero hosts file tampering).
 * 3. Pomodoro timer engine (25m Focus / 5m Short Break / 15m Long Break).
 * 4. 5-minute emergency manual unblock with confirmation & expiration.
 * 5. Productivity metrics: focus time today, sessions completed, distractions blocked.
 * 6. Calm breathing distraction modal trigger with 5-second countdown.
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { configStore } from './config-store';

export type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';
export type PomodoroStatus = 'idle' | 'running' | 'paused';
export type BlockItemType = 'domain' | 'app';

export interface BlockedItem {
  id: string;
  target: string;
  type: BlockItemType;
  enabled: boolean;
  addedAt: number;
}

export interface ForegroundWindow {
  title: string;
  processName: string;
  pid?: number;
  hwnd?: number;
}

export interface DistractionMatch {
  isDistracting: boolean;
  item: BlockedItem;
  matchedOn: 'domain' | 'process' | 'title';
  windowTitle: string;
  processName: string;
  timestamp: number;
}

export interface PomodoroState {
  mode: PomodoroMode;
  status: PomodoroStatus;
  timeRemaining: number;
  totalDuration: number;
  currentCycle: number;
  totalCycles: number;
}

export interface ProductivityStats {
  focusTimeSecondsToday: number;
  sessionsCompleted: number;
  distractionsBlocked: number;
  todayDate: string;
  lifetimeFocusTimeSeconds: number;
  lifetimeSessionsCompleted: number;
  lifetimeDistractionsBlocked: number;
}

export interface EmergencyOverrideState {
  active: boolean;
  remainingSeconds: number;
  expiresAt: number;
  durationSeconds: number;
}

export interface FocusGuardFullState {
  enabled: boolean;
  pomodoro: PomodoroState;
  override: EmergencyOverrideState;
  stats: ProductivityStats;
  blocklist: BlockedItem[];
}

export const DEFAULT_BLOCKED_ITEMS: Array<{ target: string; type: BlockItemType }> = [
  { target: 'youtube.com', type: 'domain' },
  { target: 'twitter.com', type: 'domain' },
  { target: 'x.com', type: 'domain' },
  { target: 'reddit.com', type: 'domain' },
  { target: 'instagram.com', type: 'domain' },
  { target: 'facebook.com', type: 'domain' },
  { target: 'tiktok.com', type: 'domain' },
  { target: 'twitch.tv', type: 'domain' },
  { target: 'netflix.com', type: 'domain' },
  { target: 'discord.exe', type: 'app' },
  { target: 'steam.exe', type: 'app' }
];

export const KNOWN_BROWSERS = [
  'chrome',
  'msedge',
  'firefox',
  'brave',
  'opera',
  'vivaldi',
  'arc',
  'waterfox',
  'safari',
  'browser'
];

export class FocusGuard extends EventEmitter {
  private enabled: boolean = true;
  private blocklist: Map<string, BlockedItem> = new Map();
  
  // Pomodoro
  private pomodoroMode: PomodoroMode = 'focus';
  private pomodoroStatus: PomodoroStatus = 'idle';
  private timeRemaining: number = 25 * 60;
  private totalDuration: number = 25 * 60;
  private currentCycle: number = 1;
  private readonly totalCycles: number = 4;
  private pomodoroTimer: NodeJS.Timeout | null = null;

  // Custom durations (seconds)
  private durations: Record<PomodoroMode, number> = {
    focus: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  };

  // Emergency Override
  private overrideExpiry: number = 0;
  private readonly overrideDefaultDuration: number = 5 * 60; // 5 minutes

  // Productivity Statistics
  private stats: ProductivityStats = {
    focusTimeSecondsToday: 0,
    sessionsCompleted: 0,
    distractionsBlocked: 0,
    todayDate: this.getTodayDateString(),
    lifetimeFocusTimeSeconds: 0,
    lifetimeSessionsCompleted: 0,
    lifetimeDistractionsBlocked: 0
  };

  // Polling
  private pollTimer: NodeJS.Timeout | null = null;
  private pollIntervalMs: number = 1000;
  private customForegroundProvider: (() => Promise<ForegroundWindow> | ForegroundWindow) | null = null;
  private lastDistractionTimestamp: number = 0;
  private lastDistractionTarget: string = '';
  private guardWin: BrowserWindow | null = null;
  private currentDistractionHwnd: number | null = null;

  constructor() {
    super();
    this.initBlocklist();
    this.checkDayRollOver();
  }

  /* ------------------------------------------------------------------------
   * 1. BLOCKLIST MANAGEMENT
   * ------------------------------------------------------------------------ */

  private initBlocklist(): void {
    // Seed defaults first
    for (const item of DEFAULT_BLOCKED_ITEMS) {
      this.addBlockedItem(item.target, item.type, false);
    }

    // Attempt to merge from configStore if available
    try {
      const cfg = configStore?.get?.();
      if (cfg && Array.isArray(cfg.focusGuardBlockedApps) && cfg.focusGuardBlockedApps.length > 0) {
        for (const item of cfg.focusGuardBlockedApps) {
          const type: BlockItemType = item.toLowerCase().endsWith('.exe') ? 'app' : 'domain';
          this.addBlockedItem(item, type, false);
        }
        if (typeof cfg.focusGuardEnabled === 'boolean') {
          this.enabled = cfg.focusGuardEnabled;
        }
      }
    } catch {
      // Fallback to defaults
    }
  }

  public getBlocklist(): BlockedItem[] {
    return Array.from(this.blocklist.values());
  }

  public addBlockedItem(targetRaw: string, type?: BlockItemType, syncConfig = true): BlockedItem {
    const target = targetRaw.trim().toLowerCase();
    if (!target) {
      throw new Error('Target cannot be empty');
    }

    const determinedType: BlockItemType = type || (target.endsWith('.exe') ? 'app' : 'domain');
    const id = `${determinedType}:${target}`;

    const item: BlockedItem = {
      id,
      target,
      type: determinedType,
      enabled: true,
      addedAt: Date.now()
    };

    this.blocklist.set(id, item);

    if (syncConfig) {
      this.syncBlocklistToConfig();
    }
    this.emit('blocklist:updated', this.getBlocklist());
    return item;
  }

  public removeBlockedItem(idOrTarget: string, syncConfig = true): boolean {
    const raw = idOrTarget.trim().toLowerCase();
    let idToDelete = raw;

    if (!this.blocklist.has(idToDelete)) {
      // Try resolving by target name
      for (const [id, item] of this.blocklist.entries()) {
        if (item.target === raw || item.id.toLowerCase() === raw) {
          idToDelete = id;
          break;
        }
      }
    }

    const deleted = this.blocklist.delete(idToDelete);
    if (deleted) {
      if (syncConfig) {
        this.syncBlocklistToConfig();
      }
      this.emit('blocklist:updated', this.getBlocklist());
    }
    return deleted;
  }

  public toggleBlockedItem(idOrTarget: string, enabled?: boolean): boolean {
    const raw = idOrTarget.trim().toLowerCase();
    let foundItem: BlockedItem | null = null;

    if (this.blocklist.has(raw)) {
      foundItem = this.blocklist.get(raw)!;
    } else {
      for (const item of this.blocklist.values()) {
        if (item.target === raw || item.id === raw) {
          foundItem = item;
          break;
        }
      }
    }

    if (!foundItem) return false;
    foundItem.enabled = enabled !== undefined ? enabled : !foundItem.enabled;
    this.emit('blocklist:updated', this.getBlocklist());
    return true;
  }

  public setMasterEnabled(enabled: boolean): void {
    this.enabled = enabled;
    try {
      configStore?.update?.({ focusGuardEnabled: enabled });
    } catch {
      // Ignored in test environment
    }
    this.emit('state:updated', this.getFullState());
  }

  public isMasterEnabled(): boolean {
    return this.enabled;
  }

  private syncBlocklistToConfig(): void {
    try {
      const appTargets = Array.from(this.blocklist.values())
        .filter((i) => i.enabled)
        .map((i) => i.target);
      configStore?.update?.({
        focusGuardBlockedApps: appTargets,
        focusGuardEnabled: this.enabled
      });
    } catch {
      // Ignored if outside electron context
    }
  }

  /* ------------------------------------------------------------------------
   * 2. NON-INVASIVE FOREGROUND WINDOW INSPECTION (Zero hosts file modification)
   * ------------------------------------------------------------------------ */

  public setForegroundProvider(provider: (() => Promise<ForegroundWindow> | ForegroundWindow) | null): void {
    this.customForegroundProvider = provider;
  }

  /**
   * Retrieves active foreground window title and process name non-invasively via GetForegroundWindow.
   * Does NOT alter DNS, network traffic, or Windows hosts file.
   */
  public async getForegroundWindow(): Promise<ForegroundWindow> {
    if (this.customForegroundProvider) {
      return await this.customForegroundProvider();
    }

    // Windows native inspection via user32.dll GetForegroundWindow & GetWindowText
    return new Promise((resolve) => {
      if (process.platform !== 'win32') {
        resolve({ title: '', processName: '' });
        return;
      }

      const psScript = `
$sig = @'
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, System.Text.StringBuilder s, int n);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
'@
$Win32 = Add-Type -MemberDefinition $sig -Name "Win32Focus" -Namespace "RoboIslandFocus" -PassThru -ErrorAction SilentlyContinue
$hwnd = [RoboIslandFocus.Win32Focus]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 512
[void][RoboIslandFocus.Win32Focus]::GetWindowText($hwnd, $sb, 512)
$pid = 0
[void][RoboIslandFocus.Win32Focus]::GetWindowThreadProcessId($hwnd, [ref]$pid)
$pName = ""
if ($pid -gt 0) {
  try { $pName = (Get-Process -Id $pid).ProcessName } catch {}
}
@{ title = $sb.ToString(); process = $pName; pid = $pid } | ConvertTo-Json -Compress
`;

      exec(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\n/g, ' ')}"`, { timeout: 1500 }, (err, stdout) => {
        if (err || !stdout) {
          resolve({ title: '', processName: '' });
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          resolve({
            title: String(parsed.title || ''),
            processName: String(parsed.process || ''),
            pid: Number(parsed.pid) || 0
          });
        } catch {
          resolve({ title: '', processName: '' });
        }
      });
    });
  }

  /**
   * Evaluates if a given or current foreground window matches any active blocklist item.
   * Only triggers during an active focus session when emergency override is not active.
   */
  public checkDistraction(windowInfo: ForegroundWindow): DistractionMatch | null {
    if (!this.enabled) return null;
    if (this.isEmergencyOverrideActive()) return null;
    if (this.pomodoroStatus !== 'running' || this.pomodoroMode !== 'focus') return null;

    const titleLower = (windowInfo.title || '').toLowerCase();
    const procLower = (windowInfo.processName || '').toLowerCase().replace(/\.exe$/, '');
    const isBrowser = KNOWN_BROWSERS.some((b) => procLower.includes(b));

    for (const item of this.blocklist.values()) {
      if (!item.enabled) continue;
      const targetLower = item.target.toLowerCase();

      // Case A: Desktop App process match
      if (item.type === 'app') {
        const appClean = targetLower.replace(/\.exe$/, '');
        if (procLower === appClean || procLower.includes(appClean)) {
          return {
            isDistracting: true,
            item,
            matchedOn: 'process',
            windowTitle: windowInfo.title,
            processName: windowInfo.processName,
            timestamp: Date.now()
          };
        }
        // Also check if app name is in window title if process is ambiguous
        if (titleLower.includes(appClean) && !isBrowser) {
          return {
            isDistracting: true,
            item,
            matchedOn: 'title',
            windowTitle: windowInfo.title,
            processName: windowInfo.processName,
            timestamp: Date.now()
          };
        }
      }

      // Case B: Website domain match (in browser title or URL bar title)
      if (item.type === 'domain') {
        // Extract base domain name (e.g. "youtube" from "youtube.com")
        const baseName = targetLower.split('.')[0];
        
        // Match exact domain or base name if active window is a browser
        const domainInTitle = titleLower.includes(targetLower);
        const baseNameInTitle = baseName.length >= 3 && titleLower.includes(baseName);

        if (domainInTitle || (isBrowser && baseNameInTitle)) {
          return {
            isDistracting: true,
            item,
            matchedOn: 'domain',
            windowTitle: windowInfo.title,
            processName: windowInfo.processName,
            timestamp: Date.now()
          };
        }
      }
    }

    return null;
  }

  public startForegroundPolling(intervalMs = 1000): void {
    this.pollIntervalMs = intervalMs;
    if (this.pollTimer) clearInterval(this.pollTimer);

    this.pollTimer = setInterval(async () => {
      if (!this.enabled || this.pomodoroStatus !== 'running' || this.pomodoroMode !== 'focus') {
        return;
      }
      if (this.isEmergencyOverrideActive()) {
        return;
      }

      try {
        const fg = await this.getForegroundWindow();
        const match = this.checkDistraction(fg);

        if (match) {
          const now = Date.now();
          // Debounce same distraction within 6 seconds
          if (now - this.lastDistractionTimestamp > 6000 || this.lastDistractionTarget !== match.item.target) {
            this.lastDistractionTimestamp = now;
            this.lastDistractionTarget = match.item.target;
            this.recordDistractionBlocked();
            this.emit('focus:distraction', match);
            this.broadcast('focus:distraction', match);
            this.showGuardWindow(match.item.target, fg?.hwnd);
          }
        }
      } catch (err) {
        // Safe failover, never crash main process
      }
    }, this.pollIntervalMs);
  }

  public showGuardWindow(targetName: string, hwnd?: number): void {
    if (this.guardWin && !this.guardWin.isDestroyed()) return;
    this.currentDistractionHwnd = typeof hwnd === 'number' ? hwnd : null;

    try {
      const { screen } = require('electron');
      const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      this.guardWin = new BrowserWindow({
        ...d.bounds,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        show: false,
        hasShadow: false,
        backgroundColor: '#00000000',
        webPreferences: {
          preload: path.join(__dirname, '../renderer/guard/guard-preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      });

      this.guardWin.setAlwaysOnTop(true, 'screen-saver');
      const guardHtmlPath = path.join(__dirname, '../renderer/guard/guard.html');
      this.guardWin.loadFile(guardHtmlPath, {
        query: {
          name: targetName || 'this',
          wait: '5',
          allow: '5',
          lang: 'en'
        }
      });

      this.guardWin.once('ready-to-show', () => {
        if (!this.guardWin || this.guardWin.isDestroyed()) return;
        this.guardWin.show();
        this.guardWin.focus();
      });

      this.guardWin.on('closed', () => {
        this.guardWin = null;
      });
    } catch (err) {
      console.warn('[FocusGuard] Failed to launch TwoCode guard window:', err);
    }
  }

  public stopForegroundPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /* ------------------------------------------------------------------------
   * 3. POMODORO TIMER ENGINE (25m / 5m / 15m)
   * ------------------------------------------------------------------------ */

  public startPomodoro(): PomodoroState {
    this.checkDayRollOver();
    if (this.pomodoroStatus === 'running') {
      return this.getPomodoroState();
    }

    this.pomodoroStatus = 'running';
    if (!this.pomodoroTimer) {
      this.pomodoroTimer = setInterval(() => this.tickPomodoro(), 1000);
    }

    // Ensure polling is active when focus begins
    if (!this.pollTimer) {
      this.startForegroundPolling(this.pollIntervalMs);
    }

    this.emit('pomodoro:started', this.getPomodoroState());
    this.broadcast('focus:tick', this.getFullState());
    return this.getPomodoroState();
  }

  public pausePomodoro(): PomodoroState {
    if (this.pomodoroStatus !== 'running') {
      return this.getPomodoroState();
    }

    this.pomodoroStatus = 'paused';
    if (this.pomodoroTimer) {
      clearInterval(this.pomodoroTimer);
      this.pomodoroTimer = null;
    }

    this.emit('pomodoro:paused', this.getPomodoroState());
    this.broadcast('focus:tick', this.getFullState());
    return this.getPomodoroState();
  }

  public resetPomodoro(): PomodoroState {
    this.pomodoroStatus = 'idle';
    if (this.pomodoroTimer) {
      clearInterval(this.pomodoroTimer);
      this.pomodoroTimer = null;
    }

    this.timeRemaining = this.durations[this.pomodoroMode];
    this.totalDuration = this.durations[this.pomodoroMode];

    this.emit('pomodoro:reset', this.getPomodoroState());
    this.broadcast('focus:tick', this.getFullState());
    return this.getPomodoroState();
  }

  public skipPomodoro(): PomodoroState {
    this.advanceCycle(true);
    return this.getPomodoroState();
  }

  public setPomodoroMode(mode: PomodoroMode, customDurationMinutes?: number): PomodoroState {
    this.pomodoroMode = mode;
    if (typeof customDurationMinutes === 'number' && customDurationMinutes > 0) {
      this.durations[mode] = Math.round(customDurationMinutes * 60);
    }
    this.timeRemaining = this.durations[mode];
    this.totalDuration = this.durations[mode];
    this.pomodoroStatus = 'idle';

    if (this.pomodoroTimer) {
      clearInterval(this.pomodoroTimer);
      this.pomodoroTimer = null;
    }

    this.emit('pomodoro:mode-changed', this.getPomodoroState());
    this.broadcast('focus:tick', this.getFullState());
    return this.getPomodoroState();
  }

  public tickPomodoro(): PomodoroState {
    if (this.pomodoroStatus !== 'running') {
      return this.getPomodoroState();
    }

    if (this.timeRemaining > 0) {
      this.timeRemaining--;
      if (this.pomodoroMode === 'focus') {
        this.recordFocusTick();
      }
    }

    if (this.timeRemaining <= 0) {
      this.handleSessionCompletion();
    } else {
      this.broadcast('focus:tick', this.getFullState());
    }

    return this.getPomodoroState();
  }

  private handleSessionCompletion(): void {
    const completedMode = this.pomodoroMode;
    if (completedMode === 'focus') {
      this.recordSessionCompleted();
    }

    this.emit('focus:session-complete', {
      completedMode,
      cycle: this.currentCycle,
      timestamp: Date.now()
    });
    this.broadcast('focus:session-complete', {
      completedMode,
      cycle: this.currentCycle
    });

    this.advanceCycle(false);
  }

  private advanceCycle(wasSkipped: boolean): void {
    if (this.pomodoroMode === 'focus') {
      if (this.currentCycle >= this.totalCycles) {
        // Time for Long Break!
        this.pomodoroMode = 'longBreak';
      } else {
        // Short Break
        this.pomodoroMode = 'shortBreak';
      }
    } else if (this.pomodoroMode === 'shortBreak') {
      this.currentCycle++;
      this.pomodoroMode = 'focus';
    } else if (this.pomodoroMode === 'longBreak') {
      this.currentCycle = 1;
      this.pomodoroMode = 'focus';
    }

    this.timeRemaining = this.durations[this.pomodoroMode];
    this.totalDuration = this.durations[this.pomodoroMode];
    this.pomodoroStatus = 'idle';

    if (this.pomodoroTimer) {
      clearInterval(this.pomodoroTimer);
      this.pomodoroTimer = null;
    }

    this.emit('pomodoro:cycle-advanced', {
      mode: this.pomodoroMode,
      cycle: this.currentCycle,
      wasSkipped
    });
    this.broadcast('focus:tick', this.getFullState());
  }

  public getPomodoroState(): PomodoroState {
    return {
      mode: this.pomodoroMode,
      status: this.pomodoroStatus,
      timeRemaining: this.timeRemaining,
      totalDuration: this.totalDuration,
      currentCycle: this.currentCycle,
      totalCycles: this.totalCycles
    };
  }

  /* ------------------------------------------------------------------------
   * 4. 5-MINUTE EMERGENCY MANUAL OVERRIDE
   * ------------------------------------------------------------------------ */

  public triggerEmergencyOverride(minutes: number = 5): EmergencyOverrideState {
    const durationSeconds = Math.max(1, Math.round(minutes * 60));
    this.overrideExpiry = Date.now() + durationSeconds * 1000;

    const state = this.getEmergencyOverrideStatus();
    this.emit('override:activated', state);
    this.broadcast('focus:override', state);
    this.broadcast('focus:tick', this.getFullState());
    return state;
  }

  public cancelEmergencyOverride(): EmergencyOverrideState {
    this.overrideExpiry = 0;
    const state = this.getEmergencyOverrideStatus();
    this.emit('override:cancelled', state);
    this.broadcast('focus:override', state);
    this.broadcast('focus:tick', this.getFullState());
    return state;
  }

  public isEmergencyOverrideActive(): boolean {
    return Date.now() < this.overrideExpiry;
  }

  public getEmergencyOverrideStatus(): EmergencyOverrideState {
    const now = Date.now();
    const active = now < this.overrideExpiry;
    const remainingSeconds = active ? Math.max(0, Math.ceil((this.overrideExpiry - now) / 1000)) : 0;

    return {
      active,
      remainingSeconds,
      expiresAt: this.overrideExpiry,
      durationSeconds: this.overrideDefaultDuration
    };
  }

  /* ------------------------------------------------------------------------
   * 5. PRODUCTIVITY METRICS & STATISTICS
   * ------------------------------------------------------------------------ */

  private getTodayDateString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private checkDayRollOver(): void {
    const today = this.getTodayDateString();
    if (this.stats.todayDate !== today) {
      this.stats.todayDate = today;
      this.stats.focusTimeSecondsToday = 0;
      this.stats.sessionsCompleted = 0;
      this.stats.distractionsBlocked = 0;
    }
  }

  public recordFocusTick(): void {
    this.checkDayRollOver();
    this.stats.focusTimeSecondsToday++;
    this.stats.lifetimeFocusTimeSeconds++;
  }

  public recordDistractionBlocked(): void {
    this.checkDayRollOver();
    this.stats.distractionsBlocked++;
    this.stats.lifetimeDistractionsBlocked++;
  }

  public recordSessionCompleted(): void {
    this.checkDayRollOver();
    this.stats.sessionsCompleted++;
    this.stats.lifetimeSessionsCompleted++;
  }

  public getStats(): ProductivityStats {
    this.checkDayRollOver();
    return { ...this.stats };
  }

  public resetTodayStats(): ProductivityStats {
    this.stats.focusTimeSecondsToday = 0;
    this.stats.sessionsCompleted = 0;
    this.stats.distractionsBlocked = 0;
    this.stats.todayDate = this.getTodayDateString();
    this.broadcast('focus:tick', this.getFullState());
    return this.getStats();
  }

  /* ------------------------------------------------------------------------
   * 6. FULL STATE & IPC WIRING
   * ------------------------------------------------------------------------ */

  public getFullState(): FocusGuardFullState {
    return {
      enabled: this.enabled,
      pomodoro: this.getPomodoroState(),
      override: this.getEmergencyOverrideStatus(),
      stats: this.getStats(),
      blocklist: this.getBlocklist()
    };
  }

  private broadcast(channel: string, payload: any): void {
    try {
      if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.webContents.send(channel, payload);
          }
        }
      }
    } catch {
      // Ignored outside electron window context
    }
  }

  /**
   * Registers all Focus Guard IPC channels.
   */
  public registerIPC(ipc = ipcMain): void {
    if (!ipc || typeof ipc.handle !== 'function') {
      return;
    }

    ipc.handle('focus:get-state', () => this.getFullState());
    ipc.handle('focus:start', () => this.startPomodoro());
    ipc.handle('focus:pause', () => this.pausePomodoro());
    ipc.handle('focus:reset', () => this.resetPomodoro());
    ipc.handle('focus:skip', () => this.skipPomodoro());
    ipc.handle('focus:set-mode', (_e, mode: PomodoroMode, minutes?: number) => this.setPomodoroMode(mode, minutes));
    ipc.handle('focus:set-enabled', (_e, enabled: boolean) => {
      this.setMasterEnabled(enabled);
      return this.getFullState();
    });

    ipc.handle('focus:add-item', (_e, target: string, type?: BlockItemType) => this.addBlockedItem(target, type));
    ipc.handle('focus:remove-item', (_e, idOrTarget: string) => this.removeBlockedItem(idOrTarget));
    ipc.handle('focus:toggle-item', (_e, idOrTarget: string, enabled?: boolean) => this.toggleBlockedItem(idOrTarget, enabled));

    ipc.handle('focus:emergency-override', (_e, minutes?: number) => this.triggerEmergencyOverride(minutes));
    ipc.handle('focus:cancel-override', () => this.cancelEmergencyOverride());
    ipc.handle('focus:reset-stats', () => this.resetTodayStats());
    ipc.handle('focus:minimize', (_e, pid?: number) => {
      if (pid && process.platform === 'win32') {
        try {
          exec(`powershell -NoProfile -NonInteractive -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).CloseMainWindow()"`);
        } catch {}
      }
      return { ok: true };
    });

    ipc.on('guard:choice', (_e, kind: string) => {
      if (kind === 'back') {
        if (this.currentDistractionHwnd && process.platform === 'win32') {
          try {
            exec(`powershell -NoProfile -NonInteractive -Command "$h = [IntPtr]${this.currentDistractionHwnd}; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class U { [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'; [U]::ShowWindow($h, 6);"`);
          } catch {}
        }
        this.emit('guard:event', 'back');
        this.broadcast('guard:event', 'back');
      } else if (kind === 'anyway') {
        this.triggerEmergencyOverride(5);
        this.emit('guard:event', 'anyway');
        this.broadcast('guard:event', 'anyway');
      }
      try {
        if (this.guardWin && !this.guardWin.isDestroyed()) {
          this.guardWin.close();
          this.guardWin = null;
        }
      } catch {}
    });
  }

  public dispose(): void {
    this.stopForegroundPolling();
    if (this.pomodoroTimer) {
      clearInterval(this.pomodoroTimer);
      this.pomodoroTimer = null;
    }
    this.removeAllListeners();
  }
}

// Global singleton instance
export const focusGuard = new FocusGuard();
focusGuard.registerIPC();
