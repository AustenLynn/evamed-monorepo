# ECO Platform Institutional Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Restrict ECO Platform data and projects containing it to owners authenticated with a verified email at exactly `correo.uia.mx`.

**Architecture:** Evaluate eligibility from the backend-authenticated identity on each request. Share material and project visibility helpers across catalog, project, explorer, and export paths; expose the resulting capability through `/me/`.

**Tech Stack:** Django, Django REST Framework, Firebase Authentication, Angular, existing Django and Vitest tests.

**Spec:** Approved conversation design, recorded below. This is a planning-only change; implementation and ECO ingestion are not included.

## Approved design

Only authenticated users with verified email domain exactly `correo.uia.mx` receive ECO access. Staff status does not bypass eligibility. Other users retain existing access to non-ECO resources. Projects with ECO materials disappear completely for ineligible owners, including direct access, calculations, exports, edits, and duplication. Data remains stored and becomes visible again when eligibility returns. Ownership checks remain mandatory. Eligibility uses authenticated identity, never editable profile email. `/me/` exposes `can_access_ecoplatform`.

Alternatives considered: persisted institutional groups require synchronization; explicit provider entitlements add management complexity. Request-time domain checks were selected because eligibility follows the trusted email without duplicated membership state.

## Global constraints

- Exact domain `correo.uia.mx`; compare case-insensitively, exclude subdomains and suffix lookalikes.
- Require verified authenticated email; anonymous and unverified identities fail closed.
- No staff exemption, automatic project deletion, or changes to ecoinvent calculations.
- Restricted projects disappear, rather than appearing with a restricted label.
- Do not add live API calls or provider credentials for this work.
- Existing downloaded files cannot be recalled; prevent subsequent access and clear application-held stale data when eligibility changes.

## Review focus

- Unverified institutional accounts and outside-domain admins must receive no ECO data (Task 1).
- Hidden project children must not remain reachable through generic resource endpoints (Task 3).
- Forged material IDs and bulk writes must not introduce ECO data for ineligible users (Task 3).
- Explorer facets, ranking populations, workbook contents, and caches must not leak restricted data (Task 2).
- Eligibility changes must hide and restore stored projects without destroying them (Tasks 3–4).

## Task 1: Provider identity and eligibility

**Files:** `projects_api/models.py`, new migration, `projects_api/access.py`, `projects_api/views.py`, new `projects_api/tests_eco_access.py` (backend paths relative to `backend/evamed-api/`).

**Interfaces:** Add `Material.provider_code`, indexed, default `legacy`, with restricted value `eco_platform`; retain `database_from` for existing calculations. Add `can_access_ecoplatform(user) -> bool`, `visible_materials(user) -> QuerySet[Material]`; extend `/me/` with boolean `can_access_ecoplatform`.

- [x] Write failing tests for verified institutional email, uppercase domain, unverified email, anonymous caller, outside-domain staff, subdomain, and `correo.uia.mx.example.org`. Assert existing `/me/` fields remain present.
- [x] Run `python manage.py test projects_api.tests_eco_access`; confirm failures reflect missing functionality.
- [x] Add provider identity and eligibility helpers using the existing trusted-identity semantics. Existing records remain `legacy`; do not infer ECO provenance from names or relabel existing `EPDs`. Require future ECO importers to set `eco_platform` explicitly.
- [x] Run targeted tests and `python manage.py makemigrations --check --dry-run`; expect success and no unrecorded model changes.

## Task 2: Catalog, explorer, and workbook visibility

**Files:** `projects_api/views.py`, `projects_api/serializers.py`, `projects_api/explorer/queries.py`, `projects_api/explorer/views.py`, `projects_api/excel_templates/build.py`, `projects_api/excel_templates/views.py`, `projects_api/tests_eco_access.py`, `projects_api/tests_explorer.py`, `projects_api/tests_excel_templates.py`.

**Interfaces:** Use `visible_materials(user)` for material-rooted queries. Pass an explicitly scoped material queryset into production explorer queries and workbook catalog generation; default internal catalog generation to non-ECO visibility. Preserve unrelated stage loaders.

- [x] Add failing tests for list/search/detail, material factors, conversions, source selectors, explorer counts/facets/ranking, and workbook contents using eligible and ineligible callers. Eligible access must still respect ownership where applicable.
- [x] Run those test modules; verify expected failures.
- [x] Filter before pagination, aggregation, facet construction, and workbook generation. Hidden detail IDs return 404. Prevent outside-domain administrators from reading or modifying ECO records via REST, including changing provider identity to expose them. Keep any shared cache partitioned by visibility or disable caching for these responses.
- [x] Run targeted tests; verify ordinary catalog reads remain available. Inspect generated workbook XML for hidden material names and factors, including template seed data.

## Task 3: Project visibility and write enforcement

