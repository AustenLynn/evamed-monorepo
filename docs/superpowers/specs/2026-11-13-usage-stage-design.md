# Usage stage implementation design

Proposed 2026-11-13. Visual concept approved; technical design pending review.

Implement docs/design-system/usage-concept.md using the existing Angular/Django stack and shared EVAMED UI. Both new and reopened project routes share one editor. Usage belongs to the whole building.

## Approach

Recommend a shared editor plus a project-scoped atomic aggregate save endpoint. A frontend-only change leaves annual totals and allocations vulnerable to partial saves. A schema-wide energy-unit migration is broader than this feature. Preserve current tables, existing API compatibility, B6 formulas and factor selection. No automatic historical data changes, dependencies, commit, push or deployment.

## Behavior

Show annual consumption, assigned/remaining allocation, editable source cards, a multi-add catalogue and direct replacement. Additions start at zero percent. Replacement retains row ID and allocation. Preserve every existing source row, including repeated families. New duplicate catalogue selections are excluded. Photovoltaics remain separate source=panels,type=null rows without invented metadata or impact claims.

Percentages stay fixed when the annual total changes. Keep existing integer contracts: nonnegative whole annual totals and whole percentages from 0 to 100. Permit incomplete allocation with a visible warning; reject totals above 100 percent. Zero is valid. Quantity is derived server-side using Decimal(total)*percentage/100, returned as a decimal string. Example: 10,000 at 60/20 percent becomes 12,000 at 7,200/2,400 with 20 percent remaining. Preserve existing decimal precision.

Use explicit save/cancel for annual and source edits. Preserve drafts on error; disable duplicate submissions and continuation while pending. Update the energy bar and navigate only after confirmed persistence. Confirm explicit removals. Preserve dirty drafts when navigation is cancelled. Multi-add retains selection through filters and uses the shared menu shell/tray. Replacement is single-select with no multi-add tray.

## Legacy and catalogue handling

Annual/source unit foreign keys point to Unit, while old forms populate EnergyUnit IDs. Never equate their IDs or default to 1. Resolve a unique canonical kWh Unit from actual catalogue data. Missing/ambiguous entries block creation with an actionable message; no automatic insertion or migration. Live catalogue verification is required before release if unavailable during implementation.

Keep all loaded IDs, units, percentages, quantities and source strings intact. Invalid/null percentages, incompatible units, unsupported families and quantity/share disagreement appear as legacy inconsistencies. Viewing/cancelling never writes. Block annual total changes until inconsistent rows are repaired. Allow explicit per-row repair or removal without rewriting unrelated legacy rows. Unit reinterpretation must show old/new values and require explicit user action; never claim an automatic conversion.

Missing catalogue types stay visible with their saved ID. Use verified classification metadata or an explicit mapping for known types; do not classify everything except one gas label as electricity. Unclassified catalogue types cannot be newly added. Only display supported database/region metadata.

No annual row means an empty editor. Multiple annual rows mean a visible repair-needed state with writes blocked; do not silently select the first.

## Persistence contract

Add authenticated project-scoped GET/PUT Usage endpoints using existing trusted owner identity rules. GET returns annual record or null, all source rows, canonical-unit availability and an opaque revision of exact persisted state. PUT includes revision, optional annual edit, explicit row edits/removals and additions identified by stable operation IDs. Server controls project/annual links and derives changed quantities.

Inside transaction.atomic, lock the owned project first, then annual/source rows in stable order. This also serializes initial creation through the new endpoint. Validate revision after locking; return 409 without writes on stale state. Validate the whole request before applying it: ownership, foreign/duplicate/conflicting IDs, catalogue types, source families, numeric bounds, units and aggregate allocation. Omitted rows remain untouched. Retain row IDs on replacement. Return complete canonical state and new revision.

Retry after an uncertain network outcome requires reload/reconciliation before resubmitting. The implementation plan must choose durable idempotency or another persisted mapping for operation IDs so retries never duplicate additions. Preserve dirty intent on conflict and show a reload/review action.

Old CRUD endpoints remain compatible. Revision checks detect their prior changes, but old writers do not use the new project lock. Guarantee atomicity of each new aggregate request; do not claim global serialization with every legacy API writer.

## UI and verification

Follow docs/design-system and frontend/evamed/AGENTS.md. Preserve Spanish labels, header/footer and stage navigation. No building-element selector. Provide keyboard access, field-linked errors, focus restoration, announced failures and one primary catalogue scroll area with persistent tray.

Backend verification: ownership, rollback, initial creation, all same-family rows retained, replacement identity, explicit deletion, revision conflicts, uncertain retry, unit errors, incremental repair, zero/percentage boundaries and exact recalculation. Frontend verification: both route entries, asynchronous hydration, add/replace/cancel, filtered selections, draft retention, pending controls, navigation and energy-bar updates only after success, legacy repair and blocked total edits. Retain B6 regression coverage for all typed rows and current photovoltaic treatment.

Run relevant backend/frontend suites, touched-file lint, production build and whitespace checks. Inspect rendered 1440px and 390px layouts including long names, inline editors, loading/empty/error states. Update migration documentation.

## Builder decisions

Component decomposition, route names, serializer layout and test fixtures are implementation choices. Specify idempotency persistence and catalogue classification explicitly in the plan. Fractional shares, decimal annual totals, broad unit migration and formula changes are outside scope.
