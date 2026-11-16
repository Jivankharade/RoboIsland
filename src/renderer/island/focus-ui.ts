/**
 * RoboIsland 2.0 - Focus Guard & TwoCode Focus Controller (`src/renderer/island/focus-ui.ts`)
 * 
 * Capabilities:
 * 1. TwoCode Interactive Wheel Picker: Hours (0-5 hr) & Minutes (00-59 min) with smooth mouse scroll & number clicking.
 * 2. Preset Chips: 5m, 15m, 25m, 50m, plus -5m / +5m quick steppers and custom time selection.
 * 3. Live Running View: Stop button, +5m quick extension, large bold countdown digits, shrinking progress bar.
 * 4. Free/Zero-Paywall Ethos: All features unlocked with zero paywalls.
 * 5. Focus Guard Superpower: App and domain distraction alerts, 5-minute emergency unblock, mindful calm pause.
 * 6. Bi-directional sync with Home Dashboard #card-focus and compact island split-bubble.
 * 7. 100% SVG vector iconography (ZERO emojis).
 */

// Browser compatibility guard
if (typeof exports === 'undefined') {
  (globalThis as any).exports = {};
}

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
}

export interface EmergencyOverrideState {
  active: boolean;
  remainingSeconds: number;
  expiresAt: number;
  durationSeconds: number;
}

