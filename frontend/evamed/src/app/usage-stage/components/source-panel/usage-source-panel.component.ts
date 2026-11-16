import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SourceDraft, UsageOption, UsageSource, UsageUnit } from '../../usage.models';

@Component({selector: 'app-usage-source-panel', templateUrl: './usage-source-panel.component.html',
  styleUrls: ['./usage-source-panel.component.scss'], standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class UsageSourcePanelComponent {
  @Input() rows: UsageSource[] = [];
  @Input() options: UsageOption[] = [];
  @Input() units: UsageUnit[] = [];
  @Input() canonicalUnit: UsageUnit | null = null;
  @Input() drafts: ReadonlyMap<number, SourceDraft> = new Map();
  @Input() quantityPreviews: ReadonlyMap<number, string | null> = new Map();
  @Input() errors: ReadonlyMap<number, string> = new Map();
  @Input() expanded: number | null = null;
  @Input() pending = false;
  @Input() blocked = false;
  @Input() canAdd = true;
  @Input() annualQuantity: number | null = null;
  @Input() annualDraftDirty = false;
  @Output() readonly addSources = new EventEmitter<void>();
  @Output() readonly editSource = new EventEmitter<number>();
  @Output() readonly cancelSource = new EventEmitter<number>();
  @Output() readonly saveSource = new EventEmitter<number>();
  @Output() readonly replaceSource = new EventEmitter<number>();
  @Output() readonly removeSource = new EventEmitter<number>();
  @Output() readonly draftChange = new EventEmitter<{id: number; patch: Partial<SourceDraft>}>();
  view: 'cards' | 'list' = 'cards';
  trackRow(_index: number, row: UsageSource): number {return row.id;}
  option(row: {type: number | null; source: string | null}): UsageOption | undefined {
    return this.options.find(option => row.type === null ? option.source === row.source && option.type === null : option.type === row.type);
  }
  name(row: {type: number | null; source: string | null}): string {
    return this.option(row)?.name ?? (row.type === null ? 'Fuente sin clasificar' : `Fuente guardada #${row.type}`);
  }
  unitName(id: number | null): string {
    return this.units.find(unit => unit.id === id)?.name_unit ?? (id === null ? 'Sin unidad' : `Unidad guardada #${id}`);
  }
  description(row: UsageSource): string {
    const labels: Record<string, string> = {unit: 'unidad por revisar', percentage: 'porcentaje por revisar', quantity: 'cantidad por recalcular', type: 'fuente por revisar'};
    return row.issues.map(issue => labels[issue] ?? issue).join(' · ');
  }
  change(id: number, patch: Partial<SourceDraft>): void {this.draftChange.emit({id, patch});}
}
