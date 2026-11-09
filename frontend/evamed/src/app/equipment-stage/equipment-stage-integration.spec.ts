import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjectsService } from '../core/services/projects/projects.service';
import { MaterialsService } from '../core/services/materials/materials.service';
import { EnergyTotalService } from '../core/services/energy-total/energy-total.service';
import { EquipmentCatalogueService } from './equipment-catalogue.service';
import { EquipmentRowsService } from './equipment-rows.service';
import { EquipmentPickerService } from './equipment-picker.service';
import { EquipmentStagePanelComponent } from './equipment-stage-panel.component';
import { ConstructionStageModule } from '../construction-stage/construction-stage.module';
import { EndLifeStageModule } from '../end-life-stage/end-life-stage.module';
import { ConstructionStageComponent } from '../construction-stage/components/construction-stage/construction-stage.component';
import { ConstructionStageUpdateComponent } from '../construction-stage/components/construction-stage-update/construction-stage-update.component';
import { EndLifeStageComponent } from '../end-life-stage/components/end-life-stage/end-life-stage.component';
import { EndLifeUpdateComponent } from '../end-life-stage/components/end-life-update/end-life-update.component';

describe.each([
  ['construction', ConstructionStageComponent, 'setConstructionTotal'],
  ['construction reopened', ConstructionStageUpdateComponent, 'setConstructionTotal'],
  ['end-life', EndLifeStageComponent, 'setEndLifeTotal'],
  ['end-life reopened', EndLifeUpdateComponent, 'setEndLifeTotal'],
])('%s equipment host', (_label, type: any, totalMethod: string) => {
  afterEach(() => { localStorage.clear(); sessionStorage.clear(); });
  const host = () => {
    const component = Object.create(type.prototype);
    component.projectId = 42;
    component.sheetNames = ['Cimentación', 'Muros interiores'];
    component.router = { navigateByUrl: vi.fn() };
    component.energyTotalService = { [totalMethod]: vi.fn() };
    return component;
  };
  it('waits for pending mutations before navigating to the explicit project', async () => {
    localStorage.setItem('idProyectoConstrucción', '3');
    const component = host();
    let complete!: () => void;
    component.equipmentPanel = { whenIdle: vi.fn(() => new Promise<void>(resolve => complete = resolve)) };
    const navigation = component.goToResultados();
    expect(component.router.navigateByUrl).not.toHaveBeenCalled();
    complete(); await navigation;
    expect(sessionStorage.getItem('projectID')).toBe('42');
    expect(component.router.navigateByUrl).toHaveBeenCalledWith('resultados');
  });
  it.each(['goToMaterialStage', 'goToConstructionStage', 'goToUsageStage', 'goToEndLife', 'continue', 'goToProjects'])('waits for pending work before %s', async method => {
    const component = host();
    let complete!: () => void;
    component.equipmentPanel = { whenIdle: () => new Promise<void>(resolve => complete = resolve) };
    component.materialsService = {
      getMaterialSchemeProyects: () => of([]), getConstructionStage: () => of([]),
      getACR: () => of([]), getEDCP: () => of([]),
    };
    const navigation = component[method]();
    expect(component.router.navigateByUrl).not.toHaveBeenCalled();
    complete(); await navigation;
    expect(component.router.navigateByUrl).toHaveBeenCalledTimes(1);
  });
  it('has no legacy polling, blur or delete-and-recreate EC entry points', () => {
    const component = host();
    for (const method of ['startAutosave', 'onFieldBlur', 'onSelectChange', 'onSaveEC', 'saveStepTwo', 'saveStepFour', 'addFormEC', 'removeFormEC']) {
      expect(component[method]).toBeUndefined();
    }
  });
  it('selects an empty section without creating an automatic legacy row', () => {
    const component = host();
    component.EC = []; component.dataArrayEC = [];
    component.onGroupsChange([{ value: 'Muros interiores' }]);
    expect(component.indexSheet).toBe(1);
    expect(component.dataArrayEC).toEqual([]);
    expect(component.selectedSheet).toBe('Muros interiores');
  });
  it('publishes committed panel totals through the existing energy service', () => {
    const component = host();
    component.onEquipmentTotalChange(123);
    expect(component.energyTotalService[totalMethod]).toHaveBeenCalledWith(123);
  });
});


