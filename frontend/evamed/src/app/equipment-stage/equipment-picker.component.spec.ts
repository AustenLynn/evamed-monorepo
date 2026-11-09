import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EMPTY, of } from 'rxjs';
import { EquipmentStageUiModule } from './equipment-stage-ui.module';
import { EquipmentPickerComponent } from './equipment-picker.component';
import { EquipmentCatalogueService } from './equipment-catalogue.service';

const catalogue = { sources: [{ id: 2, name: 'Generador diésel', type: 'Generador' }, { id: 11, name: 'Excavadora hidráulica', type: 'Otros' }], units: [], unitLabels: [], constructionEnergyProcessId: 8 };
describe('Equipment catalogue', () => {
  const render = (extra: object = {}) => {
    const close = vi.fn();
    TestBed.configureTestingModule({ imports: [EquipmentStageUiModule], providers: [
      {provide: MAT_DIALOG_DATA, useValue: {stage: 'construction', section: 'Pisos', mode: 'add', ...extra}},
      {provide: MatDialogRef, useValue: {close, backdropClick: () => EMPTY, keydownEvents: () => EMPTY}},
      {provide: EquipmentCatalogueService, useValue: {load: () => of(catalogue)}}
    ]});
    const fixture = TestBed.createComponent(EquipmentPickerComponent); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement,
     click = async (selector: string) => { const button = el.querySelector<HTMLElement>(selector); expect(button, selector).toBeTruthy(); button!.click(); await new Promise(resolve => setTimeout(resolve)); fixture.detectChanges(); };
    return {fixture, el, close, click};
  };
  it('adds sources without quantity or unit controls and retains only failed selections', async () => {
    const save = vi.fn(async () => [true, false]), {el, close, click} = render({save});
    expect(el.textContent).toContain('Agregar equipos');
    expect(el.querySelector('[name="quantity"], [name="unit"]')).toBeNull();
    await click('[data-source="2"]'); await click('[data-source="11"]');
    await click('.equipment-add');
    expect(save).toHaveBeenCalledWith(catalogue.sources);
    expect(el.querySelector('.equipment-failed')?.textContent).toContain('Excavadora');
    await click('[aria-label="Cerrar catálogo"]');
    expect(close).toHaveBeenCalledWith([catalogue.sources[0]]);
  });
  it('single replacement returns directly with no selection tray', async () => {
    const {el, click, close} = render({mode: 'replace'});
    expect(el.querySelector('.equipment-tray')).toBeNull();
    await click('[data-source="11"]');
    expect(close).toHaveBeenCalledWith(catalogue.sources[1]);
  });
  it('keeps selections through search and ignores repeated submission and close during saving', async () => {
    let finish!: (saved: boolean[]) => void;
    const save = vi.fn(() => new Promise<boolean[]>(resolve => {finish = resolve;})), {fixture, el, click, close} = render({save});
    await click('[data-source="2"]');
    const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'excavadora'; search.dispatchEvent(new Event('input')); fixture.detectChanges();
    expect(el.querySelector('[data-source="2"]')).toBeNull();
    await click('.equipment-add'); await click('.equipment-add'); await click('[aria-label="Cerrar catálogo"]');
    expect(save).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled();
    finish([true]); await new Promise(resolve => setTimeout(resolve)); fixture.detectChanges();
    expect(close).toHaveBeenCalledWith([catalogue.sources[0]]);
  });
});
