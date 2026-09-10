import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { TranslationService } from '../../core/services/translation.service';
import { MaterialRecord } from '../../core/models/material-record.model';
import { MaterialConversionUtil } from '../../core/utils/material-conversion.util';

@Component({
  selector: 'app-materials-details-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatTableModule],
  template: `
    <div class="dialog-wrapper tpms-dir" [attr.dir]="translation.dir()">
      <h2 mat-dialog-title>{{ translation.translate('materials.view.title') }}</h2>
      <mat-dialog-content>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">{{ translation.translate('materials.view.date') }}</span>
            <span class="detail-value">{{ data.record.date | date:'shortDate' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ translation.translate('materials.view.line') }}</span>
            <span class="detail-value font-medium text-primary">{{ data.lineName }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ translation.translate('materials.view.product') }}</span>
            <span class="detail-value">{{ data.productName }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ translation.translate('materials.view.shift') }}</span>
            <span class="detail-value">{{ data.shiftName }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ translation.translate('materials.view.mixCount') }}</span>
            <span class="detail-value">{{ data.record.mixCount }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ translation.translate('materials.view.operator') }}</span>
            <span class="detail-value">{{ data.record.operator || '—' }}</span>
          </div>
        </div>

        <h3 class="section-subtitle">{{ translation.translate('materials.view.section.consumption') }}</h3>

        <table mat-table [dataSource]="data.record.materials" class="tpms-table mt-3 mb-3 details-table">
          <ng-container matColumnDef="material">
            <th mat-header-cell *matHeaderCellDef> {{ translation.translate('materials.view.table.material') }} </th>
            <td mat-cell *matCellDef="let element"> <span class="font-medium">{{element.materialName}}</span> </td>
          </ng-container>

          <ng-container matColumnDef="standardPerMix">
            <th mat-header-cell *matHeaderCellDef> {{ translation.translate('materials.view.table.stdPerMix') }} </th>
            <td mat-cell *matCellDef="let element"> {{element.perMixStandard || '—'}} {{ unitLabel(element.unit) }}{{ translation.translate('materials.unit.perMix') }} </td>
          </ng-container>

          <ng-container matColumnDef="actualPerMix">
            <th mat-header-cell *matHeaderCellDef> {{ translation.translate('materials.view.table.actualPerMix') }} </th>
            <td mat-cell *matCellDef="let element"> <span class="font-medium">{{element.perMixActual}} {{ unitLabel(element.unit) }}{{ translation.translate('materials.unit.perMix') }}</span> </td>
          </ng-container>

          <ng-container matColumnDef="theoretical">
            <th mat-header-cell *matHeaderCellDef> {{ translation.translate('materials.view.table.stdDaily') }} </th>
            <td mat-cell *matCellDef="let element"> {{element.theoreticalQuantity || '—'}} {{ unitLabel(element.unit) }} </td>
          </ng-container>

          <ng-container matColumnDef="actual">
            <th mat-header-cell *matHeaderCellDef> {{ translation.translate('materials.view.table.totalActual') }} </th>
            <td mat-cell *matCellDef="let element">
              <span class="font-medium text-primary">{{element.actualQuantity}} {{ unitLabel(element.unit) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="variance">
            <th mat-header-cell *matHeaderCellDef> {{ translation.translate('materials.view.table.variance') }} </th>
            <td mat-cell *matCellDef="let element">
              <span class="variance-badge" [ngClass]="getVarianceClass(element.variance)">
                {{ (element.variance > 0 ? '+' : '') + element.variance }} {{ unitLabel(element.unit) }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="cost">
            <th mat-header-cell *matHeaderCellDef> {{ translation.translate('materials.view.table.cost') }} </th>
            <td mat-cell *matCellDef="let element">
              <span *ngIf="element.dimensionOk">{{element.totalCost | number:'1.2-2'}}</span>
              <span *ngIf="!element.dimensionOk" class="text-muted" [title]="translation.translate('materials.cost.notCompatibleShort')">{{ translation.translate('materials.cost.na') }}</span>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>

        <div class="total-section">
          <span class="total-label">{{ translation.translate('materials.totalCost') }}</span>
          <span class="total-value">{{ data.record.totalCost | number:'1.2-2' }}</span>
        </div>

        <div class="conversion-note mt-3" *ngIf="conversionSummary">
          <span>{{ translation.translate('materials.view.conversion.note', { summary: conversionSummary }) }}</span>
        </div>
        <div class="conversion-note mt-3" *ngIf="missingConversion">
          <span class="text-muted">{{ missingConversion }}</span>
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
      gap: var(--space-3);
      margin-bottom: var(--space-5);
      background: var(--surface-alt);
      padding: var(--space-4);
      border-radius: var(--radius-md);
    }

    .detail-item { display: flex; flex-direction: column; }
    .detail-label { font-size: var(--text-xs); color: var(--text-secondary); font-weight: var(--weight-medium); text-transform: uppercase; letter-spacing: 0.5px; }
    .detail-value { font-size: var(--text-sm); color: var(--text-primary); margin-top: 2px; }

    .section-subtitle { font-size: var(--text-md); font-weight: var(--weight-semibold); color: var(--text-primary); margin-top: var(--space-4); margin-bottom: var(--space-3); border-bottom: 1px solid var(--border-subtle); padding-bottom: var(--space-2); }

    .details-table { width: 100%; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); overflow: hidden; }

    .variance-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-weight: var(--weight-semibold); font-size: var(--text-xs); }
    .variance-positive { background: var(--error-light); color: var(--error-dark); }
    .variance-negative { background: var(--success-light); color: var(--success-dark); }
    .variance-zero { background: var(--surface-alt); color: var(--text-secondary); }

    .text-muted { color: var(--text-tertiary); }

    .total-section { display: flex; justify-content: flex-end; align-items: center; gap: var(--space-3); padding: var(--space-4) var(--space-4) 0 0; }
    .total-label { font-weight: var(--weight-medium); color: var(--text-secondary); }
    .total-value { font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--primary); }

    .conversion-note {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      background: var(--surface-alt);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
    }

    .mt-3 { margin-top: var(--space-3); }
    .mb-3 { margin-bottom: var(--space-3); }

    .tpms-dir[dir="rtl"] .detail-label,
    .tpms-dir[dir="rtl"] .section-subtitle,
    .tpms-dir[dir="rtl"] .details-table .mat-mdc-header-cell {
      text-transform: none;
      letter-spacing: 0;
    }

    .tpms-dir[dir="rtl"] .total-section {
      justify-content: flex-start;
      padding: var(--space-4) 0 0 var(--space-4);
    }
  `]
})
export class MaterialsDetailsDialogComponent {
  readonly translation = inject(TranslationService);
  columns: string[] = ['material', 'standardPerMix', 'actualPerMix', 'theoretical', 'actual', 'variance', 'cost'];

