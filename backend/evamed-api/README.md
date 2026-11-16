# Profiles REST API

Profiles REST API course code.

## ecoinvent integration

Impact factors for the ecoinvent-sourced slice of the catalogue (37 materials,
7 transports, 3 MX electricity types, 11 machinery sources) can be refreshed
from the ecoinvent REST API. See `docs/ecoinvent-api-findings.md` for how the
mapping was established.

Configuration lives in `.env` (see `.env.example`). Nothing in the request path
calls the API: values are fetched by command and cached in the existing tables.

```bash
# 1. Pin EVAmed rows to ecoinvent dataset ids. Costs no licence quota.
python manage.py ecoinvent_resolve --dry-run     # inspect first
python manage.py ecoinvent_resolve --apply
python manage.py ecoinvent_resolve --verify      # re-check pins still match

# 1b. Add the construction materials in ecoinvent/data/construction_materials.json
#     (cements, steels, concrete, blocks, mortars, plasters, gypsum, aggregates,
#     bricks), already pinned. Costs no quota.
python manage.py ecoinvent_add_materials             # dry run
python manage.py ecoinvent_add_materials --apply

# 2. Refresh impact factors. SPENDS unique-dataset quota — dry-run first.
python manage.py ecoinvent_refresh --dry-run
python manage.py ecoinvent_refresh --apply
python manage.py ecoinvent_refresh --only type_energy --apply   # one slice

# 3. Submit licence usage reports (needs ECOINVENT_ORGANIZATION_ID).
python manage.py ecoinvent_report_usage --dry-run
python manage.py ecoinvent_report_usage --send
python manage.py ecoinvent_report_usage --periodic --send       # cache-served
```

`projects_api/ecoinvent/data/pins.json` is the committed audit artifact: it
records which dataset each row resolved to, the match method and score, and the
runners-up. Review its diff when a number looks wrong.

Notes:

- The licence caps the number of **distinct** datasets whose scores you fetch.
  Repeat fetches of an already-seen dataset are free. `--max-datasets N` aborts
  before spending quota.
- `ECOINVENT_VERSION` defaults to `3.12-sandbox`, whose values are **not
  authoritative**. Running against a production version requires
  `ECOINVENT_ALLOW_PRODUCTION=True`.
- The `geography` filter needs the full display name (`Mexico (MX)`); a bare
  code returns HTTP 200 with zero results. The client guards against this.

## ECO Platform access

ECO records must set `Material.provider_code = 'eco_platform'` explicitly. Existing
records default to `legacy`; existing EPD records are not automatically ECO imports.
Deploy migration `0086_material_provider_identity` and backend filtering before any ECO
imports. Audit and classify any records imported outside the forthcoming importer.

`GET /api-projects/me/` returns `can_access_ecoplatform`. Only authenticated identities
with a verified email at exactly `correo.uia.mx` are eligible, including administrators.
ECO materials, factors, conversions, explorer data, and Excel catalogs are filtered.
Projects with ECO material references in either current or original rows are hidden
from ineligible owners, including their children and calculation endpoints. Stored data
is retained and becomes accessible when the same ownership identity is eligible again.
Removing the last ECO reference from both representations removes the restriction.

Eligibility follows the Firebase token accepted by the backend. Issued tokens can
retain prior claims until refresh/expiry; this feature does not implement immediate
session revocation or transfer projects between email addresses. The frontend refreshes
capabilities on token changes and window focus, clearing caches and project context on
identity/access changes. Already downloaded files cannot be recalled.

No ECO API ingestion or EN15804 model changes are part of this segmentation feature.
