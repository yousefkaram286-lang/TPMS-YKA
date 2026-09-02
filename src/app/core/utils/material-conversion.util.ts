import { MasterDataUtil } from './master-data.util';

export const OK = 'OK' as const;
export const CONFIGURATION_REQUIRED = 'CONFIGURATION_REQUIRED' as const;

export type ConversionStatus = typeof OK | typeof CONFIGURATION_REQUIRED;

export interface KgToM3Result {
  cubicMeters: number;
  status: ConversionStatus;
}

export interface UnitPriceConversion {
  pricePerOperationalUnit: number;
  compatible: boolean;
}

/**
 * Reusable domain conversions for the corrected Materials model.
 *
 * Daily totals are ALWAYS MixCount × per-mix quantity — never derived from
 * Presses, PiecesPerPress, or ProducedQuantity.
 *
 * kg → m³ conversions are REPORT/display-only: they use the configured
 * per-material factor (SandKgPerM3 / AggregateKgPerM3) and never mutate the
 * stored kg values. A missing/zero factor yields CONFIGURATION_REQUIRED,
 * never a fabricated number.
 *
 * Cost pricing conversions are explicit metric relations only (1000 kg = 1
 * metric ton; 1000 L = 1 m³). Anything else is dimensionally incompatible and
 * cost must be deferred.
 */
export class MaterialConversionUtil {

  /** Daily total = perMix × mixCount. Authoritative materials rule. */
  static dailyFromPerMix(perMix: number, mixCount: number): number {
    return perMix * mixCount;
  }

  /**
   * Report conversion: kg → m³ using the configured per-material factor.
   * Returns CONFIGURATION_REQUIRED (not a fabricated value) when the factor
   * is missing, zero, null or non-finite.
   */
  static kgToM3(kg: number, kgPerM3: number | undefined | null): KgToM3Result {
    if (!MasterDataUtil.isConfiguredConversion(kgPerM3)) {
      return { cubicMeters: 0, status: CONFIGURATION_REQUIRED };
    }
    return { cubicMeters: kg / (kgPerM3 as number), status: OK };
  }

  /**
   * Resolves a unit-cost config to a price per operational unit.
   * Compatible when the units are identical or an exact metric relation.
   * Incompatible → { pricePerOperationalUnit: 0, compatible: false } so the
   * caller can DEFFER the cost and warn instead of fabricating assumptions.
   */
  static perUnitPriceFromConfig(
    price: number,
    priceUnit: string | undefined | null,
    operationalUnit: string
  ): UnitPriceConversion {
    const u = (priceUnit || '').trim().toLowerCase();
    const op = (operationalUnit || '').trim().toLowerCase();

    if (!u || !op || !Number.isFinite(price)) {
      return { pricePerOperationalUnit: 0, compatible: false };
    }

    if (u === op) {
      return { pricePerOperationalUnit: price, compatible: true };
    }

    // 1 metric ton = 1000 kg
    if (MaterialConversionUtil.isMetricTon(u) && op === 'kg') {
      return { pricePerOperationalUnit: price / 1000, compatible: true };
    }
    if (u === 'kg' && MaterialConversionUtil.isMetricTon(op)) {
      return { pricePerOperationalUnit: price * 1000, compatible: true };
    }

    // 1 m³ = 1000 L
    if (MaterialConversionUtil.isCubicMeter(u) && op === 'l') {
      return { pricePerOperationalUnit: price / 1000, compatible: true };
    }
    if (u === 'l' && MaterialConversionUtil.isCubicMeter(op)) {
      return { pricePerOperationalUnit: price * 1000, compatible: true };
    }

    return { pricePerOperationalUnit: 0, compatible: false };
  }

  static isMetricTon(u: string): boolean {
    return u === 'ton' || u === 'tonne' || u === 'mt' || u === 'metricton';
  }

  static isCubicMeter(u: string): boolean {
    return u === 'm3' || u === 'm³' || u === 'cm' || u === 'cubicmeter';
  }
}