import { Injectable } from '@angular/core';
import { EMPTY, forkJoin, Observable, of } from 'rxjs';
import { expand, map, reduce, shareReplay } from 'rxjs/operators';
import { CatalogsService } from '../core/services/catalogs/catalogs.service';
import { MaterialsService } from '../core/services/materials/materials.service';
import { ExplorerItem } from '../explorer/explorer.models';
import { ExplorerService } from '../explorer/services/explorer.service';
import { EquipmentCatalogue, EquipmentSource, EquipmentStage, EquipmentUnit } from './equipment.models';

export const CONSTRUCTION_ENERGY_PROCESS = 'Energía consumida durante el proceso constructivo';
const normalized = (name: string) => name.trim().toLocaleLowerCase();

@Injectable({ providedIn: 'root' })
export class EquipmentCatalogueService {
  private sources$: Observable<EquipmentSource[]>;
  private unitLabels$: Observable<EquipmentUnit[]>;
  constructor(private catalogs: CatalogsService, private materials: MaterialsService, private explorer: ExplorerService) {}

  load(stage: EquipmentStage): Observable<EquipmentCatalogue> {
    if (!this.sources$) {
      this.sources$ = this.explorer.page('construccion', {search: '', filters: {}}, 1).pipe(
        expand((page, index) => page.next ? this.explorer.page('construccion', {search: '', filters: {}}, index + 2) : EMPTY),
        reduce((items, page) => [...items, ...page.results], [] as ExplorerItem[]),
        map(items => items.filter(item => item.name !== 'Mexicaniuh - CADIS').map(item => ({
          id: item.id, name: item.name, displayName: item.display_name || item.name,
          database: item.source, region: item.region, type: item.type || 'Otros',
        }))), shareReplay(1)
      );
    }
    if (stage === 'end-life' && !this.unitLabels$) {
      this.unitLabels$ = this.materials.getUnits().pipe(
        map(rows => rows.map(row => ({ id: row.id, name: row.name_unit }))), shareReplay(1)
      );
    }
    return forkJoin({
      sources: this.sources$,
      energyUnits: this.catalogs.getEnergyUnits(),
      labels: stage === 'end-life' ? this.unitLabels$ : of(null),
      processes: stage === 'construction' ? this.catalogs.getConstructiveProcesses() : of([]),
    }).pipe(map(({ sources, energyUnits, labels, processes }) => {
      const energy: EquipmentUnit[] = energyUnits.map(row => ({ id: row.id, name: row.name_energy_unit })),
       units = stage === 'construction' ? energy : labels.filter(unit => energy.some(e => normalized(e.name) === normalized(unit.name)));
      return {
        sources,
        units, unitLabels: labels ?? energy,
        constructionEnergyProcessId: processes.find(row => row.name_constructive_process === CONSTRUCTION_ENERGY_PROCESS)?.id ?? null,
      };
    }));
  }
}
