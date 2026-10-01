import { PRESSES_PER_TROLLEY, TrolleyUtil } from './trolley.util';

describe('Trolley input rule', () => {
  it('applies only to the stable Line 1 and Line 2 IDs', () => {
    expect(TrolleyUtil.isTrolleyLine('lin-001')).toBeTrue();
    expect(TrolleyUtil.isTrolleyLine('lin-002')).toBeTrue();
    expect(TrolleyUtil.isTrolleyLine('lin-003')).toBeFalse();
    expect(TrolleyUtil.isTrolleyLine('lin-005')).toBeFalse();
    expect(PRESSES_PER_TROLLEY).toBe(14);
  });

  it('preserves decimal trolley input and fractional presses without a six-decimal cutoff', () => {
    expect(TrolleyUtil.calculatePresses(30)).toBe(420);
    expect(TrolleyUtil.calculatePresses(30.5)).toBe(427);
    expect(TrolleyUtil.calculatePresses(30.25)).toBe(423.5);
    expect(TrolleyUtil.calculatePresses(0.5)).toBe(7);
    expect(TrolleyUtil.calculatePresses(0.0000001)).toBeCloseTo(0.0000014, 12);
  });

  it('accepts positive decimals and rejects zero, negatives, and non-numeric input', () => {
    for (const value of [30, 30.5, 30.25, 0.5]) {
      expect(TrolleyUtil.isValidTrolleyCount(value)).toBeTrue();
    }
    for (const value of [0, -1, '', null, undefined, NaN, Infinity, 'not a number', true, '0x10']) {
      expect(TrolleyUtil.isValidTrolleyCount(value)).toBeFalse();
    }
    expect(TrolleyUtil.calculatePresses('0x10' as unknown as number)).toBe(0);
  });

  it('never infers trolley data from a historical presses value', () => {
    expect(TrolleyUtil.trolleyCountOf({})).toBeNull();
    expect(TrolleyUtil.hasTrolleyData({})).toBeFalse();
    expect(TrolleyUtil.trolleyCountOf({ trolleyCount: 30.25 })).toBe(30.25);
  });
});
