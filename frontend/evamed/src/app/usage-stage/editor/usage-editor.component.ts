import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnChanges, OnDestroy } from '@angular/core';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EnergyTotalService } from '../../core/services/energy-total/energy-total.service';
import { UsageChange, UsageIntent, UsageSource, UsageState, UsageType } from './usage.models';
import { UsageService } from './usage.service';
import { UsagePickerService } from './usage-picker.service';

interface RowDraft {id: number; percentage: string; type: number | null; source: string; repair_unit: boolean}
const integer = (value: string, max: number): number | null => /^\d+$/.test(value.trim()) &&
  Number.isSafeInteger(Number(value)) && Number(value) <= max ? Number(value) : null;

@Component({selector: 'app-usage-editor', templateUrl: './usage-editor.component.html',
  styleUrls: ['./usage-editor.component.scss'], standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class UsageEditorComponent implements OnChanges, OnDestroy {
  @Input() projectId: number;
  state: UsageState | null = null;
  loading = true;
  pending = false;
  pickerOpen = false;
  error = '';
  notice = '';
  fieldError = '';
  reviewRequired = false;
  annualDraft: string | null = null;
  annualRepair = false;
  annualRepairQuantities = false;
  rowDraft: RowDraft | null = null;
  additionDraft: UsageType[] = [];
  private uncertain: UsageChange | null = null;
  private destroy$ = new Subject<void>();
  constructor(private api: UsageService, private totals: EnergyTotalService,
    private picker: UsagePickerService, private cdr: ChangeDetectorRef, private host: ElementRef<HTMLElement>) {}

  ngOnChanges(): void {
    this.state = null; this.loading = true;
    if (!Number.isInteger(this.projectId) || this.projectId <= 0) {
      this.error = 'No hay un proyecto activo. Regresa a proyectos para seleccionarlo.';
      this.loading = false; return;
    }
    this.api.load(this.projectId).pipe(takeUntil(this.destroy$)).subscribe({
      next: state => {this.accept(state); this.loading = false; this.cdr.markForCheck();},
      error: () => {this.loading = false; this.error = 'No se pudo cargar Uso. Reintenta sin cambiar tus datos.'; this.cdr.markForCheck();}
    });
  }
  get orphanDraft(): boolean {return !!this.rowDraft && !this.state?.sources.some(row => row.id === this.rowDraft.id);}
  get assigned(): number {return this.state?.sources.reduce((sum, row) => sum + Math.max(0, row.percentage ?? 0), 0) ?? 0;}
  get draftQuantity(): string | null {
    const share = this.rowDraft ? integer(this.rowDraft.percentage, 100) : null;
    if (share === null || !this.state?.annual || this.state.annual.quantity < 0) return null;
    const hundredths = BigInt(this.state.annual.quantity) * BigInt(share);
    return `${hundredths / 100n}.${String(hundredths % 100n).padStart(2, '0')}`.replace(/\.?0+$/, '');
  }
  get hasPanels(): boolean {return this.state?.sources.some(row => row.source === 'panels' && row.type === null) ?? false;}
  get remaining(): number {return 100 - this.assigned;}
  get blocked(): boolean {return !this.state || this.state.issues.includes('multiple_annuals');}
  get annualBlocked(): boolean {
    return this.blocked || this.state.canonical_unit_id === null || this.state.sources.some(row => row.issues.some(issue => !this.annualNegative || issue !== 'quantity'));
  }
  get annualNegative(): boolean {return (this.state?.annual?.quantity ?? 0) < 0;}
  get canAdd(): boolean {
    return !this.blocked && !!this.state.annual && this.state.canonical_unit_id !== null &&
      !this.state.issues.includes('annual_unit') && !this.state.issues.includes('annual_quantity');
  }
  get dirty(): boolean {return this.annualDraft !== null || this.rowDraft !== null || this.additionDraft.length > 0;}
  get locked(): boolean {return this.pending || this.loading || this.pickerOpen || this.reviewRequired;}
  unitName(id: number | null): string {
    return this.state?.units.find(unit => unit.id === id)?.name_unit ?? (id === null ? 'Sin unidad' : `Unidad guardada #${id}`);
  }
  type(row: {type: number | null}): UsageType | undefined {return this.state?.catalogue.find(item => item.id === row.type);}
  name(row: {type: number | null; source: string | null}): string {
    return row.source === 'panels' && row.type === null ? 'Paneles fotovoltaicos' :
      this.type(row)?.display_name || `Fuente guardada #${row.type ?? 'sin tipo'} (${row.source ?? 'sin familia'})`;
  }
  issues(row: UsageSource): string {
    const labels: Record<string, string> = {percentage: 'porcentaje inválido', quantity: 'cantidad incompatible', unit: 'unidad por revisar', type: 'familia o tipo sin clasificar'};
    return row.issues.map(issue => labels[issue] || issue).join(' · ');
  }
  private accept(state: UsageState): void {
    this.state = state;
    this.totals.setUsageTotal(state.annual?.quantity ?? 0);
  }
  private discardOtherDraft(): boolean {
    if (!this.dirty) return true;
    if (!window.confirm('¿Descartar los cambios sin guardar?')) return false;
    this.cancelDraft(); return true;
  }
  editAnnual(): void {
    if (this.locked || this.annualBlocked || !this.discardOtherDraft()) return;
    this.annualDraft = String(this.state.annual?.quantity ?? 0); this.annualRepair = false; this.annualRepairQuantities = false; this.fieldError = '';
  }
  editRow(row: UsageSource): void {
    if (this.locked || this.blocked || !this.discardOtherDraft()) return;
    this.annualDraft = null; this.fieldError = '';
    this.rowDraft = {id: row.id, percentage: row.percentage === null ? '' : String(row.percentage),
      type: row.type, source: row.source, repair_unit: false};
  }
  cancelDraft(): void {
    if (this.pending || this.reviewRequired) return;
    this.clearDraft();
  }
  async saveAnnual(): Promise<void> {
    if (this.annualDraft === null || this.locked) return;
    const quantity = integer(this.annualDraft, 2147483647);
    if (quantity === null) {this.fieldError = 'Indica un consumo entero entre 0 y 2147483647.'; return;}
    if (this.annualNegative && this.state.sources.length && !this.annualRepairQuantities) {
      this.fieldError = 'Confirma la revisión de las cantidades de todas las fuentes antes de reparar el consumo.'; return;
    }
    const edits = this.annualNegative ? this.state.sources.map(row => ({id: row.id, percentage: row.percentage})) : undefined;
    if (await this.persist({annual: {quantity, repair_unit: this.annualRepair}, ...(edits ? {edits} : {})})) this.clearDraft();
  }
  async saveRow(): Promise<void> {
    if (!this.rowDraft || this.locked) return;
    const percentage = integer(this.rowDraft.percentage, 100);
    if (percentage === null) {this.fieldError = 'Indica un porcentaje entero entre 0 y 100.'; return;}
    const {id, type, source, repair_unit} = this.rowDraft;
    if (await this.persist({edits: [{id, type, source, percentage, repair_unit}]})) this.clearDraft();
  }
  private clearDraft(): void {
    const selector = this.rowDraft ? `[data-source-row="${this.rowDraft.id}"] .usage-card-summary` : '[data-edit-annual]';
    this.annualDraft = null; this.rowDraft = null; this.additionDraft = []; this.fieldError = ''; this.cdr.markForCheck();
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus());
  }
  async persist(intent: UsageIntent): Promise<boolean> {
    if (this.pending || this.reviewRequired || this.blocked) return false;
    const request: UsageChange = {...intent, revision: this.state.revision, operation_id: crypto.randomUUID()};
    this.pending = true; this.error = ''; this.notice = ''; this.fieldError = '';
    try {
      this.accept(await firstValueFrom(this.api.save(this.projectId, request)));
      return true;
    } catch (failure) {
      const error = failure as {status?: number; error?: unknown};
      if (!error.status || error.status >= 500 || error.status === 409) {
        this.reviewRequired = true; this.uncertain = request;
        this.error = error.status === 409 ? 'Los datos cambiaron. Recarga y revisa el borrador antes de guardar.' :
          'No se pudo confirmar el guardado. Recarga y revisa antes de reintentar; tu borrador se conserva.';
      } else {
        this.error = typeof error.error === 'string' ? error.error :
          error.error ? Object.values(error.error).flat().join(' ') : 'No se pudo guardar. Revisa los datos e intenta de nuevo.';
      }
      return false;
    } finally {this.pending = false; this.cdr.markForCheck();}
  }
  async review(): Promise<void> {
    if (this.pending) return;
    this.pending = true;
    try {
      const state = await firstValueFrom(this.api.load(this.projectId, this.uncertain?.operation_id));
      this.accept(state);
      if (state.operation_applied) {this.clearDraft(); this.notice = 'El guardado anterior quedó confirmado.';} else {
        if (this.rowDraft && !state.sources.some(row => row.id === this.rowDraft.id)) {
          this.notice = 'La fuente del borrador fue eliminada. Conserva estos valores para revisar antes de cancelar.';
        } else this.notice = 'Datos recargados. Revisa tu borrador y guarda de nuevo cuando esté listo.';
      }
      this.uncertain = null; this.reviewRequired = false; this.error = '';
    } catch {this.error = 'No se pudo recargar. Tu borrador se conserva; reintenta la revisión.';} finally {this.pending = false; this.cdr.markForCheck();}
  }
  async addSources(): Promise<void> {
    if (this.locked || !this.canAdd) return;
    if ((this.annualDraft !== null || this.rowDraft !== null) && !this.discardOtherDraft()) return;
    this.pickerOpen = true;
    try {
      await this.picker.add(this.state.catalogue, this.state.sources.map(row => row.type), async sources => {
        if (this.reviewRequired) return false;
        this.additionDraft = sources;
        const saved = await this.persist({additions: sources.map(source => ({client_id: crypto.randomUUID(), type: source.id, source: source.family}))});
        if (saved) this.additionDraft = [];
        return saved;
      }, this.additionDraft.map(source => source.id), () => this.reviewRequired);
    } finally {this.pickerOpen = false; this.cdr.markForCheck();}
  }
  async addPanels(): Promise<void> {
    if (this.locked || !this.canAdd || !this.discardOtherDraft() || this.state.sources.some(row => row.type === null && row.source === 'panels')) return;
    await this.persist({additions: [{client_id: crypto.randomUUID(), type: null, source: 'panels'}]});
  }
  async replace(): Promise<void> {
    if (this.locked || !this.rowDraft) return;
    this.pickerOpen = true;
    try {
      const selected = await this.picker.choose(this.state.catalogue);
      if (selected && this.rowDraft) {this.rowDraft.type = selected.id; this.rowDraft.source = selected.family;}
    } finally {this.pickerOpen = false; this.cdr.markForCheck();}
  }
  async remove(row: UsageSource): Promise<void> {
    if (this.locked || this.blocked || !this.discardOtherDraft()) return;
    if (window.confirm(`¿Eliminar «${this.name(row)}» del proyecto?`)) await this.persist({removals: [row.id]});
  }
  canLeave(): boolean {
    if (this.pending || this.pickerOpen || this.reviewRequired) return false;
    return !this.dirty || window.confirm('Hay cambios sin guardar. ¿Salir y descartarlos?');
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty || this.pending || this.reviewRequired) {event.preventDefault(); event.returnValue = '';}
  }
  ngOnDestroy(): void {this.destroy$.next(); this.destroy$.complete();}
}
