import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OutputRelease } from '../../core/models/output-release.model';

@Component({
  selector: 'app-output-release-details-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Output Release Details</h2>
    <mat-dialog-content>

      <!-- Legacy provenance banner -->
      <div class="legacy-banner" *ngIf="data.record.dataSource === 'LEGACY_AMBIGUOUS_SESSION'">
        <mat-icon>history</mat-icon>
        <div>
          <strong>Legacy Migrated Record</strong>
          <p>This record was migrated from a legacy production session. Product attribution is unknown.
             Source session: <code>{{ data.record.legacySessionId }}</code></p>
        </div>
      </div>

      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">Release Date</span>
          <span class="detail-value font-medium">{{ data.record.releaseDate | date:'mediumDate' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Quantity Released</span>
          <span class="detail-value font-medium qty-value">{{ data.record.releasedQuantity | number }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Product</span>
          <span class="detail-value" *ngIf="data.productName">{{ data.productName }}</span>
          <span class="detail-value text-tertiary" *ngIf="!data.productName">
            {{ data.record.dataSource === 'LEGACY_AMBIGUOUS_SESSION' ? 'Unknown (legacy — ambiguous)' : 'Not specified' }}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Production Line</span>
          <span class="detail-value" *ngIf="data.lineName">{{ data.lineName }}</span>
          <span class="detail-value text-tertiary" *ngIf="!data.lineName">Not specified</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Data Source</span>
          <span class="detail-value provenance"
            [class.provenance--manual]="data.record.dataSource === 'MANUAL_ENTRY'"
            [class.provenance--legacy]="data.record.dataSource === 'LEGACY_AMBIGUOUS_SESSION'">
            {{ data.record.dataSource === 'MANUAL_ENTRY' ? 'Manual Entry' : 'Legacy (Ambiguous Session)' }}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Recorded At</span>
          <span class="detail-value text-sm">{{ data.record.createdAt | date:'medium' }}</span>
        </div>
        <div class="detail-item full-width" *ngIf="data.record.notes">
          <span class="detail-label">Notes</span>
          <span class="detail-value">{{ data.record.notes }}</span>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .legacy-banner {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-5);
      color: var(--warning-dark);

      mat-icon { margin-top: 2px; flex-shrink: 0; font-size: 20px; width: 20px; height: 20px; }
      p { margin: 4px 0 0; font-size: var(--text-xs); color: var(--text-secondary); }
      strong { font-size: var(--text-sm); }
      code { font-family: monospace; font-size: 11px; background: rgba(0,0,0,0.08); padding: 1px 4px; border-radius: 3px; }
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-4);
      background: var(--surface-alt);
      padding: var(--space-5);
      border-radius: var(--radius-md);
    }

    .detail-item { display: flex; flex-direction: column; gap: 4px; }
    .full-width { grid-column: span 2; }

    .detail-label {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      font-weight: var(--weight-medium);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .detail-value {
      font-size: var(--text-sm);
      color: var(--text-primary);
    }

    .font-medium { font-weight: var(--weight-medium); }
    .text-tertiary { color: var(--text-tertiary); font-style: italic; }
    .text-sm { font-size: var(--text-xs); }

    .qty-value {
      font-size: var(--text-lg);
      color: var(--primary);
    }

    .provenance {
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      display: inline-block;
    }
    .provenance--manual {
      background: rgba(16, 185, 129, 0.12);
      color: var(--success-dark, #065f46);
    }
    .provenance--legacy {
      background: rgba(245, 158, 11, 0.12);
      color: var(--warning-dark, #92400e);
    }
  `]
})
export class OutputReleaseDetailsDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {
      record: OutputRelease;
      productName?: string;
      lineName?: string;
    }
  ) {}
}
