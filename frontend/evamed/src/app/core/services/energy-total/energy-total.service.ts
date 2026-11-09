import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConstructionStageService } from '../construction-stage/construction-stage.service';
import { ElectricitConsumptionService } from '../electricity-consumption/electricit-consumption.service';
import { EndLifeService } from '../end-life/end-life.service';

@Injectable({ providedIn: 'root' })
export class EnergyTotalService {
  private construction$ = new BehaviorSubject<number>(0);
  private usage$ = new BehaviorSubject<number>(0);
  private endLife$ = new BehaviorSubject<number>(0);

  private loadVersion = 0;
  private revisions = {construction: 0, usage: 0, endLife: 0};

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

  setConstructionTotal(val: number): void { this.revisions.construction++; this.construction$.next(val || 0); }
  setUsageTotal(val: number): void { this.revisions.usage++; this.usage$.next(val || 0); }
  setEndLifeTotal(val: number): void { this.revisions.endLife++; this.endLife$.next(val || 0); }

  /** Fetches all 3 stages simultaneously and populates the bar.
   *  Call from ngOnInit of any stage component so the full bar is
   *  visible regardless of which route the user opens first. */
  loadAll(explicitProjectId?: number): void {
    const projectId = explicitProjectId ?? parseInt(localStorage.getItem('idProyectoConstrucción') ?? '', 10);
    if (!Number.isFinite(projectId)) { return; }

    const version = ++this.loadVersion, revisions = {...this.revisions};
    forkJoin([
      this.constructionStageService.getConstructiveSystemElement(),
      this.electricitConsumptionService.getACR(),
      this.endLifeService.getECDP(),
    ]).subscribe(([cseAll, acrAll, ecdpAll]) => {
      if (version !== this.loadVersion) return;
      const constructionSum = (cseAll as any[])
        .filter(item => item.project_id === projectId)
        .reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0),

       acrRow = (acrAll as any[]).find(item => item.project_id === projectId),
       usageSum = parseFloat(acrRow?.quantity ?? '') || 0,

       endLifeSum = (ecdpAll as any[])
        .filter(item => item.project_id === projectId)
        .reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0);

      if (revisions.construction === this.revisions.construction) this.construction$.next(constructionSum);
      if (revisions.usage === this.revisions.usage) this.usage$.next(usageSum);
      if (revisions.endLife === this.revisions.endLife) this.endLife$.next(endLifeSum);
    });
  }
}
