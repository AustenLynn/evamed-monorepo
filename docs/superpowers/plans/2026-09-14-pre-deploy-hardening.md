# Pre-Deploy Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the hardening gaps that stand between `main` and the AWS Lightsail dev deploy, so that `docs/superpowers/plans/2026-09-11-aws-lightsail-dev-deploy.md` can run next.

**Architecture:** Four small, independent changes: per-address/per-user API throttling that understands Firebase callers, a CORS list without retired hosts, zero runtime `npm audit` findings, and an AWS plan brought up to date and gated on this one plus the manual click-through.

**Tech Stack:** Django 5.2 + DRF 3.16 (API), Angular 22 + Vitest (frontend), Docker Compose. Everything runs in containers, as in the earlier plans.

**Spec:** None separate. The findings and decisions below are the spec. Findings come from the 2026-09-14 gap audit.

## Global Constraints

- **Docker must be running.** Docker Desktop must be running with WSL integration enabled for this distro (`docker version` works). Every build/test command below runs in a container.
- **Baselines** (from `387cfab`): backend `manage.py test` → 97 tests OK; frontend `npm test` → 5 passed; `ng lint` → 187 problems; production build Initial total 1.65 MB.
- **Test commands** (from the repo root):
  - Backend: `docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test`
  - Frontend: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine sh -lc '<cmd>'`

---

## What was found

| # | Finding | Evidence | Addressed in |
|---|---|---|---|
| F1 | No API throttling. DRF's stock `UserRateThrottle` would also put every non-admin caller into one bucket, because `FirebaseUser.pk` is `None` | `profiles_api/authentication.py` | Task 1 |
| F2 | `CORS_ALLOWED_ORIGINS` lists a retired EC2 IP, private LAN IPs and `0.0.0.0` | `profiles_project/settings.py` | Task 2 |
| F3 | Runtime `npm audit`: `swiper` critical (only its CSS is referenced), `xlsx` high (live: `to-do-file` parses user uploads; no fix on npm), `express`/`qs` moderate | `npm audit --omit=dev` | Task 3 |
| F4 | The AWS plan still says Django 2.2/Angular 19, lists fixed gaps as open, and routes the removed `/api-profiles/*` | the plan file | Task 4 |
| F5 | The committed Django `SECRET_KEY` is public | `settings.py` | Already covered by AWS plan Task 1 (env-supplied key; its compose requires `DJANGO_SECRET_KEY`). Not repeated here |

**Not issues** (confirmed with the user on 2026-09-15): the seed dump's `projects_api_userplatform` rows and projects, including the blanked plaintext passwords in the first commit's revision, are test accounts, not real people. No notification, account locking, seed scrub or history rewrite is needed.

Out of scope (recorded, not fixed here): `.dockerignore` files, running containers as non-root, the web image carrying build tooling.

## Decisions (defaults; override before starting)

| # | Decision | Default | Consequence / alternative |
|---|---|---|---|
| H1 | Throttle rates | anonymous **120/minute per client address**; signed-in **600/minute per Firebase uid** | `NUM_PROXIES = 1` (Caddy on AWS). A second proxy in front later means raising it. |
| H2 | CORS | Keep only `http://localhost`, `:4200`, `:8080`, `:8000` | If the 172.16.3.x LAN box is still in use, add it back deliberately. |
| H3 | xlsx source | SheetJS's own CDN tarball `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` | Official channel (SheetJS stopped publishing to npm). `npm ci` then needs `cdn.sheetjs.com` reachable. Alternative: replace the library. |

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `backend/evamed-api/profiles_api/throttling.py` | Create | `FirebaseUserRateThrottle` keyed by Firebase uid |
| `backend/evamed-api/profiles_project/test_runner.py` | Create | Test runner that switches throttling off for the suite |
| `backend/evamed-api/profiles_api/tests_throttling.py` | Create | Throttling tests with a real cache |
| `backend/evamed-api/profiles_project/tests_cors.py` | Create | Preflight tests for allowed/retired origins |
| `backend/evamed-api/profiles_project/settings.py` | Modify | Throttle config, `NUM_PROXIES`, `TEST_RUNNER`, CORS list |
| `frontend/evamed/src/app/to-do-file/xlsx.contract.spec.ts` | Create | Pins the SheetJS call shape the upload screen uses |
| `frontend/evamed/package.json`, `package-lock.json`, `angular.json` | Modify | Drop swiper, xlsx from SheetJS CDN, qs fix |
| `docs/superpowers/plans/2026-09-11-aws-lightsail-dev-deploy.md` | Modify | Stale facts, routes, gate on this plan |

---

### Task 1: API throttling

**Files:**
- Create: `backend/evamed-api/profiles_api/throttling.py`
- Create: `backend/evamed-api/profiles_project/test_runner.py`
- Test: `backend/evamed-api/profiles_api/tests_throttling.py`
- Modify: `backend/evamed-api/profiles_project/settings.py` (`REST_FRAMEWORK`; new `TEST_RUNNER`)

**Interfaces:**
- Consumes: `projects_api.testing.firebase_user(email)` and `admin_user()`; `FirebaseUser.uid`.
- Produces: `profiles_api.throttling.FirebaseUserRateThrottle` (scope `user`); `profiles_project.test_runner.NoThrottleTestRunner`; settings `DEFAULT_THROTTLE_RATES = {'anon': '120/minute', 'user': '600/minute'}` and `NUM_PROXIES = 1`. Task 4 references `NUM_PROXIES` in the AWS plan.

Why a test runner: the suite makes hundreds of requests from one address in about 3 seconds. Throttling is switched off for it by giving DRF a cache that never remembers anything, and `tests_throttling.py` puts a real cache back for its own tests. `/api/health/` is a plain Django view, so it's never throttled (the deploy health check depends on that).

- [ ] **Step 1: Write the failing tests**

`backend/evamed-api/profiles_api/tests_throttling.py`:

```python
from unittest import mock

from django.core.cache.backends.locmem import LocMemCache
from rest_framework.test import APITestCase
from rest_framework.throttling import SimpleRateThrottle

from projects_api.testing import admin_user, firebase_user

URL = '/api-projects/units/'   # public catalogue read: 200 for anyone


class ThrottleTests(APITestCase):

    def setUp(self):
        # The suite's runner switches throttling off; give each test a real,
        # private cache and tiny rates.
        for patcher in (
            mock.patch.object(SimpleRateThrottle, 'cache', LocMemCache(self.id(), {})),
            mock.patch.object(SimpleRateThrottle, 'THROTTLE_RATES', {'anon': '3/minute', 'user': '3/minute'}),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def statuses(self, n, **extra):
        return [self.client.get(URL, **extra).status_code for _ in range(n)]

    def test_anonymous_callers_are_throttled(self):
        self.assertEqual(self.statuses(4), [200, 200, 200, 429])

    def test_anonymous_address_comes_from_the_proxy_header(self):
        self.assertEqual(self.statuses(4, HTTP_X_FORWARDED_FOR='203.0.113.1'), [200, 200, 200, 429])
        self.assertEqual(self.statuses(1, HTTP_X_FORWARDED_FOR='203.0.113.2'), [200])

    def test_each_signed_in_user_has_their_own_allowance(self):
        self.client.force_authenticate(firebase_user('alice@example.com'))
        self.assertEqual(self.statuses(4), [200, 200, 200, 429])
        self.client.force_authenticate(firebase_user('bob@example.com'))
        self.assertEqual(self.statuses(1), [200])

    def test_admins_are_throttled_by_profile(self):
        self.client.force_authenticate(admin_user())
        self.assertEqual(self.statuses(4), [200, 200, 200, 429])

    def test_health_check_is_never_throttled(self):
        for _ in range(5):
            self.assertEqual(self.client.get('/api/health/').status_code, 200)
```

- [ ] **Step 2: Run them and confirm they fail**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" \
  api python manage.py test profiles_api.tests_throttling 2>&1 | tail -8
```

Expected: 4 failures, lists like `[200, 200, 200, 200] != [200, 200, 200, 429]` (nothing is throttled yet). The health-check test passes.

- [ ] **Step 3: Write the throttle and the runner**

`backend/evamed-api/profiles_api/throttling.py`:

```python
"""Per-user API throttling that understands Firebase callers.

DRF's UserRateThrottle keys a signed-in user by `user.pk`. A FirebaseUser (any
caller without an admin UserProfile) has pk None, so all of them would share
one bucket. Key them by their Firebase uid instead; admins keep their pk.
Anonymous callers are left to AnonRateThrottle.
"""
from rest_framework.throttling import UserRateThrottle


class FirebaseUserRateThrottle(UserRateThrottle):

    def get_cache_key(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return None
        ident = getattr(user, 'uid', None) or user.pk
        return self.cache_format % {'scope': self.scope, 'ident': ident}
```

`backend/evamed-api/profiles_project/test_runner.py`:

```python
"""Test runner that switches API throttling off for the suite.

The API tests make hundreds of requests a second from one address, far past
the real rates. profiles_api/tests_throttling.py tests throttling itself with
a real cache.
"""
from django.core.cache.backends.dummy import DummyCache
from django.test.runner import DiscoverRunner
from rest_framework.throttling import SimpleRateThrottle


class NoThrottleTestRunner(DiscoverRunner):

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        # A DummyCache never stores a request history, so nothing is throttled.
        SimpleRateThrottle.cache = DummyCache('throttle-off', {})
```

- [ ] **Step 4: Configure settings.** In `backend/evamed-api/profiles_project/settings.py`, replace the `REST_FRAMEWORK` block with:

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'profiles_api.authentication.FirebaseAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'profiles_api.throttling.FirebaseUserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '120/minute',
        'user': '600/minute',
    },
    # One proxy (Caddy on AWS) sits in front of gunicorn: the client address
    # is the last entry it appends to X-Forwarded-For. With no proxy (local
    # compose) there is no such header and REMOTE_ADDR is used. Raise this if
    # another proxy or load balancer is ever put in front of Caddy.
    'NUM_PROXIES': 1,
}

# The API suite would trip the throttles above; see test_runner.py.
TEST_RUNNER = 'profiles_project.test_runner.NoThrottleTestRunner'
```

- [ ] **Step 5: Run the throttling tests, then the full suite**

Run the Step 2 command. Expected: `Ran 5 tests` … `OK`. Then the backend test command. Expected: `Ran 102 tests` … `OK` (97 + 5). A `429` anywhere in the full suite means the runner isn't in effect: check `TEST_RUNNER`.

- [ ] **Step 6: Commit**

```bash
git add backend/evamed-api/profiles_api/throttling.py backend/evamed-api/profiles_project/test_runner.py \
        backend/evamed-api/profiles_api/tests_throttling.py backend/evamed-api/profiles_project/settings.py
git commit -m "feat(api): throttle anonymous callers per address and users per Firebase uid"
```

---

### Task 2: CORS without retired hosts

**Files:**
- Test: `backend/evamed-api/profiles_project/tests_cors.py`
- Modify: `backend/evamed-api/profiles_project/settings.py` (`CORS_ALLOWED_ORIGINS`)

**Interfaces:**
- Produces: `CORS_ALLOWED_ORIGINS` = the four localhost origins in R9. The AWS deploy is single-origin and needs none.

- [ ] **Step 1: Write the failing tests**

`backend/evamed-api/profiles_project/tests_cors.py`:

```python
from django.test import SimpleTestCase

LOCAL = ('http://localhost', 'http://localhost:4200', 'http://localhost:8080', 'http://localhost:8000')
RETIRED = ('http://54.224.175.163', 'http://172.16.3.134:8080', 'http://172.16.3.136', 'http://0.0.0.0:8080')


class CorsTests(SimpleTestCase):

    def preflight(self, origin):
        return self.client.options(
            '/api-projects/units/', HTTP_ORIGIN=origin, HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET')

    def test_local_frontends_are_allowed(self):
        for origin in LOCAL:
            with self.subTest(origin=origin):
                self.assertEqual(self.preflight(origin)['Access-Control-Allow-Origin'], origin)

    def test_retired_hosts_are_not(self):
        for origin in RETIRED:
            with self.subTest(origin=origin):
                self.assertFalse(self.preflight(origin).has_header('Access-Control-Allow-Origin'))
```

- [ ] **Step 2: Run them and confirm they fail**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" \
  api python manage.py test profiles_project.tests_cors 2>&1 | tail -6
```

Expected: `test_retired_hosts_are_not` fails for all four subtests; `test_local_frontends_are_allowed` passes.

- [ ] **Step 3: Trim the list.** In `settings.py`, replace the whole `CORS_ALLOWED_ORIGINS = [ … ]` block with:

```python
# Local development only (ng serve on 4200, the compose frontend on 8080).
# The AWS dev deploy serves the SPA and the API from one origin, so it needs
# no CORS at all.
CORS_ALLOWED_ORIGINS = [
    "http://localhost",
    "http://localhost:4200",
    "http://localhost:8080",
    "http://localhost:8000",
]
```

- [ ] **Step 4: Run the CORS tests, then the full suite.** Expected: `Ran 2 tests … OK`, then `Ran 104 tests … OK`.

- [ ] **Step 5: Commit**

```bash
git add backend/evamed-api/profiles_project/tests_cors.py backend/evamed-api/profiles_project/settings.py
git commit -m "fix(api): drop retired EC2/LAN hosts from CORS"
```

---

### Task 3: Zero runtime npm audit findings

**Files:**
- Create: `frontend/evamed/src/app/to-do-file/xlsx.contract.spec.ts`
- Modify: `frontend/evamed/package.json`, `frontend/evamed/package-lock.json`, `frontend/evamed/angular.json` (drop `./node_modules/swiper/swiper.css` from `build.options.styles`)

**Interfaces:**
- Consumes: the upload screen's SheetJS calls in `to-do-file.component.ts`: `XLSX.read(<ArrayBuffer>, { type: 'binary' })` and `XLSX.utils.sheet_to_json(sheet, { raw: true, defval: null })`. The component itself doesn't change.

- [ ] **Step 1: Write a contract spec for the SheetJS calls the upload screen makes**

`frontend/evamed/src/app/to-do-file/xlsx.contract.spec.ts`:

```ts
import * as XLSX from 'xlsx';

// The to-do-file screen reads an upload with FileReader.readAsArrayBuffer and
// passes the ArrayBuffer to XLSX.read with { type: 'binary' }, then calls
// sheet_to_json with { raw: true, defval: null }. Pin that exact call shape so
// a SheetJS upgrade can't silently break the upload.
describe('SheetJS as the to-do-file screen uses it', () => {
  it('parses an ArrayBuffer passed as type "binary"', () => {
    const sheet = XLSX.utils.aoa_to_sheet([['material', 'cantidad'], ['Concreto', 12], ['Acero', null]]),
      book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Materiales');

    const bytes: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' }),
      wb = XLSX.read(bytes, { type: 'binary' }),
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: true, defval: null });

    expect(wb.SheetNames).toEqual(['Materiales']);
    expect(rows).toEqual([
      { material: 'Concreto', cantidad: 12 },
      { material: 'Acero', cantidad: null },
    ]);
  });
});
```

- [ ] **Step 2: Run it against today's xlsx 0.18.5.** This is a characterization test, so it should pass now.

```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npm test -- --watch=false' 2>&1 | grep -E "Tests |FAIL|✓|×"
```

Expected: `6 passed (6)`. If the contract spec fails here, stop and report: the spec doesn't describe what the screen does today.

- [ ] **Step 3: Swap the packages** (R7) and apply the non-breaking qs fix:

```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine sh -lc '
  npm uninstall swiper &&
  npm install --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz &&
  npm audit fix &&
  npm audit --omit=dev'
grep -rn "swiper" frontend/evamed/src || echo "no swiper usage"
```

Expected: `found 0 vulnerabilities` and `no swiper usage`. Never run `npm audit fix --force`; it would pull in unrelated major versions.

- [ ] **Step 4: Remove the swiper stylesheet.** In `frontend/evamed/angular.json`, delete the line `"./node_modules/swiper/swiper.css",` from `projects.evamed.architect.build.options.styles`. The list becomes:

```json
"styles": [
  "./node_modules/@angular/material/prebuilt-themes/indigo-pink.css",
  "./node_modules/flexboxgrid/dist/flexboxgrid.min.css",
  "src/styles.scss"
],
```

- [ ] **Step 5: Verify tests, build and lint**

```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine sh -lc '
  npm ci >/dev/null &&
  npm test -- --watch=false 2>&1 | grep -E "Tests " &&
  npm run build -- --configuration production 2>&1 | grep -E "Initial total|ERROR|error TS";
  npx ng lint 2>&1 | grep problems;
  npm audit --omit=dev | tail -1'
grep -E '"(xlsx|swiper|qs)"' frontend/evamed/package.json
```

Expected:
- `6 passed (6)`
- the build succeeds with Initial total at or below 1.65 MB
- `187 problems`
- `found 0 vulnerabilities`
- `package.json` shows `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` and no swiper

- [ ] **Step 6: Commit**

```bash
git add frontend/evamed/src/app/to-do-file/xlsx.contract.spec.ts frontend/evamed/package.json \
        frontend/evamed/package-lock.json frontend/evamed/angular.json
git commit -m "fix(frontend): xlsx 0.20.3 from SheetJS, drop unused swiper, patch qs"
```

---

### Task 4: Bring the AWS plan up to date and gate it

**Files:**
- Modify: `docs/superpowers/plans/2026-09-11-aws-lightsail-dev-deploy.md`

**Interfaces:**
- Consumes: `NUM_PROXIES = 1` (Task 1), the CORS list (Task 2).

- [ ] **Step 1: Apply these exact replacements**

| Find | Replace with |
|---|---|
| `Caddy 2, the existing Django 2.2 / Angular 19 images.` | `Caddy 2, the existing Django 5.2 / Angular 22 images.` |
| `It holds seeded catalogue data from \`backend/evamed-api/backup\` and must never receive a copy of production user data.` | `It holds seeded catalogue data from \`backend/evamed-api/backup\`, plus its test accounts and projects, which are not real people (confirmed 2026-09-15), and must never receive a copy of production user data.` |
| The whole gap item that starts `1. **The API accepts anonymous writes.**` | `1. **API authorization — done.** The API-authorization plan made the API authenticated by default, with catalogue routes public-read/admin-write and project data owner-only. The pre-deploy hardening plan added throttling (anonymous 120/min per address, signed-in 600/min per Firebase uid) with \`NUM_PROXIES = 1\`. Caddy's \`reverse_proxy\` appends \`X-Forwarded-For\` by default, which is what that setting expects; putting a load balancer or CDN in front of Caddy means raising it.` |
| The whole gap item that starts `6. **Stale entries.**` | `6. **Stale entries — done.** The retired EC2/LAN origins are gone from \`CORS_ALLOWED_ORIGINS\` and the dead \`*Fake\` methods are deleted.` |
| `	@api path /api/* /api-projects/* /api-profiles/*` | `	@api path /api/* /api-projects/*` |

- [ ] **Step 2: Add a pre-flight step** at the top of Task 0, before `- [ ] **Step 1: AWS identity.**`:

```markdown
- [ ] **Step 0: Pre-flight.** `docs/superpowers/plans/2026-09-14-pre-deploy-hardening.md` is complete (throttling, CORS and the npm audit fixes are on `main`), and the Angular-upgrade smoke checklist S1–S8 has passed on `main`. Do not create a public hostname before both are true.
```

- [ ] **Step 3: Check nothing stale remains**

```bash
P=docs/superpowers/plans/2026-09-11-aws-lightsail-dev-deploy.md
grep -nE "Django 2\.2 / Angular 19|@api path.*api-profiles|accepts anonymous writes" "$P" || echo "CLEAN"
grep -c "Step 0: Pre-flight" "$P"
```

Expected: `CLEAN` and `1`. The D6 row's sentence "`/api-profiles/*` no longer exists" is historical and intentionally kept, which is why the grep only looks at the Caddy route line.

- [ ] **Step 4: Commit and push everything**

```bash
git add docs/superpowers/plans/2026-09-11-aws-lightsail-dev-deploy.md
git commit -m "docs(aws-plan): current stack, done gaps, no /api-profiles route, gate on hardening"
git push origin main
```

---

## After this plan (not tasks here)

1. **S1–S8 click-through** from `docs/superpowers/plans/2026-09-13-angular-upgrade.md`. Also upload a sample `.xlsx` on the `to-do-file` screen and confirm it's read (new SheetJS).
2. **AWS plan Task 0:**
   - pick the AWS account and a non-root IAM user with MFA
   - confirm the Route 53 domain
   - install the AWS CLI v2 and Terraform ≥ 1.10 (neither is installed here)
3. Then run `docs/superpowers/plans/2026-09-11-aws-lightsail-dev-deploy.md`.

## Self-review notes

- **Coverage:**

  | Finding | Where it's handled |
  |---|---|
  | F1 | Task 1 |
  | F2 | Task 2 |
  | F3 | Task 3 |
  | F4 | Task 4 |
  | F5 | AWS plan Task 1, as noted |

  The audit's other items (Firebase authorized domain, Task 0 tooling, S1–S8) are in the AWS plan's own steps or in "After this plan".
- **Test counts:**

  | After | Backend tests |
  |---|---|
  | Baseline | 97 |
  | Task 1 | 102 (+5) |
  | Task 2 | 104 (+2) |

  Frontend goes from 5 to 6 after Task 3.
- **Names used across tasks:** `FirebaseUserRateThrottle`, `NoThrottleTestRunner`, `NUM_PROXIES`, the rates `anon` 120/minute and `user` 600/minute.
- **Unverified here, because Docker was down while this was written:** the throttling/CORS tests and the SheetJS 0.20.3 contract. Each has a step that fails loudly rather than passing silently: Task 1 Step 2 must show nothing is throttled yet, and Task 3 Step 2 must pass on 0.18.5.
