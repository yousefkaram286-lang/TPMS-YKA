// ============================================================
// TPMS — PageHeader Component
// ============================================================
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

export interface Breadcrumb {
  label: string;
  route?: string;
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterModule],
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <div class="page-header__meta">
          <nav *ngIf="breadcrumbs.length" class="breadcrumbs" aria-label="Breadcrumb">
            <ol>
              <li *ngFor="let crumb of breadcrumbs; let last = last">
                <a *ngIf="crumb.route && !last" [routerLink]="crumb.route">{{ crumb.label }}</a>
                <span *ngIf="!crumb.route || last" [class.current]="last">{{ crumb.label }}</span>
                <mat-icon *ngIf="!last" class="separator">chevron_right</mat-icon>
              </li>
            </ol>
          </nav>
          <div class="page-header__title-row">
            <div class="page-header__icon-wrap" *ngIf="icon">
              <mat-icon>{{ icon }}</mat-icon>
            </div>
            <div>
              <h1 class="page-header__title">{{ title }}</h1>
              <p *ngIf="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
            </div>
          </div>
        </div>
        <div class="page-header__actions">
          <ng-content select="[actions]"></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      margin-bottom: var(--space-8);

      &__content {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
      }

      &__title-row {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        margin-top: var(--space-2);
      }

      &__icon-wrap {
        width: 48px; height: 48px;
        border-radius: var(--radius-lg);
        background: var(--primary-50);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;

        mat-icon {
          color: var(--primary);
          font-size: 24px;
          width: 24px; height: 24px;
        }

        :host-context([data-theme="dark"]) & {
          background: rgba(99, 102, 241, 0.15);
        }
      }

      &__title {
        font-family: var(--font-display);
        font-size: var(--text-2xl);
        font-weight: var(--weight-bold);
        color: var(--text-primary);
        margin: 0;
        line-height: var(--leading-tight);
        letter-spacing: -0.5px;
      }

      &__subtitle {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        margin: 4px 0 0;
      }

      &__actions {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-shrink: 0;
      }
    }

    .breadcrumbs ol {
      display: flex;
      align-items: center;
      gap: 2px;
      list-style: none;
      margin: 0 0 4px;
      padding: 0;

      li {
        display: flex;
        align-items: center;
        gap: 2px;

        a {
          font-size: var(--text-xs);
          color: var(--primary-light);
          text-decoration: none;
          font-weight: var(--weight-medium);
          &:hover { text-decoration: underline; }
        }

        span {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          &.current { color: var(--text-secondary); font-weight: var(--weight-medium); }
        }

        .separator {
          font-size: 14px; width: 14px; height: 14px;
          color: var(--text-tertiary);
        }
      }
    }
  `],
})
export class PageHeaderComponent {
  @Input() title:       string       = '';
  @Input() subtitle?:   string;
  @Input() icon?:       string;
  @Input() breadcrumbs: Breadcrumb[] = [];
}
