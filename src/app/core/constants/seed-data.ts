import { User } from '../models/user.model';
import { Product, ProductType } from '../models/product.model';
import { Line } from '../models/line.model';
import { Shift } from '../models/shift.model';
import { Machine } from '../models/machine.model';
import { Recipe } from '../models/recipe.model';
import { UnitCost } from '../models/unit-cost.model';
import { Material } from '../models/material.model';
import { ProductMachineConfig } from '../models/product-machine.model';
import { LineProductMapping } from '../models/line-product.model';

const now = new Date().toISOString();

export const SEED_USERS: User[] = [
  { id: 'usr-001', username: 'admin', password: 'admin123', role: 'Admin', displayName: 'Admin User', active: true, email: 'admin@tpms.factory', department: 'Management' },
  { id: 'usr-002', username: 'user', password: 'user123', role: 'User', displayName: 'Factory User', active: true, email: 'user@tpms.factory', department: 'Production' }
];

// ============================================================================
// VERIFIED FACTORY MASTER DATA (Toblat)
// ----------------------------------------------------------------------------
// Business-confirmed values ONLY. Anything not confirmed stays unset — it is
// surfaced as "Not configured" / CONFIGURATION_REQUIRED and NEVER invented.
//
// Field notes:
//  - compressionStandard is stored on the Product model as `standardStrength`
//    (the per-product Compression Standard). It is read per product — there is
//    NO name-string matching for compression logic anywhere.
//  - standardWeight is always stored in KILOGRAMS for every product
//    (Solid 12 = 3.7 kg, Solid 10 = 2.5 kg, Blocks 24/19/14/13/12 kg).
//    No mixed g/kg units are ever used.
//  - Product Area is always configured (business-confirmed): Solid 12 = 300,
//    Solid 10 = 200, Blocks 1000/800/600/480/400.
//  - density / dimensions on the SOLID products are intentionally NOT
//    configured until the factory approves them.
//  - PiecesPerPress may be fractional (10.5 … 22.5) and must NEVER be rounded;
//    Produced = Presses × PiecesPerPress.
//
// Stable ID policy (used by the idempotent migration too):
//  - prd-001 'Block 20' / prd-002 'Block 15' reuse the existing legacy IDs so
//    historical Production / Quality / Recipe / Release references stay valid.
//  - prd-004 … prd-008 are genuinely new products; IDs follow the prd-NNN
//    project convention.
// ============================================================================

export interface VerifiedProductSeed {
  id: string;
  name: string;
  nameAr?: string;
  type: ProductType;
  piecesPerPress: number;
  compressionStandard: number;
  standardHeight: number;
  standardWeight?: number;
  productArea?: number;
  dimensions?: string;
  densityKgPerM3?: number;
  /** Recognized existing names so the migration can normalize a matching record instead of creating a duplicate. */
  legacyNames?: string[];
}

