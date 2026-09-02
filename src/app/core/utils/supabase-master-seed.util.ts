import { VerifiedProductSeed, VERIFIED_PRODUCTS, SEED_LINES, SEED_MATERIALS, SEED_LINE_PRODUCTS } from '../constants/seed-data';

// ============================================================================
// Supabase Master Data seed planner — PURE planning logic (additive, idempotent,
// non-destructive). Never deletes. Never overwrites an existing value.
//
// Business-confirmed baseline (Toblat) — the SAME verified values the legacy
// IndexedDB migration used, now planned against the central Supabase tables:
//   - Lines 1 … 5 (stable ids lin-001 … lin-005)
//   - 7 confirmed products (Solid 12/10, Block 25/20/15/12/10) with their
//     PiecesPerPress, ProductArea, StandardWeight, CompressionStandard
//   - Materials Cement / Sand / Aggregate / Water (Sand 1625, Aggregate
//     1550 kg/m³ conversion factors)
//   - Line ↔ Product mappings (Line 1/2 → all 7, Line 3/4 → Solid 10+12,
//     Line 5 → NONE — Interlock definition unconfirmed, never invented)
//
// Conflict policy (task requirement): if a matching record already exists with
// a different value → DO NOT overwrite → report it in `conflicts`.
// Conversion factors are backfilled only when missing/unset; an operator-set
// positive value is never overwritten (differs → reported as a conflict).
// ============================================================================

export type SeedConflictEntity = 'line' | 'product' | 'material' | 'line_product';

export interface SupabaseSeedConflict {
  entity: SeedConflictEntity;
  seedId: string;
  field?: string;
  expected?: unknown;
  actual?: unknown;
  message: string;
}

export interface SupabaseMasterSeedPlan {
  linesToInsert: any[];
  productsToInsert: any[];
  materialsToInsert: any[];
  materialConversionBackfills: { id: string; conversion_kg_per_m3: number; updated_at: string }[];
  mappingsToInsert: any[];
  conflicts: SupabaseSeedConflict[];
}

export interface SupabaseMasterSeedOptions {
  products?: VerifiedProductSeed[];
  lines?: { id: string; name: string; active: boolean }[];
  materials?: { id: string; name: string; unit: string; active: boolean; conversion_kg_per_m3: number | null }[];
  mappings?: { id: string; lineId: string; productId: string }[];
  now?: string;
}

function isConfiguredPositive(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim();
}

/** True when the seed's confirmed value differs from the existing row value. */
function differs(seedValue: string | number | boolean | null | undefined, existingValue: string | number | boolean | null | undefined): boolean {
  if (seedValue === null || seedValue === undefined) {
    return false; // field not confirmed by seed → never a conflict
  }
  if (typeof seedValue === 'string') {
    return normalize(seedValue) !== normalize(existingValue as string | null | undefined);
  }
  return seedValue !== (existingValue ?? null);
}

function toProductRow(p: VerifiedProductSeed, now: string): any {
  return {
    id: p.id,
    name: p.name,
    name_ar: p.nameAr ?? null,
    type: p.type,
    pieces_per_press: p.piecesPerPress,
    product_area: p.productArea ?? null,
    standard_strength: p.compressionStandard,
    standard_height: p.standardHeight,
    standard_weight: p.standardWeight ?? null,
    dimensions: p.dimensions ?? null,
    density_kg_per_m3: p.densityKgPerM3 ?? null,
    active: true,
    created_at: now
  };
}

function buildSeedRows(options: SupabaseMasterSeedOptions, now: string) {
  const products = options.products ?? VERIFIED_PRODUCTS;
  const lines = options.lines ?? SEED_LINES.map(l => ({ id: l.id, name: l.name, active: l.active }));
  const materials = options.materials
    ?? SEED_MATERIALS.filter(m => m.active).map(m => ({
      id: m.id, name: m.name, unit: m.unit, active: m.active,
      conversion_kg_per_m3: m.conversionKgPerM3 ?? null
    }));
  const mappings = options.mappings ?? SEED_LINE_PRODUCTS.map(lp => ({ id: lp.id, lineId: lp.lineId, productId: lp.productId }));
  return { products, lines, materials, mappings };
}

