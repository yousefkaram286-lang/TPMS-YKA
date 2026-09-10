import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslationService } from '../../core/services/translation.service';
import { MaterialRecord, MaterialTransactionItem } from '../../core/models/material-record.model';
import { MaterialsService } from '../../core/services/materials.service';

@Component({
  selector: 'app-materials-edit-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, ReactiveFormsModule],
  template: `
    <div class="dialog-wrapper tpms-dir" [attr.dir]="translation.dir()">
      <h2 mat-dialog-title>{{ translation.translate('materials.edit.title') }}</h2>
      <mat-dialog-content>

        <div class="info-banner">
          {{ translation.translate('materials.edit.infoBanner') }}
        </div>

        <div class="details-grid mt-3">
          <div class="detail-item">
            <span class="detail-label">{{ translation.translate('materials.view.product') }}</span>
            <span class="detail-value font-medium text-primary">{{ data.productName }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ translation.translate('materials.view.mixCount') }}</span>
            <span class="detail-value">{{ data.record.mixCount }}</span>
          </div>
        </div>

        <form [formGroup]="editForm" class="mt-4">
          <div class="table-responsive">
            <table class="tpms-table edit-table">
              <thead>
                <tr>
                  <th>{{ translation.translate('materials.edit.table.material') }}</th>
                  <th>{{ translation.translate('materials.edit.table.stdPerMix') }}</th>
                  <th>{{ translation.translate('materials.edit.table.actualPerMix') }}</th>
                  <th>{{ translation.translate('materials.edit.table.actualTotal') }}</th>
                  <th>{{ translation.translate('materials.edit.table.variance') }}</th>
                  <th>{{ translation.translate('materials.edit.table.cost') }}</th>
                </tr>
              </thead>
              <tbody formArrayName="materials">
                <tr *ngFor="let item of materials.controls; let i = index" [formGroupName]="i">
                  <td><span class="font-medium">{{ item.get('materialName')?.value }}</span></td>
                  <td>{{ item.get('perMixStandard')?.value }} {{ unitLabel(item.get('unit')?.value) }}{{ translation.translate('materials.unit.perMix') }}</td>
                  <td>
                    <input type="number" formControlName="perMixActual" class="form-control actual-input" (input)="onActualChange(i)" min="0"
                           [class.is-invalid]="item.get('perMixActual')?.invalid && item.get('perMixActual')?.touched">
                  </td>
                  <td><span class="font-bold">{{ item.get('actualQuantity')?.value }} {{ unitLabel(item.get('unit')?.value) }}</span></td>
                  <td>
                    <span class="variance-badge" [ngClass]="getVarianceClass(item.get('variance')?.value)">
                      {{ (item.get('variance')?.value > 0 ? '+' : '') + (item.get('variance')?.value ?? 0) }}
                    </span>
                  </td>
                  <td>
                    <span *ngIf="item.get('dimensionOk')?.value">{{ item.get('totalCost')?.value | number:'1.2-2' }}</span>
                    <span *ngIf="!item.get('dimensionOk')?.value" class="text-muted">{{ translation.translate('materials.cost.na') }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </form>

        <div class="total-section mt-4">
          <span class="total-label">{{ translation.translate('materials.totalCost') }}</span>
          <span class="total-value">{{ getTotalCost() | number:'1.2-2' }}</span>
        </div>

      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ translation.translate('common.cancel') }}</button>
        <button mat-flat-button color="primary" (click)="save()" [disabled]="editForm.invalid">{{ translation.translate('materials.edit.saveChanges') }}</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .info-banner {
      background: var(--info-light);
      color: var(--accent-dark);
      padding: var(--space-3);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-3);
      background: var(--surface-alt);
      padding: var(--space-3);
      border-radius: var(--radius-md);
    }

    .detail-item { display: flex; flex-direction: column; }
    .detail-label { font-size: var(--text-xs); color: var(--text-secondary); text-transform: uppercase; }
    .detail-value { font-size: var(--text-sm); color: var(--text-primary); margin-top: 2px; }

    .text-muted { color: var(--text-tertiary); }

    .edit-table { width: 100%; border-collapse: collapse; }
    .edit-table th { background: var(--surface-alt); text-align: left; padding: var(--space-2) var(--space-3); font-size: var(--text-sm); font-weight: var(--weight-semibold); border-bottom: 1px solid var(--border); }
    .edit-table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border-subtle); vertical-align: middle; }

    .actual-input { width: 90px; padding: 4px 8px; border: 1px solid var(--border); border-radius: var(--radius-md); }
    .actual-input:focus { outline: none; border-color: var(--accent); }
    .is-invalid { border-color: var(--error); }

    .variance-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-weight: var(--weight-semibold); font-size: var(--text-xs); }
    .variance-positive { background: var(--error-light); color: var(--error-dark); }
    .variance-negative { background: var(--success-light); color: var(--success-dark); }
    .variance-zero { background: var(--surface-alt); color: var(--text-secondary); }

    .total-section { display: flex; justify-content: flex-end; align-items: center; gap: var(--space-3); padding-top: var(--space-3); border-top: 2px solid var(--border); }
    .total-label { font-weight: var(--weight-medium); color: var(--text-secondary); }
    .total-value { font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--primary); }

    .mt-3 { margin-top: var(--space-3); }
    .mt-4 { margin-top: var(--space-4); }

    .tpms-dir[dir="rtl"] .detail-label,
    .tpms-dir[dir="rtl"] .edit-table th {
      text-transform: none;
      letter-spacing: 0;
    }

    .tpms-dir[dir="rtl"] .edit-table th {
      text-align: right;
    }

    .tpms-dir[dir="rtl"] .total-section {
      justify-content: flex-start;
    }
  `]
})
export class MaterialsEditDialogComponent implements OnInit {
  readonly translation = inject(TranslationService);
  editForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private materialsService: MaterialsService,
    private dialogRef: MatDialogRef<MaterialsEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      record: MaterialRecord;
      productName: string;
    }
  ) {}

  unitLabel(unit: string | null | undefined): string {
    if (unit === 'kg') return this.translation.translate('materials.unit.kg');
    if (unit === 'L' || unit === 'l') return this.translation.translate('materials.unit.liter');
    return unit ?? '—';
  }

  ngOnInit(): void {
    this.editForm = this.fb.group({
      materials: this.fb.array([])
    });
    this.populateForm();
  }

  get materials(): FormArray {
    return this.editForm.get('materials') as FormArray;
  }

  private populateForm(): void {
    this.data.record.materials.forEach((item: MaterialTransactionItem) => {
      this.materials.push(this.fb.group({
        materialId: [item.materialId],
        materialName: [item.materialName],
        unit: [item.unit],
        perMixStandard: [item.perMixStandard],
        perMixActual: [item.perMixActual, [Validators.required, Validators.min(0)]],
        theoreticalQuantity: [item.theoreticalQuantity],
        actualQuantity: [item.actualQuantity],
        variance: [item.variance],
        dimensionOk: [item.dimensionOk],
        unitCost: [item.unitCost],
        totalCost: [item.totalCost]
      }));
    });
  }

  onActualChange(index: number): void {
    const row = this.materials.at(index);
    const perMixActual = row.get('perMixActual')?.value;
    const mixCount = this.data.record.mixCount;
    const theo = row.get('theoreticalQuantity')?.value || 0;

    if (perMixActual === null || perMixActual === undefined || perMixActual === '') {
      row.get('actualQuantity')?.setValue(0);
      row.get('variance')?.setValue(-theo);
      row.get('totalCost')?.setValue(0);
      return;
    }

    const actual = this.materialsService.calculateDailyTotal(perMixActual, mixCount);
    const variance = this.materialsService.calculateVariance(actual, theo);
    const dimensional = !!row.get('dimensionOk')?.value;
    const unitCost = row.get('unitCost')?.value || 0;

    row.get('actualQuantity')?.setValue(actual);
    row.get('variance')?.setValue(variance);
    row.get('totalCost')?.setValue(dimensional ? this.materialsService.calculateMaterialCost(actual, unitCost) : 0);
  }

  getVarianceClass(variance: number): string {
    if (variance > 0) return 'variance-positive';
    if (variance < 0) return 'variance-negative';
    return 'variance-zero';
  }

  getTotalCost(): number {
    const costs = this.materials.controls.map(ctrl => ctrl.get('totalCost')?.value || 0);
    return this.materialsService.calculateTotalCost(costs);
  }

  save(): void {
    if (this.editForm.invalid) return;

    const updatedMaterials: MaterialTransactionItem[] = this.materials.controls.map(c => ({
      materialId: c.get('materialId')?.value || '',
      materialName: c.get('materialName')?.value,
      unit: c.get('unit')?.value,
      perMixStandard: c.get('perMixStandard')?.value || 0,
      perMixActual: c.get('perMixActual')?.value ?? 0,
      theoreticalQuantity: c.get('theoreticalQuantity')?.value || 0,
      actualQuantity: c.get('actualQuantity')?.value || 0,
      variance: c.get('variance')?.value || 0,
      dimensionOk: !!c.get('dimensionOk')?.value,
      unitCost: c.get('unitCost')?.value || 0,
      totalCost: c.get('totalCost')?.value || 0
    }));

    const updatedRecord: MaterialRecord = {
      ...this.data.record,
      materials: updatedMaterials,
      totalCost: this.getTotalCost(),
      updatedAt: new Date().toISOString()
    };

    this.materialsService.update(updatedRecord).subscribe(() => {
      this.dialogRef.close(true);
    });
  }
}