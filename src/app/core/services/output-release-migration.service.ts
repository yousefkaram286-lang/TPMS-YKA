import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { STORE_NAMES } from '../constants/storage.constants';
import { ProductionSession } from '../models/production-session.model';
import { OutputRelease } from '../models/output-release.model';

/**
 * MIGRATION VERSION KEY stored in localStorage.
 * 'true' = migration has been fully completed and verified.
 * Absence or 'false' = migration should run (or re-run partially).
 */
export const OUTPUT_RELEASE_MIGRATION_KEY = 'tpms_output_release_migration_v1_completed';

/**
 * Verification result returned after migration completes.
 */
export interface OutputReleaseMigrationVerification {
  legacyTotalReleasedOutput: number;
  migratedTotalReleasedQuantity: number;
  totalsMatch: boolean;
  legacyRecordCount: number;
  migratedRecordCount: number;
  skippedZeroCount: number;
  duplicatesPreventedCount: number;
  byDate: Record<string, { legacy: number; migrated: number; match: boolean }>;
  byLine: Record<string, { legacy: number; migrated: number; match: boolean }>;
}

@Injectable({
  providedIn: 'root'
})
export class OutputReleaseMigrationService {
  private storageService = inject(StorageService);

  /**
   * Builds the deterministic, collision-safe ID for a migrated session record.
   * Format: migrated_session_<sessionId>
   *
   * Using a deterministic ID means:
   * - If migration runs twice, the second insert will fail silently (record already exists).
   * - We never create duplicates even if the completion flag was not written.
   */
  static buildMigratedId(sessionId: string): string {
    return `migrated_session_${sessionId}`;
  }

