import { MaterialDetail } from './explorer.models';

/** A material as the detail endpoint returns it, for specs. */
export const DETAIL: MaterialDetail = {
  id: 12,
  stage: 'produccion',
  name: 'Concreto_AAC block',
  display_name: 'AAC block',
  category: 'Concreto',
  description: 'Bloque de concreto celular curado en autoclave.',
  source: 'ECOINVENT 3',
  unit: 'kg',
  gwp: 0.4,
  impact_level: 'bajo',
  ecoinvent: { dataset_id: 1234, version: '3.12', system_model: null },
  indicators: [
    { code: 'PCG 100', name: 'Potencial de calentamiento global', unit: 'kg CO2 eq', a1: null, a2: null, a3: null, a1_a3: 0.4 },
    { code: 'PA', name: 'Potencial de acidificación', unit: 'kg SO2 eq', a1: 0.001, a2: 0.0002, a3: 0.0001, a1_a3: 0.0013 },
  ],
  comparison: { group: 'Concreto', unit: 'kg', n: 8, mean: 0.8, p25: 0.5, value: 0.4 },
};
