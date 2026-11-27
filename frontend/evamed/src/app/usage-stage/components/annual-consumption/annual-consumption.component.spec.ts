import { TestBed } from '@angular/core/testing';
import { UsageStageUiModule } from '../../usage-stage-ui.module';
import { AnnualConsumptionComponent } from './annual-consumption.component';
import { usageFixture } from '../../testing/usage-fixtures';

describe('Annual consumption edited in place', () => {
  const render = (annual = usageFixture().annual, inputs: Record<string, unknown> = {}) => {
    TestBed.configureTestingModule({imports: [UsageStageUiModule]});
    const fixture = TestBed.createComponent(AnnualConsumptionComponent), component = fixture.componentInstance,
      quantities: number[] = [], repairs = vi.fn();
    fixture.componentRef.setInput('annual', annual); fixture.componentRef.setInput('assigned', 80);
    fixture.componentRef.setInput('units', usageFixture().units); fixture.componentRef.setInput('canonicalUnit', {id: 22, name_unit: 'kWh'});
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    component.setQuantity.subscribe(value => quantities.push(value)); component.repairUnit.subscribe(repairs);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement,
      enter = (text: string) => {
        // Opens the cell unless an invalid value already keeps it open.
        el.querySelector<HTMLButtonElement>('button.quantity')?.click(); fixture.detectChanges();
        const input = el.querySelector<HTMLInputElement>('input')!;
        input.value = text; input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true})); fixture.detectChanges();
      };
    return {fixture, el, quantities, repairs, enter};
  };
  it('has no form, Guardar or Cancelar, and keeps the allocation line', () => {
    const {el} = render();
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).not.toContain('Guardar');
    expect(el.textContent).not.toContain('Cancelar');
    expect(el.textContent).toContain('80 % asignado');
    expect(el.querySelector('button.quantity')!.textContent!.trim()).toBe('10000 kWh / año');
  });
  it('saves a whole number at once and rejects decimals', () => {
    const {el, quantities, enter} = render();
    enter('12000,5'); expect(quantities).toEqual([]);
    expect(el.querySelector('.quantity__error')).toBeTruthy();
    enter('12000'); expect(quantities).toEqual([12000]);
  });
  it('asks for a first consumption when there is none', () => {
    const {el, quantities, enter} = render(null);
    expect(el.textContent).toContain('Define el consumo anual para agregar fuentes.');
    expect(el.querySelector('button.quantity')!.textContent!.trim()).toBe('— kWh / año');
    enter('8000'); expect(quantities).toEqual([8000]);
  });
  it('offers a one-click unit repair', () => {
    const {el, repairs} = render({id: 11, quantity: 10000, unit_id: 1});
    expect(el.querySelector('.annual-unit-warning')!.textContent).toContain('Pz');
    el.querySelector<HTMLButtonElement>('[data-repair-annual]')!.click();
    expect(repairs).toHaveBeenCalledTimes(1);
  });
  it('explains that a new consumption recalculates the sources when the saved one is negative', () => {
    const {el} = render({id: 11, quantity: -5, unit_id: 22}, {repairSummary: ['Electricidad: 60 %']});
    expect(el.textContent).toContain('El consumo guardado es negativo. Al guardar el nuevo consumo se recalcularán las fuentes con sus porcentajes guardados.');
    expect(el.textContent).toContain('Electricidad: 60 %');
    expect(el.querySelector('input[type=checkbox], mat-checkbox')).toBeNull();
  });
  it('disables the cell while pending and shows a blocking reason', () => {
    const {el} = render(undefined, {pending: true, blockedReason: 'Hay varios consumos anuales.'});
    expect(el.querySelector<HTMLButtonElement>('button.quantity')!.disabled).toBe(true);
    expect(el.textContent).toContain('Hay varios consumos anuales.');
  });
});
