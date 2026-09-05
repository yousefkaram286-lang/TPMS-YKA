import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { forkJoin, of, Observable } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { ProductionService } from '../../core/services/production.service';
import { ProductionSessionService } from '../../core/services/production-session.service';
import { ProductService } from '../../core/services/product.service';
import { LineService } from '../../core/services/line.service';
import { LineProductService } from '../../core/services/line-product.service';
import { ShiftService } from '../../core/services/shift.service';
import { Production } from '../../core/models/production.model';
import { ProductionSession, ProductionDowntimeEvent } from '../../core/models/production-session.model';
import { Product } from '../../core/models/product.model';
import { Line } from '../../core/models/line.model';
import { Shift } from '../../core/models/shift.model';
import { LineProductMapping } from '../../core/models/line-product.model';
import { ProductionViewDialogComponent } from './production-view-dialog.component';
import { ProductionUtil, SubmissionGuard } from '../../core/utils/production.util';
import { MasterDataUtil } from '../../core/utils/master-data.util';
import { toLocalCalendarString, parseLocalCalendarDate } from '../../core/utils/date.util';

@Component({
  selector: 'app-production',
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
    <div class="production-container">
      <app-page-header
        title="Production"
        subtitle="Record and manage daily factory production"
        icon="precision_manufacturing"
      ></app-page-header>

      <div class="production-content">
        <!-- Entry Form Section -->
        <div class="card production-entry-card">
          <div class="card-header">
            <h3>{{ editingSessionId ? 'Edit Production' : 'Production Entry' }}</h3>
          </div>
          
          <form [formGroup]="productionForm" class="card-body tpms-form">
            
            <!-- SECTION A: Production Information -->
            <div class="section-label">A. Production Information</div>
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
                <label>Shift</label>
                <select formControlName="shiftId" class="form-control" [class.is-invalid]="isInvalid('shiftId')">
                  <option value="" disabled>Select Shift</option>
                  <option *ngFor="let shift of activeShifts" [value]="shift.id">{{ shift.name }}</option>
                </select>
              </div>

              <div class="form-group">
                <label>Line *</label>
                <select formControlName="lineId" class="form-control" (change)="onLineChange()" [class.is-invalid]="isInvalid('lineId')">
                  <option value="" disabled>Select Line</option>
                  <option *ngFor="let line of activeLines" [value]="line.id">{{ line.name }}</option>
                </select>
                <div class="invalid-feedback" *ngIf="isInvalid('lineId')">Line is required.</div>
              </div>

              <div class="form-group">
                <label>Supervisor</label>
                <input type="text" formControlName="supervisor" class="form-control" [class.is-invalid]="isInvalid('supervisor')" placeholder="Supervisor name">
              </div>
            </div>

            <hr class="divider">

            <!-- SECTION B: Production Output -->
            <div class="section-label">B. Production Output</div>
            <div formArrayName="items" class="products-list">
              <div class="products-header">
                <div class="col-product">Product</div>
                <div class="col-pieces">Pieces/Press</div>
                <div class="col-presses">Presses</div>
                <div class="col-produced">Produced</div>
                <div class="col-actions"></div>
              </div>

              <div class="product-row" *ngFor="let item of items.controls; let i = index" [formGroupName]="i">
                <!-- Product Select -->
                <div class="col-product form-group mb-0">
                  <select formControlName="productId" class="form-control" (change)="onProductChange(i)" [class.is-invalid]="item.get('productId')?.invalid && item.get('productId')?.touched">
                    <option value="" disabled>[ Select Product ▼ ]</option>
                    <option *ngFor="let product of activeProducts" [value]="product.id">{{ product.name }}</option>
                  </select>
                </div>

                <!-- Pieces / Press -->
                <div class="col-pieces form-group mb-0">
                  <input type="number" formControlName="piecesPerPress" class="form-control readonly-input" readonly tabindex="-1">
                  <div class="invalid-feedback" *ngIf="item.get('piecesPerPress')?.hasError('noConfig')" style="display: block;">
                    Pieces/Press not set in Product master data
                  </div>
                </div>

                <!-- Presses -->
                <div class="col-presses form-group mb-0">
                  <input type="number" formControlName="presses" class="form-control" (input)="calculateRowProduced(i)" [class.is-invalid]="item.get('presses')?.invalid && item.get('presses')?.touched" min="0">
                </div>

                <!-- Produced -->
                <div class="col-produced form-group mb-0">
                  <div class="produced-value">{{ item.get('produced')?.value || 0 }}</div>
                </div>

                <!-- Actions -->
                <div class="col-actions">
                  <button type="button" mat-icon-button color="warn" (click)="removeItem(i)" [disabled]="items.length === 1">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>

              <div class="products-footer">
                <button type="button" mat-button color="primary" (click)="addItem()">
                  <mat-icon>add</mat-icon> Add Product
                </button>
              </div>
            </div>

            <hr class="divider">

            <!-- SECTION C: Daily Line Time -->
            <div class="section-label">C. Daily Line Time & Overtime</div>
            
            <div class="form-row" style="margin-bottom: 16px;">
              <div class="form-group" style="width: 200px;">
                <label>Overtime Occurred? *</label>
                <select formControlName="overtime" class="form-control" (change)="onOvertimeChange()">
                  <option [ngValue]="false">No</option>
                  <option [ngValue]="true">Yes</option>
                </select>
              </div>
              <div class="form-group" style="width: 200px;">
                <label>Total Overtime Hours</label>
                <input type="number" formControlName="overtimeHours" class="form-control" min="0" step="0.5" [class.is-invalid]="isInvalid('overtimeHours')">
              </div>
            </div>

            <div class="sub-section-label">Downtime Events <span class="sub-hint">— multiple allowed for the selected line</span></div>

            <div formArrayName="downtimeEvents" class="line-time-list">
              <div class="line-time-header dte-header">
                <div class="col-dte-duration">Duration (min)</div>
                <div class="col-dte-reason">Reason</div>
                <div class="col-dte-notes">Notes</div>
                <div class="col-dte-actions"></div>
              </div>

              <div class="line-time-row dte-row" *ngFor="let ev of downtimeEvents.controls; let i = index" [formGroupName]="i">
                <div class="col-dte-duration form-group mb-0">
                   <input type="number" formControlName="durationMinutes" class="form-control" min="0" [class.is-invalid]="ev.get('durationMinutes')?.value < 0">
                </div>
                <div class="col-dte-reason form-group mb-0">
                   <input type="text" formControlName="reason" class="form-control" placeholder="Free-text reason (e.g. Breakdown)">
                </div>
                <div class="col-dte-notes form-group mb-0">
                   <input type="text" formControlName="notes" class="form-control" placeholder="Optional notes">
                </div>
                <div class="col-dte-actions">
                  <button type="button" mat-icon-button color="warn" (click)="removeDowntimeEvent(i)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>

              <div class="products-footer" style="margin-top: var(--space-2); padding-top: var(--space-2);">
                <button type="button" mat-button color="primary" (click)="addDowntimeEvent()">
                  <mat-icon>add</mat-icon> Add Downtime Event
                </button>
              </div>
            </div>

            <hr class="divider">

            <!-- SECTION D: Notes -->
            <div class="section-label">D. Session Notes</div>
            <div class="form-group">
               <textarea formControlName="notes" class="form-control notes-area" placeholder="Enter any overall observations or notes for this production session..."></textarea>
            </div>

            <!-- SECTION E: Summary Panel -->
            <div class="summary-panel">
               <div class="summary-item">
                  <span class="s-label">Total Produced</span>
                  <span class="s-value">{{ getTotalProduced() | number }}</span>
               </div>
               <div class="summary-item">
                  <span class="s-label">Total Presses</span>
                  <span class="s-value">{{ getTotalPresses() | number }}</span>
               </div>
               <div class="summary-item">
                  <span class="s-label">Downtime</span>
                  <span class="s-value downtime">{{ getTotalDowntime() }} min</span>
               </div>
               <div class="summary-item">
                  <span class="s-label">Overtime</span>
                  <span class="s-value overtime">{{ productionForm.get('overtimeHours')?.value || 0 }} hrs</span>
               </div>
               <div class="summary-item">
                  <span class="s-label">Available</span>
                  <span class="s-value">{{ getAvailableMinutes() }} min</span>
               </div>
               <div class="summary-item">
                  <span class="s-label">Actual</span>
                  <span class="s-value">{{ getActualRunMinutes() }} min</span>
               </div>
               <div class="summary-item">
                  <span class="s-label">Efficiency</span>
                  <span class="s-value">{{ getEfficiencyPercent() | number:'1.1-1' }}%</span>
               </div>
            </div>

            <div *ngIf="saveError" class="save-error">
              <mat-icon>error_outline</mat-icon>
              <span>{{ saveError }}</span>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="confirmClear()">{{ editingSessionId ? 'Cancel' : 'Clear' }}</button>
              <button type="button" class="btn-primary" (click)="saveProduction()" [disabled]="productionForm.invalid || saving">
                {{ saving ? 'Saving...' : (editingSessionId ? 'Update Session' : 'Save Session') }}
              </button>
            </div>
          </form>
        </div>

        <!-- History Section -->
        <div class="card history-card">
          <div class="card-header history-header">
            <h3>Production History</h3>
            <div class="history-actions">
              <div class="search-bar">
                <mat-icon class="search-icon">search</mat-icon>
                <input type="text" placeholder="Search..." [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
              </div>
            </div>
          </div>
          
          <div class="card-body p-0">
            <div *ngIf="loadingHistory" class="loading-state">Loading history...</div>
            
            <app-empty-state
              *ngIf="!loadingHistory && !filteredHistory.length"
              icon="history"
              title="No production records yet."
              description="Start by adding your first production entry."
              variant="neutral"
            ></app-empty-state>

            <div class="table-responsive" *ngIf="!loadingHistory && filteredHistory.length > 0">
              <table mat-table [dataSource]="filteredHistory" class="tpms-table history-table">
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef> Date </th>
                  <td mat-cell *matCellDef="let element"> {{element.date | date:'shortDate'}} </td>
                </ng-container>

                <ng-container matColumnDef="product">
                  <th mat-header-cell *matHeaderCellDef> Product </th>
                  <td mat-cell *matCellDef="let element"> <span class="font-medium text-primary">{{getProductName(element.productId)}}</span> </td>
                </ng-container>

                <ng-container matColumnDef="line">
                  <th mat-header-cell *matHeaderCellDef> Line </th>
                  <td mat-cell *matCellDef="let element"> {{getLineName(element.lineId)}} </td>
                </ng-container>

                <ng-container matColumnDef="shift">
                  <th mat-header-cell *matHeaderCellDef> Shift </th>
                  <td mat-cell *matCellDef="let element"> {{getShiftName(element.shiftId)}} </td>
                </ng-container>

                <ng-container matColumnDef="presses">
                  <th mat-header-cell *matHeaderCellDef> Presses </th>
                  <td mat-cell *matCellDef="let element"> {{element.presses}} </td>
                </ng-container>

                <ng-container matColumnDef="produced">
                  <th mat-header-cell *matHeaderCellDef> Produced </th>
                  <td mat-cell *matCellDef="let element"> 
                    <span class="produced-badge">{{element.produced}}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="actions-col"> Actions </th>
                  <td mat-cell *matCellDef="let element" class="actions-col">
                    <div class="table-actions">
                      <button mat-icon-button class="action-btn" title="View Details" (click)="viewDetails(element)"><mat-icon>visibility</mat-icon></button>
                      <button mat-icon-button class="action-btn" title="Edit Session" (click)="editSession(element)"><mat-icon>edit</mat-icon></button>
                      <button mat-icon-button class="action-btn delete-btn" title="Delete Session" (click)="deleteProduction(element)"><mat-icon>delete</mat-icon></button>
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

    .production-container {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      padding: var(--space-6);
      max-width: 1200px;
      margin: 0 auto;
    }

    /* ── Card Base ─────────────────────────────────── */
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
    .mb-0 { margin-bottom: 0 !important; }

    /* ── Form ──────────────────────────────────────── */
    .tpms-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }
    
    .section-label {
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: var(--space-2);
      margin-bottom: var(--space-2);
      border-left: 4px solid var(--primary);
      padding-left: var(--space-2);
    }

    .form-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
    }

    .header-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

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
      
      &:disabled {
        background-color: var(--surface-alt);
        cursor: not-allowed;
      }

      option { background: var(--surface); color: var(--text-primary); }
    }
    
    .notes-area {
       height: 80px;
       resize: vertical;
    }

    .date-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;

      input { flex: 1; padding-right: 40px; }
      mat-datepicker-toggle { position: absolute; right: 0; color: var(--text-tertiary); }
    }

    .readonly-input {
      background-color: var(--surface-alt);
      color: var(--text-secondary);
      cursor: not-allowed;
      border-color: transparent;
    }

    .invalid-feedback {
      font-size: var(--text-xs);
      color: var(--error);
      margin-top: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .save-error {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: var(--error-light, rgba(239, 68, 68, 0.08));
      border: 1px solid var(--error);
      border-radius: var(--radius-md);
      color: var(--error);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .divider {
      border: 0;
      border-top: 1px solid var(--border-subtle);
      margin: var(--space-2) 0;
    }

    /* ── Products List ─────────────────────────────── */
    .products-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .products-header {
      display: grid;
      grid-template-columns: 3fr 1fr 1fr 1fr 48px;
      gap: var(--space-4);
      align-items: center;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      background: var(--surface-alt);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .product-row {
      display: grid;
      grid-template-columns: 3fr 1fr 1fr 1fr 48px;
      gap: var(--space-4);
      align-items: center;
      padding: var(--space-2) var(--space-1);
      border-radius: var(--radius-md);
      transition: background var(--transition-fast);

      &:hover { background: var(--surface-alt); }
    }

    .col-product { min-width: 0; }
    .col-pieces, .col-presses { min-width: 80px; }
    .col-produced { min-width: 80px; display: flex; justify-content: center; }
    .col-actions { display: flex; justify-content: center; }

    .produced-value {
      font-size: var(--text-base);
      font-weight: var(--weight-semibold);
      color: var(--primary);
      background: var(--primary-50);
      padding: 4px var(--space-3);
      border-radius: var(--radius-full);
      min-width: 60px;
      text-align: center;
    }

    .products-footer {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      padding-top: var(--space-4);
      border-top: 1px dashed var(--border);
      margin-top: var(--space-2);
    }
    
    /* ── Line Time List ─────────────────────────────── */
    .sub-section-label {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      color: var(--text-primary);
      margin: var(--space-2) 0 var(--space-2);
      display: flex;
      align-items: center;
      gap: var(--space-2);

      .sub-hint {
        font-size: var(--text-xs);
        font-weight: var(--weight-regular);
        color: var(--text-tertiary);
      }
    }

    .line-time-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .line-time-header, .line-time-row {
      display: grid;
      grid-template-columns: 140px 2fr 2fr 48px;
      gap: var(--space-4);
      align-items: center;
      padding: var(--space-2) var(--space-3);
    }

    .line-time-header {
      border-radius: var(--radius-md);
      background: var(--surface-alt);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .line-time-row {
      border-radius: var(--radius-md);
      transition: background var(--transition-fast);
      &:hover { background: var(--surface-alt); }
    }
    

    /* ── Summary Panel ─────────────────────────────── */
    .summary-panel {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      background: var(--surface-alt);
      padding: var(--space-4) var(--space-6);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
      margin-top: var(--space-2);
      justify-content: space-between;
    }
    
    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: center;
    }
    
    .s-label {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      text-transform: uppercase;
      font-weight: var(--weight-medium);
      letter-spacing: 0.05em;
    }
    
    .s-value {
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      color: var(--text-primary);
      
      &.released { color: var(--success, #16a34a); }
      &.downtime { color: var(--warning-dark, #b45309); }
      &.overtime { color: var(--primary); }
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
      border-top: 1px solid var(--border-subtle);
    }

    /* ── History Card ──────────────────────────────── */
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

    /* ── Table ─────────────────────────────────────── */
    .table-responsive { overflow-x: auto; }

    .history-table { width: 100%; }

    .produced-badge {
      background: var(--primary-50);
      color: var(--primary);
      padding: 3px 10px;
      border-radius: var(--radius-full);
      font-weight: var(--weight-medium);
      font-size: 12px;
    }

    .font-medium { font-weight: var(--weight-medium); }
    .text-primary { color: var(--text-primary); }

    .actions-col { width: 120px; text-align: right; }
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

    /* ── Mat Table Overrides ───────────────────────── */
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

    /* ── Dark Mode Overrides ──────────────────────── */
    :host-context([data-theme="dark"]) {
      .produced-value, .total-produced { background: rgba(99, 102, 241, 0.12); }
      .produced-badge { background: rgba(99, 102, 241, 0.15); }
    }
  `]
})
export class ProductionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private productionService = inject(ProductionService);
  private productionSessionService = inject(ProductionSessionService);
  private productService = inject(ProductService);
  private lineService = inject(LineService);
  private shiftService = inject(ShiftService);
  private lineProductService = inject(LineProductService);

  productionForm!: FormGroup;
  saving = false;
  editingSessionId: string | null = null;
  private pendingSessionId: string | null = null;
  saveError = '';
  private submissionGuard = new SubmissionGuard();

  // Master Data
  activeProducts: Product[] = [];
  activeLines: Line[] = [];
  activeShifts: Shift[] = [];
  lineProducts: LineProductMapping[] = [];
  
  // Data Maps for fast lookup
  productsMap = new Map<string, Product>();
  linesMap = new Map<string, Line>();
  shiftsMap = new Map<string, Shift>();
  sessionsMap = new Map<string, ProductionSession>();

  // History Data
  history: Production[] = [];
  filteredHistory: Production[] = [];
  loadingHistory = true;
  searchTerm = '';
  historyColumns: string[] = ['date', 'product', 'line', 'shift', 'presses', 'produced', 'actions'];

  get items(): FormArray {
    return this.productionForm.get('items') as FormArray;
  }
  
  get downtimeEvents(): FormArray {
    return this.productionForm.get('downtimeEvents') as FormArray;
  }

  ngOnInit(): void {
    this.initForm();
    this.loadMasterData();
  }

  private initForm(): void {
    this.productionForm = this.fb.group({
      date: [new Date(), Validators.required],
      shiftId: [''],
      lineId: ['', Validators.required],
      supervisor: [''],
      items: this.fb.array([]),
      
      // Session fields
      overtime: [false],
      overtimeHours: [{value: 0, disabled: true}, [Validators.min(0)]],
      downtimeEvents: this.fb.array([]),
      notes: ['']
    });

    // Start with one empty product row
    this.addItem();
  }

  createItem(): FormGroup {
    return this.fb.group({
      productId: ['', Validators.required],
      piecesPerPress: [0, Validators.required],
      presses: [0, [Validators.required, Validators.min(0)]],
      produced: [0, Validators.required]
    });
  }

  addItem(): void {
    this.items.push(this.createItem());
  }

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
    }
  }
  
  /**
   * Creates one downtime event FormGroup for the SELECTED line. Events are
   * free-form (durationMinutes / reason / notes) — no invented classifications.
   */
  createDowntimeEvent(event?: ProductionDowntimeEvent): FormGroup {
    return this.fb.group({
      durationMinutes: [event?.durationMinutes ?? 0, [Validators.min(0)]],
      reason: [event?.reason ?? ''],
      notes: [event?.notes ?? '']
    });
  }

  addDowntimeEvent(): void {
    this.downtimeEvents.push(this.createDowntimeEvent());
  }

  removeDowntimeEvent(index: number): void {
    this.downtimeEvents.removeAt(index);
  }

  onOvertimeChange(): void {
    const overtime = this.productionForm.get('overtime')?.value;
    const hoursCtrl = this.productionForm.get('overtimeHours');
    if (overtime) {
      hoursCtrl?.enable();
    } else {
      hoursCtrl?.disable();
      hoursCtrl?.setValue(0);
    }
  }

  isInvalid(controlName: string): boolean {
    const control = this.productionForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onLineChange(): void {
    const lineId = this.productionForm.get('lineId')?.value;
    this.applyLineProductFilter(lineId);

    // Reset items because the available products change per line
    this.items.controls.forEach((_, i) => {
      if (!this.isProductAllowed(this.items.at(i).get('productId')?.value)) {
        this.items.at(i).get('productId')?.setValue('');
        this.items.at(i).get('piecesPerPress')?.setValue(0);
      }
      this.calculateRowProduced(i);
    });
  }

  /**
   * Filters the selectable products for the chosen line using the approved
   * Line ↔ Product mappings. A line with no approved mapping (e.g. Line 5
   * until the Interlock master is confirmed) exposes NO products, so no
   * unapproved Block/Solid can ever be picked on it.
   */
  private applyLineProductFilter(lineId: string): void {
    const allActive = this.productsMap.size > 0
      ? this.allActiveProducts()
      : [];
    const allowed = new Set(
      this.lineProducts.filter(lp => lp.lineId === lineId).map(lp => lp.productId)
    );
    this.activeProducts = allActive.filter(p => allowed.has(p.id));
  }

  private allActiveProducts(): Product[] {
    return [...this.productsMap.values()].filter(p => p.active);
  }

  private isProductAllowed(productId: string | null | undefined): boolean {
    if (!productId) {
      return true; // empty selection never needs resetting
    }
    return this.activeProducts.some(p => p.id === productId);
  }

  onProductChange(index: number): void {
    this.updateRowConfig(index);
  }

  private updateRowConfig(index: number): void {
    const row = this.items.at(index);
    const productId = row.get('productId')?.value;

    if (!productId) {
      row.get('piecesPerPress')?.setValue(0);
      this.calculateRowProduced(index);
      return;
    }

    // PiecesPerPress is supplied by Product master data.
    const product = this.productsMap.get(productId);
    const pieces = MasterDataUtil.piecesPerPressOf(product);

    if (ProductionUtil.isConfigured(pieces)) {
      row.get('piecesPerPress')?.setValue(pieces!);
      row.get('piecesPerPress')?.setErrors(null);
    } else {
      row.get('piecesPerPress')?.setValue(0);
      row.get('piecesPerPress')?.setErrors({ noConfig: true });
    }

    this.calculateRowProduced(index);
  }

  calculateRowProduced(index: number): void {
    const row = this.items.at(index);
    const pieces = row.get('piecesPerPress')?.value || 0;
    const presses = row.get('presses')?.value || 0;
    row.get('produced')?.setValue(ProductionUtil.calculateProduced(pieces, presses));
  }

  getTotalProduced(): number {
    let total = 0;
    this.items.controls.forEach(row => {
      total += (row.get('produced')?.value || 0);
    });
    return total;
  }
  
  getTotalPresses(): number {
    let total = 0;
    this.items.controls.forEach(row => {
      total += (row.get('presses')?.value || 0);
    });
    return total;
  }
  
  getTotalDowntime(): number {
    return ProductionUtil.sumDowntime(
      this.downtimeEvents.controls.map(c => ({ durationMinutes: c.get('durationMinutes')?.value }))
    );
  }

  getOvertimeHours(): number {
    return Number(this.productionForm.get('overtimeHours')?.value) || 0;
  }

  getAvailableMinutes(): number {
    return ProductionUtil.availableMinutes(this.getOvertimeHours());
  }

  getActualRunMinutes(): number {
    return ProductionUtil.actualRunMinutes(
      this.getOvertimeHours(),
      this.downtimeEvents.controls.map(c => ({ durationMinutes: c.get('durationMinutes')?.value }))
    );
  }

  getEfficiencyPercent(): number {
    return ProductionUtil.efficiencyPercent(
      this.getOvertimeHours(),
      this.downtimeEvents.controls.map(c => ({ durationMinutes: c.get('durationMinutes')?.value }))
    );
  }

  saveProduction(): void {
    if (this.saving) return;
    if (!this.submissionGuard.acquire()) return;
    this.saveError = '';

    if (this.productionForm.invalid) {
      this.productionForm.markAllAsTouched();
      this.submissionGuard.release();
      return;
    }

    const formValue = this.productionForm.getRawValue();

    // ── Reference integrity ──────────────────────────────────────────────
    const line = this.linesMap.get(formValue.lineId);
    if (!line) {
      this.saveError = 'Selected Line is not valid. Production must be recorded per Production Line.';
      this.submissionGuard.release();
      return;
    }

    // Historical-integrity guard (Index matches buildItemRecords() FIFO reuse of
    // existing record ids). An UNCHANGED existing item may keep referencing a
    // Product that has since been deactivated; NEW/CHANGED references must
    // satisfy today's active master.
    const existingItems = this.editingSessionId
      ? this.history.filter(h => h.sessionId === this.editingSessionId)
      : [];

    for (let idx = 0; idx < formValue.items.length; idx++) {
      const item = formValue.items[idx];
      if (!ProductionUtil.isValidPressCount(item.presses)) {
        this.saveError = 'Press count cannot be negative.';
        this.submissionGuard.release();
        return;
      }
      const product = this.productsMap.get(item.productId);
      const referenceStatus = ProductionUtil.resolveProductReferenceStatus({
        editing: !!this.editingSessionId,
        existingProductId: existingItems[idx]?.productId,
        nextProductId: item.productId,
        productExists: !!product,
        productActive: product?.active ?? false
      });
      if (referenceStatus === 'blocked' || !product) {
        this.saveError = 'Selected product is not valid or not active.';
        this.submissionGuard.release();
        return;
      }
      if (!ProductionUtil.isConfigured(MasterDataUtil.piecesPerPressOf(product))) {
        this.saveError = `Product "${product.name}" has no PiecesPerPress configured. Set it in Settings > Products before recording production.`;
        this.submissionGuard.release();
        return;
      }
    }

    this.saving = true;

    const isoDate = this.formatDate(formValue.date);
    const sessionId = this.editingSessionId
      || this.pendingSessionId
      || this.generateId('sess_');
    if (!this.editingSessionId) {
      this.pendingSessionId = sessionId;
    }

    let records: Production[];
    try {
      records = this.buildItemRecords(sessionId, isoDate, formValue);
    } catch (err: any) {
      this.saveError = err?.message || 'Invalid production data.';
      this.saving = false;
      this.submissionGuard.release();
      return;
    }

    if (records.length === 0) {
      this.saveError = 'At least one product line is required.';
      this.saving = false;
      this.submissionGuard.release();
      return;
    }

    if (this.editingSessionId) {
      this.saveEditedSession(sessionId, isoDate, formValue, records);
    } else {
      this.saveNewSession(sessionId, isoDate, formValue, records);
    }
  }

  /**
   * Builds Production records. ProducedQuantity is ALWAYS recomputed from
   * NumberOfPresses × PiecesPerPress (snapshot); form-supplied values are ignored.
   *
   * New entries use deterministic record ids (sessionId:index) so retries of the
   * same submission produce identical primary keys — IndexedDB rejects the duplicate.
   * Edit mode reuses existing record ids by consuming them in FIFO order so that
   * same-product repeated rows are handled correctly.
   */
  private buildItemRecords(sessionId: string, isoDate: string, formValue: any): Production[] {
    const existingItems = this.editingSessionId
      ? this.history.filter(h => h.sessionId === this.editingSessionId)
      : [];
    const remaining = [...existingItems];

    return formValue.items.map((item: any, index: number) => {
      let existing: Production | undefined;
      if (remaining.length > 0) {
        existing = remaining.shift();
      }
      const createdAt = existing?.createdAt || new Date().toISOString();

      return this.productionService.createProductionRecord({
        id: existing?.id || `${sessionId}:${index}`,
        sessionId,
        date: isoDate,
        lineId: formValue.lineId,
        productId: item.productId,
        shiftId: formValue.shiftId || undefined,
        supervisor: (formValue.supervisor || '').trim(),
        piecesPerPress: item.piecesPerPress,
        presses: item.presses,
        createdAt
      });
    });
  }

  private buildSessionRecord(sessionId: string, isoDate: string, formValue: any): ProductionSession {
    const existing = this.editingSessionId ? this.sessionsMap.get(this.editingSessionId) : undefined;

    // Downtime is captured as MULTIPLE events for the single selected line.
    const events: ProductionDowntimeEvent[] = (formValue.downtimeEvents || [])
      .map((ev: any): ProductionDowntimeEvent => ({
        durationMinutes: Number(ev.durationMinutes) || 0,
        reason: (ev.reason || '').trim(),
        notes: (ev.notes || '').trim()
      }))
      .filter((ev: ProductionDowntimeEvent) => ev.durationMinutes > 0);

    const totalDowntime = ProductionUtil.sumDowntime(events);
    const firstReason = events.find(ev => ev.reason)?.reason || '';
    const firstNotes = events.find(ev => ev.notes)?.notes || '';

    // SINGLE authoritative overtime source: the user-entered overtimeHours.
    // Stored directly; converted to minutes only inside calculation helpers.
    const overtimeHours = formValue.overtimeHours || 0;

    const sessionRecord: ProductionSession = {
      id: sessionId,
      date: isoDate,
      shiftId: formValue.shiftId || '',
      lineId: formValue.lineId,
      supervisor: (formValue.supervisor || '').trim(),
      overtime: formValue.overtime,
      overtimeHours: overtimeHours,
      dailyLineTime: [{
        lineId: formValue.lineId,
        lineName: this.linesMap.get(formValue.lineId)?.name || '',
        overtimeHours: overtimeHours,
        downtimeMinutes: totalDowntime,
        downtimeReason: firstReason,
        notes: firstNotes
      }],
      downtimeEvents: events,
      notes: formValue.notes || '',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Legacy-only: preserve any previously releasedOutput on edit so the
    // OutputRelease migration never loses historical data. New records omit it.
    if (existing && typeof existing.releasedOutput === 'number') {
      sessionRecord.releasedOutput = existing.releasedOutput;
    }

    return sessionRecord;
  }

  private saveNewSession(sessionId: string, isoDate: string, formValue: any, records: Production[]): void {
    const sessionRecord = this.buildSessionRecord(sessionId, isoDate, formValue);

    // To respect PostgreSQL foreign keys, the session MUST exist before its child records.
    this.productionSessionService.getById(sessionId).pipe(
      switchMap(existingSession => {
        if (existingSession) {
          // Idempotency: Session already exists (e.g. from a partial previous save).
          // Replace its old records with the new ones.
          return this.productionService.getBySessionId(sessionId).pipe(
            switchMap(existingRecords => {
               if (existingRecords.length > 0) {
                 return forkJoin(existingRecords.map(r => this.productionService.delete(r.id))).pipe(
                   switchMap(() => forkJoin(records.map(r => this.productionService.create(r))))
                 );
               }
               return forkJoin(records.map(r => this.productionService.create(r)));
            })
          );
        } else {
          // Fresh save: Create session FIRST
          return this.productionSessionService.create(sessionRecord).pipe(
            switchMap(() => {
              // Then create the child records
              return forkJoin(records.map(r => this.productionService.create(r))).pipe(
                catchError((err: any) => {
                   // Rollback session if child creation fails
                   this.productionSessionService.delete(sessionId).subscribe();
                   throw err;
                })
              );
            })
          );
        }
      })
    ).subscribe({
      next: () => {
        this.finishSave();
      },
      error: (err) => {
        console.error('Error saving session or production items:', err);
        this.saveError = 'Failed to persist the production session. No production data was saved.';
        this.saving = false;
        this.submissionGuard.release();
      }
    });
  }

  private saveEditedSession(sessionId: string, isoDate: string, formValue: any, records: Production[]): void {
    const sessionRecord = this.buildSessionRecord(sessionId, isoDate, formValue);
    const existingItems = this.history.filter(h => h.sessionId === this.editingSessionId);

    const removed = existingItems.filter(
      ex => !records.some(r => r.id === ex.id)
    );
    const updates = records.filter(r =>
      existingItems.some(ex => ex.id === r.id)
    );
    const creates = records.filter(r =>
      !existingItems.some(ex => ex.id === r.id)
    );

    // Ensure session update happens. Then safely forkJoin the items (using of([]) for empty arrays).
    this.productionSessionService.update(sessionRecord).pipe(
      switchMap(() => updates.length > 0 ? forkJoin(updates.map(r => this.productionService.update(r))) : of([])),
      switchMap(() => creates.length > 0 ? forkJoin(creates.map(r => this.productionService.create(r))) : of([])),
      switchMap(() => removed.length > 0 ? forkJoin(removed.map(r => this.productionService.delete(r.id))) : of([]))
    ).subscribe({
      next: () => this.finishSave(),
      error: (err) => {
        console.error('Error updating session:', err);
        this.saveError = 'Failed to persist the edited session. Please reload and verify data integrity.';
        this.saving = false;
        this.submissionGuard.release();
        this.loadHistory();
      }
    });
  }

  private finishSave(): void {
    this.saving = false;
    this.submissionGuard.release();
    this.editingSessionId = null;
    this.pendingSessionId = null;
    this.clearForm();
    this.loadHistory();
  }
  
  editSession(record: Production): void {
     if (!record.sessionId) {
        alert('Cannot edit this legacy record. It was created before the Session feature was added.');
        return;
     }
     
     const session = this.sessionsMap.get(record.sessionId);
     if (!session) {
        alert('Session data not found for this record.');
        return;
     }
     
     this.editingSessionId = session.id;
     
     // Find all items for this session
     const sessionItems = this.history.filter(h => h.sessionId === session.id);
     
     // Populate header and session data
     this.productionForm.patchValue({
        date: parseLocalCalendarDate(session.date) ?? new Date(),
        shiftId: session.shiftId,
        lineId: session.lineId,
        supervisor: session.supervisor,
        overtime: session.overtime,
        overtimeHours: session.overtimeHours,
        notes: session.notes
     });
     
     // Enable/disable overtime hours
     this.onOvertimeChange();
     
     // Populate items array
     this.items.clear();
     sessionItems.forEach(item => {
        const group = this.createItem();
        group.patchValue({
           productId: item.productId,
           piecesPerPress: item.piecesPerPress,
           presses: item.presses,
           produced: item.produced
        });
        this.items.push(group);
     });
     
     // Populate downtime events for the selected line. Historical scalar-only
     // sessions are transformed into one compatibility event so legacy downtime
     // is never shown as zero nor lost on a later Save (PROD-BIZ-12 / 13).
     this.downtimeEvents.clear();
     ProductionUtil.legacyDowntimeEvents(session).forEach(ev => {
        this.downtimeEvents.push(this.createDowntimeEvent(ev));
     });
     
     window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteProduction(record: Production): void {
    const title = record.sessionId ? 'Delete Entire Session?' : 'Delete Record?';
    const msg = record.sessionId 
      ? 'This will delete the entire production session (including all products, downtime, and overtime logged with it). Are you sure?'
      : 'Are you sure you want to delete this legacy production record?';
      
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: title,
        message: msg,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        variant: 'danger'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
         if (record.sessionId) {
            // Delete the session and all associated items
            const sessionItems = this.history.filter(h => h.sessionId === record.sessionId);
            const ops$ = sessionItems.map(item => this.productionService.delete(item.id));
            ops$.push(this.productionSessionService.delete(record.sessionId));
            
            forkJoin(ops$).subscribe({
               next: () => this.loadHistory(),
               error: err => console.error('Error deleting session:', err)
            });
         } else {
            // Legacy delete
            this.productionService.delete(record.id).subscribe({
               next: () => this.loadHistory(),
               error: err => console.error('Error deleting record:', err)
            });
         }
      }
    });
  }
  
  viewDetails(record: Production): void {
     const session = record.sessionId ? this.sessionsMap.get(record.sessionId) || null : null;
     
     this.dialog.open(ProductionViewDialogComponent, {
        data: {
           record,
           session,
           productName: this.getProductName(record.productId),
           lineName: this.getLineName(record.lineId),
           shiftName: this.getShiftName(record.shiftId)
        }
     });
  }

  confirmClear(): void {
    if (this.productionForm.dirty) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Clear form?',
          message: 'All unsaved data will be lost.',
          confirmText: 'Clear',
          cancelText: 'Cancel',
          variant: 'warning'
        }
      });

      dialogRef.afterClosed().subscribe(confirmed => {
        if (confirmed) {
          this.clearForm();
        }
      });
    } else {
      this.clearForm();
    }
  }

  clearForm(): void {
    this.editingSessionId = null;
    this.pendingSessionId = null;
    this.items.clear();
    this.addItem();

    this.productionForm.reset({
      date: new Date(),
      shiftId: '',
      lineId: '',
      supervisor: '',
      overtime: false,
      overtimeHours: {value: 0, disabled: true},
      notes: ''
    });
    
    this.downtimeEvents.clear();
    this.saveError = '';
    this.productionForm.markAsPristine();
    this.productionForm.markAsUntouched();
  }

  applyFilter(): void {
    const search = this.searchTerm.toLowerCase();
    this.filteredHistory = this.history.filter(record => {
      const product = this.getProductName(record.productId).toLowerCase();
      const line = this.getLineName(record.lineId).toLowerCase();
      const shift = this.getShiftName(record.shiftId).toLowerCase();
      return !search || 
        product.includes(search) || 
        line.includes(search) || 
        shift.includes(search) ||
        record.supervisor.toLowerCase().includes(search);
    });
  }

  private loadMasterData(): void {
    forkJoin([
      this.productService.getAll(),
      this.lineService.getAll(),
      this.shiftService.getAll(),
      this.lineProductService.getAll()
    ]).subscribe({
      next: ([products, lines, shifts, lineProducts]) => {
        this.activeProducts = products.filter(p => p.active);
        this.activeLines = lines.filter(l => l.active);
        this.activeShifts = shifts.filter(s => s.active);
        this.lineProducts = lineProducts;

        // Populate maps
        products.forEach(p => this.productsMap.set(p.id, p));
        lines.forEach(l => this.linesMap.set(l.id, l));
        shifts.forEach(s => this.shiftsMap.set(s.id, s));
        
        this.downtimeEvents.clear();
        this.loadHistory();
      },
      error: (err) => {
        console.error('Error loading master data:', err);
        this.loadHistory();
      }
    });
  }

  private loadHistory(): void {
    this.loadingHistory = true;
    
    forkJoin([
       this.productionService.getAll(),
       this.productionSessionService.getAll()
    ]).subscribe({
      next: ([records, sessions]) => {
        this.history = records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        this.sessionsMap.clear();
        sessions.forEach(s => this.sessionsMap.set(s.id, s));
        
        this.applyFilter();
        this.loadingHistory = false;
      },
      error: (err) => {
        console.error('Error loading history:', err);
        this.loadingHistory = false;
      }
    });
  }

  getProductName(id: string): string {
    return this.productsMap.get(id)?.name || 'Unknown Product';
  }

  getLineName(id: string): string {
    return this.linesMap.get(id)?.name || 'Unknown Line';
  }

  getShiftName(id: string): string {
    return this.shiftsMap.get(id)?.name || 'Unknown Shift';
  }

  private formatDate(date: Date): string {
    return toLocalCalendarString(date);
  }

  private generateId(prefix: string): string {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
