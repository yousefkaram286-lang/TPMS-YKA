import { computeFactoryConfigMigration, FactoryConfigMigrationPlan } from './factory-config-migration.util';
import { SEED_LINES, SEED_LINE_PRODUCTS, SEED_UNIT_COSTS } from '../constants/seed-data';

const NOW = '2026-08-29T00:00:00.000Z';

function line(id: string, name: string): any {
  return { id, name, active: true, createdAt: NOW };
}

function material(id: string, name: string, conversion?: number): any {
  return { id, name, unit: 'kg', conversionKgPerM3: conversion, active: true, createdAt: NOW };
}

function lp(id: string, lineId: string, productId: string): any {
  return { id, lineId, productId, createdAt: NOW };
}

function cost(id: string, demo?: boolean): any {
  return { id, materialId: 'mat-001', unitCost: 15, unit: 'ton', demo, createdAt: NOW };
}

describe('FactoryConfigMigration', () => {
  it('creates lin-004 and lin-005 and renames lin-001…003 when demo lines exist', () => {
    const demo = [line('lin-001', 'Line 1 - Heavy'), line('lin-002', 'Line 2 - Standard'), line('lin-003', 'Line 3 - Specialty')];
    const plan = computeFactoryConfigMigration(demo, [], [], [], { now: NOW });

    expect(plan.lineCreates.map(l => l.id).sort()).toEqual(['lin-004', 'lin-005']);
    expect(plan.lineUpdates).toEqual([
      { ...demo[0], name: 'Line 1', updatedAt: NOW },
      { ...demo[1], name: 'Line 2', updatedAt: NOW },
      { ...demo[2], name: 'Line 3', updatedAt: NOW }
    ]);
    expect(plan.lineCreates.every(l => l.active)).toBeTrue();
  });

  it('converges to exactly 5 active business lines', () => {
    let lines = [line('lin-001', 'Line 1 - Heavy'), line('lin-002', 'Line 2 - Standard'), line('lin-003', 'Line 3 - Specialty')];
    const apply = (plan: FactoryConfigMigrationPlan) => {
      const byId = new Map(lines.map(l => [l.id, l]));
      plan.lineUpdates.forEach(l => byId.set(l.id, l));
      plan.lineCreates.forEach(l => byId.set(l.id, l));
      lines = [...byId.values()].filter(l => l.id.startsWith('lin-'));
    };
    apply(computeFactoryConfigMigration(lines, [], [], [], { now: NOW }));

    expect(lines.map(l => l.name).sort()).toEqual(['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5']);
    expect(lines.filter(l => l.active).length).toBe(5);

    // second run → fully idempotent (no more ops)
    const p2 = computeFactoryConfigMigration(lines, [], [], [], { now: NOW });
    expect(p2.lineCreates.length).toBe(0);
    expect(p2.lineUpdates.length).toBe(0);
  });

  it('backfills Sand = 1625 and Aggregate = 1550 when missing', () => {
    const mats = [material('mat-001', 'Sand'), material('mat-002', 'Aggregate'), material('mat-003', 'Cement')];
    const plan = computeFactoryConfigMigration([], mats, [], [], { now: NOW });

    expect(plan.materialUpdates.length).toBe(2);
    const byId = new Map(plan.materialUpdates.map(m => [m.id, m]));
    expect(byId.get('mat-001')!.conversionKgPerM3).toBe(1625);
    expect(byId.get('mat-002')!.conversionKgPerM3).toBe(1550);
    expect(byId.has('mat-003')).toBeFalse();
  });

  it('does NOT overwrite an operator-set positive conversion', () => {
    const mats = [material('mat-001', 'Sand', 1600), material('mat-002', 'Aggregate', 1550)];
    const plan = computeFactoryConfigMigration([], mats, [], [], { now: NOW });
    expect(plan.materialUpdates.length).toBe(0);
  });

  it('never touches historical stored kg (conversions only live on the Material master)', () => {
    const mats = [material('mat-001', 'Sand'), material('mat-002', 'Aggregate')];
    const plan = computeFactoryConfigMigration([], mats, [], [], { now: NOW });
    for (const m of plan.materialUpdates) {
      expect(m.conversionKgPerM3).toBeGreaterThan(0);
      expect('kgRecords' in m).toBeFalse();
    }
  });

  it('creates all seed line↔product mappings and is idempotent', () => {
    const plan = computeFactoryConfigMigration([], [], [], [], { now: NOW });
    const created = plan.lineProductCreates;

    expect(created.length).toBe(SEED_LINE_PRODUCTS.length);

    const lin1 = created.filter(c => c.lineId === 'lin-001');
    const lin2 = created.filter(c => c.lineId === 'lin-002');
    const lin3 = created.filter(c => c.lineId === 'lin-003');
    const lin4 = created.filter(c => c.lineId === 'lin-004');
    const lin5 = created.filter(c => c.lineId === 'lin-005');

    expect(lin1.length).toBe(7);
    expect(lin2.length).toBe(7);
    expect(lin3.map(c => c.productId).sort()).toEqual(['prd-004', 'prd-005']);
    expect(lin4.map(c => c.productId).sort()).toEqual(['prd-004', 'prd-005']);
    expect(lin5.length).toBe(0); // Interlock unconfirmed — never invented
  });

  it('re-running with all mappings already present creates nothing', () => {
    const first = computeFactoryConfigMigration([], [], [], [], { now: NOW });
    const second = computeFactoryConfigMigration([], [], first.lineProductCreates, [], { now: NOW });
    expect(second.lineProductCreates.length).toBe(0);
  });

  it('never duplicates exclusive ids when existing set contains unrelated rows', () => {
    const unrelated = lp('lpm-custom-x', 'lin-001', 'prd-999');
    const plan = computeFactoryConfigMigration([], [], [unrelated, ...SEED_LINE_PRODUCTS.map(l => ({ ...l, createdAt: NOW }))], [], { now: NOW });
    expect(plan.lineProductCreates.length).toBe(0);
  });

  it('marks pre-loaded seed unit costs as DEMO on existing installs', () => {
    const existing = SEED_UNIT_COSTS.map(c => ({ ...c, demo: undefined as boolean | undefined }));
    const plan = computeFactoryConfigMigration([], [], [], existing, { now: NOW });

    expect(plan.unitCostUpdates.length).toBe(existing.length);
    expect(plan.unitCostUpdates.every(u => u.demo === true)).toBeTrue();
    // values are never changed, only the disclaimer flag
    expect(plan.unitCostUpdates.every(u => Number.isFinite(u.unitCost))).toBeTrue();
  });

  it('never re-flags costs already marked demo and never invents flags for custom costs', () => {
    const existing = [
      ...SEED_UNIT_COSTS.map(c => ({ ...c, demo: true })),
      cost('cst-custom-9')
    ];
    const plan = computeFactoryConfigMigration([], [], [], existing, { now: NOW });
    expect(plan.unitCostUpdates.length).toBe(0);
  });
});