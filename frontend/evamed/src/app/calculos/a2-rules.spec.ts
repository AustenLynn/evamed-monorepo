import { buildA2Rules } from './a2-rules';

// EN 15804+A2 rules the browser calculations share with ProjectResultsView (design 2026-11-20).
const A2_TYPES = [
  { id: 101, name_potential_type: 'GWP-total' },
  { id: 102, name_potential_type: 'GWP-biogenic' },
],
 CML_TYPES = [{ id: 3, name_potential_type: 'PCG 100' }],
 MSD = [
  // 1: current, A1-A3 only, biogenic uptake −10 per unit
  { material_id: 1, standard_id: 1, potential_type_id: 101, value: 4 },
  { material_id: 1, standard_id: 1, potential_type_id: 102, value: -10 },
  // 2: partial (no biogenic) → not current
  { material_id: 2, standard_id: 1, potential_type_id: 101, value: 4 },
  // 3: current through a complete A1/A2/A3 split
  ...[2, 3, 4].flatMap(s => [
    { material_id: 3, standard_id: s, potential_type_id: 101, value: 1 },
    { material_id: 3, standard_id: s, potential_type_id: 102, value: -1 },
  ]),
],
 MATERIALS = [
  { id: 1, unit_name: 'm²' }, { id: 2, unit_name: 'Kg' }, { id: 3, unit_name: 'Kg' },
  { id: 4, unit_name: 'Ton' }, { id: 5, unit_name: 'Pz' },
];

describe('buildA2Rules', () => {
  const rules = (types = A2_TYPES, conversions = [{ material_id: 1, value: 0.5 }]) =>
    buildA2Rules({ potentialTypesList: types, materialSchemeDataList: MSD, materialList: MATERIALS, conversionList: conversions });

  it('is off under CML, where every material counts and mass defaults to 1 t', () => {
    const r = rules(CML_TYPES, []);
    expect(r.active).toBe(false);
    expect(r.counts(2)).toBe(true);
    expect(r.tonnes(5)).toBe(1);
    expect(r.biogenicRelease([{ material_id: 1, quantity: 2, replaces: 1 }])).toBe(0);
  });

  it('counts only materials with every A2 indicator, read as the results page reads them', () => {
    const r = rules();
    expect(r.active).toBe(true);
    expect([1, 2, 3].map(id => r.counts(id))).toEqual([true, false, true]);
  });

  it('takes mass from Conversions, then from a kg or tonne unit, else none', () => {
    const r = rules();
    expect(r.tonnes(1)).toBe(0.5);
    expect(r.tonnes(2)).toBe(0.001);
    expect(r.tonnes(4)).toBe(1);
    expect(r.tonnes(5)).toBe(0);
  });

  it('releases the biogenic uptake of the original and each replacement', () => {
    const r = rules();
    expect(r.biogenicRelease([
      { material_id: 1, quantity: 2, replaces: 1 },   // −10 × 2 × 2 → 40
      { material_id: 3, quantity: 1, replaces: 0 },   // −3 (split) → 3
      { material_id: 2, quantity: 5, replaces: 0 },   // not current → 0
    ])).toBe(43);
  });

  it('applies the release to the biogenic and total climate indicators only', () => {
    const r = rules();
    expect(r.releasesInto(101)).toBe(true);
    expect(r.releasesInto(102)).toBe(true);
    expect(r.releasesInto(3)).toBe(false);
  });
});
