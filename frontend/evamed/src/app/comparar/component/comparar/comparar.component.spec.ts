import { of, Subject } from 'rxjs';

// Compile the component in its NgModule's context (mat-* elements, charts).
import '../../comparar.module';
import { CompararComponent } from './comparar.component';

// The results page names the active project in menu_inicio(), which runs once
// the catalogue requests finish. The user's project list comes from its own
// request chain (searchUser, then getProjects), so it can land after them;
// the page must still show the name when it does.
describe('CompararComponent project name', () => {
  let users$: Subject<any[]>,
    projects$: Subject<any[]>;

  const build = () => {
    const anyRequest = () => of([]),
      analisis = new Proxy({}, { get: () => anyRequest }),
      materials = { getMaterials: anyRequest },
      calculos = {
        FiltradoDeImpactos: () => [{ name_complete_potential_type: 'GWP' }],
        ajustarNombre: (name: string) => name,
        ImpactosSeleccionados: () => [],
        materiales_EPIC: 0,
        materiales_EPD: 0,
      };
    return new CompararComponent(
      materials as any,
      { getProjects: () => projects$ } as any,
      analisis as any,
      { navigateByUrl: vi.fn() } as any,
      { searchUser: () => users$ } as any,
      calculos as any,
      {} as any,
      {} as any
    );
  };

  beforeEach(() => {
    localStorage.setItem('email-login', 'ana@example.com');
    sessionStorage.setItem('projectID', '7');
    users$ = new Subject();
    projects$ = new Subject();
    // Chart and button set-up that needs real catalogue data.
    for (const method of ['llenarIdsBotonesImpactos', 'BDInicio', 'llenarIdsBotones', 'iniciar_graficas']) {
      vi.spyOn(CompararComponent.prototype as any, method).mockImplementation(() => undefined);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows the active project name when the project list arrives after the catalogues', () => {
    // The catalogue requests (of([])) have already completed by now.
    const component = build();

    users$.next([{ id: 3 }]);
    users$.complete();
    projects$.next([
      { id: 7, name_project: 'Casa Norte', user_platform_id: 3 },
      { id: 8, name_project: 'Oficina', user_platform_id: 3 },
      { id: 9, name_project: 'Ajeno', user_platform_id: 4 },
    ]);
    projects$.complete();

    expect(component.proyecto.nombre).toBe('Casa Norte');
    expect(component.proyect.map(p => p.Nombre)).toEqual(['Oficina']);
  });

  it('still draws the charts when the project list cannot be loaded', () => {
    const component = build();

    users$.error(new Error('offline'));

    expect(component.projectsList).toEqual([]);
    expect(CompararComponent.prototype['iniciar_graficas']).toHaveBeenCalledWith(7);
  });
});
