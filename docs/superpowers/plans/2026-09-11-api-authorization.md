# API Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop anonymous and cross-user access to the EVAmed API. Catalogue data becomes public-read and admin-write, project data becomes owner-only, and user profiles become self-only with no passwords in them.

**Architecture:** Every DRF endpoint authenticates with the existing `FirebaseAuthentication`, and the default permission becomes `IsAuthenticated` (fail-closed). A new `projects_api/access.py` holds three rules:
- `IsAdminOrReadOnly` for the 30 catalogue viewsets.
- `OwnedByCallerMixin`, which scopes a viewset's queryset and its writes by the ORM path to the owner's email, for the 8 project-owned viewsets and `users-platform`.
- `owned_projects()` / `owns_project()` helpers for the three hand-written `APIView`s.

An "admin" is a Django `UserProfile` with `is_staff`, reachable only through a **verified** Firebase email and managed with a `grant_admin` command. The frontend waits for Firebase to restore the session before sending requests, stops sending passwords to the API, and gets the admin flag from a new `GET /api-projects/me/`.

**Tech Stack:** Django 2.2, DRF 3.9, firebase-admin, Angular 19 + @angular/fire 19 (firebase 11).

**Spec:** None separate. Decisions below. Background: gap 1 in `docs/superpowers/plans/2026-09-11-aws-lightsail-dev-deploy.md`.

## Global Constraints

- Backend commands run in the local compose stack, with the source bind-mounted so no rebuilds are needed. The canonical form, from the repo root:
  `docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py <args>`
  Every backend step below uses exactly this prefix (abbreviated nowhere).
- Frontend compile check: `docker compose build web` (uses the `docker` Angular configuration, which is a full AOT build).
- `projects_api/tests.py` is **tab-indented**; every other Python file uses 4 spaces.
- Catalogue writes are admin-only. Project data is owner-only, including for admins through the API (Django admin keeps full access).
- An admin must sign in with a Firebase account whose email is **verified** (Google sign-in always is).
- Do not push or deploy until Task 7; the backend and frontend changes go live together.

---

## Decisions

### Made in this plan (override before starting if you disagree)

| # | Decision | Choice | Why / alternative |
|---|---|---|---|
| A1 | Catalogue tables (materials, units, transports, … 30 routes) | Anyone can read; only admins can write | The UI already writes to them only from its admin pages (verified: every `post/put/delete` on these endpoints lives in `materials.service.ts` / `analisis.service.ts` and is called only from `*-admin` components). The register page reads `countries` before login, so reads stay public. |
| A2 | What "admin" means | A Django `UserProfile` with `is_staff=True`, matched by **verified** Firebase email; managed with `python manage.py grant_admin <email>` | No new infra, and it's revocable without a deploy. Today "admin" is only `*ngIf="email === 'arqarvizup@gmail.com'"` in the UI, and the backend enforces nothing. Alternatives: Firebase custom claims (needs an Admin-SDK script; no DB row), or an env-var allowlist (every change needs a redeploy). |
| A3 | Project data (8 routes + 3 APIViews) | Visible and writable only by the owner, meaning the `UserPlatform` whose email equals the token email, case-insensitive | Today every project of every user is readable and writable anonymously; the UI hides other users' projects with a client-side `filter`. Scoping server-side is invisible to the UI, because it already filters to its own rows. |
| A4 | Unverified emails | Project data needs a **verified** email (Firebase `email_verified`, whatever the sign-in provider). Unverified users, including social sign-ins Firebase reports unverified, can register and read their own profile but see no projects until they verify. Updating a profile needs a verified email; the API can't delete profiles (Django admin can). Unverified users can't be admin. | Anyone can create a Firebase account for any address without verifying it, and the sign-in provider doesn't prove the email either (account linking, email changes, multi-tenant Microsoft). A verification banner points unverified users to the email. |
| A5 | `/api-profiles/*` (course demo code: hello, feed, token login, profile list) | **Removed** | The frontend never calls it (verified). It exposes a password-guessing login for Django users (who will now be the admins) and lists every Django user's email. |
| A6 | `UserPlatform.password` | Column **dropped**, and the field removed from the API | It stores the **plaintext** Firebase password of every email/password user (`register.component.ts` posts the form, password included, to `users-platform/`), and any signed-in user can list it today. Dropping the column is irreversible, which is intended. |
| A7 | Missing credentials | `401` + `WWW-Authenticate: Bearer` (not `403`) | The UI and clients can tell "sign in" apart from "not allowed". |

### Needs your decision (not blocking the code)

