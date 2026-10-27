import { BUILDING_SECTIONS } from './building-sections';
import { bySection } from './template-sheets';

const row = (system: string, material: string) => ({
  Origen: 'Modelo de Revit',
  Sistema_constructivo: system,
  Material: material,
  Cantidad: 1,
}),
  header = { Origen: 'Origen', Sistema_constructivo: 'Sistema_constructivo', Material: 'Material', Cantidad: 'Cantidad' },
  helpers = ['Inicio', 'Registro', 'ListaElementos', 'BD', 'Parametros'];

describe('Uploaded template sheets by section', () => {
  it('Windows file (no hidden first sheet): each section gets its own rows', () => {
    const names = [...BUILDING_SECTIONS.map(n => (n === 'Muros interiores' ? 'Muros Interiores' : n)), ...helpers],
      result = bySection({ sheetNames: names, data: names.map(name => [row('S', name)]) });

    expect(result.sheetNames).toEqual(BUILDING_SECTIONS);
    expect(result.data.map(rows => rows[0]['Material'])).toEqual(
      BUILDING_SECTIONS.map(n => (n === 'Muros interiores' ? 'Muros Interiores' : n))
    );
    expect(result.unknownSheets).toEqual([]);
    expect(result.sectionSheets).toBe(11);
  });

  it('Mac file: skips the hidden first sheet and the repeated header rows', () => {
    const names = ['Muros InterioresBis', ...BUILDING_SECTIONS, ...helpers],
      data = names.map(name => [header, header, row('S', name)]),
      result = bySection({ sheetNames: names, data });

    expect(result.data[0]).toEqual([row('S', 'Cimentación')]);
    expect(result.data[10]).toEqual([row('S', 'Otros')]);
  });

  it('matches names regardless of case, accents and punctuation; missing sections are empty', () => {
    const result = bySection({
      sheetNames: ['OTROS', 'Cimentacion', 'Inst especiales'],
      data: [[row('A', 'x')], [row('B', 'y')], [row('C', 'z')]],
    });

    expect(result.data[0]).toEqual([row('B', 'y')]);
    expect(result.data[9]).toEqual([row('C', 'z')]);
    expect(result.data[10]).toEqual([row('A', 'x')]);
    expect(result.data[3]).toEqual([]);
  });

  it('reports sheets with materials that are no section, but not the template’s own or empty ones', () => {
    const result = bySection({
      sheetNames: ['Cimentación', 'Cocina', 'Notas', 'BD'],
      data: [[row('A', 'x')], [row('B', 'y')], [{ Material: null }], [row('C', 'z')]],
    });

    expect(result.unknownSheets).toEqual(['Cocina']);
    expect(result.sectionSheets).toBe(1);
  });

  it('gives the same result when applied to its own output (a stored upload)', () => {
    const once = bySection({ sheetNames: ['Muros InterioresBis', 'Cimentación'], data: [[], [header, row('A', 'x')]] }),
      twice = bySection(once);

    expect(twice.sheetNames).toEqual(once.sheetNames);
    expect(twice.data).toEqual(once.data);
  });
});
