import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';

/**
 * Session cache for large public catalogues, shared by every service that
 * reads them. Keyed by URL. Services that change a catalogue invalidate it.
 * Never use it for a user's own data.
 */
@Injectable({ providedIn: 'root' })
export class CatalogueCacheService {
  private entries = new Map<string, Observable<unknown>>();

  constructor(private http: HttpClient) {}

  get<T>(url: string): Observable<T> {
    let entry = this.entries.get(url) as Observable<T> | undefined;
    if (!entry) {
      entry = this.http.get<T>(url).pipe(
        catchError(error => {
          this.entries.delete(url); // don't replay a failure; the next call retries
          return throwError(() => error);
        }),
        shareReplay(1)
      );
      this.entries.set(url, entry);
    }
    return entry;
  }

  invalidate(url: string): void {
    this.entries.delete(url);
  }
}
