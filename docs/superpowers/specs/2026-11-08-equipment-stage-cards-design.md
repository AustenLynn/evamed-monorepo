# Equipment cards for Construcción and Fin de vida

Status: implemented locally and frontend-verified, 2026-11-08; backend contract tests await CI.

## Owner decisions and design authority

- Both stages should show added equipment as cards, with an Agregar catalogue similar to Materiales.
- Editing expands **inside the selected card**, rather than in a separate side panel.
- Maintain the existing EVAMED design system and consistency across pages.
- Batch addition only selects equipment: no quantity or unit control is required there. Add at quantity 0 with a blank unit; edit those fields later in the main stage, following Materiales.
- Owner subsequently authorized implementation. Commit, push, and deployment require a separate request.

The implementation references are `frontend/evamed/src/styles.scss`,
`frontend/evamed/src/styles/_explorer.scss`, and the existing explorer card,
picker, and form components. The Superdesign prototype is a flow reference,
not a replacement design system or an authoritative data source. Its side
editor is superseded by the inline-card decision.

Prototype: https://p.superdesign.dev/draft/12509189-92d5-46a2-8668-7236fa1c79e5

## Design consistency requirements

- No new dependencies, frontend or backend.
- Angular 22 NgModules; new components use `standalone: false`.
- Use existing `--ev-*` tokens; no raw hex in new component SCSS.
- Inherit the app's typography; do not introduce fonts, colours, branding, or a competing Material theme.
- Reuse Material controls and Material Icons, existing button treatments, card borders/radii, spacing, and focus styles.
- Keep the existing header, footer, stage navigation, building-element selection, and standard page width.
- Keep calculations, fixtures, and database schema unchanged.
- Commit and push only on the owner's explicit request.

Cards use the explorer's 12px radius, 16px grid gap, and 16–24px padding.
At the standard 65rem page width, use two columns when space permits and one
on narrow screens; never shrink form controls to force a third column.
The expanded card retains its grid column and contains a single-column form.
Align neighbouring cards to the top. Allow the page to grow instead of
clipping content in the legacy fixed 26rem stage container. There is one
scroll owner per region, with no scrollbar inside each expanded card.

## Proposed behaviour

For each building element, show the equipment already saved in that stage.
An empty element has a clear empty state and **Agregar equipo**. Default to
cards, with a compact **Tarjetas / Lista** switch following the existing explorer.
Both views operate on the same records and preserve the selection/draft.

Each card shows the real source name, quantity, and unit label. A blank unit
is displayed as **Sin unidad** with an **Editar** action; do not infer a unit.
A newly added card is a saved row at quantity 0 and unit null, not an ephemeral
selection that vanishes on refresh.
Keep the full source name available when visually clamped. Source IDs and
record IDs are distinct: two intentional rows using one source remain two cards.
Do not invent GWP values, impact badges, source databases, power values, or
equipment reference units. Source/region chips are optional and may only use
verified metadata; the initial implementation can omit them.

Clicking a card or **Editar** expands its form inside that card. Only one
editor is expanded at a time. Its fields are source (**Cambiar equipo**),
quantity, and unit, followed by **Guardar cambios** and **Cancelar**.
Keep edited values separate from committed rows: autosave and totals must
not consume an unfinished edit. Preserve an editor draft when switching
between cards or building elements in the same mounted page; clear it on
Save or Cancel. Switching projects clears all old project drafts.

**Cambiar equipo** opens a single-choice catalogue; clicking a source returns
directly to the expanded card and preserves the typed quantity and unit.
Only **Guardar cambios** persists that replacement. **Cancelar** restores
the saved source and values. **Eliminar** is an explicit separate action;
clicking it never expands the card or deletes neighbouring rows.

### Agregar catalogue

- Reuse the Materiales bottom-sheet pattern: full width, 75dvh, light backdrop,
  close button/Esc, a single scrolling body, and visible selection/action area.
- Search the cached current source catalogue, with the existing exclusion of
  `Mexicaniuh - CADIS`; do not copy the mockup's example catalogue into the app.
- Offer type filters derived from names: Generador, Maquinaria ligera,
  Maquinaria pesada, Otros; use the same classification rules as the explorer.
- Support selecting one or several sources; selection survives search and view changes.
- Owner decision: **Agregar N equipos** needs only a source selection. There
  are no batch quantity or unit controls. Persist each chosen source with
  quantity **0** and the stage's unit field explicitly **null**.
- Fill quantity and unit later on the main stage, inside the selected card.
  A blank quantity normalizes to 0, as in Materiales; a blank unit remains null.
  Save and Cancel preserve that distinction, including source replacement.
- Load unit IDs and labels from the appropriate real unit catalogue, never
  infer them from equipment names or copy the prototype's defaults.
- Save each selected source once, retain successful rows, and offer retry only
  for failed selections. Disable repeat opening/submission and premature close
  while an add is being saved, preserving the Materiales duplicate-add fixes.
- Closing before submission makes no changes. No required technical Ficha step.

Construction and deconstruction share the same source catalogue. Fin de vida
continues to manage **deconstruction energy (C1)**. Waste-treatment scenarios,
recycling, landfill, C2–C4 factors, and new calculations are outside this scope.

## Existing code facts and persistence requirements