  /**
   * Runs the idempotent migration from legacy ProductionSession.releasedOutput
   * to the new OutputRelease store.
   *
   * SAFETY DESIGN:
   *  1. Each migrated record uses a deterministic ID → IDB add() fails on duplicate key → no duplicate.
   *  2. The completion flag is written ONLY after verification passes.
   *  3. If the process is interrupted, re-running will skip already-inserted records
   *     (IDB add error is caught per-record and counted as "already migrated").
   *  4. We read the final OutputRelease store to compute totals, not just rely on what we inserted.
   *
   * MIGRATION RULES (enforced):
   *  - Only sessions with releasedOutput > 0 create an OutputRelease record.
   *  - releaseDate = session.date (only thing we reliably know).
   *  - lineId = session.lineId (reliably on the session itself).
   *  - productId is explicitly left undefined (session spans multiple products).
   *  - dataSource = 'LEGACY_AMBIGUOUS_SESSION'.
   *  - legacySessionId = session.id (provenance link, NOT production traceability).
   *
   * @returns verification object with totals and match status
   */
  migrate(): Observable<OutputReleaseMigrationVerification> {
    // Step 1: Load all sessions and all existing output releases in parallel
    return forkJoin([
      this.storageService.getAll<ProductionSession>(STORE_NAMES.PRODUCTION_SESSIONS),
      this.storageService.getAll<OutputRelease>(STORE_NAMES.OUTPUT_RELEASES)
    ]).pipe(
      switchMap(([sessions, existingReleases]) => {
        // Build a Set of already-migrated IDs for quick lookup
        const existingIds = new Set(existingReleases.map(r => r.id));

        const sessionsWithOutput = sessions.filter(s => (s.releasedOutput || 0) > 0);
        const sessionsSkippedZero = sessions.length - sessionsWithOutput.length;

        let duplicatesPreventedCount = 0;
        const toInsert: OutputRelease[] = [];

        for (const session of sessionsWithOutput) {
          const migratedId = OutputReleaseMigrationService.buildMigratedId(session.id);

          if (existingIds.has(migratedId)) {
            // Record already exists — idempotency: skip without error
            duplicatesPreventedCount++;
            continue;
          }

          const record: OutputRelease = {
            id: migratedId,
            releaseDate: session.date,
            lineId: session.lineId || undefined,
            // productId intentionally omitted — cannot be inferred from session level
            releasedQuantity: session.releasedOutput ?? 0,
            dataSource: 'LEGACY_AMBIGUOUS_SESSION',
            legacySessionId: session.id,
            notes: `Migrated from legacy ProductionSession (id: ${session.id})`,
            createdAt: session.createdAt || new Date().toISOString()
          };

          toInsert.push(record);
        }

        // Step 2: Insert only the truly new records
        const insertOps: Observable<OutputRelease>[] = toInsert.map(record =>
          this.storageService.add<OutputRelease>(STORE_NAMES.OUTPUT_RELEASES, record)
        );

        const insert$ = insertOps.length > 0
          ? forkJoin(insertOps)
          : of([] as OutputRelease[]);

        return insert$.pipe(
          // Step 3: Re-read all OutputRelease records to compute verified totals
          switchMap(() => forkJoin([
            of(sessions),
            this.storageService.getAll<OutputRelease>(STORE_NAMES.OUTPUT_RELEASES)
          ])),
          map(([allSessions, allReleases]) => {
            // ── Compute LEGACY totals ──────────────────────────────────────
            let legacyTotal = 0;
            const legacyByDate: Record<string, number> = {};
            const legacyByLine: Record<string, number> = {};

            for (const s of allSessions) {
              const qty = s.releasedOutput || 0;
              if (qty <= 0) continue;
              legacyTotal += qty;
              legacyByDate[s.date] = (legacyByDate[s.date] || 0) + qty;
              if (s.lineId) {
                legacyByLine[s.lineId] = (legacyByLine[s.lineId] || 0) + qty;
              }
            }

            // ── Compute MIGRATED totals (LEGACY_AMBIGUOUS_SESSION only) ───
            const migratedReleases = allReleases.filter(r => r.dataSource === 'LEGACY_AMBIGUOUS_SESSION');
            let migratedTotal = 0;
            const migratedByDate: Record<string, number> = {};
            const migratedByLine: Record<string, number> = {};

            for (const r of migratedReleases) {
              migratedTotal += r.releasedQuantity;
              migratedByDate[r.releaseDate] = (migratedByDate[r.releaseDate] || 0) + r.releasedQuantity;
              if (r.lineId) {
                migratedByLine[r.lineId] = (migratedByLine[r.lineId] || 0) + r.releasedQuantity;
              }
            }

            // ── Build per-date comparison ──────────────────────────────────
            const allDates = new Set([...Object.keys(legacyByDate), ...Object.keys(migratedByDate)]);
            const byDate: Record<string, { legacy: number; migrated: number; match: boolean }> = {};
            for (const date of allDates) {
              const legacy = legacyByDate[date] || 0;
              const migrated = migratedByDate[date] || 0;
              byDate[date] = { legacy, migrated, match: legacy === migrated };
            }

            // ── Build per-line comparison ──────────────────────────────────
            const allLines = new Set([...Object.keys(legacyByLine), ...Object.keys(migratedByLine)]);
            const byLine: Record<string, { legacy: number; migrated: number; match: boolean }> = {};
            for (const line of allLines) {
              const legacy = legacyByLine[line] || 0;
              const migrated = migratedByLine[line] || 0;
              byLine[line] = { legacy, migrated, match: legacy === migrated };
            }

            const verification: OutputReleaseMigrationVerification = {
              legacyTotalReleasedOutput: legacyTotal,
              migratedTotalReleasedQuantity: migratedTotal,
              totalsMatch: legacyTotal === migratedTotal,
              legacyRecordCount: allSessions.filter(s => (s.releasedOutput || 0) > 0).length,
              migratedRecordCount: migratedReleases.length,
              skippedZeroCount: sessionsSkippedZero,
              duplicatesPreventedCount,
              byDate,
              byLine
            };

            return verification;
          }),
          tap(verification => {
            if (verification.totalsMatch) {
              localStorage.setItem(OUTPUT_RELEASE_MIGRATION_KEY, 'true');
              console.log('[OutputReleaseMigration] ✅ Totals match. Migration verified and flagged complete.', verification);
            } else {
              console.error('[OutputReleaseMigration] ❌ TOTAL MISMATCH. Migration flag NOT set.', verification);
            }
          }),
          catchError(error => {
            console.error('[OutputReleaseMigration] Error during migration:', error);
            // Return a safe "failed" verification object
            const failed: OutputReleaseMigrationVerification = {
              legacyTotalReleasedOutput: -1,
              migratedTotalReleasedQuantity: -1,
              totalsMatch: false,
              legacyRecordCount: 0,
              migratedRecordCount: 0,
              skippedZeroCount: 0,
              duplicatesPreventedCount: 0,
              byDate: {},
              byLine: {}
            };
            return of(failed);
          })
        );
      })
    );
  }

  /**
   * Returns true if migration has been completed and verified.
   */
  isCompleted(): boolean {
    return localStorage.getItem(OUTPUT_RELEASE_MIGRATION_KEY) === 'true';
  }

  /**
   * Resets the migration flag, allowing it to re-run.
   * USE ONLY FOR TESTING.
   */
  resetForTesting(): void {
    localStorage.removeItem(OUTPUT_RELEASE_MIGRATION_KEY);
  }
}
