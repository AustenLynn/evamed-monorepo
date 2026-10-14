import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ExplorerItem, ExplorerQuery } from '../../explorer.models';
import { ExplorerService } from '../../services/explorer.service';
import { StageConfig, stageConfig } from '../../stage-config';
import { ExplorerView } from '../explorer-browser/explorer-browser.component';

interface PageState {
  stage: StageConfig;
  query: ExplorerQuery;
  view: ExplorerView;
  tablePage: number;
}

/**
 * One page for every stage (the route's data.stage picks the config). Search,
 * filters, view and table page live in the URL (HANDOFF §7.1).
 */
@Component({
  selector: 'app-explorer-page',
  templateUrl: './explorer-page.component.html',
  styleUrls: ['./explorer-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ExplorerPageComponent {
  readonly state$: Observable<PageState | null>;
  private stage?: StageConfig;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    explorer: ExplorerService
  ) {
    this.state$ = combineLatest([route.data, route.queryParamMap]).pipe(
      map(([data, params]) => {
        const stage = stageConfig(data['stage']);
        this.stage = stage;
        // A detail page goes back to exactly this list.
        explorer.lastListUrl = router.url;
        return stage ? ExplorerPageComponent.fromUrl(stage, params) : null;
      })
    );
  }

  static fromUrl(stage: StageConfig, params: ParamMap): PageState {
    const filters: Record<string, string[]> = {};
    stage.filters.forEach(filter => {
      const values = params.getAll(filter.urlParam);
      if (values.length) {
        filters[filter.param] = values;
      }
    });
    const page = Number(params.get('pagina'));
    return {
      stage,
      query: { search: params.get('buscar') ?? '', filters },
      view: params.get('vista') === 'tabla' ? 'tabla' : 'tarjetas',
      tablePage: Number.isInteger(page) && page > 1 ? page : 1,
    };
  }

  readonly linkFor = (item: ExplorerItem): unknown[] | null =>
    this.stage?.hasDetail ? ['/explorador', item.stage, item.id] : null;

  onQuery(state: PageState, query: ExplorerQuery): void {
    const params: Params = { buscar: query.search.trim() || null, pagina: null };
    state.stage.filters.forEach(filter => {
      const values = query.filters[filter.param] ?? [];
      params[filter.urlParam] = values.length ? values : null;
    });
    // Typing shouldn't fill the history with one entry per word.
    this.navigate(params, query.search !== state.query.search);
  }

  onView(view: ExplorerView): void {
    this.navigate({ vista: view === 'tabla' ? 'tabla' : null });
  }

  onTablePage(page: number): void {
    this.navigate({ pagina: page > 1 ? page : null });
  }

  private navigate(queryParams: Params, replaceUrl = false): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl });
  }
}
