import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { EnergyTotalService } from '../../../core/services/energy-total/energy-total.service';
import { MaterialsService } from '../../../core/services/materials/materials.service';
import { UsageApiService } from '../../services/usage-api.service';
import { UsageState } from '../../usage.models';
import { usageFixture } from '../../testing/usage-fixtures';
import { UsageStageModule } from '../../usage-stage.module';
import { UsageStageComponent } from '../usage-stage/usage-stage.component';
import { UsageStageUpdateComponent } from './usage-stage-update.component';

// Both route entries hydrate the same aggregate editor without legacy writers.
describe.each([['new', UsageStageComponent], ['reopened', UsageStageUpdateComponent]])('%s Usage route', (_name, component: typeof UsageStageComponent | typeof UsageStageUpdateComponent) => {
  beforeEach(() => {localStorage.setItem('idProyectoConstrucción', '5'); sessionStorage.setItem('primaryDataProject', JSON.stringify({id: 5, name_project: 'Casa'}));});
  afterEach(() => {localStorage.clear(); sessionStorage.clear();});
  it('renders sources from an asynchronous aggregate response with stable row identity', async () => {
    const response = new Subject<UsageState>(), load = vi.fn(() => response);
    TestBed.configureTestingModule({imports: [UsageStageModule], providers: [provideRouter([]),
      {provide: UsageApiService, useValue: {load, save: vi.fn()}},
      {provide: EnergyTotalService, useValue: {loadAll: vi.fn(), refresh: vi.fn(), breakdown$: of({production: 0, construction: 0, usage: 0, endLife: 0, total: 0, unit: 'kg CO2 eq'})}},
      {provide: MaterialsService, useValue: {}}
    ]});
    const fixture = TestBed.createComponent(component); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando consumo');
    response.next(usageFixture()); await fixture.whenStable(); fixture.detectChanges();
    expect(load).toHaveBeenCalledWith(5); expect(fixture.nativeElement.querySelectorAll('[data-row]').length).toBe(2);
    expect(fixture.componentInstance.editor?.store.saved?.sources.map(row=>row.id)).toEqual([21, 22]);
  });
});
