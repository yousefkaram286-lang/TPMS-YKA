import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

// Shared components
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

// Chart.js
import { Chart, ChartConfiguration, registerables } from 'chart.js';
Chart.register(...registerables);

// Services & models
import {
  DashboardService, DatePreset, DateRange,
  DashboardData, DashboardStats,
  ProductionTrendPoint, ProductBreakdown, MaterialAggregate, QualityTrendPoint,
  ProductPerformanceRow, LineStatusRow, OperationalAlert,
  RecentActivity
} from '../../core/services/dashboard.service';
import { ReportService, ReportType, ReportFormat } from '../../core/services/report.service';
import { AuthService } from '../../core/services/auth.service';

// ─── Report Dialog Component ──────────────────────────────────────────────────

import { Component as NgComponent } from '@angular/core';

@NgComponent({
  selector: 'app-report-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatSelectModule,
    MatDialogModule, MatFormFieldModule, MatInputModule
  ],
  template: `
    <div class="report-dialog">
      <div class="report-dialog__header">
        <mat-icon class="report-dialog__icon">download</mat-icon>
        <h2>Download Report</h2>
        <button mat-icon-button class="report-dialog__close" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="report-dialog__body">
        <!-- Report Type -->
        <div class="field-group">
          <label>Report Type</label>
          <div class="type-grid">
            <button
              *ngFor="let t of reportTypes"
              class="type-btn"
              [class.type-btn--active]="reportType === t.value"
              (click)="reportType = t.value">
              <mat-icon>{{ t.icon }}</mat-icon>
              <span>{{ t.label }}</span>
            </button>
          </div>
        </div>

        <!-- Date Range -->
        <div class="field-group">
          <label>Date Range</label>
          <div class="preset-row">
            <button
              *ngFor="let p of presets"
              class="preset-btn"
              [class.preset-btn--active]="datePreset === p.preset && p.preset !== 'custom'"
              (click)="selectPreset(p.preset)">
              {{ p.label }}
            </button>
          </div>
          <div *ngIf="datePreset === 'custom'" class="custom-dates">
            <div class="date-field">
              <label>From</label>
              <input type="date" [(ngModel)]="customStart" class="date-input">
            </div>
            <div class="date-field">
              <label>To</label>
              <input type="date" [(ngModel)]="customEnd" class="date-input">
            </div>
          </div>
        </div>

        <!-- Format -->
        <div class="field-group">
          <label>Format</label>
          <div class="format-row">
            <button
              class="format-btn"
              [class.format-btn--active]="format === 'xlsx'"
              (click)="format = 'xlsx'">
              <mat-icon>table_chart</mat-icon>
              Excel (.xlsx)
            </button>
            <button
              class="format-btn"
              [class.format-btn--active]="format === 'pdf'"
              (click)="format = 'pdf'">
              <mat-icon>picture_as_pdf</mat-icon>
              Professional PDF
            </button>
          </div>
        </div>
      </div>

      <div class="report-dialog__footer">
        <button mat-button (click)="close()" class="btn-cancel">Cancel</button>
        <button mat-button class="btn-download" (click)="download()">
          <mat-icon>download</mat-icon>
          Download
        </button>
      </div>
    </div>
  `,
  styles: [`
    .report-dialog {
      width: 480px;
      max-width: 95vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      background: var(--surface);
      color: var(--text-primary);
    }

    .report-dialog__header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-5) var(--space-6);
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;

      mat-icon.report-dialog__icon {
        color: var(--accent);
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      h2 {
        flex: 1;
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--weight-semibold);
        color: var(--text-primary);
      }
    }

    .report-dialog__close {
      color: var(--text-secondary);
      transition: color 0.2s;

      &:hover {
        color: var(--text-primary);
      }
    }

    .report-dialog__body {
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      overflow-y: auto;
      min-height: 0;
    }

    .field-group > label {
      display: block;
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      color: var(--text-secondary);
      margin-bottom: var(--space-3);
    }

    .type-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }

    .type-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface-alt);
      cursor: pointer;
      font-size: var(--text-sm);
      color: var(--text-secondary);
      transition: all 0.2s;

      mat-icon { font-size: 20px; width: 20px; height: 20px; }

      &:hover { 
        border-color: var(--accent); 
        color: var(--accent);
        background: var(--surface);
      }
    }

    .type-btn--active {
      border-color: var(--accent);
      background: var(--primary-50);
      color: var(--accent);
      font-weight: var(--weight-medium);
    }

    .preset-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .preset-btn {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full, 9999px);
      border: 1px solid var(--border);
      background: var(--surface-alt);
      font-size: var(--text-xs);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;

      &:hover { 
        border-color: var(--accent); 
        color: var(--accent);
        background: var(--surface);
      }
    }

    .preset-btn--active {
      border-color: var(--accent);
      background: var(--primary-50);
      color: var(--accent);
      font-weight: var(--weight-medium);
    }

    .custom-dates {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
      margin-top: var(--space-3);
    }

    .date-field > label {
      display: block;
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      margin-bottom: var(--space-1);
    }

    .date-input {
      width: 100%;
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--text-primary);
      background: var(--surface);
      font-family: inherit;

      &:focus { 
        outline: none; 
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgb(14 165 233 / 0.1);
      }
    }

    .format-row {
      display: flex;
      gap: var(--space-3);
    }

    .format-btn {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface-alt);
      cursor: pointer;
      font-size: var(--text-sm);
      color: var(--text-secondary);
      transition: all 0.2s;

      mat-icon { font-size: 18px; width: 18px; height: 18px; }

      &:hover { 
        border-color: var(--accent); 
        color: var(--accent);
        background: var(--surface);
      }
    }

    .format-btn--active {
      border-color: var(--accent);
      background: var(--primary-50);
      color: var(--accent);
      font-weight: var(--weight-medium);
    }

    .report-dialog__footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .btn-cancel {
      color: var(--text-secondary);
      background: transparent;
      border: 1px solid var(--border);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--surface-alt);
        color: var(--text-primary);
      }
    }

    .btn-download {
      background: var(--gradient-primary);
      color: var(--text-inverse);
      border: none;
      border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-4);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      cursor: pointer;
      transition: all 0.2s;

      mat-icon { font-size: 18px; width: 18px; height: 18px; }

      &:hover {
        background: var(--gradient-brand);
        box-shadow: 0 6px 18px rgb(109 93 246 / 0.35);
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0);
      }
    }

    // Dark mode adjustments
    :host-context([data-theme="dark"]) .report-dialog {
      .type-btn--active,
      .preset-btn--active,
      .format-btn--active {
        background: var(--primary-100);
      }

      .date-input:focus {
        box-shadow: 0 0 0 3px rgb(59 130 246 / 0.2);
      }

      .btn-download:hover {
        background: var(--accent-dark);
      }
    }
  `]
})
export class ReportDialogComponent {
  private dashboardSvc = inject(DashboardService);

