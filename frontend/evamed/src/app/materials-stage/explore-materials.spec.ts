import { of } from 'rxjs';

// Compile the components in their NgModule's context.
import './materials-stage.module';
import { PickedMaterial } from '../explorer/picker.models';
import { MaterialStageUpdateComponent } from './components/material-stage-update/material-stage-update.component';
import { MaterialsStageComponent } from './components/materials-stage/materials-stage.component';
import { toExcelRow, toSchemeProject } from './picked-material';

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

  const build = (answer: PickedMaterial | undefined) => {
    const component: any = Object.create(MaterialsStageComponent.prototype),
      sheet: any[] = [];
    component.projectId = 42;
    component.ciudadOrigenSeleccionada = 9;
    component.currentPanelItem = 'Muro A';
    component.selectedSheet = 'Muros exteriores';
    component.vidaUtilSeleccionado = '50';
    component.listData = sheet;
    component.indexSheet = 0;
    component.contentData = [[], sheet];
    sessionStorage.setItem('dataProject', JSON.stringify({ sheetNames: ['Muros exteriores'], data: [[], []] }));
    component.SOR = [['Muro A']];
    component.SOD = [[]];
    component.materialsList = [{ id: 2, name_material: 'Concreto_Bloque hueco' }];
    component.explorerPicker = { pick: vi.fn(async () => answer) };
    component.materialsService = { searchMaterial: vi.fn(() => of([])) };
    component.projectsService = {
      replaceMaterialScheme: vi.fn(() => of({ items: [], skipped: [] })),
    };
    return component;
  };

  it('opens the explorer with the panel’s system, section and project life', async () => {
    const component = build(undefined);

    await component.exploreMaterials('Modelo de Revit');

    expect(component.explorerPicker.pick).toHaveBeenCalledWith({
      system: 'Muro A',
      section: 'Muros exteriores',
      projectLife: 50,
    });
    expect(component.listData).toEqual([]);
  });

  it('keeps the material when Producción is opened again (the page reloads the stored Excel)', async () => {
    const component = build(picked);

    await component.exploreMaterials('Modelo de Revit');

    const stored = JSON.parse(sessionStorage.getItem('dataProject')!);
    expect(stored.sheetNames).toEqual(['Muros exteriores']);
    expect(stored.data[1].map((row: any) => row.Material)).toEqual(['Block hueco 15']);
  });

  it('adds the material to the panel, and the autosave stores it with its transport', async () => {
    const component = build(picked);

    await component.exploreMaterials('Modelo de Revit');
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

  const build = (answer: PickedMaterial | undefined) => {
    const component: any = Object.create(MaterialStageUpdateComponent.prototype);
    component.currentPanelItem = 'Losa';
    component.indexSheet = 3;
    component.sheetNames = ['Cimentación', 'Muros interiores', 'Muros exteriores', 'Pisos'];
    component.vidaUtilSeleccionado = 60;
    component.cdr = { markForCheck: vi.fn() };
    component.explorerPicker = { pick: vi.fn(async () => answer) };
    component.projectsService = {
      addSchemeProject: vi.fn(() => of({ id: 99 })),
      getMaterialSchemeProyect: vi.fn(() => of([{ id: 99, project_id: 42 }, { id: 7, project_id: 5 }])),
    };
    component.showMaterials = vi.fn();
    localStorage.setItem('idProyectoConstrucción', '42');
    return component;
  };

  it('saves the material as a new row, then shows the system with it at once', async () => {
    const component = build(picked);

    await component.exploreMaterials();

    expect(component.explorerPicker.pick).toHaveBeenCalledWith({ system: 'Losa', section: 'Pisos', projectLife: 60 });
    expect(component.projectsService.addSchemeProject).toHaveBeenCalledWith(
      toSchemeProject(picked, { projectId: 42, sectionId: 4, system: 'Losa' })
    );
    expect(component.listData2).toEqual([{ id: 99, project_id: 42 }]);
    expect(component.showMaterials).toHaveBeenCalledWith(null, 'Losa', 'revit-user');
    expect(component.adding).toBe(false);
  });

  it('saves nothing when the explorer is closed', async () => {
    const component = build(undefined);

    await component.exploreMaterials();

    expect(component.projectsService.addSchemeProject).not.toHaveBeenCalled();
  });

  it('needs an open project and a system', async () => {
    const component = build(picked);
    localStorage.clear();

    await component.exploreMaterials();

    expect(component.explorerPicker.pick).not.toHaveBeenCalled();
  });
});

describe('picked material rows', () => {
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
