import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';

import { ExplorerItem, PAGE_SIZE } from '../../explorer.models';

/** The table view: one server page at a time (HANDOFF §4). */
@Component({
  selector: 'app-results-table',
  templateUrl: './results-table.component.html',
  styleUrls: ['./results-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ResultsTableComponent {
  @Input() items: ExplorerItem[] = [];
  @Input() count = 0;
  /** 1-based. */
  @Input() page = 1;
  @Input() linkFor: ((item: ExplorerItem) => unknown[] | null) | null = null;
  @Input() openable = false;
  @Input() selectable = false;
  @Input() selectedIds: ReadonlySet<number> = new Set();
  @Output() readonly itemOpen = new EventEmitter<ExplorerItem>();
  @Output() readonly pageChange = new EventEmitter<number>();
  @Output() readonly selectToggle = new EventEmitter<ExplorerItem>();

  readonly pageSize = PAGE_SIZE;

  get columns(): string[] {
    const columns = ['name', 'category', 'source', 'region', 'gwp', 'impact'];
    return this.selectable ? ['select', ...columns] : columns;
  }

  onPage(event: PageEvent): void {
    this.pageChange.emit(event.pageIndex + 1);
  }
}
