// ============================================================
// TPMS — Output Release bilingual (EN/AR) presentation checks
// ------------------------------------------------------------
// Phase 4 i18n: confirms the Output Release route is RTL-capable,
// catalogs are in sync, rendered labels flip at runtime without
// a reload, released-quantity values and dates stay identical
// across language switches, existing validation rules are
// unchanged, DB-sourced master data is never translated,
// Output Release stays independent from Production (a manual
// save payload contains release fields only — no production
// linkage), and missing Arabic keys fall back to English.
// ============================================================
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { OutputReleaseComponent } from './output-release.component';
import { OutputReleaseService } from '../../core/services/output-release.service';
import { ProductService } from '../../core/services/product.service';
import { LineService } from '../../core/services/line.service';
import { TranslationService } from '../../core/services/translation.service';
import { MatDialog } from '@angular/material/dialog';
import { OutputRelease } from '../../core/models/output-release.model';
import { LANGUAGE_STORAGE_KEY } from '../../core/i18n';
import { EN } from '../../core/i18n/en';
import { AR } from '../../core/i18n/ar';
import { routes } from '../../app.routes';
import { toLocalCalendarString, parseLocalCalendarDate, getDefaultOperationalDate } from '../../core/utils/date.util';

const MANUAL_RECORD: OutputRelease = {
  id: 'output_sub_t1',
  releaseDate: '2024-01-15',
  lineId: 'l1',
  productId: 'p1',
  releasedQuantity: 1500,
  dataSource: 'MANUAL_ENTRY',
  notes: 'shift A release',
  createdAt: '2024-01-15T10:00:00.000Z',
};

const LEGACY_RECORD: OutputRelease = {
  id: 'migrated_session_sess-legacy',
  releaseDate: '2024-02-01',
  legacySessionId: 'sess-legacy',
  releasedQuantity: 500,
  dataSource: 'LEGACY_AMBIGUOUS_SESSION',
  createdAt: '2024-02-01T08:00:00.000Z',
};

class FakeOutputReleaseService {
  getAll = jasmine.createSpy('getAll').and.returnValue(of([LEGACY_RECORD, MANUAL_RECORD]));
  createIdempotent = jasmine.createSpy('createIdempotent').and.returnValue(of(MANUAL_RECORD));
  update = jasmine.createSpy('update').and.returnValue(of(MANUAL_RECORD));
  delete = jasmine.createSpy('delete').and.returnValue(of(undefined));
}

class FakeProductService {
  getAll = () => of([
    { id: 'p1', name: 'Solid Block', standardStrength: 180, active: true, createdAt: new Date().toISOString() },
    { id: 'p2', name: 'Hollow Block', standardStrength: 70, active: true, createdAt: new Date().toISOString() },
    { id: 'p3', name: 'Inactive Block', standardStrength: 90, active: false, createdAt: new Date().toISOString() },
  ]);
}

class FakeLineService {
  getAll = () => of([
    { id: 'l1', name: 'Line A', active: true, createdAt: new Date().toISOString() },
    { id: 'l2', name: 'Line B', active: true, createdAt: new Date().toISOString() },
  ]);
}

