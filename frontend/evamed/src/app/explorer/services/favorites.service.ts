import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { StageKey } from '../stage-config';

const STORAGE_KEY = 'explorer-favorites';

/** Favourite catalogue items, kept in this browser only (K-16). */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly ids$ = new BehaviorSubject<ReadonlySet<string>>(this.read());

  readonly favorites$: Observable<ReadonlySet<string>> = this.ids$.asObservable();

  static key(stage: StageKey, id: number): string {
    return `${stage}:${id}`;
  }

  isFavorite(stage: StageKey, id: number): boolean {
    return this.ids$.value.has(FavoritesService.key(stage, id));
  }

  toggle(stage: StageKey, id: number): void {
    const ids = new Set(this.ids$.value),
      key = FavoritesService.key(stage, id);
    if (ids.has(key)) {
      ids.delete(key);
    } else {
      ids.add(key);
    }
    this.ids$.next(ids);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      // Private mode or full storage: favourites last for this visit only.
    }
  }

  private read(): ReadonlySet<string> {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return new Set(Array.isArray(stored) ? stored.filter(value => typeof value === 'string') : []);
    } catch {
      return new Set();
    }
  }
}
