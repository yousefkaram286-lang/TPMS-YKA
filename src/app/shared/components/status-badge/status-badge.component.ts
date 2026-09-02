// ============================================================
// TPMS — StatusBadge Component
// ============================================================
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';
export type BadgeSize    = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <span
      class="badge"
      [class]="'badge--' + variant + ' badge--' + size"
    >
      <mat-icon *ngIf="icon" class="badge__icon">{{ icon }}</mat-icon>
      <span class="badge__dot" *ngIf="showDot && !icon"></span>
      {{ label }}
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: var(--radius-full);
      font-family: var(--font-sans);
      font-weight: var(--weight-medium);
      line-height: 1;
      white-space: nowrap;

      &--sm  { padding: 2px 6px;  font-size: 10px; }
      &--md  { padding: 4px 8px; font-size: 11px; }
      &--lg  { padding: 6px 12px; font-size: 12px; }

      &--success { background: var(--success-light); color: var(--success-dark); }
      &--warning { background: var(--warning-light); color: var(--warning-dark); }
      &--error   { background: var(--error-light);   color: var(--error-dark);   }
      &--info    { background: var(--info-light);     color: var(--accent-dark);  }
      &--primary { background: var(--primary-100);   color: var(--primary);      }
      &--neutral { background: var(--surface-alt);    color: var(--text-secondary);}

      .badge__icon {
        font-size: 12px;
        width: 12px;
        height: 12px;
      }

      .badge__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        flex-shrink: 0;
      }
    }

    // Dark mode adjustments
    :host-context([data-theme="dark"]) .badge {
      &--success { background: rgba(16, 185, 129, 0.15); color: #10B981; }
      &--warning { background: rgba(245, 158, 11, 0.15); color: #F59E0B; }
      &--error   { background: rgba(239, 68, 68, 0.15); color: #EF4444;   }
      &--info    { background: rgba(56, 189, 248, 0.15); color: #38BDF8;  }
      &--primary { background: rgba(99, 102, 241, 0.15); color: #6366F1;      }
      &--neutral { background: var(--surface-alt);    color: var(--text-secondary);}
    }
  `],
})
export class StatusBadgeComponent {
  @Input() label:   string        = '';
  @Input() variant: BadgeVariant  = 'neutral';
  @Input() size:    BadgeSize     = 'md';
  @Input() icon?:   string;
  @Input() showDot: boolean       = false;
}
