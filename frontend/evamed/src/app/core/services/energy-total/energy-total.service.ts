import { Injectable } from '@angular/core';
import { BehaviorSubject, EMPTY, merge, Observable, Subject } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { AnalisisService } from '../analisis/analisis.service';
import { ProjectSavesService } from './project-saves.service';

/** The project's carbon (GWP-total, or PCG 100 under CML) per life-cycle stage. */
export interface CarbonBreakdown {
  production: number;
  construction: number;
  usage: number;
  endLife: number;
  total: number;
  unit: string;
}

const EMPTY_BREAKDOWN: CarbonBreakdown = {
    production: 0, construction: 0, usage: 0, endLife: 0, total: 0, unit: 'kg CO2 eq',
  },
  sumStage = (stage: Record<string, number> | undefined) =>
  Object.values(stage ?? {}).reduce((acc, value) => acc + (Number(value) || 0), 0);

export function toCarbonBreakdown(results: any): CarbonBreakdown {
  const carbono = results?.carbono,
    stages = carbono ? results?.datos?.[carbono.name] : undefined;
  if (!stages) return { ...EMPTY_BREAKDOWN, unit: carbono?.unit ?? EMPTY_BREAKDOWN.unit };
  const production = sumStage(stages['Producción']),
    construction = sumStage(stages['Construccion']),
    usage = sumStage(stages['Uso']),
    endLife = sumStage(stages['FinDeVida']);
  return {
    production, construction, usage, endLife,
    total: production + construction + usage + endLife,
    unit: carbono.unit ?? EMPTY_BREAKDOWN.unit,
  };
}

/**
 * Feeds the stage pages' bar with the project's carbon per stage, from the same server
 * calculation as Resultados (/projects/<id>/results/). It reloads on loadAll() and after
 * every confirmed save (ProjectSavesInterceptor), so what is shown is always what is stored.
 */
@Injectable({ providedIn: 'root' })
export class EnergyTotalService {
  private projectId: number | null = null;
  private readonly reloads = new Subject<void>();
  private readonly state = new BehaviorSubject<CarbonBreakdown>(EMPTY_BREAKDOWN);
  readonly breakdown$: Observable<CarbonBreakdown> = this.state.asObservable();

  constructor(private analisis: AnalisisService, saves: ProjectSavesService) {
    merge(this.reloads, saves.saved$).pipe(
      debounceTime(300),
      switchMap(() => {
        const projectId = this.projectId;
        if (projectId === null) return EMPTY;
        return this.analisis.getProjectResults(projectId).pipe(
          map(results => ({ projectId, breakdown: toCarbonBreakdown(results) })),
          catchError(() => EMPTY)
        );
      })
    ).subscribe(({ projectId, breakdown }) => {
      if (projectId === this.projectId) this.state.next(breakdown);
    });
  }

  /** Call from ngOnInit of any stage page so the bar shows the open project. */
  loadAll(explicitProjectId?: number): void {
    const projectId = explicitProjectId ?? parseInt(localStorage.getItem('idProyectoConstrucción') ?? '', 10);
    if (!Number.isFinite(projectId)) return;
    if (projectId !== this.projectId) this.state.next(EMPTY_BREAKDOWN);
    this.projectId = projectId;
    this.reloads.next();
  }

  /** A stage's saved data changed: reload the totals from the server. */
  refresh(): void {
    this.reloads.next();
  }
}
