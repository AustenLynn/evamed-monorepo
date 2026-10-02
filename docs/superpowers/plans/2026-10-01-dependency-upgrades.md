# Dependency Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neither the backend nor the frontend's runtime dependencies have a known advisory, and CI fails when one appears.

**Architecture:**
- **Task 1** bumps three backend pins to their smallest fixing versions.
- **Task 2** moves Angular to 22.2.1 and forces a fixed `@grpc/grpc-js` with an npm override.
- **Task 3** adds a `dependency audit` CI job:
  - `pip-audit` over the *installed* backend environment, so transitive packages are checked too;
  - `npm audit --omit=dev` for the frontend, holding the line from the 2026-09-14 hardening plan.

**Tech Stack:** pip, `pip-audit`, npm, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-01-security-performance-audit.md`, finding 3.

## Global Constraints

- **Target pins** (the smallest version that fixes every listed advisory):
  - `djangorestframework==3.17.2`, from 3.16.1 (GHSA-2m8g-3cmr-wg3w, GHSA-g47c-3xmw-q6m2);
  - `sqlparse==0.6.0`, from 0.5.5 (GHSA-3496-9g83-7v6x, -cfqr-cjx5-5jcm, -f2ff-p2ww-7p4p, -prg7-hcfm-mfcr, -pwgv-4x5q-6m9f);
  - `requests==2.33.0`, from 2.32.4 (GHSA-gc5v-m9x4-r6x2).
- **Compatibility, checked on PyPI 2026-10-01:**
  - DRF 3.17.2 needs `django>=4.2` and Python ≥ 3.10;
  - sqlparse 0.6.0 satisfies Django 5.2's `sqlparse>=0.3.1`;
  - requests 2.33.0 needs Python ≥ 3.10.
  - Production runs Python 3.12 (`python:3.12-slim-bookworm`).
- **Frontend runtime findings** (`npm audit --omit=dev`, 2026-10-01: 5 high):
  - **`@angular/router` 22.1.6:** GHSA-ff3f-86qr-9cv3 is an SSR-only denial of service. This app has no SSR, so it can't be triggered, but it's fixed in 22.2.0. Every `@angular/*`, `@angular/cdk`, `@angular/material`, `@angular/cli` and `@angular-devkit/build-angular` package moves to **22.2.1**, all of which exist.
  - **`firebase` → `@firebase/firestore` 4.17.2 → `@grpc/grpc-js` 1.9.16:** GHSA-m9gg-hp2v-232j and GHSA-f596-whhp-79r4, server-side gRPC issues fixed after 1.13.5. Even the latest firebase (12.19.0) pins `~1.9.0`, and npm's suggested "fix" is a downgrade to firebase 9.14.
    - The app never imports Firestore. gRPC is only Firestore's Node transport; browsers use WebChannel. So an `overrides` entry forcing **`@grpc/grpc-js` 1.14.5** can't affect runtime.
    - `npm audit` has no per-advisory waiver, so the override is how the audit gets to zero.
- **Leave every other pin unchanged** (Django 5.2.17, firebase-admin 7.5.0, gunicorn 23.0.0, psycopg2 2.9.13, django-cors-headers 4.9.0, whitenoise 6.12.0).
- **The backend suite must stay green** (the current `backend` CI job count, 115+ tests).
- **Backend commands need Docker or CI.** Locally, Docker Desktop's WSL integration must be on. Otherwise push the branch and read the GitHub Actions jobs.

## Review Focus

- **DRF 3.17 behaviour changes in serializers or the browsable API** used by the app. The full backend suite covers the API contract (`tests_api_contract.py`); Task 1 runs it.
- **A transitive package with an advisory** that isn't in `requirements.txt` (e.g. `urllib3`, `cryptography`). Task 2 audits the installed environment, not just the pins.
- **An advisory published later, with no fix available yet.** That would turn CI red on unrelated PRs. Task 3 documents how to waive one backend ID with `--ignore-vuln`; frontend ones need an `overrides` entry or an upgrade.
- **The Angular minor update changes behaviour.** Task 2 runs the frontend suite and the production build, and the dev click-through is listed under "After this plan".
- **Firestore code becomes reachable later** (someone imports `firebase/firestore`). The override would then run in a browser bundle that doesn't use gRPC anyway; the note in `README.md` (Task 3) says the override exists and why.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `backend/evamed-api/requirements.txt` | Modify | Three pins |
| `frontend/evamed/package.json`, `package-lock.json` | Modify | Angular 22.2.1; `overrides` for `@grpc/grpc-js` |
| `.github/workflows/tests.yml` | Modify | `audit` job; deploy `needs` it |
| `README.md` | Modify | One line in the Spanish CI section |

---

### Task 1: Bump the three pins

**Files:**
- Modify: `backend/evamed-api/requirements.txt`

- [ ] **Step 1: Prove the current pins fail an audit (the failing test)**

Run from the repo root:

```bash
python3 -m venv /tmp/pa && /tmp/pa/bin/pip install -q pip-audit
/tmp/pa/bin/pip-audit --no-deps -r backend/evamed-api/requirements.txt
```

`--no-deps` checks only the listed pins, so it needs no compiler for `psycopg2`. Expected: it exits 1, listing `djangorestframework 3.16.1`, `requests 2.32.4` and `sqlparse 0.5.5`.

- [ ] **Step 2: Bump the pins**

In `backend/evamed-api/requirements.txt`, change exactly these three lines:

```
djangorestframework==3.17.2
requests==2.33.0
sqlparse==0.6.0
```

- [ ] **Step 3: Re-run the audit**

Run `/tmp/pa/bin/pip-audit --no-deps -r backend/evamed-api/requirements.txt`. Expected: `No known vulnerabilities found`, exit 0.

- [ ] **Step 4: Run the backend suite**

Run: `docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api sh -c "pip install -q -r requirements.txt && python manage.py test"`. Without Docker, push the branch and use the `backend` CI job.

Expected: every test passes, with the same count as on `main`. If any fail, read DRF's 3.17 release notes for the failing behaviour, then stop and report rather than changing app code.

- [ ] **Step 5: Commit**

```bash
git add backend/evamed-api/requirements.txt
git commit -m "chore(deps): bump DRF, requests and sqlparse past known advisories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend runtime advisories

**Files:**
- Modify: `frontend/evamed/package.json`, `frontend/evamed/package-lock.json`

- [ ] **Step 1: Prove the audit fails today (the failing test)**

From `frontend/evamed`, run `npx -y -p node@22 -- npm audit --omit=dev --audit-level=low`. Expected: exit 1, `5 high severity vulnerabilities` (`@angular/router`, `firebase`, `@firebase/firestore`, `@firebase/firestore-compat`, `@grpc/grpc-js`).

- [ ] **Step 2: Update Angular to 22.2.1**

Run from `frontend/evamed`:

```bash
npx -y -p node@22 -- npx ng update @angular/core@22.2.1 @angular/cli@22.2.1 @angular/material@22.2.1 @angular/cdk@22.2.1
```

Expected:
- Every `@angular/*` dependency in `package.json` reads `^22.2.1`.
- `@angular-devkit/build-angular` reads `22.2.1`.
- `ng update` reports no migration errors.

If `@angular-devkit/build-angular` stays on 22.1.8, run `npm install -D @angular-devkit/build-angular@22.2.1`.

- [ ] **Step 3: Force the fixed grpc-js**

Add to `frontend/evamed/package.json`, at top level after `devDependencies`:

```json
  "overrides": {
    "@grpc/grpc-js": "1.14.5"
  }
```

Then run `npx -y -p node@22 -- npm install`. Expected: `npm ls @grpc/grpc-js` shows `1.14.5` (marked `overridden`).

- [ ] **Step 4: Re-run the audit**

Run `npx -y -p node@22 -- npm audit --omit=dev --audit-level=low`. Expected: `found 0 vulnerabilities`, exit 0.

- [ ] **Step 5: Tests and build**

Run:

```bash
npx -y -p node@22 -- npm test -- --watch=false
npx -y -p node@22 -- npm run build -- --configuration production
```

Expected:
- every test passes (same count as on `main`);
- the build completes, with the initial total within about 5% of 1.65 MB.

- [ ] **Step 6: Commit**

```bash
git add frontend/evamed/package.json frontend/evamed/package-lock.json
git commit -m "chore(deps): Angular 22.2.1; force a fixed @grpc/grpc-js

firebase's Firestore pins @grpc/grpc-js ~1.9.0 even in its latest release.
The app never imports Firestore and gRPC is its Node-only transport, so
overriding to 1.14.5 clears the advisories without touching runtime.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Audit dependencies in CI

**Files:**
- Modify: `.github/workflows/tests.yml`, `README.md`

**Interfaces:**
- Produces: a CI job with id `audit` and name `audit (dependencies)`. `deploy.needs` includes it.

- [ ] **Step 1: Add the job**

In `.github/workflows/tests.yml`, add after the `frontend` job:

```yaml
  audit:
    name: audit (dependencies)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-python@v7
        with:
          python-version: '3.12'
          cache: pip
          cache-dependency-path: backend/evamed-api/requirements.txt

      - name: Install libpq headers
        run: sudo apt-get update && sudo apt-get install -y --no-install-recommends libpq-dev

      # Audit what is actually installed, transitive packages included.
      # To waive an advisory with no fix yet, add --ignore-vuln <ID> here
      # with a comment saying why and when to revisit.
      - name: Backend (pip-audit)
        working-directory: backend/evamed-api
        run: |
          pip install -r requirements.txt pip-audit
          pip-audit --skip-editable

      - uses: actions/setup-node@v7
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: frontend/evamed/package-lock.json

      - name: Frontend (npm audit, runtime deps)
        working-directory: frontend/evamed
        run: npm audit --omit=dev --audit-level=low
```

Then change the `deploy` job's `needs:` to include `audit`. With the `caddy` job from the security-headers plan, that's `[backend, frontend, audit]` or `[backend, frontend, caddy, audit]`.

- [ ] **Step 2: Prove the job catches a vulnerable pin**

Do this on a throwaway branch, which you delete afterwards:

```bash
git switch -c audit-red-check
sed -i 's/^requests==.*/requests==2.32.4/' backend/evamed-api/requirements.txt
git commit -qam "TEMP: vulnerable requests pin"
git push -u origin audit-red-check
```

Expected: `audit (dependencies)` fails, naming `requests 2.32.4`. Then clean up:

```bash
git switch -
git push origin --delete audit-red-check
git branch -D audit-red-check
```

- [ ] **Step 3: Note it in the README**

In `README.md`'s Spanish CI section, add after the frontend bullet:

```markdown
- **audit** — revisa las dependencias del backend (`pip-audit`, incluidas las
  transitivas) y del frontend (`npm audit --omit=dev`); falla si alguna tiene
  una vulnerabilidad conocida. `package.json` fuerza `@grpc/grpc-js` 1.14.5
  (`overrides`) porque Firestore fija una versión vulnerable; la app no usa
  Firestore.
```

- [ ] **Step 4: Commit and verify**

```bash
git add .github/workflows/tests.yml README.md
git commit -m "ci: fail on dependencies with known advisories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Push and open the PR. Expected: `audit (dependencies)` passes on the branch, with Task 1's pins and Task 2's frontend changes.

If it fails on a **transitive** package, fix it in one of two ways and stop to report which you chose:
- pin the transitive package's fixed version in `requirements.txt`;
- or waive the advisory with `--ignore-vuln <ID>` and a comment, if no fix exists.

## After this plan

- **Click-through on dev after the Angular update:** sign in, import a project and walk every stage, as in the security-headers plan's Task 3 checklist.
- **Branch protection:** to have `main` refuse merges while the audit is red, add `audit (dependencies)` to the branch-protection required checks: `gh api -X PUT repos/AustenLynn/evamed-monorepo/branches/main/protection …`, with the same body as before plus the new check.
