import { TestBed } from '@angular/core/testing';
import { UsageStageUiModule } from '../../usage-stage-ui.module';
import { UsageSourcePanelComponent } from './usage-source-panel.component';
import { usageFixture } from '../../testing/usage-fixtures';
import { UsageOption } from '../../usage.models';

const options: UsageOption[] = [
  {key: 'type:2', selectionId: 2, type: 2, source: 'electric', name: 'Energía eléctrica, Medio voltaje', rawName: 'Electricidad', database: 'ECOINVENT 3', region: 'México', supported: true},
  {key: 'type:11', selectionId: 11, type: 11, source: 'fuel', name: 'Calefacción doméstica con gas natural', rawName: 'Gas', database: null, region: 'Global', supported: true},
  {key: 'panels', selectionId: -1, type: null, source: 'panels', name: 'Paneles fotovoltaicos', rawName: 'Paneles fotovoltaicos', database: null, region: null, supported: true},
];
describe('Usage sources edited in place', () => {
  const render = (rows = usageFixture().sources) => {
    TestBed.configureTestingModule({imports: [UsageStageUiModule]});
    const fixture = TestBed.createComponent(UsageSourcePanelComponent), state = usageFixture();
    fixture.componentRef.setInput('rows', rows); fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('units', state.units); fixture.componentRef.setInput('canonicalUnit', state.units[0]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    return {fixture, component: fixture.componentInstance, el};
  };
  it('has no editing form: no form, Guardar, Cancelar or Cambiar fuente button', () => {
    const {el} = render();
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).not.toContain('Guardar cambios');
    expect(el.textContent).not.toContain('Cancelar');
    expect(el.querySelector('.usage-replace')).toBeNull();
  });
  it('edits the percentage in place and emits it', () => {
    const {fixture, component, el} = render(), changes: unknown[] = [];
    component.setPercentage.subscribe(change => changes.push(change));
    const cell = el.querySelector<HTMLButtonElement>('[data-row="21"] button.quantity')!;
    expect(cell.textContent!.trim()).toBe('60 %');
    cell.click(); fixture.detectChanges();
    const input = el.querySelector<HTMLInputElement>('[data-row="21"] input')!;
    input.value = '101'; input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true})); fixture.detectChanges();
    expect(changes).toEqual([]);
    input.value = '30'; input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    expect(changes).toEqual([{id: 21, percentage: 30}]);
  });
  it('changes the source from its name, and deletes exactly one row', () => {
    const {component, el} = render(), replaced: number[] = [], removed: number[] = [];
    component.replaceSource.subscribe(id => replaced.push(id)); component.removeSource.subscribe(id => removed.push(id));
    el.querySelector<HTMLButtonElement>('[data-replace="22"]')!.click();
    el.querySelector<HTMLButtonElement>('[data-row="21"] .usage-card-footer button')!.click();
    expect(replaced).toEqual([22]); expect(removed).toEqual([21]);
  });
  it('shows the yearly quantity and offers a one-click unit repair', () => {
    const rows = usageFixture().sources; rows[1] = {...rows[1], unit_id: 1};
    const {component, el} = render(rows), repairs: number[] = [];
    component.repairUnit.subscribe(id => repairs.push(id));
    expect(el.querySelector('[data-row="21"] .usage-quantity')!.textContent).toContain('6000');
    expect(el.querySelector('[data-row="21"] [data-repair]')).toBeNull();
    expect(el.querySelector('[data-row="22"] .usage-unit-warning')!.textContent).toContain('Pz');
    el.querySelector<HTMLButtonElement>('[data-row="22"] [data-repair]')!.click();
    expect(repairs).toEqual([22]);
  });
  it('disables names, percentages and repairs while pending', () => {
    const {fixture, el} = render();
    fixture.componentRef.setInput('pending', true); fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('[data-replace="21"]')!.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('[data-row="21"] button.quantity')!.disabled).toBe(true);
  });
  it('keeps list metadata hidden in list view and shows each share', () => {
    const {fixture, el} = render();
    el.querySelector<HTMLButtonElement>('.usage-view mat-button-toggle:last-child button')!.click(); fixture.detectChanges();
    expect(el.querySelectorAll('app-source-chip, app-region-chip')).toHaveLength(0);
    expect(el.querySelector('[data-row="21"] button.quantity')!.textContent).toContain('60 %');
  });
  it('keeps the card hierarchy and one Add Source action', () => {
    const {el} = render(), buttons = [...el.querySelectorAll('.usage-panel-header button')] as HTMLButtonElement[];
    expect(buttons).toHaveLength(1); expect(buttons[0].textContent).toContain('Agregar fuente');
    expect(el.querySelectorAll('[data-row]')).toHaveLength(2);
  });
  it('shows photovoltaic generation without fabricated metadata', () => {
    const {el} = render([{...usageFixture().sources[0], id: 23, source: 'panels', type: null}]);
    expect(el.textContent).toContain('Paneles fotovoltaicos');
    expect(el.querySelector('app-source-chip,app-region-chip')).toBeNull();
  });
  it('keeps one Add Source action in the empty state', () => {
    const {el} = render([]);
    const buttons = [...el.querySelectorAll('button')].filter(button => button.textContent!.includes('Agregar fuente'));
    expect(buttons).toHaveLength(1);
  });
  it('shows a failed save or delete message on its card', () => {
    const {fixture, el} = render();
    fixture.componentRef.setInput('errors', new Map([[21, 'No se pudo eliminar la fuente.']])); fixture.detectChanges();
    expect(el.querySelector('[data-row="21"] [role=alert]')?.textContent).toContain('No se pudo eliminar');
  });
});
