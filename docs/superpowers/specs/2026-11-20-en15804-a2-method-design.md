# EN 15804+A2 as EVAmed's method, with ECO Platform EPDs — design

Date: 2026-11-20. Status: draft for owner approval.

## Intent

EVAmed adopts **EN 15804+A2** as its impact method (owner decision, 2026-11-19). The trigger is the
ECO Platform (ECO Portal) EPDs: 128 of the 129 Mexican and Latin American EPDs downloaded on
2026-11-19 are EN 15804+A2, and three of their core indicators (acidification, eutrophication,
photochemical ozone) cannot be converted into the CML units EVAmed uses today. Rather than store
half of each EPD, EVAmed switches method. Old-method data is hidden, never deleted.

## Goals

1. A site-wide **active method** setting. Today's data is `CML`; the new method is `EN15804+A2`
   and becomes the active one. Only the active method's indicators are served, calculated and shown.
2. The **13 EN 15804+A2 core indicators** as new indicator rows (list below), all shown on the
   results pages.
3. Import **125 ECO Platform EPDs** as materials in a new **"ECO Platform"** database, carrying their
   A1-A3 values for all 13 indicators, marked `provider_code='eco_platform'` (so the existing
   access rule limits them to verified `correo.uia.mx` / `ibero.mx` users).
4. Re-score the **ecoinvent** entities (materials, transport, energy types, construction sources)
   with ecoinvent's EN 15804+A2 (EF 3.1) indicators, stored next to their CML values.
5. The catalogue (material lists, pickers, explorer, Excel templates) offers only materials that
   have values in the active method. Everything else stays stored.
6. Results show the active method only. A project that contains materials without active-method
   values shows a **warning listing those materials**: "Este proyecto usa N materiales del método
   anterior; no se incluyen en los resultados". Users swap them for A2 materials.

## Non-goals

- Deleting or converting old-method data (EPiC, the 62 "EPDs" rows, mexicaniuh, ecoinvent CML
  values, CML indicator rows). They stay in the database untouched.
- Showing two methods at once, or a per-project method. One active method site-wide.
- Using the EPDs' own A4–D figures. EVAmed keeps calculating A4 onward from project data.
- Downloading more EPDs from ECO Portal (129 of the 500 allowed are used; all needed files are
  local).
- A UI for switching method. It's a deploy-time setting.

## Anti-goals (would be a failure even if it "works")

- Any old-method value silently counted as an A2 value, or vice versa (for example a CML GWP
  row summed into A2 climate change).
- A missing value silently treated as zero without the warning.
- ECO Platform data reaching an ineligible user through any new path (results warning list,
  indicator lists, templates, explorer).
- Old projects that no longer open or that lose stored rows.
- Unapproved ecoinvent quota use.

## Constraints

- Owner rules (docs/handoff/2026-11-08-handoff.md §2): no changes to
  `frontend/evamed/src/app/calculos/*` without owner approval; no new dependencies; commit and push
  only when the owner asks (push deploys dev); ecoinvent quota needs the owner's OK with a number
  first; never print credentials; the dev database is not reseeded, so data changes need an
  explicit command run on dev.
- ECO Portal files live outside the repo in `~/ecoplatform/search/epds/<uuid>.json` (ILCD+EPD
  JSON as served by `GET /v1/ilcd/{regAuth}/{uuid}`). They are licensed data: don't commit them.
  They must be copied to the dev server to run the import there.
- ECO access rule from b5e5b8f / 393275c (`projects_api/access.py`) stays authoritative.

## Approaches considered

- **A. Method column on indicators, A2 values next to CML values.** Server serves only one fixed
  method. Simple, but hard-codes the switch.
- **B. A plus a site-wide active-method setting (chosen by the owner).** Same storage as A; the
  active method is configuration, so EVAmed could return to CML or a later method without code
  changes.
- **C. Separate A2 tables.** Every query, calculation and admin screen would read two places. Rejected.

## Design

### Indicators

- `PotentialType` gains `method` (`'CML'` | `'EN15804+A2'`, default `'CML'`; a migration marks every
  existing row CML).
- Setting `EVAMED_IMPACT_METHOD` (Django setting from env, default `EN15804+A2`), read through one
  helper (e.g. `projects_api/methods.py: active_method()`).
