import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EnergyTotalService } from 'src/app/core/services/energy-total/energy-total.service';

interface EnergyBreakdown {
  construction: number;
  usage: number;
  endLife: number;
  total: number;
}

interface EnergyBarView {
  breakdown: EnergyBreakdown;
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
  // Totals arrive after the stage pages' requests return; the async pipe marks
  // this OnPush component for check whenever a new one comes in.
  readonly view$: Observable<EnergyBarView>;

  constructor(energyTotalService: EnergyTotalService) {
    this.view$ = energyTotalService.breakdown$.pipe(
      map(breakdown => {
        const pct = (part: number) => (breakdown.total > 0 ? (part / breakdown.total) * 100 : 0);
        return {
          breakdown,
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
