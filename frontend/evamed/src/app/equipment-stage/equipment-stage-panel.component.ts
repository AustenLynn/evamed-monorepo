import { afterNextRender, ElementRef, Injector, ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { firstValueFrom, forkJoin, Observable, Subscription } from 'rxjs';
import { EquipmentCatalogueService } from './equipment-catalogue.service';
import { EquipmentRowsService } from './equipment-rows.service';
import { EquipmentCatalogue, EquipmentInput, EquipmentRow, EquipmentSource, EquipmentStage } from './equipment.models';
import { EquipmentPickerService } from './equipment-picker.service';

const UNIT_LABELS: Record<string, string> = {'h': 'horas de operación', 'm³': 'm³ excavados', 't·km': 'toneladas-kilómetro transportadas (t·km)'};

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
  view = 'cards';
  /** Save errors shown on their card (row key -> message). */
  rowErrors = new Map<string, string>();
  loading = true;
  error = '';
  loadFailed = false;
  private identity = '';
  private rawTotal = 0;
  private tasks = new Set<Promise<unknown>>();
  private read?: Subscription;
  private destroyed = false;
  constructor(private api: EquipmentRowsService, private catalogues: EquipmentCatalogueService,
    private picker: EquipmentPickerService, private cdr: ChangeDetectorRef,
    private host: ElementRef<HTMLElement>, private injector: Injector) {}
  ngOnChanges(): void {
    const identity = `${this.stage}:${this.projectId}`;
    if (this.identity !== identity) {
      this.identity = identity; this.rowErrors.clear(); this.rows = []; this.error = ''; this.load();
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
  sourceInfo(id: number | null): EquipmentSource | undefined {return this.catalogue.sources.find(source => source.id === id);}
  sourceName(id: number | null): string {const source = this.sourceInfo(id); return source?.displayName || source?.name || 'Fuente no disponible';}
  /** Short unit of a source's quantity; hours unless the source says otherwise. */
  quantityUnit(sourceId: number | null): string {return this.sourceInfo(sourceId)?.unit || 'h';}
  quantityUnitLabel(sourceId: number | null): string {const unit = this.quantityUnit(sourceId); return UNIT_LABELS[unit] ?? unit;}
  private byHours(sourceId: number | null): boolean {return this.quantityUnit(sourceId) === 'h';}
  /** Hours rows save the hours unit (audit A-12); a source in m³ or t·km carries its unit itself. */
  private rowUnitId(sourceId: number | null): number | null {return this.byHours(sourceId) ? this.catalogue.hourUnitId ?? null : null;}
  unitName(id: number | null): string {return id === null ? 'Sin unidad' : this.catalogue.unitLabels.find(unit => unit.id === id)?.name ?? 'Unidad no disponible';}
  /** Saved in another unit before quantities became hours (audit A-12): the number is read as hours. */
  otherUnit(row: EquipmentRow): boolean {return this.byHours(row.sourceId) && row.unitId !== null && row.unitId !== (this.catalogue.hourUnitId ?? null);}
  legacyUnit(row: EquipmentRow): boolean {return row.unitId !== null && !this.catalogue.units.some(unit => unit.id === row.unitId);}
  /** A quantity edited in place (in-place editing design): saved at once. */
  setQuantity(row: EquipmentRow, quantity: number): Promise<void> {
    return this.update(row, {sourceId: row.sourceId!, quantity, unitId: this.rowUnitId(row.sourceId)});
  }
  /** «Cambiar equipo» from the card's name: saved as soon as one is chosen, with the stored quantity. */
  async replace(row: EquipmentRow): Promise<void> {
    if (this.busy) return;
    const identity = this.identity,
     source = await this.picker.choose({stage: this.stage, section: this.sectionName, mode: 'replace'});
    if (!source || identity !== this.identity || source.id === row.sourceId) return;
    await this.update(row, {sourceId: source.id, quantity: row.quantity ?? 0, unitId: this.rowUnitId(source.id)});
  }
  private async update(row: EquipmentRow, input: EquipmentInput): Promise<void> {
    if (this.busy) return;
    const stage = this.stage, identity = this.identity;
    this.error = ''; this.rowErrors.delete(row.key);
    try {
      const saved = await this.track(this.api.update(stage, row, input));
      if (identity !== this.identity) return;
      this.rows = this.rows.map(current => current.id === row.id ? {...saved, key: row.key} : current);
      this.rawTotal += Number(saved.quantity ?? 0) - Number(row.quantity ?? 0);
      this.totalChange.emit(this.rawTotal);
    } catch {if (identity === this.identity) this.rowErrors.set(row.key, 'No se pudo guardar el equipo. Intenta de nuevo.');}
    this.mark();
  }
  async remove(row: EquipmentRow): Promise<void> {
    if (this.busy) return;
    const stage = this.stage, identity = this.identity; this.error = '';
    try {
      await this.track(this.api.remove(stage, row.id));
      if (identity !== this.identity) return;
      this.rows = this.rows.filter(current => current.id !== row.id);
      this.rawTotal -= Number(row.quantity ?? 0); this.rowErrors.delete(row.key);
      this.totalChange.emit(this.rawTotal); this.focusRow(this.visibleRows[0]?.id);
    } catch {if (identity === this.identity) this.error = 'No se pudo eliminar el equipo. Intenta de nuevo.';}
    this.mark();
  }
  async add(): Promise<void> {
    if (this.busy || this.loading || this.loadFailed) return;
    const stage = this.stage, projectId = this.projectId, sectionId = this.sectionId, identity = this.identity;
    await this.picker.pickMany({stage, section: this.sectionName, mode: 'add', save: sources => this.addSources(stage, projectId, sectionId, identity, sources)});
  }
  private addSources(stage: EquipmentStage, projectId: number, sectionId: number, identity: string, sources: EquipmentSource[]): Promise<boolean[]> {
    return Promise.all(sources.map(async source => {
      try {
        const row = await this.track(this.api.create(stage, projectId, sectionId, {sourceId: source.id, quantity: 0, unitId: this.rowUnitId(source.id)}));
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
      const target = id === undefined ? null : this.host.nativeElement.querySelector<HTMLButtonElement>(`[data-replace="${id}"]`);
      (target ?? this.host.nativeElement.querySelector<HTMLButtonElement>('.equipment-panel-header button'))?.focus();
    }, {injector: this.injector});
  }
  private mark(): void {if (!this.destroyed) this.cdr.markForCheck();}
  ngOnDestroy(): void {this.destroyed = true; this.read?.unsubscribe();}
}
