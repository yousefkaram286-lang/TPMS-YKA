// ============================================================
// TPMS — Dashboard bilingual (EN/AR) presentation checks
// ------------------------------------------------------------
// Phase 1 i18n: confirms the Dashboard route is RTL-capable,
// catalogs are in sync, rendered labels flip at runtime without
// a reload, missing Arabic keys fall back to English, and KPI
// numbers / auth state are untouched by language switching.
// ============================================================
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { DashboardComponent } from './dashboard.component';
import { DashboardService, DashboardData, DashboardStats } from '../../core/services/dashboard.service';
import { TranslationService } from '../../core/services/translation.service';
import { ReportService } from '../../core/services/report.service';
import { AuthService } from '../../core/services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { LANGUAGE_STORAGE_KEY } from '../../core/i18n';
import { EN } from '../../core/i18n/en';
import { AR } from '../../core/i18n/ar';
import { routes } from '../../app.routes';

const EMPTY_DATA: DashboardData = {
  productions: [], sessions: [], materials: [], qualityTests: [],
  releases: [], products: [], shifts: [], lines: [], materialsMaster: [], unitCostsMaster: []
};

const FAKE_STATS: DashboardStats = {
  totalProduction: 1234, totalMixes: 56, qualitySamples: 20,
  qualityPassed: 16, qualityFailed: 4, passRate: 80, totalCost: 0, timeEfficiency: 92.5
};

class FakeDashboardService {
  getPresets() {
    return [
      { preset: 'today', label: 'Today' },
      { preset: 'last7', label: 'Last 7 Days' },
      { preset: 'last30', label: 'Last 30 Days' },
      { preset: 'thisMonth', label: 'This Month' },
      { preset: 'custom', label: 'Custom Range' }
    ];
  }
  localDateStr = (d: Date) => d.toISOString().substring(0, 10);
  buildDateRange = (preset: string, start?: string, end?: string) => ({
    preset, startDate: start ?? '', endDate: end ?? '', label: `${start ?? 'x'} → ${end ?? 'y'}`
  });
  filterData = (data: DashboardData) => data;
  calcStats = () => ({ ...FAKE_STATS });
  buildProductionTrend = () => [];
  buildProductionByProduct = () => [];
  buildMaterialAggregates = () => [];
  buildQualityTrend = () => [];
  buildProductPerformance = () => [];
  buildLineStatus = () => [];
  buildAlerts = () => [];
  buildRecentActivities = () => [];
  loadAll = () => of(EMPTY_DATA);
}

describe('DashboardComponent i18n', () => {
  const originalLang = document.documentElement.lang;
  const originalDir = document.documentElement.dir;

  beforeEach(() => {
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, DashboardComponent],
      providers: [
        { provide: DashboardService, useClass: FakeDashboardService },
        { provide: AuthService, useValue: { isAdmin: () => true } },
        { provide: ReportService, useValue: {} },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
      ],
    });
  });

  afterEach(() => {
    document.documentElement.setAttribute('lang', originalLang);
    document.documentElement.setAttribute('dir', originalDir);
  });

  it('marks the Dashboard route as RTL-capable for Arabic', () => {
    const dashboardRoute = routes
      .filter(r => !!r.component)
      .flatMap(r => (r as any).children ?? [r])
      .find((r: any) => r.path === 'dashboard');
    expect(dashboardRoute?.data).toEqual({ rtl: true });
  });

  it('keeps every dashboard.* catalog key in sync between English and Arabic', () => {
    const enKeys = Object.keys(EN).filter(k => k.startsWith('dashboard.'));
    expect(enKeys.length).toBeGreaterThan(0);
    for (const key of enKeys) {
      expect(AR[key]).toBeDefined();
      expect(AR[key]).not.toBe('');
    }
    // No Arabic-only dashboard keys that English lacks.
    const arKeys = Object.keys(AR).filter(k => k.startsWith('dashboard.'));
    for (const key of arKeys) {
      expect(EN[key]).toBeDefined();
    }
  });

  it('renders English labels from the catalog', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Dashboard');
    expect(text).toContain("Today's Production");
    expect(text).toContain('Last 7 Days');
  });

  it('renders Arabic labels at runtime after switching language (no reload)', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('لوحة التحكم');
    expect(text).toContain('إنتاج اليوم');
    expect(text).toContain('آخر 7 أيام');
  });

  it('falls back to English when an Arabic dashboard key is missing', () => {
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    const key = 'dashboard.kpi.unitPieces';
    expect(AR[key]).toBeTruthy();
    delete AR[key];
    try {
      expect(translation.translate(key)).toBe(EN[key]);
    } finally {
      AR[key] = 'قطعة';
    }
  });

  it('leaves KPI numbers intact across language switches', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const before = fixture.componentInstance.stats.totalProduction;
    expect(before).toBe(1234);

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.stats.totalProduction).toBe(1234);
    expect(fixture.nativeElement.textContent).toContain('1,234');
    expect(fixture.componentInstance.stats.qualityPassed).toBe(FAKE_STATS.qualityPassed);
  });

  it('preserves auth/business state across language switches', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.isAdmin()).toBe(true);
    expect(fixture.componentInstance.datePreset).toBe('today');

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.isAdmin()).toBe(true);
    expect(fixture.componentInstance.datePreset).toBe('today');
    expect(fixture.componentInstance.loading).toBe(false);
    expect(fixture.componentInstance.error).toBe(false);
  });
});