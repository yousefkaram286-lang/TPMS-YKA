export interface Production {
  id: string;
  sessionId?: string;       // links to ProductionSession; absent on legacy records
  date: string;
  shiftId: string;              // '' when shift not captured (optional input)
  lineId: string;
  machineId?: string;       // Optional for backward compatibility with older records
  supervisor: string;
  productId: string;
  piecesPerPress: number;
  presses: number;
  produced: number;
  /**
   * Trolley input (Line 1 / Line 2 only) — operator-entered trolley count.
   * Accepts decimals (30.5) and is stored unrounded. Absent on every record
   * that was not captured through the Trolley flow, including historical
   * Line 1/2 records: a trolley count is never back-derived from Presses.
   */
  trolleyCount?: number;
  /**
   * Presses-per-trolley snapshot taken at entry time (always PRESSES_PER_TROLLEY
   * = 14). Stored so a later change of the fixed factor can never silently
   * reinterpret historical records. Absent when trolleyCount is absent.
   */
  pressesPerTrolley?: number;
  releasedOutput?: number;  // Optional for backward compatibility
  output?: number;          // Legacy field — kept for backward compat
  createdAt: string;
  updatedAt?: string;
}
