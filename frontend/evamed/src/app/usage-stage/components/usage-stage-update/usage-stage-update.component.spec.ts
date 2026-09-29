import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';

import { CatalogsService } from 'src/app/core/services/catalogs/catalogs.service';
import { ElectricitConsumptionService } from 'src/app/core/services/electricity-consumption/electricit-consumption.service';
import { EnergyTotalService } from 'src/app/core/services/energy-total/energy-total.service';
import { MaterialsService } from 'src/app/core/services/materials/materials.service';
import { UsageStageModule } from '../../usage-stage.module';
import { UsageStageUpdateComponent } from './usage-stage-update.component';

// The page loads the energy-type catalogue, the project's annual consumption
// (ACR) and its consumption breakdown (ECD) with separate requests, which can
// answer in any order.
describe('UsageStageUpdateComponent loading', () => {
  // Decimal fields arrive as strings, as DRF serializes them.
  const acrRows = [{ id: 11, project_id: 5, name: 'Casa', quantity: '1200.0000000000', unit_id: 1 }],
    ecdRows = [
      { id: 21, annual_consumption_required_id: 11, source: 'electric', quantity: '900.0000000000', percentage: 75, unit_id: 1, type: 2 },
      { id: 22, annual_consumption_required_id: 11, source: 'fuel', quantity: '300.0000000000', percentage: 25, unit_id: 1, type: 9 },
    ],
    types = [
      { id: 2, name_type_energy: 'Energía eléctrica, Bajo voltaje (MX)-MEXICANIUH' },
      { id: 9, name_type_energy: 'Calefacción doméstica con gas natural (GLO)' },
    ];

  const render = (sources: { types: Observable<any[]>; acr: Observable<any[]>; ecd: Observable<any[]> }) => {
    TestBed.configureTestingModule({
      imports: [UsageStageModule],
      providers: [
        provideRouter([]),
        { provide: CatalogsService, useValue: { getEnergyUnits: () => of([]), getTypeEnergy: () => sources.types } },
        { provide: ElectricitConsumptionService, useValue: { getACR: () => sources.acr, getECD: () => sources.ecd } },
        { provide: EnergyTotalService, useValue: { loadAll: vi.fn(), setUsageTotal: vi.fn(), breakdown$: of({ construction: 0, usage: 0, endLife: 0, total: 0 }) } },
        { provide: MaterialsService, useValue: {} },
      ],
    });
    return TestBed.createComponent(UsageStageUpdateComponent);
  };

  beforeEach(() => localStorage.setItem('idProyectoConstrucción', '5'));
  afterEach(() => localStorage.clear());

  it('renders the saved values before the energy-type catalogue has loaded', () => {
    const types$ = new Subject<any[]>(),
      fixture = render({ types: types$, acr: of(acrRows), ecd: of(ecdRows) });

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance.tipoMixElectrico).toBe(2);

    types$.next(types);
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('shows the saved breakdown even when it answers before the annual consumption', () => {
    const acr$ = new Subject<any[]>(),
      fixture = render({ types: of(types), acr: acr$, ecd: of(ecdRows) });

    acr$.next(acrRows);
    fixture.detectChanges();

    expect(fixture.componentInstance.cantidadMixElectrico).toBe(900);
    expect(fixture.componentInstance.cantidadCombustible).toBe(300);
  });
});
