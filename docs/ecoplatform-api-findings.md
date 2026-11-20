# ECO Platform (ECO Portal) API — findings

Last updated 2026-11-20.

## Access

- API: `https://api.portal.eco-platform.org/v1/`, key in the `x-api-key` header. The old
  soda4LCA address (`data.eco-platform.org/resource/…`) now redirects to the portal home page.
- Docs: `https://portal.eco-platform.org/docs/developers` (users: `/users/auth`, reference: `/reference`).
- Key: owner's local file `~/ecoplatform/.env` (`ECOPLATFORM_API_KEY`, mode 600). Never printed or
  committed. For the server it follows the ecoinvent pattern (`deploy/.env.aws` + `push-secrets.sh`);
  not wired yet because the import reads local files.
- Licence: Non-Commercial Use approved for EVAmed; data restricted to verified `correo.uia.mx` and
  `ibero.mx` users (`projects_api/access.py`, `provider_code='eco_platform'`). Limit 500 EPDs.
- Rate limit headers: `ratelimit-limit: 1000`, reset each minute; the docs also mention a daily quota.

## Endpoints used

| Call | Cost | Notes |
|---|---|---|
| `GET /v1/search?q=&location=&classes=&valid=&pageSize=&startIndex=` | free | `pageSize` up to 1000. Default `valid` filter keeps only EPDs passing DDR v1.1 validation (6,632 of 51,112 on 2026-11-19); `valid=all` for everything. `location` is an exact country code. |
| `GET /v1/ilcd/{regAuthUuid}/{epdUuid}` | counts toward the 500 | Full ILCD+EPD JSON: `LCIAResults` per module (A1-A3 … D), reference flow with `flowProperties`. |

## Downloads

| Date | What | EPDs |
|---|---|---|
| 2026-11-19 | Every EPD located in MX (38) and other Latin American countries (91) in the construction families | 129 of 500 |

Files: `~/ecoplatform/search/epds/<uuid>.json` (owner's machine; not in the repo). Search summaries
and the selection page data are in `~/ecoplatform/search/`.

## What the files contain

- 128 of 129 are EN 15804+A2 (EF 3.0 or 3.1); one (`Reinforcing steel in bars`, BR) is A1.
- 124 of the 125 imported have all 13 core indicators as A1-A3; *Yura MAX ICo Type Cement* has
  them as A1/A2/A3 only.
- Only 2 of the 57 Mexican EPDs pass DDR v1.1 validation, but the non-validated ones still carry
  machine-readable values.
- The declared unit is not flagged in 28 files; `ecoplatform_import` infers it (area, volume, or a
  1000 kg mass) and lists each case.
- Three publishers attach the EF 3.1 fossil/biogenic GWP method UUIDs the other way round; their
  values follow the label, so the importer reads climate sub-indicators by label.

## Import

`python manage.py ecoplatform_import --dir <folder> [--apply]` (families in
`projects_api/ecoplatform/data/families.json`). Excluded by the owner: *Steel Slang*,
*Bekron Cementitious adhesives*, *PEGAMENTO MEDIO PVC TRANSPARENTE*. Dry run on 2026-11-20:
125 to import, 4 skipped, 28 inferred units, 22 without mass (their A4 transport is left out of results).
Not yet run on dev.
