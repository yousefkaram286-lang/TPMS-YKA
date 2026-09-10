// ============================================================
// TPMS — Production bilingual (EN/AR) presentation checks
// ------------------------------------------------------------
// Phase 2 i18n: confirms the Production route is RTL-capable,
// catalogs are in sync, rendered labels flip at runtime without
// a reload, missing Arabic keys fall back to English, and the
// calculated values (ProducedQty, 390-min rule, efficiency)
// plus business/form state are untouched by language switching.
// ============================================================
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ProductionComponent } from './production.component';
import { ProductionService } from '../../core/services/production.service';
import { ProductionSessionService } from '../../core/services/production-session.service';
import { ProductService } from '../../core/services/product.service';
import { LineService } from '../../core/services/line.service';
import { LineProductService } from '../../core/services/line-product.service';
import { ShiftService } from '../../core/services/shift.service';
import { TranslationService } from '../../core/services/translation.service';
import { MatDialog } from '@angular/material/dialog';
import { ProductionUtil } from '../../core/utils/production.util';
import { LANGUAGE_STORAGE_KEY } from '../../core/i18n';
import { EN } from '../../core/i18n/en';
import { AR } from '../../core/i18n/ar';
import { routes } from '../../app.routes';

const EMPTY: any[] = [];

class FakeProductionService {
  getAll = () => of(EMPTY);
  getById = () => of(null);
  getBySessionId = () => of(EMPTY);
  create = () => of({});
  createProductionRecord = (input: any) => input;
  update = () => of({});
  delete = () => of({});
}

class FakeProductionSessionService {
  getAll = () => of(EMPTY);
  getById = () => of(null);
  create = () => of({});
  update = () => of({});
  delete = () => of({});
}

class FakeProductService { getAll = () => of(EMPTY); }
class FakeLineService { getAll = () => of(EMPTY); }
class FakeShiftService { getAll = () => of(EMPTY); }
class FakeLineProductService { getAll = () => of(EMPTY); }

