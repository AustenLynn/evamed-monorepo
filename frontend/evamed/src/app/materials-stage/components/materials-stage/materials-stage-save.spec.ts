import { of, Subject, throwError } from 'rxjs';

// Compile the component in its NgModule's context.
import '../../materials-stage.module';
import { MaterialsStageComponent } from './materials-stage.component';

// The page autosaves its whole selection every few seconds. Each save must
// set the project's rows to that selection (one replace request), not add to
// what earlier saves stored.
describe('MaterialsStageComponent saving', () => {
  const sheet = [
      { Sistema_constructivo: 'Muro A', Origen: 'Modelo de Revit', Material: 'Concreto', Cantidad: 12.5, Unidad: 'm3',
        distancia_1: '', distancia_2: '30', transporte_1: '2', transporte_2: '', reemplazos: '', 'Descripción de Material': 'c' },
      { Sistema_constructivo: 'Muro A', Origen: 'Modelo de Revit', Material: 'Concreto', Cantidad: 12.5, Unidad: 'm3' },
      { Sistema_constructivo: 'Muro B', Origen: 'Modelo de Revit', Material: 'Acero', Cantidad: 3, Unidad: 'kg' },
      { Sistema_constructivo: 'Losa', Origen: 'Opciones EVAMED', Material: 'Acero', Cantidad: 7, Unidad: 'kg', transporte_1: '4' },
      { Sistema_constructivo: 'Muro A', Origen: 'Modelo de Revit', Material: 'Desconocido', Cantidad: 1 },
    ];

  const replaceMock = () =>
    vi.fn((_projectId: number, _origins: number[], _sections: number[], _items: any[]) =>
      of({ items: [] as any[], skipped: [] as any[] }));

  const build = (replace: ReturnType<typeof replaceMock> = replaceMock()) => {
    const component: any = Object.create(MaterialsStageComponent.prototype);
    component.projectId = 42;
    component.ciudadOrigenSeleccionada = 9;
    component.materialsList = [{ id: 1, name_material: 'Concreto' }, { id: 2, name_material: 'Acero' }];
    component.contentData = [[], sheet];
    component.SOR = [['Muro A']];
    component.SOD = [['Losa']];
    component.SOU = [];
    component.projectsService = { replaceMaterialScheme: replace, addSchemeProject: vi.fn() };
    component.materialsService = { searchMaterial: vi.fn() };
    return { component, replace };
  };

  it('replaces the project rows with exactly the selected systems', () => {
    const { component, replace } = build();

    component.saveStepOne();

    expect(replace).toHaveBeenCalledTimes(1);
    const [projectId, origins, sections, items] = replace.mock.calls[0];
    expect(projectId).toBe(42);
    expect(origins).toEqual([1, 2]);
    expect(sections).toEqual([1]);
    expect(items.map((i: any) => [i.construction_system, i.material_id, i.origin_id])).toEqual([
      ['Muro A', 1, 1],
      ['Muro A', 1, 1], // a legitimate duplicate row in the Excel is kept
      ['Losa', 2, 2],
    ]);
    expect(items[0]).toEqual({
      construction_system: 'Muro A', comercial_name: 'Concreto', quantity: 12.5, provider_distance: 0,
      material_id: 1, origin_id: 1, section_id: 1, value: null, distance_init: 0, distance_end: 30,
      replaces: 0, city_id_origin: 9, state_id_origin: 1, city_id_end: 1,
      transport_id_origin: 2, transport_id_end: null, unit_text: 'm3', description_material: 'c',
    });
    expect(items[2].transport_id_origin).toBe('4'); // origin 2 keeps the raw value, as before
    expect(component.projectsService.addSchemeProject).not.toHaveBeenCalled();
    expect(component.materialsService.searchMaterial).not.toHaveBeenCalled();
  });

  it('drops a deselected system on the next save', () => {
    const { component, replace } = build();
    component.saveStepOne();

    component.SOR = [[]];
    component.saveStepOne();

    expect(replace.mock.calls[1][3].map((i: any) => i.construction_system)).toEqual(['Losa']);
  });

  it('sends nothing until the materials catalogue has loaded, and retries once it has', () => {
    const { component, replace } = build();
    component.materialsList = undefined;
    component.lastAutosaveSignature = 'state-before-catalogue';

    component.saveStepOne();

    expect(replace).not.toHaveBeenCalled();
    expect(component.lastAutosaveSignature).toBeNull(); // the next tick tries again
  });

  // Coming back to the page (Back, reload) starts with no sheet loaded. Saving
  // then must not claim, and so clear, sheets whose selections it doesn't know.
  it('saves nothing for a freshly opened page with no sheet loaded', () => {
    const { component, replace } = build();
    component.SOR = [];
    component.SOD = [];

    component.saveStepOne();

    expect(replace).not.toHaveBeenCalled();
  });

  it('only claims sheets whose selections are known for both origins', () => {
    const { component, replace } = build();
    component.contentData = [[], sheet, sheet, sheet];
    component.SOR = [['Muro A'], ['Muro A'], undefined];
    component.SOD = [['Losa'], undefined, ['Losa']];

    component.saveStepOne();

    expect(replace.mock.calls[0][2]).toEqual([1]);
    expect(new Set(replace.mock.calls[0][3].map((i: any) => i.section_id))).toEqual(new Set([1]));
  });

  // Overlapping saves can interleave on the server; send one at a time.
  it('does not start a save while one is in flight, and retries after', () => {
    const pending = new Subject<{ items: any[]; skipped: any[] }>();
    const { component, replace } = build(vi.fn(() => pending) as any);
    component.saveStepOne();
    component.lastAutosaveSignature = 'newer-state';

    component.saveStepOne();

    expect(replace).toHaveBeenCalledTimes(1);
    expect(component.lastAutosaveSignature).toBeNull();

    pending.next({ items: [], skipped: [] });
    pending.complete();
    component.saveStepOne();
    expect(replace).toHaveBeenCalledTimes(2);
  });

  it('lets the next autosave retry after a failed save', () => {
    const { component } = build(vi.fn((_p: number, _o: number[], _s: number[], _i: any[]) => throwError(() => new Error('offline'))) as any);
    component.lastAutosaveSignature = 'saved-state';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    component.saveStepOne();

    expect(component.lastAutosaveSignature).toBeNull();
  });

  // The API rejects these (quantity is a decimal); inside one replace they would
  // block every other row. The old per-row POSTs already lost them silently.
  it('leaves out rows without a numeric quantity', () => {
    const { component, replace } = build();
    component.contentData = [[], [
      ...sheet,
      { Sistema_constructivo: 'Muro A', Origen: 'Modelo de Revit', Material: 'Acero', Cantidad: '' },
      { Sistema_constructivo: 'Muro A', Origen: 'Modelo de Revit', Material: 'Acero', Cantidad: null },
      { Sistema_constructivo: 'Muro A', Origen: 'Modelo de Revit', Material: 'Acero', Cantidad: 'n/a' },
      { Sistema_constructivo: 'Muro A', Origen: 'Modelo de Revit', Material: 'Acero', Cantidad: '4.5' },
    ]];

    component.saveStepOne();

    const quantities = replace.mock.calls[0][3].map((i: any) => i.quantity);
    expect(quantities).toEqual([12.5, 12.5, '4.5', 7]);
  });
});