1. **Possible exposure of plaintext passwords.** Until commit `6c020f8` (2026-06-18), `users-platform/` had no permission check, so anyone on the internet could `GET` every user's name, email and plaintext password from the live API (Render, and Heroku before it). From then until this plan ships, any signed-in user can. Those are the same passwords users use for Firebase, and probably elsewhere. This plan stops the leak and deletes the data. It does **not** decide on:
   - forcing a password reset for all email/password accounts (possible in bulk with the Firebase Admin SDK by revoking refresh tokens and sending reset emails),
   - notifying users,
   - whether Mexican data-protection law (LFPDPPP) or your institution's policy creates a notification duty.

   Please decide those with whoever is responsible for the platform.

   Also: the git-tracked seed dump `backend/evamed-api/backup` contained those plaintext passwords (and real users' names and emails) in git history since the initial commit. The working-tree copy is now scrubbed (passwords set to NULL). Whether to rewrite git history, and whether real users' data belongs in the seed at all, is your call.
2. **Who the admins are.** Task 7 grants admin to `arqarvizup@gmail.com` (the address hardcoded in the UI today). Confirm that this is right, and list anyone else.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `backend/evamed-api/profiles_api/authentication.py` | Modify | Carry `email_verified`/`is_staff`; bridge to Django user only for verified emails; 401 header |
| `backend/evamed-api/profiles_api/tests_authentication.py` | Create | Tests for the above |
| `backend/evamed-api/profiles_project/settings.py` | Modify | `REST_FRAMEWORK` defaults |
| `backend/evamed-api/projects_api/access.py` | Create | Ownership + admin rules |
| `backend/evamed-api/projects_api/testing.py` | Create | Test helpers (`firebase_user`, `admin_user`, `platform_user`, `owned_project`) |
| `backend/evamed-api/projects_api/views.py` | Modify | Apply rules to every viewset/APIView; add `MeView` |
| `backend/evamed-api/projects_api/urls.py` | Modify | Route `me/` |
| `backend/evamed-api/projects_api/serializers.py` | Modify | `UserPlatformSerializer` without password |
| `backend/evamed-api/projects_api/migrations/0083_remove_userplatform_password.py` | Create | Drop the column |
| `backend/evamed-api/projects_api/tests_access.py` | Create | Catalogue + ownership + route-classification tests |
| `backend/evamed-api/projects_api/tests_users.py` | Create | `users-platform` + `me` tests |
| `backend/evamed-api/projects_api/tests.py`, `tests_project_results.py` | Modify | Authenticate as the project owner |
| `backend/evamed-api/profiles_api/management/commands/grant_admin.py` (+ `__init__.py` ×2) | Create | Grant/revoke admin |
| `backend/evamed-api/profiles_api/tests_grant_admin.py` | Create | Tests for the command |
| `backend/evamed-api/profiles_project/urls.py` | Modify | Unmount `api-profiles/` |
| `backend/evamed-api/profiles_api/{urls,views,serializers,permissions}.py` | Delete | Dead demo endpoints |
| `frontend/evamed/src/app/core/interceptors/auth.interceptor.ts` | Modify | Wait for `authStateReady()` |
| `frontend/evamed/src/app/core/services/auth.service.ts` | Modify | `deleteCurrentUser()` |
| `frontend/evamed/src/app/core/services/user/user.service.ts` | Modify | `getMe()` |
| `frontend/evamed/src/environments/environment*.ts` | Modify | `api_me` |
| `frontend/evamed/src/app/auth/components/register/register.component.ts` | Modify | Firebase first, no password to API, rollback |
| `frontend/evamed/src/app/auth/components/complete-profile/complete-profile.component.ts` | Modify | Drop `password: ''` |
| `frontend/evamed/src/app/home-evamed/components/home-evamed/home-evamed.component.{ts,html}` | Modify | Admin button from `/me` |

---

### Task 1: Harden `FirebaseAuthentication` and make it the default

**Files:**
- Modify: `backend/evamed-api/profiles_api/authentication.py`
- Modify: `backend/evamed-api/profiles_project/settings.py` (end of file)
- Create: `backend/evamed-api/profiles_api/tests_authentication.py`

**Interfaces:**
- Produces: `FirebaseUser(uid: str, email: str, email_verified: bool = False)` with attributes `uid, email, email_verified, id=None, pk=None, is_authenticated=True, is_active=True, is_staff=False`.
- `FirebaseAuthentication.authenticate()` returns `(UserProfile, None)` **only** when the token's `email_verified` is true and an active `UserProfile` has that email (case-insensitive); otherwise `(FirebaseUser, None)`. Returns `None` when there is no `Bearer` header.
- `FirebaseAuthentication.authenticate_header()` returns `'Bearer'`.

- [ ] **Step 1: Write the failing tests**

`backend/evamed-api/profiles_api/tests_authentication.py`:

```python
from unittest import mock

from django.test import TestCase
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory

from profiles_api.authentication import FirebaseAuthentication, FirebaseUser
from profiles_api.models import UserProfile


def bearer_request(token='valid-token'):
    return APIRequestFactory().get('/', HTTP_AUTHORIZATION='Bearer ' + token)


@mock.patch('profiles_api.authentication._get_firebase_app', return_value=None)
class FirebaseAuthenticationTests(TestCase):

    def setUp(self):
        self.admin = UserProfile.objects.create_user(email='admin@example.com', name='Admin')
        self.admin.is_staff = True
        self.admin.save()

    def authenticate(self, claims):
        with mock.patch('firebase_admin.auth.verify_id_token', return_value=claims):
            return FirebaseAuthentication().authenticate(bearer_request())

    def test_no_bearer_header_is_anonymous(self, _app):
        self.assertIsNone(FirebaseAuthentication().authenticate(APIRequestFactory().get('/')))

    def test_invalid_token_is_rejected(self, _app):
        with mock.patch('firebase_admin.auth.verify_id_token', side_effect=ValueError('bad')):
            with self.assertRaises(AuthenticationFailed):
                FirebaseAuthentication().authenticate(bearer_request())

    def test_verified_email_bridges_to_django_user(self, _app):
        user, _ = self.authenticate({'uid': 'u1', 'email': 'Admin@Example.com', 'email_verified': True})
        self.assertEqual(user, self.admin)
        self.assertTrue(user.is_staff)

    def test_unverified_email_never_bridges(self, _app):
        user, _ = self.authenticate({'uid': 'u1', 'email': 'admin@example.com', 'email_verified': False})
        self.assertIsInstance(user, FirebaseUser)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.email_verified)

    def test_inactive_django_user_is_not_bridged(self, _app):
        self.admin.is_active = False
        self.admin.save()
        user, _ = self.authenticate({'uid': 'u1', 'email': 'admin@example.com', 'email_verified': True})
        self.assertIsInstance(user, FirebaseUser)

    def test_unknown_verified_email_is_plain_firebase_user(self, _app):
        user, _ = self.authenticate({'uid': 'u2', 'email': 'someone@example.com', 'email_verified': True})
        self.assertIsInstance(user, FirebaseUser)
        self.assertEqual(user.email, 'someone@example.com')
        self.assertTrue(user.email_verified)
        self.assertFalse(user.is_staff)

    def test_missing_credentials_answer_401(self, _app):
        self.assertEqual(FirebaseAuthentication().authenticate_header(None), 'Bearer')
```

- [ ] **Step 2: Run to verify failure**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test profiles_api.tests_authentication -v 2
```

Expected: several FAIL/ERROR: unverified test gets the `UserProfile`, `FirebaseUser` has no `email_verified`/`is_staff`, and `authenticate_header` returns `None`.

- [ ] **Step 3: Implement**

In `backend/evamed-api/profiles_api/authentication.py`, replace the `FirebaseUser.__init__` method with:

```python
    def __init__(self, uid: str, email: str, email_verified: bool = False):
        self.uid = uid
        self.email = email
        self.email_verified = email_verified
        self.id = None
        self.pk = None
        self.is_authenticated = True
        self.is_active = True
        # Admin rights only ever come from a Django UserProfile (see below).
        self.is_staff = False
```

In `FirebaseAuthentication.authenticate`, replace everything from `email = decoded.get('email', '')` to the end of the method with:

```python
        email = decoded.get('email', '')
        email_verified = bool(decoded.get('email_verified', False))
        # Bridge to the Django user (which may carry is_staff) only for a
        # verified address: an unverified token just proves someone typed it.
        if email and email_verified:
            from profiles_api.models import UserProfile
            profile = UserProfile.objects.filter(email__iexact=email, is_active=True).first()
            if profile is not None:
                return (profile, None)

        return (FirebaseUser(uid=decoded['uid'], email=email, email_verified=email_verified), None)

    def authenticate_header(self, request):
        # Lets DRF answer 401 (not 403) when credentials are missing.
        return 'Bearer'
```

Append to `backend/evamed-api/profiles_project/settings.py`:

```python

REST_FRAMEWORK = {
    # Every endpoint reads the Firebase ID token sent by the Angular interceptor.
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'profiles_api.authentication.FirebaseAuthentication',
    ),
}
```

- [ ] **Step 4: Run the new tests, then the whole suite**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test profiles_api.tests_authentication -v 2
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test
```

Expected: `Ran 7 tests ... OK`, then the full suite `OK`. Existing tests call the API anonymously, and no permission has changed yet.

- [ ] **Step 5: Commit**

```bash
git add backend/evamed-api/profiles_api/authentication.py backend/evamed-api/profiles_api/tests_authentication.py backend/evamed-api/profiles_project/settings.py
git commit -m "fix(auth): only bridge verified Firebase emails to Django users; firebase auth by default"
```

---

### Task 2: Access rules + catalogue lockdown

