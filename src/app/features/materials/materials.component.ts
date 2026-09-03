import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MaterialsDetailsDialogComponent } from './materials-details-dialog.component';
import { MaterialsEditDialogComponent } from './materials-edit-dialog.component';

import { MaterialsService } from '../../core/services/materials.service';
import { ProductService } from '../../core/services/product.service';
import { LineService } from '../../core/services/line.service';
import { ShiftService } from '../../core/services/shift.service';
import { RecipeService } from '../../core/services/recipe.service';
import { UnitCostService } from '../../core/services/unit-cost.service';
import { MaterialService } from '../../core/services/material.service';
import { SubmissionGuard } from '../../core/utils/production.util';
import { MaterialConversionUtil } from '../../core/utils/material-conversion.util';
import { toLocalCalendarString } from '../../core/utils/date.util';

import { MaterialRecord, MaterialTransactionItem } from '../../core/models/material-record.model';
import { Product } from '../../core/models/product.model';
import { Line } from '../../core/models/line.model';
import { Shift } from '../../core/models/shift.model';
import { Recipe } from '../../core/models/recipe.model';
import { UnitCost } from '../../core/models/unit-cost.model';
import { Material } from '../../core/models/material.model';

/**
 * Corrected Materials business model:
 * Entry = Line/day (Date + Line required; Shift / Product / Operator optional
 * metadata). MixCount = total mixer batches for the Line/day. Actual per-mix
 * quantities (Cement kg/Mix, Sand kg/Mix, Aggregate kg/Mix, Water L/Mix) are
 * entered by the operator; the DAILY ACTUAL TOTAL is CALCULATED as
 * MixCount × Actual per mix. Never derived from Presses/PiecesPerPress/
 * ProducedQuantity. The Standard Recipe is reference-only and never overwrites
 * Actual per mix; its values are snapshotted at entry time so later Recipe
 * master edits never alter history.
 */
