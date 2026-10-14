import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { ExplorerItem } from '../../explorer.models';

@Component({
  selector: 'app-result-card',
  templateUrl: './result-card.component.html',
  styleUrls: ['./result-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ResultCardComponent {
  @Input({ required: true }) item!: ExplorerItem;
  @Input() favorite = false;
  /** Where the name leads; null keeps it plain text. */
  @Input() link: unknown[] | null = null;
  @Output() readonly favoriteToggle = new EventEmitter<void>();
}
