// ============================================================
// TPMS — Trolley Input Utility (Production Line 1 & Line 2)
// ------------------------------------------------------------
// Factory-confirmed business rule:
//
//   Line 1 and Line 2 do NOT receive direct Presses input.
//   The operator enters TROLLEYS and the system derives Presses:
//
//        Presses = Trolleys x PRESSES_PER_TROLLEY
//        Produced = Presses x PiecesPerPress
//
//   1 Trolley = 14 Presses (fixed, not configurable).
//
// Trolley counts accept DECIMALS and are NEVER rounded:
//
//        30      -> 420 presses
//        30.5    -> 427 presses
//        30.25   -> 423.5 presses
//        0.5     -> 7 presses
//
// SCOPE: applies ONLY to the trolley lines listed in TROLLEY_LINE_IDS.
// Every other line keeps the existing manual Presses input untouched.
// ============================================================

/**
 * Lines that receive Trolley input instead of direct Presses input.
 * Identified by the master-data Line id (NOT by display name) so a
 * renamed line keeps — or loses — trolley mode deterministically.
 */
export const TROLLEY_LINE_IDS: ReadonlySet<string> = new Set(['lin-001', 'lin-002']);

/** Fixed factory conversion factor: 1 Trolley = 14 Presses. */
export const PRESSES_PER_TROLLEY = 14;

export class TrolleyUtil {
  /**
   * True when the given Line id receives Trolley input.
   * An unknown/empty line id is NOT a trolley line.
   */
  static isTrolleyLine(lineId: string | null | undefined): boolean {
    return !!lineId && TROLLEY_LINE_IDS.has(lineId);
  }

  /**
   * Converts a Trolley count to Presses.
   *
   * Returns 0 for non-finite input. Fractional Presses (e.g. 423.5) are
   * valid; the entered trolley precision is never explicitly rounded.
   */
  static calculatePresses(trolleyCount: unknown): number {
    if (!this.isValidTrolleyCount(trolleyCount)) return 0;
    const trolleys = Number(trolleyCount);
    return trolleys * PRESSES_PER_TROLLEY;
  }

  /**
   * Trolley validation. Rejects 0, negatives, and non-numeric input.
   * Accepts any positive decimal (30, 30.5, 30.25, 0.5).
   *
   * Accepts `unknown` because an Angular number control yields a number, a
   * raw DOM string, or null depending on how the value was entered; all three
   * are validated on their numeric result.
   */
  static isValidTrolleyCount(trolleyCount: unknown): boolean {
    if (typeof trolleyCount !== 'number' && typeof trolleyCount !== 'string') return false;
    if (typeof trolleyCount === 'string' &&
        !/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trolleyCount.trim())) return false;
    const trolleys = Number(trolleyCount);
    return Number.isFinite(trolleys) && trolleys > 0;
  }

  /**
   * Historical-integrity helper.
   *
   * A Trolley count is only ever read from — or written to — a record that
   * ALREADY carries one. A missing value stays missing: no trolley count is
   * ever back-derived from a legacy Presses value, because a legacy Presses
   * figure is not guaranteed to have originated from whole or partial trolleys.
   */
  static trolleyCountOf(record: { trolleyCount?: number | null } | null | undefined): number | null {
    if (!record) return null;
    const raw = record.trolleyCount;
    if (raw === null || raw === undefined) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  /**
   * True when the record was captured through the Trolley flow, i.e. it has a
   * stored trolley count. Used to decide whether a Line 1/2 record can be
   * re-opened in trolley mode without inventing data.
   */
  static hasTrolleyData(record: { trolleyCount?: number | null } | null | undefined): boolean {
    return this.trolleyCountOf(record) !== null;
  }
}
