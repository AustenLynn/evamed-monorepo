import { of } from 'rxjs';

// Compile the components in their NgModule's context.
import './materials-stage.module';
import { PickedMaterial } from '../explorer/picker.models';
import { AddConstructiveSystemComponent } from './components/add-constructive-system/add-constructive-system.component';
import { MaterialStageUpdateComponent } from './components/material-stage-update/material-stage-update.component';
import { MaterialsStageComponent } from './components/materials-stage/materials-stage.component';
import { toSchemeProject } from './picked-material';

const picked: PickedMaterial = {
  material: { id: 2, name: 'Concreto_Bloque hueco', unit: 'Pz', source: 'EPiC' },
  comercialName: 'Block hueco 15',
  quantity: 120,
  comments: '',
  transportOrigin: 1,
  distanceOrigin: 1500,
  transportEnd: 4,
  distanceEnd: null,
  lifeYears: 50,
  replaces: 0,
},

 nextTask = () => new Promise(resolve => setTimeout(resolve));

describe('Nuevo sistema constructivo dialog', () => {
  const build = (existing: string[] = []) => {
    const dialogRef = { close: vi.fn() },
      component = new AddConstructiveSystemComponent(dialogRef as any, { existing });
    return { component, dialogRef };
  };

  it('closes with the trimmed name', () => {
    const { component, dialogRef } = build();
    component.name = '  Muro de block  ';

    component.create();

    expect(dialogRef.close).toHaveBeenCalledWith('Muro de block');
  });

  it('won’t create a blank name', () => {
    const { component, dialogRef } = build();
    component.name = '   ';

    component.create();

    expect(component.valid).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('won’t reuse a name the element already has, whatever its case', () => {
    const { component, dialogRef } = build(['Muro A']);
    component.name = ' muro a';

    component.create();

    expect(component.duplicate).toBe(true);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('cancel closes with nothing', () => {
    const { component, dialogRef } = build();
    component.name = 'Muro B';

    component.cancel();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});

describe('Agregar sistema constructivo on the new-project page', () => {
  afterEach(() => sessionStorage.clear());

  const build = (name: string | undefined, answer: PickedMaterial[]) => {
    const component: any = Object.create(MaterialsStageComponent.prototype),
      revitRow = { Origen: 'Modelo de Revit', Sistema_constructivo: 'Muro A', Material: 'Block', Cantidad: 5 },
      sheet: any[] = [revitRow];
    component.projectId = 42;
    component.ciudadOrigenSeleccionada = 9;
    component.sheetNames = ['Muros exteriores'];
    component.selectedSheet = 'Muros exteriores';
    component.vidaUtilSeleccionado = '50';
    component.contentData = [sheet];
    component.listData = sheet;
    component.indexSheet = 0;
    component.ListSCRevit = ['Muro A'];
    component.ListSCDynamo = [];
    component.ListSCUsuario = [];
    component.SOR = [['Muro A']];
    component.SOD = [[]];
    component.SOU = [[]];
    component.selectedSystems = {};
    component.selectionIdByKey = {};
    component.deleteMode = false;
    component.materialsList = [{ id: 1, name_material: 'Block' }, { id: 2, name_material: 'Concreto_Bloque hueco' }];
    sessionStorage.setItem('dataProject', JSON.stringify({ sheetNames: ['Muros exteriores'], data: [[]] }));
    component.dialog = { open: vi.fn(() => ({ afterClosed: () => of(name) })) };
    component.explorerPicker = { pickMany: vi.fn(async () => answer) };
    component.materialsService = {
      searchMaterial: vi.fn(() => of([])),
      upsertMaterialsStageSelections: vi.fn(() => of({})),
      // New selections start switched on.
      getMaterialsStageSelections: vi.fn(() =>
        of({ items: [{ id: 1, origin_id: 1, label: 'Muro A', is_selected: true }, { id: 2, origin_id: 3, label: name, is_selected: true }] })
      ),
    };
    component.projectsService = { replaceMaterialScheme: vi.fn(() => of({ items: [], skipped: [] })) };
    return component;
  };

  it('asks for a name the element doesn’t have yet, then opens the explorer for it', async () => {
    const component = build('Muro de block', []);

    await component.addConstructiveSystem();

    expect(component.dialog.open.mock.calls[0][1].data).toEqual({ existing: ['Muro A'] });
    expect(component.explorerPicker.pickMany).toHaveBeenCalledWith({
      system: 'Muro de block',
      section: 'Muros exteriores',
      projectLife: 50,
    });
  });

  it('lists the system under "Creados por el usuario", switched on and open with its materials', async () => {
    const component = build('Muro de block', [picked]);

    await component.addConstructiveSystem();

    expect(component.ListSCUsuario).toEqual(['Muro de block']);
    expect(component.isSystemSelected('Muro de block', 3)).toBe(true);
    expect(component.currentPanelItem).toBe('Muro de block');
    expect(component.listMateriales.map((row: any) => [row.Material, row.Origen])).toEqual([
      ['Block hueco 15', 'Usuario_Plataforma'],
    ]);
    const stored = JSON.parse(sessionStorage.getItem('dataProject')!);
    expect(stored.data[0].map((row: any) => row.Sistema_constructivo)).toEqual(['Muro A', 'Muro de block']);
  });

  it('the autosave keeps the user’s system with the others', async () => {
    const component = build('Muro de block', [picked]);

    await component.addConstructiveSystem();
    component.saveStepOne();

    const [projectId, origins, sections, items] = component.projectsService.replaceMaterialScheme.mock.calls[0];
    expect([projectId, origins, sections]).toEqual([42, [1, 2, 3], [1]]);
    expect(items.map((item: any) => [item.construction_system, item.origin_id, item.material_id])).toEqual([
      ['Muro A', 1, 1],
      ['Muro de block', 3, 2],
    ]);
    expect(items[1]).toMatchObject({ transport_id_origin: 1, transport_id_end: 4, quantity: 120 });
  });

  it('a later ⊕ in Materiales adds to the user’s system, not to Revit', async () => {
    const component = build('Muro de block', [picked]);
    await component.addConstructiveSystem();
    component.explorerPicker.pickMany = vi.fn(async () => [{ ...picked, comercialName: 'Mortero' }]);

    await component.exploreMaterials();

    expect(component.listMateriales.map((row: any) => [row.Material, row.Origen])).toEqual([
      ['Block hueco 15', 'Usuario_Plataforma'],
      ['Mortero', 'Usuario_Plataforma'],
    ]);
  });

  it('keeps nothing when the explorer is closed without materials', async () => {
    const component = build('Muro de block', []);

    await component.addConstructiveSystem();

    expect(component.listData).toHaveLength(1);
    expect(component.ListSCUsuario).toEqual([]);
  });

  it('does nothing when the name is cancelled', async () => {
    const component = build(undefined, [picked]);

    await component.addConstructiveSystem();

    expect(component.explorerPicker.pickMany).not.toHaveBeenCalled();
  });

  it('needs an element, and not while systems are being deleted', async () => {
    const component = build('Muro de block', [picked]);
    component.deleteMode = true;

    await component.addConstructiveSystem();
    component.deleteMode = false;
    component.indexSheet = undefined;
    await component.addConstructiveSystem();

    expect(component.dialog.open).not.toHaveBeenCalled();
  });
});

describe('Agregar sistema constructivo on the existing-project page', () => {
  afterEach(() => localStorage.clear());

  const revitRow = { id: 1, project_id: 42, section_id: 4, origin_id: 1, construction_system: 'Losa', material_id: 2 },
    // Added with the explorer to a Revit system: the user's origin, but not the user's system.
    explorerRow = { id: 2, project_id: 42, section_id: 4, origin_id: 3, construction_system: 'Losa', material_id: 2 },

   build = (name: string | undefined, answer: PickedMaterial[]) => {
    const component: any = Object.create(MaterialStageUpdateComponent.prototype),
      saved = { id: 99, project_id: 42, section_id: 4, origin_id: 3, construction_system: name, material_id: 2 };
    component.sheetNames = ['Cimentación', 'Muros interiores', 'Muros exteriores', 'Pisos'];
    component.selectedSheet = 'Pisos';
    component.indexSheet = 3;
    component.vidaUtilSeleccionado = 60;
    component.listData2 = [revitRow, explorerRow];
    component.ListSCRevit = ['Losa'];
    component.ListSCDynamo = [];
    component.ListSCUsuario = [];
    component.SOR = [];
    component.SOD = [];
    component.SOU = [];
    component.selectedSystems = {};
    component.selectionIdByKey = {};
    component.deleteMode = false;
    component.cdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    component.dialog = { open: vi.fn(() => ({ afterClosed: () => of(name) })) };
    component.explorerPicker = {
      pickMany: vi.fn(async (context: any) => {
        const ok: boolean[] = answer.length ? await context.save(answer) : [];
        return answer.filter((_material, index) => ok[index]);
      }),
    };
    component.projectsService = {
      addSchemeProject: vi.fn(() => of(saved)),
      getMaterialSchemeProyect: vi.fn(() => of([revitRow, explorerRow, saved, { id: 7, project_id: 5 }])),
    };
    component.materialsService = {
      searchMaterial: vi.fn(() => of([])),
      upsertMaterialsStageSelections: vi.fn(() => of({})),
      getMaterialsStageSelections: vi.fn(() => of({ items: [] })),
    };
    localStorage.setItem('idProyectoConstrucción', '42');
    return component;
  };

  it('saves each material as the user’s, in the new system', async () => {
    const component = build('Muro verde', [picked]);

    await component.addConstructiveSystem();

    expect(component.dialog.open.mock.calls[0][1].data).toEqual({ existing: ['Losa'] });
    expect(component.projectsService.addSchemeProject).toHaveBeenCalledWith(
      toSchemeProject(picked, { projectId: 42, sectionId: 4, system: 'Muro verde' })
    );
  });

  it('lists only the user’s own systems under "Creados por el usuario", saves it switched on and opens it', async () => {
    const component = build('Muro verde', [picked]),
     show = vi.spyOn(component, 'showMaterials');

    await component.addConstructiveSystem();
    await nextTask();
    await nextTask();

    expect(component.ListSCRevit).toEqual(['Losa']);
    expect(component.ListSCUsuario).toEqual(['Muro verde']);
    expect(component.isSystemSelected('Muro verde', 3)).toBe(true);
    expect(component.materialsService.upsertMaterialsStageSelections).toHaveBeenCalledWith({
      project_id: 42,
      items: [
        { section_id: 4, origin_id: 1, label: 'Losa' },
        { section_id: 4, origin_id: 3, label: 'Muro verde' },
      ],
    });
    expect(show).toHaveBeenLastCalledWith(null, 'Muro verde', 'user');
    expect(component.currentPanelOrigin).toBe('user');
  });

  it('saves nothing when the name is cancelled or no material is added', async () => {
    const cancelled = build(undefined, [picked]),
      empty = build('Muro verde', []);

    await cancelled.addConstructiveSystem();
    await empty.addConstructiveSystem();

    expect(cancelled.explorerPicker.pickMany).not.toHaveBeenCalled();
    expect(empty.projectsService.addSchemeProject).not.toHaveBeenCalled();
    expect(empty.projectsService.getMaterialSchemeProyect).not.toHaveBeenCalled();
  });
});
