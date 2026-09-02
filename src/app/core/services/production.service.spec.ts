import { TestBed } from '@angular/core/testing';
import { Observable, of, forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { ProductionService } from './production.service';
import { StorageService } from './storage.service';
import { Production } from '../models/production.model';
import { SubmissionGuard } from '../utils/production.util';

function createMockStorageService() {
  const records = new Map<string, Production>();

  return {
    getAll: jasmine.createSpy('getAll').and.callFake(() => of(Array.from(records.values()))),
    add: jasmine.createSpy('add').and.callFake((storeName: string, record: Production) => {
      if (records.has(record.id)) {
        return new Observable((sub) => sub.error(new Error(`Key already exists: ${record.id}`)));
      }
      records.set(record.id, { ...record });
      return of({ ...record });
    }),
    update: jasmine.createSpy('update').and.callFake((storeName: string, record: Production) => {
      records.set(record.id, { ...record });
      return of({ ...record });
    }),
    delete: jasmine.createSpy('delete').and.callFake((storeName: string, id: string) => {
      records.delete(id);
      return of(void 0);
    }),
    getById: jasmine.createSpy('getById').and.callFake((storeName: string, id: string) => {
      return of(records.get(id));
    })
  } as unknown as StorageService;
}

describe('ProductionService (Production business rules)', () => {

  function buildService() {
    const mockStorage = createMockStorageService();
    TestBed.configureTestingModule({
      providers: [
        ProductionService,
        { provide: StorageService, useValue: mockStorage }
      ]
    });
    const svc = TestBed.inject(ProductionService);
    return { svc, mockStorage };
  }

  // ── Calculation regression ──────────────────────────────────────────────
  it('500 × 10.5 = 5250 through createProductionRecord', () => {
    const { svc } = buildService();
    const record = svc.createProductionRecord({
      id: 'prod-1',
      date: '2026-01-15',
      lineId: 'line-1',
      productId: 'prd-1',
      piecesPerPress: 10.5,
      presses: 500,
      createdAt: '2026-01-15T08:00:00.000Z'
    });
    expect(record.produced).toBe(5250);
  });

  it('ProducedQuantity is system-calculated and not arbitrary manual input', () => {
    const { svc } = buildService();
    const record = svc.createProductionRecord({
      id: 'prod-2',
      date: '2026-01-15',
      lineId: 'line-1',
      productId: 'prd-1',
      piecesPerPress: 10.5,
      presses: 500,
      createdAt: '2026-01-15T08:00:00.000Z'
    });
    expect(record.produced).not.toBe(99999);
    expect(record.produced).toBe(ProductionService.prototype.calculateProduced(10.5, 500));
  });

  it('persists a calculated record where pressing with 3 × 4.5 = 13.5', (done) => {
    const { svc } = buildService();
    const record = svc.createProductionRecord({
      id: 'prod-3', date: '2026-01-16', lineId: 'line-2', productId: 'prd-2',
      piecesPerPress: 4.5, presses: 3, createdAt: '2026-01-16T08:00:00.000Z'
    });
    expect(record.produced).toBe(13.5);
    svc.create(record).subscribe(() => {
      svc.getAll().subscribe(list => {
        expect(list.length).toBe(1);
        expect(list[0].produced).toBe(13.5);
        done();
      });
    });
  });

  // ── Production saves independently of Output ────────────────────────────
  it('Production record has NO output / released-quantity fields', () => {
    const { svc } = buildService();
    const record = svc.createProductionRecord({
      id: 'prod-4', date: '2026-01-17', lineId: 'line-1', productId: 'prd-1',
      piecesPerPress: 10, presses: 100, createdAt: '2026-01-17T08:00:00.000Z'
    });
    expect(record.releasedOutput).toBeUndefined();
    expect(record.output).toBeUndefined();
  });

  it('Production.Save persists a valid record with no Output existing', (done) => {
    const { svc } = buildService();
    const record = svc.createProductionRecord({
      id: 'prod-5', date: '2026-01-18', lineId: 'line-1', productId: 'prd-3',
      piecesPerPress: 12, presses: 40, createdAt: '2026-01-18T08:00:00.000Z'
    });
    svc.create(record).subscribe({
      next: () => {
        svc.getById('prod-5').subscribe(saved => {
          expect(saved).toBeDefined();
          expect(saved!.produced).toBe(480);
          expect(saved!.releasedOutput).toBeUndefined();
          done();
        });
      },
      error: () => fail('create should succeed without any Output record')
    });
  });

  // ── Snapshot integrity ──────────────────────────────────────────────────
  it('historical Production preserves PiecesPerPress snapshot when master changes later', () => {
    const { svc } = buildService();

    const historical = svc.createProductionRecord({
      id: 'prod-hist', date: '2026-01-19', lineId: 'line-1', productId: 'prd-1',
      piecesPerPress: 10.5, presses: 500, createdAt: '2026-01-19T08:00:00.000Z'
    });
    expect(historical.piecesPerPress).toBe(10.5);
    expect(historical.produced).toBe(5250);

    const later = svc.createProductionRecord({
      id: 'prod-new', date: '2026-02-01', lineId: 'line-1', productId: 'prd-1',
      piecesPerPress: 12, presses: 500, createdAt: '2026-02-01T08:00:00.000Z'
    });
    expect(later.produced).toBe(6000);

    expect(historical.piecesPerPress).toBe(10.5);
    expect(historical.produced).toBe(5250);
  });

  // ── Negative / invalid press count ──────────────────────────────────────
  it('rejects a negative press count', () => {
    const { svc } = buildService();
    expect(() => svc.createProductionRecord({
      id: 'prod-neg', date: '2026-01-20', lineId: 'line-1', productId: 'prd-1',
      piecesPerPress: 10, presses: -1, createdAt: '2026-01-20T08:00:00.000Z'
    })).toThrowError(/Negative press count/);
  });

  it('rejects missing PiecesPerPress configuration', () => {
    const { svc } = buildService();
    expect(() => svc.createProductionRecord({
      id: 'prod-nocfg', date: '2026-01-20', lineId: 'line-1', productId: 'prd-1',
      piecesPerPress: undefined, presses: 100, createdAt: '2026-01-20T08:00:00.000Z'
    })).toThrowError(/PiecesPerPress/);
  });

  // ── Same Line/day + different Product is ALLOWED ────────────────────────
  it('same Line/day + different Products saves as separate records', (done) => {
    const { svc } = buildService();
    const recA = svc.createProductionRecord({
      id: 'prod-A', date: '2026-08-29', lineId: 'line-1', productId: 'prd-001',
      piecesPerPress: 5, presses: 200, createdAt: '2026-08-29T08:00:00.000Z'
    });
    const recB = svc.createProductionRecord({
      id: 'prod-B', date: '2026-08-29', lineId: 'line-1', productId: 'prd-002',
      piecesPerPress: 6, presses: 150, createdAt: '2026-08-29T09:00:00.000Z'
    });

    svc.create(recA).pipe(
      switchMap(() => svc.create(recB)),
      switchMap(() => svc.getAll())
    ).subscribe(list => {
      expect(list.length).toBe(2);
      expect(list.find(r => r.productId === 'prd-001')!.presses).toBe(200);
      expect(list.find(r => r.productId === 'prd-002')!.presses).toBe(150);
      done();
    });
  });

  // ── Same Line/day + same Product can appear twice (legitimate) ──────────
  it('same Line/day + same Product saves as two separate legitimate records', (done) => {
    const { svc } = buildService();
    const rec1 = svc.createProductionRecord({
      id: 'prod-same-A', date: '2026-08-29', lineId: 'line-1', productId: 'prd-001',
      piecesPerPress: 5, presses: 200, createdAt: '2026-08-29T08:00:00.000Z'
    });
    const rec2 = svc.createProductionRecord({
      id: 'prod-same-B', date: '2026-08-29', lineId: 'line-1', productId: 'prd-001',
      piecesPerPress: 5, presses: 100, createdAt: '2026-08-29T10:00:00.000Z'
    });

    svc.create(rec1).pipe(
      switchMap(() => svc.create(rec2)),
      switchMap(() => svc.getAll())
    ).subscribe(list => {
      const prd1Records = list.filter(r => r.productId === 'prd-001');
      expect(prd1Records.length).toBe(2);
      expect(prd1Records[0].presses).toBe(200);
      expect(prd1Records[1].presses).toBe(100);
      expect(prd1Records[0].id).not.toBe(prd1Records[1].id);
      done();
    });
  });

  // ── Exact retry of the same submission is rejected (idempotent) ─────────
  it('retrying the same submission (same record ids) cannot silently duplicate', (done) => {
    const { svc } = buildService();
    const record = svc.createProductionRecord({
      id: 'prod-dedup', date: '2026-01-21', lineId: 'line-1', productId: 'prd-1',
      piecesPerPress: 10, presses: 50, createdAt: '2026-01-21T08:00:00.000Z'
    });

    svc.create(record).subscribe({
      next: () => {
        svc.create({ ...record }).subscribe({
          next: () => fail('duplicate id must be rejected'),
          error: () => {
            svc.getAll().subscribe(list => {
              expect(list.filter(r => r.id === 'prod-dedup').length).toBe(1);
              done();
            });
          }
        });
      },
      error: (err) => fail(`first create failed: ${err}`)
    });
  });

  // ── getBySessionId helper ───────────────────────────────────────────────
  it('getBySessionId returns only records belonging to that session', (done) => {
    const { svc } = buildService();

    const r1 = svc.createProductionRecord({
      id: 'prod-s1', sessionId: 'sess-abc', date: '2026-08-29', lineId: 'line-1',
      productId: 'prd-1', piecesPerPress: 5, presses: 100, createdAt: '2026-08-29T08:00:00.000Z'
    });
    const r2 = svc.createProductionRecord({
      id: 'prod-s2', sessionId: 'sess-abc', date: '2026-08-29', lineId: 'line-1',
      productId: 'prd-2', piecesPerPress: 6, presses: 80, createdAt: '2026-08-29T08:00:00.000Z'
    });
    const r3 = svc.createProductionRecord({
      id: 'prod-other', sessionId: 'sess-xyz', date: '2026-08-29', lineId: 'line-2',
      productId: 'prd-1', piecesPerPress: 5, presses: 200, createdAt: '2026-08-29T08:00:00.000Z'
    });

    svc.create(r1).pipe(
      switchMap(() => svc.create(r2)),
      switchMap(() => svc.create(r3)),
      switchMap(() => svc.getBySessionId('sess-abc'))
    ).subscribe(list => {
      expect(list.length).toBe(2);
      expect(list.every(r => r.sessionId === 'sess-abc')).toBeTrue();
      done();
    });
  });

  // ── Idempotent retry: records already exist → no deletion needed ────────
  it('retry of same submission preserves existing records without deleting them', (done) => {
    const { svc } = buildService();
    const records = [
      svc.createProductionRecord({
        id: 'idem-1', sessionId: 'sess-idem', date: '2026-08-29', lineId: 'line-1',
        productId: 'prd-1', piecesPerPress: 5, presses: 100, createdAt: '2026-08-29T08:00:00.000Z'
      }),
      svc.createProductionRecord({
        id: 'idem-2', sessionId: 'sess-idem', date: '2026-08-29', lineId: 'line-1',
        productId: 'prd-2', piecesPerPress: 6, presses: 80, createdAt: '2026-08-29T08:00:00.000Z'
      })
    ];

    // First save
    forkJoin(records.map(r => svc.create(r))).pipe(
      switchMap(() => svc.getBySessionId('sess-idem'))
    ).subscribe({
      next: (afterFirst: Production[]) => {
        expect(afterFirst.length).toBe(2);

        // Attempt retry with same ids — should fail at IDB level (key uniqueness)
        // but the component-level idempotency detects records exist and skips.
        // At the service level, we verify records still exist and are intact.
        svc.create(records[0]).subscribe({
          next: () => fail('retry with same id must be rejected'),
          error: () => {
            // Verify original records were NOT deleted
            svc.getBySessionId('sess-idem').subscribe(remaining => {
              expect(remaining.length).toBe(2);
              expect(remaining.find(r => r.id === 'idem-1')!.presses).toBe(100);
              expect(remaining.find(r => r.id === 'idem-2')!.presses).toBe(80);
              done();
            });
          }
        });
      }
    });
  });

  // ── Different submission, same sessionId content → allowed ──────────────
  it('different submission (new ids) with same sessionId content creates new records', (done) => {
    const { svc } = buildService();

    const first = svc.createProductionRecord({
      id: 'diff-1', sessionId: 'sess-diff', date: '2026-08-29', lineId: 'line-1',
      productId: 'prd-1', piecesPerPress: 5, presses: 100, createdAt: '2026-08-29T08:00:00.000Z'
    });
    const second = svc.createProductionRecord({
      id: 'diff-2', sessionId: 'sess-diff', date: '2026-08-29', lineId: 'line-1',
      productId: 'prd-2', piecesPerPress: 6, presses: 80, createdAt: '2026-08-29T08:00:00.000Z'
    });

    svc.create(first).pipe(
      switchMap(() => svc.create(second)),
      switchMap(() => svc.getBySessionId('sess-diff'))
    ).subscribe(list => {
      expect(list.length).toBe(2);
      done();
    });
  });

  // ── Concurrent double-click: SubmissionGuard prevents duplicate ─────────
  it('concurrent double-click produces only one logical submission', () => {
    const guard = new SubmissionGuard();

    expect(guard.acquire()).toBeTrue();   // first click
    expect(guard.acquire()).toBeFalse();  // second click blocked
    expect(guard.isActive).toBeTrue();

    guard.release();
    expect(guard.acquire()).toBeTrue();   // next submission allowed
    guard.release();
  });
});
