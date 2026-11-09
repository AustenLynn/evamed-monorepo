# Equipment Stage Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Construcción and Fin de vida consistent equipment cards, an editor expanded inside the selected card, and a Materiales-style add catalogue.

**Architecture:** A shared `EquipmentStageUiModule` supplies a stage panel and catalogue dialog to all four existing stage routes. A small adapter uses the existing owned CRUD endpoints, while the panel owns committed records, separate edit drafts, and per-row request state. Catalogue data comes from the existing cached services; the app's design tokens and Material controls remain authoritative.

**Tech Stack:** Angular 22 NgModules, Angular Material, RxJS, existing HttpClient services, Vitest; existing Django/DRF endpoints.

**Spec:** `docs/superpowers/specs/2026-11-08-equipment-stage-cards-design.md`

Status: planning draft for owner review, updated with the owner's batch-add decision: no quantity/unit entry in the picker; persist quantity 0 and unit null, then edit on the main stage. Do not update the canvas or application in this planning round.

## Global Constraints

- No new dependencies, frontend or backend.
- Angular 22 NgModules; new components use `standalone: false`.
- Use existing `--ev-*` tokens; no raw hex in new component SCSS.
- Inherit the app's typography; do not introduce fonts, colours, branding, or a competing Material theme.
- Reuse Material controls and Material Icons, existing button treatments, card borders/radii, spacing, and focus styles.
- Keep the existing header, footer, stage navigation, building-element selection, and standard page width.
- Keep calculations, fixtures, and database schema unchanged.
- Commit and push only on the owner's explicit request.

## Review Focus

1. Project A is open while localStorage still names B, or a section changes during a request: only the captured project/section changes. Tasks 1 and 4 test this.
2. Two rows use one source, or a legacy source/unit is missing from the catalogue: identities remain distinct and no stored value is silently replaced. Tasks 1 and 3 test this.
3. Add succeeds for one source and fails for another, or a POST outcome is unknown: successful rows are not submitted again. Tasks 1 and 2 test this.
4. Quantity 0, blank unit, decimal comma, and high-precision existing values: preserve nullable fields, distinguish construction decimal from end-life integer contracts, and never truncate on load. Tasks 1 and 3 test this.
5. Opening another card, switching views/elements, or cancelling a replacement while a lookup loads: drafts and focus follow the intended card without background writes. Tasks 2–4 test this.

## Files and boundaries

Create `frontend/evamed/src/app/equipment-stage/`:

- `equipment.models.ts`: shared row, catalogue, draft, result, and stage types.
- `equipment-catalogue.service.ts`, `.spec.ts`: cached source/unit/process lookup, stage-correct unit ID resolution, and source-name filtering/classification.
- `equipment-rows.service.ts`, `.spec.ts`: adapt existing API payloads; preserve row IDs, project and section targets.
- `equipment-picker.service.ts`: one active equipment dialog; separate from Materiales' material-specific picker.
- `equipment-picker.component.ts`, `.html`, `.scss`, `.spec.ts`: add/replace catalogue, source-only batch selection, and partial-save results.
- `equipment-stage-panel.component.ts`, `.html`, `.scss`, `.spec.ts`: grid/list, per-card inline editor, drafts, persistence coordination, loading/error states.
- `equipment-stage-ui.module.ts`: declare the new non-standalone components and export the panel; import CommonModule, Forms/ReactiveForms, MaterialModule as needed.

Create the backend blank-unit API contract test named in Task 1 (test coverage only; no schema or calculation change). Modify the cached `core/services/catalogs/catalogs.service.ts` and both environment files to expose the existing `/constructive-process/` catalogue. Add PATCH helpers to the existing construction/end-life services. Modify both stage modules and the four host components/templates/styles; retain their shell and navigation. Add integration tests alongside the hosts. Do not move unrelated legacy methods or redesign other pages.

## Task 1: Catalogue and record adapter

**Files:** models, catalogue/rows services and their tests above; `core/services/catalogs/catalogs.service.ts`; `core/services/construction-stage/construction-stage.service.ts`; `core/services/end-life/end-life.service.ts`; `src/environments/environment.ts` and `environment.prod.ts`.

**Interfaces:**

