// ============================================================
// TPMS — Storage Constants
// ============================================================

export const DB_NAME = 'TPMS_DB';
export const DB_VERSION = 6; // bumped 5 → 6 to create the lineProducts store (approved Line ↔ Product mappings)

export const SEED_FLAG_KEY = 'tpms_db_seeded_v3';

export const STORE_NAMES = {
  USERS: 'users',
  PRODUCTS: 'products',
  MATERIALS: 'materials',
  LINES: 'lines',
  SHIFTS: 'shifts',
  MACHINES: 'machines',
  RECIPES: 'recipes',
  UNIT_COSTS: 'unitCosts',
  PRODUCTIONS: 'productions',
  PRODUCTION_SESSIONS: 'productionSessions',
  MATERIAL_RECORDS: 'materialRecords',
  QUALITY_TESTS: 'qualityTests',
  PRODUCT_MACHINES: 'productMachines',
  OUTPUT_RELEASES: 'outputReleases',
  LINE_PRODUCTS: 'lineProducts',
} as const;

export type StoreName = typeof STORE_NAMES[keyof typeof STORE_NAMES];
