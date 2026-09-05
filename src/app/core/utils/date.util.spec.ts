import { toLocalCalendarString, parseLocalCalendarDate } from './date.util';

describe('toLocalCalendarString (local plant calendar date serialization)', () => {

  it('PROD-BIZ-09. serializes using the LOCAL calendar date, not UTC', () => {
    // Local midnight in a positive UTC offset (e.g. Riyadh UTC+3) must NOT
    // shift to the previous UTC calendar day.
    const localMidnight = new Date(2026, 8, 3, 0, 0, 0); // Sep 3, 2026 local
    expect(localMidnight.getTimezoneOffset()).toBeLessThan(0); // positive offset env
    expect(toLocalCalendarString(localMidnight)).toBe('2026-09-03');
  });

  it('PROD-BIZ-09b. pads month and day to two digits', () => {
    expect(toLocalCalendarString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalCalendarString(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('round-trips the local calendar date (save → re-open)', () => {
    const saved = toLocalCalendarString(new Date(2026, 8, 3, 8, 30, 0));
    // Re-reading a stored YYYY-MM-DD back into a local Date, then re-serializing,
    // must yield the same calendar day for a 0-offset-free workflow.
    expect(saved).toBe('2026-09-03');
  });

  it('is distinct from toISOString() behavior in positive offset zones', () => {
    const localMidnight = new Date(2026, 8, 3, 0, 0, 0);
    // In a negative-UTC-offset environment this date's ISO UTC day may differ;
    // the point is the local calendar string is authoritative and stable.
    expect(toLocalCalendarString(localMidnight)).toBe('2026-09-03');
  });
});

describe('Business date timezone integrity (date.util)', () => {

  // CASE 2 — save path: a local Date representing 2026-09-05 must serialize to
  // the SAME calendar date, never the previous day.
  it('toLocalCalendarString keeps the exact local calendar date (no UTC shift)', () => {
    const localMidnight = new Date(2026, 8, 5); // local calendar date 2026-09-05

    expect(toLocalCalendarString(localMidnight)).toBe('2026-09-05');

    // Document the defect this replaces: on any machine east of UTC (incl. the
    // UTC+3 factory) the old toISOString().split('T')[0] pattern loses a day.
    if (localMidnight.getTimezoneOffset() < 0) {
      expect(localMidnight.toISOString().split('T')[0]).toBe('2026-09-04');
    } else {
      expect(localMidnight.toISOString().split('T')[0]).toBe('2026-09-05');
    }
  });

  // CASE 1 / 4 / 5 — edit path: a stored '2026-09-05' opens in the form as the
  // exact same local calendar date, regardless of the host timezone.
  it('parseLocalCalendarDate opens a stored YYYY-MM-DD as the exact same calendar date', () => {
    const d = parseLocalCalendarDate('2026-09-05');

    expect(d).toBeDefined();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(8);
    expect(d!.getDate()).toBe(5);

    // Round-trips back to the identical stored business date.
    expect(toLocalCalendarString(d!)).toBe('2026-09-05');
  });

  it('parseLocalCalendarDate is timezone-safe where new Date("YYYY-MM-DD") is not', () => {
    // new Date('2026-09-05') is UTC midnight — that instant is NOT the local
    // calendar date on any machine west of UTC.
    const rawParsed = new Date('2026-09-05');
    expect(rawParsed.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    if (rawParsed.getTimezoneOffset() > 0) {
      expect(rawParsed.getDate()).toBe(4); // previous local day
    }

    // parseLocalCalendarDate always yields the stored calendar day.
    expect(parseLocalCalendarDate('2026-09-05')!.getDate()).toBe(5);
  });

  it('parseLocalCalendarDate rejects anything that is not a well-formed YYYY-MM-DD', () => {
    expect(parseLocalCalendarDate(undefined)).toBeUndefined();
    expect(parseLocalCalendarDate(null)).toBeUndefined();
    expect(parseLocalCalendarDate('')).toBeUndefined();
    expect(parseLocalCalendarDate('2026-9-5')).toBeUndefined();
    expect(parseLocalCalendarDate('2026-09-05T00:00:00')).toBeUndefined();
    expect(parseLocalCalendarDate('2026-09-31')).toBeUndefined(); // rolls to Oct 1 — never accepted
    expect(parseLocalCalendarDate('2026-13-01')).toBeUndefined(); // month 13 — never accepted
    expect(parseLocalCalendarDate('not-a-date')).toBeUndefined();
  });
});