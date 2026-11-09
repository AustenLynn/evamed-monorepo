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
