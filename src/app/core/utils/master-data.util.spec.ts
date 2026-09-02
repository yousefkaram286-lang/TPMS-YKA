import { MasterDataUtil } from './master-data.util';
import { Product } from '../models/product.model';
import { Material } from '../models/material.model';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'prd-test',
    name: 'Test Product',
    standardStrength: 15,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function makeMaterial(overrides: Partial<Material>): Material {
  return {
    id: 'mat-test',
    name: 'Sand',
    unit: 'kg',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('MasterDataUtil (Settings / Master Data)', () => {

  // ─── Product: PiecesPerPress ────────────────────────────────────────────
  it('piecesPerPress is configurable from Product master', () => {
    const product = makeProduct({ piecesPerPress: 10.5 });
    expect(MasterDataUtil.piecesPerPressOf(product)).toBe(10.5);
  });

  it('piecesPerPress returns undefined when absent (no invented value)', () => {
    const product = makeProduct({});
    expect(MasterDataUtil.piecesPerPressOf(product)).toBeUndefined();
  });

  // ─── Product: ProductArea ───────────────────────────────────────────────
  it('productArea is configurable from Product master', () => {
    const product = makeProduct({ productArea: 0.1 });
    expect(MasterDataUtil.productAreaOf(product)).toBe(0.1);
  });

  it('productArea returns undefined when absent (no invented value)', () => {
    const product = makeProduct({});
    expect(MasterDataUtil.productAreaOf(product)).toBeUndefined();
  });

  // ─── Product: CompressionStandard ───────────────────────────────────────
  it('compressionStandard reads the configurable standardStrength field', () => {
    const product = makeProduct({ standardStrength: 35 });
    expect(MasterDataUtil.compressionStandardOf(product)).toBe(35);
  });

  it('compressionStandard returns undefined when unconfigured (no invented value)', () => {
    const product = makeProduct({ standardStrength: undefined });
    expect(MasterDataUtil.compressionStandardOf(product)).toBeUndefined();
  });

  // ─── Materials: SandKgPerM3 / AggregateKgPerM3 conversions ─────────────
  it('SandKgPerM3 is configurable (per-material conversionKgPerM3)', () => {
    const sand = makeMaterial({ name: 'Sand', conversionKgPerM3: 1600 });
    expect(MasterDataUtil.conversionKgPerM3Of(sand)).toBe(1600);
    expect(MasterDataUtil.isConfiguredConversion(sand.conversionKgPerM3)).toBeTrue();
  });

  it('AggregateKgPerM3 is configurable (per-material conversionKgPerM3)', () => {
    const aggregate = makeMaterial({ name: 'Aggregate', conversionKgPerM3: 1400 });
    expect(MasterDataUtil.conversionKgPerM3Of(aggregate)).toBe(1400);
    expect(MasterDataUtil.isConfiguredConversion(aggregate.conversionKgPerM3)).toBeTrue();
  });

  it('NO invented default conversion value when none configured', () => {
    const sand = makeMaterial({ name: 'Sand' });           // no conversion
    const aggregate = makeMaterial({ name: 'Aggregate' }); // no conversion
    expect(MasterDataUtil.conversionKgPerM3Of(sand)).toBeUndefined();
    expect(MasterDataUtil.conversionKgPerM3Of(aggregate)).toBeUndefined();
    expect(MasterDataUtil.isConfiguredConversion(sand.conversionKgPerM3)).toBeFalse();
    expect(MasterDataUtil.isConfiguredConversion(aggregate.conversionKgPerM3)).toBeFalse();
  });

  it('isConfiguredConversion rejects zero / negative / non-finite values', () => {
    expect(MasterDataUtil.isConfiguredConversion(0)).toBeFalse();
    expect(MasterDataUtil.isConfiguredConversion(-5)).toBeFalse();
    expect(MasterDataUtil.isConfiguredConversion(NaN)).toBeFalse();
    expect(MasterDataUtil.isConfiguredConversion(undefined)).toBeFalse();
    expect(MasterDataUtil.isConfiguredConversion(null)).toBeFalse();
  });
});