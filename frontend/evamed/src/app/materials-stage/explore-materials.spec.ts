import { of, throwError } from 'rxjs';

// Compile the components in their NgModule's context.
import './materials-stage.module';
import { PickedMaterial } from '../explorer/picker.models';
import { MaterialStageUpdateComponent } from './components/material-stage-update/material-stage-update.component';
import { MaterialsStageComponent } from './components/materials-stage/materials-stage.component';
import { fromExcelRow, fromSchemeRow, toExcelRow, toSchemeProject } from './picked-material';

const picked: PickedMaterial = {
  material: { id: 2, name: 'Concreto_Bloque hueco', unit: 'Pz', source: 'EPiC' },
  comercialName: 'Block hueco 15',
  quantity: 120,
  comments: 'Muro norte',
  transportOrigin: 1,
  distanceOrigin: 1500,
  transportEnd: 4,
  distanceEnd: null,
  lifeYears: 25,
  replaces: 1,
};

// "Explorar materiales" replaces the Materiales panel's ⊕ on both stage pages (R-20).
describe('Explorar materiales on the new-project page', () => {
  afterEach(() => sessionStorage.clear());

  const build = (answer: PickedMaterial[]) => {
    const component: any = Object.create(MaterialsStageComponent.prototype),
      sheet: any[] = [];
    component.projectId = 42;
    component.ciudadOrigenSeleccionada = 9;
    component.currentPanelItem = 'Muro A';
    component.currentPanelOrigin = 'revit-user';
    component.selectedSheet = 'Muros exteriores';
    component.vidaUtilSeleccionado = '50';
    component.listData = sheet;
    component.indexSheet = 0;
    component.contentData = [[], sheet];
    sessionStorage.setItem('dataProject', JSON.stringify({ sheetNames: ['Muros exteriores'], data: [[], []] }));
    component.SOR = [['Muro A']];
    component.SOD = [[]];
    component.materialsList = [{ id: 2, name_material: 'Concreto_Bloque hueco' }];
    component.explorerPicker = { pickMany: vi.fn(async () => answer) };
    component.materialsService = { searchMaterial: vi.fn(() => of([])) };
    component.projectsService = {
      replaceMaterialScheme: vi.fn(() => of({ items: [], skipped: [] })),
    };
    return component;
  };

  it('opens the explorer with the panel’s system, section and project life', async () => {
    const component = build([]);

    await component.exploreMaterials();

    expect(component.explorerPicker.pickMany).toHaveBeenCalledWith({
      system: 'Muro A',
      section: 'Muros exteriores',
      projectLife: 50,
    });
    expect(component.listData).toEqual([]);
  });

  it('keeps the material when Producción is opened again (the page reloads the stored Excel)', async () => {
    const component = build([picked]);

    await component.exploreMaterials();

    const stored = JSON.parse(sessionStorage.getItem('dataProject')!);
    expect(stored.sheetNames).toEqual(['Muros exteriores']);
    expect(stored.data[1].map((row: any) => row.Material)).toEqual(['Block hueco 15']);
  });

  it('adds several materials at once, listed A→Z', async () => {
    const component = build([picked, { ...picked, comercialName: 'Mortero', quantity: 3 }]);

    await component.exploreMaterials();

    expect(component.listMateriales.map((row: any) => [row.Material, row.Cantidad])).toEqual([
      ['Block hueco 15', 120],
      ['Mortero', 3],
    ]);
  });

  it('adds the material to the panel, and the autosave stores it with its transport', async () => {
    const component = build([picked]);

    await component.exploreMaterials();
    expect(component.listMateriales.map((row: any) => row.Material)).toEqual(['Block hueco 15']);

    component.saveStepOne();
    const [, , , items] = component.projectsService.replaceMaterialScheme.mock.calls[0];
    expect(items).toEqual([
      expect.objectContaining({
        construction_system: 'Muro A',
        comercial_name: 'Block hueco 15',
        material_id: 2,
        origin_id: 1,
        quantity: 120,
        distance_init: 1500,
        distance_end: 0,
        transport_id_origin: 1,
        transport_id_end: 4,
        replaces: 1,
        unit_text: 'Pz',
        description_material: 'Muro norte',
      }),
    ]);
  });
});

