import { QualityCalculationUtil, CONFIGURATION_REQUIRED, resolveQualitySnapshotBasis, QualitySnapshotBasis } from './quality-calculation.util';
import { Product } from '../models/product.model';

const NOW = '2026-01-01T00:00:00.000Z';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prd-001',
    name: 'Block 20',
    productArea: 0.2,
    standardStrength: 15,
    active: true,
    createdAt: NOW,
    ...overrides
  };
}

describe('QualityCalculationUtil (Compression = Load ÷ Area)', () => {

  // ── regression 1: Compression = Load / ProductArea ───────────────────────
  it('regression 1: Compression is Load ÷ ProductArea', () => {
    // 3.2 kN ÷ 0.2 m² = 16
    expect(QualityCalculationUtil.calculateCompression(3.2, 0.2)).toBe(16);
    // 2.0 kN ÷ 0.25 m² = 8
    expect(QualityCalculationUtil.calculateCompression(2.0, 0.25)).toBe(8);
  });

  // ── regressions 2-3: standard boundary ────────────────────────────────────
  it('regression 2: Compression ≥ Standard → PASS (equal counts as pass)', () => {
    expect(QualityCalculationUtil.evaluate(15, 15)).toBe('PASS');
    expect(QualityCalculationUtil.evaluate(16, 15)).toBe('PASS');
  });

  it('regression 3: Compression < Standard → FAIL', () => {
    expect(QualityCalculationUtil.evaluate(14.9, 15)).toBe('FAIL');
    expect(QualityCalculationUtil.evaluate(12, 15)).toBe('FAIL');
  });

  // ── regression 4: Area snapshot surfaced ─────────────────────────────────
  it('regression 4: productArea snapshot is surfaced from the product master', () => {
    const evalResult = QualityCalculationUtil.evaluateFromProduct(3.2, makeProduct({ productArea: 0.2 }));
    expect(evalResult.productArea).toBe(0.2);
    expect(evalResult.compression).toBe(16);
  });

  // ── regression 5: Standard snapshot surfaced ─────────────────────────────
  it('regression 5: compressionStandard snapshot is surfaced from the product master', () => {
    const evalResult = QualityCalculationUtil.evaluateFromProduct(3.2, makeProduct({ standardStrength: 15 }));
    expect(evalResult.compressionStandard).toBe(15);
    expect(evalResult.result).toBe('PASS');
  });

  // ── regression 7: missing/zero Area → CONFIGURATION_REQUIRED ─────────────
  it('regression 7: missing or zero Product Area → no compression, CONFIGURATION_REQUIRED', () => {
    const missing = QualityCalculationUtil.evaluateFromProduct(3.2, makeProduct({ productArea: undefined }));
    expect(missing.productArea).toBeUndefined();
    expect(missing.compression).toBeUndefined();
    expect(missing.result).toBe(CONFIGURATION_REQUIRED);

    const zero = QualityCalculationUtil.evaluateFromProduct(3.2, makeProduct({ productArea: 0 }));
    expect(zero.compression).toBeUndefined();
    expect(zero.result).toBe(CONFIGURATION_REQUIRED);

    const negative = QualityCalculationUtil.evaluateFromProduct(3.2, makeProduct({ productArea: -0.5 }));
    expect(negative.compression).toBeUndefined();
    expect(negative.result).toBe(CONFIGURATION_REQUIRED);
  });

  // ── regression 8: missing Standard → CONFIGURATION_REQUIRED ──────────────
  it('regression 8: Compression may calculate but missing/zero Standard → CONFIGURATION_REQUIRED', () => {
    const missingStandard = QualityCalculationUtil.evaluateFromProduct(3.2, makeProduct({ standardStrength: undefined as unknown as number }));
    expect(missingStandard.compression).toBe(16);
    expect(missingStandard.compressionStandard).toBeUndefined();
    expect(missingStandard.result).toBe(CONFIGURATION_REQUIRED);

    const zeroStandard = QualityCalculationUtil.evaluateFromProduct(3.2, makeProduct({ standardStrength: 0 }));
    expect(zeroStandard.compression).toBe(16);
    expect(zeroStandard.result).toBe(CONFIGURATION_REQUIRED);
  });

  it('non-positive or non-finite load never fabricates a compression', () => {
    expect(QualityCalculationUtil.calculateCompression(0, 0.2)).toBeUndefined();
    expect(QualityCalculationUtil.calculateCompression(-3, 0.2)).toBeUndefined();
    expect(QualityCalculationUtil.calculateCompression(NaN, 0.2)).toBeUndefined();
  });

  // ── three-sample: per-sample evaluation ──────────────────────────────────
  it('evaluateSample computes Compression = Load ÷ Area and PASS/FAIL against the Standard', () => {
    const pass = QualityCalculationUtil.evaluateSample(3.2, 0.2, 15);
    expect(pass.compression).toBe(16);
    expect(pass.compressionResult).toBe('PASS');

    const fail = QualityCalculationUtil.evaluateSample(2.8, 0.2, 15);
    expect(QualityCalculationUtil.roundToDecimals(fail.compression as number)).toBe(14);
    expect(fail.compressionResult).toBe('FAIL');
  });

  it('evaluateSample with missing Area or Standard never fabricates a result → CONFIGURATION_REQUIRED', () => {
    const noArea = QualityCalculationUtil.evaluateSample(3.2, undefined, 15);
    expect(noArea.compression).toBeUndefined();
    expect(noArea.compressionResult).toBe(CONFIGURATION_REQUIRED);

    const noStandard = QualityCalculationUtil.evaluateSample(3.2, 0.2, 0);
    expect(noStandard.compression).toBe(16);
    expect(noStandard.compressionResult).toBe(CONFIGURATION_REQUIRED);
  });

  // ── three-sample: Height / Weight differences only (no PASS/FAIL tolerance)
  it('height/weight differences are Actual − Standard, rounded, and only when the Standard is configured', () => {
    expect(QualityCalculationUtil.heightDifference(200, 200)).toBe(0);
    expect(QualityCalculationUtil.heightDifference(205, 200)).toBe(5);
    expect(QualityCalculationUtil.heightDifference(198.5, 200)).toBe(-1.5);
    expect(QualityCalculationUtil.heightDifference(200, undefined)).toBeUndefined();
    expect(QualityCalculationUtil.heightDifference(200, 0)).toBeUndefined();

    expect(QualityCalculationUtil.weightDifference(101.25, 99)).toBe(2.25);
    expect(QualityCalculationUtil.weightDifference(100, undefined)).toBeUndefined();
  });

  // ── weight unit: ALL weight inputs/outputs are in kg (no mixed g/kg units) ──
  it('Weight Difference uses kg consistently against the verified standard weights', () => {
    // Solid 12 std 3.7 kg — actual sampled weights are compared in kg too
    expect(QualityCalculationUtil.weightDifference(3.8, 3.7)).toBe(0.1);
    expect(QualityCalculationUtil.weightDifference(3.7, 3.7)).toBe(0);
    expect(QualityCalculationUtil.weightDifference(3.45, 3.7)).toBe(-0.25);
    // Solid 10 std 2.5 kg
    expect(QualityCalculationUtil.weightDifference(2.6, 2.5)).toBe(0.1);
    expect(QualityCalculationUtil.weightDifference(2.4, 2.5)).toBe(-0.1);
    // Block weights stay kg as well
    expect(QualityCalculationUtil.weightDifference(19.5, 19)).toBe(0.5);
  });

  // ── three-sample: averages (confirmed AVERAGE regressions) ───────────────
  it('AVERAGE regression: Actual Heights 200/201/199 → 200', () => {
    expect(QualityCalculationUtil.average([200, 201, 199])).toBe(200);
  });

  it('AVERAGE regression: Actual Weights 12/12.4/11.6 → 12', () => {
    expect(QualityCalculationUtil.average([12, 12.4, 11.6])).toBe(12);
  });

  it('AVERAGE regression: Loads 120/126/114 → 120', () => {
    expect(QualityCalculationUtil.average([120, 126, 114])).toBe(120);
  });

  it('AVERAGE regression: Compressions 15/15.75/14.25 → 15 (averageCompression requires all three)', () => {
    expect(QualityCalculationUtil.averageCompression([15, 15.75, 14.25])).toBe(15);
    // (15 + 15.75 + 14.25) / 3 = 15 exactly — no FP artifact
    expect(QualityCalculationUtil.averageCompression([15, 15.75, 14.25])).toBe(15);
    // averages never fabricate a result from partial values
    expect(QualityCalculationUtil.averageCompression([15, 15.75, undefined])).toBeUndefined();
    expect(QualityCalculationUtil.averageCompression([])).toBeUndefined();
  });

  it('PASS/FAIL statuses are never averaged and no combined Quality Score is produced', () => {
    // averageCompression returns a number (the mean) or undefined — never a PASS/FAIL status.
    const mean = QualityCalculationUtil.averageCompression([16, 17, 15]);
    expect(typeof mean).toBe('number');
    expect(mean).toBe(16);
    // a single failing sample does NOT fail the event at util level — results are per sample.
    const result = QualityCalculationUtil.evaluateSample(2.8, 0.2, 15).compressionResult;
    expect(result).toBe('FAIL');
  });

  it('roundToDecimals removes floating-point display artifacts', () => {
    expect(QualityCalculationUtil.roundToDecimals(0.1 + 0.2, 2)).toBe(0.3);
    expect(QualityCalculationUtil.roundToDecimals(16.0000000004, 2)).toBe(16);
  });
});

