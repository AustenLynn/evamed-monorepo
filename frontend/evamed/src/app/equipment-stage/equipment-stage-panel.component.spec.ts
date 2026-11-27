import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { EquipmentStageUiModule } from './equipment-stage-ui.module';
import { EquipmentStagePanelComponent } from './equipment-stage-panel.component';
import { EquipmentCatalogueService } from './equipment-catalogue.service';
import { EquipmentRowsService } from './equipment-rows.service';
import { EquipmentPickerService } from './equipment-picker.service';

describe('Equipment cards', () => {
  const render = (stage = 'construction', initialQuantity = '12.3456789', hourUnitId?: number, unit74 = 2) => {
    const rows = [{key: 'construction:73', id: 73, sectionId: 1, sourceId: 11, quantity: initialQuantity, unitId: null}, {key: 'construction:74', id: 74, sectionId: 1, sourceId: 11, quantity: 8, unitId: unit74}, {key: 'construction:75', id: 75, sectionId: 2, sourceId: 11, quantity: 3, unitId: 2}];
    let nextId = 90;
    const picker = {pickMany: vi.fn(async (context: any) => {const sources = [{id: 11, name: 'Excavadora hidráulica', type: 'Otros'}], saved = await context.save(sources); return sources.filter((_s, i) => saved[i]);}), choose: vi.fn(async () => ({id: 2, name: 'Generador diésel', type: 'Generador'}))},
     api = {list: vi.fn(() => of({rows, rawTotal: 23.3456789})), update: vi.fn((_stage: unknown, row: any, value: any) => of({...row, ...value})), create: vi.fn((_stage: unknown, _project:unknown, sectionId:number, value:any) => of({key: 'construction:' + nextId, id: nextId++, sectionId, ...value})), remove: vi.fn(() => of(undefined))};
    TestBed.configureTestingModule({imports: [EquipmentStageUiModule], providers: [
      {provide: EquipmentCatalogueService, useValue: {load: ()=>of({sources: [{id: 11, name: 'Excavadora hidráulica (GLO)-Ecoinvent 3', displayName: 'Excavadora hidráulica', database: 'ECOINVENT 3', region: 'Global', type: 'Otros'}, {id: 2, name: 'Generador diésel', type: 'Generador'}], units: [{id: 2, name: 'Hrs'}, {id: 3, name: 'MJ'}], unitLabels: [{id: 2, name: 'Hrs'}, {id: 3, name: 'MJ'}], hourUnitId, constructionEnergyProcessId: 8})}},
      {provide: EquipmentRowsService, useValue: api}, {provide: EquipmentPickerService, useValue: picker}
    ]});
    const fixture = TestBed.createComponent(EquipmentStagePanelComponent); fixture.componentRef.setInput('stage', stage);fixture.componentRef.setInput('projectId', 42);fixture.componentRef.setInput('sectionId', 1);fixture.componentRef.setInput('sectionName', 'Cimentación');fixture.detectChanges();
    const el:HTMLElement = fixture.nativeElement,
     click = async (selector:string)=>{const node = el.querySelector<HTMLElement>(selector);expect(node, selector).toBeTruthy();node!.click();await new Promise(resolve=>setTimeout(resolve));fixture.detectChanges();},
     quantity = (value:string)=>{const input = el.querySelector<HTMLInputElement>('input[name="quantity"]')!;input.value = value;input.dispatchEvent(new Event('input'));fixture.detectChanges();};
    const editQuantity = async (rowId: number, text: string) => {
      el.querySelector<HTMLButtonElement>(`[data-row="${rowId}"] button.quantity`)!.click(); fixture.detectChanges();
      const input = el.querySelector<HTMLInputElement>(`[data-row="${rowId}"] input`)!;
      input.value = text; input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
      await new Promise(resolve => setTimeout(resolve)); fixture.detectChanges();
    };
    return {fixture, el, api, click, quantity, rows, picker, editQuantity};
  };
  it('shows the readable name and database/region separately on the main card', () => {
    const {el} = render(), card = el.querySelector('[data-row="73"]')!;
    expect(card.querySelector('h3')?.textContent?.trim()).toBe('Excavadora hidráulica');
    expect(card.querySelector('h3')?.getAttribute('title')).toBe('Excavadora hidráulica (GLO)-Ecoinvent 3');
    expect(card.querySelector('app-source-chip')?.textContent).toContain('ECOINVENT 3');
    expect(card.querySelector('app-region-chip')?.textContent).toContain('Global');
  });
  it('has no editing form: no form, Guardar or Cancelar', () => {
    const {el} = render();
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).not.toContain('Guardar cambios');
    expect(el.textContent).not.toContain('Cancelar');
  });
  it.each([
    ['0.0000000000', '0'],
    ['12.0000000000', '12'],
    ['12.5000000000', '12.5'],
    ['1234567890.1234567890', '1234567890.123456789'],
  ])('displays quantity %s as %s without changing the stored value', (stored, displayed) => {
    const {rows, el, api} = render('construction', stored);
    expect(el.querySelector('[data-row="73"] button.quantity')?.textContent?.trim()).toBe(`${displayed} h`);
    expect(rows[0].quantity).toBe(stored);
    expect(api.update).not.toHaveBeenCalled();
  });
  it('saves a quantity edited in place, in hours (audit A-12)', async () => {
    const {api, editQuantity, rows, el} = render('construction', '10', 2);
    await editQuantity(73, '12,5');
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenLastCalledWith('construction', rows[0], {sourceId: 11, quantity: 12.5, unitId: 2});
    expect(el.querySelector('[data-row="73"] button.quantity')?.textContent?.trim()).toBe('12.5 h');
  });
  it('end of life takes whole numbers only, without writing', async () => {
    const {api, el, editQuantity} = render('end-life');
    await editQuantity(73, '2.5');
    expect(api.update).not.toHaveBeenCalled();
    expect(el.querySelector('[data-row="73"] .quantity__error')?.textContent).toContain('entero');
  });
  it('changes the equipment from its name and saves at once, keeping the stored quantity', async () => {
    const {api, picker, fixture, click, rows} = render();
    rows[0].quantity = '1234567890.1234567890'; fixture.detectChanges();
    await click('[data-replace="73"]');
    expect(picker.choose).toHaveBeenCalledWith({stage: 'construction', section: 'Cimentación', mode: 'replace'});
    expect(api.update.mock.calls.at(-1)?.[2]).toEqual({sourceId: 2, quantity: '1234567890.1234567890', unitId: null});
  });
  it('flags a row captured in another unit, whose number is read as hours (audit A-12)', () => {
    const {el} = render('construction', '10', 2, 3);
    expect(el.querySelector('[data-row="73"] .equipment-unit-alert')).toBeNull();
    expect(el.querySelector('[data-row="74"] .equipment-unit-alert')?.getAttribute('aria-label')).toContain('Capturado en MJ');
  });
  it('keeps the saved value and says so on that card when a save fails; deletion removes exactly one row', async () => {
    const {api, el, click, editQuantity} = render();
    api.remove.mockReturnValueOnce(throwError(() => new Error('offline'))); await click('[data-delete="73"]');
    expect(el.querySelectorAll('.equipment-card')).toHaveLength(2);
    api.update.mockReturnValueOnce(throwError(() => new Error('offline'))); await editQuantity(73, '16');
    expect(el.querySelector('[data-row="73"] [role="alert"]')?.textContent).toContain('No se pudo guardar el equipo. Intenta de nuevo.');
    expect(el.querySelector('[data-row="73"] button.quantity')?.textContent?.trim()).toBe('12.3456789 h');
    await click('[data-delete="73"]');
    expect(el.querySelector('[data-row="73"]')).toBeNull(); expect(el.querySelector('[data-row="74"]')).toBeTruthy();
    expect(api.remove).toHaveBeenCalledWith('construction', 73);
  });
  it('disables names and quantities while a save is pending, and waits for it', async () => {
    const {fixture, api, el, editQuantity} = render(), pending = new Subject<any>(); api.update.mockReturnValue(pending);
    await editQuantity(73, '15');
    expect(el.querySelector<HTMLButtonElement>('[data-replace="74"]')!.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('[data-row="74"] button.quantity')!.disabled).toBe(true);
    let idle = false; const wait = fixture.componentInstance.whenIdle().then(() => {idle = true;});
    await Promise.resolve(); expect(idle).toBe(false);
    pending.next({key: 'construction:73', id: 73, sectionId: 1, sourceId: 11, quantity: 15, unitId: null}); pending.complete();
    await wait; expect(idle).toBe(true);
  });
  it('batch addition creates persisted zero rows in hours', async () => {
    const {api, el, click} = render('construction', '10', 2); await click('.equipment-panel-header button');
    expect(api.create).toHaveBeenCalledWith('construction', 42, 1, {sourceId: 11, quantity: 0, unitId: 2});
    expect(el.querySelector('[data-row="90"] button.quantity')?.textContent).toContain('h');
    expect(el.querySelectorAll('.equipment-card')).toHaveLength(3);
  });
  it('a save finishing after a project change cannot overwrite the new project', async () => {
    const {api, fixture, el, editQuantity} = render(), pending = new Subject<any>(); api.update.mockReturnValue(pending);
    await editQuantity(73, '55'); fixture.componentRef.setInput('projectId', 43); fixture.detectChanges();
    pending.next({key: 'construction:73', id: 73, sectionId: 1, sourceId: 11, quantity: 55, unitId: null}); pending.complete();
    await fixture.componentInstance.whenIdle(); fixture.detectChanges();
    expect(el.querySelector('[data-row="73"] button.quantity')?.textContent).toContain('12.3456789');
  });
  it('discards a superseded project read without replacing the current view', async () => {
    const {api, fixture, el} = render(), stale = new Subject<any>(); api.list.mockReturnValueOnce(stale);
    fixture.componentRef.setInput('projectId', 43); fixture.detectChanges(); fixture.componentRef.setInput('projectId', 44); fixture.detectChanges();
    stale.next({rows: [], rawTotal: 999}); stale.complete(); fixture.detectChanges();
    expect(el.querySelectorAll('.equipment-card')).toHaveLength(2); expect(api.list).toHaveBeenLastCalledWith('construction', 44);
  });
  it('moves keyboard focus to the next card after a deletion', async () => {
    const {el, click} = render();
    el.querySelector<HTMLButtonElement>('[data-delete="73"]')!.focus(); await click('[data-delete="73"]'); TestBed.tick();
    expect(document.activeElement).toBe(el.querySelector('[data-replace="74"]'));
    await click('[data-delete="74"]'); TestBed.tick();
    expect(document.activeElement).toBe(el.querySelector('.equipment-panel-header button'));
  });
  it('keeps list metadata hidden in list view', async () => {
    const {el, click} = render();
    await click('.equipment-view mat-button-toggle:last-child button');
    expect(el.querySelectorAll('app-source-chip, app-region-chip')).toHaveLength(0);
  });
});

