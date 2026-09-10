// ============================================================
// TPMS — Language Switcher
// ------------------------------------------------------------
// Compact control to switch English (LTR) / العربية (RTL) at
// runtime. Reused by the authenticated header and the Login
// screen (so language can be chosen before authentication).
// ============================================================

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      class="lang-switcher"
      [matTooltip]="translation.translate('language.switch')"
      matTooltipPosition="below"
      [attr.aria-label]="translation.translate('language.switch')"
      (click)="translation.toggle()"
    >
      <mat-icon class="lang-switcher__icon">language</mat-icon>
      <span class="lang-switcher__label">{{ translation.isArabic() ? 'EN' : 'ع' }}</span>
    </button>
  `,
  styles: [
    `
      .lang-switcher {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border: 1px solid var(--tpms-border, rgba(255, 255, 255, 0.15));
        border-radius: 8px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        line-height: 1;
        transition: background-color 0.2s ease, border-color 0.2s ease;
        user-select: none;
      }
      .lang-switcher:hover {
        background: rgba(128, 128, 128, 0.12);
        border-color: rgba(128, 128, 128, 0.35);
      }
      .lang-switcher__icon {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }
      .lang-switcher__label {
        min-width: 16px;
        text-align: center;
      }
    `,
  ],
})
export class LanguageSwitcherComponent {
  readonly translation = inject(TranslationService);
}
