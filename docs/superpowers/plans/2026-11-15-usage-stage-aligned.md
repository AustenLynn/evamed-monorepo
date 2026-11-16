# Usage Stage Aligned with EVAMED — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the main implementation, with an independent backend worker where file ownership is disjoint and a fresh final code review. Track steps with checkboxes.

**Goal:** Implement the approved Usage stage with the actual Construction visual patterns and independent annual/source saves, preserving historical records.

**Architecture:** Share presentation-only SCSS between Construction/equipment and Usage; retain domain-specific Angular components and services. One project-scoped aggregate API supplies canonical saved state, optimistic revisions and durable batch operation receipts. A frontend draft store keeps annual and per-source intent independent and reconciles only the operation whose outcome is confirmed.

**Tech Stack:** Existing Angular NgModules/RxJS/Material, Django/DRF/PostgreSQL, Vitest. No application dependencies added.

**Spec:** `docs/superpowers/specs/2026-11-15-usage-stage-design.md` (owner approved; implementation explicitly requested for unattended execution).

## Global Constraints

- Preserve the existing header, project heading/back link, white stage shell, connected stage navigation with its current assets, energy bar and footer.
- Do not introduce a new navigation strip, dashboard header, KPI cards, fonts or colour theme.
- Usage applies to the whole building; no element selector. Annual form occupies the existing desktop sidebar and stacks above sources at 390px.
- One Agregar fuente action; photovoltaics belong inside that menu, represented as `source=panels,type=null`, without invented metadata.
- Independent Save/Cancel: source Save uses saved annual quantity; annual Save uses saved percentages. Preserve other drafts.
- Preserve saved row IDs, Decimal precision, B6 factors/formulas and all omitted legacy rows. Never copy EnergyUnit IDs into Unit.
- Resolve a unique kWh Unit from live labels; do not hardcode Unit 22, insert units or convert historical data automatically.
- Run on a local feature branch; the user authorized plan + implementation, not push/deployment. Leave results reviewable without waiting for the unattended user.

## Review Focus

- A dirty annual field and two source drafts coexist: saving one commits only its intent and preserves the others (Task 3).
- The live database retains applied migration 0085 after source rollback: reuse its exact schema, testing both fresh and already-applied states (Task 2).
- A successful save with a lost response must not duplicate additions or clear unrelated drafts; reconcile its frozen operation only (Tasks 2–3).
- A negative annual and legacy unit/type/share problems must have a recovery path retaining IDs, without deleting every source (Tasks 2–3).
- Reference components must keep their typography, card tracks, connected navigation and mobile bounds after shared-style extraction (Tasks 1 and 5).

## Interfaces and file responsibilities

Backend paths below are relative to `backend/evamed-api/`:

- `projects_api/usage.py`: GET/PUT orchestration, serializers and atomic writes. Split catalogue/state helpers into `usage_catalogue.py` and `usage_state.py` if this keeps the view focused.
- `projects_api/models.py`, `migrations/0085_usagesavereceipt.py`, `urls.py`: restore the exact already-deployed receipt model/migration and register `/api-projects/projects/<project_id>/usage/`.
- `projects_api/tests_usage.py`, `tests_usage_schema.py`: ownership, transactions, legacy repairs and retained-schema compatibility.

Frontend paths below are relative to `frontend/evamed/src/`:

