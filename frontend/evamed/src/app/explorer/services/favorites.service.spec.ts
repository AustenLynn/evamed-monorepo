import { TestBed } from '@angular/core/testing';

import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('toggles a favourite and remembers it in this browser', () => {
    const favorites = TestBed.inject(FavoritesService);

    favorites.toggle('produccion', 12);
    expect(favorites.isFavorite('produccion', 12)).toBe(true);
    expect(favorites.isFavorite('uso', 12)).toBe(false);
    expect(JSON.parse(localStorage.getItem('explorer-favorites')!)).toEqual(['produccion:12']);

    favorites.toggle('produccion', 12);
    expect(favorites.isFavorite('produccion', 12)).toBe(false);
  });

  it('reads favourites saved earlier', () => {
    localStorage.setItem('explorer-favorites', JSON.stringify(['uso:3']));

    expect(TestBed.inject(FavoritesService).isFavorite('uso', 3)).toBe(true);
  });

  it('ignores unreadable storage', () => {
    localStorage.setItem('explorer-favorites', '{not json');

    expect(TestBed.inject(FavoritesService).isFavorite('uso', 3)).toBe(false);
  });

  it('still works when storage refuses writes', () => {
    const favorites = TestBed.inject(FavoritesService);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    favorites.toggle('produccion', 1);

    expect(favorites.isFavorite('produccion', 1)).toBe(true);
  });
});
