import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { UsageStageModule } from '../../usage-stage.module';
import { UsageStageComponent, leaveUsage } from '../usage-stage/usage-stage.component';
import { UsageStageUpdateComponent } from './usage-stage-update.component';
import { UsageService } from '../../editor/usage.service';
import { UsageState } from '../../editor/usage.models';
import { MaterialsService } from '../../../core/services/materials/materials.service';
import { EnergyTotalService } from '../../../core/services/energy-total/energy-total.service';

// Both entries must hydrate the shared editor and keep their own project context.
describe('Usage route entries', () => {
  afterEach(() => {localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks();});
  it('allows returning to projects when no active project can be loaded', async () => {
    const router = {url: '/usage-stage/update', navigateByUrl: vi.fn()};
    TestBed.configureTestingModule({imports: [UsageStageModule], providers: [
      {provide: UsageService, useValue: {load: vi.fn()}}, {provide: Router, useValue: router},
      {provide: MaterialsService, useValue: {}}, {provide: EnergyTotalService, useValue: {loadAll: vi.fn(), breakdown$: of({construction: 0, usage: 0, endLife: 0, total: 0})}},
    ]});
    const fixture = TestBed.createComponent(UsageStageUpdateComponent); fixture.detectChanges();
    const back = [...fixture.nativeElement.querySelectorAll('button')].find((button: HTMLButtonElement) => button.textContent.includes('Regresar a proyectos')) as HTMLButtonElement;
    expect(back.disabled).toBe(false); back.click(); await fixture.whenStable();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });
  for (const update of [false, true]) {
    it(`${update ? 'reopened' : 'new'} entry keeps every saved row and guards drafts`, () => {
      localStorage.setItem('idProyectoConstrucción', '5');
      sessionStorage.setItem('primaryDataProject', JSON.stringify({id: 8}));
      const state$ = new Subject<UsageState>(),
        load = vi.fn(() => state$), router = {url: update ? '/usage-stage/update' : '/usage-stage', navigateByUrl: vi.fn()},
        totals = {loadAll: vi.fn(), setUsageTotal: vi.fn(), breakdown$: of({construction: 0, usage: 0, endLife: 0, total: 0})};
      TestBed.configureTestingModule({imports: [UsageStageModule], providers: [
        {provide: UsageService, useValue: {load, save: vi.fn()}}, {provide: Router, useValue: router},
        {provide: MaterialsService, useValue: {}}, {provide: EnergyTotalService, useValue: totals},
      ]});
      const fixture = update ? TestBed.createComponent(UsageStageUpdateComponent) : TestBed.createComponent(UsageStageComponent);
      fixture.detectChanges();
      const id = update ? 5 : 8;
      expect(load).toHaveBeenCalledWith(id);
      state$.next({project_id: id, project_name: 'Casa', annual: {id: 11, quantity: 100, unit_id: 20}, annuals: [],
        revision: 'one', catalogue: [], units: [{id: 20, name_unit: 'kWh'}], canonical_unit_id: 20, issues: [],
        sources: [21, 22].map(rowId => ({id: rowId, annual_consumption_required_id: 11, source: 'panels', type: null,
          unit_id: 20, percentage: 20, quantity: '20.0000000000', issues: []}))});
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[data-source-row]').length).toBe(2);
      const page = fixture.componentInstance;
      page.go('resultados');
      expect(sessionStorage.getItem('projectID')).toBe(String(id));
      expect(router.navigateByUrl).toHaveBeenCalledWith('resultados');
      page.editor.editRow(page.editor.state.sources[0]); page.editor.rowDraft.percentage = '30';
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      expect((leaveUsage as any)(page)).toBe(false);
      expect(page.editor.rowDraft.percentage).toBe('30');
      page.editor.pending = true; expect(page.navigationLocked).toBe(true);
    });
  }
});
