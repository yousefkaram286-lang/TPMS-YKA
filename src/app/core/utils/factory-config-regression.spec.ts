import { ProductionUtil } from './production.util';
import { MasterDataUtil } from './master-data.util';
import { VERIFIED_PRODUCTS, SEED_PRODUCTS } from '../constants/seed-data';

// ============================================================================
// PPP RECONCILIATION REGRESSION — BUSINESS-CONFIRMED pieces per press.
// ----------------------------------------------------------------------------
// Confirmed factory master: Solid 10 = 80 → 8000 @100 presses, Solid 12 = 64 → 6400,
// Block 25 = 10.5 → 1050, Block 20 = 12.5 → 1250, Block 15 = 16.5 → 1650,
// Block 12 = 18.5 → 1850, Block 10 = 22.5 → 2250.
// PPP must come from the Product master (never from productMachines or a
// line-level override) and must never be rounded.
// ============================================================================

describe('PPP Reconciliation Regression (business-confirmed)', () => {
  const PRESSES = 100;

  const cases: { id: string; name: string; expectedPpp: number; expectedTotal: number }[] = [
    { id: 'prd-005', name: 'Solid 10', expectedPpp: 80, expectedTotal: 8000 },
    { id: 'prd-004', name: 'Solid 12', expectedPpp: 64, expectedTotal: 6400 },
    { id: 'prd-006', name: 'Block 25', expectedPpp: 10.5, expectedTotal: 1050 },
    { id: 'prd-001', name: 'Block 20', expectedPpp: 12.5, expectedTotal: 1250 },
    { id: 'prd-002', name: 'Block 15', expectedPpp: 16.5, expectedTotal: 1650 },
    { id: 'prd-007', name: 'Block 12', expectedPpp: 18.5, expectedTotal: 1850 },
    { id: 'prd-008', name: 'Block 10', expectedPpp: 22.5, expectedTotal: 2250 }
  ];

  it('the verified seed master carries a product master entry for every current product', () => {
    expect(VERIFIED_PRODUCTS.length).toBe(7);
    for (const c of cases) {
      const seed = VERIFIED_PRODUCTS.find(p => p.id === c.id);
      expect(seed).toBeDefined(`missing verified product ${c.id} (${c.name})`);
    }
  });

  it('Solid 10 @ 100 presses produces exactly 8000 (former 4000 report anomaly)', () => {
    const solid10 = SEED_PRODUCTS.find(p => p.id === 'prd-005');
    const ppp = MasterDataUtil.piecesPerPressOf(solid10);
    expect(ppp).toBe(80);
    expect(ProductionUtil.calculateProduced(ppp!, PRESSES)).toBe(8000);
  });

  it('100-press totals match the confirmed factory unit sheet for every current product', () => {
    for (const c of cases) {
      const product = SEED_PRODUCTS.find(p => p.id === c.id);
      const ppp = MasterDataUtil.piecesPerPressOf(product);
      expect(MasterDataUtil.piecesPerPressOf(product)).toBe(c.expectedPpp);
      expect(ProductionUtil.calculateProduced(ppp!, PRESSES)).toBe(c.expectedTotal);
    }
  });

  it('PPP is never rounded (fractional 10.5 … 22.5 stay exact)', () => {
    for (const c of cases) {
      const product = SEED_PRODUCTS.find(p => p.id === c.id);
      expect(MasterDataUtil.piecesPerPressOf(product)).toBe(c.expectedPpp);
    }
  });
});