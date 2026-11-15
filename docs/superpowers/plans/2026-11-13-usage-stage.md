# Usage Stage Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace both legacy Usage forms with one source-card editor that saves allocations atomically and preserves source identities.

**Architecture:** A project-scoped GET/PUT aggregate exposes canonical persisted state and its revision. A durable per-project request receipt makes an identical retry safe; a shared Angular editor and catalogue use the existing EVAMED primitives.

**Tech Stack:** Django/DRF/PostgreSQL, Angular NgModules, RxJS, Angular Material, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-usage-stage-design.md`

## Global Constraints

- No historical data changes, unit insertion, formula changes, dependencies in the application, commit, push or deployment.
- Keep integer annual totals and shares, Decimal quantities and all saved row IDs; never equate Unit and EnergyUnit IDs.
- Preserve B6 factors and photovoltaic source=panels,type=null semantics.
- Use explicit save/cancel, preserve failed drafts, block duplicate submission, and update totals/navigation only after persistence.
- Follow maintained design-system guidance; inspect 1440px and 390px.

## Technical decisions

- Persist `UsageSaveReceipt(project, operation_id UUID, request_hash)` with a unique project/operation constraint. Check receipts under the project lock before revision validation. Identical retries return current state plus replay status; changed payload under the same ID returns 409. Receipts survive row deletion and do not hold user content. One operation ID covers the atomic batch and its additions; each addition also has a unique client ID within that request. Retrying a different batch requires a fresh revision and operation ID.
- Classify only explicit known catalogue names, independent of numeric IDs: six electricity variants (three voltage levels × ECOINVENT3/MEXICANIUH) and `Calefacción doméstica con gas natural (GLO)`. Unrecognized names remain visible on saved rows but cannot be newly added. Use explorer derive helpers only for readable names and supported database/region.
- Resolve exactly one Unit whose trimmed case-folded name is kWh. Missing/ambiguous units block writes that require canonical units; deletions and independent legacy repairs remain possible where safe. Repair is explicit and never a conversion.
- Treat the user's request to resume as authorization to implement the scoped technical recommendations. Work in the clean current checkout; no additional worktree is necessary for this continuation.

## Review Focus

- Lost response followed by retry must never create a duplicate annual/source row (Task 1).
- A repair of one legacy row must leave unrelated inconsistent rows byte-for-byte unchanged (Task 1).
- Multiple annual rows block writes rather than choosing one implicitly (Task 1).
- A cancelled navigation keeps a dirty draft; successful saves alone update the energy bar (Task 2).
- Filter changes and catalogue arrival order must preserve selected sources and saved rows (Tasks 2–3).

### Task 1: Atomic Usage persistence

**Files:** Create `projects_api/usage.py`, `projects_api/tests_usage.py`, migration 0085; modify models.py and urls.py (all beneath backend/evamed-api).
**Interfaces:** GET/PUT `/api-projects/projects/:id/usage/`. State: project/name, annual/null, sources[], catalogue[], units[], canonical_unit_id/null, revision, issues[]. PUT: revision, operation_id, optional annual {quantity, repair_unit}, edits [{id, percentage, type, source, repair_unit}], removals [id], additions [{client_id, type, source}]. Omitted rows are unchanged. `issues` annotate saved rows.

- [x] Write API tests for owned empty state, all repeated source rows, 10000→12000 at 60/20, stale revision, retry, replacement identity, explicit deletion and whole-request rollback.
- [x] Run `python manage.py test projects_api.tests_usage`; confirm missing endpoint failures.
- [x] Implement strict integer input serializers, catalogue classification, exact-state revision, legacy diagnostics and atomic locked validation/save with durable receipts. Annual edits recompute only valid rows after explicit unit repair, and are blocked by any remaining inconsistency. Row repairs derive their own quantity; omitted rows are untouched. Reject foreign/conflicting IDs, unexpected fields and >100 allocation.
- [x] Add ownership/untrusted identity, missing/ambiguous unit, multiple annual records, unsupported type, fractional inputs, percentage/quantity boundaries, incremental repair and omitted-row tests. Run the relevant backend tests and migration consistency check.

### Task 2: Shared Usage editor

**Files:** Create `frontend/evamed/src/app/usage-stage/editor/usage.models.ts`, `usage.service.ts`, `usage-editor.component.{ts,html,scss,spec.ts}`; replace legacy page component implementations/templates; modify UsageStageModule/routing.
**Interfaces:** `UsageService.load(projectId)` and `.save(projectId, change)` return Observable<UsageState>; `UsageEditorComponent` consumes projectId, exposes `canLeave(): boolean` and emits pending state. Both routes use the same editor and a CanDeactivate guard.

- [x] Write tests for asynchronous state hydration retaining repeated rows, explicit save/cancel, 60/20 fixed shares, failed drafts, pending navigation, conflict/reload review and legacy repair.
- [x] Run `npm test -- --watch=false --include='**/usage*.spec.ts'`; confirm missing editor failure.
- [x] Implement typed service, shared cards/annual summary, explicit unit repair with old/new labels, row deletion confirmation and error recovery. Use operation UUIDs and preserve uncertain request identity until reconciled. Share navigation wrapper for both routes; retire autosave and legacy delete/recreate writers.
- [x] Run Usage and EnergyTotal tests, including route entry and dirty-draft navigation checks.

### Task 3: Source catalogue and integration verification

**Files:** Create `usage-picker.component.{ts,html,scss,spec.ts}` and picker service beneath editor; update `docs/design-system/migration.md` and handoff.
**Interfaces:** Picker takes catalogue and existing type IDs, mode add/replace; emits selection through MatDialog after confirmation. Replacement retains source ID/share. Add mode keeps selected IDs across filters and excludes already saved types. Photovoltaics use a separate action.

- [x] Write tests for filter-independent selection, single replacement without tray, cancellation and duplicate exclusion. Run to confirm missing component failures.
- [x] Implement using MenuShell, SelectionTray, FilterPanel and database/region chips; one main scroll area and persistent tray. Wire into shared editor.
- [x] Run backend suite, frontend suite, touched-file lint, production build and `git diff --check`. Check rendered desktop/mobile and B6 regressions. Document exact results and any environmental limits.

## Execution ledger

- Review: handoff/spec checked against current models, legacy forms, equipment components and fixtures. No live production catalogue queried; release still requires live Unit verification. New endpoint can safely block absent kWh without data migration.

- Task 1: implemented and verified against PostgreSQL: 18 Usage tests pass, including a concurrent initial retry, exact recalculation, B6, trusted identity and post-delete replay. Migration adds only durable request receipts.
- Task 2: both routes now share one editor, with explicit annual/source drafts, unit repair consent, a route guard and response reconciliation. Legacy autosave writers and duplicate update markup removed.
- Task 3: catalogue uses the shared shell, filters, chips and tray; failed additions survive close/reopen. Browser checks use intercepted synthetic data, with no live project writes.
- Ruling: preserve batch operation identity through a durable per-request receipt rather than storing client IDs on source rows — atomic request replay covers all its additions, and receipts survive deletion. Cost if wrong: retry ambiguity; concurrent and post-delete replay tests cover this.
- Ruling: work in the clean existing checkout and leave changes uncommitted — the handoff forbids automatic commit/push/deployment; no worktree is needed for the continuation. Cost if wrong: changes remain on the current branch for user review.
- Verification environment: temporary Python 3.12 environment and PostgreSQL 18 cluster on port 55439; psycopg2-binary substitutes for the source package only in that temporary environment because local libpq build headers are absent. Application requirements are unchanged.

- Final review: independent read-only review found no critical issues and two important recovery gaps.
- Final: fixed negative annual recovery — coordinated annual/source edits now derive quantities against the confirmed new total while retaining IDs; incremental metadata repairs preserve saved quantity until then. The two backend regressions failed before the fix and pass afterward; editor confirmation regression also passes.
- Final: fixed uncertain selection replacement — picker edits/submits freeze while review is required, and the parent rejects replacement intent before changing its draft snapshot. Parent and picker regressions failed before the fix and pass afterward.
- Final: Ruling: the initially minor return-navigation finding is important recovery behavior — a missing project/error explicitly directs the user back to projects, so that action must remain available. The regression failed before the fix and passes afterward. Cost if wrong: safe exit remains enabled while a read is loading; pending writes still block it.
- Final: Ruling: a negative legacy annual is repaired through confirmed coordinated annual/source edits, without a new migration or automatic reinterpretation. Source metadata can be repaired incrementally while its raw quantity stays unchanged. Cost if wrong: legacy users must explicitly review affected values; tests pin retained IDs and quantities.
- Final: Ruling: the review's declined areas remain as scoped: seven explicit catalogue names only (new types need classification review); batch receipts supply durable addition identity; legacy CRUD writers are not globally serialized; historical unit migration is prohibited; live Unit verification is a release prerequisite. Browser and suite evidence is recorded by the executor. Temporary test instrumentation has been removed. Cost if wrong: new catalogue names remain unavailable until reviewed; concurrent legacy edits and live catalogue validity remain deployment constraints.
- Resource note: one combined frontend verification was interrupted after overlapping build/test processes caused resource pressure; final frontend verification runs sequentially with two workers.

- Final verification: full backend 230/230, full frontend 455/455, touched-file lint, production build, migration consistency and whitespace checks pass. Rendered checks cover both routes at 1440/390 and loading/empty/error/unit-repair/negative-repair/multiple-annual states, with no browser exceptions or document overflow.
- Final browser regression: empty EnergyBar had a content-box border that extended the mobile document by 2px; shared track border sizing now includes the border. Failing and passing browser bounds were observed. The concurrent API test also now closes its worker-thread database connections explicitly, avoiding teardown-only connection leaks.
- Review deferred minors: none. The initial-load navigation issue was treated as a recovery defect and fixed.

- Release authorization 2026-11-14: after explicitly approving and verifying live Unit 22=kWh, the owner requested continuation with commit/push/deployment. Those previously excluded actions are now authorized for this implementation. Historical record conversion remains excluded. Release verification uses the existing CI/deployment workflow plus read-only deployed checks.
