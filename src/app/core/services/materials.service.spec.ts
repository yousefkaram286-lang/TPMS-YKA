import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';

import { MaterialsService } from './materials.service';
import { StorageService } from './storage.service';
import { STORE_NAMES } from '../constants/storage.constants';
import { MaterialRecord, MaterialTransactionItem } from '../models/material-record.model';
import { Product } from '../models/product.model';
import { Line } from '../models/line.model';
import { Shift } from '../models/shift.model';
import { Material } from '../models/material.model';
import { Recipe } from '../models/recipe.model';
import { MaterialConversionUtil } from '../utils/material-conversion.util';

// ─── Master data seeds (corrected model) ─────────────────────────────────────

const NOW = '2026-01-01T00:00:00.000Z';

const PRODUCTS: Product[] = [
  { id: 'prd-001', name: 'Block 20', piecesPerPress: 5, standardStrength: 15, active: true, createdAt: NOW },
  { id: 'prd-002', name: 'Block 15', piecesPerPress: 6, standardStrength: 12, active: true, createdAt: NOW }
];

const LINES: Line[] = [
  { id: 'lin-001', name: 'Line 1 - Heavy',    active: true, createdAt: NOW },
  { id: 'lin-002', name: 'Line 2 - Standard', active: true, createdAt: NOW }
];

const SHIFTS: Shift[] = [
  { id: 'shf-001', name: 'Morning',  startTime: '06:00', endTime: '14:00', active: true, createdAt: NOW },
  { id: 'shf-002', name: 'Afternoon', startTime: '14:00', endTime: '22:00', active: true, createdAt: NOW }
];

const MATERIALS: Material[] = [
  { id: 'mat-001', name: 'Sand',      unit: 'kg', active: true, createdAt: NOW },
  { id: 'mat-002', name: 'Aggregate', unit: 'kg', active: true, createdAt: NOW },
  { id: 'mat-003', name: 'Cement',    unit: 'kg', active: true, createdAt: NOW },
  { id: 'mat-004', name: 'Water',     unit: 'L',  active: true, createdAt: NOW }
];

