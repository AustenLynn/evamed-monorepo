import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { StageKey, STAGES } from '../../stage-config';

/** The four stage tabs, drawn like the stage pages' stepper. */
@Component({
  selector: 'app-stage-tabs',
  templateUrl: './stage-tabs.component.html',
  styleUrls: ['./stage-tabs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class StageTabsComponent {
  @Input() current: StageKey | null = null;

  readonly stages = STAGES;
}