export const VERIFIED_PRODUCTS: VerifiedProductSeed[] = [
  {
    id: 'prd-004',
    name: 'Solid 12',
    nameAr: 'مصمت 12',
    type: 'SOLID',
    piecesPerPress: 64,
    compressionStandard: 180,
    standardHeight: 12,
    standardWeight: 3.7,
    productArea: 300,
    legacyNames: ['Solid 12', 'مصمت 12']
  },
  {
    id: 'prd-005',
    name: 'Solid 10',
    nameAr: 'مصمت 10',
    type: 'SOLID',
    piecesPerPress: 80,
    compressionStandard: 180,
    standardHeight: 10,
    standardWeight: 2.5,
    productArea: 200,
    legacyNames: ['Solid 10', 'مصمت 10']
  },
  {
    id: 'prd-006',
    name: 'Block 25',
    nameAr: 'بلوك 25',
    type: 'BLOCK',
    piecesPerPress: 10.5,
    compressionStandard: 70,
    standardHeight: 25,
    standardWeight: 24,
    productArea: 1000,
    dimensions: '40 × 20 × 25 cm',
    densityKgPerM3: 1200,
    legacyNames: ['Block 25', 'بلوك 25']
  },
  {
    id: 'prd-001',
    name: 'Block 20',
    nameAr: 'بلوك 20',
    type: 'BLOCK',
    piecesPerPress: 12.5,
    compressionStandard: 70,
    standardHeight: 20,
    standardWeight: 19,
    productArea: 800,
    dimensions: '40 × 20 × 20 cm',
    densityKgPerM3: 1200,
    legacyNames: ['Block 20', 'بلوك 20']
  },
  {
    id: 'prd-002',
    name: 'Block 15',
    nameAr: 'بلوك 15',
    type: 'BLOCK',
    piecesPerPress: 16.5,
    compressionStandard: 70,
    standardHeight: 15,
    standardWeight: 14,
    productArea: 600,
    dimensions: '40 × 20 × 15 cm',
    densityKgPerM3: 1150,
    legacyNames: ['Block 15', 'بلوك 15']
  },
  {
    id: 'prd-007',
    name: 'Block 12',
    nameAr: 'بلوك 12',
    type: 'BLOCK',
    piecesPerPress: 18.5,
    compressionStandard: 70,
    standardHeight: 12,
    standardWeight: 13,
    productArea: 480,
    dimensions: '40 × 20 × 12 cm',
    densityKgPerM3: 1350,
    legacyNames: ['Block 12', 'بلوك 12']
  },
  {
    id: 'prd-008',
    name: 'Block 10',
    nameAr: 'بلوك 10',
    type: 'BLOCK',
    piecesPerPress: 22.5,
    compressionStandard: 70,
    standardHeight: 10,
    standardWeight: 12,
    productArea: 400,
    dimensions: '40 × 20 × 10 cm',
    densityKgPerM3: 1500,
    legacyNames: ['Block 10', 'بلوك 10']
  }
];

/**
 * Known demo products that were part of the original demo seed (e.g. 'Interlock').
 * The migration deactivates them so they never appear as selectable factory products.
 */
export const DEMO_LEGACY_PRODUCT_NAMES = ['Interlock'];

export const SEED_PRODUCTS: Product[] = VERIFIED_PRODUCTS.map(
  ({ legacyNames, compressionStandard, ...rest }) => ({
    ...rest,
    standardStrength: compressionStandard,
    active: true,
    createdAt: now
  })
);

export const SEED_MATERIALS: Material[] = [
  { id: 'mat-001', name: 'Sand', unit: 'kg', conversionKgPerM3: 1625, active: true, createdAt: now },
  { id: 'mat-002', name: 'Aggregate', unit: 'kg', conversionKgPerM3: 1550, active: true, createdAt: now },
  { id: 'mat-003', name: 'Cement', unit: 'kg', active: true, createdAt: now },
  { id: 'mat-004', name: 'Water', unit: 'L', active: true, createdAt: now },
  { id: 'mat-005', name: 'Admixture', unit: 'L', active: false, createdAt: now }
];

// ============================================================================
// BUSINESS-CONFIRMED FACTORY LINES (Toblat) — Lines 1 … 5, all active.
// ----------------------------------------------------------------------------
// Stable IDs lin-001 … lin-003 are kept so existing historical Production /
// Quality / Output-release records keep referencing the same Line rows; only the
// display names are normalized to 'Line 1' … 'Line 5' and lin-004 / lin-005 are
// created. The old 'Line 1 - Heavy', 'Line 2 - Standard', 'Line 3 - Specialty'
// names were demo-only.
// ============================================================================
export const SEED_LINES: Line[] = [
  { id: 'lin-001', name: 'Line 1', active: true, createdAt: now },
  { id: 'lin-002', name: 'Line 2', active: true, createdAt: now },
  { id: 'lin-003', name: 'Line 3', active: true, createdAt: now },
  { id: 'lin-004', name: 'Line 4', active: true, createdAt: now },
  { id: 'lin-005', name: 'Line 5', active: true, createdAt: now }
];

