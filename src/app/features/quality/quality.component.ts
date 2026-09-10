import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSortModule, Sort } from '@angular/material/sort';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { QualityDetailsDialogComponent } from './quality-details-dialog.component';

import { QualityService } from '../../core/services/quality.service';
import { TranslationService } from '../../core/services/translation.service';
import { ProductService } from '../../core/services/product.service';
import { LineService } from '../../core/services/line.service';
import { QualityTest, QualitySample } from '../../core/models/quality-test.model';
import { Product } from '../../core/models/product.model';
import { Line } from '../../core/models/line.model';
import { MasterDataUtil } from '../../core/utils/master-data.util';
import { QualityCalculationUtil, resolveQualitySnapshotBasis } from '../../core/utils/quality-calculation.util';
import { toLocalCalendarString } from '../../core/utils/date.util';
import { SubmissionGuard } from '../../core/utils/production.util';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-quality',
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
    MatSelectModule,
    MatDialogModule,
    MatSortModule,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusBadgeComponent
  ],
  template: `
    <div class="quality-container">
      <app-page-header
        [title]="translation.translate('quality.title')"
        [subtitle]="translation.translate('quality.subtitle')"
        icon="verified"
      ></app-page-header>

      <div class="quality-content">
        <!-- Entry Form Section -->
        <div class="card entry-card">
          <div class="card-header">
            <h3>{{ translation.translate('quality.entry.title') }}</h3>
          </div>

          <form [formGroup]="qualityForm" class="card-body tpms-form">
            <div class="form-row header-row">
              <div class="form-group">
                <label>{{ translation.translate('quality.form.date') }} *</label>
                <div class="date-input-wrapper">
                  <input matInput [matDatepicker]="datePicker" formControlName="date" class="form-control" [class.is-invalid]="isInvalid('date')">
                  <mat-datepicker-toggle matIconSuffix [for]="datePicker"></mat-datepicker-toggle>
                  <mat-datepicker #datePicker></mat-datepicker>
                </div>
                <div class="invalid-feedback" *ngIf="isInvalid('date')">{{ translation.translate('quality.form.date.required') }}</div>
              </div>

              <div class="form-group">
                <label>{{ translation.translate('quality.form.product') }} *</label>
                <select formControlName="productId" class="form-control" (change)="onProductChange()" [class.is-invalid]="isInvalid('productId')">
                  <option value="" disabled>{{ translation.translate('quality.form.product.placeholder') }}</option>
                  <option *ngFor="let product of activeProducts" [value]="product.id">{{ product.name }}</option>
                </select>
                <div class="invalid-feedback" *ngIf="isInvalid('productId')">{{ translation.translate('quality.form.product.required') }}</div>
              </div>

              <div class="form-group">
                <label>{{ translation.translate('quality.form.line') }} *</label>
                <select formControlName="lineId" class="form-control" [class.is-invalid]="isInvalid('lineId')">
                  <option value="" disabled>{{ translation.translate('quality.form.line.placeholder') }}</option>
                  <option *ngFor="let line of activeLines" [value]="line.id">{{ line.name }}</option>
                </select>
                <div class="invalid-feedback" *ngIf="isInvalid('lineId')">{{ translation.translate('quality.form.line.required') }}</div>
              </div>

              <div class="form-group">
                <label>{{ translation.translate('quality.form.notes') }}</label>
                <input type="text" formControlName="notes" class="form-control" [placeholder]="translation.translate('quality.form.notes.placeholder')">
              </div>
            </div>

            <!-- Product master summary (read-only, always visible above samples) -->
            <div class="master-summary">
              <div class="summary-item">
                <span class="summary-label">{{ translation.translate('quality.summary.product') }}</span>
                <span class="summary-value font-medium text-primary">{{ selectedProduct?.name || '—' }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">{{ translation.translate('quality.summary.line') }}</span>
                <span class="summary-value font-medium">{{ selectedLineName || '—' }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">{{ translation.translate('quality.summary.productArea') }}</span>
                <span class="summary-value font-medium">{{ previewProductArea != null ? previewProductArea : '—' }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">{{ translation.translate('quality.summary.compressionStandard') }}</span>
                <span class="summary-value font-medium">{{ previewCompressionStandard != null ? previewCompressionStandard : '—' }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">{{ translation.translate('quality.summary.standardWeight') }}</span>
                <span class="summary-value font-medium">{{ previewStandardWeight != null ? previewStandardWeight : '—' }}</span>
              </div>
            </div>

            <!-- Three-sample measurement table -->
            <div class="form-group">
              <label>{{ translation.translate('quality.form.samples.hint') }}</label>
              <div class="table-responsive samples-table-wrap">
                <table class="tpms-table samples-table">
                  <thead>
                    <tr>
                      <th>{{ translation.translate('quality.table.sample') }}</th>
                      <th>{{ translation.translate('quality.table.actualHeight') }}</th>
                      <th>{{ translation.translate('quality.table.actualWt') }}</th>
                      <th>{{ translation.translate('quality.table.stdWt') }}</th>
                      <th>{{ translation.translate('quality.table.wtDiff') }}</th>
                      <th>{{ translation.translate('quality.table.load') }}</th>
                      <th>{{ translation.translate('quality.table.area') }}</th>
                      <th>{{ translation.translate('quality.table.compression') }}</th>
                      <th>{{ translation.translate('quality.table.compStd') }}</th>
                      <th>{{ translation.translate('quality.table.result') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let g of sampleGroups(); let i = index" [formGroup]="g">
                      <td class="sample-label">{{ translation.translate('quality.table.sampleLabel', { n: i + 1 }) }}</td>
                      <td>
                        <input type="number" min="0.01" step="0.1" formControlName="actualHeight"
                          class="form-control sample-input"
                          [class.is-invalid]="sampleInvalid(i, 'actualHeight')">
                        <div class="invalid-feedback" *ngIf="sampleInvalid(i, 'actualHeight')">{{ translation.translate('quality.error.heightPositive') }}</div>
                      </td>
                      <td>
                        <input type="number" min="0.01" step="0.1" formControlName="actualWeight"
                          class="form-control sample-input"
                          [placeholder]="translation.translate('quality.unit.kg')"
                          [class.is-invalid]="sampleInvalid(i, 'actualWeight')">
                        <div class="invalid-feedback" *ngIf="sampleInvalid(i, 'actualWeight')">{{ translation.translate('quality.error.weightPositive') }}</div>
                      </td>
                      <td class="readonly-cell">{{ previewStandardWeight != null ? previewStandardWeight : '—' }}</td>
                      <td class="readonly-cell">{{ computedSamples[i].weightDifference ?? '—' }}</td>
                      <td>
                        <input type="number" min="0.01" step="0.1" formControlName="load"
                          class="form-control sample-input"
                          [class.is-invalid]="sampleInvalid(i, 'load')">
                        <div class="invalid-feedback" *ngIf="sampleInvalid(i, 'load')">{{ translation.translate('quality.error.loadPositive') }}</div>
                      </td>
                      <td class="readonly-cell">{{ previewProductArea != null ? previewProductArea : '—' }}</td>
                      <td class="readonly-cell compression-cell">{{ computedSamples[i].compression != null ? (computedSamples[i].compression | number:'1.2-2') : '—' }}</td>
                      <td class="readonly-cell">{{ previewCompressionStandard != null ? previewCompressionStandard : '—' }}</td>
                      <td>
                        <app-status-badge
                          *ngIf="computedSamples[i].compressionResult"
                          [label]="resultLabel(computedSamples[i].compressionResult)"
                          [variant]="computedSamples[i].compressionResult === 'PASS' ? 'success' : computedSamples[i].compressionResult === 'FAIL' ? 'error' : 'warning'"
                          [icon]="computedSamples[i].compressionResult === 'PASS' ? 'check_circle' : computedSamples[i].compressionResult === 'FAIL' ? 'cancel' : 'help'"
                          size="sm">
                        </app-status-badge>
                        <span *ngIf="!computedSamples[i].compressionResult" class="no-result">{{ translation.translate('quality.form.enterLoad') }}</span>
                      </td>
                    </tr>
                    <!-- Averages -->
                    <tr class="averages-row">
                      <td class="sample-label">{{ translation.translate('quality.table.avgForEvent') }}</td>
                      <td class="avg-cell">{{ avgActualHeight ?? '—' }}</td>
                      <td class="avg-cell">{{ avgActualWeight ?? '—' }}</td>
                      <td></td>
                      <td class="avg-cell">{{ avgWeightDiff ?? '—' }}</td>
                      <td class="avg-cell">{{ avgLoad ?? '—' }}</td>
                      <td></td>
                      <td class="avg-cell">
                        <span *ngIf="avgCompression != null">{{ avgCompression | number:'1.2-2' }}</span>
                        <span *ngIf="avgCompression == null" class="no-result">{{ translation.translate('quality.result.configRequired') }}</span>
                      </td>
                      <td></td>
                      <td class="avg-cell-note">{{ translation.translate('quality.table.avgNote') }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Configuration warnings (never invent Area / Standard / results) -->
            <div class="warning-alert mt-4" *ngIf="configMessages.length > 0">
              <mat-icon>warning</mat-icon>
              <div>
                <span *ngFor="let msg of configMessages" class="config-msg">{{ msg }}</span>
                <span>{{ translation.translate('quality.warning.configureProduct') }}</span>
              </div>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="confirmClear()">{{ translation.translate('quality.actions.clear') }}</button>
              <button type="button" class="btn-primary" (click)="saveQualityTest()" [disabled]="qualityForm.invalid || saving || !configComplete">
                {{ saving ? translation.translate('quality.actions.saving') : translation.translate('quality.actions.saveTest') }}
              </button>
            </div>
          </form>
        </div>

        <!-- History Section -->
        <div class="card history-card">
          <div class="card-header history-header">
            <h3>{{ translation.translate('quality.history.title') }}</h3>
            <div class="history-actions">
              <div class="search-bar">
                <mat-icon class="search-icon">search</mat-icon>
                <input type="text" [placeholder]="translation.translate('quality.search.placeholder')" [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
              </div>
            </div>
          </div>

          <!-- Filters -->
          <div class="filters-section" *ngIf="activeFilters.length > 0">
            <div class="filter-group">
              <label>{{ translation.translate('quality.filter.date') }}</label>
              <select [(ngModel)]="dateFilter" (ngModelChange)="applyFilter()" class="filter-select">
                <option value="">{{ translation.translate('quality.filter.allDates') }}</option>
                <option value="today">{{ translation.translate('quality.filter.today') }}</option>
                <option value="week">{{ translation.translate('quality.filter.week') }}</option>
                <option value="month">{{ translation.translate('quality.filter.month') }}</option>
              </select>
            </div>
            <div class="filter-group">
              <label>{{ translation.translate('quality.filter.product') }}</label>
              <select [(ngModel)]="productFilter" (ngModelChange)="applyFilter()" class="filter-select">
                <option value="">{{ translation.translate('quality.filter.allProducts') }}</option>
                <option *ngFor="let product of activeProducts" [value]="product.id">{{ product.name }}</option>
              </select>
            </div>
            <div class="filter-group">
              <label>{{ translation.translate('quality.filter.line') }}</label>
              <select [(ngModel)]="lineFilter" (ngModelChange)="applyFilter()" class="filter-select">
                <option value="">{{ translation.translate('quality.filter.allLines') }}</option>
                <option *ngFor="let line of activeLines" [value]="line.id">{{ line.name }}</option>
              </select>
            </div>
            <button type="button" class="btn-text" (click)="clearFilters()">{{ translation.translate('quality.filter.clear') }}</button>
          </div>

          <div class="card-body p-0">
            <div *ngIf="loadingHistory" class="loading-state">{{ translation.translate('quality.history.loading') }}</div>

            <app-empty-state
              *ngIf="!loadingHistory && !filteredHistory.length"
              icon="verified"
              [title]="translation.translate('quality.history.empty.title')"
              [description]="translation.translate('quality.history.empty.description')"
              variant="neutral"
            ></app-empty-state>

            <div class="table-responsive" *ngIf="!loadingHistory && filteredHistory.length > 0">
              <table mat-table [dataSource]="dataSource" matSort (matSortChange)="sortData($event)" class="tpms-table history-table">
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header> {{ translation.translate('quality.table.date') }} </th>
                  <td mat-cell *matCellDef="let element"> {{element.date | date:'shortDate'}} </td>
                </ng-container>

                <ng-container matColumnDef="product">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header> {{ translation.translate('quality.table.product') }} </th>
                  <td mat-cell *matCellDef="let element"> <span class="font-medium text-primary">{{element.productName}}</span> </td>
                </ng-container>

                <ng-container matColumnDef="line">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header> {{ translation.translate('quality.table.line') }} </th>
                  <td mat-cell *matCellDef="let element">
                    <span *ngIf="element.lineName" class="line-badge">{{ element.lineName }}</span>
                    <span *ngIf="!element.lineName" class="text-tertiary">{{ translation.translate('quality.table.notSpecified') }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="samples">
                  <th mat-header-cell *matHeaderCellDef> {{ translation.translate('quality.table.samples') }} </th>
                  <td mat-cell *matCellDef="let element"> {{ element.samples?.length ?? 1 }} </td>
                </ng-container>

                <ng-container matColumnDef="avgCompression">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header> {{ translation.translate('quality.table.avgCompression') }} </th>
                  <td mat-cell *matCellDef="let element">
                    <span *ngIf="avgCompressionOf(element) != null">{{ avgCompressionOf(element) | number:'1.2-2' }}</span>
                    <span *ngIf="avgCompressionOf(element) == null" class="no-result">{{ translation.translate('quality.result.configRequired') }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="actions-col actions-col-wide"> {{ translation.translate('quality.table.actions') }} </th>
                  <td mat-cell *matCellDef="let element" class="actions-col actions-col-wide">
                    <div class="table-actions">
                      <button mat-icon-button class="action-btn" [title]="translation.translate('quality.action.view')" (click)="viewDetails(element)">
                        <mat-icon>visibility</mat-icon>
                      </button>
                      <button mat-icon-button class="action-btn" [title]="translation.translate('quality.action.edit')" (click)="editRecord(element)">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button class="action-btn delete-btn" [title]="translation.translate('quality.action.delete')" (click)="deleteRecord(element)">
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

    .quality-container {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      padding: var(--space-6);
      max-width: 1400px;
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
    .mt-4 { margin-top: var(--space-4) !important; }

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
      padding: 8px var(--space-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: var(--font-sans);
      height: 38px;
      width: 100%;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      box-shadow: var(--shadow-xs);
      &:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: var(--shadow-glow);
      }
      &.is-invalid { border-color: var(--error); }
      option { background: var(--surface); color: var(--text-primary); }
    }

    .sample-input {
      min-width: 86px;
      height: 32px;
      padding: 4px var(--space-2);
      font-size: var(--text-sm);
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
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: var(--warning-light);
      color: var(--warning-dark);
      border-radius: var(--radius-md);
      border: 1px solid rgba(245, 158, 11, 0.3);
      font-size: var(--text-sm);
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 2px; }
    }

    .config-msg { display: block; font-weight: var(--weight-medium); margin-bottom: 2px; }

    .master-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--surface-alt);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
    }

    .summary-item { display: flex; flex-direction: column; gap: 2px; }
    .summary-label {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      font-weight: var(--weight-medium);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .summary-value { font-size: var(--text-sm); color: var(--text-primary); }

    .samples-table-wrap { overflow-x: auto; }

    .samples-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);

      th {
        padding: 8px var(--space-2);
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

      td {
        padding: 8px var(--space-2);
        border-bottom: 1px solid var(--border-subtle);
        vertical-align: top;
        color: var(--text-primary);
      }

      .sample-label {
        font-weight: var(--weight-medium);
        color: var(--text-secondary);
        white-space: nowrap;
      }

      .readonly-cell {
        background: var(--surface-alt);
        color: var(--text-secondary);
        font-size: var(--text-sm);
      }

      .compression-cell { font-weight: var(--weight-medium); color: var(--text-primary); }

      .averages-row {
        td {
          border-top: 2px solid var(--border);
          background: var(--surface-alt);
        }
        .avg-cell {
          font-weight: var(--weight-medium);
          color: var(--primary-dark, var(--text-primary));
        }
        .avg-cell-note {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          font-style: italic;
          white-space: nowrap;
        }
      }
    }

    .no-result { color: var(--text-tertiary); font-size: var(--text-sm); }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
      border-top: 1px solid var(--border-subtle);
    }

    .history-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3); }

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
      &:focus-within { border-color: var(--primary); box-shadow: var(--shadow-glow); }
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

    .filters-section {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-6);
      background: var(--surface-alt);
      border-bottom: 1px solid var(--border-subtle);
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      label {
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }

    .filter-select {
      padding: 4px var(--space-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-primary);
      font-size: var(--text-xs);
      font-family: var(--font-sans);
      height: 30px;
      transition: border-color var(--transition-fast);
      &:focus { outline: none; border-color: var(--primary); }
    }

    .btn-text {
      background: none;
      border: none;
      color: var(--primary);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      cursor: pointer;
      padding: 4px var(--space-2);
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);
      &:hover { background: var(--primary-50); }
    }

    .history-table { width: 100%; }

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

    .font-medium { font-weight: var(--weight-medium); }
    .text-primary { color: var(--text-primary); }
    .text-tertiary { color: var(--text-tertiary); font-size: var(--text-sm); font-style: italic; }
    .line-badge { font-size: var(--text-sm); color: var(--text-primary); }

    ::ng-deep .tpms-table {
      background: transparent;
      .mat-mdc-header-row { background: var(--surface-alt); border-bottom: 1px solid var(--border); }
      .mat-mdc-header-cell {
        color: var(--text-tertiary);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom-color: var(--border);
        background: var(--surface-alt);
      }
      .mat-mdc-row { background: var(--surface); border-bottom: 1px solid var(--border-subtle); transition: background var(--transition-fast); &:hover { background: var(--surface-alt); } &:last-child { border-bottom: none; } }
      .mat-mdc-cell { color: var(--text-primary); font-size: var(--text-sm); border-bottom-color: var(--border-subtle); }
    }

    :host-context([data-theme="dark"]) {
      .warning-alert { border-color: rgba(245, 158, 11, 0.2); }
    }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .tpms-dir[dir="rtl"] .summary-label,
    .tpms-dir[dir="rtl"] .samples-table th,
    .tpms-dir[dir="rtl"] .history-table .mat-mdc-header-cell {
      text-transform: none;
      letter-spacing: 0;
    }

    .tpms-dir[dir="rtl"] .date-input-wrapper {
      flex-direction: row;
    }

    .tpms-dir[dir="rtl"] .samples-table th,
    .tpms-dir[dir="rtl"] .samples-table td {
      text-align: right;
    }

    .tpms-dir[dir="rtl"] .form-actions {
      flex-direction: row;
    }

    .tpms-dir[dir="rtl"] .history-table .mat-mdc-header-cell,
    .tpms-dir[dir="rtl"] .history-table .mat-mdc-cell {
      text-align: right;
    }

    .tpms-dir[dir="rtl"] .filters-section .filter-group label {
      text-align: right;
    }

    .tpms-dir[dir="rtl"] .actions-col .table-actions {
      flex-direction: row;
    }

    .tpms-dir[dir="rtl"] .search-bar {
      direction: rtl;
    }
  `]
})
export class QualityComponent implements OnInit, OnDestroy {
  readonly translation = inject(TranslationService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private qualityService = inject(QualityService);
  private productService = inject(ProductService);
  private lineService = inject(LineService);
  private destroy$ = new Subject<void>();
  private submissionGuard = new SubmissionGuard();
  /** The historical record being edited. Drives snapshot preservation on save. */
  private editingOriginal: QualityTest | null = null;

  qualityForm!: FormGroup;
  saving = false;
  editingId: string | null = null;
  pendingSubmissionId: string | null = null;

  // Master data
  activeProducts: Product[] = [];
  activeLines: Line[] = [];
  linesMap = new Map<string, Line>();

  // Product master preview (read-only, from Product Master)
  selectedProduct: Product | undefined;
  selectedLineName = '';
  previewProductArea: number | undefined;
  previewCompressionStandard: number | undefined;
  previewStandardHeight: number | undefined;
  previewStandardWeight: number | undefined;

  // Computed per-sample measurements + averages
  computedSamples: QualitySample[] = [];
  avgActualHeight: number | undefined;
  avgActualWeight: number | undefined;
  avgLoad: number | undefined;
  avgCompression: number | undefined;
  avgWeightDiff: number | undefined;

  configMessages: string[] = [];
  configComplete = false;

  // History
  history: QualityTest[] = [];
  filteredHistory: QualityTest[] = [];
  dataSource = new MatTableDataSource<QualityTest>();
  loadingHistory = true;
  searchTerm = '';
  historyColumns: string[] = ['date', 'product', 'line', 'samples', 'avgCompression', 'actions'];

  // Filters
  dateFilter = '';
  productFilter = '';
  lineFilter = '';

  get activeFilters(): string[] {
    const filters: string[] = [];
    if (this.dateFilter) filters.push('date');
    if (this.productFilter) filters.push('product');
    if (this.lineFilter) filters.push('line');
    return filters;
  }

  ngOnInit(): void {
    this.initForm();
    this.loadMasterData();
    this.qualityForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.recomputeSamples());
    this.recomputeSamples();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.qualityForm = this.fb.group({
      date: [new Date(), Validators.required],
      productId: ['', Validators.required],
      lineId: ['', Validators.required],
      notes: [''],
      samples: this.fb.array([this.createSampleGroup(), this.createSampleGroup(), this.createSampleGroup()])
    });
  }

