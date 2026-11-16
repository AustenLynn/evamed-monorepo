import { TestBed } from '@angular/core/testing';
import { UsageStageUiModule } from '../../usage-stage-ui.module';
import { UsageOption } from '../../usage.models';
import { UsageSourcePickerComponent } from './usage-source-picker.component';

const options: UsageOption[] = [
  {key: 'type:2', selectionId: 2, type: 2, source: 'electric', name: 'Electricidad', rawName: 'Electricidad (MX)', database: 'ECOINVENT 3', region: 'México', supported: true},
  {key: 'type:4', selectionId: 4, type: 4, source: 'fuel', name: 'Gas natural', rawName: 'Gas natural (GLO)', database: null, region: 'Global', supported: true},
  {key: 'panels', selectionId: -1, type: null, source: 'panels', name: 'Fotovoltaicos', rawName: 'Fotovoltaicos', database: null, region: null, supported: true},
];
describe('Usage source picker', () => {
  const render = (mode: 'add' | 'replace' = 'add', selectedKeys: string[] = []) => {
    TestBed.configureTestingModule({imports: [UsageStageUiModule]});
    const fixture = TestBed.createComponent(UsageSourcePickerComponent);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('selectedKeys', selectedKeys);
    fixture.detectChanges();
    return {fixture, picker: fixture.componentInstance, el: fixture.nativeElement as HTMLElement};
  };
  it('preserves selections through filters and excludes saved option keys', () => {
    const {picker} = render('add', ['type:4']);
    picker.pick(options[0]);
    picker.query = {search: 'Fotovoltaicos', filters: {}};
    expect(picker.filtered.map(row => row.key)).toEqual(['panels']);
    expect(picker.selection.map(row => row.key)).toEqual(['type:2']);
    picker.query = {search: '', filters: {}};
    expect(picker.filtered.map(row => row.key)).toEqual(['type:2', 'panels']);
    picker.pick(options[1]);
    expect(picker.selection.map(row => row.key)).toEqual(['type:2']);
  });
  it('retains option DOM identity when the parent refreshes equivalent catalogue objects', () => {
    const {fixture, el} = render();
    const before = el.querySelector('[data-option="type:2"]');
    fixture.componentRef.setInput('options', options.map(option => ({...option}))); fixture.detectChanges();
    expect(el.querySelector('[data-option="type:2"]')).toBe(before);
  });
  it('uses the common shell/filter/tray and includes PV with no invented metadata', () => {
    const {picker, el, fixture} = render();
    expect(el.querySelector('app-ev-menu-shell')).toBeTruthy();
    expect(el.querySelector('app-filter-panel')).toBeTruthy();
    picker.pick(options[2]); fixture.detectChanges();
    const pv = el.querySelector('[data-option="panels"]')!.closest('article')!;
    expect(pv.textContent).toContain('Generación fotovoltaica');
    expect(pv.querySelector('app-source-chip, app-region-chip')).toBeNull();
    const confirm = vi.spyOn(picker.confirm, 'emit');
    picker.submit();
    expect(confirm).toHaveBeenCalledWith([options[2]]);
    expect(confirm.mock.calls[0][0]?.[0].type).toBeNull();
  });
  it('replacement emits one option directly and has no tray', () => {
    const {picker, el} = render('replace'),
     confirm = vi.spyOn(picker.confirm, 'emit');
    expect(el.querySelector('app-ev-selection-tray')).toBeNull();
    picker.pick(options[1]);
    expect(confirm).toHaveBeenCalledWith([options[1]]);
  });
  it('freezes submitted selection and blocks duplicate submit, backdrop and Escape while pending', () => {
    const {picker, fixture, el} = render(),
     confirm = vi.spyOn(picker.confirm, 'emit'), close = vi.spyOn(picker.close, 'emit');
    picker.pick(options[0]); picker.submit(); picker.submit();
    expect(confirm).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('pending', true); fixture.detectChanges();
    picker.pick(options[1]); picker.removeSelection(2); picker.requestClose();
    el.querySelector<HTMLElement>('.usage-picker-backdrop')!.click();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    expect(picker.selection.map(row => row.key)).toEqual(['type:2']);
    expect(close).not.toHaveBeenCalled();
    fixture.componentRef.setInput('pending', false); fixture.detectChanges();
    picker.pick(options[1]);
    expect(picker.selection.map(row => row.key)).toEqual(['type:2', 'type:4']);
    picker.submit(); expect(confirm).toHaveBeenCalledTimes(2);
  });
  it('offers accessible reconciliation inside the locked dialog without changing the submitted selection', () => {
    const {picker, fixture, el} = render(),
     recover = vi.fn();
    fixture.componentRef.setInput('pending', true);
    fixture.componentRef.setInput('error', 'No se pudo confirmar el guardado.');
    fixture.componentRef.setInput('recoveryEnabled', true);
    fixture.detectChanges();
    // Access by DOM so RED verifies the missing user recovery control.
    const button = el.querySelector<HTMLButtonElement>('.usage-recover');
    expect(button).toBeTruthy();
    picker.recover.subscribe(recover);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo confirmar');
    expect(button!.disabled).toBe(false);
    button!.click();
    expect(recover).toHaveBeenCalledTimes(1);
    expect(picker.locked).toBe(true);
    fixture.componentRef.setInput('recoveryEnabled', false); fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('.usage-recover')!.disabled).toBe(true);
  });
  it('keeps editable selection after confirmed failure and closes without writing', () => {
    const {picker, fixture} = render(),
     confirm = vi.spyOn(picker.confirm, 'emit'), close = vi.spyOn(picker.close, 'emit');
    picker.pick(options[0]); picker.submit();
    fixture.componentRef.setInput('pending', true); fixture.detectChanges();
    fixture.componentRef.setInput('pending', false); fixture.detectChanges();
    expect(picker.selection.map(row => row.key)).toEqual(['type:2']);
    picker.requestClose();
    expect(close).toHaveBeenCalledTimes(1); expect(confirm).toHaveBeenCalledTimes(1);
  });
});
