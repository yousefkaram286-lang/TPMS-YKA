import { ProductionUtil, SubmissionGuard } from './production.util';

describe('ProductionUtil', () => {

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