```ts
type EquipmentStage = 'construction' | 'end-life';
interface EquipmentSource { id: number; name: string; type: string; }
interface EquipmentUnit { id: number; name: string; }
interface EquipmentRow {
  key: string; id: number; sectionId: number;
  sourceId: number | null; quantity: string | number | null; unitId: number | null;
}
interface EquipmentDraft { sourceId: number | null; quantity: unknown; unitId: number | null; }
interface EquipmentInput { sourceId: number; quantity: number; unitId: number | null; }
interface EquipmentCatalogue {
  sources: EquipmentSource[]; units: EquipmentUnit[]; unitLabels: EquipmentUnit[];
  constructionEnergyProcessId: number | null;
}
interface EquipmentSnapshot { rows: EquipmentRow[]; rawTotal: number; }
// EquipmentCatalogueService
load(stage: EquipmentStage): Observable<EquipmentCatalogue>;
// EquipmentRowsService: all targets are explicit, never read from localStorage.
list(stage: EquipmentStage, projectId: number): Observable<EquipmentSnapshot>;
create(stage: EquipmentStage, projectId: number, sectionId: number,
       input: EquipmentInput): Observable<EquipmentRow>;
update(stage: EquipmentStage, row: EquipmentRow,
       input: EquipmentInput): Observable<EquipmentRow>;
remove(stage: EquipmentStage, rowId: number): Observable<void>;
```

`rawTotal` preserves the existing energy-bar quantity aggregation over all rows
of this project/stage, including construction records outside energy process.
Only energy-process rows enter the construction card list; none of the other
records is deleted or rewritten. Do not introduce unit conversion or impact math.

- [ ] Write failing HttpTestingController tests: a construction fixture with energy-process ID **8** is mapped correctly; source `Mexicaniuh - CADIS` is excluded; returned unit IDs/labels are unchanged; current source types match the explorer rules.
- [ ] Test batch POST payloads for both stages with project **42**, section **3**, source **11**, quantity **0**, unit **null**. Construction sends `energy_unit_id: null` and the looked-up process ID; end-life sends `unit_id: null`. Returned server IDs survive reload without a unit or quantity being entered. Missing construction process prevents creation rather than falling back to 1.
- [ ] Add `backend/evamed-api/projects_api/tests_equipment_cards_contract.py`: authenticated POST/PATCH with quantity 0 and unit null succeeds for each existing endpoint. Run those contracts in CI; do not assert local backend execution where Django is unavailable.
- [ ] Test stage-correct units with EnergyUnit **2 = Hrs**, EnergyUnit **3 = MJ**, Unit **2 = Kg**, Unit **12 = MJ**: construction uses its IDs; end-life offers MJ as **12** and does not substitute ID 2 for Hrs. Preserve legacy Unit 2 and show its real label on existing end-life rows. Test current end-life integer validation without silent decimal rounding.
- [ ] Test that editing persisted ID **73** sends PATCH to `/73/` and sends no DELETE/POST. Deleting ID **73** sends one DELETE. Another row with the same source retains ID **74**. Unedited quantity string `"12.3456789"` round-trips on list without `trunc`.
- [ ] Test explicit project filtering with mixed-project API rows, preservation of other construction processes, and a failed request without automatic mutation retry.
- [ ] Run the new service specs and observe the expected missing-interface failures.
- [ ] Implement the adapter with existing services. Add `patchConstructiveSystemElement(id, changes)` and `patchECDP(id, changes)`; use existing environment URLs. Add cached `getConstructiveProcesses()` using the existing server route and exact process name from the spec. Use existing `MaterialsService.getUnits()` for end-life Unit labels, cache that read inside `EquipmentCatalogueService`, and match selectable energy-unit labels by name, never by shared numeric ID.
- [ ] Run these service specs again; require zero failures before UI integration.

## Task 2: Shared equipment catalogue sheet

**Files:** equipment picker service/component/templates/styles/spec and UI module.

**Consumes:** Task 1 catalogue and source/unit types.

**Produces:**

```ts
interface EquipmentPickContext {
  stage: EquipmentStage; section: string; mode: 'add' | 'replace';
  save?: (sources: EquipmentSource[]) => Promise<boolean[]>;
}
// EquipmentPickerService
pickMany(context: EquipmentPickContext): Promise<EquipmentSource[]>;
choose(context: EquipmentPickContext): Promise<EquipmentSource | undefined>;
```

Add resolves with sources successfully saved by `context.save`; replace
resolves with one chosen source without persisting it. The captured save
callback, not the picker, owns project/section IDs. Search/type/view changes
never discard selection. Source names remain real catalogue names.

