import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import { ExplorerItem, SortKey } from '../../explorer.models';

const CARD_MIN_WIDTH = 220,
  GAP = 16;

/** The cards view: batches load as the end of the grid scrolls into view (HANDOFF §4). */
@Component({
  selector: 'app-results-cards',
  templateUrl: './results-cards.component.html',
  styleUrls: ['./results-cards.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ResultsCardsComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() items: ExplorerItem[] = [];
  @Input() count: number | null = null;
  @Input() loading = false;
  @Input() failed = false;
  @Input() hasMore = false;
  /** The list's order: the impact and category orders get a heading where each group starts. */
  @Input() groupBy: SortKey = 'nombre';
  @Input() linkFor: ((item: ExplorerItem) => unknown[] | null) | null = null;
  @Input() openable = false;
  @Input() selectable = false;
  @Input() selectedIds: ReadonlySet<number> = new Set();
  @Output() readonly itemOpen = new EventEmitter<ExplorerItem>();
  @Output() readonly loadMore = new EventEmitter<void>();
  @Output() readonly retry = new EventEmitter<void>();
  @Output() readonly selectToggle = new EventEmitter<ExplorerItem>();

  @ViewChild('grid', { static: true }) grid!: ElementRef<HTMLElement>;
  @ViewChild('sentinel', { static: true }) sentinel!: ElementRef<HTMLElement>;

  /** Placeholder cards while a batch loads: the rest of the last row and one more row. */
  skeletons: number[] = [];
  private observer?: IntersectionObserver;
  private focusIndex: number | null = null;

  constructor(private zone: NgZone) {}

  get canLoadMore(): boolean {
    return this.hasMore && !this.loading && !this.failed;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loading'] || changes['items']) {
      this.skeletons = this.loading ? this.placeholders() : [];
    }
    if (changes['items'] && this.focusIndex !== null && this.items.length > this.focusIndex) {
      const index = this.focusIndex;
      this.focusIndex = null;
      // Keyboard users who asked for more land on the first new card.
      setTimeout(() => this.grid.nativeElement.querySelectorAll<HTMLElement>('.result-card')[index]?.focus());
    }
  }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return; // the "Cargar más" button still works
    }
    this.observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting) && this.canLoadMore && this.items.length) {
          this.zone.run(() => this.loadMore.emit());
        }
      },
      { rootMargin: '400px 0px' }
    );
    this.observer.observe(this.sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  requestMore(): void {
    this.focusIndex = this.items.length;
    this.loadMore.emit();
  }

  /** The heading before items[index], or null when it continues the previous item's group. */
  groupHeading(index: number): string | null {
    if (this.groupBy === 'nombre') {
      return null;
    }
    const label = (item: ExplorerItem) =>
      this.groupBy === 'impacto' || this.groupBy === 'mayor-impacto'
        ? item.unit
          ? `Por ${item.unit}`
          : 'Sin unidad'
        : `${item.category ?? 'Sin categoría'} · ${item.unit ?? 'sin unidad'}`,
      heading = label(this.items[index]);
    return index > 0 && label(this.items[index - 1]) === heading ? null : heading;
  }

  trackItem(_index: number, item: ExplorerItem): number {
    return item.id;
  }

  private placeholders(): number[] {
    const width = this.grid?.nativeElement.clientWidth ?? 0,
      columns = Math.max(1, Math.floor((width + GAP) / (CARD_MIN_WIDTH + GAP))),
      rest = (columns - (this.items.length % columns)) % columns;
    return Array.from({ length: rest + columns }, (_, index) => index);
  }
}
