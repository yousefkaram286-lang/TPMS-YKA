import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';

import { QualityService } from './quality.service';
import { StorageService } from './storage.service';
import { STORE_NAMES } from '../constants/storage.constants';
import { QualityTest, QualitySample } from '../models/quality-test.model';
import { Product } from '../models/product.model';
import { Line } from '../models/line.model';
import { QualityCalculationUtil } from '../utils/quality-calculation.util';

// ─── Master data seeds (confirmed three-sample Quality rule) ─────────────────

const NOW = '2026-01-01T00:00:00.000Z';

const PRODUCTS: Product[] = [
  {
    id: 'prd-001', name: 'Block 20', productArea: 0.2, standardStrength: 15,
    standardHeight: 200, standardWeight: 99, active: true, createdAt: NOW
  },
  {
    id: 'prd-002', name: 'Block 15', productArea: 0.2, standardStrength: 12,
    standardHeight: 200, standardWeight: 99, active: true, createdAt: NOW
  }
];

const LINES: Line[] = [
  { id: 'lin-001', name: 'Line 1 - Heavy',    active: true, createdAt: NOW },
  { id: 'lin-002', name: 'Line 2 - Standard', active: true, createdAt: NOW }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 3.2 kN ÷ 0.2 m² = 16 ≥ 15 → PASS (mirrors QualityCalculationUtil). */
function makeSample(overrides: Partial<QualitySample> = {}): QualitySample {
  const evaluation = QualityCalculationUtil.evaluateSample(3.2, 0.2, 15);
  return {
    sampleNumber: 1,
    actualHeight: 200,
    actualWeight: 100,
    load: 3.2,
    compression: evaluation.compression as number,
    compressionResult: evaluation.compressionResult,
    heightDifference: QualityCalculationUtil.heightDifference(200, 200),
    weightDifference: QualityCalculationUtil.weightDifference(100, 99),
    ...overrides
  };
}

/** A valid three-sample Quality event: 16 ≥ 15 → PASS on every sample. */
function makePackedTest(overrides: Partial<QualityTest> = {}): QualityTest {
  return {
    id: 'quality_test_sub_qt-ok',
    submissionId: 'qt-ok',
    date: '2026-08-29',
    productId: 'prd-001',
    productName: 'Block 20',
    lineId: 'lin-001',
    lineName: 'Line 1 - Heavy',
    testDate: '2026-08-29',
    productAreaSnapshot: 0.2,
    compressionStandardSnapshot: 15,
    standardHeightSnapshot: 200,
    standardWeightSnapshot: 99,
    samples: [
      makeSample({ sampleNumber: 1, actualHeight: 200, actualWeight: 100, load: 3.2 }),
      makeSample({ sampleNumber: 2, actualHeight: 201, actualWeight: 100, load: 3.2 }),
      makeSample({ sampleNumber: 3, actualHeight: 199, actualWeight: 100, load: 3.2 })
    ],
    decisionSource: 'AUTO_CALCULATED',
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

describe('QualityService (three-sample Compression model)', () => {

  function buildService(seed?: (mock: any) => void) {
    const mockStorage = createMockStorage();
    mockStorage.seed(STORE_NAMES.PRODUCTS, PRODUCTS);
    mockStorage.seed(STORE_NAMES.LINES, LINES);
    if (seed) seed(mockStorage);

    TestBed.configureTestingModule({
      providers: [
        QualityService,
        { provide: StorageService, useValue: mockStorage as unknown as StorageService }
      ]
    });
    const svc = TestBed.inject(QualityService);
    return { svc, mock: mockStorage };
  }

  // ── regressions 1-2: event requires Product and Line ────────────────────
  it('regression 1: an event without a Product is rejected', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makePackedTest({ productId: undefined as unknown as string })).subscribe({
      next: () => fail('should have rejected missing product'),
      error: (e) => {
        expect(e.message).toContain('Product is required');
        done();
      }
    });
  });

  it('regression 2: an event without a Line is rejected', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makePackedTest({ lineId: undefined as unknown as string })).subscribe({
      next: () => fail('should have rejected missing line'),
      error: (e) => {
        expect(e.message).toContain('Line is required');
        done();
      }
    });
  });

  // ── regression 4: exactly 3 samples are stored ───────────────────────────
  it('regression 4: exactly 3 independent samples are stored per event', (done) => {
    const { svc, mock } = buildService();
    svc.createIdempotent(makePackedTest()).subscribe(saved => {
      expect(saved.samples!.length).toBe(3);
      expect(mock.stores.get(STORE_NAMES.QUALITY_TESTS)!.size).toBe(1);

      svc.getAll().subscribe(list => {
        expect(list[0].samples!.length).toBe(3);
        expect(list[0].samples!.every(s => s.compressionResult === 'PASS')).toBeTrue();
        done();
      });
    });
  });

  it('an event with anything other than 3 samples is rejected', (done) => {
    const { svc } = buildService();
    const two = makePackedTest();
    two.samples = [makeSample(), makeSample()];
    svc.createIdempotent(two).subscribe({
      next: () => fail('should have rejected 2 samples'),
      error: (e) => {
        expect(e.message).toContain('Exactly 3 samples are required');
        done();
      }
    });
  });

  // ── regression 5: per-sample measurements are independent ────────────────
  it('regression 5: Actual Height / Weight / Load are stored independently per sample', (done) => {
    const { svc } = buildService();
    const record = makePackedTest();
    record.samples = [
      makeSample({ sampleNumber: 1, actualHeight: 205, actualWeight: 110, load: 3.1, compression: 15.5, compressionResult: 'PASS' }),
      makeSample({ sampleNumber: 2, actualHeight: 210, actualWeight: 112, load: 3.08, compression: 15.4, compressionResult: 'PASS' }),
      makeSample({ sampleNumber: 3, actualHeight: 208, actualWeight: 109, load: 2.99, compression: 14.95, compressionResult: 'FAIL' })
    ];

    svc.createIdempotent(record).subscribe(saved => {
      expect(saved.samples![0].actualHeight).toBe(205);
      expect(saved.samples![1].actualWeight).toBe(112);
      expect(saved.samples![2].load).toBe(2.99);
      expect(saved.samples![2].compressionResult).toBe('FAIL');
      // values never bleed between samples
      expect(saved.samples![0].load).toBe(3.1);
      expect(saved.samples![1].actualHeight).toBe(210);
      done();
    });
  });

  // ── regression 3 / 7: Area is a stored snapshot from the master ──────────
  it('regression 3+7: Area snapshot is stored from the Product master and used for Compression', (done) => {
    const { svc } = buildService();
    const record = makePackedTest();
    record.productAreaSnapshot = 0.25;
    record.samples = record.samples!.map((s, i) =>
      makeSample({ sampleNumber: i + 1, load: 4, compression: 16, compressionResult: 'PASS' })
    );

    svc.createIdempotent(record).subscribe(saved => {
      expect(saved.productAreaSnapshot).toBe(0.25);
      expect(saved.samples![0].compression).toBe(16); // 4 ÷ 0.25
      done();
    });
  });

  // ── regressions 6+8: historical snapshots survive master-data changes ───
  it('regression 6+8: later Area / Standard Height / Standard Weight / Compression Standard changes do NOT alter saved tests', (done) => {
    const { svc, mock } = buildService();
    svc.createIdempotent(makePackedTest()).subscribe(saved => {
      expect(saved.productAreaSnapshot).toBe(0.2);
      expect(saved.compressionStandardSnapshot).toBe(15);
      expect(saved.standardHeightSnapshot).toBe(200);
      expect(saved.standardWeightSnapshot).toBe(99);
      expect(saved.samples![0].compression).toBe(16);
      expect(saved.samples![0].compressionResult).toBe('PASS');

      // Business edits the Product master AFTER the test was saved.
      mock.stores.get(STORE_NAMES.PRODUCTS)!.set('prd-001', {
        ...PRODUCTS[0], productArea: 0.5, standardStrength: 999, standardHeight: 999, standardWeight: 999
      });

      svc.getAll().subscribe(list => {
        const rec = list[0];
        expect(rec.productAreaSnapshot).toBe(0.2);        // historical snapshot preserved
        expect(rec.compressionStandardSnapshot).toBe(15);
        expect(rec.standardHeightSnapshot).toBe(200);
        expect(rec.standardWeightSnapshot).toBe(99);
        expect(rec.samples![0].compression).toBe(16);     // never recomputed from master
        expect(rec.samples![0].compressionResult).toBe('PASS');
        done();
      });
    });
  });

  // ── regression 9: invalid master references rejected ─────────────────────
  it('regression 9: unknown Line is rejected before persist', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makePackedTest({ lineId: 'lin-999', lineName: '' })).subscribe({
      next: () => fail('should have rejected unknown line'),
      error: (e) => {
        expect(e.message).toContain('Line not found: lin-999');
        done();
      }
    });
  });

  it('regression 9: unknown Product is rejected before persist', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makePackedTest({ productId: 'prd-999', productName: 'Ghost' })).subscribe({
      next: () => fail('should have rejected unknown product'),
      error: (e) => {
        expect(e.message).toContain('Product not found: prd-999');
        done();
      }
    });
  });

  // ── regression 10: Output/Production stores untouched by quality saves ───
  it('regression 10: saving a quality test never touches Productions or Outputs stores', (done) => {
    const { svc, mock } = buildService();
    svc.createIdempotent(makePackedTest()).subscribe(() => {
      expect(mock.touchedStores.has(STORE_NAMES.QUALITY_TESTS)).toBeTrue();
      expect(mock.touchedStores.has(STORE_NAMES.PRODUCTIONS)).toBeFalse();
      expect(mock.touchedStores.has(STORE_NAMES.OUTPUT_RELEASES)).toBeFalse();
      done();
    });
  });

  // ── regression 11: ProductionRecordId never required ─────────────────────
  it('regression 11: a quality test saves successfully without any production reference', (done) => {
    const { svc } = buildService();
    const record = makePackedTest();
    delete record.productionRecordId;
    delete record.productionDate;

    svc.createIdempotent(record).subscribe(saved => {
      expect(saved.id).toBe('quality_test_sub_qt-ok');
      expect(saved.productionRecordId).toBeUndefined();
      expect(saved.productionDate).toBeUndefined();
      done();
    });
  });

  // ── regression 12: exact retry → no duplicate ─────────────────────────────
  it('regression 12: retrying the same submission returns the same record without duplicating', (done) => {
    const { svc, mock } = buildService();
    const record = makePackedTest();

    svc.createIdempotent(record).subscribe(first => {
      svc.createIdempotent(makePackedTest()).subscribe(second => {
        expect(second.id).toBe(first.id);
        expect(mock.stores.get(STORE_NAMES.QUALITY_TESTS)!.size).toBe(1);
        done();
      });
    });
  });

  // ── regression 13: identical content, different submission ids → both save
  it('regression 13: identical content with different submission ids persists both records', (done) => {
    const { svc, mock } = buildService();
    const a = makePackedTest();
    a.id = 'quality_test_sub_qt-a';
    a.submissionId = 'qt-a';
    const b = {
      ...a,
      id: 'quality_test_sub_qt-b',
      submissionId: 'qt-b',
      samples: a.samples!.map(s => ({ ...s }))
    };

    svc.createIdempotent(a).subscribe(() => {
      svc.createIdempotent(b).subscribe(() => {
        svc.getAll().subscribe(list => {
          expect(list.length).toBe(2);
          expect(list.map(t => t.id).sort()).toEqual(['quality_test_sub_qt-a', 'quality_test_sub_qt-b']);
          done();
        });
      });
    });
  });

  // ── configuration-incomplete never persists a result ─────────────────────
  it('a test whose samples cannot calculate Compression is rejected — no PASS/FAIL is ever fabricated', (done) => {
    const { svc } = buildService();
    const record = makePackedTest();
    record.productAreaSnapshot = undefined;
    record.compressionStandardSnapshot = undefined;
    record.samples = [1, 2, 3].map(n => makeSample({
      sampleNumber: n,
      compression: undefined,
      compressionResult: 'CONFIGURATION_REQUIRED'
    }));

    svc.createIdempotent(record).subscribe({
      next: () => fail('should have rejected config-incomplete record'),
      error: (e) => {
        expect(e.message).toContain('Compression result could not be calculated');
        done();
      }
    });
  });

  it('a multi-sample record with unassessed (PENDING) samples is rejected — result must always be calculated', (done) => {
    const { svc } = buildService();
    const record = makePackedTest();
    record.samples = record.samples!.map((s, i) => makeSample({
      sampleNumber: i + 1, compression: 16, compressionResult: 'PENDING' as QualitySample['compressionResult']
    }));

    svc.createIdempotent(record).subscribe({
      next: () => fail('should have rejected PENDING sample'),
      error: (e) => {
        expect(e.message).toContain('Sample 1 Compression result could not be calculated');
        done();
      }
    });
  });

  it('a record with a missing Product Area snapshot is rejected — Compression cannot be calculated', (done) => {
    const { svc } = buildService();
    const record = makePackedTest();
    record.productAreaSnapshot = undefined;

    svc.createIdempotent(record).subscribe({
      next: () => fail('should have rejected missing Area snapshot'),
      error: (e) => {
        expect(e.message).toContain('Product Area is not configured for this product');
        done();
      }
    });
  });

  it('a record with a missing Compression Standard snapshot is rejected', (done) => {
    const { svc } = buildService();
    const record = makePackedTest();
    record.compressionStandardSnapshot = undefined;

    svc.createIdempotent(record).subscribe({
      next: () => fail('should have rejected missing Standard snapshot'),
      error: (e) => {
        expect(e.message).toContain('Compression Standard is not configured for this product');
        done();
      }
    });
  });

  // ── required-field validation (per-sample) ──────────────────────────────
  it('requires Test Date, Line, Product and per-sample Height / Weight / Load > 0', (done) => {
    const { svc } = buildService();
    const records: Partial<QualityTest>[] = [
      { testDate: null as unknown as string },
      { lineId: undefined as unknown as string },
      { productId: undefined as unknown as string }
    ];
    const messages: string[] = [
      'Test Date is required',
      'Line is required',
      'Product is required'
    ];

    // piecewise record patches — [patchFn, targetSampleNumber, expectedMessage]
    const samplePatches: [(s: QualitySample) => QualitySample, number, string][] = [
      [(s) => ({ ...s, actualHeight: 0 }), 1, 'Sample 1 Actual Height must be greater than zero'],
      [(s) => ({ ...s, actualWeight: -1 }), 2, 'Sample 2 Actual Weight must be greater than zero'],
      [(s) => ({ ...s, load: 0 }), 3, 'Sample 3 Load must be greater than zero']
    ];

    const cases: { record: Partial<QualityTest>; message: string }[] = [
      ...records.map((r, i) => ({ record: r, message: messages[i] })),
      ...samplePatches.map(([fn, target, message]) => ({
        record: {
          samples: [1, 2, 3].map((n) =>
            n === target ? fn(makeSample({ sampleNumber: n })) : makeSample({ sampleNumber: n })
          )
        },
        message
      }))
    ];

    let idx = 0;
    const run = () => {
      if (idx >= cases.length) { done(); return; }
      const { record, message } = cases[idx++];
      svc.createIdempotent(makePackedTest(record)).subscribe({
        next: () => {
          fail(`should have been rejected: ${message}`);
          done();
        },
        error: (e) => {
          try {
            expect(e.message).toContain(message);
          } catch (err) {
            fail(err);
            done();
            return;
          }
          run();
        }
      });
    };
    run();
  });

  it('calculateCompression delegates to the authoritative Load ÷ Area rule', () => {
    const { svc } = buildService();
    expect(svc.calculateCompression(3.2, 0.2)).toBe(16);
    expect(svc.calculateCompression(2.0, 0.25)).toBe(8);
    expect(svc.calculateCompression(3.2, 0)).toBeUndefined();
    expect(svc.calculateCompression(0, 0.2)).toBeUndefined();
  });
});