Cover all four routes: `/construction-stage`, `/construction-stage/update`,
`/end-life-stage`, `/end-life-stage/update`. A reopened project with no saved
stage data can reach the route without `/update`; these routes cannot assume
an imported Excel exists.

The live forms use **all** returned energy units. Hours-only filters in their
constructors are commented out or produce unused arrays. The mockup's example
units are not evidence of a source's reference unit.

Existing save paths need replacement for the equipment region:

- New construction `saveStepTwo()` POSTs every complete EC row on each save
  without retaining returned IDs; repeated saves can duplicate records.
- Update pages use delete-and-recreate operations for edits. A failed creation
  can leave a deleted record; overlapping callbacks complicate row identity.
- New-page `removeFormEC(i)` uses `splice(i)`, removing subsequent rows too.
  Construction update uses `splice(i, i)`, removing the wrong number of rows.
- These are source-code findings, not a claim that production data was inspected.

Use existing DRF ModelViewSet endpoints: POST for a new record, PATCH for an
existing record, and DELETE for exactly the selected persisted ID. Do not add
a bulk replacement endpoint or rewrite a whole section. Both serializers
already support partial updates. Both models allow null unit references, so
blank-unit batch creation needs no new schema. Pin that with API contract tests
before wiring the UI; do not assume integer IDs mean the same unit in two tables.

Resolve the construction energy-process ID from the existing
`constructive-process` catalogue by the exact name
`Energía consumida durante el proceso constructivo`; do not introduce a new
assumption that its ID is always 1. Preserve existing water/waste records and
their unit fields, even though this interface edits energy rows only.

Pass project and section IDs explicitly, capture the mutation target before
async work, retain server IDs and unedited decimal quantities, and block
overlapping writes to one row. No automatic POST retry after an ambiguous
network failure. Never silently clean up historical duplicate records.

Replace only the old EC save triggers for this region, including navigation,
blur, and timer callbacks. They must not run alongside the new component.
Existing stage navigation and energy-bar algorithms stay intact. Refresh the
bar from the correct project's committed server state; drafts do not count.

### Unit and quantity contract found during the blank-value review

`ConstructiveSystemElement.energy_unit_id` references **EnergyUnit** and its
quantity is decimal. `ElectricityConsumptionDeconstructiveProcess.unit_id`
references **Unit**, and its quantity is integer. The current end-life forms
nevertheless offer EnergyUnit IDs. The fixture demonstrates why IDs cannot be
copied between catalogues: EnergyUnit 2 is Hrs; Unit 2 is Kg; MJ has different
IDs in the two tables. These are existing model/UI mismatches, not new owner
requirements or permission to migrate data.

For implementation, construction uses EnergyUnit IDs directly. End-life unit
choices must resolve energy-unit labels against the live **Unit** catalogue
by exact normalized name, use the resulting Unit IDs, and offer only supported
matches. Keep unmatched energy choices unavailable rather than fabricating a
mapping. Display legacy references using their actual Unit labels and preserve
their IDs on unrelated edits; never silently reinterpret or rewrite them.
Broadening end-life units or decimal support would require a separate data/model
decision. The initial card feature and blank-unit addition do not depend on it.

Initial rows at quantity 0 contribute zero under the existing result logic.
A missing unit is not a new calculation exclusion: existing calculations use
source and quantity. Do not claim that this UI change adds unit conversion or
changes impact semantics when a quantity is filled before its unit.

## Acceptance

- Both stages and both route variants use the same reusable card, inline editor,
  catalogue sheet, controls, and style rules.
- Saving updates one record; repeated actions do not duplicate it; deleting one
  row leaves neighbours and other sections/projects unchanged.
- Cancel, source replacement, partial batch failures, unavailable catalogue
  references, and section/project changes preserve the expected records.
- Zero and blank inputs work: blank quantity becomes 0, blank unit remains null,
  and added cards survive refresh with those values. Nonblank quantities must be
  finite and nonnegative. Construction supports decimals; the current end-life
  API accepts integers, so fractional end-life submissions must not be rounded
  silently or presented as saved. Legacy records are not silently corrected.
- Keyboard controls, focus return, accessible labels, loading/error/empty
  states, and a usable 390px layout are included.
- Compare Materials, Construction, and Fin de vida side by side at 1440px and
  390px; confirm no new design vocabulary or nested scrollbars.
- Full frontend tests, touched-file lint, and production build pass. Backend
  contract checks run in CI if any backend tests are added.

## Implementation verification — 2026-11-08

Shared cards/list, inline drafts, source-only batch picker and stable-ID persistence are implemented across all four routes. Untouched construction quantities retain their original decimal string through source/unit edits; end-life quantities retain the existing integer contract. Explicit project totals initialization and response guards prevent stale totals. Save/Cancel/Delete return keyboard focus to a surviving card or Add.

Frontend verification: 421 tests passed, production build passed, touched TypeScript/templates passed ESLint. Existing style-budget and file-saver CommonJS build warnings remain. Real built-app browser checks used intercepted API fixtures: all four routes rendered at 390px without document overflow; construction/update also checked at 1440px, including inline editing and batch POST with quantity 0/unit null. No browser exceptions occurred. Backend contract tests were added and syntax checked; execution awaits CI.

Responsive corrections retain the design tokens and content: the four stage layouts use a contained horizontal element rail on mobile; header row margins and mobile footer wrapping were corrected to prevent page overflow. No calculation, schema, fixture, or backend production code changed.
