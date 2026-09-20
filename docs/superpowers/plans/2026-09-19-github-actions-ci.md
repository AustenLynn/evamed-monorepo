# GitHub Actions CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run both test suites automatically on every push and pull request, so a commit that breaks the backend or the frontend is caught before anyone deploys it.

**Architecture:** One workflow file, `.github/workflows/tests.yml`, with two independent jobs that run in parallel on GitHub-hosted runners. `backend` installs Python 3.12, runs Django's suite against a PostgreSQL 17 service container, and needs no secrets because the tests fake Firebase. `frontend` installs Node 22, runs the Vitest suite through `ng test`, and then runs the production build — the same build the deploy performs on the Lightsail box, so a build break is caught here instead of there. Nothing in this plan touches the deploy path: `deploy/deploy.sh` stays manual.

**Tech Stack:** GitHub Actions (ubuntu-latest runners), `actions/checkout@v7`, `actions/setup-python@v7`, `actions/setup-node@v7`, the `postgres:17-alpine` service container, Django 5.2's test runner, Vitest via `@angular/build:unit-test`.

**Spec:** None separate. The decisions below are the spec; they come from the 2026-09-19 review of the existing pipeline, which found no CI at all — only the manual `deploy/deploy.sh`.

## Global Constraints

- **Runtime versions must match production**, or CI proves nothing: Python **3.12** (`backend/evamed-api/Dockerfile` is `python:3.12-slim-bookworm`), Node **22** (`frontend/evamed/package.json` `engines.node` is `^22.22.3`), PostgreSQL **17** (`docker-compose.yml` uses `postgres:17-alpine`).
- **Action versions are pinned to these majors**, verified as the latest on 2026-09-19: `actions/checkout@v7`, `actions/setup-python@v7`, `actions/setup-node@v7`. Runner Node 20 was removed on 2026-09-16, so older majors of these actions no longer run.
- **CI must require no secret whatsoever** — no Firebase key, no ecoinvent credentials, no AWS credentials, no SSH key. The backend tests fake Firebase (`projects_api/testing.py`), and the frontend specs fake it too. If any step appears to need a secret, stop and report; do not add one.
- **Baselines** (from `main` at 11ad748): backend `manage.py test` → **115 tests, OK**; frontend `npm test` → **6 passed**; production build Initial total **1.65 MB**.
- **Lint is deliberately NOT in CI.** `ng lint` reports 187 pre-existing findings; a lint gate would be red from the first run. Leave it out.
- **Database settings come from the environment** (`settings.py` reads `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT`); the workflow sets them rather than editing any settings file.
- **Work on branch `feat/ci-tests`.** Never push to `main` from a task, and never force-push anything.
- **Verification uses the public GitHub API**, unauthenticated: the repo `AustenLynn/evamed-monorepo` is public, so run status is readable without `gh` or a token (rate limit 60 requests/hour, so poll every 15 s, not in a tight loop).
- **Local commands still run in containers** as elsewhere in this repo (backend: `docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test`), but this plan's verification happens on GitHub, not locally.

---

## Context: what exists today

There is no CI: no `.github/` directory, no git hooks, no other CI config. Deployment is manual — `deploy/deploy.sh` ships the committed `HEAD` over SSH, rebuilds on the box, and health-checks. This plan adds the missing test gate and changes nothing about deployment.

## Decisions (defaults; override before starting)

| # | Decision | Default | Consequence / alternative |
|---|---|---|---|
| C1 | Triggers | Every `push` (any branch) and every `pull_request` | Actions minutes are free for public repos, so breadth costs nothing. Alternative: restrict pushes to `main` and rely on PRs. |
| C2 | Backend runtime | `actions/setup-python` + a `postgres:17-alpine` service container | Fast (~2 min) and simple. Alternative: `docker compose run api …`, which reuses the local path exactly but fails in CI, because `docker-compose.yml` mounts a Firebase key file that does not exist on a runner. |
| C3 | Frontend job also builds production | Yes | Catches a build break in CI (~2 min) instead of on the 2 GB box mid-deploy. |
| C4 | Lint | Not run | 187 pre-existing findings; see Global Constraints. |
| C5 | Concurrency | Cancel superseded runs for the same ref | Pushing twice quickly leaves only the newer run. |
| C6 | Branch protection | Not configured by this plan | Requires GitHub admin UI; listed under "After this plan". |

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `.github/workflows/tests.yml` | Create | The whole CI definition: `backend` and `frontend` jobs |
| `README.md` | Modify | A short CI section so contributors know what runs and where to look. The file is in Spanish; the new section is written in Spanish to match |

---

### Task 1: The backend job

**Files:**
- Create: `.github/workflows/tests.yml`

**Interfaces:**
- Produces: a workflow named `tests` with a job id `backend`. Task 2 adds a `frontend` job to the same file and relies on the `name:`, `on:`, `permissions:` and `concurrency:` blocks created here.

- [ ] **Step 1: Create the workflow with the backend job**

`.github/workflows/tests.yml`:

