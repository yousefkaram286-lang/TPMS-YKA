// ============================================================
// TPMS — Materials bilingual (EN/AR) presentation checks
// ------------------------------------------------------------
// Phase 3 i18n: confirms the Materials route is RTL-capable,
// catalogs are in sync, rendered labels flip at runtime without
// a reload, the authoritative MixCount × per-mix totals stay
// identical across language switches, storage/master values are
// never translated, missing Arabic keys fall back to English,
// and the report-only kg → m³ conversions use /1625 (Sand) and
// /1550 (Aggregate) with CONFIGURATION_REQUIRED when a factor
// is missing.
// ============================================================
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { MaterialsComponent } from './materials.component';
import { MaterialsService } from '../../core/services/materials.service';
import { ProductService } from '../../core/services/product.service';
import { LineService } from '../../core/services/line.service';
import { ShiftService } from '../../core/services/shift.service';
import { RecipeService } from '../../core/services/recipe.service';
import { UnitCostService } from '../../core/services/unit-cost.service';
import { MaterialService } from '../../core/services/material.service';
import { TranslationService } from '../../core/services/translation.service';
import { MatDialog } from '@angular/material/dialog';
import { MaterialConversionUtil, CONFIGURATION_REQUIRED } from '../../core/utils/material-conversion.util';
import { LANGUAGE_STORAGE_KEY } from '../../core/i18n';
import { EN } from '../../core/i18n/en';
import { AR } from '../../core/i18n/ar';
import { routes } from '../../app.routes';
import { toLocalCalendarString, getDefaultOperationalDate } from '../../core/utils/date.util';
import { MaterialRecord } from '../../core/models/material-record.model';

const EMPTY: any[] = [];

class FakeMaterialsService {
  records: MaterialRecord[] = [];
  getAll = () => of(this.records);
  createIdempotent = () => of({});
  update = () => of({});
  delete = () => of({});
  calculateDailyTotal = (perMixActual: number, mixCount: number) => perMixActual * mixCount;
  calculateTheoretical = (perMixStandard: number, mixCount: number) => perMixStandard * mixCount;
  calculateVariance = (actual: number, theoretical: number) => actual - theoretical;
  calculateTotalCost = (costs: number[]) => costs.reduce((sum, c) => sum + (c || 0), 0);
  calculateMaterialCost = (actual: number, unitCost: number) => actual * unitCost;
}

class FakeProductService { getAll = () => of(EMPTY); }
class FakeLineService {
  lines: any[] = [];
  getAll = () => of(this.lines);
}
class FakeShiftService { getAll = () => of(EMPTY); }
class FakeRecipeService { getAll = () => of(EMPTY); getByProduct = () => of(EMPTY); }
class FakeUnitCostService { getAll = () => of(EMPTY); }
class FakeMaterialService { getAll = () => of(EMPTY); }

