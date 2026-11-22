import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { EnergyTotalService } from 'src/app/core/services/energy-total/energy-total.service';
import { SharedModule } from '../../shared.module';
import { EnergyBarComponent } from './energy-bar.component';

// The stage pages push their totals after their own requests return, i.e.
// after the bar has first rendered. The bar is OnPush, so it has to redraw
// when a later total arrives.
describe('EnergyBarComponent', () => {
  it('draws the usage segment when the usage total arrives after the first render', () => {
    const breakdown$ = new BehaviorSubject({ production: 0, construction: 0, usage: 0, endLife: 0, total: 0, unit: 'kg CO2 eq' });
    TestBed.configureTestingModule({
      imports: [SharedModule],
      providers: [{ provide: EnergyTotalService, useValue: { breakdown$ } }],
    });
    const fixture = TestBed.createComponent(EnergyBarComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.segment.usage')).toBeNull();

    breakdown$.next({ production: 0, construction: 30, usage: 70, endLife: 0, total: 100, unit: 'kg CO2 eq' });
    fixture.detectChanges();

    const usage: HTMLElement = fixture.nativeElement.querySelector('.segment.usage');
    expect(usage).not.toBeNull();
    expect(usage.style.width).toBe('70%');
    expect(fixture.nativeElement.querySelector('.energy-bar-total').textContent).toContain('100');
  });

  it('shows production and the carbon unit; a negative stage gets no segment but counts in the total', () => {
    const breakdown$ = new BehaviorSubject({
      production: 900, construction: 100, usage: 0, endLife: -50, total: 950, unit: 'kg CO2 eq',
    });
    TestBed.configureTestingModule({
      imports: [SharedModule],
      providers: [{ provide: EnergyTotalService, useValue: { breakdown$ } }],
    });
    const fixture = TestBed.createComponent(EnergyBarComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.legend-item.production')?.textContent).toContain('Producción');
    expect((el.querySelector('.segment.production') as HTMLElement).style.width).toBe('90%');
    expect((el.querySelector('.segment.construction') as HTMLElement).style.width).toBe('10%');
    expect(el.querySelector('.segment.end-life')).toBeNull();
    expect(el.querySelector('.energy-bar-total')!.textContent).toContain('950');
    expect(el.querySelector('.energy-bar-total')!.textContent).toContain('kg CO2 eq');
  });
});