**Files:**
- Create: `backend/evamed-api/projects_api/access.py`
- Create: `backend/evamed-api/projects_api/testing.py`
- Create: `backend/evamed-api/projects_api/tests_access.py`
- Modify: `backend/evamed-api/projects_api/views.py` (imports; 30 class declarations)

**Interfaces:**
- Consumes: `FirebaseUser(uid, email, email_verified)` from Task 1.
- Produces (`projects_api.access`): `PROJECT_OWNER = 'project_id__user_platform_id__email'`; `is_admin(user) -> bool`; `caller_email(user) -> str` (lower-cased, `''` if none); `owned_projects(user) -> QuerySet[Project]`; `owns_project(user, project_id) -> bool` (accepts str/int, and returns False for garbage); `IsAdminOrReadOnly` (permission); `OwnedByCallerMixin` (viewset mixin with class attr `owner_email_path: str`).
- Produces (`projects_api.testing`): `firebase_user(email, verified=True) -> FirebaseUser`, `admin_user(email='admin@example.com') -> UserProfile`, `platform_user(email) -> UserPlatform`, `owned_project(email, name='Project') -> Project`.
- Produces (`projects_api.views`): `CatalogueViewSet` base class.
- Produces (`projects_api.tests_access`): the constants `CATALOGUE_ROUTES`, `OWNED_ROUTES`, `USER_ROUTES` (sets of router prefixes).

- [ ] **Step 1: Create the test helpers**

`backend/evamed-api/projects_api/testing.py`:

```python
"""Helpers for authenticating API tests as EVAmed users."""
from profiles_api.authentication import FirebaseUser
from profiles_api.models import UserProfile
from projects_api import models


def firebase_user(email, verified=True):
    """What FirebaseAuthentication returns for a signed-in, non-admin user."""
    return FirebaseUser(uid='uid-' + email, email=email, email_verified=verified)


def admin_user(email='admin@example.com'):
    """A Django user with is_staff, as FirebaseAuthentication returns for admins."""
    profile = UserProfile.objects.create_user(email=email, name='Admin')
    profile.is_staff = True
    profile.save()
    return profile


def platform_user(email):
    """The UserPlatform row that owns a user's projects."""
    return models.UserPlatform.objects.create(name=email.split('@')[0], email=email)


def owned_project(email, name='Project'):
    return models.Project.objects.create(name_project=name, user_platform_id=platform_user(email))
```

- [ ] **Step 2: Write the failing tests**

`backend/evamed-api/projects_api/tests_access.py`:

```python
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase

from projects_api import access
from projects_api.testing import admin_user, firebase_user
from projects_api.urls import router

CATALOGUE_ROUTES = {
    'transports', 'uses', 'type-project', 'countries', 'external-distance',
    'useful-life', 'housing-scheme', 'materials', 'sections', 'origins',
    'units', 'standards', 'potential-types', 'volume-units', 'energy-units',
    'bulk-units', 'source-information', 'constructive-process',
    'material-scheme-data', 'sources-electricity-consumption',
    'stage-scheme-data', 'type-energy', 'source-information-data',
    'type-energy-data', 'states', 'cities', 'local-distances',
    'potential-transport', 'conversions', 'database-material',
}
OWNED_ROUTES = {
    'projects', 'material-scheme-project', 'material-scheme-project-original',
    'constructive-system-element', 'annual-consumption-required',
    'electricity-consumption-data',
    'electricity-consumption-deconstructive-process',
    'treatment-of-generate-wasted',
}
USER_ROUTES = {'users-platform'}


def viewset_for(prefix):
    return next(viewset for p, viewset, _ in router.registry if p == prefix)


class RouteClassificationTests(SimpleTestCase):
    """New routes must be classified here on purpose, not by accident."""

    def test_every_route_is_classified_exactly_once(self):
        registered = {prefix for prefix, _, _ in router.registry}
        self.assertEqual(registered, CATALOGUE_ROUTES | OWNED_ROUTES | USER_ROUTES)
        self.assertFalse(CATALOGUE_ROUTES & OWNED_ROUTES)

    def test_catalogue_viewsets_are_admin_write(self):
        for prefix in sorted(CATALOGUE_ROUTES):
            with self.subTest(prefix=prefix):
                self.assertIn(access.IsAdminOrReadOnly, viewset_for(prefix).permission_classes)


class CataloguePermissionTests(APITestCase):

    def test_anonymous_can_read_every_catalogue_route(self):
        for prefix in sorted(CATALOGUE_ROUTES):
            with self.subTest(prefix=prefix):
                self.assertEqual(self.client.get('/api-projects/%s/' % prefix).status_code, 200)

    def test_anonymous_cannot_write(self):
        for prefix in sorted(CATALOGUE_ROUTES):
            with self.subTest(prefix=prefix):
                response = self.client.post('/api-projects/%s/' % prefix, {}, format='json')
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_signed_in_non_admin_cannot_write(self):
        self.client.force_authenticate(user=firebase_user('user@example.com'))
        for prefix in sorted(CATALOGUE_ROUTES):
            with self.subTest(prefix=prefix):
                response = self.client.post('/api-projects/%s/' % prefix, {}, format='json')
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_write(self):
        self.client.force_authenticate(user=admin_user())
        response = self.client.post('/api-projects/units/', {'name_unit': 'kWh'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_unverified_email_is_never_admin(self):
        self.assertFalse(access.is_admin(firebase_user('admin@example.com', verified=False)))
```

- [ ] **Step 3: Run to verify failure**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test projects_api.tests_access -v 2
```

Expected: ERROR `ImportError: cannot import name 'access' from 'projects_api'`.

- [ ] **Step 4: Create `backend/evamed-api/projects_api/access.py`**

```python
"""Who may read and change what through the projects API.

* Catalogue tables (materials, units, transports, ...) are public to read;
  only admins may change them. An admin is a Django UserProfile with is_staff,
  which FirebaseAuthentication only returns for a verified email.
* Project data belongs to the UserPlatform whose email matches the caller's
  Firebase token.
"""
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from projects_api import models

PROJECT_OWNER = 'project_id__user_platform_id__email'


def is_admin(user):
    return bool(getattr(user, 'is_authenticated', False) and getattr(user, 'is_staff', False))


def caller_email(user):
    return (getattr(user, 'email', '') or '').strip().lower()


def owned_projects(user):
    email = caller_email(user)
    if not email:
        return models.Project.objects.none()
    return models.Project.objects.filter(user_platform_id__email__iexact=email)


def owns_project(user, project_id):
    try:
        project_id = int(project_id)
    except (TypeError, ValueError):
        return False
    return owned_projects(user).filter(id=project_id).exists()


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or is_admin(request.user)


