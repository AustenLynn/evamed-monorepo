import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** The region an item's name says it covers (R-44); nothing when it doesn't say. */
@Component({
  selector: 'app-region-chip',
  template: `
    <span *ngIf="region" class="region-chip" [title]="'Región: ' + region">
      <mat-icon class="region-chip__icon" aria-hidden="true">public</mat-icon>
      <span class="ev-visually-hidden">Región:</span>
      {{ region }}
    </span>
  `,
  styles: [
    `
      .region-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border: 1px solid var(--ev-border);
        border-radius: 999px;
        font-size: 12px;
        color: var(--ev-text);
        background: var(--ev-surface);
        white-space: nowrap;
      }
      .region-chip__icon {
        width: 14px;
        height: 14px;
        font-size: 14px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RegionChipComponent {
  @Input() region: string | null = null;
}