describe('OutputReleaseComponent i18n', () => {
  const originalLang = document.documentElement.lang;
  const originalDir = document.documentElement.dir;

  beforeEach(() => {
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, OutputReleaseComponent],
      providers: [
        { provide: OutputReleaseService, useClass: FakeOutputReleaseService },
        { provide: ProductService, useClass: FakeProductService },
        { provide: LineService, useClass: FakeLineService },
        {
          provide: MatDialog,
          useValue: {
            open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(true) }),
          },
        },
      ],
    });
  });

  afterEach(() => {
    document.documentElement.setAttribute('lang', originalLang);
    document.documentElement.setAttribute('dir', originalDir);
  });

  async function createComponent() {
    const fixture = TestBed.createComponent(OutputReleaseComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('marks the Output Release route as RTL-capable for Arabic', () => {
    const route = routes
      .filter(r => !!r.component)
      .flatMap(r => (r as any).children ?? [r])
      .find((r: any) => r.path === 'output-release');
    expect(route?.data).toEqual({ rtl: true });
  });

  it('keeps every outputRelease.* catalog key in sync between English and Arabic', () => {
    const enKeys = Object.keys(EN).filter(k => k.startsWith('outputRelease.'));
    expect(enKeys.length).toBeGreaterThan(0);
    for (const key of enKeys) {
      expect(AR[key]).toBeDefined();
      expect(AR[key]).not.toBe('');
    }
    const arKeys = Object.keys(AR).filter(k => k.startsWith('outputRelease.'));
    for (const key of arKeys) {
      expect(EN[key]).toBeDefined();
    }
  });

  it('renders English labels from the catalog', async () => {
    const fixture = await createComponent();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Output Release');
    expect(text).toContain('Record Output Release');
    expect(text).toContain('Release History');
    expect(text).toContain('Released Quantity *');
    expect(text).toContain('Record Release');
    expect(text).toContain('Product *');
    expect(text).toContain('Line *');
  });

  it('renders Arabic labels at runtime after switching language (no reload)', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('صرف الإنتاج');
    expect(text).toContain('تسجيل صرف الإنتاج');
    expect(text).toContain('سجل الصرف');
    expect(text).toContain('الكمية المصروفة');
    expect(text).toContain('تسجيل الصرف');
    expect(text).not.toContain('Record Release');
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
    expect(text).toContain('Record Release');
    expect(text).toContain('Release History');
    expect(text).toContain('Product *');
    expect(text).not.toContain('تسجيل صرف الإنتاج');
  });

  it('keeps released quantities and dates identical across language switches', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;

    const beforeHistory = comp.history.map(r => ({ qty: r.releasedQuantity, date: r.releaseDate }));
    comp.releaseForm.patchValue({ releasedQuantity: 1750 });
    fixture.detectChanges();

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.releaseForm.get('releasedQuantity')?.value).toBe(1750);
    expect(comp.history.map(r => ({ qty: r.releasedQuantity, date: r.releaseDate }))).toEqual(beforeHistory);
    expect(comp.filteredHistory.map(r => r.releasedQuantity)).toEqual([500, 1500]);
  });

  it('preserves business state and form values during language switches', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;

    comp.releaseForm.patchValue({
      releaseDate: new Date('2024-03-10T00:00:00'),
      releasedQuantity: 2000,
      productId: 'p2',
      lineId: 'l2',
      notes: 'nightly',
    });
    const before = {
      releaseDate: comp.releaseForm.get('releaseDate')?.value,
      releasedQuantity: comp.releaseForm.get('releasedQuantity')?.value,
      productId: comp.releaseForm.get('productId')?.value,
      lineId: comp.releaseForm.get('lineId')?.value,
      notes: comp.releaseForm.get('notes')?.value,
      editingId: comp.editingId,
      searchTerm: comp.searchTerm,
    };

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.releaseForm.get('releaseDate')?.value).toEqual(before.releaseDate);
    expect(comp.releaseForm.get('releasedQuantity')?.value).toBe(before.releasedQuantity);
    expect(comp.releaseForm.get('productId')?.value).toBe(before.productId);
    expect(comp.releaseForm.get('lineId')?.value).toBe(before.lineId);
    expect(comp.releaseForm.get('notes')?.value).toBe(before.notes);
    expect(comp.editingId).toBe(before.editingId);
    expect(comp.searchTerm).toBe(before.searchTerm);
  });

  it('keeps the existing validation rules unchanged (required + min 1)', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    const svc = TestBed.inject(OutputReleaseService) as unknown as FakeOutputReleaseService;

    // releaseDate defaults to the Operational Date (yesterday) — valid out of the box.
    expect(toLocalCalendarString(comp.releaseForm.get('releaseDate')!.value as Date))
      .toBe(toLocalCalendarString(getDefaultOperationalDate()));
    expect(comp.releaseForm.get('releaseDate')?.valid).toBeTrue();
    comp.releaseForm.get('releaseDate')?.setValue(null);
    expect(comp.releaseForm.get('releaseDate')?.hasError('required')).toBeTrue();
    expect(comp.releaseForm.get('releasedQuantity')?.hasError('required')).toBeTrue();
    expect(comp.releaseForm.get('productId')?.hasError('required')).toBeTrue();
    expect(comp.releaseForm.get('lineId')?.hasError('required')).toBeTrue();

    comp.releaseForm.patchValue({ releaseDate: new Date(), releasedQuantity: 0, productId: 'p1', lineId: 'l1' });
    expect(comp.releaseForm.get('releasedQuantity')?.hasError('min')).toBeTrue();

    comp.releaseForm.patchValue({ releaseDate: new Date(), releasedQuantity: 1750, productId: 'p1', lineId: 'l1', notes: 'shift A release' });
    comp.save();
    expect((svc.createIdempotent as jasmine.Spy)).toHaveBeenCalledTimes(1);
    const input = (svc.createIdempotent as jasmine.Spy).calls.mostRecent().args[0];
    expect(input.releaseDate).toBeTruthy();
    expect(input.releasedQuantity).toBe(1750);
    expect(input.productId).toBe('p1');
    expect(input.lineId).toBe('l1');
    expect(input.notes).toBe('shift A release');
    expect(input.transactionId).toBeTruthy();
  });

  it('does not submit an invalid form', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    const svc = TestBed.inject(OutputReleaseService) as unknown as FakeOutputReleaseService;

    comp.releaseForm.patchValue({
      releaseDate: new Date(),
      releasedQuantity: 0,
      productId: '',
      lineId: '',
    });
    comp.save();
    expect((svc.createIdempotent as jasmine.Spy)).not.toHaveBeenCalled();
  });

  it('never translates DB-sourced product, line, date, or provenance values', async () => {
    const translation = TestBed.inject(TranslationService);
    const fixture = await createComponent();
    const comp = fixture.componentInstance;

    // history is sorted desc by releaseDate: legacy (2024-02-01) first, manual (2024-01-15) second.
    const manual = comp.history.find(r => r.dataSource === 'MANUAL_ENTRY');
    const legacy = comp.history.find(r => r.dataSource === 'LEGACY_AMBIGUOUS_SESSION');

    translation.setLanguage('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(translation.translate('outputRelease.table.source')).toBe('المصدر');

    expect(manual!.productId).toBe('p1');
    expect(manual!.lineId).toBe('l1');
    expect(manual!.releasedQuantity).toBe(1500);
    expect(manual!.releaseDate).toBe('2024-01-15');
    expect(manual!.notes).toBe('shift A release');
    expect(manual!.dataSource).toBe('MANUAL_ENTRY');
    expect(comp.getProductName(manual!)).toBe('Solid Block');
    expect(comp.getLineName(manual!)).toBe('Line A');

    expect(legacy!.dataSource).toBe('LEGACY_AMBIGUOUS_SESSION');
    expect(legacy!.productId).toBeUndefined();
    expect(legacy!.legacySessionId).toBe('sess-legacy');
    expect(comp.getProductName(legacy!)).toBe('');
  });

  it('filters inactive products/lines out of master-data selectors', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    expect(comp.activeProducts.map(p => p.name)).toEqual(['Solid Block', 'Hollow Block']);
    expect(comp.activeLines.map(l => l.name)).toEqual(['Line A', 'Line B']);
  });

  it('keeps Output Release independent from Production (manual save is release-only)', async () => {
    // ProductionService is deliberately NOT provided — if the component injected it,
    // TestBed bootstrap would fail here, proving no Production dependency.
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    const svc = TestBed.inject(OutputReleaseService) as unknown as FakeOutputReleaseService;

    comp.releaseForm.patchValue({
      releaseDate: new Date(),
      releasedQuantity: 2200,
      productId: 'p2',
      lineId: 'l2',
      notes: undefined,
    });
    comp.save();

    const input = (svc.createIdempotent as jasmine.Spy).calls.mostRecent().args[0];
    expect(Object.keys(input).sort()).toEqual([
      'lineId', 'notes', 'productId', 'releaseDate', 'releasedQuantity', 'transactionId',
    ]);

    // Editing a legacy record stays blocked: no production link, no edit affordance.
    const legacy = comp.history.find(r => r.dataSource === 'LEGACY_AMBIGUOUS_SESSION')!;
    comp.editRecord(legacy);
    expect(comp.editingId).toBeNull();
  });

  it('keeps existing search/source filtering behavior unchanged', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;

    comp.searchTerm = 'solid';
    comp.applyFilter();
    expect(comp.filteredHistory.length).toBe(1);
    expect(comp.filteredHistory[0].productId).toBe('p1');

    comp.searchTerm = '';
    comp.sourceFilter = 'LEGACY_AMBIGUOUS_SESSION';
    comp.applyFilter();
    expect(comp.filteredHistory.length).toBe(1);
    expect(comp.filteredHistory[0].dataSource).toBe('LEGACY_AMBIGUOUS_SESSION');

    comp.clearFilters();
    expect(comp.filteredHistory.length).toBe(2);
    expect(comp.columns).toEqual(['releaseDate', 'product', 'line', 'releasedQuantity', 'dataSource', 'actions']);
  });

  it('falls back to English when an Arabic outputRelease key is missing', () => {
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    const key = 'outputRelease.title';
    expect(AR[key]).toBeTruthy();
    delete AR[key];
    try {
      expect(translation.translate(key)).toBe(EN[key]);
    } finally {
      AR[key] = 'صرف الإنتاج';
    }
  });

  it('defaults new releases to the Operational Date (yesterday) and resets to it', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    const op = toLocalCalendarString(getDefaultOperationalDate());

    // Fresh release form starts on the Operational Date = Local Plant Calendar Date − 1.
    expect(toLocalCalendarString(comp.releaseForm.get('releaseDate')!.value as Date)).toBe(op);
    expect(comp.releaseForm.get('releaseDate')?.valid).toBeTrue();

    // Manual selection of any calendar day is allowed.
    comp.releaseForm.get('releaseDate')!.setValue(new Date(2024, 5, 1));
    expect(toLocalCalendarString(comp.releaseForm.get('releaseDate')!.value as Date)).toBe('2024-06-01');

    // Clear form returns to the Operational Date.
    comp.clearForm();
    expect(toLocalCalendarString(comp.releaseForm.get('releaseDate')!.value as Date)).toBe(op);
  });

  it('editing a MANUAL_ENTRY preserves the stored release date (exact local calendar day)', async () => {
    const fixture = await createComponent();
    const comp = fixture.componentInstance;

    comp.editRecord(MANUAL_RECORD);
    const value = comp.releaseForm.get('releaseDate')!.value as Date;
    expect(toLocalCalendarString(value)).toBe('2024-01-15');
    // Round-trips through the local-safe parser.
    expect(toLocalCalendarString(parseLocalCalendarDate('2024-01-15')!)).toBe('2024-01-15');
  });
});