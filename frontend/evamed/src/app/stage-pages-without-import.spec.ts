import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CatalogsService } from './core/services/catalogs/catalogs.service';
import { ConstructionStageService } from './core/services/construction-stage/construction-stage.service';
import { EndLifeService } from './core/services/end-life/end-life.service';
import { EnergyTotalService } from './core/services/energy-total/energy-total.service';
import { MaterialsService } from './core/services/materials/materials.service';
import { ConstructionStageModule } from './construction-stage/construction-stage.module';
import { ConstructionStageComponent } from './construction-stage/components/construction-stage/construction-stage.component';
import { EndLifeStageModule } from './end-life-stage/end-life-stage.module';
import { EndLifeStageComponent } from './end-life-stage/components/end-life-stage/end-life-stage.component';

// An existing project reaches the construction and end-of-life pages for new
// projects when that stage has no saved data yet. Opening it (ActiveProjectService)
// stores the project but no imported Excel, so these pages must list the
// building elements without sessionStorage['dataProject'].
describe.each([
  ['construction', ConstructionStageModule, ConstructionStageComponent],
  ['end of life', EndLifeStageModule, EndLifeStageComponent],
])('%s page for an existing project', (_name, stageModule: any, stage: any) => {
  beforeEach(() => {
    // The state ActiveProjectService.open() leaves: a project, no imported Excel.
    sessionStorage.removeItem('dataProject');
    sessionStorage.setItem('primaryDataProject', JSON.stringify({ id: 7, name_project: 'Casa Norte' }));
    const anyRequest = () => of([]),
      catalogs = new Proxy({}, { get: () => anyRequest });
    TestBed.configureTestingModule({
      imports: [stageModule],
      providers: [
        provideRouter([]),
        { provide: CatalogsService, useValue: catalogs },
        { provide: MaterialsService, useValue: catalogs },
        { provide: ConstructionStageService, useValue: catalogs },
        { provide: EndLifeService, useValue: catalogs },
        {
          provide: EnergyTotalService,
          useValue: {
            loadAll: vi.fn(),
            setConstructionTotal: vi.fn(),
            setEndLifeTotal: vi.fn(),
            breakdown$: of({ construction: 0, usage: 0, endLife: 0, total: 0 }),
          },
        },
      ],
    });
  });

  afterEach(() => sessionStorage.clear());

  it('renders the project name and all building elements', () => {
    const fixture = TestBed.createComponent<any>(stage);

    expect(() => fixture.detectChanges()).not.toThrow();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Casa Norte');
    expect(fixture.componentInstance.sheetNames).toEqual([
      'Cimentación',
      'Muros interiores',
      'Muros exteriores',
      'Pisos',
      'Techos',
      'Entrepiso',
      'Estructura',
      'Puertas',
      'Ventanas',
      'Inst. especiales',
      'Otros',
    ]);
    expect(text).toContain('Inst. especiales');
  });
});
