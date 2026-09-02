import { Component, Inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { Production } from '../../core/models/production.model';
import { ProductionSession } from '../../core/models/production-session.model';

export interface ProductionViewDialogData {
  record: Production;
  session: ProductionSession | null;
  productName: string;
  lineName: string;
  shiftName: string;
  machineName: string;
}

@Component({
  selector: 'app-production-view-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, StatusBadgeComponent],
  template: `
    <div class="dialog-wrapper">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon class="title-icon">precision_manufacturing</mat-icon>
        Production Record
      </h2>

      <mat-dialog-content class="dialog-content">

        <!-- Section A: Production Information -->
        <div class="section">
          <div class="section-label">Production Information</div>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">Date</span>
              <span class="detail-value">{{ data.record.date | date:'mediumDate' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Shift</span>
              <span class="detail-value">{{ data.shiftName }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Line</span>
              <span class="detail-value">{{ data.lineName }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Machine</span>
              <span class="detail-value">{{ data.machineName || '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Supervisor</span>
              <span class="detail-value">{{ data.record.supervisor }}</span>
            </div>
          </div>
        </div>

        <!-- Section B: Production Output -->
        <div class="section">
          <div class="section-label">Production Output</div>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">Product</span>
              <span class="detail-value font-medium">{{ data.productName }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Pieces / Press</span>
              <span class="detail-value">{{ data.record.piecesPerPress }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Presses</span>
              <span class="detail-value">{{ data.record.presses }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Produced</span>
              <span class="detail-value produced-value">{{ data.record.produced | number }}</span>
            </div>
            <div class="detail-item" *ngIf="data.session && data.session.releasedOutput != null">
              <span class="detail-label">Released Output</span>
              <span class="detail-value released-value">{{ data.session.releasedOutput | number }}</span>
            </div>
          </div>
        </div>

        <!-- Section C: Overtime (if session exists) -->
        <div class="section" *ngIf="data.session">
          <div class="section-label">Overtime</div>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">Overtime</span>
              <div class="detail-value">
                <app-status-badge
                  [label]="data.session.overtime ? 'Yes' : 'No'"
                  [variant]="data.session.overtime ? 'warning' : 'neutral'"
                  size="sm">
                </app-status-badge>
              </div>
            </div>
            <div class="detail-item" *ngIf="data.session.overtime">
              <span class="detail-label">Overtime Hours</span>
              <span class="detail-value">{{ data.session.overtimeHours }} hrs</span>
            </div>
          </div>
        </div>

        <!-- Section D: Daily Line Time (if session exists and has entries) -->
        <div class="section" *ngIf="data.session && data.session.dailyLineTime && data.session.dailyLineTime.length > 0">
          <div class="section-label">Daily Line Time</div>
          <div class="line-time-list">
            <div class="line-time-entry"
              *ngFor="let entry of data.session.dailyLineTime"
              [class.has-downtime]="entry.downtimeMinutes > 0">
              <div class="entry-line-name">
                <mat-icon class="entry-icon">route</mat-icon>
                {{ entry.lineName || entry.lineId }}
              </div>
              <div class="entry-details">
                <div class="entry-detail" *ngIf="entry.overtimeHours > 0">
                  <span class="entry-label">Overtime:</span>
                  <span class="entry-val overtime-val">{{ entry.overtimeHours }} hrs</span>
                </div>
                <div class="entry-detail" *ngIf="entry.downtimeMinutes > 0">
                  <span class="entry-label">Downtime:</span>
                  <span class="entry-val downtime-val">{{ entry.downtimeMinutes }} min</span>
                </div>
                <div class="entry-detail" *ngIf="entry.downtimeReason">
                  <span class="entry-label">Reason:</span>
                  <span class="entry-val">{{ entry.downtimeReason }}</span>
                </div>
                <div class="entry-detail" *ngIf="entry.notes">
                  <span class="entry-label">Notes:</span>
                  <span class="entry-val notes-val">{{ entry.notes }}</span>
                </div>
                <div class="entry-detail no-events" *ngIf="entry.overtimeHours === 0 && entry.downtimeMinutes === 0 && !entry.notes">
                  No events recorded
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Session Notes -->
        <div class="section" *ngIf="data.session?.notes">
          <div class="section-label">Notes</div>
          <p class="notes-text">{{ data.session!.notes }}</p>
        </div>

        <!-- No session data for legacy records -->
        <div class="legacy-notice" *ngIf="!data.session">
          <mat-icon>info</mat-icon>
          <span>Extended operational data is not available for this legacy record.</span>
        </div>

      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-wrapper { min-width: 520px; max-width: 700px; }

    .dialog-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-lg) !important;
      font-weight: var(--weight-semibold) !important;
      color: var(--text-primary) !important;
      margin: 0 !important;
      padding: var(--space-5) var(--space-6) !important;
    }

    .title-icon {
      color: var(--primary);
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .dialog-content {
      padding: 0 var(--space-6) var(--space-4) !important;
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .section-label {
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--border-subtle);
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--space-3) var(--space-4);
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .detail-label {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      font-weight: var(--weight-medium);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .detail-value {
      font-size: var(--text-sm);
      color: var(--text-primary);
    }

    .font-medium { font-weight: var(--weight-medium); }

    .produced-value {
      font-weight: var(--weight-semibold);
      color: var(--primary);
    }

    .released-value {
      font-weight: var(--weight-semibold);
      color: var(--success, #16a34a);
    }

    /* Line Time */
    .line-time-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .line-time-entry {
      background: var(--surface-alt);
      border-radius: var(--radius-md);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--border-subtle);

      &.has-downtime {
        border-color: rgba(245, 158, 11, 0.3);
        background: var(--warning-light, rgba(245, 158, 11, 0.05));
      }
    }

    .entry-line-name {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      color: var(--text-primary);
      margin-bottom: var(--space-2);
    }

    .entry-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--text-tertiary);
    }

    .entry-details {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-4);
    }

    .entry-detail {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .entry-label {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      font-weight: var(--weight-medium);
    }

    .entry-val {
      font-size: var(--text-xs);
      color: var(--text-primary);
    }

    .overtime-val {
      color: var(--primary);
      font-weight: var(--weight-medium);
    }

    .downtime-val {
      color: var(--warning-dark, #b45309);
      font-weight: var(--weight-medium);
    }

    .notes-val {
      font-style: italic;
    }

    .no-events {
      color: var(--text-tertiary);
      font-style: italic;
    }

    .notes-text {
      font-size: var(--text-sm);
      color: var(--text-primary);
      background: var(--surface-alt);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      margin: 0;
      line-height: 1.6;
      border: 1px solid var(--border-subtle);
    }

    .legacy-notice {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: var(--surface-alt);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      border: 1px solid var(--border-subtle);

      mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-tertiary); }
    }
  `]
})
export class ProductionViewDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ProductionViewDialogData,
    private dialogRef: MatDialogRef<ProductionViewDialogComponent>
  ) {}
}