class OwnedByCallerMixin:
    """Limit a ModelViewSet to rows whose owner email is the caller's.

    `owner_email_path` is the ORM path from the model to the owner's email,
    e.g. PROJECT_OWNER. Its first segment must be a serializer field.
    """
    permission_classes = (permissions.IsAuthenticated,)
    owner_email_path = None

    def get_queryset(self):
        email = caller_email(self.request.user)
        queryset = super().get_queryset()
        if not email:
            return queryset.none()
        return queryset.filter(**{self.owner_email_path + '__iexact': email})

    def perform_create(self, serializer):
        self._require_ownership(serializer.validated_data, required=True)
        serializer.save()

    def perform_update(self, serializer):
        self._require_ownership(serializer.validated_data, required=False)
        serializer.save()

    def _require_ownership(self, validated_data, required):
        first, *rest = self.owner_email_path.split('__')
        if first not in validated_data and not required:
            return  # partial update that doesn't move the row; the row is already scoped
        value = validated_data.get(first)
        for attr in rest:
            value = getattr(value, attr, None)
        if not value or value.strip().lower() != caller_email(self.request.user):
            raise PermissionDenied('That record does not belong to you.')
```

- [ ] **Step 5: Apply `CatalogueViewSet` in `views.py`**

In `backend/evamed-api/projects_api/views.py`, after the last `import` line near the top, add:

```python
from projects_api import access


class CatalogueViewSet(viewsets.ModelViewSet):
    """Reference data: anyone may read it, only admins may change it."""
    permission_classes = (access.IsAdminOrReadOnly,)
```

Then switch the 30 catalogue viewsets to it (run from the repo root):

```bash
python3 - <<'EOF'
import pathlib, re
p = pathlib.Path('backend/evamed-api/projects_api/views.py')
names = """TransportsViewSet UsesViewSet TypeProjectsViewSet CountriesViewSet
ExternalDistanceViewSet UsefulLifeViewSet HousingSchemeViewSet MaterialsViewSet
SectionsViewSet OriginsViewSet UnitsViewSet StandardsViewSet PotentialTypesViewSet
VolumeUnitsViewSet EnergyUnitsViewSet BulkUnitsViewSet SourceInformationViewSet
ConstructiveProcessViewSet MaterialSchemeDataViewSet SourcesElectricityConsumptionViewSet
StageSchemeDataViewSet TypeEnergyViewSet SourceInformationDataViewSet TypeEnergyDataViewSet
StatesViewSet CitiesViewSet LocalDistancesViewSet PotentialTransportViewSet
ConversionsViewSet DataBaseMaterialViewSet""".split()
assert len(names) == 30
s = p.read_text()
for n in names:
    s, k = re.subn(r'class %s\(viewsets\.ModelViewSet\):' % n, 'class %s(CatalogueViewSet):' % n, s)
    assert k == 1, n
p.write_text(s)
print('ok')
EOF
```

Expected: `ok`.

- [ ] **Step 6: Run the new tests, then the whole suite**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test projects_api.tests_access -v 2
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test
```

Expected: `Ran 7 tests ... OK`; full suite `OK`.

- [ ] **Step 7: Commit**

```bash
git add backend/evamed-api/projects_api/access.py backend/evamed-api/projects_api/testing.py backend/evamed-api/projects_api/tests_access.py backend/evamed-api/projects_api/views.py
git commit -m "fix(api): catalogue endpoints are public-read, admin-write"
```

---

### Task 3: Project data is owner-only; fail-closed default

**Files:**
- Modify: `backend/evamed-api/projects_api/views.py` (8 viewsets, `ProjectResultsView`, `MaterialStageView`, `MaterialStageUpdateView`)
- Modify: `backend/evamed-api/profiles_project/settings.py` (`REST_FRAMEWORK`)
- Modify: `backend/evamed-api/projects_api/tests_access.py` (append)
- Modify: `backend/evamed-api/projects_api/tests.py` (setUp, tab-indented)
- Modify: `backend/evamed-api/projects_api/tests_project_results.py:39`

**Interfaces:**
- Consumes: everything `access` and `testing` produce (Task 2).
- Produces: owner-scoped behaviour. A non-owner gets `404` on detail/update/delete, `403` when creating a row that points at someone else's project, `404` on `GET materials-stage/?project_id=<not yours>` and on `projects/<not yours>/results/`, and `400 {"detail": "Invalid project_id"}` on materials-stage writes for a project that isn't theirs. Anonymous callers get `401` on all of these.

- [ ] **Step 1: Write the failing tests**

In `projects_api/tests_access.py`, change the imports at the top to:

```python
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase

from projects_api import access, models
from projects_api.testing import admin_user, firebase_user, owned_project
from projects_api.urls import router
```

and append:

```python
class ProjectOwnershipTests(APITestCase):

    def setUp(self):
        self.alice_project = owned_project('alice@example.com', name='Alice')
        self.bob_project = owned_project('bob@example.com', name='Bob')
        self.rows = {}
        for project, who in ((self.alice_project, 'alice'), (self.bob_project, 'bob')):
            acr = models.AnnualConsumptionRequired.objects.create(project_id=project)
            self.rows[who] = {
                'projects': project.id,
                'material-scheme-project': models.MaterialSchemeProject.objects.create(project_id=project).id,
                'material-scheme-project-original': models.MaterialSchemeProjectOrigianal.objects.create(project_id=project).id,
                'constructive-system-element': models.ConstructiveSystemElement.objects.create(project_id=project).id,
                'annual-consumption-required': acr.id,
                'electricity-consumption-data': models.ElectricityConsumptionData.objects.create(annual_consumption_required_id=acr).id,
                'electricity-consumption-deconstructive-process': models.ElectricityConsumptionDeconstructiveProcess.objects.create(project_id=project).id,
                'treatment-of-generate-wasted': models.TreatmentOfGeneratedWaste.objects.create(project_id=project).id,
            }
        self.assertEqual(set(self.rows['alice']), OWNED_ROUTES)

    def as_alice(self):
        self.client.force_authenticate(user=firebase_user('ALICE@example.com'))  # case-insensitive

    def test_anonymous_gets_401_everywhere(self):
        for prefix in sorted(OWNED_ROUTES):
            with self.subTest(prefix=prefix):
                self.assertEqual(self.client.get('/api-projects/%s/' % prefix).status_code, 401)

    def test_lists_contain_only_own_rows(self):
        self.as_alice()
        for prefix in sorted(OWNED_ROUTES):
            with self.subTest(prefix=prefix):
                ids = {row['id'] for row in self.client.get('/api-projects/%s/' % prefix).data}
                self.assertEqual(ids, {self.rows['alice'][prefix]})

    def test_other_users_rows_are_invisible_and_untouchable(self):
        self.as_alice()
        for prefix in sorted(OWNED_ROUTES):
            url = '/api-projects/%s/%s/' % (prefix, self.rows['bob'][prefix])
            with self.subTest(prefix=prefix):
                self.assertEqual(self.client.get(url).status_code, 404)
                self.assertEqual(self.client.patch(url, {}, format='json').status_code, 404)
                self.assertEqual(self.client.delete(url).status_code, 404)

    def test_cannot_create_rows_in_someone_elses_project(self):
        self.as_alice()
        payload = {'project_id': self.bob_project.id, 'quantity': None, 'unit_id': None}
        response = self.client.post('/api-projects/annual-consumption-required/', payload, format='json')
        self.assertEqual(response.status_code, 403)

    def test_can_create_rows_in_own_project(self):
        self.as_alice()
        payload = {'project_id': self.alice_project.id, 'quantity': None, 'unit_id': None}
        response = self.client.post('/api-projects/annual-consumption-required/', payload, format='json')
        self.assertEqual(response.status_code, 201)

    def test_projects_can_only_be_created_for_yourself(self):
        self.as_alice()
        payload = {
            'name_project': 'New', 'use_id': None, 'type_id': None, 'country_id': None,
            'builded_surface': None, 'living_area': None, 'tier': None,
            'useful_life_id': None, 'housing_scheme_id': None, 'city_id_origin': None,
            'distance': None,
        }
        mine = dict(payload, user_platform_id=self.alice_project.user_platform_id.id)
        theirs = dict(payload, user_platform_id=self.bob_project.user_platform_id.id)
        self.assertEqual(self.client.post('/api-projects/projects/', mine, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api-projects/projects/', theirs, format='json').status_code, 403)

    def test_results_are_owner_only(self):
        # The owner's 200 path is covered by tests_project_results (which signs in as the owner).
        self.as_alice()
        self.assertEqual(self.client.get('/api-projects/projects/%s/results/' % self.bob_project.id).status_code, 404)

    def test_materials_stage_is_owner_only(self):
        self.as_alice()
        section = models.Section.objects.create(name_section='S')
        get_theirs = self.client.get('/api-projects/materials-stage/', {'project_id': self.bob_project.id})
        post_theirs = self.client.post('/api-projects/materials-stage/', {
            'project_id': self.bob_project.id,
            'items': [{'section_id': section.id, 'label': 'Muro'}],
        }, format='json')
        patch_theirs = self.client.patch('/api-projects/materials-stage/update/', {
            'project_id': self.bob_project.id, 'selectedIds': [],
        }, format='json')
        self.assertEqual(get_theirs.status_code, 404)
        self.assertEqual(post_theirs.status_code, 400)
        self.assertEqual(patch_theirs.status_code, 400)
        self.assertEqual(self.client.get('/api-projects/materials-stage/', {'project_id': 'abc'}).status_code, 404)
```

