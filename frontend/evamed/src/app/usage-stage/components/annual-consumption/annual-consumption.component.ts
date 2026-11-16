import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AnnualDraft, UsageAnnual, UsageUnit } from '../../usage.models';

@Component({selector: 'app-annual-consumption', templateUrl: './annual-consumption.component.html',
  styleUrls: ['./annual-consumption.component.scss'], standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class AnnualConsumptionComponent {
  @Input() annual: UsageAnnual | null = null;
  @Input() draft: AnnualDraft = {quantity: '', repairUnit: false, confirmRecalculate: false};
  @Input() canonicalUnit: UsageUnit | null = null;
  @Input() units: UsageUnit[] = [];
  @Input() assigned = 0;
  @Input() pending = false;
  @Input() blockedReason = '';
  @Input() error = '';
  @Input() repairSummary: string[] = [];
  @Output() readonly draftChange = new EventEmitter<Partial<AnnualDraft>>();
  @Output() readonly saveAnnual = new EventEmitter<void>();
  @Output() readonly cancelAnnual = new EventEmitter<void>();
  get negative(): boolean {return (this.annual?.quantity ?? 0) < 0;}
  get unitLabel(): string {
    return this.units.find(unit => unit.id === this.annual?.unit_id)?.name_unit ?? (this.annual?.unit_id ? `Unidad guardada #${this.annual.unit_id}` : 'Sin unidad');
  }
}