export function computeSupabaseMasterSeedPlan(
  existingLines: any[],
  existingProducts: any[],
  existingMaterials: any[],
  existingMappings: any[],
  options?: SupabaseMasterSeedOptions
): SupabaseMasterSeedPlan {
  const now = options?.now ?? new Date().toISOString();
  const { products, lines, materials, mappings } = buildSeedRows(options ?? {}, now);

  const plan: SupabaseMasterSeedPlan = {
    linesToInsert: [],
    productsToInsert: [],
    materialsToInsert: [],
    materialConversionBackfills: [],
    mappingsToInsert: [],
    conflicts: []
  };
  const conflict = (c: Omit<SupabaseSeedConflict, 'message'> & { message?: string }): void => {
    plan.conflicts.push({
      entity: c.entity,
      seedId: c.seedId,
      field: c.field,
      expected: c.expected,
      actual: c.actual,
      message: c.message ?? 'Existing row was not overwritten.'
    });
  };

  // ── Lines: insert missing by stable id; same-name/renamed rows are conflicts ──
  const lineById = new Map(existingLines.map((l: any) => [l.id, l]));
  for (const target of lines) {
    const existing = lineById.get(target.id);
    if (!existing) {
      const nameCollision = existingLines.find((l: any) => normalize(l.name) === normalize(target.name) && l.id !== target.id);
      if (nameCollision) {
        conflict({
          entity: 'line', seedId: target.id, field: 'name',
          expected: target.name, actual: nameCollision.name,
          message: `Line '${target.name}' already exists under id '${nameCollision.id}'; ${target.id} was NOT created to avoid a duplicate.`
        });
        continue;
      }
      plan.linesToInsert.push({ id: target.id, name: target.name, active: target.active, created_at: now });
    } else if (differs(target.name, existing.name)) {
      conflict({
        entity: 'line', seedId: target.id, field: 'name',
        expected: target.name, actual: existing.name,
        message: `Line '${existing.name}' exists under ${target.id}; the name was NOT overwritten.`
      });
    }
  }

  // ── Products: insert missing by stable id; never overwrite existing values ──
  const productById = new Map(existingProducts.map((p: any) => [p.id, p]));
  const PRODUCT_FIELDS: { field: string; seed(p: VerifiedProductSeed): string | number | boolean | null }[] = [
    { field: 'name', seed: p => p.name },
    { field: 'name_ar', seed: p => p.nameAr ?? null },
    { field: 'type', seed: p => p.type },
    { field: 'pieces_per_press', seed: p => p.piecesPerPress },
    { field: 'product_area', seed: p => p.productArea ?? null },
    { field: 'standard_strength', seed: p => p.compressionStandard },
    { field: 'standard_height', seed: p => p.standardHeight },
    { field: 'standard_weight', seed: p => p.standardWeight ?? null },
    { field: 'dimensions', seed: p => p.dimensions ?? null },
    { field: 'density_kg_per_m3', seed: p => p.densityKgPerM3 ?? null },
    { field: 'active', seed: () => true }
  ];
  for (const target of products) {
    const row = toProductRow(target, now);
    const existing = productById.get(target.id);
    if (!existing) {
      const nameCollision = existingProducts.find(
        (p: any) => normalize(p.name) === normalize(target.name) && p.id !== target.id
      );
      if (nameCollision) {
        conflict({
          entity: 'product', seedId: target.id, field: 'name',
          expected: target.name, actual: nameCollision.name,
          message: `Product '${target.name}' already exists under id '${nameCollision.id}'; ${target.id} was NOT created to avoid a duplicate.`
        });
        continue;
      }
      plan.productsToInsert.push(row);
    } else {
      for (const f of PRODUCT_FIELDS) {
        const seedValue = f.seed(target);
        const existingValue = existing[f.field];
        if (differs(seedValue, existingValue)) {
          conflict({
            entity: 'product', seedId: target.id, field: f.field,
            expected: seedValue, actual: existingValue,
            message: `Product ${target.id} has a different ${f.field}; the value was NOT overwritten.`
          });
        }
      }
    }
  }

  // ── Materials: insert missing by stable id; backfill conversion only when unset ──
  const materialById = new Map(existingMaterials.map((m: any) => [m.id, m]));
  for (const target of materials) {
    const existing = materialById.get(target.id);
    if (!existing) {
      const nameCollision = existingMaterials.find(
        (m: any) => normalize(m.name) === normalize(target.name) && m.id !== target.id
      );
      if (nameCollision) {
        conflict({
          entity: 'material', seedId: target.id, field: 'name',
          expected: target.name, actual: nameCollision.name,
          message: `Material '${target.name}' already exists under id '${nameCollision.id}'; ${target.id} was NOT created to avoid a duplicate.`
        });
        continue;
      }
      plan.materialsToInsert.push({
        id: target.id, name: target.name, unit: target.unit,
        conversion_kg_per_m3: target.conversion_kg_per_m3,
        active: target.active, created_at: now
      });
      continue;
    }
    if (differs(target.name, existing.name)) {
      conflict({
        entity: 'material', seedId: target.id, field: 'name',
        expected: target.name, actual: existing.name,
        message: `Material ${target.id} has a different name; it was NOT overwritten.`
      });
    }
    if (target.conversion_kg_per_m3 !== null && isConfiguredPositive(target.conversion_kg_per_m3)) {
      const existingConversion = existing.conversion_kg_per_m3 ?? null;
      if (!isConfiguredPositive(existingConversion)) {
        plan.materialConversionBackfills.push({
          id: target.id,
          conversion_kg_per_m3: target.conversion_kg_per_m3,
          updated_at: now
        });
      } else if (existingConversion !== target.conversion_kg_per_m3) {
        conflict({
          entity: 'material', seedId: target.id, field: 'conversion_kg_per_m3',
          expected: target.conversion_kg_per_m3, actual: existingConversion,
          message: `Material ${target.id} has a different operator-set conversion factor; it was NOT overwritten.`
        });
      }
    }
  }

  // ── Line ↔ Product mappings: create only confirmed seed rows that are missing ──
  const existingMappingIds = new Set(existingMappings.map((m: any) => m.id));
  const existingMappingKeys = new Set(
    existingMappings.map((m: any) => `${m.line_id}|${m.product_id}`)
  );
  const availableLineIds = new Set([...lineById.keys(), ...plan.linesToInsert.map(l => l.id)]);
  const availableProductIds = new Set([...productById.keys(), ...plan.productsToInsert.map(p => p.id)]);

  for (const target of mappings) {
    if (existingMappingIds.has(target.id)) {
      continue;
    }
    const key = `${target.lineId}|${target.productId}`;
    if (existingMappingKeys.has(key)) {
      continue;
    }
    if (!availableLineIds.has(target.lineId) || !availableProductIds.has(target.productId)) {
      conflict({
        entity: 'line_product', seedId: target.id,
        message: `Mapping ${target.id} references a line/product that is not present in Supabase; it was skipped to avoid a phantom reference.`
      });
      continue;
    }
    plan.mappingsToInsert.push({
      id: target.id,
      line_id: target.lineId,
      product_id: target.productId,
      created_at: now
    });
  }

  return plan;
}