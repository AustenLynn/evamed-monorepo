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

/** A positive number, accepting a decimal comma; null for anything else. */
export const parseQuantity = (text: string): number | null => {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const quantity = Number(trimmed);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
};

/**
 * A material row's quantity, edited in place: click it, then Enter or click
 * away saves and Esc puts the old value back. Clicks and keys stay here, so
 * the row underneath doesn't open Edición.
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
  /** A new valid quantity, different from the current one. */
  @Output() readonly changed = new EventEmitter<number>();

  @ViewChild('input') input?: ElementRef<HTMLInputElement>;
  editing = false;
  draft = '';

  constructor(private cdr: ChangeDetectorRef) {}

  start(event: Event): void {
    event.stopPropagation();
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
    }
  }

  commit(): void {
    if (!this.editing) {
      return;
    }
    this.editing = false;
    const quantity = parseQuantity(this.draft);
    if (quantity !== null && quantity !== Number(this.value)) {
      this.changed.emit(quantity);
    }
  }
}