- `styles/_project-stage.scss`: existing Construction shell/column/navigation styles as presentation-only mixins, parameterized by active stage. Construction includes the unchanged rendering; Usage activates Uso. Keep unrelated legacy rules in their original file where possible.
- `styles/_stage-cards.scss`: equipment-card visual definitions as a prefix-parameterized mixin. `equipment-stage-panel.component.scss` includes it with `equipment`; Usage source panel includes it with `usage`. Domain logic is not shared.
- `app/usage-stage/usage.models.ts`: wire state, operation and draft types.
- `app/usage-stage/services/usage-api.service.ts`: uncached project GET/PUT transport.
- `app/usage-stage/services/usage-editor-state.ts`: pure saved-state/draft/reconciliation rules, separate from Angular rendering.
- `app/usage-stage/components/annual-consumption/annual-consumption.component.{ts,html,scss}`: existing outlined fields and Save/Cancel; emits intent, owns no API calls.
- `app/usage-stage/components/source-panel/usage-source-panel.component.{ts,html,scss}`: equipment-derived cards/list, one expanded editor, per-row errors/repair consent, quantity-led hierarchy; emits intent.
- `app/usage-stage/components/source-picker/usage-source-picker.component.{ts,html,scss}` plus `services/usage-picker.service.ts`: shared menu/filter/chip/tray composition, selections, direct replacement and pending/uncertain locks.
- `app/usage-stage/components/usage-editor/usage-editor.component.{ts,html,scss}`: API coordination, independent drafts, annual/sidebar and sources layout, operation reconciliation and energy-bar updates.
- Existing `usage-stage` / `usage-stage-update` route components become thin shared-shell wrappers; preserve their public navigation methods, including `goToResultados`, and retire the old blur/autosave writers. Reuse one template/styles for both routes.
- `usage-stage.module.ts`, routing and optional `usage-stage-ui.module.ts`: NgModule composition and dirty/pending CanDeactivate guard. Supporting components are testable without registering feature routes.

### Wire contract

`UsageState = {project_id, project_name, annual|null, annuals[], sources[], catalogue[], units[], canonical_unit_id|null, revision, issues[], operation_applied?}`. Annual rows contain `{id,quantity,unit_id}`. Sources contain `{id,annual_consumption_required_id,percentage,quantity:string|null,unit_id,type,source,issues[]}`. Catalogue items contain `{id,name,display_name,family:'electric'|'fuel'|null,database,region}`.

`UsageChange = {revision,operation_id:UUID,annual?:{quantity,repair_unit?},edits?:[{id,percentage?,type?,source?,repair_unit?}],removals?:number[],additions?:[{client_id:UUID,type:number|null,source}]}`. GET accepts optional `operation_id` and reports whether its receipt exists. PUT returns complete canonical state plus replay status. Serialize the project lock before checking receipt/revision; changed payload for an existing operation ID returns 409.

Durable identity is one `UsageSaveReceipt(project,operation_id,request_hash)` per atomic request, unique on project/operation. This covers every addition and survives later source deletion. Restore migration 0085 byte-for-byte from commit `7a9062d`; do not create an incompatible new 0085 or drop the retained table. Seven explicit known TypeEnergy names are the initial supported classification mapping, independent of PKs; unknown types remain visible but unavailable for new selection.

The UI adds a separate option key `panels` with a presentation-only tray ID `-1`; it always serializes as `type:null,source:'panels'`, never as FK -1. Other option keys are `type:<actual id>`. Newly added duplicate option keys are excluded; historic duplicates remain editable. Replacement cannot create a new duplicate key, but editing an existing duplicate without changing its key remains valid.

### Task 1: Shared visual foundation and exact Usage presentation

**Files:** shared SCSS, Construction/equipment stylesheet includes, annual/source presentation components, Usage UI module, presentation specs; preview/check artifacts under ignored `.superpowers/`.
**Consumes:** existing Construction template/styles, equipment template/styles, EvUiModule, MaterialModule and approved preview v2.
**Produces:** `AnnualConsumptionComponent` and `UsageSourcePanelComponent` inputs/outputs; shared frame/card mixins used by actual reference and Usage.

