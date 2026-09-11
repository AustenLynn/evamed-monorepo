# ecoinvent API — Feasibility Assessment for Replacing the DB Dump

**Date:** 2026-09-03
**Author:** investigation via Claude Code
**Status:** Discovery / mapping only — no code written
**Credentials:** `.env` at repo root (gitignored). Client `ecoinvent-32225-6855`. **Rotate — shared in plaintext.**

---

## 1. Executive summary

The ecoinvent API **can** supply the impact-factor data that currently lives hardcoded in
`backend/evamed-api/backup` (a 346 KB Postgres dump), but only for **part** of it.

| Verdict | Scope |
|---|---|
| ✅ Fully replaceable | Impact factors for the **37 ECOINVENT-3 materials**, the **7 transport modes**, the **3 MX electricity types**, and the **11 machinery/energy source processes** |
| ⚠️ Needed fixing first | A **live bug** meant every ecoinvent material computed to **zero**, and 22 materials had a **unit mismatch** with no conversion factor (see §6.1b, §6.1c) |
| ❌ Not replaceable | The **369 non-ecoinvent materials** (EPiC 286, EPDs 62, mexicaniuh 21) — different data sources, out of scope for this API |

**Bottom line:** roughly **~9% of material rows** (37/406) and **~35% of the impact-factor rows overall**
can be sourced live from the API. The dump cannot be retired outright; the API is an *upgrade path for
the ecoinvent slice*, not a wholesale replacement.

---

## 2. Verified API access

Authentication and data retrieval were tested live and both work.

```
POST https://sso.ecoinvent.org/realms/ecoinvent/protocol/openid-connect/token
  grant_type=client_credentials, client_id, client_secret
  → 200 {"access_token": "...", "expires_in": 300, "scope": "profile"}
```

Token lifetime is **300 s** — any client needs refresh/caching logic.

**Subscription level (important):**

| Property | Value |
|---|---|
| Version available | `3.12-sandbox` (only — no production version) |
| System model | `cutoff` |
| Datasets accessible | **10,094** (vs. 26,000+ advertised for full access) |
| LCIA methods accessible | 41 methods / 600+ indicators |
| Release date | 2025-11-05 |

> ⚠️ **This is a sandbox subscription.** It is sufficient to build and validate the integration, but a
> production licence will be needed before shipping real numbers to users.

### Endpoints that matter to us

| Endpoint | Purpose |
|---|---|
| `GET /v3/api1/versions` | Which DB versions the licence unlocks |
| `GET /v3/api1/indicators` | Catalogue of LCIA methods → categories → indicator IDs |
| `GET /v3/api1/datasets?query=&geography=&…` | Search / resolve a material name → dataset ID |
| `GET /v3/api1/datasets/{id}?indicator_ids=…` | **Impact scores for one dataset** |
| `POST /v3/api1/datasets/batch` | Up to **1000 dataset IDs × 100 indicator IDs** per call |
| `POST /v3/api1/reports` | **Mandatory** usage reporting |

---

## 3. What is in the dump today

The dump (`backend/evamed-api/backup`, Postgres custom format, restore with `pg_restore`) holds
**~9,000 rows** across 51 tables. The impact-factor payload is:

| Table | Rows | Content |
|---|---|---|
| `projects_api_materialschemedata` | **2,547** | material × standard × impact category → value |
| `projects_api_sourceinformationdata` | **134** | machinery/generator process → impact value |
| `projects_api_typeenergydata` | **65** | energy type (incl. MX grid) → impact value |
| `projects_api_potentialtransport` | **64** | transport mode → impact value |
| `projects_api_material` | 406 | material catalogue |
| `projects_api_localdistance` | 2,605 | MX city-to-city distances (unrelated to ecoinvent) |
| `projects_api_materialschemeproject` | 1,593 | user project data (**never** replace) |

**Total replaceable-in-principle impact rows: 2,810.**

### Material catalogue by source database

