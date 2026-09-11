# Runtime Upgrade (Python, Django, PostgreSQL, Node) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move EVAmed off end-of-life runtimes: Python 3.8 → 3.12, Django 2.2 → 5.2 LTS, DRF 3.9 → 3.16, PostgreSQL 12 → 17, and Node 18 → 22 LTS for the frontend image. API behaviour and data stay unchanged.

**Architecture:** Characterisation tests pin today's API behaviour first. Then the upgrade goes in hops, each leaving the suite green and deployable on its own:
1. Forward-compatible cleanups on Django 2.2.
2. Python 3.12 + Django 4.2 (still runs on PostgreSQL 12).
3. PostgreSQL 17 (dump/restore of each environment's database).
4. Django 5.2, which requires PostgreSQL ≥ 14 and therefore must ship only after hop 3 has reached every environment.

Node is independent.

**Tech Stack:** Docker Compose, `python:3.12-slim-bookworm`, Django 4.2 → 5.2, DRF 3.16, django-cors-headers 4.x, whitenoise 6.x, gunicorn 23, psycopg2 2.9, `postgres:17-alpine`, `node:22-alpine`.

**Spec:** None separate. Decisions below. Background: gap 2 in `docs/superpowers/plans/2026-09-11-aws-lightsail-dev-deploy.md`.

## Global Constraints

- Backend commands, from the repo root, always use this prefix:
  `docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python <args>`
  The bind mount picks up code edits without a rebuild. **After changing `requirements.txt` or the `Dockerfile`, run `docker compose build api` first.**
- `requirements.txt` keeps exact `==` pins (repo convention). Each hop resolves ranges once, then pins what was installed.
- The whole backend suite must pass after every task. Characterisation tests (Task 1) must pass **unchanged** from Task 2 onward. If one fails, the upgrade changed API behaviour: stop and decide deliberately.
- **Django 5.2 must not reach an environment whose database is older than PostgreSQL 14**; it refuses to connect. Task 5 lives on a branch until Task 7 Stage B is done.
- Do not bump anything not listed here (no Angular upgrade, no psycopg 3 switch).

---

## Decisions

| # | Decision | Choice | Why / alternative |
|---|---|---|---|
| U1 | Django target | **5.2 LTS** (security fixes until April 2028) | 4.2 LTS reached end of life in April 2026, so it is only a stepping stone here. 6.0 is not LTS. |
| U2 | Upgrade path | 2.2 → **4.2** → **5.2**, two hops | The code has almost no deprecated API use (scan found only `base_name=`, `USE_L10N`, `STATICFILES_STORAGE`), so the 3.x hop adds little. Two hops still let PostgreSQL move in between, because 4.2 runs on PG 12 and 17 alike. |
| U3 | Python target | **3.12** (supported until Oct 2028) | Django 4.2.8+ and 5.2 support it, and it has mature wheels for everything we use. 3.13 would also work; there's no need yet. |
| U4 | PostgreSQL target | **17** (supported until Nov 2029) | Django 5.2 needs ≥ 14. The seed `backup` is a custom-format dump (`PGDMP`), which `pg_restore` 17 reads fine. |
| U5 | DB driver | Stay on `psycopg2` 2.9 | Zero code change. psycopg 3 is a later, separate improvement. |
| U6 | Unused deps | Remove `python-decouple`, `dj-database-url`, `pytz`; delete `settings_local.py`, `runtime.txt` | All are imported nowhere or unused. `settings_local.py` is an old SQLite/Heroku settings file that nothing loads. `runtime.txt` is a Heroku relic; Render and Docker read the `Dockerfile`. |
| U7 | Node for the frontend image | **22 LTS** (maintenance until Apr 2027) | Node 18 reached end of life in April 2025. Angular 19 supports `^22.0.0`. Your WSL already has Node v22.22.0. |
| U8 | Order vs. the authorization plan | Do `2026-09-11-api-authorization.md` **first** if you can | Its ~35 permission tests become part of this upgrade's safety net. Nothing here depends on it; Task 1 works either way. |

**Out of scope, but also end-of-life:** **Angular 19** left long-term support around May 2026. Upgrading Angular (19 → 20 → 21, one major at a time with `ng update`) touches every module and deserves its own plan.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `backend/evamed-api/projects_api/tests_api_contract.py` | Create | Characterisation tests |
| `backend/evamed-api/profiles_project/settings.py` | Modify | Remove dead imports/settings; `DEFAULT_AUTO_FIELD`; `STORAGES` |
| `backend/evamed-api/profiles_project/settings_local.py` | Delete | Unused |
| `backend/evamed-api/profiles_api/urls.py` | Modify (only if it still exists) | `base_name=` → `basename=` |
| `backend/evamed-api/requirements.txt` | Modify | Versions |
| `backend/evamed-api/runtime.txt` | Delete | Heroku relic |
| `backend/evamed-api/Dockerfile` | Modify | Python 3.12 base |
| `docker-compose.yml` | Modify | `postgres:17-alpine` |
| `deploy/compose.aws.yml` | Modify (only if it exists) | `postgres:17-alpine` |
| `frontend/evamed/Dockerfile`, `frontend/evamed/package.json` | Modify | Node 22 |

---

### Task 1: Characterisation tests (safety net)

**Files:**
- Create: `backend/evamed-api/projects_api/tests_api_contract.py`

**Interfaces:**
- Produces: `ApiContractTests`, which must pass unchanged through every later task.

- [ ] **Step 1: Write the tests**

`backend/evamed-api/projects_api/tests_api_contract.py`:

```python
"""Characterisation tests: pin API behaviour that framework upgrades could change.

They describe what the API does today, not what it ideally should do. If one
fails after an upgrade, the upgrade changed observable behaviour, so decide
deliberately whether to accept it.
"""
from decimal import Decimal

from rest_framework.test import APITestCase

from profiles_api.models import UserProfile
from projects_api import models
from projects_api.urls import router

EMAIL = 'contract@example.com'


class ApiContractTests(APITestCase):

    def setUp(self):
        # An admin who also owns the test data, so these pass with or without
        # the authorization plan applied.
        admin = UserProfile.objects.create_user(email=EMAIL, name='Contract')
        admin.is_staff = True
        admin.save()
        self.client.force_authenticate(user=admin)
        self.owner = models.UserPlatform.objects.create(name='Contract', email=EMAIL)

    def test_every_router_route_lists(self):
        for prefix, _, _ in router.registry:
            with self.subTest(prefix=prefix):
                response = self.client.get('/api-projects/%s/' % prefix)
                self.assertEqual(response.status_code, 200)
                self.assertIsInstance(response.json(), list)

    def test_decimal_fields_render_as_fixed_point_strings(self):
        project = models.Project.objects.create(
            name_project='P', user_platform_id=self.owner, distance=Decimal('1.5'))
        body = self.client.get('/api-projects/projects/%s/' % project.id).json()
        self.assertEqual(body['distance'], '1.' + '5'.ljust(35, '0'))  # decimal_places=35

    def test_foreign_keys_render_as_ids(self):
        project = models.Project.objects.create(name_project='P', user_platform_id=self.owner)
        body = self.client.get('/api-projects/projects/%s/' % project.id).json()
        self.assertEqual(body['user_platform_id'], self.owner.id)
        self.assertIsNone(body['use_id'])

    def test_exact_search_by_email_and_by_id(self):
        project = models.Project.objects.create(name_project='P', user_platform_id=self.owner)
        users = self.client.get('/api-projects/users-platform/', {'search': EMAIL}).json()
        projects = self.client.get('/api-projects/projects/', {'search': str(project.id)}).json()
        self.assertEqual([u['id'] for u in users], [self.owner.id])
        self.assertEqual([p['id'] for p in projects], [project.id])

    def test_validation_errors_are_keyed_by_field(self):
        body = self.client.post('/api-projects/units/', {}, format='json').json()
        self.assertEqual(list(body), ['name_unit'])

    def test_health(self):
        self.assertEqual(self.client.get('/api/health/').json(), {'status': 'ok'})
```

- [ ] **Step 2: Run on today's stack; all must pass**

```bash
docker compose build api
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test projects_api.tests_api_contract -v 2
```

Expected: `Ran 6 tests ... OK`. These tests describe the current behaviour. If one fails **here**, the literal in the test is wrong, not the app: change the expected value to what today's stack returns, and note it in the commit message.

- [ ] **Step 3: Record the baseline**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test 2>&1 | tail -3
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py makemigrations --check --dry-run
docker compose run --rm api pip freeze > ~/evamed-pip-freeze-before-upgrade.txt   # rollback reference
```

Expected: `OK` with the test count (note it), then `No changes detected`.

- [ ] **Step 4: Commit**

```bash
git add backend/evamed-api/projects_api/tests_api_contract.py
git commit -m "test(api): characterisation tests ahead of runtime upgrade"
```

---

### Task 2: Forward-compatible cleanups (still Django 2.2)

**Files:**
- Modify: `backend/evamed-api/profiles_project/settings.py`
- Modify: `backend/evamed-api/requirements.txt`
- Modify: `backend/evamed-api/profiles_api/urls.py` (only if it exists)
- Delete: `backend/evamed-api/profiles_project/settings_local.py`

**Interfaces:**
- Produces: `settings.DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'`. Django 2.2 ignores it; from 3.2 on, it prevents `models.W042` warnings and any migration that would turn every `id` into a `BigAutoField`.

- [ ] **Step 1: Settings**

In `backend/evamed-api/profiles_project/settings.py`, delete these two lines (both imports are unused):

```python
from decouple import config
import dj_database_url
```

Directly above `AUTH_USER_MODEL = 'profiles_api.UserProfile'` add:

```python
# Keep 32-bit integer ids; switching to BigAutoField would rewrite every table.
DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'
```

- [ ] **Step 2: Requirements**

In `backend/evamed-api/requirements.txt`, delete the lines `dj-database-url==0.5.0`, `python-decouple==3.4` and `pytz==2020.1`.

- [ ] **Step 3: DRF router keyword**

```bash
test -f backend/evamed-api/profiles_api/urls.py && sed -i "s/base_name='hello-viewset'/basename='hello-viewset'/" backend/evamed-api/profiles_api/urls.py
grep -rn "base_name" backend/evamed-api --include=*.py
```

Expected: no output. (DRF 3.9 already accepts `basename`; 3.11+ rejects `base_name`. If the authorization plan ran, this file is gone and the `test -f` skips.)

- [ ] **Step 4: Delete the unused settings file**

```bash
git rm backend/evamed-api/profiles_project/settings_local.py
grep -rn "settings_local" backend/ docker-compose.yml render.yml
```

Expected: no output.

- [ ] **Step 5: Rebuild and run everything**

```bash
docker compose build api
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py makemigrations --check --dry-run
```

Expected: `OK` (same count as Task 1 Step 3); `No changes detected`.

- [ ] **Step 6: Commit**

```bash
git add -A backend/evamed-api/profiles_project backend/evamed-api/requirements.txt backend/evamed-api/profiles_api
git commit -m "chore(api): drop unused deps and settings ahead of Django upgrade"
```

---

### Task 3: Python 3.12 + Django 4.2 + DRF 3.16

**Files:**
- Modify: `backend/evamed-api/Dockerfile:1`
- Modify: `backend/evamed-api/requirements.txt`
- Modify: `backend/evamed-api/profiles_project/settings.py` (`USE_L10N`, `STATICFILES_STORAGE`)
- Delete: `backend/evamed-api/runtime.txt`

**Interfaces:**
- Produces: an image on Python 3.12 running Django 4.2.x. It works against PostgreSQL 12 **and** 17, so it is safe to deploy before any DB upgrade.

- [ ] **Step 1: Base image**

In `backend/evamed-api/Dockerfile`, replace line 1 `FROM python:3.8-slim-bullseye` with:

```dockerfile
FROM python:3.12-slim-bookworm
```

```bash
git rm backend/evamed-api/runtime.txt
```

- [ ] **Step 2: Requirements (ranges; pinned in Step 6)**

Replace the whole of `backend/evamed-api/requirements.txt` with:

```text
Django>=4.2,<5.0
django-cors-headers>=4.7,<5
djangorestframework>=3.16,<3.17
firebase-admin>=6.5,<8
gunicorn>=23,<24
psycopg2>=2.9.10,<2.10
requests==2.32.4
sqlparse>=0.5,<0.6
whitenoise>=6.9,<7
```

- [ ] **Step 3: Settings for Django 4.2**

In `backend/evamed-api/profiles_project/settings.py`, delete the line `USE_L10N = True` (always on since Django 4.0; the setting is deprecated and removed in 5.0). Replace

```python
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

with

```python
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
```

- [ ] **Step 4: Build and run the suite**

```bash
docker compose build api
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python --version
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py makemigrations --check --dry-run
```

Expected: `Python 3.12.x`; `OK` with the same count; `No changes detected`. The characterisation tests pass unchanged. If `makemigrations --check` reports changes, run it without `--check` to see them. Changes that only touch `help_text`/`verbose_name`/choices can be generated and committed, anything else needs a look: stop and investigate.

- [ ] **Step 5: No pending Django deprecations**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python -Wa manage.py test 2>&1 \
  | grep -E "RemovedInDjango5[0-9]Warning" || echo "NO DJANGO DEPRECATIONS"
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py check
```

Expected: `NO DJANGO DEPRECATIONS`; `System check identified no issues (0 silenced).` Fix anything reported in project code; warnings raised from inside third-party packages can be ignored.

- [ ] **Step 6: Pin exact versions**

```bash
docker compose run --rm api pip freeze | grep -iE '^(django|django-cors-headers|djangorestframework|firebase-admin|gunicorn|psycopg2|requests|sqlparse|whitenoise)=='
```

Replace each range in `requirements.txt` with the `==` line printed for it (keep the file sorted as above). Then `docker compose build api` and re-run the full suite from Step 4 → `OK`.

- [ ] **Step 7: Boot the real stack on the existing PG12 volume**

```bash
docker compose up -d --build api
docker compose logs api | grep -E "Applying|Booting worker|Error" | head -20
curl -s http://localhost:8000/api/health/
```

Expected: a few `Applying admin.000x…`/`auth.00xx…`/`authtoken.0003…` lines (Django's own migrations), `Booting worker`, then `{"status": "ok"}`. Then run `docker compose up -d` and do a browser smoke test at `http://localhost:8080`: log in, open a project, open its results page, and open one admin page.

- [ ] **Step 8: Commit**

```bash
git add -A backend/evamed-api/Dockerfile backend/evamed-api/requirements.txt backend/evamed-api/profiles_project/settings.py backend/evamed-api/runtime.txt
git commit -m "chore(api): Python 3.12, Django 4.2 LTS, DRF 3.16"
```

---

### Task 4: PostgreSQL 17 (local compose, and AWS dev compose if present)

**Files:**
- Modify: `docker-compose.yml` (`db.image`)
- Modify: `deploy/compose.aws.yml` (`db.image`), only if the file exists

**Interfaces:**
- Produces: local stack on PostgreSQL 17 with the seed restored and migrations applied. Task 5 relies on it for its test DB.

A PostgreSQL data directory can't be opened by a newer major version. Changing the image on an existing volume makes the `db` container crash-loop, so every environment's data goes through dump → new volume → restore.

- [ ] **Step 1: Snapshot the current local database**

```bash
cd /home/maikolkali/evamed-monorepo
docker compose up -d db
BACKUP=~/evamed-local-pre-pg17-$(date +%F).dump
docker compose exec -T db pg_dump -U myprojectuser -Fc evamed_total > "$BACKUP"
docker compose exec -T db psql -U myprojectuser -d evamed_total -tAc "select count(*) from projects_api_material" 
ls -l "$BACKUP"
```

Expected: a non-empty dump file and the material count (note it, e.g. `406`).

- [ ] **Step 2: Switch the image**

In `docker-compose.yml`, change `image: postgres:12-alpine` to `image: postgres:17-alpine`. If `deploy/compose.aws.yml` exists, make the same change there. **Deploying that file to the AWS box requires Task 7's AWS-dev procedure in the same sitting.**

- [ ] **Step 3: Recreate the volume (seed restores automatically)**

```bash
docker compose down -v          # deletes the PG12 volume; the dump from Step 1 is your copy
docker compose up -d db
docker compose logs db | grep -E "Restoring database|ready to accept connections" | tail -3
docker compose up -d --build
```

Expected: `Restoring database from /docker-entrypoint-initdb.d/backup`, then `ready to accept connections`; the API applies migrations and starts.

- [ ] **Step 4: Put your local data back (skip if it was only the seed)**

```bash
docker compose exec -T db pg_restore -U myprojectuser -d evamed_total --clean --if-exists --no-owner < "$BACKUP"
docker compose restart api
```

- [ ] **Step 5: Verify**

```bash
docker compose exec -T db psql -U myprojectuser -d evamed_total -tAc "show server_version"
docker compose exec -T db psql -U myprojectuser -d evamed_total -tAc "select count(*) from projects_api_material"
curl -s http://localhost:8000/api/health/
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test
```

Expected: `17.x`; the same material count as Step 1; `{"status": "ok"}`; suite `OK`.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml $(test -f deploy/compose.aws.yml && echo deploy/compose.aws.yml)
git commit -m "chore(db): PostgreSQL 17 for local (and AWS dev) compose"
```

---

### Task 5: Django 5.2 LTS (on branch `upgrade/django-5.2`)

**Files:**
- Modify: `backend/evamed-api/requirements.txt`

**Interfaces:**
- Consumes: PostgreSQL ≥ 14 in every environment it's deployed to (Task 4 locally; Task 7 elsewhere).

- [ ] **Step 1: Branch**

```bash
git switch -c upgrade/django-5.2
```

- [ ] **Step 2: Bump Django**

In `backend/evamed-api/requirements.txt`, replace the `Django==4.2.x` line with `Django>=5.2,<5.3`. Leave the other pins, which already support 5.2.

- [ ] **Step 3: Build, test, check migrations**

```bash
docker compose build api
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py makemigrations --check --dry-run
```

Expected: `OK` with the same count; the characterisation tests pass unchanged; `No changes detected`. If `pip` reports a resolver conflict, bump the conflicting package to its newest release inside its current major and retry.

- [ ] **Step 4: No pending Django deprecations**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python -Wa manage.py test 2>&1 \
  | grep -E "RemovedInDjango6[0-9]Warning" || echo "NO DJANGO DEPRECATIONS"
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py check
```

Expected: `NO DJANGO DEPRECATIONS`; no system-check issues.

- [ ] **Step 5: Pin, then boot and smoke-test**

```bash
docker compose run --rm api pip freeze | grep -iE '^django=='
```

Replace the range with the printed `Django==5.2.x`. Then:

```bash
docker compose build api && docker compose up -d
curl -s http://localhost:8000/api/health/
```

Expected: `{"status": "ok"}`. Browser smoke test at `http://localhost:8080`: log in, create a project, add a material in materials-stage, and open results. On the Django side, log into `http://localhost:8000/admin/` (create a superuser if needed: `docker compose exec api python manage.py createsuperuser`).

- [ ] **Step 6: Commit (stays on the branch)**

```bash
git add backend/evamed-api/requirements.txt
git commit -m "chore(api): Django 5.2 LTS"
```

Do **not** merge until Task 7 Stage B is complete.

---

### Task 6: Node 22 LTS for the frontend image

**Files:**
- Modify: `frontend/evamed/Dockerfile:1`
- Modify: `frontend/evamed/package.json` (`engines`)

- [ ] **Step 1: Switch the image and engines**

In `frontend/evamed/Dockerfile`, replace `FROM node:18.19.1-alpine` with:

```dockerfile
FROM node:22-alpine
```

In `frontend/evamed/package.json`, replace the `engines` block with:

```json
  "engines": {
    "node": ">=22 <23",
    "npm": ">=10"
  },
```

- [ ] **Step 2: Build and verify**

```bash
docker compose build web
docker compose run --rm --no-deps web node -v
docker compose up -d web
curl -s http://localhost:8080/ | grep -c '<app-root'
```

Expected: build succeeds; `v22.x`; `1`. Browser smoke test at `http://localhost:8080`: log in, and the home page loads projects.

- [ ] **Step 3: Commit**

```bash
git add frontend/evamed/Dockerfile frontend/evamed/package.json
git commit -m "chore(frontend): Node 22 LTS image"
```

---

### Task 7: Rollout, in three stages

**Files:** none

**Stage A: everything except Django 5.2** (Tasks 1–4 and 6 on `main`)

- [ ] **Step 1:** Back up production (Render dashboard → database → Backups, or `pg_dump -Fc` with the external URL).
- [ ] **Step 2:** Push `main`. Render rebuilds `evamed-api` (Python 3.12 / Django 4.2, which works on the current DB) and `evamed-frontend` (Node 22). `docker-compose.yml` doesn't affect Render.
- [ ] **Step 3:** Smoke-test production: `curl -s https://<render-api-host>/api/health/`, then log in, open a project and its results.
- [ ] **Step 4 (AWS dev, if built):** the new `postgres:17-alpine` image can't open the PG12 volume, so on the box:

```bash
ssh ubuntu@$EVAMED_DEV_HOST 'bash /opt/evamed/src/deploy/dc.sh exec -T db pg_dump -U myprojectuser -Fc evamed_total > /opt/evamed/pre-pg17.dump && ls -l /opt/evamed/pre-pg17.dump'
ssh ubuntu@$EVAMED_DEV_HOST 'bash /opt/evamed/src/deploy/dc.sh down && docker volume rm evamed_db_data'
deploy/deploy.sh                                          # starts PG17; seed restores
ssh ubuntu@$EVAMED_DEV_HOST 'bash /opt/evamed/src/deploy/dc.sh exec -T db pg_restore -U myprojectuser -d evamed_total --clean --if-exists --no-owner < /opt/evamed/pre-pg17.dump; bash /opt/evamed/src/deploy/dc.sh restart api'
```

(Dev data is disposable; skip the restore if the seed is enough.)

**Stage B: production database to PostgreSQL ≥ 14 (ideally 17)**

- [ ] **Step 5: Find the version**

In the Render shell for `evamed-api`:

```bash
python manage.py shell -c "from django.db import connection; connection.ensure_connection(); print(connection.pg_version)"
```

`140000` or higher means Django 5.2 will run; skip to Stage C (you can still plan a move to 17). Anything lower must be upgraded first.

- [ ] **Step 6: Upgrade.** Take a fresh backup. If Render offers an in-place major-version upgrade for your database plan, use it. Otherwise:
  1. Create a new PostgreSQL 17 database in Render.
  2. Copy the data: `pg_dump -Fc "<old external URL>" > prod.dump`, then `pg_restore --no-owner --no-privileges -d "<new external URL>" prod.dump`.
  3. Point `evamed-api` at the new database: change `fromDatabase.name` in `render.yml`, or the `DB_*` env vars in the dashboard.
  4. Redeploy and re-run Step 5 until it prints ≥ `140000`.

  Schedule a short maintenance window: writes made between the dump and the switch are lost.

**Stage C: Django 5.2**

- [ ] **Step 7:** Only after Step 5 shows ≥ 14 on **every** deployed environment (Render, and AWS dev from Step 4): merge `upgrade/django-5.2` into `main`, push, and repeat the Step 3 smoke test.

**Rollback**

- App: redeploy the previous commit. The upgrade adds no migrations to our own apps. Any new migrations Django applies to its built-in apps are additive, and the older version ignores them.
- Database: restore the backup taken before the stage into a database of the old version, and point the API back at it.