- [ ] **Step 2: Run to verify failure**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test projects_api.tests_access.ProjectOwnershipTests -v 2
```

Expected: FAILs. Anonymous gets `200`, lists contain Bob's rows, and so on.

- [ ] **Step 3: Scope the 8 project-owned viewsets**

In `backend/evamed-api/projects_api/views.py`, change each class line and add `owner_email_path` as the first line of its body (keep everything else in the class as is):

| Class line becomes | Add in body |
|---|---|
| `class ProjectsViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):` | `owner_email_path = 'user_platform_id__email'` |
| `class MaterialSchemeProjectViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):` | `owner_email_path = access.PROJECT_OWNER` |
| `class MaterialSchemeProjectOriginalViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):` | `owner_email_path = access.PROJECT_OWNER` |
| `class ConstructiveSystemElementViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):` | `owner_email_path = access.PROJECT_OWNER` |
| `class AnnualConsumptionRequiredViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):` | `owner_email_path = access.PROJECT_OWNER` |
| `class ElectricityConsumptionDataViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):` | `owner_email_path = 'annual_consumption_required_id__' + access.PROJECT_OWNER` |
| `class ElectricityConsumptionDeconstructiveProcessViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):` | `owner_email_path = access.PROJECT_OWNER` |
| `class TreatmentOfGeneratedWasteViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):` | `owner_email_path = access.PROJECT_OWNER` |

Example of the finished shape:

```python
class ProjectsViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):
    """Handle creating and updating profiles"""
    owner_email_path = 'user_platform_id__email'
    serializer_class = serializers.ProjectsSerializer
    ...
```

- [ ] **Step 4: Guard the three APIViews**

`ProjectResultsView`: add `permission_classes = (IsAuthenticated,)` under its docstring, and replace

```python
            project = models.Project.objects.select_related('useful_life_id').get(id=project_id)
```

with

```python
            project = access.owned_projects(request.user).select_related('useful_life_id').get(id=project_id)
```

`MaterialStageView`: add `permission_classes = (IsAuthenticated,)` under its docstring. In `get`, right after the `if project_id is None: ... return Response(...)` block, insert:

```python
        if not access.owns_project(request.user, project_id):
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
```

`MaterialStageUpdateView`: add `permission_classes = (IsAuthenticated,)` under its docstring.

Then replace both occurrences (in `MaterialStageView.post` and `MaterialStageUpdateView._update_selection_state`) of

```python
        if not models.Project.objects.filter(id=project_id).exists():
```

with

```python
        if not access.owns_project(request.user, project_id):
```

Check: `grep -c "models.Project.objects.filter(id=project_id).exists()" backend/evamed-api/projects_api/views.py` → `0`.

- [ ] **Step 5: Fail-closed default**

In `backend/evamed-api/profiles_project/settings.py`, extend `REST_FRAMEWORK`:

```python
REST_FRAMEWORK = {
    # Every endpoint reads the Firebase ID token sent by the Angular interceptor.
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'profiles_api.authentication.FirebaseAuthentication',
    ),
    # Anything not explicitly opened up (catalogue reads) needs a signed-in user.
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}
```

- [ ] **Step 6: Make the existing tests sign in as the project owner**

`backend/evamed-api/projects_api/tests.py` (tabs). Add below `from projects_api import models`:

```python
from projects_api.testing import firebase_user, owned_project
```

and in `MaterialStageSelectionApiTests.setUp` replace

```python
		self.project = models.Project.objects.create(name_project='Test Project')
```

with

```python
		self.project = owned_project('owner@example.com', name='Test Project')
		self.client.force_authenticate(user=firebase_user('owner@example.com'))
```

`backend/evamed-api/projects_api/tests_project_results.py`. Add below `from projects_api import models`:

```python
from projects_api.testing import firebase_user, owned_project
```

and replace line 39

```python
        self.project = models.Project.objects.create(name_project='test project')
```

with

```python
        self.project = owned_project('owner@example.com', name='test project')
        self.client.force_authenticate(user=firebase_user('owner@example.com'))
```

- [ ] **Step 7: Run the ownership tests, then the whole suite**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test projects_api.tests_access -v 2
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test
```

Expected: `tests_access` runs 15 tests, OK. Full suite OK. `users-platform` is still covered by its old `get_permissions`, which Task 4 replaces.

- [ ] **Step 8: Commit**

```bash
git add backend/evamed-api/projects_api/views.py backend/evamed-api/profiles_project/settings.py backend/evamed-api/projects_api/tests_access.py backend/evamed-api/projects_api/tests.py backend/evamed-api/projects_api/tests_project_results.py
git commit -m "fix(api): project data is owner-only; authenticated by default"
```

---

### Task 4: `users-platform` is self-only and password-free; `GET /me/`

**Files:**
- Modify: `backend/evamed-api/projects_api/views.py` (`UserPlatformViewSet`; add `MeView`)
- Modify: `backend/evamed-api/projects_api/urls.py`
- Modify: `backend/evamed-api/projects_api/serializers.py` (`UserPlatformSerializer`)
- Create: `backend/evamed-api/projects_api/migrations/0083_remove_userplatform_password.py`
- Create: `backend/evamed-api/projects_api/tests_users.py`