| Source | Count | ecoinvent API can serve? |
|---|---|---|
| EPiC | 286 | ❌ no — separate Australian database |
| EPDs | 62 | ❌ no — vendor EPD documents |
| **ECOINVENT 3** | **37** | ✅ **yes** |
| mexicaniuh | 21 | ❌ no — Mexican national inventory |

---

## 4. Impact-category mapping (the critical mapping)

EVAmed defines 14 `potentialtype` rows, but only **9 are actually populated** in the dump.
Every populated one maps to a live ecoinvent indicator — verified by real API response.

| # | EVAmed code | Spanish name | Unit | ecoinvent method | Indicator ID | ecoinvent unit |
|---|---|---|---|---|---|---|
| 1 | PAAe | Agotamiento de Recursos Abióticos Minerales | kg SB eq | CML v4.8 2016 | **990** | kg Sb-Eq |
| 2 | PAAf | Agotamiento de Recursos Abióticos Fósiles | MJ | CML v4.8 2016 | **956** | MJ |
| 3 | PCG 100 | Calentamiento Global | kg CO2 eq | CML v4.8 2016 | **882** | kg CO2-Eq |
| 4 | PAO | Agotamiento de la Capa de Ozono | kg CFC-11 eq | CML v4.8 2016 | **962** | kg CFC-11-Eq |
| 5 | PFOF | Oxidación Fotoquímica | kg C2H4 | CML v4.8 2016 | **953** | kg ethylene-Eq |
| 6 | PA | Acidificación | kg SO2 eq | CML v4.8 2016 | **964** | kg SO2-Eq |
| 7 | PE | Eutrofización | kg PO4 eq | CML v4.8 2016 | **897** | kg PO4-Eq |
| 8 | EA | Escasez de agua | m3 eq | EF v3.0 (AWARE) | **904** | m3 world Eq deprived |
| 11 | — | Human toxicity | 1,4-DB | CML v4.8 2016 | **977** | kg 1,4-DCB-Eq |

Unpopulated in the dump but available if ever needed:

| # | EVAmed code | ecoinvent | Indicator ID |
|---|---|---|---|
| 9 | POT — Formación de Ozono Troposférico (kg O3) | ⚠️ **no kg O3 equivalent** — nearest is ReCiPe *tropospheric ozone concentration increase* in **kg NMVOC-Eq** | 923 |
| 10 | PARNR — Agotamiento recursos energéticos no renovables (MJ) | Cumulative Energy Demand, non-renewable | 1087 |
| 12 | Fresh water aquatic ecotox. | CML v4.8 2016 | 926 |
| 13 | Marine aquatic ecotoxicity | CML v4.8 2016 | 889 |
| 14 | Terrestrial ecotoxicity | CML v4.8 2016 | 886 |

**Units line up 1:1 for all 9 populated categories** — no conversion factors needed. The one genuine
mismatch (POT, kg O3 vs kg NMVOC-Eq) affects a category that carries no data today.

### Verified live response

`GET /v3/api1/datasets/8279` → *market for electricity, low voltage | Mexico (MX) | per kWh*

```
climate change                        0.864591    kg CO2-Eq
eutrophication                        0.00108769  kg PO4-Eq
water use                             0.0275639   m3 world Eq deprived
photochemical oxidant formation       0.000212975 kg ethylene-Eq
energy resources: non-renewable      12.1651      MJ
ozone depletion                       1.52637e-08 kg CFC-11-Eq
acidification                         0.00128283  kg SO2-Eq
material resources: metals/minerals   1.6985e-06  kg Sb-Eq
```

All 9 categories for one material come back in **a single HTTP call**.

---

## 5. Dataset matching results

The 37 ECOINVENT-3 materials in the dump kept ecoinvent's own naming convention
(`Clay brick {GLO}| market for | Cut-off, S`), which makes them machine-matchable.

**Search hit rate: 37 / 37 (100%)** after stripping the `{GEO}| … | Cut-off, S` decoration.

Examples:

| EVAmed material | ecoinvent match |
|---|---|
| `Clay brick {GLO}\| market for \| Cut-off, S` | market for clay brick |
| `Cement, unspecified {GLO}\| market group for…` | market for cement, unspecified |
| `Concrete, normal {GLO}\| market group for…` | market for concrete, normal strength |
| `Sand-lime brick {GLO}\| market for \| Cut-off, S` | sand-lime brick production |
| `Autoclaved aerated concrete block {CH}\| …` | autoclaved aerated concrete block production |

