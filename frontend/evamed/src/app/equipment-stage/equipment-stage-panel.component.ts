import { afterNextRender, ElementRef, Injector, ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { firstValueFrom, forkJoin, Observable, Subscription } from 'rxjs';
import { EquipmentCatalogueService } from './equipment-catalogue.service';
import { EquipmentRowsService } from './equipment-rows.service';
import { EquipmentCatalogue, EquipmentDraft, EquipmentInput, EquipmentRow, EquipmentSource, EquipmentStage } from './equipment.models';
import { EquipmentPickerService } from './equipment-picker.service';

@Component({selector: 'app-equipment-stage-panel', templateUrl: './equipment-stage-panel.component.html', styleUrls: ['./equipment-stage-panel.component.scss'], standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class EquipmentStagePanelComponent implements OnChanges, OnDestroy {
  @Input() stage: EquipmentStage = 'construction';
  @Input() projectId = 0;
  @Input() sectionId = 0;
  @Input() sectionName = '';
  @Output() totalChange = new EventEmitter<number>();
  @Output() pendingChange = new EventEmitter<boolean>();
  rows: EquipmentRow[] = [];
  catalogue: EquipmentCatalogue = {sources: [], units: [], unitLabels: [], constructionEnergyProcessId: null};
  expanded: string | null = null;
  view = 'cards';
  loading = true;
  error = '';
  loadFailed = false;
  private identity = '';
  private rawTotal = 0;
  private drafts = new Map<string, EquipmentDraft>();
  private tasks = new Set<Promise<unknown>>();
  private read?: Subscription;
  private destroyed = false;
  constructor(private api: EquipmentRowsService, private catalogues: EquipmentCatalogueService,
    private picker: EquipmentPickerService, private cdr: ChangeDetectorRef,
    private host: ElementRef<HTMLElement>, private injector: Injector) {}
  ngOnChanges(): void {
    const identity = `${this.stage}:${this.projectId}`;
    this.expanded = null;
    if (this.identity !== identity) {
      this.identity = identity; this.drafts.clear(); this.rows = []; this.error = ''; this.load();
    }
  }
  get visibleRows(): EquipmentRow[] {return this.rows.filter(row => row.sectionId === this.sectionId);}
  get busy(): boolean {return this.tasks.size > 0;}
  load(): void {
    this.read?.unsubscribe();
    if (!Number.isFinite(this.projectId) || this.projectId <= 0) {this.loading = false; return;}
    this.loading = true; this.loadFailed = false;
    const identity = this.identity;
    this.read = forkJoin({catalogue: this.catalogues.load(this.stage), snapshot: this.api.list(this.stage, this.projectId)}).subscribe({
      next: ({catalogue, snapshot}) => {
        if (identity !== this.identity) return;
        this.catalogue = catalogue; this.rows = snapshot.rows; this.rawTotal = snapshot.rawTotal;
        this.loading = false; this.totalChange.emit(this.rawTotal); this.mark();
      },
      error: () => {if (identity === this.identity) {this.loading = false; this.loadFailed = true; this.mark();}}
    });
  }
  sourceName(id: number | null): string {return this.catalogue.sources.find(source => source.id === id)?.name ?? 'Fuente no disponible';}
  unitName(id: number | null): string {return id === null ? 'Sin unidad' : this.catalogue.unitLabels.find(unit => unit.id === id)?.name ?? 'Unidad no disponible';}
  legacyUnit(row: EquipmentRow): boolean {return row.unitId !== null && !this.catalogue.units.some(unit => unit.id === row.unitId);}
  draftFor(row: EquipmentRow): EquipmentDraft {
    let draft = this.drafts.get(row.key);
    if (!draft) {draft = {sourceId: row.sourceId, quantity: row.quantity, unitId: row.unitId}; this.drafts.set(row.key, draft);}
    return draft;
  }
  edit(row: EquipmentRow): void {
    if (this.busy) return;
    this.error = ''; this.expanded = this.expanded === row.key ? null : row.key; this.draftFor(row);
  }
  cancel(row: EquipmentRow): void {if (!this.busy) {this.drafts.delete(row.key); this.expanded = null; this.error = ''; this.focusRow(row.id);}}
  private input(row: EquipmentRow): EquipmentInput | null {
    const draft = this.draftFor(row), text = String(draft.quantity ?? '').trim().replace(',', '.'), quantity = text === '' ? 0 : Number(text);
    if (!Number.isFinite(quantity) || quantity < 0 || (this.stage === 'end-life' && !Number.isInteger(quantity))) {
      this.error = this.stage === 'end-life' ? 'Introduce una cantidad entera igual o mayor a cero.' : 'Introduce una cantidad igual o mayor a cero.';
      return null;
    }
    if (!draft.sourceId || !Number.isFinite(draft.sourceId)) {this.error = 'Selecciona un equipo.'; return null;}
    if (draft.unitId !== null && draft.unitId !== row.unitId && !this.catalogue.units.some(unit => unit.id === draft.unitId)) {
      this.error = 'Selecciona una unidad disponible.'; return null;
    }
    return {sourceId: draft.sourceId, quantity: typeof row.quantity === 'string' && draft.quantity === row.quantity ? row.quantity : quantity, unitId: draft.unitId};
  }
  async save(row: EquipmentRow): Promise<void> {
    if (this.busy) return;
    this.error = '';
    const input = this.input(row); if (!input) return;
    const stage = this.stage, identity = this.identity;
    try {
      const saved = await this.track(this.api.update(stage, row, input));
      if (identity !== this.identity) return;
      this.rows = this.rows.map(current => current.id === row.id ? {...saved, key: row.key} : current);
      this.rawTotal += Number(saved.quantity ?? 0) - Number(row.quantity ?? 0);
      this.drafts.delete(row.key); this.expanded = null; this.totalChange.emit(this.rawTotal); this.focusRow(row.id);
    } catch {if (identity === this.identity) this.error = 'No se pudo guardar el equipo. Intenta de nuevo.';}
    this.mark();
  }
  async remove(row: EquipmentRow): Promise<void> {
    if (this.busy) return;
    const stage = this.stage, identity = this.identity; this.error = '';
    try {
      await this.track(this.api.remove(stage, row.id));
      if (identity !== this.identity) return;
      this.rows = this.rows.filter(current => current.id !== row.id);
      this.rawTotal -= Number(row.quantity ?? 0); this.drafts.delete(row.key);
      if (this.expanded === row.key) this.expanded = null;
      this.totalChange.emit(this.rawTotal); this.focusRow(this.visibleRows[0]?.id);
    } catch {if (identity === this.identity) this.error = 'No se pudo eliminar el equipo. Intenta de nuevo.';}
    this.mark();
  }
  async replace(row: EquipmentRow): Promise<void> {
    const identity = this.identity, draft = this.draftFor(row),
     source = await this.picker.choose({stage: this.stage, section: this.sectionName, mode: 'replace'});
    if (source && identity === this.identity && this.drafts.get(row.key) === draft) {draft.sourceId = source.id; this.mark();}
  }
  async add(): Promise<void> {
    if (this.busy || this.loading || this.loadFailed) return;
    const stage = this.stage, projectId = this.projectId, sectionId = this.sectionId, identity = this.identity;
    await this.picker.pickMany({stage, section: this.sectionName, mode: 'add', save: sources => this.addSources(stage, projectId, sectionId, identity, sources)});
  }
  private addSources(stage: EquipmentStage, projectId: number, sectionId: number, identity: string, sources: EquipmentSource[]): Promise<boolean[]> {
    return Promise.all(sources.map(async source => {
      try {
        const row = await this.track(this.api.create(stage, projectId, sectionId, {sourceId: source.id, quantity: 0, unitId: null}));
        if (identity === this.identity) {this.rows = [...this.rows, row]; this.rawTotal += Number(row.quantity ?? 0); this.totalChange.emit(this.rawTotal); this.mark();}
        return true;
      } catch {return false;}
    }));
  }
  private async track<T>(request: Observable<T>): Promise<T> {
    const task = firstValueFrom(request); this.tasks.add(task); this.pendingChange.emit(true); this.mark();
    try {return await task;} finally {this.tasks.delete(task); if (!this.destroyed) this.pendingChange.emit(this.busy); this.mark();}
  }
  async whenIdle(): Promise<void> {while (this.tasks.size) await Promise.allSettled([...this.tasks]);}
  private focusRow(id?: number): void {
    afterNextRender(() => {
      if (this.destroyed) return;
      const target = id === undefined ? null : this.host.nativeElement.querySelector<HTMLButtonElement>(`[data-edit="${id}"]`);
      (target ?? this.host.nativeElement.querySelector<HTMLButtonElement>('.equipment-panel-header button'))?.focus();
    }, {injector: this.injector});
  }
  private mark(): void {if (!this.destroyed) this.cdr.markForCheck();}
  ngOnDestroy(): void {this.destroyed = true; this.read?.unsubscribe();}
}
