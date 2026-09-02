// ============================================================
// TPMS — AppCard Component
// ============================================================
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card" [class.card--hoverable]="hoverable" [class.card--flat]="flat" [class.card--compact]="compact">
      <div *ngIf="title || headerSlot" class="card__header">
        <div class="card__header-left">
          <h3 *ngIf="title" class="card__title">{{ title }}</h3>
          <p *ngIf="subtitle" class="card__subtitle">{{ subtitle }}</p>
        </div>
        <div class="card__header-right">
          <ng-content select="[cardHeader]"></ng-content>
        </div>
      </div>
      <div class="card__body">
        <ng-content></ng-content>
      </div>
      <div class="card__footer" *ngIf="hasFooter">
        <ng-content select="[cardFooter]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: var(--surface);
      border-radius: var(--radius-xl);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      position: relative;
      transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
      animation: fadeSlideUp 0.4s cubic-bezier(0.215, 0.61, 0.355, 1) both;

      &--hoverable:hover {
        box-shadow: var(--shadow-lg), 0 16px 40px rgb(109 93 246 / 0.12);
        transform: translateY(-2px);
        border-color: var(--primary-100);
      }

      &--flat {
        box-shadow: none;
        background: transparent;
        border-color: var(--border);
      }

      &--compact .card__body { padding: var(--space-4); }

      &__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4);
        padding: var(--space-5) var(--space-6) 0;
      }

      &__title {
        font-family: var(--font-display);
        font-size: var(--text-base);
        font-weight: var(--weight-medium);
        color: var(--text-primary);
        margin: 0;
        line-height: var(--leading-snug);
        letter-spacing: -0.01em;
      }

      &__subtitle {
        font-size: var(--text-sm);
        color: var(--text-tertiary);
        margin: 4px 0 0;
      }

      &__body { padding: var(--space-5) var(--space-6) var(--space-6); }

      &__footer {
        padding: var(--space-4) var(--space-6);
        border-top: 1px solid var(--border-subtle);
        background: var(--surface-alt);
      }
    }

    // Dark mode adjustments
    :host-context([data-theme="dark"]) .card {
      border: 1px solid rgba(255, 255, 255, 0.05);
      
      &--hoverable:hover {
        border-color: var(--primary-100);
        box-shadow: var(--shadow-lg), 0 16px 40px rgba(0, 0, 0, 0.4);
      }
    }
  `],
})
export class AppCardComponent {
  @Input() title?:     string;
  @Input() subtitle?:  string;
  @Input() hoverable:  boolean = false;
  @Input() flat:       boolean = false;
  @Input() compact:    boolean = false;
  @Input() hasFooter:  boolean = false;
  headerSlot = false;
}