describe('Explorar materiales on the existing-project page', () => {
  afterEach(() => localStorage.clear());

  // The picker saves through context.save, then hands back what it saved.
  const build = (answer: PickedMaterial[]) => {
    const component: any = Object.create(MaterialStageUpdateComponent.prototype);
    component.currentPanelItem = 'Losa';
    component.indexSheet = 3;
    component.sheetNames = ['Cimentación', 'Muros interiores', 'Muros exteriores', 'Pisos'];
    component.vidaUtilSeleccionado = 60;
    component.cdr = { markForCheck: vi.fn() };
    component.explorerPicker = {
      pickMany: vi.fn(async (context: any) => {
        const saved: boolean[] = answer.length ? await context.save(answer) : [];
        component.saved = saved;
        return answer.filter((_material, index) => saved[index]);
      }),
    };
    component.projectsService = {
      addSchemeProject: vi.fn(() => of({ id: 99 })),
      getMaterialSchemeProyect: vi.fn(() => of([{ id: 99, project_id: 42 }, { id: 7, project_id: 5 }])),
    };
    component.showMaterials = vi.fn();
    component.snackBar = { open: vi.fn() };
    localStorage.setItem('idProyectoConstrucción', '42');
    return component;
  };

  it('saves each material as a new row, then shows the system with them at once', async () => {
    const mortar = { ...picked, comercialName: 'Mortero', quantity: 3 },
      component = build([picked, mortar]);

    await component.exploreMaterials();

    expect(component.explorerPicker.pickMany).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'Losa', section: 'Pisos', projectLife: 60 })
    );
    expect(component.projectsService.addSchemeProject.mock.calls).toEqual([
      [toSchemeProject(picked, { projectId: 42, sectionId: 4, system: 'Losa' })],
      [toSchemeProject(mortar, { projectId: 42, sectionId: 4, system: 'Losa' })],
    ]);
    expect(component.saved).toEqual([true, true]);
    expect(component.listData2).toEqual([{ id: 99, project_id: 42 }]);
    expect(component.showMaterials).toHaveBeenCalledWith(null, 'Losa', 'revit-user');
  });

  it('tells the picker which materials failed, so it keeps them to retry', async () => {
    const component = build([picked, { ...picked, comercialName: 'Mortero' }]);
    component.projectsService.addSchemeProject = vi
      .fn()
      .mockReturnValueOnce(of({ id: 99 }))
      .mockReturnValueOnce(throwError(() => ({ status: 400 })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await component.exploreMaterials();

    expect(component.saved).toEqual([true, false]);
    expect(component.showMaterials).toHaveBeenCalled();
  });

  it('saves nothing when the explorer is closed', async () => {
    const component = build([]);

    await component.exploreMaterials();

    expect(component.projectsService.addSchemeProject).not.toHaveBeenCalled();
  });

  it('needs an open project and a system', async () => {
    const component = build([picked]);
    localStorage.clear();

    await component.exploreMaterials();

    expect(component.explorerPicker.pickMany).not.toHaveBeenCalled();
  });
});