describe.each([
  ['construction', ConstructionStageComponent, ConstructionStageModule, false],
  ['construction', ConstructionStageUpdateComponent, ConstructionStageModule, true],
  ['end-life', EndLifeStageComponent, EndLifeStageModule, false],
  ['end-life', EndLifeUpdateComponent, EndLifeStageModule, true],
])('%s shared panel route (reopened: %s)', (stage: string, type: any, module: any, reopened: boolean) => {
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); });
  it.each([false, true])('keeps the shell and explicit context with existing rows: %s', existing => {
    sessionStorage.removeItem('dataProject');
    sessionStorage.setItem('primaryDataProject', JSON.stringify({ id: reopened ? 3 : 42, name_project: 'Casa Norte' }));
    localStorage.setItem('idProyectoConstrucción', reopened ? '42' : '3');
    const rows = existing ? [
      { key: 'one', id: 1, sectionId: 1, sourceId: 5, quantity: 4, unitId: null },
      { key: 'two', id: 2, sectionId: 2, sourceId: 5, quantity: 6, unitId: null },
    ] : [],
     api = { list: vi.fn(() => of({rows, rawTotal: existing ? 10 : 0})), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
     totals = { loadAll: vi.fn(), setConstructionTotal: vi.fn(), setEndLifeTotal: vi.fn(),
      breakdown$: of({construction: 0, usage: 0, endLife: 0, total: 0}) },
     projects = { getProjectById: vi.fn(() => of({id: 42, name_project: 'Casa Norte'})) };
    TestBed.configureTestingModule({imports: [module], providers: [
      provideRouter([]), {provide: ProjectsService, useValue: projects},
      {provide: MaterialsService, useValue: {}}, {provide: EnergyTotalService, useValue: totals},
      {provide: EquipmentRowsService, useValue: api},
      {provide: EquipmentCatalogueService, useValue: {load: () => of({sources: [{id: 5, name: 'Generador', type: 'Generador'}], units: [], unitLabels: [], constructionEnergyProcessId: 1})}},
      {provide: EquipmentPickerService, useValue: {}},
    ]});
    const fixture = TestBed.createComponent<any>(type);
    fixture.detectChanges();
    expect(fixture.componentInstance.projectId).toBe(42);
    expect(totals.loadAll).toHaveBeenCalledWith(42);
    fixture.componentInstance.onGroupsChange([{value: 'Cimentación'}]);
    fixture.detectChanges();
    const panel = fixture.debugElement.query(By.directive(EquipmentStagePanelComponent)).componentInstance;
    expect(panel.stage).toBe(stage); expect(panel.projectId).toBe(42);
    expect(panel.sectionId).toBe(1); expect(panel.sectionName).toBe('Cimentación');
    expect(panel.visibleRows.length).toBe(existing ? 1 : 0);
    fixture.componentInstance.onGroupsChange([{value: 'Muros interiores'}]); fixture.detectChanges();
    expect(panel.sectionId).toBe(2); expect(panel.visibleRows.length).toBe(existing ? 1 : 0);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.list).toHaveBeenCalledWith(stage, 42);
    const text = fixture.nativeElement.textContent;
    for (const label of ['Casa Norte', 'Producción', 'Construcción', 'Uso', 'Fin de vida', 'Inst. especiales', 'Atrás', 'Continuar', 'Ir a resultados']) expect(text).toContain(label);
    expect(fixture.nativeElement.querySelector('app-energy-bar')).toBeTruthy();
    expect(api.create).not.toHaveBeenCalled(); expect(api.update).not.toHaveBeenCalled(); expect(api.remove).not.toHaveBeenCalled();
    expect(stage === 'construction' ? totals.setConstructionTotal : totals.setEndLifeTotal).toHaveBeenCalledWith(existing ? 10 : 0);
  });
});
