import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ExplorerService } from '../../services/explorer.service';

const LIST = '/explorador/produccion';

/** /explorador/produccion/:id: the Ficha on its own page, browse-only (R-20). */
@Component({
  selector: 'app-material-detail-page',
  templateUrl: './material-detail-page.component.html',
  styleUrls: ['./material-detail-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MaterialDetailPageComponent {
  readonly id$: Observable<number>;

  constructor(
    route: ActivatedRoute,
    private router: Router,
    private explorer: ExplorerService
  ) {
    this.id$ = route.paramMap.pipe(map(params => Number(params.get('id'))));
  }

  /** The list as it was left: its filters, view and page (HANDOFF §4). */
  get backUrl(): string {
    const last = this.explorer.lastListUrl;
    return last?.startsWith(LIST) ? last : LIST;
  }

  back(event: Event): void {
    event.preventDefault();
    void this.router.navigateByUrl(this.backUrl);
  }
}