  reportType: ReportType = 'production';
  format: ReportFormat = 'xlsx';
  datePreset: DatePreset = 'today';
  customStart = this.dashboardSvc.localDateStr(new Date());
  customEnd = this.dashboardSvc.localDateStr(new Date());

  reportTypes: { value: ReportType; label: string; icon: string }[] = [
    { value: 'production', label: 'Production', icon: 'precision_manufacturing' },
    { value: 'materials', label: 'Materials', icon: 'science' },
    { value: 'quality', label: 'Quality', icon: 'verified' },
    { value: 'complete', label: 'Complete Report', icon: 'summarize' },
    { value: 'daily', label: 'Daily Report', icon: 'calendar_today' },
    { value: 'monthly', label: 'Monthly Report', icon: 'calendar_month' }
  ];

  presets = this.dashboardSvc.getPresets();

  // injected from parent after open
  data!: DashboardData;
  reportService!: ReportService;
  dialogRef!: any;

  selectPreset(preset: DatePreset): void {
    this.datePreset = preset;
  }

  download(): void {
    const range = this.dashboardSvc.buildDateRange(
      this.datePreset,
      this.datePreset === 'custom' ? this.customStart : undefined,
      this.datePreset === 'custom' ? this.customEnd : undefined
    );
    const filtered = this.dashboardSvc.filterData(this.data, range);
    this.reportService.generate({
      type: this.reportType,
      format: this.format,
      range,
      productions: filtered.productions,
      sessions: filtered.sessions,
      materials: filtered.materials,
      qualityTests: filtered.qualityTests,
      releases: filtered.releases,
      products: this.data.products,
      shifts: this.data.shifts,
      lines: this.data.lines,
      materialsMaster: this.data.materialsMaster,
      unitCostsMaster: this.data.unitCostsMaster
    });
    this.dialogRef.close();
  }

  close(): void {
    this.dialogRef.close();
  }
}

