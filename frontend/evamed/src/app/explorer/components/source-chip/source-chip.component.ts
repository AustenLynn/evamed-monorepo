import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

// The app's database logos (assets/logos); ecoinvent has none.
const LOGOS: Record<string, string> = {
  EPiC: 'assets/logos/EPIC.png',
  EPDs: 'assets/logos/EPD.png',
  mexicaniuh: 'assets/logos/MEXICANIUH.png',
};

/** The database an item comes from, with its logo when the app has one. */
@Component({
  selector: 'app-source-chip',
  template: `
    <span *ngIf="source" class="source-chip">
      <img *ngIf="logo" class="source-chip__logo" [src]="logo" alt="" height="16" />
      {{ source }}
    </span>
  `,
  styles: [
    `
      .source-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        border: 1px solid var(--ev-border);
        border-radius: 999px;
        font-size: 12px;
        color: var(--ev-text);
        background: var(--ev-surface);
        white-space: nowrap;
      }
      .source-chip__logo {
        height: 16px;
        width: auto;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SourceChipComponent {
  @Input() source: string | null = null;

  get logo(): string | undefined {
    return this.source ? LOGOS[this.source] : undefined;
  }
}
