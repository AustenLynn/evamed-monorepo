import { isClimateChangeTotal, muestraReferenciaCarbono, OPCIONES_CARBONO, valorReferenciaCarbono } from './climate';

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

describe('carbon reference on the project card (audit A-27, A-28)', () => {
  const casa = { id: 1, use_id: 1, living_area: 100 };

  it('is offered for housing projects with the climate change total selected, from the start', () => {
    expect(muestraReferenciaCarbono('Calentamiento global, total', casa)).toBe(true);
    expect(muestraReferenciaCarbono('Acidificación', casa)).toBe(false);
    expect(muestraReferenciaCarbono('Calentamiento global, total', { ...casa, use_id: 2 })).toBe(false);
  });

  it('only offers scales whose values have been confirmed', () => {
    expect(OPCIONES_CARBONO).toEqual(['Vivienda sustentable']);
  });

  it('has no value without use-stage data or habitable surface', () => {
    expect(valorReferenciaCarbono(0, 100, 50)).toBeNull();
    expect(valorReferenciaCarbono(5000, 0, 50)).toBeNull();
    expect(valorReferenciaCarbono(5000, 100, 50)).toBe(1);
  });
});