```yaml
name: tests

on:
  push:
  pull_request:

permissions:
  contents: read

# A newer push to the same branch makes the older run pointless.
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend:
    name: backend (Django 5.2, PostgreSQL 17)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: backend/evamed-api

    services:
      db:
        image: postgres:17-alpine
        env:
          POSTGRES_DB: evamed_total
          POSTGRES_USER: myprojectuser
          POSTGRES_PASSWORD: password
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U myprojectuser -d evamed_total"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-python@v7
        with:
          python-version: '3.12'
          cache: pip
          cache-dependency-path: backend/evamed-api/requirements.txt

      # psycopg2 is built from source and needs pg_config.
      - name: Install libpq headers
        run: sudo apt-get update && sudo apt-get install -y --no-install-recommends libpq-dev

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run the test suite
        env:
          DB_NAME: evamed_total
          DB_USER: myprojectuser
          DB_PASSWORD: password
          DB_HOST: localhost
          DB_PORT: '5432'
        run: python manage.py test --verbosity 2
```

- [ ] **Step 2: Commit and push the branch**

```bash
cd /home/maikolkali/evamed-monorepo
git switch -c feat/ci-tests
git add .github/workflows/tests.yml
git commit -m "ci: run the Django test suite on every push and pull request"
git push -u origin feat/ci-tests
```

- [ ] **Step 3: Watch the run and confirm it is green**

```bash
poll() {  # $1 = branch
  for _ in $(seq 1 40); do
    out=$(curl -s "https://api.github.com/repos/AustenLynn/evamed-monorepo/actions/runs?branch=$1&per_page=1" \
      | python3 -c "import json,sys; r=json.load(sys.stdin)['workflow_runs']; print('none' if not r else '%s %s %s %s' % (r[0]['head_sha'][:7], r[0]['status'], r[0]['conclusion'], r[0]['html_url']))")
    echo "$out"
    case "$out" in *completed*) return 0;; esac
    sleep 15
  done
}
poll feat/ci-tests
```

Expected: the line ends `completed success https://github.com/...`. Per-step detail, if you need it:

```bash
RUN_ID=$(curl -s "https://api.github.com/repos/AustenLynn/evamed-monorepo/actions/runs?branch=feat/ci-tests&per_page=1" | python3 -c "import json,sys;print(json.load(sys.stdin)['workflow_runs'][0]['id'])")
curl -s "https://api.github.com/repos/AustenLynn/evamed-monorepo/actions/runs/$RUN_ID/jobs" \
  | python3 -c "import json,sys
for j in json.load(sys.stdin)['jobs']:
    print(j['name'], j['status'], j['conclusion'])
    for s in j['steps']: print('   ', s['number'], s['name'], s['conclusion'])"
```

If the run is red, read the failing step's name, fix the workflow, and push again. Do not weaken the tests to make CI pass — the tests pass locally on this commit, so a failure here is a workflow problem (a missing dependency, a wrong env var, a service that never became healthy).

- [ ] **Step 4: Prove the gate actually fails on a broken test**

A green run only proves the suite ran; it does not prove CI would block a bad commit. Do this on a throwaway branch so the feature branch stays clean.

```bash
git switch -c ci-red-check
python3 - <<'PY'
p = 'backend/evamed-api/profiles_api/tests_throttling.py'
s = open(p).read()
a = "self.assertEqual(self.statuses(4), [200, 200, 200, 429])"
b = "self.assertEqual(self.statuses(4), [200, 200, 200, 200])  # deliberately wrong"
# The line appears 3 times (anonymous, proxy-header and per-user tests);
# breaking the first is enough to turn the suite red.
assert s.count(a) == 3, 'expected 3 occurrences, found %d' % s.count(a)
open(p, 'w').write(s.replace(a, b, 1))
PY
git commit -am "test: deliberately break a throttling assertion to prove CI fails"
git push -u origin ci-red-check
poll ci-red-check
```

Expected: `completed failure`. That is the gate working.

- [ ] **Step 5: Delete the throwaway branch, local and remote**

```bash
git switch feat/ci-tests
git push origin --delete ci-red-check
git branch -D ci-red-check
git status --short   # expect empty
```

Expected: `feat/ci-tests` still holds exactly one commit, the workflow file, and the broken assertion exists nowhere.

---

### Task 2: The frontend job, and the README section

**Files:**
- Modify: `.github/workflows/tests.yml` (add a second job)
- Modify: `README.md`

**Interfaces:**
- Consumes: the `name:`, `on:`, `permissions:` and `concurrency:` blocks from Task 1, and its `jobs:` mapping.
- Produces: a job id `frontend` running alongside `backend`.

- [ ] **Step 1: Add the frontend job**

Append to the `jobs:` mapping in `.github/workflows/tests.yml`, at the same indentation as `backend:`:

```yaml
  frontend:
    name: frontend (Angular 22, Vitest)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    defaults:
      run:
        working-directory: frontend/evamed

    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: frontend/evamed/package-lock.json

      # xlsx comes from SheetJS's own CDN, not npm, so this step needs
      # cdn.sheetjs.com to be reachable.
      - name: Install dependencies
        run: npm ci

      - name: Run the unit tests
        run: npm test -- --watch=false

      # The deploy builds this on the 2 GB box; failing here is cheaper.
      - name: Build production
        run: npm run build -- --configuration production
```

