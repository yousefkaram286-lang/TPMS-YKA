import { MaterialConversionUtil, OK, CONFIGURATION_REQUIRED } from './material-conversion.util';

describe('MaterialConversionUtil', () => {

  // ── Daily totals: MixCount × per-mix (authoritative rule) ──────────────
  it('regression 1: MixCount 20 × Cement 210 kg/Mix → DailyCementKg 4200', () => {
    expect(MaterialConversionUtil.dailyFromPerMix(210, 20)).toBe(4200);
  });

  it('regression 2: MixCount 20 × Sand 380 kg/Mix → DailySandKg 7600', () => {
    expect(MaterialConversionUtil.dailyFromPerMix(380, 20)).toBe(7600);
  });

  it('regression 3: MixCount 20 × Aggregate 515 kg/Mix → DailyAggregateKg 10300', () => {
    expect(MaterialConversionUtil.dailyFromPerMix(515, 20)).toBe(10300);
  });

  it('regression 4: MixCount 20 × Water 95 L/Mix → DailyWaterL 1900', () => {
    expect(MaterialConversionUtil.dailyFromPerMix(95, 20)).toBe(1900);
  });

  it('dailyFromPerMix is pure — no Press/PiecesPerPress/ProducedQuantity input exists', () => {
    // Changing any press-derived concept cannot affect this formula by design.
    const daily = MaterialConversionUtil.dailyFromPerMix(210, 20);
    expect(daily).toBe(4200);
    expect(MaterialConversionUtil.dailyFromPerMix(0, 999)).toBe(0);
    expect(MaterialConversionUtil.dailyFromPerMix(210, 0)).toBe(0);
  });

  // ── kg → m³ report conversion with configured factor ─────────────────────
  it('regression 13: Sand kg → m³ uses configured SandKgPerM3', () => {
    const r = MaterialConversionUtil.kgToM3(7600, 1600); // SandKgPerM3
    expect(r.status).toBe(OK);
    expect(r.cubicMeters).toBe(4.75);
  });

  it('regression 14: Aggregate kg → m³ uses configured AggregateKgPerM3', () => {
    const r = MaterialConversionUtil.kgToM3(10300, 1400); // AggregateKgPerM3
    expect(r.status).toBe(OK);
    expect(r.cubicMeters).toBeCloseTo(7.35714, 5);
  });

  it('regression 15: missing/zero conversion returns CONFIGURATION REQUIRED — no invented result', () => {
    expect(MaterialConversionUtil.kgToM3(7600, undefined).status).toBe(CONFIGURATION_REQUIRED);
    expect(MaterialConversionUtil.kgToM3(7600, null).status).toBe(CONFIGURATION_REQUIRED);
    expect(MaterialConversionUtil.kgToM3(7600, 0).status).toBe(CONFIGURATION_REQUIRED);
    expect(MaterialConversionUtil.kgToM3(7600, -1).status).toBe(CONFIGURATION_REQUIRED);
    expect(MaterialConversionUtil.kgToM3(7600, NaN).status).toBe(CONFIGURATION_REQUIRED);
    const el = MaterialConversionUtil.kgToM3(7600, undefined);
    expect(el.cubicMeters).toBe(0);
  });

  it('regression 16: conversion is computed, never overwrites stored kg', () => {
    const storedDailyKg = 7600;
    const r = MaterialConversionUtil.kgToM3(storedDailyKg, 1600);
    expect(r.cubicMeters).toBe(4.75);
    expect(storedDailyKg).toBe(7600);            // input untouched
    expect(r.cubicMeters).not.toBe(storedDailyKg); // output is a derived figure
  });

  // ── Unit-cost dimension safety ───────────────────────────────────────────
  it('compatible price per ton → per kg uses the exact metric conversion (80/ton → 0.08/kg)', () => {
    const r = MaterialConversionUtil.perUnitPriceFromConfig(80, 'ton', 'kg');
    expect(r.compatible).toBeTrue();
    expect(r.pricePerOperationalUnit).toBe(0.08);
  });

  it('compatible price per m³ → per L uses the exact metric conversion (2/m³ → 0.002/L)', () => {
    const r = MaterialConversionUtil.perUnitPriceFromConfig(2, 'm3', 'L');
    expect(r.compatible).toBeTrue();
    expect(r.pricePerOperationalUnit).toBe(0.002);
  });

  it('identical units are compatible at the configured price', () => {
    expect(MaterialConversionUtil.perUnitPriceFromConfig(0.02, 'kg', 'kg'))
      .toEqual({ pricePerOperationalUnit: 0.02, compatible: true });
    expect(MaterialConversionUtil.perUnitPriceFromConfig(0.05, 'L', 'L'))
      .toEqual({ pricePerOperationalUnit: 0.05, compatible: true });
  });

  it('dimensionally incompatible unit pricing is deferred (never multiplied as-is)', () => {
    // kg quantity with a per-m³ price, or L with a per-kg price: defer.
    const a = MaterialConversionUtil.perUnitPriceFromConfig(80, 'm3', 'kg');
    expect(a.compatible).toBeFalse();
    expect(a.pricePerOperationalUnit).toBe(0);
    const b = MaterialConversionUtil.perUnitPriceFromConfig(5, 'kg', 'L');
    expect(b.compatible).toBeFalse();
    expect(b.pricePerOperationalUnit).toBe(0);
  });

  it('unknown units, empty units, and non-finite prices are unsupported → deferred', () => {
    const unknown = MaterialConversionUtil.perUnitPriceFromConfig(80, 'box', 'kg');
    expect(unknown.compatible).toBeFalse();
    const empty = MaterialConversionUtil.perUnitPriceFromConfig(80, '', 'kg');
    expect(empty.compatible).toBeFalse();
    const nan = MaterialConversionUtil.perUnitPriceFromConfig(NaN, 'kg', 'kg');
    expect(nan.compatible).toBeFalse();
  });
});