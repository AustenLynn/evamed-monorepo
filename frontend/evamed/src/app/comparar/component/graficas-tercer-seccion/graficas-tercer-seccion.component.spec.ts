import { GraficasTercerSeccionComponent } from './graficas-tercer-seccion.component';

// A-32 plan, Task 8: material names come with the server results, not from the full catalogue.
describe('GraficasTercerSeccionComponent material table', () => {
  it('names materials from nombresMateriales', () => {
    const component: any = Object.create(GraficasTercerSeccionComponent.prototype);
    component.FasesEliminadas = [];
    component.ElementosContructivosEliminados = [];
    component.nombresMateriales = { '9': 'Cemento', '11': 'Acero' };

    const tabla = component.IniciarTablaMateriales(
      { Producción: { 'A1-A3': { '1': { '9': 5, '11': 1 } } } }, ' ', 0, false, ' ');

    expect(tabla.map((fila: any) => fila.material)).toEqual(['Cemento', 'Acero']);
  });
});
