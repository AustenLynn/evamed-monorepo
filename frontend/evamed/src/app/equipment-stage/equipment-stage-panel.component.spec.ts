import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { EquipmentStageUiModule } from './equipment-stage-ui.module';
import { EquipmentStagePanelComponent } from './equipment-stage-panel.component';
import { EquipmentCatalogueService } from './equipment-catalogue.service';
import { EquipmentRowsService } from './equipment-rows.service';
import { EquipmentPickerService } from './equipment-picker.service';

describe('Equipment cards', () => {
  const render = (stage = 'construction', initialQuantity = '12.3456789') => {
    const rows = [{key: 'construction:73', id: 73, sectionId: 1, sourceId: 11, quantity: initialQuantity, unitId: null}, {key: 'construction:74', id: 74, sectionId: 1, sourceId: 11, quantity: 8, unitId: 2}, {key: 'construction:75', id: 75, sectionId: 2, sourceId: 11, quantity: 3, unitId: 2}];
    let nextId = 90;
    const picker = {pickMany: vi.fn(async (context: any) => {const sources = [{id: 11, name: 'Excavadora hidráulica', type: 'Otros'}], saved = await context.save(sources); return sources.filter((_s, i) => saved[i]);}), choose: vi.fn(async () => ({id: 2, name: 'Generador diésel', type: 'Generador'}))},
     api = {list: vi.fn(() => of({rows, rawTotal: 23.3456789})), update: vi.fn((_stage: unknown, row: any, value: any) => of({...row, ...value})), create: vi.fn((_stage: unknown, _project:unknown, sectionId:number, value:any) => of({key: 'construction:' + nextId, id: nextId++, sectionId, ...value})), remove: vi.fn(() => of(undefined))};
    TestBed.configureTestingModule({imports: [EquipmentStageUiModule], providers: [
      {provide: EquipmentCatalogueService, useValue: {load: ()=>of({sources: [{id: 11, name: 'Excavadora hidráulica', type: 'Otros'}, {id: 2, name: 'Generador diésel', type: 'Generador'}], units: [{id: 2, name: 'Hrs'}], unitLabels: [{id: 2, name: 'Hrs'}], constructionEnergyProcessId: 8})}},
      {provide: EquipmentRowsService, useValue: api}, {provide: EquipmentPickerService, useValue: picker}
    ]});
    const fixture = TestBed.createComponent(EquipmentStagePanelComponent); fixture.componentRef.setInput('stage', stage);fixture.componentRef.setInput('projectId', 42);fixture.componentRef.setInput('sectionId', 1);fixture.componentRef.setInput('sectionName', 'Cimentación');fixture.detectChanges();
    const el:HTMLElement = fixture.nativeElement,
     click = async (selector:string)=>{const node = el.querySelector<HTMLElement>(selector);expect(node, selector).toBeTruthy();node!.click();await new Promise(resolve=>setTimeout(resolve));fixture.detectChanges();},
     quantity = (value:string)=>{const input = el.querySelector<HTMLInputElement>('input[name="quantity"]')!;input.value = value;input.dispatchEvent(new Event('input'));fixture.detectChanges();};
    return {fixture, el, api, click, quantity, rows, picker};
  };
  it.each([
    ['0.0000000000', '0'],
    ['12.0000000000', '12'],
    ['12.5000000000', '12.5'],
    ['1234567890.1234567890', '1234567890.123456789'],
  ])('displays quantity %s as %s without changing the stored value', (stored, displayed) => {
    const {rows, el, api} = render('construction', stored);
    expect(el.querySelector('[data-row="73"] .equipment-quantity')?.firstChild?.textContent?.trim()).toBe(displayed);
    expect(rows[0].quantity).toBe(stored);
    expect(api.update).not.toHaveBeenCalled();
  });
  it('expands inside only the selected card and preserves distinct rows of the same source', async ()=>{
    const {el, api, click} = render();expect(el.querySelectorAll('.equipment-card')).toHaveLength(2);
    expect(el.textContent).toContain('Sin unidad');await click('[data-edit="73"]');
    expect(el.querySelector('[data-row="73"] form')).toBeTruthy();expect(el.querySelector('[data-row="74"] form')).toBeNull();
    await click('.equipment-cancel');expect(el.querySelector('form')).toBeNull();expect(api.update).not.toHaveBeenCalled();
  });
  it('saves a decimal comma and permits blank unit/quantity without replacing the row', async ()=>{
    const {api, click, quantity, rows} = render();await click('[data-edit="73"]');quantity('12,5');await click('.equipment-save');
    expect(api.update).toHaveBeenLastCalledWith('construction', rows[0], {sourceId: 11, quantity: 12.5, unitId: null});
    await click('[data-edit="73"]');quantity('');await click('.equipment-save');
    expect(api.update.mock.calls.at(-1)?.[2]).toEqual({sourceId: 11, quantity: 0, unitId: null});expect(api.create).not.toHaveBeenCalled();
  });
  it('preserves edit drafts across cards and elements, but clears them when the project changes', async ()=>{
    const {fixture, el, click, quantity, api} = render();await click('[data-edit="73"]');quantity('17');await click('[data-edit="74"]');await click('[data-edit="73"]');expect(el.querySelector<HTMLInputElement>('input[name="quantity"]')!.value).toBe('17');
    fixture.componentRef.setInput('sectionId', 2);fixture.detectChanges();fixture.componentRef.setInput('sectionId', 1);fixture.detectChanges();await click('[data-edit="73"]');expect(el.querySelector<HTMLInputElement>('input[name="quantity"]')!.value).toBe('17');expect(api.update).not.toHaveBeenCalled();
    fixture.componentRef.setInput('projectId', 43);fixture.detectChanges();await click('[data-edit="73"]');expect(el.querySelector<HTMLInputElement>('input[name="quantity"]')!.value).toBe('12.3456789');
  });
  it('keeps rows and editable values when save/delete fail; removes exactly one selected ID on success', async ()=>{
    const {api, el, click, quantity} = render();api.remove.mockReturnValueOnce(throwError(()=>new Error('offline')));await click('[data-delete="73"]');expect(el.querySelectorAll('.equipment-card')).toHaveLength(2);
    api.update.mockReturnValueOnce(throwError(()=>new Error('offline')));await click('[data-edit="73"]');quantity('16');await click('.equipment-save');expect(el.querySelector('form')).toBeTruthy();expect(el.textContent).toContain('No se pudo');
    await click('[data-delete="73"]');expect(el.querySelector('[data-row="73"]')).toBeNull();expect(el.querySelector('[data-row="74"]')).toBeTruthy();expect(api.remove).toHaveBeenCalledWith('construction', 73);
  });
  it('waits for a pending write and ignores repeated saves', async ()=>{
    const {fixture, api, click, quantity} = render(), pending = new Subject<any>();api.update.mockReturnValue(pending);await click('[data-edit="73"]');quantity('15');await click('.equipment-save');await click('.equipment-save');expect(api.update).toHaveBeenCalledTimes(1);
    let idle = false;const wait = fixture.componentInstance.whenIdle().then(()=>{idle = true;});await Promise.resolve();expect(idle).toBe(false);pending.next({key: 'construction:73', id: 73, sectionId: 1, sourceId: 11, quantity: 15, unitId: null});pending.complete();await wait;expect(idle).toBe(true);
  });
  it('batch addition creates persisted zero/null rows without asking for units', async ()=>{
    const {api, el, click} = render();await click('.equipment-panel-header button');
    expect(api.create).toHaveBeenCalledWith('construction', 42, 1, {sourceId: 11, quantity: 0, unitId: null});
    expect(el.querySelector('[data-row="90"]')?.textContent).toContain('Sin unidad');
    expect(el.querySelectorAll('.equipment-card')).toHaveLength(3);
  });
  it('replacement keeps quantity and blank unit in a draft until Save, and Cancel restores the source', async ()=>{
    const {api, el, click, quantity} = render();await click('[data-edit="73"]');quantity('16');await click('.equipment-replace');
    expect(el.querySelector('.equipment-draft-name')?.textContent).toContain('Generador');
    expect(el.querySelector<HTMLInputElement>('input[name="quantity"]')!.value).toBe('16');expect(api.update).not.toHaveBeenCalled();
    await click('.equipment-cancel');await click('[data-edit="73"]');expect(el.querySelector('.equipment-draft-name')?.textContent).toContain('Excavadora');
  });
  it('a mutation finishing after a project change cannot overwrite the new project', async ()=>{
    const {api, fixture, el, click, quantity} = render(), pending = new Subject<any>();api.update.mockReturnValue(pending);
    await click('[data-edit="73"]');quantity('55');await click('.equipment-save');fixture.componentRef.setInput('projectId', 43);fixture.detectChanges();
    pending.next({key: 'construction:73', id: 73, sectionId: 1, sourceId: 11, quantity: 55, unitId: null});pending.complete();await fixture.componentInstance.whenIdle();fixture.detectChanges();
    expect(el.querySelector('[data-row="73"] .equipment-quantity')?.textContent).toContain('12.3456789');
  });
  it('discards a superseded project read without replacing the current view', async ()=>{
    const {api, fixture, el} = render(), stale = new Subject<any>();api.list.mockReturnValueOnce(stale);
    fixture.componentRef.setInput('projectId', 43);fixture.detectChanges();fixture.componentRef.setInput('projectId', 44);fixture.detectChanges();
    stale.next({rows: [], rawTotal: 999});stale.complete();fixture.detectChanges();
    expect(el.querySelectorAll('.equipment-card')).toHaveLength(2);expect(api.list).toHaveBeenLastCalledWith('construction', 44);
  });
  it('preserves full stored decimal precision when only the source changes', async () => {
    const {api, fixture, click, rows} = render();
    rows[0].quantity = '1234567890.1234567890'; fixture.detectChanges();
    await click('[data-edit="73"]'); await click('.equipment-replace'); await click('.equipment-save');
    expect(api.update.mock.calls.at(-1)?.[2]).toEqual({sourceId: 2, quantity: '1234567890.1234567890', unitId: null});
  });
  it('returns keyboard focus after save, cancel, and deletion', async () => {
    const {el, click, quantity} = render();
    await click('[data-edit="73"]'); el.querySelector<HTMLInputElement>('input[name="quantity"]')!.focus(); quantity('18');
    await click('.equipment-save'); TestBed.tick();
    expect(document.activeElement).toBe(el.querySelector('[data-edit="73"]'));
    await click('[data-edit="73"]'); el.querySelector<HTMLInputElement>('input[name="quantity"]')!.focus();
    await click('.equipment-cancel'); TestBed.tick(); expect(document.activeElement).toBe(el.querySelector('[data-edit="73"]'));
    el.querySelector<HTMLButtonElement>('[data-delete="73"]')!.focus(); await click('[data-delete="73"]'); TestBed.tick();
    expect(document.activeElement).toBe(el.querySelector('[data-edit="74"]'));
    await click('[data-delete="74"]'); TestBed.tick();
    expect(document.activeElement).toBe(el.querySelector('.equipment-panel-header button'));
  });
  it('rejects negative quantities and fractional end-life values without writing', async ()=>{
    const {api, el, click, quantity} = render('end-life');await click('[data-edit="73"]');quantity('-1');await click('.equipment-save');expect(api.update).not.toHaveBeenCalled();quantity('12,5');await click('.equipment-save');expect(api.update).not.toHaveBeenCalled();expect(el.querySelector('[role="alert"]')).toBeTruthy();
  });
});
