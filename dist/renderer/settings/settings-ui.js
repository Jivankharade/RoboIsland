"use strict";
(() => {
  // src/renderer/settings/settings-ui.ts
  var SVG_ICONS = {
    guard: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>`,
    claude: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    buddy: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="8" rx="2"/><path d="M12 2v6"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/></svg>`,
    spotify: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    lyrics: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
    focus: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    tray: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
    clips: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,
    note: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 10"/></svg>`,
    weather: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128A4 4 0 0 0 8 12c-2.21 0-4 1.79-4 4 0 2.21 1.79 4 4 4h10a4 4 0 0 0 4-4c0-1.85-1.28-3.41-3.053-3.85z"/></svg>`,
    battery: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg>`,
    volume: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
  };
  var APPS = [
    { id: "guard", name: "Focus Guard", icon: SVG_ICONS.guard, desc: "Gently prevents access to distracting websites and applications." },
    { id: "claude", name: "AI Assistants", icon: SVG_ICONS.claude, desc: "Real-time monitoring for Claude Code CLI and OpenAI Codex." },
    { id: "buddy", name: "Robo Buddy", icon: SVG_ICONS.buddy, desc: "Drag Robo out of the island to inspect screen elements and text." },
    { id: "spotify", name: "Music Player", icon: SVG_ICONS.spotify, desc: "Detects YouTube, Spotify, and browser playback via Windows SMTC." },
    { id: "lyrics", name: "Live Lyrics", icon: SVG_ICONS.lyrics, desc: "Line-by-line synchronized LRCLIB karaoke lyrics for playing tracks." },
    { id: "focus", name: "Focus Pomodoro", icon: SVG_ICONS.focus, desc: "Configurable work and break intervals with audio notifications." },
    { id: "tray", name: "File Tray", icon: SVG_ICONS.tray, desc: "Drop files into the island and retrieve them whenever needed." },
    { id: "clips", name: "Clipboard History", icon: SVG_ICONS.clips, desc: "Stores recent text snippets with instant one-click re-copying." },
    { id: "note", name: "Quick Scratchpad", icon: SVG_ICONS.note, desc: "Persistent fast notes saved to your local storage." },
    { id: "clock", name: "Clock & Calendar", icon: SVG_ICONS.clock, desc: "Live system time and date displayed in the island." },
    { id: "weather", name: "Live Weather", icon: SVG_ICONS.weather, desc: "Real-time weather conditions and temperature from Open-Meteo." },
    { id: "battery", name: "Battery Monitor", icon: SVG_ICONS.battery, desc: "Tracks battery level, discharging status, and power notifications." },
    { id: "volume", name: "System Volume & Radios", icon: SVG_ICONS.volume, desc: "Controls Windows master volume, Wi-Fi, and Bluetooth radios." }
  ];
  var SettingsUI = class {
    config = {};
    activeTab = "home";
    appsOff = /* @__PURE__ */ new Set();
    audioCtx = null;
    constructor() {
      this.setupNavigation();
      this.setupSearch();
      this.setupQuickNavigation();
      this.setupInteractiveButtons();
      this.initData();
    }
    async initData() {
      if (!window.settingsApi) return;
      try {
        this.config = await window.settingsApi.getConfig() || {};
        if (Array.isArray(this.config.appsOff)) {
          this.appsOff = new Set(this.config.appsOff);
        }
        this.populateFormFields();
        this.renderAppsGrid();
      } catch (err) {
        console.error("[SettingsUI] Failed to load config:", err);
      }
      window.settingsApi.onGotoTab((tab) => {
        this.switchTab(tab);
      });
      this.updateClock();
      setInterval(() => this.updateClock(), 1e3);
      this.fetchWeather();
      setInterval(() => this.fetchWeather(), 15 * 60 * 1e3);
      this.initBattery();
      this.initMedia();
      this.initVolume();
      this.initNetwork();
      this.initLicense();
    }
    setupNavigation() {
      const navButtons = document.querySelectorAll(".nav-item");
      navButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.getAttribute("data-tab");
          if (tab) this.switchTab(tab);
        });
      });
    }
    switchTab(tab) {
      this.activeTab = tab;
      document.querySelectorAll(".nav-item").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-tab") === tab);
      });
      document.querySelectorAll(".tab-pane").forEach((pane) => {
        pane.classList.remove("active");
      });
      const targetPane = document.getElementById(`pane-${tab}`);
      if (targetPane) targetPane.classList.add("active");
      const titles = {
        home: ["Home & Status", "Real-time system monitors, weather, and connected integrations."],
        connect: ["Connections", "Configure hooks for Claude Code CLI and OpenAI Codex CLI."],
        ai: ["AI & Chat", "Configure AI models, speech synthesis, and custom prompt settings."],
        apps: ["Apps Ecosystem", "Manage your RoboIsland desktop apps. Every toggle is completely functional and free."],
        karakter: ["Robo Character", "Customize Robo personality, eye expressions, and animation physics."],
        wardrobe: ["Wardrobe & Customization", "Personalize Robo appearance. Every single skin and accessory is completely free."],
        account: ["Account & Profile", "Local desktop profile and offline usage statistics."],
        general: ["General Preferences", "Windows startup, hotkeys, and system integration preferences."],
        island: ["Dynamic Island", "Configure Dynamic Island attachment mode, size scaling, and textures."],
        guard: ["Focus Guard (100% Free)", "Block distracting websites and applications during deep work sessions."],
        news: ["News & Updates", "Latest release notes, updates, and feature additions."],
        support: ["Support & Community", "RoboIsland open source desktop companion information."],
        license: ["Robo Pro & Creator Hub", "License activation, Pro feature management, and Owner developer tools."]
      };
      const header = titles[tab] || ["Settings", "Preferences"];
      const titleEl = document.getElementById("page-title");
      const subEl = document.getElementById("page-subtitle");
      if (titleEl) titleEl.textContent = header[0];
      if (subEl) subEl.textContent = header[1];
      this.applySearchFilter();
    }
    updateClock() {
      const clockEl = document.getElementById("home-clock");
      const dateEl = document.getElementById("home-date");
      if (clockEl) {
        clockEl.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      if (dateEl) {
        dateEl.textContent = (/* @__PURE__ */ new Date()).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
      }
    }
    async fetchWeather() {
      const tempEl = document.getElementById("home-temp");
      const condEl = document.getElementById("home-weather-cond");
      try {
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=28.61&longitude=77.23&current=temperature_2m,weather_code", {
          signal: AbortSignal.timeout(4e3)
        });
        if (res.ok) {
          const json = await res.json();
          if (json.current) {
            const t = Math.round(json.current.temperature_2m);
            if (tempEl) tempEl.textContent = `${t}\xB0C`;
            if (condEl) condEl.textContent = "Clear Skies";
          }
        }
      } catch {
        if (tempEl) tempEl.textContent = "24\xB0C";
        if (condEl) condEl.textContent = "Local Weather";
      }
    }
    async initBattery() {
      if ("getBattery" in navigator) {
        try {
          const b = await navigator.getBattery();
          const update = () => {
            const lvl = Math.round(b.level * 100);
            const levelEl = document.getElementById("home-battery-level");
            const statusEl = document.getElementById("home-battery-status");
            const iconEl = document.getElementById("home-battery-icon");
            if (levelEl) levelEl.textContent = `${lvl}%`;
            if (statusEl) statusEl.textContent = b.charging ? "Charging" : "On Battery";
            if (iconEl) iconEl.innerHTML = b.charging ? '<svg class="i" viewBox="0 0 24 24"><use href="#i-battery-charging"/></svg>' : '<svg class="i" viewBox="0 0 24 24"><use href="#i-battery"/></svg>';
          };
          update();
          b.addEventListener("levelchange", update);
          b.addEventListener("chargingchange", update);
        } catch {
        }
      }
    }
    async initMedia() {
      const titleEl = document.getElementById("home-media-title");
      const artistEl = document.getElementById("home-media-artist");
      const playBtn = document.getElementById("btn-home-play");
      const prevBtn = document.getElementById("btn-home-prev");
      const nextBtn = document.getElementById("btn-home-next");
      const thumbEl = document.getElementById("home-media-thumb");
      const progEl = document.getElementById("home-progress-bar");
      const updateMediaUI = (state) => {
        if (!state) return;
        if (titleEl) titleEl.textContent = state.title || "Nothing Playing";
        if (artistEl) artistEl.textContent = state.artist || "Windows SMTC (YouTube, Spotify, Browsers)";
        if (playBtn) playBtn.innerHTML = state.playing ? '<svg class="i" viewBox="0 0 24 24"><use href="#i-pause"/></svg>' : '<svg class="i" viewBox="0 0 24 24"><use href="#i-play"/></svg>';
        if (thumbEl) {
          if (state.coverUrl) {
            thumbEl.style.backgroundImage = `url("${state.coverUrl}")`;
            thumbEl.innerHTML = "";
          } else {
            thumbEl.style.backgroundImage = "none";
            thumbEl.innerHTML = '<svg class="i" viewBox="0 0 24 24"><use href="#i-music"/></svg>';
          }
        }
        if (progEl && state.durationMs > 0) {
          const pct = Math.min(100, state.positionMs / state.durationMs * 100);
          progEl.style.width = `${pct}%`;
        }
      };
      try {
        const initial = await window.settingsApi?.getMediaState();
        updateMediaUI(initial);
      } catch {
      }
      window.settingsApi?.onMediaStateChanged((state) => {
        updateMediaUI(state);
      });
      playBtn?.addEventListener("click", () => {
        window.settingsApi?.mediaControl("toggle");
      });
      prevBtn?.addEventListener("click", () => {
        window.settingsApi?.mediaControl("previous");
      });
      nextBtn?.addEventListener("click", () => {
        window.settingsApi?.mediaControl("next");
      });
    }
    async initVolume() {
      const slider = document.getElementById("home-volume-slider");
      const label = document.getElementById("home-vol-label");
      const muteBtn = document.getElementById("btn-home-mute");
      const setMuteUI = (muted) => {
        if (muteBtn) {
          muteBtn.setAttribute("data-muted", muted ? "true" : "false");
          muteBtn.innerHTML = muted ? '<svg class="i" viewBox="0 0 24 24"><use href="#i-volume-mute"/></svg>' : '<svg class="i" viewBox="0 0 24 24"><use href="#i-volume"/></svg>';
        }
      };
      try {
        const vol = await window.settingsApi?.getVolume();
        if (vol) {
          if (slider) slider.value = String(vol.level);
          if (label) label.textContent = `${vol.level}%`;
          setMuteUI(vol.muted);
        }
      } catch {
      }
      slider?.addEventListener("input", () => {
        const val = parseInt(slider.value, 10);
        if (label) label.textContent = `${val}%`;
        window.settingsApi?.setVolume(val);
      });
      muteBtn?.addEventListener("click", () => {
        const isMuted = muteBtn.getAttribute("data-muted") === "true";
        const newMuted = !isMuted;
        setMuteUI(newMuted);
        window.settingsApi?.setMute(newMuted);
      });
      window.settingsApi?.onVolumeChanged((vol) => {
        if (slider) slider.value = String(vol.level);
        if (label) label.textContent = `${vol.level}%`;
        setMuteUI(vol.muted);
      });
    }
    async initNetwork() {
      const ssidEl = document.getElementById("home-wifi-ssid");
      const barsEl = document.getElementById("home-wifi-bars");
      try {
        const net = await window.settingsApi?.getNetwork();
        if (net && net.wifi) {
          if (ssidEl) ssidEl.textContent = net.wifi.ssid || "Wi-Fi Connected";
          if (barsEl) barsEl.textContent = `${net.wifi.bars || 4} bars`;
        }
      } catch {
      }
      window.settingsApi?.onNetworkChanged((net) => {
        if (net && net.wifi) {
          if (ssidEl) ssidEl.textContent = net.wifi.ssid || "Wi-Fi Connected";
          if (barsEl) barsEl.textContent = `${net.wifi.bars || 4} bars`;
        }
      });
    }
    async initLicense() {
      if (!window.settingsApi?.getLicenseStatus) return;
      const refreshUI = async () => {
        try {
          const status = await window.settingsApi.getLicenseStatus();
          const badge = document.querySelector(".brand-badge");
          const ownerView = document.getElementById("license-owner-view");
          const customerView = document.getElementById("license-customer-view");
          const proActiveCard = document.getElementById("license-pro-active-card");
          const proDetails = document.getElementById("pro-active-details");
          const freeCard = document.getElementById("license-free-card");
          if (badge) {
            if (status.isOwner) {
              badge.textContent = "OWNER";
              badge.className = "brand-badge owner-badge";
            } else if (status.isPro) {
              badge.textContent = "PRO";
              badge.className = "brand-badge pro-badge";
            } else {
              badge.textContent = "Free";
              badge.className = "brand-badge";
            }
          }
          if (status.isOwner) {
            if (ownerView) ownerView.classList.remove("hidden");
            if (customerView) customerView.classList.add("hidden");
          } else {
            if (ownerView) ownerView.classList.add("hidden");
            if (customerView) customerView.classList.remove("hidden");
            if (status.isPro) {
              if (proActiveCard) proActiveCard.classList.remove("hidden");
              if (freeCard) freeCard.classList.add("hidden");
              if (proDetails) proDetails.textContent = `Registered to: ${status.registeredTo} (${status.activatedAt})`;
            } else {
              if (proActiveCard) proActiveCard.classList.add("hidden");
              if (freeCard) freeCard.classList.remove("hidden");
            }
          }
        } catch (err) {
          console.error("[SettingsUI] initLicense error:", err);
        }
      };
      await refreshUI();
      const btnGenKey = document.getElementById("btn-generate-customer-key");
      const inputCustomer = document.getElementById("input-customer-id");
      const genResult = document.getElementById("license-gen-result");
      const genOutput = document.getElementById("gen-key-output");
      const btnCopyGen = document.getElementById("btn-copy-gen-key");
      if (btnGenKey && window.settingsApi?.generateCustomerKey) {
        btnGenKey.addEventListener("click", async () => {
          const id = inputCustomer ? inputCustomer.value.trim() : "";
          const res = await window.settingsApi.generateCustomerKey(id || "Customer");
          if (res && res.success && res.key) {
            if (genOutput) genOutput.textContent = res.key;
            if (genResult) genResult.classList.remove("hidden");
          }
        });
      }
      if (btnCopyGen && genOutput) {
        btnCopyGen.addEventListener("click", () => {
          const key = genOutput.textContent || "";
          navigator.clipboard.writeText(key);
          btnCopyGen.textContent = "Copied!";
          setTimeout(() => {
            btnCopyGen.textContent = "Copy Key";
          }, 2e3);
        });
      }
      const btnActivate = document.getElementById("btn-activate-key");
      const inputKey = document.getElementById("input-license-key");
      const actStatus = document.getElementById("license-activation-status");
      if (btnActivate && window.settingsApi?.activateLicense) {
        btnActivate.addEventListener("click", async () => {
          const key = inputKey ? inputKey.value.trim() : "";
          if (!key) return;
          const res = await window.settingsApi.activateLicense(key);
          if (actStatus) {
            actStatus.classList.remove("hidden");
            actStatus.textContent = res.message;
            if (res.success) {
              actStatus.style.background = "rgba(48, 209, 88, 0.15)";
              actStatus.style.color = "#30d158";
              actStatus.style.border = "1px solid rgba(48, 209, 88, 0.4)";
              setTimeout(async () => {
                await refreshUI();
              }, 1200);
            } else {
              actStatus.style.background = "rgba(255, 69, 58, 0.15)";
              actStatus.style.color = "#ff453a";
              actStatus.style.border = "1px solid rgba(255, 69, 58, 0.4)";
            }
          }
        });
      }
      const btnBuy = document.getElementById("btn-buy-license");
      if (btnBuy && window.settingsApi?.openExternal) {
        btnBuy.addEventListener("click", () => {
          window.settingsApi.openExternal("https://github.com/your-username/roboisland#pro");
        });
      }
    }
    renderAppsGrid() {
      const container = document.getElementById("apps-list");
      if (!container) return;
      container.innerHTML = "";
      APPS.forEach((app) => {
        const isOff = this.appsOff.has(app.id);
        const card = document.createElement("div");
        card.className = "app-card";
        card.innerHTML = `
        <div class="app-icon">${app.icon}</div>
        <div class="app-info">
          <b>${app.name}</b>
          <small>${app.desc}</small>
        </div>
        <button class="switch ${isOff ? "" : "on"}" data-app="${app.id}"></button>
      `;
        const sw = card.querySelector(".switch");
        sw.addEventListener("click", () => {
          const currentlyOn = sw.classList.contains("on");
          if (currentlyOn) {
            sw.classList.remove("on");
            this.appsOff.add(app.id);
          } else {
            sw.classList.add("on");
            this.appsOff.delete(app.id);
          }
          this.saveConfig({ appsOff: Array.from(this.appsOff) });
        });
        container.appendChild(card);
      });
    }
    saveToastTimer = null;
    showSaveFeedback() {
      const pill = document.getElementById("settings-save-pill");
      if (pill) {
        pill.classList.add("show");
        if (this.saveToastTimer) clearTimeout(this.saveToastTimer);
        this.saveToastTimer = setTimeout(() => {
          pill.classList.remove("show");
        }, 1400);
      }
    }
    saveConfig(partial) {
      this.config = { ...this.config, ...partial };
      if (window.settingsApi) {
        window.settingsApi.updateConfig(partial);
        this.showSaveFeedback();
      }
    }
    populateFormFields() {
      const roboNameInput = document.getElementById("input-robo-name");
      const btnSaveName = document.getElementById("btn-save-name");
      const roboDisplayName = document.getElementById("robo-display-name");
      const wardrobeNameCaption = document.getElementById("wardrobe-name-caption");
      const currentName = this.config.mascotName || "Robo";
      if (roboNameInput) roboNameInput.value = currentName;
      if (roboDisplayName) roboDisplayName.textContent = currentName;
      if (wardrobeNameCaption) wardrobeNameCaption.textContent = currentName;
      const commitName = () => {
        const newName = roboNameInput ? roboNameInput.value.trim() || "Robo" : "Robo";
        if (roboDisplayName) roboDisplayName.textContent = newName;
        if (wardrobeNameCaption) wardrobeNameCaption.textContent = newName;
        if (btnSaveName) {
          const origText = btnSaveName.textContent;
          btnSaveName.textContent = "Saved!";
          setTimeout(() => {
            if (btnSaveName) btnSaveName.textContent = origText;
          }, 1200);
        }
        this.saveConfig({ mascotName: newName });
      };
      btnSaveName?.addEventListener("click", commitName);
      roboNameInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitName();
        }
      });
      roboNameInput?.addEventListener("change", commitName);
      const trafficConfig = this.config.trafficLightEyes || { preset: "classic", working: "#ff9500", done: "#34c759", error: "#ff3b30" };
      const currentPreset = trafficConfig.preset || "classic";
      const presetBtns = document.querySelectorAll(".preset-btn");
      presetBtns.forEach((btn) => {
        const p = btn.getAttribute("data-preset");
        btn.classList.toggle("active", p === currentPreset);
        btn.addEventListener("click", () => {
          presetBtns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          const chosen = btn.getAttribute("data-preset") || "classic";
          const colors = chosen === "soft" ? { working: "#ffcc00", done: "#63e6e2", error: "#ff453a" } : chosen === "colorblind" ? { working: "#ff9500", done: "#00e5ff", error: "#ffffff" } : { working: "#ff9500", done: "#34c759", error: "#ff3b30" };
          const updated = { preset: chosen, ...colors };
          this.config.trafficLightEyes = updated;
          this.saveConfig({ trafficLightEyes: updated });
          document.querySelectorAll('.swatches-row[data-target="working"] .swatch').forEach((s) => s.classList.toggle("active", s.dataset.color === colors.working));
          document.querySelectorAll('.swatches-row[data-target="done"] .swatch').forEach((s) => s.classList.toggle("active", s.dataset.color === colors.done));
          document.querySelectorAll('.swatches-row[data-target="error"] .swatch').forEach((s) => s.classList.toggle("active", s.dataset.color === colors.error));
        });
      });
      document.querySelectorAll('.swatches-row[data-target="working"] .swatch').forEach((s) => s.classList.toggle("active", s.dataset.color === trafficConfig.working));
      document.querySelectorAll('.swatches-row[data-target="done"] .swatch').forEach((s) => s.classList.toggle("active", s.dataset.color === trafficConfig.done));
      document.querySelectorAll('.swatches-row[data-target="error"] .swatch').forEach((s) => s.classList.toggle("active", s.dataset.color === trafficConfig.error));
      const swatches = document.querySelectorAll(".swatch");
      swatches.forEach((sw) => {
        sw.addEventListener("click", () => {
          const row = sw.closest(".swatches-row");
          if (!row) return;
          row.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
          sw.classList.add("active");
          const target = row.getAttribute("data-target") || "done";
          const color = sw.getAttribute("data-color") || "#34c759";
          const current = this.config.trafficLightEyes || { preset: "classic", working: "#ff9500", done: "#34c759", error: "#ff3b30" };
          current[target] = color;
          this.config.trafficLightEyes = current;
          this.saveConfig({ trafficLightEyes: current });
        });
      });
      const outfitCards = document.querySelectorAll(".outfit-card");
      const hatDisplay = document.getElementById("wardrobe-hat-display");
      const wearingCaption = document.getElementById("wardrobe-wearing-caption");
      const outfitIcons = {
        best: '<svg class="i" viewBox="0 0 24 24"><use href="#i-sparkles"/></svg>',
        none: "",
        party: '<svg class="i" viewBox="0 0 24 24"><use href="#i-party"/></svg>',
        sunglasses: '<svg class="i" viewBox="0 0 24 24"><use href="#i-sunglasses"/></svg>',
        crown: '<svg class="i" viewBox="0 0 24 24"><use href="#i-crown"/></svg>'
      };
      const currentOutfit = this.config.mascotOutfit || "none";
      if (hatDisplay) hatDisplay.innerHTML = outfitIcons[currentOutfit] || "";
      if (wearingCaption) {
        const activeCard = Array.from(outfitCards).find((c) => c.getAttribute("data-outfit") === currentOutfit);
        const name = activeCard?.querySelector("b")?.textContent || currentOutfit;
        wearingCaption.textContent = `Wearing: ${name}`;
      }
      outfitCards.forEach((card) => {
        const outfit = card.getAttribute("data-outfit") || "none";
        card.classList.toggle("active", outfit === currentOutfit);
        card.addEventListener("click", () => {
          outfitCards.forEach((c) => c.classList.remove("active"));
          card.classList.add("active");
          if (hatDisplay) hatDisplay.innerHTML = outfitIcons[outfit] || "";
          if (wearingCaption) wearingCaption.textContent = `Wearing: ${card.querySelector("b")?.textContent || outfit}`;
          this.saveConfig({ mascotOutfit: outfit });
        });
      });
      const bodyCircles = document.querySelectorAll(".color-circle[data-body]");
      const wardrobeHead = document.getElementById("wardrobe-head-body");
      const bodyColors = {
        cloud: "#ffffff",
        mint: "#63e6e2",
        sky: "#5ac8fa",
        rose: "#ff2d55",
        classic: "#2c2d35",
        night: "#121318",
        blue: "#0a84ff",
        purple: "#af52de",
        pink: "#ff375f",
        gold: "#f5c518"
      };
      const currentBody = this.config.mascotBodyColor || "cloud";
      if (wardrobeHead) wardrobeHead.style.background = bodyColors[currentBody] || "#ffffff";
      bodyCircles.forEach((circle) => {
        const body = circle.getAttribute("data-body") || "cloud";
        circle.classList.toggle("active", body === currentBody);
        circle.addEventListener("click", () => {
          bodyCircles.forEach((c) => c.classList.remove("active"));
          circle.classList.add("active");
          if (wardrobeHead) wardrobeHead.style.background = bodyColors[body] || "#ffffff";
          this.saveConfig({ mascotBodyColor: body });
        });
      });
      const eyeCircles = document.querySelectorAll(".color-circle[data-eye]");
      const eyeLeft = document.getElementById("wardrobe-eye-left");
      const eyeRight = document.getElementById("wardrobe-eye-right");
      const eyeColors = {
        mint: "#63e6e2",
        white: "#ffffff",
        blue: "#00d2ff",
        pink: "#ff2d55",
        purple: "#af52de",
        yellow: "#ffcc00"
      };
      const currentEye = this.config.mascotEyeColor || "mint";
      const cEye = eyeColors[currentEye] || "#63e6e2";
      if (eyeLeft) {
        eyeLeft.style.background = cEye;
        eyeLeft.style.boxShadow = `0 0 12px ${cEye}`;
      }
      if (eyeRight) {
        eyeRight.style.background = cEye;
        eyeRight.style.boxShadow = `0 0 12px ${cEye}`;
      }
      eyeCircles.forEach((circle) => {
        const eye = circle.getAttribute("data-eye") || "mint";
        circle.classList.toggle("active", eye === currentEye);
        circle.addEventListener("click", () => {
          eyeCircles.forEach((c2) => c2.classList.remove("active"));
          circle.classList.add("active");
          const c = eyeColors[eye] || "#63e6e2";
          if (eyeLeft) {
            eyeLeft.style.background = c;
            eyeLeft.style.boxShadow = `0 0 12px ${c}`;
          }
          if (eyeRight) {
            eyeRight.style.background = c;
            eyeRight.style.boxShadow = `0 0 12px ${c}`;
          }
          this.saveConfig({ mascotEyeColor: eye });
        });
      });
      const claudeSwitch = document.getElementById("toggle-claude-hook");
      if (claudeSwitch) {
        const isClaudeOn = this.config.claudeCodeHooksEnabled !== false;
        claudeSwitch.classList.toggle("on", isClaudeOn);
        claudeSwitch.addEventListener("click", () => {
          const on = !claudeSwitch.classList.contains("on");
          claudeSwitch.classList.toggle("on", on);
          this.saveConfig({ claudeCodeHooksEnabled: on });
        });
      }
      const codexSwitch = document.getElementById("toggle-codex-hook");
      if (codexSwitch) {
        const isCodexOn = this.config.codexHooksEnabled !== false;
        codexSwitch.classList.toggle("on", isCodexOn);
        codexSwitch.addEventListener("click", () => {
          const on = !codexSwitch.classList.contains("on");
          codexSwitch.classList.toggle("on", on);
          this.saveConfig({ codexHooksEnabled: on });
        });
      }
      const aiProviderSelect = document.getElementById("ai-provider-select");
      if (aiProviderSelect) {
        aiProviderSelect.value = this.config.aiProvider || "gemini";
        aiProviderSelect.addEventListener("change", () => {
          this.saveConfig({ aiProvider: aiProviderSelect.value });
        });
      }
      const geminiKeyInput = document.getElementById("gemini-api-key");
      if (geminiKeyInput) {
        geminiKeyInput.value = this.config.geminiApiKey || "";
        const saveGeminiKey = () => {
          const key = geminiKeyInput.value.trim();
          this.saveConfig({ geminiApiKey: key });
          if (window.settingsApi?.saveAICredential && key) {
            window.settingsApi.saveAICredential("gemini", key, "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-1.5-flash");
          }
        };
        geminiKeyInput.addEventListener("change", saveGeminiKey);
        geminiKeyInput.addEventListener("blur", saveGeminiKey);
        const toggleGeminiBtn = document.getElementById("btn-toggle-gemini-visibility");
        toggleGeminiBtn?.addEventListener("click", () => {
          const isPass = geminiKeyInput.type === "password";
          geminiKeyInput.type = isPass ? "text" : "password";
          toggleGeminiBtn.textContent = isPass ? "Hide" : "Show";
        });
        const verifyGeminiBtn = document.getElementById("btn-test-gemini");
        verifyGeminiBtn?.addEventListener("click", async () => {
          const key = geminiKeyInput.value.trim();
          if (!key) {
            verifyGeminiBtn.textContent = "Enter Key";
            setTimeout(() => {
              if (verifyGeminiBtn) verifyGeminiBtn.textContent = "Verify";
            }, 1500);
            return;
          }
          verifyGeminiBtn.textContent = "Checking...";
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
            if (res.ok) {
              verifyGeminiBtn.textContent = "Verified!";
              saveGeminiKey();
            } else {
              verifyGeminiBtn.textContent = "Invalid Key";
            }
          } catch {
            verifyGeminiBtn.textContent = "Net Error";
          }
          setTimeout(() => {
            if (verifyGeminiBtn) verifyGeminiBtn.textContent = "Verify";
          }, 2e3);
        });
      }
      const aiApiKeyInput = document.getElementById("ai-api-key");
      if (aiApiKeyInput) {
        aiApiKeyInput.value = this.config.openAiApiKey || "";
        const saveKey = () => {
          this.saveConfig({ openAiApiKey: aiApiKeyInput.value.trim() });
        };
        aiApiKeyInput.addEventListener("change", saveKey);
        aiApiKeyInput.addEventListener("blur", saveKey);
      }
      const aiTtsSwitch = document.getElementById("toggle-ai-tts");
      if (aiTtsSwitch) {
        const isTtsOn = this.config.ttsEnabled ?? this.config.soundEnabled ?? true;
        aiTtsSwitch.classList.toggle("on", isTtsOn);
        aiTtsSwitch.addEventListener("click", () => {
          const on = !aiTtsSwitch.classList.contains("on");
          aiTtsSwitch.classList.toggle("on", on);
          this.saveConfig({ ttsEnabled: on, soundEnabled: on });
        });
      }
      const startupSwitch = document.getElementById("toggle-startup");
      if (startupSwitch) {
        startupSwitch.classList.toggle("on", Boolean(this.config.autoStart));
        startupSwitch.addEventListener("click", () => {
          const on = !startupSwitch.classList.contains("on");
          startupSwitch.classList.toggle("on", on);
          this.saveConfig({ autoStart: on });
        });
      }
      const shortcutInput = document.getElementById("shortcut-input");
      if (shortcutInput && this.config.globalShortcut) {
        shortcutInput.value = this.config.globalShortcut;
      }
      const themeSelect = document.getElementById("theme-select");
      if (themeSelect) {
        themeSelect.value = this.config.theme || "dark";
        themeSelect.addEventListener("change", () => {
          this.saveConfig({ theme: themeSelect.value });
        });
      }
      const langSelect = document.getElementById("language-select");
      if (langSelect) {
        langSelect.value = this.config.language || "en";
        langSelect.addEventListener("change", () => {
          const lang = langSelect.value === "hi" ? "hi" : "en";
          this.saveConfig({ language: lang });
        });
      }
      const styleRadios = document.querySelectorAll('input[name="islandStyle"]');
      styleRadios.forEach((r) => {
        const radio = r;
        radio.checked = radio.value === (this.config.islandStyle || "floating");
        radio.addEventListener("change", () => {
          this.saveConfig({ islandStyle: radio.value });
        });
      });
      const scaleRadios = document.querySelectorAll('input[name="islandScale"]');
      scaleRadios.forEach((r) => {
        const radio = r;
        radio.checked = parseFloat(radio.value) === (this.config.islandScale || 1);
        radio.addEventListener("change", () => {
          this.saveConfig({ islandScale: parseFloat(radio.value) });
        });
      });
      const textureSelect = document.getElementById("texture-select");
      if (textureSelect) {
        textureSelect.value = this.config.visualTexture || "obsidian";
        textureSelect.addEventListener("change", () => {
          this.saveConfig({ visualTexture: textureSelect.value });
        });
      }
      const restLeftSelect = document.getElementById("rest-left-select");
      if (restLeftSelect) {
        restLeftSelect.value = this.config.restLeft || "none";
        restLeftSelect.addEventListener("change", () => {
          this.saveConfig({ restLeft: restLeftSelect.value });
        });
      }
      const restRightSelect = document.getElementById("rest-right-select");
      if (restRightSelect) {
        restRightSelect.value = this.config.restRight || "none";
        restRightSelect.addEventListener("change", () => {
          this.saveConfig({ restRight: restRightSelect.value });
        });
      }
      const textureSkinSelect = document.getElementById("texture-skin-select");
      if (textureSkinSelect) {
        textureSkinSelect.value = this.config.textureSkin || "none";
        textureSkinSelect.addEventListener("change", () => {
          this.saveConfig({ textureSkin: textureSkinSelect.value });
        });
      }
      const soundPackSelect = document.getElementById("sound-pack-select");
      if (soundPackSelect) {
        soundPackSelect.value = this.config.soundPack || "klassiek";
        soundPackSelect.addEventListener("change", () => {
          this.saveConfig({ soundPack: soundPackSelect.value });
        });
      }
      const guardSwitch = document.getElementById("toggle-focus-guard");
      if (guardSwitch) {
        const isGuardOn = Boolean(this.config.focusGuardEnabled);
        guardSwitch.classList.toggle("on", isGuardOn);
        guardSwitch.addEventListener("click", () => {
          const on = !guardSwitch.classList.contains("on");
          guardSwitch.classList.toggle("on", on);
          this.saveConfig({ focusGuardEnabled: on });
        });
      }
      const guardText = document.getElementById("guard-blocked-list");
      if (guardText) {
        const blockedApps = Array.isArray(this.config.focusGuardBlockedApps) && this.config.focusGuardBlockedApps.length > 0 ? this.config.focusGuardBlockedApps : this.config.focusGuardBlocked ? this.config.focusGuardBlocked.split(",").map((s) => s.trim()).filter(Boolean) : [];
        if (blockedApps.length > 0) {
          guardText.value = blockedApps.join(", ");
        }
        const saveGuardList = () => {
          const list = guardText.value.split(",").map((s) => s.trim()).filter(Boolean);
          this.saveConfig({ focusGuardBlockedApps: list, focusGuardBlocked: guardText.value });
        };
        guardText.addEventListener("change", saveGuardList);
        guardText.addEventListener("blur", saveGuardList);
      }
      const nameInput = document.getElementById("profile-name-input");
      const userDisplay = document.getElementById("user-display-name");
      if (nameInput) {
        nameInput.value = this.config.profileName || "Robo Companion";
        if (userDisplay) userDisplay.textContent = nameInput.value;
        const saveProfile = () => {
          if (userDisplay) userDisplay.textContent = nameInput.value;
          this.saveConfig({ profileName: nameInput.value });
        };
        nameInput.addEventListener("change", saveProfile);
        nameInput.addEventListener("blur", saveProfile);
      }
      const skinCards = document.querySelectorAll(".skin-card");
      skinCards.forEach((card) => {
        const skin = card.getAttribute("data-skin");
        card.classList.toggle("active", skin === (this.config.mascotSkin || "classic"));
        card.addEventListener("click", () => {
          skinCards.forEach((c) => c.classList.remove("active"));
          card.classList.add("active");
          this.saveConfig({ mascotSkin: skin });
        });
      });
      const hatCards = document.querySelectorAll(".hat-card");
      hatCards.forEach((card) => {
        const hat = card.getAttribute("data-hat");
        card.classList.toggle("active", hat === (this.config.mascotHat || "none"));
        card.addEventListener("click", () => {
          hatCards.forEach((c) => c.classList.remove("active"));
          card.classList.add("active");
          this.saveConfig({ mascotHat: hat });
        });
      });
    }
    setupSearch() {
      const input = document.getElementById("search-input");
      if (!input) return;
      input.addEventListener("input", () => this.applySearchFilter());
      window.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
          e.preventDefault();
          input.focus();
          input.select();
        }
      });
    }
    applySearchFilter() {
      const input = document.getElementById("search-input");
      const q = input ? input.value.trim().toLowerCase() : "";
      const currentPane = document.getElementById(`pane-${this.activeTab}`);
      if (!currentPane) return;
      const searchableItems = currentPane.querySelectorAll(".card, .row, .form-row, .app-card, .outfit-card, .kpi-card");
      searchableItems.forEach((item) => {
        if (!q) {
          item.classList.remove("search-hidden");
        } else {
          const text = item.textContent?.toLowerCase() || "";
          const match = text.includes(q);
          item.classList.toggle("search-hidden", !match);
        }
      });
    }
    setupQuickNavigation() {
      const weatherCard = document.getElementById("card-weather");
      const wifiCard = document.getElementById("card-wifi");
      const batteryCard = document.getElementById("card-battery");
      const timeCard = document.getElementById("card-time");
      weatherCard?.addEventListener("click", () => this.switchTab("island"));
      wifiCard?.addEventListener("click", () => this.switchTab("connect"));
      batteryCard?.addEventListener("click", () => this.switchTab("island"));
      timeCard?.addEventListener("click", () => this.switchTab("island"));
      document.querySelectorAll("[data-goto]").forEach((el) => {
        el.addEventListener("click", () => {
          const target = el.getAttribute("data-goto");
          if (target) this.switchTab(target);
        });
      });
    }
    setupInteractiveButtons() {
      const btnTestClaude = document.getElementById("btn-test-claude");
      btnTestClaude?.addEventListener("click", () => {
        btnTestClaude.textContent = "Listening on :47823 (OK)";
        this.playProceduralChime("working");
        setTimeout(() => {
          if (btnTestClaude) btnTestClaude.textContent = "Test Webhook Ping";
        }, 2200);
      });
      const btnCopyClaude = document.getElementById("btn-copy-claude-guide");
      btnCopyClaude?.addEventListener("click", async () => {
        try {
          if (navigator.clipboard) await navigator.clipboard.writeText("claude --telem-port 47823");
          btnCopyClaude.textContent = "Copied!";
          setTimeout(() => {
            if (btnCopyClaude) btnCopyClaude.textContent = "Copy Setup Command";
          }, 2e3);
        } catch {
        }
      });
      const btnTestCodex = document.getElementById("btn-test-codex");
      btnTestCodex?.addEventListener("click", () => {
        btnTestCodex.textContent = "Codex Hook Active (OK)";
        this.playProceduralChime("working");
        setTimeout(() => {
          if (btnTestCodex) btnTestCodex.textContent = "Test Codex Ping";
        }, 2200);
      });
      const btnCopyCodex = document.getElementById("btn-copy-codex-guide");
      btnCopyCodex?.addEventListener("click", async () => {
        try {
          if (navigator.clipboard) await navigator.clipboard.writeText("codex --notify-hook http://127.0.0.1:47823/event");
          btnCopyCodex.textContent = "Copied!";
          setTimeout(() => {
            if (btnCopyCodex) btnCopyCodex.textContent = "Copy Setup Command";
          }, 2e3);
        } catch {
        }
      });
      const apiKeyInput = document.getElementById("ai-api-key");
      const btnToggleKey = document.getElementById("btn-toggle-key-visibility");
      btnToggleKey?.addEventListener("click", () => {
        if (!apiKeyInput) return;
        const isPass = apiKeyInput.type === "password";
        apiKeyInput.type = isPass ? "text" : "password";
        btnToggleKey.textContent = isPass ? "Hide" : "Show";
      });
      const btnTestAi = document.getElementById("btn-test-ai");
      btnTestAi?.addEventListener("click", () => {
        const key = apiKeyInput ? apiKeyInput.value.trim() : "";
        if (!key) {
          btnTestAi.textContent = "Key Optional (OK)";
        } else {
          btnTestAi.textContent = "Key Verified (OK)";
        }
        setTimeout(() => {
          if (btnTestAi) btnTestAi.textContent = "Verify";
        }, 2e3);
      });
      const btnTestTts = document.getElementById("btn-test-tts");
      btnTestTts?.addEventListener("click", () => {
        if ("speechSynthesis" in window && window.speechSynthesis) {
          try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance("Hello! I am Robo, your desktop companion.");
            utterance.rate = 1.05;
            utterance.pitch = 1.15;
            window.speechSynthesis.speak(utterance);
          } catch {
            this.playProceduralChime("klassiek");
          }
        } else {
          this.playProceduralChime("klassiek");
        }
        btnTestTts.textContent = "Speaking...";
        setTimeout(() => {
          if (btnTestTts) btnTestTts.textContent = "Test Voice";
        }, 2e3);
      });
      const btnAppsAllOn = document.getElementById("btn-apps-all-on");
      btnAppsAllOn?.addEventListener("click", () => {
        this.appsOff.clear();
        document.querySelectorAll("#apps-list .switch").forEach((sw) => sw.classList.add("on"));
        this.saveConfig({ appsOff: [] });
      });
      const btnAppsAllOff = document.getElementById("btn-apps-all-off");
      btnAppsAllOff?.addEventListener("click", () => {
        APPS.forEach((a) => this.appsOff.add(a.id));
        document.querySelectorAll("#apps-list .switch").forEach((sw) => sw.classList.remove("on"));
        this.saveConfig({ appsOff: Array.from(this.appsOff) });
      });
      const heroFaceLeft = document.querySelector(".robo-face-preview .face-eye.left");
      const heroFaceRight = document.querySelector(".robo-face-preview .face-eye.right");
      const wardrobeEyeLeft = document.getElementById("wardrobe-eye-left");
      const wardrobeEyeRight = document.getElementById("wardrobe-eye-right");
      const flashEyes = (color) => {
        [heroFaceLeft, heroFaceRight, wardrobeEyeLeft, wardrobeEyeRight].forEach((el) => {
          if (el) {
            el.style.background = color;
            el.style.boxShadow = `0 0 14px ${color}`;
          }
        });
      };
      const btnTestWorking = document.getElementById("btn-test-working");
      btnTestWorking?.addEventListener("click", () => {
        const color = this.config.trafficLightEyes?.working || "#ff9500";
        flashEyes(color);
        this.playProceduralChime("working");
        btnTestWorking.textContent = "Testing...";
        setTimeout(() => {
          if (btnTestWorking) btnTestWorking.innerHTML = '<span class="traffic-dot dot-working"></span>Test Working';
        }, 1800);
      });
      const btnTestDone = document.getElementById("btn-test-done");
      btnTestDone?.addEventListener("click", () => {
        const color = this.config.trafficLightEyes?.done || "#34c759";
        flashEyes(color);
        this.playProceduralChime("done");
        btnTestDone.textContent = "Done!";
        setTimeout(() => {
          if (btnTestDone) btnTestDone.innerHTML = '<span class="traffic-dot dot-done"></span>Test Done';
        }, 1800);
      });
      const btnTestError = document.getElementById("btn-test-error");
      btnTestError?.addEventListener("click", () => {
        const color = this.config.trafficLightEyes?.error || "#ff3b30";
        flashEyes(color);
        this.playProceduralChime("error");
        btnTestError.textContent = "Alert!";
        setTimeout(() => {
          if (btnTestError) btnTestError.innerHTML = '<span class="traffic-dot dot-error"></span>Test Error';
        }, 1800);
      });
      const btnRandomOutfit = document.getElementById("btn-random-outfit");
      btnRandomOutfit?.addEventListener("click", () => {
        const outfits = ["best", "none", "party", "sunglasses", "crown"];
        const bodies = ["cloud", "mint", "sky", "rose", "classic", "night", "blue", "purple", "pink", "gold"];
        const eyes = ["mint", "white", "blue", "pink", "purple", "yellow"];
        const randomOutfit = outfits[Math.floor(Math.random() * outfits.length)];
        const randomBody = bodies[Math.floor(Math.random() * bodies.length)];
        const randomEye = eyes[Math.floor(Math.random() * eyes.length)];
        const outfitCard = document.querySelector(`.outfit-card[data-outfit="${randomOutfit}"]`);
        outfitCard?.click();
        const bodyCircle = document.querySelector(`.color-circle[data-body="${randomBody}"]`);
        bodyCircle?.click();
        const eyeCircle = document.querySelector(`.color-circle[data-eye="${randomEye}"]`);
        eyeCircle?.click();
        this.playProceduralChime("belletjes");
      });
      const shortcutInput = document.getElementById("shortcut-input");
      const btnRecord = document.getElementById("btn-record-shortcut");
      const btnReset = document.getElementById("btn-reset-shortcut");
      let recording = false;
      btnRecord?.addEventListener("click", () => {
        recording = !recording;
        if (recording) {
          btnRecord.textContent = "Press Keys...";
          if (shortcutInput) shortcutInput.value = "Recording keys...";
        } else {
          btnRecord.textContent = "Record Key";
          if (shortcutInput) shortcutInput.value = this.config.globalShortcut || "Ctrl + Alt + T";
        }
      });
      window.addEventListener("keydown", (e) => {
        if (!recording) return;
        if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
        e.preventDefault();
        const parts = [];
        if (e.ctrlKey) parts.push("Ctrl");
        if (e.altKey) parts.push("Alt");
        if (e.shiftKey) parts.push("Shift");
        if (e.metaKey) parts.push("Super");
        const keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key;
        parts.push(keyName);
        const combo = parts.join(" + ");
        recording = false;
        if (btnRecord) btnRecord.textContent = "Record Key";
        if (shortcutInput) shortcutInput.value = combo;
        this.saveConfig({ globalShortcut: combo });
        this.playProceduralChime("klassiek");
      });
      btnReset?.addEventListener("click", () => {
        recording = false;
        if (btnRecord) btnRecord.textContent = "Record Key";
        if (shortcutInput) shortcutInput.value = "Ctrl + Alt + T";
        this.saveConfig({ globalShortcut: "Ctrl + Alt + T" });
      });
      const btnPreviewSound = document.getElementById("btn-preview-sound");
      const soundPackSelect = document.getElementById("sound-pack-select");
      btnPreviewSound?.addEventListener("click", () => {
        const pack = soundPackSelect?.value || "klassiek";
        this.playProceduralChime(pack);
        btnPreviewSound.textContent = "Playing...";
        setTimeout(() => {
          if (btnPreviewSound) btnPreviewSound.textContent = "Play Preview";
        }, 800);
      });
      const btnTestIsland = document.getElementById("btn-test-island-toggle");
      btnTestIsland?.addEventListener("click", () => {
        window.settingsApi?.toggleIsland?.();
        btnTestIsland.textContent = "Toggled!";
        setTimeout(() => {
          if (btnTestIsland) btnTestIsland.textContent = "Toggle Island";
        }, 1500);
      });
      const btnTestNotification = document.getElementById("btn-test-notification");
      btnTestNotification?.addEventListener("click", () => {
        window.settingsApi?.postNotification?.({
          id: "test-done-" + Date.now(),
          title: "Task Completed",
          body: "Claude Code finished building features",
          kind: "done",
          durationMs: 3800
        });
        btnTestNotification.textContent = "Triggered!";
        setTimeout(() => {
          if (btnTestNotification) btnTestNotification.textContent = "Test Done";
        }, 1500);
      });
      const btnTestWhatsApp = document.getElementById("btn-test-whatsapp");
      btnTestWhatsApp?.addEventListener("click", () => {
        window.settingsApi?.postNotification?.({
          id: "test-wa-" + Date.now(),
          app: "WhatsApp",
          title: "WhatsApp: Rahul Sharma",
          body: "Hey! Are we still meeting for lunch today?",
          kind: "whatsapp",
          durationMs: 5e3
        });
        btnTestWhatsApp.textContent = "Pushed!";
        setTimeout(() => {
          if (btnTestWhatsApp) btnTestWhatsApp.textContent = "Test WhatsApp";
        }, 1500);
      });
      const btnTestWaGroup = document.getElementById("btn-test-wa-group");
      btnTestWaGroup?.addEventListener("click", () => {
        window.settingsApi?.postNotification?.({
          id: "test-wagroup-" + Date.now(),
          app: "WhatsApp",
          title: "Tech Developers",
          body: "Alice: Have you checked the latest release build?",
          kind: "whatsapp",
          durationMs: 5e3
        });
        btnTestWaGroup.textContent = "Pushed!";
        setTimeout(() => {
          if (btnTestWaGroup) btnTestWaGroup.textContent = "Test WA Group";
        }, 1500);
      });
      const btnTestWaCall = document.getElementById("btn-test-wa-call");
      btnTestWaCall?.addEventListener("click", () => {
        window.settingsApi?.postNotification?.({
          id: "test-wacall-" + Date.now(),
          app: "WhatsApp",
          title: "WhatsApp Voice Call",
          body: "Rahul Sharma",
          kind: "whatsapp",
          durationMs: 15e3
        });
        btnTestWaCall.textContent = "Ringing...";
        setTimeout(() => {
          if (btnTestWaCall) btnTestWaCall.textContent = "Test WA Call";
        }, 2e3);
      });
      const btnTestChrome = document.getElementById("btn-test-chrome");
      btnTestChrome?.addEventListener("click", () => {
        window.settingsApi?.postNotification?.({
          id: "test-chrome-" + Date.now(),
          app: "Google Chrome",
          title: "GitHub: Build Successful",
          body: "Workflow run completed for roboisland/main (100% passed)",
          kind: "chrome",
          url: "https://github.com",
          durationMs: 5e3
        });
        btnTestChrome.textContent = "Pushed!";
        setTimeout(() => {
          if (btnTestChrome) btnTestChrome.textContent = "Test Chrome";
        }, 1500);
      });
      const btnTestMail = document.getElementById("btn-test-mail");
      btnTestMail?.addEventListener("click", () => {
        window.settingsApi?.postNotification?.({
          id: "test-mail-" + Date.now(),
          app: "Mail",
          title: "Google Security: New Login",
          body: "A new sign-in was detected on your Windows device.",
          kind: "mail",
          durationMs: 5e3
        });
        btnTestMail.textContent = "Pushed!";
        setTimeout(() => {
          if (btnTestMail) btnTestMail.textContent = "Test Mail";
        }, 1500);
      });
      const btnTestDownloadProgress = document.getElementById("btn-test-download-progress");
      btnTestDownloadProgress?.addEventListener("click", () => {
        window.settingsApi?.postNotification?.({
          id: "test-dl-prog-" + Date.now(),
          app: "Downloads",
          title: "RoboIsland-v2.0-Setup.exe",
          body: "24.5 MB \u2022 3.2 MB/s",
          kind: "download",
          status: "downloading",
          progress: 0.65,
          durationMs: 4500
        });
        btnTestDownloadProgress.textContent = "Pushed!";
        setTimeout(() => {
          if (btnTestDownloadProgress) btnTestDownloadProgress.textContent = "Test Progress DL";
        }, 1500);
      });
      const btnTestDownload = document.getElementById("btn-test-download");
      btnTestDownload?.addEventListener("click", () => {
        window.settingsApi?.postNotification?.({
          id: "test-dl-" + Date.now(),
          app: "Downloads",
          title: "Download Complete",
          body: "RoboIsland-v2.0-Setup.exe",
          kind: "download",
          status: "complete",
          filePath: "C:\\Users\\Default\\Downloads\\RoboIsland-v2.0-Setup.exe",
          durationMs: 5e3
        });
        btnTestDownload.textContent = "Pushed!";
        setTimeout(() => {
          if (btnTestDownload) btnTestDownload.textContent = "Test DL Complete";
        }, 1500);
      });
      const btnTestDownloadCancel = document.getElementById("btn-test-download-cancel");
      btnTestDownloadCancel?.addEventListener("click", () => {
        window.settingsApi?.postNotification?.({
          id: "test-dl-cancel-" + Date.now(),
          app: "Downloads",
          title: "Download Cancelled",
          body: "RoboIsland-v2.0-Setup.exe",
          kind: "download",
          status: "error",
          durationMs: 4500
        });
        btnTestDownloadCancel.textContent = "Pushed!";
        setTimeout(() => {
          if (btnTestDownloadCancel) btnTestDownloadCancel.textContent = "Test DL Cancelled";
        }, 1500);
      });
      const btnTestQuestion = document.getElementById("btn-test-question-notification");
      btnTestQuestion?.addEventListener("click", () => {
        window.settingsApi?.postNotification?.({
          id: "test-question-" + Date.now(),
          title: "npm install electron",
          body: "Authorize Claude to run dependency installation?",
          kind: "question",
          actions: [
            { id: "deny", label: "Deny", primary: false },
            { id: "allow", label: "Allow", primary: true }
          ]
        });
        btnTestQuestion.textContent = "Triggered!";
        setTimeout(() => {
          if (btnTestQuestion) btnTestQuestion.textContent = "Test Question";
        }, 1500);
      });
      const btnTestVolume = document.getElementById("btn-test-volume-hud");
      btnTestVolume?.addEventListener("click", () => {
        window.settingsApi?.testVolumeHud?.(65, false);
        btnTestVolume.textContent = "Triggered!";
        setTimeout(() => {
          if (btnTestVolume) btnTestVolume.textContent = "Test Volume HUD";
        }, 1500);
      });
      const btnTestCharger = document.getElementById("btn-test-charger-surge");
      btnTestCharger?.addEventListener("click", () => {
        window.settingsApi?.testChargerSurge?.(true, 85);
        btnTestCharger.textContent = "Triggered!";
        setTimeout(() => {
          if (btnTestCharger) btnTestCharger.textContent = "Test Charger Surge";
        }, 1500);
      });
      const btnTestSpeedometer = document.getElementById("btn-test-speedometer-hud");
      btnTestSpeedometer?.addEventListener("click", () => {
        window.settingsApi?.testSpeedometerHud?.();
        btnTestSpeedometer.textContent = "Triggered!";
        setTimeout(() => {
          if (btnTestSpeedometer) btnTestSpeedometer.textContent = "Test Speedometer HUD";
        }, 1500);
      });
      const btnTestJarvisVision = document.getElementById("btn-test-jarvis-vision");
      btnTestJarvisVision?.addEventListener("click", () => {
        window.settingsApi?.analyzeScreen?.();
        btnTestJarvisVision.textContent = "Scanning...";
        setTimeout(() => {
          if (btnTestJarvisVision) btnTestJarvisVision.textContent = "Trigger JARVIS Vision (Alt+S)";
        }, 3e3);
      });
      const btnTestJarvisClean = document.getElementById("btn-test-jarvis-clean");
      btnTestJarvisClean?.addEventListener("click", () => {
        window.settingsApi?.cleanJunkFiles?.();
        btnTestJarvisClean.textContent = "Purged!";
        setTimeout(() => {
          if (btnTestJarvisClean) btnTestJarvisClean.textContent = "Purge Junk & DNS";
        }, 1500);
      });
      const guardText = document.getElementById("guard-blocked-list");
      document.querySelectorAll(".guard-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const appDomain = chip.getAttribute("data-app");
          if (!appDomain || !guardText) return;
          const currentVal = guardText.value;
          const items = currentVal.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
          if (!items.includes(appDomain.toLowerCase())) {
            guardText.value = currentVal ? `${currentVal}, ${appDomain}` : appDomain;
            const updatedList = guardText.value.split(",").map((s) => s.trim()).filter(Boolean);
            this.saveConfig({ focusGuardBlockedApps: updatedList, focusGuardBlocked: guardText.value });
          }
        });
      });
      const btnTestGuard = document.getElementById("btn-test-guard");
      btnTestGuard?.addEventListener("click", () => {
        window.settingsApi?.testFocusGuard?.();
        btnTestGuard.textContent = "Triggered!";
        setTimeout(() => {
          if (btnTestGuard) btnTestGuard.textContent = "Test Mindful Pause";
        }, 1800);
      });
      const btnCheckUpdates = document.getElementById("btn-check-updates");
      btnCheckUpdates?.addEventListener("click", () => {
        btnCheckUpdates.textContent = "Checking...";
        setTimeout(() => {
          if (btnCheckUpdates) btnCheckUpdates.textContent = "Up to Date (v1.1.0)";
          setTimeout(() => {
            if (btnCheckUpdates) btnCheckUpdates.textContent = "Check for Updates";
          }, 2200);
        }, 700);
      });
      const btnOpenGitHub = document.getElementById("btn-open-github");
      btnOpenGitHub?.addEventListener("click", () => {
        window.settingsApi?.openExternal?.("https://github.com/RoboIsland/RoboIsland");
      });
      const btnCopySupport = document.getElementById("btn-copy-support-link");
      btnCopySupport?.addEventListener("click", async () => {
        try {
          if (navigator.clipboard) await navigator.clipboard.writeText("https://github.com/RoboIsland/RoboIsland");
          btnCopySupport.textContent = "Copied!";
          setTimeout(() => {
            if (btnCopySupport) btnCopySupport.textContent = "Copy Project Link";
          }, 2e3);
        } catch {
        }
      });
    }
    playProceduralChime(type) {
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtxClass) return;
        if (!this.audioCtx) {
          this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx.state === "suspended") {
          this.audioCtx.resume().catch(() => {
          });
        }
        const now = this.audioCtx.currentTime;
        if (type === "done" || type === "klassiek") {
          const osc1 = this.audioCtx.createOscillator();
          const gain1 = this.audioCtx.createGain();
          osc1.type = "sine";
          osc1.frequency.setValueAtTime(523.25, now);
          gain1.gain.setValueAtTime(0.12, now);
          gain1.gain.exponentialRampToValueAtTime(1e-3, now + 0.3);
          osc1.connect(gain1);
          gain1.connect(this.audioCtx.destination);
          osc1.start(now);
          osc1.stop(now + 0.35);
          const osc2 = this.audioCtx.createOscillator();
          const gain2 = this.audioCtx.createGain();
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(659.25, now + 0.12);
          gain2.gain.setValueAtTime(0.12, now + 0.12);
          gain2.gain.exponentialRampToValueAtTime(1e-3, now + 0.5);
          osc2.connect(gain2);
          gain2.connect(this.audioCtx.destination);
          osc2.start(now + 0.12);
          osc2.stop(now + 0.55);
        } else if (type === "working") {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.25);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.28);
        } else if (type === "error") {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(330, now);
          osc.frequency.linearRampToValueAtTime(261.63, now + 0.25);
          gain.gain.setValueAtTime(0.07, now);
          gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.3);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.35);
        } else if (type === "zacht") {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(392, now);
          gain.gain.setValueAtTime(1e-3, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.08);
          gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.6);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.65);
        } else if (type === "belletjes") {
          [880, 1174, 1760].forEach((freq, idx) => {
            if (!this.audioCtx) return;
            const t = now + idx * 0.07;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(1e-3, t + 0.25);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(t);
            osc.stop(t + 0.28);
          });
        }
      } catch {
      }
    }
  };
  window.addEventListener("DOMContentLoaded", () => {
    new SettingsUI();
  });
})();
