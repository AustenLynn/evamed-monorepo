import { etiquetasProyectos, filasTabla, porMetroDisponible } from './tabla-resultados';

const GWP = 'Calentamiento global,\ntotal',
  proyecto = (id: number, Nombre: string, p: number, c: number, u: number, f: number) => ({
    id, Nombre, Datos: { [GWP]: { Producción: p, Construccion: c, Uso: u, FinDeVida: f } },
  });

describe('results table rows', () => {
  it('puts each project total under its own column, whatever the ids (audit A-16)', () => {
    const filas = filasTabla([proyecto(651, 'Auditoría', 3760, 27.4, 0, 0), proyecto(12, 'Miguel', 5580, 0, 0, 95.2)], []),
      total = filas.find(f => f.data['ciclo de vida'] === 'Total')!;
    expect(total.data['Calentamiento global,total']).toEqual(['3.79e+3', '5.68e+3']);
  });

  it('names the projects in a header row only when comparing (audit A-17)', () => {
    const uno = filasTabla([proyecto(1, 'Casa', 1, 2, 3, 4)], []);
    expect(uno.map(f => f.data['ciclo de vida'])).toEqual(['Producción', 'Construccion', 'Uso', 'FinDeVida', 'Total']);
    expect(uno[4].data['Calentamiento global,total']).toEqual(['1.00e+1']);
    const dos = filasTabla([proyecto(1, 'Casa', 1, 2, 3, 4), proyecto(2, 'Casa', 1, 1, 1, 1)], []);
    expect(dos[0].data).toEqual({ 'ciclo de vida': 'Proyecto', 'Calentamiento global,total': ['Casa (#1)', 'Casa (#2)'] });
  });

  it('leaves hidden stages out of the rows and the total', () => {
    const filas = filasTabla([proyecto(1, 'Casa', 1, 2, 3, 4)], ['Uso']);
    expect(filas.map(f => f.data['ciclo de vida'])).toEqual(['Producción', 'Construccion', 'FinDeVida', 'Total']);
    expect(filas[3].data['Calentamiento global,total']).toEqual(['7.00e+0']);
  });

  it('shows a dash instead of Infinity or NaN', () => {
    const filas = filasTabla([proyecto(1, 'Casa', Infinity, NaN, 3, 4)], []);
    expect(filas[0].data['Calentamiento global,total']).toEqual(['—']);
    expect(filas[4].data['Calentamiento global,total']).toEqual(['—']);
  });

  it('labels duplicate project names with their id only when needed', () => {
    expect(etiquetasProyectos([{ id: 1, Nombre: 'Prueba' }, { id: 2, Nombre: 'Prueba' }, { id: 3, Nombre: 'Casa' }]))
      .toEqual(['Prueba (#1)', 'Prueba (#2)', 'Casa']);
  });
});

describe('per m² availability (audit A-09)', () => {
  const lista = [
    { id: 1, builded_surface: 120, living_area: 100 },
    { id: 2, builded_surface: 0, living_area: 500 },
    { id: 3, builded_surface: 80, living_area: null },
  ];
  it('is available only when every shown project has both surfaces above 0', () => {
    expect(porMetroDisponible(lista, [1])).toBe(true);
    expect(porMetroDisponible(lista, [1, 2])).toBe(false);
    expect(porMetroDisponible(lista, [3])).toBe(false);
    expect(porMetroDisponible(lista, [9])).toBe(false);
  });
});
