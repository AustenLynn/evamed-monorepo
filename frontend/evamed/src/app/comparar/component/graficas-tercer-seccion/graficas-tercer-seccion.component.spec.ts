import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CompararModule } from '../../comparar.module';
import { GraficasTercerSeccionComponent } from './graficas-tercer-seccion.component';

// A-32 plan, Task 8: material names come with the server results, not from the full catalogue.
describe('GraficasTercerSeccionComponent material table', () => {
  it('names materials from nombresMateriales', () => {
    const component: any = Object.create(GraficasTercerSeccionComponent.prototype);
    component.FasesEliminadas = [];
    component.ElementosContructivosEliminados = [];
    component.nombresMateriales = { '9': 'Cemento', '11': 'Acero' };

    const tabla = component.IniciarTablaMateriales(
      { Producción: { 'A1-A3': { '1': { '9': 5, '11': 1 } } } }, ' ', 0, false, ' ');

    expect(tabla.map((fila: any) => fila.material)).toEqual(['Cemento', 'Acero']);
  });
});

// Inside a cdk-virtual-scroll-viewport, CDK 22 tables virtualise their rows: a card showed 4 of
// its 6 materials, and none once a project without materials was shown beside it (dev, A-32 check).
describe('GraficasTercerSeccionComponent rendered', () => {
  const etapas = (a1a3: Record<string, any>) =>
    ({ Producción: { A1: {}, A2: {}, A3: {}, 'A1-A3': a1a3 }, Construccion: { A4: {} }, Uso: { B4: {} } });
  const vacio = () => ({ Producción: { A1: {}, A2: {}, A3: {} }, Construccion: { A4: {} }, Uso: { B4: {} } });
  const estado = { flagPie: true, fragBar: false, agruparProduccion: false, cicloSeleccionado: ' ' };

  it('lists every material of each project, also next to an empty project', async () => {
    await TestBed.configureTestingModule({ imports: [CompararModule, NoopAnimationsModule] }).compileComponents();
    const fixture = TestBed.createComponent(GraficasTercerSeccionComponent);
    Object.assign(fixture.componentInstance, {
      impactoAmbientalMostrado: 'GWP', FaseSeleccionada: ' ', FasesEliminadas: [], ElementosContructivosEliminados: [],
      Secciones: [{ id: 1, name_section: 'Cimentación' }, { id: 2, name_section: 'Muros interiores' }],
      unidades: [], EstadoSeccion: { 650: { ...estado }, 647: { ...estado } },
      nombresMateriales: { '1': 'M1', '2': 'M2', '3': 'M3', '4': 'M4', '5': 'M5', '6': 'M6' },
      inputProyect: [
        { idproyecto: 650, nombre: 'Con datos', data: {
          materiales: { GWP: etapas({ '1': { '1': 60, '2': 20, '3': 10, '4': 5 }, '2': { '5': 3, '6': 2 } }) },
          Calculos: { GWP: etapas({ '1': 95, '2': 5 }) } } },
        { idproyecto: 647, nombre: 'Vacío', data: { materiales: { GWP: vacio() }, Calculos: { GWP: vacio() } } },
      ],
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const tarjetas = [...fixture.nativeElement.querySelectorAll('mat-card')] as HTMLElement[];
    const filas = tarjetas.map(t => t.querySelectorAll('tr.mat-mdc-row').length);
    expect(filas).toEqual([6, 0]);
  });
});
