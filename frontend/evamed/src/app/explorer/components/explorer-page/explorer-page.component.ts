import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { StageConfig, stageConfig } from '../../stage-config';

/** One page for every stage; the route's data.stage picks the config. */
@Component({
  selector: 'app-explorer-page',
  templateUrl: './explorer-page.component.html',
  styleUrls: ['./explorer-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ExplorerPageComponent {
  readonly stage$: Observable<StageConfig | undefined>;

  constructor(route: ActivatedRoute) {
    this.stage$ = route.data.pipe(map(data => stageConfig(data['stage'])));
  }
}
