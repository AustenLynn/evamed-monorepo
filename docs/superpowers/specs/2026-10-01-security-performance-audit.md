# Security and performance audit (dev, before real users)

**Date:** 2026-10-01
**Goal (user):** people outside the team will soon use `dev.evamediber.click` with their own projects. Find the security and performance gaps that matter for that.
**Assumptions:** dev stays one 2 GB Lightsail box; users self-register through Firebase; production-only concerns (HA, a separate prod) are out of scope.
**Method:** read-only. Code reading, read-only HTTP requests to dev, two read-only SQL queries on the dev DB, and an OSV query for backend pins. Nothing was changed.

## Findings

| # | Finding | Evidence | Plan |
|---|---|---|---|
| 1 | The new-project materials page **appends** material rows on every autosave instead of replacing them. Duplicate rows count again in the results. | `materials-stage.component.ts`: `startAutosave()` (every 5 s, on any change to `indexSheet`/`SOR`/`SOD`/`SOU`/`contentData`) calls `saveStepOne()`, which POSTs every selected row. There's no delete and no unique constraint. Deselected systems' rows are never removed. Each row also costs a `searchMaterial` request. Dev DB: 50 extra identical rows in 7 projects (up to 4 copies). | `plans/2026-10-01-materials-save-replaces.md` |
| 2 | No security response headers: HSTS, framing protection, `nosniff`, `Referrer-Policy` or CSP. | `curl -D -` on `/`, `main-*.js`, `/api-projects/…`. The Caddyfile sets none. | `plans/2026-10-01-security-headers.md` |
| 3 | Dependencies with advisories. **Backend:** DRF 3.16.1 (fixed 3.17.2), sqlparse 0.5.5 (fixed 0.6.0), requests 2.32.4 (fixed 2.33.0). **Frontend runtime:** 5 high, namely `@angular/router` 22.1.6 (SSR-only DoS, fixed in 22.2.0) and `firebase` → `@firebase/firestore` → `@grpc/grpc-js` 1.9.16 (server-side gRPC; Firestore is unused). | OSV `querybatch` and `npm audit --omit=dev`, 2026-10-01. The 2026-09-14 hardening had left the npm audit at zero. None of these is reachable from user input here. | `plans/2026-10-01-dependency-upgrades.md` |
| 4 | Fingerprinted bundles are served with `cache-control: public, max-age=0`, so every visit revalidates about 1.65 MB of JS and CSS. | `curl -D -` on `main-XKXL4GGQ.js` | `plans/2026-10-01-static-asset-caching.md` |
| 5 | The results page (`comparar`) downloads 19 catalogues (~1 MB raw, ~150 KB compressed) and recomputes in the browser. Home already uses `GET /projects/<id>/results/`, so the two pages can disagree. | `comparar.component.ts` constructor `forkJoin`; `home-evamed.component.ts:422` | `plans/2026-10-01-results-page-server-results.md` |
| 6 | `materials` (348 KB) and `material-scheme-data` (331 KB) are re-downloaded because `MaterialsService` doesn't cache them; the other catalogues are already cached by `AnalisisService`/`CatalogsService`. **Found while planning:** `AnalisisService.getMaterialSchemeProyect()` caches the *user's own* project rows for the whole session with no invalidation. The results page then computes from stale rows after an edit, and after a sign-in as someone else in the same tab it would use the previous user's rows. `ProjectsService` has a similar cache that isn't cleared on add. | grep of `getMaterials()` and friends; `analisis.service.ts`, `projects.service.ts`, `comparar.component.ts:252` | `plans/2026-10-01-shared-catalogue-cache.md` |
| 7 | No API pagination. Fine at today's sizes, since project data is per user and the largest catalogue is 348 KB. | settings, live sizes | Decision record: `plans/2026-10-01-deferred-pagination-and-revocation.md` |
| 8 | The uploaded file's name is written with `innerHTML`. That's self-XSS only, since only the uploader can trigger it. | `to-do-file.component.ts:48` | `plans/2026-10-01-upload-filename-text.md` |
| 9 | No monitoring: no uptime alarm and no frontend error reporting. | infra and frontend have none | `plans/2026-10-01-uptime-alarm.md` |
| 10 | Revoked Firebase tokens are accepted until they expire (at most 1 h). | `profiles_api/authentication.py`: `verify_id_token(...)` without `check_revoked` | Decision record (with #7) |

## Checked and fine

- Every one of the ~45 routes and the 3 custom `APIView`s is scoped to the owner's verified email (`access.py`).
- Anonymous requests to project and user data return 401.
- `DEBUG` is off (a generic 404 page).
- No secrets have ever been committed (git history).
- SheetJS is 0.20.3.
- Responses are compressed (zstd/gzip).
- `ProjectResultsView` uses batched queries.
- Home loads results per tab.
- gunicorn runs 4 workers × 2 threads.
