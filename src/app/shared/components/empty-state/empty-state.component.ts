// ============================================================
// TPMS — EmptyState Component
// ============================================================
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="empty-state" [class.empty-state--page]="isPage">
      <div class="empty-state__icon-wrap" [class]="'empty-state__icon-wrap--' + variant">
        <mat-icon class="empty-state__icon">{{ icon }}</mat-icon>
      </div>
      <div class="empty-state__badge" *ngIf="badge">
        <span>{{ badge }}</span>
      </div>
      <h2 class="empty-state__title">{{ title }}</h2>
      <p class="empty-state__description">{{ description }}</p>
      <div class="empty-state__actions">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--space-12) var(--space-6);
      gap: var(--space-4);
      animation: fadeIn 0.4s ease both;

      &--page {
        min-height: 60vh;
        padding: var(--space-16) var(--space-6);
      }

      &__icon-wrap {
        width: 80px; height: 80px;
        border-radius: var(--radius-2xl);
        display: flex; align-items: center; justify-content: center;
        margin-bottom: var(--space-2);
        position: relative;

        &--primary   { background: var(--primary-50);   }
        &--success   { background: var(--success-light); }
        &--warning   { background: var(--warning-light); }
        &--neutral   { background: var(--border-subtle); }
        &--coming    { background: linear-gradient(135deg, var(--primary-50) 0%, var(--info-light) 100%); }
      }

      &__icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: var(--primary);

        .empty-state__icon-wrap--success & { color: var(--success); }
        .empty-state__icon-wrap--warning & { color: var(--warning); }
        .empty-state__icon-wrap--neutral & { color: var(--text-tertiary); }
      }

      &__badge {
        display: inline-flex;
        align-items: center;
        padding: 6px 16px;
        background: linear-gradient(135deg, var(--primary-50), var(--info-light));
        border: 1px solid var(--primary-100);
        border-radius: var(--radius-full);
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        color: var(--primary);
        letter-spacing: 0.5px;
        text-transform: uppercase;
        animation: badgePop 0.5s ease 0.2s both;
      }

      &__title {
        font-size: var(--text-xl);
        font-weight: var(--weight-medium);
        color: var(--text-primary);
        margin: 0;
        letter-spacing: -0.01em;
      }

      &__description {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        margin: 0;
        max-width: 480px;
        line-height: var(--leading-relaxed);
      }

      &__actions {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-top: var(--space-2);
        flex-wrap: wrap;
        justify-content: center;
      }
    }

    // Dark mode adjustments
    :host-context([data-theme="dark"]) .empty-state {
      &__icon-wrap {
        &--primary   { background: rgba(99, 102, 241, 0.15); }
        &--success   { background: rgba(16, 185, 129, 0.15); }
        &--warning   { background: rgba(245, 158, 11, 0.15); }
        &--neutral   { background: rgba(255, 255, 255, 0.05); }
      }
      &__icon {
        .empty-state__icon-wrap--success & { color: #10B981; }
        .empty-state__icon-wrap--warning & { color: #F59E0B; }
        .empty-state__icon-wrap--neutral & { color: var(--text-secondary); }
      }
    }
  `],
})
export class EmptyStateComponent {
  @Input() icon:        string  = 'inbox';
  @Input() title:       string  = 'Nothing here yet';
  @Input() description: string  = '';
  @Input() badge?:      string;
  @Input() variant:     'primary' | 'success' | 'warning' | 'neutral' | 'coming' = 'primary';
  @Input() isPage:      boolean = false;
}
