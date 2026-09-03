import { ProductionUtil, SubmissionGuard } from './production.util';

describe('ProductionUtil legacy edit compatibility (PROD-BIZ-13)', () => {

  it('loads real granular downtimeEvents unchanged when present', () => {
    const events = ProductionUtil.legacyDowntimeEvents({
      downtimeEvents: [{ durationMinutes: 25, reason: 'Changeover', notes: 'a' }],
      dailyLineTime: [{ downtimeMinutes: 40, downtimeReason: 'Breakdown', notes: 'example' }]
    });
    expect(events).toEqual([{ durationMinutes: 25, reason: 'Changeover', notes: 'a' }]);
  });

  it('legacy scalar-only session → ONE compatibility event (edit must not show zero / lose downtime)', () => {
    // Exact review scenario: downtimeEvents is null/[] (predates the field),
    // dailyLineTime[0] carries the old scalar downtime.
    const events = ProductionUtil.legacyDowntimeEvents({
      downtimeEvents: [],
      dailyLineTime: [{
        downtimeMinutes: 40,
        downtimeReason: 'Breakdown',
        notes: 'example'
      }]
    });
    expect(events).toEqual([{
      durationMinutes: 40,
      reason: 'Breakdown',
      notes: 'example'
    }]);
  });

  it('legacy scalar-only session with reason/notes missing → empty reason/notes, downtime preserved', () => {
    const events = ProductionUtil.legacyDowntimeEvents({
      downtimeEvents: null,
      dailyLineTime: [{ downtimeMinutes: 40, downtimeReason: '', notes: '' }]
    });
    expect(events).toEqual([{ durationMinutes: 40, reason: '', notes: '' }]);
  });

  it('no downtime at all → empty event list (form shows none, nothing invented)', () => {
    expect(ProductionUtil.legacyDowntimeEvents({ downtimeEvents: [], dailyLineTime: [{ downtimeMinutes: 0 }] })).toEqual([]);
    expect(ProductionUtil.legacyDowntimeEvents(null)).toEqual([]);
    expect(ProductionUtil.legacyDowntimeEvents(undefined)).toEqual([]);
    expect(ProductionUtil.legacyDowntimeEvents({})).toEqual([]);
  });

  it('is a read/edit transformation — it never mutates or migrates the input session', () => {
    const session = {
      downtimeEvents: [] as { durationMinutes: number }[],
      dailyLineTime: [{ downtimeMinutes: 40, downtimeReason: 'Breakdown', notes: 'example' }]
    };
    const snapshot = JSON.stringify(session);
    ProductionUtil.legacyDowntimeEvents(session);
    expect(JSON.stringify(session)).toBe(snapshot);
  });
});

