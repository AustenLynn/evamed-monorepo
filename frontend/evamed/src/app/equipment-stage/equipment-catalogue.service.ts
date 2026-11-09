import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { CatalogsService } from '../core/services/catalogs/catalogs.service';
import { MaterialsService } from '../core/services/materials/materials.service';
import { EquipmentCatalogue, EquipmentStage, EquipmentUnit } from './equipment.models';

export const CONSTRUCTION_ENERGY_PROCESS = 'Energía consumida durante el proceso constructivo';
const normalized = (name: string) => name.trim().toLocaleLowerCase();

@Injectable({ providedIn: 'root' })
export class EquipmentCatalogueService {
  private unitLabels$: Observable<EquipmentUnit[]>;
  constructor(private catalogs: CatalogsService, private materials: MaterialsService) {}

  load(stage: EquipmentStage): Observable<EquipmentCatalogue> {
    if (stage === 'end-life' && !this.unitLabels$) {
      this.unitLabels$ = this.materials.getUnits().pipe(
        map(rows => rows.map(row => ({ id: row.id, name: row.name_unit }))), shareReplay(1)
      );
    }
    return forkJoin({
      sources: this.catalogs.getSourceInformation(),
      energyUnits: this.catalogs.getEnergyUnits(),
      labels: stage === 'end-life' ? this.unitLabels$ : of(null),
      processes: stage === 'construction' ? this.catalogs.getConstructiveProcesses() : of([]),
    }).pipe(map(({ sources, energyUnits, labels, processes }) => {
      const energy: EquipmentUnit[] = energyUnits.map(row => ({ id: row.id, name: row.name_energy_unit })),
       units = stage === 'construction' ? energy : labels.filter(unit => energy.some(e => normalized(e.name) === normalized(unit.name)));
      return {
        sources: sources.filter(row => row.name_source_information !== 'Mexicaniuh - CADIS').map(row => {
          const name = row.name_source_information,
           lower = name.toLowerCase(),
           type = lower.startsWith('generador') ? 'Generador' : lower.includes('carga ligera') ? 'Maquinaria ligera' : lower.includes('carga pesada') ? 'Maquinaria pesada' : 'Otros';
          return { id: row.id, name, type };
        }),
        units, unitLabels: labels ?? energy,
        constructionEnergyProcessId: processes.find(row => row.name_constructive_process === CONSTRUCTION_ENERGY_PROCESS)?.id ?? null,
      };
    }));
  }
}
