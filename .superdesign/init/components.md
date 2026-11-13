# Shared UI primitives
Angular 22 NgModules, Material components, RxJS; preserve standalone:false. Cards and badges below define the existing visual language.
## `frontend/evamed/src/app/material/material.module.ts`
```ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatTableModule } from '@angular/material/table';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { LayoutModule } from '@angular/cdk/layout';
import { MatStepperModule } from '@angular/material/stepper';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule} from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatBadgeModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatTableModule,
    MatSidenavModule,
    MatListModule,
    LayoutModule,
    MatStepperModule,
    MatGridListModule,
    MatDialogModule,
    MatExpansionModule,
    MatTabsModule,
    MatMenuModule,
    MatCheckboxModule,
    MatAutocompleteModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatButtonToggleModule,
    MatPaginatorModule,
    MatTooltipModule
  ],
  exports: [
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatBadgeModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatTableModule,
    MatSidenavModule,
    MatListModule,
    LayoutModule,
    MatStepperModule,
    MatGridListModule,
    MatDialogModule,
    MatExpansionModule,
    MatTabsModule,
    MatMenuModule,
    MatCheckboxModule,
    MatAutocompleteModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatButtonToggleModule,
    MatPaginatorModule,
    MatTooltipModule
  ]
})
export class MaterialModule { }

```

## `frontend/evamed/src/app/explorer/components/result-card/result-card.component.html`
```html
<article class="result-card" tabindex="-1">
  <header class="result-card__header">
    <h3 class="result-card__name">
      <a *ngIf="link; else openOrPlain" [routerLink]="link">{{ item.display_name }}</a>
      <ng-template #openOrPlain>
        <button *ngIf="openable; else plainName" type="button" class="result-card__open" (click)="itemOpen.emit()">
          {{ item.display_name }}
        </button>
      </ng-template>
      <ng-template #plainName>{{ item.display_name }}</ng-template>
    </h3>
    <mat-checkbox
      *ngIf="selectable"
      class="result-card__check"
      [checked]="selected"
      [aria-label]="'Seleccionar: ' + item.display_name"
      (change)="selectToggle.emit()"
    ></mat-checkbox>
  </header>

  <p class="result-card__description" [title]="item.description || ''">
    {{ item.description || item.category || '' }}
  </p>

  <div class="result-card__impact">
    <span class="result-card__gwp" [class.result-card__gwp--credit]="item.gwp !== null && item.gwp < 0">
      {{ item.gwp | gwp }}
    </span>
    <span class="result-card__unit">
      kg CO₂e {{ item.unit ? '/ ' + item.unit : 'por unidad de referencia' }}
    </span>
    <app-impact-badge [level]="item.impact_level"></app-impact-badge>
  </div>

  <footer class="result-card__footer">
    <app-source-chip [source]="item.source"></app-source-chip>
    <app-region-chip [region]="item.region"></app-region-chip>
  </footer>
</article>

```

## `frontend/evamed/src/app/explorer/components/result-card/result-card.component.scss`
```scss
:host {
  display: block;
}

.result-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 190px;
  box-sizing: border-box;
  padding: 16px;
  background: var(--ev-surface);
  border: 1px solid var(--ev-border);
  border-radius: 12px;

  &:focus-visible {
    outline: 2px solid var(--ev-green-text);
    outline-offset: 2px;
  }
}

.result-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.result-card__name {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--ev-text);
  overflow-wrap: anywhere;

  a,
  .result-card__open {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
    color: inherit;
    text-decoration: none;

    &:hover,
    &:focus-visible {
      color: var(--ev-green-text);
      text-decoration: underline;
    }
  }
}

.result-card__check {
  flex: none;
  margin: -10px -10px 0 0;
}

.result-card__description {
  margin: 6px 0 12px;
  font-size: 13px;
  color: var(--ev-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 1.2em;
}

.result-card__impact {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.result-card__gwp {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--ev-text);
}

.result-card__gwp--credit {
  color: var(--ev-green-text);
}

.result-card__unit {
  font-size: 12px;
  color: var(--ev-text-muted);
}

.result-card__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
  padding-top: 12px;
}

```