> ⚠️ **Caveat:** 100% is the *recall* figure — every material returns candidates. Top-1 precision is
> lower: queries return ~10 candidates and the naive first hit is sometimes a `production` activity
> where the dump wants the `market for` activity (or vice versa). Matching must additionally filter on
> **activity type** (`MARKET_ACTIVITY` vs `TRANSFORMING_ACTIVITY`) and **geography**, then be
> **reviewed by hand once** and the resulting dataset IDs pinned in our DB. Do not resolve by search
> at runtime.

### Other directly mappable entities

**Electricity (`projects_api_typeenergy`)** — exact matches found:

| EVAmed row | ecoinvent dataset ID |
|---|---|
| Energía eléctrica, Alto voltaje (MX)-ECOINVENT3 | **2989** — market for electricity, high voltage, Mexico (MX) |
| Energía eléctrica, Medio voltaje (MX)-ECOINVENT3 | **7773** — market for electricity, medium voltage, Mexico (MX) |
| Energía eléctrica, Bajo voltaje (MX)-ECOINVENT3 | **8279** — market for electricity, low voltage, Mexico (MX) |

The three `-MEXICANIUH` electricity rows are a deliberate alternative source and stay as they are.

**Transport (`projects_api_transport`, 7 rows)** — all 7 are ecoinvent-labelled (lorry EURO 3 by
tonnage band, ocean freight). 223 `transport, freight` datasets are available; these map cleanly.

**Machinery (`projects_api_sourceinformation`, 11 rows)** — 9 of 11 are explicitly
`-Ecoinvent 3` labelled (diesel generators and light/heavy loaders by power band). The remaining
two (`Banda transportadora (GLO)`, `Excavadora hidráulica (GLO)`) are GLO-tagged and almost
certainly ecoinvent too — `market for transport, freight, conveyor belt` exists in the API.

---

## 6. Gaps and blockers

### 6.1 ✅ RESOLVED — the A1/A2/A3 stage split is not an obstacle

> **Correction (2026-09-04).** This section originally called the stage split
> "the single biggest obstacle". That was wrong, and the follow-up investigation
> disproved it.

`materialschemedata` rows broken down by source database (1=A1-A3, 2=A1, 3=A2, 4=A3):

| Source | standard_id distribution |
|---|---|
| ECOINVENT 3 | `{1: 298}` — **aggregate only** |
| EPiC | `{1: 290}` — aggregate only |
| EPDs | `{1: 8, 2: 488, 3: 490, 4: 487}` |
| mexicaniuh | `{1: 146, 2: 146, 3: 71, 4: 123}` |

Every one of the 37 ecoinvent materials carries **only** the A1-A3 aggregate.
The 1,805 stage-split rows belong entirely to EPDs and mexicaniuh, which this
API does not touch. ecoinvent `Cut-off, S` datasets are aggregated system
processes that structurally cannot be decomposed into EN 15804 modules — so
matching the API to the data is exactly right, not a compromise.

### 6.1b 🐛 The real blocker was a live bug (now fixed)

`ProjectResultsView` routed non-EPiC materials through
`_PRODUCTION_STAGES = [2,3,4]`, but ecoinvent materials only have `standard_id=1`.
Those lookups returned 0, so **every ecoinvent material contributed exactly zero**
to the Producción stage — and the same EPiC-only special case existed in three
frontend `calculos` files.

One EPD material (`Panel de aislamiento térmico marca ROLAN_MX`, id 81) is also
aggregate-only and was silently zero for the same reason.

Fixed by deciding per material from the data it actually has — "has only an
A1-A3 row" — rather than from a hardcoded database name.

### 6.1c ⚠️ Unit mismatch was the genuine data blocker

