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
    start = async (extra: object = {}, many = false, body: ExplorerPage = list) => {
      TestBed.configureTestingModule({
        imports: [ExplorerUiModule],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: CatalogsService, useValue: { getTransports: () => of([{ id: 1, name_transport: 'Barco' }, { id: 4, name_transport: 'Camión' }]) } },
        ],
      });
      http = TestBed.inject(HttpTestingController);
      const picker = TestBed.inject(ExplorerPickerService),
        context = { system: 'Muro de block', section: 'Muros exteriores', projectLife: 50, ...extra },
        result = many ? picker.pickMany(context) : picker.pick(context);
      // The picker's code loads on first use.
      for (let tries = 0; tries < 50 && !overlay()?.querySelector('app-explorer-browser'); tries++) {
        await settle();
      }
      http.expectOne(request => request.url.endsWith('/explorer/produccion/')).flush(body);
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

    expect(overlay().querySelector('.picker__title')?.textContent).toContain('Agregar material al proyecto');
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

  it('edit mode: opens Edición directly with the row’s values', async () => {
    const { result } = await start({
      mode: 'edit',
      materialId: 12,
      initial: {
        comercialName: 'Block del muro', quantity: 90, comments: '', transportOrigin: null, distanceOrigin: null,
        transportEnd: 4, distanceEnd: 30, replaces: 1, rowUnit: 'Ton',
      },
    });
    http.expectOne(request => request.url.endsWith('/explorer/produccion/12/')).flush(DETAIL);
    await settle();

    expect(overlay().querySelector('.picker__title')?.textContent).toContain('Editar material');
    expect(overlay().querySelector<HTMLInputElement>('input[formcontrolname=comercialName]')!.value).toBe('Block del muro');
    expect(overlay().querySelector('.edit__warning')?.textContent).toContain('«Ton»');
    await click('button[type=submit]', 'Guardar cambios');

    expect(await result).toMatchObject({ comercialName: 'Block del muro', quantity: 90, distanceEnd: 30, replaces: 1, lifeYears: 25 });
  });

  it('edit mode: a row without a catalogue material starts on the list', async () => {
    await start({ mode: 'edit', materialId: null });

    expect(overlay().querySelector<HTMLElement>('app-explorer-browser')!.hidden).toBe(false);
    expect(overlay().querySelector('app-material-edit')).toBeNull();
  });

  describe('several at once', () => {
    const beam = { ...DETAIL, id: 13, name: 'Acero_Viga', display_name: 'Viga', unit: 'm', source: 'EPDs' },
      two: ExplorerPage = { ...list, count: 2, results: [DETAIL, beam] },
      tick = (index: number) => click(`app-result-card:nth-of-type(${index}) .result-card__check input`),
      quantity = (index: number, value: string) => {
        const input = overlay().querySelectorAll<HTMLInputElement>('.selection__quantity input')[index];
        input.value = value;
        input.dispatchEvent(new Event('input'));
        TestBed.tick();
      },
      addButton = () =>
        Array.from(overlay().querySelectorAll<HTMLButtonElement>('.picker__tray button')).find(button =>
          button.textContent?.includes('Agregar')
        )!;

    it('ticks materials, lists them with a quantity each, and adds them with the defaults', async () => {
      const { result } = await start({}, true, two);

      await tick(1);
      await tick(2);
      expect(overlay().querySelector('.picker__count')?.textContent?.trim()).toBe('2 materiales seleccionados');
      await click('.picker__tray button', 'Revisar y agregar');

      expect(Array.from(overlay().querySelectorAll('.selection__name'), name => name.textContent?.trim())).toEqual([
        'AAC block',
        'Viga',
      ]);
      expect(addButton().disabled).toBe(true);
      quantity(0, '30');
      quantity(1, '4.5');
      expect(addButton().textContent?.trim()).toBe('Agregar 2 materiales');
      expect(addButton().disabled).toBe(false);
      await click('.picker__tray button', 'Agregar 2 materiales');

      expect(await result).toEqual([
        {
          material: { id: 12, name: DETAIL.name, unit: 'kg', source: 'ECOINVENT 3' },
          comercialName: 'AAC block',
          quantity: 30,
          comments: '',
          transportOrigin: 1,
          distanceOrigin: null,
          transportEnd: 4,
          distanceEnd: null,
          lifeYears: 50,
          replaces: 0,
        },
        expect.objectContaining({ material: expect.objectContaining({ id: 13 }), comercialName: 'Viga', quantity: 4.5 }),
      ]);
    });

    it('unticks a material, and removes one from the list', async () => {
      await start({}, true, two);

      await tick(1);
      await tick(2);
      await tick(1);
      expect(overlay().querySelector('.picker__count')?.textContent?.trim()).toBe('1 material seleccionado');
      await click('.picker__tray button', 'Revisar y agregar');
      await click('button[aria-label="Quitar de la selección: Viga"]');

      expect(overlay().querySelector('.selection')).toBeNull();
      expect(overlay().querySelector('.picker__tray')).toBeNull();
      expect(overlay().querySelector<HTMLElement>('app-explorer-browser')!.hidden).toBe(false);
    });

    it('adds from the Ficha too', async () => {
      await start({}, true, two);

      await click('app-result-card:nth-of-type(2) .result-card__open');
      http.expectOne(request => request.url.endsWith('/explorer/produccion/13/')).flush(beam);
      await settle();
      await click('.detail__toggle', 'Agregar a la selección');

      expect(overlay().querySelector('.detail__toggle')?.textContent).toContain('En la selección');
      expect(overlay().querySelector('.picker__count')?.textContent?.trim()).toBe('1 material seleccionado');
    });

    it('edits one material’s other values in Edición, then goes back to the list', async () => {
      const { result } = await start({}, true, two);
      await tick(2);
      await click('.picker__tray button', 'Revisar y agregar');

      await click('.selection__edit');
      http.expectOne(request => request.url.endsWith('/explorer/produccion/13/')).flush(beam);
      await settle();
      const name = overlay().querySelector<HTMLInputElement>('input[formcontrolname=comercialName]')!,
        amount = overlay().querySelector<HTMLInputElement>('input[formcontrolname=quantity]')!,
        distance = overlay().querySelector<HTMLInputElement>('input[formcontrolname=distanceEnd]')!;
      [[name, 'Viga IPR'], [amount, '12'], [distance, '80']].forEach(([input, value]) => {
        (input as HTMLInputElement).value = value as string;
        (input as HTMLInputElement).dispatchEvent(new Event('input'));
      });
      await click('button[type=submit]', 'Guardar en la selección');

      expect(overlay().querySelector('.selection__meta')?.textContent).toContain('«Viga IPR»');
      expect(overlay().querySelector<HTMLInputElement>('.selection__quantity input')!.value).toBe('12');
      await click('.picker__tray button', 'Agregar 1 material');
      expect(await result).toEqual([expect.objectContaining({ comercialName: 'Viga IPR', quantity: 12, distanceEnd: 80 })]);
    });

    it('keeps what the project couldn’t save, says so, and hands back what it did', async () => {
      const save = vi.fn(async (materials: PickedMaterial[]) => materials.map(material => material.material.id === 12)),
        { result } = await start({ save }, true, two);
      await tick(1);
      await tick(2);
      await click('.picker__tray button', 'Revisar y agregar');
      quantity(0, '1');
      quantity(1, '2');

      await click('.picker__tray button', 'Agregar 2 materiales');

      expect(save).toHaveBeenCalledTimes(1);
      expect(overlay().querySelector('.picker__failed')?.textContent).toContain('No se pudo agregar: Viga.');
      expect(Array.from(overlay().querySelectorAll('.selection__name'), name => name.textContent?.trim())).toEqual(['Viga']);
      await click('button[aria-label="Cerrar el explorador sin agregar"]');
      expect(await result).toEqual([expect.objectContaining({ comercialName: 'AAC block', quantity: 1 })]);
    });

    it('offers no checkboxes when editing a project row', async () => {
      await start({ mode: 'edit', materialId: null });

      expect(overlay().querySelector('.result-card__check')).toBeNull();
    });
  });
});