// ============================================================================
// BUSINESS-APPROVED LINE ↔ PRODUCT MAPPINGS (Toblat).
// ----------------------------------------------------------------------------
// Line 1 → all 7 verified current products
// Line 2 → all 7 verified current products
// Line 3 → Solid 10 + Solid 12 only
// Line 4 → Solid 10 + Solid 12 only
// Line 5 → Interlock ONLY — the Interlock product definition is still
//          UNCONFIRMED and is intentionally NOT invented, so Line 5 starts with
//          NO selectable products until the factory approves the Interlock
//          master. No unapproved Block/Solid product may ever appear on Line 5.
// ============================================================================
const ALL_VERIFIED_PRODUCT_IDS = VERIFIED_PRODUCTS.map(p => p.id);
const SOLID_PRODUCT_IDS = ['prd-004', 'prd-005']; // Solid 12, Solid 10

export const SEED_LINE_PRODUCTS: LineProductMapping[] = [
  ...ALL_VERIFIED_PRODUCT_IDS.map(productId => ({ id: `lpm-lin-001-${productId}`, lineId: 'lin-001', productId, createdAt: now })),
  ...ALL_VERIFIED_PRODUCT_IDS.map(productId => ({ id: `lpm-lin-002-${productId}`, lineId: 'lin-002', productId, createdAt: now })),
  ...SOLID_PRODUCT_IDS.map(productId => ({ id: `lpm-lin-003-${productId}`, lineId: 'lin-003', productId, createdAt: now })),
  ...SOLID_PRODUCT_IDS.map(productId => ({ id: `lpm-lin-004-${productId}`, lineId: 'lin-004', productId, createdAt: now }))
  // lin-005 intentionally has NO mapping rows until Interlock is confirmed.
];

export const SEED_SHIFTS: Shift[] = [
  { id: 'shf-001', name: 'Morning',  startTime: '06:00', endTime: '14:00', active: true, createdAt: now },
  { id: 'shf-002', name: 'Overtime', startTime: '14:00', endTime: '18:00', active: true, createdAt: now }
];

export const SEED_MACHINES: Machine[] = [
  { id: 'mac-001', name: 'Press Alpha', lineId: 'lin-001', active: true, createdAt: now },
  { id: 'mac-002', name: 'Press Beta', lineId: 'lin-001', active: true, createdAt: now },
  { id: 'mac-003', name: 'Press Gamma', lineId: 'lin-002', active: true, createdAt: now },
  { id: 'mac-004', name: 'Press Delta', lineId: 'lin-003', active: true, createdAt: now }
];

/**
 * No verified recipes exist yet — recipes must never be invented.
 * Fresh installs start with an empty Recipes list.
 */
export const SEED_RECIPES: Recipe[] = [];

export const SEED_UNIT_COSTS: UnitCost[] = [
  { id: 'cst-001', materialId: 'mat-001', unitCost: 15, unit: 'ton', demo: true, createdAt: now },
  { id: 'cst-002', materialId: 'mat-002', unitCost: 20, unit: 'ton', demo: true, createdAt: now },
  { id: 'cst-003', materialId: 'mat-003', unitCost: 80, unit: 'ton', demo: true, createdAt: now },
  { id: 'cst-004', materialId: 'mat-004', unitCost: 2, unit: 'm3', demo: true, createdAt: now },
  { id: 'cst-005', materialId: 'mat-005', unitCost: 5, unit: 'L', demo: true, createdAt: now }
];

/**
 * No verified machine ↔ product mappings exist — they are never auto-created.
 * Fresh installs start with an empty Production Config list.
 */
export const SEED_PRODUCT_MACHINES: ProductMachineConfig[] = [];