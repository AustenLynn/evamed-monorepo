import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ExplorerModule } from '../../explorer.module';

describe('StageTabsComponent', () => {
  const setup = async (url: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'explorador', loadChildren: () => ExplorerModule }]),
      ],
    });
    const harness = await RouterTestingHarness.create(url),
      tabs = () =>
        Array.from(harness.routeNativeElement!.querySelectorAll<HTMLAnchorElement>('.stage-tab'));
    return { harness, tabs };
  };

  it('links to the four stages, in the app order', async () => {
    const { tabs } = await setup('/explorador/produccion');

    expect(tabs().map(tab => tab.getAttribute('href'))).toEqual([
      '/explorador/produccion',
      '/explorador/construccion',
      '/explorador/uso',
      '/explorador/fin-de-vida',
    ]);
    expect(tabs().map(tab => tab.querySelector('.stage-tab__title')?.textContent?.trim())).toEqual([
      'Producción',
      'Construcción',
      'Uso',
      'Fin de vida',
    ]);
  });

  it('marks only the current stage', async () => {
    const { tabs } = await setup('/explorador/uso');

    expect(tabs().map(tab => tab.getAttribute('aria-current'))).toEqual([null, null, 'page', null]);
    expect(tabs()[2].classList).toContain('stage-tab--active');
  });

  it('shows the app’s active stage image on the current tab only', async () => {
    const { tabs } = await setup('/explorador/fin-de-vida'),
      images = tabs().map(tab => tab.querySelector('img')!.getAttribute('src'));
    expect(images).toEqual([
      'assets/images/Etapas/Produccion_.png',
      'assets/images/Etapas/Construcción_.png',
      'assets/images/Etapas/Uso_.png',
      'assets/images/Etapas/Fin_.png',
    ]);
  });

  it('follows navigation between stages', async () => {
    const { harness, tabs } = await setup('/explorador/produccion');

    await harness.navigateByUrl('/explorador/construccion');

    expect(tabs().map(tab => tab.getAttribute('aria-current'))).toEqual([null, 'page', null, null]);
  });
});
