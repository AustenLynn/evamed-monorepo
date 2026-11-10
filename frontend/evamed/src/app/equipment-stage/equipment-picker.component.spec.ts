import { EquipmentSource } from './equipment.models';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EMPTY, of } from 'rxjs';
import { EquipmentStageUiModule } from './equipment-stage-ui.module';
import { EquipmentPickerComponent } from './equipment-picker.component';
import { SEARCH_DEBOUNCE_MS } from '../explorer/components/filter-panel/filter-panel.component';
import { EquipmentCatalogueService } from './equipment-catalogue.service';

const catalogue = { sources: [{ id: 2, name: 'Generador diésel (GLO)-Ecoinvent 3', displayName: 'Generador diésel', database: 'ECOINVENT 3', region: 'Global', type: 'Generador' }, { id: 11, name: 'Excavadora hidráulica (MX)-MEXICANIUH', displayName: 'Excavadora hidráulica', database: 'mexicaniuh', region: 'México', type: 'Otros' }], units: [], unitLabels: [], constructionEnergyProcessId: 8 };
describe('Equipment catalogue', () => {
  const render = (extra: object = {}, sources: EquipmentSource[] = catalogue.sources) => {
    const close = vi.fn();
    TestBed.configureTestingModule({ imports: [EquipmentStageUiModule], providers: [
      {provide: MAT_DIALOG_DATA, useValue: {stage: 'construction', section: 'Pisos', mode: 'add', ...extra}},
      {provide: MatDialogRef, useValue: {close, backdropClick: () => EMPTY, keydownEvents: () => EMPTY}},
      {provide: EquipmentCatalogueService, useValue: {load: () => of({...catalogue, sources})}}
    ]});
    const fixture = TestBed.createComponent(EquipmentPickerComponent); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement,
     click = async (selector: string) => { const button = el.querySelector<HTMLElement>(selector); expect(button, selector).toBeTruthy(); button!.click(); await new Promise(resolve => setTimeout(resolve)); fixture.detectChanges(); };
    return {fixture, el, close, click};
  };
  it.each(['construction', 'end-life'])('uses material filters and cards in %s, keeping hidden selections', async stage => {
    const {el, click, fixture} = render({stage});
    expect(Array.from(el.querySelectorAll('legend'), node => node.textContent?.trim())).toEqual(['Base de datos', 'Tipo', 'Región']);
    expect(el.querySelector('[data-source="2"]')?.textContent?.trim()).toBe('Generador diésel');
    expect(el.querySelector('app-source-chip')?.textContent).toContain('ECOINVENT 3');
    expect(el.querySelector('app-region-chip')?.textContent).toContain('Global');
    await click('[data-source="2"]');
    const group = Array.from(el.querySelectorAll('fieldset')).find(node => node.querySelector('legend')?.textContent?.trim() === 'Región')!,
     mexico = Array.from(group.querySelectorAll('mat-checkbox')).find(node => node.textContent?.includes('México'))!;
    (mexico.querySelector('input') as HTMLInputElement).click(); fixture.detectChanges();
    expect(el.querySelector('[data-source="2"]')).toBeNull();
    expect(el.querySelector('[data-source="11"]')).not.toBeNull();
    expect(el.querySelector('.equipment-tray')?.textContent).toContain('Generador diésel');
    const database = Array.from(el.querySelectorAll('fieldset')).find(node => node.querySelector('legend')?.textContent?.trim() === 'Base de datos')!,
     ecoinvent = Array.from(database.querySelectorAll('mat-checkbox')).find(node => node.textContent?.includes('ECOINVENT 3'))!;
    (ecoinvent.querySelector('input') as HTMLInputElement).click(); fixture.detectChanges();
    expect(el.querySelectorAll('[data-source]')).toHaveLength(0);
    await click('.filter-panel__clear');
    expect(el.querySelectorAll('[data-source]')).toHaveLength(2);
    expect(fixture.componentInstance.selected.has(2)).toBe(true);
  });
  it('keeps unspecified metadata explicit and searchable without inventing it', async () => {
    const {el, click} = render({}, [{id: 9, name: 'Equipo sin metadatos', type: 'Otros'}]);
    expect(el.querySelector('app-source-chip')?.textContent).toContain('Sin base de datos');
    expect(el.querySelector('app-region-chip')?.textContent).toContain('Sin región');
    expect(el.querySelectorAll('fieldset')[0].textContent).toContain('Sin base de datos');
    await click('[data-source="9"]');
    expect(el.querySelector('.equipment-tray')?.textContent).toContain('Equipo sin metadatos');
  });
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
    search.value = 'excavadora'; search.dispatchEvent(new Event('input')); await new Promise(resolve => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 20)); fixture.detectChanges();
    expect(el.querySelector('[data-source="2"]')).toBeNull();
    await click('.equipment-add'); await click('.equipment-add'); await click('[aria-label="Cerrar catálogo"]');
    expect(save).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled();
    finish([true]); await new Promise(resolve => setTimeout(resolve)); fixture.detectChanges();
    expect(close).toHaveBeenCalledWith([catalogue.sources[0]]);
  });
});