**Interfaces:**
- Consumes: `access.OwnedByCallerMixin`, `access.is_admin`, `access.caller_email`; test helpers.
- Produces:
  - `users-platform/`: create requires auth, and `email` must equal the token email. Non-admins list and search only their own row(s); admins see everyone. No `password` key anywhere.
  - `GET /api-projects/me/` returns `{"email": str, "is_admin": bool, "email_verified": bool}`, or `401` when anonymous. Task 6 uses it.

- [ ] **Step 1: Write the failing tests**

`backend/evamed-api/projects_api/tests_users.py`:

```python
from django.core.exceptions import FieldDoesNotExist
from rest_framework.test import APITestCase

from projects_api import models
from projects_api.testing import admin_user, firebase_user, platform_user

PROFILE = {'name': 'Alice', 'institution': 'UNAM', 'sector': 'Academia', 'country': 'México'}


class UserPlatformTests(APITestCase):

    def setUp(self):
        self.alice = platform_user('alice@example.com')
        self.bob = platform_user('bob@example.com')

    def test_anonymous_cannot_register_a_profile(self):
        response = self.client.post('/api-projects/users-platform/', dict(PROFILE, email='x@example.com'), format='json')
        self.assertEqual(response.status_code, 401)

    def test_signed_in_user_registers_own_profile_without_password(self):
        self.client.force_authenticate(user=firebase_user('carol@example.com'))
        response = self.client.post('/api-projects/users-platform/', dict(PROFILE, email='Carol@example.com'), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertNotIn('password', response.data)

    def test_cannot_register_a_profile_for_another_email(self):
        self.client.force_authenticate(user=firebase_user('carol@example.com'))
        response = self.client.post('/api-projects/users-platform/', dict(PROFILE, email='bob@example.com'), format='json')
        self.assertEqual(response.status_code, 403)

    def test_search_only_finds_yourself(self):
        self.client.force_authenticate(user=firebase_user('alice@example.com'))
        own = self.client.get('/api-projects/users-platform/', {'search': 'alice@example.com'}).data
        other = self.client.get('/api-projects/users-platform/', {'search': 'bob@example.com'}).data
        self.assertEqual([row['id'] for row in own], [self.alice.id])
        self.assertEqual(other, [])

    def test_admin_lists_everyone(self):
        self.client.force_authenticate(user=admin_user())
        ids = {row['id'] for row in self.client.get('/api-projects/users-platform/').data}
        self.assertEqual(ids, {self.alice.id, self.bob.id})

    def test_password_is_gone_from_model_and_api(self):
        with self.assertRaises(FieldDoesNotExist):
            models.UserPlatform._meta.get_field('password')
        self.client.force_authenticate(user=admin_user())
        for row in self.client.get('/api-projects/users-platform/').data:
            self.assertNotIn('password', row)


class MeTests(APITestCase):

    def test_anonymous_gets_401(self):
        self.assertEqual(self.client.get('/api-projects/me/').status_code, 401)

    def test_regular_user(self):
        self.client.force_authenticate(user=firebase_user('Alice@example.com', verified=False))
        self.assertEqual(self.client.get('/api-projects/me/').data,
                         {'email': 'alice@example.com', 'is_admin': False, 'email_verified': False})

    def test_admin(self):
        self.client.force_authenticate(user=admin_user('boss@example.com'))
        self.assertEqual(self.client.get('/api-projects/me/').data,
                         {'email': 'boss@example.com', 'is_admin': True, 'email_verified': True})
```

- [ ] **Step 2: Run to verify failure**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test projects_api.tests_users -v 2
```

Expected: FAILs. Anonymous create returns `201`, search returns Bob, `password` exists, and `/me/` returns `404`.

- [ ] **Step 3: Rewrite `UserPlatformViewSet`**

Replace the whole `class UserPlatformViewSet ...` block (from `class UserPlatformViewSet` down to, but not including, `class TransportsViewSet`) with:

```python
class UserPlatformViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):
    """A user's own profile. Admins can list everyone's."""
    serializer_class = serializers.UserPlatformSerializer
    queryset = models.UserPlatform.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=email', )
    owner_email_path = 'email'

    def get_queryset(self):
        if access.is_admin(self.request.user):
            return models.UserPlatform.objects.all()
        return super().get_queryset()


class MeView(APIView):
    """Who the caller is, as the API sees it. Drives admin-only UI."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response({
            'email': access.caller_email(request.user),
            'is_admin': access.is_admin(request.user),
            # Django (admin) users are only ever bridged for verified emails.
            'email_verified': getattr(request.user, 'email_verified', True),
        })
```

- [ ] **Step 4: Route it**

In `backend/evamed-api/projects_api/urls.py`, add as the first entry of `urlpatterns`:

```python
    path('me/', views.MeView.as_view()),
```

- [ ] **Step 5: Remove the password from the serializer**

In `backend/evamed-api/projects_api/serializers.py`, replace the `Meta` of `UserPlatformSerializer` (including its `extra_kwargs` and comment) with:

```python
    class Meta:
        model = models.UserPlatform
        # Passwords live in Firebase only; never accept or return one here.
        fields = ('id', 'name', 'email', 'institution', 'sector', 'country')
```

and delete the line `            password = validated_data.get('password', ''),` from its `create()`.

- [ ] **Step 6: Drop the column**

`backend/evamed-api/projects_api/migrations/0083_remove_userplatform_password.py`:

```python
# UserPlatform.password held plaintext Firebase passwords. Dropping it is
# deliberate and irreversible.
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0082_ecoinvent_usage_report'),
    ]

    operations = [
        migrations.RemoveField(model_name='userplatform', name='password'),
    ]
```

Then delete the field from the model: remove `password = models.CharField(max_length=255, null=True)` from `class UserPlatform` in `projects_api/models.py`. Check for drift:

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py makemigrations --check --dry-run
```

Expected: `No changes detected`.

- [ ] **Step 7: Run the new tests, then the whole suite**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test projects_api.tests_users -v 2
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test
```

Expected: `Ran 9 tests ... OK`; full suite OK.

- [ ] **Step 8: Commit**

```bash
git add backend/evamed-api/projects_api/views.py backend/evamed-api/projects_api/urls.py backend/evamed-api/projects_api/serializers.py backend/evamed-api/projects_api/models.py backend/evamed-api/projects_api/migrations/0083_remove_userplatform_password.py backend/evamed-api/projects_api/tests_users.py
git commit -m "fix(api): users-platform is self-only and drops stored passwords; add /me"
```

---

### Task 5: `grant_admin` command; remove `/api-profiles/`

**Files:**
- Create: `backend/evamed-api/profiles_api/management/__init__.py` (empty), `backend/evamed-api/profiles_api/management/commands/__init__.py` (empty), `backend/evamed-api/profiles_api/management/commands/grant_admin.py`
- Create: `backend/evamed-api/profiles_api/tests_grant_admin.py`
- Modify: `backend/evamed-api/profiles_project/urls.py`
- Delete: `backend/evamed-api/profiles_api/urls.py`, `views.py`, `serializers.py`, `permissions.py`

**Interfaces:**
- Produces: `python manage.py grant_admin <email> [--revoke]`. It creates a `UserProfile` (lower-cased email, unusable password) if needed and sets or clears `is_staff`.

- [ ] **Step 1: Write the failing tests**

`backend/evamed-api/profiles_api/tests_grant_admin.py`:

```python
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from profiles_api.models import UserProfile


class GrantAdminTests(TestCase):

    def run_command(self, *args):
        out = StringIO()
        call_command('grant_admin', *args, stdout=out)
        return out.getvalue()

    def test_creates_staff_profile_with_unusable_password(self):
        self.assertIn('granted', self.run_command('Boss@Example.com'))
        profile = UserProfile.objects.get(email='boss@example.com')
        self.assertTrue(profile.is_staff)
        self.assertFalse(profile.has_usable_password())

    def test_promotes_existing_profile(self):
        UserProfile.objects.create_user(email='boss@example.com', name='Boss')
        self.run_command('boss@example.com')
        self.assertEqual(UserProfile.objects.filter(email__iexact='boss@example.com').count(), 1)
        self.assertTrue(UserProfile.objects.get(email='boss@example.com').is_staff)

    def test_revoke(self):
        self.run_command('boss@example.com')
        self.assertIn('revoked', self.run_command('boss@example.com', '--revoke'))
        self.assertFalse(UserProfile.objects.get(email='boss@example.com').is_staff)


class ProfilesApiRemovedTests(TestCase):

    def test_api_profiles_is_gone(self):
        for path in ('/api-profiles/login/', '/api-profiles/profile/', '/api-profiles/hello-view/'):
            with self.subTest(path=path):
                self.assertEqual(APIClient().get(path).status_code, 404)
```

- [ ] **Step 2: Run to verify failure**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test profiles_api.tests_grant_admin -v 2
```

Expected: `CommandError: Unknown command: 'grant_admin'`, and the `/api-profiles/` paths are not 404.

- [ ] **Step 3: Create the command**

```bash
mkdir -p backend/evamed-api/profiles_api/management/commands
touch backend/evamed-api/profiles_api/management/__init__.py backend/evamed-api/profiles_api/management/commands/__init__.py
```

`backend/evamed-api/profiles_api/management/commands/grant_admin.py`:

```python
"""Grant or revoke EVAmed admin rights (catalogue editing) for an email.

