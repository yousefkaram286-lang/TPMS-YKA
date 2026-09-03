/**
 * Local calendar date utilities (TPMS V3).
 *
 * Operational dates are local plant calendar dates (YYYY-MM-DD). They MUST NOT
 * be serialized through UTC: a local midnight in a positive UTC offset (e.g.
 * Riyadh UTC+3) serializes as the PREVIOUS UTC calendar day when using
 * `toISOString()`. Use `toLocalCalendarString()` for all transaction date
 * serialization; keep `toISOString()` only for createdAt/updatedAt audit fields.
 */
export function toLocalCalendarString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
