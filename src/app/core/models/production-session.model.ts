// ============================================================
// TPMS — Production Session Model
// ============================================================

/**
 * Downtime / overtime entry for a single production line within a session.
 * Multiple lines can be tracked per session via the dailyLineTime array.
 */
export interface DailyLineTimeEntry {
  lineId: string;
  lineName?: string;       // denormalized for display; resolved from Lines master at save time
  overtimeHours: number;
  downtimeMinutes: number;
  downtimeReason: string;
  notes: string;
}

/**
 * Session-level metadata for a production form submission.
 * One session groups all Production records saved together in one form submit.
 * The Production records reference this session via sessionId.
 *
 * Stored in the 'productionSessions' IndexedDB object store.
 */
export interface ProductionSession {
  id: string;                        // sessionId — shared key across Production items
  date: string;                      // YYYY-MM-DD
  shiftId: string;
  lineId: string;
  supervisor: string;
  /**
   * @deprecated Preserved for backward compatibility only.
   * Migrated to OutputRelease store (dataSource: LEGACY_AMBIGUOUS_SESSION).
   * Do NOT use for new reads — query the OutputRelease store instead.
   * Will be removed in a future release once all reads use OutputRelease.
   */
  releasedOutput?: number;           // deprecated legacy — new sessions omit this field
  overtime: boolean;
  overtimeHours: number;             // 0 when overtime = false
  dailyLineTime: DailyLineTimeEntry[]; // per-line downtime/overtime entries
  notes: string;                     // session-level notes
  createdAt: string;
  updatedAt?: string;
}
