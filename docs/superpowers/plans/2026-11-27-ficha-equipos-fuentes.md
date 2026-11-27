# Ficha de equipos y fuentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** a detail sheet for equipment and use sources inside their pickers.
**Spec:** `docs/superpowers/specs/2026-11-27-ficha-equipos-fuentes-design.md`
**Tests:** backend `cd backend/evamed-api && DB_USER=maikolkali DB_HOST=/tmp DB_PORT=55432 /tmp/evamed-usage-py/bin/python manage.py test --noinput`; frontend `cd frontend/evamed && npx -y -p node@22 node node_modules/@angular/cli/bin/ng.js test --watch=false`.

## Global Constraints
- Only data already stored; description shows «Sin descripción.» when null.
- Indicators of the active method only.
- No change to how picking/adding works except: clicking a name opens the sheet (photovoltaic keeps toggling).

## Review Focus
1. Unknown id or a stage other than construccion/uso → 404 (Task 1).
2. A row with no values for the active method → empty indicator list, sheet still opens (Task 1, Task 2).
3. The sheet's add/remove keeps the selection tray in sync (Task 3).

### Task 1: Detail endpoint
**Files:** `projects_api/explorer/queries.py` (`catalogue_detail(stage, pk) -> dict | None`), `explorer/views.py` (`ExplorerCatalogueDetailView`), `urls.py` (`explorer/<slug:stage>/<int:pk>/` after the produccion route), `tests_explorer.py`.
**Produces:** `{id, stage, name, display_name, source, region, type, unit, gwp, description: None, modules, ecoinvent: {dataset_id, version, activity, geography} | null, indicators: [{code, name, unit, value}]}`; `modules` = 'A5 y C1' (construccion) or 'B6' (uso); uso unit 'kWh' for electricity types, else null; ecoinvent activity/geography from `pins.json` by entity type and dataset id.
- [ ] Tests: construction excavator → unit 'm³', indicators values, ecoinvent activity; uso electricity → unit 'kWh', modules 'B6'; unknown id and stage 'produccion2' → 404; row without values → `indicators: []`.
- [ ] RED → implement → GREEN → commit `feat(explorer): detail for equipment and use sources`.

### Task 2: Shared sheet component
**Files:** `explorer/components/catalogue-detail/*` (declared/exported in `ExplorerUiModule`), `explorer.service.ts` (`catalogueDetail(stage, id)`), `explorer.models.ts` (`CatalogueDetail`).
**Produces:** `<app-catalogue-detail [stage] [itemId] [actionLabel] (back) (action)>`.
- [ ] Tests: renders title, chips, unit, modules, ecoinvent activity, GWP per unit, indicator rows, «Sin descripción.»; loading/error/retry; «Volver al catálogo» emits back; action button emits.
- [ ] RED → implement → GREEN → commit `feat(explorer): equipment and source detail sheet`.

### Task 3: Pickers open the sheet
**Files:** `equipment-stage/equipment-picker.component.*`, `usage-stage/components/source-picker/*` (+ specs).
- [ ] Tests: clicking a name opens the sheet (no selection change); in add mode the sheet's action toggles selection and its label follows («Agregar a la selección» / «Quitar de la selección»); back returns to the list with filters kept; replace mode action picks and closes/confirms as the checkbox-less click did; photovoltaic name still toggles.
- [ ] RED → implement → GREEN → full suites + build → commit `feat(pickers): open the detail sheet from an option's name`.
