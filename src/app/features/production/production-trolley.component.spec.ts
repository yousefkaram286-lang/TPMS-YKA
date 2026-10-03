// ============================================================
// TPMS — Trolley Input for Production Line 1 & Line 2
// ------------------------------------------------------------
// Factory-confirmed business rule under test:
//
//   Line 1 / Line 2 do NOT receive direct Presses input. The operator
//   enters TROLLEYS in increments of 0.5; Presses = Trolleys x 14, so
//   Presses is ALWAYS a whole number (0.5 trolley = 7 presses).
//   Produced may still be fractional because PPP can be fractional.
//
//        Trolleys   Presses   Result
//        0          0         VALID   (line stopped, savable)
//        0.5        7         VALID
//        1          14        VALID
//        1.5        21        VALID
//        30         420       VALID
//        30.5       427       VALID
//        0.25       3.5       INVALID
//        0.75       10.5      INVALID
//        1.25       17.5      INVALID
//        30.25      423.5     INVALID
//
//   An invalid value is rejected, never rounded or snapped to the nearest
//   increment. Produced = Presses x PiecesPerPress.
//
// Every OTHER line keeps the existing manual Presses input.
// ============================================================
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ProductionComponent } from './production.component';
import { ProductionService, ProductionRecordInput } from '../../core/services/production.service';
import { ProductionSessionService } from '../../core/services/production-session.service';
import { ProductService } from '../../core/services/product.service';
import { LineService } from '../../core/services/line.service';
import { LineProductService } from '../../core/services/line-product.service';
import { ShiftService } from '../../core/services/shift.service';
import { MatDialog } from '@angular/material/dialog';
import { TrolleyUtil, PRESSES_PER_TROLLEY, TROLLEY_STEP } from '../../core/utils/trolley.util';
import { ProductionUtil } from '../../core/utils/production.util';
import { Production } from '../../core/models/production.model';
import { ProductionSession } from '../../core/models/production-session.model';

const LINE_1 = 'lin-001';
const LINE_2 = 'lin-002';
const LINE_3 = 'lin-003';
const LINE_4 = 'lin-004';

const EMPTY: any[] = [];

class FakeProductionService {
  records: Production[] = [];
  sessions: ProductionSession[] = [];
  /** Every record handed to create(), in call order. */
  written: Production[] = [];
  getAll = () => of(this.records);
  getById = () => of(null);
  getBySessionId = (id: string) => of(this.records.filter(r => r.sessionId === id));
  create = (r: Production) => { this.written.push(r); return of(r); };
  createProductionRecord = (input: ProductionRecordInput) => this.realCreate(input);
  /** Updates are recorded too — an edit re-saves through update(), not create(). */
  update = (r: Production) => { this.written.push(r); return of(r); };
  delete = () => of({});

  private realCreate(input: ProductionRecordInput): Production {
    const usesTrolleys = input.trolleyCount !== null && input.trolleyCount !== undefined;
    if (usesTrolleys && !TrolleyUtil.isValidTrolleyCount(input.trolleyCount)) {
      throw new Error('Trolley count must be a number greater than or equal to zero.');
    }
    const presses = usesTrolleys ? TrolleyUtil.calculatePresses(input.trolleyCount) : input.presses;
    if (!ProductionUtil.isValidPressCount(presses)) {
      throw new Error('Negative press count is not allowed.');
    }
    if (!ProductionUtil.isConfigured(input.piecesPerPress)) {
      throw new Error('PiecesPerPress is not configured for this product.');
    }
    const piecesPerPress = input.piecesPerPress as number;
    const record: Production = {
      id: input.id, sessionId: input.sessionId, date: input.date,
      shiftId: input.shiftId ?? '', lineId: input.lineId, productId: input.productId,
      supervisor: input.supervisor ?? '', piecesPerPress, presses,
      produced: ProductionUtil.calculateProduced(piecesPerPress, presses),
      createdAt: input.createdAt
    };
    if (usesTrolleys) {
      record.trolleyCount = input.trolleyCount as number;
      record.pressesPerTrolley = PRESSES_PER_TROLLEY;
    }
    return record;
  }
}

class FakeProductionSessionService {
  sessions: ProductionSession[] = [];
  getAll = () => of(this.sessions);
  getById = () => of(null);
  create = () => of({});
  update = (s: ProductionSession) => { this.sessions = [...this.sessions.filter(x => x.id !== s.id), s]; return of(s); };
  delete = () => of({});
}

class FakeProductService { getAll = () => of(EMPTY); }
class FakeLineService { getAll = () => of(EMPTY); }
class FakeShiftService { getAll = () => of(EMPTY); }
class FakeLineProductService { getAll = () => of(EMPTY); }

