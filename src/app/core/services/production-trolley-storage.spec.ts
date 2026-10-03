// ============================================================
// TPMS — Trolley Storage Mapping & Downstream Totals
// ------------------------------------------------------------
// Covers the persistence contract of the trolley feature:
//   * trolley_count / presses_per_trolley round-trip through the
//     productions table mapper in both snake_case and camelCase.
//   * A missing trolley count is stored as NULL, never as 0.
//   * Dashboard aggregation totals fractional presses/produced
//     without truncation or rounding.
// ============================================================
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ProductionService, ProductionRecordInput } from '../../core/services/production.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { FakeSupabaseClient } from '../../core/testing/fake-supabase.client';
import { DashboardService } from '../../core/services/dashboard.service';
import { MaterialsService } from '../../core/services/materials.service';
import { MaterialService } from '../../core/services/material.service';
import { OutputReleaseService } from '../../core/services/output-release.service';
import { QualityService } from '../../core/services/quality.service';
import { ProductService } from '../../core/services/product.service';
import { ShiftService } from '../../core/services/shift.service';
import { LineService } from '../../core/services/line.service';
import { UnitCostService } from '../../core/services/unit-cost.service';
import { ProductionSessionService } from '../../core/services/production-session.service';
import { Production } from '../../core/models/production.model';
import { TrolleyUtil, PRESSES_PER_TROLLEY } from '../../core/utils/trolley.util';

class FakeSupabaseService {
  client = new FakeSupabaseClient({});
}

/** Exposes the private mappers so both directions can be asserted. */
class TestableProductionService extends ProductionService {
  toModel(row: any): Production {
    return (this as any).mapToModel(row);
  }
  toDb(production: Production): any {
    return (this as any).mapToDb(production);
  }
}

function baseRecord(overrides: Partial<Production> = {}): Production {
  return {
    id: 'r1', date: '2026-09-29', shiftId: '', lineId: 'lin-001', productId: 'p1',
    supervisor: 'Ahmed', piecesPerPress: 10, presses: 420, produced: 4200,
    createdAt: '2026-09-29T08:00:00Z',
    ...overrides
  };
}

function inputFor(overrides: Partial<ProductionRecordInput> = {}): ProductionRecordInput {
  return {
    id: 'r1', date: '2026-09-29', shiftId: '', lineId: 'lin-001', productId: 'p1',
    supervisor: 'Ahmed', piecesPerPress: 10, presses: 420,
    createdAt: '2026-09-29T08:00:00Z',
    ...overrides
  };
}

