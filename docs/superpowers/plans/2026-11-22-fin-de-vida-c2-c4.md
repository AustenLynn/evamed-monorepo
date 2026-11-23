# Fin de vida C2–C4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C2, C3 and C4 carry real values in Resultados: declared by the EPD when it has them, from a fixed EVAmed scenario per material family for ecoinvent materials.

**Architecture:** Phase 1 stores the C2–C4 modules ECO Platform EPDs already declare (three new `Standard` rows, the existing importer) and teaches `results.compute` to use them, add them to B4 and list materials left without end of life. Phase 2 adds a pinned ecoinvent catalogue of waste treatments and a versioned scenario file (family → destinations, distance, density) that `results.compute` applies to materials without declared values, gated by an `approved` flag the owner flips.

**Tech Stack:** Django 5.2 + DRF (backend tests: `cd backend/evamed-api && DB_USER=maikolkali DB_HOST=/tmp DB_PORT=55432 /tmp/evamed-usage-py/bin/python manage.py test --noinput`, local cluster started as in the A-32 plan); Angular 22 + Vitest (`cd frontend/evamed && npx -y -p node@22 node node_modules/@angular/cli/bin/ng.js test --watch=false [--include=…]`).

**Spec:** `docs/superpowers/specs/2026-11-22-fin-de-vida-c2-c4-design.md`

## Global Constraints

- The server is the only source of numbers; every calculation lives in `projects_api/results.py`.
- C1 keeps coming from the user's machinery; an EPD's C1 and D are never stored or used.
- An EPD that declares at least one of C2–C4 uses its declared modules only; a missing one counts 0 and is never filled from the scenario.
- The computed biogenic release (`release_by_row`) applies only to rows whose material has no declared C module.
- B4 adds `(C2 + C3 + C4 of the row) × replaces`.
- `por_elemento` invariant: its sum equals `datos` over A1-A3, A4, A5, B4, C1, C2, C3 and C4.
- Excluded entries are listed only under EN 15804+A2, like the existing categories.
- ecoinvent searches are free; any score fetch needs `--count-only` first and the owner's OK with the number.
- The scenario stays inactive until the owner approves its rates and distances (`"approved": true`).
- Push to `main` deploys dev; each phase is pushed with the owner's OK. No Excel template changes.

## Review Focus

1. An EPD declared per m³ or per piece while EVAmed's unit differs: its C values must scale exactly like its A1-A3 (Task 1 test `test_c_modules_scale_like_a1_a3`).
2. Running the importer twice must not duplicate C rows (Task 1 test `test_reimport_keeps_one_row_per_module`).
3. A row in a switched-off system, or an excluded material, must not add C2–C4 nor appear in the end-of-life notice (Task 2 test `test_switched_off_and_excluded_rows_have_no_end_of_life`).
4. A scenario treatment without values for the active method must not count silently as 0 (Task 6 test `test_treatment_without_values_is_listed`).
5. A family in m³ with no density, or a material with no mass, is listed, not guessed (Task 6 test `test_m3_material_without_density_is_listed`).

---

## Phase 1 — C2–C4 declared by the EPDs

### Task 1: Store the C2–C4 modules of ECO Platform EPDs

**Files:**
- Create: `backend/evamed-api/projects_api/migrations/0094_end_of_life_standards.py`
- Modify: `backend/evamed-api/projects_api/ecoplatform/ilcd.py:37` (`MODULES`)
- Modify: `backend/evamed-api/projects_api/management/commands/ecoplatform_import.py:25,93,115-119`
- Test: `backend/evamed-api/projects_api/tests_ecoplatform.py` (create if the existing ECO tests live elsewhere; put the tests next to them)

**Interfaces:**
- Produces: `Standard` rows named `'C2'`, `'C3'`, `'C4'` (looked up by `name_standard`, never by id); `MaterialSchemeData` rows for those standards per A2 indicator; `ilcd.MODULES == ('A1-A3', 'A1', 'A2', 'A3', 'C2', 'C3', 'C4')`.

