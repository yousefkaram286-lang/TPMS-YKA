import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';

import { OutputReleaseMigrationService } from './output-release-migration.service';
import { StorageService } from './storage.service';
import { STORE_NAMES } from '../constants/storage.constants';
import { ProductionSession } from '../models/production-session.model';
import { OutputRelease } from '../models/output-release.model';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<ProductionSession> & { id: string }): ProductionSession {
  return {
    date: '2026-01-15',
    shiftId: 'shift-1',
    lineId: 'line-1',
    supervisor: 'Ahmed',
    releasedOutput: 0,
    overtime: false,
    overtimeHours: 0,
    dailyLineTime: [],
    notes: '',
    createdAt: '2026-01-15T08:00:00.000Z',
    ...overrides
  };
}

function makeOutputRelease(overrides: Partial<OutputRelease> & { id: string }): OutputRelease {
  return {
    releaseDate: '2026-01-15',
    releasedQuantity: 500,
    dataSource: 'LEGACY_AMBIGUOUS_SESSION',
    createdAt: '2026-01-15T08:00:00.000Z',
    ...overrides
  };
}

// ─── Mock StorageService ──────────────────────────────────────────────────────

function createMockStorageService(sessions: ProductionSession[], existingReleases: OutputRelease[]) {
  const added: OutputRelease[] = [];

  return {
    getAll: jasmine.createSpy('getAll').and.callFake((storeName: string) => {
      if (storeName === STORE_NAMES.PRODUCTION_SESSIONS) return of([...sessions]);
      if (storeName === STORE_NAMES.OUTPUT_RELEASES)     return of([...existingReleases, ...added]);
      return of([]);
    }),
    add: jasmine.createSpy('add').and.callFake((storeName: string, record: OutputRelease) => {
      // Simulate IDB uniqueness — reject if already in added or existingReleases
      const allIds = new Set([...existingReleases.map(r => r.id), ...added.map(r => r.id)]);
      if (allIds.has(record.id)) {
        return new Observable((sub) => sub.error(new Error(`Key already exists: ${record.id}`)));
      }
      added.push({ ...record });
      return of(record);
    })
  } as unknown as StorageService;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OutputReleaseMigrationService', () => {

  afterEach(() => {
    localStorage.removeItem('tpms_output_release_migration_v1_completed');
  });

  function buildService(sessions: ProductionSession[], existingReleases: OutputRelease[] = []) {
    const mockStorage = createMockStorageService(sessions, existingReleases);
    TestBed.configureTestingModule({
      providers: [
        OutputReleaseMigrationService,
        { provide: StorageService, useValue: mockStorage }
      ]
    });
    const svc = TestBed.inject(OutputReleaseMigrationService);
    return { svc, mockStorage };
  }

  // ── Test 1 ──────────────────────────────────────────────────────────────────
  it('creates one OutputRelease for a session with releasedOutput > 0', (done) => {
    const sessions = [
      makeSession({ id: 'sess-1', releasedOutput: 1200, date: '2026-01-15', lineId: 'line-A' })
    ];
    const { svc, mockStorage } = buildService(sessions);

    svc.migrate().subscribe(verification => {
      expect(verification.legacyRecordCount).toBe(1);
      expect(verification.migratedRecordCount).toBe(1);
      expect(verification.legacyTotalReleasedOutput).toBe(1200);
      expect(verification.migratedTotalReleasedQuantity).toBe(1200);
      expect(verification.totalsMatch).toBeTrue();
      // Verify the inserted record details via the add spy
      const addCall = (mockStorage.add as jasmine.Spy).calls.mostRecent();
      expect(addCall.args[1].id).toBe('migrated_session_sess-1');
      expect(addCall.args[1].releaseDate).toBe('2026-01-15');
      expect(addCall.args[1].lineId).toBe('line-A');
      expect(addCall.args[1].dataSource).toBe('LEGACY_AMBIGUOUS_SESSION');
      done();
    });
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────
  it('does NOT assign productId to migrated records', (done) => {
    const sessions = [
      makeSession({ id: 'sess-2', releasedOutput: 500 })
    ];
    const { svc, mockStorage } = buildService(sessions);

    svc.migrate().subscribe(() => {
      const addCall = (mockStorage.add as jasmine.Spy).calls.mostRecent();
      const record: OutputRelease = addCall.args[1];
      expect(record.productId).toBeUndefined();
      done();
    });
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────
  it('preserves correct date and lineId from session', (done) => {
    const sessions = [
      makeSession({ id: 'sess-3', releasedOutput: 800, date: '2026-03-22', lineId: 'line-5' })
    ];
    const { svc, mockStorage } = buildService(sessions);

    svc.migrate().subscribe(() => {
      const addCall = (mockStorage.add as jasmine.Spy).calls.mostRecent();
      const record: OutputRelease = addCall.args[1];
      expect(record.releaseDate).toBe('2026-03-22');
      expect(record.lineId).toBe('line-5');
      expect(record.legacySessionId).toBe('sess-3');
      done();
    });
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────
  it('creates NO OutputRelease for sessions with releasedOutput = 0', (done) => {
    const sessions = [
      makeSession({ id: 'sess-4', releasedOutput: 0 }),
      makeSession({ id: 'sess-5', releasedOutput: 0 })
    ];
    const { svc, mockStorage } = buildService(sessions);

    svc.migrate().subscribe(verification => {
      expect(verification.legacyRecordCount).toBe(0);
      expect(verification.migratedRecordCount).toBe(0);
      expect(verification.legacyTotalReleasedOutput).toBe(0);
      expect(verification.migratedTotalReleasedQuantity).toBe(0);
      expect(verification.totalsMatch).toBeTrue();
      expect((mockStorage.add as jasmine.Spy).calls.count()).toBe(0);
      done();
    });
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────
  it('running migration twice creates NO duplicate OutputRelease records', (done) => {
    const sessions = [
      makeSession({ id: 'sess-6', releasedOutput: 1000 })
    ];
    const existingAfterFirstRun = [
      makeOutputRelease({
        id: 'migrated_session_sess-6',
        releasedQuantity: 1000,
        releaseDate: '2026-01-15',
        dataSource: 'LEGACY_AMBIGUOUS_SESSION',
        legacySessionId: 'sess-6'
      })
    ];
    // Second run: already has the migrated record
    const { svc, mockStorage } = buildService(sessions, existingAfterFirstRun);

    svc.migrate().subscribe(verification => {
      expect(verification.duplicatesPreventedCount).toBe(1);
      // add() should NOT have been called on the second run
      expect((mockStorage.add as jasmine.Spy).calls.count()).toBe(0);
      expect(verification.migratedRecordCount).toBe(1);
      expect(verification.totalsMatch).toBeTrue();
      done();
    });
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────────
  it('preserves existing non-legacy OutputRelease records', (done) => {
    const sessions = [
      makeSession({ id: 'sess-7', releasedOutput: 600 })
    ];
    const existingManual = [
      makeOutputRelease({
        id: 'manual-entry-001',
        releasedQuantity: 999,
        dataSource: 'MANUAL_ENTRY'
      })
    ];
    const { svc } = buildService(sessions, existingManual);

    svc.migrate().subscribe(verification => {
      // MANUAL_ENTRY is NOT counted in legacy comparison — only LEGACY_AMBIGUOUS_SESSION
      expect(verification.migratedRecordCount).toBe(1); // 1 newly migrated
      expect(verification.legacyTotalReleasedOutput).toBe(600);
      expect(verification.migratedTotalReleasedQuantity).toBe(600);
      expect(verification.totalsMatch).toBeTrue();
      done();
    });
  });

  // ── Test 7 ──────────────────────────────────────────────────────────────────
  it('handles partial previous migration without creating duplicates', (done) => {
    const sessions = [
      makeSession({ id: 'sess-8', releasedOutput: 400 }),
      makeSession({ id: 'sess-9', releasedOutput: 300 })
    ];
    // Only sess-8 was migrated in a previous partial run
    const existingPartial = [
      makeOutputRelease({
        id: 'migrated_session_sess-8',
        releasedQuantity: 400,
        dataSource: 'LEGACY_AMBIGUOUS_SESSION',
        legacySessionId: 'sess-8'
      })
    ];
    const { svc, mockStorage } = buildService(sessions, existingPartial);

    svc.migrate().subscribe(verification => {
      expect(verification.duplicatesPreventedCount).toBe(1); // sess-8 skipped
      // Only sess-9 should have been newly added
      const addCalls = (mockStorage.add as jasmine.Spy).calls.all();
      expect(addCalls.length).toBe(1);
      expect(addCalls[0].args[1].id).toBe('migrated_session_sess-9');
      expect(verification.migratedRecordCount).toBe(2); // both now present
      expect(verification.legacyTotalReleasedOutput).toBe(700);
      expect(verification.migratedTotalReleasedQuantity).toBe(700);
      expect(verification.totalsMatch).toBeTrue();
      done();
    });
  });

  // ── Test 8 ──────────────────────────────────────────────────────────────────
  it('migrated total equals legacy total across multiple sessions', (done) => {
    const sessions = [
      makeSession({ id: 'sessA', releasedOutput: 1500, date: '2026-01-10', lineId: 'line-1' }),
      makeSession({ id: 'sessB', releasedOutput: 2000, date: '2026-01-10', lineId: 'line-2' }),
      makeSession({ id: 'sessC', releasedOutput: 750,  date: '2026-01-11', lineId: 'line-1' }),
      makeSession({ id: 'sessD', releasedOutput: 0,    date: '2026-01-12', lineId: 'line-3' }),
    ];
    const { svc } = buildService(sessions);

    svc.migrate().subscribe(verification => {
      const expectedTotal = 1500 + 2000 + 750; // 4250; sessD has 0, excluded
      expect(verification.legacyTotalReleasedOutput).toBe(expectedTotal);
      expect(verification.migratedTotalReleasedQuantity).toBe(expectedTotal);
      expect(verification.totalsMatch).toBeTrue();
      expect(verification.legacyRecordCount).toBe(3);
      expect(verification.migratedRecordCount).toBe(3);
      expect(verification.skippedZeroCount).toBe(1);

      // Verify date-level breakdown
      expect(verification.byDate['2026-01-10'].legacy).toBe(3500);
      expect(verification.byDate['2026-01-10'].migrated).toBe(3500);
      expect(verification.byDate['2026-01-10'].match).toBeTrue();
      expect(verification.byDate['2026-01-11'].legacy).toBe(750);
      expect(verification.byDate['2026-01-11'].match).toBeTrue();

      // Verify line-level breakdown
      expect(verification.byLine['line-1'].legacy).toBe(2250); // 1500 + 750
      expect(verification.byLine['line-1'].match).toBeTrue();
      expect(verification.byLine['line-2'].legacy).toBe(2000);
      expect(verification.byLine['line-2'].match).toBeTrue();

      done();
    });
  });

  // ── Test 9 ──────────────────────────────────────────────────────────────────
  it('buildMigratedId produces expected deterministic format', () => {
    expect(OutputReleaseMigrationService.buildMigratedId('abc-123'))
      .toBe('migrated_session_abc-123');
    expect(OutputReleaseMigrationService.buildMigratedId('session-xyz'))
      .toBe('migrated_session_session-xyz');
  });
});