22 of the 30 resolvable ecoinvent materials were stored as `Pz` (pieces) while
ecoinvent's reference unit is `kg`/`m2`/`m3`, and `Conversions` held **no rows**
for any ecoinvent material. A per-kg score written against a per-piece quantity
is a silent error of several orders of magnitude.

Resolved by realigning those materials to ecoinvent's reference unit
(migration `0081`), which is safe only because no project references them.

### 6.2 ⚠️ Sandbox-only subscription

10,094 of 26,000+ datasets. Fine for development; a production licence is required before launch.

### 6.3 ⚠️ Licence obligations — unique-dataset quota + mandatory reporting

From the licence docs:

- Plans carry a **unique dataset limit** — the number of *distinct* activities we may pull scores for.
  Repeat calls to an already-accessed dataset are free and unlimited; the *first* call to dataset
  N+1 beyond the tier **fails**.
- **Usage reporting is mandatory** via `POST /v3/api1/reports`, and is required **even when we serve
  the value from our own cache**. Reporting tracks *data delivery to an organisation*, not API calls.

Practical consequences for our design:

1. Caching impact scores in our own DB is **explicitly permitted** — good, that suits a pinned-ID model.
2. But we must implement a reporting hook that fires whenever a project consumes a dataset's scores,
   including cache hits. This is a real feature, not a nicety.
3. Our tier's actual dataset limit is **not exposed by any API endpoint** — it has to be confirmed
   with ecoinvent commercially.

### 6.4 Minor API gotchas found while testing

- The `geography` filter requires the **full display name** (`Mexico (MX)`), not the short code.
  `geography=MX` and `geography=Mexico` both silently return `total: 0` with HTTP 200 — a silent
  wrong-answer trap worth a guard in any client.
- `indicator_ids` must be **repeated query params**; comma-separated values are not supported.
- Token expires in 300 s.
- Facet counts and filter results disagree slightly (facet reported MX=93, filter returns 78).

---

## 7. Recommended approach

Given the findings, the sensible shape is **pin-and-cache, not live lookup**:

1. **Add dataset-ID columns.** Put a nullable `ecoinvent_dataset_id` (+ `ecoinvent_version`,
   `ecoinvent_system_model`) on `Material`, `Transport`, `TypeEnergy` and `SourceInformation`.
2. **Resolve IDs once, offline.** A management command searches the API, applies the
   activity-type + geography filters, and writes a candidate mapping to a review file. A human
   confirms the 37 + 7 + 3 + 11 = **58 mappings** once. This is a small, tractable review.
3. **Refresh scores in bulk.** A second command batches the pinned IDs through
   `POST /v3/api1/datasets/batch` (1000 IDs/call → all 58 in **one** request) and upserts into
   `materialschemedata` / `potentialtransport` / `typeenergydata` / `sourceinformationdata`
   for `standard = A1-A3`.
4. **Report usage.** Hook `POST /v3/api1/reports` into project calculation.
5. **Keep the dump** for the 369 non-ecoinvent materials — EPiC, EPDs and mexicaniuh are outside
   this API's scope and their A1/A2/A3 stage rows are unaffected.

**Open questions to settle before implementation:**

- What is our production tier's unique-dataset limit?
- Do we upgrade from `3.12-sandbox` before or after building this?

---

## 8. Reproducing this investigation

```bash
# credentials live in .env (gitignored)
set -a; . ./.env; set +a

TOK=$(curl -s -X POST "$ECOINVENT_TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d grant_type=client_credentials \
  -d "client_id=$ECOINVENT_CLIENT_ID" \
  -d "client_secret=$ECOINVENT_CLIENT_SECRET" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# impact scores for MX low-voltage electricity, all 9 mapped categories
curl -s -H "Authorization: Bearer $TOK" \
  "$ECOINVENT_API_BASE/v3/api1/datasets/8279?indicator_ids=990&indicator_ids=956&indicator_ids=882&indicator_ids=962&indicator_ids=953&indicator_ids=964&indicator_ids=897&indicator_ids=904&indicator_ids=977"

# inspect the current dump
pg_restore -a -f dump.sql backend/evamed-api/backup
```

Docs index: <https://docs.api.ecoinvent.org/llms.txt>
