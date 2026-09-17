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

/**
 * Default Operational Date (UI default only): the Local Plant Calendar Date
 * minus one day, i.e. YESTERDAY.
 *
 * Returns a LOCAL `Date` for the previous calendar day of `now`. Calendar
 * arithmetic via `setDate(getDate() - 1)` is used (NOT `now - 86400000`) so the
 * result is the exact previous local calendar day regardless of DST or UTC
 * offset; the optional `now` parameter exists only for deterministic tests.
 *
 * This is a UI/default-date rule only: use it to pre-fill entry forms, reset
 * forms, and the Dashboard's default operational selection. It must NEVER be
 * used to shift stored data, rewrite historical dates, or subtract during save.
 */
export function getDefaultOperationalDate(now: Date = new Date()): Date {
  const date = new Date(now.getTime());
  date.setDate(date.getDate() - 1);
  return date;
}

/**
 * Parse a stored YYYY-MM-DD business date into a LOCAL `Date` (local midnight)
 * WITHOUT UTC interpretation. `new Date("2026-09-05")` parses at UTC midnight
 * and can render as the PREVIOUS local calendar day for negative UTC offsets,
 * or feed the reverse direction of `toISOString()` and lose a day. This
 * mirrors the local-calendar rule of `toLocalCalendarString()`.
 * Returns undefined for anything that is not a well-formed YYYY-MM-DD.
 */
export function parseLocalCalendarDate(value: string | null | undefined): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return undefined;
  if (toLocalCalendarString(date) !== value) return undefined;
  return date;
}