const RECIPES: Recipe[] = [
  {
    id: 'rec-001',
    productId: 'prd-001',
    items: [
      { materialId: 'mat-003', quantity: 200 },  // Cement  standard kg/Mix
      { materialId: 'mat-001', quantity: 380 },  // Sand    standard kg/Mix
      { materialId: 'mat-002', quantity: 500 },  // Aggregate standard kg/Mix
      { materialId: 'mat-004', quantity: 90 }    // Water   standard L/Mix
    ],
    createdAt: NOW
  }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MIX = 20;

function item(
  materialId: string,
  materialName: string,
  unit: string,
  perMixStandard: number,
  perMixActual: number,
  unitCost: number
): MaterialTransactionItem {
  const theoreticalQuantity = MaterialConversionUtil.dailyFromPerMix(perMixStandard, MIX);
  const actualQuantity = MaterialConversionUtil.dailyFromPerMix(perMixActual, MIX);
  const variance = actualQuantity - theoreticalQuantity;
  const dimensionOk = true;
  const totalCost = unitCost * actualQuantity;
  return { materialId, materialName, unit, perMixStandard, perMixActual, theoreticalQuantity, actualQuantity, variance, dimensionOk, unitCost, totalCost };
}

/** The concrete corrected-model example: MixCount=20, 4 canonical materials. */
function makeExampleRecord(overrides: Partial<MaterialRecord> = {}): MaterialRecord {
  const materials = [
    item('mat-003', 'Cement',    'kg', 200, 210, 0.08),
    item('mat-001', 'Sand',      'kg', 380, 380, 0.015),
    item('mat-002', 'Aggregate', 'kg', 500, 515, 0.02),
    item('mat-004', 'Water',     'L',  90,  95,  0.002)
  ];
  return {
    id: 'material_sub_sub-ok',
    date: '2026-08-29',
    lineId: 'lin-001',
    shiftId: 'shf-001',
    productId: 'prd-001',
    mixCount: MIX,
    operator: 'Ahmed',
    materials,
    totalCost: materials.reduce((s, i) => s + i.totalCost, 0),
    createdAt: '2026-08-29T08:00:00.000Z',
    ...overrides
  };
}

// ─── Mock StorageService (IndexedDB-like, keyed by store) ─────────────────────

function createMockStorage() {
  const stores = new Map<string, Map<string, any>>();
  const touchedStores = new Set<string>();
  let raceTarget: string | null = null;

  const getStore = (name: string): Map<string, any> => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };

  return {
    stores,
    touchedStores,
    seed: (name: string, records: any[]) => {
      const s = getStore(name);
      records.forEach(r => s.set(r.id, { ...r }));
    },
    setRaceTarget: (id: string) => { raceTarget = id; },
    getAll: jasmine.createSpy('getAll').and.callFake((storeName: string) => {
      touchedStores.add(storeName);
      return of([...getStore(storeName).values()]);
    }),
    getById: jasmine.createSpy('getById').and.callFake((storeName: string, id: string) => {
      touchedStores.add(storeName);
      if (raceTarget === id) {
        raceTarget = null;
        return of(undefined);
      }
      return of(getStore(storeName).get(id));
    }),
    add: jasmine.createSpy('add').and.callFake((storeName: string, record: any) => {
      touchedStores.add(storeName);
      const s = getStore(storeName);
      if (s.has(record.id)) {
        return new Observable((sub) => sub.error(new Error(`Key already exists: ${record.id}`)));
      }
      s.set(record.id, { ...record });
      return of({ ...record });
    }),
    update: jasmine.createSpy('update').and.callFake((storeName: string, record: any) => {
      touchedStores.add(storeName);
      getStore(storeName).set(record.id, { ...record });
      return of({ ...record });
    }),
    delete: jasmine.createSpy('delete').and.callFake((storeName: string, id: string) => {
      touchedStores.add(storeName);
      getStore(storeName).delete(id);
      return of(undefined);
    }),
    count: jasmine.createSpy('count').and.callFake((storeName: string) => {
      touchedStores.add(storeName);
      return of(getStore(storeName).size);
    })
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MaterialsService (corrected model)', () => {

  function buildService(seed?: (mock: any) => void) {
    const mockStorage = createMockStorage();
    mockStorage.seed(STORE_NAMES.PRODUCTS, PRODUCTS);
    mockStorage.seed(STORE_NAMES.LINES, LINES);
    mockStorage.seed(STORE_NAMES.SHIFTS, SHIFTS);
    mockStorage.seed(STORE_NAMES.MATERIALS, MATERIALS);
    mockStorage.seed(STORE_NAMES.RECIPES, RECIPES);
    if (seed) seed(mockStorage);

    TestBed.configureTestingModule({
      providers: [
        MaterialsService,
        { provide: StorageService, useValue: mockStorage as unknown as StorageService }
      ]
    });
    const svc = TestBed.inject(MaterialsService);
    return { svc, mock: mockStorage };
  }

  // ── regressions 1-4: daily total = MixCount × per-mix, units preserved ──
  it('regression 1-4: saved daily totals equal MixCount × per-mix AND original kg/L per-mix values are preserved', (done) => {
    const { svc } = buildService();

    svc.createIdempotent(makeExampleRecord()).subscribe(saved => {
      svc.getById(saved.id).subscribe(rec => {
        expect(rec!.mixCount).toBe(20);

        const byName = (n: string) => rec!.materials.find(m => m.materialName === n)!;

        expect(byName('Cement').perMixActual).toBe(210);
        expect(byName('Cement').actualQuantity).toBe(4200);   // 20 × 210  → DailyCementKg
        expect(byName('Cement').unit).toBe('kg');

        expect(byName('Sand').perMixActual).toBe(380);
        expect(byName('Sand').actualQuantity).toBe(7600);     // 20 × 380  → DailySandKg
        expect(byName('Sand').unit).toBe('kg');

        expect(byName('Aggregate').perMixActual).toBe(515);
        expect(byName('Aggregate').actualQuantity).toBe(10300); // 20 × 515 → DailyAggregateKg
        expect(byName('Aggregate').unit).toBe('kg');

        expect(byName('Water').perMixActual).toBe(95);
        expect(byName('Water').actualQuantity).toBe(1900);    // 20 × 95   → DailyWaterL
        expect(byName('Water').unit).toBe('L');
        done();
      });
    });
  });

  it('calculateDailyTotal helper follows the the authoritative MixCount × per-mix rule', () => {
    const { svc } = buildService();
    expect(svc.calculateDailyTotal(210, 20)).toBe(4200);
    expect(svc.calculateDailyTotal(380, 20)).toBe(7600);
    expect(svc.calculateDailyTotal(515, 20)).toBe(10300);
    expect(svc.calculateDailyTotal(95, 20)).toBe(1900);
  });

  // ── regression 8: actual may differ from standard ───────────────────────
  it('regression 8: actual per mix may differ from the standard recipe and is stored as-is', (done) => {
    const { svc } = buildService();
    const record = makeExampleRecord();
    const cement = record.materials.find(m => m.materialName === 'Cement')!;
    expect(cement.perMixStandard).toBe(200);
    expect(cement.perMixActual).toBe(210);  // differs — allowed
    expect(cement.variance).toBe(200);

    svc.createIdempotent(record).subscribe(saved => {
      expect(saved.materials.find(m => m.materialName === 'Cement')!.perMixActual).toBe(210);
      done();
    });
  });

  // ── regression 7: recipe master change never alters history ─────────────
  it('regression 7: changing the Standard Recipe after a historical save does NOT alter saved per-mix or totals', (done) => {
    const { svc, mock } = buildService();
    mock.seed(STORE_NAMES.MATERIAL_RECORDS, []);

    svc.createIdempotent(makeExampleRecord()).subscribe(() => {
      // Business changes the Recipe master: Cement standard 200 → 999.
      const recipe = { ...RECIPES[0], items: [{ materialId: 'mat-003', quantity: 999 }] };
      mock.stores.get(STORE_NAMES.RECIPES)!.set('rec-001', recipe);

      svc.getAll().subscribe(list => {
        const rec = list[0];
        const cement = rec.materials.find(m => m.materialName === 'Cement')!;
        expect(cement.perMixStandard).toBe(200);   // historical snapshot preserved
        expect(cement.perMixActual).toBe(210);     // actual untouched
        expect(cement.actualQuantity).toBe(4200);  // historical total untouched
        done();
      });
    });
  });

  // ── regression 5 & 6: Presses / PiecesPerPress never feed materials ─────
  it('regression 5 & 6: PressCount / PiecesPerPress / ProducedQuantity changes do NOT alter material totals', (done) => {
    const { svc, mock } = buildService();

    svc.createIdempotent(makeExampleRecord()).subscribe(saved => {
      // Change press-derived concepts: write a production record and bump
      // the product's piecesPerPress (+ press count implied by production).
      mock.seed(STORE_NAMES.PRODUCTIONS, [{
        id: 'prod-900', productId: 'prd-001', lineId: 'lin-001', date: '2026-08-29',
        produced: 9999, createdAt: NOW
      }]);
      mock.seed(STORE_NAMES.PRODUCTS, [{
        ...PRODUCTS[0], piecesPerPress: 99
      }]);

      svc.getById(saved.id).subscribe(rec => {
        expect(rec!.materials.find(m => m.materialName === 'Cement')!.actualQuantity).toBe(4200);
        expect(rec!.materials.find(m => m.materialName === 'Sand')!.actualQuantity).toBe(7600);
        expect(rec!.materials.find(m => m.materialName === 'Aggregate')!.actualQuantity).toBe(10300);
        expect(rec!.materials.find(m => m.materialName === 'Water')!.actualQuantity).toBe(1900);
        done();
      });
    });
  });

  // ── regression 17: no Mixer→Press traceability ──────────────────────────
  it('regression 17: Material records carry no Mixer/Press/ProducedQuantity concepts', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeExampleRecord()).subscribe(saved => {
      const asAny = saved as any;
      expect(asAny.machineId).toBeUndefined();
      expect(asAny.pressId).toBeUndefined();
      expect(asAny.producedQuantity).toBeUndefined();
      expect(asAny.piecesPerPress).toBeUndefined();
      done();
    });
  });

  // ── regression 9: missing/zero MixCount rejected ────────────────────────
  it('regression 9: missing or zero MixCount is rejected', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeExampleRecord({ mixCount: 0 } as any)).subscribe({
      next: () => fail('should reject zero mix count'),
      error: (err) => {
        expect(err.message).toMatch(/mix count/i);
        svc.createIdempotent(makeExampleRecord({ mixCount: undefined as any })).subscribe({
          next: () => fail('should reject missing mix count'),
          error: (e2) => {
            expect(e2.message).toMatch(/mix count/i);
            done();
          }
        });
      }
    });
  });

  // ── regression 10: negative per-mix rejected ────────────────────────────
  it('regression 10: negative per-mix quantities are rejected', (done) => {
    const { svc } = buildService();
    const record = makeExampleRecord();
    record.materials[0].perMixActual = -5;
    svc.createIdempotent(record).subscribe({
      next: () => fail('should reject negative per mix'),
      error: (err) => {
        expect(err.message).toMatch(/negative/i);
        done();
      }
    });
  });

  it('rejects a record missing a material name', (done) => {
    const { svc } = buildService();
    const record = makeExampleRecord();
    record.materials[0].materialName = '   ';
    svc.createIdempotent(record).subscribe({
      next: () => fail('should reject blank material name'),
      error: (err) => { expect(err.message).toMatch(/material name/i); done(); }
    });
  });

  it('rejects a record with a missing Line (transaction grain)', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeExampleRecord({ lineId: '' } as any)).subscribe({
      next: () => fail('should reject missing line'),
      error: (err) => { expect(err.message).toMatch(/line is required/i); done(); }
    });
  });

  it('rejects a record with a missing Date', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeExampleRecord({ date: '' as any })).subscribe({
      next: () => fail('should reject missing date'),
      error: (err) => { expect(err.message).toMatch(/date is required/i); done(); }
    });
  });

  // ── Product is OPTIONAL — grain is Line/day ─────────────────────────────
  it('a Line/day record WITHOUT product, shift, or operator saves successfully', (done) => {
    const { svc } = buildService();
    const record = makeExampleRecord({
      id: 'material_sub_sub-noprod',
      productId: undefined,
      shiftId: undefined,
      operator: undefined
    });
    svc.createIdempotent(record).subscribe({
      next: saved => {
        expect(saved.productId).toBeUndefined();
        expect(saved.shiftId).toBeUndefined();
        expect(saved.operator).toBeUndefined();
        expect(saved.lineId).toBe('lin-001');
        done();
      },
      error: () => fail('should accept a Line/day record without product metadata')
    });
  });

  // ── optional master references still validated when provided ───────────
  it('rejects a record referencing a nonexistent Line', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeExampleRecord({ lineId: 'lin-999' })).subscribe({
      next: () => fail('should reject invalid line'),
      error: (err) => { expect(err.message).toMatch(/line not found/i); done(); }
    });
  });

  it('rejects a provided product that does not exist', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeExampleRecord({ productId: 'prd-999' })).subscribe({
      next: () => fail('should reject invalid product'),
      error: (err) => { expect(err.message).toMatch(/product not found/i); done(); }
    });
  });

  it('rejects a provided shift that does not exist', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeExampleRecord({ shiftId: 'shf-999' })).subscribe({
      next: () => fail('should reject invalid shift'),
      error: (err) => { expect(err.message).toMatch(/shift not found/i); done(); }
    });
  });

  it('rejects an item with a provided materialId that does not exist', (done) => {
    const { svc } = buildService();
    const record = makeExampleRecord();
    record.materials[0].materialId = 'mat-999';
    svc.createIdempotent(record).subscribe({
      next: () => fail('should reject invalid material id'),
      error: (err) => { expect(err.message).toMatch(/material not found/i); done(); }
    });
  });

  it('accepts items whose materialId is empty (master resolution happens in the component)', (done) => {
    const { svc } = buildService();
    const record = makeExampleRecord({ id: 'material_sub_sub-nomatid' });
    record.materials.forEach(m => { m.materialId = ''; });
    svc.createIdempotent(record).subscribe({
      next: saved => {
        expect(saved.materials.every(m => m.materialId === '')).toBeTrue();
        done();
      },
      error: () => fail('should accept items without a master material id')
    });
  });

  it('valid save checks every PROVIDED master reference', (done) => {
    const { svc, mock } = buildService();

    svc.createIdempotent(makeExampleRecord()).subscribe(() => {
      const args = (mock.getById as jasmine.Spy).calls.allArgs();
      expect(args.some(a => a[0] === STORE_NAMES.LINES && a[1] === 'lin-001')).toBeTrue();
      expect(args.some(a => a[0] === STORE_NAMES.PRODUCTS && a[1] === 'prd-001')).toBeTrue();
      expect(args.some(a => a[0] === STORE_NAMES.SHIFTS && a[1] === 'shf-001')).toBeTrue();
      expect(args.some(a => a[0] === STORE_NAMES.MATERIALS && a[1] === 'mat-003')).toBeTrue();
      done();
    });
  });

  it('rejects a record with no submission id', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeExampleRecord({ id: ('' as any) })).subscribe({
      next: () => fail('should not save without a submission id'),
      error: (err) => { expect(err.message).toMatch(/submission id is required/i); done(); }
    });
  });

  // ── regression 11: exact retry ──────────────────────────────────────────
  it('regression 11: exact retry with the same submission id creates ONE record', (done) => {
    const { svc } = buildService();
    const record = makeExampleRecord();

    svc.createIdempotent(record).subscribe({
      next: (first) => {
        svc.createIdempotent(record).subscribe({
          next: (second) => {
            expect(second.id).toBe(first.id);
            svc.getAll().subscribe(list => {
              expect(list.length).toBe(1);
              done();
            });
          }
        });
      }
    });
  });

  // ── regression 12: two legitimate submissions are never conflated ───────
  it('regression 12: two legitimate Line/day submissions with identical content and DIFFERENT ids both persist', (done) => {
    const { svc } = buildService();
    const base = makeExampleRecord();
    const content = { ...base, id: undefined as any };

    svc.createIdempotent({ ...content, id: 'material_sub_sub-A' }).subscribe({
      next: () => {
        svc.createIdempotent({ ...content, id: 'material_sub_sub-B' }).subscribe({
          next: () => {
            svc.getAll().subscribe(list => {
              expect(list.length).toBe(2);
              expect(list.find(r => r.id === 'material_sub_sub-A')).toBeDefined();
              expect(list.find(r => r.id === 'material_sub_sub-B')).toBeDefined();
              expect(list.every(r => r.mixCount === 20)).toBeTrue();
              done();
            });
          }
        });
      }
    });
  });

  it('double-click on ONE submission produces ONE record (add called once)', (done) => {
    const { svc, mock } = buildService();
    const record = makeExampleRecord();

    svc.createIdempotent(record).subscribe({
      next: (first) => {
        svc.createIdempotent(record).subscribe({
          next: (second) => {
            expect(second.id).toBe(first.id);
            svc.getAll().subscribe(list => {
              expect(list.length).toBe(1);
              expect((mock.add as jasmine.Spy).calls.count()).toBe(1);
              done();
            });
          }
        });
      }
    });
  });

  it('when two submissions race, the loser fetches the winner — one record', (done) => {
    const { svc, mock } = buildService();
    const record = makeExampleRecord();

    svc.createIdempotent(record).subscribe({
      next: (winner) => {
        mock.setRaceTarget(winner.id);
        svc.createIdempotent(record).subscribe({
          next: (loser) => {
            expect(loser.id).toBe(winner.id);
            svc.getAll().subscribe(list => {
              expect(list.length).toBe(1);
              done();
            });
          }
        });
      }
    });
  });

  // ── Production independence ──────────────────────────────────────────────
  it('never reads or writes Production stores', (done) => {
    const { svc, mock } = buildService();
    svc.createIdempotent(makeExampleRecord()).subscribe(() => {
      expect(mock.touchedStores.has(STORE_NAMES.PRODUCTION_SESSIONS)).toBeFalse();
      expect(mock.touchedStores.has(STORE_NAMES.PRODUCTIONS)).toBeFalse();
      done();
    });
  });

  // ── CRUD + in-place update stay intact ───────────────────────────────────
  it('update() edits an existing record in place', (done) => {
    const { svc } = buildService();

    svc.createIdempotent(makeExampleRecord()).subscribe(() => {
      svc.getById('material_sub_sub-ok').subscribe(x => {
        const patched: MaterialRecord = { ...x!, mixCount: 6, updatedAt: NOW };
        svc.update(patched).subscribe(() => {
          svc.getById('material_sub_sub-ok').subscribe(found => {
            expect(found!.mixCount).toBe(6);
            done();
          });
        });
      });
    });
  });

  it('basic create / getAll / getById / delete still work', (done) => {
    const { svc } = buildService();
    const record = makeExampleRecord({ id: 'material_sub_sub-crud', mixCount: 3 });

    svc.createIdempotent(record).subscribe(() => {
      svc.getAll().subscribe(list => {
        expect(list.length).toBe(1);
        svc.delete(record.id).subscribe(() => {
          svc.getById(record.id).subscribe(gone => {
            expect(gone).toBeUndefined();
            done();
          });
        });
      });
    });
  });

});