describe('Trolley Input — Production Line 1 & Line 2', () => {
  beforeEach(() => {
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

  async function createComponent() {
    const fixture = TestBed.createComponent(ProductionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Seeds master data with the real factory Line ids so the component's own
   * line resolution is exercised, then selects `lineId`.
   */
  async function createComponentOnLine(lineId: string, piecesPerPress = 10) {
    (TestBed.inject(LineService) as unknown as FakeLineService).getAll = () => of(
      [LINE_1, LINE_2, LINE_3, LINE_4].map((id, i) => ({
        id, name: `Line ${i + 1}`, active: true, createdAt: '2026-01-01T00:00:00Z'
      }))
    );
    (TestBed.inject(ProductService) as unknown as FakeProductService).getAll = () => of([
      { id: 'p1', name: 'Block 8', active: true, piecesPerPress, productArea: 0.08, createdAt: '2026-01-01T00:00:00Z' }
    ] as any);

    const fixture = await createComponent();
    const comp = fixture.componentInstance;
    comp.productionForm.get('lineId')!.setValue(lineId);
    comp.onLineChange();
    comp.items.at(0).get('productId')!.setValue('p1');
    comp.onProductChange(0);
    fixture.detectChanges();
    return { fixture, comp };
  }

  // ═══════════════════════════════════════════════════════════
  // 1. CALCULATION — the four factory examples
  // ═══════════════════════════════════════════════════════════
  describe('calculation: Presses = Trolleys x 14', () => {
    it('uses the fixed factory factor of 14 presses per trolley', () => {
      expect(PRESSES_PER_TROLLEY).toBe(14);
    });

    it('steps the entry field by 0.5 trolley, which is 7 presses', () => {
      expect(TROLLEY_STEP).toBe(0.5);
      expect(TrolleyUtil.calculatePresses(TROLLEY_STEP)).toBe(7);
    });

    // Only multiples of 0.5 are valid sessions, and each yields whole Presses.
    const cases: Array<[number, number]> = [
      [0, 0],
      [0.5, 7],
      [1, 14],
      [1.5, 21],
      [2, 28],
      [2.5, 35],
      [30, 420],
      [30.5, 427],
    ];

    for (const [trolleys, presses] of cases) {
      it(`converts ${trolleys} trolleys to ${presses} presses`, () => {
        expect(TrolleyUtil.calculatePresses(trolleys)).toBe(presses);
        expect(TrolleyUtil.isValidTrolleyCount(trolleys)).toBe(true);
        expect(Number.isInteger(presses)).toBe(true);
      });
    }

    it('accepts 1.5 trolleys as 21 presses', () => {
      expect(TrolleyUtil.calculatePresses(1.5)).toBe(21);
      expect(TrolleyUtil.isValidTrolleyCount(1.5)).toBe(true);
    });

    it('rejects 30.25 trolleys because it is not a multiple of 0.5', () => {
      expect(TrolleyUtil.isValidTrolleyCount(30.25)).toBe(false);
      expect(TrolleyUtil.isOnStep(30.25)).toBe(false);
      expect(TrolleyUtil.hasWholePresses(30.25)).toBe(false);
    });

    it('rejects every confirmed off-step example', () => {
      for (const value of [0.25, 0.75, 1.25, 30.25]) {
        expect(TrolleyUtil.isValidTrolleyCount(value)).withContext(String(value)).toBe(false);
      }
    });

    it('never floors, ceils, rounds or snaps an off-step value', () => {
      // The exact product is always returned; the entry is rejected separately.
      expect(TrolleyUtil.calculatePresses(30.25)).toBe(423.5);
      expect(TrolleyUtil.calculatePresses(30.25)).not.toBe(423);
      expect(TrolleyUtil.calculatePresses(30.25)).not.toBe(424);
      expect(TrolleyUtil.calculatePresses(0.75)).toBe(10.5);
      expect(TrolleyUtil.calculatePresses(1.25)).toBe(17.5);
      expect(TrolleyUtil.calculatePresses(0.1)).toBe(1.4000000000000001);
    });

    it('treats 0.1 trolleys (1.4 presses) as invalid, and 0.5 as valid', () => {
      expect(TrolleyUtil.isValidTrolleyCount(0.1)).toBe(false);
      expect(TrolleyUtil.isValidTrolleyCount(0.5)).toBe(true);
    });

    it('is not fooled by binary floating-point error on a legitimate half trolley', () => {
      // 0.1 * 14 is 1.4000000000000001 in raw IEEE-754, so the step decision
      // cannot be a `Number.isInteger(x * 2)` test.
      expect(0.1 * 14).not.toBe(1.4);
      expect(TrolleyUtil.isOnStep(30.5)).toBe(true);
      expect(TrolleyUtil.isValidTrolleyCount(30.5)).toBe(true);
      expect(TrolleyUtil.calculatePresses(30.5)).toBe(427);
    });

    it('accepts 0 as a legitimate whole-press trolley count', () => {
      expect(TrolleyUtil.isValidTrolleyCount(0)).toBe(true);
      expect(TrolleyUtil.isOnStep(0)).toBe(true);
      expect(TrolleyUtil.hasWholePresses(0)).toBe(true);
      expect(TrolleyUtil.calculatePresses(0)).toBe(0);
    });

    it('never rounds the trolley value itself', () => {
      for (const [trolleys] of cases) {
        expect(TrolleyUtil.calculatePresses(trolleys) / PRESSES_PER_TROLLEY).toBeCloseTo(trolleys, 10);
      }
    });

    it('derives Presses in the form and computes Produced = Presses x PPP', async () => {
      const { comp } = await createComponentOnLine(LINE_1, 10);
      comp.items.at(0).get('trolleyCount')!.setValue(30.5);
      comp.calculateRowProduced(0);

      expect(comp.items.at(0).get('presses')!.value).toBe(427);
      expect(comp.items.at(0).get('produced')!.value).toBe(4270);
      expect(comp.getTotalPresses()).toBe(427);
      expect(comp.getTotalProduced()).toBe(4270);
    });

    it('keeps Produced unrounded with a fractional PiecesPerPress', async () => {
      // 30.5 trolleys = 427 presses; 427 x 10.5 = 4483.5
      const { comp } = await createComponentOnLine(LINE_1, 10.5);
      comp.items.at(0).get('trolleyCount')!.setValue(30.5);
      comp.calculateRowProduced(0);

      expect(comp.items.at(0).get('presses')!.value).toBe(427);
      expect(comp.items.at(0).get('produced')!.value).toBe(4483.5);
      expect(ProductionUtil.calculateProduced(10.5, 427)).toBe(4483.5);
    });

    it('shows the calculated Presses exactly as computed when the entry is off-step', async () => {
      // 30.25 trolleys = 423.5 presses; 423.5 x 0.75 = 317.625. The displayed
      // numbers are the real products — nothing is rounded, and nothing is
      // snapped to 30 or 30.5, to fake validity.
      const { comp } = await createComponentOnLine(LINE_1, 0.75);
      comp.items.at(0).get('trolleyCount')!.setValue(30.25);
      comp.calculateRowProduced(0);

      expect(comp.items.at(0).get('trolleyCount')!.value).toBe(30.25);
      expect(comp.items.at(0).get('presses')!.value).toBe(423.5);
      expect(comp.items.at(0).get('presses')!.value).not.toBe(420);
      expect(comp.items.at(0).get('presses')!.value).not.toBe(427);
      expect(comp.items.at(0).get('produced')!.value).toBe(317.625);
      expect(comp.items.at(0).get('trolleyCount')!.hasError('invalidStep')).toBe(true);
    });

    it('sets the trolley input step to 0.5', async () => {
      const { fixture } = await createComponentOnLine(LINE_1);
      const input = fixture.nativeElement.querySelector('input[formControlName="trolleyCount"]');
      expect(input.getAttribute('step')).toBe('0.5');
      expect(input.getAttribute('min')).toBe('0');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. INPUT MODE — which line gets Trolleys
  // ═══════════════════════════════════════════════════════════
  describe('input mode selection', () => {
    it('activates trolley mode on Line 1', async () => {
      const { comp, fixture } = await createComponentOnLine(LINE_1);
      expect(comp.trolleyMode).toBe(true);
      // Assert against the live translations, not hardcoded English: the active
      // language is global state and another suite may have selected Arabic.
      const t = (key: string) => comp.translation.translate(key);
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(t('production.form.trolleys'));
      expect(text).toContain(t('production.form.pressesPerTrolley'));
      expect(text).toContain(t('production.form.calculatedPresses'));
    });

    it('activates trolley mode on Line 2', async () => {
      const { comp, fixture } = await createComponentOnLine(LINE_2);
      expect(comp.trolleyMode).toBe(true);
      expect(fixture.nativeElement.textContent as string)
        .toContain(comp.translation.translate('production.form.trolleys'));
    });

    it('renders a read-only Presses-per-trolley field fixed at 14 in trolley mode', async () => {
      const { fixture } = await createComponentOnLine(LINE_1);
      const pptInputs = fixture.nativeElement.querySelectorAll('.col-presses-per-trolley input');
      expect(pptInputs.length).toBe(1);
      const el = pptInputs[0] as HTMLInputElement;
      expect(el.value).toBe('14');
      expect(el.readOnly).toBe(true);
    });

    it('allows decimal entry in the Trolleys field, stepping by 0.5', async () => {
      const { fixture } = await createComponentOnLine(LINE_1);
      const input = fixture.nativeElement.querySelector('.col-trolleys input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.readOnly).toBe(false);
      // The native stepper advertises the same increment the validator enforces,
      // so the UI affordance and the accepted values cannot disagree.
      expect(input.getAttribute('step')).toBe('0.5');
      expect(input.getAttribute('min')).toBe('0');
    });

    it('makes the Presses field read-only in trolley mode', async () => {
      const { fixture } = await createComponentOnLine(LINE_1);
      const input = fixture.nativeElement.querySelector('.col-presses input') as HTMLInputElement;
      expect(input.readOnly).toBe(true);
    });

    it('keeps Line 3 on the existing manual Presses input, unchanged', async () => {
      const { comp, fixture } = await createComponentOnLine(LINE_3);
      expect(comp.trolleyMode).toBe(false);
      expect(fixture.nativeElement.querySelector('.col-trolleys')).toBeNull();
      expect(fixture.nativeElement.querySelector('.col-presses-per-trolley')).toBeNull();
      expect(fixture.nativeElement.textContent as string).not.toContain('Trolleys');

      const pressesInput = fixture.nativeElement.querySelector('.col-presses input') as HTMLInputElement;
      expect(pressesInput.readOnly).toBe(false);
      expect(pressesInput.getAttribute('min')).toBe('0');
    });

    it('keeps Line 4 on the existing manual Presses input, unchanged', async () => {
      const { comp, fixture } = await createComponentOnLine(LINE_4);
      expect(comp.trolleyMode).toBe(false);
      expect(fixture.nativeElement.querySelector('.col-trolleys')).toBeNull();
    });

    it('does not activate trolley mode when no line is selected', async () => {
      const fixture = await createComponent();
      expect(fixture.componentInstance.trolleyMode).toBe(false);
    });

    it('switches from trolley mode to manual mode when the line changes', async () => {
      const { comp, fixture } = await createComponentOnLine(LINE_1);
      expect(comp.trolleyMode).toBe(true);

      comp.productionForm.get('lineId')!.setValue(LINE_3);
      comp.onLineChange();
      fixture.detectChanges();

      expect(comp.trolleyMode).toBe(false);
      expect(fixture.nativeElement.querySelector('.col-trolleys')).toBeNull();
    });

    it('manual Presses on a non-trolley line still drives Produced', async () => {
      const { comp } = await createComponentOnLine(LINE_3, 10);
      comp.items.at(0).get('presses')!.setValue(150);
      comp.calculateRowProduced(0);
      expect(comp.items.at(0).get('produced')!.value).toBe(1500);
      expect(comp.items.at(0).get('trolleyCount')!.value).toBeNull();
    });

    it('does not let a typed Presses value override trolley mode', async () => {
      const { comp } = await createComponentOnLine(LINE_1, 10);
      comp.items.at(0).get('trolleyCount')!.setValue(0.5);
      comp.items.at(0).get('presses')!.setValue(999);
      comp.calculateRowProduced(0);
      expect(comp.items.at(0).get('presses')!.value).toBe(7);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. VALIDATION — accept / reject
  // ═══════════════════════════════════════════════════════════
  describe('validation', () => {
    it('accepts the confirmed valid values 0, 0.5, 1, 1.5 and 30.5', () => {
      for (const value of [0, 0.5, 1, 1.5, 30.5]) {
        expect(TrolleyUtil.isValidTrolleyCount(value)).withContext(String(value)).toBe(true);
      }
    });

    it('accepts 0 because a line stopped for the whole day is a valid session', () => {
      expect(TrolleyUtil.isValidTrolleyCount(0)).toBe(true);
      expect(TrolleyUtil.isNumericTrolleyCount(0)).toBe(true);
      expect(TrolleyUtil.isOnStep(0)).toBe(true);
      expect(TrolleyUtil.hasWholePresses(0)).toBe(true);
    });

    it('rejects the confirmed invalid off-step values', () => {
      for (const value of [0.25, 0.75, 1.25, 30.25]) {
        expect(TrolleyUtil.isValidTrolleyCount(value)).withContext(String(value)).toBe(false);
        expect(TrolleyUtil.isOnStep(value)).withContext(String(value)).toBe(false);
      }
    });

    it('rejects every trolley count that is not a multiple of 0.5', () => {
      for (const value of [0.1, 0.2, 0.3, 30.25, 30.1, 1.1]) {
        expect(TrolleyUtil.isOnStep(value)).withContext(String(value)).toBe(false);
        expect(TrolleyUtil.isValidTrolleyCount(value)).withContext(String(value)).toBe(false);
      }
    });

    it('rejects negatives', () => {
      expect(TrolleyUtil.isValidTrolleyCount(-1)).toBe(false);
      expect(TrolleyUtil.isValidTrolleyCount(-0.5)).toBe(false);
      expect(TrolleyUtil.isNumericTrolleyCount(-2)).toBe(false);
    });

    it('rejects non-numeric input', () => {
      expect(TrolleyUtil.isValidTrolleyCount('abc')).toBe(false);
      expect(TrolleyUtil.isValidTrolleyCount('')).toBe(false);
      expect(TrolleyUtil.isValidTrolleyCount(null)).toBe(false);
      expect(TrolleyUtil.isValidTrolleyCount(undefined)).toBe(false);
      expect(TrolleyUtil.isValidTrolleyCount(NaN)).toBe(false);
    });

    it('marks the Trolleys control invalid in trolley mode when empty', async () => {
      const { comp } = await createComponentOnLine(LINE_1);
      const ctrl = comp.items.at(0).get('trolleyCount')!;
      ctrl.setValue(null);
      ctrl.markAsTouched();
      expect(ctrl.hasError('invalidTrolleys')).toBe(true);
      expect(comp.productionForm.invalid).toBe(true);
    });

    it('accepts a half-trolley decimal without a validation error', async () => {
      const { comp } = await createComponentOnLine(LINE_1);
      const ctrl = comp.items.at(0).get('trolleyCount')!;
      ctrl.setValue(30.5);
      ctrl.markAsTouched();
      expect(ctrl.hasError('invalidTrolleys')).toBe(false);
      expect(ctrl.hasError('invalidStep')).toBe(false);
      expect(ctrl.valid).toBe(true);
    });

    it('flags every off-step value with a dedicated invalidStep error', async () => {
      for (const value of [0.25, 0.75, 1.25, 30.25]) {
        const { comp } = await createComponentOnLine(LINE_1);
        const ctrl = comp.items.at(0).get('trolleyCount')!;
        ctrl.setValue(value);
        ctrl.updateValueAndValidity();
        ctrl.markAsTouched();
        expect(ctrl.hasError('invalidStep')).withContext(String(value)).toBe(true);
        expect(ctrl.hasError('invalidTrolleys')).withContext(String(value)).toBe(false);
        expect(comp.productionForm.invalid).withContext(String(value)).toBe(true);
      }
    });

    it('flags a negative count with the invalidTrolleys error', async () => {
      const { comp } = await createComponentOnLine(LINE_1);
      const ctrl = comp.items.at(0).get('trolleyCount')!;
      ctrl.setValue(-2);
      ctrl.updateValueAndValidity();
      ctrl.markAsTouched();
      expect(ctrl.hasError('invalidTrolleys')).toBe(true);
      expect(ctrl.hasError('invalidStep')).toBe(false);
    });

    it('flags non-numeric input with the invalidTrolleys error', async () => {
      const { comp } = await createComponentOnLine(LINE_1);
      const ctrl = comp.items.at(0).get('trolleyCount')!;
      ctrl.setValue('bad');
      ctrl.updateValueAndValidity();
      ctrl.markAsTouched();
      expect(ctrl.hasError('invalidTrolleys')).toBe(true);
    });

    it('does not apply trolley validation on a non-trolley line', async () => {
      const { comp } = await createComponentOnLine(LINE_3);
      const ctrl = comp.items.at(0).get('trolleyCount')!;
      expect(ctrl.validator).toBeNull();
      expect(ctrl.hasError('invalidTrolleys')).toBe(false);
    });

    it('ALLOWS the save when the trolley count is 0 (line stopped all day)', async () => {
      const { comp } = await createComponentOnLine(LINE_1, 10.5);
      comp.items.at(0).get('trolleyCount')!.setValue(0);
      comp.calculateRowProduced(0);
      comp.productionForm.get('supervisor')!.setValue('Ahmed');

      expect(comp.items.at(0).get('presses')!.value).toBe(0);
      expect(comp.items.at(0).get('produced')!.value).toBe(0);
      expect(comp.productionForm.invalid).toBe(false);

      comp.saveProduction();

      const prod = TestBed.inject(ProductionService) as unknown as FakeProductionService;
      expect(prod.written.length).toBe(1);
      expect(prod.written[0].trolleyCount).toBe(0);
      expect(prod.written[0].pressesPerTrolley).toBe(14);
      expect(prod.written[0].presses).toBe(0);
      expect(prod.written[0].produced).toBe(0);
    });

    it('ALLOWS the save for 0.5 and 1.5 trolleys', async () => {
      for (const [trolleys, presses] of [[0.5, 7], [1.5, 21]] as Array<[number, number]>) {
        const { comp } = await createComponentOnLine(LINE_1, 10);
        comp.items.at(0).get('trolleyCount')!.setValue(trolleys);
        comp.calculateRowProduced(0);
        comp.productionForm.get('supervisor')!.setValue('Ahmed');
        expect(comp.productionForm.invalid).toBe(false);

        comp.saveProduction();

        const prod = TestBed.inject(ProductionService) as unknown as FakeProductionService;
        expect(prod.written.length).withContext(`${trolleys} trolleys`).toBe(1);
        expect(prod.written[0].trolleyCount).toBe(trolleys);
        expect(prod.written[0].presses).toBe(presses);
        expect(prod.written[0].produced).toBe(presses * 10);
        prod.written.length = 0;
      }
    });

    it('blocks the save for an off-step value and shows the step message', async () => {
      const { comp, fixture } = await createComponentOnLine(LINE_1, 10.5);
      const ctrl = comp.items.at(0).get('trolleyCount')!;
      ctrl.setValue(30.25);
      comp.calculateRowProduced(0);
      ctrl.markAsTouched();
      comp.productionForm.get('supervisor')!.setValue('Ahmed');
      fixture.detectChanges();

      expect(comp.productionForm.invalid).toBe(true);
      expect(ctrl.hasError('invalidStep')).toBe(true);
      expect(ctrl.hasError('invalidTrolleys')).toBe(false);
      // The exact, unrounded result stays visible so the operator can see why.
      // Nothing is snapped to 30 or 30.5.
      expect(ctrl.value).toBe(30.25);
      expect(comp.items.at(0).get('presses')!.value).toBe(423.5);
      // The reason is rendered in a full-width row under the fields, in the
      // active language.
      expect(fixture.nativeElement.querySelector('.row-messages')).not.toBeNull();
      expect(fixture.nativeElement.textContent)
        .toContain(comp.translation.translate('production.error.invalidStep'));

      comp.saveProduction();
      expect((TestBed.inject(ProductionService) as unknown as FakeProductionService).written.length).toBe(0);
    });

    it('blocks the save for a negative trolley count', async () => {
      const { comp } = await createComponentOnLine(LINE_1);
      const ctrl = comp.items.at(0).get('trolleyCount')!;
      ctrl.setValue(-2);
      ctrl.markAsTouched();
      comp.calculateRowProduced(0);
      comp.productionForm.get('supervisor')!.setValue('Ahmed');

      expect(ctrl.hasError('invalidTrolleys')).toBe(true);
      expect(ctrl.hasError('invalidStep')).toBe(false);
      comp.saveProduction();
      expect((TestBed.inject(ProductionService) as unknown as FakeProductionService).written.length).toBe(0);
    });

    it('blocks the save for a non-numeric trolley count', async () => {
      const { comp } = await createComponentOnLine(LINE_1);
      const ctrl = comp.items.at(0).get('trolleyCount')!;
      ctrl.setValue(null);
      ctrl.updateValueAndValidity();
      ctrl.markAsTouched();
      comp.productionForm.get('supervisor')!.setValue('Ahmed');

      expect(ctrl.hasError('invalidTrolleys')).toBe(true);
      comp.saveProduction();
      expect((TestBed.inject(ProductionService) as unknown as FakeProductionService).written.length).toBe(0);
    });

    it('blocks the save when the trolley count is negative', async () => {
      const { comp } = await createComponentOnLine(LINE_1);
      comp.items.at(0).get('trolleyCount')!.setValue(-2);
      comp.calculateRowProduced(0);
      expect(comp.productionForm.invalid).toBe(true);
      comp.saveProduction();
      expect((TestBed.inject(ProductionService) as unknown as FakeProductionService).written.length).toBe(0);
    });

    it('blocks the save and surfaces the step error when 30.25 reaches the save guard', async () => {
      // The reactive validator blocks the form first; the save guard is the
      // second, independent line of defence (e.g. a value set past the form).
      const { comp } = await createComponentOnLine(LINE_1);
      comp.items.at(0).get('trolleyCount')!.setValue(0.5);
      comp.calculateRowProduced(0);
      const trolleyControl = comp.items.at(0).get('trolleyCount')!;
      trolleyControl.clearValidators();
      trolleyControl.setValue(30.25);
      trolleyControl.updateValueAndValidity();
      comp.productionForm.get('supervisor')!.setValue('Ahmed');

      comp.saveProduction();

      expect(comp.saveError).toBe(comp.translation.translate('production.error.invalidStep'));
      expect((TestBed.inject(ProductionService) as unknown as FakeProductionService).written.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. SAVE / RELOAD PERSISTENCE
  // ═══════════════════════════════════════════════════════════
  describe('save and reload', () => {
    it('persists trolley_count, presses_per_trolley and whole presses', async () => {
      const { comp } = await createComponentOnLine(LINE_1, 10);
      comp.items.at(0).get('trolleyCount')!.setValue(30.5);
      comp.calculateRowProduced(0);
      comp.productionForm.get('supervisor')!.setValue('Ahmed');
      comp.saveProduction();

      const written = (TestBed.inject(ProductionService) as unknown as FakeProductionService).written;
      expect(written.length).toBe(1);
      expect(written[0].trolleyCount).toBe(30.5);
      expect(written[0].pressesPerTrolley).toBe(14);
      expect(written[0].presses).toBe(427);
      expect(written[0].produced).toBe(4270);
    });

    it('zero-production session survives a save and reload with all zeros intact', async () => {
      const prod = TestBed.inject(ProductionService) as unknown as FakeProductionService;
      const { comp } = await createComponentOnLine(LINE_1, 10.5);
      comp.items.at(0).get('trolleyCount')!.setValue(0);
      comp.calculateRowProduced(0);
      comp.productionForm.get('supervisor')!.setValue('Ahmed');
      comp.saveProduction();

      const written = prod.written;
      expect(written.length).toBe(1);
      expect(written[0].trolleyCount).toBe(0);
      expect(written[0].presses).toBe(0);
      expect(written[0].produced).toBe(0);
      expect(TrolleyUtil.hasTrolleyData(written[0])).toBe(true);
      expect(TrolleyUtil.trolleyCountOf(written[0])).toBe(0);

      // Reload: a stored 0 must come back as a trolley session showing 0, and
      // must not be mistaken for "no trolley data" (legacy fallback).
      const stored = written[0];
      prod.records = [stored];
      const sessions = TestBed.inject(ProductionSessionService) as unknown as FakeProductionSessionService;
      sessions.sessions = [{
        id: stored.sessionId!, date: stored.date, shiftId: '', lineId: LINE_1, supervisor: 'Ahmed',
        overtime: false, overtimeHours: 0, dailyLineTime: [], notes: '', createdAt: stored.createdAt
      }];
      (TestBed.inject(LineService) as unknown as FakeLineService).getAll = () => of(
        [LINE_1, LINE_2, LINE_3, LINE_4].map((id, i) => ({
          id, name: `Line ${i + 1}`, active: true, createdAt: '2026-01-01T00:00:00Z'
        }))
      );
      (TestBed.inject(ProductService) as unknown as FakeProductService).getAll = () => of([
        { id: 'p1', name: 'Block 8', active: true, piecesPerPress: 10.5, productArea: 0.08, createdAt: '2026-01-01T00:00:00Z' }
      ] as any);

      const fixture = await createComponent();
      const reloaded = fixture.componentInstance;
      reloaded.editSession(stored);
      fixture.detectChanges();

      expect(reloaded.trolleyMode).toBe(true);
      expect(reloaded.items.at(0).get('trolleyCount')!.value).toBe(0);
      expect(reloaded.items.at(0).get('presses')!.value).toBe(0);
      expect(reloaded.items.at(0).get('produced')!.value).toBe(0);
    });

    it('persists Line 2 trolley records the same way', async () => {
      const { comp } = await createComponentOnLine(LINE_2, 12);
      comp.items.at(0).get('trolleyCount')!.setValue(30.5);
      comp.calculateRowProduced(0);
      comp.saveProduction();

      const written = (TestBed.inject(ProductionService) as unknown as FakeProductionService).written;
      expect(written[0].trolleyCount).toBe(30.5);
      expect(written[0].pressesPerTrolley).toBe(14);
      expect(written[0].presses).toBe(427);
      expect(written[0].produced).toBe(5124);
    });

    it('round-trips a decimal trolley record through edit without drift', async () => {
      const prod = TestBed.inject(ProductionService) as unknown as FakeProductionService;
      const sessionId = 'sess_trolley';
      const stored: Production = {
        id: `${sessionId}:0`, sessionId, date: '2026-09-28', shiftId: '', lineId: LINE_1,
        productId: 'p1', supervisor: 'Ahmed', piecesPerPress: 10.5,
        presses: 427, produced: 4483.5, trolleyCount: 30.5, pressesPerTrolley: 14,
        createdAt: '2026-09-28T10:00:00Z'
      };
      prod.records = [stored];
      const sessions = TestBed.inject(ProductionSessionService) as unknown as FakeProductionSessionService;
      sessions.sessions = [{
        id: sessionId, date: '2026-09-28', shiftId: '', lineId: LINE_1, supervisor: 'Ahmed',
        overtime: false, overtimeHours: 0, dailyLineTime: [], notes: '', createdAt: '2026-09-28T10:00:00Z'
      }];
      (TestBed.inject(LineService) as unknown as FakeLineService).getAll = () => of(
        [LINE_1, LINE_2, LINE_3, LINE_4].map((id, i) => ({
          id, name: `Line ${i + 1}`, active: true, createdAt: '2026-01-01T00:00:00Z'
        }))
      );
      (TestBed.inject(ProductService) as unknown as FakeProductService).getAll = () => of([
        { id: 'p1', name: 'Block 8', active: true, piecesPerPress: 10.5, productArea: 0.08, createdAt: '2026-01-01T00:00:00Z' }
      ] as any);

      const fixture = await createComponent();
      const comp = fixture.componentInstance;
      comp.editSession(stored);
      fixture.detectChanges();

      // Loads in trolley mode with the stored decimals intact.
      expect(comp.trolleyMode).toBe(true);
      expect(comp.items.at(0).get('trolleyCount')!.value).toBe(30.5);
      expect(comp.items.at(0).get('presses')!.value).toBe(427);
      expect(comp.items.at(0).get('produced')!.value).toBe(4483.5);

      // Re-saving without touching anything must not change the stored values.
      comp.saveProduction();
      const written = prod.written;
      expect(written.length).toBe(1);
      expect(written[0].trolleyCount).toBe(30.5);
      expect(written[0].pressesPerTrolley).toBe(14);
      expect(written[0].presses).toBe(427);
      expect(written[0].produced).toBe(4483.5);
      expect(written[0].id).toBe(stored.id);
    });

    it('recomputes presses and produced when the trolley value is edited', async () => {
      const { comp } = await createComponentOnLine(LINE_1, 10);
      comp.items.at(0).get('trolleyCount')!.setValue(0.5);
      comp.calculateRowProduced(0);
      expect(comp.items.at(0).get('presses')!.value).toBe(7);
      expect(comp.items.at(0).get('produced')!.value).toBe(70);

      // 30 -> 420, then edited to 30.5 -> 427.
      comp.items.at(0).get('trolleyCount')!.setValue(30);
      comp.calculateRowProduced(0);
      expect(comp.items.at(0).get('presses')!.value).toBe(420);

      comp.items.at(0).get('trolleyCount')!.setValue(30.5);
      comp.calculateRowProduced(0);
      expect(comp.items.at(0).get('presses')!.value).toBe(427);
      expect(comp.items.at(0).get('produced')!.value).toBe(4270);
    });

    it('editing 0 to 0.5 recalculates from zero to 7 presses', async () => {
      const { comp } = await createComponentOnLine(LINE_1, 10.5);
      comp.items.at(0).get('trolleyCount')!.setValue(0);
      comp.calculateRowProduced(0);
      expect(comp.items.at(0).get('presses')!.value).toBe(0);
      expect(comp.items.at(0).get('produced')!.value).toBe(0);

      comp.items.at(0).get('trolleyCount')!.setValue(0.5);
      comp.calculateRowProduced(0);
      expect(comp.items.at(0).get('presses')!.value).toBe(7);
      expect(comp.items.at(0).get('produced')!.value).toBe(73.5);
    });

    it('keeps every valid row total a whole number of presses', async () => {
      const { comp } = await createComponentOnLine(LINE_1, 10);
      comp.addItem();
      comp.items.at(1).get('productId')!.setValue('p1');
      comp.onProductChange(1);

      comp.items.at(0).get('trolleyCount')!.setValue(30.5); // 427 presses
      comp.items.at(1).get('trolleyCount')!.setValue(0.5);  // 7 presses
      comp.calculateRowProduced(0);
      comp.calculateRowProduced(1);

      expect(comp.getTotalPresses()).toBe(434);
      expect(Number.isInteger(comp.getTotalPresses())).toBe(true);
      expect(comp.getTotalProduced()).toBe(4340);
    });

    it('a zero row contributes 0 to the summary without breaking the total', async () => {
      const { comp } = await createComponentOnLine(LINE_1, 10.5);
      comp.addItem();
      comp.items.at(1).get('productId')!.setValue('p1');
      comp.onProductChange(1);

      comp.items.at(0).get('trolleyCount')!.setValue(0);    // 0 presses
      comp.items.at(1).get('trolleyCount')!.setValue(30.5); // 427 presses
      comp.calculateRowProduced(0);
      comp.calculateRowProduced(1);

      expect(comp.getTotalPresses()).toBe(427);
      expect(comp.getTotalProduced()).toBe(4483.5);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. HISTORICAL INTEGRITY
  // ═══════════════════════════════════════════════════════════
  describe('historical integrity', () => {
    async function loadLegacyLine1(presses: number, produced: number) {
      const prod = TestBed.inject(ProductionService) as unknown as FakeProductionService;
      const sessionId = 'sess_legacy';
      const stored: Production = {
        id: `${sessionId}:0`, sessionId, date: '2026-09-01', shiftId: '', lineId: LINE_1,
        productId: 'p1', supervisor: 'Ahmed', piecesPerPress: 10,
        presses, produced, createdAt: '2026-09-01T10:00:00Z'
      };
      prod.records = [stored];
      const sessions = TestBed.inject(ProductionSessionService) as unknown as FakeProductionSessionService;
      sessions.sessions = [{
        id: sessionId, date: '2026-09-01', shiftId: '', lineId: LINE_1, supervisor: 'Ahmed',
        overtime: false, overtimeHours: 0, dailyLineTime: [], notes: '', createdAt: '2026-09-01T10:00:00Z'
      }];
      (TestBed.inject(LineService) as unknown as FakeLineService).getAll = () => of(
        [LINE_1, LINE_2, LINE_3, LINE_4].map((id, i) => ({
          id, name: `Line ${i + 1}`, active: true, createdAt: '2026-01-01T00:00:00Z'
        }))
      );
      (TestBed.inject(ProductService) as unknown as FakeProductService).getAll = () => of([
        { id: 'p1', name: 'Block 8', active: true, piecesPerPress: 10, productArea: 0.08, createdAt: '2026-01-01T00:00:00Z' }
      ] as any);

      const fixture = await createComponent();
      const comp = fixture.componentInstance;
      comp.editSession(stored);
      fixture.detectChanges();
      return { fixture, comp, prod, stored };
    }

    it('keeps a legacy Line 1 record readable on the manual Presses form', async () => {
      const { comp, fixture, stored } = await loadLegacyLine1(300, 3000);
      expect(comp.trolleyMode).toBe(false);
      expect(fixture.nativeElement.querySelector('.col-trolleys')).toBeNull();
      expect(comp.items.at(0).get('presses')!.value).toBe(300);
      expect(comp.items.at(0).get('produced')!.value).toBe(3000);
      expect(stored.trolleyCount).toBeUndefined();
    });

    it('never invents a trolley count for a legacy Line 1 record', async () => {
      const { comp } = await loadLegacyLine1(300, 3000);
      expect(comp.items.at(0).get('trolleyCount')!.value).toBeNull();
      expect(TrolleyUtil.hasTrolleyData({ presses: 300 } as Production)).toBe(false);
      expect(TrolleyUtil.trolleyCountOf({ presses: 300 } as Production)).toBeNull();
    });

    it('never back-derives a trolley count from a non-divisible legacy press count', async () => {
      // 300 presses is not a whole multiple of 14 — proof that presses cannot
      // be assumed to have come from trolleys.
      await loadLegacyLine1(300, 3000);
      expect(300 / PRESSES_PER_TROLLEY).not.toBe(Math.round(300 / PRESSES_PER_TROLLEY));
    });

    it('re-saving a legacy Line 1 record does not rewrite its presses or add trolley data', async () => {
      const { comp, prod, stored } = await loadLegacyLine1(300, 3000);
      comp.saveProduction();

      const written = prod.written;
      expect(written.length).toBe(1);
      expect(written[0].presses).toBe(300);
      expect(written[0].produced).toBe(3000);
      expect(written[0].trolleyCount).toBeUndefined();
      expect(written[0].pressesPerTrolley).toBeUndefined();
      expect(written[0].id).toBe(stored.id);
    });

    it('a legacy record on a non-trolley line is also untouched by this change', async () => {
      const prod = TestBed.inject(ProductionService) as unknown as FakeProductionService;
      const sessionId = 'sess_legacy_l3';
      const stored: Production = {
        id: `${sessionId}:0`, sessionId, date: '2026-09-01', shiftId: '', lineId: LINE_3,
        productId: 'p1', supervisor: 'Ahmed', piecesPerPress: 10,
        presses: 420, produced: 4200, createdAt: '2026-09-01T10:00:00Z'
      };
      prod.records = [stored];
      (TestBed.inject(ProductionSessionService) as unknown as FakeProductionSessionService).sessions = [{
        id: sessionId, date: '2026-09-01', shiftId: '', lineId: LINE_3, supervisor: 'Ahmed',
        overtime: false, overtimeHours: 0, dailyLineTime: [], notes: '', createdAt: '2026-09-01T10:00:00Z'
      }];
      (TestBed.inject(LineService) as unknown as FakeLineService).getAll = () => of(
        [LINE_1, LINE_2, LINE_3, LINE_4].map((id, i) => ({
          id, name: `Line ${i + 1}`, active: true, createdAt: '2026-01-01T00:00:00Z'
        }))
      );
      (TestBed.inject(ProductService) as unknown as FakeProductService).getAll = () => of([
        { id: 'p1', name: 'Block 8', active: true, piecesPerPress: 10, productArea: 0.08, createdAt: '2026-01-01T00:00:00Z' }
      ] as any);

      const fixture = await createComponent();
      const comp = fixture.componentInstance;
      comp.editSession(stored);
      comp.saveProduction();

      const written = prod.written;
      expect(written[0].presses).toBe(420);
      expect(written[0].trolleyCount).toBeUndefined();
    });

    it('only Line 1 and Line 2 are trolley lines', () => {
      expect(TrolleyUtil.isTrolleyLine(LINE_1)).toBe(true);
      expect(TrolleyUtil.isTrolleyLine(LINE_2)).toBe(true);
      expect(TrolleyUtil.isTrolleyLine(LINE_3)).toBe(false);
      expect(TrolleyUtil.isTrolleyLine('lin-005')).toBe(false);
      expect(TrolleyUtil.isTrolleyLine('')).toBe(false);
      expect(TrolleyUtil.isTrolleyLine(null)).toBe(false);
    });
  });
});
