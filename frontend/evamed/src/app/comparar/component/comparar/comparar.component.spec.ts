import { of, Subject, throwError } from 'rxjs';

// Compile the component in its NgModule's context (mat-* elements, charts).
import '../../comparar.module';
import { CompararComponent } from './comparar.component';
import { ResultadosService } from '../../resultados.service';
import { firstValueFrom } from 'rxjs';

// The results page names the active project in menu_inicio(), which runs once
// the catalogue requests finish. The user's project list comes from its own
// request chain (searchUser, then getProjects), so it can land after them;
// the page must still show the name when it does.
describe('CompararComponent project name', () => {
  let users$: Subject<any[]>,
    projects$: Subject<any[]>;

  const build = (overrides: Record<string, (...args: any[]) => any> = {}) => {
    const anyRequest = () => of([]),
      analisis = new Proxy(overrides, { get: (target, name: string) => target[name] ?? anyRequest }),
      materials = { getMaterials: anyRequest },
      calculos = {
        FiltradoDeImpactos: () => [{ name_complete_potential_type: 'GWP' }],
        ajustarNombre: (name: string) => name,
        OperacionesDeFase: vi.fn(),
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
      {} as any,
      new ResultadosService(analisis as any, calculos as any)
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

  it('lists what the server left out of the active project (audit A-13)', () => {
    const excluded = { materials: [], no_mass: [], transport: [], energy: [{ id: 16, name: 'Red MX' }], sources: [] },
      getProjectResults = vi.fn(() => of({ excluded })),
      component = build({ getProjectResults });
    users$.next([{ id: 3 }]);
    users$.complete();
    projects$.next([]);
    projects$.complete();

    expect(getProjectResults).toHaveBeenCalledWith(7, undefined, true);
    expect(component.excluded).toEqual(excluded);
  });

  it('still draws the charts when the project list cannot be loaded', () => {
    const component = build();

    users$.error(new Error('offline'));

    expect(component.projectsList).toEqual([]);
    expect(CompararComponent.prototype['iniciar_graficas']).toHaveBeenCalledWith(7);
  });

  // A-32 plan, Task 3: section 1 comes from GET /results/?detalle=1.
  describe('server results', () => {
    const datos = { GWP: { Producción: { 'A1-A3': 5 } }, ODP: { Producción: { 'A1-A3': 1 } } },
      servidor = (map: Record<number, () => any>) => ({
        getProjectResults: vi.fn((id: number) => map[id]()),
      }),
      drawn = () => vi.spyOn(CompararComponent.prototype as any, 'dibujarProyecto').mockImplementation(() => undefined),
      selections = (component: any) => (component.materials.getMaterialsStageSelections = () => of({ items: [] }));

    it('draws section 1 from the server results', async () => {
      const component: any = build(servidor({ 7: () => of({ datos }) }));
      await firstValueFrom(component.resultados.cargar(7));

      expect(component.llamarCalculos(7)).toEqual(datos);
      expect(component.calculos.OperacionesDeFase).not.toHaveBeenCalled();
    });

    it('keeps the Solo carbono filter working with server names', async () => {
      const component: any = build(servidor({ 7: () => of({ datos }) }));
      await firstValueFrom(component.resultados.cargar(7));
      component.nombresMostrados = new Set(['GWP']);

      expect(component.llamarCalculos(7)).toEqual({ GWP: datos.GWP });
    });

    it('shows an error and retries a project that failed', () => {
      vi.mocked(CompararComponent.prototype['iniciar_graficas'] as any).mockRestore();
      const dibujar = drawn();
      let falla = true;
      const component: any = build(servidor({ 8: () => (falla ? throwError(() => new Error('500')) : of({ datos })) }));
      selections(component);

      component.iniciar_graficas(8);
      expect(component.estadoCarga[8]).toBe('error');
      expect(component.proyect_active).not.toContain(8);
      expect(dibujar).not.toHaveBeenCalled();

      falla = false;
      component.reintentar(8);
      expect(component.estadoCarga[8]).toBe('listo');
      expect(dibujar).toHaveBeenCalledWith(8);
    });

    it('ignores a late response for a removed project', () => {
      vi.mocked(CompararComponent.prototype['iniciar_graficas'] as any).mockRestore();
      const dibujar = drawn(),
        tarde = new Subject<any>(),
        component: any = build(servidor({ 8: () => tarde }));
      selections(component);

      component.iniciar_graficas(8);
      // What quitarProyecto does to the shown list (the rest needs the chart containers).
      component.proyect_active = component.proyect_active.filter((item: number) => item != 8);
      tarde.next({ datos });
      tarde.complete();

      expect(dibujar).not.toHaveBeenCalled();
      expect(component.proyect_active).not.toContain(8);
    });
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
        ImpactosSeleccionados: (types: any[]) => ['ciclo de vida', ...types.map(t => t.name_complete_potential_type)],
        OperacionesDeFase: vi.fn(() => [{
          'Calentamiento global, total': { Producción: { A1: 1 } },
          'Agotamiento de ozono': { Producción: { A1: 2 } },
        }]),
      };
      component.potentialTypesList = types;
      // Server results (A-32): every indicator of the active method.
      component.resultados = {
        obtener: () => ({ datos: {
          'Calentamiento global, total': { Producción: { A1: 1 } },
          'Agotamiento de ozono': { Producción: { A1: 2 } },
        } }),
      };
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

  it('shows only the carbon indicator of the server results in the carbon view', () => {
    const component = build();
    component.vista = 'carbono';
    component.iniciarCatalogo([gwp, odp]);

    const datos = component.llamarCalculos(7);

    expect(component.calculos.OperacionesDeFase).not.toHaveBeenCalled();
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

  it('shows only the carbon column in the results table', () => {
    const component = build();
    vi.spyOn(component, 'ajusteUsoBaseDatos').mockImplementation(() => undefined);

    component.cambiarVista('carbono');
    expect(component.columnsToDisplay).toEqual(['ciclo de vida', 'Calentamiento global, total']);

    component.cambiarVista('completo');
    expect(component.columnsToDisplay).toEqual(['ciclo de vida', 'Calentamiento global, total', 'Agotamiento de ozono']);
  });

  it('a stage click in the carbon view opens the GWP-total breakdown, not a one-axis radar', () => {
    const component = build(),
      graficaEn = (vista: 'completo' | 'carbono') => {
        vi.spyOn(component, 'ajusteUsoBaseDatos').mockImplementation(() => undefined);
        component.cambiarVista(vista);
        component.resultdosGraficos = true;
        component.banderaGrapg = 1;
        component.containerGraficas = { clear: () => undefined };
        const pie = vi.spyOn(component, 'iniciaPie').mockImplementation(() => undefined),
          radar = vi.spyOn(component, 'iniciaRadiales').mockImplementation(() => undefined);
        vi.spyOn(component, 'receiveSelector').mockImplementation((nombre: any) => {
          component.selector = nombre;
          component.bandera = 1;
        });
        component.grafica('Producción');
        return { pie: pie.mock.calls.length, radar: radar.mock.calls.length, selector: component.selector };
      };
    document.body.innerHTML = '<button id="Producción"></button>';

    expect(graficaEn('carbono')).toEqual({ pie: 1, radar: 0, selector: 'Calentamiento global, total' });
    vi.restoreAllMocks();
    expect(graficaEn('completo')).toEqual({ pie: 0, radar: 1, selector: null });
    document.body.innerHTML = '';
  });

  it('hides the switch when no carbon indicator is served', () => {
    const component = build([odp]);
    component.vista = 'carbono';
    component.iniciarCatalogo([odp]);

    expect(component.carbonoDisponible).toBe(false);
    expect(component.catologoImpactoAmbiental).toEqual([odp]);
  });
});

// Final review (2026-11-21): switching views must not leave section 1 half-selected,
// and stages hidden with the eye button stay hidden after the recalculation.
describe('CompararComponent view switch resets', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('clears the selected bar and stage before recalculating', () => {
    const component: any = Object.create(CompararComponent.prototype);
    component.calculos = { ajustarNombre: (name: string) => name, ImpactosSeleccionados: () => [] };
    component.basesDatos = { 'ECO Platform': true };
    component.vista = 'completo';
    component.catologoImpactoAmbiental = [];
    component.iniciarCatalogo([{ id: 20, name_potential_type: 'GWP-total', name_complete_potential_type: 'GWP' }]);
    document.body.innerHTML = '<button id="Producción" class="boton-select"></button>';
    component.ID = 'Producción';
    component.bandera = 1;
    component.selector = 'GWP';
    let estadoAlRecalcular: any;
    vi.spyOn(component, 'ajusteUsoBaseDatos').mockImplementation(() => {
      estadoAlRecalcular = { bandera: component.bandera, ID: component.ID, selector: component.selector };
    });

    component.cambiarVista('carbono');

    expect(estadoAlRecalcular).toEqual({ bandera: 0, ID: ' ', selector: null });
    expect(document.getElementById('Producción')!.className).toBe('boton-principal');
  });

  it('keeps stages hidden with the eye button out of the rebuilt bars', () => {
    const component: any = Object.create(CompararComponent.prototype);
    component.calculos = { ajustarNombre: (name: string) => name };
    component.basesDatos = { 'ECO Platform': true };
    component.proyect_active = [7];
    component.fasesEliminadas = ['Uso'];
    component.resultdosGraficos = true;
    component.Impactos_ambientales = false;
    component.Impactos_Elementos = false;
    component.Elementos_constructivos = false;
    vi.spyOn(component, 'llamarCalculos').mockReturnValue({});
    vi.spyOn(component, 'getAnalisisBarras').mockImplementation(() => ({
      id: 7, Nombre: 'Casa', Datos: { GWP: { Producción: 1, Uso: 2 } },
    }));
    for (const method of ['getAnalisisRadial', 'getAnalisisPie', 'getAnalisisPieBarSegunaSeccion',
      'getAnalisisElementos', 'getAnalisisBarrasElementosConstructivos', 'iniciaBarras']) {
      vi.spyOn(component, method).mockReturnValue({});
    }

    component.ajusteUsoBaseDatos(['ECO Platform']);

    expect(component.outproyect_bar[0].Datos.GWP).toEqual({ Producción: 1 });
  });

});