describe('ProductionService — trolley storage mapping', () => {
  let service: TestableProductionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useClass: FakeSupabaseService },
        { provide: ProductionService, useClass: TestableProductionService }
      ]
    });
    service = TestBed.inject(ProductionService) as unknown as TestableProductionService;
  });

  describe('record construction', () => {
    it('derives Presses from the trolley count and snapshots the factor of 14', () => {
      const record = service.createProductionRecord(inputFor({ trolleyCount: 30 }));
      expect(record.trolleyCount).toBe(30);
      expect(record.pressesPerTrolley).toBe(PRESSES_PER_TROLLEY);
      expect(record.presses).toBe(420);
      expect(record.produced).toBe(4200);
    });

    it('derives whole presses from a half-trolley decimal', () => {
      const record = service.createProductionRecord(inputFor({ trolleyCount: 30.5 }));
      expect(record.presses).toBe(427);
      expect(record.trolleyCount).toBe(30.5);
      expect(record.produced).toBe(4270);
      expect(Number.isInteger(record.presses)).toBeTrue();
    });

    it('rejects a trolley count that is not a multiple of 0.5', () => {
      for (const trolleys of [0.25, 0.75, 1.25, 30.25]) {
        expect(() => service.createProductionRecord(inputFor({ trolleyCount: trolleys })))
          .withContext(String(trolleys))
          .toThrowError(/multiple of 0\.5/i);
      }
    });

    it('accepts 0, 1 and 1.5 trolleys as valid whole-press sessions', () => {
      const zero = service.createProductionRecord(inputFor({ trolleyCount: 0 }));
      expect(zero.presses).toBe(0);
      expect(zero.produced).toBe(0);
      expect(zero.trolleyCount).toBe(0);

      const one = service.createProductionRecord(inputFor({ trolleyCount: 1 }));
      expect(one.presses).toBe(14);

      const oneAndAHalf = service.createProductionRecord(inputFor({ trolleyCount: 1.5 }));
      expect(oneAndAHalf.presses).toBe(21);
      expect(oneAndAHalf.trolleyCount).toBe(1.5);
    });

    it('ignores a caller-supplied presses value when a trolley count is present', () => {
      const record = service.createProductionRecord(inputFor({ trolleyCount: 0.5, presses: 999 }));
      expect(record.presses).toBe(7);
    });

    it('omits trolley fields entirely for a manual-presses record', () => {
      const record = service.createProductionRecord(inputFor({ presses: 150 }));
      expect(record.trolleyCount).toBeUndefined();
      expect(record.pressesPerTrolley).toBeUndefined();
      expect(record.presses).toBe(150);
    });

    it('rejects a negative trolley count', () => {
      expect(() => service.createProductionRecord(inputFor({ trolleyCount: -3 }))).toThrow();
      expect(() => service.createProductionRecord(inputFor({ trolleyCount: -0.5 }))).toThrow();
    });

    it('rejects a non-numeric trolley count', () => {
      expect(() => service.createProductionRecord(inputFor({ trolleyCount: 'abc' as unknown as number }))).toThrow();
      expect(() => service.createProductionRecord(inputFor({ trolleyCount: '30.5x' as unknown as number }))).toThrow();
      expect(() => service.createProductionRecord(inputFor({ trolleyCount: NaN }))).toThrow();
      expect(() => service.createProductionRecord(inputFor({ trolleyCount: Infinity }))).toThrow();
    });

    it('treats a null trolley count as "not entered", i.e. a manual-presses record', () => {
      // null means the operator never used the Trolley flow, so the existing
      // manual Presses behaviour applies; it is not a Trolley Count of 0.
      const record = service.createProductionRecord(inputFor({ trolleyCount: null, presses: 150 }));
      expect(record.trolleyCount).toBeUndefined();
      expect(record.pressesPerTrolley).toBeUndefined();
      expect(record.presses).toBe(150);
    });
  });

  describe('model -> database mapping', () => {
    it('writes trolley_count and presses_per_trolley columns', () => {
      const db = service.toDb(baseRecord({ trolleyCount: 30.5, pressesPerTrolley: 14, presses: 427, produced: 4270 }));
      expect(db.trolley_count).toBe(30.5);
      expect(db.presses_per_trolley).toBe(14);
      expect(db.presses).toBe(427);
      expect(db.produced).toBe(4270);
    });

    it('writes 0 (not NULL) for a zero-trolley session', () => {
      // 0 is a real trolley count. Writing NULL here would lose the distinction
      // between "line stopped, produced nothing" and "not captured in trolleys".
      const db = service.toDb(baseRecord({ trolleyCount: 0, pressesPerTrolley: 14, presses: 0, produced: 0 }));
      expect(db.trolley_count).toBe(0);
      expect(db.presses_per_trolley).toBe(14);
      expect(db.presses).toBe(0);
      expect(db.produced).toBe(0);
    });

    it('writes NULL — not 0 — for a record with no trolley data', () => {
      const db = service.toDb(baseRecord());
      expect(db.trolley_count).toBeNull();
      expect(db.presses_per_trolley).toBeNull();
    });
  });

  describe('database -> model mapping', () => {
    it('reads trolley_count and presses_per_trolley back into the model', () => {
      const model = service.toModel({
        id: 'r1', date: '2026-09-29', shift_id: '', line_id: 'lin-001', product_id: 'p1',
        supervisor: 'Ahmed', pieces_per_press: 10.5, presses: 427, produced: 4483.5,
        trolley_count: 30.5, presses_per_trolley: 14,
        created_at: '2026-09-29T08:00:00Z'
      });
      expect(model.trolleyCount).toBe(30.5);
      expect(model.pressesPerTrolley).toBe(14);
      expect(model.presses).toBe(427);
      expect(model.produced).toBe(4483.5);
    });

    it('reads a zero-trolley row back as 0, not as missing trolley data', () => {
      const model = service.toModel({
        id: 'r0', date: '2026-09-29', shift_id: '', line_id: 'lin-001', product_id: 'p1',
        supervisor: 'Ahmed', pieces_per_press: 10.5, presses: 0, produced: 0,
        trolley_count: 0, presses_per_trolley: 14,
        created_at: '2026-09-29T08:00:00Z'
      });
      expect(model.trolleyCount).toBe(0);
      expect(model.pressesPerTrolley).toBe(14);
      expect(model.presses).toBe(0);
      expect(model.produced).toBe(0);
      expect(TrolleyUtil.hasTrolleyData(model)).toBeTrue();
    });

    it('leaves trolley fields undefined for a legacy row (NULL columns)', () => {
      const model = service.toModel({
        id: 'r1', date: '2026-01-05', shift_id: '', line_id: 'lin-001', product_id: 'p1',
        supervisor: 'Ahmed', pieces_per_press: 10, presses: 300, produced: 3000,
        trolley_count: null, presses_per_trolley: null,
        created_at: '2026-01-05T08:00:00Z'
      });
      expect(model.trolleyCount).toBeUndefined();
      expect(model.pressesPerTrolley).toBeUndefined();
      expect(model.presses).toBe(300);
      expect(model.produced).toBe(3000);
    });

    it('treats a row with no trolley columns at all as legacy (pre-migration rows)', () => {
      const model = service.toModel({
        id: 'r1', date: '2026-01-05', shift_id: '', line_id: 'lin-001', product_id: 'p1',
        supervisor: 'Ahmed', pieces_per_press: 10, presses: 300, produced: 3000,
        created_at: '2026-01-05T08:00:00Z'
      });
      expect(model.trolleyCount).toBeUndefined();
      expect(model.pressesPerTrolley).toBeUndefined();
    });
  });
});

