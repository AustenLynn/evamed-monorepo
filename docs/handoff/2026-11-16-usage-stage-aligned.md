# Usage stage implementation — 2026-11-16

The owner approved the design and authorized planning plus unattended implementation. Work is implemented locally on `feat/usage-stage-aligned` in `/tmp/evamed-usage-aligned`, based on rollback `9e9b331`. The original checkout remains on main with its earlier planning changes preserved. Nothing has been merged, pushed or deployed; live records were not changed.

Approved [design](../superpowers/specs/2026-11-15-usage-stage-design.md) · completed [plan](../superpowers/plans/2026-11-15-usage-stage-aligned.md) · maintained [design-system inventory](../design-system/migration.md).

## Result

Both Usage routes use one shared editor. It preserves the actual Construction shell/navigation/footer and equipment-card hierarchy. Presentation-only Sass mixins share those visual definitions without sharing domain persistence. Annual consumption replaces the building-element sidebar and stacks above sources at390px. Photovoltaic generation is inside Agregar fuente, with no separate button or invented metadata.

Annual and per-source Save/Cancel remain independent. Source previews/saves use the saved annual total. Annual saves use saved shares and atomically recalculate quantities. Other drafts survive. Replacement preserves the row ID/share and updates only its draft until saved. Additions start at0%; deletion targets one confirmed row. Historical duplicates remain visible/editable.

The authenticated project aggregate endpoint supplies revisions, atomic validation and durable operation receipts. Lost responses reconcile a frozen operation through GET; they do not automatically replay additions. A recovery button remains accessible inside a locked catalogue. Both routes protect dirty annual/source drafts and pending operations.

Canonical kWh is resolved by its unique Unit label, never by an EnergyUnit ID or hardcoded22. Legacy units require explicit old/new-label confirmation; unknown sources and malformed shares remain visible. Negative annuals can be repaired with confirmation while retaining IDs. Multiple annual rows block writes and do not choose a total implicitly. B6 factors/formulas remain unchanged.

## Verification

- Frontend: **477/477 tests**,64 files, using `NG_BUILD_MAX_WORKERS=2 VITEST_MAX_WORKERS=2 npm test --prefix frontend/evamed -- --watch=false`.
- Backend: **236/236 tests**, run from `backend/evamed-api` with the local PostgreSQL test database and `python manage.py test --noinput`.
- `makemigrations --check --dry-run`: no changes. Migration0085 is byte-identical to the prior deployment, with fresh-schema and already-applied receipt reuse tests. Its retained live state was inspected read-only.
- Touched frontend TypeScript/templates:32 files linted; production build and `git diff --check` pass. Existing home/material-stage style-budget warnings and file-saver CommonJS warning remain.
- Real application browser checks use synthetic API fixtures only. At1440/390, Usage card radius12px, summary padding20px16px12px, title16px/700, quantity26px, unit13px and document bounds match the reference contract. Construction screenshots before/after extraction are pixel-identical at both widths for collapsed cards, expanded editor and catalogue. End of Life also renders its three states at both widths without JavaScript exceptions.
- Browser flows cover independent source/annual saves with unrelated drafts retained, saved-share recalculation, direct replacement/cancel, selection through filtering, Escape, PV batch add, empty/load-error states, actual home rendering after return, explicit unit repairs, empty negative annual, severe over-allocation followed by negative-annual repair, and uncertain additions without duplicates.
- One full frontend run under concurrent browser capture hit timing failures in unchanged lazy Explorer picker tests. The sequential final run passed all477 without application changes for those tests.

Local screenshots, browser scripts/results and verification logs are preserved at `.superdesign/tmp/usage-implementation-review/` inside the feature worktree. Open `browser/usage-collapsed-1440.png`, `browser/usage-collapsed-390.png`, and `browser/usage-picker-390.png` for visual review. These are synthetic examples, not live projects.

## Independent review and decisions

A fresh read-only reviewer completed the whole branch review. No Critical issues; two Important findings were fixed with RED→GREEN regressions and complete suites:

1. Legacy over-allocation could prevent every independent repair. Source-only saves/removals now may temporarily remain over100% only when they strictly reduce the existing total. Annual saves/additions and allocation increases remain rejected while the result is over100%. Browser and backend regressions repair two120% rows and a negative annual while retaining their IDs; four60% rows are also covered.
2. Regresar a proyectos pointed to a nonexistent `/projects` route. It now uses `/home-evamed`; a real-application browser regression verifies that the actual home component renders after initial Usage loading fails.

Rulings made:

- Permit the narrow decreasing legacy-allocation repair above to preserve independent saves and historical IDs. Cost: a legacy project may remain visibly invalid during its sequence of repairs.
- Retain the approved aggregate-only serialization boundary. Concurrent legacy CRUD writers do not acquire the aggregate project lock. Cost: simultaneous legacy and aggregate writes can race, although changes preceding an aggregate request are detected through revisions.
- Retain the approved multiple-annual repair-needed state without selecting an arbitrary record; Usage total is0 and writes are blocked. Cost: these projects require manual record review before editing.

Deferred minor: choosing catalogue options without submitting them does not mark the parent dirty. Browser Back can therefore discard only those unsubmitted selections without a prompt. Annual/source draft navigation remains protected; explicit catalogue cancellation intentionally discards selections.

## Next boundary

Review the local implementation visually, then choose integration/deployment separately. Keep retained migration0085/table and existing unit/record identities intact. No automatic historical conversion, schema recreation, live cleanup, push or deployment belongs to this handoff.
