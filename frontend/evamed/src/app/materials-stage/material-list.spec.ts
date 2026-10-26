import { Subject, of } from 'rxjs';

// Compile the pages in their NgModule's context.
import './materials-stage.module';
import { PickedMaterial } from '../explorer/picker.models';
import { MaterialStageUpdateComponent } from './components/material-stage-update/material-stage-update.component';
import { MaterialsStageComponent } from './components/materials-stage/materials-stage.component';
import { byIndex, RECENT_MS, sortByName } from './material-list';

const picked: PickedMaterial = {
  material: { id: 2, name: 'Concreto_Bloque hueco', unit: 'Pz', source: 'EPiC' },
  comercialName: 'Block hueco 15',
  quantity: 0,
  comments: '',
  transportOrigin: 1,
  distanceOrigin: null,
  transportEnd: 4,
  distanceEnd: null,
  lifeYears: 50,
  replaces: 0,
};

describe('Materiales list order', () => {
  it('sorts A→Z ignoring case and accents, numbers in number order, and renumbers', () => {
    const rows = sortByName(
      [{ name: 'zinc' }, { name: 'Bloque 10' }, { name: 'Árido' }, { name: 'bloque 2' }],
      row => row.name
    );

    expect(rows.map(row => [row['key'], row.name])).toEqual([
      [1, 'Árido'],
      [2, 'bloque 2'],
      [3, 'Bloque 10'],
      [4, 'zinc'],
    ]);
  });

  it('keeps the list’s own order past nine materials', () => {
    const keys = ['0', '1', '10', '2'].map(key => ({ key, value: null }));

    expect(keys.sort(byIndex).map(entry => entry.key)).toEqual(['0', '1', '2', '10']);
  });

  it('new-project page: shows a system’s materials A→Z', () => {
    const component: any = Object.create(MaterialsStageComponent.prototype);
    component.materialsService = { searchMaterial: vi.fn(() => of([])) };
    component.listData = [
      { Origen: 'Modelo de Revit', Sistema_constructivo: 'Muro A', Material: 'Mortero' },
      { Origen: 'Template EVAMED', Sistema_constructivo: 'Muro A', Material: 'acero' },
      { Origen: 'Modelo de Revit', Sistema_constructivo: 'Muro B', Material: 'Arena' },
    ];

    component.showMaterials('Muro A', 'revit-user');

    expect(component.listMateriales.map((row: any) => [row.key, row.Material])).toEqual([
      [1, 'acero'],
      [2, 'Mortero'],
    ]);
  });

  it('existing-project page: shows a system’s materials A→Z as their names arrive', () => {
    const component: any = Object.create(MaterialStageUpdateComponent.prototype),
      names: Record<number, string> = { 1: 'Mortero', 2: 'acero' };
    component.indexSheet = 0;
    component.materialsService = { searchMaterial: vi.fn((id: number) => of([{ id, name_material: names[id] }])) };
    component.listData2 = [
      { id: 10, material_id: 1, section_id: 1, origin_id: 1, construction_system: 'Losa', quantity: 1, distance_init: 0 },
      { id: 11, material_id: 2, section_id: 1, origin_id: 3, construction_system: 'Losa', quantity: 2, distance_init: 0 },
    ];

    component.showMaterials(null, 'Losa', 'revit-user');

    expect(component.listMateriales.map((row: any) => [row.key, row.name_material])).toEqual([
      [1, 'acero'],
      [2, 'Mortero'],
    ]);
  });
});