- [ ] **Step 1: Write the failing tests** — build a minimal ILCD document (copy the shape of an existing ECO test fixture or of one file in `~/ecoplatform/search/epds`) whose GWP-total has `A1-A3: 10, C1: 1, C2: 2, C3: 3, C4: 4, D: -5`.
  - `test_parse_keeps_c2_to_c4`: `record.values` has `('GWP-total','C2'): 2`, `C3: 3`, `C4: 4`, and no `C1` nor `D` key.
  - `test_c_modules_scale_like_a1_a3`: with a declared amount of 2 (so scale 0.5), `values[('GWP-total','C3')] == 1.5` when `A1-A3 == 5`.
  - `test_import_stores_c_modules`: after `call_command('ecoplatform_import', dir=..., apply=True)`, `MaterialSchemeData` for that material has one row each for standards `C2`, `C3`, `C4` with 2, 3, 4.
  - `test_reimport_keeps_one_row_per_module`: running the import twice leaves exactly one row per (standard, indicator).
  - `test_parse_keeps_c_next_to_complete_a1_a3`: a document with a complete A1-A3 **and** an A1/A2/A3 split keeps A1-A3 and C2–C4 and drops only A1, A2, A3. (Today `parse` keeps only `A1-A3` keys in that case, which is why no C module ever reached the importer.)
  - `test_dry_run_reports_end_of_life_coverage`: the dry run prints `C2–C4: <n> complete, <n> partial, <n> none` (on the real files: 114, 4, 7 of 125).
- [ ] **Step 2: Run them** — Expected: FAIL (no C keys; no C standards).
- [ ] **Step 3: Implement** — migration `0094` creates the three standards with `get_or_create(name_standard=...)` (reverse deletes them); `ilcd.MODULES` gains `'C2', 'C3', 'C4'`; the complete-A1-A3 filter in `parse` drops only the `A1`, `A2`, `A3` keys; `_report` prints the coverage line; the importer maps modules to standards by name (`{s.name_standard: s for s in Standard.objects.filter(name_standard__in=...)}`) instead of `MODULE_STANDARDS` ids, and fails with `CommandError` if a C standard is missing. The existing delete-then-create of A2 rows already makes re-runs idempotent.
- [ ] **Step 4: Run** — Expected: PASS; full backend suite green.
- [ ] **Step 5: Commit** — `feat(ecoplatform): import the C2–C4 modules EPDs declare`

### Task 2: Use declared C2–C4 in the results

**Files:**
- Modify: `backend/evamed-api/projects_api/results.py` (`compute`, `_apply_a2_exclusions`)
- Test: `backend/evamed-api/projects_api/tests_project_results.py` (new class `EndOfLifeTests`, reusing `A2ResultsTests` helpers like `DetailBreakdownTests` does; add C2–C4 standards in its `setUp`)

**Interfaces:**
- Consumes: Task 1 standards by name.
- Produces:
  - `datos[i]['FinDeVida'] == {'C1', 'C2', 'C3', 'C4'}` with declared values × quantity.
  - `excluded['end_of_life']`: list of `{'row_id': int, 'material_id': int, 'name': str, 'reason': str}`; reasons used in this phase: `'sin_datos'`. Phase 2 adds `'sin_masa'` and `'sin_tratamiento'`.
  - Helper `_declared_end_of_life(msd_lookup, end_standards, material_id, type_id) -> dict[str, float] | None` (None when the material declares none of C2–C4).

