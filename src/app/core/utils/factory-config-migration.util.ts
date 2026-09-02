import { Line } from '../models/line.model';
import { Material } from '../models/material.model';
import { LineProductMapping } from '../models/line-product.model';
import { UnitCost } from '../models/unit-cost.model';
import { SEED_LINES, SEED_LINE_PRODUCTS, SEED_MATERIALS, SEED_UNIT_COSTS } from '../constants/seed-data';

// ============================================================================
// Factory Configuration reconciliation — PURE planning logic (idempotent).
// ----------------------------------------------------------------------------
// BUSINESS-CONFIRMED (Toblat):
//  - Lines 1 … 5 are the actual factory lines (all active, plain names).
//    lin-001 … lin-003 keep their stable IDs (historical references stay
//    valid) and are only renamed from the demo names to 'Line 1' … 'Line 3';
//    lin-004 / lin-005 are created when missing.
//  - SandKgPerM3 = 1625 and AggregateKgPerM3 = 1550 are the approved
//    conversion factors. They are backfilled ONLY when missing / zero / invalid
//    — an operator-set positive value is never silently overwritten. Historical
//    stored kg records are never touched.
//  - Line ↔ Product mappings come from SEED_LINE_PRODUCTS (Line 1/2 → all 7
//    verified products; Line 3/4 → Solid 10 + Solid 12; Line 5 → none, because
//    the Interlock definition is unconfirmed and must NOT be invented).
//  - Recipes stay untouched (optional/reference only; ActualPerMix is
//    user-entered). Admixture stays inactive (legacy).
// ============================================================================

export interface FactoryConfigMigrationPlan {
  lineUpdates: Line[];
  lineCreates: Line[];
  materialUpdates: Material[];
  lineProductCreates: LineProductMapping[];
  unitCostUpdates: UnitCost[];
}

export interface FactoryConfigMigrationOptions {
  lines?: Line[];
  materials?: Material[];
  lineProducts?: LineProductMapping[];
  unitCosts?: UnitCost[];
  now?: string;
}

function isConfiguredPositive(value: number | undefined | null): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Approved Sand / Aggregate conversion factors keyed by stable material id. */
const CONFIRMED_CONVERSIONS: { id: string; factor: number }[] = [
  { id: 'mat-001', factor: 1625 }, // Sand
  { id: 'mat-002', factor: 1550 }  // Aggregate
];

/** Ids of every seed record (idempotency guard for the mapping creations). */
const SEED_LP_IDS = new Set<string>(SEED_LINE_PRODUCTS.map(lp => lp.id));

export function computeFactoryConfigMigration(
  lines: Line[],
  materials: Material[],
  lineProducts: LineProductMapping[],
  unitCosts: UnitCost[],
  options?: FactoryConfigMigrationOptions
): FactoryConfigMigrationPlan {
  const targetLines = options?.lines ?? SEED_LINES;
  const targetLp = options?.lineProducts ?? SEED_LINE_PRODUCTS;
  const now = options?.now ?? new Date().toISOString();

  const plan: FactoryConfigMigrationPlan = {
    lineUpdates: [],
    lineCreates: [],
    materialUpdates: [],
    lineProductCreates: [],
    unitCostUpdates: []
  };

  // ── Lines: rename lin-001…003, create lin-004 / lin-005 ────────────────
  const existingById = new Map(lines.map(l => [l.id, l]));
  for (const target of targetLines) {
    const existing = existingById.get(target.id);
    if (!existing) {
      plan.lineCreates.push({ ...target, createdAt: now });
    } else if (existing.name !== target.name) {
      plan.lineUpdates.push({ ...existing, name: target.name, updatedAt: now });
    }
  }

  // ── Material conversions: backfill missing factors only ─────────────────
  const existingByNameId = new Map(materials.map(m => [m.id, m]));
  for (const c of CONFIRMED_CONVERSIONS) {
    const material = existingByNameId.get(c.id);
    if (material && !isConfiguredPositive(material.conversionKgPerM3)) {
      plan.materialUpdates.push({ ...material, conversionKgPerM3: c.factor, updatedAt: now });
    }
  }

  // ── Line ↔ Product mappings: create missing seed rows (idempotent) ──────
  const existingLpIds = new Set(lineProducts.map(lp => lp.id));
  for (const lp of targetLp) {
    if (!SEED_LP_IDS.has(lp.id)) {
      continue; // never invent/duplicate non-seed mappings
    }
    if (!existingLpIds.has(lp.id)) {
      plan.lineProductCreates.push({ ...lp, createdAt: now });
    }
  }

  // ── Unit costs: backfill demo flag on the pre-loaded (unverified) seed rows
  //                 so existing installs converge with fresh installs. Values
  //                 are never changed — DEMO is a display-only disclaimer that
  //                 keeps them out of any operational confirmation claim.
  const seedCostById = new Map(SEED_UNIT_COSTS.map(c => [c.id, c]));
  const existingCosts = unitCosts ?? [];
  for (const cost of existingCosts) {
    if (seedCostById.has(cost.id) && cost.demo !== true) {
      plan.unitCostUpdates.push({ ...cost, demo: true, updatedAt: now });
    }
  }

  return plan;
}