describe('Dashboard totals with trolley-derived whole presses and fractional Produced', () => {
  let dashboard: DashboardService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ProductionService, useValue: { getAll: () => of([]) } },
        { provide: ProductionSessionService, useValue: { getAll: () => of([]) } },
        { provide: MaterialsService, useValue: { getAll: () => of([]) } },
        { provide: MaterialService, useValue: { getAll: () => of([]) } },
        { provide: OutputReleaseService, useValue: { getAll: () => of([]) } },
        { provide: QualityService, useValue: { getAll: () => of([]) } },
        { provide: ProductService, useValue: { getAll: () => of([]) } },
        { provide: ShiftService, useValue: { getAll: () => of([]) } },
        { provide: LineService, useValue: { getAll: () => of([]) } },
        { provide: UnitCostService, useValue: { getAll: () => of([]) } },
      ]
    });
    dashboard = TestBed.inject(DashboardService);
  });

  /**
   * calcStats reduces over every production-derived collection, so all of them
   * must be present. Only `productions` varies per test.
   */
  function dashboardData(productions: Production[]): any {
    return {
      productions, sessions: [], materials: [], qualityTests: [],
      releases: [], products: [], shifts: [], lines: [],
      materialsMaster: [], unitCostsMaster: []
    };
  }

  it('sums fractional produced totals without rounding', () => {
    const stats = dashboard.calcStats(dashboardData([
      baseRecord({ id: 'a', presses: 427, produced: 4483.5, trolleyCount: 30.5, pressesPerTrolley: 14 }),
      baseRecord({ id: 'b', presses: 7, produced: 73.5, trolleyCount: 0.5, pressesPerTrolley: 14 }),
    ]));

    expect(stats.totalProduction).toBe(4557);
  });

  it('keeps a lone fractional produced value exact', () => {
    const stats = dashboard.calcStats(dashboardData([
      baseRecord({ presses: 427, produced: 317.625, trolleyCount: 30.5, pressesPerTrolley: 14 })
    ]));

    expect(stats.totalProduction).toBe(317.625);
  });

  it('keeps a zero-trolley session in the total and reports zero presses', () => {
    const stats = dashboard.calcStats(dashboardData([
      baseRecord({ id: 'z', presses: 0, produced: 0, trolleyCount: 0, pressesPerTrolley: 14 }),
      baseRecord({ id: 'a', presses: 427, produced: 4270, trolleyCount: 30.5, pressesPerTrolley: 14 }),
    ]));

    // The stopped line adds 0, so the total is unchanged but nothing is lost.
    expect(stats.totalProduction).toBe(4270);
  });

  it('does not alter a whole-number Line 3 total', () => {
    const stats = dashboard.calcStats(dashboardData([
      baseRecord({ id: 'x', lineId: 'lin-003', presses: 420, produced: 4200 })
    ]));

    expect(stats.totalProduction).toBe(4200);
  });

  it('returns a Line 1 record to its original total after removal', () => {
    const qaRecord = baseRecord({
      id: 'qa', lineId: 'lin-001', presses: 427, produced: 4483.5,
      trolleyCount: 30.5, pressesPerTrolley: 14
    });
    const originals = [baseRecord({ id: 'a', presses: 420, produced: 4200 })];

    const before = dashboard.calcStats(dashboardData(originals)).totalProduction;
    const during = dashboard.calcStats(dashboardData([...originals, qaRecord])).totalProduction;
    const after = dashboard.calcStats(dashboardData(originals)).totalProduction;

    expect(before).toBe(4200);
    expect(during).toBe(8683.5);
    expect(after).toBe(before);
  });
});
