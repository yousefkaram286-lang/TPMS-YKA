import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { QualityService } from './quality.service';
import { SupabaseService } from './supabase.service';
import { ProductService } from './product.service';
import { LineService } from './line.service';
import { QualityTest, QualitySample } from '../models/quality-test.model';
import { Product } from '../models/product.model';
import { Line } from '../models/line.model';
import { QualityCalculationUtil } from '../utils/quality-calculation.util';

// ─── Master data seeds (confirmed three-sample Quality rule) ─────────────────

const NOW = '2026-01-01T00:00:00.000Z';

const PRODUCTS: Product[] = [
  {
    id: 'prd-001', name: 'Block 20', productArea: 300, standardStrength: 180,
    standardHeight: 200, standardWeight: 99, active: true, createdAt: NOW
  },
  {
    id: 'prd-002', name: 'Block 15', productArea: 300, standardStrength: 180,
    standardHeight: 200, standardWeight: 99, active: true, createdAt: NOW
  }
];

const LINES: Line[] = [
  { id: 'lin-001', name: 'Line 1 - Heavy',    active: true, createdAt: NOW },
  { id: 'lin-002', name: 'Line 2 - Standard', active: true, createdAt: NOW }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 54000 kg ÷ 300 cm² = 180 ≥ 180 → PASS (mirrors QualityCalculationUtil). */
function makeSample(overrides: Partial<QualitySample> = {}): QualitySample {
  const evaluation = QualityCalculationUtil.evaluateSample(54000, 300, 180);
  return {
    sampleNumber: 1,
    actualHeight: 200,
    actualWeight: 100,
    load: 54000,
    compression: evaluation.compression as number,
    compressionResult: evaluation.compressionResult,
    heightDifference: QualityCalculationUtil.heightDifference(200, 200),
    weightDifference: QualityCalculationUtil.weightDifference(100, 99),
    ...overrides
  };
}

/** A valid three-sample Quality event: 180 ≥ 180 → PASS on every sample. */
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
    productAreaSnapshot: 300,
    compressionStandardSnapshot: 180,
    standardHeightSnapshot: 200,
    standardWeightSnapshot: 99,
    samples: [
      makeSample({ sampleNumber: 1, actualHeight: 200, actualWeight: 100, load: 54000 }),
      makeSample({ sampleNumber: 2, actualHeight: 201, actualWeight: 100, load: 54000 }),
      makeSample({ sampleNumber: 3, actualHeight: 199, actualWeight: 100, load: 54000 })
    ],
    decisionSource: 'AUTO_CALCULATED',
    createdAt: '2026-08-29T08:00:00.000Z',
    ...overrides
  };
}

/** DB row (snake_case) as Supabase would return it. */
function dbRow(overrides: any = {}): any {
  return {
    id: 'quality_test_sub_qt-ok',
    date: '2026-08-29',
    product_id: 'prd-001',
    product_name: 'Block 20',
    line_id: 'lin-001',
    line_name: 'Line 1 - Heavy',
    test_date: '2026-08-29',
    product_area_snapshot: 300,
    compression_standard_snapshot: 180,
    standard_height_snapshot: 200,
    standard_weight_snapshot: 99,
    production_record_id: null,
    production_date: null,
    notes: null,
    submission_id: 'qt-ok',
    samples: [...makePackedTest().samples!],
    strength: null,
    standard_strength: null,
    load: null,
    compression: null,
    sample: null,
    result: null,
    decision_source: 'AUTO_CALCULATED',
    created_at: '2026-08-29T08:00:00.000Z',
    updated_at: null,
    ...overrides
  };
}

// ─── Mock Supabase client (in-memory store, fluent query builder) ────────────

function sortRows(list: any[], order: { col: string; desc: boolean }): any[] {
  return [...list].sort((x, y) => {
    const a = x[order.col];
    const b = y[order.col];
    if (a == null && b == null) return 0;
    if (a == null) return order.desc ? 1 : -1;
    if (b == null) return order.desc ? -1 : 1;
    return order.desc ? String(b).localeCompare(String(a)) : String(a).localeCompare(String(b));
  });
}