describe('ProductionUtil', () => {

  // ─── Production business simplification: time calculations ─────────────
  // One selected line per session; downtime captured as MULTIPLE events;
  // single authoritative overtime in HOURS (converted to minutes only for
  // Available/Actual/Efficiency).

  it('PROD-BIZ-03. sums multiple downtime events into a single total', () => {
    const events = [
      { durationMinutes: 30 },
      { durationMinutes: 15 },
      { durationMinutes: 5 }
    ];
    expect(ProductionUtil.sumDowntime(events)).toBe(50);
  });

  it('PROD-BIZ-03b. a single downtime event is treated as its own total', () => {
    expect(ProductionUtil.sumDowntime([{ durationMinutes: 45 }])).toBe(45);
  });

  it('PROD-BIZ-03c. ignores non-finite/negative event durations', () => {
    expect(ProductionUtil.sumDowntime([
      { durationMinutes: 10 },
      { durationMinutes: -5 },
      { durationMinutes: NaN },
      { durationMinutes: 20 }
    ])).toBe(30);
    expect(ProductionUtil.sumDowntime(null)).toBe(0);
    expect(ProductionUtil.sumDowntime(undefined)).toBe(0);
    expect(ProductionUtil.sumDowntime([])).toBe(0);
  });

  it('PROD-BIZ-05a. Available = 390 + OvertimeMinutes (overtime in hours ×60)', () => {
    // 1.5 hours overtime → 90 min overtime → 390 + 90 = 480
    expect(ProductionUtil.availableMinutes(1.5)).toBe(480);
    // no overtime → base 390
    expect(ProductionUtil.availableMinutes(0)).toBe(390);
    expect(ProductionUtil.availableMinutes(undefined)).toBe(390);
  });

  it('PROD-BIZ-05b. Actual = max(0, Available − TotalDowntime)', () => {
    // Available 480, downtime 50 → Actual 430
    expect(ProductionUtil.actualRunMinutes(1.5, [
      { durationMinutes: 30 }, { durationMinutes: 20 }
    ])).toBe(430);
    // downtime exceeds available → floor at 0 (never negative)
    expect(ProductionUtil.actualRunMinutes(0, [{ durationMinutes: 999 }])).toBe(0);
  });

  it('PROD-BIZ-05c. Efficiency = Actual / Available × 100', () => {
    // Available 480, Actual 430 → 89.583...
    expect(ProductionUtil.efficiencyPercent(1.5, [
      { durationMinutes: 30 }, { durationMinutes: 20 }
    ])).toBeCloseTo(430 / 480 * 100, 5);
    // no overtime, no downtime → 100%
    expect(ProductionUtil.efficiencyPercent(0, [])).toBe(100);
    // fully down → 0%
    expect(ProductionUtil.efficiencyPercent(0, [{ durationMinutes: 390 }])).toBe(0);
  });

  it('PROD-BIZ-08. overtime is a SINGLE authoritative source — stored as hours, never round-tripped', () => {
    // overtimeHours is stored verbatim; only converted to minutes inside the
    // Available/Actual/Efficiency helpers. There is no stored overtimeMinutes.
    expect(ProductionUtil.availableMinutes(2)).toBe(390 + 2 * 60);
    // Available time returned is in minutes (as required by the rule).
    expect(ProductionUtil.availableMinutes(2)).toBe(510);
  });

  it('PROD-BIZ-12. legacy scalar-only sessions still aggregate from dailyLineTime', () => {
    // Historical session has NO granular events → fall back to per-line scalar.
    expect(ProductionUtil.downtimeMinutesOf({ downtimeEvents: [], dailyLineTime: [
      { downtimeMinutes: 25 }, { downtimeMinutes: 15 }
    ]})).toBe(40);
    // granular events take precedence when present
    expect(ProductionUtil.downtimeMinutesOf({ downtimeEvents: [
      { durationMinutes: 10 }
    ], dailyLineTime: [{ downtimeMinutes: 25 }] })).toBe(10);
    // missing session / no data
    expect(ProductionUtil.downtimeMinutesOf(null)).toBe(0);
    expect(ProductionUtil.downtimeMinutesOf({})).toBe(0);
  });

  // ─── Calculation regression ─────────────────────────────────────────────
  it('regression: 500 presses × 10.5 pieces/per press = 5250', () => {
    expect(ProductionUtil.calculateProduced(10.5, 500)).toBe(5250);
  });

  it('rounds float artifacts from non-decimal ratios', () => {
    // 0.1 × 3 in JS = 0.30000000000000004 — must normalize to 0.3
    expect(ProductionUtil.calculateProduced(0.1, 3)).toBe(0.3);
  });

  it('calculates zero presses as zero produced', () => {
    expect(ProductionUtil.calculateProduced(10.5, 0)).toBe(0);
  });

  it('produces 0 for invalid inputs (never NaN/negative from bad data)', () => {
    expect(ProductionUtil.calculateProduced(NaN, 5)).toBe(0);
    expect(ProductionUtil.calculateProduced(10.5, NaN)).toBe(0);
    expect(ProductionUtil.calculateProduced(-10.5, 5)).toBe(-52.5);
  });

  // ─── Press count validation ─────────────────────────────────────────────
  it('rejects negative press count', () => {
    expect(ProductionUtil.isValidPressCount(-1)).toBeFalse();
    expect(ProductionUtil.isValidPressCount(-0.5)).toBeFalse();
  });

  it('accepts zero and positive press counts', () => {
    expect(ProductionUtil.isValidPressCount(0)).toBeTrue();
    expect(ProductionUtil.isValidPressCount(500)).toBeTrue();
    expect(ProductionUtil.isValidPressCount(10.5)).toBeTrue();
  });

  it('rejects non-finite press counts', () => {
    expect(ProductionUtil.isValidPressCount(NaN)).toBeFalse();
    expect(ProductionUtil.isValidPressCount(Infinity)).toBeFalse();
    expect(ProductionUtil.isValidPressCount(undefined)).toBeFalse();
  });

  // ─── Configuration check (PiecesPerPress presence) ─────────────────────
  it('isConfigured requires a positive finite PiecesPerPress', () => {
    expect(ProductionUtil.isConfigured(10.5)).toBeTrue();
    expect(ProductionUtil.isConfigured(0)).toBeFalse();
    expect(ProductionUtil.isConfigured(-1)).toBeFalse();
    expect(ProductionUtil.isConfigured(undefined)).toBeFalse();
    expect(ProductionUtil.isConfigured(null)).toBeFalse();
    expect(ProductionUtil.isConfigured(NaN)).toBeFalse();
  });

  // ─── Snapshot integrity ─────────────────────────────────────────────────
  it('historical record preserves its own PiecesPerPress value (snapshot)', () => {
    // Record saved when master PiecesPerPress = 10.5
    const historicalProduced = ProductionUtil.calculateProduced(10.5, 500);
    expect(historicalProduced).toBe(5250);

    // Later the Product master PiecesPerPress changes to 12
    const laterMasterProduced = ProductionUtil.calculateProduced(12, 500);
    expect(laterMasterProduced).toBe(6000);

    // The historical record must remain unaffected when re-derived from its snapshot
    expect(ProductionUtil.calculateProduced(10.5, 500)).toBe(historicalProduced);
  });
});