describe('Materials just added', () => {
  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('new-project page: highlights the rows added from the explorer for a moment', async () => {
    vi.useFakeTimers();
    const component: any = Object.create(MaterialsStageComponent.prototype),
      old = { Origen: 'Modelo de Revit', Sistema_constructivo: 'Muro A', Material: 'Arena', Cantidad: 3 };
    component.currentPanelItem = 'Muro A';
    component.currentPanelOrigin = 'revit-user';
    component.listData = [old];
    component.indexSheet = 0;
    component.contentData = [[], component.listData];
    component.recentRows = new Set();
    component.materialsService = { searchMaterial: vi.fn(() => of([])) };
    component.explorerPicker = { pickMany: vi.fn(async () => [picked]) };

    await component.exploreMaterials();

    const added = component.listData[1];
    expect(added).toMatchObject({ Material: 'Block hueco 15', Cantidad: 0 });
    expect(component.isRecent(added)).toBe(true);
    expect(component.isRecent(old)).toBe(false);
    vi.advanceTimersByTime(RECENT_MS);
    expect(component.isRecent(added)).toBe(false);
  });

  it('existing-project page: highlights the rows that weren’t there before', async () => {
    const component: any = Object.create(MaterialStageUpdateComponent.prototype);
    component.currentPanelItem = 'Losa';
    component.currentPanelOrigin = 'revit-user';
    component.indexSheet = 3;
    component.sheetNames = ['Cimentación', 'Muros interiores', 'Muros exteriores', 'Pisos'];
    component.recentIds = new Set();
    component.listData2 = [{ id: 1, project_id: 42 }];
    component.cdr = { markForCheck: vi.fn() };
    component.showMaterials = vi.fn();
    component.explorerPicker = {
      pickMany: vi.fn(async (context: any) => (await context.save([picked])).length && [picked]),
    };
    component.projectsService = {
      addSchemeProject: vi.fn(() => of({ id: 2 })),
      getMaterialSchemeProyect: vi.fn(() => of([{ id: 1, project_id: 42 }, { id: 2, project_id: 42 }])),
    };
    localStorage.setItem('idProyectoConstrucción', '42');

    await component.exploreMaterials();

    expect(component.isRecent({ material_scheme_project_id: 2 })).toBe(true);
    expect(component.isRecent({ material_scheme_project_id: 1 })).toBe(false);
  });
});

describe('Leaving the new-project page', () => {
  const build = () => {
    const component: any = Object.create(MaterialsStageComponent.prototype),
      saves: Subject<any>[] = [];
    component.projectId = 42;
    component.materialsList = [{ id: 2, name_material: 'Concreto_Bloque hueco' }];
    component.listData = [{ Origen: 'Modelo de Revit', Sistema_constructivo: 'Muro A', Material: 'Block', materialSelectedDB: 'Concreto_Bloque hueco', name_material_db: 'Concreto_Bloque hueco', Cantidad: 5 }];
    component.indexSheet = 0;
    component.contentData = [[], component.listData];
    component.SOR = [['Muro A']];
    component.SOD = [[]];
    component.SOU = [[]];
    component.inFlight = Promise.resolve();
    component.lastAutosaveSignature = null;
    component.router = { navigateByUrl: vi.fn() };
    component.projectsService = {
      replaceMaterialScheme: vi.fn(() => {
        const save = new Subject<any>();
        saves.push(save);
        return save;
      }),
    };
    const finish = (index: number) => {
      saves[index].next({ items: [], skipped: [] });
      saves[index].complete();
    };
    return { component, finish };
  };

  it('saves the last changes before opening Resultados', async () => {
    const { component, finish } = build(),

     leaving = component.goToResultados();
    await Promise.resolve();
    expect(component.projectsService.replaceMaterialScheme).toHaveBeenCalledTimes(1);
    expect(component.router.navigateByUrl).not.toHaveBeenCalled();
    finish(0);
    await leaving;

    expect(component.router.navigateByUrl).toHaveBeenCalledWith('resultados');
  });

  it('waits for a save already running, then saves what changed meanwhile', async () => {
    const { component, finish } = build();
    void component.saveStepOne();
    component.lastAutosaveSignature = component.buildAutosaveSignature();
    component.listData[0].Cantidad = 9;

    const flushed = component.flushSave();
    await Promise.resolve();
    expect(component.projectsService.replaceMaterialScheme).toHaveBeenCalledTimes(1);
    finish(0);
    await new Promise(resolve => setTimeout(resolve));
    expect(component.projectsService.replaceMaterialScheme).toHaveBeenCalledTimes(2);
    expect(component.projectsService.replaceMaterialScheme.mock.calls[1][3][0].quantity).toBe(9);
    finish(1);
    await flushed;
  });

  it('saves nothing when nothing changed', async () => {
    const { component } = build();
    component.lastAutosaveSignature = component.buildAutosaveSignature();

    await component.flushSave();

    expect(component.projectsService.replaceMaterialScheme).not.toHaveBeenCalled();
  });
});