- [ ] **Step 1: Write the failing tests**
  - `test_declared_c_modules_reach_the_stages`: an A2 material with GWP-total A1-A3 1, C2 2, C3 3, C4 4, quantity 2 → `FinDeVida` C2 4, C3 6, C4 8.
  - `test_partial_declaration_counts_missing_as_zero`: declares only C3 → C2 0, C4 0, not in `end_of_life`.
  - `test_declared_material_gets_no_computed_biogenic_release`: GWP-biogenic A1-A3 −5 and declared C3 for GWP-biogenic 5 → C3 GWP-biogenic == 5 × quantity, not 10 × quantity.
  - `test_undeclared_material_keeps_biogenic_release_and_is_listed`: no C declared, GWP-biogenic −5 → C3 is the release as today, and the row is in `end_of_life` with reason `'sin_datos'`.
  - `test_replacements_add_their_end_of_life_to_b4`: declared C2+C3+C4 = 9 per unit, quantity 1, replaces 2 → B4 includes 18 on top of today's value.
  - `test_switched_off_and_excluded_rows_have_no_end_of_life`: a row in a switched-off system and an old-method row add nothing to C2–C4 and are not in `end_of_life`.
  - `test_per_element_includes_c2_and_c4`: with `?detalle=1`, sum of `por_elemento` == sum of `datos` over A1-A3, A4, A5, B4, C1, C2, C3, C4.
  - `test_cml_lists_nothing`: under `EVAMED_IMPACT_METHOD='CML'`, `excluded['end_of_life'] == []`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** in `compute`: resolve the C standards by name once; per indicator, for each kept row whose database is active, read declared values; add them to C2/C3/C4 totals, `sumar` them per element, and add `(c2+c3+c4) × replaces` to that row's B4 value (also through `sumar`/`anotar` as B4 is today). `_apply_a2_exclusions` skips `release[ps.id]` when the material declares any C module. Rows with no declared C go to `excluded['end_of_life']` (A2 only), after the existing exclusions so excluded rows never reach it. Initialise `excluded` with the new key.
- [ ] **Step 4: Run** — Expected: PASS; full backend suite green (adapt existing tests that compare the whole `excluded` dict by adding `'end_of_life': []`).
- [ ] **Step 5: Commit** — `feat(results): declared C2–C4, in B4 for replacements, and an end-of-life notice list`

### Task 3: Show the notice and explain the source

**Files:**
- Modify: `frontend/evamed/src/app/home-evamed/components/excluded-notice/excluded-notice.component.{ts,html}` and its spec
- Modify: `frontend/evamed/src/app/comparar/component/comparar/comparar.component.html:123` (note under the section 1 chart) and its spec
- Modify: `frontend/evamed/src/app/user-manual/components/user-manual/user-manual.component.html` (a short "Fin de vida (C1–C4)" paragraph)

**Interfaces:**
- Consumes: `excluded.end_of_life` from Task 2.
- Produces: `ResultsExcluded.end_of_life: { row_id: number; material_id: number; name: string; reason: string }[]` (optional in the type so older payloads still parse).

- [ ] **Step 1: Write the failing tests**
  - excluded-notice: with two `end_of_life` entries the text contains `2 materiales sin fin de vida (C2–C4): no se incluyen en esas etapas` and both names; with none, no such text; a payload without the key renders as today.
  - comparar: the section 1 area contains `C2–C4: lo declarado en la EPD del fabricante cuando existe; si no, el escenario de EVAmed (ver Manual)`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** — `hasAny` also counts `end_of_life`; a block like `no_mass` with the lead text above; per item a meta line `sin datos de fin de vida` / `sin masa para el escenario` / `tratamiento sin datos` by reason. The comparar note is a `<p class="secondary-text">` below the stage chart. The manual paragraph says: C1 from the machinery captured in Fin de vida; C2–C4 from the manufacturer's EPD when declared; otherwise EVAmed's scenario per material family (fase 2, with its sources); D not included.
- [ ] **Step 4: Run** — Expected: PASS; full frontend suite green; production build OK.
- [ ] **Step 5: Commit** — `feat(resultados): end-of-life notice and source note`

### Task 4: Phase 1 delivery (owner gates)

