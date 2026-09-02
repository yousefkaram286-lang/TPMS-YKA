import { Product } from '../models/product.model';
import { MasterDataUtil } from './master-data.util';

export const CONFIGURATION_REQUIRED = 'CONFIGURATION_REQUIRED' as const;

export type QualityResultStatus = 'PASS' | 'FAIL' | typeof CONFIGURATION_REQUIRED;

export interface QualityEvaluation {
  load: number;
  productArea?: number;
  compression?: number;
  compressionStandard?: number;
  result: QualityResultStatus;
}

/**
 * Authoritative Quality calculation rule (confirmed business model):
 *
 *   Compression = Load ÷ Product Area
 *   Compression ≥ Compression Standard → PASS
 *   Compression <  Compression Standard → FAIL
 *
 * Product Area and Compression Standard are ALWAYS read from the Product
 * master. A missing, zero, or non-finite Area / Standard / Load means the test
 * cannot be evaluated: the result is CONFIGURATION_REQUIRED and NO compression
 * is fabricated.
 *
 * No unit conversions are invented here — the caller (factory config / product
 * master) must keep Load, Area and Standard in consistent units.
 */
/**
 * Historical-integrity rule for the master-derived Quality snapshots.
 *
 * CURRENT MASTER DATA controls NEW transactions; HISTORICAL SNAPSHOTS control
 * EXISTING historical transactions:
 *
 * - CREATE (not an edit) → the four snapshot values come from the CURRENT
 *   Product Master of the selected product.
 * - EDIT where the operator changed the Product → snapshots come from the
 *   CURRENT master of the newly selected product. A changed Product is a new
 *   transaction: old snapshots are never mixed with a different Product.
 * - EDIT where the Product is UNCHANGED → the record's stored historical
 *   snapshots are preserved verbatim (an unrelated field edit must not
 *   silently re-interpret the record against today's master). A missing
 *   stored snapshot falls back to the current master value rather than
 *   inventing data the model never stored.
 */
export interface QualitySnapshotBasis {
  productArea?: number;
  compressionStandard?: number;
  standardHeight?: number;
  standardWeight?: number;
}

export interface QualitySnapshotResolution {
  isEdit: boolean;
  productChanged: boolean;
  historical: QualitySnapshotBasis;
  current: QualitySnapshotBasis;
}

export function resolveQualitySnapshotBasis(input: QualitySnapshotResolution): QualitySnapshotBasis {
  if (input.isEdit && !input.productChanged) {
    return {
      productArea: input.historical.productArea ?? input.current.productArea,
      compressionStandard: input.historical.compressionStandard ?? input.current.compressionStandard,
      standardHeight: input.historical.standardHeight ?? input.current.standardHeight,
      standardWeight: input.historical.standardWeight ?? input.current.standardWeight
    };
  }
  return { ...input.current };
}

export class QualityCalculationUtil {

  /**
   * Compression = Load ÷ ProductArea.
   * Returns undefined (never a fabricated number) when the area is missing,
   * zero or non-finite, or the load is not a positive number.
   */
  static calculateCompression(load: number, productArea: number | undefined | null): number | undefined {
    const areaConfigured = typeof productArea === 'number' && Number.isFinite(productArea) && productArea > 0;
    if (!areaConfigured || !Number.isFinite(load) || !(load > 0)) {
      return undefined;
    }
    return load / (productArea as number);
  }

  /**
   * Compression ≥ Standard → PASS, Compression < Standard → FAIL.
   * Missing / zero / non-finite compression or standard → CONFIGURATION_REQUIRED.
   */
  static evaluate(compression: number | undefined, compressionStandard: number | undefined): QualityResultStatus {
    const compressionReady = typeof compression === 'number' && Number.isFinite(compression);
    const standardReady = typeof compressionStandard === 'number' && Number.isFinite(compressionStandard) && compressionStandard > 0;
    if (!compressionReady || !standardReady) {
      return CONFIGURATION_REQUIRED;
    }
    return compression >= (compressionStandard as number) ? 'PASS' : 'FAIL';
  }

  /**
   * Full evaluation from a Product master record. Snapshots the configured
   * Area and Standard so the caller can persist the exact evaluation inputs.
   */
  static evaluateFromProduct(load: number, product: Product | undefined | null): QualityEvaluation {
    const productArea = MasterDataUtil.productAreaOf(product);
    const compression = this.calculateCompression(load, productArea);
    const compressionStandard = MasterDataUtil.compressionStandardOf(product);
    return {
      load,
      productArea,
      compression,
      compressionStandard,
      result: this.evaluate(compression, compressionStandard)
    };
  }

  /**
   * Per-sample compression + result from the sample load and the Product
   * Master snapshots. Returns CONFIGURATION_REQUIRED (never a fabricated
   * result) when Area or Compression Standard is unavailable.
   */
  static evaluateSample(
    load: number,
    productArea: number | undefined | null,
    compressionStandard: number | undefined | null
  ): { compression: number | undefined; compressionResult: QualityResultStatus } {
    const compression = this.calculateCompression(load, productArea);
    return {
      compression,
      compressionResult: this.evaluate(compression, compressionStandard ?? undefined)
    };
  }

  // ─── Height / Weight ────────────────────────────────────────────────────────
  // No PASS/FAIL acceptance tolerance exists yet — only Difference is computed.
  // A missing/zero/negative standard yields NO difference (CONFIGURATION_REQUIRED).

  /** Difference = Actual − Standard. Rounded to 2 decimals to avoid FP artifacts. */
  static heightDifference(actualHeight: number, standardHeight: number | undefined | null): number | undefined {
    if (!Number.isFinite(actualHeight) || !MasterDataUtil.isConfiguredPositive(standardHeight)) {
      return undefined;
    }
    return this.roundToDecimals(actualHeight - (standardHeight as number));
  }

  /** Difference = Actual − Standard. Rounded to 2 decimals to avoid FP artifacts. */
  static weightDifference(actualWeight: number, standardWeight: number | undefined | null): number | undefined {
    if (!Number.isFinite(actualWeight) || !MasterDataUtil.isConfiguredPositive(standardWeight)) {
      return undefined;
    }
    return this.roundToDecimals(actualWeight - (standardWeight as number));
  }

  // ─── Averages ────────────────────────────────────────────────────────────────
  // PASS/FAIL statuses are NEVER averaged. Compression averages require ALL
  // three valid Compression values before a final number is produced; otherwise
  // the average is undefined (displayed as CONFIGURATION_REQUIRED).

  /** Rounds a number to a fixed number of decimals, removing FP display artifacts. */
  static roundToDecimals(value: number, decimals = 2): number {
    if (!Number.isFinite(value)) {
      return NaN;
    }
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /** Average of the finite values, rounded to 2 decimals. Undefined when no values. */
  static average(values: number[]): number | undefined {
    const valid = values.filter(v => Number.isFinite(v));
    if (valid.length === 0) {
      return undefined;
    }
    return this.roundToDecimals(valid.reduce((sum, v) => sum + v, 0) / valid.length);
  }

  /**
   * Average Compression is only produced when EVERY sample has a valid stored
   * Compression. If any sample cannot calculate Compression (Area/config
   * unavailable), the average is undefined — never fabricated from partial
   * values.
   */
  static averageCompression(compressions: Array<number | undefined | null>): number | undefined {
    if (compressions.length === 0 || !compressions.every(c => Number.isFinite(c))) {
      return undefined;
    }
    return this.roundToDecimals(
      (compressions as number[]).reduce((sum, c) => sum + c, 0) / compressions.length
    );
  }
}