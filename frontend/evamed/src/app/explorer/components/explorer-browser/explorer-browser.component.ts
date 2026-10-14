import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { combineLatest, Observable, ReplaySubject } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { ExplorerItem, ExplorerQuery } from '../../explorer.models';
import { ExplorerFeed, FeedState } from '../../services/explorer-feed';
import { ExplorerService } from '../../services/explorer.service';
import { FavoritesService } from '../../services/favorites.service';
import { StageConfig } from '../../stage-config';

export type ExplorerView = 'tarjetas' | 'tabla';

interface ViewModel {
  state: FeedState;
  feed: ExplorerFeed;
  favorites: ReadonlySet<number>;
}

/**
 * Filters and results for one stage. It holds no navigation state of its own:
 * the routed page keeps query, view and table page in the URL; the stage
 * page's dialog keeps them in memory.
 */
@Component({
  selector: 'app-explorer-browser',
  templateUrl: './explorer-browser.component.html',
  styleUrls: ['./explorer-browser.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ExplorerBrowserComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) stage!: StageConfig;
  @Input() query: ExplorerQuery = { search: '', filters: {} };
  @Input() view: ExplorerView = 'tarjetas';
  /** 1-based; the table view's page. */
  @Input() tablePage = 1;
  /** Detail links for items; null for none. */
  @Input() linkFor: ((item: ExplorerItem) => unknown[] | null) | null = null;
  @Output() readonly queryChange = new EventEmitter<ExplorerQuery>();
  @Output() readonly viewChange = new EventEmitter<ExplorerView>();
  @Output() readonly tablePageChange = new EventEmitter<number>();

  private readonly feed$ = new ReplaySubject<ExplorerFeed>(1);
  private feed?: ExplorerFeed;
  readonly vm$: Observable<ViewModel>;

  constructor(
    private explorer: ExplorerService,
    private favoriteStore: FavoritesService
  ) {
    this.vm$ = combineLatest([
      this.feed$.pipe(switchMap(feed => feed.state$.pipe(map(state => ({ feed, state }))))),
      this.favoriteStore.favorites$,
    ]).pipe(
      map(([{ feed, state }, favorites]) => ({
        feed,
        state,
        favorites: this.idsFor(favorites),
      }))
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stage'] || changes['query']) {
      if (this.feed && this.view === 'tarjetas') {
        this.feed.scrollY = 0;
      }
      this.feed = this.explorer.feed(this.stage.key, this.query);
      this.feed$.next(this.feed);
      this.restoreScroll(this.feed);
    }
    this.loadVisible();
  }

  ngOnDestroy(): void {
    if (this.feed && this.view === 'tarjetas' && typeof window !== 'undefined') {
      this.feed.scrollY = window.scrollY;
    }
  }

  get filtered(): boolean {
    return !!this.query.search || Object.values(this.query.filters).some(values => values.length > 0);
  }

  tableItems(state: FeedState): ExplorerItem[] | undefined {
    return state.pages.get(this.tablePage);
  }

  toggleFavorite(item: ExplorerItem): void {
    this.favoriteStore.toggle(this.stage.key, item.id);
  }

  clearFilters(): void {
    this.queryChange.emit({ search: '', filters: {} });
  }

  private loadVisible(): void {
    if (!this.feed) {
      return;
    }
    if (this.view === 'tabla') {
      this.feed.load(this.tablePage);
    } else if (this.feed.loadedRun === 0) {
      this.feed.loadMore();
    }
  }

  private restoreScroll(feed: ExplorerFeed): void {
    if (feed.loadedRun > 0 && feed.scrollY > 0 && this.view === 'tarjetas' && typeof window !== 'undefined') {
      const y = feed.scrollY;
      setTimeout(() => window.scrollTo({ top: y }));
    }
  }

  private idsFor(favorites: ReadonlySet<string>): ReadonlySet<number> {
    const prefix = `${this.stage.key}:`;
    return new Set(
      [...favorites].filter(key => key.startsWith(prefix)).map(key => Number(key.slice(prefix.length)))
    );
  }
}
