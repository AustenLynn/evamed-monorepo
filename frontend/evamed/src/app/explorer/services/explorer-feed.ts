import { BehaviorSubject, Observable } from 'rxjs';

import { ExplorerItem, ExplorerPage, ExplorerQuery, Facets, PAGE_SIZE } from '../explorer.models';

export interface FeedState {
  /** Loaded pages, by number. */
  pages: ReadonlyMap<number, ExplorerItem[]>;
  count: number | null;
  facets: Facets | null;
  /** The page being fetched, if any. */
  loading: number | null;
  /** The page whose fetch failed, if any. */
  failed: number | null;
}

/** A stable key for a query: same filters in any order, same key. */
export const queryKey = (query: ExplorerQuery): string =>
  JSON.stringify([
    query.search.trim(),
    Object.keys(query.filters)
      .sort()
      .filter(param => query.filters[param].length)
      .map(param => [param, [...query.filters[param]].sort()]),
  ]);

/**
 * The pages of one query. Cards show pages 1…n in a row; the table shows one
 * page at a time. Both read the same loaded pages, so switching views doesn't
 * fetch again.
 */
export class ExplorerFeed {
  readonly state$: BehaviorSubject<FeedState>;
  /** Where the cards were scrolled to when the list was left. */
  scrollY = 0;

  constructor(private readonly fetch: (page: number) => Observable<ExplorerPage>) {
    this.state$ = new BehaviorSubject<FeedState>({
      pages: new Map(),
      count: null,
      facets: null,
      loading: null,
      failed: null,
    });
  }

  get state(): FeedState {
    return this.state$.value;
  }

  get pageCount(): number | null {
    return this.state.count === null ? null : Math.max(1, Math.ceil(this.state.count / PAGE_SIZE));
  }

  /** Pages 1…n with no gap: what the cards show. */
  get loadedRun(): number {
    let run = 0;
    while (this.state.pages.has(run + 1)) {
      run++;
    }
    return run;
  }

  get hasMore(): boolean {
    const pages = this.pageCount;
    return pages === null || this.loadedRun < pages;
  }

  cards(): ExplorerItem[] {
    const items: ExplorerItem[] = [];
    for (let page = 1; page <= this.loadedRun; page++) {
      items.push(...this.state.pages.get(page)!);
    }
    return items;
  }

  /** Fetches a page unless it's loaded or another fetch is running. */
  load(page: number): void {
    if (this.state.pages.has(page) || this.state.loading !== null) {
      return;
    }
    this.patch({ loading: page, failed: null });
    this.fetch(page).subscribe({
      next: response => {
        const pages = new Map(this.state.pages);
        pages.set(page, response.results);
        this.patch({ pages, count: response.count, facets: response.facets, loading: null });
      },
      error: () => this.patch({ loading: null, failed: page }),
    });
  }

  /** The cards' next batch. */
  loadMore(): void {
    if (this.hasMore) {
      this.load(this.loadedRun + 1);
    }
  }

  retry(): void {
    if (this.state.failed !== null) {
      this.load(this.state.failed);
    }
  }

  private patch(change: Partial<FeedState>): void {
    this.state$.next({ ...this.state, ...change });
  }
}
