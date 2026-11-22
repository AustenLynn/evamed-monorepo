import {AnnualDraft, SourceDraft, UsageIntent, UsageOperation, UsageOperationTarget, UsageOption, UsageSource, UsageState, UsageUnit} from '../usage.models';

export function wholeNumber(text: string, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return Number.isSafeInteger(value) && value <= max ? value : null;
}
export function calculatedQuantity(total: number | null, share: string): string | null {
  const percentage = wholeNumber(share, 100);
  if (total === null || !Number.isSafeInteger(total) || total < 0 || percentage === null) return null;
  const product = BigInt(total) * BigInt(percentage),
   remainder = product % 100n;
  return String(product / 100n) + (remainder ? '.' + String(remainder).padStart(2, '0').replace(/0$/, '') : '');
}
export function optionKey(row: Pick<UsageSource, 'type' | 'source'>): string {
  return row.type !== null ? `type:${row.type}` : row.source === 'panels' ? 'panels' : `legacy:${row.source}`;
}
export function usageOptions(state: UsageState): UsageOption[] {
  const options: UsageOption[] = state.catalogue.map(item => ({key: `type:${item.id}`, selectionId: item.id, type: item.id,
    source: item.family, name: item.display_name, rawName: item.name, database: item.database, region: item.region, supported: item.family !== null,
    offerable: item.offerable !== false}));
  for (const row of state.sources) {
    if (row.type !== null && !options.some(option => option.type === row.type)) {
      options.push({key: `type:${row.type}`, selectionId: row.type, type: row.type, source: null,
        name: `Fuente no disponible (${row.type})`, rawName: `Fuente ${row.type}`, database: null, region: null, supported: false});
    }
  }
  options.push({key: 'panels', selectionId: -1, type: null, source: 'panels', name: 'Generación fotovoltaica', rawName: 'Generación fotovoltaica', database: null, region: null, supported: true});
  // Same label from two databases (e.g. ecoinvent and mexicaniuh grids): name the database (audit A-14).
  const repeated = new Set(options.map(o => o.name).filter((name, i, all) => all.indexOf(name) !== i));
  return options.map(o => repeated.has(o.name) && o.database ? {...o, name: `${o.name} (${o.database})`} : o);
}
const emptyAnnual = (): AnnualDraft => ({quantity: '', repairUnit: false, confirmRecalculate: false}),
 copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export class UsageEditorState {
  saved: UsageState | null = null;
  annual = emptyAnnual();
  drafts = new Map<number, SourceDraft>();
  expanded: number | null = null;
  additionKeys: string[] = [];
  unresolved: UsageOperation | null = null;
  get canonicalUnit(): UsageUnit | null { return this.saved?.units.find(unit => unit.id === this.saved?.canonical_unit_id) ?? null; }
  get options(): UsageOption[] { return this.saved ? usageOptions(this.saved) : []; }
  get assigned(): number { return (this.saved?.sources ?? []).reduce((sum, row) => sum + (typeof row.percentage === 'number' && row.percentage > 0 ? row.percentage : 0), 0); }
  /** Saved sources whose type has no data for the active method: they count as 0 in the results. */
  get notOfferable(): UsageSource[] { return (this.saved?.sources ?? []).filter(row => this.options.find(option => option.key === optionKey(row))?.offerable === false); }
  get remaining(): number { return Math.max(0, 100 - this.assigned); }
  get annualDirty(): boolean { return this.annual.quantity !== this.savedAnnual().quantity || this.annual.repairUnit || this.annual.confirmRecalculate; }
  get dirty(): boolean { return this.annualDirty || this.additionKeys.length > 0 || [...this.drafts].some(([id, draft]) => this.sourceDirty(id, draft)); }
  get canAdd(): boolean { return !!this.saved?.annual && this.saved.annuals.length === 1 && this.saved.annual.quantity >= 0 && this.saved.annual.unit_id === this.canonicalUnit?.id && !!this.canonicalUnit && this.assigned <= 100 && !this.unresolved; }
  get annualBlockedReason(): string | null {
    if (!this.saved || !this.canonicalUnit) return 'No se encontró una unidad kWh única. Revisa las unidades del proyecto.';
    if (this.saved.annuals.length > 1) return 'Hay varios consumos anuales. Resuelve los registros antes de guardar.';
    if (this.saved.annual && this.saved.annual.unit_id !== this.canonicalUnit.id && !this.annual.repairUnit) return 'Confirma la corrección de la unidad anual a kWh.';
    const negative = (this.saved.annual?.quantity ?? 0) < 0;
    for (const row of this.saved.sources) {
      if (!this.validSavedRow(row, negative)) return 'Repara las unidades, fuentes, porcentajes o cantidades de las fuentes antes de guardar.';
    }
    if (this.assigned > 100) return 'La asignación supera el 100 %.';
    if (negative && this.saved.sources.length > 0 && !this.annual.confirmRecalculate) return 'Confirma el recálculo de las fuentes para reparar el consumo negativo.';
    return null;
  }
  load(state: UsageState): void { this.saved = copy(state); this.annual = this.savedAnnual(); this.drafts.clear(); this.expanded = null; this.additionKeys = []; this.unresolved = null; }
  openSource(id: number): void { this.sourceDraft(id); this.expanded = id; }
  patchAnnual(patch: Partial<AnnualDraft>): void { this.annual = {...this.annual, ...patch}; }
  patchSource(id: number, patch: Partial<SourceDraft>): void { this.drafts.set(id, {...this.sourceDraft(id), ...patch}); }
  cancelAnnual(): void { this.annual = this.savedAnnual(); }
  cancelSource(id: number): void { this.drafts.delete(id); if(this.expanded === id) this.expanded = null; }
  sourceDraft(id: number): SourceDraft {
    let draft = this.drafts.get(id);
    if (!draft) {
 const row = this.saved?.sources.find(item=>item.id === id); if(!row) throw new Error('La fuente ya no está disponible.');
      draft = {percentage: row.percentage === null ? '' : String(row.percentage), type: row.type, source: row.source, repairUnit: false}; this.drafts.set(id, draft);
}
    return draft;
  }
  annualIntent(): UsageIntent {
    const quantity = wholeNumber(this.annual.quantity, 2147483647); if(quantity === null) throw new Error('Escribe un consumo anual entero entre 0 y 2147483647.');
    if(this.annualBlockedReason) throw new Error(this.annualBlockedReason);
    const intent: UsageIntent = {annual: {quantity, ...(this.annual.repairUnit ? {repair_unit: true} : {})}};
    if((this.saved?.annual?.quantity ?? 0) < 0) intent.edits = this.saved!.sources.map(row=>({id: row.id, percentage: row.percentage!}));
    return intent;
  }
  sourceIntent(id: number): UsageIntent {
    const row = this.saved?.sources.find(item=>item.id === id); if(!row) throw new Error('La fuente ya no está disponible; revisa o cancela el borrador.');
    if(!this.saved?.annual || !this.canonicalUnit || this.saved.annuals.length !== 1) throw new Error('Guarda un consumo anual con una unidad kWh válida.');
    const draft = this.sourceDraft(id), percentage = wholeNumber(draft.percentage, 100);
    if(percentage === null) throw new Error('Escribe un porcentaje entero entre 0 y 100.');
    const key = optionKey(draft), original = optionKey(row), option = this.options.find(item=>item.key === key);
    if(!option?.supported || option.source !== draft.source) throw new Error('Selecciona una fuente compatible.');
    if(key !== original && this.saved.sources.some(item=>item.id !== id && optionKey(item) === key)) throw new Error('Esta fuente ya está asignada.');
    const allocated = this.saved.sources.reduce((sum, item)=>sum + (item.id === id ? percentage : Math.max(0, item.percentage ?? 0)), 0),
     reducingLegacy = this.assigned > 100 && allocated < this.assigned;
    if(allocated > 100 && !reducingLegacy) throw new Error('La asignación supera el 100 %.');
    if(row.unit_id !== this.canonicalUnit.id && !draft.repairUnit) throw new Error('Confirma la corrección de la unidad a kWh.');
    return {edits: [{id, percentage, ...(draft.type !== row.type || draft.source !== row.source ? {type: draft.type, source: draft.source} : {}), ...(draft.repairUnit ? {repair_unit: true} : {})}]};
  }
  accept(state: UsageState, target: UsageOperationTarget): void { this.refresh(state); this.clearTarget(target); }
  refresh(state: UsageState): void {
    const annualDirty = this.annualDirty;
    for(const [id, draft] of this.drafts) if(!this.sourceDirty(id, draft)) this.drafts.delete(id);
    this.saved = copy(state); if(!annualDirty) this.annual = this.savedAnnual();
  }
  markUnresolved(operation: UsageOperation): void { this.unresolved = copy(operation); }
  reconcile(state: UsageState): boolean {
    const operation = this.unresolved; this.refresh(state);
    const applied = !!operation && state.operation_applied === true;
    if(applied) this.clearTarget(operation!.target);
    this.unresolved = null; return applied;
  }
  private clearTarget(target: UsageOperationTarget): void {
    if(target.kind === 'annual') this.cancelAnnual();
    else if(target.kind === 'add') this.additionKeys = this.additionKeys.filter(key=>!target.keys.includes(key));
    else this.cancelSource(target.id);
  }
  private savedAnnual(): AnnualDraft { return {...emptyAnnual(), quantity: this.saved?.annual ? String(this.saved.annual.quantity) : ''}; }
  private sourceDirty(id: number, draft: SourceDraft): boolean {
    const row = this.saved?.sources.find(item=>item.id === id);
    return !row || draft.percentage !== (row.percentage === null ? '' : String(row.percentage)) || draft.type !== row.type || draft.source !== row.source || draft.repairUnit;
  }
  private validSavedRow(row: UsageSource, allowQuantityIssue: boolean): boolean {
    const option = this.options.find(item=>item.key === optionKey(row));
    return row.percentage !== null && wholeNumber(String(row.percentage), 100) !== null && row.unit_id === this.canonicalUnit?.id &&
      !!option?.supported && option.source === row.source && row.issues.every(issue=>allowQuantityIssue && issue === 'quantity');
  }
}
