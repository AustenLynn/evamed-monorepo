import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UsageStageComponent } from '../usage-stage/usage-stage.component';

/** Reopened projects use the same editor, lifecycle and persistence as new projects. */
@Component({selector: 'app-usage-stage-update', templateUrl: '../usage-stage/usage-stage.component.html',
  styleUrls: ['../usage-stage/usage-stage.component.scss'], standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class UsageStageUpdateComponent extends UsageStageComponent {}
