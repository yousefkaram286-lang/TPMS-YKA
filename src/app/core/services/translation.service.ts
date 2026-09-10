// ============================================================
// TPMS — Translation Service
// ------------------------------------------------------------
// Lightweight runtime translation for English (LTR) / Arabic
// (RTL). No external i18n dependency.
//
// Reactivity model: templates call `translate(key, params)`.
// Because `translate` reads the `language` signal, any template
// expression evaluating it registers a reactive dependency, so
// the component re-renders automatically when the language
// changes at runtime (no rebuild / reload required).
//
// Fallback behaviour (fail-safe):
//   - missing Arabic key  -> English value
//   - missing English key -> the key itself (never blank/crash)
// ============================================================

import { Injectable, signal } from '@angular/core';
import {
  LanguageCode,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  LANGUAGE_META,
  TRANSLATIONS,
  TranslationCatalog,
} from '../i18n';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly language = signal<LanguageCode>(this.loadInitialLanguage());

  constructor() {
    this.applyDocument();
  }

  /** Current language code ('en' | 'ar'). */
  lang(): LanguageCode {
    return this.language();
  }

  /** Current text direction derived from the active language. */
  dir(): 'ltr' | 'rtl' {
    return LANGUAGE_META[this.lang()].dir;
  }

  /** Whether Arabic (RTL) is active. */
  isArabic(): boolean {
    return this.lang() === 'ar';
  }

  /** Translate a dot-key with optional `{param}` interpolation. */
  translate(key: string, params?: Record<string, string | number>): string {
    const active = this.language();
    const catalog = TRANSLATIONS[active] ?? TRANSLATIONS[DEFAULT_LANGUAGE];

    // Prefer the active catalog, then fall back to English.
    let value = catalog[key] ?? TRANSLATIONS[DEFAULT_LANGUAGE][key] ?? key;

    if (params) {
      for (const [name, raw] of Object.entries(params)) {
        value = value.split(`{${name}}`).join(String(raw));
      }
    }
    return value;
  }

  /** Interpolation-aware helper exposed for pipes/TS call sites. */
  t(key: string, params?: Record<string, string | number>): string {
    return this.translate(key, params);
  }

  /** Switch language at runtime, persist, and update <html lang>/<dir>. */
  setLanguage(lang: LanguageCode): void {
    if (!SUPPORTED_LANGUAGES.includes(lang) || lang === this.lang()) {
      return;
    }
    this.language.set(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore storage failures (e.g. privacy mode); still switch in-memory.
    }
    this.applyDocument();
  }

  /** Toggle English <-> Arabic. Returns the new language. */
  toggle(): LanguageCode {
    const next: LanguageCode = this.lang() === 'ar' ? 'en' : 'ar';
    this.setLanguage(next);
    return next;
  }

  /** Reset to the default language (English). */
  reset(): void {
    this.setLanguage(DEFAULT_LANGUAGE);
  }

  private loadInitialLanguage(): LanguageCode {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // Ignore storage access failures; default to English.
    }
    return saved === 'ar' ? 'ar' : DEFAULT_LANGUAGE;
  }

  private applyDocument(): void {
    const meta = LANGUAGE_META[this.lang()];
    const el = document.documentElement;
    el.setAttribute('lang', this.lang());
    el.setAttribute('dir', meta.dir);
  }
}

/** Create an empty catalog helper for type-safe partial overrides. */
export function catalog(pairs: TranslationCatalog): TranslationCatalog {
  return pairs;
}
