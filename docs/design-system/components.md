# Shared UI components and visual roles

Import `EvUiModule` from `src/app/shared/ui/ui.module.ts` in feature modules. Components are also standalone. Global visual roles are opt-in static attributes, not Angular directives: they add no event handling, validation or persistence.

## MenuShellComponent — `<app-ev-menu-shell>`

```html
<app-ev-menu-shell>
  <header evMenuHeader>
    <div><h1 evHeading="menu">Explorar materiales</h1><p>Contexto</p></div>
    <button mat-icon-button aria-label="Cerrar" [disabled]="saving" (click)="close()">…</button>
  </header>
  <!-- Body content -->
  <app-ev-selection-tray evMenuFooter *ngIf="selection.length" …>…</app-ev-selection-tray>
</app-ev-menu-shell>
```

The parent supplies a bounded height; the shell fills it. `[evMenuHeader]` and `[evMenuFooter]` are projection slots. The shell body is the sole main scroll owner. `body: ElementRef<HTMLElement>` exposes its scroll element for features that preserve list position across Ficha/edit navigation. It must not become another scroll area.

The caller retains MatDialog focus trapping/restoration, title ID, backdrop/Escape handling and pending-close restrictions. The shell does not close or save anything.

The shared header supplies Material dialog title tokens as well as heading styles, and removes the default title spacer. Verify headings inside a real MatDialog, not only an embedded preview: expected menu treatment is 20px, weight 700 and `--ev-green-text`. Material otherwise overrides a plain attribute selector.

## SelectionTrayComponent — `<app-ev-selection-tray>`

Inputs:

- `items: SelectionItem[]`, each `{ id: number; name: string }`.
- `label: string`: localized count/context announced as status.
- `disabled: boolean`: disables all remove buttons during saving.

Output: `remove: EventEmitter<number>` emits the exact ID. Project the caller's primary action inside the component. The caller owns its label, disabled state, batch save, partial failures and whether the tray is shown. Single-choice replacement must not show multi-add controls. Materials keep their existing conditional tray; equipment retains its add-mode tray even when empty.

Long names truncate visually but retain their title and full accessible remove label. The list wraps and has a bounded scroll at many selections. On mobile the action stacks below the selection.

## Visual roles

| Attribute | Purpose |
| --- | --- |
| `evSurface` | Shared white surface, border, 12px radius, 16px padding; feature layout may use documented compact/detail padding |
| `evHeading="menu\|detail\|section"` | Shared type roles and colour; retain appropriate semantic h1/h2/h3/legend |
| `evAction="primary"` | Use with `mat-flat-button`; green/black through Material tokens, including disabled behaviour |
| `evAction="secondary"` | Use with `mat-stroked-button`; Material outline/disabled treatment |
| `evAction="tertiary"` | Use with `mat-button`; readable green |
| `evAction="destructive"` | Use with `mat-button`; readable destructive colour |
| `evForm` | Compact outlined Material field density, inherited by descendants |
| `evFieldGroup` | Native fieldset surface and legend styling |
| `evActions` | Wrapping, right-aligned action row |
| `evStatus="loading\|error\|warning\|failure"` | Semantic status text/notices; caller provides status/alert/note roles as appropriate |

Shared roles live in `_ui.scss`. Keep layout/domain composition in the feature. Do not add universal Material overrides, raw feature colours or a new button variant without a documented decision.

## Domain patterns

Catalogue cards and editable equipment cards share surfaces and heading roles but keep distinct selection/expansion semantics. Ficha owns source/region/impact badges, facts and impact tables. Material edit owns transports, lifetime and validation. Equipment edit owns quantity/unit drafts and stable row identity. Do not force these into one configurable domain component.

## Development reference

Run the existing Angular development server and open `/design-system`. The page uses real explorer, Ficha and edit components with local synthetic providers, plus interactive shared action/tray states. It makes no project/catalogue API requests. Production and docker replace `reference.routes.ts` with an empty route list; the reference component is not imported by those builds.

## Quantity display

`QuantityDisplayPipe` (`quantityDisplay`), exported by `EvUiModule`, removes insignificant fractional zeros: `0.0000000000` → `0`, `12.000` → `12`, `12.500` → `12.5`. Equipment card quantities use this display role. It preserves decimal strings without numeric conversion or rounding; editing and persistence retain the original value. Other numeric roles, such as impact values, keep their existing formatting.

## Equipment catalogue filters and names

Construction and End of Life reuse `FilterPanelComponent`, `SourceChipComponent` and `RegionChipComponent` from `ExplorerUiModule`. Both stages consume the existing construction explorer metadata: raw `name`, readable `display_name`, `source`, `region`, and `type`. Full names remain in title text and search; no arbitrary name truncation is applied.

The filter panel accepts optional `disabled` (default false) to lock inputs, checkboxes, clear and pending search while saving. Disabling restores the applied query text; queued typing cannot unexpectedly filter after saving, and the same term can be entered again after re-enable. Database/type/region groups support multiple values: OR within a group, AND across groups. Counts exclude their own group and preserve catalogue options at zero; clearing filters keeps selections. Missing values are shown as `Sin base de datos` / `Sin región`, not inferred from pins or names again in the frontend.

Main equipment cards show the readable title and separate database/region chips, preserving quantity display and inline drafts. All metadata pages are loaded before local filtering; source IDs, units, persistence and calculation contracts remain unchanged.

## Equipment card alignment

Collapsed equipment cards share title, quantity, edit, metadata and delete tracks within each grid row, so long names remain readable without shifting neighbouring actions. The footer keeps metadata and Delete on separate rows. An expanded inline editor returns cards to independent heights, preventing blank stretched neighbours. Single-column/mobile cards retain natural title height. Browsers without CSS subgrid retain equal-height flex cards with consistent footer order.

## Shared stage presentation and Usage

`styles/_stage-cards.scss` exposes `cards($prefix)`, consumed by the equipment panel and Usage source panel. It shares the existing 12px card radius, 20px/16px/12px summary padding, 16px/700 title, 26px quantity and 13px unit, aligned collapsed tracks and independent expanded editor heights. It contains no persistence or equipment/source domain logic.

`styles/_project-stage.scss` exposes `shell($active)` for the existing Construction/Usage frame and `columns` for the 20% annual sidebar / 80% sources layout. At 390px, columns stack at full width. Usage uses native keyboard-accessible buttons with the existing navigation images; its active stage remains noninteractive.

The Usage catalogue composes MenuShell, FilterPanel, SelectionTray and database/region chips, with the equipment menu's 75% height. Add mode retains selection across filters; replacement has no tray and only patches a source draft. Pending or uncertain operations lock the submitted selection until confirmed state is read.

## Compact main-stage lists

Construction, Usage and End of Life share a list-only variant in `stage-cards.cards($prefix)`. List rows use the Materials name/quantity/action hierarchy: 13px readable names, 14px tabular quantities, small unit labels and 40px edit/delete targets. Usage retains its saved percentage in the collapsed row. Rows share one outlined container and dividers, rather than repeating full card spacing. Long names wrap naturally; at600px and below the name sits above quantity/share and controls.

Database and region badges appear only in the expanded list row, as approved by the owner. Card mode retains its existing metadata and styling. The same inline form expands below its row; changing views does not reset drafts or save. Card subgrid alignment is scoped to card mode. Empty lists do not render an outlined empty strip. This variant applies to the main stages; catalogue menus retain their own list presentation.
