import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { finalize, map, shareReplay, tap } from 'rxjs/operators';
import { Calculos } from '../calculos/calculos';
import { AnalisisService } from '../core/services/analisis/analisis.service';
import { ResultsExcluded } from '../home-evamed/components/excluded-notice/excluded-notice.component';

/** A project's results as Resultados uses them, indicator names already adapted. */
export interface ResultadosProyecto {
  datos: Record<string, any>;
  porElemento: Record<string, Record<string, number>> | null;
  porMaterial: { Calculos: Record<string, any>; materiales: Record<string, any> } | null;
  nombresMateriales: Record<string, string>;
  excluded: ResultsExcluded | null;
}

/**
 * Loads GET /projects/<id>/results/?detalle=1 once per project while Resultados is
 * open (A-32 plan, 2026-11-22). The server is the only place results are calculated.
 */
@Injectable({ providedIn: 'root' })
export class ResultadosService {
  private listos = new Map<number, ResultadosProyecto>();
  private enCurso = new Map<number, Observable<ResultadosProyecto>>();

  constructor(private analisis: AnalisisService, private calculos: Calculos) {}

  cargar(projectId: number): Observable<ResultadosProyecto> {
    const listo = this.listos.get(projectId);
    if (listo) return of(listo);
    let pedido = this.enCurso.get(projectId);
    if (!pedido) {
      pedido = this.analisis.getProjectResults(projectId, undefined, true).pipe(
        map(respuesta => this.adaptar(respuesta)),
        tap(resultado => this.listos.set(projectId, resultado)),
        finalize(() => this.enCurso.delete(projectId)),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      this.enCurso.set(projectId, pedido);
    }
    return pedido;
  }

  obtener(projectId: number): ResultadosProyecto | undefined {
    return this.listos.get(projectId);
  }

  olvidar(projectId: number): void {
    this.listos.delete(projectId);
    this.enCurso.delete(projectId);
  }

  private adaptar(respuesta: any): ResultadosProyecto {
    const material = respuesta?.por_material;
    return {
      datos: this.nombres(respuesta?.datos) ?? {},
      porElemento: this.nombres(respuesta?.por_elemento),
      porMaterial: material ? { Calculos: this.nombres(material.Calculos) ?? {}, materiales: this.nombres(material.materiales) ?? {} } : null,
      nombresMateriales: respuesta?.nombres_materiales ?? {},
      excluded: respuesta?.excluded ?? null,
    };
  }

  /** Same names the browser calculation used (calculos.ajustarNombre), so keepIndicators still matches. */
  private nombres<T>(porIndicador: Record<string, T> | undefined | null): Record<string, T> | null {
    if (!porIndicador) return null;
    return Object.fromEntries(Object.entries(porIndicador).map(([k, v]) => [this.calculos.ajustarNombre(k), v]));
  }
}
