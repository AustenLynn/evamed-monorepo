import { TestBed } from '@angular/core/testing';

import { ExplorerQuery } from '../../explorer.models';
import { ExplorerModule } from '../../explorer.module';
import { STAGES } from '../../stage-config';
import { FilterPanelComponent } from './filter-panel.component';

describe('FilterPanelComponent', () => {
  afterEach(() => vi.useRealTimers());

  const render = (query: ExplorerQuery = { search: '', filters: {} }) => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [ExplorerModule] });
    const fixture = TestBed.createComponent(FilterPanelComponent),
      emitted: ExplorerQuery[] = [];
    fixture.componentRef.setInput('filters', STAGES.find(stage => stage.key === 'uso')!.filters);
    fixture.componentRef.setInput('facets', {
      sources: { 'ECOINVENT 3': 3, mexicaniuh: 3 },
      types: { Electricidad: 6, Gas: 1 },
    });
    fixture.componentRef.setInput('query', query);
    fixture.componentInstance.queryChange.subscribe(change => emitted.push(change));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, emitted };
  };

  it('searches 300 ms after typing stops', () => {
    const { el, emitted } = render(),
      input = el.querySelector<HTMLInputElement>('#explorer-search')!;

    input.value = 'ener';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(200);
    input.value = 'energía';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(299);
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(emitted).toEqual([{ search: 'energía', filters: {} }]);
  });

  it('groups each filter under its legend, with counts', () => {
    const { el } = render(),
      legends = Array.from(el.querySelectorAll('legend')).map(legend => legend.textContent?.trim());

    expect(legends).toEqual(['Base de datos', 'Tipo']);
    expect(el.querySelector('fieldset')?.textContent).toContain('mexicaniuh (3)');
  });

  it('adds and removes a value', () => {
    const { el, emitted } = render({ search: 'x', filters: { type: ['Gas'] } }),
      boxes = el.querySelectorAll<HTMLInputElement>('input[type=checkbox]');

    boxes[0].click(); // ECOINVENT 3
    boxes[3].click(); // Gas, checked

    expect(emitted).toEqual([
      { search: 'x', filters: { type: ['Gas'], source: ['ECOINVENT 3'] } },
      { search: 'x', filters: { type: [] } },
    ]);
  });

  it('keeps a chosen value the facets no longer count, so it can be unchecked', () => {
    const { el } = render({ search: '', filters: { source: ['EPDs'] } });

    expect(el.querySelector('fieldset')?.textContent).toContain('EPDs (0)');
  });

  it('clears search and filters at once', () => {
    const { el, emitted } = render({ search: 'gas', filters: { type: ['Gas'] } }),
      clear = Array.from(el.querySelectorAll('button')).find(button => button.textContent?.includes('Limpiar'))!;

    clear.click();

    expect(emitted).toEqual([{ search: '', filters: {} }]);
    expect(el.querySelector<HTMLInputElement>('#explorer-search')!.value).toBe('');
  });

  it('disables "Limpiar filtros" when nothing is applied', () => {
    const { el } = render(),
      clear = Array.from(el.querySelectorAll('button')).find(button => button.textContent?.includes('Limpiar'))!;

    expect(clear.disabled).toBe(true);
  });
});
