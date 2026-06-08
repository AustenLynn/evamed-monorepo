import { Component, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { EnergyTotalService } from 'src/app/core/services/energy-total/energy-total.service';

interface EnergyBreakdown {
  construction: number;
  usage: number;
  endLife: number;
  total: number;
}

@Component({
  selector: 'app-energy-bar',
  templateUrl: './energy-bar.component.html',
  styleUrls: ['./energy-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class EnergyBarComponent implements OnInit, OnDestroy {
  breakdown: EnergyBreakdown = { construction: 0, usage: 0, endLife: 0, total: 0 };

  constructionPct = 0;
  usagePct        = 0;
  endLifePct      = 0;

  private sub: Subscription;

  constructor(private energyTotalService: EnergyTotalService) {}

  ngOnInit(): void {
    this.sub = this.energyTotalService.breakdown$.subscribe(b => {
      this.breakdown = b;
      if (b.total > 0) {
        this.constructionPct = (b.construction / b.total) * 100;
        this.usagePct        = (b.usage / b.total) * 100;
        this.endLifePct      = (b.endLife / b.total) * 100;
      } else {
        this.constructionPct = 0;
        this.usagePct        = 0;
        this.endLifePct      = 0;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  format(val: number): string {
    return val.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  }
}