- [x] Record the current rendered Construction shell/cards and computed style/bounds at 1440/390 with synthetic API fixtures. Retain screenshot references locally.
- [x] Add presentation tests for row identity and isolated emitted intent: clicking source 21 Save emits 21, Cancel 22 emits 22; PV has no database/region chips; the panel exposes one Agregar fuente and no standalone PV button.
- [x] Run the new specs and observe missing-component failures; implement the presentational components and shared visual mixins using the actual reference markup/classes/Material controls.
- [x] Render the new Usage layout with fixture inputs before connecting mutations. Assert reference/Usage card radius `12px`, padding `20px 16px 12px`, title `16px/700`, quantity `26px`, unit `13px`, matching shell/nav structure and no mobile overflow. Inspect screenshots, expanded editors and menu at both widths.
- [x] Run existing equipment panel/integration tests and the new presentation specs; confirm Construction and End of Life behaviour remain intact. Commit the visual foundation on the feature branch.

### Task 2: Safe aggregate API and retained migration compatibility

**Files:** backend files listed above.
**Consumes:** existing models/access rules, wire contract, original receipt schema.
**Produces:** authenticated GET/PUT with stable source IDs, exact quantities, revision/receipt reconciliation and honest legacy diagnostics.

- [x] Write tests against the missing endpoint, including `10000 @ 60/20 -> 12000 @ 7200/2400`, all repeated rows retained, source-only save, 409 rollback, duplicate/foreign/conflicting IDs, identity-preserving replacement, explicit deletion and forbidden duplicate replacement. Observe expected 404 failures.
- [x] Restore receipt model/migration exactly; implement classification, strict nonnegative integer validation (annual max 2147483647, share 0–100), label-resolved Unit, persisted-state revision and all-before-write validation under transaction/project lock. Reuse reviewed backend logic from the reverted commit only after checking it against this contract.
- [x] Add regressions for simultaneous initial retries, uncertain/replayed/post-delete operations, unknown types, null/negative shares not masking >100 allocation, canonical-unit absence/ambiguity, multiple annual rows, partial legacy repair, coordinated negative annual repair and B6 typed/PV treatment.
- [x] Inspect retained live schema read-only. Test a fresh migrated database and an already-applied 0085 state: migration planning performs no duplicate table creation and the API reuses stored receipts. Test old CRUD compatibility. Run `python manage.py test` and `makemigrations --check --dry-run`; commit verified API work.

### Task 3: Independent drafts, save orchestration and both routes

**Files:** usage models/API/state store/editor/wrappers/routing and focused specs; retire unused old update markup/styles.
**Consumes:** Tasks 1–2; `UsageApiService.load(projectId, operationId?)` and `.save(projectId, change)` return `Observable<UsageState>`.
**Produces:** shared editor for both route entries and `canLeave(): boolean`, with complete independent-save behaviour.

- [x] Add pure-store tests where annual draft=12000, source 21 draft=30 and source 22 draft=40 coexist over saved 10000/60/20. A source-21 save sends only `{edits:[{id:21,percentage:30,...}]}`; annual input and source-22 draft survive. Annual Save sends only annual intent and uses saved shares; each Cancel affects only its own draft. Observe missing-store failures.
- [x] Implement saved state plus per-ID drafts and explicit operation snapshots. Opening an untouched editor does not make it dirty. Switching cards preserves drafts. Source previews use the saved annual total; an unsaved annual input is not a hidden dependency. Source/annual success clears only that operation's confirmed draft.
- [x] Add controller/route tests for asynchronous hydration, source/annual failures, pending navigation/duplicate submission, cancelled dirty navigation, initial load failure with working return-to-projects, conflicts, orphaned/deleted-row drafts visible for review/cancel, and uncertain responses that reconcile without replay or clearing unrelated intent.
- [x] Implement the editor and thin wrappers, preserving current project context and existing navigation methods. Update totals only from confirmed saved state. Multiple annual rows do not select the first in either editor or shared energy totals. Keep per-row legacy repair local; negative annual recovery retains IDs and requires explicit confirmation.
- [x] Run Usage/energy-bar/route-result-link specs and full frontend tests; verify both routes render the Task-1 visual contract with real controller bindings. Commit the independent-save integration.

### Task 4: Shared catalogue, photovoltaic option and replacement

