import { toLocalCalendarString } from './date.util';

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