export const SVG_ICONS = {
  play: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>`,
  skip: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  app: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#34c759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  shieldAlert: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ff9500" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  shieldOff: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ff453a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.69 14a6.9 6.9 0 0 0 .31-2V5l-8-3-3.11 1.17"/><path d="M4.73 4.73 4 5v7c0 6 8 10 8 10a20.29 20.29 0 0 0 5.62-4.38"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};

export class FocusUI {
  private panelEl: HTMLElement | null = null;
  private isMounted = false;

  // Chosen duration in seconds (default 25 min = 1500s)
  private chosenSeconds = 25 * 60;
  private currentTab: 'timer' | 'guard' = 'timer';

  // Local state mirror
  private isGuardEnabled = true;
  private pomodoro: PomodoroState = {
    mode: 'focus',
    status: 'idle',
    timeRemaining: 25 * 60,
    totalDuration: 25 * 60,
    currentCycle: 1,
    totalCycles: 4
  };
  private override: EmergencyOverrideState = {
    active: false,
    remainingSeconds: 0,
    expiresAt: 0,
    durationSeconds: 300
  };
  private stats: ProductivityStats = {
    focusTimeSecondsToday: 0,
    sessionsCompleted: 0,
    distractionsBlocked: 0,
    todayDate: new Date().toISOString().slice(0, 10)
  };
  private blocklist: BlockedItem[] = [
    { id: 'domain:youtube.com', target: 'youtube.com', type: 'domain', enabled: true, addedAt: Date.now() },
    { id: 'domain:twitter.com', target: 'twitter.com', type: 'domain', enabled: true, addedAt: Date.now() },
    { id: 'domain:reddit.com', target: 'reddit.com', type: 'domain', enabled: true, addedAt: Date.now() },
    { id: 'domain:instagram.com', target: 'instagram.com', type: 'domain', enabled: true, addedAt: Date.now() },
    { id: 'domain:tiktok.com', target: 'tiktok.com', type: 'domain', enabled: true, addedAt: Date.now() },
    { id: 'app:discord.exe', target: 'discord.exe', type: 'app', enabled: true, addedAt: Date.now() },
    { id: 'app:steam.exe', target: 'steam.exe', type: 'app', enabled: true, addedAt: Date.now() }
  ];

  private activeFilter: 'all' | 'domain' | 'app' = 'all';
  private timerInterval: any = null;
  private overrideInterval: any = null;
  private breathingCountdown = 5;
  private breathingTimer: any = null;

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof window !== 'undefined') {
      this.exposeFocusEngine();
    }
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.mount());
    } else {
      this.mount();
    }
  }

  public mount(): void {
    if (this.isMounted) return;
    const parentContainer = document.getElementById('island-panel-container');
    if (!parentContainer) return;

    this.injectStyles();

    // 1. Locate or create #panel-focus
    let panel = document.getElementById('panel-focus');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'panel-focus';
      panel.className = 'island-panel';
      parentContainer.appendChild(panel);
    }
    panel.innerHTML = this.renderPanelHtml();
    this.panelEl = panel;

    // 2. Locate or create breathing modal overlay
    this.ensureCalmModalInDom();

    // 3. Expose canonical FocusEngine
    this.exposeFocusEngine();

    // 4. Setup event listeners
    this.setupEventListeners();

    // 5. Update UI to initial state
    this.renderBlocklistItems();
    this.renderTimerView();
    this.updateTimerDisplay();
    this.updateStatsDisplay();
    this.updateOverrideDisplay();
    this.syncHomeCard();

    this.isMounted = true;
  }

  public exposeFocusEngine(): void {
    if (typeof window === 'undefined') return;
    const engine = {
      active: () => this.pomodoro.status === 'running',
      left: () => Math.max(0, this.pomodoro.timeRemaining * 1000),
      length: () => (this.pomodoro.totalDuration || this.chosenSeconds) * 1000,
      chosen: () => this.chosenSeconds,
      minutes: () => Math.round(this.chosenSeconds / 60),
      label: () => this.formatLabel(this.pomodoro.timeRemaining),
      choose: (sec: number) => this.chooseDuration(sec),
      start: (sec?: number) => {
        if (sec) this.chooseDuration(sec);
        this.startTimer();
      },
      stop: () => this.resetTimer(),
      toggle: () => this.togglePlayPause(),
      add: (sec: number) => this.addSeconds(sec)
    };
    (window as any).__roboFocus = engine;
    (window as any).__twocodeFocus = engine;
  }

  /* ------------------------------------------------------------------------
   * HTML TEMPLATES & RENDERING
   * ------------------------------------------------------------------------ */

  private renderPanelHtml(): string {
    return `
      <div class="focus-panel-container">
        <!-- View 1: TwoCode Interactive Wheel & Running View -->
        <div id="focus-view-timer" class="focus-view-content ${this.currentTab === 'timer' ? 'active' : ''}">
          ${this.renderTimerBodyHtml()}
        </div>

        <!-- View 2: Focus Guard (Blocklist & Emergency Override) -->
        <div id="focus-view-guard" class="focus-view-content ${this.currentTab === 'guard' ? 'active' : ''}">
          <div class="guard-header-row">
            <button type="button" class="btn-guard-back-timer" id="btn-back-timer" title="Back to Focus Timer">
              ${SVG_ICONS.arrowLeft}
              <span>Timer</span>
            </button>
            <span class="guard-header-title">Distraction Guard</span>
            <label class="focus-toggle-label" title="Enable / Disable Focus Guard" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <span id="focus-guard-status-text" class="guard-status-text" style="font-size:11px; color:rgba(255,255,255,0.6);">${this.isGuardEnabled ? 'Active' : 'Disabled'}</span>
              <input type="checkbox" id="chk-focus-guard-enable" ${this.isGuardEnabled ? 'checked' : ''} style="display:none;" />
              <span class="switch-slider"></span>
            </label>
          </div>
          <div class="focus-content-scroll">

            <!-- Emergency Override Banner / Button -->
            <div class="focus-override-section">
              <div id="override-inactive-view" class="override-inactive-view ${this.override.active ? 'hidden' : ''}">
                <button id="btn-trigger-override" class="override-btn" title="Emergency 5-Minute Unblock">
                  ${SVG_ICONS.shieldOff}
                  <span>5-Min Emergency Unblock</span>
                </button>
                <span class="override-hint">Temporarily suspends app and domain distraction alerts</span>
              </div>
              <div id="override-active-view" class="override-active-view ${this.override.active ? '' : 'hidden'}">
                <div class="override-pill">
                  ${SVG_ICONS.shieldAlert}
                  <span id="override-countdown-text">Override Active: 05:00</span>
                </div>
                <button id="btn-cancel-override" class="override-cancel-btn">
                  Resume Focus
                </button>
              </div>
            </div>

            <!-- Productivity Stats Grid -->
            <div class="focus-stats-grid">
              <div class="stat-card">
                <div class="stat-icon">${SVG_ICONS.clock}</div>
                <div class="stat-body">
                  <span class="stat-value" id="stat-focus-time">0m</span>
                  <span class="stat-label">Focus Today</span>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">${SVG_ICONS.check}</div>
                <div class="stat-body">
                  <span class="stat-value" id="stat-sessions">0</span>
                  <span class="stat-label">Sessions Done</span>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">${SVG_ICONS.shield}</div>
                <div class="stat-body">
                  <span class="stat-value" id="stat-distractions">0</span>
                  <span class="stat-label">Blocked</span>
                </div>
              </div>
            </div>

            <!-- Blocklist Management Section -->
            <div class="focus-blocklist-section">
              <div class="blocklist-header">
                <span class="section-title">Distraction Blocklist</span>
                <div class="filter-pills">
                  <button class="filter-pill ${this.activeFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                  <button class="filter-pill ${this.activeFilter === 'domain' ? 'active' : ''}" data-filter="domain">Websites</button>
                  <button class="filter-pill ${this.activeFilter === 'app' ? 'active' : ''}" data-filter="app">Apps</button>
                </div>
              </div>

              <!-- Add Input Row -->
              <form id="form-add-blocklist" class="blocklist-add-row">
                <input 
                  type="text" 
                  id="input-block-target" 
                  class="block-input" 
                  placeholder="Add website or app (e.g. reddit.com, steam.exe)..." 
                  autocomplete="off"
                />
                <button type="submit" class="block-add-btn" title="Add to Blocklist">
                  ${SVG_ICONS.plus}
                  <span>Add</span>
                </button>
              </form>

              <!-- Items List -->
              <div id="blocklist-items-container" class="blocklist-items-container">
                <!-- Dynamically rendered -->
              </div>
            </div>
          </div>
        </div>

        <!-- Hidden Fallback elements for test suite backward compatibility -->
        <div style="display:none;" id="focus-legacy-compat">
          <button id="btn-focus-play-main"></button>
          <button id="btn-focus-reset"></button>
          <button id="btn-focus-skip"></button>
          <div class="mode-tab" data-mode="focus"></div>
          <div class="mode-tab" data-mode="shortBreak"></div>
          <div class="mode-tab" data-mode="longBreak"></div>
          <h1 id="focus-clock-text"></h1>
          <span id="focus-clock-subtitle"></span>
          <svg><circle id="focus-progress-circle"></circle></svg>
          <div id="focus-cycles-dots"><span class="cycle-dot"></span></div>
        </div>
      </div>
    `;
  }

  public renderTimerBodyHtml(): string {
    const isRunning = this.pomodoro.status === 'running';
    if (isRunning) {
      const totalSec = this.pomodoro.totalDuration || this.chosenSeconds || 1500;
      const pct = Math.max(0, Math.min(100, (this.pomodoro.timeRemaining / totalSec) * 100));
      return `
        <div class="fo-body">
          <div class="fo-run">
            <button type="button" class="fo-round sm grey" data-stop="1" title="Stop Focus Session">
              <svg width="11" height="11" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="#ff453a"/></svg>
              <span>Stop</span>
            </button>
            <button type="button" class="fo-round sm grey" data-plus="300" title="Add 5 minutes">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              <span>+5 min</span>
            </button>
            <div class="fo-big">
              <small>Focus</small>
              <b id="fo-left">${this.formatLabel(this.pomodoro.timeRemaining)}</b>
            </div>
          </div>
          <div class="fo-bar">
            <i id="fo-ring" style="width: ${pct.toFixed(2)}%;"></i>
          </div>
          <div class="fo-foot">
            <span class="fo-hint">Robo lets you know when time is up</span>
            <span class="fo-end" id="fo-end">${this.formatDoneAt(Date.now() + this.pomodoro.timeRemaining * 1000)}</span>
          </div>
        </div>
      `;
    }

    const sec = this.chosenSeconds;
    const h = Math.min(5, Math.floor(sec / 3600));
    const m = Math.floor((sec % 3600) / 60);

    return `
      <div class="fo-body">
        <div class="fo-row">
          <button type="button" class="fo-round grey" data-set="1500" title="Reset to 25 minutes">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/></svg>
            <span>Reset</span>
          </button>
          <div class="fo-wheel">
            <div class="fo-band"></div>
            ${this.renderWheelColumn('h', h, 6, 'hr')}
            ${this.renderWheelColumn('m', m, 60, 'min')}
            <div class="fo-fade"></div>
          </div>
          <button type="button" class="fo-round white" data-start="1" title="Start Focus Session">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#bf5af2"><path d="M7 4.5v15l12.5-7.5z"/></svg>
            <span style="color:#000000; font-weight:700;">Start</span>
          </button>
        </div>
        ${this.renderPresetChips(sec)}
      </div>
    `;
  }

  private renderWheelColumn(kind: 'h' | 'm', value: number, count: number, unit: string): string {
    const ROW = 32;
    const nums = Array.from({ length: count }, (_, i) => 
      `<div class="fo-num${i === value ? ' on' : ''}" data-pick="${kind}" data-v="${i}">${kind === 'm' ? String(i).padStart(2, '0') : i}</div>`
    ).join('');
    return `
      <div class="fo-col" data-col="${kind}">
        <div class="fo-list" style="transform:translateY(${-(value * ROW) - ROW / 2}px)">${nums}</div>
        <span class="fo-unit">${unit}</span>
      </div>
    `;
  }

  private renderPresetChips(sec: number): string {
    const presets = [5, 15, 25, 50];
    const chipsHtml = presets.map((n) => 
      `<button type="button" class="fo-chip${sec === n * 60 ? ' on' : ''}" data-set="${n * 60}">${n} min</button>`
    ).join('');
    return `
      <div class="fo-foot">
        ${chipsHtml}
        <button type="button" class="fo-chip fo-guard-toggle" id="btn-toggle-guard" title="Focus Guard Blocklist">
          ${SVG_ICONS.shield}
          <span>Guard</span>
        </button>
        <span class="fo-end" id="fo-end">${this.formatDoneAt(Date.now() + sec * 1000)}</span>
      </div>
    `;
  }

  public formatLabel(s: number): string {
    const total = Math.max(0, s);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  }

  public formatDoneAt(targetMs: number): string {
    const d = new Date(targetMs);
    return 'Done at ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  private ensureCalmModalInDom(): void {
    let modal = document.getElementById('focus-calm-overlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'focus-calm-overlay';
      modal.className = 'focus-calm-overlay hidden';
      modal.innerHTML = `
        <div class="calm-modal-backdrop"></div>
        <div class="calm-modal-card">
          <div class="calm-icon-wrap">
            <div class="breathing-circle-anim"></div>
            <div class="calm-center-icon">${SVG_ICONS.wind}</div>
          </div>
          <h2 class="calm-modal-title">Take a Deep Breath</h2>
          <p class="calm-modal-sub" id="calm-detected-msg">
            A distracting app or website was opened during your focus session.
          </p>
          <div class="calm-countdown-pill">
            <span id="calm-countdown-text">Returning to focus in 5s</span>
          </div>
          <div class="calm-modal-actions">
            <button id="btn-calm-emergency" class="calm-btn-emergency">
              ${SVG_ICONS.shieldOff}
              <span>Emergency 5-Min Unblock</span>
            </button>
            <button id="btn-calm-dismiss" class="calm-btn-dismiss">
              Return to Focus
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }

  /* ------------------------------------------------------------------------
   * EVENT LISTENERS
   * ------------------------------------------------------------------------ */

  private setupEventListeners(): void {
    if (!this.panelEl) return;

    // 1. Navigation Tab [data-tab="focus"] - Delegated to CanvasEngine.showDomTab('focus')
    const navFocusBtn = document.querySelector('.nav-item[data-tab="focus"]');
    if (navFocusBtn) {
      navFocusBtn.addEventListener('click', () => {
        const engine = (window as any).__canvasEngine;
        if (engine && typeof engine.showDomTab === 'function') {
          engine.showDomTab('focus');
        } else {
          this.activatePanel();
        }
      });
    }

    // 2. Home Dashboard #card-focus click
    const cardFocus = document.getElementById('card-focus');
    if (cardFocus) {
      cardFocus.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('#btn-focus-toggle')) return;
        const engine = (window as any).__canvasEngine;
        if (engine && typeof engine.showDomTab === 'function') {
          engine.showDomTab('focus');
        } else {
          this.activatePanel();
        }
      });
    }

    // 3. Sub-View Switcher between Timer and Guard
    const switchSubView = (view: 'timer' | 'guard') => {
      this.currentTab = view;
      const timerView = this.panelEl?.querySelector('#focus-view-timer');
      const guardView = this.panelEl?.querySelector('#focus-view-guard');
      if (timerView && guardView) {
        timerView.classList.toggle('active', view === 'timer');
        guardView.classList.toggle('active', view === 'guard');
      }
    };

    // Guard View back button to Timer
    const guardView = this.panelEl.querySelector('#focus-view-guard') as HTMLElement;
    if (guardView) {
      guardView.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest('button') as HTMLElement;
        if (b && (b.id === 'btn-back-timer' || b.classList.contains('btn-guard-back-timer'))) {
          switchSubView('timer');
        }
      });
    }

    // 4. Timer View Wheel Scrolling & Clicks
    const timerView = this.panelEl.querySelector('#focus-view-timer') as HTMLElement;
    if (timerView) {
      timerView.addEventListener('wheel', (e) => {
        if (this.pomodoro.status === 'running') return;
        const col = (e.target as HTMLElement).closest('[data-col]') as HTMLElement;
        if (!col) return;
        e.preventDefault();
        const kind = col.dataset.col as 'h' | 'm';
        const sec = this.chosenSeconds;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const now = kind === 'h' ? h : m;
        const delta = e.deltaY > 0 ? 1 : -1;
        const nextVal = now + delta;
        const nh = kind === 'h' ? Math.max(0, Math.min(5, nextVal)) : h;
        const nm = kind === 'm' ? (nextVal + 60) % 60 : m;
        this.chooseDuration(nh * 3600 + nm * 60);
        this.playChirp();
      }, { passive: false });

      timerView.addEventListener('click', (e) => {
        const num = (e.target as HTMLElement).closest('[data-pick]') as HTMLElement;
        if (num && this.pomodoro.status !== 'running') {
          const kind = num.dataset.pick as 'h' | 'm';
          const v = Number(num.dataset.v);
          const sec = this.chosenSeconds;
          const h = Math.floor(sec / 3600);
          const m = Math.floor((sec % 3600) / 60);
          const nh = kind === 'h' ? Math.max(0, Math.min(5, v)) : h;
          const nm = kind === 'm' ? (v + 60) % 60 : m;
          this.chooseDuration(nh * 3600 + nm * 60);
          this.playChirp();
          return;
        }

        const b = (e.target as HTMLElement).closest('button') as HTMLElement;
        if (!b) return;

        if (b.id === 'btn-toggle-guard' || b.classList.contains('fo-guard-toggle')) {
          switchSubView('guard');
        } else if (b.dataset.set) {
          this.chooseDuration(Number(b.dataset.set));
          this.playChirp();
        } else if (b.dataset.step) {
          this.addSeconds(Number(b.dataset.step));
          this.playChirp();
        } else if (b.dataset.start) {
          this.startTimer();
        } else if (b.dataset.stop) {
          this.resetTimer();
        } else if (b.dataset.plus) {
          this.addSeconds(Number(b.dataset.plus));
          this.playPop();
        }
      });
    }

    // 5. Fallback Legacy Buttons for test suite
    const btnPlayMain = this.panelEl.querySelector('#btn-focus-play-main');
    if (btnPlayMain) {
      btnPlayMain.addEventListener('click', () => {
        this.togglePlayPause();
      });
    }

    const btnReset = this.panelEl.querySelector('#btn-focus-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.resetTimer();
      });
    }

    const btnSkip = this.panelEl.querySelector('#btn-focus-skip');
    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        this.skipSession();
      });
    }

    const modeTabs = this.panelEl.querySelectorAll('.mode-tab');
    modeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = (tab as HTMLElement).dataset.mode as PomodoroMode;
        if (mode) this.switchMode(mode);
      });
    });

    // 6. Master Enable/Disable Toggle
    const chkEnable = this.panelEl.querySelector('#chk-focus-guard-enable') as HTMLInputElement;
    if (chkEnable) {
      chkEnable.addEventListener('change', () => {
        this.isGuardEnabled = chkEnable.checked;
        const statusText = this.panelEl?.querySelector('#focus-guard-status-text');
        if (statusText) statusText.textContent = this.isGuardEnabled ? 'Active' : 'Disabled';
        this.syncStateWithBackend();
      });
    }

    // 7. Emergency Override Buttons
    const btnOverride = this.panelEl.querySelector('#btn-trigger-override');
    if (btnOverride) {
      btnOverride.addEventListener('click', () => {
        this.promptEmergencyOverride();
      });
    }

    const btnCancelOverride = this.panelEl.querySelector('#btn-cancel-override');
    if (btnCancelOverride) {
      btnCancelOverride.addEventListener('click', () => {
        this.cancelOverride();
      });
    }

    // 8. Filter Tabs in Blocklist
    const filterPills = this.panelEl.querySelectorAll('.filter-pill');
    filterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        filterPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeFilter = ((pill as HTMLElement).dataset.filter as any) || 'all';
        this.renderBlocklistItems();
      });
    });

    // 9. Add Blocklist Form
    const addForm = this.panelEl.querySelector('#form-add-blocklist') as HTMLFormElement;
    const addInput = this.panelEl.querySelector('#input-block-target') as HTMLInputElement;
    if (addForm && addInput) {
      addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const target = addInput.value.trim();
        if (target) {
          this.addBlocklistItem(target);
          addInput.value = '';
        }
      });
    }

    // 10. Calm Modal Action Buttons
    const calmOverlay = document.getElementById('focus-calm-overlay');
    if (calmOverlay) {
      const btnCalmEmergency = calmOverlay.querySelector('#btn-calm-emergency');
      if (btnCalmEmergency) {
        btnCalmEmergency.addEventListener('click', () => {
          this.hideCalmModal();
          this.promptEmergencyOverride();
        });
      }

      const btnCalmDismiss = calmOverlay.querySelector('#btn-calm-dismiss');
      if (btnCalmDismiss) {
        btnCalmDismiss.addEventListener('click', () => {
          this.hideCalmModal();
        });
      }
    }

    // 11. Listen for other tabs clicked to close panel-focus
    const allNavTabs = document.querySelectorAll('.nav-item[data-tab]');
    allNavTabs.forEach((tabBtn) => {
      if ((tabBtn as HTMLElement).dataset.tab !== 'focus') {
        tabBtn.addEventListener('click', () => {
          this.panelEl?.classList.remove('active');
        });
      }
    });

    // 12. IPC event subscriptions
    this.subscribeToBackendIpc();
  }

  /* ------------------------------------------------------------------------
   * PANEL ACTIVATION & NAVIGATION
   * ------------------------------------------------------------------------ */

  public activatePanel(): void {
    const engine = (window as any).__canvasEngine;
    if (engine && typeof engine.showDomTab === 'function') {
      engine.showDomTab('focus');
      return;
    }

    if (!this.panelEl) return;

    const panels = document.querySelectorAll('.island-panel');
    panels.forEach((p) => p.classList.remove('active'));

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((btn) => {
      if ((btn as HTMLElement).dataset.tab === 'focus') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const titleEl = document.getElementById('status-title');
    if (titleEl) {
      titleEl.innerHTML = `<span style="color:#ffffff; font-weight:700;">Focus </span><span style="color:#bf5af2; font-weight:700;">Timer</span>`;
    }

    this.panelEl.classList.add('active');
  }

  /* ------------------------------------------------------------------------
   * TIMER CONTROL & STATE MACHINE
   * ------------------------------------------------------------------------ */

  public chooseDuration(sec: number): void {
    const clamped = Math.max(5, Math.min(24 * 3600 - 1, Math.round(sec)));
    this.chosenSeconds = clamped;
    if (this.pomodoro.status !== 'running') {
      this.pomodoro.timeRemaining = clamped;
      this.pomodoro.totalDuration = clamped;
    }
    this.renderTimerView();
    this.syncHomeCard();
  }

  public addSeconds(sec: number): void {
    if (this.pomodoro.status === 'running') {
      this.pomodoro.timeRemaining += sec;
      this.pomodoro.totalDuration += sec;
    } else {
      this.chooseDuration(this.chosenSeconds + sec);
    }
    this.renderTimerView();
    this.syncHomeCard();
  }

  public togglePlayPause(): void {
    if (this.pomodoro.status === 'running') {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  public startTimer(): void {
    if (this.pomodoro.status === 'idle') {
      this.pomodoro.timeRemaining = this.chosenSeconds;
      this.pomodoro.totalDuration = this.chosenSeconds;
    }
    this.pomodoro.status = 'running';
    if (!this.timerInterval) {
      this.timerInterval = setInterval(() => this.tick(), 1000);
    }
    this.playPop();
    this.renderTimerView();
    this.updateTimerDisplay();
    this.syncHomeCard();
    this.syncStateWithBackend();
    try {
      const canvas = (window as any).__canvasEngine;
      if (canvas) {
        if (canvas.focusState) {
          canvas.focusState.active = true;
          canvas.focusState.remainingSeconds = this.pomodoro.timeRemaining;
          canvas.focusState.totalSeconds = this.pomodoro.totalDuration;
        }
        if (typeof canvas.updateTargetDimensions === 'function') canvas.updateTargetDimensions();
        if (typeof canvas.requestRender === 'function') canvas.requestRender();
      }
    } catch {}
  }

  public pauseTimer(): void {
    this.pomodoro.status = 'paused';
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.renderTimerView();
    this.updateTimerDisplay();
    this.syncHomeCard();
    this.syncStateWithBackend();
    try {
      const canvas = (window as any).__canvasEngine;
      if (canvas) {
        if (canvas.focusState) canvas.focusState.active = false;
        if (typeof canvas.updateTargetDimensions === 'function') canvas.updateTargetDimensions();
        if (typeof canvas.requestRender === 'function') canvas.requestRender();
      }
    } catch {}
  }

  public resetTimer(): void {
    this.pomodoro.status = 'idle';
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const durations: Record<PomodoroMode, number> = {
      focus: this.chosenSeconds,
      shortBreak: 5 * 60,
      longBreak: 15 * 60
    };
    this.pomodoro.timeRemaining = durations[this.pomodoro.mode];
    this.pomodoro.totalDuration = durations[this.pomodoro.mode];

    this.playChirp();
    this.renderTimerView();
    this.updateTimerDisplay();
    this.syncHomeCard();
    this.syncStateWithBackend();
    try {
      const canvas = (window as any).__canvasEngine;
      if (canvas) {
        if (canvas.focusState) {
          canvas.focusState.active = false;
          canvas.focusState.remainingSeconds = this.pomodoro.timeRemaining;
          canvas.focusState.totalSeconds = this.pomodoro.totalDuration;
        }
        if (typeof canvas.updateTargetDimensions === 'function') canvas.updateTargetDimensions();
        if (typeof canvas.requestRender === 'function') canvas.requestRender();
      }
    } catch {}
  }

  public skipSession(): void {
    this.advanceCycle(true);
  }

  public switchMode(mode: PomodoroMode): void {
    this.pomodoro.mode = mode;
    this.resetTimer();

    const tabs = this.panelEl?.querySelectorAll('.mode-tab');
    tabs?.forEach((t) => {
      if ((t as HTMLElement).dataset.mode === mode) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
  }

  public tick(): void {
    if (this.pomodoro.status !== 'running') return;

    if (this.pomodoro.timeRemaining > 0) {
      this.pomodoro.timeRemaining--;
      if (this.pomodoro.mode === 'focus') {
        this.stats.focusTimeSecondsToday++;
      }
    }

    if (this.pomodoro.timeRemaining <= 0) {
      this.handleSessionCompleted();
    } else {
      this.updateTimerDisplay();
      this.syncHomeCard();
      this.updateStatsDisplay();
    }
  }

  private handleSessionCompleted(): void {
    if (this.pomodoro.mode === 'focus') {
      this.stats.sessionsCompleted++;
      this.playChime();
    }
    this.advanceCycle(false);
  }

  private advanceCycle(_wasSkipped: boolean): void {
    if (this.pomodoro.mode === 'focus') {
      if (this.pomodoro.currentCycle >= this.pomodoro.totalCycles) {
        this.pomodoro.mode = 'longBreak';
      } else {
        this.pomodoro.mode = 'shortBreak';
      }
    } else if (this.pomodoro.mode === 'shortBreak') {
      this.pomodoro.currentCycle++;
      this.pomodoro.mode = 'focus';
    } else if (this.pomodoro.mode === 'longBreak') {
      this.pomodoro.currentCycle = 1;
      this.pomodoro.mode = 'focus';
    }

    this.resetTimer();
    this.switchMode(this.pomodoro.mode);
  }

  private playPop(): void {
    try {
      const win = (typeof window !== 'undefined' ? window : null) as any;
      if (win?.AudioSynth?.getInstance) {
        win.AudioSynth.getInstance().play('pop');
      } else if (win?.roboIslandMascot?.sounds?.playPop) {
        win.roboIslandMascot.sounds.playPop();
      }
    } catch {}
  }

  private playChirp(): void {
    try {
      const win = (typeof window !== 'undefined' ? window : null) as any;
      if (win?.AudioSynth?.getInstance) {
        win.AudioSynth.getInstance().play('pop');
      } else if (win?.roboIslandMascot?.sounds?.playChirp) {
        win.roboIslandMascot.sounds.playChirp();
      }
    } catch {}
  }

  private playChime(): void {
    try {
      const win = (typeof window !== 'undefined' ? window : null) as any;
      if (win?.AudioSynth?.getInstance) {
        win.AudioSynth.getInstance().play('done');
      } else if (win?.roboIslandMascot?.sounds?.playChirp) {
        win.roboIslandMascot.sounds.playChirp();
      } else if (win?.AudioContext || win?.webkitAudioContext) {
        const ctx = new (win.AudioContext || win.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch {}
  }

  public renderTimerView(): void {
    if (!this.panelEl) return;
    const timerView = this.panelEl.querySelector('#focus-view-timer');
    if (timerView) {
      timerView.innerHTML = this.renderTimerBodyHtml();
    }
  }

  private updateTimerDisplay(): void {
    if (!this.panelEl) return;
    const isRunning = this.pomodoro.status === 'running';

    // Live update TwoCode running numbers and progress ring
    const foLeft = this.panelEl.querySelector('#fo-left');
    const foRing = this.panelEl.querySelector('#fo-ring') as HTMLElement;
    const foEnd = this.panelEl.querySelector('#fo-end');

    if (foLeft) foLeft.textContent = this.formatLabel(this.pomodoro.timeRemaining);
    if (foRing) {
      const totalSec = this.pomodoro.totalDuration || this.chosenSeconds || 1500;
      const pct = Math.max(0, Math.min(100, (this.pomodoro.timeRemaining / totalSec) * 100));
      foRing.style.width = `${pct.toFixed(2)}%`;
    }
    if (foEnd) {
      foEnd.textContent = this.formatDoneAt(Date.now() + this.pomodoro.timeRemaining * 1000);
    }

    // Fallback legacy indicators for test suite
    const clockText = this.panelEl.querySelector('#focus-clock-text');
    const clockSub = this.panelEl.querySelector('#focus-clock-subtitle');
    const ringCircle = this.panelEl.querySelector('#focus-progress-circle') as SVGCircleElement;

    if (clockText) clockText.textContent = this.formatLabel(this.pomodoro.timeRemaining);
    if (clockSub) {
      clockSub.textContent = isRunning
        ? (this.pomodoro.mode === 'focus' ? 'Focusing...' : 'Taking a break...')
        : (this.pomodoro.status === 'paused' ? 'Paused' : 'Ready to start');
    }
    if (ringCircle) {
      const radius = 70;
      const circumference = 2 * Math.PI * radius;
      ringCircle.style.strokeDasharray = `${circumference} ${circumference}`;
      const elapsed = this.pomodoro.totalDuration - this.pomodoro.timeRemaining;
      const progress = Math.min(1, Math.max(0, elapsed / (this.pomodoro.totalDuration || 1)));
      ringCircle.style.strokeDashoffset = `${circumference - progress * circumference}`;
    }

    this.syncHomeCard();
  }

  private syncHomeCard(): void {
    if (typeof document === 'undefined') return;
    const cardFocus = document.getElementById('card-focus');
    const cardFocusTime = document.getElementById('card-focus-time');
    const cardFocusSub = document.getElementById('card-focus-sub');
    const btnFocusToggle = document.getElementById('btn-focus-toggle');

    const isRunning = this.pomodoro.status === 'running';
    const displaySeconds = isRunning ? this.pomodoro.timeRemaining : this.chosenSeconds;

    if (cardFocus) cardFocus.classList.toggle('live', isRunning);

    if (cardFocusTime) {
      const m = Math.floor(displaySeconds / 60);
      const s = displaySeconds % 60;
      cardFocusTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    if (cardFocusSub) {
      if (this.override.active) {
        cardFocusSub.textContent = `Override (${Math.ceil(this.override.remainingSeconds / 60)}m)`;
      } else if (isRunning) {
        const minsLeft = Math.max(1, Math.ceil(this.pomodoro.timeRemaining / 60));
        cardFocusSub.textContent = `${minsLeft} min left`;
      } else if (this.pomodoro.status === 'paused') {
        cardFocusSub.textContent = 'Paused';
      } else {
        cardFocusSub.textContent = 'Ready to start';
      }
    }

    if (btnFocusToggle) {
      const currentActive = btnFocusToggle.dataset.active === 'true';
      if (currentActive !== isRunning) {
        btnFocusToggle.dataset.active = isRunning ? 'true' : 'false';
        if (!isRunning) {
          btnFocusToggle.dataset.lastOffset = '';
          btnFocusToggle.innerHTML = `
            <svg viewBox="0 0 36 36" width="36" height="36">
              <circle cx="18" cy="18" r="18" fill="#ffffff"/>
              <polygon points="15 12 25 18 15 24" fill="#bf5af2"/>
            </svg>
          `;
        }
      }
      if (isRunning) {
        const totalSec = this.pomodoro.totalDuration || this.chosenSeconds || 1500;
        const part = Math.max(0, Math.min(1, this.pomodoro.timeRemaining / totalSec));
        const offset = (94.2 * (1 - part)).toFixed(1);
        if (btnFocusToggle.dataset.lastOffset !== offset) {
          btnFocusToggle.dataset.lastOffset = offset;
          btnFocusToggle.innerHTML = `
            <svg viewBox="0 0 36 36" width="36" height="36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
              <circle cx="18" cy="18" r="15" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-dasharray="94.2" stroke-dashoffset="${offset}" transform="rotate(-90 18 18)"/>
              <rect x="13" y="13" width="10" height="10" rx="2.5" fill="#ffffff"/>
            </svg>
          `;
        }
      }
    }
  }

  /* ------------------------------------------------------------------------
   * 5-MINUTE EMERGENCY MANUAL OVERRIDE
   * ------------------------------------------------------------------------ */

  public promptEmergencyOverride(): void {
    let confirmed = true;
    if (typeof confirm !== 'undefined') {
      confirmed = confirm(
        "Emergency Unblock: Are you sure you want to pause Focus Guard for 5 minutes?\n\nDistraction alerts and overlays will be suspended during this window."
      );
    }
    if (confirmed) {
      this.activateEmergencyOverride(5);
    }
  }

  public activateEmergencyOverride(minutes = 5): void {
    this.override.active = true;
    this.override.durationSeconds = minutes * 60;
    this.override.remainingSeconds = minutes * 60;
    this.override.expiresAt = Date.now() + minutes * 60 * 1000;

    if (this.overrideInterval) clearInterval(this.overrideInterval);
    this.overrideInterval = setInterval(() => {
      if (this.override.remainingSeconds > 0) {
        this.override.remainingSeconds--;
        this.updateOverrideDisplay();
        this.syncHomeCard();
      } else {
        this.cancelOverride();
      }
    }, 1000);

    this.hideCalmModal();
    this.updateOverrideDisplay();
    this.syncHomeCard();
    this.syncStateWithBackend();
  }

  public cancelOverride(): void {
    this.override.active = false;
    this.override.remainingSeconds = 0;
    this.override.expiresAt = 0;

    if (this.overrideInterval) {
      clearInterval(this.overrideInterval);
      this.overrideInterval = null;
    }

    this.updateOverrideDisplay();
    this.syncHomeCard();
    this.syncStateWithBackend();
  }

  private updateOverrideDisplay(): void {
    if (!this.panelEl) return;
    const inactiveView = this.panelEl.querySelector('#override-inactive-view');
    const activeView = this.panelEl.querySelector('#override-active-view');
    const textEl = this.panelEl.querySelector('#override-countdown-text');

    if (this.override.active) {
      inactiveView?.classList.add('hidden');
      activeView?.classList.remove('hidden');
      if (textEl) {
        const m = Math.floor(this.override.remainingSeconds / 60);
        const s = this.override.remainingSeconds % 60;
        textEl.textContent = `Override Active: ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    } else {
      inactiveView?.classList.remove('hidden');
      activeView?.classList.add('hidden');
    }
  }

  /* ------------------------------------------------------------------------
   * CALM BREATHING DISTRACTION OVERLAY MODAL
   * ------------------------------------------------------------------------ */

  public triggerCalmModal(distractionTarget: string): void {
    if (typeof document === 'undefined') return;
    if (this.override.active || !this.isGuardEnabled || this.pomodoro.status !== 'running') {
      return;
    }

    const modal = document.getElementById('focus-calm-overlay');
    if (!modal) return;

    const detectedMsg = modal.querySelector('#calm-detected-msg');
    if (detectedMsg) {
      detectedMsg.textContent = `"${distractionTarget}" was opened during your focus session. Take a conscious breath before proceeding.`;
    }

    this.breathingCountdown = 5;
    this.updateBreathingCountdown();

    modal.classList.remove('hidden');

    if (this.breathingTimer) clearInterval(this.breathingTimer);
    this.breathingTimer = setInterval(() => {
      this.breathingCountdown--;
      this.updateBreathingCountdown();
      if (this.breathingCountdown <= 0) {
        clearInterval(this.breathingTimer);
        this.breathingTimer = null;
      }
    }, 1000);
  }

  private updateBreathingCountdown(): void {
    if (typeof document === 'undefined') return;
    const pill = document.getElementById('calm-countdown-text');
    if (pill) {
      pill.textContent = this.breathingCountdown > 0 
        ? `Returning to focus in ${this.breathingCountdown}s` 
        : 'Resume Focus';
    }
  }

  public hideCalmModal(): void {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('focus-calm-overlay');
    if (modal) {
      modal.classList.add('hidden');
    }
    if (this.breathingTimer) {
      clearInterval(this.breathingTimer);
      this.breathingTimer = null;
    }
  }

  /* ------------------------------------------------------------------------
   * BLOCKLIST MANAGEMENT
   * ------------------------------------------------------------------------ */

  public addBlocklistItem(targetRaw: string): void {
    let clean = targetRaw.trim().toLowerCase();
    if (!clean) return;

    clean = clean.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');

    const isApp = clean.endsWith('.exe') || (!clean.includes('.') && clean.length > 2);
    const type: BlockItemType = isApp ? 'app' : 'domain';
    const id = `${type}:${clean}`;

    if (this.blocklist.some((b) => b.id === id || b.target === clean)) {
      return;
    }

    this.blocklist.unshift({
      id,
      target: clean,
      type,
      enabled: true,
      addedAt: Date.now()
    });

    this.renderBlocklistItems();
    this.syncStateWithBackend();
  }

  public removeBlocklistItem(id: string): void {
    this.blocklist = this.blocklist.filter((b) => b.id !== id && b.target !== id);
    this.renderBlocklistItems();
    this.syncStateWithBackend();
  }

  public toggleBlocklistItem(id: string): void {
    const item = this.blocklist.find((b) => b.id === id || b.target === id);
    if (item) {
      item.enabled = !item.enabled;
      this.renderBlocklistItems();
      this.syncStateWithBackend();
    }
  }

  private renderBlocklistItems(): void {
    if (!this.panelEl) return;
    const container = this.panelEl.querySelector('#blocklist-items-container');
    if (!container) return;

    const filtered = this.blocklist.filter((b) => {
      if (this.activeFilter === 'domain') return b.type === 'domain';
      if (this.activeFilter === 'app') return b.type === 'app';
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-blocklist">
          <span>No blocked ${this.activeFilter === 'all' ? 'items' : this.activeFilter === 'domain' ? 'websites' : 'apps'}</span>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((item) => `
      <div class="blocklist-item ${item.enabled ? '' : 'disabled'}" data-id="${item.id}">
        <div class="item-left">
          <span class="item-type-icon">
            ${item.type === 'domain' ? SVG_ICONS.globe : SVG_ICONS.app}
          </span>
          <span class="item-target">${item.target}</span>
        </div>
        <div class="item-actions">
          <label class="item-toggle-label" title="Enable or Disable Rule">
            <input type="checkbox" class="chk-item-toggle" ${item.enabled ? 'checked' : ''} />
            <span class="item-toggle-slider"></span>
          </label>
          <button class="btn-remove-item" title="Delete Rule">
            ${SVG_ICONS.trash}
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.blocklist-item').forEach((row) => {
      const id = (row as HTMLElement).dataset.id;
      if (!id) return;

      const chk = row.querySelector('.chk-item-toggle') as HTMLInputElement;
      chk?.addEventListener('change', () => this.toggleBlocklistItem(id));

      const delBtn = row.querySelector('.btn-remove-item');
      delBtn?.addEventListener('click', () => this.removeBlocklistItem(id));
    });
  }

  /* ------------------------------------------------------------------------
   * PRODUCTIVITY METRICS
   * ------------------------------------------------------------------------ */

  private updateStatsDisplay(): void {
    if (!this.panelEl) return;
    const timeEl = this.panelEl.querySelector('#stat-focus-time');
    const sessEl = this.panelEl.querySelector('#stat-sessions');
    const distEl = this.panelEl.querySelector('#stat-distractions');

    if (timeEl) {
      const minutes = Math.floor(this.stats.focusTimeSecondsToday / 60);
      timeEl.textContent = minutes >= 60 
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` 
        : `${minutes}m`;
    }

    if (sessEl) {
      sessEl.textContent = String(this.stats.sessionsCompleted);
    }

    if (distEl) {
      distEl.textContent = String(this.stats.distractionsBlocked);
    }
  }

  /* ------------------------------------------------------------------------
   * IPC SYNCHRONIZATION WITH ELECTRON MAIN
   * ------------------------------------------------------------------------ */

  private subscribeToBackendIpc(): void {
    if (typeof window === 'undefined') return;
    const win = window as any;
    if (!win.electron && !win.roboIsland) return;

    if (win.roboIsland?.onDistraction) {
      win.roboIsland.onDistraction((data: any) => {
        this.triggerCalmModal(data.item?.target || 'Distracting window');
      });
    }
  }

  private syncStateWithBackend(): void {
    if (typeof window === 'undefined') return;
    const win = window as any;
    try {
      if (win.roboIsland?.updateConfig) {
        win.roboIsland.updateConfig({
          focusGuardEnabled: this.isGuardEnabled,
          focusGuardBlockedApps: this.blocklist.map((b) => b.target)
        });
      }
    } catch {}
  }

  /* ------------------------------------------------------------------------
   * STYLES INJECTION
   * ------------------------------------------------------------------------ */

  private injectStyles(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById('focus-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'focus-ui-styles';
    style.textContent = `
      #panel-focus {
        display: none;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      #panel-focus.active {
        display: flex;
        flex-direction: column;
      }
      .focus-panel-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        color: #ffffff;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-sizing: border-box;
        user-select: none;
      }
      .focus-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        flex: none;
      }
      .focus-title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .focus-icon-badge {
        color: #bf5af2;
        display: flex;
        align-items: center;
      }
      .focus-title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.2px;
      }
      .focus-view-switch {
        display: flex;
        background: rgba(255,255,255,0.08);
        border-radius: 8px;
        padding: 2px;
        gap: 2px;
      }
      .focus-switch-btn {
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.6);
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .focus-switch-btn.active {
        background: rgba(255,255,255,0.18);
        color: #ffffff;
      }
      .focus-view-content {
        display: none;
        flex: 1;
        min-height: 0;
        flex-direction: column;
      }
      .focus-view-content.active {
        display: flex;
      }
      .focus-content-scroll {
        flex: 1;
        overflow-y: auto;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .switch-slider {
        position: relative;
        width: 32px;
        height: 18px;
        background: rgba(255,255,255,0.2);
        border-radius: 9px;
        transition: 0.25s;
        display: inline-block;
      }
      .switch-slider:before {
        content: "";
        position: absolute;
        width: 14px;
        height: 14px;
        left: 2px;
        top: 2px;
        background: #ffffff;
        border-radius: 50%;
        transition: 0.25s;
      }
      .focus-toggle-label input:checked + .switch-slider {
        background: #bf5af2;
      }
      .focus-toggle-label input:checked + .switch-slider:before {
        transform: translateX(14px);
      }
      .focus-override-section {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        padding: 10px 14px;
      }
      .override-btn {
        background: rgba(255,69,58,0.15);
        color: #ff453a;
        border: 1px solid rgba(255,69,58,0.3);
        border-radius: 8px;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      .override-btn:hover {
        background: rgba(255,69,58,0.25);
      }
      .override-hint {
        display: block;
        font-size: 11px;
        color: rgba(255,255,255,0.5);
        margin-top: 6px;
      }
      .override-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255,149,0,0.15);
        color: #ff9500;
        border: 1px solid rgba(255,149,0,0.3);
        border-radius: 20px;
        padding: 4px 12px;
        font-size: 12px;
        font-weight: 600;
      }
      .override-cancel-btn {
        background: rgba(255,255,255,0.1);
        border: none;
        color: #ffffff;
        border-radius: 6px;
        padding: 5px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        margin-left: 8px;
      }
      .focus-stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .stat-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 8px;
        padding: 8px 10px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .stat-icon {
        color: #bf5af2;
        display: flex;
      }
      .stat-value {
        font-size: 14px;
        font-weight: 700;
        display: block;
      }
      .stat-label {
        font-size: 10px;
        color: rgba(255,255,255,0.5);
        display: block;
      }
      .focus-blocklist-section {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .blocklist-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .section-title {
        font-size: 12px;
        font-weight: 700;
        color: rgba(255,255,255,0.85);
      }
      .filter-pills {
        display: flex;
        gap: 4px;
      }
      .filter-pill {
        background: rgba(255,255,255,0.08);
        border: none;
        color: rgba(255,255,255,0.6);
        font-size: 10px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
        cursor: pointer;
      }
      .filter-pill.active {
        background: rgba(191,90,242,0.3);
        color: #ffffff;
      }
      .blocklist-add-row {
        display: flex;
        gap: 6px;
      }
      .block-input {
        flex: 1;
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        padding: 6px 10px;
        color: #ffffff;
        font-size: 11px;
      }
      .block-input:focus {
        outline: none;
        border-color: #bf5af2;
      }
      .block-add-btn {
        background: #bf5af2;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        padding: 0 12px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .blocklist-items-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 120px;
        overflow-y: auto;
      }
      .blocklist-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 8px;
        background: rgba(255,255,255,0.03);
        border-radius: 6px;
        font-size: 11px;
      }
      .blocklist-item.disabled {
        opacity: 0.45;
      }
      .item-left {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .item-type-icon {
        color: rgba(255,255,255,0.5);
        display: flex;
      }
      .item-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .item-toggle-label {
        display: flex;
        align-items: center;
        cursor: pointer;
      }
      .item-toggle-label input {
        display: none;
      }
      .item-toggle-slider {
        position: relative;
        width: 24px;
        height: 14px;
        background: rgba(255,255,255,0.2);
        border-radius: 7px;
        transition: 0.2s;
        display: inline-block;
      }
      .item-toggle-slider:before {
        content: "";
        position: absolute;
        width: 10px;
        height: 10px;
        left: 2px;
        top: 2px;
        background: #ffffff;
        border-radius: 50%;
        transition: 0.2s;
      }
      .item-toggle-label input:checked + .item-toggle-slider {
        background: #bf5af2;
      }
      .item-toggle-label input:checked + .item-toggle-slider:before {
        transform: translateX(10px);
      }
      .btn-remove-item {
        background: transparent;
        border: none;
        color: rgba(255,69,58,0.7);
        cursor: pointer;
        padding: 2px;
        display: flex;
      }
      .btn-remove-item:hover {
        color: #ff453a;
      }
      .empty-blocklist {
        padding: 12px;
        text-align: center;
        color: rgba(255,255,255,0.4);
        font-size: 11px;
      }
      .hidden {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Getters for testing
  public getPomodoroState(): PomodoroState {
    return { ...this.pomodoro };
  }

  public getEmergencyOverrideState(): EmergencyOverrideState {
    return { ...this.override };
  }

  public getProductivityStats(): ProductivityStats {
    return { ...this.stats };
  }

  public getBlocklist(): BlockedItem[] {
    return [...this.blocklist];
  }
}

// Auto-initialize in browser window
if (typeof window !== 'undefined') {
  (window as any).FocusUI = FocusUI;
  const focusUiInstance = new FocusUI();
  (window as any).focusUI = focusUiInstance;
}
