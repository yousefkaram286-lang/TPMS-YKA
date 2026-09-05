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
