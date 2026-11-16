import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { UsageStageRoute } from '../usage-stage-route';

@Component({selector: 'app-usage-stage-update', templateUrl: '../usage-stage/usage-stage.component.html', standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class UsageStageUpdateComponent extends UsageStageRoute {
  constructor(router: Router) {super(router, true);}
}
