import { Injectable } from '@angular/core';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { CatalogsService } from '../core/services/catalogs/catalogs.service';
import { ConstructionStageService } from '../core/services/construction-stage/construction-stage.service';
import { EndLifeService } from '../core/services/end-life/end-life.service';
import { CONSTRUCTION_ENERGY_PROCESS } from './equipment-catalogue.service';
import { EquipmentInput, EquipmentRow, EquipmentSnapshot, EquipmentStage } from './equipment.models';

@Injectable({ providedIn: 'root' })
export class EquipmentRowsService {
  constructor(private catalogs: CatalogsService, private construction: ConstructionStageService, private endLife: EndLifeService) {}

  private row(stage: EquipmentStage, raw: any): EquipmentRow {
    return { key: `${stage}:${raw.id}`, id: raw.id, sectionId: raw.section_id,
      sourceId: raw.source_information_id, quantity: raw.quantity,
      unitId: (stage === 'construction' ? raw.energy_unit_id : raw.unit_id) ?? null };
  }

  list(stage: EquipmentStage, projectId: number): Observable<EquipmentSnapshot> {
    return forkJoin({
      records: stage === 'construction' ? this.construction.getConstructiveSystemElement() : this.endLife.getECDP(),
      processes: stage === 'construction' ? this.catalogs.getConstructiveProcesses() : of([]),
    }).pipe(map(({ records, processes }) => {
      const projectRows = records.filter(raw => raw.project_id === projectId),
       processId = processes.find(p => p.name_constructive_process === CONSTRUCTION_ENERGY_PROCESS)?.id;
      return {
        rows: projectRows.filter(raw => stage !== 'construction' || raw.constructive_process_id === processId).map(raw => this.row(stage, raw)),
        rawTotal: projectRows.reduce((total, raw) => total + (parseFloat(raw.quantity) || 0), 0),
      };
    }));
  }

  private valid(stage: EquipmentStage, input: EquipmentInput): boolean {
    const quantity = Number(input.quantity);
    return Number.isFinite(quantity) && quantity >= 0 && (stage !== 'end-life' || Number.isInteger(quantity));
  }
  private changes(stage: EquipmentStage, input: EquipmentInput): object {
    return { source_information_id: input.sourceId, quantity: input.quantity,
      ...(stage === 'construction' ? { energy_unit_id: input.unitId } : { unit_id: input.unitId }) };
  }

  create(stage: EquipmentStage, projectId: number, sectionId: number, input: EquipmentInput): Observable<EquipmentRow> {
    if (!this.valid(stage, input)) return throwError(() => new Error('Cantidad inválida'));
    const target = { project_id: projectId, section_id: sectionId, ...this.changes(stage, input) };
    if (stage === 'end-life') return this.endLife.addECDP(target).pipe(map(raw => this.row(stage, raw)));
    return this.catalogs.getConstructiveProcesses().pipe(switchMap(processes => {
      const process = processes.find(p => p.name_constructive_process === CONSTRUCTION_ENERGY_PROCESS);
      if (!process) return throwError(() => new Error('Proceso de energía no disponible'));
      return this.construction.addConstructiveSistemElement({ ...target, constructive_process_id: process.id, volume_unit_id: null, bulk_unit_id: null });
    }), map(raw => this.row(stage, raw)));
  }

  update(stage: EquipmentStage, row: EquipmentRow, input: EquipmentInput): Observable<EquipmentRow> {
    if (!this.valid(stage, input)) return throwError(() => new Error('Cantidad inválida'));
    const request = stage === 'construction'
      ? this.construction.patchConstructiveSystemElement(row.id, this.changes(stage, input))
      : this.endLife.patchECDP(row.id, this.changes(stage, input));
    return request.pipe(map(raw => this.row(stage, raw)));
  }

  remove(stage: EquipmentStage, rowId: number): Observable<void> {
    return (stage === 'construction' ? this.construction.deleteConstructiveSystemElement(rowId) : this.endLife.deleteECDP(rowId)).pipe(map(() => undefined));
  }
}
