import { TestBed } from '@angular/core/testing';

import { TranslatePipe } from './translate.pipe';
import { TranslationService } from '../../core/services/translation.service';
import { LANGUAGE_STORAGE_KEY } from '../../core/i18n';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let service: TranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TranslationService);
    pipe = TestBed.runInInjectionContext(() => new TranslatePipe());
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  });

  afterEach(() => {
    document.documentElement.setAttribute('lang', 'en');
    document.documentElement.setAttribute('dir', 'ltr');
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  });

  it('translates a key in English', () => {
    expect(pipe.transform('nav.dashboard')).toBe('Dashboard');
  });

  it('translates a key in Arabic after switch', () => {
    service.setLanguage('ar');
    expect(pipe.transform('nav.dashboard')).toBe('لوحة التحكم');
  });

  it('supports interpolation', () => {
    expect(pipe.transform('users.action.deactivateFor', { name: 'Sara' })).toBe('Deactivate Sara');
  });

  it('falls back to English when Arabic key is missing', () => {
    service.setLanguage('ar');
    expect(pipe.transform('users.count.accounts')).toBe('accounts');
  });
});