function createSupabaseMock(seed: any[] = []) {
  const store = new Map<string, any>();
  const touched = new Set<string>();
  seed.forEach(r => store.set(r.id, { ...r }));
  let conflictOnce = false;

  const matches = (row: any, filters: { col: string; val: any }[]): boolean =>
    filters.every(f => row[f.col] === f.val);

  const builder = (
    table: string
  ): any => {
    const b = {
      columns: '*',
      filters: [] as { col: string; val: any }[],
      orderInfo: null as { col: string; desc: boolean } | null,
      singleFlag: false,
      op: 'select' as 'select' | 'insert' | 'update' | 'delete',
      payload: null as any,
      table,

      select() { return this; },
      eq(col: string, val: any) { this.filters.push({ col, val }); return this; },
      order(col: string, opts?: { ascending?: boolean }) { this.orderInfo = { col, desc: opts?.ascending === false }; return this; },
      single() { this.singleFlag = true; return this; },
      insert(p: any) { this.op = 'insert'; this.payload = p; return this; },
      update(p: any) { this.op = 'update'; this.payload = p; return this; },
      delete() { this.op = 'delete'; return this; },

      execute(): Promise<{ data: any; error: any }> {
        if (this.table !== 'quality_tests') {
          return Promise.resolve({ data: null, error: { code: '42P01', message: `relation "${this.table}" does not exist` } });
        }
        const list = [...store.values()].filter(r => matches(r, this.filters));

        if (this.op === 'select') {
          if (this.singleFlag) {
            if (list.length === 0) {
              return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } });
            }
            const data = this.orderInfo ? sortRows(list, this.orderInfo)[0] : list[0];
            return Promise.resolve({ data: { ...data }, error: null });
          }
          const data = this.orderInfo ? sortRows(list, this.orderInfo) : list;
          return Promise.resolve({ data: data.map(r => ({ ...r })), error: null });
        }

        if (this.op === 'insert') {
          const row = { ...this.payload, id: this.payload.id };
          if (conflictOnce) {
            conflictOnce = false;
            store.set(row.id, row); // a concurrent writer saved the same id
            return Promise.resolve({ data: null, error: { code: '23505', message: `duplicate key value violates unique constraint on ${this.table}` } });
          }
          if (store.has(row.id)) {
            return Promise.resolve({ data: null, error: { code: '23505', message: `duplicate key value violates unique constraint on ${this.table}` } });
          }
          store.set(row.id, row);
          return Promise.resolve({ data: { ...row }, error: null });
        }

        if (this.op === 'update') {
          const match = list[0];
          if (!match) {
            return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'no rows matched' } });
          }
          const updated = { ...match, ...this.payload };
          store.set(updated.id, updated);
          return Promise.resolve({ data: { ...updated }, error: null });
        }

        if (this.op === 'delete') {
          list.forEach(r => store.delete(r.id));
          return Promise.resolve({ data: null, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      },

      then(resolve: (v: any) => any, reject: (e: any) => any) {
        return this.execute().then(r => resolve(r), (e: any) => reject(e));
      }
    };
    return b;
  };

  return {
    store,
    touched,
    setConflictOnce: () => { conflictOnce = true; },
    client: { from: (table: string) => { touched.add(table); return builder(table); } }
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QualityService (three-sample Compression model, Supabase)', () => {

  function buildService(seed?: (supabaseMock: ReturnType<typeof createSupabaseMock>) => void) {
    const supabaseMock = createSupabaseMock();
    if (seed) seed(supabaseMock);

    TestBed.configureTestingModule({
      providers: [
        QualityService,
        { provide: SupabaseService, useValue: { client: supabaseMock.client } },
        {
          provide: ProductService,
          useValue: {
            getById: jasmine.createSpy('productService.getById').and.callFake(
              (id: string) => of(PRODUCTS.find(p => p.id === id))
            )
          }
        },
        {
          provide: LineService,
          useValue: {
            getById: jasmine.createSpy('lineService.getById').and.callFake(
              (id: string) => of(LINES.find(l => l.id === id))
            )
          }
        }
      ]
    });
    const svc = TestBed.inject(QualityService);
    return { svc, mock: supabaseMock };
  }

  // ── QUAL-BIZ-11: valid event persists all 3 samples + snapshots ─────────
  it('QUAL-BIZ-11: a valid 3-sample event is persisted with every sample measured independently', (done) => {
    const { svc, mock } = buildService();
    svc.createIdempotent(makePackedTest()).subscribe(saved => {
      expect(saved.id).toBe('quality_test_sub_qt-ok');
      expect(saved.samples!.length).toBe(3);
      expect(saved.samples!.every(s => s.compressionResult === 'PASS')).toBeTrue();
      expect(saved.productAreaSnapshot).toBe(300);
      expect(saved.compressionStandardSnapshot).toBe(180);
      expect(mock.store.size).toBe(1);
      done();
    });
  });

  // ── QUAL-BIZ-12: exactly 3 samples enforced ─────────────────────────────
  it('QUAL-BIZ-12: an event with anything other than 3 samples is rejected', (done) => {
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

  // ── QUAL-BIZ-13: required fields ─────────────────────────────────────────
  it('QUAL-BIZ-13: Test Date, Line, Product and per-sample Height / Weight / Load > 0 are required', (done) => {
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

  // ── QUAL-BIZ-14: per-sample results are independent, no overall result ───
  it('QUAL-BIZ-14: per-sample results are stored independently and no overall result is fabricated', (done) => {
    const { svc } = buildService();
    const record = makePackedTest();
    record.samples = [
      makeSample({ sampleNumber: 1, actualHeight: 205, actualWeight: 110, load: 75280, compression: 250.93, compressionResult: 'PASS' }),
      makeSample({ sampleNumber: 2, actualHeight: 210, actualWeight: 112, load: 74510, compression: 248.37, compressionResult: 'PASS' }),
      makeSample({ sampleNumber: 3, actualHeight: 208, actualWeight: 109, load: 43976, compression: 146.59, compressionResult: 'FAIL' })
    ];
    // The UI submits per-sample compression results only — no overall `result`.
    expect(record.result).toBeUndefined();
    svc.createIdempotent(record).subscribe(saved => {
      expect(saved.samples![0].compressionResult).toBe('PASS');
      expect(saved.samples![1].compressionResult).toBe('PASS');
      expect(saved.samples![2].compressionResult).toBe('FAIL');
      expect(saved.result).toBeUndefined();
      done();
    });
  });

  // ── QUAL-BIZ-15: CONFIGURATION_REQUIRED never fabricates PASS/FAIL ───────
  it('QUAL-BIZ-15: config-incomplete samples (CONFIGURATION_REQUIRED) are rejected — no PASS/FAIL fabricated', (done) => {
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

  it('QUAL-BIZ-15b: PENDING / unassessed samples are rejected', (done) => {
    const { svc } = buildService();
    const record = makePackedTest();
    record.samples = record.samples!.map((s, i) => makeSample({
      sampleNumber: i + 1, compression: 180, compressionResult: 'PENDING' as QualitySample['compressionResult']
    }));
    svc.createIdempotent(record).subscribe({
      next: () => fail('should have rejected PENDING sample'),
      error: (e) => {
        expect(e.message).toContain('Sample 1 Compression result could not be calculated');
        done();
      }
    });
  });

  it('QUAL-BIZ-15c: missing Product Area snapshot is rejected before persist', (done) => {
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

  it('QUAL-BIZ-15d: missing Compression Standard snapshot is rejected before persist', (done) => {
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

  // ── QUAL-BIZ-16: unknown master references rejected ──────────────────────
  it('QUAL-BIZ-16: unknown Line is rejected before persist', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makePackedTest({ lineId: 'lin-999', lineName: '' })).subscribe({
      next: () => fail('should have rejected unknown line'),
      error: (e) => {
        expect(e.message).toContain('Line not found: lin-999');
        done();
      }
    });
  });

  it('QUAL-BIZ-16b: unknown Product is rejected before persist', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makePackedTest({ productId: 'prd-999', productName: 'Ghost' })).subscribe({
      next: () => fail('should have rejected unknown product'),
      error: (e) => {
        expect(e.message).toContain('Product not found: prd-999');
        done();
      }
    });
  });

  // ── QUAL-BIZ-17: snapshots survive master changes ────────────────────────
  it('QUAL-BIZ-17: reads never recompute snapshots — historical values stay even after the master changed', (done) => {
    const { svc, mock } = buildService();
    // Record created EARLIER under the old master.
    mock.store.set('quality_test_sub_qt-ok', dbRow({
      product_area_snapshot: 300,
      compression_standard_snapshot: 180,
      standard_height_snapshot: 200,
      standard_weight_snapshot: 99
    }));
    // Product master changed AFTER the test was saved (mock ProductService provides
    // 300/180/200/99 in PRODUCTS but the point is the read path never consults it).

    svc.getById('quality_test_sub_qt-ok').subscribe(rec => {
      expect(rec!.productAreaSnapshot).toBe(300);
      expect(rec!.compressionStandardSnapshot).toBe(180);
      expect(rec!.standardHeightSnapshot).toBe(200);
      expect(rec!.standardWeightSnapshot).toBe(99);
      expect(rec!.samples![0].compression).toBe(180); // never recomputed from master
      done();
    });
  });

  // ── QUAL-BIZ-18: idempotency ─────────────────────────────────────────────
  it('QUAL-BIZ-18: retrying the same submission returns the same record without duplicating', (done) => {
    const { svc, mock } = buildService();
    const record = makePackedTest();

    svc.createIdempotent(record).subscribe(first => {
      svc.createIdempotent(makePackedTest()).subscribe(second => {
        expect(second.id).toBe(first.id);
        expect(mock.store.size).toBe(1);
        done();
      });
    });
  });

  it('QUAL-BIZ-18b: identical content with different submission ids persists both records', (done) => {
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

  it('QUAL-BIZ-18c: a duplicate-key race resolves to the existing record, never a double-insert', (done) => {
    const { svc, mock } = buildService();
    mock.setConflictOnce();
    const record = makePackedTest();
    record.id = 'quality_test_sub_qt-race';
    record.submissionId = 'qt-race';

    svc.createIdempotent(record).subscribe(saved => {
      // probe missed; insert collided (23505) but the concurrent row landed;
      // getById then returned the existing row.
      expect(saved.id).toBe('quality_test_sub_qt-race');
      expect(mock.store.size).toBe(1);
      done();
    });
  });

  // ── QUAL-BIZ-19: snake_case ↔ camelCase round-trip ───────────────────────
  it('QUAL-BIZ-19: getAll maps DB snake_case rows back to camelCase model', (done) => {
    const { svc, mock } = buildService();
    mock.store.set('legacy-row', dbRow({ id: 'legacy-row', test_date: '2026-08-28' }));
    svc.getAll().subscribe(list => {
      const legacy = list.find(t => t.id === 'legacy-row');
      expect(legacy).toBeDefined();
      expect(legacy!.testDate).toBe('2026-08-28');
      expect(legacy!.productId).toBe('prd-001');
      expect(legacy!.productName).toBe('Block 20');
      expect((legacy as any).product_id).toBeUndefined();
      done();
    });
  });

  // ── QUAL-BIZ-20: production reference optional; legacy read-only keep ────
  it('QUAL-BIZ-20: a quality test saves without any production reference, and legacy refs map back read-only', (done) => {
    const { svc, mock } = buildService();
    mock.store.set('legacy-prod-ref', dbRow({
      id: 'legacy-prod-ref',
      production_record_id: 'PR-000123',
      production_date: '2026-08-27'
    }));

    const record = makePackedTest();
    delete record.productionRecordId;
    delete record.productionDate;
    svc.createIdempotent(record).subscribe(saved => {
      expect(saved.productionRecordId).toBeUndefined();
      expect(saved.productionDate).toBeUndefined();

      svc.getById('legacy-prod-ref').subscribe(legacy => {
        expect(legacy!.productionRecordId).toBe('PR-000123');
        expect(legacy!.productionDate).toBe('2026-08-27');
        done();
      });
    });
  });

  // ── Isolation: quality persistence touches only the quality table ────────
  it('regression 10: saving a quality test never touches productions or outputs tables', (done) => {
    const { svc, mock } = buildService();
    svc.createIdempotent(makePackedTest()).subscribe(() => {
      expect(mock.touched.has('quality_tests')).toBeTrue();
      expect(mock.touched.has('productions')).toBeFalse();
      expect(mock.touched.has('output_releases')).toBeFalse();
      done();
    });
  });

  // ── Regression: area snapshot drives compression ──────────────────────────
  it('regression 3+7: the stored Area snapshot is the source of truth for Compression', (done) => {
    const { svc } = buildService();
    const record = makePackedTest();
    record.productAreaSnapshot = 300;
    record.samples = record.samples!.map((s, i) =>
      makeSample({ sampleNumber: i + 1, load: 54000, compression: 180, compressionResult: 'PASS' })
    );
    svc.createIdempotent(record).subscribe(saved => {
      expect(saved.productAreaSnapshot).toBe(300);
      expect(saved.samples![0].compression).toBe(180); // 54000 ÷ 300
      done();
    });
  });

  it('calculateCompression delegates to the authoritative Load ÷ Area rule', () => {
    const { svc } = buildService();
    expect(svc.calculateCompression(54000, 300)).toBe(180);
    expect(svc.calculateCompression(62000, 436.32)).toBeCloseTo(142.1, 2);
    expect(svc.calculateCompression(54000, 0)).toBeUndefined();
    expect(svc.calculateCompression(0, 300)).toBeUndefined();
  });
});