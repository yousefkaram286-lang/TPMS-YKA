import { computeSupabaseMasterSeedPlan, SupabaseMasterSeedPlan } from './supabase-master-seed.util';
import {
  VERIFIED_PRODUCTS,
  SEED_LINES,
  SEED_LINE_PRODUCTS,
  SEED_MATERIALS
} from '../constants/seed-data';

const NOW = '2026-09-02T00:00:00.000Z';

function line(id: string, name: string): any {
  return { id, name, active: true, created_at: NOW };
}

function product(id: string, name: string, nameAr: string | null, overrides: any = {}): any {
  return {
    id, name, name_ar: nameAr, type: 'BLOCK',
    pieces_per_press: 12.5, product_area: 800, standard_strength: 70,
    standard_height: 20, standard_weight: 19, dimensions: null,
    density_kg_per_m3: null, active: true, created_at: NOW,
    ...overrides
  };
}

function material(id: string, name: string, conversion: number | null = null): any {
  return { id, name, unit: 'kg', conversion_kg_per_m3: conversion, active: true, created_at: NOW };
}

function mapping(id: string, lineId: string, productId: string): any {
  return { id, line_id: lineId, product_id: productId, created_at: NOW };
}

describe('SupabaseMasterSeed util', () => {

  it('seed constants are internally consistent (no duplicate products/lines/materials)', () => {
    const productIds = VERIFIED_PRODUCTS.map(p => p.id);
    const productNames = VERIFIED_PRODUCTS.map(p => p.name.toLowerCase());
    const lineIds = SEED_LINES.map(l => l.id);
    const materialIds = SEED_MATERIALS.filter(m => m.active).map(m => m.id);
    const materialNames = SEED_MATERIALS.filter(m => m.active).map(m => m.name.toLowerCase());
    const mappingIds = SEED_LINE_PRODUCTS.map(lp => lp.id);

    expect(VERIFIED_PRODUCTS.length).toBe(7);
    expect(new Set(productIds).size).toBe(7);
    expect(new Set(productNames).size).toBe(7);
    expect(SEED_LINES.length).toBe(5);
    expect(new Set(lineIds).size).toBe(5);
    expect(new Set(materialIds).size).toBe(new Set(materialNames).size);
    expect(new Set(mappingIds).size).toBe(SEED_LINE_PRODUCTS.length);
  });

  it('plans the full confirmed baseline on empty Supabase tables (5 lines / 7 products / 4 materials / 18 mappings)', () => {
    const plan = computeSupabaseMasterSeedPlan([], [], [], [], { now: NOW });

    expect(plan.linesToInsert.length).toBe(5);
    expect(plan.productsToInsert.length).toBe(7);
    expect(plan.materialsToInsert.length).toBe(4);
    expect(plan.mappingsToInsert.length).toBe(18);
    expect(plan.conflicts.length).toBe(0);

    // Confirmed per-product values must be present verbatim.
    const solid12 = plan.productsToInsert.find(p => p.id === 'prd-004');
    expect(solid12.pieces_per_press).toBe(64);
    expect(solid12.product_area).toBe(300);
    expect(solid12.standard_weight).toBe(3.7);
    expect(solid12.standard_strength).toBe(180);
    expect(solid12.type).toBe('SOLID');
    expect(solid12.name_ar).toBe('مصمت 12');

    const block20 = plan.productsToInsert.find(p => p.id === 'prd-001');
    expect(block20.pieces_per_press).toBe(12.5);
    expect(block20.product_area).toBe(800);
    expect(block20.standard_weight).toBe(19);
    expect(block20.standard_strength).toBe(70);

    const sand = plan.materialsToInsert.find(m => m.id === 'mat-001');
    expect(sand.conversion_kg_per_m3).toBe(1625);
    const aggregate = plan.materialsToInsert.find(m => m.id === 'mat-002');
    expect(aggregate.conversion_kg_per_m3).toBe(1550);
  });

  it('Line 5 receives NO mappings (Interlock unconfirmed — never invented)', () => {
    const plan = computeSupabaseMasterSeedPlan([], [], [], [], { now: NOW });
    expect(plan.mappingsToInsert.filter(m => m.line_id === 'lin-005').length).toBe(0);
    expect(SEED_LINE_PRODUCTS.filter(lp => lp.lineId === 'lin-005').length).toBe(0);
  });

  it('Line 1/2 → all 7 products; Line 3/4 → Solid 10 + Solid 12 only', () => {
    const plan = computeSupabaseMasterSeedPlan([], [], [], [], { now: NOW });
    const lin1 = plan.mappingsToInsert.filter(m => m.line_id === 'lin-001').map(m => m.product_id);
    const lin3 = plan.mappingsToInsert.filter(m => m.line_id === 'lin-003').map(m => m.product_id);
    const lin4 = plan.mappingsToInsert.filter(m => m.line_id === 'lin-004').map(m => m.product_id);
    expect(lin1.length).toBe(7);
    expect(lin3.sort()).toEqual(['prd-004', 'prd-005']);
    expect(lin4.sort()).toEqual(['prd-004', 'prd-005']);
  });

  it('is idempotent: applying the plan once yields no inserts on the next run', () => {
    const first = computeSupabaseMasterSeedPlan([], [], [], [], { now: NOW });
    const existing = {
      lines: first.linesToInsert,
      products: first.productsToInsert,
      materials: first.materialsToInsert,
      mappings: first.mappingsToInsert
    };
    const second = computeSupabaseMasterSeedPlan(
      existing.lines, existing.products, existing.materials, existing.mappings, { now: NOW }
    );
    expect(second.linesToInsert.length).toBe(0);
    expect(second.productsToInsert.length).toBe(0);
    expect(second.materialsToInsert.length).toBe(0);
    expect(second.materialConversionBackfills.length).toBe(0);
    expect(second.mappingsToInsert.length).toBe(0);
    expect(second.conflicts.length).toBe(0);
  });

  it('does NOT overwrite a user-modified product and reports the conflict', () => {
    const modified = product('prd-004', 'Solid 12', 'مصمت 12', { pieces_per_press: 40, type: 'SOLID', standard_height: 12, standard_strength: 180, standard_weight: 3.7, product_area: 300 });
    const plan = computeSupabaseMasterSeedPlan([line('lin-001', 'Line 1')], [modified], [material('mat-001', 'Sand', 1625)], [], { now: NOW });

    expect(plan.productsToInsert.length).toBe(6); // the OTHER 6 missing products are still seeded
    expect(plan.productsToInsert.find(p => p.id === 'prd-004')).toBeUndefined();
    const productConflict = plan.conflicts.find(c => c.entity === 'product' && c.seedId === 'prd-004');
    expect(productConflict).toBeDefined();
    expect(productConflict!.field).toBe('pieces_per_press');
    expect(productConflict!.expected).toBe(64);
    expect(productConflict!.actual).toBe(40);
  });

  it('does NOT duplicate a product that already exists under a different id with the same name', () => {
    const existing = product('uuid-prod-x', 'Solid 12', 'مصمت 12');
    const plan = computeSupabaseMasterSeedPlan([], [existing], [], [], { now: NOW });

    expect(plan.productsToInsert.length).toBe(6); // prd-004 excluded
    expect(plan.productsToInsert.find(p => p.id === 'prd-004')).toBeUndefined();
    expect(plan.conflicts.find(c => c.entity === 'product' && c.seedId === 'prd-004')).toBeDefined();
  });

  it('backfills Sand=1625 / Aggregate=1550 ONLY when the conversion is missing', () => {
    const plan = computeSupabaseMasterSeedPlan(
      [], [],
      [material('mat-001', 'Sand'), material('mat-002', 'Aggregate'), material('mat-003', 'Cement'), material('mat-004', 'Water')],
      [], { now: NOW }
    );
    expect(plan.materialsToInsert.length).toBe(0);
    expect(plan.materialConversionBackfills.length).toBe(2);
    const byId = new Map(plan.materialConversionBackfills.map(b => [b.id, b.conversion_kg_per_m3]));
    expect(byId.get('mat-001')).toBe(1625);
    expect(byId.get('mat-002')).toBe(1550);
  });

  it('does NOT overwrite an operator-set conversion factor and reports the conflict', () => {
    const plan = computeSupabaseMasterSeedPlan(
      [], [],
      [material('mat-001', 'Sand', 1600), material('mat-002', 'Aggregate', 1550), material('mat-003', 'Cement'), material('mat-004', 'Water')],
      [], { now: NOW }
    );
    expect(plan.materialConversionBackfills.length).toBe(0);
    const conflict = plan.conflicts.find(c => c.entity === 'material' && c.seedId === 'mat-001');
    expect(conflict).toBeDefined();
    expect(conflict!.expected).toBe(1625);
    expect(conflict!.actual).toBe(1600);
  });

  it('does NOT rename an existing line; creates the missing ones', () => {
    const demo = [line('lin-001', 'Line 1 - Heavy'), line('lin-002', 'Line 2')];
    const plan = computeSupabaseMasterSeedPlan(demo, [], [], [], { now: NOW });

    expect(plan.linesToInsert.map(l => l.id).sort()).toEqual(['lin-003', 'lin-004', 'lin-005']);
    expect(plan.linesToInsert.some(l => l.name === 'Line 3')).toBeTrue();
    const conflict = plan.conflicts.find(c => c.entity === 'line' && c.seedId === 'lin-001');
    expect(conflict).toBeDefined();
    expect(demo[0].name).toBe('Line 1 - Heavy'); // untouched
  });

  it('skips mappings that reference a line present only under a different id (no phantom references)', () => {
    const renamed = [line('uuid-line-1', 'Line 1'), line('lin-002', 'Line 2'), line('lin-003', 'Line 3'), line('lin-004', 'Line 4'), line('lin-005', 'Line 5')];
    const plan = computeSupabaseMasterSeedPlan(renamed, [], [], [], { now: NOW });

    expect(plan.linesToInsert.length).toBe(0);
    expect(plan.mappingsToInsert.some(m => m.line_id === 'lin-001')).toBeFalse();
    const skipped = plan.conflicts.filter(c => c.entity === 'line_product');
    expect(skipped.length).toBe(7); // the 7 lin-001 seed mappings
  });

  it('creates no mapping rows when all seed mappings already exist', () => {
    const existing = SEED_LINE_PRODUCTS.map(lp => mapping(lp.id, lp.lineId, lp.productId));
    const plan = computeSupabaseMasterSeedPlan([], [], [], existing, { now: NOW });
    expect(plan.mappingsToInsert.length).toBe(0);
  });

  it('never invents recipes / machines / unit costs (plan only touches the 4 confirmed tables)', () => {
    const plan: SupabaseMasterSeedPlan = computeSupabaseMasterSeedPlan([], [], [], [], { now: NOW });
    const payloads = [
      ...plan.linesToInsert,
      ...plan.productsToInsert,
      ...plan.materialsToInsert,
      ...plan.mappingsToInsert
    ];
    expect(payloads.every(p => !!p.id)).toBeTrue();
    expect(plan.conflicts.length).toBe(0);
  });
});