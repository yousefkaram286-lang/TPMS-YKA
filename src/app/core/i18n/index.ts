// ============================================================
// TPMS — i18n catalog aggregator / types
// ============================================================

import { TranslationCatalog, EN } from './en';
import { AR } from './ar';

export type LanguageCode = 'en' | 'ar';

export type { TranslationCatalog } from './en';

export const TRANSLATIONS: Record<LanguageCode, TranslationCatalog> = {
  en: EN,
  ar: AR,
};

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
export const LANGUAGE_STORAGE_KEY = 'tpms.language';
export const SUPPORTED_LANGUAGES: LanguageCode[] = ['en', 'ar'];

export const LANGUAGE_META: Record<LanguageCode, { dir: 'ltr' | 'rtl'; labelKey: string }> = {
  en: { dir: 'ltr', labelKey: 'language.en' },
  ar: { dir: 'rtl', labelKey: 'language.ar' },
};