describe('Editing a material from the panel', () => {
  afterEach(() => sessionStorage.clear());

  it('new-project page: opens Edición with the row, and writes the changes back to the sheet', async () => {
    const row: any = {
        Material: 'Agua_Water_mortero_aplanado', Cantidad: 90.51, Unidad: 'kg', 'Descripción de Material': '-',
        Origen: 'Opciones EVAMED', Sistema_constructivo: 'EPS wall', distancia_2: '30', transporte_2: '4', reemplazos: '1',
      },
      component: any = Object.create(MaterialsStageComponent.prototype);
    component.listData = [row];
    component.indexSheet = 0;
    component.contentData = [[], component.listData];
    component.selectedSheet = 'Muros interiores';
    component.vidaUtilSeleccionado = '50';
    component.materialsList = [{ id: 382, name_material: 'Agua_Water_mortero_aplanado' }];
    component.explorerPicker = { pick: vi.fn(async () => ({ ...picked, comercialName: 'Agua de obra', comments: '' })) };
    sessionStorage.setItem('dataProject', JSON.stringify({ data: [[], []] }));
    const initial = fromExcelRow(row);

    await component.onSelectedMaterial({ selected: [{ value: { value: row } }] });

    expect(component.explorerPicker.pick).toHaveBeenCalledWith({
      mode: 'edit',
      system: 'EPS wall',
      section: 'Muros interiores',
      projectLife: 50,
      materialId: 382,
      initial,
    });
    expect(row).toMatchObject({ Material: 'Agua de obra', Origen: 'Opciones EVAMED', Cantidad: 120, 'Descripción de Material': null });
    expect(JSON.parse(sessionStorage.getItem('dataProject')!).data[1][0].Material).toBe('Agua de obra');
  });

  it('existing-project page: saves the row in place, keeping its origin, and shows it again', async () => {
    const row = {
        material_scheme_project_id: 10636, material_id: 382, project_id: 640, section_id: 2, origin_id: 2,
        construction_system: 'EPS wall', comercial_name: 'Agua_Water_mortero_aplanado', quantity: 90.51, unit_text: 'kg',
        description_material: '-', transporte_1: null, transporte_2: null, distancia_1: 0, distancia_2: 0, reemplazos: 0,
        state_id_origin: 5, city_id_origin: 9, city_id_end: 1,
      },
      component: any = Object.create(MaterialStageUpdateComponent.prototype);
    component.sheetNames = ['Cimentación', 'Muros interiores'];
    component.vidaUtilSeleccionado = 50;
    component.cdr = { markForCheck: vi.fn() };
    component.snackBar = { open: vi.fn() };
    component.explorerPicker = { pick: vi.fn(async () => picked) };
    component.projectsService = {
      updateMaterialSchemeProject: vi.fn(() => of({})),
      getMaterialSchemeProyect: vi.fn(() => of([{ id: 10636, project_id: 640 }])),
    };
    component.showMaterials = vi.fn();

    await component.onSelectedMaterial(null, { selected: [{ value: { value: row } }] });

    expect(component.explorerPicker.pick).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'edit', materialId: 382, section: 'Muros interiores', initial: fromSchemeRow(row),
    }));
    const [id, changes] = component.projectsService.updateMaterialSchemeProject.mock.calls[0];
    expect(id).toBe(10636);
    expect(changes).toMatchObject({ origin_id: 2, section_id: 2, material_id: 2, state_id_origin: 5, city_id_origin: 9 });
    expect(component.showMaterials).toHaveBeenCalledWith(null, 'EPS wall', 'dynamo');
  });
});

describe('picked material rows', () => {
  it('sends empty comments as null: the API refuses a blank description (R-37)', () => {
    const empty = { ...picked, comments: '  ' };

    expect(toSchemeProject(empty, { projectId: 1, sectionId: 1, system: 'X' })['description_material']).toBeNull();
    expect(toExcelRow(empty, 'X', 'Modelo de Revit')['Descripción de Material']).toBeNull();
  });

  it('reads a row back as the form’s starting values', () => {
    expect(fromExcelRow({ Material: 'A', Cantidad: '12.5', Unidad: 'Ton', 'Descripción de Material': '-', transporte_1: '', distancia_1: '', transporte_2: '4', distancia_2: '30', reemplazos: undefined })).toEqual({
      comercialName: 'A', quantity: 12.5, comments: '', transportOrigin: null, distanceOrigin: null,
      transportEnd: 4, distanceEnd: 30, replaces: null, rowUnit: 'Ton',
    });
  });

  it('keeps empty legs empty in the Excel row, so the save writes 0 and no transport', () => {
    const row = toExcelRow({ ...picked, transportEnd: null, distanceEnd: null }, 'Muro A', 'Modelo de Revit');

    expect(row).toMatchObject({ transporte_2: '', distancia_2: '', materialSelectedDB: 'Concreto_Bloque hueco' });
  });

  it('marks a project row as added by the user', () => {
    expect(toSchemeProject(picked, { projectId: 1, sectionId: 2, system: 'X' })).toMatchObject({
      origin_id: 3,
      section_id: 2,
      material_id: 2,
      distance_init: 1500,
      distance_end: 0,
      transport_id_origin: 1,
      transport_id_end: 4,
    });
  });
});
