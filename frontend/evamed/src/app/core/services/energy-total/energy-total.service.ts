import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConstructionStageService } from '../construction-stage/construction-stage.service';
import { ElectricitConsumptionService } from '../electricity-consumption/electricit-consumption.service';
import { EndLifeService } from '../end-life/end-life.service';

@Injectable({ providedIn: 'root' })
export class EnergyTotalService {
  private construction$ = new BehaviorSubject<number>(0);
  private usage$        = new BehaviorSubject<number>(0);
  private endLife$      = new BehaviorSubject<number>(0);

  breakdown$ = combineLatest([this.construction$, this.usage$, this.endLife$]).pipe(
    map(([c, u, e]) => ({
      construction: c,
      usage: u,
      endLife: e,
      total: c + u + e
    }))
  );

  constructor(
    private constructionStageService: ConstructionStageService,
    private electricitConsumptionService: ElectricitConsumptionService,
    private endLifeService: EndLifeService,
  ) {}

  setConstructionTotal(val: number): void { this.construction$.next(val || 0); }
  setUsageTotal(val: number): void        { this.usage$.next(val || 0); }
  setEndLifeTotal(val: number): void      { this.endLife$.next(val || 0); }

  /** Fetches all 3 stages simultaneously and populates the bar.
   *  Call from ngOnInit of any stage component so the full bar is
   *  visible regardless of which route the user opens first. */
  loadAll(): void {
    const projectId = parseInt(localStorage.getItem('idProyectoConstrucción') ?? '', 10);
    if (!Number.isFinite(projectId)) { return; }

    forkJoin([
      this.constructionStageService.getConstructiveSystemElement(),
      this.electricitConsumptionService.getACR(),
      this.endLifeService.getECDP(),
    ]).subscribe(([cseAll, acrAll, ecdpAll]) => {
      const constructionSum = (cseAll as any[])
        .filter(item => item.project_id === projectId)
        .reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0);

      const acrRow = (acrAll as any[]).find(item => item.project_id === projectId);
      const usageSum = parseFloat(acrRow?.quantity ?? '') || 0;

      const endLifeSum = (ecdpAll as any[])
        .filter(item => item.project_id === projectId)
        .reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0);

      this.construction$.next(constructionSum);
      this.usage$.next(usageSum);
      this.endLife$.next(endLifeSum);
    });
  }
}
