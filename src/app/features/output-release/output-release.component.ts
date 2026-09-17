// ============================================================
// TPMS — Output Release Component (Phase D)
// ============================================================
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { OutputReleaseDetailsDialogComponent } from './output-release-details-dialog.component';

import { OutputReleaseService, OutputReleaseInput } from '../../core/services/output-release.service';
import { ProductService } from '../../core/services/product.service';
import { LineService } from '../../core/services/line.service';
import { TranslationService } from '../../core/services/translation.service';
import { OutputRelease } from '../../core/models/output-release.model';
import { Product } from '../../core/models/product.model';
import { Line } from '../../core/models/line.model';
import { SubmissionGuard } from '../../core/utils/production.util';
import { toLocalCalendarString, parseLocalCalendarDate, getDefaultOperationalDate } from '../../core/utils/date.util';

@Component({
  selector: 'app-output-release',
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
    MatTooltipModule,
    PageHeaderComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="output-container">
      <app-page-header
        [title]="translation.translate('outputRelease.title')"
        [subtitle]="translation.translate('outputRelease.subtitle')"
        icon="output"
      ></app-page-header>

      <div class="output-content">

        <!-- ── Info notice ─────────────────────────────────────── -->
        <div class="info-notice">
          <mat-icon>info</mat-icon>
          <span>
            {{ translation.translate('outputRelease.info.noticePre') }}
            <strong>{{ translation.translate('outputRelease.info.independent') }}</strong>
            {{ translation.translate('outputRelease.info.noticeMid') }}
            <strong>{{ translation.translate('outputRelease.info.required') }}</strong>
            {{ translation.translate('outputRelease.info.noticePost') }}
          </span>
        </div>

        <!-- ── Entry Form ──────────────────────────────────────── -->
        <div class="card entry-card">
          <div class="card-header">
            <h3>{{ editingId ? translation.translate('outputRelease.entry.title.edit') : translation.translate('outputRelease.entry.title.create') }}</h3>
            <span class="source-badge" *ngIf="editingId">{{ translation.translate('outputRelease.entry.manualBadge') }}</span>
          </div>

          <form [formGroup]="releaseForm" class="card-body tpms-form">
            <div class="form-row header-row">

              <!-- Release Date — MANDATORY -->
              <div class="form-group">
                <label>{{ translation.translate('outputRelease.form.date') }}</label>
                <div class="date-input-wrapper">
                  <input matInput [matDatepicker]="datePicker"
                    formControlName="releaseDate"
                    class="form-control"
                    [class.is-invalid]="isInvalid('releaseDate')">
                  <mat-datepicker-toggle matIconSuffix [for]="datePicker"></mat-datepicker-toggle>
                  <mat-datepicker #datePicker></mat-datepicker>
                </div>
                <div class="invalid-feedback" *ngIf="isInvalid('releaseDate')">{{ translation.translate('outputRelease.form.dateRequired') }}</div>
              </div>

              <!-- Released Quantity — MANDATORY -->
              <div class="form-group">
                <label>{{ translation.translate('outputRelease.form.quantity') }}</label>
                <input type="number"
                  formControlName="releasedQuantity"
                  class="form-control"
                  [class.is-invalid]="isInvalid('releasedQuantity')"
                  min="1"
                  step="1"
                  [placeholder]="translation.translate('outputRelease.form.quantityPlaceholder')">
                <div class="invalid-feedback" *ngIf="isInvalid('releasedQuantity')">
                  {{ translation.translate('outputRelease.form.quantityRequired') }}
                </div>
              </div>

              <!-- Product — MANDATORY for manual output entries -->
              <div class="form-group">
                <label>{{ translation.translate('outputRelease.form.product') }}</label>
                <select formControlName="productId" class="form-control"
                  [class.is-invalid]="isInvalid('productId')">
                  <option value="">{{ translation.translate('outputRelease.form.productPlaceholder') }}</option>
                  <option *ngFor="let p of activeProducts" [value]="p.id">{{ p.name }}</option>
                </select>
                <div class="invalid-feedback" *ngIf="isInvalid('productId')">{{ translation.translate('outputRelease.form.productRequired') }}</div>
              </div>

              <!-- Production Line — MANDATORY for manual output entries -->
              <div class="form-group">
                <label>{{ translation.translate('outputRelease.form.line') }}</label>
                <select formControlName="lineId" class="form-control"
                  [class.is-invalid]="isInvalid('lineId')">
                  <option value="">{{ translation.translate('outputRelease.form.linePlaceholder') }}</option>
                  <option *ngFor="let l of activeLines" [value]="l.id">{{ l.name }}</option>
                </select>
                <div class="invalid-feedback" *ngIf="isInvalid('lineId')">{{ translation.translate('outputRelease.form.lineRequired') }}</div>
              </div>

              <!-- Notes — OPTIONAL -->
              <div class="form-group full-col">
                <label>
                  {{ translation.translate('outputRelease.form.notes') }}
                  <span class="optional-tag">{{ translation.translate('outputRelease.form.notesOptional') }}</span>
                </label>
                <input type="text"
                  formControlName="notes"
                  class="form-control"
                  [placeholder]="translation.translate('outputRelease.form.notesPlaceholder')">
              </div>

            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="confirmClear()">
                {{ editingId ? translation.translate('outputRelease.actions.cancelEdit') : translation.translate('outputRelease.actions.clear') }}
              </button>
              <button type="button" class="btn-primary"
                (click)="save()"
                [disabled]="releaseForm.invalid || saving">
                {{ saving ? translation.translate('outputRelease.actions.saving') : (editingId ? translation.translate('outputRelease.actions.update') : translation.translate('outputRelease.actions.save')) }}
              </button>
            </div>
          </form>
        </div>

        <!-- ── History ─────────────────────────────────────────── -->
        <div class="card history-card">
          <div class="card-header history-header">
            <h3>{{ translation.translate('outputRelease.history.title') }}</h3>
            <div class="history-actions">
              <div class="search-bar">
                <mat-icon class="search-icon">search</mat-icon>
                <input type="text" [placeholder]="translation.translate('outputRelease.search.placeholder')" [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
              </div>
            </div>
          </div>

          <!-- Filters -->
          <div class="filters-section">
            <div class="filter-group">
              <label>{{ translation.translate('outputRelease.filter.date') }}</label>
              <select [(ngModel)]="dateFilter" (ngModelChange)="applyFilter()" class="filter-select">
                <option value="">{{ translation.translate('outputRelease.filter.allDates') }}</option>
                <option value="today">{{ translation.translate('outputRelease.filter.today') }}</option>
                <option value="week">{{ translation.translate('outputRelease.filter.week') }}</option>
                <option value="month">{{ translation.translate('outputRelease.filter.month') }}</option>
              </select>
            </div>
            <div class="filter-group">
              <label>{{ translation.translate('outputRelease.filter.product') }}</label>
              <select [(ngModel)]="productFilter" (ngModelChange)="applyFilter()" class="filter-select">
                <option value="">{{ translation.translate('outputRelease.filter.allProducts') }}</option>
                <option *ngFor="let p of activeProducts" [value]="p.id">{{ p.name }}</option>
              </select>
            </div>
            <div class="filter-group">
              <label>{{ translation.translate('outputRelease.filter.line') }}</label>
              <select [(ngModel)]="lineFilter" (ngModelChange)="applyFilter()" class="filter-select">
                <option value="">{{ translation.translate('outputRelease.filter.allLines') }}</option>
                <option *ngFor="let l of activeLines" [value]="l.id">{{ l.name }}</option>
              </select>
            </div>
            <div class="filter-group">
              <label>{{ translation.translate('outputRelease.filter.source') }}</label>
              <select [(ngModel)]="sourceFilter" (ngModelChange)="applyFilter()" class="filter-select">
                <option value="">{{ translation.translate('outputRelease.filter.allSources') }}</option>
                <option value="MANUAL_ENTRY">{{ translation.translate('outputRelease.filter.manualEntry') }}</option>
                <option value="LEGACY_AMBIGUOUS_SESSION">{{ translation.translate('outputRelease.filter.legacy') }}</option>
              </select>
            </div>
            <button type="button" class="btn-text" (click)="clearFilters()">{{ translation.translate('outputRelease.filter.clear') }}</button>
          </div>

          <div class="card-body p-0">
            <div *ngIf="loadingHistory" class="loading-state">{{ translation.translate('outputRelease.state.loading') }}</div>

            <app-empty-state
              *ngIf="!loadingHistory && !filteredHistory.length"
              icon="output"
              [title]="translation.translate('outputRelease.state.emptyTitle')"
              [description]="translation.translate('outputRelease.state.emptyDescription')"
              variant="neutral">
            </app-empty-state>

            <div class="table-responsive" *ngIf="!loadingHistory && filteredHistory.length > 0">
              <table mat-table [dataSource]="dataSource" class="tpms-table">

                <ng-container matColumnDef="releaseDate">
                  <th mat-header-cell *matHeaderCellDef>{{ translation.translate('outputRelease.table.releaseDate') }}</th>
                  <td mat-cell *matCellDef="let r">{{ r.releaseDate | date:'shortDate' }}</td>
                </ng-container>

                <ng-container matColumnDef="product">
                  <th mat-header-cell *matHeaderCellDef>{{ translation.translate('outputRelease.table.product') }}</th>
                  <td mat-cell *matCellDef="let r">
                    <span *ngIf="getProductName(r)" class="font-medium text-primary-color">{{ getProductName(r) }}</span>
                    <span *ngIf="!getProductName(r)" class="text-tertiary">
                      {{ r.dataSource === 'LEGACY_AMBIGUOUS_SESSION' ? translation.translate('outputRelease.table.unknownLegacy') : '—' }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="line">
                  <th mat-header-cell *matHeaderCellDef>{{ translation.translate('outputRelease.table.line') }}</th>
                  <td mat-cell *matCellDef="let r">
                    <span *ngIf="getLineName(r)" class="line-badge">{{ getLineName(r) }}</span>
                    <span *ngIf="!getLineName(r)" class="text-tertiary">—</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="releasedQuantity">
                  <th mat-header-cell *matHeaderCellDef>{{ translation.translate('outputRelease.table.quantity') }}</th>
                  <td mat-cell *matCellDef="let r">
                    <span class="qty-cell">{{ r.releasedQuantity | number }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="dataSource">
                  <th mat-header-cell *matHeaderCellDef>{{ translation.translate('outputRelease.table.source') }}</th>
                  <td mat-cell *matCellDef="let r">
                    <span class="provenance-badge"
                      [class.provenance-badge--manual]="r.dataSource === 'MANUAL_ENTRY'"
                      [class.provenance-badge--legacy]="r.dataSource === 'LEGACY_AMBIGUOUS_SESSION'"
                      [matTooltip]="r.dataSource === 'LEGACY_AMBIGUOUS_SESSION' ? translation.translate('outputRelease.table.tooltip.legacy') : translation.translate('outputRelease.table.tooltip.manual')">
                      {{ r.dataSource === 'MANUAL_ENTRY' ? translation.translate('outputRelease.table.manual') : translation.translate('outputRelease.table.legacy') }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="actions-col">{{ translation.translate('outputRelease.table.actions') }}</th>
                  <td mat-cell *matCellDef="let r" class="actions-col">
                    <div class="table-actions">
                      <button mat-icon-button class="action-btn" [title]="translation.translate('outputRelease.action.view')" (click)="viewDetails(r)">
                        <mat-icon>visibility</mat-icon>
                      </button>
                      <!-- Edit only allowed for MANUAL_ENTRY records -->
                      <button mat-icon-button class="action-btn" [title]="translation.translate('outputRelease.action.edit')"
                        (click)="editRecord(r)"
                        *ngIf="r.dataSource === 'MANUAL_ENTRY'"
                        [disabled]="!!editingId && editingId !== r.id">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <!-- For legacy records: view-only indicator -->
                      <mat-icon class="legacy-lock-icon"
                        *ngIf="r.dataSource === 'LEGACY_AMBIGUOUS_SESSION'"
                        [matTooltip]="translation.translate('outputRelease.table.tooltip.legacyLock')"
                        [matTooltipShowDelay]="300">
                        lock
                      </mat-icon>
                      <button mat-icon-button class="action-btn delete-btn" [title]="translation.translate('outputRelease.action.delete')" (click)="deleteRecord(r)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="columns"></tr>
                <tr mat-row *matRowDef="let row; columns: columns;"
                  [class.row-legacy]="row.dataSource === 'LEGACY_AMBIGUOUS_SESSION'"></tr>
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

    .output-container {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      padding: var(--space-6);
      max-width: 1200px;
      margin: 0 auto;
    }

    /* ── Info notice ──────────────────────────── */
    .info-notice {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: rgba(99, 102, 241, 0.07);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--text-secondary);

      mat-icon { color: var(--primary); font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
      strong { color: var(--text-primary); }
    }

    /* ── Card Base ────────────────────────────── */
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

    .source-badge {
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      padding: 2px 10px;
      border-radius: var(--radius-sm);
      background: rgba(16, 185, 129, 0.12);
      color: #065f46;
      letter-spacing: 0.05em;
    }

    .card-body { padding: var(--space-6); }
    .p-0 { padding: 0 !important; }

    /* ── Form ─────────────────────────────────── */
    .tpms-form { display: flex; flex-direction: column; gap: var(--space-5); }

    .form-row {
      display: grid;
      gap: var(--space-4);
    }
    .header-row { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
    .full-col { grid-column: 1 / -1; }

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
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
    }

    .optional-tag {
      font-size: 10px;
      font-weight: var(--weight-regular);
      color: var(--text-tertiary);
      text-transform: lowercase;
      letter-spacing: 0;
      background: var(--surface-alt);
      padding: 1px 6px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
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

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
      border-top: 1px solid var(--border-subtle);
    }

    /* ── History ──────────────────────────────── */
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
      box-shadow: var(--shadow-xs);
      &:focus-within { border-color: var(--primary); box-shadow: var(--shadow-glow); }
      input {
        border: none; background: transparent; outline: none;
        padding: 0 var(--space-2); width: 100%;
        font-size: var(--text-sm); color: var(--text-primary); font-family: var(--font-sans);
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
      &:focus { outline: none; border-color: var(--primary); }
    }

    .btn-text {
      background: none; border: none; color: var(--primary);
      font-size: var(--text-xs); font-weight: var(--weight-medium);
      cursor: pointer; padding: 4px var(--space-2); border-radius: var(--radius-sm);
      &:hover { background: var(--primary-50); }
    }

    /* ── Table ────────────────────────────────── */
    .tpms-table { width: 100%; }
    .actions-col { width: 120px; text-align: right; }
    .table-actions { display: flex; justify-content: flex-end; align-items: center; gap: 4px; }

    .action-btn {
      color: var(--text-tertiary);
      width: 32px; height: 32px;
      border-radius: var(--radius-md);
      &:hover { color: var(--primary); background: var(--primary-50); }
    }
    .delete-btn:hover { color: var(--error) !important; background: var(--error-light) !important; }

    .legacy-lock-icon {
      font-size: 16px; width: 16px; height: 16px;
      color: var(--text-tertiary);
      cursor: help;
    }

    .loading-state {
      padding: var(--space-12); text-align: center;
      color: var(--text-secondary); font-size: var(--text-sm);
    }

    /* ── Misc ─────────────────────────────────── */
    .font-medium { font-weight: var(--weight-medium); }
    .text-primary-color { color: var(--primary); }
    .text-tertiary { color: var(--text-tertiary); font-size: var(--text-sm); font-style: italic; }

    .qty-cell {
      font-weight: var(--weight-medium);
      font-size: var(--text-sm);
      color: var(--text-primary);
    }

    .line-badge { font-size: var(--text-sm); color: var(--text-primary); }

    .provenance-badge {
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
    }
    .provenance-badge--manual {
      background: rgba(16, 185, 129, 0.12);
      color: #065f46;
    }
    .provenance-badge--legacy {
      background: rgba(245, 158, 11, 0.12);
      color: #92400e;
    }

    /* Legacy rows get a subtle visual distinction */
    ::ng-deep .row-legacy td {
      color: var(--text-secondary);
    }

    /* ── Mat Table Overrides ──────────────────── */
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
      }
    }

    /* ── RTL (scoped to output-release drained pages) ────────── */
    .tpms-dir[dir="rtl"] {
      label {
        text-transform: none;
        letter-spacing: 0;
      }
      .form-actions {
        justify-content: flex-start;
      }
      .date-input-wrapper {
        input { padding-right: var(--space-3); padding-left: 40px; }
        mat-datepicker-toggle { right: auto; left: 0; }
      }
      .actions-col { text-align: left; }
      .table-actions { justify-content: flex-start; }
      .filter-group label {
        text-transform: none;
        letter-spacing: 0;
      }
      ::ng-deep .tpms-table .mat-mdc-header-cell {
        text-align: right;
        text-transform: none;
        letter-spacing: 0;
      }
    }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Buttons (shared) ─────────────────────── */
    .btn-primary {
      padding: var(--space-2) var(--space-5);
      background: var(--primary);
      color: white;
      border: none;
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      cursor: pointer;
      transition: background var(--transition-fast), opacity var(--transition-fast);
      &:hover:not(:disabled) { background: var(--primary-dark, #4338ca); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .btn-secondary {
      padding: var(--space-2) var(--space-5);
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
      &:hover { background: var(--surface-alt); color: var(--text-primary); }
    }
  `]
})
export class OutputReleaseComponent implements OnInit {
  private fb          = inject(FormBuilder);
  private dialog      = inject(MatDialog);
  private outputSvc   = inject(OutputReleaseService);
  private productSvc  = inject(ProductService);
  private lineSvc     = inject(LineService);
  readonly translation = inject(TranslationService);

  releaseForm!: FormGroup;
  saving       = false;
  editingId: string | null = null;
  private submissionGuard = new SubmissionGuard();

  /**
   * Identity of the CURRENT logical save attempt. Generated once when a NEW
   * submission begins, reused while the save is uncertain/failed, cleared
   * after a confirmed successful save or an explicit reset.
   * Never derived from business content — identical content on a later
   * legitimate entry must still be a separate transaction.
   */
  private pendingSubmissionId: string | null = null;

  // Master data
  activeProducts: Product[] = [];
  activeLines: Line[] = [];
  private productsMap = new Map<string, Product>();
  private linesMap    = new Map<string, Line>();

  // History
  history: OutputRelease[] = [];
  filteredHistory: OutputRelease[] = [];
  dataSource = new MatTableDataSource<OutputRelease>();
  loadingHistory = true;

  columns: string[] = ['releaseDate', 'product', 'line', 'releasedQuantity', 'dataSource', 'actions'];

  // Filters
  searchTerm   = '';
  dateFilter   = '';
  productFilter = '';
  lineFilter   = '';
  sourceFilter = '';

  ngOnInit(): void {
    this.initForm();
    this.loadMasterData();
  }

  private initForm(): void {
    this.releaseForm = this.fb.group({
      releaseDate:       [getDefaultOperationalDate(), Validators.required],
      releasedQuantity:  [null, [Validators.required, Validators.min(1)]],
      productId:         ['', Validators.required],   // MANUAL_ENTRY requires product
      lineId:            ['', Validators.required],   // MANUAL_ENTRY requires line
      notes:             ['']                         // optional
    });
  }

  isInvalid(name: string): boolean {
    const ctrl = this.releaseForm.get(name);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  // ── Lookup helpers ────────────────────────────────────────────────────────

  getProductName(r: OutputRelease): string {
    if (!r.productId) return '';
    return this.productsMap.get(r.productId)?.name || r.productId;
  }

  getLineName(r: OutputRelease): string {
    if (!r.lineId) return '';
    return this.linesMap.get(r.lineId)?.name || r.lineId;
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  save(): void {
    if (this.releaseForm.invalid) {
      this.releaseForm.markAllAsTouched();
      return;
    }

    if (!this.submissionGuard.acquire()) {
      return; // Double-click blocked
    }

    this.saving = true;
    const v = this.releaseForm.getRawValue();

    if (this.editingId) {
      // Edit existing record - use update
      const record: OutputRelease = {
        id:               this.editingId,
        releaseDate:      this.formatDate(v.releaseDate),
        releasedQuantity: v.releasedQuantity,
        productId:        v.productId || undefined,
        lineId:           v.lineId || undefined,
        notes:            v.notes?.trim() || undefined,
        dataSource:       'MANUAL_ENTRY',
        createdAt:        this.history.find(h => h.id === this.editingId)?.createdAt || new Date().toISOString(),
        updatedAt:        new Date().toISOString()
      };

      this.outputSvc.update(record).subscribe({
        next: () => {
          this.saving = false;
          this.submissionGuard.release();
          this.editingId = null;
          this.clearForm();
          this.loadHistory();
        },
        error: (err) => {
          console.error('Error updating output release:', err);
          this.saving = false;
          this.submissionGuard.release();
        }
      });
    } else {
      // New record - use idempotent create.
      // Cache the submission id across retries of the SAME logical attempt;
      // a later legitimate entry with identical business content always gets
      // a fresh submission id because the previous one was cleared on success.
      if (!this.pendingSubmissionId) {
        this.pendingSubmissionId = this.newSubmissionId();
      }

      const idForThisAttempt = this.pendingSubmissionId;
      const input: OutputReleaseInput = {
        releaseDate:      this.formatDate(v.releaseDate),
        releasedQuantity: v.releasedQuantity,
        productId:        v.productId,
        lineId:           v.lineId,
        notes:            v.notes?.trim() || undefined,
        transactionId:    idForThisAttempt
      };

      this.outputSvc.createIdempotent(input).subscribe({
        next: () => {
          this.saving = false;
          this.submissionGuard.release();
          this.pendingSubmissionId = null; // confirmed saved → next entry is new
          this.editingId = null;
          this.clearForm();
          this.loadHistory();
        },
        error: (err) => {
          console.error('Error saving output release:', err);
          this.saving = false;
          this.submissionGuard.release();
          // pendingSubmissionId is intentionally KEPT → retry reuses the same id
        }
      });
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  editRecord(record: OutputRelease): void {
    // Only MANUAL_ENTRY records are editable
    if (record.dataSource !== 'MANUAL_ENTRY') return;

    this.pendingSubmissionId = null; // editing is a fresh logical operation
    this.editingId = record.id;
    this.releaseForm.patchValue({
      releaseDate:      parseLocalCalendarDate(record.releaseDate) ?? getDefaultOperationalDate(),
      releasedQuantity: record.releasedQuantity,
      productId:        record.productId || '',
      lineId:           record.lineId || '',
      notes:            record.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  deleteRecord(record: OutputRelease): void {
    const isLegacy = record.dataSource === 'LEGACY_AMBIGUOUS_SESSION';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: isLegacy ? this.translation.translate('outputRelease.delete.legacyTitle') : this.translation.translate('outputRelease.delete.title'),
        message: isLegacy
          ? this.translation.translate('outputRelease.delete.legacyMessage')
          : this.translation.translate('outputRelease.delete.message'),
        confirmText: this.translation.translate('outputRelease.delete.confirm'),
        cancelText: this.translation.translate('common.cancel'),
        variant: 'danger'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.outputSvc.delete(record.id).subscribe({
          next: () => this.loadHistory(),
          error: (err) => console.error('Error deleting output release:', err)
        });
      }
    });
  }

  // ── View Details ──────────────────────────────────────────────────────────

  viewDetails(record: OutputRelease): void {
    this.dialog.open(OutputReleaseDetailsDialogComponent, {
      data: {
        record,
        productName: this.getProductName(record),
        lineName:    this.getLineName(record)
      }
    });
  }

  // ── Clear form ────────────────────────────────────────────────────────────

  confirmClear(): void {
    if (this.releaseForm.dirty || this.editingId) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: this.translation.translate('outputRelease.clear.title'),
          message: this.translation.translate('outputRelease.clear.message'),
          confirmText: this.translation.translate('outputRelease.clear.confirm'),
          cancelText: this.translation.translate('common.cancel'),
          variant: 'warning'
        }
      });
      dialogRef.afterClosed().subscribe(confirmed => { if (confirmed) this.clearForm(); });
    } else {
      this.clearForm();
    }
  }

  clearForm(): void {
    this.editingId = null;
    this.pendingSubmissionId = null; // explicit reset → next entry is a NEW transaction
    this.releaseForm.reset({
      releaseDate:      getDefaultOperationalDate(),
      releasedQuantity: null,
      productId:        '',
      lineId:           '',
      notes:            ''
    });
    this.releaseForm.markAsPristine();
  }

  private newSubmissionId(): string {
    // Identity of the save attempt — never derived from business content.
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  applyFilter(): void {
    const searchLower = this.searchTerm.toLowerCase();

    this.filteredHistory = this.history.filter(r => {
      const productName = this.getProductName(r).toLowerCase();
      const lineName    = this.getLineName(r).toLowerCase();

      const matchesSearch = !this.searchTerm ||
        productName.includes(searchLower) ||
        lineName.includes(searchLower) ||
        (r.notes || '').toLowerCase().includes(searchLower);

      let matchesDate = true;
      if (this.dateFilter) {
        const rDate = new Date(r.releaseDate + 'T00:00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (this.dateFilter === 'today') {
          const d = new Date(rDate); d.setHours(0, 0, 0, 0);
          matchesDate = d.getTime() === today.getTime();
        } else if (this.dateFilter === 'week') {
          const wk = new Date(today); wk.setDate(wk.getDate() - 7);
          matchesDate = rDate >= wk;
        } else if (this.dateFilter === 'month') {
          const mo = new Date(today); mo.setMonth(mo.getMonth() - 1);
          matchesDate = rDate >= mo;
        }
      }

      const matchesProduct = !this.productFilter || r.productId === this.productFilter;
      const matchesLine    = !this.lineFilter    || r.lineId    === this.lineFilter;
      const matchesSource  = !this.sourceFilter  || r.dataSource === this.sourceFilter;

      return matchesSearch && matchesDate && matchesProduct && matchesLine && matchesSource;
    });

    this.dataSource.data = this.filteredHistory;
  }

  clearFilters(): void {
    this.dateFilter   = '';
    this.productFilter = '';
    this.lineFilter   = '';
    this.sourceFilter = '';
    this.applyFilter();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  private loadMasterData(): void {
    forkJoin([
      this.productSvc.getAll(),
      this.lineSvc.getAll()
    ]).subscribe({
      next: ([products, lines]) => {
        this.activeProducts = products.filter(p => p.active);
        this.activeLines    = lines.filter(l => l.active);
        products.forEach(p => this.productsMap.set(p.id, p));
        lines.forEach(l => this.linesMap.set(l.id, l));
        this.loadHistory();
      },
      error: () => this.loadHistory()
    });
  }

  private loadHistory(): void {
    this.loadingHistory = true;
    this.outputSvc.getAll().subscribe({
      next: (records) => {
        this.history = records.sort(
          (a, b) => (parseLocalCalendarDate(b.releaseDate)?.getTime() ?? 0) - (parseLocalCalendarDate(a.releaseDate)?.getTime() ?? 0)
        );
        this.applyFilter();
        this.loadingHistory = false;
      },
      error: (err) => {
        console.error('Error loading output releases:', err);
        this.loadingHistory = false;
      }
    });
  }

  private formatDate(d: Date): string {
    return toLocalCalendarString(d);
  }
}