describe('MaterialsComponent i18n', () => {
  const originalLang = document.documentElement.lang;
  const originalDir = document.documentElement.dir;

  beforeEach(() => {
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, MaterialsComponent],
      providers: [
        { provide: MaterialsService, useClass: FakeMaterialsService },
        { provide: ProductService, useClass: FakeProductService },
        { provide: LineService, useClass: FakeLineService },
        { provide: ShiftService, useClass: FakeShiftService },
        { provide: RecipeService, useClass: FakeRecipeService },
        { provide: UnitCostService, useClass: FakeUnitCostService },
        { provide: MaterialService, useClass: FakeMaterialService },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
      ],
    });
  });

  afterEach(() => {
    document.documentElement.setAttribute('lang', originalLang);
    document.documentElement.setAttribute('dir', originalDir);
  });

  async function createComponent() {
    const fixture = TestBed.createComponent(MaterialsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /** Fills the entry form with deterministic business data (per-mix × mixCount). */
  function populateForm(comp: MaterialsComponent): void {
    comp.materialsForm.patchValue({
      lineId: 'l1',
      productId: 'p1',
      mixCount: 25,
      notes: 'run A',
    });
    [100, 200, 300, 40].forEach((value, i) => {
      comp.materials.at(i).patchValue({ perMixActual: value });
    });
    (comp as any).recomputeAll();
  }

  function historyRecord(id: string, date: string, lineId: string, createdAt = '2026-09-28T12:00:00Z'): MaterialRecord {
    return { id, date, lineId, createdAt, mixCount: 1, materials: [], totalCost: 0 };
  }

  async function renderHistory(records: MaterialRecord[], lineNames: string[]) {
    (TestBed.inject(MaterialsService) as unknown as FakeMaterialsService).records = records;
    (TestBed.inject(LineService) as unknown as FakeLineService).lines = lineNames.map((name, index) => ({
      id: `l${index + 1}`, name, active: true, createdAt: '2026-01-01T00:00:00Z'
    }));
    const fixture = await createComponent();
    const renderedLines = [...fixture.nativeElement.querySelectorAll('.history-table .mat-mdc-row .mat-column-line')]
      .map((cell: Element) => cell.textContent?.trim());
    return { records: fixture.componentInstance.filteredHistory, renderedLines };
  }

  it('renders same-date Materials History in numeric line order regardless of entry order', async () => {
    const date = '2026-09-28';
    const result = await renderHistory([
      historyRecord('line-4', date, 'l4'),
      historyRecord('line-1', date, 'l1'),
      historyRecord('line-3', date, 'l3'),
      historyRecord('line-2', date, 'l2')
    ], ['Line 1', 'Line 2', 'Line 3', 'Line 4']);

    expect(result.records.map(record => record.lineId)).toEqual(['l1', 'l2', 'l3', 'l4']);
    expect(result.renderedLines).toEqual(['Line 1', 'Line 2', 'Line 3', 'Line 4']);
  });

  it('places a newer operational date ahead of an earlier line', async () => {
    const result = await renderHistory([
      historyRecord('older', '2026-09-28', 'l1'),
      historyRecord('newer', '2026-09-29', 'l3')
    ], ['Line 1', 'Line 2', 'Line 3']);

    expect(result.records.map(record => record.date)).toEqual(['2026-09-29', '2026-09-28']);
    expect(result.renderedLines).toEqual(['Line 3', 'Line 1']);
  });

  it('places Line 10 after Line 4 and nonnumeric lines after numbered lines', async () => {
    const date = '2026-09-28';
    const result = await renderHistory([
      historyRecord('ten', date, 'l3'),
      historyRecord('other', date, 'l4'),
      historyRecord('four', date, 'l2'),
      historyRecord('one', date, 'l1')
    ], ['Line 1', 'Line 4', 'Line 10', 'Other']);

    expect(result.renderedLines).toEqual(['Line 1', 'Line 4', 'Line 10', 'Other']);
  });

  it('uses creation time then id to break ties on the same date and line', async () => {
    const date = '2026-09-28';
    const result = await renderHistory([
      historyRecord('b', date, 'l1', '2026-09-28T09:00:00Z'),
      historyRecord('a', date, 'l1', '2026-09-28T09:00:00Z'),
      historyRecord('newest', date, 'l1', '2026-09-28T10:00:00Z')
    ], ['Line 1']);

    expect(result.records.map(record => record.id)).toEqual(['newest', 'a', 'b']);
    expect(result.renderedLines).toEqual(['Line 1', 'Line 1', 'Line 1']);
  });

  it('marks the Materials route as RTL-capable for Arabic', () => {
    const materialsRoute = routes
      .filter(r => !!r.component)
      .flatMap(r => (r as any).children ?? [r])
      .find((r: any) => r.path === 'materials');
    expect(materialsRoute?.data).toEqual({ rtl: true });
  });

  it('keeps every materials.* catalog key in sync between English and Arabic', () => {
    const enKeys = Object.keys(EN).filter(k => k.startsWith('materials.'));
    expect(enKeys.length).toBeGreaterThan(0);
    for (const key of enKeys) {
      expect(AR[key]).toBeDefined();
      expect(AR[key]).not.toBe('');
    }
    const arKeys = Object.keys(AR).filter(k => k.startsWith('materials.'));
    for (const key of arKeys) {
      expect(EN[key]).toBeDefined();
    }
  });

  it('renders English labels from the catalog', async () => {
    const fixture = await createComponent();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Materials');
    expect(text).toContain('Material Entry (Line / Day)');
    expect(text).toContain('Materials History');
    expect(text).toContain('Mix Count * (mixes)');
    expect(text).toContain('Save Materials');
  });

  it('renders Arabic labels at runtime after switching language (no reload)', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('المواد');
    expect(text).toContain('تسجيل المواد (خط / يوم)');
    expect(text).toContain('سجل المواد');
    expect(text).toContain('عدد الخلطات');
    expect(text).not.toContain('Save Materials');
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
    expect(text).toContain('Save Materials');
    expect(text).toContain('Materials History');
    expect(text).not.toContain('حفظ المواد');
  });

  it('keeps MixCount × per-mix totals identical across language switches', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    populateForm(comp);
    fixture.detectChanges();

    const snapshot = () => comp.materials.controls.map(row => row.get('actualQuantity')?.value);
    const totalsBefore = () => comp.getTotalCost();
    const before = snapshot();
    const totalBefore = totalsBefore();
    // 100×25, 200×25, 300×25, 40×25 — authoritative daily totals.
    expect(before).toEqual([2500, 5000, 7500, 1000]);

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(snapshot()).toEqual(before);
    expect(comp.getTotalCost()).toBe(totalBefore);
    expect(comp.materials.at(0).get('perMixActual')?.value).toBe(100);
    expect(comp.materialsForm.get('mixCount')?.value).toBe(25);
  });

  it('keeps the authoritative materials formula unchanged (Daily = perMix × mixCount)', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    populateForm(comp);
    fixture.detectChanges();

    const svc = TestBed.inject(MaterialsService) as unknown as FakeMaterialsService;
    expect(svc.calculateDailyTotal(12, 25)).toBe(300);
    expect(svc.calculateTheoretical(10, 25)).toBe(250);
    expect(svc.calculateVariance(300, 250)).toBe(50);
    expect(svc.calculateMaterialCost(300, 2.5)).toBe(750);
    expect(svc.calculateTotalCost([100, 200, 300])).toBe(600);

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.materials.at(0).get('actualQuantity')?.value).toBe(100 * 25);
    expect(comp.materials.at(3).get('actualQuantity')?.value).toBe(40 * 25);
  });

  it('applies report-only kg → m³ conversions (Sand /1625, Aggregate /1550)', () => {
    const sand = MaterialConversionUtil.kgToM3(16250, 1625);
    expect(sand.cubicMeters).toBe(10);
    expect(sand.status).toBe('OK');

    const aggregate = MaterialConversionUtil.kgToM3(15500, 1550);
    expect(aggregate.cubicMeters).toBe(10);
    expect(aggregate.status).toBe('OK');

    const missing = MaterialConversionUtil.kgToM3(1000, undefined);
    expect(missing.status).toBe(CONFIGURATION_REQUIRED);
    expect(missing.cubicMeters).toBe(0);
  });

  it('never translates the stored canonical material names or units', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    populateForm(comp);
    fixture.detectChanges();

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Presentation label flips to Arabic while storage/master values stay as-is.
    expect(translation.translate('materials.table.material')).toBe('المادة');
    expect(comp.materials.controls.map(r => r.get('materialName')?.value)).toEqual(
      ['Cement', 'Sand', 'Aggregate', 'Water']);
    expect(comp.materials.controls.map(r => r.get('unit')?.value)).toEqual(['kg', 'kg', 'kg', 'L']);
  });

  it('preserves business state and form values during language switches', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    populateForm(comp);
    fixture.detectChanges();

    const before = {
      lineId: comp.materialsForm.get('lineId')?.value,
      productId: comp.materialsForm.get('productId')?.value,
      mixCount: comp.materialsForm.get('mixCount')?.value,
      notes: comp.materialsForm.get('notes')?.value,
      rowCount: comp.materials.length,
      dirty: comp.materialsForm.dirty,
    };

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.materialsForm.get('lineId')?.value).toBe(before.lineId);
    expect(comp.materialsForm.get('productId')?.value).toBe(before.productId);
    expect(comp.materialsForm.get('mixCount')?.value).toBe(before.mixCount);
    expect(comp.materialsForm.get('notes')?.value).toBe(before.notes);
    expect(comp.materials.length).toBe(before.rowCount);
    expect(comp.materialsForm.dirty).toBe(before.dirty);
  });

  it('falls back to English when an Arabic materials key is missing', () => {
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    const key = 'materials.title';
    expect(AR[key]).toBeTruthy();
    delete AR[key];
    try {
      expect(translation.translate(key)).toBe(EN[key]);
    } finally {
      AR[key] = 'المواد';
    }
  });

  it('defaults new entries to the Operational Date (yesterday) and resets to it', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    const op = toLocalCalendarString(getDefaultOperationalDate());

    // Fresh entry form starts on the Operational Date = Local Plant Calendar Date − 1.
    expect(toLocalCalendarString(comp.materialsForm.get('date')!.value as Date)).toBe(op);

    // Manual selection of any calendar day is allowed.
    comp.materialsForm.get('date')!.setValue(new Date(2026, 0, 5));
    expect(toLocalCalendarString(comp.materialsForm.get('date')!.value as Date)).toBe('2026-01-05');

    // After-save reset returns to the Operational Date.
    comp.resetForm();
    expect(toLocalCalendarString(comp.materialsForm.get('date')!.value as Date)).toBe(op);
  });
});
