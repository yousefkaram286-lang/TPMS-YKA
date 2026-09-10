import { TestBed } from '@angular/core/testing';

import { TranslationService } from './translation.service';
import { LANGUAGE_STORAGE_KEY } from '../i18n';

describe('TranslationService', () => {
  const originalLang = document.documentElement.lang;
  const originalDir = document.documentElement.dir;

  beforeEach(() => {
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  });

  afterEach(() => {
    document.documentElement.setAttribute('lang', originalLang);
    document.documentElement.setAttribute('dir', originalDir);
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  });

  function setup(): TranslationService {
    TestBed.resetTestingModule();
    return TestBed.inject(TranslationService);
  }

  it('defaults to English', () => {
    const service = setup();
    expect(service.lang()).toBe('en');
    expect(service.isArabic()).toBeFalse();
    expect(service.translate('nav.dashboard')).toBe('Dashboard');
  });

  it('English applies dir=ltr', () => {
    const service = setup();
    expect(service.dir()).toBe('ltr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('switching to Arabic applies dir=rtl and lang=ar', () => {
    const service = setup();
    service.setLanguage('ar');
    expect(service.lang()).toBe('ar');
    expect(service.dir()).toBe('rtl');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
  });

  it('persists the selected language in localStorage', () => {
    const service = setup();
    service.setLanguage('ar');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ar');
  });

  it('restores a saved preference on startup', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ar');
    const service = setup();
    expect(service.lang()).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('falls back to English when an Arabic key is missing', () => {
    const service = setup();
    service.setLanguage('ar');
    // 'nav.production' exists in both; 'users.col.user' exists in AR.
    expect(service.translate('nav.production')).toBe('الإنتاج');
    // 'users.count.accounts' exists only in EN -> English fallback.
    expect(service.translate('users.count.accounts')).toBe('accounts');
  });

  it('echoes the key when a key is missing from every catalog', () => {
    const service = setup();
    expect(service.translate('no.such.key.anywhere')).toBe('no.such.key.anywhere');
  });

  it('supports parameter interpolation', () => {
    const service = setup();
    expect(service.translate('users.action.deactivateFor', { name: 'Ahmed' })).toBe('Deactivate Ahmed');
  });

  it('switching language updates runtime output without re-instantiating', () => {
    const service = setup();
    expect(service.translate('nav.dashboard')).toBe('Dashboard');
    service.setLanguage('ar');
    expect(service.translate('nav.dashboard')).toBe('لوحة التحكم');
    service.setLanguage('en');
    expect(service.translate('nav.dashboard')).toBe('Dashboard');
  });

  it('toggle flips between languages', () => {
    const service = setup();
    expect(service.toggle()).toBe('ar');
    expect(service.toggle()).toBe('en');
  });

  it('ignores unknown language codes', () => {
    const service = setup();
    service.setLanguage('fr' as any);
    expect(service.lang()).toBe('en');
  });
});