const CANONICAL_MATERIALS: { name: string; unit: string }[] = [
  { name: 'Cement', unit: 'kg' },
  { name: 'Sand', unit: 'kg' },
  { name: 'Aggregate', unit: 'kg' },
  { name: 'Water', unit: 'L' }
];

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    PageHeaderComponent,
    EmptyStateComponent
  ],
  template: `
    <div class="materials-container">
      <app-page-header
        title="Materials"
        subtitle="Daily actual mix usage — Line/day totals from MixCount × actual per mix"
        icon="inventory_2"
      ></app-page-header>

      <div class="materials-content">
        <!-- Entry Form Section -->
        <div class="card entry-card">
          <div class="card-header">
            <h3>Material Entry (Line / Day)</h3>
          </div>

          <form [formGroup]="materialsForm" class="card-body tpms-form">
            <div class="form-row header-row">
              <div class="form-group">
                <label>Date *</label>
                <div class="date-input-wrapper">
                  <input matInput [matDatepicker]="picker" formControlName="date" class="form-control" [class.is-invalid]="isInvalid('date')">
                  <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                </div>
                <div class="invalid-feedback" *ngIf="isInvalid('date')">Date is required.</div>
              </div>

              <div class="form-group">
                <label>Line *</label>
                <select formControlName="lineId" class="form-control" [class.is-invalid]="isInvalid('lineId')">
                  <option value="" disabled>Select Line</option>
                  <option *ngFor="let line of activeLines" [value]="line.id">{{ line.name }}</option>
                </select>
                <div class="invalid-feedback" *ngIf="isInvalid('lineId')">Line is required.</div>
              </div>

              <div class="form-group">
                <label>Product (optional — reference only)</label>
                <select formControlName="productId" class="form-control" (change)="onProductChange()">
                  <option value="">None — enter actual values directly</option>
                  <option *ngFor="let product of activeProducts" [value]="product.id">{{ product.name }}</option>
                </select>
                <div class="invalid-feedback" *ngIf="isInvalid('productId')">Product is required.</div>
              </div>

              <div class="form-group">
                <label>Mix Count * (mixes)</label>
                <input type="number" formControlName="mixCount" class="form-control" (input)="onMixCountChange()" [class.is-invalid]="isInvalid('mixCount')" min="1">
                <div class="invalid-feedback" *ngIf="isInvalid('mixCount')">Mix Count is required and must be > 0.</div>
              </div>
            </div>

            <!-- Warnings -->
            <div class="warning-alert mt-2" *ngIf="recipeInfo">
              <mat-icon>info</mat-icon>
              <span>No standard recipe — enter actual per-mix values directly (recipe is reference only, never required).</span>
            </div>

            <div class="warning-alert mt-2" *ngIf="costWarnings.length > 0">
              <mat-icon>warning</mat-icon>
              <span>{{ costWarnings.join(' · ') }} Cost is deferred for those materials.</span>
            </div>

            <hr class="divider">

            <!-- Per-Mix Material Table -->
            <div class="recipe-section" *ngIf="materials.length > 0">
              <h4 class="section-title">Actual Per Mix × Mix Count → Daily Total</h4>
              <div class="table-responsive">
                <table class="tpms-table materials-input-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Unit</th>
                      <th>Standard / Mix</th>
                      <th>Actual / Mix *</th>
                      <th>Standard Daily</th>
                      <th>Total Actual</th>
                      <th>Variance</th>
                      <th>Unit Cost</th>
                      <th>Material Cost</th>
                    </tr>
                  </thead>
                  <tbody formArrayName="materials">
                    <tr *ngFor="let item of materials.controls; let i = index" [formGroupName]="i">
                      <td><span class="font-medium">{{ item.get('materialName')?.value }}</span></td>
                      <td>{{ item.get('unit')?.value }}</td>
                      <td>
                        <span>{{ formatPerMix(item.get('perMixStandard')?.value) }}</span>
                        <span *ngIf="!item.get('perMixStandard')?.value" class="text-muted">—</span>
                      </td>
                      <td>
                        <input type="number" formControlName="perMixActual" class="form-control actual-input" (input)="onPerMixChange(i)" [class.is-invalid]="item.get('perMixActual')?.invalid && item.get('perMixActual')?.touched" min="0" placeholder="0">
                      </td>
                      <td>{{ formatPerMix(item.get('theoreticalQuantity')?.value) }}</td>
                      <td>
                        <span class="font-bold">{{ formatPerMix(item.get('actualQuantity')?.value) }}</span>
                      </td>
                      <td>
                        <span class="variance-badge" [ngClass]="getVarianceClass(item.get('variance')?.value)">
                          {{ (item.get('variance')?.value > 0 ? '+' : '') + formatPerMix(item.get('variance')?.value) }}
                        </span>
                      </td>
                      <td>
                        <span *ngIf="item.get('dimensionOk')?.value">{{ item.get('unitCost')?.value | number:'1.2-4' }} / {{ item.get('unit')?.value }}</span>
                        <span *ngIf="!item.get('dimensionOk')?.value" class="text-muted" title="Unit cost not compatible with operational unit">N/A</span>
                      </td>
                      <td>{{ item.get('totalCost')?.value | number:'1.2-2' }}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="8" class="text-right font-medium">Total Material Cost:</td>
                      <td class="font-bold text-lg text-primary">{{ getTotalCost() | number:'1.2-2' }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="confirmClear()">Clear</button>
              <button type="button" class="btn-primary" (click)="saveMaterials()" [disabled]="materialsForm.invalid || saving || materials.length === 0">
                {{ saving ? 'Saving...' : 'Save Materials' }}
              </button>
            </div>
          </form>
        </div>

        <!-- History Section -->
        <div class="card history-card">
          <div class="card-header history-header">
            <h3>Materials History</h3>
            <div class="history-actions">
              <div class="search-bar">
                <mat-icon class="search-icon">search</mat-icon>
                <input type="text" placeholder="Search materials..." [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
              </div>
            </div>
          </div>

          <div class="card-body p-0">
            <div *ngIf="loadingHistory" class="loading-state">Loading history...</div>

            <app-empty-state
              *ngIf="!loadingHistory && !filteredHistory.length"
              icon="inventory_2"
              title="No material records yet."
              description="Start by recording your first material transaction."
              variant="neutral"
            ></app-empty-state>

            <div class="table-responsive" *ngIf="!loadingHistory && filteredHistory.length > 0">
              <table mat-table [dataSource]="filteredHistory" class="tpms-table history-table">
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef> Date </th>
                  <td mat-cell *matCellDef="let element"> {{element.date | date:'shortDate'}} </td>
                </ng-container>

                <ng-container matColumnDef="line">
                  <th mat-header-cell *matHeaderCellDef> Line </th>
                  <td mat-cell *matCellDef="let element"> <span class="font-medium text-primary">{{getLineName(element.lineId)}}</span> </td>
                </ng-container>

                <ng-container matColumnDef="shift">
                  <th mat-header-cell *matHeaderCellDef> Shift </th>
                  <td mat-cell *matCellDef="let element"> {{getShiftName(element.shiftId)}} </td>
                </ng-container>

                <ng-container matColumnDef="product">
                  <th mat-header-cell *matHeaderCellDef> Product </th>
                  <td mat-cell *matCellDef="let element"> {{getProductName(element.productId)}} </td>
                </ng-container>

                <ng-container matColumnDef="mixCount">
                  <th mat-header-cell *matHeaderCellDef> Mixes </th>
                  <td mat-cell *matCellDef="let element"> {{element.mixCount}} </td>
                </ng-container>

                <ng-container matColumnDef="totalCost">
                  <th mat-header-cell *matHeaderCellDef> Total Cost </th>
                  <td mat-cell *matCellDef="let element">
                    <span class="cost-badge">{{element.totalCost | number:'1.2-2'}}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="operator">
                  <th mat-header-cell *matHeaderCellDef> Operator </th>
                  <td mat-cell *matCellDef="let element"> {{element.operator || '—'}} </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="actions-col actions-col-wide"> Actions </th>
                  <td mat-cell *matCellDef="let element" class="actions-col actions-col-wide">
                    <div class="table-actions">
                      <button mat-icon-button class="action-btn" title="View Details" (click)="viewDetails(element)">
                        <mat-icon>visibility</mat-icon>
                      </button>
                      <button mat-icon-button class="action-btn" title="Edit" (click)="editRecord(element)">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button class="action-btn delete-btn" title="Delete" (click)="deleteRecord(element)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="historyColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: historyColumns;"></tr>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      animation: fadeSlideUp 0.4s cubic-bezier(0.215, 0.61, 0.355, 1) both;
    }

    .materials-container {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      padding: var(--space-6);
      max-width: 1200px;
      margin: 0 auto;
    }

    .card {
      background: var(--surface);
      border-radius: var(--radius-xl);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      transition: box-shadow var(--transition-base);

      &:hover { box-shadow: var(--shadow-md); }
    }

    .card-header {
      padding: var(--space-5) var(--space-6);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface);
      display: flex;
      align-items: center;
      justify-content: space-between;

      h3 {
        margin: 0;
        font-size: var(--text-base);
        font-weight: var(--weight-medium);
        color: var(--text-primary);
        letter-spacing: -0.01em;
      }
    }

    .card-body { padding: var(--space-6); }
    .p-0 { padding: 0 !important; }
    .mt-2 { margin-top: var(--space-2) !important; }
    .text-right { text-align: right !important; }
    .text-muted { color: var(--text-tertiary); }

    .tpms-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .form-row { display: grid; gap: var(--space-4); }
    .header-row { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }

    .form-control {
      padding: 9px var(--space-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: var(--font-sans);
      height: 40px;
      width: 100%;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      box-shadow: var(--shadow-xs);

      &:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: var(--shadow-glow);
      }

      &.is-invalid {
        border-color: var(--error);
        &:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15); }
      }

      option { background: var(--surface); color: var(--text-primary); }
    }

    .date-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;

      input { flex: 1; padding-right: 40px; }
      mat-datepicker-toggle { position: absolute; right: 0; color: var(--text-tertiary); }
    }

    .invalid-feedback {
      font-size: var(--text-xs);
      color: var(--error);
      margin-top: 2px;
    }

    .warning-alert {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: var(--warning-light);
      color: var(--warning-dark);
      border-radius: var(--radius-md);
      border: 1px solid rgba(245, 158, 11, 0.3);
      font-size: var(--text-sm);

      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }

    .divider {
      border: 0;
      border-top: 1px solid var(--border-subtle);
      margin: var(--space-2) 0;
    }

    .section-title {
      margin-top: 0;
      margin-bottom: var(--space-3);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .materials-input-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);

      th {
        background: var(--surface-alt);
        text-align: left;
        padding: var(--space-3);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid var(--border);
      }

      td {
        padding: var(--space-3);
        border-bottom: 1px solid var(--border-subtle);
        vertical-align: middle;
        color: var(--text-primary);
      }

      tr:last-child td { border-bottom: none; }
      tr:hover td { background: var(--surface-alt); }
    }

    .actual-input {
      width: 100px;
      padding: 6px var(--space-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: var(--text-sm);

      &:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: var(--shadow-glow);
      }
    }

    .variance-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: var(--radius-full);
      font-weight: var(--weight-medium);
      font-size: 12px;
    }

    .variance-positive { background: var(--error-light); color: var(--error-dark); }
    .variance-negative { background: var(--success-light); color: var(--success-dark); }
    .variance-zero { background: var(--surface-alt); color: var(--text-secondary); }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
      border-top: 1px solid var(--border-subtle);
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    .search-bar {
      position: relative;
      display: flex;
      align-items: center;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0 var(--space-3);
      height: 36px;
      width: 240px;
      background: var(--surface);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      box-shadow: var(--shadow-xs);

      &:focus-within {
        border-color: var(--primary);
        box-shadow: var(--shadow-glow);
      }

      input {
        border: none;
        background: transparent;
        outline: none;
        padding: 0 var(--space-2);
        width: 100%;
        font-size: var(--text-sm);
        color: var(--text-primary);
        font-family: var(--font-sans);

        &::placeholder { color: var(--text-tertiary); }
      }
    }

    .search-icon { color: var(--text-tertiary); font-size: 18px; width: 18px; height: 18px; }
    .history-table { width: 100%; }

    .cost-badge {
      background: var(--primary-50);
      color: var(--primary);
      padding: 3px 10px;
      border-radius: var(--radius-full);
      font-weight: var(--weight-medium);
      font-size: 12px;
    }

    .actions-col { width: 80px; text-align: right; }
    .table-actions { display: flex; justify-content: flex-end; gap: 4px; }

    .action-btn {
      color: var(--text-tertiary);
      width: 32px; height: 32px;
      transition: all var(--transition-fast);
      border-radius: var(--radius-md);

      &:hover { color: var(--primary); background: var(--primary-50); }
    }

    .delete-btn:hover { color: var(--error) !important; background: var(--error-light) !important; }

    .loading-state {
      padding: var(--space-12);
      text-align: center;
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }

    ::ng-deep .tpms-table {
      background: transparent;

      .mat-mdc-header-row {
        background: var(--surface-alt);
        border-bottom: 1px solid var(--border);
      }

      .mat-mdc-header-cell {
        color: var(--text-tertiary);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom-color: var(--border);
        background: var(--surface-alt);
      }

      .mat-mdc-row {
        background: var(--surface);
        border-bottom: 1px solid var(--border-subtle);
        transition: background var(--transition-fast);

        &:hover { background: var(--surface-alt); }
        &:last-child { border-bottom: none; }
      }

      .mat-mdc-cell {
        color: var(--text-primary);
        font-size: var(--text-sm);
        border-bottom-color: var(--border-subtle);
      }
    }

    :host-context([data-theme="dark"]) {
      .cost-badge { background: rgba(99, 102, 241, 0.15); }
      .warning-alert { border-color: rgba(245, 158, 11, 0.2); }
    }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class MaterialsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private materialsService = inject(MaterialsService);
  private productService = inject(ProductService);
  private lineService = inject(LineService);
  private shiftService = inject(ShiftService);
  private recipeService = inject(RecipeService);
  private unitCostService = inject(UnitCostService);
  private materialService = inject(MaterialService);

  materialsForm!: FormGroup;
  saving = false;
  private submissionGuard = new SubmissionGuard();

  /**
   * Identity of the CURRENT logical save attempt. Generated once when a NEW
   * submission begins, reused while the save is uncertain/failed, cleared
   * after a confirmed successful save or an explicit reset.
   * Never derived from business content — a later legitimate entry with
   * identical values must still create a separate record.
   */
  private pendingSubmissionId: string | null = null;

  recipeInfo = false;
  costWarnings: string[] = [];

  // Master Data
  activeProducts: Product[] = [];
  activeLines: Line[] = [];
  unitCosts: UnitCost[] = [];
  activeMaterials: Material[] = [];

  // Maps for history resolution
  productsMap = new Map<string, Product>();
  linesMap = new Map<string, Line>();
  shiftsMap = new Map<string, Shift>();

  // History Data
  history: MaterialRecord[] = [];
  filteredHistory: MaterialRecord[] = [];
  loadingHistory = true;
  searchTerm = '';
  historyColumns: string[] = ['date', 'line', 'shift', 'product', 'mixCount', 'totalCost', 'operator', 'actions'];

  ngOnInit(): void {
    this.initForm();
    this.buildCanonicalRows();
    this.loadMasterData();
  }

  private initForm(): void {
    this.materialsForm = this.fb.group({
      date: [new Date(), Validators.required],
      lineId: ['', Validators.required],
      productId: [''],
      mixCount: [null, [Validators.required, Validators.min(1)]],
      notes: [''],
      materials: this.fb.array([])
    });
  }

  get materials(): FormArray {
    return this.materialsForm.get('materials') as FormArray;
  }

  isInvalid(controlName: string): boolean {
    const control = this.materialsForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  /** The 4 canonical rows are always present — actual per-mix is the input. */
  private buildCanonicalRows(): void {
    this.materials.clear();
    CANONICAL_MATERIALS.forEach(m => {
      const matDef = this.activeMaterials.find(x => x.name.toLowerCase() === m.name.toLowerCase());
      this.materials.push(this.fb.group({
        materialId: [matDef?.id ?? ''],
        materialName: [m.name],
        unit: [m.unit],
        perMixStandard: [0],
        perMixActual: [null, [Validators.required, Validators.min(0)]],
        theoreticalQuantity: [0],
        actualQuantity: [0],
        variance: [0],
        dimensionOk: [false],
        unitCost: [0],
        totalCost: [0]
      }));
    });
  }

  private loadMasterData(): void {
    this.loadingHistory = true;

    this.productService.getAll().subscribe(products => {
      this.activeProducts = products.filter(p => p.active);
      products.forEach(p => this.productsMap.set(p.id, p));
      this.checkMasterDataLoaded();
    });

    this.lineService.getAll().subscribe(lines => {
      this.activeLines = lines.filter(l => l.active);
      lines.forEach(l => this.linesMap.set(l.id, l));
      this.checkMasterDataLoaded();
    });

    this.shiftService.getAll().subscribe(shifts => {
      shifts.forEach(s => this.shiftsMap.set(s.id, s));
      this.checkMasterDataLoaded();
    });

    this.unitCostService.getAll().subscribe(costs => {
      this.unitCosts = costs;
      this.checkMasterDataLoaded();
    });

    this.materialService.getAll().subscribe(materials => {
      this.activeMaterials = materials.filter(m => m.active);
      // Re-resolve canonical row material ids once master materials arrive.
      this.materials.controls.forEach(row => {
        const name = row.get('materialName')?.value;
        const matDef = this.activeMaterials.find(x => x.name.toLowerCase() === name.toLowerCase());
        if (matDef) row.get('materialId')?.setValue(matDef.id);
      });
      this.recomputeAll();
      this.checkMasterDataLoaded();
    });
  }

  private checkMasterDataLoaded(): void {
    if (this.activeMaterials.length >= 0) {
      this.loadHistory();
    }
  }

  private loadHistory(): void {
    this.materialsService.getAll().subscribe({
      next: (data) => {
        this.history = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        this.applyFilter();
        this.loadingHistory = false;
      },
      error: (err) => {
        console.error('Failed to load history', err);
        this.loadingHistory = false;
      }
    });
  }

  getProductName(id: string | undefined): string { return (id && this.productsMap.get(id)?.name) || '—'; }
  getLineName(id: string | undefined): string { return (id && this.linesMap.get(id)?.name) || '—'; }
  getShiftName(id: string | undefined): string { return (id && this.shiftsMap.get(id)?.name) || '—'; }

  onProductChange(): void {
    const productId = this.materialsForm.get('productId')?.value;
    if (!productId) {
      this.recipeInfo = false;
      // Reference standard cleared; actual per mix is never touched.
      this.materials.controls.forEach(row => row.get('perMixStandard')?.setValue(0));
      this.recomputeAll();
      return;
    }

    this.recipeService.getByProduct(productId).subscribe(recipes => {
      if (!recipes || recipes.length === 0) {
        this.recipeInfo = true;
        this.materials.controls.forEach(row => row.get('perMixStandard')?.setValue(0));
        this.recomputeAll();
        return;
      }
      this.recipeInfo = false;
      const recipe = recipes[0];
      // Standard/Mix snapshot → reference only; actual per mix unchanged.
      this.materials.controls.forEach(row => {
        const materialId = row.get('materialId')?.value;
        const recipeItem = recipe.items?.find(r => r.materialId === materialId);
        row.get('perMixStandard')?.setValue(recipeItem ? recipeItem.quantity : 0);
      });
      this.recomputeAll();
    });
  }

  onMixCountChange(): void {
    this.recomputeAll();
  }

  onPerMixChange(index: number): void {
    this.recomputeRow(index);
  }

  /** Recomputes every row + warnings (mix count changed, product/recipe changed). */
  private recomputeAll(): void {
    this.materials.controls.forEach((_, i) => this.recomputeRow(i));
  }

  private recomputeRow(index: number): void {
    const row = this.materials.at(index);
    const mixCount = this.materialsForm.get('mixCount')?.value || 0;
    const perMixStandard = row.get('perMixStandard')?.value || 0;
    const perMixActual = row.get('perMixActual')?.value;
    const materialId = row.get('materialId')?.value;
    const unit = row.get('unit')?.value;

    const theoreticalQuantity = this.materialsService.calculateTheoretical(perMixStandard, mixCount);
    row.get('theoreticalQuantity')?.setValue(theoreticalQuantity);

    if (perMixActual === null || perMixActual === undefined || perMixActual === '') {
      row.get('actualQuantity')?.setValue(0);
      row.get('variance')?.setValue(-theoreticalQuantity);
      row.get('totalCost')?.setValue(0);
      return;
    }

    const actualQuantity = this.materialsService.calculateDailyTotal(perMixActual, mixCount);
    const variance = this.materialsService.calculateVariance(actualQuantity, theoreticalQuantity);

    // Cost safety: dimension-compatible unit cost only — else deferred + warned.
    const costConfig = materialId ? this.unitCosts.find(c => c.materialId === materialId) : undefined;
    const resolved = MaterialConversionUtil.perUnitPriceFromConfig(
      costConfig?.unitCost ?? 0,
      costConfig?.unit,
      unit
    );

    row.get('actualQuantity')?.setValue(actualQuantity);
    row.get('variance')?.setValue(variance);
    row.get('dimensionOk')?.setValue(resolved.compatible);
    row.get('unitCost')?.setValue(resolved.compatible ? resolved.pricePerOperationalUnit : 0);
    row.get('totalCost')?.setValue(resolved.compatible
      ? this.materialsService.calculateMaterialCost(actualQuantity, resolved.pricePerOperationalUnit)
      : 0);

    this.buildCostWarnings();
  }

  private buildCostWarnings(): void {
    const warnings: string[] = [];
    this.materials.controls.forEach(row => {
      const name = row.get('materialName')?.value;
      const unit = row.get('unit')?.value;
      const materialId = row.get('materialId')?.value;
      if (!row.get('dimensionOk')?.value) {
        const cfg = materialId ? this.unitCosts.find(c => c.materialId === materialId) : undefined;
        warnings.push(name + (cfg ? ` (unit cost in ${cfg.unit} ≠ ${unit})` : ' (no unit cost)'));
      }
    });
    this.costWarnings = warnings;
  }

  getVarianceClass(variance: number): string {
    if (variance > 0) return 'variance-positive';
    if (variance < 0) return 'variance-negative';
    return 'variance-zero';
  }

  formatPerMix(value: number): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '0';
    return Number.isInteger(value) ? String(value) : Number(value.toFixed(2)).toString();
  }

  getTotalCost(): number {
    const costs = this.materials.controls.map(ctrl => ctrl.get('totalCost')?.value || 0);
    return this.materialsService.calculateTotalCost(costs);
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredHistory = [...this.history];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredHistory = this.history.filter(record =>
      this.getProductName(record.productId).toLowerCase().includes(term) ||
      this.getLineName(record.lineId).toLowerCase().includes(term) ||
      this.getShiftName(record.shiftId).toLowerCase().includes(term) ||
      (record.operator || '').toLowerCase().includes(term)
    );
  }

  confirmClear(): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Clear material entry?',
        message: 'All unsaved data will be lost.',
        confirmText: 'Clear',
        cancelText: 'Cancel',
        variant: 'warning'
      }
    }).afterClosed().subscribe(confirm => {
      if (confirm) {
        this.resetForm();
      }
    });
  }

  resetForm(): void {
    this.pendingSubmissionId = null; // explicit reset → next entry is a NEW transaction
    this.materialsForm.reset();
    this.materialsForm.get('date')?.setValue(new Date());
    this.materialsForm.get('lineId')?.setValue('');
    this.materialsForm.get('productId')?.setValue('');
    this.recipeInfo = false;
    this.costWarnings = [];
    this.buildCanonicalRows();
  }

  saveMaterials(): void {
    if (this.materialsForm.invalid) {
      this.materialsForm.markAllAsTouched();
      return;
    }

    if (!this.submissionGuard.acquire()) {
      return; // Double-click blocked
    }

    this.saving = true;
    const formValue = this.materialsForm.value;

    const materialsArray: MaterialTransactionItem[] = this.materials.controls.map(c => ({
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

    // Cache the submission id across retries of the SAME logical attempt.
    if (!this.pendingSubmissionId) {
      this.pendingSubmissionId = this.newSubmissionId();
    }
    const idForThisAttempt = this.pendingSubmissionId;

    const record: MaterialRecord = {
      id: `material_sub_${idForThisAttempt}`,
      date: this.formatDate(formValue.date),
      lineId: formValue.lineId,
      productId: formValue.productId || undefined,
      mixCount: formValue.mixCount,
      notes: formValue.notes,
      materials: materialsArray,
      totalCost: this.getTotalCost(),
      createdAt: new Date().toISOString()
    };

    this.materialsService.createIdempotent(record).subscribe({
      next: () => {
        this.saving = false;
        this.submissionGuard.release();
        this.pendingSubmissionId = null; // confirmed saved → next entry is new
        this.resetForm();
        this.loadHistory();
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
        this.submissionGuard.release();
        // pendingSubmissionId intentionally KEPT → retry reuses the same id
      }
    });
  }

  private newSubmissionId(): string {
    // Identity of the save attempt — never derived from business content.
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private formatDate(d: Date): string {
    // Local plant calendar date (YYYY-MM-DD) — toISOString() would shift the
    // day by the UTC offset. Reuses the shared date utility.
    return toLocalCalendarString(d);
  }

  deleteRecord(record: MaterialRecord): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Material Transaction?',
        message: 'Are you sure you want to delete this material record?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        variant: 'danger'
      }
    }).afterClosed().subscribe(confirm => {
      if (confirm) {
        this.materialsService.delete(record.id).subscribe(() => this.loadHistory());
      }
    });
  }

  viewDetails(record: MaterialRecord): void {
    const conversionFactors = new Map<string, number>();
    this.activeMaterials.forEach(m => { if (m.conversionKgPerM3) conversionFactors.set(m.id, m.conversionKgPerM3); });

    this.dialog.open(MaterialsDetailsDialogComponent, {
      width: '860px',
      data: {
        record,
        productName: this.getProductName(record.productId),
        lineName: this.getLineName(record.lineId),
        shiftName: this.getShiftName(record.shiftId),
        conversionFactors
      }
    });
  }

  editRecord(record: MaterialRecord): void {
    this.dialog.open(MaterialsEditDialogComponent, {
      width: '800px',
      data: {
        record,
        productName: this.getProductName(record.productId)
      }
    }).afterClosed().subscribe(updated => {
      if (updated) {
        this.loadHistory();
      }
    });
  }
}