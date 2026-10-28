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
      // The picker's code loads on first use; on a busy machine that takes a while.
      for (let tries = 0; tries < 500 && !overlay()?.querySelector('app-explorer-browser'); tries++) {
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

  it('edit mode: "Cancelar" closes the picker without changes', async () => {
    const { result } = await start({ mode: 'edit', materialId: 12 });
    http.expectOne(request => request.url.endsWith('/explorer/produccion/12/')).flush(DETAIL);
    await settle();

    await click('button', 'Cancelar');

    expect(await result).toBeUndefined();
    expect(overlay().querySelector('app-explorer-picker')).toBeNull();
  });

  it('edit mode: "Ver ficha completa" still opens the Ficha', async () => {
    await start({ mode: 'edit', materialId: 12 });
    http.expectOne(request => request.url.endsWith('/explorer/produccion/12/')).flush(DETAIL);
    await settle();

    await click('.edit__summary-link', 'Ver ficha completa');
    http.expectOne(request => request.url.endsWith('/explorer/produccion/12/')).flush(DETAIL);
    await settle();

    expect(overlay().querySelector('app-material-detail h1')?.textContent).toContain('AAC block');
  });

  it('edit mode: a row without a catalogue material starts on the list', async () => {
    await start({ mode: 'edit', materialId: null });

    expect(overlay().querySelector<HTMLElement>('app-explorer-browser')!.hidden).toBe(false);
    expect(overlay().querySelector('app-material-edit')).toBeNull();
  });

  it('edit mode: "Cambiar material" brings in the new material’s name, keeping the row’s other values', async () => {
    const beam = { ...DETAIL, id: 13, name: 'Acero_Viga', display_name: 'Viga' },
      { result } = await start({
        mode: 'edit',
        materialId: 12,
        initial: {
          comercialName: 'Block del muro', quantity: 90, comments: '', transportOrigin: null, distanceOrigin: null,
          transportEnd: 4, distanceEnd: 30, replaces: 1, rowUnit: null,
        },
      });
    http.expectOne(request => request.url.endsWith('/explorer/produccion/12/')).flush(DETAIL);
    await settle();

    await click('.edit__summary-link', 'Cambiar material');
    await click('.result-card__open');
    http.expectOne(request => request.url.endsWith('/explorer/produccion/12/')).flush(beam);
    await settle();
    await click('.detail__select');

    expect(overlay().querySelector<HTMLInputElement>('input[formcontrolname=comercialName]')!.value).toBe('Viga');
    await click('button[type=submit]', 'Guardar cambios');
    expect(await result).toMatchObject({ material: { id: 13 }, comercialName: 'Viga', quantity: 90, distanceEnd: 30 });
  });

  it('adds a material once, however often "Agregar material" is clicked while it saves', async () => {
    let finish!: (saved: boolean[]) => void;
    const save = vi.fn(() => new Promise<boolean[]>(resolve => (finish = resolve))),
      { result } = await start({ save }, true);
    await click('.result-card__open');
    http.expectOne(() => true).flush(DETAIL);
    await settle();
    await click('.detail__select');
    const quantity = overlay().querySelector<HTMLInputElement>('input[formcontrolname=quantity]')!;
    quantity.value = '30';
    quantity.dispatchEvent(new Event('input'));

    await click('button[type=submit]');
    const submit = overlay().querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(submit.textContent?.trim()).toBe('Agregando…');
    expect(submit.disabled).toBe(true);
    submit.form!.requestSubmit();
    await settle();
    finish([true]);

    expect(await result).toHaveLength(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  describe('several at once', () => {
    const beam = { ...DETAIL, id: 13, name: 'Acero_Viga', display_name: 'Viga', unit: 'm', source: 'EPDs' },
      two: ExplorerPage = { ...list, count: 2, results: [DETAIL, beam] },
      tick = (index: number) => click(`app-result-card:nth-of-type(${index}) .result-card__check input`),
      picked = () => Array.from(overlay().querySelectorAll('.picker__chip-name'), name => name.textContent?.trim());

    it('lists the ticked materials, and adds them at once with quantity 0 and the defaults', async () => {
      const { result } = await start({}, true, two);

      await tick(1);
      await tick(2);
      expect(overlay().querySelector('.picker__count')?.textContent?.trim()).toBe('2 materiales seleccionados');
      expect(picked()).toEqual(['AAC block', 'Viga']);
      expect(overlay().querySelector('.selection__quantity')).toBeNull();
      await click('.picker__add', 'Agregar 2 materiales');

      expect(await result).toEqual([
        {
          material: { id: 12, name: DETAIL.name, unit: 'kg', source: 'ECOINVENT 3' },
          comercialName: 'AAC block',
          quantity: 0,
          comments: '',
          transportOrigin: 1,
          distanceOrigin: null,
          transportEnd: 4,
          distanceEnd: null,
          lifeYears: 50,
          replaces: 0,
        },
        expect.objectContaining({ material: expect.objectContaining({ id: 13 }), comercialName: 'Viga', quantity: 0 }),
      ]);
    });

    it('unticks a material, and removes one from the tray’s list', async () => {
      await start({}, true, two);

      await tick(1);
      await tick(2);
      await tick(1);
      expect(picked()).toEqual(['Viga']);
      await click('button[aria-label="Quitar de la selección: Viga"]');

      expect(overlay().querySelector('.picker__tray')).toBeNull();
      expect(overlay().querySelector('.result-card__check input:checked')).toBeNull();
    });

    it('adds from the Ficha too', async () => {
      await start({}, true, two);

      await click('app-result-card:nth-of-type(2) .result-card__open');
      http.expectOne(request => request.url.endsWith('/explorer/produccion/13/')).flush(beam);
      await settle();
      await click('.detail__toggle', 'Agregar a la selección');

      expect(overlay().querySelector('.detail__toggle')?.textContent).toContain('En la selección');
      expect(picked()).toEqual(['Viga']);
    });

    it('Edición joins the ticked materials with its own values, back on the list', async () => {
      const { result } = await start({}, true, two);
      await tick(1);
      await click('app-result-card:nth-of-type(2) .result-card__open');
      http.expectOne(request => request.url.endsWith('/explorer/produccion/13/')).flush(beam);
      await settle();
      await click('.detail__select');
      const amount = overlay().querySelector<HTMLInputElement>('input[formcontrolname=quantity]')!;
      amount.value = '12';
      amount.dispatchEvent(new Event('input'));

      await click('button[type=submit]', 'Agregar a la selección');

      expect(overlay().querySelector<HTMLElement>('app-explorer-browser')!.hidden).toBe(false);
      expect(picked()).toEqual(['AAC block', 'Viga']);
      await click('.picker__add', 'Agregar 2 materiales');
      expect(await result).toEqual([
        expect.objectContaining({ comercialName: 'AAC block', quantity: 0 }),
        expect.objectContaining({ comercialName: 'Viga', quantity: 12 }),
      ]);
    });

    it('keeps what the project couldn’t save, says so, and hands back what it did', async () => {
      const save = vi.fn(async (materials: PickedMaterial[]) => materials.map(material => material.material.id === 12)),
        { result } = await start({ save }, true, two);
      await tick(1);
      await tick(2);

      await click('.picker__add', 'Agregar 2 materiales');

      expect(save).toHaveBeenCalledTimes(1);
      expect(overlay().querySelector('.picker__failed')?.textContent).toContain('No se pudo agregar: Viga.');
      expect(picked()).toEqual(['Viga']);
      await click('button[aria-label="Cerrar el explorador sin agregar"]');
      expect(await result).toEqual([expect.objectContaining({ comercialName: 'AAC block', quantity: 0 })]);
    });

    it('offers no checkboxes when editing a project row', async () => {
      await start({ mode: 'edit', materialId: null });

      expect(overlay().querySelector('.result-card__check')).toBeNull();
    });
  });
});