// ═══════════ QUAL HISTORICAL-INTEGRITY (CURRENT master → NEW, SNAPSHOTS → EXISTING) ═══════════

describe('Quality snapshot historical integrity (resolveQualitySnapshotBasis)', () => {

  // Record created EARLIER under the old master.
  const HISTORICAL: QualitySnapshotBasis = {
    productArea: 0.2, compressionStandard: 180, standardHeight: 200, standardWeight: 99
  };
  // Current (today's) master AFTER the admin changed the Product configuration.
  const CURRENT: QualitySnapshotBasis = {
    productArea: 0.25, compressionStandard: 190, standardHeight: 210, standardWeight: 110
  };

  const resolve = (over: Partial<{
    isEdit: boolean; productChanged: boolean; historical: QualitySnapshotBasis; current: QualitySnapshotBasis;
  }> = {}): QualitySnapshotBasis =>
    resolveQualitySnapshotBasis({
      isEdit: over.isEdit ?? false,
      productChanged: over.productChanged ?? false,
      historical: over.historical ?? {},
      current: over.current ?? CURRENT
    });

  it('QUAL-HIST-01. Area snapshot A survives editing an unrelated field after master Area became B', () => {
    const basis = resolve({ isEdit: true, productChanged: false, historical: HISTORICAL });
    expect(basis.productArea).toBe(0.2);          // stored A — NOT today's 0.25
  });

  it('QUAL-HIST-02. Compression Standard snapshot 180 survives an unrelated edit after master became 190', () => {
    const basis = resolve({ isEdit: true, productChanged: false, historical: HISTORICAL });
    expect(basis.compressionStandard).toBe(180);   // stored 180 — NOT today's 190
  });

  it('QUAL-HIST-03. PASS/FAIL after edit keeps using the historical 180 (Load 37 ÷ 0.2 = 185 → PASS)', () => {
    const basis = resolve({ isEdit: true, productChanged: false, historical: HISTORICAL });
    const evaluation = QualityCalculationUtil.evaluateSample(37, basis.productArea, basis.compressionStandard);
    expect(evaluation.compression).toBe(185);
    expect(evaluation.compressionResult).toBe('PASS'); // 185 ≥ 180 (historical snapshot)
    // Control: today's master (190) would FAIL the same historical measurement.
    expect(QualityCalculationUtil.evaluate(185, CURRENT.compressionStandard)).toBe('FAIL');
  });

  it('QUAL-HIST-04. Standard Height/Weight snapshots remain historical after an unrelated edit', () => {
    const basis = resolve({ isEdit: true, productChanged: false, historical: HISTORICAL });
    expect(basis.standardHeight).toBe(200);
    expect(basis.standardWeight).toBe(99);
  });

  it('QUAL-HIST-05. A NEW event created after the master change uses the NEW master values', () => {
    const basis = resolve({ isEdit: false, historical: HISTORICAL });
    expect(basis.productArea).toBe(0.25);
    expect(basis.compressionStandard).toBe(190);
    expect(basis.standardHeight).toBe(210);
    expect(basis.standardWeight).toBe(110);
  });

  it('edit that CHANGES the Product takes snapshots from the newly selected Product master (no mixing)', () => {
    const basis = resolve({ isEdit: true, productChanged: true, historical: HISTORICAL });
    expect(basis.productArea).toBe(0.25);
    expect(basis.compressionStandard).toBe(190);
    expect(basis.standardHeight).toBe(210);
    expect(basis.standardWeight).toBe(110);
  });

  it('edit of an unchanged Product falls back to current master only for a snapshot the record never stored', () => {
    const basis = resolve({
      isEdit: true, productChanged: false,
      historical: { productArea: 0.2, compressionStandard: 180, standardHeight: undefined, standardWeight: undefined }
    });
    expect(basis.productArea).toBe(0.2);
    expect(basis.compressionStandard).toBe(180);
    expect(basis.standardHeight).toBe(210); // no stored snapshot → not invented → today's fallback
    expect(basis.standardWeight).toBe(110);
  });
});