import { TestBed } from '@angular/core/testing';
import { UsageStageUiModule } from '../../usage-stage-ui.module';
import { AnnualConsumptionComponent } from './annual-consumption.component';
import { usageFixture } from '../../testing/usage-fixtures';

describe('Annual consumption presentation', () => {
  it('emits Save and Cancel independently and shows the supplied allocation', () => {
    TestBed.configureTestingModule({imports: [UsageStageUiModule]});
    const fixture = TestBed.createComponent(AnnualConsumptionComponent), component = fixture.componentInstance,
      saved = vi.fn(), cancelled = vi.fn();
    fixture.componentRef.setInput('annual', usageFixture().annual);
    fixture.componentRef.setInput('draft', {quantity: '12000', repairUnit: false, confirmRecalculate: false});
    fixture.componentRef.setInput('assigned', 80); fixture.componentRef.setInput('canonicalUnit', {id: 22, name_unit: 'kWh'});
    component.saveAnnual.subscribe(saved); component.cancelAnnual.subscribe(cancelled); fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    fixture.nativeElement.querySelector('[data-cancel-annual]').click();
    expect(saved).toHaveBeenCalledTimes(1); expect(cancelled).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('80 % asignado');
  });
});
