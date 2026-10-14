import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { ImpactLevel } from '../../explorer.models';

const LABELS: Record<Exclude<ImpactLevel, null>, { label: string; dots: number }> = {
  bajo: { label: 'Bajo impacto', dots: 1 },
  medio: { label: 'Impacto medio', dots: 2 },
  alto: { label: 'Alto impacto', dots: 3 },
  credito: { label: 'Crédito ambiental', dots: 0 },
};

/** The impact level as a pill with a 3-dot gauge; the label carries the meaning. */
@Component({
  selector: 'app-impact-badge',
  templateUrl: './impact-badge.component.html',
  styleUrls: ['./impact-badge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ImpactBadgeComponent {
  @Input() level: ImpactLevel = null;

  readonly gauge = [1, 2, 3];

  get badge() {
    return this.level ? LABELS[this.level] : null;
  }
}
