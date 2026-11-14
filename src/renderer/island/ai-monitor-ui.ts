/**
 * AI Monitor UI Component for RoboIsland 2.0 (#panel-ai)
 * Provides real-time activity feed, unified diff inspection, and live agent process controls.
 */

declare global {
  interface Window {
    roboIsland: any;
    __aiMonitorUI?: AIMonitorUI;
  }
}

export class AIMonitorUI {
  private panel: HTMLElement | null = null;
  private statusPill: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  private btnPause: HTMLElement | null = null;
  private btnStop: HTMLElement | null = null;
  private btnClear: HTMLElement | null = null;

  private permissionBar: HTMLElement | null = null;
  private permissionDesc: HTMLElement | null = null;
  private btnAllow: HTMLElement | null = null;
  private btnDeny: HTMLElement | null = null;

  private taskFeed: HTMLElement | null = null;
  private feedEmpty: HTMLElement | null = null;
  private feedCount: HTMLElement | null = null;

  private diffFile: HTMLElement | null = null;
  private diffOp: HTMLElement | null = null;
  private diffViewer: HTMLElement | null = null;
  private diffEmpty: HTMLElement | null = null;
  private diffContent: HTMLElement | null = null;
  private btnDiffToggle: HTMLElement | null = null;

  private events: any[] = [];
  private isPaused = false;
  private isStopped = false;
  private currentSessionId = 'session-default';
  private selectedEventId: string | null = null;

  constructor() {
    this.bindDomElements();
    this.setupEventListeners();
    this.loadInitialHistory();
    this.subscribeLiveEvents();
  }

  private bindDomElements(): void {
    this.panel = document.getElementById('panel-ai');
    this.statusPill = document.getElementById('ai-status-pill');
    this.statusText = document.getElementById('ai-status-text');
    this.btnPause = document.getElementById('btn-ai-pause');
    this.btnStop = document.getElementById('btn-ai-stop');
    this.btnClear = document.getElementById('btn-ai-clear');

    this.permissionBar = document.getElementById('ai-permission-bar');
    this.permissionDesc = document.getElementById('ai-permission-desc');
    this.btnAllow = document.getElementById('btn-ai-allow');
    this.btnDeny = document.getElementById('btn-ai-deny');

    this.taskFeed = document.getElementById('ai-task-feed');
    this.feedEmpty = document.getElementById('ai-feed-empty');
    this.feedCount = document.getElementById('ai-feed-count');

    this.diffFile = document.getElementById('ai-diff-file');
    this.diffOp = document.getElementById('ai-diff-op');
    this.diffViewer = document.getElementById('ai-diff-viewer');
    this.diffEmpty = document.getElementById('ai-diff-empty');
    this.diffContent = document.getElementById('ai-diff-content');
    this.btnDiffToggle = document.getElementById('btn-ai-diff-toggle');
  }

