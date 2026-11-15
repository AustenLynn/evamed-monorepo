import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ExplorerQuery, Facets } from '../../explorer/explorer.models';
import { StageFilter } from '../../explorer/stage-config';
import { UsageType } from './usage.models';
import { UsagePickContext } from './usage-picker.service';

const fold = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
@Component({selector: 'app-usage-picker', templateUrl: './usage-picker.component.html',
  styleUrls: ['./usage-picker.component.scss'], standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class UsagePickerComponent implements OnDestroy {
  selected = new Set<number>();
  query: ExplorerQuery = {search: '', filters: {}};
  readonly filters: StageFilter[] = [
    {param: 'source', urlParam: 'base', facet: 'sources', label: 'Base de datos'},
    {param: 'type', urlParam: 'tipo', facet: 'types', label: 'Tipo'},
    {param: 'region', urlParam: 'region', facet: 'regions', label: 'Región'},
  ];
  view = 'cards';
  saving = false;
  failed = false;
  private finishing = false;
  private destroy$ = new Subject<void>();
  constructor(@Inject(MAT_DIALOG_DATA) readonly context: UsagePickContext,
    private ref: MatDialogRef<UsagePickerComponent>, private cdr: ChangeDetectorRef) {
    this.selected = new Set((context.selected || []).filter(id => this.sources.some(source => source.id === id)));
    ref.backdropClick().pipe(takeUntil(this.destroy$)).subscribe(() => this.close());
    ref.keydownEvents().pipe(takeUntil(this.destroy$)).subscribe(event => {
      if (event.key === 'Escape') {event.preventDefault(); this.close();}
    });
  }
  get recovering(): boolean {return this.context.recovering?.() ?? false;}
  get sources(): UsageType[] {
return this.context.catalogue.filter(source => source.family &&
    (this.context.mode === 'replace' || !this.context.excluded.includes(source.id)));
}
  get unclassified(): number {return this.context.catalogue.filter(source => !source.family).length;}
  family(source: UsageType): string {return source.family === 'electric' ? 'Electricidad' : 'Gas';}
  private values(source: UsageType): Record<string, string> {
    return {source: source.database || 'Sin base de datos', type: this.family(source), region: source.region || 'Sin región'};
  }
  private matches(source: UsageType, skip?: string): boolean {
    const words = fold(this.query.search).trim().split(/\s+/).filter(Boolean), values = this.values(source);
    return words.every(word => fold([source.name, source.display_name, source.database, source.region].filter(Boolean).join(' ')).includes(word)) &&
      this.filters.every(filter => filter.param === skip || !this.query.filters[filter.param]?.length || this.query.filters[filter.param].includes(values[filter.param]));
  }
  get filtered(): UsageType[] {return this.sources.filter(source => this.matches(source));}
  get facets(): Facets {
    const facets: Facets = {};
    for (const filter of this.filters) {
      const counts: Record<string, number> = {};
      for (const source of this.sources) {
        const value = this.values(source)[filter.param];
        counts[value] = (counts[value] || 0) + (this.matches(source, filter.param) ? 1 : 0);
      }
      facets[filter.facet] = counts;
    }
    return facets;
  }
  get selection(): UsageType[] {return this.sources.filter(source => this.selected.has(source.id));}
  get selectionItems(): {id: number; name: string}[] {return this.selection.map(source => ({id: source.id, name: source.display_name}));}
  remove(id: number): void {if (!this.saving && !this.recovering) this.selected.delete(id);}
  pick(source: UsageType): void {
    if (this.saving || this.recovering || this.finishing || !this.sources.some(item => item.id === source.id)) return;
    if (this.context.mode === 'replace') {this.finishing = true; this.ref.close(source); return;}
    if (this.selected.has(source.id)) this.selected.delete(source.id); else this.selected.add(source.id);
  }
  async submit(): Promise<void> {
    if (!this.selection.length || this.saving || this.recovering || this.finishing) return;
    this.saving = true; this.failed = false;
    try {
      if (await this.context.save(this.selection)) {this.finishing = true; this.ref.close();} else this.failed = true;
    } catch {this.failed = true;} finally {this.saving = false; this.cdr.markForCheck();}
  }
  close(): void {if (!this.saving && !this.finishing) {this.finishing = true; this.ref.close();}}
  ngOnDestroy(): void {this.destroy$.next(); this.destroy$.complete();}
}
