import { TestBed } from '@angular/core/testing';

import { ExplorerItem } from '../../explorer.models';
import { ExplorerUiModule } from '../../explorer-ui.module';
import { ResultsCardsComponent } from './results-cards.component';

const items = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => ({ id: index + 1, display_name: `Item ${index + 1}`, gwp: 1, unit: 'kg' }) as ExplorerItem
  );

describe('ResultsCardsComponent', () => {
  let observed: IntersectionObserverCallback | null;

  beforeEach(() => {
    observed = null;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          observed = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const render = (inputs: Partial<ResultsCardsComponent>) => {
      TestBed.configureTestingModule({ imports: [ExplorerUiModule] });
      const fixture = TestBed.createComponent(ResultsCardsComponent),
        loadMore = vi.fn();
      Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
      fixture.componentInstance.loadMore.subscribe(loadMore);
      fixture.detectChanges();
      return { fixture, loadMore, el: fixture.nativeElement as HTMLElement };
    },
    scrollToEnd = () =>
      observed!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);

  it('marks where each group starts when the order groups them', () => {
    const grouped = [
        { id: 1, display_name: 'Viga', category: 'Acero', unit: 'm²', gwp: 2 },
        { id: 2, display_name: 'Alambre', category: 'Acero', unit: 'm²', gwp: 13 },
        { id: 3, display_name: 'Bloque', category: 'Concreto', unit: 'kg', gwp: 1 },
        { id: 4, display_name: 'Ánfora', category: null, unit: null, gwp: null },
      ] as ExplorerItem[],
      headings = (el: HTMLElement) =>
        Array.from(el.querySelectorAll('.results-cards__group'), heading => heading.textContent?.trim());

    expect(headings(render({ items: grouped, groupBy: 'categoria' }).el)).toEqual([
      'Acero · m²',
      'Concreto · kg',
      'Sin categoría · sin unidad',
    ]);
    TestBed.resetTestingModule();
    expect(headings(render({ items: grouped, groupBy: 'impacto' }).el)).toEqual(['Por m²', 'Por kg', 'Sin unidad']);
    TestBed.resetTestingModule();
    expect(headings(render({ items: grouped, groupBy: 'nombre' }).el)).toEqual([]);
  });

  it('loads the next batch when the end of the grid comes into view', () => {
    const { loadMore } = render({ items: items(24), count: 30, hasMore: true });

    scrollToEnd();

    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('waits while a batch is loading, and stops at the end', () => {
    expect(render({ items: items(24), count: 30, hasMore: true, loading: true }).loadMore).not.toHaveBeenCalled();
    scrollToEnd();
    TestBed.resetTestingModule();

    const { loadMore } = render({ items: items(30), count: 30, hasMore: false });
    scrollToEnd();
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('fills the last row and one more with placeholders while loading', () => {
    const { el } = render({ items: items(5), count: 30, hasMore: true, loading: true });

    // jsdom has no layout: one column, so the last row is full and one more row is one card.
    expect(el.querySelectorAll('.results-cards__skeleton').length).toBe(1);
    expect(el.querySelector('[role=status]')?.textContent).toContain('Cargando más resultados… · 5 de 30');
  });

  it('moves focus to the first new card after "Cargar más"', () => {
    vi.useFakeTimers();
    const { fixture, el } = render({ items: items(2), count: 4, hasMore: true });

    el.querySelector<HTMLButtonElement>('.results-cards__more')!.click();
    fixture.componentRef.setInput('items', items(4));
    fixture.detectChanges();
    vi.runAllTimers();

    expect(document.activeElement).toBe(el.querySelectorAll('.result-card')[2]);
  });
});
