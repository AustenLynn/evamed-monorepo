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

// A system is switched off in one element; the same name elsewhere still counts.
describe('CompararComponent switched-off systems', () => {
  it('leaves out only the switched-off system’s section and origin', () => {
    const component: any = Object.create(CompararComponent.prototype),
      row = (section_id: number, construction_system: string, origin_id = 1) =>
        ({ project_id: 7, section_id, construction_system, origin_id });
    component.materialSchemeProyectList = [
      row(2, 'Muro A'), row(3, 'Muro A'), row(2, 'Muro A', 3), row(2, 'Muro B'),
      { project_id: 8, section_id: 2, construction_system: 'Muro A', origin_id: 1 },
    ];
    component.selectionsByProject = {
      7: [{ section_id: 2, label: 'Muro A', origin_id: 1, is_selected: false }],
    };

    expect(component.getFilteredScheme(7)).toEqual([
      row(3, 'Muro A'), row(2, 'Muro A', 3), row(2, 'Muro B'),
      { project_id: 8, section_id: 2, construction_system: 'Muro A', origin_id: 1 },
    ]);
  });
});

// "Solo carbono" filters what the page shows; the calculation keeps every indicator
// because the A2 rules need all of them (design 2026-11-21-solo-carbono-view).
describe('CompararComponent carbon-only view', () => {
  const gwp = { id: 20, name_potential_type: 'GWP-total', name_complete_potential_type: 'Calentamiento global, total' },
    odp = { id: 24, name_potential_type: 'ODP', name_complete_potential_type: 'Agotamiento de ozono' },
    build = (types: any[] = [gwp, odp]) => {
      const component: any = Object.create(CompararComponent.prototype);
      component.calculos = {
        ajustarNombre: (name: string) => name,
        OperacionesDeFase: vi.fn(() => [{
          'Calentamiento global, total': { Producción: { A1: 1 } },
          'Agotamiento de ozono': { Producción: { A1: 2 } },
        }]),
      };
      component.potentialTypesList = types;
      component.materialSchemeProyectList = [];
      component.selectionsByProject = {};
      component.basesDatos = { 'ECO Platform': true, 'ECOINVENT 3': false };
      component.proyect_active = [7, 8];
      component.vista = 'completo';
      component.iniciarCatalogo(types);
      return component;
    };

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('passes the full indicator list to the calculation in the carbon view', () => {
    const component = build();
    component.vista = 'carbono';
    component.iniciarCatalogo([gwp, odp]);

    const datos = component.llamarCalculos(7);

    expect(component.calculos.OperacionesDeFase.mock.calls[0][1].potentialTypesList).toEqual([gwp, odp]);
    expect(Object.keys(datos)).toEqual(['Calentamiento global, total']);
  });

  it('switching views swaps the catalogue, clears indicator selections and recalculates every compared project', () => {
    const component = build(),
      recalcular = vi.spyOn(component, 'ajusteUsoBaseDatos').mockImplementation(() => undefined);
    component.selector = 'Agotamiento de ozono';
    component.selectedValue = 'Agotamiento de ozono';

    component.cambiarVista('carbono');

    expect(component.catologoImpactoAmbiental).toEqual([gwp]);
    expect(component.selector).toBeNull();
    expect(component.selectedValue).toBe('Calentamiento global, total');
    expect(recalcular).toHaveBeenCalledTimes(1);
    expect(recalcular).toHaveBeenCalledWith(['ECO Platform']);
    expect(localStorage.getItem('evamed.resultados.vista')).toBe('carbono');
    expect(Object.keys(component.llamarCalculos(8))).toEqual(['Calentamiento global, total']);

    component.cambiarVista('completo');

    expect(component.catologoImpactoAmbiental).toEqual([gwp, odp]);
    expect(Object.keys(component.llamarCalculos(8))).toEqual(['Calentamiento global, total', 'Agotamiento de ozono']);
  });

  it('filters the element and material sections by indicator too', () => {
    const component = build();
    component.calculosTercerSeccion = {
      OperacionesDeFasePorElementoConstructivoCicloVida: () => ({
        materiales: { 'Calentamiento global, total': {}, 'Agotamiento de ozono': {} },
        Calculos: { 'Calentamiento global, total': {}, 'Agotamiento de ozono': {} },
      }),
    };
    vi.spyOn(component, 'ajusteUsoBaseDatos').mockImplementation(() => undefined);
    component.cambiarVista('carbono');

    const tres = component.llamarCalculosTercerSeccion(7);

    expect(Object.keys(tres.materiales)).toEqual(['Calentamiento global, total']);
    expect(Object.keys(tres.Calculos)).toEqual(['Calentamiento global, total']);
  });

  it('hides the switch when no carbon indicator is served', () => {
    const component = build([odp]);
    component.vista = 'carbono';
    component.iniciarCatalogo([odp]);

    expect(component.carbonoDisponible).toBe(false);
    expect(component.catologoImpactoAmbiental).toEqual([odp]);
  });
});
