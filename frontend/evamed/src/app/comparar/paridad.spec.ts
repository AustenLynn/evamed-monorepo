import { compararResultados } from './paridad';

// A-32 plan, Task 2: browser vs server numbers, while both exist.
describe('compararResultados', () => {
  it('finds no difference in equal trees or within rounding', () => {
    expect(compararResultados({ a: { b: 1 } }, { a: { b: 1 } })).toEqual([]);
    expect(compararResultados({ a: { b: 1 } }, { a: { b: 1 + 1e-12 } })).toEqual([]);
  });

  it('reports a different leaf with its path', () => {
    expect(compararResultados({ a: { b: 1 } }, { a: { b: 1.0000001 } }))
      .toEqual([{ ruta: 'a.b', navegador: 1, servidor: 1.0000001 }]);
  });

  it('treats a key missing on one side as 0', () => {
    expect(compararResultados({ a: { b: 0 } }, { a: {} })).toEqual([]);
    expect(compararResultados({ a: {} }, { a: { b: 5 } })).toEqual([{ ruta: 'a.b', navegador: undefined, servidor: 5 }]);
  });
});
