import { Component, OnInit, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { UnitCostService } from '../../../core/services/unit-cost.service';
import { MaterialService } from '../../../core/services/material.service';
import { UnitCost } from '../../../core/models/unit-cost.model';
import { Material } from '../../../core/models/material.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-unit-costs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatDialogModule,
    MatSnackBarModule,
    EmptyStateComponent
  ],
  template: `
    <div class="settings-section tpms-dir" [attr.dir]="translation.dir()">
      <div class="section-header">
        <div class="section-title">
          <h2>{{ translation.translate('settings.unitCosts.title') }}</h2>
          <p>{{ translation.translate('settings.unitCosts.subtitle') }}</p>
        </div>
        <div class="section-actions">
          <div class="search-bar">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" [placeholder]="translation.translate('settings.unitCosts.search')" [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
            <button *ngIf="searchTerm" mat-icon-button class="clear-btn" (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <button class="btn-primary" (click)="openDialog()">
            <mat-icon>add</mat-icon> {{ translation.translate('settings.unitCosts.add') }}
          </button>
        </div>
      </div>

      <div class="section-content">
        <div *ngIf="loading" class="loading-state">
          {{ translation.translate('settings.unitCosts.loading') }}
        </div>

        <ng-container *ngIf="!loading">
          <div *ngIf="hasDemoCosts" class="demo-banner">
            <mat-icon class="demo-banner-icon">warning_amber</mat-icon>
            <span [innerHTML]="translation.translate('settings.unitCosts.demoBanner')"></span>
          </div>

          <app-empty-state
            *ngIf="!unitCosts.length && !searchTerm"
            icon="attach_money"
            [title]="translation.translate('settings.unitCosts.empty.title')"
            [description]="translation.translate('settings.unitCosts.empty.desc')"
          >
            <button class="btn-primary btn-sm" (click)="openDialog()">
              <mat-icon>add</mat-icon> {{ translation.translate('settings.unitCosts.add') }}
            </button>
          </app-empty-state>

          <app-empty-state
            *ngIf="!filteredUnitCosts.length && searchTerm"
            icon="search_off"
            [title]="translation.translate('settings.unitCosts.searchEmpty.title')"
            [description]="translation.translate('settings.unitCosts.searchEmpty.desc')"
            variant="neutral"
          ></app-empty-state>

          <div class="table-container" *ngIf="filteredUnitCosts.length > 0">
            <table mat-table [dataSource]="filteredUnitCosts" class="tpms-table">
              <ng-container matColumnDef="material">
                <th mat-header-cell *matHeaderCellDef> {{ translation.translate('settings.unitCosts.table.material') }} </th>
                <td mat-cell *matCellDef="let element"> 
                  <div class="font-medium text-primary">{{getMaterialName(element.materialId)}}</div>
                </td>
              </ng-container>

              <ng-container matColumnDef="unitCost">
                <th mat-header-cell *matHeaderCellDef> {{ translation.translate('settings.unitCosts.table.unitCost') }} </th>
                <td mat-cell *matCellDef="let element">
                  <span class="cost-value">{{element.unitCost | number:'1.2-2'}}</span>
                  <span *ngIf="element.demo" class="demo-chip" [title]="translation.translate('settings.unitCosts.demoChip.title')">{{ translation.translate('settings.unitCosts.demoChip') }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="unit">
                <th mat-header-cell *matHeaderCellDef> {{ translation.translate('settings.unitCosts.table.unit') }} </th>
                <td mat-cell *matCellDef="let element"> {{element.unit}} </td>
              </ng-container>

              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef> {{ translation.translate('settings.unitCosts.table.created') }} </th>
                <td mat-cell *matCellDef="let element"> {{element.createdAt | date:'shortDate'}} </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-col"> {{ translation.translate('settings.unitCosts.table.actions') }} </th>
                <td mat-cell *matCellDef="let element" class="actions-col">
                  <div class="table-actions">
                    <button mat-icon-button (click)="openDialog(element)" class="action-btn" [title]="translation.translate('settings.common.edit')">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button (click)="deleteUnitCost(element)" class="action-btn delete-btn" [title]="translation.translate('settings.common.delete')">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .settings-section { display: flex; flex-direction: column; gap: var(--space-6); height: 100%; }
    .section-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4); background: var(--surface); padding: var(--space-5) var(--space-6); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); }
    .section-title h2 { margin: 0 0 var(--space-1) 0; font-size: var(--text-xl); font-weight: var(--weight-semibold); color: var(--text-primary); }
    .section-title p { margin: 0; color: var(--text-secondary); font-size: var(--text-sm); }
    .section-actions { display: flex; gap: var(--space-4); align-items: center; }
    .search-bar { position: relative; display: flex; align-items: center; background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0 var(--space-3); height: 40px; width: 260px; transition: border-color 0.2s; }
    .search-bar:focus-within { border-color: var(--accent); }
    .search-icon { color: var(--text-tertiary); font-size: 20px; width: 20px; height: 20px; }
    .search-bar input { border: none; background: transparent; outline: none; padding: 0 var(--space-2); width: 100%; color: var(--text-primary); font-size: var(--text-sm); }
    .clear-btn { width: 28px; height: 28px; padding: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); }
    .clear-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .section-content { flex: 1; background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); overflow: hidden; display: flex; flex-direction: column; }
    .demo-banner { display: flex; align-items: flex-start; gap: var(--space-3); margin: var(--space-4) var(--space-4) 0; padding: var(--space-3) var(--space-4); background: var(--warning-light, rgba(245, 158, 11, 0.12)); border: 1px solid var(--warning, #f59e0b); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); }
    .demo-banner-icon { color: var(--warning, #f59e0b); font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .cost-value { font-variant-numeric: tabular-nums; }
    .demo-chip { display: inline-block; margin-left: var(--space-2); padding: 2px 8px; border-radius: 999px; background: var(--warning, #f59e0b); color: #fff; font-size: 10px; font-weight: var(--weight-semibold); letter-spacing: 0.5px; text-transform: uppercase; vertical-align: middle; }
    .table-container { overflow-x: auto; }
    .loading-state { padding: var(--space-8); text-align: center; color: var(--text-secondary); }
    .actions-col { width: 120px; text-align: right; white-space: nowrap; }
    .action-btn { color: var(--text-secondary); transform: scale(0.9); }
    .action-btn:hover { color: var(--accent); background: var(--accent-light); }
    .delete-btn:hover { color: var(--error); background: var(--error-light); }

    .tpms-dir[dir="rtl"] .section-header {
      flex-direction: row-reverse;
    }
    .tpms-dir[dir="rtl"] .section-title {
      text-align: right;
    }
    .tpms-dir[dir="rtl"] .section-actions {
      flex-direction: row-reverse;
    }
    .tpms-dir[dir="rtl"] .search-bar input {
      text-align: right;
    }
    .tpms-dir[dir="rtl"] .demo-banner {
      flex-direction: row-reverse;
      text-align: right;
    }
    .tpms-dir[dir="rtl"] .actions-col {
      text-align: left;
    }
    .tpms-dir[dir="rtl"] .table-actions {
      justify-content: flex-start;
    }
    .tpms-dir[dir="rtl"] ::ng-deep .tpms-table .mat-mdc-header-cell {
      text-align: right;
    }
    .tpms-dir[dir="rtl"] ::ng-deep .tpms-table .mat-mdc-cell {
      text-align: right;
    }
  `]
})
export class UnitCostsComponent implements OnInit {
  private unitCostService = inject(UnitCostService);
  private materialService = inject(MaterialService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  readonly translation = inject(TranslationService);

  unitCosts: UnitCost[] = [];
  filteredUnitCosts: UnitCost[] = [];
  materials: Material[] = [];
  materialsMap = new Map<string, Material>();
  
  loading = true;
  searchTerm = '';

  get hasDemoCosts(): boolean {
    return this.unitCosts.some(u => u.demo === true);
  }
  
  displayedColumns: string[] = ['material', 'unitCost', 'unit', 'createdAt', 'actions'];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    let materialsLoaded = false;
    let costsLoaded = false;

    const checkDone = () => {
      if (materialsLoaded && costsLoaded) {
        this.applyFilter();
        this.loading = false;
      }
    };

    this.materialService.getAll().subscribe({
      next: (data) => {
        this.materials = data;
        data.forEach(m => this.materialsMap.set(m.id, m));
        materialsLoaded = true;
        checkDone();
      }
    });

    this.unitCostService.getAll().subscribe({
      next: (data) => {
        this.unitCosts = data;
        costsLoaded = true;
        checkDone();
      }
    });
  }

