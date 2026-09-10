// ============================================================
// TPMS — Quality bilingual (EN/AR) presentation checks
// ------------------------------------------------------------
// Phase 3 i18n: confirms the Quality route is RTL-capable,
// catalogs are in sync, rendered labels flip at runtime without
// a reload, exactly three samples are measured, Compression =
// Load ÷ Area is unchanged, PASS/FAIL thresholds (Solid = 180,
// Hollow = 70) stay authoritative, Standard Weight is display-only
// (never affects the result), CONFIGURATION_REQUIRED never
// fabricates a result, no overall verdict is invented, business
///form state survives language switches, and missing Arabic keys
// fall back to English.
// ============================================================
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { QualityComponent } from './quality.component';
import { QualityService } from '../../core/services/quality.service';
import { ProductService } from '../../core/services/product.service';
import { LineService } from '../../core/services/line.service';
import { TranslationService } from '../../core/services/translation.service';
import { MatDialog } from '@angular/material/dialog';
import { QualityCalculationUtil, CONFIGURATION_REQUIRED } from '../../core/utils/quality-calculation.util';
import { LANGUAGE_STORAGE_KEY } from '../../core/i18n';
import { EN } from '../../core/i18n/en';
import { AR } from '../../core/i18n/ar';
import { routes } from '../../app.routes';

class FakeQualityService {
  getAll = () => of([]);
  createIdempotent = () => of({});
  update = () => of({});
  delete = () => of({});
}

const PRODUCTS: any[] = [
  {
    id: 'p-solid', name: 'Solid Block', type: 'SOLID',
    productArea: 100, standardStrength: 180, standardHeight: 20, standardWeight: 200,
    active: true, createdAt: '2026-01-01',
  },
  {
    id: 'p-hollow', name: 'Hollow Block', type: 'BLOCK',
    productArea: 100, standardStrength: 70, standardHeight: 20, standardWeight: 150,
    active: true, createdAt: '2026-01-01',
  },
  {
    id: 'p-unconfig', name: 'Unconfigured Block', standardStrength: 0,
    active: true, createdAt: '2026-01-01',
  },
];

const LINES: any[] = [{ id: 'l1', name: 'Line A', active: true }];

class FakeProductService { getAll = () => of(PRODUCTS); }
class FakeLineService { getAll = () => of(LINES); }

