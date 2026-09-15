import { TestBed } from '@angular/core/testing';
import { TranslationService } from '../services/translation.service';
import { displayServiceMessage } from './service-message-keys';

describe('operational message display mapping', () => {
  it('translates a known service error in Arabic without changing its source', () => {
    const source = 'Negative press count is not allowed.';
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    expect(displayServiceMessage(source, translation)).toBe(translation.t('production.error.negativePresses'));
    expect(source).toBe('Negative press count is not allowed.');
    translation.setLanguage('en');
    expect(displayServiceMessage(source, translation)).toBe(translation.t('production.error.negativePresses'));
  });

  it('preserves unknown server errors', () => {
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    expect(displayServiceMessage('unknown external error', translation)).toBe('unknown external error');
    translation.setLanguage('en');
  });
});
