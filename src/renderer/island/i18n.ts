import enCatalog from '../locales/en.json';
import hiCatalog from '../locales/hi.json';

export type LocaleCode = 'en' | 'hi';

export interface TranslationDictionary {
  [key: string]: any;
}

export class I18nController {
  private currentLocale: LocaleCode = 'en';
  private catalogs: Record<LocaleCode, TranslationDictionary> = {
    en: enCatalog,
    hi: hiCatalog
  };
  private listeners: Array<(locale: LocaleCode) => void> = [];

  constructor(initialLocale: LocaleCode = 'en') {
    this.setLocale(initialLocale);
  }

  public getSupportedLocales(): LocaleCode[] {
    return ['en', 'hi'];
  }

  public getLocale(): LocaleCode {
    return this.currentLocale;
  }

  public setLocale(locale: string): void {
    const target: LocaleCode = (locale === 'hi') ? 'hi' : 'en';
    const changed = this.currentLocale !== target;
    this.currentLocale = target;
    if (changed) {
      this.notifyListeners();
    }
  }

  public onLocaleChanged(callback: (locale: LocaleCode) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentLocale);
      } catch (err) {
        console.error('[i18n] Listener error:', err);
      }
    }
  }

  private lookup(catalog: TranslationDictionary, key: string): string | undefined {
    if (!catalog) return undefined;
    
    // Direct top-level match
    if (typeof catalog[key] === 'string') {
      return catalog[key];
    }

    // Dot-notation navigation (e.g. "nav.home", "actions.save")
    if (key.includes('.')) {
      const parts = key.split('.');
      let curr: any = catalog;
      for (const p of parts) {
        if (curr && typeof curr === 'object' && p in curr) {
          curr = curr[p];
        } else {
          curr = undefined;
          break;
        }
      }
      if (typeof curr === 'string') return curr;
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

  public t(key: string, vars?: Record<string, string | number>): string {
    if (!key) return '';

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

  public applyToDom(root: Element | Document = document): void {
    if (!root || !('querySelectorAll' in root)) return;

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
        (el as HTMLInputElement).placeholder = this.t(k);
      }
    });
  }
}

export const i18n = new I18nController();

// Expose on global window object for renderer scripts
if (typeof window !== 'undefined') {
  (window as any).roboIslandI18n = i18n;
}
