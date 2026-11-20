import { isClimateChangeTotal } from './climate';

describe('isClimateChangeTotal', () => {
  it('accepts the CML and the EN 15804+A2 climate change totals', () => {
    expect(isClimateChangeTotal('Calentamiento Global')).toBe(true);
    expect(isClimateChangeTotal('Calentamiento global, total')).toBe(true);
  });

  it('rejects the A2 sub-indicators and other impacts', () => {
    expect(isClimateChangeTotal('Calentamiento global, fósil')).toBe(false);
    expect(isClimateChangeTotal('Acidificación')).toBe(false);
  });
});
