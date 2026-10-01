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
import { toLocalCalendarString, getDefaultOperationalDate } from '../../core/utils/date.util';
import { Production } from '../../core/models/production.model';

const EMPTY: any[] = [];

class FakeProductionService {
  records: Production[] = [];
  getAll = () => of(this.records);
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
class FakeLineService {
  lines: any[] = [];
  getAll = () => of(this.lines);
}
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

  function historyRecord(id: string, date: string, lineId: string, createdAt = '2026-09-23T12:00:00Z'): Production {
    return {
      id, date, lineId, createdAt, shiftId: '', supervisor: 'Ahmed',
      productId: 'p1', piecesPerPress: 1, presses: 1, produced: 1
    };
  }

  async function renderHistory(records: Production[], lineNames: string[]) {
    (TestBed.inject(ProductionService) as unknown as FakeProductionService).records = records;
    (TestBed.inject(LineService) as unknown as FakeLineService).lines = lineNames.map((name, index) => ({
      id: `l${index + 1}`, name, active: true, createdAt: '2026-01-01T00:00:00Z'
    }));
    const fixture = await createComponent();
    const renderedLines = [...fixture.nativeElement.querySelectorAll('.history-table .mat-mdc-row .mat-column-line')]
      .map((cell: Element) => cell.textContent?.trim());
    return { records: fixture.componentInstance.filteredHistory, renderedLines };
  }

  it('renders same-date Production History in numeric line order regardless of creation order', async () => {
    const date = '2026-09-23';
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
      historyRecord('older', '2026-09-23', 'l1'),
      historyRecord('newer', '2026-09-24', 'l3')
    ], ['Line 1', 'Line 2', 'Line 3']);

