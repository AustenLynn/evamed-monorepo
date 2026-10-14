import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ExplorerPage, ExplorerQuery, PAGE_SIZE } from '../explorer.models';
import { StageKey } from '../stage-config';
import { ExplorerFeed, queryKey } from './explorer-feed';

@Injectable({ providedIn: 'root' })
export class ExplorerService {
  // One feed per stage and query, kept for the session so a list comes back
  // with its loaded batches and scroll position (HANDOFF §4).
  private readonly feeds = new Map<string, ExplorerFeed>();

  constructor(private http: HttpClient) {}

  page(stage: StageKey, query: ExplorerQuery, page: number): Observable<ExplorerPage> {
    let params = new HttpParams().set('page', page).set('page_size', PAGE_SIZE);
    if (query.search.trim()) {
      params = params.set('search', query.search.trim());
    }
    Object.keys(query.filters).sort().forEach(param => {
      query.filters[param].forEach(value => (params = params.append(param, value)));
    });
    return this.http.get<ExplorerPage>(`${environment.api_explorer}${stage}/`, { params });
  }

  feed(stage: StageKey, query: ExplorerQuery): ExplorerFeed {
    const key = `${stage}|${queryKey(query)}`;
    let feed = this.feeds.get(key);
    if (!feed) {
      feed = new ExplorerFeed(page => this.page(stage, query, page));
      this.feeds.set(key, feed);
    }
    return feed;
  }
}
