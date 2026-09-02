import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';

import { OutputReleaseService, OutputReleaseInput } from './output-release.service';
import { StorageService } from './storage.service';
import { STORE_NAMES } from '../constants/storage.constants';
import { OutputRelease } from '../models/output-release.model';
import { Product } from '../models/product.model';
import { Line } from '../models/line.model';
import { ProductionSession } from '../models/production-session.model';

// ─── Master data seeds ────────────────────────────────────────────────────────

const NOW = '2026-01-01T00:00:00.000Z';

const PRODUCTS: Product[] = [
  { id: 'prd-001', name: 'Block 20',  standardStrength: 15, active: true,  createdAt: NOW },
  { id: 'prd-002', name: 'Block 15',  standardStrength: 12, active: true,  createdAt: NOW },
  { id: 'prd-003', name: 'Retired Block', standardStrength: 20, active: false, createdAt: NOW }
];

const LINES: Line[] = [
  { id: 'lin-001', name: 'Line 1 - Heavy',     active: true,  createdAt: NOW },
  { id: 'lin-002', name: 'Line 2 - Standard',  active: true,  createdAt: NOW },
  { id: 'lin-003', name: 'Line 3 - Retired',   active: false, createdAt: NOW }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<OutputReleaseInput>): OutputReleaseInput {
  return {
    releaseDate: '2026-08-29',
    lineId: 'lin-001',
    productId: 'prd-001',
    releasedQuantity: 1000,
    notes: 'Same content test',
    transactionId: 'sub-default',
    ...overrides
  };
}

function makeLegacyRelease(overrides: Partial<OutputRelease>): OutputRelease {
  return {
    id: 'migrated_session_legacy-1',
    releaseDate: '2026-03-22',
    releasedQuantity: 800,
    dataSource: 'LEGACY_AMBIGUOUS_SESSION',
    legacySessionId: 'legacy-1',
    createdAt: '2026-03-22T08:00:00.000Z',
    ...overrides
  };
}

