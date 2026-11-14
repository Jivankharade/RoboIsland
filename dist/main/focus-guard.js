"use strict";
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
exports.focusGuard = exports.FocusGuard = exports.KNOWN_BROWSERS = exports.DEFAULT_BLOCKED_ITEMS = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const events_1 = require("events");
const config_store_1 = require("./config-store");
exports.DEFAULT_BLOCKED_ITEMS = [
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
exports.KNOWN_BROWSERS = [
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
class FocusGuard extends events_1.EventEmitter {
    enabled = true;
    blocklist = new Map();
    // Pomodoro
    pomodoroMode = 'focus';
    pomodoroStatus = 'idle';
    timeRemaining = 25 * 60;
    totalDuration = 25 * 60;
    currentCycle = 1;
    totalCycles = 4;
    pomodoroTimer = null;
    // Custom durations (seconds)
    durations = {
        focus: 25 * 60,
        shortBreak: 5 * 60,
        longBreak: 15 * 60
    };
    // Emergency Override
    overrideExpiry = 0;
    overrideDefaultDuration = 5 * 60; // 5 minutes
    // Productivity Statistics
    stats = {
        focusTimeSecondsToday: 0,
        sessionsCompleted: 0,
        distractionsBlocked: 0,
        todayDate: this.getTodayDateString(),
        lifetimeFocusTimeSeconds: 0,
        lifetimeSessionsCompleted: 0,
        lifetimeDistractionsBlocked: 0
    };
    // Polling
    pollTimer = null;
    pollIntervalMs = 1000;
    customForegroundProvider = null;
    lastDistractionTimestamp = 0;
    lastDistractionTarget = '';
    guardWin = null;
    currentDistractionHwnd = null;
    constructor() {
        super();
        this.initBlocklist();
        this.checkDayRollOver();
    }
    /* ------------------------------------------------------------------------
     * 1. BLOCKLIST MANAGEMENT
     * ------------------------------------------------------------------------ */
    initBlocklist() {
        // Seed defaults first
        for (const item of exports.DEFAULT_BLOCKED_ITEMS) {
            this.addBlockedItem(item.target, item.type, false);
        }
        // Attempt to merge from configStore if available
        try {
            const cfg = config_store_1.configStore?.get?.();
            if (cfg && Array.isArray(cfg.focusGuardBlockedApps) && cfg.focusGuardBlockedApps.length > 0) {
                for (const item of cfg.focusGuardBlockedApps) {
                    const type = item.toLowerCase().endsWith('.exe') ? 'app' : 'domain';
                    this.addBlockedItem(item, type, false);
                }
                if (typeof cfg.focusGuardEnabled === 'boolean') {
                    this.enabled = cfg.focusGuardEnabled;
                }
            }
        }
        catch {
            // Fallback to defaults
        }
    }
    getBlocklist() {
        return Array.from(this.blocklist.values());
    }
    addBlockedItem(targetRaw, type, syncConfig = true) {
        const target = targetRaw.trim().toLowerCase();
        if (!target) {
            throw new Error('Target cannot be empty');
        }
        const determinedType = type || (target.endsWith('.exe') ? 'app' : 'domain');
        const id = `${determinedType}:${target}`;
        const item = {
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
    removeBlockedItem(idOrTarget, syncConfig = true) {
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
    toggleBlockedItem(idOrTarget, enabled) {
        const raw = idOrTarget.trim().toLowerCase();
        let foundItem = null;
        if (this.blocklist.has(raw)) {
            foundItem = this.blocklist.get(raw);
        }
        else {
            for (const item of this.blocklist.values()) {
                if (item.target === raw || item.id === raw) {
                    foundItem = item;
                    break;
                }
            }
        }
        if (!foundItem)
            return false;
        foundItem.enabled = enabled !== undefined ? enabled : !foundItem.enabled;
        this.emit('blocklist:updated', this.getBlocklist());
        return true;
    }
    setMasterEnabled(enabled) {
        this.enabled = enabled;
        try {
            config_store_1.configStore?.update?.({ focusGuardEnabled: enabled });
        }
        catch {
            // Ignored in test environment
        }
        this.emit('state:updated', this.getFullState());
    }
    isMasterEnabled() {
        return this.enabled;
    }
    syncBlocklistToConfig() {
        try {
            const appTargets = Array.from(this.blocklist.values())
                .filter((i) => i.enabled)
                .map((i) => i.target);
            config_store_1.configStore?.update?.({
                focusGuardBlockedApps: appTargets,
                focusGuardEnabled: this.enabled
            });
        }
        catch {
            // Ignored if outside electron context
        }
    }
    /* ------------------------------------------------------------------------
     * 2. NON-INVASIVE FOREGROUND WINDOW INSPECTION (Zero hosts file modification)
     * ------------------------------------------------------------------------ */
    setForegroundProvider(provider) {
        this.customForegroundProvider = provider;
    }
    /**
     * Retrieves active foreground window title and process name non-invasively via GetForegroundWindow.
     * Does NOT alter DNS, network traffic, or Windows hosts file.
     */
    async getForegroundWindow() {
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
            (0, child_process_1.exec)(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\n/g, ' ')}"`, { timeout: 1500 }, (err, stdout) => {
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
                }
                catch {
                    resolve({ title: '', processName: '' });
                }
            });
        });
    }
    /**
     * Evaluates if a given or current foreground window matches any active blocklist item.
     * Only triggers during an active focus session when emergency override is not active.
     */
    checkDistraction(windowInfo) {
        if (!this.enabled)
            return null;
        if (this.isEmergencyOverrideActive())
            return null;
        if (this.pomodoroStatus !== 'running' || this.pomodoroMode !== 'focus')
            return null;
        const titleLower = (windowInfo.title || '').toLowerCase();
        const procLower = (windowInfo.processName || '').toLowerCase().replace(/\.exe$/, '');
        const isBrowser = exports.KNOWN_BROWSERS.some((b) => procLower.includes(b));
        for (const item of this.blocklist.values()) {
            if (!item.enabled)
                continue;
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
    startForegroundPolling(intervalMs = 1000) {
        this.pollIntervalMs = intervalMs;
        if (this.pollTimer)
            clearInterval(this.pollTimer);
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
            }
            catch (err) {
                // Safe failover, never crash main process
            }
        }, this.pollIntervalMs);
    }
    showGuardWindow(targetName, hwnd) {
        if (this.guardWin && !this.guardWin.isDestroyed())
            return;
        this.currentDistractionHwnd = typeof hwnd === 'number' ? hwnd : null;
        try {
            const { screen } = require('electron');
            const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
            this.guardWin = new electron_1.BrowserWindow({
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
                if (!this.guardWin || this.guardWin.isDestroyed())
                    return;
                this.guardWin.show();
                this.guardWin.focus();
            });
            this.guardWin.on('closed', () => {
                this.guardWin = null;
            });
        }
        catch (err) {
            console.warn('[FocusGuard] Failed to launch TwoCode guard window:', err);
        }
    }
    stopForegroundPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }
    /* ------------------------------------------------------------------------
     * 3. POMODORO TIMER ENGINE (25m / 5m / 15m)
     * ------------------------------------------------------------------------ */
    startPomodoro() {
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
    pausePomodoro() {
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
    resetPomodoro() {
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
    skipPomodoro() {
        this.advanceCycle(true);
        return this.getPomodoroState();
    }
    setPomodoroMode(mode, customDurationMinutes) {
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
    tickPomodoro() {
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
        }
        else {
            this.broadcast('focus:tick', this.getFullState());
        }
        return this.getPomodoroState();
    }
    handleSessionCompletion() {
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
    advanceCycle(wasSkipped) {
        if (this.pomodoroMode === 'focus') {
            if (this.currentCycle >= this.totalCycles) {
                // Time for Long Break!
                this.pomodoroMode = 'longBreak';
            }
            else {
                // Short Break
                this.pomodoroMode = 'shortBreak';
            }
        }
        else if (this.pomodoroMode === 'shortBreak') {
            this.currentCycle++;
            this.pomodoroMode = 'focus';
        }
        else if (this.pomodoroMode === 'longBreak') {
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
    getPomodoroState() {
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
    triggerEmergencyOverride(minutes = 5) {
        const durationSeconds = Math.max(1, Math.round(minutes * 60));
        this.overrideExpiry = Date.now() + durationSeconds * 1000;
        const state = this.getEmergencyOverrideStatus();
        this.emit('override:activated', state);
        this.broadcast('focus:override', state);
        this.broadcast('focus:tick', this.getFullState());
        return state;
    }
    cancelEmergencyOverride() {
        this.overrideExpiry = 0;
        const state = this.getEmergencyOverrideStatus();
        this.emit('override:cancelled', state);
        this.broadcast('focus:override', state);
        this.broadcast('focus:tick', this.getFullState());
        return state;
    }
    isEmergencyOverrideActive() {
        return Date.now() < this.overrideExpiry;
    }
    getEmergencyOverrideStatus() {
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
    getTodayDateString() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    checkDayRollOver() {
        const today = this.getTodayDateString();
        if (this.stats.todayDate !== today) {
            this.stats.todayDate = today;
            this.stats.focusTimeSecondsToday = 0;
            this.stats.sessionsCompleted = 0;
            this.stats.distractionsBlocked = 0;
        }
    }
    recordFocusTick() {
        this.checkDayRollOver();
        this.stats.focusTimeSecondsToday++;
        this.stats.lifetimeFocusTimeSeconds++;
    }
    recordDistractionBlocked() {
        this.checkDayRollOver();
        this.stats.distractionsBlocked++;
        this.stats.lifetimeDistractionsBlocked++;
    }
    recordSessionCompleted() {
        this.checkDayRollOver();
        this.stats.sessionsCompleted++;
        this.stats.lifetimeSessionsCompleted++;
    }
    getStats() {
        this.checkDayRollOver();
        return { ...this.stats };
    }
    resetTodayStats() {
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
    getFullState() {
        return {
            enabled: this.enabled,
            pomodoro: this.getPomodoroState(),
            override: this.getEmergencyOverrideStatus(),
            stats: this.getStats(),
            blocklist: this.getBlocklist()
        };
    }
    broadcast(channel, payload) {
        try {
            if (electron_1.BrowserWindow && typeof electron_1.BrowserWindow.getAllWindows === 'function') {
                const windows = electron_1.BrowserWindow.getAllWindows();
                for (const win of windows) {
                    if (!win.isDestroyed()) {
                        win.webContents.send(channel, payload);
                    }
                }
            }
        }
        catch {
            // Ignored outside electron window context
        }
    }
    /**
     * Registers all Focus Guard IPC channels.
     */
    registerIPC(ipc = electron_1.ipcMain) {
        if (!ipc || typeof ipc.handle !== 'function') {
            return;
        }
        ipc.handle('focus:get-state', () => this.getFullState());
        ipc.handle('focus:start', () => this.startPomodoro());
        ipc.handle('focus:pause', () => this.pausePomodoro());
        ipc.handle('focus:reset', () => this.resetPomodoro());
        ipc.handle('focus:skip', () => this.skipPomodoro());
        ipc.handle('focus:set-mode', (_e, mode, minutes) => this.setPomodoroMode(mode, minutes));
        ipc.handle('focus:set-enabled', (_e, enabled) => {
            this.setMasterEnabled(enabled);
            return this.getFullState();
        });
        ipc.handle('focus:add-item', (_e, target, type) => this.addBlockedItem(target, type));
        ipc.handle('focus:remove-item', (_e, idOrTarget) => this.removeBlockedItem(idOrTarget));
        ipc.handle('focus:toggle-item', (_e, idOrTarget, enabled) => this.toggleBlockedItem(idOrTarget, enabled));
        ipc.handle('focus:emergency-override', (_e, minutes) => this.triggerEmergencyOverride(minutes));
        ipc.handle('focus:cancel-override', () => this.cancelEmergencyOverride());
        ipc.handle('focus:reset-stats', () => this.resetTodayStats());
        ipc.handle('focus:minimize', (_e, pid) => {
            if (pid && process.platform === 'win32') {
                try {
                    (0, child_process_1.exec)(`powershell -NoProfile -NonInteractive -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).CloseMainWindow()"`);
                }
                catch { }
            }
            return { ok: true };
        });
        ipc.on('guard:choice', (_e, kind) => {
            if (kind === 'back') {
                if (this.currentDistractionHwnd && process.platform === 'win32') {
                    try {
                        (0, child_process_1.exec)(`powershell -NoProfile -NonInteractive -Command "$h = [IntPtr]${this.currentDistractionHwnd}; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class U { [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'; [U]::ShowWindow($h, 6);"`);
                    }
                    catch { }
                }
                this.emit('guard:event', 'back');
                this.broadcast('guard:event', 'back');
            }
            else if (kind === 'anyway') {
                this.triggerEmergencyOverride(5);
                this.emit('guard:event', 'anyway');
                this.broadcast('guard:event', 'anyway');
            }
            try {
                if (this.guardWin && !this.guardWin.isDestroyed()) {
                    this.guardWin.close();
                    this.guardWin = null;
                }
            }
            catch { }
        });
    }
    dispose() {
        this.stopForegroundPolling();
        if (this.pomodoroTimer) {
            clearInterval(this.pomodoroTimer);
            this.pomodoroTimer = null;
        }
        this.removeAllListeners();
    }
}
exports.FocusGuard = FocusGuard;
// Global singleton instance
exports.focusGuard = new FocusGuard();
exports.focusGuard.registerIPC();