  private setupEventListeners(): void {
    // Intercept Bottom Nav [data-tab="ai"] click to open embedded #panel-ai
    const aiNavBtn = document.querySelector('.nav-item[data-tab="ai"]');
    if (aiNavBtn) {
      aiNavBtn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        this.activatePanel();
      }, true);
    }

    // Intercept Claude Code card click on home dashboard
    const cardClaude = document.getElementById('card-claude');
    if (cardClaude) {
      cardClaude.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        this.activatePanel();
      }, true);
    }

    // Listen to other nav tabs to deactivate panel-ai
    const allNavTabs = document.querySelectorAll('.nav-item[data-tab]');
    allNavTabs.forEach((tabBtn) => {
      if ((tabBtn as HTMLElement).dataset.tab !== 'ai') {
        tabBtn.addEventListener('click', () => {
          this.panel?.classList.remove('active');
        });
      }
    });

    // Control buttons: Pause / Resume
    if (this.btnPause) {
      this.btnPause.addEventListener('click', async (e) => {
        e.stopPropagation();
        this.isPaused = !this.isPaused;
        await window.roboIsland?.controlAIAgent?.('pause');
        this.updatePauseButton();
      });
    }

    // Control buttons: Stop Process
    if (this.btnStop) {
      this.btnStop.addEventListener('click', async (e) => {
        e.stopPropagation();
        this.isStopped = true;
        await window.roboIsland?.controlAIAgent?.('stop');
        this.setStatus('stopped', 'Stopped');
      });
    }

    // Clear feed
    if (this.btnClear) {
      this.btnClear.addEventListener('click', (e) => {
        e.stopPropagation();
        this.events = [];
        this.renderFeed();
        this.resetDiffView();
      });
    }

    // Permission Request Allow
    if (this.btnAllow) {
      this.btnAllow.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.roboIsland?.controlAIAgent?.('allow');
        if (window.roboIsland?.aiApprove) {
          await window.roboIsland.aiApprove(this.currentSessionId, true);
        }
        this.hidePermissionBar();
        this.setStatus('running', 'Running');
      });
    }

    // Permission Request Deny
    if (this.btnDeny) {
      this.btnDeny.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.roboIsland?.controlAIAgent?.('deny');
        if (window.roboIsland?.aiApprove) {
          await window.roboIsland.aiApprove(this.currentSessionId, false);
        }
        this.hidePermissionBar();
        this.setStatus('ready', 'Ready');
      });
    }

    // Toggle Diff Viewer expansion
    if (this.btnDiffToggle && this.diffViewer) {
      let expanded = false;
      this.btnDiffToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        expanded = !expanded;
        this.diffViewer!.style.maxHeight = expanded ? '320px' : '';
      });
    }
  }

  public activatePanel(): void {
    if (!this.panel) return;

    // Deactivate all sibling panels
    const panels = document.querySelectorAll('.island-panel');
    panels.forEach((p) => p.classList.remove('active'));

    // Activate #panel-ai
    this.panel.classList.add('active');

    // Update bottom nav active state
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((btn) => {
      if ((btn as HTMLElement).dataset.tab === 'ai') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update status header title
    const titleEl = document.getElementById('status-title');
    if (titleEl) titleEl.textContent = 'AI Monitor';

    // Refresh view
    this.renderFeed();
  }

  private async loadInitialHistory(): Promise<void> {
    if (!window.roboIsland) return;

    try {
      if (window.roboIsland.getAIMonitorHistory) {
        const history = await window.roboIsland.getAIMonitorHistory();
        if (Array.isArray(history) && history.length > 0) {
          this.events = history;
          this.renderFeed();

          // If most recent event has diff, show it
          const lastWithDiff = [...this.events].reverse().find(e => Boolean(e.diff));
          if (lastWithDiff) {
            this.displayDiff(lastWithDiff);
          }
        }
      }
    } catch {}

    try {
      if (window.roboIsland.getAiState) {
        const state = await window.roboIsland.getAiState();
        if (state) {
          this.handleStateUpdate(state);
        }
      }
    } catch {}
  }

  private subscribeLiveEvents(): void {
    if (!window.roboIsland) return;

    // Typed AI Monitor event push
    if (window.roboIsland.onAIMonitorEvent) {
      window.roboIsland.onAIMonitorEvent((event: any) => {
        this.handleLiveEvent(event);
      });
    }

    // General state changed callback
    if (window.roboIsland.onAiStateChanged) {
      window.roboIsland.onAiStateChanged((state: any) => {
        this.handleStateUpdate(state);
      });
    }
  }

  public handleLiveEvent(event: any): void {
    if (!event) return;

    // Add to local ring buffer (50 max)
    this.events.push(event);
    if (this.events.length > 50) {
      this.events.shift();
    }

    if (event.sessionId) {
      this.currentSessionId = event.sessionId;
    }

    // Update status indicator
    if (event.event === 'UserPromptSubmit' || event.event === 'PreToolUse') {
      this.setStatus('running', 'Running');
    } else if (event.event === 'PostToolUse') {
      this.setStatus('running', 'Running');
    } else if (event.event === 'PostToolUseFailure') {
      this.setStatus('error', 'Error');
    } else if (event.event === 'PermissionRequest') {
      this.setStatus('question', 'Needs Approval');
      this.showPermissionBar(event.details?.description || 'Agent requests permission to proceed');
    } else if (event.event === 'Stop' || event.event === 'SessionEnd') {
      this.setStatus('done', 'Completed');
      this.hidePermissionBar();
    } else if (event.status === 'paused') {
      this.setStatus('paused', 'Paused');
    }

    // If event contains diff, auto-display
    if (event.diff) {
      this.displayDiff(event);
    }

    this.renderFeed();
  }

  public handleStateUpdate(state: any): void {
    if (!state) return;

    if (state.status) {
      const label = state.status.charAt(0).toUpperCase() + state.status.slice(1);
      this.setStatus(state.status, label);
    }

    if (state.pendingPermission) {
      this.currentSessionId = state.pendingPermission.sessionId || 'session-default';
      this.showPermissionBar(state.pendingPermission.description || 'Permission requested');
      if (state.pendingPermission.diff) {
        this.displayDiff(state.pendingPermission);
      }
    } else {
      this.hidePermissionBar();
    }
  }

  private setStatus(kind: string, label: string): void {
    if (!this.statusPill || !this.statusText) return;

    this.statusPill.className = `ai-status-pill status-${kind}`;
    this.statusText.textContent = label;
  }

  private updatePauseButton(): void {
    if (!this.btnPause) return;
    if (this.isPaused) {
      this.btnPause.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>`;
      this.btnPause.title = 'Resume Agent';
      this.setStatus('paused', 'Paused');
    } else {
      this.btnPause.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>`;
      this.btnPause.title = 'Pause Agent';
      this.setStatus('running', 'Running');
    }
  }

  private showPermissionBar(description: string): void {
    if (!this.permissionBar) return;
    if (this.permissionDesc) this.permissionDesc.textContent = description;
    this.permissionBar.classList.remove('hidden');
  }

  private hidePermissionBar(): void {
    if (!this.permissionBar) return;
    this.permissionBar.classList.add('hidden');
  }

  private renderFeed(): void {
    if (!this.taskFeed) return;

    if (this.feedCount) {
      this.feedCount.textContent = `${this.events.length} events`;
    }

    if (this.events.length === 0) {
      if (this.feedEmpty) this.feedEmpty.classList.remove('hidden');
      this.taskFeed.innerHTML = '';
      if (this.feedEmpty) this.taskFeed.appendChild(this.feedEmpty);
      return;
    }

    if (this.feedEmpty) this.feedEmpty.classList.add('hidden');
    this.taskFeed.innerHTML = '';

    // Render events newest first
    const list = [...this.events].reverse();
    for (const evt of list) {
      const item = document.createElement('div');
      item.className = 'ai-feed-item';
      if (this.selectedEventId === evt.id) {
        item.classList.add('selected');
      }

      const timeStr = this.formatTime(evt.timestamp || Date.now());
      const badgeType = this.getBadgeClass(evt.event, evt.status);
      const label = evt.tool || evt.event || 'Activity';

      const fileHtml = evt.file
        ? `<span class="ai-feed-file-chip">
            <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            ${this.escapeHtml(this.getShortFile(evt.file))}
          </span>`
        : '';

      const descText = evt.prompt || (evt.details?.command) || (evt.error) || (evt.file ? `${evt.operation || 'modified'} ${evt.file}` : label);

      item.innerHTML = `
        <div class="ai-feed-item-header">
          <span class="ai-event-badge ${badgeType}">${this.escapeHtml(evt.event || 'Tool')}</span>
          <span class="ai-feed-time">${timeStr}</span>
        </div>
        <div class="ai-feed-desc">${this.escapeHtml(descText)}</div>
        ${fileHtml}
      `;

      item.addEventListener('click', () => {
        this.selectedEventId = evt.id;
        this.renderFeed();
        if (evt.diff) {
          this.displayDiff(evt);
        }
      });

      this.taskFeed.appendChild(item);
    }
  }

  public displayDiff(evt: any): void {
    if (!this.diffViewer || !this.diffContent || !evt) return;

    if (this.diffEmpty) this.diffEmpty.classList.add('hidden');
    this.diffContent.classList.remove('hidden');

    if (this.diffFile) {
      this.diffFile.textContent = evt.file || 'mutation.diff';
      this.diffFile.classList.remove('hidden');
    }

    if (this.diffOp) {
      const op = (evt.operation || 'modified').toUpperCase();
      this.diffOp.textContent = op;
      this.diffOp.className = `ai-diff-op-badge op-${op.toLowerCase()}`;
      this.diffOp.classList.remove('hidden');
    }

    // Parse and render unified diff lines with syntax styling
    this.diffContent.innerHTML = '';
    const rawDiff = evt.diff || '';
    const lines = rawDiff.split(/\r?\n/);

    for (const line of lines) {
      const span = document.createElement('span');
      span.className = 'ai-diff-line';

      if (line.startsWith('+++') || line.startsWith('---')) {
        span.classList.add('diff-hdr');
      } else if (line.startsWith('@@')) {
        span.classList.add('diff-chunk');
      } else if (line.startsWith('+')) {
        span.classList.add('diff-add');
      } else if (line.startsWith('-')) {
        span.classList.add('diff-del');
      } else {
        span.classList.add('diff-ctx');
      }

      span.textContent = line;
      this.diffContent.appendChild(span);
    }
  }

  private resetDiffView(): void {
    if (this.diffFile) this.diffFile.classList.add('hidden');
    if (this.diffOp) this.diffOp.classList.add('hidden');
    if (this.diffContent) {
      this.diffContent.innerHTML = '';
      this.diffContent.classList.add('hidden');
    }
    if (this.diffEmpty) this.diffEmpty.classList.remove('hidden');
  }

  private getBadgeClass(event: string, status?: string): string {
    if (event === 'UserPromptSubmit') return 'badge-prompt';
    if (event === 'PermissionRequest') return 'badge-question';
    if (status === 'failed' || event === 'PostToolUseFailure') return 'badge-error';
    if (status === 'success' || event === 'PostToolUse') return 'badge-success';
    if (event === 'Stop' || event === 'SessionEnd') return 'badge-done';
    return 'badge-tool';
  }

  private formatTime(ts: number): string {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  private getShortFile(pathStr: string): string {
    if (!pathStr) return '';
    const parts = pathStr.replace(/\\/g, '/').split('/');
    return parts.length > 2 ? parts.slice(-2).join('/') : pathStr;
  }

  private escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Auto-initialize when DOM is loaded
if (typeof window !== 'undefined') {
  const init = () => {
    if (!window.__aiMonitorUI) {
      window.__aiMonitorUI = new AIMonitorUI();
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
