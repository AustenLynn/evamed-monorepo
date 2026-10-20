import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ExplorerItem, ExplorerPage } from '../../explorer.models';
import { ExplorerModule } from '../../explorer.module';

const item = (id: number): ExplorerItem => ({
    id,
    stage: 'produccion',
    name: `Concreto_Bloque ${id}`,
    display_name: `Bloque ${id}`,
    category: 'Concreto',
    description: null,
    source: 'EPiC',
    unit: 'kg',
    gwp: id,
    impact_level: 'medio',
  }),
  page = (from: number, to: number, count: number): ExplorerPage => ({
    count,
    next: null,
    previous: null,
    results: Array.from({ length: to - from + 1 }, (_, index) => item(from + index)),
    facets: { sources: { EPiC: count, EPDs: 2 } },
  });

// The routed explorer: URL state, both views, and every loading state (HANDOFF §4, §7).
describe('Explorer (routed)', () => {
  let http: HttpTestingController, harness: RouterTestingHarness;

  const open = async (url: string) => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([{ path: 'explorador', loadChildren: () => ExplorerModule }]),
        ],
      });
      http = TestBed.inject(HttpTestingController);
      harness = await RouterTestingHarness.create(url);
    },
    el = () => harness.routeNativeElement as HTMLElement,
    // The harness doesn't render on its own after a navigation.
    settle = async () => {
      await harness.fixture.whenStable();
      harness.detectChanges();
    },
    url = () => TestBed.inject(Router).url,
    pending = () => http.match(() => true),
    answer = (request: TestRequest, body: ExplorerPage) => {
      request.flush(body);
      harness.detectChanges();
    },
    only = () => {
      const requests = pending();
      expect(requests.length).toBe(1);
      return requests[0];
    },
    button = (text: string) =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(candidate =>
        candidate.textContent?.includes(text)
      );

  afterEach(() => http.verify());

  it('shows the first batch of cards with the result count', async () => {
    await open('/explorador/produccion');
    const request = only();
    expect(request.request.params.toString()).toBe('page=1&page_size=24');
    expect(el().querySelectorAll('.results-cards__skeleton').length).toBeGreaterThan(0);

    answer(request, page(1, 24, 30));

    expect(el().querySelectorAll('app-result-card').length).toBe(24);
    expect(el().querySelector('.results-cards__skeleton')).toBeNull();
    expect(el().querySelector('#results-title')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Resultados (30)');
  });

  it('reads search and filters from the URL', async () => {
    await open('/explorador/produccion?buscar=acero&base=EPiC&base=EPDs');

    expect(only().request.params.toString()).toBe(
      'page=1&page_size=24&search=acero&source=EPiC&source=EPDs'
    );
    expect(el().querySelector<HTMLInputElement>('#explorer-search')!.value).toBe('acero');
  });

  it('writes a chosen filter to the URL and starts over', async () => {
    await open('/explorador/produccion?vista=tabla&pagina=2');
    answer(only(), page(25, 30, 30));

    el().querySelector<HTMLInputElement>('fieldset input[type=checkbox]')!.click();
    await settle();

    expect(url()).toBe('/explorador/produccion?vista=tabla&base=EPiC');
    expect(only().request.params.toString()).toBe('page=1&page_size=24&source=EPiC');
  });

  it('loads the next batch on request and says when there is no more', async () => {
    await open('/explorador/produccion');
    answer(only(), page(1, 24, 30));

    button('Cargar más')!.click();
    harness.detectChanges();
    expect(el().querySelector('[role=status]')?.textContent).toContain('Cargando más resultados… · 24 de 30');
    const next = only();
    expect(next.request.params.get('page')).toBe('2');
    answer(next, page(25, 30, 30));

    expect(el().querySelectorAll('app-result-card').length).toBe(30);
    expect(el().querySelector('[role=status]')?.textContent).toContain('No hay más resultados');
    expect(button('Cargar más')).toBeUndefined();
  });

  it('switches to the table without fetching again, then pages through the URL', async () => {
    await open('/explorador/produccion');
    answer(only(), page(1, 24, 30));

    (el().querySelector('mat-button-toggle[value=tabla] button') as HTMLButtonElement).click();
    await settle();

    expect(url()).toBe('/explorador/produccion?vista=tabla');
    expect(pending()).toEqual([]);
    expect(el().querySelectorAll('tr.mat-mdc-row').length).toBe(24);

    (el().querySelector('.mat-mdc-paginator-navigation-next') as HTMLButtonElement).click();
    await settle();
    expect(url()).toBe('/explorador/produccion?vista=tabla&pagina=2');
    answer(only(), page(25, 30, 30));
    expect(el().querySelectorAll('tr.mat-mdc-row').length).toBe(6);
  });

  it('reads the order from the URL and groups the cards', async () => {
    await open('/explorador/produccion?orden=categoria');

    const request = only();
    expect(request.request.params.toString()).toBe('page=1&page_size=24&sort=categoria');
    answer(request, page(1, 2, 2));

    expect(Array.from(el().querySelectorAll('.results-cards__group'), heading => heading.textContent?.trim())).toEqual([
      'Concreto · kg',
    ]);
  });

  it('writes a chosen order to the URL and starts over, keeping the filters', async () => {
    await open('/explorador/produccion?base=EPiC&vista=tabla&pagina=2');
    answer(only(), page(25, 30, 30));

    el().querySelector<HTMLElement>('.explorer-browser__sort .mat-mdc-select-trigger')!.click();
    await settle();
    Array.from(document.querySelectorAll<HTMLElement>('mat-option'))
      .find(option => option.textContent?.includes('Menor impacto'))!
      .click();
    await settle();

    expect(url()).toBe('/explorador/produccion?base=EPiC&vista=tabla&orden=impacto');
    expect(only().request.params.toString()).toBe('page=1&page_size=24&source=EPiC&sort=impacto');
  });

  it('offers no order on stages without units', async () => {
    await open('/explorador/construccion');
    answer(only(), { ...page(1, 2, 2), facets: { types: {} } });

    expect(el().querySelector('.explorer-browser__sort')).toBeNull();
  });

  it('offers to retry a failed load', async () => {
    await open('/explorador/produccion');
    only().flush('down', { status: 503, statusText: 'Unavailable' });
    harness.detectChanges();

    expect(el().querySelector('[role=alert]')?.textContent).toContain('No se pudieron cargar los resultados.');
    button('Reintentar')!.click();
    answer(only(), page(1, 2, 2));

    expect(el().querySelectorAll('app-result-card').length).toBe(2);
    expect(el().querySelector('[role=alert]')).toBeNull();
  });

  it('explains an empty result and offers to clear the filters, keeping the order', async () => {
    await open('/explorador/produccion?buscar=zzz&orden=impacto');
    answer(only(), { ...page(1, 0, 0), facets: { sources: {} } });

    expect(el().querySelector('.explorer-browser__empty')?.textContent).toContain(
      'No encontramos resultados con estos filtros.'
    );
    el().querySelector<HTMLButtonElement>('.explorer-browser__empty button')!.click();
    await settle();
    expect(url()).toBe('/explorador/produccion?orden=impacto');
    answer(only(), page(1, 1, 1));
  });

  it('comes back to a list without fetching it again', async () => {
    await open('/explorador/produccion?buscar=bloque');
    answer(only(), page(1, 24, 30));

    await harness.navigateByUrl('/explorador/uso');
    answer(only(), { ...page(1, 1, 1), facets: { sources: {}, types: {} } });
    await harness.navigateByUrl('/explorador/produccion?buscar=bloque');

    expect(pending()).toEqual([]);
    expect(el().querySelectorAll('app-result-card').length).toBe(24);
  });

  it('shows the empty end-of-life stage without asking the API', async () => {
    await open('/explorador/fin-de-vida');

    expect(pending()).toEqual([]);
    expect(el().querySelector('.explorer-empty')?.textContent).toContain(
      'Aún no hay escenarios de fin de vida con factores de impacto en la base de datos.'
    );
  });

  it('links Producción names to their detail page', async () => {
    await open('/explorador/produccion');
    answer(only(), page(1, 1, 1));

    expect(el().querySelector('.result-card__name a')?.getAttribute('href')).toBe('/explorador/produccion/1');
  });
});