    expect(result.records.map(record => record.date)).toEqual(['2026-09-24', '2026-09-23']);
    expect(result.renderedLines).toEqual(['Line 3', 'Line 1']);
  });

  it('places Line 10 after Line 4 and nonnumeric lines after numbered lines', async () => {
    const date = '2026-09-23';
    const result = await renderHistory([
      historyRecord('ten', date, 'l3'),
      historyRecord('other', date, 'l4'),
      historyRecord('four', date, 'l2'),
      historyRecord('one', date, 'l1')
    ], ['Line 1', 'Line 4', 'Line 10', 'Other']);

    expect(result.renderedLines).toEqual(['Line 1', 'Line 4', 'Line 10', 'Other']);
  });

  it('uses creation time then id to break ties on the same date and line', async () => {
    const date = '2026-09-23';
    const result = await renderHistory([
      historyRecord('b', date, 'l1', '2026-09-23T09:00:00Z'),
      historyRecord('a', date, 'l1', '2026-09-23T09:00:00Z'),
      historyRecord('newest', date, 'l1', '2026-09-23T10:00:00Z')
    ], ['Line 1']);

    expect(result.records.map(record => record.id)).toEqual(['newest', 'a', 'b']);
    expect(result.renderedLines).toEqual(['Line 1', 'Line 1', 'Line 1']);
  });

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

  it('defaults new entries to the Operational Date (yesterday) and resets to it', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    const op = toLocalCalendarString(getDefaultOperationalDate());

    // Fresh entry form starts on the Operational Date = Local Plant Calendar Date − 1.
    expect(toLocalCalendarString(comp.productionForm.get('date')!.value as Date)).toBe(op);

    // Manual selection of any calendar day is allowed.
    comp.productionForm.get('date')!.setValue(new Date(2026, 0, 5));
    expect(toLocalCalendarString(comp.productionForm.get('date')!.value as Date)).toBe('2026-01-05');

    // After-save form reset returns to the Operational Date.
    comp.clearForm();
    expect(toLocalCalendarString(comp.productionForm.get('date')!.value as Date)).toBe(op);
  });

  it('shows decimal Trolleys on Line 1 and derives fractional Presses and Produced', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    comp.productionForm.get('lineId')!.setValue('lin-001');
    comp.onLineChange();
    comp.items.at(0).patchValue({ piecesPerPress: 22.5, trolleyCount: 30.25 });
    comp.calculateRowProduced(0);
    fixture.detectChanges();

    expect(comp.trolleyMode).toBeTrue();
    expect(comp.items.at(0).get('presses')?.value).toBe(423.5);
    expect(comp.items.at(0).get('produced')?.value).toBe(9528.75);
    expect(fixture.nativeElement.querySelector('input[formControlName="trolleyCount"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[formControlName="presses"]').readOnly).toBeTrue();
  });

  it('uses the same Trolley input on Line 2 and rejects zero or non-numeric values', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    comp.productionForm.get('lineId')!.setValue('lin-002');
    comp.onLineChange();
    const trolleys = comp.items.at(0).get('trolleyCount')!;
    trolleys.setValue(0);
    expect(trolleys.hasError('invalidTrolleys')).toBeTrue();
    trolleys.setValue('bad');
    expect(trolleys.hasError('invalidTrolleys')).toBeTrue();
    trolleys.setValue(0.5);
    comp.items.at(0).get('piecesPerPress')!.setValue(10.5);
    comp.calculateRowProduced(0);
    fixture.detectChanges();

    expect(trolleys.valid).toBeTrue();
    expect(comp.items.at(0).get('presses')?.value).toBe(7);
    expect(comp.items.at(0).get('produced')?.value).toBe(73.5);
    expect(fixture.nativeElement.querySelector('input[formControlName="trolleyCount"]')).not.toBeNull();
  });

  it('does not carry a previous line’s trolley count or derived Presses into another line', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    comp.productionForm.get('lineId')!.setValue('lin-001');
    comp.onLineChange();
    comp.items.at(0).get('trolleyCount')!.setValue(30);
    comp.calculateRowProduced(0);
    expect(comp.items.at(0).get('presses')?.value).toBe(420);

    comp.productionForm.get('lineId')!.setValue('lin-002');
    comp.onLineChange();
    expect(comp.items.at(0).get('trolleyCount')?.value).toBeNull();
    expect(comp.items.at(0).get('presses')?.value).toBe(0);

    comp.items.at(0).get('trolleyCount')!.setValue(0.5);
    comp.calculateRowProduced(0);
    comp.productionForm.get('lineId')!.setValue('lin-003');
    comp.onLineChange();
    expect(comp.trolleyMode).toBeFalse();
    expect(comp.items.at(0).get('trolleyCount')?.value).toBeNull();
    expect(comp.items.at(0).get('presses')?.value).toBe(0);
  });

  it('keeps other lines on manual Presses and old Line 1 records readable without invented Trolleys', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    comp.productionForm.get('lineId')!.setValue('lin-003');
    comp.onLineChange();
    comp.items.at(0).patchValue({ presses: 3, piecesPerPress: 10.5 });
    comp.calculateRowProduced(0);
    fixture.detectChanges();
    expect(comp.trolleyMode).toBeFalse();
    expect(comp.items.at(0).get('produced')?.value).toBe(31.5);
    expect(fixture.nativeElement.querySelector('input[formControlName="trolleyCount"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[formControlName="presses"]').readOnly).toBeFalse();

    const old = { ...historyRecord('old', '2026-09-01', 'lin-001'), sessionId: 'old-session',
      presses: 100, piecesPerPress: 22.5, produced: 2250 };
    comp.history = [old];
    comp.sessionsMap.set('old-session', {
      id: 'old-session', date: old.date, shiftId: '', lineId: 'lin-001', supervisor: 'QA',
      overtime: false, overtimeHours: 0, dailyLineTime: [], notes: '', createdAt: old.createdAt
    });
    comp.editSession(old);
    expect(comp.trolleyMode).toBeFalse();
    expect(comp.items.at(0).get('presses')?.value).toBe(100);
    expect(comp.items.at(0).get('trolleyCount')?.value).toBeNull();
  });
});