- [ ] **Step 1:** Report to the owner: suite results, and ask to push. Push only with OK; wait for the deploy.
- [ ] **Step 2:** On dev (`AWS_PROFILE=evamed-dev deploy/with-ssh.sh ssh -o BatchMode=yes ubuntu@dev.evamediber.click "bash /opt/evamed/src/deploy/dc.sh exec -T api python manage.py …"`): confirm `/opt/evamed/data/ecoplatform` exists; `ecoplatform_import --dir /opt/evamed/data/ecoplatform` (dry run). Expected: 125 to import, as before.
- [ ] **Step 3:** Read the results of one dev test project that uses ECO Platform materials (before), then `--apply`, then read again (after). Report to the owner: how many EPDs got C2–C4, and the before/after FinDeVida and B4 for 3 materials.

---

## Phase 2 — EVAmed scenario for ecoinvent materials

### Task 5: Waste-treatment catalogue pinned to ecoinvent

**Files:**
- Modify: `backend/evamed-api/projects_api/models.py` (new `WasteTreatment(EcoinventPinnedModel)` with `name_waste_treatment`; `WasteTreatmentData` with `waste_treatment_id`, `potential_type_id`, `unit_id`, `value` shaped like `SourceInformationData`)
- Create: migration `0095_waste_treatment.py` (models + one row per treatment name below)
- Modify: `ecoinvent_resolve.py` `ENTITY_TYPES`, `ecoinvent_refresh.py` `TARGETS` (entity type `'waste_treatment'`), `ecoinvent/data/manual_pins.json` (new `"waste_treatment"` list)
- Modify: `projects_api/methods.py` — `current_waste_treatment_ids()` like the other `current_*_ids`
- Test: `tests_ecoinvent*.py` next to the existing resolve/refresh tests

**Interfaces:**
- Produces: `WasteTreatment` rows named exactly as their `manual_pins.json` entries; `methods.current_waste_treatment_ids() -> set[int]`; refresh writes `WasteTreatmentData` per kg.

Treatments (RoW, `TRANSFORMING_ACTIVITY` unless noted), names in Spanish like the other catalogues:

| Name | Dataset |
|---|---|
| Concreto a relleno de material inerte (RoW)-Ecoinvent 3 | 2846 treatment of waste concrete, inert material landfill |
| Concreto armado a reciclaje (RoW)-Ecoinvent 3 | 15709 treatment of waste reinforced concrete, recycling |
| Concreto sin armar a reciclaje (RoW)-Ecoinvent 3 | 15661 treatment of waste concrete, not reinforced, recycling |
| Varilla a reciclaje (RoW)-Ecoinvent 3 | 15194 treatment of waste reinforcement steel, recycling |
| Acero a relleno de material inerte (RoW)-Ecoinvent 3 | 13848 treatment of waste steel, inert material landfill |
| Ladrillo a reciclaje (RoW)-Ecoinvent 3 | 14998 treatment of waste brick, recycling |
| Yeso a relleno de material inerte (RoW)-Ecoinvent 3 | 15558 treatment of waste gypsum, inert material landfill |
| Tablaroca a reciclaje (RoW)-Ecoinvent 3 | 28014 treatment of waste gypsum plasterboard, recycling |
| Aplanado mineral a separación (RoW)-Ecoinvent 3 | 17601 treatment of waste mineral plaster, sorting plant |
| Residuo inerte a relleno (RoW)-Ecoinvent 3 | 3682 treatment of inert waste, inert material landfill |

- [ ] **Step 1: Write the failing tests** — `test_resolve_knows_waste_treatment` (dry run resolves the manual pins for the new type with a stubbed client, as existing resolve tests do); `test_refresh_writes_waste_treatment_data` (stubbed scores land in `WasteTreatmentData`); `test_current_waste_treatment_ids` (a treatment missing one active indicator is not current).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** the models, migration, wiring and pins. `ecoinvent_resolve --verify` must accept them (free search).
- [ ] **Step 4: Run** — Expected: PASS; suite green.
- [ ] **Step 5: Commit** — `feat(ecoinvent): waste-treatment catalogue pinned to ecoinvent`

### Task 6: Scenario file and its use in the results

**Files:**
- Create: `backend/evamed-api/projects_api/end_of_life/__init__.py`, `scenario.py`, `data/scenarios.json`
- Modify: `backend/evamed-api/projects_api/results.py`
- Test: `backend/evamed-api/projects_api/tests_end_of_life.py`

