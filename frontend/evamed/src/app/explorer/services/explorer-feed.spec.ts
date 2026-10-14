import { Subject, throwError } from 'rxjs';

import { ExplorerItem, ExplorerPage } from '../explorer.models';
import { ExplorerFeed } from './explorer-feed';

const item = (id: number) => ({ id }) as ExplorerItem,
  page = (ids: number[], count: number): ExplorerPage => ({
    count,
    next: null,
    previous: null,
    results: ids.map(item),
    facets: { sources: { EPiC: count } },
  });

describe('ExplorerFeed', () => {
  const setup = () => {
    const responses = new Map<number, Subject<ExplorerPage>>(),
      fetch = vi.fn((n: number) => {
        responses.set(n, new Subject<ExplorerPage>());
        return responses.get(n)!;
      }),
      answer = (n: number, response: ExplorerPage) => {
        responses.get(n)!.next(response);
        responses.get(n)!.complete();
      };
    return { feed: new ExplorerFeed(fetch), fetch, answer };
  };

  it('starts empty and loads the first batch', () => {
    const { feed, answer } = setup();

    expect(feed.hasMore).toBe(true);
    feed.loadMore();
    expect(feed.state.loading).toBe(1);
    answer(1, page([1, 2], 30));

    expect(feed.cards().map(card => card.id)).toEqual([1, 2]);
    expect(feed.state.count).toBe(30);
    expect(feed.state.facets).toEqual({ sources: { EPiC: 30 } });
    expect(feed.state.loading).toBeNull();
  });

  it('appends the next batch and stops at the last page', () => {
    const { feed, fetch, answer } = setup();
    feed.loadMore();
    answer(1, page([1], 30));
    feed.loadMore();
    answer(2, page([2], 30));

    expect(feed.cards().map(card => card.id)).toEqual([1, 2]);
    expect(feed.hasMore).toBe(false);
    feed.loadMore();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('runs one fetch at a time', () => {
    const { feed, fetch } = setup();

    feed.loadMore();
    feed.loadMore();
    feed.load(3);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('never fetches a loaded page again', () => {
    const { feed, fetch, answer } = setup();
    feed.load(1);
    answer(1, page([1], 30));

    feed.load(1);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('cards stop at the first gap: a table page further on is not shown as a card', () => {
    const { feed, answer } = setup();
    feed.load(1);
    answer(1, page([1], 100));
    feed.load(3);
    answer(3, page([3], 100));

    expect(feed.cards().map(card => card.id)).toEqual([1]);
    feed.loadMore();
    expect(feed.state.loading).toBe(2);
  });

  it('remembers a failed page and retries it', () => {
    const fetch = vi.fn().mockReturnValueOnce(throwError(() => new Error('offline'))),
      feed = new ExplorerFeed(fetch);
    feed.loadMore();
    expect(feed.state.failed).toBe(1);

    const retry = new Subject<ExplorerPage>();
    fetch.mockReturnValueOnce(retry);
    feed.retry();
    expect(feed.state.failed).toBeNull();
    retry.next(page([1], 1));

    expect(feed.cards().map(card => card.id)).toEqual([1]);
    expect(fetch).toHaveBeenCalledWith(1);
  });

  it('an empty result has no more pages', () => {
    const { feed, answer } = setup();
    feed.loadMore();
    answer(1, page([], 0));

    expect(feed.hasMore).toBe(false);
    expect(feed.cards()).toEqual([]);
  });
});
