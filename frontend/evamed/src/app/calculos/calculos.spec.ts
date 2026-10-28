import { Calculos } from './calculos';
import { CalculosSegundaSeccion } from './calculos-segunda-seccion';
import { CalculosTercerSeccion } from './calculos-tercer-seccion';

// One small project, worked by hand, that the Resultados calculations must agree on.
//
// Sección 2: a block in two systems (2 kg CO2e/kg, 10 kg each, 100 km by truck, 1 replacement)
//            and a mortar (5 kg CO2e/kg, 3 kg). Both have only an A1-A3 value (EPiC/ecoinvent).
// Sección 3: a cement (1 × 4 kg, A1-A3 only) and a steel with A1/A2/A3 values
//            (1 + 0.5 + 0.5 per kg, 2 kg, 50 km by ship, 2 replacements).
// Transport: 0.001 kg CO2e per kg·km.
//
//   A1-A3 = 2·10 + 2·10 + 5·3 + 1·4             = 59   (sección 2: 55, sección 3: 4)
//   A1, A2, A3 = 1·2, 0.5·2, 0.5·2              = 2, 1, 1
//   A4 = 10·100·0.001 · 2 + 2·50·0.001          = 2.1  (2 + 0.1)
//   B4 = each row × its replacements × (its own transport + its production)
//      = 2 · (1 + 20) + 2 · (0.1 + 4)            = 50.2 (42 + 8.2)
const info = () => ({
  projectsList: [{ id: 1, useful_life_id: 1 }],
  ULList: [{ id: 1, name_useful_life: '50' }],
  materialList: [
    { id: 1, database_from: 'EPiC' },
    { id: 2, database_from: 'EPiC' },
    { id: 3, database_from: 'EPiC' },
    { id: 4, database_from: 'EPDs' },
  ],
  materialSchemeDataList: [
    { material_id: 1, standard_id: 1, potential_type_id: 3, value: 2 },
    { material_id: 2, standard_id: 1, potential_type_id: 3, value: 5 },
    { material_id: 3, standard_id: 1, potential_type_id: 3, value: 1 },
    { material_id: 4, standard_id: 2, potential_type_id: 3, value: 1 },
    { material_id: 4, standard_id: 3, potential_type_id: 3, value: 0.5 },
    { material_id: 4, standard_id: 4, potential_type_id: 3, value: 0.5 },
  ],
  materialSchemeProyectList: [
    { project_id: 1, section_id: 2, material_id: 1, quantity: 10, distance_init: null, distance_end: 100, transport_id_end: 4, replaces: 1 },
    { project_id: 1, section_id: 2, material_id: 1, quantity: 10, distance_init: null, distance_end: 100, transport_id_end: 4, replaces: 1 },
    { project_id: 1, section_id: 2, material_id: 2, quantity: 3, distance_init: null, distance_end: null, replaces: 0 },
    { project_id: 1, section_id: 3, material_id: 3, quantity: 4, distance_init: null, distance_end: null, replaces: 0 },
    { project_id: 1, section_id: 3, material_id: 4, quantity: 2, distance_init: 50, transport_id_origin: 1, distance_end: null, replaces: 2 },
  ],
  potentialTypesList: [{ id: 3, name_potential_type: 'PCG 100', name_complete_potential_type: 'Calentamiento global' }],
  standarsList: [
    { id: 1, name_standard: 'A1-A3' },
    { id: 2, name_standard: 'A1' },
    { id: 3, name_standard: 'A2' },
    { id: 4, name_standard: 'A3' },
  ],
  PTList: [
    { potential_type_id: 3, transport_id: 1, value: 0.001 },
    { potential_type_id: 3, transport_id: 4, value: 0.001 },
  ],
  conversionList: [],
  CSEList: [],
  SIDList: [],
  SIList: [],
  ACRList: [],
  ECDList: [],
  TEDList: [],
  TEList: [],
  ECDPList: [],
  sectionsList: [],
}),
  BD = { EPiC: true, EPDs: true };

describe('Resultados calculations', () => {
  it('totals: every A1-A3-only material counts, and each replacement brings only its row’s transport', () => {
    const [datos] = new Calculos().OperacionesDeFase(1, info(), BD) as any,
      impacto = Object.values(datos)[0] as any;

    expect(impacto['Producción']['A1-A3']).toBeCloseTo(59);
    expect(impacto['Producción']['A1']).toBeCloseTo(2);
    expect(impacto['Producción']['A2']).toBeCloseTo(1);
    expect(impacto['Producción']['A3']).toBeCloseTo(1);
    expect(impacto['Construccion']['A4']).toBeCloseTo(2.1);
    expect(impacto['Uso']['B4']).toBeCloseTo(50.2);
  });

  it('per element: the same totals, split by section', () => {
    const datos = new CalculosSegundaSeccion().OperacionesDeFasePorElementoConstructivo(1, info(), BD) as any,
      impacto = (Array.isArray(datos) ? datos[0] : datos),
      porSeccion = Object.values(impacto)[0] as any;

    // Producción + A4 + B4 per section: 55 + 2 + 42 and 4 + 4 + 0.1 + 8.2.
    expect(porSeccion[2]).toBeCloseTo(99);
    expect(porSeccion[3]).toBeCloseTo(16.3);
  });

  it('per element and stage: the same values in each stage', () => {
    const { Calculos: datos } = new CalculosTercerSeccion().OperacionesDeFasePorElementoConstructivoCicloVida(1, info(), BD) as any,
      impacto = Object.values(datos)[0] as any;

    expect(impacto['Producción']['A1-A3'][2]).toBeCloseTo(55);
    expect(impacto['Producción']['A1-A3'][3]).toBeCloseTo(4);
    expect(impacto['Producción']['A1'][3]).toBeCloseTo(2);
    expect(impacto['Construccion']['A4'][2]).toBeCloseTo(2);
    expect(impacto['Construccion']['A4'][3]).toBeCloseTo(0.1);
    expect(impacto['Uso']['B4'][2]).toBeCloseTo(42);
    expect(impacto['Uso']['B4'][3]).toBeCloseTo(8.2);
  });
});
