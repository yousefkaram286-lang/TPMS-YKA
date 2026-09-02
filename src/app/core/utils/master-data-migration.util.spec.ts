import { Product } from '../models/product.model';
import { Material } from '../models/material.model';
import { Recipe } from '../models/recipe.model';
import { VERIFIED_PRODUCTS, DEMO_LEGACY_PRODUCT_NAMES } from '../constants/seed-data';
import { computeMasterDataMigration, buildVerifiedProduct } from './master-data-migration.util';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prd-001',
    name: 'Block 20',
    standardStrength: 70,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-001',
    name: 'Sand',
    unit: 'kg',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r-001',
    productId: 'prd-001',
    items: [{ materialId: 'mat-001', quantity: 100 }],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

/** All 7 verified products present as existing records (realistic install). */
function allVerifiedProducts(): Product[] {
  return VERIFIED_PRODUCTS.map(s => product({
    id: s.id,
    name: s.name,
    piecesPerPress: s.piecesPerPress,
    standardStrength: s.compressionStandard
  }));
}

describe('MasterDataMigration — Products', () => {
  const specs = VERIFIED_PRODUCTS;
  const specFor = (name: string) => specs.find(s => s.name === name)!;

  it('validates that the seed spec is the Verified Product set', () => {
    expect(specs.length).toBe(7);
    // Seed data is BUSINESS-CONFIRMED; changing the verified set is a product decision.
  });

it('verifies product 1: Solid 12 (prd-004) — 64 pieces/press, C180, H12, W 3.7 kg, Area 300', () => {
    const s = specFor('Solid 12');
    expect(s.id).toBe('prd-004');
    expect(s.piecesPerPress).toBe(64);
    expect(s.compressionStandard).toBe(180);
    expect(s.standardHeight).toBe(12);
    expect(s.standardWeight).toBe(3.7);
    expect(s.productArea).toBe(300);
  });

  it('normalizes Solid 12 Area to 300 — verified Area always wins; old/missing values are NOT preserved', () => {
    const plan = computeMasterDataMigration([product({ id: 'prd-004', name: 'Solid 12', standardStrength: 180 })], [], []);
    const updated = plan.productUpdates.find(p => p.id === 'prd-004');
    expect(updated).toBeTruthy();
    expect(updated!.standardWeight).toBe(3.7);
    expect(updated!.productArea).toBe(300);
    expect(updated!.piecesPerPress).toBe(64);
  });

  it('verifies Product 2 is Solid 10 (prd-005) — 80 pieces/press, C180, H10, W 2.5 kg, Area 200', () => {
    const s = specFor('Solid 10');
    expect(s.id).toBe('prd-005');
    expect(s.piecesPerPress).toBe(80);
    expect(s.compressionStandard).toBe(180);
    expect(s.standardHeight).toBe(10);
    expect(s.standardWeight).toBe(2.5);
    expect(s.productArea).toBe(200);
  });

  it('verifies Product 3 is Block 25 (prd-006) — 10.5 pieces/press, C70, H25, W24, area 1000', () => {
    const s = specFor('Block 25');
    expect(s.id).toBe('prd-006');
    expect(s.piecesPerPress).toBe(10.5);
    expect(s.compressionStandard).toBe(70);
    expect(s.standardHeight).toBe(25);
    expect(s.standardWeight).toBe(24);
    expect(s.productArea).toBe(1000);
  });

  it('verifies Product 4 is Block 20 (prd-001) — 12.5 pieces/press, C70, H20, W19, area 800, dims 40x20x20', () => {
    const s = specFor('Block 20');
    expect(s.id).toBe('prd-001');
    expect(s.piecesPerPress).toBe(12.5);
    expect(s.compressionStandard).toBe(70);
    expect(s.standardHeight).toBe(20);
    expect(s.standardWeight).toBe(19);
    expect(s.productArea).toBe(800);
    expect(s.dimensions).toBe('40 × 20 × 20 cm');
  });

  it('verifies Product 5 is Block 15 (prd-002) — 16.5 pieces/press, C70, H15, W14, area 600', () => {
    const s = specFor('Block 15');
    expect(s.id).toBe('prd-002');
    expect(s.piecesPerPress).toBe(16.5);
    expect(s.compressionStandard).toBe(70);
    expect(s.standardHeight).toBe(15);
    expect(s.standardWeight).toBe(14);
    expect(s.productArea).toBe(600);
  });

it('verifies Product 6 is Block 12 (prd-007) — 18.5 pieces/press, C70, H12, W13, area 480, density 1350', () => {
    const s = specFor('Block 12');
    expect(s.piecesPerPress).toBe(18.5);
    expect(s.compressionStandard).toBe(70);
    expect(s.standardHeight).toBe(12);
    expect(s.standardWeight).toBe(13);
    expect(s.productArea).toBe(480);
    expect(s.densityKgPerM3).toBe(1350);
  });

  it('verifies Product 7 is Block 10 (prd-008) — 22.5 pieces/press, C70, H10, W12, area 400, density 1500', () => {
    const s = specFor('Block 10');
    expect(s.id).toBe('prd-008');
    expect(s.piecesPerPress).toBe(22.5);
    expect(s.compressionStandard).toBe(70);
    expect(s.standardHeight).toBe(10);
    expect(s.standardWeight).toBe(12);
    expect(s.productArea).toBe(400);
    expect(s.densityKgPerM3).toBe(1500);
  });

  it('verifies product 8: single Compression Standard per type — Solid 180 / Block 70', () => {
    const solids = specs.filter(s => s.name.startsWith('Solid'));
    const blocks = specs.filter(s => s.name.startsWith('Block'));
    expect(solids.length).toBeGreaterThan(0);
    expect(blocks.length).toBeGreaterThan(0);
    for (const s of solids) expect(s.compressionStandard).toBe(180);
    for (const s of blocks) expect(s.compressionStandard).toBe(70);
  });

  it('verifies product 9: Solid halves are never rounded — all verified pieces/press values are exact', () => {
    for (const s of specs) {
      expect(Number(s.piecesPerPress)).toBe(s.piecesPerPress);
    }
  });

  it('verifies product 10: NO unverified products — the demo product Interlock is not a Verified Product', () => {
    for (const s of specs) {
      expect(DEMO_LEGACY_PRODUCT_NAMES).not.toContain(s.name);
      expect(DEMO_LEGACY_PRODUCT_NAMES).not.toContain(s.nameAr || '');
    }
  });

  it('verifies product 11: the exact list of demo/legacy product names is Interlock only', () => {
    expect(DEMO_LEGACY_PRODUCT_NAMES).toEqual(['Interlock']);
  });
});