- The 13 new rows (Spanish full names are the builder's to polish; they must not collide with any
  CML row's `name_complete_potential_type`, because the frontend keys results by that name):

| short name | indicator | unit |
|---|---|---|
| GWP-total | Calentamiento global, total | kg CO2 eq |
| GWP-fossil | Calentamiento global, fósil | kg CO2 eq |
| GWP-biogenic | Calentamiento global, biogénico | kg CO2 eq |
| GWP-luluc | Calentamiento global, uso y cambio de uso de suelo | kg CO2 eq |
| ODP | Agotamiento de la capa de ozono | kg CFC-11 eq |
| AP | Acidificación (excedencia acumulada) | mol H+ eq |
| EP-freshwater | Eutrofización, agua dulce | kg P eq |
| EP-marine | Eutrofización, marina | kg N eq |
| EP-terrestrial | Eutrofización, terrestre | mol N eq |
| POCP | Formación de ozono fotoquímico | kg NMVOC eq |
| ADPE | Agotamiento de recursos abióticos, minerales y metales | kg Sb eq |
| ADPF | Agotamiento de recursos abióticos, combustibles fósiles | MJ |
| WDP | Escasez de agua (privación) | m3 world eq deprived |

  Missing `Unit` rows are created. Rows are seeded by data migration (the fixture load is
  `|| true` and unreliable; same reasoning as migration 0080).
- Everything that lists indicators to the frontend (the potential-type catalogue endpoint and any
  nested serializers) returns only active-method rows. This is how `calculos/*`, the charts and the
  comparison page get A2 indicators without being edited. The builder must confirm that holds;
  if a `calculos/*` change turns out to be unavoidable, stop and ask the owner.
- `ProjectResultsView` iterates only active-method indicators (replacing the `_IMPACTOS_IGNORAR`
  name list for this purpose).

### "Has values in the active method"

One server-side rule, in one place: a material is **current** when it has a value for **every**
active-method indicator, either as one A1-A3 row (standard id 1) or as A1, A2 and A3 rows
(standards 2-4). A material with any indicator missing is not current (builder-check finding: an
"at least one" rule would let a gap be summed as 0 with no warning). The same rule applies to
transport, energy types and construction sources (every active-method indicator present).

**Catalogue vs project reads (builder's call, recorded):** the existing `/materials/` (and the
other catalogue list endpoints) stay **unfiltered**, because the browser uses them to resolve
names and databases for rows already in projects: the comparison page runs
`calculos.OperacionesDeFase` against that list, and the materials-stage autosave
(`buildSchemeItems`) maps names to ids through it and then replaces the stored set, so filtering it
would crash old projects and delete their rows. Instead, add a separate **offerable** catalogue
(a new endpoint or a query parameter) that applies `visible_materials(user)` ∩ current, and point
the pickers, explorer (counts, facets, ranking) and the Excel template catalogue at it. Old
projects open with all their rows; autosave never drops a row because its material is not offered.
ECO access (`visible_materials`) still applies to the unfiltered endpoints as today.

After the switch the MEXICANIUH electricity grids and other entries without A2 values drop out of
the pickers (owner accepted, 2026-11-20).

### ECO Platform import

- New database name `ECO Platform`: a `DataBaseMaterial` row (so the results database toggle lists
  it) and a source-chip label in the explorer (no logo).
- New management command, e.g. `ecoplatform_import --dir <path> [--apply]`, dry run by default,
  idempotent (matched by EPD UUID + version; re-running updates values, adds nothing twice).
  Store the EPD UUID, version and registration-authority UUID on the material (new nullable
  fields, or a small side table — builder's choice) so rows can be re-matched and later purged.
- Scope: the 129 downloaded EPDs minus four: *Steel Slang* (slag, not a building material),
  *Bekron Cementitious adhesives*, *PEGAMENTO MEDIO PVC TRANSPARENTE* (owner dropped adhesives), and
  *Reinforcing steel in bars* (BR, the one EN 15804+A1 EPD, which has no A2 values). **125 imported.**
- Name: `<Familia>_<EPD name> marca <owner>_<country code>`, e.g.
  `Cemento_CPC 40 Cement marca Cooperativa La Cruz Azul_MX`. The family is the keyword
  classification from the selection page, corrected where it was wrong (e.g. Gyplac, Superboard and
  fibre-cement boards are not "Cemento"); the builder produces the final family list for the owner to
  review in the dry run. `derive.region()` learns the Latin American codes in use (BR, CL, AR, CO, PE,
  CR …) so the explorer shows the country.
- Description: the EPD's own product description when present, plus the declared unit and the
  ECO Portal link.
- Values: A1-A3 (module `A1-A3`, stored under standard id 1) for each of the 13 indicators, mapped
  by the LCIA method UUID in `LCIAResults` (both EF 3.0 and EF 3.1 UUIDs occur for GWP; map both;
  ignore `GWP-GHG`). If an EPD has no `A1-A3` module but has `A1`, `A2`, `A3`, store those under
  standards 2-4 (true for *Yura MAX ICo Type Cement*). `ND` and missing values are not stored.
  Checked 2026-11-20: 124 of the 125 have all 13 indicators as A1-A3; Yura has them as A1/A2/A3.
- Unit: from the reference flow's flagged `flowProperties` (`referenceUnit`), divided by
  `resultingflowAmount` where needed so values are per one EVAmed unit: 1000 kg → `Ton` (values per
  tonne, like the existing Ternium rows), kg → `Kg`, m² → `m²`, m³ → `m³`, m → `m`, pcs → `Pz`. For
  the 28 EPDs where no property is flagged, infer from the properties present (`Area`=1 → m²,
  `Volume`=1 → m³, unnamed 1000 → tonne) and list each inference in the dry run for the owner to
  check before `--apply`.
- `Conversions` (weight factor used for A4/B4 transport): set when the EPD gives a mass per declared
  unit (`Mass` property, or `gross density` × volume for m³), in the unit `ProjectResultsView`
  expects (the builder confirms it is tonnes per declared unit from existing rows before writing).
  When no mass is known, write no `Conversions` row and list the material in the dry run.
- **A4 without mass (builder's call, recorded):** today `ProjectResultsView` uses
  `conv_lookup.get(mat.id, 1)`, i.e. silently 1 tonne per declared unit. For current-method
  materials with no `Conversions` row, leave their transport out of A4/B4 and list them in the
  results warning ("sin masa: transporte no incluido") instead of assuming 1 t. Legacy behaviour
  for CML is unchanged.

### ecoinvent EF 3.1 re-scoring

- Find the EF 3.1 (EN 15804+A2) indicator ids for the 13 indicators in the ecoinvent API (searches
  are free) and add them, mapped to the new indicator rows, alongside the CML map
  (`EcoinventIndicatorMap` keyed per method).
- `ecoinvent_refresh` gains the method dimension and writes A2 values next to the CML ones for
  materials, transport, energy types and construction sources.
- Before any fetch: report the exact number of distinct datasets and which were never fetched
  before. **The owner approves that number before the refresh runs.** The licence usage report
  (`EcoinventUsageReport`) is queued as today.
- Sandbox caveat stands (values not fit for real results until a production licence).

### Biogenic carbon (owner decision, 2026-11-20)

EN 15804+A2 counts biogenic CO2 taken up in A1-A3 as negative (−1) and requires it to be released
at end of life (+1). EVAmed does not use the EPDs' C-module figures, so for each material row the
results add an end-of-life (C3/C4) emission on **GWP-biogenic and GWP-total** equal to the
material's A1-A3 GWP-biogenic uptake × quantity (only when that value is negative). Shown inside
the existing end-of-life stage. Applies to every current material, ECO or ecoinvent.

### Carbon scale and default indicator (owner decision, 2026-11-20)

The carbon scale (`EscalasCarbono.json`) and the default/first indicator use **GWP-total**
("Calentamiento global, total"). The owner approved the one `calculos/*` change this needs: the
`ajustarNombre("Calentamiento Global")` lookup in `calculos.ts` (`determinaValorCarbono`) reads the
active method's GWP-total instead. Any further `calculos/*` change still needs the owner. Update
the non-`calculos` hard-coded names too (`home-evamed.component.ts` ~line 942, the explorer's
`'PCG 100'` GWP key).

### Results warning

`ProjectResultsView` adds a field listing what was left out of the results, returned only for
projects the caller can already see:
- material rows whose material is not current (id, name, database, section/stage);
- current materials with no mass (transport not included);
- transport, energy and construction entries used by the project that have no active-method values.

The results page (home component, and the comparison page where it shows per-project results)
shows the notice with the list. No sandbox notice (owner decision). The list can't leak ECO data:
an ineligible user can't open a project containing ECO rows at all.

### Admin screens

Admin screens (materials, indicators, transport, energy) see all indicators of every method, so
the indicator filter applies to user-facing endpoints only (e.g. `update-material.component.ts`
reads `potencial[0].name_complete_potential_type` and would break on a filtered list). Builder's
call.

## Left to the builder

- Exact field names, the import command's structure, Spanish wording of names and notice, where
  the method helper lives, and how the transport/energy/source catalogues are filtered.
- Which entries the results database toggle lists after the switch (at least "ECO Platform" and
  "ECOINVENT 3"; databases with no current materials may be hidden).
- Tests: Django tests for the method filter, "current" rule, importer (unit inference, ND handling,
  idempotency), results warning, and ECO access on every new path; Vitest for the warning UI.

## Rollout

1. Deploy code with `EVAMED_IMPACT_METHOD=CML` first: nothing visible changes.
2. Copy the 125 EPD files to the server (outside the repo), run `ecoplatform_import` dry run, owner
   reviews families and units, then `--apply`.
3. Owner approves the ecoinvent dataset count; run the EF 3.1 refresh.
4. Switch `EVAMED_IMPACT_METHOD=EN15804+A2` on dev (EVAmed's only environment; owner chose to
   switch now, without a sandbox notice) and redeploy. Check an ECO-eligible and an ineligible
   account, an old project (warning shown) and a new A2 project.
5. Update docs: `docs/ecoinvent-api-findings.md` §9, a new `docs/ecoplatform-api-findings.md`
   (API, licence counts, files), README command sequence.
