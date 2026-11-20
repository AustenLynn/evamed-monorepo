import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface ExcludedMaterial {
  row_id: number;
  material_id: number;
  name: string | null;
  database: string | null;
  section: string | null;
  /** 'old_method', or 'missing:<short names>' */
  reason: string;
}

export interface ExcludedEntry {
  id: number;
  name: string;
}

/** What GET /projects/<id>/results/ left out under EN 15804+A2. */
export interface ResultsExcluded {
  materials: ExcludedMaterial[];
  no_mass: { row_id: number; material_id: number; name: string }[];
  transport: ExcludedEntry[];
  energy: ExcludedEntry[];
  sources: ExcludedEntry[];
}

/** Lists what a project's results don't include, so the user can swap it for A2 data. */
@Component({
  selector: 'app-excluded-notice',
  templateUrl: './excluded-notice.component.html',
  styleUrls: ['./excluded-notice.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExcludedNoticeComponent {
  readonly excluded = input<ResultsExcluded | null | undefined>();

  protected readonly view = computed(() => {
    const value = this.excluded();
    if (!value) return null;
    const factors = [...value.transport, ...value.energy, ...value.sources],
      hasAny = value.materials.length || value.no_mass.length || factors.length;
    return hasAny ? { ...value, factors } : null;
  });

  protected missing(reason: string): string | null {
    return reason.startsWith('missing:') ? reason.slice('missing:'.length).split(',').join(', ') : null;
  }
}