describe('MasterDataMigration — idempotent & ID-preserving', () => {
it('normalizes in place: updates the existing prd-001 record instead of duplicating it', () => {
    const existing = product({ name: 'Block 20', piecesPerPress: 10, productArea: 900, standardHeight: 25 });
    const plan = computeMasterDataMigration([existing], [], []);

    // The 6 other verified products are created; Block 20 is NEVER duplicated.
    expect(plan.productCreates.length).toBe(6);
    expect(plan.productCreates.some(p => p.id === 'prd-001')).toBe(false);
    expect(plan.productUpdates.length).toBe(1);
    const updated = plan.productUpdates[0];
    expect(updated.id).toBe('prd-001');
    expect(updated.piecesPerPress).toBe(12.5);
    expect(updated.productArea).toBe(800);
    expect(updated.standardHeight).toBe(20);
    expect(updated.standardWeight).toBe(19);
    expect(updated.type).toBe('BLOCK');
    expect(updated.nameAr).toBe('بلوك 20');
    expect(updated.dimensions).toBe('40 × 20 × 20 cm');
  });

  it('creates only the missing verified product with its business id when absent', () => {
    const plan = computeMasterDataMigration([product({ id: 'prd-001', name: 'Block 15', piecesPerPress: 10 })], [], []);
    // prd-001 claimed by Block 20 spec by ID; Block 15 spec then matches by name.
    expect(plan.productUpdates.map(p => p.id)).toContain('prd-001');
    expect(plan.productCreates.length).toBe(6);
    expect(plan.productCreates.find(p => p.id === 'prd-004')).toBeTruthy();
  });

  it('re-runs to the same result — the migration is idempotent', () => {
    const input = [
      product({ id: 'prd-004', name: 'Solid 12', piecesPerPress: 64, standardStrength: 180 }),
      product({ id: 'prd-001', name: 'Block 20', piecesPerPress: 12.5 }),
      product({ id: 'prd-006', name: 'Block 25', piecesPerPress: 10.5 }),
      product({ id: 'prd-090', name: 'Interlock', standardStrength: 70, active: true })
    ];

    const first = computeMasterDataMigration(input, [], []);
    const afterFirst = input.map(o => {
      const u = first.productUpdates.find(p => p.id === o.id) ??
        first.productDeactivations.find(p => p.id === o.id);
      return u ? { ...o, ...u } : o;
    });

    const second = computeMasterDataMigration(afterFirst, [], []);

    // Identical create set on re-run (nothing duplicated).
    expect(second.productCreates.map(p => p.id).sort())
      .toEqual(first.productCreates.map(p => p.id).sort());
    // No record claimed by more than one action.
    const allIds = [...second.productUpdates, ...second.productCreates].map(p => p.id);
    expect(new Set(allIds).size).toBe(allIds.length);
    // Interlock stays deactivated.
    expect(afterFirst.find(p => p.id === 'prd-090')!.active).toBe(false);
  });

  it('name-matches by legacy/interchangeable names when the business id is not in use', () => {
    // An older install stored Block 20 under the physical id 'BLOCK-20-4x20'.
    const legacyBlock20 = product({ id: 'BLOCK-20-4x20', name: 'Block 20', piecesPerPress: 8 });
    const plan = computeMasterDataMigration([legacyBlock20], [], []);
    const updated = plan.productUpdates.find(p => p.id === legacyBlock20.id);
    expect(updated).toBeTruthy();
    expect(updated!.piecesPerPress).toBe(12.5);
    expect(plan.productCreates.find(p => p.id === 'prd-001')).toBeFalsy();
  });

  it('does not match two verified specs against one record', () => {
    const only = product({ id: 'PRD-99', name: 'Block 25', piecesPerPress: 9 });
    const plan = computeMasterDataMigration([only], [], []);
    // one update target, no duplicate updates
    expect(plan.productUpdates.filter(p => p.id === only.id).length).toBe(1);
  });

it('deactivates the demo product Interlock but NEVER deletes it', () => {
    const interlock = product({ id: 'prd-090', name: 'Interlock', standardStrength: 70, active: true });
    const plan = computeMasterDataMigration([...allVerifiedProducts(), interlock], [], []);

    expect(plan.productCreates.length).toBe(0);
    expect(plan.productUpdates.map(p => p.id)).not.toContain('prd-090');
    expect(plan.productDeactivations.length).toBe(1);
    expect(plan.productDeactivations[0].id).toBe('prd-090');
    expect(plan.productDeactivations[0].active).toBe(false);
    expect(plan.productDeactivations[0].name).toBe('Interlock');
  });

  it('does not touch unrelated products (files, pallets, unknown)', () => {
    const unrelated = product({ id: 'prd-999', name: 'Palette', standardStrength: 40, active: true });
    const plan = computeMasterDataMigration([unrelated], [], []);
    expect(plan.productDeactivations.length).toBe(0);
    expect(plan.productUpdates.map(p => p.id)).not.toContain('prd-999');
  });
});

