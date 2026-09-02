import { Product } from '../models/product.model';
import { Material } from '../models/material.model';
import { Recipe } from '../models/recipe.model';
import { VERIFIED_PRODUCTS, DEMO_LEGACY_PRODUCT_NAMES, VerifiedProductSeed } from '../constants/seed-data';

// ============================================================================
// Verified Factory Master Data migration — PURE planning logic (idempotent).
// ----------------------------------------------------------------------------
// Safety rules (business-confirmed):
//  - Existing Products matching a verified product (by stable id or name) are
//    UPDATED IN PLACE and KEEP their id — historical Production / Quality /
//    Recipe / Release references stay valid.
//  - Verified values that are NOT configured on SOLID products (density,
//    dimensions) PRESERVE an existing approved value — they are never wiped and
//    never invented. Standard weights and Product Areas are VERIFIED for ALL
//    products and always normalize to the business-confirmed value.
//  - Known demo products ('Interlock') are DEACTIVATED, never deleted.
//  - Recipes are never deleted; clearly demo/legacy recipes (reference an
//    inactive product or an inactive material such as Admixture) are flagged
//    with `demo: true`.
//  - Products NOT in the verified set are left untouched (no silent config
//    overwrites).
// ============================================================================

export interface MasterDataMigrationPlan {
  /** Existing products to normalize in place (same id kept). */
  productUpdates: Product[];
  /** Genuinely new verified products to add. */
  productCreates: Product[];
  /** Known demo products to deactivate (never deleted). */
  productDeactivations: Product[];
  /** Legacy demo recipes flagged with demo: true (never deleted). */
  recipeUpdates: Recipe[];
}

export interface MasterDataMigrationOptions {
  verified?: VerifiedProductSeed[];
  demoLegacyProductNames?: string[];
  now?: string;
}

function normalizeName(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

function isConfiguredPositive(value: number | undefined | null): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Maps a verified spec into a full Product record (id preserved when an existing record was found). */
export function buildVerifiedProduct(spec: VerifiedProductSeed, existing?: Product | null, now?: string): Product {
  const timestamp = now || new Date().toISOString();
  const keepApproved = (verified: number | undefined, current: number | undefined): number | undefined =>
    isConfiguredPositive(verified) ? verified : isConfiguredPositive(current) ? current : undefined;

  return {
    id: existing?.id ?? spec.id,
    name: spec.name,
    nameAr: spec.nameAr,
    type: spec.type,
    piecesPerPress: spec.piecesPerPress,
    productArea: keepApproved(spec.productArea, existing?.productArea),
    standardStrength: spec.compressionStandard,
    standardHeight: spec.standardHeight,
    standardWeight: keepApproved(spec.standardWeight, existing?.standardWeight),
    dimensions: spec.dimensions ?? existing?.dimensions,
    densityKgPerM3: keepApproved(spec.densityKgPerM3, existing?.densityKgPerM3),
    active: true,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: existing ? timestamp : undefined
  };
}

function findTarget(
  products: Product[],
  spec: VerifiedProductSeed,
  claimedIds: Set<string>
): Product | undefined {
  const specNames = new Set<string>(
    [spec.name, spec.nameAr, ...(spec.legacyNames || [])]
      .filter((n): n is string => !!n && n.trim().length > 0)
      .map(normalizeName)
  );

  const byId = products.find(p => p.id === spec.id && !claimedIds.has(p.id));
  if (byId) {
    return byId;
  }

  return products.find(p => !claimedIds.has(p.id) && specNames.has(normalizeName(p.name)));
}

/**
 * Computes the full idempotent migration plan for the given master data.
 * Pure function — never touches storage directly.
 */
export function computeMasterDataMigration(
  products: Product[],
  materials: Material[],
  recipes: Recipe[],
  options?: MasterDataMigrationOptions
): MasterDataMigrationPlan {
  const verified = options?.verified ?? VERIFIED_PRODUCTS;
  const demoNames = (options?.demoLegacyProductNames ?? DEMO_LEGACY_PRODUCT_NAMES).map(normalizeName);
  const now = options?.now ?? new Date().toISOString();

  const plan: MasterDataMigrationPlan = {
    productUpdates: [],
    productCreates: [],
    productDeactivations: [],
    recipeUpdates: []
  };

  // Confirm exclusively to avoid two verified products claiming the same record.
  const claimed = new Set<string>();

  for (const spec of verified) {
    const target = findTarget(products, spec, claimed);
    if (target) {
      claimed.add(target.id);
      plan.productUpdates.push(buildVerifiedProduct(spec, target, now));
    } else {
      plan.productCreates.push(buildVerifiedProduct(spec, null, now));
    }
  }

  // Deactivate known demo products (never delete).
  for (const p of products) {
    if (p.active && demoNames.includes(normalizeName(p.name))) {
      plan.productDeactivations.push({ ...p, active: false, updatedAt: now });
    }
  }

  // Effective final product state (post-normalization) for recipe checks.
  const finalProducts = new Map<string, Product>();
  products.forEach(p => finalProducts.set(p.id, p));
  [...plan.productUpdates, ...plan.productDeactivations, ...plan.productCreates].forEach(p => finalProducts.set(p.id, p));

  const materialMap = new Map<string, Material>();
  materials.forEach(m => materialMap.set(m.id, m));

  // Flag clearly demo/legacy recipes — never delete them.
  for (const recipe of recipes) {
    if (recipe.demo) {
      continue;
    }
    const product = finalProducts.get(recipe.productId);
    const referencesInactiveProduct = !!product && !product.active;
    const usesInactiveMaterial = (recipe.items || []).some(item => {
      const mat = materialMap.get(item.materialId);
      return !!mat && !mat.active;
    });
    if (referencesInactiveProduct || usesInactiveMaterial) {
      plan.recipeUpdates.push({ ...recipe, demo: true, updatedAt: now });
    }
  }

  return plan;
}