function makeProductionSession(overrides: Partial<ProductionSession> & { id: string }): ProductionSession {
  return {
    date: '2026-08-29',
    shiftId: 'shift-1',
    lineId: 'lin-001',
    supervisor: 'Ahmed',
    releasedOutput: 0,
    overtime: false,
    overtimeHours: 0,
    dailyLineTime: [],
    notes: '',
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
        raceTarget = null; // stale read once → create path chosen
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

describe('OutputReleaseService', () => {

  function buildService(seed?: (mock: any) => void) {
    const mockStorage = createMockStorage();
    mockStorage.seed(STORE_NAMES.PRODUCTS, PRODUCTS);
    mockStorage.seed(STORE_NAMES.LINES, LINES);
    if (seed) seed(mockStorage);

    TestBed.configureTestingModule({
      providers: [
        OutputReleaseService,
        { provide: StorageService, useValue: mockStorage as unknown as StorageService }
      ]
    });
    const svc = TestBed.inject(OutputReleaseService);
    return { svc, mock: mockStorage };
  }

  // ── 1. Exact retry with same submissionId → no duplicate ───────────────────
  it('exact retry with the same submissionId creates ONE output record', (done) => {
    const { svc } = buildService();
    const input = makeInput({ transactionId: 'sub-1' });

    svc.createIdempotent(input).subscribe({
      next: (first) => {
        expect(first.id).toBe('output_sub_sub-1');
        svc.createIdempotent(input).subscribe({
          next: (second) => {
            expect(second.id).toBe(first.id); // idempotent success, same record
            svc.getAll().subscribe(list => {
              expect(list.length).toBe(1);
              done();
            });
          }
        });
      }
    });
  });

  // ── 2. Identical business content, different submissionIds → BOTH persist ──
  it('two NEW submissions with identical content but different submissionIds save BOTH', (done) => {
    const { svc } = buildService();
    const base = { releaseDate: '2026-08-29', lineId: 'lin-001', productId: 'prd-001', releasedQuantity: 1000, notes: 'Same content test' };

    svc.createIdempotent({ ...base, transactionId: 'sub-A' }).subscribe({
      next: () => {
        // A legitimate later entry with byte-identical business fields
        svc.createIdempotent({ ...base, transactionId: 'sub-B' }).subscribe({
          next: () => {
            svc.getAll().subscribe(list => {
              expect(list.length).toBe(2);
              expect(list.find(r => r.id === 'output_sub_sub-A')).toBeDefined();
              expect(list.find(r => r.id === 'output_sub_sub-B')).toBeDefined();
              expect(list.every(r => r.releasedQuantity === 1000)).toBeTrue();
              done();
            });
          }
        });
      }
    });
  });

  // ── 3. Double-click same submission → one record ───────────────────────────
  it('double-click on ONE submission produces exactly ONE record (add called once)', (done) => {
    const { svc, mock } = buildService();
    const input = makeInput({ transactionId: 'sub-click' });

    svc.createIdempotent(input).subscribe({
      next: (first) => {
        svc.createIdempotent(input).subscribe({ // second click of the same attempt
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

  // ── 4. Manual Output missing Line → rejected ───────────────────────────────
  it('rejects a new manual output with a missing Line', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeInput({ transactionId: 'sub-noline', lineId: '' })).subscribe({
      next: () => fail('should reject missing Line'),
      error: (err) => {
        expect(err.message).toMatch(/line is required/i);
        done();
      }
    });
  });

  // ── 5. Manual Output missing Product → rejected ────────────────────────────
  it('rejects a new manual output with a missing Product', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeInput({ transactionId: 'sub-noproduct', productId: '' })).subscribe({
      next: () => fail('should reject missing Product'),
      error: (err) => {
        expect(err.message).toMatch(/product is required/i);
        done();
      }
    });
  });

  // ── 6. Invalid Line ID → rejected ──────────────────────────────────────────
  it('rejects a new manual output referencing a nonexistent Line', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeInput({ transactionId: 'sub-badline', lineId: 'lin-999' })).subscribe({
      next: () => fail('should reject invalid Line'),
      error: (err) => {
        expect(err.message).toMatch(/line not found/i);
        done();
      }
    });
  });

  // ── 7. Invalid Product ID → rejected ───────────────────────────────────────
  it('rejects a new manual output referencing a nonexistent Product', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeInput({ transactionId: 'sub-badproduct', productId: 'prd-999' })).subscribe({
      next: () => fail('should reject invalid Product'),
      error: (err) => {
        expect(err.message).toMatch(/product not found/i);
        done();
      }
    });
  });

  // ── 8. Valid Line + Product → saves ────────────────────────────────────────
  it('saves a new manual output with a valid Line and Product', (done) => {
    const { svc, mock } = buildService();

    svc.createIdempotent(makeInput({ transactionId: 'sub-ok' })).subscribe(record => {
      expect(record.id).toBe('output_sub_sub-ok');
      expect(record.dataSource).toBe('MANUAL_ENTRY');
      expect(record.lineId).toBe('lin-001');
      expect(record.productId).toBe('prd-001');
      expect(record.releaseDate).toBe('2026-08-29');
      expect(record.releasedQuantity).toBe(1000);
      // master references were actually validated before persisting
      expect((mock.getById as jasmine.Spy).calls.allArgs()
        .some(a => a[0] === STORE_NAMES.LINES && a[1] === 'lin-001')).toBeTrue();
      expect((mock.getById as jasmine.Spy).calls.allArgs()
        .some(a => a[0] === STORE_NAMES.PRODUCTS && a[1] === 'prd-001')).toBeTrue();
      done();
    });
  });

  // ── 9. Legacy ambiguous record without productId remains valid/preserved ───
  it('preserves legacy ambiguous releases that have no productId', (done) => {
    const { svc, mock } = buildService(m =>
      m.seed(STORE_NAMES.OUTPUT_RELEASES, [makeLegacyRelease({})])
    );

    svc.getAll().subscribe(list => {
      expect(list.length).toBe(1);
      const legacy = list[0];
      expect(legacy.dataSource).toBe('LEGACY_AMBIGUOUS_SESSION');
      expect(legacy.productId).toBeUndefined();
      expect(legacy.lineId).toBeUndefined();
      expect(legacy.releasedQuantity).toBe(800);
      // untouched: no writes performed on releases
      expect((mock.add as jasmine.Spy).calls.count()).toBe(0);
      expect((mock.update as jasmine.Spy).calls.count()).toBe(0);
      done();
    });
  });

  // ── 10. Output Product may differ from current Production Product ─────────
  it('allows releasing Product B while Production pressed Product A (closed loop)', (done) => {
    const { svc, mock } = buildService(m =>
      m.seed(STORE_NAMES.PRODUCTION_SESSIONS, [
        makeProductionSession({ id: 'sess-press-A', releasedOutput: 5250 })
      ])
    );

    // Press side produced Block 20 (prd-001); release is for Block 15 (prd-002)
    svc.createIdempotent(makeInput({ transactionId: 'sub-AB', productId: 'prd-002', releasedQuantity: 4000 }))
      .subscribe(record => {
        expect(record.productId).toBe('prd-002'); // released product need not match pressed
        // Production session data is preserved and untouched
        expect(mock.touchedStores.has(STORE_NAMES.PRODUCTION_SESSIONS)).toBeFalse();
        done();
      });
  });

  // ── 11. Output saves without Production today ──────────────────────────────
  it('saves an output release even when there is no Production today', (done) => {
    const { svc, mock } = buildService(); // no production stores seeded

    svc.createIdempotent(makeInput({ transactionId: 'sub-noprod', releasedQuantity: 1200 }))
      .subscribe(record => {
        expect(record.releasedQuantity).toBe(1200);
        expect(mock.touchedStores.has(STORE_NAMES.PRODUCTION_SESSIONS)).toBeFalse();
        done();
      });
  });

  // ── 12. Production stores remain untouched ─────────────────────────────────
  it('never reads, writes, or auto-creates Production records', (done) => {
    const { svc, mock } = buildService();

    svc.createIdempotent(makeInput({ transactionId: 'sub-only' })).subscribe(() => {
      expect(mock.touchedStores.has(STORE_NAMES.PRODUCTION_SESSIONS)).toBeFalse();
      expect(mock.touchedStores.has(STORE_NAMES.PRODUCTIONS)).toBeFalse();
      const addCalls = (mock.add as jasmine.Spy).calls.all();
      addCalls.forEach(call => {
        expect(call.args[0]).toBe(STORE_NAMES.OUTPUT_RELEASES);
      });
      done();
    });
  });

  // ── Validation extras ───────────────────────────────────────────────────────

  it('rejects releasedQuantity = 0', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeInput({ transactionId: 'sub-zero', releasedQuantity: 0 })).subscribe({
      next: () => fail('should not save zero quantity'),
      error: (err) => {
        expect(err.message).toMatch(/greater than zero|positive/i);
        done();
      }
    });
  });

  it('rejects a negative releasedQuantity', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeInput({ transactionId: 'sub-neg', releasedQuantity: -50 })).subscribe({
      next: () => fail('should not save negative quantity'),
      error: (err) => {
        expect(err.message).toMatch(/greater than zero|positive/i);
        done();
      }
    });
  });

  it('rejects a missing release date', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeInput({ transactionId: 'sub-date', releaseDate: ('' as any) })).subscribe({
      next: () => fail('should not save without a date'),
      error: (err) => {
        expect(err.message).toMatch(/date/i);
        done();
      }
    });
  });

  it('rejects a missing submissionId', (done) => {
    const { svc } = buildService();
    svc.createIdempotent(makeInput({ transactionId: ('' as any) })).subscribe({
      next: () => fail('should not save without a transactionId'),
      error: (err) => {
        expect(err.message).toMatch(/submission id is required/i);
        done();
      }
    });
  });

  // ── Inactive master clarification ──────────────────────────────────────────
  it('accepts an existing but INACTIVE master reference (active selection is a UI concern)', (done) => {
    const { svc } = buildService();

    // prd-003 and lin-003 exist in master data but are inactive.
    // Service validates EXISTENCE. The dropdowns surface only active records.
    svc.createIdempotent(makeInput({ transactionId: 'sub-inactive', productId: 'prd-003', lineId: 'lin-003' }))
      .subscribe(record => {
        expect(record.productId).toBe('prd-003');
        expect(record.lineId).toBe('lin-003');
        done();
      });
  });

  // ── Race extras ────────────────────────────────────────────────────────────
  it('when two submissions race, the loser fetches the winner and no duplicate is created', (done) => {
    const { svc, mock } = buildService();
    const input = makeInput({ transactionId: 'sub-race', releasedQuantity: 3000 });

    svc.createIdempotent(input).subscribe({
      next: (winner) => {
        mock.setRaceTarget(winner.id); // force retry down the create path → add() collides
        svc.createIdempotent(input).subscribe({
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

  // ── update() keeps in-place editing ────────────────────────────────────────
  it('update() edits an existing manual entry in place', (done) => {
    const { svc } = buildService();

    svc.createIdempotent(makeInput({ transactionId: 'sub-edit', releasedQuantity: 500 }))
      .subscribe(() => {
        svc.getById('output_sub_sub-edit').subscribe(x => {
          const patched: OutputRelease = { ...x!, releasedQuantity: 550 };
          svc.update(patched).subscribe(() => {
            svc.getById('output_sub_sub-edit').subscribe(found => {
              expect(found!.releasedQuantity).toBe(550);
              expect(found!.dataSource).toBe('MANUAL_ENTRY');
              done();
            });
          });
        });
      });
  });

});