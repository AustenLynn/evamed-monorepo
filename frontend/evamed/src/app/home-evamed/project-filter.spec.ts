import { filtrarProyectos } from './project-filter';

describe('home project filter (audit 2026-11-22)', () => {
  const lista = [{ id: 9, use_id: 1 }, { id: 7, use_id: 3 }, { id: 4, use_id: 1 }];

  it('keeps the original order and "Todos" (0) or no filter shows all', () => {
    expect(filtrarProyectos(lista, 1).map(p => p.id)).toEqual([9, 4]);
    expect(filtrarProyectos(lista, 1).map(p => p.id)).toEqual([9, 4]);
    expect(filtrarProyectos(lista, 0).map(p => p.id)).toEqual([9, 7, 4]);
    expect(filtrarProyectos(lista, undefined).map(p => p.id)).toEqual([9, 7, 4]);
    expect(filtrarProyectos(lista, 5)).toEqual([]);
  });
});
