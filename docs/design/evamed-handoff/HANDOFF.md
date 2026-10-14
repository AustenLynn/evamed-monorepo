# EVAMED · Explorador de Recursos: implementation handoff

Target repo: `AustenLynn/evamed-monorepo`. Frontend: `frontend/evamed` (Angular 22). Backend: `backend/evamed-api` (Django + DRF, Postgres).
Written against `main` @ `0580630`. Design snapshot: 2026-10-14.

```
evamed-handoff/
├── HANDOFF.md           ← source of truth for behavior, data and rules
├── PROMPT.md            ← first prompt for Claude Code
└── mockups/             ← visual reference, one file per screen
    ├── 01-produccion.dc.html
    ├── 02-ficha-material.dc.html
    ├── 03-edicion-material.dc.html
    ├── 04-construccion.dc.html
    ├── 05-uso.dc.html
    └── 06-fin-de-vida.dc.html
```

If the mockups and this document disagree, **this document wins**. If this document and the repo disagree, **neither wins automatically**: report it (§0).

---

## 0. Reconciliation protocol (do this first, keep doing it)

This handoff was written from a snapshot of the repo and a design made with sample data. Expect drift. **Your first job is to compare the handoff and mockups against the current project and report every mismatch before writing feature code.** Never resolve a mismatch silently, and never invent data to make a screen match a mockup.

### 0.1 Before any code: write `RECONCILIATION.md`

Create `docs/design/evamed-handoff/RECONCILIATION.md` with one row per finding:

| ID | Type | Severity | Where | Finding | Evidence | Options | Recommendation | Status |
|---|---|---|---|---|---|---|---|---|
| R-01 | Decision | Blocking | HANDOFF §6 · `projects_api/models.py:184` | Sector/Subsector filters have no data source | `Material` has no sector fields; categories are name prefixes | A) lookup table B) hide filters | A, team fills mapping | Open |