// ─── Dashboard Component ──────────────────────────────────────────────────────

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    PageHeaderComponent,
    AppCardComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <!-- Page Header with Download button -->
    <app-page-header
      title="Dashboard"
      subtitle="Factory overview and performance analytics"
      icon="dashboard"
    >
      <button mat-button class="btn-report" actions *ngIf="isAdmin()" (click)="openReportDialog()">
        <mat-icon>download</mat-icon>
        Download Report
      </button>
    </app-page-header>

    <div class="dashboard-container">

      <!-- Date Filter Bar -->
      <div class="filter-bar">
        <div class="filter-bar__presets">
          <button
            *ngFor="let p of presets"
            class="filter-chip"
            [class.filter-chip--active]="datePreset === p.preset && p.preset !== 'custom'"
            (click)="selectPreset(p.preset)">
            {{ p.label }}
          </button>
        </div>
        <div *ngIf="datePreset === 'custom'" class="filter-bar__custom">
          <input type="date" [(ngModel)]="customStart" (change)="applyCustomRange()" class="date-input">
          <span class="date-sep">→</span>
          <input type="date" [(ngModel)]="customEnd" (change)="applyCustomRange()" class="date-input">
        </div>
        <span class="filter-bar__label">{{ currentRange?.label }}</span>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-state">
        <div class="dashboard-grid">
          <div class="stat-card skeleton" *ngFor="let i of [1,2,3,4]">
            <div class="stat-card__icon skeleton-box"></div>
            <div class="stat-card__info">
              <p class="stat-card__label skeleton-text short"></p>
              <h3 class="stat-card__value skeleton-text"></h3>
            </div>
          </div>
        </div>
        <div class="charts-grid">
          <div class="chart-card skeleton-card" *ngFor="let i of [1,2,3,4]">
            <div class="skeleton-text short" style="margin-bottom:12px"></div>
            <div class="skeleton-box" style="height:220px; border-radius:8px"></div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div *ngIf="error" class="error-state">
        <app-empty-state
          icon="error_outline"
          title="Unable to load dashboard data"
          description="There was a problem loading the dashboard data. Please try again."
          variant="warning"
        >
          <button mat-button (click)="load()" class="btn-primary">Retry</button>
        </app-empty-state>
      </div>

      <!-- Dashboard Content -->
      <div *ngIf="!loading && !error" class="dashboard-content">

        <!-- Operational Alerts -->
        <div *ngIf="alerts.length > 0" class="alerts-block">
          <div
            class="alert-item"
            [class.alert-item--warning]="a.severity === 'warning'"
            [class.alert-item--danger]="a.severity === 'danger'"
            [class.alert-item--info]="a.severity === 'info'"
            *ngFor="let a of alerts">
            <mat-icon class="alert-item__icon">{{ a.icon }}</mat-icon>
            <div class="alert-item__content">
              <p class="alert-item__title">{{ a.title }}</p>
              <p class="alert-item__desc">{{ a.description }}</p>
            </div>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="dashboard-grid" id="kpi-grid">
          <app-card [compact]="true" class="stat-card-wrapper clickable" (click)="navigateTo('/production')">
            <div class="stat-card">
              <div class="stat-card__icon bg-primary-light">
                <mat-icon>precision_manufacturing</mat-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__label">{{ datePreset === 'today' ? "Today's Production" : 'Total Production' }}</p>
                <h3 class="stat-card__value">{{ stats.totalProduction | number }}</h3>
                <p class="stat-card__sub">pieces</p>
              </div>
            </div>
          </app-card>

          <app-card [compact]="true" class="stat-card-wrapper clickable" (click)="navigateTo('/materials')">
            <div class="stat-card">
              <div class="stat-card__icon bg-info-light">
                <mat-icon>science</mat-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__label">{{ datePreset === 'today' ? "Today's Mixes" : 'Total Mixes' }}</p>
                <h3 class="stat-card__value">{{ stats.totalMixes | number }}</h3>
                <p class="stat-card__sub">mixes</p>
              </div>
            </div>
          </app-card>

          <app-card [compact]="true" class="stat-card-wrapper clickable" (click)="navigateTo('/quality')">
            <div class="stat-card">
              <div class="stat-card__icon bg-warning-light">
                <mat-icon>verified</mat-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__label">Samples Tested</p>
                <h3 class="stat-card__value">{{ stats.qualitySamples | number }}</h3>
                <p class="stat-card__sub">samples</p>
              </div>
            </div>
          </app-card>

          <app-card [compact]="true" class="stat-card-wrapper clickable" (click)="navigateTo('/quality')">
            <div class="stat-card">
              <div class="stat-card__icon" [ngClass]="stats.passRate >= 80 ? 'bg-success-light' : 'bg-warning-light'">
                <mat-icon>check_circle</mat-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__label">Sample Pass Rate</p>
                <h3 class="stat-card__value">{{ stats.passRate | number:'1.1-1' }}%</h3>
                <p class="stat-card__sub">{{ stats.qualitySamples > 0 ? 'of ' + stats.qualitySamples + ' samples tested' : 'no data' }}</p>
              </div>
            </div>
          </app-card>

          <app-card [compact]="true" class="stat-card-wrapper">
            <div class="stat-card">
              <div class="stat-card__icon" [ngClass]="stats.timeEfficiency >= 90 ? 'bg-success-light' : 'bg-warning-light'">
                <mat-icon>timer</mat-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__label">Time Efficiency</p>
                <h3 class="stat-card__value">{{ stats.timeEfficiency | number:'1.1-1' }}%</h3>
                <p class="stat-card__sub">Runtime / Available</p>
              </div>
            </div>
          </app-card>
        </div>

        <!-- Charts Row 1: Production -->
        <div class="charts-grid">
          <!-- Production Trend -->
          <app-card title="Production Trend" class="chart-card">
            <ng-template #prodTrendEmpty>
              <div class="chart-empty">
                <mat-icon>show_chart</mat-icon>
                <p>No production data for this period</p>
              </div>
            </ng-template>
            <div *ngIf="productionTrend.length > 0; else prodTrendEmpty" class="chart-wrapper">
              <canvas #prodTrendChart></canvas>
            </div>
          </app-card>

          <!-- Production by Product -->
          <app-card title="Production by Product" class="chart-card">
            <ng-template #prodProductEmpty>
              <div class="chart-empty">
                <mat-icon>bar_chart</mat-icon>
                <p>No production data for this period</p>
              </div>
            </ng-template>
            <div *ngIf="productionByProduct.length > 0; else prodProductEmpty" class="chart-wrapper">
              <canvas #prodProductChart></canvas>
            </div>
          </app-card>
        </div>

        <!-- Charts Row 2: Materials & Quality Results -->
        <div class="charts-grid">
          <!-- Materials Overview -->
          <app-card title="Materials Overview" class="chart-card">
            <div *ngIf="materialAggregates.length === 0" class="chart-empty">
              <mat-icon>science</mat-icon>
              <p>No material data for this period</p>
            </div>
            <div *ngIf="materialAggregates.length > 0" class="materials-table-wrapper">
              <div class="materials-summary">
                <div class="materials-kpi">
                  <span class="materials-kpi__value">{{ filteredData.materials.length }}</span>
                  <span class="materials-kpi__label">Batch Records</span>
                </div>
                <div class="materials-kpi">
                  <span class="materials-kpi__value">{{ stats.totalMixes | number }}</span>
                  <span class="materials-kpi__label">Total Mixes</span>
                </div>
              </div>
              <div class="mat-table-scroll">
                <table class="mat-table compact-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th class="text-right">Theoretical</th>
                      <th class="text-right">Actual</th>
                      <th class="text-right">m³ (converted)</th>
                      <th class="text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let m of materialAggregates">
                      <td>{{ m.material }}</td>
                      <td class="text-right">{{ m.theoreticalQuantity | number:'1.1-1' }} {{ m.unit }}</td>
                      <td class="text-right">{{ m.actualQuantity | number:'1.1-1' }} {{ m.unit }}</td>
                      <td class="text-right">
                        <span *ngIf="m.conversionStatus === 'OK' && m.unit === 'kg'">{{ m.cubicMeters | number:'1.1-2' }} m³</span>
                        <span *ngIf="m.conversionStatus === 'OK' && m.unit !== 'kg'">—</span>
                        <span *ngIf="m.conversionStatus === 'CONFIGURATION_REQUIRED'" class="config-required">CONFIGURATION REQUIRED</span>
                      </td>
                      <td class="text-right" [class.variance-neg]="m.variance < 0" [class.variance-pos]="m.variance > 0">
                        {{ m.variance >= 0 ? '+' : '' }}{{ m.variance | number:'1.1-1' }} {{ m.unit }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div *ngIf="materialConversionRequired" class="config-required-note">
                Set SandKgPerM3 / AggregateKgPerM3 in the Material master to report Kg totals in cubic metres (CONFIGURATION REQUIRED).
              </div>
            </div>
          </app-card>

          <!-- Quality Results Doughnut -->
          <app-card title="Quality Results" class="chart-card">
            <ng-template #qualityEmpty>
              <div class="chart-empty">
                <mat-icon>donut_large</mat-icon>
                <p>No quality data for this period</p>
              </div>
            </ng-template>
            <div *ngIf="stats.qualitySamples > 0; else qualityEmpty">
              <div class="quality-legend">
                <div class="quality-legend__item quality-legend__item--pass">
                  <span class="quality-legend__dot"></span>
                  <span>Samples Passed: {{ passCount }}</span>
                </div>
                <div class="quality-legend__item quality-legend__item--fail">
                  <span class="quality-legend__dot"></span>
                  <span>Samples Failed: {{ failCount }}</span>
                </div>
              </div>
              <div class="chart-wrapper chart-wrapper--sm">
                <canvas #qualityChart></canvas>
              </div>
            </div>
          </app-card>
        </div>

        <!-- Charts Row 3: Quality Trend (Avg Compression per Day) -->
        <div *ngIf="qualityTrend.length > 0" class="charts-grid-single">
          <app-card title="Quality Trend (Avg Compression per Day)" class="chart-card chart-card--wide">
            <div class="chart-wrapper">
              <canvas #qualityTrendChart></canvas>
            </div>
          </app-card>
        </div>

        <!-- Production vs Released Output -->
        <div *ngIf="productPerformance.length > 0" class="charts-grid-single">
          <app-card title="Production vs Released Output (by Product)" class="chart-card chart-card--wide">
            <div class="mat-table-scroll">
              <table class="mat-table compact-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th class="text-right">Presses</th>
                    <th class="text-right">Press Production</th>
                    <th class="text-right">Released Output</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of productPerformance">
                    <td>{{ row.productName }}</td>
                    <td class="text-right">{{ row.presses | number }}</td>
                    <td class="text-right">{{ row.produced | number }}</td>
                    <td class="text-right">{{ row.releasedOutput | number }}</td>
                  </tr>
                </tbody>
              </table>
              <p class="prod-output-note">
                Production and Released Output are independent transactions. Pressed and released Products may differ on the same Line/date; no genealogy is implied.
              </p>
            </div>
          </app-card>
        </div>

        <!-- Line Status -->
        <div *ngIf="lineStatus.length > 0" class="charts-grid-single">
          <app-card title="Line Status" class="chart-card chart-card--wide">
            <div class="mat-table-scroll">
              <table class="mat-table compact-table line-status-table">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Products</th>
                    <th class="text-right">Presses</th>
                    <th class="text-right">Produced</th>
                    <th class="text-right">Released</th>
                    <th class="text-right">Mixes</th>
                    <th class="text-right">Downtime (min)</th>
                    <th class="text-right">Overtime (h)</th>
                    <th class="text-right">Time Efficiency</th>
                    <th class="text-right">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of lineStatus">
                    <td><strong>{{ row.lineName }}</strong></td>
                    <td>
                      <div class="line-products" *ngIf="row.products.length > 0; else noProducts">
                        <div class="line-product" *ngFor="let pr of row.products">
                          <span>{{ pr.productName }}</span>
                          <span class="line-product__qty">{{ pr.produced | number }} pressed · {{ pr.releasedOutput | number }} released</span>
                        </div>
                      </div>
                      <ng-template #noProducts>—</ng-template>
                    </td>
                    <td class="text-right">{{ row.presses | number }}</td>
                    <td class="text-right">{{ row.produced | number }}</td>
                    <td class="text-right">{{ row.releasedOutput | number }}</td>
                    <td class="text-right">{{ row.mixCount | number }}</td>
                    <td class="text-right">{{ row.downtimeMinutes | number }}</td>
                    <td class="text-right">{{ row.overtimeHours | number:'1.0-1' }}</td>
                    <td class="text-right">{{ row.timeEfficiency | number:'1.1-1' }}%</td>
                    <td class="text-right">
                      <span *ngIf="row.qualitySamples > 0">{{ row.qualityPassed }}/{{ row.qualitySamples }} samples passed</span>
                      <span *ngIf="row.qualitySamples === 0">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </app-card>
        </div>

        <!-- Recent Activities -->
        <app-card title="Recent Activities" class="activities-card">
          <div *ngIf="recentActivities.length === 0" class="empty-activities">
            <app-empty-state
              icon="history"
              title="No recent activities"
              description="Start recording Production, Materials, or Quality data to see activities here."
              variant="neutral"
              [isPage]="false"
            ></app-empty-state>
          </div>
          <div *ngIf="recentActivities.length > 0" class="activities-list">
            <div class="activity-item" *ngFor="let activity of recentActivities">
              <div class="activity-icon" [ngClass]="'activity-icon--' + activity.type">
                <mat-icon>{{ activity.icon }}</mat-icon>
              </div>
              <div class="activity-content">
                <div class="activity-header">
                  <span class="activity-type">{{ activity.title }}</span>
                  <span class="activity-time">{{ activity.relativeTime }}</span>
                </div>
                <p class="activity-description">{{ activity.description }}</p>
              </div>
            </div>
          </div>
        </app-card>

      </div><!-- /dashboard-content -->
    </div><!-- /dashboard-container -->
  `,
  styles: [`
    .dashboard-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: var(--space-6);
    }

    /* ── Filter Bar ───────────────────────────────── */
    .filter-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin-bottom: var(--space-6);
      background: var(--surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--space-3) var(--space-4);
      box-shadow: var(--shadow-sm);
    }

    .filter-bar__presets {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      flex: 1;
    }

    .filter-chip {
      padding: var(--space-1) var(--space-3);
      border-radius: 9999px;
      border: 1px solid var(--border);
      background: var(--surface-alt);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;

      &:hover { border-color: var(--primary); color: var(--primary); transform: translateY(-1px); }
    }

    .filter-chip--active {
      border-color: transparent;
      background: var(--gradient-primary);
      color: white;
      box-shadow: 0 4px 12px rgb(109 93 246 / 0.35);
    }

    .filter-bar__custom {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .date-sep { color: var(--text-tertiary); font-size: var(--text-sm); }

    .date-input {
      padding: 4px 8px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      font-size: var(--text-xs);
      color: var(--text-primary);
      background: var(--surface);
      font-family: inherit;
      &:focus { outline: none; border-color: var(--accent); }
    }

    .filter-bar__label {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      white-space: nowrap;
    }

    /* ── KPI Grid ─────────────────────────────────── */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-5);
      margin-bottom: var(--space-6);

      @media (min-width: 640px) { grid-template-columns: repeat(2, 1fr); }
      @media (min-width: 1024px) { grid-template-columns: repeat(4, 1fr); }
    }

    .stat-card-wrapper {
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      &:hover { transform: translateY(-4px); box-shadow: var(--glass-shadow), 0 16px 40px rgb(109 93 246 / 0.22); }
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: var(--space-4);

      &__icon {
        width: 56px;
        height: 56px;
        border-radius: var(--radius-xl);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: white;
        box-shadow: 0 6px 16px rgb(109 93 246 / 0.25);
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        mat-icon { font-size: 28px; width: 28px; height: 28px; }
      }

      .stat-card-wrapper:hover &__icon { transform: scale(1.08) rotate(-4deg); }

      &__info { display: flex; flex-direction: column; flex: 1; min-width: 0; }

      &__label {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: var(--weight-semibold);
      }

      &__value {
        font-family: var(--font-display);
        font-size: var(--text-3xl);
        font-weight: var(--weight-bold);
        background: var(--gradient-text);
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: transparent;
        margin: 4px 0 0;
        line-height: 1.1;
      }

      &__sub {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
        margin: 2px 0 0;
      }
    }

    .bg-primary-light  { background: var(--gradient-primary); color: var(--text-inverse); }
    .bg-success-light  { background: var(--success); color: var(--text-inverse); }
    .bg-warning-light  { background: var(--warning); color: var(--text-inverse); }
    .bg-info-light     { background: var(--info); color: var(--text-inverse); }

    /* ── Charts Grid ──────────────────────────────── */
    .charts-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-6);
      margin-bottom: var(--space-6);

      @media (min-width: 900px) { grid-template-columns: repeat(2, 1fr); }
    }

    .charts-grid-single {
      margin-bottom: var(--space-6);
    }

    .chart-card {
      min-height: 300px;
    }

    .chart-card--wide {
      width: 100%;
    }

    .chart-wrapper {
      position: relative;
      height: 220px;
      width: 100%;
      canvas { max-height: 220px; }
    }

    .chart-wrapper--sm {
      height: 180px;
      canvas { max-height: 180px; }
    }

    .chart-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 180px;
      gap: var(--space-3);
      color: var(--text-tertiary);

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        opacity: 0.4;
      }

      p {
        font-size: var(--text-sm);
        margin: 0;
        opacity: 0.7;
      }
    }

    /* ── Materials Table ──────────────────────────── */
    .materials-summary {
      display: flex;
      gap: var(--space-6);
      margin-bottom: var(--space-4);
    }

    .materials-kpi {
      display: flex;
      flex-direction: column;

      &__value {
        font-size: var(--text-xl);
        font-weight: var(--weight-bold);
        color: var(--text-primary);
      }

      &__label {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
    }

    .mat-table-scroll { overflow-x: auto; }

    .compact-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);

      th {
        text-align: left;
        padding: var(--space-3);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid var(--border);
        background: var(--surface-alt);
      }

      td {
        padding: var(--space-3);
        color: var(--text-primary);
        border-bottom: 1px solid var(--border-subtle);
        vertical-align: middle;
      }

      tr {
        transition: background var(--transition-fast);
        &:hover { background: var(--surface-alt); }
      }

      tr:last-child td { border-bottom: none; }
    }

    .text-right { text-align: right !important; }

    .variance-pos { color: var(--success-dark, #16a34a); }
    .variance-neg { color: var(--error, #ef4444); }

    /* ── Quality Legend ───────────────────────────── */
    .quality-legend {
      display: flex;
      gap: var(--space-4);
      margin-bottom: var(--space-3);
    }

    .quality-legend__item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
    }

    .quality-legend__dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .quality-legend__item--pass .quality-legend__dot { background: #22c55e; }
    .quality-legend__item--fail .quality-legend__dot { background: #ef4444; }

    /* ── Recent Activities ────────────────────────── */
    .activities-card { margin-bottom: var(--space-6); }

    .empty-activities { padding: var(--space-8) 0; }

    .activities-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .activity-item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius-md);
      transition: background 0.2s ease;

      &:hover { background: var(--surface-alt); }
    }

    .activity-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--text-inverse);
      box-shadow: var(--shadow-sm);

      mat-icon { font-size: 20px; width: 20px; height: 20px; }

      &--production { background: var(--gradient-primary); }
      &--materials  { background: var(--gradient-accent); }
      &--quality    { background: var(--success); }
    }

    .activity-content { flex: 1; min-width: 0; }

    .activity-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-1);
    }

    .activity-type {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      color: var(--text-primary);
    }

    .activity-time {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      white-space: nowrap;
    }

    .activity-description {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Skeleton / Loading ───────────────────────── */
    .loading-state { animation: fadeIn 0.3s ease both; }

    .skeleton-box {
      background: var(--surface-alt);
      border-radius: var(--radius-md);
      position: relative;
      overflow: hidden;

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
        animation: shimmer 1.5s infinite;
      }
    }

    .skeleton-text {
      height: 14px;
      background: var(--surface-alt);
      border-radius: var(--radius-xs);
      position: relative;
      overflow: hidden;
      color: transparent !important;

      &.short { width: 60%; }

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
        animation: shimmer 1.5s infinite;
      }
    }

    .skeleton-card {
      background: var(--surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--space-5);
    }

    @keyframes shimmer {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Misc ─────────────────────────────────────── */
    .error-state { padding: var(--space-8) 0; }

    .btn-primary {
      background: var(--primary);
      color: var(--text-inverse);
      border: none;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      cursor: pointer;
      transition: opacity 0.2s;
      &:hover { opacity: 0.9; }
    }

    .btn-report {
      background: #2B2118;
      color: #FFFDF8 !important;
      border-radius: var(--radius-md);
      padding: 0 var(--space-4);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      box-shadow: var(--shadow-sm);
      transition: all 0.2s;

      mat-icon { 
        font-size: 18px; 
        width: 18px; 
        height: 18px;
        color: #FFFDF8 !important;
      }

      * { color: #FFFDF8 !important; }

      &:hover {
        background: #1C1510;
        color: #FFFFFF !important;
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
        
        mat-icon, * { color: #FFFFFF !important; }
      }
    }

    .materials-table-wrapper { overflow: hidden; }

    .config-required {
      color: var(--warning, #b45309);
      font-weight: var(--weight-medium);
      font-size: var(--text-xs);
      white-space: nowrap;
    }

    .config-required-note {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      background: var(--surface-alt);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      margin-top: var(--space-3);
    }

    .prod-output-note {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      margin: var(--space-3) 0 0;
      padding: 0 var(--space-1);
    }

    .line-status-table th, .line-status-table td { white-space: nowrap; }

    .line-products { display: flex; flex-direction: column; gap: var(--space-1); min-width: 180px; }

    .line-product {
      display: flex;
      flex-direction: column;
      font-size: var(--text-xs);

      &__qty { color: var(--text-tertiary); }
    }

    .alerts-block {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin-bottom: var(--space-6);
    }

    .alert-item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);

      &--warning { background: var(--warning-light, #fffbeb); border-color: var(--warning, #d97706); }
      &--danger  { background: var(--error-light, #fef2f2); border-color: var(--error, #ef4444); }
      &--info    { background: var(--info-light, #eff6ff); border-color: var(--info, #2563eb); }

      &__icon { flex-shrink: 0; color: inherit; }

      &__content { flex: 1; min-width: 0; }

      &__title {
        margin: 0 0 2px;
        font-size: var(--text-sm);
        font-weight: var(--weight-semibold);
        color: var(--text-primary);
      }

      &__desc {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
    }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  // ─── ViewChildren for charts ──────────────────────────────────────────────
  @ViewChild('prodTrendChart') prodTrendCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('prodProductChart') prodProductCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('qualityChart') qualityCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('qualityTrendChart') qualityTrendCanvasRef?: ElementRef<HTMLCanvasElement>;

  // ─── Services ─────────────────────────────────────────────────────────────
  private router = inject(Router);
  private dashboardSvc = inject(DashboardService);
  private reportSvc = inject(ReportService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(AuthService);

  readonly isAdmin = this.auth.isAdmin;

  // ─── State ────────────────────────────────────────────────────────────────
  loading = true;
  error = false;

  allData!: DashboardData;
  filteredData: DashboardData = { productions: [], sessions: [], materials: [], qualityTests: [], releases: [], products: [], shifts: [], lines: [], materialsMaster: [], unitCostsMaster: [] };

  stats: DashboardStats = { totalProduction: 0, totalMixes: 0, qualitySamples: 0, qualityPassed: 0, qualityFailed: 0, passRate: 0, totalCost: 0, timeEfficiency: 0 };

  productionTrend: ProductionTrendPoint[] = [];
  productionByProduct: ProductBreakdown[] = [];
  productPerformance: ProductPerformanceRow[] = [];
  lineStatus: LineStatusRow[] = [];
  materialAggregates: MaterialAggregate[] = [];
  qualityTrend: QualityTrendPoint[] = [];
  recentActivities: RecentActivity[] = [];
  alerts: OperationalAlert[] = [];

  get passCount(): number { return this.stats.qualityPassed; }
  get failCount(): number { return this.stats.qualityFailed; }
  get materialConversionRequired(): boolean {
    return this.materialAggregates.some(m => m.conversionStatus === 'CONFIGURATION_REQUIRED');
  }

  // ─── Date Filter ──────────────────────────────────────────────────────────
  presets = this.dashboardSvc.getPresets();
  datePreset: DatePreset = 'today';
  customStart = this.dashboardSvc.localDateStr(new Date());
  customEnd = this.dashboardSvc.localDateStr(new Date());
  currentRange?: DateRange;

  // ─── Charts ───────────────────────────────────────────────────────────────
  private charts: Chart[] = [];
  private chartsReady = false;

  ngOnInit(): void {
    this.load();
  }

  ngAfterViewInit(): void {
    this.chartsReady = true;
    // If data already loaded before view was ready, draw now
    if (!this.loading && !this.error) {
      this.drawCharts();
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  // ─── Load & Filter ────────────────────────────────────────────────────────

  load(): void {
    this.loading = true;
    this.error = false;

    this.dashboardSvc.loadAll().subscribe({
      next: data => {
        this.allData = data;
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
        if (this.chartsReady) {
          // Use setTimeout to ensure *ngIf elements have rendered
          setTimeout(() => this.drawCharts(), 0);
        }
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  selectPreset(preset: DatePreset): void {
    this.datePreset = preset;
    if (preset !== 'custom') {
      this.applyFilter();
    }
  }

  applyCustomRange(): void {
    this.datePreset = 'custom';
    this.applyFilter();
  }

  private applyFilter(): void {
    this.currentRange = this.dashboardSvc.buildDateRange(
      this.datePreset,
      this.datePreset === 'custom' ? this.customStart : undefined,
      this.datePreset === 'custom' ? this.customEnd : undefined
    );

    this.filteredData = this.dashboardSvc.filterData(this.allData, this.currentRange);
    this.stats = this.dashboardSvc.calcStats(this.filteredData);
    this.productionTrend = this.dashboardSvc.buildProductionTrend(this.filteredData.productions, this.currentRange);
    this.productionByProduct = this.dashboardSvc.buildProductionByProduct(this.filteredData.productions, this.allData.products);
    this.materialAggregates = this.dashboardSvc.buildMaterialAggregates(this.filteredData.materials, this.allData.materialsMaster);
    this.qualityTrend = this.dashboardSvc.buildQualityTrend(this.filteredData.qualityTests, this.currentRange);
    this.productPerformance = this.dashboardSvc.buildProductPerformance(this.filteredData.productions, this.filteredData.releases, this.allData.products);
    this.lineStatus = this.dashboardSvc.buildLineStatus({
      productions: this.filteredData.productions,
      releases: this.filteredData.releases,
      materials: this.filteredData.materials,
      qualityTests: this.filteredData.qualityTests,
      sessions: this.filteredData.sessions,
      lines: this.allData.lines,
      products: this.allData.products
    });
    this.alerts = this.dashboardSvc.buildAlerts({
      productions: this.filteredData.productions,
      materials: this.filteredData.materials,
      materialsMaster: this.allData.materialsMaster,
      products: this.allData.products,
      qualityTests: this.filteredData.qualityTests
    });
    this.recentActivities = this.dashboardSvc.buildRecentActivities(
      this.filteredData.productions,
      this.filteredData.materials,
      this.filteredData.qualityTests,
      this.allData.products
    );

    if (this.chartsReady) {
      this.cdr.detectChanges();
      setTimeout(() => this.drawCharts(), 0);
    }
  }

  // ─── Chart Drawing ────────────────────────────────────────────────────────

  private destroyCharts(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  private drawCharts(): void {
    this.destroyCharts();

    const baseFont = { family: 'Inter, sans-serif', size: 12 };
    const gridColor = 'rgba(148,163,184,0.15)';
    const textColor = '#94a3b8';

    // ── Theme aware palettes ─────────────────────────────────
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Light Mode: Luxury Industrial (Espresso, Gold, Muted Brown, Warm Gray, Muted Green)
    // Dark Mode: Indigo, Emerald, Cyan, Violet
    const primaryColor = isDark ? '#6366f1' : '#2B2118';
    const primaryAlpha30 = isDark ? 'rgba(99,102,241,0.3)' : 'rgba(43,33,24,0.3)';
    const primaryAlpha0 = isDark ? 'rgba(99,102,241,0)' : 'rgba(43,33,24,0)';

    const paletteColors = isDark
      ? ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16']
      : ['#2B2118', '#B08D57', '#756A5D', '#9A9084', '#3F7D5A', '#967443', '#1C1510', '#E8D9BD'];

    const successColor = isDark ? '#22c55e' : '#3F7D5A';
    const successAlpha25 = isDark ? 'rgba(34,197,94,0.25)' : 'rgba(63,125,90,0.25)';
    const successAlpha0 = isDark ? 'rgba(34,197,94,0)' : 'rgba(63,125,90,0)';
    const errorColor = isDark ? '#ef4444' : '#B94A48';

    // ── Production Trend ─────────────────────────────────────
    if (this.productionTrend.length > 0 && this.prodTrendCanvasRef) {
      const ctx = this.prodTrendCanvasRef.nativeElement.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, 0, 220);
      gradient.addColorStop(0, primaryAlpha30);
      gradient.addColorStop(1, primaryAlpha0);

      this.charts.push(new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.productionTrend.map(p => p.label),
          datasets: [{
            label: 'Pieces Produced',
            data: this.productionTrend.map(p => p.value),
            borderColor: primaryColor,
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: primaryColor,
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }]
        },
        options: this.lineChartOptions(baseFont, gridColor, textColor, 'Pieces')
      }));
    }

    // ── Production by Product ────────────────────────────────
    if (this.productionByProduct.length > 0 && this.prodProductCanvasRef) {
      const ctx = this.prodProductCanvasRef.nativeElement.getContext('2d')!;

      this.charts.push(new Chart(ctx, {
        type: 'bar',
        data: {
          labels: this.productionByProduct.map(p => p.productName),
          datasets: [{
            label: 'Pieces Produced',
            data: this.productionByProduct.map(p => p.produced),
            backgroundColor: this.productionByProduct.map((_, i) => paletteColors[i % paletteColors.length] + 'cc'),
            borderColor: this.productionByProduct.map((_, i) => paletteColors[i % paletteColors.length]),
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          ...this.barChartOptions(baseFont, gridColor, textColor, 'Pieces'),
          indexAxis: this.productionByProduct.length > 4 ? 'y' : 'x'
        }
      }));
    }

    // ── Quality Results Doughnut ─────────────────────────────
    if (this.stats.qualitySamples > 0 && this.qualityCanvasRef) {
      const ctx = this.qualityCanvasRef.nativeElement.getContext('2d')!;

      this.charts.push(new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Samples Passed', 'Samples Failed'],
          datasets: [{
            data: [this.passCount, this.failCount],
            backgroundColor: [successColor, errorColor],
            borderColor: ['#fff', '#fff'],
            borderWidth: 3,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const pct = ((ctx.parsed / this.stats.qualitySamples) * 100).toFixed(1);
                  return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                }
              }
            }
          }
        }
      }));
    }

    // ── Quality Strength Trend ───────────────────────────────
    if (this.qualityTrend.length > 0 && this.qualityTrendCanvasRef) {
      const ctx = this.qualityTrendCanvasRef.nativeElement.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, 0, 220);
      gradient.addColorStop(0, successAlpha25);
      gradient.addColorStop(1, successAlpha0);

      this.charts.push(new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.qualityTrend.map(p => p.label),
          datasets: [{
            label: 'Avg Compression',
            data: this.qualityTrend.map(p => p.avgCompression > 0 ? p.avgCompression : null),
            borderColor: successColor,
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: successColor,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            spanGaps: true
          }]
        },
        options: this.lineChartOptions(baseFont, gridColor, textColor, 'MPa')
      }));
    }
  }

  private lineChartOptions(font: any, gridColor: string, textColor: string, unit: string): ChartConfiguration['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          padding: 10,
          callbacks: { label: ctx => ` ${ctx.formattedValue} ${unit}` }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font, maxRotation: 45 }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font },
          beginAtZero: true
        }
      }
    };
  }

  private barChartOptions(font: any, gridColor: string, textColor: string, unit: string): ChartConfiguration['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          padding: 10,
          callbacks: { label: ctx => ` ${ctx.formattedValue} ${unit}` }
        }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font }, beginAtZero: true }
      }
    };
  }

  // ─── Report Dialog ────────────────────────────────────────────────────────

  openReportDialog(): void {
    if (!this.isAdmin()) return;
    const dialogRef = this.dialog.open(ReportDialogComponent, {
      width: '520px',
      panelClass: 'report-dialog-panel'
    });
    const instance = dialogRef.componentInstance;
    instance.data = this.allData;
    instance.reportService = this.reportSvc;
    instance.dialogRef = dialogRef;
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  navigateTo(path: string): void {
    if (this.isAdmin()) {
      this.router.navigate([path]);
    }
  }
}
