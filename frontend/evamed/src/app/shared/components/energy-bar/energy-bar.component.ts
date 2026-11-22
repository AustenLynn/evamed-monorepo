import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CarbonBreakdown, EnergyTotalService } from 'src/app/core/services/energy-total/energy-total.service';

interface EnergyBarView {
  breakdown: CarbonBreakdown;
  productionPct: number;
  constructionPct: number;
  usagePct: number;
  endLifePct: number;
}

@Component({
  selector: 'app-energy-bar',
  templateUrl: './energy-bar.component.html',
  styleUrls: ['./energy-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class EnergyBarComponent {
  // The project's carbon per stage (EnergyTotalService). Totals arrive after the
  // results request returns; the async pipe marks
  // this OnPush component for check whenever a new one comes in.
  readonly view$: Observable<EnergyBarView>;

  constructor(energyTotalService: EnergyTotalService) {
    this.view$ = energyTotalService.breakdown$.pipe(
      map(breakdown => {
        // A stage can be negative (biogenic uptake): segments share the positive stages only;
        // the total keeps the true sum.
        const positive = [breakdown.production, breakdown.construction, breakdown.usage, breakdown.endLife]
            .filter(value => value > 0).reduce((acc, value) => acc + value, 0),
          pct = (part: number) => (positive > 0 && part > 0 ? (part / positive) * 100 : 0);
        return {
          breakdown,
          productionPct: pct(breakdown.production),
          constructionPct: pct(breakdown.construction),
          usagePct: pct(breakdown.usage),
          endLifePct: pct(breakdown.endLife),
        };
      })
    );
  }

  format(val: number): string {
    return val.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  }
}