The person signs in with Firebase as usual. FirebaseAuthentication maps a
*verified* token email to this UserProfile, whose is_staff makes them admin.
"""
from django.core.management.base import BaseCommand

from profiles_api.models import UserProfile


class Command(BaseCommand):
    help = 'Grant (or --revoke) admin rights for the Firebase account with this email.'

    def add_arguments(self, parser):
        parser.add_argument('email')
        parser.add_argument('--revoke', action='store_true')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        profile = UserProfile.objects.filter(email__iexact=email).first()

        if options['revoke']:
            if profile is not None:
                profile.is_staff = False
                profile.save(update_fields=['is_staff'])
            self.stdout.write('revoked admin: %s' % email)
            return

        if profile is None:
            profile = UserProfile(email=email, name=email.split('@')[0])
            profile.set_unusable_password()
        profile.is_staff = True
        profile.save()
        self.stdout.write('granted admin: %s' % email)
```

- [ ] **Step 4: Remove `/api-profiles/`**

In `backend/evamed-api/profiles_project/urls.py`, delete the line `    path('api-profiles/', include('profiles_api.urls')),`. Then:

```bash
git rm backend/evamed-api/profiles_api/urls.py backend/evamed-api/profiles_api/views.py \
  backend/evamed-api/profiles_api/serializers.py backend/evamed-api/profiles_api/permissions.py
grep -rn "profiles_api\.\(views\|serializers\|permissions\|urls\)\|from profiles_api import \(views\|serializers\|permissions\)" backend/evamed-api --include=*.py
```

The `grep` prints `projects_api/views.py:14:from profiles_api import permissions`. Delete that line; nothing in `projects_api/views.py` uses it (`grep -n "permissions\." backend/evamed-api/projects_api/views.py` → no output), and it would now fail to import. Re-run the `grep`; it must print nothing.

- [ ] **Step 5: Run the new tests, then the whole suite**

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test profiles_api.tests_grant_admin -v 2
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py check
```

Expected: `Ran 4 tests ... OK`; full suite OK; `System check identified no issues`.

- [ ] **Step 6: Commit**

```bash
git add -A backend/evamed-api/profiles_api backend/evamed-api/profiles_project/urls.py backend/evamed-api/projects_api/views.py
git commit -m "feat(api): grant_admin command; remove unused api-profiles endpoints"
```

---

### Task 6: Frontend — send tokens reliably, stop sending passwords, server-driven admin button

**Files:**
- Modify: `frontend/evamed/src/app/core/interceptors/auth.interceptor.ts`
- Modify: `frontend/evamed/src/app/core/services/auth.service.ts`
- Modify: `frontend/evamed/src/app/core/services/user/user.service.ts`
- Modify: every `frontend/evamed/src/environments/environment*.ts`
- Modify: `frontend/evamed/src/app/auth/components/register/register.component.ts`
- Modify: `frontend/evamed/src/app/auth/components/complete-profile/complete-profile.component.ts`
- Modify: `frontend/evamed/src/app/home-evamed/components/home-evamed/home-evamed.component.ts` and `.html`

**Interfaces:**
- Consumes: `GET /api-projects/me/` → `{email, is_admin, email_verified}` (Task 4). `POST users-platform/` now needs a token, and the email must match (Task 4).
- Produces: `environment.api_me`; `UserService.getMe()`; `AuthService.deleteCurrentUser(): Promise<void>`.

- [ ] **Step 1: Interceptor waits for Firebase to restore the session**

Replace the `intercept` method in `auth.interceptor.ts` with:

```ts
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Wait for Firebase to restore a persisted session. Otherwise requests fired
    // during start-up (e.g. home-evamed's constructor) go out without a token
    // and the API answers 401.
    return from(this.auth.authStateReady()).pipe(
      switchMap(() => {
        const user = this.auth.currentUser;
        if (!user) {
          return next.handle(req);
        }
        return from(user.getIdToken()).pipe(
          switchMap(token =>
            next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
          )
        );
      })
    );
  }
```

- [ ] **Step 2: `api_me` in every environment file**

```bash
cd /home/maikolkali/evamed-monorepo/frontend/evamed/src/environments
for f in environment*.ts; do
  sed -i "s#^ dbMaterial = '/database-material/';# dbMaterial = '/database-material/',\n me = '/me/';#" "$f"
  sed -i 's#^  api_db_material: `${apiEvamed}${dbMaterial}`,#&\n  api_me: `${apiEvamed}${me}`,#' "$f"
done
grep -c "me = '/me/'\|api_me:" environment*.ts
```

Expected: every file reports `2`.

- [ ] **Step 3: `UserService.getMe()`**

Add to `user.service.ts` inside the class:

```ts
  getMe() {
    return this.http.get<{ email: string; is_admin: boolean; email_verified: boolean }>(
      environment.api_me
    );
  }
```

- [ ] **Step 4: `AuthService.deleteCurrentUser()`**

In `auth.service.ts`, add `deleteUser` to the `@angular/fire/auth` import list, and add this method to the class:

```ts
  // Undo a half-finished registration so the email isn't left "already in use".
  deleteCurrentUser(): Promise<void> {
    return this.auth.currentUser ? deleteUser(this.auth.currentUser) : Promise.resolve();
  }
```

- [ ] **Step 5: Register creates the Firebase account first and never sends the password to the API**

In `register.component.ts`, add `import { lastValueFrom } from 'rxjs';` and replace the whole `register(event: Event) { ... }` method (up to `private buildForm()`) with:

```ts
  register(event: Event) {
    event.preventDefault();
    if (!this.form.valid) {
      return;
    }
    const value = this.form.value;
    if (value.password !== value.password2) {
      this.snackBar.open('Las contraseñas deben coincidir', 'OK', { duration: 4000 });
      return;
    }

    // Firebase first: the API only accepts a profile from the signed-in owner
    // of that email. The password goes to Firebase only, never to our API.
    this.authService
      .createUser(value.email, value.password)
      .then(async () => {
        try {
          await lastValueFrom(this.user.addUser({
            name: value.name,
            email: value.email,
            institution: value.institution,
            sector: value.sector,
            country: value.country,
          }));
        } catch (error) {
          await this.authService.deleteCurrentUser();
          throw error;
        }
        this.authService.verifyEmail();
        this.snackBar.open('Registro correcto', 'OK', { duration: 4000 });
        this.router.navigate(['/auth/login']);
      })
      .catch(error => {
        const message = error?.code === 'auth/email-already-in-use'
          ? 'El correo ya está registrado, usa otro correo'
          : 'Error al registrar el usuario. Intenta nuevamente.';
        this.snackBar.open(message, 'OK', { duration: 4000 });
      });
  }
```

- [ ] **Step 6: Complete-profile stops sending an empty password**

In `complete-profile.component.ts`, delete these two lines from the `addUser({...})` object:

```ts
          // Google handles auth; the backend record keeps a nullable password.
          password: '',
```

- [ ] **Step 7: Admin button comes from the server**

In `home-evamed.component.ts`, add the property `isAdmin = false;` next to `email: string;` (line ~71). In `ngOnInit`, directly after `localStorage.setItem('email-id', userData[0].id);`, add:

```ts
    // Admin rights are decided by the API (grant_admin), not by the UI.
    const me = await lastValueFrom(this.users.getMe()).catch(() => null);
    this.isAdmin = me?.is_admin === true;
```

In `home-evamed.component.html`, replace

```html
      <mat-card-actions *ngIf="email === 'arqarvizup@gmail.com'">
```

with

```html
      <mat-card-actions *ngIf="isAdmin">
```

Check nothing else hardcodes the admin: `grep -rn "arqarvizup" frontend/evamed/src` → no output.

- [ ] **Step 8: Compile**

```bash
cd /home/maikolkali/evamed-monorepo
docker compose build web
```

Expected: build succeeds (no TypeScript errors).

- [ ] **Step 9: End-to-end check against the local stack**

```bash
docker compose up -d --build
docker compose exec api python manage.py grant_admin <your-google-email>
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api-projects/units/ -H 'Content-Type: application/json' -d '{"name_unit":"x"}'   # 401
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api-projects/projects/      # 401
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api-projects/countries/     # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api-profiles/login/        # 404
```

In a browser at `http://localhost:8080`:
1. Sign in with Google as `<your-google-email>`. Your projects load, the **Administrador** button shows, and an admin page can create and delete a test unit.
2. Hard-refresh the home page. DevTools → Network shows no `401`s during start-up (this checks the interceptor fix).
3. In a private window, register a new email/password account. It succeeds; the `users-platform/` request in DevTools has an `Authorization` header and **no `password`** in the payload; no Administrador button appears; you see no other users' projects.
4. As that new user, try the admin page directly (`/admin-units`) and try to add a unit. The request fails with `403`.

- [ ] **Step 10: Commit**

```bash
git add frontend/evamed/src
git commit -m "fix(frontend): wait for auth before API calls, keep passwords out of the API, admin flag from /me"
```

---

### Task 7: Rollout

**Files:** none

- [ ] **Step 1: Pre-flight on the live database (read-only)**

Run against the production DB (Render shell for `evamed-api`, or `psql` with the external connection string):

```bash
python manage.py shell -c "
from projects_api.models import Project, UserPlatform
from django.db.models import Count
print('projects without owner:', Project.objects.filter(user_platform_id__isnull=True).count())
print('duplicate profile emails:', UserPlatform.objects.values('email').annotate(n=Count('id')).filter(n__gt=1).count())
print('profiles with stored passwords:', UserPlatform.objects.exclude(password__isnull=True).exclude(password='').count())
print('profile emails with surrounding whitespace:', UserPlatform.objects.filter(email__regex=r'^\s|\s$').count())
"
```

Then count Firebase accounts that will lose access to their projects (needs `FIREBASE_CREDENTIALS_JSON`, as the API has):

```bash
python manage.py shell -c "
from firebase_admin import auth
from profiles_api.authentication import _get_firebase_app
from projects_api.models import Project
owners = {e.strip().lower() for e in Project.objects.values_list('user_platform_id__email', flat=True) if e}
unverified = [u.email for u in auth.list_users(app=_get_firebase_app()).iterate_all()
              if u.email and not u.email_verified and u.email.strip().lower() in owners]
print('unverified Firebase accounts that own projects:', len(unverified))
"
```

Record the numbers. After rollout, ownerless projects become invisible to everyone (they are only reachable in Django admin). Duplicate emails are harmless, because both rows count as the same owner. The third number is the size of the password exposure for decision 1. Emails with leading/trailing whitespace won't match any token email, so those users lose their projects until the rows are trimmed. The unverified owners lose access to their projects until they verify; consider emailing them first.

- [ ] **Step 2: Take a backup** of the production DB with `pg_dump -Fc` (Render's free tier has no dashboard backups). Migration `0083` deletes the password column irreversibly. This backup contains the plaintext passwords, so delete it once the deploy is verified.

- [ ] **Step 3: Resolve the "Needs your decision" items** (password-exposure response, admin list).

- [ ] **Step 4: Deploy the frontend first, then the backend.**
  1. Frontend: it works against the old backend (the admin button stays hidden until the backend's `/me/` exists).
  2. Backend + migration `0083`, once the frontend is live.

  Rollback: run `python manage.py migrate projects_api 0082` before redeploying the old backend code. That re-adds the `password` column empty; the data doesn't come back.

- [ ] **Step 5: Grant admins on each environment**

```bash
# Render: shell for evamed-api    |  local: docker compose exec api ...  |  AWS dev: bash /opt/evamed/src/deploy/dc.sh exec api ...
python manage.py grant_admin arqarvizup@gmail.com
```

That account must sign in with a **verified** email (Google sign-in qualifies; an email/password account must click its verification link first).

- [ ] **Step 6: Smoke-test production:** repeat the four `curl` checks from Task 6 Step 9 against the Render API URL, plus browser checks 1–3 with a real account.