describe('ProductionComponent i18n', () => {
  const originalLang = document.documentElement.lang;
  const originalDir = document.documentElement.dir;

  beforeEach(() => {
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, ProductionComponent],
      providers: [
        { provide: ProductionService, useClass: FakeProductionService },
        { provide: ProductionSessionService, useClass: FakeProductionSessionService },
        { provide: ProductService, useClass: FakeProductService },
        { provide: LineService, useClass: FakeLineService },
        { provide: ShiftService, useClass: FakeShiftService },
        { provide: LineProductService, useClass: FakeLineProductService },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
      ],
    });
  });

  afterEach(() => {
    document.documentElement.setAttribute('lang', originalLang);
    document.documentElement.setAttribute('dir', originalDir);
  });

  async function createComponent() {
    const fixture = TestBed.createComponent(ProductionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /** Fills the entry form with deterministic business data (ProducedQty = 12 × 150). */
  function populateForm(comp: ProductionComponent): void {
    comp.items.at(0).patchValue({ productId: 'p1', piecesPerPress: 12, presses: 150 });
    comp.calculateRowProduced(0);
    comp.productionForm.patchValue({ lineId: 'l1', supervisor: 'Ahmed' });
    comp.productionForm.get('overtime')?.setValue(true);
    comp.onOvertimeChange();
    comp.productionForm.get('overtimeHours')?.setValue(1);
    comp.addDowntimeEvent();
    comp.downtimeEvents.at(0).patchValue({ durationMinutes: 30 });
  }

  it('marks the Production route as RTL-capable for Arabic', () => {
    const productionRoute = routes
      .filter(r => !!r.component)
      .flatMap(r => (r as any).children ?? [r])
      .find((r: any) => r.path === 'production');
    expect(productionRoute?.data).toEqual({ rtl: true });
  });

  it('keeps every production.* catalog key in sync between English and Arabic', () => {
    const enKeys = Object.keys(EN).filter(k => k.startsWith('production.'));
    expect(enKeys.length).toBeGreaterThan(0);
    for (const key of enKeys) {
      expect(AR[key]).toBeDefined();
      expect(AR[key]).not.toBe('');
    }
    // No Arabic-only production keys that English lacks.
    const arKeys = Object.keys(AR).filter(k => k.startsWith('production.'));
    for (const key of arKeys) {
      expect(EN[key]).toBeDefined();
    }
  });

  it('renders English labels from the catalog', async () => {
    const fixture = await createComponent();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Production');
    expect(text).toContain('Production Entry');
    expect(text).toContain('Production Output');
    expect(text).toContain('Production History');
    expect(text).toContain('Save Session');
    expect(text).toContain('Total Produced');
    expect(text).toContain('Efficiency');
  });

  it('renders Arabic labels at runtime after switching language (no reload)', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('الإنتاج');
    expect(text).toContain('تسجيل الإنتاج');
    expect(text).toContain('ناتج الإنتاج');
    expect(text).toContain('سجل الإنتاج');
    expect(text).toContain('حفظ الجلسة');
    expect(text).toContain('إجمالي الإنتاج');
    expect(text).toContain('الكفاءة');
    expect(text).not.toContain('Save Session');
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
    expect(text).toContain('Save Session');
    expect(text).toContain('Production Output');
    expect(text).not.toContain('حفظ الجلسة');
  });

  it('leaves every calculated value identical across language switches', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    populateForm(comp);
    fixture.detectChanges();

    const valuesBefore = () => [
      comp.getTotalProduced(),
      comp.getTotalPresses(),
      comp.getTotalDowntime(),
      comp.getOvertimeHours(),
      comp.getAvailableMinutes(),
      comp.getActualRunMinutes(),
      comp.getEfficiencyPercent(),
    ];
    const before = valuesBefore();
    expect(before[0]).toBe(1800);
    expect(before[4]).toBe(450);
    expect(before[5]).toBe(420);

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const after = valuesBefore();

    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[2]).toBe(before[2]);
    expect(after[3]).toBe(before[3]);
    expect(after[4]).toBe(before[4]);
    expect(after[5]).toBe(before[5]);
    expect(after[6]).toBeCloseTo(before[6], 6);
    // Displayed numbers stay western digits with unchanged formatting.
    expect(fixture.nativeElement.textContent).toContain('1,800');
    expect(fixture.nativeElement.textContent).toContain('450');
  });

  it('keeps the ProducedQty formula output unchanged (Presses × PiecesPerPress)', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    populateForm(comp);
    fixture.detectChanges();

    const producedBefore = comp.getTotalProduced();
    expect(ProductionUtil.calculateProduced(12, 150)).toBe(1800);
    expect(producedBefore).toBe(1800);
    expect(comp.items.at(0).get('produced')?.value).toBe(1800);

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.getTotalProduced()).toBe(1800);
    expect(comp.items.at(0).get('produced')?.value).toBe(1800);
  });

  it('keeps the 390-minute base, efficiency and time displays unchanged', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    populateForm(comp);
    fixture.detectChanges();

    const before = {
      available: comp.getAvailableMinutes(),
      actual: comp.getActualRunMinutes(),
      efficiency: comp.getEfficiencyPercent(),
      baseUnit: translation.translate('production.unit.min'),
    };
    // 390-min base rule: Available = 390 + overtime*60.
    expect(before.available).toBe(ProductionUtil.BASE_AVAILABLE_MINUTES + 60);

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.getAvailableMinutes()).toBe(before.available);
    expect(comp.getActualRunMinutes()).toBe(before.actual);
    expect(comp.getEfficiencyPercent()).toBeCloseTo(before.efficiency, 6);
    // Unit label switched (presentation only) while values stayed numeric.
    expect(translation.translate('production.unit.min')).not.toBe(before.baseUnit);
  });

  it('preserves business state and form values during language switches', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    populateForm(comp);
    comp.productionForm.get('notes')?.patchValue('Note text');
    fixture.detectChanges();

    const before = {
      lineId: comp.productionForm.get('lineId')?.value,
      supervisor: comp.productionForm.get('supervisor')?.value,
      overtime: comp.productionForm.get('overtime')?.value,
      overtimeHours: comp.productionForm.get('overtimeHours')?.value,
      notes: comp.productionForm.get('notes')?.value,
      productId: comp.items.at(0).get('productId')?.value,
      presses: comp.items.at(0).get('presses')?.value,
      piecesPerPress: comp.items.at(0).get('piecesPerPress')?.value,
      downtime: comp.downtimeEvents.at(0).get('durationMinutes')?.value,
      itemCount: comp.items.length,
      saving: comp.saving,
      editingSessionId: comp.editingSessionId,
      dirty: comp.productionForm.dirty,
    };

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.productionForm.get('lineId')?.value).toBe(before.lineId);
    expect(comp.productionForm.get('supervisor')?.value).toBe(before.supervisor);
    expect(comp.productionForm.get('overtime')?.value).toBe(before.overtime);
    expect(comp.productionForm.get('overtimeHours')?.value).toBe(before.overtimeHours);
    expect(comp.productionForm.get('notes')?.value).toBe(before.notes);
    expect(comp.items.at(0).get('productId')?.value).toBe(before.productId);
    expect(comp.items.at(0).get('presses')?.value).toBe(before.presses);
    expect(comp.items.at(0).get('piecesPerPress')?.value).toBe(before.piecesPerPress);
    expect(comp.downtimeEvents.at(0).get('durationMinutes')?.value).toBe(before.downtime);
    expect(comp.items.length).toBe(before.itemCount);
    expect(comp.saving).toBe(before.saving);
    expect(comp.editingSessionId).toBe(before.editingSessionId);
    expect(comp.productionForm.dirty).toBe(before.dirty);
  });

  it('falls back to English when an Arabic production key is missing', () => {
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    const key = 'production.title';
    expect(AR[key]).toBeTruthy();
    delete AR[key];
    try {
      expect(translation.translate(key)).toBe(EN[key]);
    } finally {
      AR[key] = 'الإنتاج';
    }
  });
});