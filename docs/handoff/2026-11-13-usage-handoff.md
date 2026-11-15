# Usage stage continuation

Implementation checkpoint 2026-11-13: the approved Usage concept was implemented locally on `main` (baseline `a2c7b5d`). Subsequent live catalogue verification, the approved catalogue correction, and release authorization are recorded below.

## Implemented

- Both new/reopened Usage routes share one whole-building editor: annual summary, fixed-share allocations, editable source cards, multi-add catalogue, direct replacement and separate photovoltaic generation. Explicit Save/Cancel replaces legacy autosave writers. All existing source rows and IDs are retained, including repeated families.
- Project-scoped GET/PUT `/api-projects/projects/:id/usage/` validates an entire request before atomic persistence. It uses trusted ownership, a project lock, exact-state revisions, stable source IDs and durable batch receipts to prevent duplicate retries. Source quantity remains a Decimal string and is derived server-side.
- Conflicts/uncertain responses preserve drafts and require reload/review. An uncertain catalogue submission freezes its submitted selection; confirmed receipts resolve its outcome without replaying additions. Failed selections survive catalogue close/reopen.
- Existing Unit references are displayed honestly. A unique actual kWh Unit is required for creation/repair, with explicit old/new unit consent. No EnergyUnit ID is reinterpreted and no Unit is inserted automatically. Multiple annual rows block writes. Per-row legacy repairs leave omitted rows untouched; negative annual repair supports explicit coordinated recalculation without losing source IDs.
- Catalogue classification permits the seven known fixture names independently of numeric IDs. Unknown types remain visible on saved rows but cannot be newly added. Database/region badges use only supported metadata. No factors, product metadata or impact badges are invented; B6 and photovoltaic factor treatment remain unchanged.

## Implementation and review records

- [Approved Usage concept](../design-system/usage-concept.md).
- [Technical design](../superpowers/specs/2026-11-13-usage-stage-design.md).
- [Implementation plan and decision/review ledger](../superpowers/plans/2026-11-13-usage-stage.md).
- [Migration inventory](../design-system/migration.md).
- Supporting design context and mockup resume state remain under `.superdesign/`; maintained design-system documents are authoritative.

Independent review found two important recovery gaps (negative legacy annual repair and lost-response selection replacement). Both received failing regressions before fixes. The initial-load return-navigation issue was also fixed. No critical issue was reported.

## Verification

- Backend: full Django suite, **230 tests passed** against an isolated PostgreSQL cluster. The 20 Usage tests cover ownership, revision conflicts, exact recalculation, rollback validation, incremental repairs, simultaneous initial retries, post-delete replay, negative annual repair and B6.
- Frontend: full Vitest suite, **455 tests passed**; touched-file ESLint and production build passed. Existing browser-support, legacy Materials style-budget and CommonJS build warnings remain.
- `makemigrations --check --dry-run`: no changes detected. `git diff --check`: clean.
- Real rendered checks with intercepted synthetic API data, no live project writes: both route entries at **1440px and 390px**, long names, source/annual editing, fixed 60/20 shares (10000→12000 produces 7200/2400), replacement cancellation and batch addition. Loading, empty, failed-load, unit-repair, negative-annual-repair and multiple-annual states were checked at both widths. No browser exceptions or horizontal document overflow. Empty energy-bar border sizing was corrected after a 2px mobile overflow regression.
- Screenshots and local browser scripts/logs are under `/tmp/evamed-usage-*`; these are supporting local artifacts, not runtime dependencies. Python/PostgreSQL test tooling was isolated under `/tmp`; application dependency manifests were unchanged.

## Before release

1. Apply migration **0085_usagesavereceipt** to add the durable request-receipt table. It does not migrate historical Usage records.
2. Verify the **live Unit catalogue** has exactly one intended kWh entry. The repository fixture has none; the new editor safely blocks creation/repair in that case. Any catalogue addition or historical unit correction needs explicit review rather than automatic insertion/conversion.
3. Review any live legacy inconsistencies through the explicit repair flow. The implementation is not a production-data audit. New aggregate requests are atomic; concurrent legacy CRUD writers are not globally serialized by the new project lock.
4. Review/commit/push/deploy through the owner's chosen workflow. No integration action has been taken automatically.

## Live catalogue verification — 2026-11-14

Read-only requests to the development site's `/api-projects/units/` and `/api-projects/energy-units/` confirmed:

| Catalogue | Verified entries relevant to Usage |
| --- | --- |
| Unit | ID 1 = Pz; ID 2 = Kg; ID 12 = MJ; no normalized kWh entry |
| EnergyUnit | ID 1 = kWh; ID 2 = Hrs; ID 3 = MJ |

This confirms the release prerequisite is unmet in the live development catalogue, rather than merely absent from the fixture. EnergyUnit 1 must not be treated as Unit 1. No live records or catalogue rows were modified by this check.

Concrete proposed resolution within the existing implementation: create exactly one `Unit(name_unit='kWh')`, using its database-assigned ID. Before insertion, recheck for a unique trimmed/case-insensitive kWh match; reuse one existing match, and stop if multiple matches exist. The editor already resolves this ID from the live catalogue, so no hardcoded ID or frontend change is needed. Existing annual/source references remain untouched and visible through the explicit repair flow. This deliberately keeps the two catalogues separate; consolidating them and remapping historical records is a broader migration.

Approval is required before inserting the Unit, because the design explicitly excludes automatic catalogue insertion and historical migration. Commit/push/deployment remain pending that release decision.

## Approved catalogue correction — 2026-11-14

The owner explicitly approved adding kWh to Unit. A guarded transaction on the development server rechecked for existing normalized kWh entries, serialized Unit catalogue writes, and created `Unit(id=22, name_unit='kWh')`. The database assigned ID 22; no existing ID was changed or reused.

Verification through the live public catalogue endpoints confirms exactly one kWh entry in Unit (22), while the separate EnergyUnit entry remains kWh (1). Exact before/after snapshots confirmed all **71 annual consumption records** and **114 source records** were unchanged. Temporary SSH access was closed by the documented wrapper on successful exit. No application deployment, commit, push, or historical data conversion was performed.

The live canonical-unit prerequisite is now satisfied. Remaining release work is integration/CI/deployment of the local implementation and migration 0085, followed by smoke tests and explicit review of legacy inconsistencies.

## Release authorization — 2026-11-14

After the canonical kWh Unit was verified live, the owner asked to continue with committing and deploying the implementation. This supersedes the earlier no-commit/no-push/no-deployment restriction for this release only; historical data conversion remains excluded. The release uses the existing `tests` workflow on `main`, including backend/frontend checks, dependency audits, automatic migration and the Lightsail development deployment. GitHub Actions is the authoritative record of the run result; the deployed `REVISION`, migration 0085 and read-only aggregate smoke checks are verified after deployment.