- [ ] Write failing rendered-dialog tests for search, type filtering, cards/list selection, and one active dialog even before lazy loading completes.
- [ ] Test that selecting a source alone enables Add: no unit or quantity controls are present. Changing filters preserves selected IDs. The save callback receives only selected sources; the panel creates each at quantity 0/unit null. No equipment-to-unit mapping or default Hrs assumption is allowed.
- [ ] With source IDs **2** and **11** selected and save results `[true, false]`, assert only **11** remains to retry and closing returns **2**. Repeated submit while pending invokes one batch. X/backdrop/Esc cannot detach a pending save from its result.
- [ ] In replace mode assert no multi-selection tray or unit control; clicking source **11** returns it directly. Closing before selection returns undefined and never calls save.
- [ ] Run the picker tests and observe failure; implement the Materiales-style 75dvh sheet with a single scrolling body, focus return, keyboard labels and the same backdrop treatment. Reuse existing tokens and Material controls, without importing material-save behaviour.
- [ ] Run picker tests again; require zero failures and inspect that no source fields or impact scores were invented.

## Task 3: Cards with editors inside the selected card

**Files:** equipment stage panel component/template/style/spec and UI module.

**Consumes:** Tasks 1–2.

**Produces:** exported `<app-equipment-stage-panel>` with inputs
`stage: EquipmentStage`, `projectId: number`, `sectionId: number`,
`sectionName: string`; outputs `totalChange: EventEmitter<number>` and
`pendingChange: EventEmitter<boolean>`; method `whenIdle(): Promise<void>`.

The panel owns committed records and a separate draft map keyed by project,
stage, and row key. Row request state is separate from form values. Only one
card is expanded. Server IDs, not source IDs or array positions, identify rows.

- [ ] Write a rendered test with IDs **73** and **74**, both source **11**: clicking 73 places one form **inside that card**; 74 stays collapsed, and Cancel leaves saved values unchanged. Assert no separate fixed/side editor exists.
- [ ] Test cards/list and section switching preserve the correct row's unsaved draft without an HTTP write. A project change clears old drafts and late old-context reads cannot replace the new view.
- [ ] Test Save with **0**, decimal comma **"12,5"**, blank, negative, and nonfinite input: blank quantity becomes 0 and blank unit remains null; construction accepts 12.5; end-life must surface its integer constraint rather than silently round. Source selection remains required. Invalid nonblank values show errors without mutation. Loading a construction value `"12.3456789"` alone never changes it.
- [ ] Test replacement preserves typed quantity/unit, including a null unit, until Save and Cancel restores the original source. A newly added card displays quantity 0 and Sin unidad, can be edited on the main stage, and persists correctly on reload. Missing legacy source/unit labels and IDs are never silently substituted.
- [ ] Test a failed PATCH keeps the original committed row and the editable draft; failed DELETE leaves the row visible. A successful DELETE removes only ID **73**, leaving **74**, other sections, and other projects untouched. Repeated Save/Eliminar while pending submits once.
- [ ] Run panel tests red. Implement grid/list presentation, explicit add/edit/delete, draft separation, and request guards. Add succeeds at quantity 0 with unit null and never requests a unit in the catalogue. Update local rows from successful responses before any optional totals refresh, so a failed refresh never invites re-POSTing an already-created row.
- [ ] Keep the expanded form within the original card column, with one-column fields and no nested scroll area. Keyboard expansion/actions must use semantic buttons; set `aria-expanded`/`aria-controls` on the expansion button, never nest form controls inside that button.
- [ ] Run panel tests green, including loading, retry, empty-state Agregar, and draft-exclusion from committed totals. Do not automatically retry an ambiguous POST outcome.

## Task 4: Integrate all four existing stage routes

**Files:**

- `construction-stage/construction-stage.module.ts`
- `construction-stage/components/construction-stage/construction-stage.component.{ts,html,scss}`
- `construction-stage/components/construction-stage-update/construction-stage-update.component.{ts,html,scss}`
- `end-life-stage/end-life-stage.module.ts`
- `end-life-stage/components/end-life-stage/end-life-stage.component.{ts,html,scss}`
- `end-life-stage/components/end-life-update/end-life-update.component.{ts,html,scss}`
- Create `equipment-stage/equipment-stage-integration.spec.ts`; extend existing `stage-pages-without-import.spec.ts` and `stage-results-link.spec.ts` where their contracts change.

**Consumes:** panel inputs/events/`whenIdle()` from Task 3. Hosts supply their actual project ID and the selected section's established 1-based ID.

