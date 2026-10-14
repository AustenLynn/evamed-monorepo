import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ExplorerModule } from '../../explorer.module';
import { ExplorerService } from '../../services/explorer.service';
import { DETAIL } from '../../testing';

describe('MaterialDetailPageComponent', () => {
  let http: HttpTestingController, harness: RouterTestingHarness;

  const open = async (url: string, lastList: string | null = null) => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([{ path: 'explorador', loadChildren: () => ExplorerModule }]),
        ],
      });
      http = TestBed.inject(HttpTestingController);
      TestBed.inject(ExplorerService).lastListUrl = lastList;
      harness = await RouterTestingHarness.create(url);
    },
    el = () => harness.routeNativeElement as HTMLElement;

  afterEach(() => http.verify());

  it('shows the Ficha of the material in the URL, browse-only', async () => {
    await open('/explorador/produccion/12');
    http.expectOne(request => request.url.endsWith('/explorer/produccion/12/')).flush(DETAIL);
    harness.detectChanges();

    expect(el().querySelector('app-material-detail h1')?.textContent).toContain('AAC block');
    expect(el().querySelector('.detail__select')).toBeNull();
    expect(el().querySelector('.stage-tab--active')?.textContent).toContain('Producción');
  });

  it('goes back to the list as it was left', async () => {
    await open('/explorador/produccion/12', '/explorador/produccion?buscar=block&vista=tabla');
    http.expectOne(() => true).flush(DETAIL);
    harness.detectChanges();

    const crumb = el().querySelector<HTMLAnchorElement>('.detail-page__crumb')!;
    expect(crumb.getAttribute('href')).toBe('/explorador/produccion?buscar=block&vista=tabla');
    crumb.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/explorador/produccion?buscar=block&vista=tabla');
    http.match(() => true).forEach(request => request.flush({ count: 0, next: null, previous: null, results: [], facets: {} }));
  });

  it('falls back to the plain list', async () => {
    await open('/explorador/produccion/12', '/home-evamed');
    http.expectOne(() => true).flush(DETAIL);
    harness.detectChanges();

    expect(el().querySelector('.detail-page__crumb')?.getAttribute('href')).toBe('/explorador/produccion');
  });
});