  getMaterialName(materialId: string): string {
    return this.materialsMap.get(materialId)?.name || this.translation.translate('settings.unitCosts.material.unknown');
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredUnitCosts = [...this.unitCosts];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredUnitCosts = this.unitCosts.filter(u => 
      this.getMaterialName(u.materialId).toLowerCase().includes(term) ||
      u.unit.toLowerCase().includes(term)
    );
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  openDialog(unitCost?: UnitCost): void {
    const dialogRef = this.dialog.open(UnitCostDialogComponent, {
      width: '480px',
      data: {
        unitCost: unitCost ? { ...unitCost } : null,
        materials: this.materials,
        existingCosts: this.unitCosts
      },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadData();
      }
    });
  }

  deleteUnitCost(unitCost: UnitCost): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translation.translate('settings.unitCosts.delete.title'),
        message: this.translation.translate('settings.unitCosts.delete.message'),
        confirmText: this.translation.translate('settings.unitCosts.delete.confirm'),
        cancelText: this.translation.translate('settings.common.cancel'),
        variant: 'danger'
      }
    }).afterClosed().subscribe(confirm => {
      if (confirm) {
        this.unitCostService.delete(unitCost.id).subscribe({
          next: () => {
            this.snackBar.open(this.translation.translate('settings.unitCosts.snackbar.deleted'), this.translation.translate('common.close'), { duration: 3000 });
            this.loadData();
          },
          error: (err) => {
            console.error('[UnitCostsComponent] Delete failed:', err);
            this.snackBar.open(err?.message || this.translation.translate('settings.unitCosts.snackbar.deleteError'), this.translation.translate('common.close'), { duration: 3000 });
          }
        });
      }
    });
  }
}

