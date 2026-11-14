"use strict";
(() => {
  // src/renderer/locales/en.json
  var en_default = {
    appName: "RoboIsland",
    statusReady: "Ready",
    focusSession: "Focus Session",
    weatherClear: "Clear",
    nav: {
      home: "Home",
      chat: "Chat",
      monitor: "Monitor",
      music: "Music",
      focus: "Focus",
      files: "Files",
      system: "System",
      settings: "Settings",
      tray: "File Tray",
      clipboard: "Clipboard",
      notes: "Notes"
    },
    actions: {
      search: "Search",
      send: "Send",
      clear: "Clear",
      save: "Save",
      refresh: "Refresh",
      connect: "Connect",
      disconnect: "Disconnect",
      override: "Override",
      allow: "Allow",
      deny: "Deny",
      copy: "Copy",
      copied: "Copied!",
      pause: "Pause",
      resume: "Resume",
      stop: "Stop"
    },
    settings: {
      language: "Language",
      theme: "Theme",
      sound: "Sound",
      restMode: "Rest Mode",
      gameMode: "Game Mode",
      about: "About",
      general: "General",
      connections: "Connections",
      dynamicIsland: "Dynamic Island",
      focusGuard: "Focus Guard",
      wardrobe: "Wardrobe & Skins",
      account: "Account & Profile",
      support: "Support & About",
      news: "News & Updates"
    },
    status: {
      cpuUsage: "CPU Usage",
      ramUsage: "RAM Usage",
      batteryCharging: "Charging",
      batteryDischarging: "Battery",
      wifiConnected: "Connected",
      bluetoothActive: "Active"
    }
  };

  // src/renderer/locales/hi.json
  var hi_default = {
    appName: "\u0930\u094B\u092C\u094B\u0906\u0907\u0932\u0948\u0902\u0921",
    statusReady: "\u0924\u0948\u092F\u093E\u0930",
    focusSession: "\u092B\u094B\u0915\u0938 \u0938\u0924\u094D\u0930",
    weatherClear: "\u0938\u093E\u092B\u093C",
    nav: {
      home: "\u0939\u094B\u092E",
      chat: "\u091A\u0948\u091F",
      monitor: "\u092E\u0949\u0928\u093F\u091F\u0930",
      music: "\u0938\u0902\u0917\u0940\u0924",
      focus: "\u092B\u094B\u0915\u0938",
      files: "\u092B\u093C\u093E\u0907\u0932\u0947\u0902",
      system: "\u0938\u093F\u0938\u094D\u091F\u092E",
      settings: "\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938",
      tray: "\u092B\u093C\u093E\u0907\u0932 \u091F\u094D\u0930\u0947",
      clipboard: "\u0915\u094D\u0932\u093F\u092A\u092C\u094B\u0930\u094D\u0921",
      notes: "\u0928\u094B\u091F\u094D\u0938"
    },
    actions: {
      search: "\u0916\u094B\u091C\u0947\u0902",
      send: "\u092D\u0947\u091C\u0947\u0902",
      clear: "\u0938\u093E\u092B\u093C \u0915\u0930\u0947\u0902",
      save: "\u0938\u0939\u0947\u091C\u0947\u0902",
      refresh: "\u0924\u093E\u091C\u093C\u093E \u0915\u0930\u0947\u0902",
      connect: "\u0915\u0928\u0947\u0915\u094D\u091F \u0915\u0930\u0947\u0902",
      disconnect: "\u0921\u093F\u0938\u094D\u0915\u0928\u0947\u0915\u094D\u091F \u0915\u0930\u0947\u0902",
      override: "\u0913\u0935\u0930\u0930\u093E\u0907\u0921",
      allow: "\u0905\u0928\u0941\u092E\u0924\u093F \u0926\u0947\u0902",
      deny: "\u0905\u0938\u094D\u0935\u0940\u0915\u093E\u0930 \u0915\u0930\u0947\u0902",
      copy: "\u0915\u0949\u092A\u0940 \u0915\u0930\u0947\u0902",
      copied: "\u0915\u0949\u092A\u0940 \u0939\u094B \u0917\u092F\u093E!",
      pause: "\u0930\u094B\u0915\u0947\u0902",
      resume: "\u092B\u093F\u0930 \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902",
      stop: "\u092C\u0902\u0926 \u0915\u0930\u0947\u0902"
    },
    settings: {
      language: "\u092D\u093E\u0937\u093E",
      theme: "\u0925\u0940\u092E",
      sound: "\u0927\u094D\u0935\u0928\u093F",
      restMode: "\u0935\u093F\u0936\u094D\u0930\u093E\u092E \u092E\u094B\u0921",
      gameMode: "\u0917\u0947\u092E \u092E\u094B\u0921",
      about: "\u0915\u0947 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902",
      general: "\u0938\u093E\u092E\u093E\u0928\u094D\u092F",
      connections: "\u0915\u0928\u0947\u0915\u094D\u0936\u0928",
      dynamicIsland: "\u0921\u093E\u092F\u0928\u093E\u092E\u093F\u0915 \u0906\u0907\u0932\u0948\u0902\u0921",
      focusGuard: "\u092B\u094B\u0915\u0938 \u0917\u093E\u0930\u094D\u0921",
      wardrobe: "\u0905\u0932\u092E\u093E\u0930\u0940 \u0914\u0930 \u092A\u094B\u0936\u093E\u0915",
      account: "\u0916\u093E\u0924\u093E \u0914\u0930 \u092A\u094D\u0930\u094B\u092B\u093C\u093E\u0907\u0932",
      support: "\u0938\u0939\u093E\u092F\u0924\u093E \u0914\u0930 \u091C\u093E\u0928\u0915\u093E\u0930\u0940",
      news: "\u0938\u092E\u093E\u091A\u093E\u0930 \u0914\u0930 \u0905\u092A\u0921\u0947\u091F"
    },
    status: {
      cpuUsage: "\u0938\u0940\u092A\u0940\u092F\u0942 \u0909\u092A\u092F\u094B\u0917",
      ramUsage: "\u0930\u0948\u092E \u0909\u092A\u092F\u094B\u0917",
      batteryCharging: "\u091A\u093E\u0930\u094D\u091C \u0939\u094B \u0930\u0939\u093E \u0939\u0948",
      batteryDischarging: "\u092C\u0948\u091F\u0930\u0940",
      wifiConnected: "\u0915\u0928\u0947\u0915\u094D\u091F\u0947\u0921",
      bluetoothActive: "\u0938\u0915\u094D\u0930\u093F\u092F"
    }
  };

  // src/renderer/island/i18n.ts
  var I18nController = class {
    currentLocale = "en";
    catalogs = {
      en: en_default,
      hi: hi_default
    };
    listeners = [];
    constructor(initialLocale = "en") {
      this.setLocale(initialLocale);
    }
    getSupportedLocales() {
      return ["en", "hi"];
    }
    getLocale() {
      return this.currentLocale;
    }
    setLocale(locale) {
      const target = locale === "hi" ? "hi" : "en";
      const changed = this.currentLocale !== target;
      this.currentLocale = target;
      if (changed) {
        this.notifyListeners();
      }
    }
    onLocaleChanged(callback) {
      this.listeners.push(callback);
      return () => {
        this.listeners = this.listeners.filter((cb) => cb !== callback);
      };
    }
    notifyListeners() {
      for (const listener of this.listeners) {
        try {
          listener(this.currentLocale);
        } catch (err) {
          console.error("[i18n] Listener error:", err);
        }
      }
    }
    lookup(catalog, key) {
      if (!catalog) return void 0;
      if (typeof catalog[key] === "string") {
        return catalog[key];
      }
      if (key.includes(".")) {
        const parts = key.split(".");
        let curr = catalog;
        for (const p of parts) {
          if (curr && typeof curr === "object" && p in curr) {
            curr = curr[p];
          } else {
            curr = void 0;
            break;
          }
        }
        if (typeof curr === "string") return curr;
      }
      const namespaces = ["nav", "actions", "settings", "status"];
      for (const ns of namespaces) {
        if (catalog[ns] && typeof catalog[ns] === "object" && typeof catalog[ns][key] === "string") {
          return catalog[ns][key];
        }
      }
      return void 0;
    }
    t(key, vars) {
      if (!key) return "";
      let str = this.lookup(this.catalogs[this.currentLocale], key);
      if (!str || str.trim() === "") {
        str = this.lookup(this.catalogs.en, key);
      }
      if (!str) {
        str = key;
      }
      if (vars && typeof vars === "object") {
        str = str.replace(/\{(\w+)\}/g, (match, paramKey) => {
          return vars[paramKey] !== void 0 ? String(vars[paramKey]) : match;
        });
      }
      return str;
    }
    applyToDom(root = document) {
      if (!root || !("querySelectorAll" in root)) return;
      const elements = root.querySelectorAll("[data-i18n]");
      elements.forEach((el) => {
        const k = el.getAttribute("data-i18n");
        if (k) {
          el.textContent = this.t(k);
        }
      });
      const titleElements = root.querySelectorAll("[data-i18n-title]");
      titleElements.forEach((el) => {
        const k = el.getAttribute("data-i18n-title");
        if (k) {
          el.setAttribute("title", this.t(k));
        }
      });
      const inputElements = root.querySelectorAll("[data-i18n-placeholder]");
      inputElements.forEach((el) => {
        const k = el.getAttribute("data-i18n-placeholder");
        if (k && "placeholder" in el) {
          el.placeholder = this.t(k);
        }
      });
    }
  };
  var i18n = new I18nController();
  if (typeof window !== "undefined") {
    window.roboIslandI18n = i18n;
  }
})();
