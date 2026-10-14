// The app routes reference LayoutComponent: compile it in its NgModule's context.
import '../../../app.module';

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterModule, ROUTES } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AdminGuard } from '../../../admin.guard';
import { routes as appRoutes } from '../../../app-routing.module';
import { ExplorerRoutingModule } from '../../explorer-routing.module';
import { ExplorerModule } from '../../explorer.module';

describe('ExplorerPageComponent', () => {
  const setup = async (url: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'explorador', loadChildren: () => ExplorerModule }]),
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    return { harness, el: () => harness.routeNativeElement as HTMLElement };
  };

  it.each([
    ['produccion', 'Explorador de materiales'],
    ['construccion', 'Explorador de construcción'],
    ['uso', 'Explorador de uso'],
    ['fin-de-vida', 'Explorador de fin de vida'],
  ])('titles the %s page', async (stage, title) => {
    const { el } = await setup(`/explorador/${stage}`);

    expect(el().querySelector('h1')?.textContent?.trim()).toBe(title);
  });

  it('opens Producción by default', async () => {
    const { harness } = await setup('/explorador');

    expect(TestBed.inject(Router).url).toBe('/explorador/produccion');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Explorador de materiales');
  });

  it('sends an unknown stage to Producción', async () => {
    await setup('/explorador/transporte');

    expect(TestBed.inject(Router).url).toBe('/explorador/produccion');
  });
});

describe('explorer route', () => {
  it('is lazy, admin-guarded and wide', () => {
    const route = appRoutes[0].children!.find(candidate => candidate.path === 'explorador')!;

    expect(route.loadChildren).toBeDefined();
    expect(route.canActivate).toEqual([AdminGuard]);
    expect(route.data).toEqual({ layout: 'wide' });
  });

  it('serves one page component for the four stages', () => {
    TestBed.configureTestingModule({ imports: [RouterModule.forRoot([]), ExplorerRoutingModule] });

    const stages = TestBed.inject(ROUTES)
      .flat()
      .filter(route => route.data?.['stage'])
      .map(route => [route.path, route.data!['stage']]);

    expect(stages).toEqual([
      ['produccion', 'produccion'],
      ['construccion', 'construccion'],
      ['uso', 'uso'],
      ['fin-de-vida', 'fin-de-vida'],
    ]);
  });
});