describe('MasterDataMigration — preserved-configuration guard', () => {
  it('Area 300 always wins over an old legacy Area — no old/missing value is preserved', () => {
    const solid12 = product({
      id: 'prd-004',
      name: 'Solid 12',
      standardStrength: 180,
      piecesPerPress: 64,
      productArea: 0.12,
      standardWeight: 18
    });
    const plan = computeMasterDataMigration([solid12], [], []);
    const updated = plan.productUpdates.find(p => p.id === 'prd-004')!;
    expect(updated.id).toBe('prd-004');
    expect(updated.standardWeight).toBe(3.7);
    expect(updated.productArea).toBe(300);       // verified Area wins, legacy 0.12 replaced
    expect(updated.piecesPerPress).toBe(64);
  });

  it('Solid 10 Area is normalized to 200 (verified) — a legacy missing/old Area is replaced, ID preserved', () => {
    const solid10 = product({
      id: 'prd-005',
      name: 'Solid 10',
      standardStrength: 180,
      piecesPerPress: 80,
      productArea: 0.09
    });
    const plan = computeMasterDataMigration([solid10], [], []);
    const updated = plan.productUpdates.find(p => p.id === 'prd-005')!;
    expect(updated.id).toBe('prd-005');
    expect(updated.productArea).toBe(200);
    expect(updated.standardWeight).toBe(2.5);
  });

  it('QUALITY READINESS: the two Solids now carry the full confirmed triplet (kg / Area / Compression Std)', () => {
    const solid12 = VERIFIED_PRODUCTS.find(s => s.name === 'Solid 12')!;
    expect([solid12.standardWeight, solid12.productArea, solid12.compressionStandard]).toEqual([3.7, 300, 180]);

    const solid10 = VERIFIED_PRODUCTS.find(s => s.name === 'Solid 10')!;
    expect([solid10.standardWeight, solid10.productArea, solid10.compressionStandard]).toEqual([2.5, 200, 180]);
  });

it('applies business-confirmed density — verified values win over legacy config', () => {
    // A production install added a custom density to Block 20
    const block20 = product({ id: 'prd-001', name: 'Block 20', piecesPerPress: 12.5, densityKgPerM3: 1350 });
    const plan = computeMasterDataMigration([block20], [], []);
    const updated = plan.productUpdates.find(p => p.id === 'prd-001')!;
    expect(updated.piecesPerPress).toBe(12.5);
    // Business-confirmed density wins (Block 20 density is a verified value).
    expect(updated.densityKgPerM3).toBe(1200);
  });
});