// The excavator and the conveyor belt have ecoinvent factors per m³ excavated and per t·km moved.
describe('Equipment measured in its own unit', () => {
  const render = (rowUnitId: number | null = null) => {
    const rows = [{key: 'construction:80', id: 80, sectionId: 1, sourceId: 11, quantity: '120', unitId: rowUnitId}],
     api = {list: vi.fn(() => of({rows, rawTotal: 120})), update: vi.fn((_stage: unknown, row: any, value: any) => of({...row, ...value})), create: vi.fn((_stage: unknown, _project: unknown, sectionId: number, value: any) => of({key: 'construction:91', id: 91, sectionId, ...value})), remove: vi.fn(() => of(undefined))},
     picker = {pickMany: vi.fn(async (context: any) => {const sources = [{id: 12, name: 'Banda transportadora', type: 'Otros', unit: 't·km'}]; await context.save(sources); return sources;}), choose: vi.fn()};
    TestBed.configureTestingModule({imports: [EquipmentStageUiModule], providers: [
      {provide: EquipmentCatalogueService, useValue: {load: () => of({sources: [
        {id: 11, name: 'Excavadora hidráulica (GLO)', displayName: 'Excavadora hidráulica', type: 'Otros', unit: 'm³'},
        {id: 12, name: 'Banda transportadora (GLO)', displayName: 'Banda transportadora', type: 'Otros', unit: 't·km'}],
        units: [{id: 2, name: 'Hrs'}, {id: 3, name: 'MJ'}], unitLabels: [{id: 2, name: 'Hrs'}, {id: 3, name: 'MJ'}], hourUnitId: 2, constructionEnergyProcessId: 8})}},
      {provide: EquipmentRowsService, useValue: api}, {provide: EquipmentPickerService, useValue: picker}]});
    const fixture = TestBed.createComponent(EquipmentStagePanelComponent);
    fixture.componentRef.setInput('projectId', 42); fixture.componentRef.setInput('sectionId', 1); fixture.componentRef.setInput('sectionName', 'Cimentación'); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement,
     click = async (selector: string) => {el.querySelector<HTMLElement>(selector)!.click(); await new Promise(resolve => setTimeout(resolve)); fixture.detectChanges();},
     editQuantity = async (rowId: number, text: string) => {
       el.querySelector<HTMLButtonElement>(`[data-row="${rowId}"] button.quantity`)!.click(); fixture.detectChanges();
       const input = el.querySelector<HTMLInputElement>(`[data-row="${rowId}"] input`)!;
       input.value = text; input.dispatchEvent(new Event('input'));
       input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
       await new Promise(resolve => setTimeout(resolve)); fixture.detectChanges();
     };
    return {el, api, click, editQuantity};
  };

  it('shows m³ instead of hours, and saves no hours unit', async () => {
    const {el, api, editQuantity} = render();
    expect(el.querySelector('[data-row="80"] button.quantity')?.textContent?.trim()).toBe('120 m³');
    expect(el.querySelector('[data-row="80"] button.quantity')?.getAttribute('aria-label')).toContain('m³ excavados');
    await editQuantity(80, '130');
    expect(api.update).toHaveBeenCalledWith('construction', expect.anything(), expect.objectContaining({quantity: 130, unitId: null}));
  });

  it('does not warn that a row saved in another unit is calculated in hours', () => {
    const {el} = render(3);
    expect(el.querySelector('.equipment-unit-alert')).toBeNull();
  });

  it('adds a t·km source without the hours unit', async () => {
    const {el, api, click} = render();
    await click('.equipment-panel-header .equipment-primary');
    expect(api.create).toHaveBeenCalledWith('construction', 42, 1, expect.objectContaining({sourceId: 12, unitId: null}));
    expect(el.querySelector('[data-row="91"] .equipment-quantity')?.textContent).toContain('t·km');
  });
});
