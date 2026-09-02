import { TestBed } from '@angular/core/testing';

import { LineProductService } from './line-product.service';
import { SupabaseService } from './supabase.service';
import { FakeSupabaseClient } from '../testing/fake-supabase.client';

const NOW = '2026-09-02T00:00:00.000Z';

describe('LineProductService (Supabase-backed central line ↔ product mapping)', () => {
  let fake: FakeSupabaseClient;

  function build(): LineProductService {
    fake = new FakeSupabaseClient({
      line_products: [
        { id: 'lpm-1', line_id: 'lin-001', product_id: 'prd-004', created_at: NOW },
        { id: 'lpm-2', line_id: 'lin-003', product_id: 'prd-005', created_at: NOW }
      ]
    });
    TestBed.configureTestingModule({
      providers: [
        LineProductService,
        { provide: SupabaseService, useValue: { client: fake } }
      ]
    });
    return TestBed.inject(LineProductService);
  }

  it('getAll returns the SAME central mappings for any device/browser session', (done) => {
    const svc = build();
    svc.getAll().subscribe(list => {
      expect(list.length).toBe(2);
      expect(list[0]).toEqual({ id: 'lpm-1', lineId: 'lin-001', productId: 'prd-004', createdAt: NOW });
      expect(list[1].lineId).toBe('lin-003');
      done();
    });
  });

  it('getById maps the matching row from snake_case to the model', (done) => {
    const svc = build();
    svc.getById('lpm-2').subscribe(mapping => {
      expect(mapping).toBeDefined();
      expect(mapping!.lineId).toBe('lin-003');
      expect(mapping!.productId).toBe('prd-005');
      done();
    });
  });

  it('create persists the mapping to the central table in snake_case', (done) => {
    const svc = build();
    svc.create({ id: 'lpm-new', lineId: 'lin-002', productId: 'prd-001', createdAt: NOW }).subscribe(created => {
      expect(created.productId).toBe('prd-001');
      expect(fake.rowCount('line_products')).toBe(3);
      expect(fake.tables['line_products'][2]).toEqual(
        jasmine.objectContaining({ id: 'lpm-new', line_id: 'lin-002', product_id: 'prd-001' })
      );
      done();
    });
  });

  it('delete removes the mapping from the central table by id', (done) => {
    const svc = build();
    svc.delete('lpm-1').subscribe(() => {
      expect(fake.rowCount('line_products')).toBe(1);
      expect(fake.tables['line_products'][0].id).toBe('lpm-2');
      done();
    });
  });
});