  conversionSummary: string = '';
  missingConversion: string = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {
      record: MaterialRecord;
      productName: string;
      lineName: string;
      shiftName: string;
      conversionFactors: Map<string, number>;
    }
  ) {
    this.buildConversionNote();
  }

  unitLabel(unit: string | null | undefined): string {
    if (unit === 'kg') return this.translation.translate('materials.unit.kg');
    if (unit === 'L' || unit === 'l') return this.translation.translate('materials.unit.liter');
    return unit ?? '—';
  }

  /** Report-only kg → m³ preview using configured factors (never stored). */
  private buildConversionNote(): void {
    const parts: string[] = [];
    const missing: string[] = [];
    const kgLabel = this.translation.translate('materials.unit.kg');

    this.data.record.materials.forEach(item => {
      if (item.unit !== 'kg') return;
      const kgPerM3 = this.data.conversionFactors.get(item.materialId);
      const res = MaterialConversionUtil.kgToM3(item.actualQuantity || 0, kgPerM3);
      if (res.status === 'OK') {
        const m3 = Number(res.cubicMeters.toFixed(2));
        parts.push(`${item.materialName} ${(item.actualQuantity || 0)} ${kgLabel} → ${m3} m³`);
      } else {
        missing.push(`${item.materialName}: ${this.translation.translate('materials.view.conversion.missing')}`);
      }
    });

    this.conversionSummary = parts.join(' · ');
    this.missingConversion = missing.join(' · ');
  }

  getVarianceClass(variance: number): string {
    if (variance > 0) return 'variance-positive';
    if (variance < 0) return 'variance-negative';
    return 'variance-zero';
  }
}