  private createSampleGroup(): FormGroup {
    return this.fb.group({
      actualHeight: [null, [Validators.required, Validators.min(0.01)]],
      actualWeight: [null, [Validators.required, Validators.min(0.01)]],
      load: [null, [Validators.required, Validators.min(0.01)]]
    });
  }

  sampleGroups(): FormGroup[] {
    return (this.qualityForm.get('samples') as FormArray).controls as FormGroup[];
  }

  isInvalid(controlName: string): boolean {
    const control = this.qualityForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  sampleInvalid(index: number, controlName: string): boolean {
    const group = this.sampleGroups()[index];
    if (!group) return false;
    const control = group.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onProductChange(): void {
    const productId = this.qualityForm.get('productId')?.value;
    this.selectedProduct = this.activeProducts.find(p => p.id === productId);
    this.refreshConfig();
  }

  private refreshConfig(): void {
    const product = this.selectedProduct;
    const nextProductId = this.qualityForm.get('productId')?.value;
    const original = this.editingOriginal;
    const basis = resolveQualitySnapshotBasis({
      isEdit: !!original,
      productChanged: !!original && original.productId !== nextProductId,
      historical: original ? {
        productArea: original.productAreaSnapshot,
        compressionStandard: original.compressionStandardSnapshot,
        standardHeight: original.standardHeightSnapshot,
        standardWeight: original.standardWeightSnapshot
      } : {},
      current: {
        productArea: MasterDataUtil.productAreaOf(product),
        compressionStandard: MasterDataUtil.compressionStandardOf(product),
        standardHeight: MasterDataUtil.standardHeightOf(product),
        standardWeight: MasterDataUtil.standardWeightOf(product)
      }
    });
    this.previewProductArea = basis.productArea;
    this.previewCompressionStandard = basis.compressionStandard;
    this.previewStandardHeight = basis.standardHeight;
    this.previewStandardWeight = basis.standardWeight;

    const lineId = this.qualityForm.get('lineId')?.value;
    const line = this.linesMap.get(lineId);
    this.selectedLineName = line?.name ?? '';

    const messages: string[] = [];
    if (!product) {
      messages.push(this.translation.translate('quality.warning.selectProduct'));
    } else {
      if (!MasterDataUtil.isConfiguredPositive(this.previewProductArea)) {
        messages.push(this.translation.translate('quality.warning.productArea'));
      }
      if (!MasterDataUtil.isConfiguredPositive(this.previewCompressionStandard)) {
        messages.push(this.translation.translate('quality.warning.compressionStandard'));
      }
      if (!MasterDataUtil.isConfiguredPositive(this.previewStandardWeight)) {
        messages.push(this.translation.translate('quality.warning.standardWeight'));
      }
    }
    this.configMessages = messages;
    this.configComplete = !!product &&
      MasterDataUtil.isConfiguredPositive(this.previewProductArea) &&
      MasterDataUtil.isConfiguredPositive(this.previewCompressionStandard);
    this.recomputeSamples();
  }

  private recomputeSamples(): void {
    const product = this.selectedProduct;
    const area = this.previewProductArea;
    const std = this.previewCompressionStandard;
    const stdWeight = this.previewStandardWeight;

    this.computedSamples = this.sampleGroups().map((group, i) => {
      const raw = group.getRawValue();
      const load = typeof raw.load === 'number' ? raw.load : NaN;
      const evaluation = QualityCalculationUtil.evaluateSample(load, area, std);
      return {
        sampleNumber: i + 1,
        actualHeight: typeof raw.actualHeight === 'number' ? raw.actualHeight : NaN,
        actualWeight: typeof raw.actualWeight === 'number' ? raw.actualWeight : NaN,
        load,
        compression: evaluation.compression != null ? QualityCalculationUtil.roundToDecimals(evaluation.compression) : NaN,
        compressionResult: evaluation.compressionResult,
        weightDifference: QualityCalculationUtil.weightDifference(
          typeof raw.actualWeight === 'number' ? raw.actualWeight : NaN, stdWeight)
      };
    }) as QualitySample[];

    this.avgActualHeight = QualityCalculationUtil.average(this.computedSamples.map(s => s.actualHeight));
    this.avgActualWeight = QualityCalculationUtil.average(this.computedSamples.map(s => s.actualWeight));
    this.avgLoad = QualityCalculationUtil.average(this.computedSamples.map(s => s.load));
    this.avgCompression = QualityCalculationUtil.averageCompression(
      this.computedSamples.map(s => Number.isFinite(s.compression) ? s.compression : undefined));
    const stdWeightValid = MasterDataUtil.isConfiguredPositive(this.previewStandardWeight);
    this.avgWeightDiff = stdWeightValid && this.avgActualWeight != null
      ? QualityCalculationUtil.roundToDecimals(this.avgActualWeight - (this.previewStandardWeight as number)) : undefined;
  }

  saveQualityTest(): void {
    if (this.qualityForm.invalid || !this.configComplete) {
      this.qualityForm.markAllAsTouched();
      return;
    }
    if (!this.submissionGuard.acquire()) {
      return;
    }

    this.saving = true;
    const formValue = this.qualityForm.getRawValue();
    const product = this.selectedProduct;
    const line = this.linesMap.get(formValue.lineId);

    const samples: QualitySample[] = this.computedSamples.map(s => ({ ...s }));
    if (samples.length !== 3 || samples.some(s => !Number.isFinite(s.compression) || s.compressionResult !== 'PASS' && s.compressionResult !== 'FAIL')) {
      this.saving = false;
      this.submissionGuard.release();
      return;
    }

    if (!this.editingId && !this.pendingSubmissionId) {
      this.pendingSubmissionId = `qt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    const submissionId = this.pendingSubmissionId ?? this.editingId!;

    const submittedDate = this.formatDate(formValue.date);

    const test: QualityTest = {
      id: this.editingId || `quality_test_sub_${submissionId}`,
      submissionId: this.editingId ? undefined : submissionId,
      date: submittedDate,
      productId: formValue.productId,
      productName: product?.name ?? this.editingOriginal?.productName ?? this.translation.translate('quality.product.unknown'),
      lineId: formValue.lineId,
      lineName: line?.name ?? '',
      testDate: submittedDate,
      productAreaSnapshot: this.previewProductArea,
      compressionStandardSnapshot: this.previewCompressionStandard,
      standardHeightSnapshot: this.previewStandardHeight,
      standardWeightSnapshot: this.previewStandardWeight,
      notes: (formValue.notes || '').trim() || undefined,
      samples,
      decisionSource: 'AUTO_CALCULATED',
      createdAt: this.editingId ? this.history.find(h => h.id === this.editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const save$ = this.editingId
      ? this.qualityService.update(test)
      : this.qualityService.createIdempotent(test);

    save$.subscribe({
      next: () => {
        this.saving = false;
        this.submissionGuard.release();
        this.editingId = null;
        this.pendingSubmissionId = null;
        this.clearForm();
        this.loadHistory();
      },
      error: (err) => {
        console.error('Error saving quality test:', err);
        this.saving = false;
        this.submissionGuard.release();
      }
    });
  }

  resultLabel(result: string | null | undefined): string {
    if (result === 'PASS') return this.translation.translate('quality.result.pass');
    if (result === 'FAIL') return this.translation.translate('quality.result.fail');
    if (result === 'CONFIGURATION_REQUIRED') return this.translation.translate('quality.result.configRequired');
    return result ?? '';
  }

  avgCompressionOf(test: QualityTest): number | undefined {
    if (!test.samples?.length) {
      return test.compression ?? test.strength;
    }
    return QualityCalculationUtil.averageCompression(
      test.samples.map(s => Number.isFinite(s.compression) ? s.compression : undefined));
  }

  editRecord(record: QualityTest): void {
    this.editingId = record.id;
    this.editingOriginal = record;
    const product = this.activeProducts.find(p => p.id === record.productId);
    this.selectedProduct = product;
    this.qualityForm.patchValue({
      date: new Date(record.date),
      productId: record.productId,
      lineId: record.lineId ?? '',
      notes: record.notes ?? ''
    });

    const samples = record.samples?.length ? record.samples : [
      { actualHeight: record.strength ?? null, actualWeight: null, load: record.load ?? null }
    ];
    (this.qualityForm.get('samples') as FormArray).controls.forEach((group, i) => {
      const s = samples[i];
      group.patchValue({
        actualHeight: s?.actualHeight ?? null,
        actualWeight: s?.actualWeight ?? null,
        load: s?.load ?? null
      });
    });

    this.refreshConfig();
    this.qualityForm.markAsPristine();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteRecord(record: QualityTest): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translation.translate('quality.delete.title'),
        message: this.translation.translate('quality.delete.message'),
        confirmText: this.translation.translate('quality.delete.confirm'),
        cancelText: this.translation.translate('common.cancel'),
        variant: 'danger'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.qualityService.delete(record.id).subscribe({
          next: () => this.loadHistory(),
          error: (err) => console.error('Error deleting quality test:', err)
        });
      }
    });
  }

  viewDetails(record: QualityTest): void {
    this.dialog.open(QualityDetailsDialogComponent, {
      data: { record },
      width: '760px'
    });
  }

  confirmClear(): void {
    if (this.qualityForm.dirty) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: this.translation.translate('quality.clear.title'),
          message: this.translation.translate('quality.clear.message'),
          confirmText: this.translation.translate('quality.clear.confirm'),
          cancelText: this.translation.translate('common.cancel'),
          variant: 'warning'
        }
      });
      dialogRef.afterClosed().subscribe(confirmed => {
        if (confirmed) this.clearForm();
      });
    } else {
      this.clearForm();
    }
  }

  clearForm(): void {
    this.editingId = null;
    this.editingOriginal = null;
    this.pendingSubmissionId = null;
    this.selectedProduct = undefined;
    this.qualityForm.reset({
      date: new Date(),
      productId: '',
      lineId: '',
      notes: ''
    });
    (this.qualityForm.get('samples') as FormArray).controls.forEach(group => {
      group.reset({ actualHeight: null, actualWeight: null, load: null });
    });
    this.qualityForm.markAsPristine();
    this.refreshConfig();
  }

  applyFilter(): void {
    this.filteredHistory = this.history.filter(record => {
      const searchLower = this.searchTerm.toLowerCase();
      const lineName = record.lineName ?? this.linesMap.get(record.lineId ?? '')?.name ?? '';
      const sampleText = record.samples?.length
        ? `Samples ${record.samples.map(s => s.actualHeight).join(', ')} ${record.samples.map(s => s.actualWeight).join(', ')}`.toLowerCase()
        : (record.sample ?? '');
      const matchesSearch = !this.searchTerm ||
        record.productName.toLowerCase().includes(searchLower) ||
        sampleText.includes(searchLower) ||
        lineName.toLowerCase().includes(searchLower);

      let matchesDate = true;
      if (this.dateFilter) {
        const recordDate = new Date(record.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (this.dateFilter === 'today') {
          const testDate = new Date(recordDate);
          testDate.setHours(0, 0, 0, 0);
          matchesDate = testDate.getTime() === today.getTime();
        } else if (this.dateFilter === 'week') {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          matchesDate = recordDate >= weekAgo;
        } else if (this.dateFilter === 'month') {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          matchesDate = recordDate >= monthAgo;
        }
      }

      const matchesProduct = !this.productFilter || record.productId === this.productFilter;
      const matchesLine = !this.lineFilter || record.lineId === this.lineFilter;

      return matchesSearch && matchesDate && matchesProduct && matchesLine;
    });

    this.dataSource.data = this.filteredHistory;
  }

  clearFilters(): void {
    this.dateFilter = '';
    this.productFilter = '';
    this.lineFilter = '';
    this.applyFilter();
  }

  sortData(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      this.filteredHistory = [...this.history];
      this.applyFilter();
      return;
    }

    this.filteredHistory = this.filteredHistory.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      let valueA = a[sort.active as keyof QualityTest];
      let valueB = b[sort.active as keyof QualityTest];
      valueA = valueA == null ? '' : valueA;
      valueB = valueB == null ? '' : valueB;
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return this.compareStrings(valueA, valueB, isAsc);
      }
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return this.compareNumbers(valueA, valueB, isAsc);
      }
      return 0;
    });
    this.dataSource.data = this.filteredHistory;
  }

  private compareStrings(a: string, b: string, isAsc: boolean): number {
    return (a.toLowerCase() < b.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1);
  }

  private compareNumbers(a: number, b: number, isAsc: boolean): number {
    return (a - b) * (isAsc ? 1 : -1);
  }

  private loadMasterData(): void {
    forkJoin([
      this.productService.getAll(),
      this.lineService.getAll()
    ]).subscribe({
      next: ([products, lines]) => {
        this.activeProducts = products.filter(p => p.active);
        this.activeLines = lines.filter(l => l.active);
        lines.forEach(l => this.linesMap.set(l.id, l));
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
    this.qualityService.getAll().subscribe({
      next: (tests) => {
        this.history = tests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        this.applyFilter();
        this.loadingHistory = false;
      },
      error: (err) => {
        console.error('Error loading quality tests:', err);
        this.loadingHistory = false;
      }
    });
  }

  private formatDate(date: Date): string {
    return toLocalCalendarString(date);
  }
}