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
