import { Calculos } from './calculos';

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
