import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { UsageAnnual, UsageUnit } from '../../usage.models';

@Component({selector: 'app-annual-consumption', templateUrl: './annual-consumption.component.html',
  styleUrls: ['./annual-consumption.component.scss'], standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class AnnualConsumptionComponent {
  @Input() annual: UsageAnnual | null = null;
  @Input() canonicalUnit: UsageUnit | null = null;
  @Input() units: UsageUnit[] = [];
  @Input() assigned = 0;
  @Input() pending = false;
  @Input() blockedReason = '';
  @Input() error = '';
  @Input() repairSummary: string[] = [];
  /** In place (2026-11-27): a new whole consumption, saved at once. */
  @Output() readonly setQuantity = new EventEmitter<number>();
  @Output() readonly repairUnit = new EventEmitter<void>();
  get wrongUnit(): boolean {return !!this.canonicalUnit && !!this.annual && this.annual.unit_id !== this.canonicalUnit.id;}
  get negative(): boolean {return (this.annual?.quantity ?? 0) < 0;}
  get unitLabel(): string {
    return this.units.find(unit => unit.id === this.annual?.unit_id)?.name_unit ?? (this.annual?.unit_id ? `Unidad guardada #${this.annual.unit_id}` : 'Sin unidad');
  }
}
