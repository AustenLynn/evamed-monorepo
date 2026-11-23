import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExcludedNoticeComponent, ResultsExcluded } from './excluded-notice.component';

const empty: ResultsExcluded = { materials: [], no_mass: [], transport: [], energy: [], sources: [] };

describe('ExcludedNoticeComponent', () => {
  let fixture: ComponentFixture<ExcludedNoticeComponent>;

  const render = (excluded: ResultsExcluded | null | undefined) => {
    fixture = TestBed.createComponent(ExcludedNoticeComponent);
    fixture.componentRef.setInput('excluded', excluded);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => TestBed.configureTestingModule({ imports: [ExcludedNoticeComponent] }));

  it('lists old-method materials with their count, database and section', () => {
    const el = render({
      ...empty,
      materials: [
        { row_id: 1, material_id: 7, name: 'Block de concreto', database: 'EPiC', section: 'Muros', reason: 'old_method' },
        { row_id: 2, material_id: 8, name: 'Varilla', database: 'EPDs', section: 'Losa', reason: 'old_method' },
      ],
    });
    expect(el.textContent).toContain('Este proyecto usa 2 materiales del método anterior; no se incluyen en los resultados');
    expect(el.textContent).toContain('Block de concreto');
    expect(el.textContent).toContain('EPiC');
    expect(el.textContent).toContain('Muros');
  });

  it('names the indicators a partial material lacks', () => {
    const el = render({
      ...empty,
      materials: [{ row_id: 3, material_id: 9, name: 'Mortero', database: 'ECO Platform', section: null, reason: 'missing:WDP' }],
    });
    expect(el.textContent).toContain('Mortero');
    expect(el.textContent).toContain('WDP');
  });

  it('says transport is left out for materials without mass', () => {
    const el = render({ ...empty, no_mass: [{ row_id: 4, material_id: 10, name: 'Panel' }] });
    expect(el.textContent).toContain('sin masa: transporte no incluido');
    expect(el.textContent).toContain('Panel');
  });

  it('lists transport, energy and construction entries without values', () => {
    const el = render({
      ...empty,
      transport: [{ id: 1, name: 'Barco' }],
      energy: [{ id: 2, name: 'Red MEXICANIUH' }],
      sources: [{ id: 3, name: 'Generador diésel' }],
    });
    expect(el.textContent).toContain('Barco');
    expect(el.textContent).toContain('Red MEXICANIUH');
    expect(el.textContent).toContain('Generador diésel');
  });

  it('lists materials without end of life (C2–C4)', () => {
    const el = render({
      ...empty,
      end_of_life: [
        { row_id: 5, material_id: 11, name: 'Concreto', reason: 'sin_datos' },
        { row_id: 6, material_id: 12, name: 'Block', reason: 'sin_masa' },
      ],
    });
    expect(el.textContent).toContain('2 materiales sin fin de vida (C2–C4): no se incluyen en esas etapas');
    expect(el.textContent).toContain('Concreto');
    expect(el.textContent).toContain('sin datos de fin de vida');
    expect(el.textContent).toContain('sin masa para el escenario');
  });

  it('says nothing about end of life when every material has it, or the server does not send it', () => {
    expect(render({ ...empty, end_of_life: [] }).textContent).not.toContain('fin de vida');
    expect(render(empty).textContent ?? '').not.toContain('fin de vida');
  });

  it('renders nothing when nothing was left out', () => {
    expect(render(empty).querySelector('[role="status"]')).toBeNull();
    expect(render(undefined).querySelector('[role="status"]')).toBeNull();
  });
});