- [ ] **Step 2: Commit, push, and confirm both jobs are green**

```bash
cd /home/maikolkali/evamed-monorepo
git add .github/workflows/tests.yml
git commit -m "ci: run the frontend unit tests and production build"
git push
poll feat/ci-tests
```

(`poll` is the shell function from Task 1 Step 3; redefine it if your shell no longer has it.)

Expected: `completed success`, and the jobs listing from Task 1 Step 3 now shows both `backend (Django 5.2, PostgreSQL 17)` and `frontend (Angular 22, Vitest)` with conclusion `success`.

- [ ] **Step 3: Prove the frontend gate fails too**

```bash
git switch -c ci-red-check-fe
python3 - <<'PY'
p = 'frontend/evamed/src/app/to-do-file/xlsx.contract.spec.ts'
s = open(p).read()
a = "expect(wb.SheetNames).toEqual(['Materiales']);"
b = "expect(wb.SheetNames).toEqual(['NotTheSheetName']); // deliberately wrong"
assert a in s, 'anchor not found'
open(p, 'w').write(s.replace(a, b, 1))
PY
git commit -am "test: deliberately break the xlsx contract spec to prove CI fails"
git push -u origin ci-red-check-fe
poll ci-red-check-fe
```

Expected: `completed failure`, with the `frontend` job failing at "Run the unit tests" and `backend` still succeeding — which also proves the two jobs are independent.

- [ ] **Step 4: Delete that throwaway branch**

```bash
git switch feat/ci-tests
git push origin --delete ci-red-check-fe
git branch -D ci-red-check-fe
git status --short   # expect empty
```

- [ ] **Step 5: Document CI in the README**

`README.md` is in Spanish, so this section is too. Add it immediately before the section that begins `## Base de datos`:

````markdown
## Pruebas automáticas (CI)

Cada `push` y cada pull request ejecutan `.github/workflows/tests.yml` en GitHub
Actions, con dos trabajos independientes:

- **backend** — instala Python 3.12, levanta PostgreSQL 17 y corre
  `python manage.py test` (115 pruebas).
- **frontend** — instala Node 22, corre `npm test` (6 pruebas) y compila
  `npm run build -- --configuration production`.

No usan ningún secreto: las pruebas simulan Firebase. El estado de cada
ejecución se ve en la pestaña **Actions** del repositorio.

Para correr lo mismo localmente:

```bash
docker compose run --rm api python manage.py test
docker compose run --rm web npm test -- --watch=false
```

El despliegue **no** es automático: sigue siendo manual con `deploy/deploy.sh`
(ver `deploy/README.md`).
````

- [ ] **Step 6: Commit and confirm the run is still green**

```bash
git add README.md
git commit -m "docs: describe the CI workflow in the README"
git push
poll feat/ci-tests
```

Expected: `completed success`.

---

## After this plan (not tasks here)

1. **Merge `feat/ci-tests` into `main`.** The first run on `main` is also the first proof that CI is green on the default branch.
2. **Require the checks before merging** (GitHub admin UI, your call): Settings → Branches → add a rule for `main` → "Require status checks to pass" → select `backend (Django 5.2, PostgreSQL 17)` and `frontend (Angular 22, Vitest)`. The checks must have run at least once before GitHub offers them by name.
3. **Optional later: deploy on green.** A job that runs `deploy/deploy.sh` when `main` passes needs an SSH deploy key in GitHub secrets and the runner's IP allowed through the Lightsail firewall — GitHub's runner IPs are wide ranges, so this likely means a self-hosted runner or a different access path. Worth its own plan.

## Self-review notes

- **Coverage:** the gap identified on 2026-09-19 was "nothing runs automatically on commit or push" — Task 1 covers the backend suite, Task 2 the frontend suite plus the production build that the deploy would otherwise discover on the box. Lint is excluded by decision C4, deploy automation is deferred above.
- **Both gates are proved red as well as green** (Task 1 Step 4, Task 2 Step 3), on throwaway branches that are deleted, so the feature branch carries only the workflow and the README.
- **Names used across tasks:** workflow `tests`; job ids `backend` and `frontend`; job names `backend (Django 5.2, PostgreSQL 17)` and `frontend (Angular 22, Vitest)`; branch `feat/ci-tests`; throwaway branches `ci-red-check` and `ci-red-check-fe`; the `poll` shell function.
- **Expected counts** match the current baselines: 115 backend tests, 6 frontend tests, build Initial total 1.65 MB.
- **Unverified when written:** the workflow has never run — this repo has zero Actions runs. The known risks are psycopg2 needing `libpq-dev` (handled by its own step), `npm ci` needing `cdn.sheetjs.com` for xlsx (called out in a comment), and the service container's health check gating the test step. Each one fails loudly at a named step rather than silently.
