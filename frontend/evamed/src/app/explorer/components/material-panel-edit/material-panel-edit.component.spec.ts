import { TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';
import { of, throwError } from 'rxjs';

import { CatalogsService } from '../../../core/services/catalogs/catalogs.service';
import { ExplorerUiModule } from '../../explorer-ui.module';
import { ExplorerPickerService } from '../../explorer-picker.service';
import { PickedMaterial, PickerContext } from '../../picker.models';
import { ExplorerService } from '../../services/explorer.service';
import { DETAIL } from '../../testing';
import { MaterialPanelEditComponent } from './material-panel-edit.component';

// A project row's Edición in the stage page's Materiales panel (R-46).
describe('MaterialPanelEditComponent', () => {
  const context: PickerContext = {
      mode: 'edit',
      system: 'Muro de block',
      section: 'Muros exteriores',
      projectLife: 50,
      materialId: 12,
      initial: {
        comercialName: 'Block del muro', quantity: 90, comments: '', transportOrigin: null, distanceOrigin: null,
        transportEnd: 4, distanceEnd: 30, replaces: 1, rowUnit: null,
      },
    },
    beam = { ...DETAIL, id: 13, name: 'Acero_Viga', display_name: 'Viga' },
    render = (material: Mock = vi.fn(() => of(DETAIL)), choose: Mock = vi.fn(async () => undefined as unknown)) => {
      TestBed.configureTestingModule({
        imports: [ExplorerUiModule],
        providers: [
          { provide: CatalogsService, useValue: { getTransports: () => of([{ id: 4, name_transport: 'Camión' }]) } },
          { provide: ExplorerService, useValue: { material } },
          { provide: ExplorerPickerService, useValue: { choose } },
        ],
      });
      const fixture = TestBed.createComponent(MaterialPanelEditComponent),
        saved: PickedMaterial[] = [],
        cancelled: unknown[] = [];
      fixture.componentRef.setInput('context', context);
      fixture.componentInstance.save.subscribe(value => saved.push(value));
      fixture.componentInstance.cancelled.subscribe(value => cancelled.push(value));
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement,
        click = async (selector: string, text?: string) => {
          const target = Array.from(el.querySelectorAll<HTMLElement>(selector)).find(
            candidate => !text || candidate.textContent?.includes(text)
          );
          expect(target, `${selector} ${text ?? ''}`).toBeTruthy();
          target!.click();
          await new Promise(resolve => setTimeout(resolve));
          fixture.detectChanges();
        },
        value = (name: string) => el.querySelector<HTMLInputElement>(`input[formcontrolname=${name}]`)!.value;
      return { fixture, el, saved, cancelled, click, value, material, choose };
    };

  it('shows the row’s values and the catalogue summary in a one-column layout', () => {
    const { el, value, material } = render();

    expect(material).toHaveBeenCalledWith(12);
    expect(value('comercialName')).toBe('Block del muro');
    expect(value('quantity')).toBe('90');
    expect(el.querySelector('.edit__summary-name')?.textContent).toContain('AAC block');
    expect(el.querySelector('app-material-edit')!.classList).toContain('edit--panel');
  });

  it('"Guardar cambios" hands the row’s new values back', async () => {
    const { saved, click } = render();

    await click('button[type=submit]', 'Guardar cambios');

    expect(saved[0]).toMatchObject({ material: { id: 12 }, comercialName: 'Block del muro', quantity: 90, distanceEnd: 30 });
  });

  it('"Cancelar" and the back arrow close it without saving', async () => {
    const { saved, cancelled, click } = render();

    await click('button', 'Cancelar');
    await click('button[aria-label="Volver a la lista de materiales"]');

    expect(cancelled.length).toBe(2);
    expect(saved).toEqual([]);
  });

  it('"Cambiar material" chooses in the full-screen explorer and keeps the values typed so far', async () => {
    const choose = vi.fn(async () => beam as unknown),
      { fixture, el, value, click } = render(undefined, choose),
      quantity = el.querySelector<HTMLInputElement>('input[formcontrolname=quantity]')!;
    quantity.value = '120';
    quantity.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await click('.edit__summary-link', 'Cambiar material');

    expect(choose).toHaveBeenCalledWith(expect.objectContaining({ materialId: null, system: 'Muro de block' }));
    expect(el.querySelector('.edit__summary-name')?.textContent).toContain('Viga');
    expect(value('comercialName')).toBe('Viga');
    expect(value('quantity')).toBe('120');
  });

  it('"Ver ficha completa" opens the current material’s Ficha and changes nothing when closed', async () => {
    const choose = vi.fn(async () => undefined as unknown),
      { el, value, click } = render(undefined, choose);

    await click('.edit__summary-link', 'Ver ficha completa');

    expect(choose).toHaveBeenCalledWith(expect.objectContaining({ materialId: 12 }));
    expect(el.querySelector('.edit__summary-name')?.textContent).toContain('AAC block');
    expect(value('comercialName')).toBe('Block del muro');
  });

  it('says so, and offers to retry, when the material can’t be loaded', async () => {
    const material: Mock = vi.fn(() => throwError(() => new Error('offline'))),
      { el, click } = render(material);

    expect(el.querySelector('[role=alert]')?.textContent).toContain('No se pudo cargar el material.');
    material.mockReturnValue(of(DETAIL));
    await click('button', 'Reintentar');

    expect(el.querySelector('.edit__summary-name')?.textContent).toContain('AAC block');
  });
});
