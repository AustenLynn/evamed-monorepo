import { UsageState } from '../usage.models';

/** Synthetic test-only values; never imported by production components. */
export const usageFixture = (): UsageState => ({
  project_id: 5, project_name: 'Casa de ejemplo', revision: 'saved-1',
  annual: {id: 11, quantity: 10000, unit_id: 22}, annuals: [{id: 11, quantity: 10000, unit_id: 22}],
  canonical_unit_id: 22, units: [{id: 22, name_unit: 'kWh'}, {id: 1, name_unit: 'Pz'}], issues: [],
  catalogue: [
    {id: 2, name: 'Energía eléctrica, Medio voltaje (MX)-ECOINVENT3', display_name: 'Energía eléctrica, Medio voltaje', family: 'electric', database: 'ECOINVENT 3', region: 'México'},
    {id: 9, name: 'Energía eléctrica, Alto voltaje (MX)-ECOINVENT3', display_name: 'Energía eléctrica, Alto voltaje', family: 'electric', database: 'ECOINVENT 3', region: 'México'},
    {id: 11, name: 'Calefacción doméstica con gas natural (GLO)', display_name: 'Calefacción doméstica con gas natural', family: 'fuel', database: null, region: 'Global'},
  ],
  sources: [
    {id: 21, annual_consumption_required_id: 11, percentage: 60, quantity: '6000.0000000000', unit_id: 22, type: 2, source: 'electric', issues: []},
    {id: 22, annual_consumption_required_id: 11, percentage: 20, quantity: '2000.0000000000', unit_id: 22, type: 11, source: 'fuel', issues: []},
  ],
});
