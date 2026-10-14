import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { CatalogsService } from '../../../core/services/catalogs/catalogs.service';
import { ExplorerUiModule } from '../../explorer-ui.module';
import { ExplorerPage } from '../../explorer.models';
import { ExplorerPickerService } from '../../explorer-picker.service';
import { PickedMaterial } from '../../picker.models';
import { DETAIL } from '../../testing';

describe('ExplorerPickerService', () => {
  let http: HttpTestingController;

  const list: ExplorerPage = {
      count: 1,
      next: null,
      previous: null,
      results: [DETAIL],
      facets: { sources: { 'ECOINVENT 3': 1 } },
    },
    overlay = () => document.querySelector('.cdk-overlay-container') as HTMLElement,
    settle = async () => {
      await new Promise(resolve => setTimeout(resolve));
      TestBed.tick();
    },
    click = async (selector: string, text?: string) => {
      const target = Array.from(overlay().querySelectorAll<HTMLElement>(selector)).find(
        candidate => !text || candidate.textContent?.includes(text)
      );
      expect(target, `${selector} ${text ?? ''}`).toBeTruthy();
      target!.click();
      await settle();
    },
    start = async () => {
      TestBed.configureTestingModule({
        imports: [ExplorerUiModule],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: CatalogsService, useValue: { getTransports: () => of([{ id: 1, name_transport: 'Barco' }, { id: 4, name_transport: 'Camión' }]) } },
        ],
      });
      http = TestBed.inject(HttpTestingController);
      const result = TestBed.inject(ExplorerPickerService).pick({
        system: 'Muro de block',
        section: 'Muros exteriores',
        projectLife: 50,
      });
      // The picker's code loads on first use.
      for (let tries = 0; tries < 50 && !overlay()?.querySelector('app-explorer-browser'); tries++) {
        await settle();
      }
      http.expectOne(request => request.url.endsWith('/explorer/produccion/')).flush(list);
      await settle();
      return { result };
    };

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    http.verify();
  });

  it('opens full-screen on the material list, with where the material will go', async () => {
    await start();

    expect(overlay().querySelector('.picker__title')?.textContent).toContain('Explorador de materiales');
    expect(overlay().querySelector('.picker__context')?.textContent?.trim()).toBe('Muros exteriores · Muro de block');
    expect(overlay().querySelectorAll('app-result-card').length).toBe(1);
  });

  it('goes list → Ficha → Edición and resolves with the material', async () => {
    const { result } = await start();

    await click('.result-card__open');
    http.expectOne(request => request.url.endsWith('/explorer/produccion/12/')).flush(DETAIL);
    await settle();
    await click('.detail__select');

    const quantity = overlay().querySelector<HTMLInputElement>('input[formcontrolname=quantity]')!;
    quantity.value = '30';
    quantity.dispatchEvent(new Event('input'));
    await click('button[type=submit]');

    const picked = (await result) as PickedMaterial;
    expect(picked.material.id).toBe(12);
    expect(picked.quantity).toBe(30);
    expect(picked.transportEnd).toBe(4);
  });

  it('goes back to the list as it was, without fetching it again', async () => {
    await start();
    await click('.result-card__open');
    http.expectOne(() => true).flush(DETAIL);
    await settle();

    await click('.picker__crumbs button');

    expect(overlay().querySelector<HTMLElement>('app-explorer-browser')!.hidden).toBe(false);
    expect(overlay().querySelector('app-material-detail')).toBeNull();
    expect(http.match(() => true)).toEqual([]);
  });

  it('"Cancelar" in Edición returns to the Ficha', async () => {
    await start();
    await click('.result-card__open');
    http.expectOne(() => true).flush(DETAIL);
    await settle();
    await click('.detail__select');

    await click('button', 'Cancelar');
    http.expectOne(() => true).flush(DETAIL);
    await settle();

    expect(overlay().querySelector('app-material-edit')).toBeNull();
    expect(overlay().querySelector('app-material-detail h1')?.textContent).toContain('AAC block');
  });

  it('resolves with nothing when closed', async () => {
    const { result } = await start();

    await click('button[aria-label="Cerrar el explorador sin agregar"]');

    expect(await result).toBeUndefined();
  });
});
