import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';

/** A number of 0 or more (R-47), accepting a decimal comma; null for anything else. */
export const parseQuantity = (text: string): number | null => {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const quantity = Number(trimmed);
  // '-0' reads as -0; it is 0.
  return Number.isFinite(quantity) && quantity >= 0 ? quantity + 0 : null;
};

/**
 * A number edited in place (Materiales, equipment, use sources and annual consumption): click it,
 * then Enter or click away saves and Esc puts the old value back. An invalid value keeps the box
 * open and says why. Clicks and keys stay here, so the row underneath doesn't react.
 */
@Component({
  selector: 'app-quantity-cell',
  templateUrl: './quantity-cell.component.html',
  styleUrls: ['./quantity-cell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class QuantityCellComponent {
  @Input() value: number | string | null = null;
  @Input() unit: string | null = null;
  /** Shown instead of the formatted value (e.g. '12 h', '40 %'). */
  @Input() display: string | null = null;
  /** What the number is, for screen readers ('cantidad', 'porcentaje'). */
  @Input() label = 'cantidad';
  @Input() integer = false;
  @Input() max: number | null = null;
  @Input() disabled = false;
  /** A new valid quantity, different from the current one. */
  @Output() readonly changed = new EventEmitter<number>();

  @ViewChild('input') input?: ElementRef<HTMLInputElement>;
  editing = false;
  draft = '';
  error = '';

  constructor(private cdr: ChangeDetectorRef) {}

  start(event: Event): void {
    event.stopPropagation();
    if (this.disabled) {
      return;
    }
    this.error = '';
    this.draft = this.value === null || this.value === undefined ? '' : String(this.value);
    this.editing = true;
    this.cdr.detectChanges();
    this.input?.nativeElement.focus();
    this.input?.nativeElement.select();
  }

  onKey(event: KeyboardEvent): void {
    // The list underneath would take Space, Enter and the arrows as its own.
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.editing = false;
      this.error = '';
    }
  }

  commit(): void {
    if (!this.editing) {
      return;
    }
    const quantity = this.parse(this.draft);
    if (quantity === null) {
      this.error = this.integer && this.max === null ? 'Escribe un número entero igual o mayor a cero.'
        : this.max !== null ? `Escribe un número entre 0 y ${this.max}.` : 'Escribe un número igual o mayor a cero.';
      this.cdr.detectChanges();
      return;
    }
    this.editing = false;
    this.error = '';
    if (quantity !== Number(this.value)) {
      this.changed.emit(quantity);
    }
  }

  private parse(text: string): number | null {
    const quantity = parseQuantity(text);
    if (quantity === null || (this.integer && !Number.isInteger(quantity)) || (this.max !== null && quantity > this.max)) {
      return null;
    }
    return quantity;
  }
}
