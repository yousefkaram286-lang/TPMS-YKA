import { computePiecesPerPressBackfill } from './pieces-per-press-migration.util';

describe('PiecesPerPress Migration Logic', () => {

  it('backfills from one legacy value safely', () => {
    const products = [
      { id: 'prd-001', name: 'Block 20' },  // no piecesPerPress
    ];
    const configs = [
      { productId: 'prd-001', piecesPerPress: 5, machineId: 'mac-001' },
      { productId: 'prd-001', piecesPerPress: 5, machineId: 'mac-002' },
    ];

    const result = computePiecesPerPressBackfill(products, configs);

    expect(result.migrated.length).toBe(1);
    expect(result.migrated[0]).toEqual({ productId: 'prd-001', piecesPerPress: 5 });
    expect(result.conflicts.length).toBe(0);
    expect(result.unconfigured.length).toBe(0);
  });

  it('backfills when multiple configs share the same numeric value', () => {
    const products = [
      { id: 'prd-002', name: 'Block 15' },
    ];
    const configs = [
      { productId: 'prd-002', piecesPerPress: 6, machineId: 'mac-001' },
      { productId: 'prd-002', piecesPerPress: 6, machineId: 'mac-002' },
      { productId: 'prd-002', piecesPerPress: 6, machineId: 'mac-003' },
    ];

    const result = computePiecesPerPressBackfill(products, configs);

    expect(result.migrated.length).toBe(1);
    expect(result.migrated[0]).toEqual({ productId: 'prd-002', piecesPerPress: 6 });
    expect(result.conflicts.length).toBe(0);
  });

  it('does NOT backfill when multiple different values exist (conflict)', () => {
    const products = [
      { id: 'prd-003', name: 'Interlock' },
    ];
    const configs = [
      { productId: 'prd-003', piecesPerPress: 10, machineId: 'mac-001' },
      { productId: 'prd-003', piecesPerPress: 12, machineId: 'mac-002' },
    ];

    const result = computePiecesPerPressBackfill(products, configs);

    expect(result.migrated.length).toBe(0);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].productId).toBe('prd-003');
    expect(result.conflicts[0].values).toEqual(jasmine.arrayContaining([10, 12]));
    expect(result.unconfigured.length).toBe(0);
  });

  it('does NOT overwrite existing Product.piecesPerPress', () => {
    const products = [
      { id: 'prd-001', name: 'Block 20', piecesPerPress: 8 },
    ];
    const configs = [
      { productId: 'prd-001', piecesPerPress: 5, machineId: 'mac-001' },
    ];

    const result = computePiecesPerPressBackfill(products, configs);

    expect(result.migrated.length).toBe(0);
    expect(result.conflicts.length).toBe(0);
    expect(result.unconfigured.length).toBe(0);
  });

  it('leaves product unconfigured when no legacy configs exist', () => {
    const products = [
      { id: 'prd-new', name: 'New Product' },
    ];
    const configs = [
      { productId: 'prd-other', piecesPerPress: 5, machineId: 'mac-001' },
    ];

    const result = computePiecesPerPressBackfill(products, configs);

    expect(result.migrated.length).toBe(0);
    expect(result.conflicts.length).toBe(0);
    expect(result.unconfigured).toEqual(['prd-new']);
  });

  it('handles mixed scenarios across multiple products', () => {
    const products = [
      { id: 'prd-a', name: 'Product A' },              // no value, 1 config → backfill
      { id: 'prd-b', name: 'Product B', piecesPerPress: 7 }, // already configured → skip
      { id: 'prd-c', name: 'Product C' },              // no value, 2 configs → conflict
      { id: 'prd-d', name: 'Product D' },              // no value, no configs → unconfigured
    ];
    const configs = [
      { productId: 'prd-a', piecesPerPress: 5, machineId: 'mac-001' },
      { productId: 'prd-c', piecesPerPress: 10, machineId: 'mac-001' },
      { productId: 'prd-c', piecesPerPress: 12, machineId: 'mac-002' },
    ];

    const result = computePiecesPerPressBackfill(products, configs);

    expect(result.migrated.length).toBe(1);
    expect(result.migrated[0]).toEqual({ productId: 'prd-a', piecesPerPress: 5 });
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].productId).toBe('prd-c');
    expect(result.unconfigured).toEqual(['prd-d']);
  });

  it('ignores zero and negative legacy values', () => {
    const products = [
      { id: 'prd-001', name: 'Block 20' },
    ];
    const configs = [
      { productId: 'prd-001', piecesPerPress: 0, machineId: 'mac-001' },
      { productId: 'prd-001', piecesPerPress: -5, machineId: 'mac-002' },
    ];

    const result = computePiecesPerPressBackfill(products, configs);

    expect(result.migrated.length).toBe(0);
    expect(result.conflicts.length).toBe(0);
    expect(result.unconfigured).toEqual(['prd-001']);
  });
});
