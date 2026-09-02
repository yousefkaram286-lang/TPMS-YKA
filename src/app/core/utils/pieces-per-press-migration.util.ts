/**
 * Pure logic for the PiecesPerPress backfill migration.
 * Extracted for testability — no Angular / IndexedDB dependencies.
 */

export interface MigrationProduct {
  id: string;
  name: string;
  piecesPerPress?: number;
  [key: string]: any;
}

export interface MigrationConfig {
  productId: string;
  piecesPerPress: number;
  [key: string]: any;
}

export interface BackfillResult {
  /** Products that were safely backfilled (1 distinct legacy value). */
  migrated: Array<{ productId: string; piecesPerPress: number }>;
  /** Products with conflicting legacy values (2+ distinct) — requires manual resolution. */
  conflicts: Array<{ productId: string; productName: string; values: number[] }>;
  /** Products with no valid legacy values — left unconfigured. */
  unconfigured: string[];
}

/**
 * Determines which Products can be safely backfilled from legacy
 * ProductMachineConfig data.
 *
 * Rules:
 * - Products with piecesPerPress already > 0 are never touched.
 * - Collect ALL distinct positive legacy values per Product.
 * - 1 distinct value → safely backfill.
 * - 0 distinct values → leave unconfigured.
 * - 2+ distinct values → leave unconfigured (conflict).
 */
export function computePiecesPerPressBackfill(
  products: MigrationProduct[],
  configs: MigrationConfig[]
): BackfillResult {
  const migrated: BackfillResult['migrated'] = [];
  const conflicts: BackfillResult['conflicts'] = [];
  const unconfigured: string[] = [];

  for (const p of products) {
    if (p.piecesPerPress && p.piecesPerPress > 0) continue;

    const distinctValues = [...new Set(
      configs
        .filter(c => c.productId === p.id && c.piecesPerPress > 0)
        .map(c => c.piecesPerPress)
    )];

    if (distinctValues.length === 1) {
      migrated.push({ productId: p.id, piecesPerPress: distinctValues[0] });
    } else if (distinctValues.length > 1) {
      conflicts.push({ productId: p.id, productName: p.name, values: distinctValues });
    } else {
      unconfigured.push(p.id);
    }
  }

  return { migrated, conflicts, unconfigured };
}
