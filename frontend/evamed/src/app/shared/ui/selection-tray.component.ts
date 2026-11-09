import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
export interface SelectionItem { id: number; name: string; }
/** Callers own persistence, action labels and whether a tray is visible. */
@Component({selector: 'app-ev-selection-tray', imports: [CommonModule, MatIconModule], templateUrl: './selection-tray.component.html', styleUrls: ['./selection-tray.component.scss'], standalone: true})
export class SelectionTrayComponent {
  @Input() items: SelectionItem[] = [];
  @Input() disabled = false;
  @Input() label = '';
  @Output() remove = new EventEmitter<number>();
}