**Files:** Usage picker/service plus picker and editor integration specs.
**Consumes:** `UsageCatalogueOption {key,selectionId,type,source,name,database,region}`; current saved option keys; add/replace mode; a save callback returning confirmed success/failure and a recovery-lock callback.
**Produces:** add batch with 0% rows; direct replacement draft; selection/draft preservation on cancellation/failure and freeze during unresolved outcome.

- [x] Write tests proving selections survive filters, already-saved keys are excluded, PV is inside the same menu and serializes only null/panels, replacement has no tray and preserves typed draft percentage, and close/backdrop/Escape are blocked during a request. Observe missing-picker failures.
- [x] Compose the existing MenuShell, FilterPanel, chips and SelectionTray with the same 75%-height bottom sheet. Source types use verified metadata; PV is labelled generation without invented metadata. Filter fallback labels stay appropriate to database/region.
- [x] Test a lost-response add A followed by attempted selection B: the submitted snapshot freezes; reconciliation confirms only A and preserves any other drafts. Ordinary validation errors retain an editable selection. Cancel never writes. Integrate selection/addition success with the canonical row list and stable IDs.
- [x] Run picker/editor specs and keyboard/browser checks of filters, tray, replacement/cancel and PV. Commit the catalogue integration.

### Task 5: Complete verification, review and durable handoff

**Files:** meaningful regression tests, maintained design-system migration/component docs, handoff and this plan's execution ledger.
**Consumes:** complete implementation, approved design and original Construction visual fixtures.
**Produces:** verified local branch, review findings resolved, evidence and remaining deployment constraints documented.

- [x] Run full Django and frontend suites, migration consistency, touched-file ESLint, production build and whitespace checks. Test production web server if relevant configuration changes arise. Record exact commands/results; avoid simultaneous Angular build/test processes.
- [x] Run rendered checks at 1440/390 for new/reopened Usage, reference Construction and End of Life; include long names, zero/empty/loading/error/legacy, editor/cancel/replacement, pending/uncertain recovery, filter selections and only-saved-value recalculation. Compare screenshot/style/bounds against Task 1, not the rejected refactor.
- [x] Dispatch one fresh read-only whole-branch reviewer with design, plan, baseline SHA, test evidence and Review Focus. Fix Critical/Important findings with failing regressions before fixes; record reasoned decisions and any deferred minors. Repeat affected/full checks as justified by fixes.
- [x] Update documentation with current behaviour and retained 0085/live kWh prerequisites. Keep all live records unchanged. Leave commits on the local feature branch with a clean worktree and reviewable screenshots; no push/deployment.

## Execution ledger

- Baseline: `9e9b331` on main (the prior refactor has been reverted). Existing dirty files are planning/design metadata from this conversation and must be preserved.
- Authorization: the owner approved the design and explicitly requested plan + implementation before leaving the session unattended for 10 hours. No blocking questions remain. Implement autonomously without intermediate approval requests, retaining local-only delivery.
- Self-review: the plan covers the design's visual contract, independent drafts, aggregate persistence, legacy/schema history, catalogue/PV flow, navigation and verification. Backend work can proceed in parallel with presentation-only files using this fixed contract; integration remains sequential.

## Verified delivery — 2026-11-16

Implemented locally on `feat/usage-stage-aligned` in `/tmp/evamed-usage-aligned`. Final results: 477 frontend tests /64 files,236 backend tests,32 frontend files linted, production build, migration consistency and whitespace checks pass. Construction reference is pixel-identical at1440/390; Usage and End of Life browser checks pass. Fresh independent review reported two Important issues, both fixed with failing regressions first; one catalogue Back-navigation minor is deferred. The explicit decreasing-legacy-allocation exception, aggregate-only serialization boundary and multiple-annual repair-needed state are recorded in the [handoff](../../handoff/2026-11-16-usage-stage-aligned.md). No merge, push, deployment or live data mutation.
