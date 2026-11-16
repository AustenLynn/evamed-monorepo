import { Injectable } from '@angular/core';
import { ExplorerQuery, Facets } from '../../explorer/explorer.models';
import { StageFilter } from '../../explorer/stage-config';
import { UsageOption } from '../usage.models';

const fold = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
@Injectable({providedIn: 'root'})
export class UsagePickerService {
  readonly filters: StageFilter[] = [
    {param: 'source', urlParam: 'base', facet: 'sources', label: 'Base de datos'},
    {param: 'region', urlParam: 'region', facet: 'regions', label: 'Región'},
  ];
  private value(option: UsageOption, param: string): string {
    if (option.source === 'panels') return 'No aplica';
    return param === 'source' ? option.database || 'Sin base de datos' : option.region || 'Sin región';
  }
  matches(option: UsageOption, query: ExplorerQuery, skip?: string): boolean {
    const searchable = fold([option.name, option.rawName, option.database, option.region,
      option.source === 'panels' ? 'Generación fotovoltaica' : ''].filter(Boolean).join(' '));
    return fold(query.search).trim().split(/\s+/).filter(Boolean).every(word => searchable.includes(word)) &&
      this.filters.every(filter => filter.param === skip || !query.filters[filter.param]?.length ||
        query.filters[filter.param].includes(this.value(option, filter.param)));
  }
  facets(options: UsageOption[], query: ExplorerQuery): Facets {
    const facets: Facets = {};
    for (const filter of this.filters) {
      const counts: Record<string, number> = {};
      for (const option of options) {
        const value = this.value(option, filter.param);
        counts[value] = (counts[value] || 0) + (this.matches(option, query, filter.param) ? 1 : 0);
      }
      facets[filter.facet] = counts;
    }
    return facets;
  }
}