**Files:** `projects_api/access.py`, `projects_api/views.py`, `projects_api/serializers.py`, `projects_api/usage.py`, `projects_api/tests_eco_access.py`, `projects_api/tests_access.py`, `projects_api/tests_material_scheme_replace.py`, `projects_api/tests_project_results.py`, `projects_api/tests_usage.py`.

**Interfaces:** Add `visible_projects(user) -> QuerySet[Project]`, combining ownership with ECO eligibility. Keep `owned_projects` ownership-only; route user-facing authorization through `visible_projects`. Make `owns_project` use visible projects. Restrict child viewsets through the same project scope.

- [x] Add failing tests: mixed project disappears for ineligible owner; direct project/results/usage/stage/child reads and writes fail; ownership remains enforced; forged ECO IDs fail for single and atomic bulk writes; changing project or material foreign keys cannot bypass checks.
- [x] Include both `MaterialSchemeProject` and legacy `MaterialSchemeProjectOrigianal` in ECO dependency detection. Test disappearance, eligibility restoration, and visibility after eligible removal of the last ECO dependency from all stored project material representations.
- [x] Run targeted modules and confirm failures.
- [x] Implement visibility with database subqueries/Exists, avoiding per-project queries. Scope child reads and validate all destination foreign keys, including project reassignment and nested constructive-system references. Reject blocked writes before mutation. Do not silently drop ECO rows from calculations or turn missing factors into zero.
- [x] Audit all routes in `projects_api/urls.py`, including `ProjectMaterialSchemeView`, stage update, generic child viewsets, and frontend duplication's source reads. Record the route-to-policy matrix in the test module documentation.
- [x] Run targeted modules; expect pass, unchanged non-ECO behavior, preserved stored rows, and bounded query count for project lists.

## Task 4: Frontend capability and stale-state handling

**Files:** `frontend/evamed/src/app/core/services/user/user.service.ts`, its spec, `core/services/auth.service.ts`, `home-evamed/components/home-evamed/home-evamed.component.ts`, affected material-stage components, and their specs. Read `frontend/evamed/AGENTS.md` and design-system guidance before UI edits.

**Interfaces:** Extend `getMe()` response type with `can_access_ecoplatform: boolean`. Treat absent capability or failed identity fetch as false. Refresh capability when authentication or verified token changes; never derive permission from localStorage email.

- [x] Add failing tests for capability response, account switching, eligibility loss while a project is open, and recovery. Assert project lists refresh, stale material/results state clears, and duplication/export cannot proceed after a denied fresh request.
- [x] Run `npm test -- --watch=false`; confirm intended failures.
- [x] Consume backend-filtered lists; condition ECO-specific controls on capability. On project 404, clear active project data and return to the project list without exposing hidden project metadata. Recheck project access before client-side duplication and export. Do not persist a list of hidden projects.
- [x] Run frontend tests and `npm run build`; verify eligible/ineligible behavior in controlled session tests and smoke-test unchanged startup UI at desktop and 390px. Live institutional login is a deployment follow-up.

## Task 5: Integrated verification and rollout

- [x] Run the full Django test suite against the documented local test database and the frontend test/build commands. Do not call either provider API.
- [x] Exercise eligible → ineligible → eligible requests against the same retained project fixtures; verify catalogs, project children, results, workbooks, and duplicate paths.
- [x] Document Firebase behavior: permissions reflect the verified token accepted by the backend; already-issued tokens may retain old claims until refresh/expiry. Refresh tokens on known account changes. Immediate revocation beyond that is a separate identity-session requirement.
- [x] Document rollout ordering: deploy backend filtering before frontend controls and before ECO ingestion; audit and classify preexisting ECO imports before exposure. Public non-ECO behavior is verified in local tests; production institutional access remains a deployment follow-up.

## Scope boundaries

This plan provides segmentation infrastructure and tests using ECO fixtures. ECO API ingestion, EN15804 methodology alignment, cross-provider material standardization, account ownership transfer after email changes, and invalidating already downloaded files are separate work. Restoration assumes the same project ownership identity; this work does not migrate ownership between different email addresses.

## Completion evidence (2026-11-16)

- Django full suite: 254 passed against isolated local PostgreSQL test database.
- Angular/Vitest: 492 passed across 65 files, with a local two-worker runner configuration to avoid host contention observed on the unchanged baseline.
- Production build and 3 web-server tests passed; model/migration check reports no changes.
- Browser smoke at 1440px and 390px: unauthenticated project-list navigation reaches login with no uncaught application errors.
- Independent final review found a signup-navigation race. Four token-observer regression cases failed before the fix and passed after it; full frontend suite rerun passed.
- Rollout ordering is documented in backend README; no deployment, production data migration, provider calls, or live institutional login was performed.