describe('QualityComponent i18n', () => {
  const originalLang = document.documentElement.lang;
  const originalDir = document.documentElement.dir;

  beforeEach(() => {
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, QualityComponent],
      providers: [
        { provide: QualityService, useClass: FakeQualityService },
        { provide: ProductService, useClass: FakeProductService },
        { provide: LineService, useClass: FakeLineService },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
      ],
    });
  });

  afterEach(() => {
    document.documentElement.setAttribute('lang', originalLang);
    document.documentElement.setAttribute('dir', originalDir);
  });

  async function createComponent() {
    const fixture = TestBed.createComponent(QualityComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function selectProduct(comp: QualityComponent, productId: string, load: number): void {
    comp.qualityForm.patchValue({ date: new Date('2026-01-10'), productId, lineId: 'l1', notes: 'run' });
    comp.onProductChange();
    comp.sampleGroups().forEach((g, i) => g.patchValue({ actualHeight: 20, actualWeight: 200 + i, load }));
    (comp as any).recomputeSamples();
  }

  it('marks the Quality route as RTL-capable for Arabic', () => {
    const qualityRoute = routes
      .filter(r => !!r.component)
      .flatMap(r => (r as any).children ?? [r])
      .find((r: any) => r.path === 'quality');
    expect(qualityRoute?.data).toEqual({ rtl: true });
  });

  it('keeps every quality.* catalog key in sync between English and Arabic', () => {
    const enKeys = Object.keys(EN).filter(k => k.startsWith('quality.'));
    expect(enKeys.length).toBeGreaterThan(0);
    for (const key of enKeys) {
      expect(AR[key]).toBeDefined();
      expect(AR[key]).not.toBe('');
    }
    const arKeys = Object.keys(AR).filter(k => k.startsWith('quality.'));
    for (const key of arKeys) {
      expect(EN[key]).toBeDefined();
    }
  });

  it('renders English labels from the catalog', async () => {
    const fixture = await createComponent();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Quality');
    expect(text).toContain('Quality Test Event');
    expect(text).toContain('Quality History');
    expect(text).toContain('Save Test');
    expect(text).toContain('Sample 1');
  });

  it('renders Arabic labels at runtime after switching language (no reload)', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('الجودة');
    expect(text).toContain('حدث اختبار الجودة');
    expect(text).toContain('سجل الجودة');
    expect(text).toContain('العينة 1');
    expect(text).not.toContain('Save Test');
  });

  it('restores English labels when switching back from Arabic', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    translation.setLanguage('en');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Save Test');
    expect(text).toContain('Quality History');
    expect(text).not.toContain('حفظ الاختبار');
  });

  it('keeps exactly three samples per quality test', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    expect(comp.sampleGroups().length).toBe(3);
    expect(comp.computedSamples.length).toBe(3);
  });

  it('keeps Compression = Load ÷ Area unchanged', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    selectProduct(comp, 'p-solid', 18000);
    fixture.detectChanges();

    expect(comp.previewProductArea).toBe(100);
    expect(comp.previewCompressionStandard).toBe(180);
    expect(comp.computedSamples[0].compression).toBe(180);
    expect(comp.computedSamples[0].compressionResult).toBe('PASS');

    selectProduct(comp, 'p-solid', 17999);
    fixture.detectChanges();
    expect(comp.computedSamples[0].compression).toBeCloseTo(179.99, 5);
    expect(comp.computedSamples[0].compressionResult).toBe('FAIL');
  });

  it('keeps the Solid (180) and Hollow (70) thresholds authoritative', () => {
    // Solid = 180 kg/cm²: at/above passes, below fails.
    expect(QualityCalculationUtil.evaluate(180, 180)).toBe('PASS');
    expect(QualityCalculationUtil.evaluate(179.9, 180)).toBe('FAIL');
    // Hollow = 70 kg/cm²: at/above passes, below fails.
    expect(QualityCalculationUtil.evaluate(70, 70)).toBe('PASS');
    expect(QualityCalculationUtil.evaluate(69.9, 70)).toBe('FAIL');
  });

  it('keeps Standard Weight display-only — it never drives the result', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    selectProduct(comp, 'p-solid', 18000);
    fixture.detectChanges();

    // Standard Weight shows a difference but the compression result is by Load only.
    expect(comp.previewStandardWeight).toBe(200);
    expect(comp.computedSamples[0].compressionResult).toBe('PASS');

    // A weight far from standard still cannot change a PASS/FAIL verdict.
    comp.sampleGroups()[0].patchValue({ actualWeight: 220, load: 17999 });
    (comp as any).recomputeSamples();
    fixture.detectChanges();
    expect(comp.computedSamples[0].compressionResult).toBe('FAIL');
    expect(QualityCalculationUtil.weightDifference(220, 200)).toBe(20);
  });

  it('keeps CONFIGURATION_REQUIRED when Area/Standard is missing (no fabricated result)', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    selectProduct(comp, 'p-unconfig', 18000);
    fixture.detectChanges();

    expect(comp.previewProductArea).toBeUndefined();
    expect(comp.previewCompressionStandard).toBe(0);
    expect(comp.configComplete).toBe(false);
    expect(comp.configMessages.length).toBeGreaterThan(0);
    expect(Number.isNaN(comp.computedSamples[0].compression)).toBe(true);
    expect(comp.computedSamples[0].compressionResult).toBe(CONFIGURATION_REQUIRED);
    expect(comp.avgCompression).toBeUndefined();
  });

  it('never invents an overall verdict — PASS/FAIL are per-sample only', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    selectProduct(comp, 'p-hollow', 7000);
    fixture.detectChanges();

    // All three PASS — but Compression averages numerically; no overall result field exists.
    expect(comp.computedSamples.every(s => s.compressionResult === 'PASS')).toBe(true);
    expect(comp.avgCompression).toBe(70);
    expect((comp as any).overallCompressionResult).toBeUndefined();
  });

  it('preserves business state and form values during language switches', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    selectProduct(comp, 'p-hollow', 7000);
    fixture.detectChanges();

    const before = {
      productId: comp.qualityForm.get('productId')?.value,
      lineId: comp.qualityForm.get('lineId')?.value,
      notes: comp.qualityForm.get('notes')?.value,
      loads: comp.sampleGroups().map(g => g.get('load')?.value),
      weights: comp.sampleGroups().map(g => g.get('actualWeight')?.value),
      results: comp.computedSamples.map(s => s.compressionResult),
    };

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.qualityForm.get('productId')?.value).toBe(before.productId);
    expect(comp.qualityForm.get('lineId')?.value).toBe(before.lineId);
    expect(comp.qualityForm.get('notes')?.value).toBe(before.notes);
    expect(comp.sampleGroups().map(g => g.get('load')?.value)).toEqual(before.loads);
    expect(comp.sampleGroups().map(g => g.get('actualWeight')?.value)).toEqual(before.weights);
    expect(comp.computedSamples.map(s => s.compressionResult)).toEqual(before.results);
  });

  it('falls back to English when an Arabic quality key is missing', () => {
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    const key = 'quality.title';
    expect(AR[key]).toBeTruthy();
    delete AR[key];
    try {
      expect(translation.translate(key)).toBe(EN[key]);
    } finally {
      AR[key] = 'الجودة';
    }
  });
});