@Component({
  selector: 'app-unit-cost-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatSelectModule, MatIconModule],
  template: `
    <div class="dialog-wrapper tpms-dir" [attr.dir]="translation.dir()">
      <div class="dialog-header">
        <h2 mat-dialog-title>{{ data.unitCost ? translation.translate('settings.unitCosts.dialog.title.edit') : translation.translate('settings.unitCosts.dialog.title.add') }}</h2>
        <button mat-icon-button (click)="onCancel()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <mat-dialog-content>
        <form [formGroup]="unitCostForm" class="dialog-form tpms-form mt-2">
          <div class="form-group">
            <label>{{ translation.translate('settings.unitCosts.dialog.material') }}</label>
            <select formControlName="materialId" class="form-control" [class.is-invalid]="isInvalid('materialId')" (change)="onMaterialChange()">
              <option value="">{{ translation.translate('settings.unitCosts.dialog.material.placeholder') }}</option>
              <option *ngFor="let m of data?.materials" [value]="m.id">{{ m.name }}</option>
            </select>
            <div class="invalid-feedback" *ngIf="isInvalid('materialId')">{{ translation.translate('settings.unitCosts.dialog.material.error') }}</div>
            <div class="invalid-feedback" *ngIf="unitCostForm.hasError('duplicateMaterial')">{{ translation.translate('settings.unitCosts.dialog.material.duplicate') }}</div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>{{ translation.translate('settings.unitCosts.dialog.unitCost') }}</label>
              <input type="number" formControlName="unitCost" class="form-control" min="0.01" step="0.01" [class.is-invalid]="isInvalid('unitCost')">
              <div class="invalid-feedback" *ngIf="isInvalid('unitCost')">{{ translation.translate('settings.unitCosts.dialog.unitCost.error') }}</div>
            </div>
            <div class="form-group">
              <label>{{ translation.translate('settings.unitCosts.dialog.unit') }}</label>
              <input type="text" formControlName="unit" class="form-control" [placeholder]="translation.translate('settings.unitCosts.dialog.unit.placeholder')" [class.is-invalid]="isInvalid('unit')">
              <div class="invalid-feedback" *ngIf="isInvalid('unit')">{{ translation.translate('settings.unitCosts.dialog.unit.error') }}</div>
            </div>
          </div>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <div class="error-banner" *ngIf="errorMessage">{{ errorMessage }}</div>
        <button mat-button (click)="onCancel()" [disabled]="saving">{{ translation.translate('settings.unitCosts.dialog.cancel') }}</button>
        <button mat-flat-button color="primary" (click)="onSave()" [disabled]="unitCostForm.invalid || saving">
          {{ saving ? translation.translate('settings.unitCosts.dialog.saving') : translation.translate('settings.unitCosts.dialog.save') }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-wrapper { display: flex; flex-direction: column; }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-4) var(--space-6);
      border-bottom: 1px solid var(--border-subtle);
    }
    .dialog-header h2 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: var(--weight-semibold);
    }
    .close-btn {
      color: var(--text-muted);
    }
    mat-dialog-content {
      padding: var(--space-4) var(--space-6) !important;
    }
    mat-dialog-actions {
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--border-subtle);
      margin: 0;
    }
    .dialog-form { display: flex; flex-direction: column; gap: var(--space-4); }
    .mt-2 { margin-top: var(--space-2); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
    .form-group { display: flex; flex-direction: column; gap: var(--space-2); }
    .form-group label { font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--text-secondary); }
    .form-control { padding: var(--space-2) var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-md); font-size: var(--text-sm); height: 40px; background: var(--surface); color: var(--text-primary); }
    .form-control:focus { outline: none; border-color: var(--accent); }
    .form-control.is-invalid { border-color: var(--error); }
    .invalid-feedback { font-size: var(--text-xs); color: var(--error); margin-top: 2px; }
    .error-banner { flex: 1; font-size: var(--text-xs); color: var(--error); padding: var(--space-1) 0; }

    .tpms-dir[dir="rtl"] .dialog-header {
      flex-direction: row-reverse;
    }
    .tpms-dir[dir="rtl"] mat-dialog-content {
      text-align: right;
    }
    .tpms-dir[dir="rtl"] .form-group label {
      text-align: right;
    }
    .tpms-dir[dir="rtl"] mat-dialog-actions {
      flex-direction: row-reverse;
    }
    .tpms-dir[dir="rtl"] input,
    .tpms-dir[dir="rtl"] select {
      direction: rtl;
    }
  `]
})
export class UnitCostDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<UnitCostDialogComponent>);
  private unitCostService = inject(UnitCostService);
  private snackBar = inject(MatSnackBar);
  readonly translation = inject(TranslationService);

  public data = inject<{ unitCost: UnitCost | null, materials: Material[], existingCosts: UnitCost[] }>(MAT_DIALOG_DATA);

  unitCostForm!: FormGroup;
  saving = false;
  errorMessage = '';

  ngOnInit() {
    this.unitCostForm = this.fb.group({
      materialId: [this.data.unitCost?.materialId || '', Validators.required],
      unitCost: [this.data.unitCost?.unitCost || 0, [Validators.required, Validators.min(0.01)]],
      unit: [this.data.unitCost?.unit || '', [Validators.required, Validators.maxLength(20)]]
    }, { validators: [this.duplicateMaterialValidator.bind(this)] });
  }

  onMaterialChange(): void {
    const matId = this.unitCostForm.get('materialId')?.value;
    if (matId) {
      const mat = this.data.materials.find(m => m.id === matId);
      if (mat) {
        this.unitCostForm.get('unit')?.setValue(mat.unit);
      }
    }
  }

  isInvalid(controlName: string): boolean {
    const control = this.unitCostForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  duplicateMaterialValidator(group: FormGroup) {
    const materialId = group.get('materialId')?.value;
    if (!materialId) return null;
    
    const currentId = this.data.unitCost?.id;
    const exists = this.data.existingCosts.some(u => u.materialId === materialId && u.id !== currentId);
    
    return exists ? { duplicateMaterial: true } : null;
  }

  onSave(): void {
    if (this.unitCostForm.invalid) {
      this.unitCostForm.markAllAsTouched();
      return;
    }

    const formValue = this.unitCostForm.value;
    const unitCost: UnitCost = {
      id: this.data.unitCost?.id || crypto.randomUUID(),
      materialId: formValue.materialId,
      unitCost: formValue.unitCost,
      unit: formValue.unit.trim(),
      createdAt: this.data.unitCost?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saving = true;
    this.errorMessage = '';

    const save$ = this.data.unitCost ? this.unitCostService.update(unitCost) : this.unitCostService.create(unitCost);

    save$.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(this.translation.translate('settings.unitCosts.snackbar.saved'), this.translation.translate('common.close'), { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Failed to save unit cost', err);
        this.saving = false;
        this.errorMessage = err?.message || this.translation.translate('settings.unitCosts.dialog.saveError');
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
