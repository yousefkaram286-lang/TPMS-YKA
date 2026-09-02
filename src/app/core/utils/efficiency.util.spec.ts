import { EfficiencyUtil } from './efficiency.util';

describe('EfficiencyUtil', () => {

  it('regression 1: no OT, no DT', () => {
    const result = EfficiencyUtil.calculateEfficiency(0, 0);
    expect(result.availableMinutes).toBe(390);
    expect(result.actualRunMinutes).toBe(390);
    expect(result.timeEfficiency).toBe(100);
  });

  it('regression 2: 1.5 hours OT, no DT', () => {
    const result = EfficiencyUtil.calculateEfficiency(1.5, 0);
    expect(result.availableMinutes).toBe(480);
    expect(result.actualRunMinutes).toBe(480);
    expect(result.timeEfficiency).toBe(100);
  });

  it('regression 3: 1.5 hours OT, 30 mins DT', () => {
    const result = EfficiencyUtil.calculateEfficiency(1.5, 30);
    expect(result.availableMinutes).toBe(480);
    expect(result.actualRunMinutes).toBe(450);
    expect(result.timeEfficiency).toBe(93.75);
  });

  it('handles negative downtime gracefully', () => {
    const result = EfficiencyUtil.calculateEfficiency(0, -50);
    // Should treat -50 as 0
    expect(result.availableMinutes).toBe(390);
    expect(result.actualRunMinutes).toBe(390);
    expect(result.timeEfficiency).toBe(100);
  });

  it('handles downtime greater than available time (prevents negative actual run time)', () => {
    const result = EfficiencyUtil.calculateEfficiency(0, 500);
    // 390 available, 500 downtime => actual should be 0, not negative
    expect(result.availableMinutes).toBe(390);
    expect(result.actualRunMinutes).toBe(0);
    expect(result.timeEfficiency).toBe(0);
  });

  it('handles negative overtime gracefully', () => {
    const result = EfficiencyUtil.calculateEfficiency(-2, 0);
    // Should treat -2 as 0
    expect(result.availableMinutes).toBe(390);
    expect(result.actualRunMinutes).toBe(390);
    expect(result.timeEfficiency).toBe(100);
  });
});
