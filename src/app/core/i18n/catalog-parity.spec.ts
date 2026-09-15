import { AR } from './ar';
import { EN } from './en';

describe('translation catalog parity', () => {
  it('has the same keys in English and Arabic', () => {
    expect(Object.keys(AR).sort()).toEqual(Object.keys(EN).sort());
  });
});
