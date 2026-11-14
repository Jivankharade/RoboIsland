"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.i18n = exports.I18nController = void 0;
const en_json_1 = __importDefault(require("../locales/en.json"));
const hi_json_1 = __importDefault(require("../locales/hi.json"));
class I18nController {
    currentLocale = 'en';
    catalogs = {
        en: en_json_1.default,
        hi: hi_json_1.default
    };
    listeners = [];
    constructor(initialLocale = 'en') {
        this.setLocale(initialLocale);
    }
    getSupportedLocales() {
        return ['en', 'hi'];
    }
    getLocale() {
        return this.currentLocale;
    }
    setLocale(locale) {
        const target = (locale === 'hi') ? 'hi' : 'en';
        const changed = this.currentLocale !== target;
        this.currentLocale = target;
        if (changed) {
            this.notifyListeners();
        }
    }
    onLocaleChanged(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }
    notifyListeners() {
        for (const listener of this.listeners) {
            try {
                listener(this.currentLocale);
            }
            catch (err) {
                console.error('[i18n] Listener error:', err);
            }
        }
    }
    lookup(catalog, key) {
        if (!catalog)
            return undefined;
        // Direct top-level match
        if (typeof catalog[key] === 'string') {
            return catalog[key];
        }
        // Dot-notation navigation (e.g. "nav.home", "actions.save")
        if (key.includes('.')) {
            const parts = key.split('.');
            let curr = catalog;
            for (const p of parts) {
                if (curr && typeof curr === 'object' && p in curr) {
                    curr = curr[p];
                }
                else {
                    curr = undefined;
                    break;
                }
            }
            if (typeof curr === 'string')
                return curr;
        }
        // Deep search in nested namespaces (nav, actions, settings, status)
        const namespaces = ['nav', 'actions', 'settings', 'status'];
        for (const ns of namespaces) {
            if (catalog[ns] && typeof catalog[ns] === 'object' && typeof catalog[ns][key] === 'string') {
                return catalog[ns][key];
            }
        }
        return undefined;
    }
    t(key, vars) {
        if (!key)
            return '';
        // Primary locale lookup
        let str = this.lookup(this.catalogs[this.currentLocale], key);
        // Fallback to English if missing or empty in primary locale
        if (!str || str.trim() === '') {
            str = this.lookup(this.catalogs.en, key);
        }
        // Fallback to key literal if not found in English
        if (!str) {
            str = key;
        }
        // Interpolate {varName} placeholders
        if (vars && typeof vars === 'object') {
            str = str.replace(/\{(\w+)\}/g, (match, paramKey) => {
                return vars[paramKey] !== undefined ? String(vars[paramKey]) : match;
            });
        }
        return str;
    }
    applyToDom(root = document) {
        if (!root || !('querySelectorAll' in root))
            return;
        // Text content
        const elements = root.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const k = el.getAttribute('data-i18n');
            if (k) {
                el.textContent = this.t(k);
            }
        });
        // Titles
        const titleElements = root.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(el => {
            const k = el.getAttribute('data-i18n-title');
            if (k) {
                el.setAttribute('title', this.t(k));
            }
        });
        // Placeholders
        const inputElements = root.querySelectorAll('[data-i18n-placeholder]');
        inputElements.forEach(el => {
            const k = el.getAttribute('data-i18n-placeholder');
            if (k && 'placeholder' in el) {
                el.placeholder = this.t(k);
            }
        });
    }
}
exports.I18nController = I18nController;
exports.i18n = new I18nController();
// Expose on global window object for renderer scripts
if (typeof window !== 'undefined') {
    window.roboIslandI18n = exports.i18n;
}
