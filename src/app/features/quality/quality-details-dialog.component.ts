import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { TranslationService } from '../../core/services/translation.service';
import { QualityTest, QualitySample } from '../../core/models/quality-test.model';
import { QualityCalculationUtil } from '../../core/utils/quality-calculation.util';

@Component({
  selector: 'app-quality-details-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, StatusBadgeComponent],
  template: `
    <div class="dialog-wrapper tpms-dir" [attr.dir]="translation.dir()">
      <h2 mat-dialog-title>{{ translation.translate('quality.view.title') }}</h2>
      <mat-dialog-content>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">{{ translation.translate('quality.view.product') }}</span>
            <span class="detail-value font-medium text-primary">{{ data.record.productName }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ translation.translate('quality.view.line') }}</span>
            <span class="detail-value">{{ data.record.lineName || translation.translate('quality.table.notSpecified') }}</span>
          </div>
          <div class="detail-item" *ngIf="data.record.date">
            <span class="detail-label">{{ translation.translate('quality.view.date') }}</span>
            <span class="detail-value">{{ data.record.date | date:'shortDate' }}</span>
          </div>
          <div class="detail-item" *ngIf="data.record.productionRecordId || data.record.productionDate">
            <span class="detail-label">{{ translation.translate('quality.view.productionReference') }}</span>
            <span class="detail-value">
              <span *ngIf="data.record.productionRecordId">{{ data.record.productionRecordId }}</span>
              <span *ngIf="data.record.productionDate">{{ data.record.productionDate }}</span>
            </span>
          </div>
          <div class="detail-item" *ngIf="data.record.samples?.length">
            <span class="detail-label">{{ translation.translate('quality.view.productArea') }}</span>
            <span class="detail-value font-medium">{{ data.record.productAreaSnapshot ?? '—' }}</span>
          </div>
          <div class="detail-item" *ngIf="data.record.samples?.length">
            <span class="detail-label">{{ translation.translate('quality.view.compressionStandard') }}</span>
            <span class="detail-value font-medium">{{ data.record.compressionStandardSnapshot ?? '—' }}</span>
          </div>
        </div>

        <!-- Sample measurements -->
        <div class="block" *ngIf="data.record.samples?.length">
          <div class="block-title">{{ translation.translate('quality.view.samples', { n: (data.record.samples?.length ?? 0) }) }}</div>
          <div class="table-responsive">
            <table class="samples-table">
              <thead>
                <tr>
                  <th>{{ translation.translate('quality.view.table.sample') }}</th>
                  <th>{{ translation.translate('quality.view.table.actHt') }}</th>
                  <th>{{ translation.translate('quality.view.table.actWt') }}</th>
                  <th>{{ translation.translate('quality.view.table.stdWt') }}</th>
                  <th>{{ translation.translate('quality.view.table.wtDiff') }}</th>
                  <th>{{ translation.translate('quality.view.table.load') }}</th>
                  <th>{{ translation.translate('quality.view.table.compression') }}</th>
                  <th>{{ translation.translate('quality.view.table.result') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of data.record.samples; let i = index">
                  <td class="sample-label">{{ translation.translate('quality.table.sampleLabel', { n: i + 1 }) }}</td>
                  <td>{{ s.actualHeight }}</td>
                  <td>{{ s.actualWeight }}</td>
                  <td class="snapshot">{{ data.record.standardWeightSnapshot ?? '—' }}</td>
                  <td>{{ s.weightDifference ?? '—' }}</td>
                  <td>{{ s.load }}</td>
                  <td class="compression">{{ s.compression }}</td>
                  <td>
                    <app-status-badge
                      [label]="resultLabel(s.compressionResult)"
                      [variant]="s.compressionResult === 'PASS' ? 'success' : s.compressionResult === 'FAIL' ? 'error' : 'warning'"
                      [icon]="s.compressionResult === 'PASS' ? 'check_circle' : s.compressionResult === 'FAIL' ? 'cancel' : 'help'"
                      size="sm">
                    </app-status-badge>
                  </td>
                </tr>
                <tr class="averages-row" *ngIf="(data.record.samples?.length ?? 0) === 3">
                  <td class="sample-label">{{ translation.translate('quality.view.table.averageLabel') }}</td>
                  <td>{{ avg.height }}</td>
                  <td>{{ avg.weight }}</td>
                  <td></td>
                  <td>{{ avg.weightDiff }}</td>
                  <td>{{ avg.load }}</td>
                  <td>
                    <span *ngIf="avg.compression != null">{{ avg.compression }}</span>
                    <span *ngIf="avg.compression == null" class="no-result">{{ translation.translate('quality.result.configRequired') }}</span>
                  </td>
                  <td class="avg-note">{{ translation.translate('quality.table.avgNote') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="block" *ngIf="!data.record.samples?.length">
          <div class="block-title">{{ translation.translate('quality.view.legacy.title') }}</div>
          <div class="details-grid legacy-grid">
            <div class="detail-item">
              <span class="detail-label">{{ translation.translate('quality.view.load') }}</span>
              <span class="detail-value font-medium">{{ data.record.load ?? '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">{{ translation.translate('quality.view.compression') }}</span>
              <span class="detail-value font-medium">{{ data.record.compression ?? (data.record.strength ?? '—') }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">{{ translation.translate('quality.view.result') }}</span>
              <span class="detail-value font-medium">{{ resultLabel(data.record.result ?? undefined) || '—' }}</span>
            </div>
          </div>
        </div>

        <div class="block" *ngIf="data.record.notes">
          <div class="block-title">{{ translation.translate('quality.view.notes') }}</div>
          <div class="notes-text">{{ data.record.notes }}</div>
        </div>

        <div class="mt-2 text-tertiary text-xs" *ngIf="data.record.decisionSource">
          {{ translation.translate('quality.view.decisionSource', { source: data.record.decisionSource.replace('_', ' ') }) }}
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ translation.translate('common.close') }}</button>
      </mat-dialog-actions>
    </div>
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

    .tpms-dir[dir="rtl"] .detail-label,
    .tpms-dir[dir="rtl"] .block-title,
    .tpms-dir[dir="rtl"] .samples-table th {
      text-transform: none;
      letter-spacing: 0;
    }

    .tpms-dir[dir="rtl"] .samples-table th,
    .tpms-dir[dir="rtl"] .samples-table td {
      text-align: right;
    }
  `]
})
export class QualityDetailsDialogComponent {
  readonly translation = inject(TranslationService);
  avg: { height?: number; weight?: number; load?: number; compression?: number; weightDiff?: number } = {};

  resultLabel(result: string | null | undefined): string {
    if (result === 'PASS') return this.translation.translate('quality.result.pass');
    if (result === 'FAIL') return this.translation.translate('quality.result.fail');
    if (result === 'CONFIGURATION_REQUIRED') return this.translation.translate('quality.result.configRequired');
    return result ?? '';
  }

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