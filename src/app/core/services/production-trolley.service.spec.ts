import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { ProductionService } from './production.service';
import { SupabaseService } from './supabase.service';

describe('Production trolley persistence', () => {
  const createdAt = '2026-09-29T08:00:00Z';
  let rows: Map<string, any>;
  let lastWrite: any;
  let service: ProductionService;

  beforeEach(() => {
    rows = new Map<string, any>();
    lastWrite = null;
    const client = {
      from: (table: string) => {
        expect(table).toBe('productions');
        return {
          select: () => ({
            eq: (_column: string, id: string) => ({
              single: () => Promise.resolve({ data: rows.get(id) ?? null, error: null })
            })
          }),
          insert: (payload: any) => ({
            select: () => ({ single: () => {
              lastWrite = payload;
              rows.set(payload.id, { ...payload });
              return Promise.resolve({ data: { ...payload }, error: null });
            } })
          }),
          update: (payload: any) => ({
            eq: (_column: string, id: string) => ({
              select: () => ({ single: () => {
                lastWrite = payload;
                const updated = { ...rows.get(id), ...payload };
                rows.set(id, updated);
                return Promise.resolve({ data: { ...updated }, error: null });
              } })
            })
          })
        };
      }
    };
    TestBed.configureTestingModule({ providers: [
      ProductionService,
      { provide: SupabaseService, useValue: { client } }
    ] });
    service = TestBed.inject(ProductionService);
  });

  it('derives Line 1 and Line 2 whole Presses from 0.5 increments, including fractional PPP output', () => {
    for (const lineId of ['lin-001', 'lin-002']) {
      for (const [trolleys, presses] of [[0, 0], [0.5, 7], [1, 14], [1.5, 21], [30, 420], [30.5, 427]] as Array<[number, number]>) {
        const record = service.createProductionRecord({
          id: `${lineId}-${trolleys}`, date: '2026-09-29', lineId,
          productId: 'prd-008', piecesPerPress: 22.5,
          presses: 999, trolleyCount: trolleys, createdAt
        });
        expect(record.trolleyCount).toBe(trolleys);
        expect(record.pressesPerTrolley).toBe(14);
        expect(record.presses).toBe(presses);
        expect(record.produced).toBe(presses * 22.5);
        expect(Number.isInteger(record.presses)).toBeTrue();
      }
    }
  });

  it('rejects every trolley count that is not a multiple of 0.5', () => {
    for (const trolleys of [0.25, 0.75, 1.25, 30.25]) {
      expect(() => service.createProductionRecord({
        id: `bad-${trolleys}`, date: '2026-09-29', lineId: 'lin-001',
        productId: 'prd-008', piecesPerPress: 22.5,
        presses: 0, trolleyCount: trolleys, createdAt
      })).withContext(String(trolleys)).toThrowError(/multiple of 0\.5/i);
    }
  });

  it('accepts a zero-trolley session as a valid zero-production record', () => {
    const record = service.createProductionRecord({
      id: 'zero-session', date: '2026-09-29', lineId: 'lin-001',
      productId: 'prd-008', piecesPerPress: 22.5,
      presses: 999, trolleyCount: 0, createdAt
    });
    expect(record.trolleyCount).toBe(0);
    expect(record.pressesPerTrolley).toBe(14);
    expect(record.presses).toBe(0);
    expect(record.produced).toBe(0);
  });

  it('stores and reloads trolley count, factor snapshot, whole presses, and Produced', async () => {
    const record = service.createProductionRecord({
      id: 'trolley-1', date: '2026-09-29', lineId: 'lin-001',
      productId: 'prd-008', piecesPerPress: 22.5,
      presses: 0, trolleyCount: 30.5, createdAt
    });
    const saved = await firstValueFrom(service.create(record));
    const reloaded = await firstValueFrom(service.getById(record.id));

    expect(lastWrite.trolley_count).toBe(30.5);
    expect(lastWrite.presses_per_trolley).toBe(14);
    expect(lastWrite.presses).toBe(427);
    expect(lastWrite.produced).toBe(9607.5);
    expect(saved.trolleyCount).toBe(30.5);
    expect(reloaded?.trolleyCount).toBe(30.5);
    expect(reloaded?.pressesPerTrolley).toBe(14);
    expect(reloaded?.presses).toBe(427);
    expect(reloaded?.produced).toBe(9607.5);
  });

  it('round-trips a zero-trolley session through the database mapping', async () => {
    const record = service.createProductionRecord({
      id: 'zero-db', date: '2026-09-29', lineId: 'lin-001',
      productId: 'prd-008', piecesPerPress: 22.5,
      presses: 0, trolleyCount: 0, createdAt
    });
    await firstValueFrom(service.create(record));
    const reloaded = await firstValueFrom(service.getById(record.id));

    // 0 is a real trolley count, not "no trolley data": it must be stored as 0
    // and read back as 0 (not collapsed to null/undefined).
    expect(lastWrite.trolley_count).toBe(0);
    expect(lastWrite.presses_per_trolley).toBe(14);
    expect(lastWrite.presses).toBe(0);
    expect(lastWrite.produced).toBe(0);
    expect(reloaded?.trolleyCount).toBe(0);
    expect(reloaded?.presses).toBe(0);
    expect(reloaded?.produced).toBe(0);
  });

  it('keeps other lines on manual presses and rejects trolley data on them', () => {
    const input = {
      id: 'manual-3', date: '2026-09-29', lineId: 'lin-003',
      productId: 'prd-004', piecesPerPress: 10.5, presses: 3,
      createdAt
    };
    const record = service.createProductionRecord(input);
    expect(record.presses).toBe(3);
    expect(record.produced).toBe(31.5);
    expect(record.trolleyCount).toBeUndefined();
    expect(() => service.createProductionRecord({ ...input, trolleyCount: 2 })).toThrowError(/only valid for Line 1 and Line 2/);
  });

  it('does not backfill trolley data when an old Line 1 row is read and updated', async () => {
    rows.set('legacy-1', {
      id: 'legacy-1', session_id: 'session-1', date: '2026-09-01',
      shift_id: 'shf-001', line_id: 'lin-001', machine_id: null,
      supervisor: 'original', product_id: 'prd-008', pieces_per_press: 22.5,
      presses: 100, produced: 2250, trolley_count: null,
      presses_per_trolley: null, released_output: null, output: null,
      created_at: createdAt, updated_at: null
    });
    const old = await firstValueFrom(service.getById('legacy-1'));
    expect(old?.trolleyCount).toBeUndefined();
    await firstValueFrom(service.update({ ...old!, supervisor: 'edited' }));
    const reloaded = await firstValueFrom(service.getById('legacy-1'));
    expect(lastWrite.trolley_count).toBeNull();
    expect(lastWrite.presses_per_trolley).toBeNull();
    expect(reloaded?.presses).toBe(100);
    expect(reloaded?.produced).toBe(2250);
    expect(reloaded?.trolleyCount).toBeUndefined();
  });
});