## `frontend/evamed/src/app/explorer/components/result-card/result-card.component.spec.ts`
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ExplorerItem } from '../../explorer.models';
import { ExplorerUiModule } from '../../explorer-ui.module';
import { ResultCardComponent } from './result-card.component';

describe('ResultCardComponent', () => {
  const item: ExplorerItem = {
      id: 12,
      stage: 'produccion',
      name: 'Concreto_AAC block',
      display_name: 'AAC block',
      category: 'Concreto',
      region: null,
      description: 'Bloque de concreto celular',
      source: 'EPiC',
      unit: 'Pz',
      gwp: 12.3456,
      impact_level: 'bajo',
    },
    render = (inputs: Partial<{ item: ExplorerItem; link: unknown[] | null }> = {}) => {
      TestBed.configureTestingModule({ imports: [ExplorerUiModule], providers: [provideRouter([])] });
      const fixture = TestBed.createComponent(ResultCardComponent);
      fixture.componentRef.setInput('item', inputs.item ?? item);
      if (inputs.link !== undefined) {
        fixture.componentRef.setInput('link', inputs.link);
      }
      fixture.detectChanges();
      return { fixture, el: fixture.nativeElement as HTMLElement };
    };

  it('shows the name, description, GWP per unit, impact and database', () => {
    const { el } = render();

    expect(el.querySelector('.result-card__name')?.textContent?.trim()).toBe('AAC block');
    expect(el.querySelector('.result-card__description')?.textContent?.trim()).toBe('Bloque de concreto celular');
    expect(el.querySelector('.result-card__gwp')?.textContent?.trim()).toBe('12.346');
    expect(el.querySelector('.result-card__unit')?.textContent?.trim()).toBe('kg CO₂e / Pz');
    expect(el.querySelector('app-impact-badge')?.textContent).toContain('Bajo impacto');
    expect(el.querySelector('app-source-chip img')?.getAttribute('src')).toBe('assets/logos/EPIC.png');
    // EPiC names don't say a region (R-44).
    expect(el.querySelector('.region-chip')).toBeNull();
  });

  it('shows the region the name says next to the database', () => {
    const { el } = render({ item: { ...item, region: 'Resto del mundo' } }),
      chip = el.querySelector('.result-card__footer .region-chip')!;

    expect(chip.querySelector('.ev-visually-hidden')?.textContent).toBe('Región:');
    expect(chip.textContent).toContain('Resto del mundo');
    expect(chip.getAttribute('title')).toBe('Región: Resto del mundo');
  });

  it('says "por unidad de referencia" when the data has no unit (R-04)', () => {
    const { el } = render({ item: { ...item, unit: null, impact_level: null } });

    expect(el.querySelector('.result-card__unit')?.textContent?.trim()).toBe('kg CO₂e por unidad de referencia');
    expect(el.querySelector('.impact-badge')).toBeNull();
  });

  it('links the name only when given a link', () => {
    expect(render().el.querySelector('.result-card__name a')).toBeNull();
    TestBed.resetTestingModule();

    const link = render({ link: ['/explorador', 'produccion', 12] }).el.querySelector('.result-card__name a');
    expect(link?.getAttribute('href')).toBe('/explorador/produccion/12');
  });

  it('shows a negative value as a green credit with a true minus', () => {
    const { el } = render({ item: { ...item, gwp: -1.5, impact_level: 'credito' } }),
      gwp = el.querySelector('.result-card__gwp')!;

    expect(gwp.textContent?.trim()).toBe('−1.5');
    expect(gwp.classList).toContain('result-card__gwp--credit');
  });
});

```

## `frontend/evamed/src/app/explorer/components/result-card/result-card.component.ts`
```ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { ExplorerItem } from '../../explorer.models';

