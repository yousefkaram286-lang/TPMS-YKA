// ============================================================
// TPMS — ConfirmDialog Component (UI shell)
// ============================================================
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title:       string;
  message:     string;
  confirmText?: string;
  cancelText?:  string;
  variant?:     'danger' | 'warning' | 'info';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <div class="confirm-dialog__header" [class]="'confirm-dialog__header--' + (data.variant || 'info')">
        <div class="confirm-dialog__icon">
          <mat-icon>{{ iconMap[data.variant || 'info'] }}</mat-icon>
        </div>
        <h2 class="confirm-dialog__title">{{ data.title }}</h2>
      </div>

      <div class="confirm-dialog__body">
        <p>{{ data.message }}</p>
      </div>

      <div class="confirm-dialog__footer">
        <button class="btn-secondary btn-sm" (click)="onCancel()">
          {{ data.cancelText || 'Cancel' }}
        </button>
        <button
          [class]="(data.variant === 'danger' ? 'btn-danger' : 'btn-primary') + ' btn-sm'"
          (click)="onConfirm()"
        >
          {{ data.confirmText || 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      min-width: 360px;
      max-width: 480px;
      animation: scaleIn 0.3s cubic-bezier(0.19, 1, 0.22, 1) both;

      &__header {
        padding: var(--space-5) var(--space-6);
        display: flex;
        align-items: center;
        gap: var(--space-3);
        border-bottom: 1px solid var(--border);

        &--danger .confirm-dialog__icon { background: var(--error-light); color: var(--error); }
        &--warning .confirm-dialog__icon { background: var(--warning-light); color: var(--warning); }
        &--info .confirm-dialog__icon { background: var(--info-light); color: var(--accent); }
      }

      &__icon {
        width: 36px; height: 36px;
        border-radius: var(--radius-md);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }

      &__title {
        font-size: var(--text-base);
        font-weight: var(--weight-medium);
        color: var(--text-primary);
        margin: 0;
        letter-spacing: -0.01em;
      }

      &__body {
        padding: var(--space-5) var(--space-6);
        p {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin: 0;
          line-height: var(--leading-relaxed);
        }
      }

      &__footer {
        padding: var(--space-4) var(--space-6);
        border-top: 1px solid var(--border-subtle);
        display: flex;
        justify-content: flex-end;
        gap: var(--space-3);
        background: var(--surface-alt);
      }
    }

    // Dark mode adjustments
    :host-context([data-theme="dark"]) .confirm-dialog {
      &__header {
        &--danger .confirm-dialog__icon { background: rgba(239, 68, 68, 0.15); color: #EF4444; }
        &--warning .confirm-dialog__icon { background: rgba(245, 158, 11, 0.15); color: #F59E0B; }
        &--info .confirm-dialog__icon { background: rgba(56, 189, 248, 0.15); color: #38BDF8; }
      }
    }
  `],
})
export class ConfirmDialogComponent {
  iconMap: Record<string, string> = {
    danger:  'warning',
    warning: 'info',
    info:    'help_outline',
  };

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
  ) {}

  onConfirm(): void { this.dialogRef.close(true);  }
  onCancel():  void { this.dialogRef.close(false); }
}
