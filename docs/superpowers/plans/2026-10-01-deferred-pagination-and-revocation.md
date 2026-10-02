# Deferred: API pagination, token revocation, frontend error reporting

**Status:** decision record, not an implementation plan. Nothing here is scheduled. Each item says what would trigger doing it and what the change would be at that point.

**Spec:** `docs/superpowers/specs/2026-10-01-security-performance-audit.md`, findings 7 and 10, and the error-reporting half of 9.

## 7. API pagination

**Today:** no endpoint paginates; every list returns all rows.
- **Project data is owner-scoped,** so a list holds only the caller's own rows.
- **Catalogues are shared;** the largest are `materials` 348 KB, `material-scheme-data` 331 KB and `local-distances` 265 KB raw, about 50 KB each compressed.

**Why not now:**
- **The frontend expects plain arrays everywhere.** Paginating any list endpoint would mean changing every consumer of it (dozens of `subscribe(data => data.map(…))` sites).
- **The catalogues are loaded whole by design:** autocomplete and the client-side results calculation need the full set.

**Trigger (any one of):**
- a catalogue passes **2 MB raw** (about 4× today);
- one user owns more than **200 projects**;
- a list endpoint's p95 passes **1.5 s**, against about 0.3–0.8 s today.

**Check the first two with:**

```bash
curl -sS -o /dev/null -w '%{size_download}\n' https://dev.evamediber.click/api-projects/materials/
```

and a `SELECT user_platform_id_id, count(*) … GROUP BY 1 ORDER BY 2 DESC LIMIT 5` on `projects_api_project`.

**Change at that point:** **opt-in** pagination, so nothing breaks.
- Add a DRF `LimitOffsetPagination` subclass that only paginates when `?limit=` is present.
- Set it as `pagination_class` on the affected viewset alone.
- Then move that one consumer to fetch pages.
- Write a design for it then, because the consumer change is the real work.

## 10. Revoked Firebase tokens

**Today:** `profiles_api/authentication.py` calls `auth.verify_id_token(id_token, app=app)` without `check_revoked=True`. A token stays valid until it expires (at most 1 hour) even after revocation, i.e. after `revoke_refresh_tokens(uid)`, a password change, or disabling the user.

**Why not now:**
- **`check_revoked=True` costs a call to Firebase on every API request.** The token itself is still checked locally, but the revocation check is a network fetch of the user record. That adds latency to every request, and makes the API fail whenever Firebase is unreachable.
- **No flow in the app revokes tokens today.** There's no "sign out everywhere" and no admin "disable user", so the extra check would protect nothing that currently happens.

**Trigger (any one of):**
- an account compromise needs cutting off in under an hour;
- the app gains "disable user" or "sign out of all devices";
- dev starts holding data that a one-hour window would put at risk.

**Change at that point:**
- Pass `check_revoked=True` and catch `auth.RevokedIdTokenError` / `auth.UserDisabledError` as `AuthenticationFailed`.
- To limit the cost, cache "uid not revoked" for about 5 minutes in the Django cache that throttling already uses (`CACHES['default']`), keyed by uid and the token's `auth_time`. Revocation then takes effect within 5 minutes instead of 60, at about one Firebase call per user per 5 minutes.

## 9b. Frontend error reporting

**Today:** JavaScript errors in users' browsers are invisible. Every crash fixed in late September 2026 was found by a person clicking around.

**Why not now:** it means choosing a vendor (Sentry, or a self-hosted alternative), or adding a small `/api/client-errors/` endpoint with log retention. Either way it's a privacy decision about what leaves users' browsers, so it needs a short design with the user rather than a plan.

**Trigger:** the first time a user reports a broken page that can't be reproduced, or before real users arrive if the user wants it.

**Change at that point:**
- An Angular `ErrorHandler` that POSTs `{message, stack, url, userAgent}` (no form data, no tokens) to a rate-limited API endpoint.
- The API logs it to stdout, which `dc.sh logs api` already shows.
- Design the payload and retention with the user first.
