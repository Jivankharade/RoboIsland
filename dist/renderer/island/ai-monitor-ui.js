"use strict";
(() => {
  // src/renderer/island/ai-monitor-ui.ts
  var AIMonitorUI = class {
    panel = null;
    statusPill = null;
    statusText = null;
    btnPause = null;
    btnStop = null;
    btnClear = null;
    permissionBar = null;
    permissionDesc = null;
    btnAllow = null;
    btnDeny = null;
    taskFeed = null;
    feedEmpty = null;
    feedCount = null;
    diffFile = null;
    diffOp = null;
    diffViewer = null;
    diffEmpty = null;
    diffContent = null;
    btnDiffToggle = null;
    events = [];
    isPaused = false;
    isStopped = false;
    currentSessionId = "session-default";
    selectedEventId = null;
    constructor() {
      this.bindDomElements();
      this.setupEventListeners();
      this.loadInitialHistory();
      this.subscribeLiveEvents();
    }
    bindDomElements() {
      this.panel = document.getElementById("panel-ai");
      this.statusPill = document.getElementById("ai-status-pill");
      this.statusText = document.getElementById("ai-status-text");
      this.btnPause = document.getElementById("btn-ai-pause");
      this.btnStop = document.getElementById("btn-ai-stop");
      this.btnClear = document.getElementById("btn-ai-clear");
      this.permissionBar = document.getElementById("ai-permission-bar");
      this.permissionDesc = document.getElementById("ai-permission-desc");
      this.btnAllow = document.getElementById("btn-ai-allow");
      this.btnDeny = document.getElementById("btn-ai-deny");
      this.taskFeed = document.getElementById("ai-task-feed");
      this.feedEmpty = document.getElementById("ai-feed-empty");
      this.feedCount = document.getElementById("ai-feed-count");
      this.diffFile = document.getElementById("ai-diff-file");
      this.diffOp = document.getElementById("ai-diff-op");
      this.diffViewer = document.getElementById("ai-diff-viewer");
      this.diffEmpty = document.getElementById("ai-diff-empty");
      this.diffContent = document.getElementById("ai-diff-content");
      this.btnDiffToggle = document.getElementById("btn-ai-diff-toggle");
    }
    setupEventListeners() {
      const aiNavBtn = document.querySelector('.nav-item[data-tab="ai"]');
      if (aiNavBtn) {
        aiNavBtn.addEventListener("click", () => {
          const engine = window.__canvasEngine;
          if (engine && typeof engine.showDomTab === "function") {
            engine.showDomTab("ai");
          } else {
            this.activatePanel();
          }
        });
      }
      const cardClaude = document.getElementById("card-claude");
      if (cardClaude) {
        cardClaude.addEventListener("click", () => {
          const engine = window.__canvasEngine;
          if (engine && typeof engine.showDomTab === "function") {
            engine.showDomTab("ai");
          } else {
            this.activatePanel();
          }
        });
      }
      const allNavTabs = document.querySelectorAll(".nav-item[data-tab]");
      allNavTabs.forEach((tabBtn) => {
        if (tabBtn.dataset.tab !== "ai") {
          tabBtn.addEventListener("click", () => {
            this.panel?.classList.remove("active");
          });
        }
      });
      if (this.btnPause) {
        this.btnPause.addEventListener("click", async (e) => {
          e.stopPropagation();
          this.isPaused = !this.isPaused;
          await window.roboIsland?.controlAIAgent?.("pause");
          this.updatePauseButton();
        });
      }
      if (this.btnStop) {
        this.btnStop.addEventListener("click", async (e) => {
          e.stopPropagation();
          this.isStopped = true;
          await window.roboIsland?.controlAIAgent?.("stop");
          this.setStatus("stopped", "Stopped");
        });
      }
      if (this.btnClear) {
        this.btnClear.addEventListener("click", (e) => {
          e.stopPropagation();
          this.events = [];
          this.renderFeed();
          this.resetDiffView();
        });
      }
      if (this.btnAllow) {
        this.btnAllow.addEventListener("click", async (e) => {
          e.stopPropagation();
          await window.roboIsland?.controlAIAgent?.("allow");
          if (window.roboIsland?.aiApprove) {
            await window.roboIsland.aiApprove(this.currentSessionId, true);
          }
          this.hidePermissionBar();
          this.setStatus("running", "Running");
        });
      }
      if (this.btnDeny) {
        this.btnDeny.addEventListener("click", async (e) => {
          e.stopPropagation();
          await window.roboIsland?.controlAIAgent?.("deny");
          if (window.roboIsland?.aiApprove) {
            await window.roboIsland.aiApprove(this.currentSessionId, false);
          }
          this.hidePermissionBar();
          this.setStatus("ready", "Ready");
        });
      }
      if (this.btnDiffToggle && this.diffViewer) {
        let expanded = false;
        this.btnDiffToggle.addEventListener("click", (e) => {
          e.stopPropagation();
          expanded = !expanded;
          this.diffViewer.style.maxHeight = expanded ? "320px" : "";
        });
      }
    }
    activatePanel() {
      const engine = window.__canvasEngine;
      if (engine && typeof engine.showDomTab === "function") {
        engine.showDomTab("ai");
        return;
      }
      if (!this.panel) return;
      const panels = document.querySelectorAll(".island-panel");
      panels.forEach((p) => p.classList.remove("active"));
      this.panel.classList.add("active");
      const navItems = document.querySelectorAll(".nav-item");
      navItems.forEach((btn) => {
        if (btn.dataset.tab === "ai") {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
      const titleEl = document.getElementById("status-title");
      if (titleEl) titleEl.textContent = "AI Monitor";
      this.renderFeed();
    }
    async loadInitialHistory() {
      if (!window.roboIsland) return;
      try {
        if (window.roboIsland.getAIMonitorHistory) {
          const history = await window.roboIsland.getAIMonitorHistory();
          if (Array.isArray(history) && history.length > 0) {
            this.events = history;
            this.renderFeed();
            const lastWithDiff = [...this.events].reverse().find((e) => Boolean(e.diff));
            if (lastWithDiff) {
              this.displayDiff(lastWithDiff);
            }
          }
        }
      } catch {
      }
      try {
        if (window.roboIsland.getAiState) {
          const state = await window.roboIsland.getAiState();
          if (state) {
            this.handleStateUpdate(state);
          }
        }
      } catch {
      }
    }
    subscribeLiveEvents() {
      if (!window.roboIsland) return;
      if (window.roboIsland.onAIMonitorEvent) {
        window.roboIsland.onAIMonitorEvent((event) => {
          this.handleLiveEvent(event);
        });
      }
      if (window.roboIsland.onAiStateChanged) {
        window.roboIsland.onAiStateChanged((state) => {
          this.handleStateUpdate(state);
        });
      }
    }
    handleLiveEvent(event) {
      if (!event) return;
      this.events.push(event);
      if (this.events.length > 50) {
        this.events.shift();
      }
      if (event.sessionId) {
        this.currentSessionId = event.sessionId;
      }
      if (event.event === "UserPromptSubmit" || event.event === "PreToolUse") {
        this.setStatus("running", "Running");
      } else if (event.event === "PostToolUse") {
        this.setStatus("running", "Running");
      } else if (event.event === "PostToolUseFailure") {
        this.setStatus("error", "Error");
      } else if (event.event === "PermissionRequest") {
        this.setStatus("question", "Needs Approval");
        this.showPermissionBar(event.details?.description || "Agent requests permission to proceed");
      } else if (event.event === "Stop" || event.event === "SessionEnd") {
        this.setStatus("done", "Completed");
        this.hidePermissionBar();
      } else if (event.status === "paused") {
        this.setStatus("paused", "Paused");
      }
      if (event.diff) {
        this.displayDiff(event);
      }
      this.renderFeed();
    }
    handleStateUpdate(state) {
      if (!state) return;
      if (state.status) {
        const label = state.status.charAt(0).toUpperCase() + state.status.slice(1);
        this.setStatus(state.status, label);
      }
      if (state.pendingPermission) {
        this.currentSessionId = state.pendingPermission.sessionId || "session-default";
        this.showPermissionBar(state.pendingPermission.description || "Permission requested");
        if (state.pendingPermission.diff) {
          this.displayDiff(state.pendingPermission);
        }
      } else {
        this.hidePermissionBar();
      }
    }
    setStatus(kind, label) {
      if (!this.statusPill || !this.statusText) return;
      this.statusPill.className = `ai-status-pill status-${kind}`;
      this.statusText.textContent = label;
    }
    updatePauseButton() {
      if (!this.btnPause) return;
      if (this.isPaused) {
        this.btnPause.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>`;
        this.btnPause.title = "Resume Agent";
        this.setStatus("paused", "Paused");
      } else {
        this.btnPause.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>`;
        this.btnPause.title = "Pause Agent";
        this.setStatus("running", "Running");
      }
    }
    showPermissionBar(description) {
      if (!this.permissionBar) return;
      if (this.permissionDesc) this.permissionDesc.textContent = description;
      this.permissionBar.classList.remove("hidden");
    }
    hidePermissionBar() {
      if (!this.permissionBar) return;
      this.permissionBar.classList.add("hidden");
    }
    renderFeed() {
      if (!this.taskFeed) return;
      if (this.feedCount) {
        this.feedCount.textContent = `${this.events.length} events`;
      }
      if (this.events.length === 0) {
        if (this.feedEmpty) this.feedEmpty.classList.remove("hidden");
        this.taskFeed.innerHTML = "";
        if (this.feedEmpty) this.taskFeed.appendChild(this.feedEmpty);
        return;
      }
      if (this.feedEmpty) this.feedEmpty.classList.add("hidden");
      this.taskFeed.innerHTML = "";
      const list = [...this.events].reverse();
      for (const evt of list) {
        const item = document.createElement("div");
        item.className = "ai-feed-item";
        if (this.selectedEventId === evt.id) {
          item.classList.add("selected");
        }
        const timeStr = this.formatTime(evt.timestamp || Date.now());
        const badgeType = this.getBadgeClass(evt.event, evt.status);
        const label = evt.tool || evt.event || "Activity";
        const fileHtml = evt.file ? `<span class="ai-feed-file-chip">
            <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            ${this.escapeHtml(this.getShortFile(evt.file))}
          </span>` : "";
        const descText = evt.prompt || evt.details?.command || evt.error || (evt.file ? `${evt.operation || "modified"} ${evt.file}` : label);
        item.innerHTML = `
        <div class="ai-feed-item-header">
          <span class="ai-event-badge ${badgeType}">${this.escapeHtml(evt.event || "Tool")}</span>
          <span class="ai-feed-time">${timeStr}</span>
        </div>
        <div class="ai-feed-desc">${this.escapeHtml(descText)}</div>
        ${fileHtml}
      `;
        item.addEventListener("click", () => {
          this.selectedEventId = evt.id;
          this.renderFeed();
          if (evt.diff) {
            this.displayDiff(evt);
          }
        });
        this.taskFeed.appendChild(item);
      }
    }
    displayDiff(evt) {
      if (!this.diffViewer || !this.diffContent || !evt) return;
      if (this.diffEmpty) this.diffEmpty.classList.add("hidden");
      this.diffContent.classList.remove("hidden");
      if (this.diffFile) {
        this.diffFile.textContent = evt.file || "mutation.diff";
        this.diffFile.classList.remove("hidden");
      }
      if (this.diffOp) {
        const op = (evt.operation || "modified").toUpperCase();
        this.diffOp.textContent = op;
        this.diffOp.className = `ai-diff-op-badge op-${op.toLowerCase()}`;
        this.diffOp.classList.remove("hidden");
      }
      this.diffContent.innerHTML = "";
      const rawDiff = evt.diff || "";
      const lines = rawDiff.split(/\r?\n/);
      for (const line of lines) {
        const span = document.createElement("span");
        span.className = "ai-diff-line";
        if (line.startsWith("+++") || line.startsWith("---")) {
          span.classList.add("diff-hdr");
        } else if (line.startsWith("@@")) {
          span.classList.add("diff-chunk");
        } else if (line.startsWith("+")) {
          span.classList.add("diff-add");
        } else if (line.startsWith("-")) {
          span.classList.add("diff-del");
        } else {
          span.classList.add("diff-ctx");
        }
        span.textContent = line;
        this.diffContent.appendChild(span);
      }
    }
    resetDiffView() {
      if (this.diffFile) this.diffFile.classList.add("hidden");
      if (this.diffOp) this.diffOp.classList.add("hidden");
      if (this.diffContent) {
        this.diffContent.innerHTML = "";
        this.diffContent.classList.add("hidden");
      }
      if (this.diffEmpty) this.diffEmpty.classList.remove("hidden");
    }
    getBadgeClass(event, status) {
      if (event === "UserPromptSubmit") return "badge-prompt";
      if (event === "PermissionRequest") return "badge-question";
      if (status === "failed" || event === "PostToolUseFailure") return "badge-error";
      if (status === "success" || event === "PostToolUse") return "badge-success";
      if (event === "Stop" || event === "SessionEnd") return "badge-done";
      return "badge-tool";
    }
    formatTime(ts) {
      const d = new Date(ts);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    }
    getShortFile(pathStr) {
      if (!pathStr) return "";
      const parts = pathStr.replace(/\\/g, "/").split("/");
      return parts.length > 2 ? parts.slice(-2).join("/") : pathStr;
    }
    escapeHtml(str) {
      if (!str) return "";
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
  };
  if (typeof window !== "undefined") {
    const init = () => {
      if (!window.__aiMonitorUI) {
        window.__aiMonitorUI = new AIMonitorUI();
      }
    };
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