describe('SubmissionGuard (duplicate submission protection)', () => {

  it('blocks a second submission while the first is in flight', () => {
    const guard = new SubmissionGuard();
    expect(guard.acquire()).toBeTrue();   // first submit accepted
    expect(guard.acquire()).toBeFalse();  // retry of the same submission blocked
  });

  it('allows a new submission after release', () => {
    const guard = new SubmissionGuard();
    expect(guard.acquire()).toBeTrue();
    guard.release();
    expect(guard.acquire()).toBeTrue();
  });

  it('tracks active state', () => {
    const guard = new SubmissionGuard();
    expect(guard.isActive).toBeFalse();
    guard.acquire();
    expect(guard.isActive).toBeTrue();
    guard.release();
    expect(guard.isActive).toBeFalse();
  });
});

// ═══════════ PROD HISTORICAL-INTEGRITY (inactive master must not block unchanged historical items) ═══════════

describe('Production Product reference integrity (resolveProductReferenceStatus)', () => {

  const resolve = (over: Partial<{
    editing: boolean; existingProductId: string | undefined; nextProductId: string;
    productExists: boolean; productActive: boolean;
  }> = {}): 'ok' | 'blocked' =>
    ProductionUtil.resolveProductReferenceStatus({
      editing: over.editing ?? false,
      existingProductId: over.existingProductId,
      nextProductId: over.nextProductId ?? 'prd-A',
      productExists: over.productExists ?? true,
      productActive: over.productActive ?? true
    });

  it('PROD-HIST-01. editing only Notes on a session whose Product is now inactive → allowed', () => {
    // Unchanged historical reference: existing item === next item, product now inactive.
    expect(resolve({ editing: true, existingProductId: 'prd-A', nextProductId: 'prd-A', productActive: false })).toBe('ok');
  });

  it('PROD-HIST-02. editing downtime/overtime on that same unchanged item → allowed', () => {
    // Same per-row decision: the row still equals its historical reference.
    expect(resolve({ editing: true, existingProductId: 'prd-A', nextProductId: 'prd-A', productActive: false })).toBe('ok');
  });

  it('PROD-HIST-03. NEW Production using an inactive Product → blocked', () => {
    expect(resolve({ editing: false, existingProductId: undefined, nextProductId: 'prd-A', productActive: false })).toBe('blocked');
    // even on edit, an item with NO historical counterpart (a new row) is blocked
    expect(resolve({ editing: true, existingProductId: undefined, nextProductId: 'prd-A', productActive: false })).toBe('blocked');
  });

  it('PROD-HIST-04. edit that ADDS inactive Product A as a new item → blocked', () => {
    // The new row sits beyond the existing records (no historical counterpart at its index).
    expect(resolve({ editing: true, existingProductId: undefined, nextProductId: 'prd-A', productActive: false })).toBe('blocked');
  });

  it('PROD-HIST-04b. edit that SWITCHES an existing item to another inactive Product → blocked', () => {
    expect(resolve({ editing: true, existingProductId: 'prd-B', nextProductId: 'prd-A', productActive: false })).toBe('blocked');
  });

  it('PROD-HIST-05. historical record referencing inactive Product A remains valid when unchanged', () => {
    expect(resolve({ editing: true, existingProductId: 'prd-A', nextProductId: 'prd-A', productActive: false })).toBe('ok');
    // active-master rows are trivially fine too
    expect(resolve({ editing: true, existingProductId: 'prd-A', nextProductId: 'prd-A', productActive: true })).toBe('ok');
  });

  it('PROD-HIST-06. OutputRelease is a completely separate store — reference resolution never concerns it', () => {
    // The guard's only inputs are master existence/active + historical reference equality.
    // (Persistence independence is verified in production.service.spec.)
    expect(resolve({ editing: true, existingProductId: 'prd-A', nextProductId: 'prd-A', productActive: false })).toBe('ok');
    expect(resolve({ editing: false, existingProductId: undefined, nextProductId: 'prd-A', productActive: false })).toBe('blocked');
  });

  it('a missing Product master is ALWAYS blocked — references are never silently re-pointed', () => {
    expect(resolve({ editing: true, existingProductId: 'prd-A', nextProductId: 'prd-MISSING', productExists: false, productActive: false })).toBe('blocked');
    expect(resolve({ editing: false, existingProductId: undefined, nextProductId: 'prd-MISSING', productExists: false, productActive: false })).toBe('blocked');
  });
});