@Component({
  selector: 'app-result-card',
  templateUrl: './result-card.component.html',
  styleUrls: ['./result-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ResultCardComponent {
  @Input({ required: true }) item!: ExplorerItem;
  /** Where the name leads; null keeps it plain text. */
  @Input() link: unknown[] | null = null;
  /** Without a link, the name can still open the item through itemOpen (the picker). */
  @Input() openable = false;
  /** The picker: a checkbox adds the item to the selection. */
  @Input() selectable = false;
  @Input() selected = false;
  @Output() readonly itemOpen = new EventEmitter<void>();
  @Output() readonly selectToggle = new EventEmitter<void>();
}

```

## `frontend/evamed/src/app/explorer/components/impact-badge/impact-badge.component.html`
```html
<span *ngIf="badge as badge" class="impact-badge" [ngClass]="'impact-badge--' + level">
  <span class="impact-badge__gauge" aria-hidden="true">
    <mat-icon *ngIf="level === 'credito'; else dots" class="impact-badge__icon">recycling</mat-icon>
    <ng-template #dots>
      <span *ngFor="let dot of gauge" class="impact-badge__dot" [class.impact-badge__dot--on]="dot <= badge.dots"></span>
    </ng-template>
  </span>
  {{ badge.label }}
</span>

```

## `frontend/evamed/src/app/explorer/components/impact-badge/impact-badge.component.scss`
```scss
.impact-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.impact-badge--bajo,
.impact-badge--credito {
  background: var(--ev-impact-low-bg);
  color: var(--ev-impact-low-text);
}

.impact-badge--medio {
  background: var(--ev-impact-mid-bg);
  color: var(--ev-impact-mid-text);
}

.impact-badge--alto {
  background: var(--ev-impact-high-bg);
  color: var(--ev-impact-high-text);
}

.impact-badge__gauge {
  display: inline-flex;
  gap: 3px;
}

.impact-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px currentColor;
  opacity: 0.6;
}

.impact-badge__dot--on {
  background: currentColor;
  box-shadow: none;
  opacity: 1;
}

.impact-badge__icon {
  width: 14px;
  height: 14px;
  font-size: 14px;
}

```

## `frontend/evamed/src/app/explorer/components/impact-badge/impact-badge.component.spec.ts`
```ts
import { TestBed } from '@angular/core/testing';

import { ImpactLevel } from '../../explorer.models';
import { ExplorerUiModule } from '../../explorer-ui.module';
import { ImpactBadgeComponent } from './impact-badge.component';

describe('ImpactBadgeComponent', () => {
  const render = (level: ImpactLevel) => {
    TestBed.configureTestingModule({ imports: [ExplorerUiModule] });
    const fixture = TestBed.createComponent(ImpactBadgeComponent);
    fixture.componentRef.setInput('level', level);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it.each([
    ['bajo', 'Bajo impacto', 1],
    ['medio', 'Impacto medio', 2],
    ['alto', 'Alto impacto', 3],
  ] as const)('shows %s with its label and %i filled dots', (level, label, filled) => {
    const el = render(level);

    expect(el.textContent?.trim()).toBe(label);
    expect(el.querySelectorAll('.impact-badge__dot').length).toBe(3);
    expect(el.querySelectorAll('.impact-badge__dot--on').length).toBe(filled);
    expect(el.querySelector('.impact-badge__gauge')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows a credit with the recycling icon and no dots', () => {
    const el = render('credito');

    expect(el.textContent).toContain('Crédito ambiental');
    expect(el.querySelectorAll('.impact-badge__dot').length).toBe(0);
  });

  it('shows nothing without a level', () => {
    expect(render(null).querySelector('.impact-badge')).toBeNull();
  });
});

```

## `frontend/evamed/src/app/explorer/components/impact-badge/impact-badge.component.ts`
```ts
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

```

## `frontend/evamed/src/app/explorer/components/source-chip/source-chip.component.ts`
```ts
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

```

## `frontend/evamed/src/app/explorer/components/region-chip/region-chip.component.ts`
```ts
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

```
