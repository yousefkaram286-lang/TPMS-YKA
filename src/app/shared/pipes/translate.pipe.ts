// ============================================================
// TPMS — Translate Pipe
// ------------------------------------------------------------
// Convenience pipe for standalone components:
//   {{ 'nav.dashboard' | translate }}
//   {{ 'users.success.deactivated' | translate: { name: user } }}
//
// Marks as impure so it re-evaluates whenever change detection
// runs after a language switch. Falls back to English, then to
// the key itself, via TranslationService (never blank).
// ============================================================

import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly translation = inject(TranslationService);

  transform(key: string, params?: Record<string, string | number>): string {
    return this.translation.translate(key, params);
  }
}
