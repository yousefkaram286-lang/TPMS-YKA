import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { QualityTest, QualitySample } from '../../core/models/quality-test.model';
import { QualityCalculationUtil } from '../../core/utils/quality-calculation.util';

@Component({
  selector: 'app-quality-details-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, StatusBadgeComponent],
  template: `
    <h2 mat-dialog-title>Quality Test Details</h2>
    <mat-dialog-content>
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">Product:</span>
          <span class="detail-value font-medium text-primary">{{ data.record.productName }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Production Line:</span>
          <span class="detail-value">{{ data.record.lineName || 'Not specified' }}</span>
        </div>
        <div class="detail-item" *ngIf="data.record.date">
          <span class="detail-label">Date:</span>
          <span class="detail-value">{{ data.record.date | date:'shortDate' }}</span>
        </div>
        <div class="detail-item" *ngIf="data.record.productionRecordId || data.record.productionDate">
          <span class="detail-label">Production Reference:</span>
          <span class="detail-value">
            <span *ngIf="data.record.productionRecordId">{{ data.record.productionRecordId }}</span>
            <span *ngIf="data.record.productionDate">{{ data.record.productionDate }}</span>
          </span>
        </div>
        <div class="detail-item" *ngIf="data.record.samples?.length">
          <span class="detail-label">Product Area (cm²):</span>
          <span class="detail-value font-medium">{{ data.record.productAreaSnapshot ?? '—' }}</span>
        </div>
        <div class="detail-item" *ngIf="data.record.samples?.length">
          <span class="detail-label">Compression Standard (kg/cm²):</span>
          <span class="detail-value font-medium">{{ data.record.compressionStandardSnapshot ?? '—' }}</span>
        </div>
      </div>

      <!-- Sample measurements -->
      <div class="block" *ngIf="data.record.samples?.length">
        <div class="block-title">Samples ({{ data.record.samples?.length }})</div>
        <div class="table-responsive">
          <table class="samples-table">
            <thead>
              <tr>
                <th>Sample</th>
                <th>Act Ht</th>
                <th>Act Wt (kg)</th>
                <th>Std Wt (kg)</th>
                <th>Wt Diff (kg)</th>
                <th>Load (kg)</th>
                <th>Compression (kg/cm²)</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of data.record.samples; let i = index">
                <td class="sample-label">Sample {{ i + 1 }}</td>
                <td>{{ s.actualHeight }}</td>
                <td>{{ s.actualWeight }}</td>
                <td class="snapshot">{{ data.record.standardWeightSnapshot ?? '—' }}</td>
                <td>{{ s.weightDifference ?? '—' }}</td>
                <td>{{ s.load }}</td>
                <td class="compression">{{ s.compression }}</td>
                <td>
                  <app-status-badge
                    [label]="s.compressionResult"
                    [variant]="s.compressionResult === 'PASS' ? 'success' : s.compressionResult === 'FAIL' ? 'error' : 'warning'"
                    [icon]="s.compressionResult === 'PASS' ? 'check_circle' : s.compressionResult === 'FAIL' ? 'cancel' : 'help'"
                    size="sm">
                  </app-status-badge>
                </td>
              </tr>
              <tr class="averages-row" *ngIf="(data.record.samples?.length ?? 0) === 3">
                <td class="sample-label">AVERAGE (this test event)</td>
                <td>{{ avg.height }}</td>
                <td>{{ avg.weight }}</td>
                <td></td>
                <td>{{ avg.weightDiff }}</td>
                <td>{{ avg.load }}</td>
                <td>
                  <span *ngIf="avg.compression != null">{{ avg.compression }}</span>
                  <span *ngIf="avg.compression == null" class="no-result">CONFIGURATION REQUIRED</span>
                </td>
                <td class="avg-note">PASS/FAIL not averaged</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="block" *ngIf="!data.record.samples?.length">
        <div class="block-title">Legacy measurement</div>
        <div class="details-grid legacy-grid">
          <div class="detail-item">
            <span class="detail-label">Load (kg):</span>
            <span class="detail-value font-medium">{{ data.record.load ?? '—' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Compression (kg/cm²):</span>
            <span class="detail-value font-medium">{{ data.record.compression ?? (data.record.strength ?? '—') }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Result:</span>
            <span class="detail-value font-medium">{{ data.record.result ?? '—' }}</span>
          </div>
        </div>
      </div>

      <div class="block" *ngIf="data.record.notes">
        <div class="block-title">Notes</div>
        <div class="notes-text">{{ data.record.notes }}</div>
      </div>

      <div class="mt-2 text-tertiary text-xs" *ngIf="data.record.decisionSource">
        Decision source: {{ data.record.decisionSource.replace('_', ' ') }}
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-4);
      margin-bottom: var(--space-4);
      background: var(--surface-alt);
      padding: var(--space-4);
      border-radius: var(--radius-md);
    }

    .legacy-grid { margin-bottom: 0; }

    .detail-item { display: flex; flex-direction: column; }
    .detail-label {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      font-weight: var(--weight-medium);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .detail-value { font-size: var(--text-sm); color: var(--text-primary); margin-top: 4px; }

    .block { margin-bottom: var(--space-4); }
    .block-title {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      font-weight: var(--weight-medium);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .samples-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);
    }
    .samples-table th {
      padding: 8px;
      text-align: left;
      background: var(--surface-alt);
      color: var(--text-tertiary);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .samples-table td {
      padding: 8px;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-primary);
    }
    .sample-label { font-weight: var(--weight-medium); color: var(--text-secondary); white-space: nowrap; }
    .snapshot { color: var(--text-secondary); }
    .compression { font-weight: var(--weight-medium); }
    .averages-row td {
      border-top: 2px solid var(--border);
      background: var(--surface-alt);
      font-weight: var(--weight-medium);
    }
    .avg-note { font-size: var(--text-xs); color: var(--text-tertiary); font-style: italic; }
    .no-result { color: var(--text-tertiary); font-size: var(--text-sm); font-style: italic; }
    .notes-text { font-size: var(--text-sm); color: var(--text-primary); }

    .font-medium { font-weight: var(--weight-medium); }
    .text-primary { color: var(--text-primary); }
    .text-tertiary { color: var(--text-tertiary); }
    .text-xs { font-size: var(--text-xs); }
    .mt-2 { margin-top: 8px; }
  `]
})
export class QualityDetailsDialogComponent {
  avg: { height?: number; weight?: number; load?: number; compression?: number; weightDiff?: number } = {};

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {
      record: QualityTest;
    }
  ) {
    const samples: QualitySample[] = data.record.samples ?? [];
    if (samples.length === 3) {
      this.avg.height = QualityCalculationUtil.average(samples.map(s => s.actualHeight));
      this.avg.weight = QualityCalculationUtil.average(samples.map(s => s.actualWeight));
      this.avg.load = QualityCalculationUtil.average(samples.map(s => s.load));
      this.avg.compression = QualityCalculationUtil.averageCompression(
        samples.map(s => Number.isFinite(s.compression) ? s.compression : undefined));
      this.avg.weightDiff = QualityCalculationUtil.average(samples.map(s => s.weightDifference).filter((d): d is number => d != null));
    }
  }
}