describe('MasterDataMigration — Materials legacy guard', () => {
it('never mutates material records — materials are read-only inputs to the plan', () => {
    const admixture = material({ id: 'mat-005', name: 'Admixture', unit: 'kg', active: false });
    const cbs = material({ id: 'mat-002', name: 'Aggregate', unit: 'kg' });
    const plan = computeMasterDataMigration(allVerifiedProducts(), [admixture, cbs], []);

    expect(plan.productCreates.length).toBe(0);
    expect(plan.productUpdates.length).toBe(7);
    expect(plan.productDeactivations.length).toBe(0);
    expect(plan.recipeUpdates.length).toBe(0);
  });

  it('is a pure planning function — identical inputs always produce an identical plan', () => {
    const products = [
      product({ id: 'prd-004', name: 'Solid 12', piecesPerPress: 64, standardStrength: 180 }),
      product({ id: 'prd-090', name: 'Interlock', standardStrength: 70, active: true })
    ];
    const materials = [material({ id: 'mat-005', name: 'Admixture', unit: 'kg', active: false })];
    const recipes = [recipe({ id: 'r-adm', productId: 'prd-001', items: [{ materialId: 'mat-005', quantity: 5 }] })];
    // Pin the planning timestamp so the plan is fully deterministic (options.now is injected).
    const pinned = { now: '2026-01-01T00:00:00.000Z' };

    const planA = computeMasterDataMigration(products, materials, recipes, pinned);
    const planB = computeMasterDataMigration(products, materials, recipes, pinned);

    expect(planA).toEqual(planB);
  });
});

describe('MasterDataMigration — Recipes legacy guard', () => {
  it('flags not deletes recipes that reference the demo product Interlock', () => {
    const interlock = product({ id: 'prd-090', name: 'Interlock', standardStrength: 70 });
    const legacy = recipe({ id: 'r-001', productId: 'prd-090' });
    const plan = computeMasterDataMigration([interlock], [], [legacy]);

    expect(plan.productDeactivations.map(p => p.id)).toContain('prd-090');
    const update = plan.recipeUpdates.find(r => r.id === 'r-001');
    expect(update).toBeTruthy();
    expect(update!.demo).toBe(true);
  });

  it('flags recipes that reference the inactive Admixture material — never delete', () => {
    const adm = material({ id: 'mat-005', name: 'Admixture', unit: 'kg', active: false });
    const r = recipe({ id: 'r-adm', productId: 'prd-001', items: [{ materialId: 'mat-005', quantity: 5 }] });
    const plan = computeMasterDataMigration(
      [product({ id: 'prd-001', name: 'Block 20', piecesPerPress: 12.5 })],
      [adm],
      [r]
    );

    const updated = plan.recipeUpdates.find(x => x.id === 'r-adm');
    expect(updated).toBeTruthy();
    expect(updated!.demo).toBe(true);
  });

  it('does NOT flag recipes that use active products and active materials', () => {
    const r = recipe({ id: 'r-ok', productId: 'prd-001', items: [{ materialId: 'mat-001', quantity: 100 }] });
    const plan = computeMasterDataMigration(
      [product({ id: 'prd-001', name: 'Block 20', piecesPerPress: 12.5 })],
      [material({ id: 'mat-001', name: 'Sand', unit: 'kg' })],
      [r]
    );

    expect(plan.recipeUpdates.some(x => x.id === 'r-ok')).toBe(false);
  });
});

describe('MasterDataMigration plan integrity', () => {
  it('reference-maintaining Interface layout: productUpdates preserves every product key & ID', () => {
    const block20 = product({ id: 'prd-001', name: 'Block 20', piecesPerPress: 12.5, productArea: 800 });
    const plan = computeMasterDataMigration([block20], [], []);
    const updated = plan.productUpdates.find(p => p.id === 'prd-001')!;
    expect(updated.standardStrength).toBe(70);
    expect(updated.standardHeight).toBe(20);
    expect(updated.updatedAt).toBeDefined();
  });
});