**Types:**
- **Inconsistency**: the handoff or a mockup contradicts the repo (a field, endpoint, route, color, component or behavior that is different or doesn't exist), or two mockups contradict each other.
- **Error**: something in the handoff, mockups or repo that is wrong. Examples: a bad value, a broken calculation, a unit mismatch, a data bug, an accessibility failure, a contrast failure.
- **Decision**: there's more than one valid way forward and the owner must choose.
- **Missing data**: the UI needs something the database doesn't store.
- **Repo drift**: the repo changed since `0580630` in a way that affects §1–§9 (check `git log 0580630..HEAD`).

**Severity:**
- **Blocking**: you can't implement the affected part correctly without an answer.
- **Major**: you can proceed with a stated default, but the result may need rework.
- **Minor**: cosmetic, or an easy follow-up.

**Rules:**
- **Evidence:** a file path with line number, a command output or a query. No finding without evidence.
- **Options:** concrete, with the cost of each. Give a recommendation but don't apply it until it's approved.
- **Mockup sample data:** findings that come only from the mockups' illustrative data (§0.4) are one grouped row, not one row per value.

### 0.2 Then stop

Post a short summary in chat: the counts per type and severity, and every **Blocking** row in full. Wait for the owner's answers. Record each answer in the row (`Status: Decided → <choice>, <date>`) before implementing that part.

### 0.3 During implementation

- New findings go into `RECONCILIATION.md` as they appear.
  - **Blocking:** stop that part and ask.
  - **Major:** proceed with the default stated in the row, mark it `Assumed`, and list it in your phase summary.
  - **Minor:** log it and continue.
- Reference finding IDs in commit messages and in the PR description, e.g. `feat(explorer): sector filter (R-01)`.
- At the end of each phase (§10), report the new findings, the assumed defaults and the still-open decisions.
- Never change existing calculations (`app/calculos/`), the data in fixtures or the dump, or other features' behavior to make the explorer fit. Log it and ask.

### 0.4 Known items to verify first

Start `RECONCILIATION.md` with these. Confirm or correct each one against the current repo; they came from the snapshot review.

| # | Type | Item |
|---|---|---|
| K-01 | Missing data | **Sector / Subsector** checkbox filters (screen 01) have no source. `Material` only has `name_material`, `unit_id`, `database_from` and `description`. The closest thing is the name prefix before `_` (~160 values). Needs a mapping table or a new field. |
| K-02 | Missing data | **Geografía** filter (screens 01, 05, 06) and geography chips: there's no geography field. It can only be derived from `(GLO)`, `(RoW)`, `(MX)` or `_MX` in names, and is null for most materials. |
| K-03 | Inconsistency | **Base de datos** options in the mockups (EcoPlatform 1,245 · ecoinvent 3.12 · Base EVAMED · Usuario) are sample data. The real values are `EPiC` 286 · `EPDs` 62 · `ECOINVENT 3` 37 · `mexicaniuh` 21 (`DataBaseMaterial`). |
| K-04 | Inconsistency | **Mockup sample data** in general (CEMEX/Holcim EPDs, alias, "Calidad", EPD validity, PCR, manufacturer, PV panels, LED, heat pump, recycling credits, grúa torre, etc.) doesn't exist in the database. Build from real fields only (§5). |
| K-05 | Decision | **Construcción / Uso / Fin de vida filters** in the mockups (Tipo de maquinaria, Combustible, Categoría, Tipo de tratamiento, Unidad) don't match the real catalogs (§5.2). Also, the owner removed "Unidad" from screen 01 but it's still on 04–06. Remove it there too? |
| K-06 | Missing data | **Fin de vida** has no impact catalog. `calculos.ts` hardcodes C3 = C4 = 0. Proposed: an empty state (§6). |
| K-07 | Decision | **Sort order.** The owner removed the sort control. Proposed fixed order: name A→Z. Alternative: lowest GWP first. |
| K-08 | Decision | **Edición de material (screen 03)** overlaps the existing `materials-stage/components/material-stage-update` and `add-constructive-material`, which already have Transporte 1/2, Tiempo de vida and Reemplazos. Restyle and reuse those components, or build a new one? A project must be active for the screen to have context. |
| K-09 | Missing data | **Tiempo de vida (años)** on screen 03 isn't stored per material. Today `replaces = ceil(project useful life / material life) − 1` (`material-stage-update.component.ts` ~l.970) and only `replaces` is saved. Keep it computed, or add a field? |
| K-10 | Error | **Transport factor unit** isn't stored. `calculos.ts` A4 uses `value × km × (conversion kg × quantity)`, i.e. per kg·km. `Conversions` was reported empty in `docs/ecoinvent-api-findings.md`, so `peso` falls back to 1. Verify whether A4 is currently correct. |
| K-11 | Error | **Material unit data:** both `Kg` and `kg`, both `Pz` and `Pza`, and 2 materials whose unit is `kg CO2 eq`. Display normalization only; report the rows. |
| K-12 | Error | **Comparison chart (screen 02):** the mockup's "Mejor 25%" (0.171) is worse than the product (0.132). It must be computed (§5.3), not copied. |
| K-13 | Inconsistency | **Stray element:** screen 02 has a grey 120×120 absolutely-positioned box near the bottom-left (`left: 391px; top: 994px`). Probably an accidental canvas edit; confirm before ignoring it. |
| K-14 | Decision | **Stage colors** (§3): the new tokens change Uso from the charts' purple (`Subetapas.json` #8A4F8B) to teal #0E7C86. Phases 1–4 leave the charts alone; phase 5 needs a decision. |
| K-15 | Inconsistency | **Global `.container { max-width: 65rem !important }`** would cap the explorer at 1040px. A wide layout variant is needed (§1). |
| K-16 | Decision | **Favorites:** no backend model exists. Proposed: `localStorage` only for now. |
| K-17 | Inconsistency | **Header:** the mockups draw their own header; the repo already has `shared/components/header`. Reuse it. A restyle is phase 5. |

---

## 1. What the repo already is (follow it)

| Topic | Repo reality | Consequence |
|---|---|---|
| Angular | 22, **NgModule-based** (`standalone: false`), bootstrapped from `AppModule` | New lazy `ExplorerModule` with `standalone: false` components. Don't migrate the app to standalone. |
| State / templates | RxJS + services, `*ngIf` / `*ngFor`, no signals | Same: `async` pipe, `BehaviorSubject` for UI state. |
| UI kit | Angular Material 22 (`app/material/MaterialModule`), Material Icons, `flexboxgrid` | `mat-select`, `mat-checkbox`, `mat-form-field`, `mat-icon`, `mat-paginator`, `mat-button-toggle`. Add `MatButtonToggleModule` and `MatPaginatorModule` to `MaterialModule`; no new dependency. |
| Routing | `app-routing.module.ts`: lazy children of `LayoutComponent`, `canActivate: [AdminGuard]` | Add `explorador` the same way. |
| Layout | `LayoutComponent` = `<app-header>` + `.container` (global `max-width: 65rem !important`) + `<app-footer>` | Add a wide variant for explorer routes (route `data: { layout: 'wide' }` → `max-width: 1440px`). Don't change `.container` globally. |
| Header / footer | `shared/components/header` has the logo image, "Acerca de" and "Manual de usuario" | Reuse them. |
| Stage icons / logos | `assets/icons/fabrica-bold.svg`, `grua.svg`, `uso.svg`; `assets/images/Etapas/*.png`; `assets/logos/EPD.png`, `EPIC.png`, `MEXICANIUH.png` | Use for the stage tabs and database chips. |
| Existing material form | `materials-stage/components/material-stage-update`, `add-constructive-material` | See K-08 before building screen 03. |
| API config | URL constants in `src/environments/environment*.ts` | Add `api_explorer` to both files. |
| Catalog caching | `core/services/catalogue-cache/CatalogueCacheService` | Use it for facets. |
| Tests / CI | Vitest via `@angular/build:unit-test`; backend `python manage.py test` (`tests_api_contract.py` style); CI also runs the prod build, `npm audit` and `pip-audit` | Ship tests in those same harnesses. |
| Style budget | `anyComponentStyle` **warn 6 kB / error 10 kB** (prod) | Tokens and shared explorer styles go in global partials. |
| Fonts | Body is Helvetica Neue; Roboto + Material Icons are loaded | Add IBM Plex Sans/Mono (§3). |

---

## 2. Screens and routes

| # | Screen | Route (proposed) | Mockup |
|---|---|---|---|
| 1 | Explorador de materiales (Producción) | `/explorador/produccion` | 01 |
| 2 | Ficha de material | `/explorador/produccion/:id` | 02 |
| 3 | Edición de material en el proyecto | `/explorador/produccion/:id/editar` **or** the existing materials-stage route (K-08) | 03 |
| 4 | Explorador de construcción | `/explorador/construccion` | 04 |
| 5 | Explorador de uso | `/explorador/uso` | 05 |
| 6 | Explorador de fin de vida | `/explorador/fin-de-vida` | 06 |

**Stage menu: 4 tabs**, matching the app's 4 stages: Producción · Construcción · Uso · Fin de vida. **Transport is not a stage or a screen.** It is set per material inside the edit form (screen 03, Transporte 1 and Transporte 2), exactly as the current app does.

Screens 1, 4, 5 and 6 are one `ExplorerPageComponent` driven by a stage config.

---

## 3. Design system (the mockup's, applied repo-wide)

Owner decision: the mockup's design system becomes EVAMED's. Phases 1–4 apply it to the explorer; phase 5 extends it to the rest of the app (§10).

Put the tokens in `src/styles/_tokens.scss` as CSS custom properties on `:root`, imported first in `styles.scss`. No raw hex in component SCSS.

| Token | Value | Use |
|---|---|---|
| `--ev-bg` | `#F3F5F8` | page background |
| `--ev-surface` | `#FFFFFF` | cards, panels |
| `--ev-surface-muted` | `#F7F9FB` | table header, form sub-panels |
| `--ev-border` | `#DDE2EA` | panel/card borders |
| `--ev-border-input` | `#CBD2DC` | inputs |
| `--ev-divider` | `#EDF0F4` | dividers |
| `--ev-skeleton` | `#EEF1F5` (border `#E3E7ED`) | loading placeholders |
| `--ev-text` | `#1B2330` | primary text |
| `--ev-text-2` | `#3A4352` | secondary text |
| `--ev-text-muted` | `#5A6474` | captions (lightest allowed for small text) |
| `--ev-tab-idle` | `#E8ECF1` | inactive stage tab |
| `--ev-primary` | `#267A26` | primary buttons, checkboxes, focus, active toggle |
| `--ev-primary-text` | `#1F6B1F` | green text/links |
| `--ev-primary-soft` | `#E5F3E5` | low-impact / credit badge |
| `--ev-warn-soft` / `--ev-warn-text` | `#FDF1D2` / `#7A4F00` | medium impact |
| `--ev-danger-soft` / `--ev-danger-text` | `#FBE4E2` / `#A3241B` | high impact |
| `--ev-star` / `--ev-star-stroke` | `#F2B705` / `#D99A00` | favorite |

**Stage colors** (active tab only):

| Stage | Background | Text |
|---|---|---|
| Producción | `#F6C343` | `#1B2330` |
| Construcción | `#F2A900` | `#1B2330` |
| Uso | `#0E7C86` | `#FFFFFF` |
| Fin de vida | `#5B6475` | `#FFFFFF` |

(`--ev-stage-transporte` is no longer used.)

**Material theme:** override the indigo-pink theme inside an `.ev-explorer` scope (primary = `--ev-primary`). App-wide is phase 5.

**Type:** IBM Plex Sans 400–700 and IBM Plex Mono, via one Google Fonts `<link>` in `index.html`. Scale: page title 24/600, section 16/600, card title 16/700, body 14, captions 12–13, card GWP 30/700 with tabular numerals.

**Shape:** radius 12px for panels and cards, 10px for sub-panels, 8px for inputs and buttons, 999px for pills. Padding 20/16/24px. Max width 1440px.

---

## 4. Components

### Shared

- **`StageTabsComponent`**: 4 `routerLink` tabs (icon, title, subtitle). The active tab gets its stage color and `aria-current="page"`. Wraps on narrow screens.
- **`ExplorerPageComponent`**: page title and subtitle; filter panel (260–320px) beside the results; stacks below about 900px.
- **`FilterPanelComponent`**: "Filtros" + "Limpiar filtros". **`SearchBox` first**, then the stage's filters (§6), then "Filtros avanzados" (collapsed; content TBD, see R-log).
  - **No GWP range filter, no Unidad filter on screen 01, no Tipo de dataset.** The owner removed these.
  - Number inputs inside the panel need `width:100%; min-width:0`. This was a real overflow bug in the mockups.
- **Results header**: "Resultados (N)" and **`ViewToggle`** (Tabla | Tarjetas, `mat-button-toggle-group`). **No sort control**; fixed order per K-07. Default view **Tarjetas**, kept in `?vista=`.

### Cards view (infinite scroll)

- **No pagination.** Load in batches of **24** (divisible by 2, 3 and 4 columns, so rows fill). Use an `IntersectionObserver` sentinel below the grid.
- **Grid:** `repeat(auto-fill, minmax(220px, 1fr))`, gap 16px. That gives 4 columns at desktop width.
- **While loading:** placeholder cards (`--ev-skeleton`, min-height about 190px) **inside the same grid**, filling the rest of the last row and one more row. Below them, a status line "Cargando más resultados… · {n} de {total}" with `role="status"`.
- **Accessibility fallback:** a visible "Cargar más" button when the observer isn't supported or the user navigates by keyboard to the end. "No hay más resultados" at the end.
- **Restoring position:** scroll position and loaded batches survive going to the detail page and back (cache in the service).

### `ResultCardComponent`

- Name with favorite star in the top-right; one-line description with ellipsis.
- GWP at 30/700 with the unit line `kg CO₂e / {unit}`, plus `ImpactBadge`.
- Footer: geography chip, shown only when known, and the database chip (logo + name).
- **The footer is pinned to the bottom** (`margin-top: auto`) so rows of cards with different text lengths line up.
- On Producción, the name links to the detail page.

### `ResultsTableComponent`

- `mat-table` with `mat-paginator`. **The table view stays paginated.**
- Columns: Nombre/Descripción · Categoría · Base de datos · GWP (unit in cell, right-aligned) · Impacto · ★.

### `ImpactBadgeComponent`

A pill with a **3-dot gauge** before the label (8px dots, 3px gap, `aria-hidden`; the label carries the meaning):

| Level | Gauge | Label | Colors |
|---|---|---|---|
| `bajo` | ●○○ | Bajo impacto | primary-soft / primary-text |
| `medio` | ●●○ | Impacto medio | warn-soft / warn-text |
| `alto` | ●●● | Alto impacto | danger-soft / danger-text |
| `credito` | recycle icon, no dots | Crédito ambiental | primary-soft / primary-text |
| `null` | no badge | | |

Filled dot = `currentColor`. Empty dot = 1.5px inset ring in `currentColor` at 60% opacity.

### `MaterialDetailComponent` (screen 02)

- **Breadcrumb and ×** both return to the list with its state preserved.
- **Header:** name, star, database chip, unit chip. No image.
- **Descripción:** the real text, clamped to 6 lines with "Ver más".
- **Información general:** Base de datos, Categoría, Unidad declarada, Etapa A1–A3, plus the ecoinvent dataset ID and version **only if** pinned.
- **Indicadores ambientales:** a table with Indicador · Unidad · A1 · A2 · A3 · A1–A3. **No bars**, because the units differ.
- **Comparación en su categoría:** computed (§5.3). Hide when the group has fewer than 5 materials.
- **Actions:**
  - "Seleccionar recurso" opens screen 03, and needs an active project (`ActiveProjectService`). With no active project, disable it with a tooltip saying to open a project first.
  - "Comparar" and "Ver fuente".

### `MaterialEditComponent` (screen 03); read K-08 first

- **Material:** Nombre comercial (textarea, prefilled with the catalog name), Cantidad + Unidad, Comentarios.
- **Transporte:**
  - **Transporte 1** ("Origen → frontera (internacional)"): Tipo de transporte (the 7 `Transport` rows, display names cleaned) + Distancia (km). Maps to `transport_id_origin` / `distance_init`.
  - **Transporte 2** ("Frontera → obra (nacional)"): maps to `transport_id_end` / `distance_end`. Its placeholder is "Selecciona un modo…".
  - Defaults when left empty mirror `calculos.ts`: origin → transport id 1, end → id 4. Show those as defaults, not as silent behavior.
- **Tiempo de vida del material:** Tiempo de vida (años), defaulting to the project's useful life, and Reemplazos, computed as `ceil(project life / material life) − 1`; editable only if the existing flow allows it (K-09).
- **Actions:** "Guardar cambios" saves the `MaterialSchemeProject` row through the existing endpoints; "Cancelar" goes back to the Ficha.
- **Right column:** a summary of the catalog material (name, GWP A1–A3 with impact badge, database, declared unit) and a "Ver ficha completa" link.
- **Validation:** quantity > 0, distance ≥ 0. A distance > 0 requires a transport type, and vice versa.

---

## 5. Backend: read-only explorer API (Django)

No endpoint today returns catalog items with their GWP. Add one. Screen 03 uses the **existing** project endpoints (`material-scheme-project`, `materials-stage/update/`); don't duplicate them.

### 5.1 Where

`projects_api/explorer/` (`views.py`, `serializers.py`, `queries.py`), following `projects_api/ecoinvent/`. Register in `projects_api/urls.py` before `include(router.urls)`:

```
GET /explorer/<stage>/            stage ∈ produccion | construccion | uso | fin-de-vida
GET /explorer/produccion/<id>/    material detail
```

Permissions follow the `IsAdminOrReadOnly` catalog convention. GET only.

### 5.2 Sources of truth

| Stage | Items | GWP | Unit |
|---|---|---|---|
| produccion | `Material` (406) | `MaterialSchemeData` where `potential_type.name_potential_type == 'PCG 100'` and `standard.name_standard == 'A1-A3'` | the material's `unit_id` |
| construccion | `SourceInformation` (11) | `SourceInformationData` (PCG 100) | its `unit_id` |
| uso | `TypeEnergy` (7) | `TypeEnergyData` (PCG 100) | its `unit_id` |
| fin-de-vida | none (K-06) | — | — |
| *(screen 03 only)* | `Transport` (7) via `/transports/` + `PotentialTransport` | PCG 100 | kg·km (K-10) |

Look things up by name, never by hardcoded PK.

**Derived fields** (pure functions with unit tests):

- `category`: the name prefix before `_`, else `null`.
- `geography`: a trailing `(GLO|RoW|MX)` or `_MX`, else `null` (K-02).
- `display_name`: the name without the `-Ecoinvent 3` / `-ECOINVENT3` / `-MEXICANIUH` suffix.
- `source`: `database_from`, or the name suffix for the other stages.
- `sector` / `subsector`: from the mapping decided in K-01. Until then, `null`, and those filters are hidden.

### 5.3 Contract

```
GET /explorer/produccion/?search=&source=EPiC&sector=&subsector=&geography=&page=1&page_size=24
```

```json
{
  "count": 20,
  "results": [{
    "id": 12, "stage": "produccion",
    "name": "Concreto_AAC block - 600 × 200 × 100 mm",
    "display_name": "AAC block - 600 × 200 × 100 mm",
    "category": "Concreto", "sector": null, "subsector": null,
    "description": "…", "source": "EPiC", "geography": null,
    "unit": "Pz", "gwp": 12.34, "impact_level": "bajo"
  }],
  "facets": {
    "sources": {"EPiC": 286, "EPDs": 62, "ECOINVENT 3": 37, "mexicaniuh": 21},
    "sectors": [], "subsectors": [], "geographies": []
  }
}
```

- **Ordering** is fixed per K-07. Items with `gwp: null` go last.
- **Pagination:** `PageNumberPagination`, default page size 24, max 100. The same endpoint serves infinite scroll (cards) and pages (table).
- **Search:** case- and accent-insensitive.
- **Facets** exclude the facet's own filter, so counts stay meaningful while that filter is applied.

**Detail** adds:
- `ecoinvent` (if pinned)
- `indicators[]` with `code`, `name`, `unit`, `a1`, `a2`, `a3`, `a1_a3`
- `comparison {group, n, mean, p25, value}`, computed over the same `category` + `unit`; `null` if `n < 5`.

### 5.4 Impact level

Computed server-side over the whole catalog group, not the current page:

- **Group:** same stage + unit, narrowed to the same category if that group has ≥ 6 items.
- **Levels:** positive GWP values in thirds → `bajo` / `medio` / `alto`; ties share the lower level. Negative → `credito`. Fewer than 3 items or `null` GWP → `null`.
- **Provisional:** log it as a Decision if the team has real thresholds.

### 5.5 Backend tests

- contract shape
- every filter
- facets
- pagination bounds
- nulls last
- detail
- `comparison` null below 5
- impact levels, including ties and negatives
- read-only: write methods return 405 or 403
- constant query count (no N+1)

---

## 6. Stage configuration (`stage-config.ts`)

| Stage | Title · subtitle | Filters in the mockup | Implement |
|---|---|---|---|
| produccion | Explorador de materiales | Buscar · Sector (checkboxes) · Subsector (checkboxes) · Geografía · Base de datos (checkboxes with counts) · Filtros avanzados | Buscar + Base de datos now. Sector/Subsector after K-01; Geografía after K-02. |
| construccion | Explorador de construcción | Buscar · Tipo de maquinaria · Combustible · Unidad | Buscar + Tipo (Generador / Maquinaria ligera / Maquinaria pesada / Otros, derived from names). The rest per K-05. |
| uso | Explorador de uso | Buscar · Categoría · Geografía · Unidad | Buscar + Base de datos (ECOINVENT 3 / mexicaniuh) + Tipo (Electricidad / Gas). The rest per K-05. |
| fin-de-vida | Explorador de fin de vida | Buscar · Tipo de tratamiento · Geografía · Unidad | Empty state: "Aún no hay escenarios de fin de vida con factores de impacto en la base de datos." Keep the tab (K-06). |

---

## 7. Behavior rules

1. **URL state:** filters, search and view live in query params. The table page is a query param too; cards scroll and don't change the URL. "Limpiar filtros" resets everything. Search is debounced at 300 ms.
2. **Loading states:** skeleton, error with "Reintentar", empty, and end of list.
3. **Number formatting:** 3 significant decimals. Tiny values use the existing `shared/pipes/exponential` pipe. Negative values use a true minus sign and green text.
4. **View switch:** going between cards and table doesn't reload data, and favorites and filters persist.
5. **Navigation:** stage tabs are `routerLink`. Producción card → Ficha → "Seleccionar recurso" → Edición. Back links preserve list state.

## 8. Accessibility and responsiveness

- **Semantic controls:** use Material components or real `<button>`, `<a>`, `<label>`, `<fieldset>`/`<legend>` for checkbox groups. Icon-only buttons need `aria-label`; the star uses `aria-pressed`.
- **Contrast:** nothing lighter than `--ev-text-muted` for small text. The old `#cbcbcb` / `#aca8a8` labels fail contrast; don't reuse them.
- **Infinite scroll:** `role="status"` on the loading line, the "Cargar más" fallback, and focus kept on the last card after loading.
- **Narrow screens:** at 390px the panels stack, tabs wrap and the table scrolls inside its box; nothing scrolls sideways.

## 9. Things not to do

- Invent data to match a mockup.
- Change `calculos.ts`, fixtures or the dump.
- Add npm or pip dependencies.
- Convert the app to standalone components.
- Put raw hex in component SCSS.
- Start phase 5 without approval.

## 10. Phases and acceptance

Stop after each phase. Run `npm test`, `npm run lint`, `npm run build -- --configuration production` and `python manage.py test`. Report new and assumed findings (§0.3).

0. **Reconciliation.** `RECONCILIATION.md` (§0.1–0.2). No feature code.
1. **Foundations.** Tokens, IBM Plex, the explorer theme scope, `ExplorerModule` + routes + wide layout, `StageTabs` (4 tabs).
2. **API.** `/explorer/<stage>/` + Producción detail, with tests.
3. **Producción explorer.** Search, filters per decisions, cards with infinite scroll, paginated table, toggle, favorites, all states.
4. **Detail, edit and other stages.** Ficha; Edición per K-08/K-09; Construcción and Uso via config; Fin de vida empty state.
5. **Repo-wide design system (separate PR, after approval).** Header, footer and existing stage pages, Material theme, chart colors (K-14), within the style budget.

**Acceptance:**

- [ ] `RECONCILIATION.md` exists, with no Blocking rows open for shipped parts
- [ ] Layout matches the mockups at 1440px and works at 390px
- [ ] One config-driven explorer page
- [ ] No raw hex in component SCSS
- [ ] Every visible filter is backed by real data
- [ ] No invented fields
- [ ] Tests added
- [ ] CI green, including style budgets
- [ ] PR lists the finding IDs addressed
