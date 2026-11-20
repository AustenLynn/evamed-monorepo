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

describe('Carbon scale value (EN 15804+A2 design, 2026-11-20)', () => {
  const projects = [{ id: 1, living_area: 10, useful_life_id: 1 }];
  const usefulLives = [{ id: 1, name_useful_life: '50' }];

  it('reads the A2 climate change total when the results carry it', () => {
    const calculos = new Calculos();
    const data = { [calculos.ajustarNombre('Calentamiento global, total')]: { Uso: { B4: 300, B6: 200 } } };
    expect(calculos.determinaValorCarbono(data, projects, 1, usefulLives)).toBeCloseTo(1);
  });

  it('still reads the CML global warming key under the old method', () => {
    const calculos = new Calculos();
    const data = { [calculos.ajustarNombre('Calentamiento Global')]: { Uso: { B4: 1000, B6: 0 } } };
    expect(calculos.determinaValorCarbono(data, projects, 1, usefulLives)).toBeCloseTo(2);
  });
});

// EN 15804+A2 (design 2026-11-20): Comparar must agree with ProjectResultsView.
//
// Indicators: GWP-total (101), GWP-biogenic (102). Transport 4: 0.01 kg CO2e/t·km (total), 0 (biogenic).
// m1: Kg, no Conversions row (mass from unit: 0.001 t), total 2 and biogenic −1 per kg; 10 kg, 100 km, 1 replacement.
// m2: only a total value → not current, left out.
// m3: m², no mass (transport left out), total 1, biogenic 0; 2 m², 50 km.
//   A1-A3 total = 2·10 + 1·2 = 22 (section 2: 20, section 3: 2);  biogenic = −10
//   A4 total    = 0.001·10·100·0.01 = 0.01 (m3 has no mass)
//   B4 total    = 1 · (0.01 + 20) = 20.01;  biogenic B4 = −10
//   C3 release  = −(−1·10)·(1 + 1) = 20 on biogenic and total  → biogenic balances to 0
const a2Info = () => ({
  ...info(),
  materialList: [
    { id: 1, database_from: 'ECO Platform', unit_name: 'Kg' },
    { id: 2, database_from: 'ECO Platform', unit_name: 'Kg' },
    { id: 3, database_from: 'ECO Platform', unit_name: 'm²' },
  ],
  materialSchemeDataList: [
    { material_id: 1, standard_id: 1, potential_type_id: 101, value: 2 },
    { material_id: 1, standard_id: 1, potential_type_id: 102, value: -1 },
    { material_id: 2, standard_id: 1, potential_type_id: 101, value: 5 },
    { material_id: 3, standard_id: 1, potential_type_id: 101, value: 1 },
    { material_id: 3, standard_id: 1, potential_type_id: 102, value: 0 },
  ],
  materialSchemeProyectList: [
    { id: 11, project_id: 1, section_id: 2, material_id: 1, quantity: 10, distance_init: null, distance_end: 100, transport_id_end: 4, replaces: 1 },
    { id: 12, project_id: 1, section_id: 2, material_id: 2, quantity: 3, distance_init: null, distance_end: null, replaces: 0 },
    { id: 13, project_id: 1, section_id: 3, material_id: 3, quantity: 2, distance_init: null, distance_end: 50, transport_id_end: 4, replaces: 0 },
  ],
  potentialTypesList: [
    { id: 101, name_potential_type: 'GWP-total', name_complete_potential_type: 'Calentamiento global, total' },
    { id: 102, name_potential_type: 'GWP-biogenic', name_complete_potential_type: 'Calentamiento global, biogénico' },
  ],
  PTList: [
    { potential_type_id: 101, transport_id: 4, value: 0.01 },
    { potential_type_id: 102, transport_id: 4, value: 0 },
  ],
  conversionList: [],
  ECDPList: [{ project_id: 1, section_id: 3, source_information_id: 99, quantity: 1 }],
  SIDList: [],
}),
  A2_BD = { 'ECO Platform': true };

describe('Resultados calculations under EN 15804+A2', () => {
  const key = (name: string) => new Calculos().ajustarNombre(name);

  it('totals: skip non-current materials, mass from the unit, biogenic released at end of life', () => {
    const [datos] = new Calculos().OperacionesDeFase(1, a2Info(), A2_BD) as any,
      total = datos[key('Calentamiento global, total')],
      bio = datos[key('Calentamiento global, biogénico')];
    expect(total['Producción']['A1-A3']).toBeCloseTo(22);
    expect(total['Construccion']['A4']).toBeCloseTo(0.01);
    expect(total['Uso']['B4']).toBeCloseTo(20.01);
    expect(total['FinDeVida']['C3']).toBeCloseTo(20);
    expect(bio['Producción']['A1-A3'] + bio['Uso']['B4'] + bio['FinDeVida']['C3']).toBeCloseTo(0);
  });

  it('per element: the same rules, and an end-of-life source without A2 values does not crash', () => {
    const datos = new CalculosSegundaSeccion().OperacionesDeFasePorElementoConstructivo(1, a2Info(), A2_BD) as any,
      porSeccion = datos[key('Calentamiento global, total')];
    expect(porSeccion[2]).toBeCloseTo(20 + 0.01 + 20.01 + 20);
    expect(porSeccion[3]).toBeCloseTo(2);
  });

  it('per element and stage: the same rules', () => {
    const { Calculos: datos } = new CalculosTercerSeccion().OperacionesDeFasePorElementoConstructivoCicloVida(1, a2Info(), A2_BD) as any,
      total = datos[key('Calentamiento global, total')];
    expect(total['Producción']['A1-A3'][2]).toBeCloseTo(20);
    expect(total['Producción']['A1-A3'][3]).toBeCloseTo(2);
    expect(total['Construccion']['A4'][2]).toBeCloseTo(0.01);
    expect(total['Construccion']['A4'][3] ?? 0).toBeCloseTo(0);
    expect(total['Uso']['B4'][2]).toBeCloseTo(20.01);
  });
});
