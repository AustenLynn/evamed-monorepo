import { ExplorerQuery, Facets } from '../explorer/explorer.models';
import { StageFilter } from '../explorer/stage-config';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EquipmentCatalogueService } from './equipment-catalogue.service';
import { EquipmentSource } from './equipment.models';
import { EquipmentPickContext } from './equipment-picker.service';

const fold = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
@Component({selector: 'app-equipment-picker', templateUrl: './equipment-picker.component.html', styleUrls: ['./equipment-picker.component.scss'], standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class EquipmentPickerComponent implements OnDestroy {
  sources: EquipmentSource[] = [];
  selected = new Set<number>();
  added: EquipmentSource[] = [];
  query: ExplorerQuery = {search: '', filters: {}};
  readonly filters: StageFilter[] = [
    {param: 'source', urlParam: 'base', facet: 'sources', label: 'Base de datos'},
    {param: 'type', urlParam: 'tipo', facet: 'types', label: 'Tipo'},
    {param: 'region', urlParam: 'region', facet: 'regions', label: 'Región'},
  ];
  view = 'cards';
  loading = true;
  failed = false;
  failedNames: string[] = [];
  saving = false;
  private finishing = false;
  private destroy$ = new Subject<void>();
  constructor(@Inject(MAT_DIALOG_DATA) readonly context: EquipmentPickContext,
    private ref: MatDialogRef<EquipmentPickerComponent>, private catalogue: EquipmentCatalogueService,
    private cdr: ChangeDetectorRef) {
    ref.backdropClick().pipe(takeUntil(this.destroy$)).subscribe(() => this.close());
    ref.keydownEvents().pipe(takeUntil(this.destroy$)).subscribe(event => {
      if (event.key === 'Escape') {event.preventDefault(); this.close();}
    });
    this.load();
  }
  load(): void {
    this.loading = true; this.failed = false;
    this.catalogue.load(this.context.stage).pipe(takeUntil(this.destroy$)).subscribe({
      next: catalogue => {this.sources = catalogue.sources; this.loading = false; this.cdr.markForCheck();},
      error: () => {this.failed = true; this.loading = false; this.cdr.markForCheck();}
    });
  }
  private matches(source: EquipmentSource, skip?: string): boolean {
    const words = fold(this.query.search).trim().split(/\s+/).filter(Boolean),
     values: Record<string, string> = {source: source.database || 'Sin base de datos', type: source.type, region: source.region || 'Sin región'};
    return words.every(word => fold([source.name, source.displayName, source.database, source.region].filter(Boolean).join(' ')).includes(word)) &&
      this.filters.every(filter => filter.param === skip || !this.query.filters[filter.param]?.length || this.query.filters[filter.param].includes(values[filter.param]));
  }
  get filtered(): EquipmentSource[] {return this.sources.filter(source => this.matches(source));}
  get facets(): Facets {
    const facets: Facets = {};
    for (const filter of this.filters) {
      const counts: Record<string, number> = {};
      for (const source of this.sources) {
        const value = filter.param === 'source' ? source.database || 'Sin base de datos' : filter.param === 'region' ? source.region || 'Sin región' : source.type;
        counts[value] = (counts[value] || 0) + (this.matches(source, filter.param) ? 1 : 0);
      }
      facets[filter.facet] = counts;
    }
    return facets;
  }
  get selectionItems(): {id: number; name: string}[] {return this.selection.map(source => ({id: source.id, name: source.displayName || source.name}));}
  get selection(): EquipmentSource[] {return [...this.selected].map(id => this.sources.find(source => source.id === id)!).filter(Boolean);}
  removeSelection(id: number): void {
    const source = this.sources.find(item => item.id === id);
    if (source) this.pick(source);
  }
  pick(source: EquipmentSource): void {
    if (this.saving || this.finishing) return;
    if (this.context.mode === 'replace') {this.finishing = true; this.ref.close(source); return;}
    if (this.selected.has(source.id)) this.selected.delete(source.id); else this.selected.add(source.id);
  }
  async submit(): Promise<void> {
    if (!this.selected.size || this.saving || this.finishing) return;
    this.saving = true; this.failedNames = [];
    const sources = this.selection,
     saved = this.context.save ? await this.context.save(sources).catch(() => sources.map(() => false)) : sources.map(() => true);
    this.added.push(...sources.filter((_source, i) => saved[i]));
    const failed = sources.filter((_source, i) => !saved[i]);
    this.selected = new Set(failed.map(source => source.id)); this.failedNames = failed.map(source => source.name);
    this.saving = false;
    if (!failed.length) {this.finishing = true; this.ref.close([...this.added]);}
    this.cdr.markForCheck();
  }
  close(): void {
    if (this.saving || this.finishing) return;
    this.finishing = true;
    this.ref.close(this.context.mode === 'add' ? [...this.added] : undefined);
  }
  ngOnDestroy(): void {this.destroy$.next(); this.destroy$.complete();}
}
