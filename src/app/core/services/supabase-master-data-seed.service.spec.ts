import { TestBed } from '@angular/core/testing';

import { SupabaseMasterDataSeedService, SUPABASE_MASTER_SEED_DONE_KEY } from './supabase-master-data-seed.service';
import { SupabaseService } from './supabase.service';
import { FakeSupabaseClient } from '../testing/fake-supabase.client';
import { SEED_LINE_PRODUCTS } from '../constants/seed-data';

describe('SupabaseMasterDataSeedService', () => {
  let fake: FakeSupabaseClient;
  let svc: SupabaseMasterDataSeedService;

  function build(seedTables: Record<string, any[]> = {}) {
    fake = new FakeSupabaseClient(seedTables);
    TestBed.configureTestingModule({
      providers: [
        SupabaseMasterDataSeedService,
        { provide: SupabaseService, useValue: { client: fake } }
      ]
    });
    svc = TestBed.inject(SupabaseMasterDataSeedService);
  }

  beforeEach(() => {
    localStorage.removeItem(SUPABASE_MASTER_SEED_DONE_KEY);
  });

  it('seeds the confirmed baseline once and is additive/idempotent on re-run', async () => {
    build();
    const first = await svc.runSeed();

    expect(first.linesInserted).toBe(5);
    expect(first.productsInserted).toBe(7);
    expect(first.materialsInserted).toBe(4);
    expect(first.mappingsInserted).toBe(18);
    expect(first.conflicts.length).toBe(0);

    // Force a real re-run (not the flag short-circuit) to prove idempotency.
    localStorage.removeItem(SUPABASE_MASTER_SEED_DONE_KEY);
    const second = await svc.runSeed();

    expect(second.linesInserted).toBe(0);
    expect(second.productsInserted).toBe(0);
    expect(second.materialsInserted).toBe(0);
    expect(second.mappingsInserted).toBe(0);
    expect(second.conflicts.length).toBe(0);

    expect(fake.rowCount('lines')).toBe(5);
    expect(fake.rowCount('products')).toBe(7);
    expect(fake.rowCount('materials')).toBe(4);
    expect(fake.rowCount('line_products')).toBe(18);
  });

  it('a fresh device receives the same central mappings (and Line 5 stays empty)', async () => {
    build();
    await svc.runSeed();

    const mappings = fake.tables['line_products'];
    expect(mappings.length).toBe(SEED_LINE_PRODUCTS.length);
    expect(mappings.some(m => m.line_id === 'lin-005')).toBeFalse();

    const lines = fake.tables['lines'].map((l: any) => l.name).sort();
    expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5']);

    const materials = fake.tables['materials'].map((m: any) => m.name).sort();
    expect(materials).toEqual(['Aggregate', 'Cement', 'Sand', 'Water']);
  });

  it('does NOT overwrite a user-modified product and reports the conflict', async () => {
    build({
      products: [
        {
          id: 'prd-004', name: 'Solid 12', name_ar: 'مصمت 12', type: 'SOLID',
          pieces_per_press: 40, product_area: 300, standard_strength: 180,
          standard_height: 12, standard_weight: 3.7, dimensions: null,
          density_kg_per_m3: null, active: true, created_at: '2026-01-01T00:00:00.000Z'
        }
      ]
    });

    const result = await svc.runSeed();

    expect(fake.tables['products'][0].pieces_per_press).toBe(40); // untouched
    expect(result.productsInserted).toBe(6); // the other 6 products seeded
    const conflict = result.conflicts.find(c => c.entity === 'product' && c.seedId === 'prd-004');
    expect(conflict).toBeDefined();
    expect(conflict!.expected).toBe(64);
    expect(conflict!.actual).toBe(40);
  });

  it('never touches recipes / machines / unit-costs / profiles during seeding', async () => {
    build();
    await svc.runSeed();

    expect(fake.rowCount('recipes')).toBe(0);
    expect(fake.rowCount('machines')).toBe(0);
    expect(fake.rowCount('unit_costs')).toBe(0);
    expect(fake.rowCount('profiles')).toBe(0);
  });

  it('skips writes entirely when the seed-completed flag is already set', async () => {
    build();
    localStorage.setItem(SUPABASE_MASTER_SEED_DONE_KEY, 'true');

    const result = await svc.runSeed();

    expect(result.linesInserted).toBe(0);
    expect(fake.rowCount('lines')).toBe(0);
  });

  it('records the completion flag only after a successful seed', async () => {
    build();
    expect(localStorage.getItem(SUPABASE_MASTER_SEED_DONE_KEY)).toBeNull();

    await svc.runSeed();

    expect(localStorage.getItem(SUPABASE_MASTER_SEED_DONE_KEY)).toBe('true');
  });
});