import { PRESSES_PER_TROLLEY, TROLLEY_STEP, TrolleyUtil } from './trolley.util';

describe('Trolley input rule', () => {
  it('applies only to the stable Line 1 and Line 2 IDs', () => {
    expect(TrolleyUtil.isTrolleyLine('lin-001')).toBeTrue();
    expect(TrolleyUtil.isTrolleyLine('lin-002')).toBeTrue();
    expect(TrolleyUtil.isTrolleyLine('lin-003')).toBeFalse();
    expect(TrolleyUtil.isTrolleyLine('lin-005')).toBeFalse();
    expect(PRESSES_PER_TROLLEY).toBe(14);
  });

  it('steps the Trolley field by 0.5, which is 7 Presses', () => {
    expect(TROLLEY_STEP).toBe(0.5);
    // The UI affordance must match the maths: half a trolley is 7 presses.
    expect(TrolleyUtil.calculatePresses(TROLLEY_STEP)).toBe(7);
  });

  it('derives whole Presses for every valid trolley count', () => {
    expect(TrolleyUtil.calculatePresses(0)).toBe(0);
    expect(TrolleyUtil.calculatePresses(0.5)).toBe(7);
    expect(TrolleyUtil.calculatePresses(1)).toBe(14);
    expect(TrolleyUtil.calculatePresses(1.5)).toBe(21);
    expect(TrolleyUtil.calculatePresses(2)).toBe(28);
    expect(TrolleyUtil.calculatePresses(2.5)).toBe(35);
    expect(TrolleyUtil.calculatePresses(30)).toBe(420);
    expect(TrolleyUtil.calculatePresses(30.5)).toBe(427);
  });

  it('ACCEPTS the confirmed valid examples', () => {
    for (const value of [0, 0.5, 1, 1.5, 30.5]) {
      expect(TrolleyUtil.isValidTrolleyCount(value)).withContext(String(value)).toBeTrue();
      expect(TrolleyUtil.isOnStep(value)).withContext(String(value)).toBeTrue();
      expect(TrolleyUtil.hasWholePresses(value)).withContext(String(value)).toBeTrue();
      expect(Number.isInteger(TrolleyUtil.calculatePresses(value))).withContext(String(value)).toBeTrue();
    }
  });

  it('REJECTS the confirmed invalid off-step examples', () => {
    for (const value of [0.25, 0.75, 1.25, 30.25]) {
      expect(TrolleyUtil.isValidTrolleyCount(value)).withContext(String(value)).toBeFalse();
      expect(TrolleyUtil.isOnStep(value)).withContext(String(value)).toBeFalse();
      expect(TrolleyUtil.hasWholePresses(value)).withContext(String(value)).toBeFalse();
    }
  });

  it('accepts 0 because a stopped line is a valid zero-production session', () => {
    expect(TrolleyUtil.isValidTrolleyCount(0)).toBeTrue();
    expect(TrolleyUtil.isNumericTrolleyCount(0)).toBeTrue();
    expect(TrolleyUtil.isOnStep(0)).toBeTrue();
    expect(TrolleyUtil.isValidTrolleyCount('0')).toBeTrue();
    expect(TrolleyUtil.calculatePresses(0)).toBe(0);
  });

  it('rejects negatives and non-numeric input', () => {
    for (const value of [-1, -0.5, -2, '', '  ', 'not a number', null, undefined, NaN, Infinity, true, '0x10', '1e3x']) {
      expect(TrolleyUtil.isValidTrolleyCount(value as unknown)).withContext(String(value)).toBeFalse();
      expect(TrolleyUtil.isNumericTrolleyCount(value as unknown)).withContext(String(value)).toBeFalse();
    }
  });

  it('never floors, ceils, rounds or snaps an off-step value', () => {
    // 30.25 must NOT become 30, 30.5, 423 or 424 anywhere in the utility.
    expect(TrolleyUtil.calculatePresses(30.25)).toBe(423.5);
    expect(TrolleyUtil.calculatePresses(30.25)).not.toBe(423);
    expect(TrolleyUtil.calculatePresses(30.25)).not.toBe(424);
    expect(TrolleyUtil.calculatePresses(0.75)).toBe(10.5);
    expect(TrolleyUtil.calculatePresses(1.25)).toBe(17.5);
  });

  it('decides the step on the exact decimal value, not the float product', () => {
    // Raw IEEE-754 multiplication is unreliable in both directions, so the
    // validator must not be a `Number.isInteger(x * 2)` test. 0.1 * 14 is
    // 1.4000000000000001, and values that round-trip through float arithmetic
    // must still be judged on the decimal the operator actually typed.
    expect(0.1 * 14).not.toBe(1.4);
    expect(TrolleyUtil.isOnStep(0.1)).toBeFalse();

    // A legitimate half increment is never rejected because of float noise.
    expect(TrolleyUtil.isOnStep(30.5)).toBeTrue();
    expect(TrolleyUtil.isOnStep(0.1 + 0.4)).toBeTrue();
    expect(TrolleyUtil.isOnStep(30.5 + 0.2)).toBeFalse();
  });

  it('accepts a plain decimal string as a valid trolley count', () => {
    expect(TrolleyUtil.isValidTrolleyCount('30.5')).toBeTrue();
    expect(TrolleyUtil.isValidTrolleyCount(' 0.5 ')).toBeTrue();
    expect(TrolleyUtil.isValidTrolleyCount('30.25')).toBeFalse();
    expect(TrolleyUtil.calculatePresses('30.5')).toBe(427);
  });

  it('returns 0 presses for non-numeric input rather than throwing', () => {
    expect(TrolleyUtil.calculatePresses('0x10' as unknown as number)).toBe(0);
    expect(TrolleyUtil.calculatePresses(null)).toBe(0);
    expect(TrolleyUtil.calculatePresses(undefined)).toBe(0);
  });

  it('never infers trolley data from a historical presses value', () => {
    expect(TrolleyUtil.trolleyCountOf({})).toBeNull();
    expect(TrolleyUtil.hasTrolleyData({})).toBeFalse();
    expect(TrolleyUtil.trolleyCountOf({ presses: 300 } as never)).toBeNull();
  });

  it('preserves a stored zero trolley count as real trolley data', () => {
    // 0 is a genuine entry (line stopped) and must not read as "no trolley data",
    // otherwise a zero session would silently fall back to manual Presses.
    expect(TrolleyUtil.trolleyCountOf({ trolleyCount: 0 })).toBe(0);
    expect(TrolleyUtil.hasTrolleyData({ trolleyCount: 0 })).toBeTrue();
    expect(TrolleyUtil.trolleyCountOf({ trolleyCount: null })).toBeNull();
    expect(TrolleyUtil.trolleyCountOf({ trolleyCount: -1 })).toBeNull();
  });

  it('reads back a stored half-trolley count', () => {
    expect(TrolleyUtil.trolleyCountOf({ trolleyCount: 30.5 })).toBe(30.5);
    expect(TrolleyUtil.hasTrolleyData({ trolleyCount: 30.5 })).toBeTrue();
  });
});
