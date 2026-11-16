import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { EnergyTotalService } from '../../../core/services/energy-total/energy-total.service';
import { MaterialsService } from '../../../core/services/materials/materials.service';
import { UsageApiService } from '../../services/usage-api.service';
import { calculatedQuantity, optionKey, UsageEditorState } from '../../services/usage-editor-state';
import { AnnualDraft, SourceDraft, UsageIntent, UsageOperation, UsageOperationTarget, UsageOption, UsageSource, UsageState } from '../../usage.models';

@Component({selector: 'app-usage-editor', templateUrl: './usage-editor.component.html',
  styleUrls: ['./usage-editor.component.scss'], standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class UsageEditorComponent implements OnInit, OnDestroy {
  @Input() projectId: number | null = null;
  @Input() projectName = '';
  readonly store = new UsageEditorState();
  loading = true;
  pending = false;
  loadError = '';
  annualError = '';
  operationError = '';
  sourceErrors = new Map<number, string>();
  pickerOpen = false;
  replacementId: number | null = null;
  private destroyed = new Subject<void>();
  private discardApproved = false;
  constructor(private api: UsageApiService, private energy: EnergyTotalService,
    private router: Router, private materials: MaterialsService, private changes?: ChangeDetectorRef) {}
  get recoveryEnabled(): boolean {return !!this.store.unresolved && !this.pending;}
  get locked(): boolean {return this.pending || !!this.store.unresolved;}
  get drafts(): ReadonlyMap<number, SourceDraft> {return new Map(this.store.drafts);}
  get quantityPreviews(): ReadonlyMap<number, string | null> {
    return new Map([...this.store.drafts].map(([id, draft]) => [id, calculatedQuantity(this.store.saved?.annual?.quantity ?? null, draft.percentage)]));
  }
  get orphanDrafts(): {id: number; draft: SourceDraft}[] {
    return [...this.store.drafts].filter(([id]) => !this.store.saved?.sources.some(row => row.id === id)).map(([id, draft]) => ({id, draft}));
  }
  get pickerOptions(): UsageOption[] {
    const row = this.store.saved?.sources.find(source => source.id === this.replacementId),
     current = row ? optionKey(row) : null,
     used = new Set((this.store.saved?.sources ?? []).filter(source => source.id !== this.replacementId).map(optionKey));
    return this.store.options.filter(option => option.supported && (option.key === current || !used.has(option.key)));
  }
  get pickerSelectedKeys(): string[] {return this.replacementId === null ? (this.store.saved?.sources ?? []).map(optionKey) : [];}
  get repairSummary(): string[] {return (this.store.saved?.sources ?? []).map(row => `${this.sourceName(row)}: ${row.percentage === null ? 'sin porcentaje' : row.percentage + ' %'}`);}
  ngOnInit(): void {void this.load();}
  ngOnDestroy(): void {this.destroyed.next(); this.destroyed.complete();}
  private async value<T>(source: import('rxjs').Observable<T>): Promise<T> {return firstValueFrom(source.pipe(takeUntil(this.destroyed)));}
  async load(): Promise<void> {
    if (this.locked) return;
    this.loading = true; this.loadError = '';
    if (!Number.isSafeInteger(this.projectId) || this.projectId! <= 0) {this.loadError = 'No se encontró el proyecto. Vuelve a Mis proyectos.'; this.loading = false; return;}
    this.energy.loadAll(this.projectId!);
    try {const state = await this.value(this.api.load(this.projectId!)); this.store.load(state); this.confirmed(state);} catch {this.loadError = 'No se pudo cargar el uso del proyecto. Inténtalo de nuevo.';} finally {this.loading = false; this.changes?.markForCheck();}
  }
  patchAnnual(patch: Partial<AnnualDraft>): void {if (!this.locked) {this.store.patchAnnual(patch); this.annualError = ''; this.discardApproved = false;}}
  patchSource(change: {id: number; patch: Partial<SourceDraft>}): void {if (!this.locked) {this.store.patchSource(change.id, change.patch); this.sourceErrors.delete(change.id); this.discardApproved = false;}}
  openSource(id: number): void {if (!this.locked) {if (this.store.expanded === id) this.store.expanded = null; else this.store.openSource(id);}}
  cancelAnnual(): void {if (!this.locked) {this.store.cancelAnnual(); this.annualError = '';}}
  cancelSource(id: number): void {if (!this.locked) {this.store.cancelSource(id); this.sourceErrors.delete(id);}}
  saveAnnual(): Promise<boolean> {return this.intent(() => this.store.annualIntent(), {kind: 'annual'});}
  saveSource(id: number): Promise<boolean> {return this.intent(() => this.store.sourceIntent(id), {kind: 'source', id});}
  async removeSource(id: number): Promise<boolean> {
    if (this.locked || !confirm('¿Eliminar esta fuente? Solo se eliminará el registro seleccionado.')) return false;
    return this.intent(() => ({removals: [id]}), {kind: 'remove', id});
  }
  openPicker(id?: number): void {
    if (this.locked || (id === undefined && !this.store.canAdd)) return;
    this.replacementId = id ?? null; this.pickerOpen = true;
  }
  closePicker(): void {if (!this.locked) {this.pickerOpen = false; this.store.additionKeys = [];}}
  async confirmPicker(options: UsageOption[]): Promise<boolean> {
    if (this.locked || !options.length) return false;
    const available = new Map(this.pickerOptions.map(option => [option.key, option]));
    if (options.some(option => !available.has(option.key))) {this.operationError = 'La selección ya no está disponible.'; return false;}
    if (this.replacementId !== null) {
      const option = available.get(options[0].key)!;
      this.patchSource({id: this.replacementId, patch: {type: option.type, source: option.source}});
      this.store.openSource(this.replacementId); this.pickerOpen = false; return true;
    }
    const selected = [...new Set(options.map(option => option.key))].map(key => available.get(key)!);
    this.store.additionKeys = selected.map(option => option.key);
    const saved = await this.intent(() => ({additions: selected.map(option => ({client_id: this.uuid(), type: option.type, source: option.source!}))}), {kind: 'add', keys: [...this.store.additionKeys]});
    if (saved) this.pickerOpen = false;
    return saved;
  }
  private async intent(build: () => UsageIntent, target: UsageOperationTarget): Promise<boolean> {
    if (this.locked || !this.store.saved) return false;
    try {
      const operation: UsageOperation = {request: {...build(), revision: this.store.saved.revision, operation_id: this.uuid()}, target};
      this.pending = true; this.setError(target, ''); this.operationError = '';
      try {
        const state = await this.value(this.api.save(this.projectId!, operation.request));
        this.store.accept(state, target); this.confirmed(state); return true;
      } catch (error) {
        const status = (error as {status?: number}).status;
        if (status === 0 || status === undefined || status >= 500 || status === 408) {
          this.store.markUnresolved(operation);
          return await this.reconcile();
        }
        this.setError(target, this.errorMessage(error));
        if (status === 409) {
          try {const state = await this.value(this.api.load(this.projectId!)); this.store.refresh(state); this.confirmed(state);} catch {this.operationError = 'No se pudo actualizar el estado. Conservamos tus cambios; vuelve a cargar antes de guardar.';}
        }
        return false;
      } finally {this.pending = false; this.changes?.markForCheck();}
    } catch (error) {this.setError(target, error instanceof Error ? error.message : 'No se pudo preparar el cambio.'); this.changes?.markForCheck(); return false;}
  }
  async recover(): Promise<boolean> {
    if (this.pending || !this.store.unresolved) return false;
    this.pending = true;
    try {return await this.reconcile();} finally {this.pending = false; this.changes?.markForCheck();}
  }
  private async reconcile(): Promise<boolean> {
    const operation = this.store.unresolved!;
    try {
      const state = await this.value(this.api.load(this.projectId!, operation.request.operation_id));
      if (typeof state.operation_applied !== 'boolean') throw new Error('Resultado sin confirmar');
      const applied = this.store.reconcile(state); this.confirmed(state);
      this.operationError = applied ? '' : 'El cambio no se guardó. Conservamos tus valores para que puedas revisarlos y guardar de nuevo.';
      if (applied && operation.target.kind === 'add') this.pickerOpen = false;
      return applied;
    } catch {this.operationError = 'No se pudo confirmar el resultado. Revisa el estado antes de volver a guardar.'; return false;}
  }
  private confirmed(state: UsageState): void {
    this.projectName = state.project_name;
    this.energy.setUsageTotal(state.annuals.length === 1 && state.annual && state.annual.quantity >= 0 ? state.annual.quantity : 0);
  }
  private setError(target: UsageOperationTarget, message: string): void {
    if (target.kind === 'annual') this.annualError = message;
    else if (target.kind === 'source' || target.kind === 'remove') {this.sourceErrors = new Map(this.sourceErrors); this.sourceErrors.set(target.id, message);} else this.operationError = message;
  }
  private errorMessage(error: unknown): string {
    const data = (error as {error?: unknown})?.error;
    if (typeof data === 'string' && !data.startsWith('<')) return data;
    if (data && typeof data === 'object') {const detail = (data as {detail?: unknown}).detail; if (typeof detail === 'string') return detail;}
    return (error as {status?: number})?.status === 409 ? 'El proyecto cambió en otra sesión. Revisa los valores actualizados; tus borradores se conservan.' : 'No se pudo guardar. Revisa los datos e inténtalo de nuevo.';
  }
  private uuid(): string {return crypto.randomUUID();}
  private sourceName(row: UsageSource): string {return this.store.options.find(option => option.key === optionKey(row))?.name ?? `Fuente #${row.id}`;}
  canLeave(): boolean {
    if (this.locked) return false;
    if (this.discardApproved || !this.store.dirty) return true;
    this.discardApproved = confirm('Hay cambios sin guardar. ¿Salir y descartarlos?'); return this.discardApproved;
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {if (this.locked || this.store.dirty) {event.preventDefault(); event.returnValue = '';}}
  async navigate(destination: string): Promise<void> {
    if (!this.canLeave()) return;
    if (destination === 'resultados') {sessionStorage.setItem('projectID', String(this.projectId)); await this.router.navigateByUrl('resultados'); return;}
    if (destination === 'projects') {await this.router.navigateByUrl('/home-evamed'); return;}
    localStorage.setItem('idProyectoConstrucción', String(this.projectId));
    const lookup = destination === 'materials-stage' ? this.materials.getMaterialSchemeProyects() : destination === 'construction-stage' ? this.materials.getConstructionStage() : destination === 'end-life-stage' ? this.materials.getEDCP() : null;
    if (!lookup) {await this.router.navigateByUrl(destination); return;}
    try {const rows = await this.value(lookup), exists = (rows as {project_id: number}[]).some(row => Number(row.project_id) === this.projectId); await this.router.navigateByUrl(destination + (exists ? '/update' : ''));} catch {this.operationError = 'No se pudo abrir la etapa. Inténtalo de nuevo.'; this.discardApproved = false; this.changes?.markForCheck();}
  }
}