- [ ] Write parameterized route-host tests for both stages and both route variants. Include a reopened project with no `sessionStorage.dataProject`, explicit current project **42** while localStorage contains **3**, empty stages, and existing records on two elements.
- [ ] Assert each host renders the shared card panel, retains its project/header/footer/stage navigation and element list, and sends the proper stage/project/section context. Fin de vida copy refers to deconstruction energy and never offers landfill/recycling scenarios.
- [ ] With a create/PATCH/DELETE held pending, trigger an old timer, blur, section change, and navigation: none may invoke the old EC POST/delete-and-recreate path. Navigation waits on `whenIdle()` before leaving. Never create the legacy automatic blank row when a section is empty.
- [ ] Test section/project changes during completion: the mutation applies to the captured target, not the newly selected one. Unchanged reloads and navigation send no mutation. Bar totals update from committed state through host handlers calling existing `setConstructionTotal()`/`setEndLifeTotal()` methods, not stale localStorage.
- [ ] Run integration tests red. Import the shared UI module and replace the repeated EC form region with the shared panel. Disable/remove the superseded EC timer/blur/navigation save triggers and duplicate EC record-load wiring. Preserve unrelated records, algorithms, routes and navigation destination IDs.
- [ ] Remove the fixed-height constraint only from these stage resource layouts so expanded cards fit; retain the existing shell, page-width constraint and building-element rail. No app-wide CSS override or Materials redesign.
- [ ] Run integration tests green, then all service/picker/panel tests. Confirm no backend production, schema, fixture or calculation file changed (backend contract tests are allowed), and no historical duplicates were automatically removed.

## Task 5: Design consistency and final verification

**Files:** only focused corrections from previous tasks; update the equipment decision entry in `docs/design/evamed-handoff/RECONCILIATION.md` with verified outcomes.

- [ ] Compare Materiales/explorer, Construcción and Fin de vida side by side at **1440px** and **390px**: colours, inherited font, button treatment, 12px cards, spacing, focus, headers/footers and page width. Verify a very long source name, a fully expanded card, empty element and catalogue selection tray.
- [ ] Exercise Agregar → multi-select sources only → add at quantity 0/unit null → reload → expand one card → fill quantity/unit or leave blank → change source → Save/Cancel → reload. Repeat on new and reopened projects in both stages. Confirm only one scroll owner per region and no horizontal page overflow.
- [ ] Review keyboard focus and screen-reader names for card expansion, catalogue entry/exit, single-source replacement and deletion. Do not add decorative imagery, fake GWP badges, new stage colours, or equipment reference-unit assumptions.
- [ ] Run full frontend tests from `frontend/evamed` with Node **22.22.3+**: `node node_modules/@angular/cli/bin/ng.js test --watch=false`. Require exit 0; report every failure by name.
- [ ] Run touched-file ESLint with the same Node version, without `--fix` on accent-normalization regexes. Run `node node_modules/@angular/cli/bin/ng.js build --configuration production` and `git diff --check`. Record any existing style-budget/CommonJS warnings separately from errors.
- [ ] Review the diff against the spec and the five Review Focus cases; prepare the verified implementation for owner review. Commit, push, and deployment follow only an explicit owner request.

## Planning self-review

- Owner's inline-card decision and design consistency are requirements, not optional polish.
- Shared components cover all four routes; catalogue data, row identity and API mappings have named owners and interfaces.
- Drafts cannot enter old autosave paths. Existing endpoints support PATCH and nullable units; API contracts must verify blank-unit additions. End-life unit-table/integer constraints are explicit, with no implicit schema/data repair.
- The owner rejected a batch-unit selector: the picker only selects sources, and quantity/unit are completed later in the main stage.
- Prototype quantities, database chips and default units are illustrative; the implementation uses real catalogues and preserves existing data.

## Execution outcome — 2026-11-08

Tasks 1–4 implemented. The original checkboxes above describe planned acceptance work; this outcome records the verified scope without implying every manual scenario was exercised. Task 5: full frontend suite 421/421, touched-file ESLint, production build, and diff whitespace checks pass. Independent review identified totals initialization, untouched decimal precision, and action focus restoration; all three were corrected with regressions. Async totals response races also have regressions.

Real built-app browser fixtures verified all four routes at 390px and construction/update at 1440px, inline editing and blank-unit batch creation, with no page exceptions or horizontal document overflow. Broader manual persistence checks against the live backend and backend contract execution remain for CI/owner review. No live project data was written during browser verification. Small shared header/footer responsive corrections were necessary to remove mobile overflow while retaining content and styling. No commit or push performed.