**Interfaces:**
- Consumes: `WasteTreatment`/`WasteTreatmentData`, `methods.current_waste_treatment_ids()` (Task 5); `construction_materials.json` categories; Task 2's `excluded['end_of_life']`.
- Produces:
  - `scenarios.json`: `{"approved": false, "truck": "<Transport name>", "families": {"<family>": {"distance_km": float, "density_kg_m3": float | null, "destinations": [{"treatment": "<WasteTreatment name>", "share": float, "module": "C3" | "C4"}], "sources": "<text>"}}}` with families `Acero, Cemento, Concreto, Block, Aplanado, Ladrillo, Grava, Arena, Panel de yeso, Yeso, Mortero, Otros`.
  - `scenario.load(path=None) -> Scenario` raising `ScenarioError` when shares of a family don't sum to 1 (±1e-9), a module isn't C3/C4, a treatment or the truck name has no row, or `Otros` is missing.
  - `scenario.family_for(material) -> str`: the `category` of the `construction_materials.json` entry whose `dataset_id == material.ecoinvent_dataset_id`, else `'Otros'`.
  - In `compute`: for kept rows whose material declares no C (Task 2) and `approved` is true: mass in kg = quantity × (`_UNIT_TONNES` unit × 1000, or the family density for `m³`); C2 = mass/1000 × `distance_km` × truck factor; C3/C4 = mass × share × treatment factor per destination module. Rows lacking mass → `'sin_masa'`; a destination treatment not current → `'sin_tratamiento'` (whole row, nothing partial). These rows also add to B4 × replaces and to `por_elemento` like Task 2.

- [ ] **Step 1: Write the failing tests**
  - `test_load_rejects_shares_not_summing_to_one`, `test_load_rejects_unknown_treatment`.
  - `test_family_from_construction_materials_else_otros`.
  - `test_unapproved_scenario_changes_nothing`: `approved: false` → ecoinvent row stays in `end_of_life` with `'sin_datos'`, C2–C4 0.
  - `test_scenario_values`: family with 30 km, destinations 0.8 C4 (factor 0.01/kg) and 0.2 C3 (factor 0.05/kg), truck 0.1/t·km, 1000 kg → C2 3.0, C3 10.0, C4 8.0.
  - `test_m3_material_without_density_is_listed`: m³ material, family density null → `'sin_masa'`.
  - `test_treatment_without_values_is_listed`: one destination's treatment lacks an active indicator → `'sin_tratamiento'`, nothing added.
  - `test_declared_epd_ignores_scenario`: a material with declared C3 uses it even with an approved scenario.
  - `test_scenario_rows_add_to_b4_and_per_element`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `scenario.py` and the `compute` branch. Ship `scenarios.json` with `"approved": false` and the proposal from Task 7 Step 1.
- [ ] **Step 4: Run** — Expected: PASS; suite green.
- [ ] **Step 5: Commit** — `feat(results): EVAmed end-of-life scenario for materials without declared C`

### Task 7: Phase 2 delivery (owner gates)

- [ ] **Step 1: Proposal.** Write in `docs/end-of-life-scenario.md` the table per family: destinations and shares, distance, density, and the source of each number (or "supuesto"). Ask the owner to approve or change it. Without approval stop here: nothing in this task runs.
- [ ] **Step 2:** With the approved numbers in `scenarios.json` (`"approved": true`), tests green, ask to push; push with OK.
- [ ] **Step 3:** On dev: `ecoinvent_resolve --entity-types waste_treatment --verify` then `--apply` (free); `ecoinvent_refresh --only waste_treatment --method EN15804+A2 --count-only` → report the new-dataset count and wait for OK; then refresh both methods with `--max-datasets` equal to the count of pinned treatments.
- [ ] **Step 4:** Verify a dev project with ecoinvent materials shows C2–C4 > 0 and the manual describes the scenario with its sources.
