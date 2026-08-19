# Auth Process Map & Fix Plan

## Context

EVAMED is an Angular + Firebase Auth + Django REST Framework app. The auth layer has accumulated significant technical debt: a disconnected dual-auth system, dead code with a hardcoded private IP, no HTTP interceptor sending tokens to the backend (meaning all Django API calls are unauthenticated), commented-out email verification, and `alert()` calls for all user feedback. This plan fixes bugs, seals the security holes, and improves UX.

---

## Current Auth Flow (As-Is)

```
User submits login form
       │
       ▼
LoginComponent.login()
       │
       ├─→ AuthService.login()  ──→  Firebase signInWithEmailAndPassword()
       │         │                         │
       │         │                   Firebase JWT stored in browser
       │         │                         │
       │         └─── .then() ──────→ localStorage.setItem('email-login', email)
       │                              Router.navigate(['/'])
       │
       └─→ AdminGuard.canActivate()
                  │
                  └─→ AuthService.hasUser()  ──→  authState(Firebase)
                            │
                      user != null? → allow
                      user == null? → redirect /auth/login


Register flow:
  RegisterComponent.register()
    ├─→ UserService.addUser()  ──→  POST /api-projects/users-platform/ (NO auth, no error handling)
    └─→ AuthService.createUser()  ──→  Firebase createUserWithEmailAndPassword()
              └─→ .then()  ──→  AuthService.verifyEmail()  ──→  sendEmailVerification()
                                alert('Registro correcto')

DEAD CODE (never called anywhere):
  AuthService.loginCoreEVAMED()  ──→  POST http://10.2.102.118:8000/api-profiles/login/
                                          (hardcoded private IP)
            └─→ TokenService.saveToken()  ──→  localStorage.setItem('token', ...)
                  (token never retrieved, never attached to HTTP requests)
```

---

## Issues Found

### Bugs
| # | Issue | Location |
|---|-------|----------|
| 1 | `loginCoreEVAMED()` hardcodes private IP `10.2.102.118`, is never called — dead code | `auth.service.ts:55-67` |
| 2 | `isEmailVerified()` calls `this.auth.currentUser.emailVerified` — crashes if no user (null) | `auth.service.ts:49` |
| 3 | Email verification check is commented out in login; users enter without verified email | `login.component.ts:31-39` |
| 4 | `register()` subscribes to `addUser` with empty callback — Django errors silently swallowed; Firebase `createUser` runs even if Django write failed | `register.component.ts:40-56` |
| 5 | `AdminGuard` has `CanActivate` import and interface commented out | `admin.guard.ts:3,13` |
| 6 | `localStorage.setItem('email-login')` set on login but never cleared on logout | `login.component.ts:33` |

### Security Issues
| # | Issue | Location |
|---|-------|----------|
| 7 | **No HTTP interceptor** — Firebase ID token is never attached to outgoing API requests; all Django endpoints receive unauthenticated calls | (missing) |
| 8 | `UserPlatformViewSet` has no `authentication_classes` or `permission_classes` — open to public | `projects_api/views.py:16-21` |
| 9 | `UserProfileViewSet` has `UpdateOwnProfile` permission but no `IsAuthenticated` — unauthenticated reads allowed | `profiles_api/views.py:103-109` |
| 10 | `TokenService` saves a DRF token that is never used — misleads future devs into thinking there's token auth | `token.service.ts` |

### UX Issues
| # | Issue | Location |
|---|-------|----------|
| 11 | All user feedback uses `alert()` — login errors, register success/fail, password reset | `login.component.ts`, `register.component.ts`, `recover-password.component.ts` |
| 12 | Password field has `Validators.required` only — no min length or complexity | form builders in all three components |
| 13 | Email field on login has `Validators.required` but no `Validators.email` pattern | `login.component.ts:49` |

---

## Fix Plan (To-Do)

### 1. Remove Dead Code
**Files:** `auth.service.ts`, `token.service.ts`

- Delete `loginCoreEVAMED()` from `AuthService` (the method with the hardcoded IP).
- Delete `TokenService` entirely — it saves a token that is never read.
- Remove `TokenService` from `AuthService` constructor injection.

### 2. Fix `isEmailVerified()` Null Safety
**File:** `auth.service.ts:49`

```ts
// Before
isEmailVerified() {
  return this.auth.currentUser.emailVerified;
}

// After
isEmailVerified() {
  return this.auth.currentUser?.emailVerified ?? false;
}
```

### 3. Add Firebase Auth HTTP Interceptor
**New file:** `frontend/evamed/src/app/core/interceptors/auth.interceptor.ts`

This is the most impactful security fix. Create a `HttpInterceptor` that:
1. Gets the Firebase ID token from `Auth.currentUser.getIdToken()`
2. Clones the request with `Authorization: Bearer <token>` header
3. Skips unauthenticated routes (the Firebase endpoints themselves)

Register it in `app.module.ts` via `HTTP_INTERCEPTORS`.

```ts
// Pattern:
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
  const user = this.auth.currentUser;
  if (!user) return next.handle(req);
  return from(user.getIdToken()).pipe(
    switchMap(token => {
      const authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
      return next.handle(authReq);
    })
  );
}
```

### 4. Secure Django APIs
**Files:** `backend/evamed-api/projects_api/views.py`, `backend/evamed-api/profiles_api/views.py`

Add `authentication_classes` and `permission_classes` to the open viewsets:

```python
# projects_api/views.py - UserPlatformViewSet
authentication_classes = (TokenAuthentication,)
permission_classes = (IsAuthenticated,)
```

> **Note:** Since the frontend will now send Firebase tokens (JWTs), the backend needs a Firebase JWT verification middleware OR the DRF token auth needs to be replaced with Firebase Admin SDK verification. The simplest bridge without refactoring the backend is to use `djangorestframework-simplejwt` or `drf-firebase-auth`. Alternatively, keep DRF token auth and add a one-time "exchange" endpoint where the frontend POSTs a Firebase ID token and receives a DRF token back. This plan recommends the exchange endpoint approach as the minimal change.

### 5. Fix the AdminGuard
**File:** `frontend/evamed/src/app/admin.guard.ts`

Restore the `CanActivate` interface:
```ts
import { CanActivate, ... } from '@angular/router';
export class AdminGuard implements CanActivate {
```

### 6. Fix Register Flow
**File:** `register.component.ts`

- Pipe `addUser` error — if Django user creation fails, do not call Firebase `createUser`.
- Clean up `localStorage.setItem('email-login')` pattern; use a single source of truth from Firebase auth state.

```ts
// Correct sequence:
this.user.addUser(value).subscribe({
  next: () => {
    this.authService.createUser(value.email, value.password)
      .then(() => { /* success */ })
      .catch(() => { /* Firebase error */ });
  },
  error: () => { /* Django error - don't proceed */ }
});
```

### 7. Replace `alert()` with MatSnackBar
**Files:** `login.component.ts`, `register.component.ts`, `recover-password.component.ts`

Inject `MatSnackBar` and replace all `alert(...)` calls with `this.snackBar.open(message, 'OK', { duration: 4000 })`. `MatSnackBarModule` is already available via `MaterialModule`.

### 8. Improve Form Validation
**Files:** All three component `.ts` form builders

Add validators:
- Email: `Validators.email`
- Password: `Validators.minLength(8)`

No template changes needed — the submit button is already disabled on `form.invalid`.

### 9. Clean Up `localStorage.setItem('email-login')`
**Files:** `login.component.ts`, `auth.service.ts`

Remove the manual email storage in `login.component.ts:33`. Add email cleanup in `AuthService.logout()`:
```ts
logout() {
  localStorage.removeItem('email-login');
  return signOut(this.auth);
}
```

---

## Dependency Order

```
Step 1 (remove dead code)
    └─→ Step 2 (null safety) — independent, safe to do together
    
Step 3 (HTTP interceptor) — depends on nothing, but Step 4 depends on it
    └─→ Step 4 (secure Django APIs)
    
Step 5 (AdminGuard) — independent
Step 6 (fix register) — independent
Step 7 (replace alerts) — independent
Step 8 (form validators) — independent
Step 9 (localStorage cleanup) — independent
```

Steps 1, 2, 5, 6, 7, 8, 9 are all self-contained frontend changes.
Steps 3 + 4 are the critical security pair (interceptor + backend auth).

---

## Critical Files

| File | Change |
|------|--------|
| `frontend/.../core/services/auth.service.ts` | Remove `loginCoreEVAMED`, fix null in `isEmailVerified`, remove `TokenService` dep, clean logout |
| `frontend/.../core/services/token.service.ts` | **Delete** |
| `frontend/.../core/interceptors/auth.interceptor.ts` | **Create new** |
| `frontend/.../app/app.module.ts` | Register interceptor |
| `frontend/.../auth/components/login/login.component.ts` | Replace alert, add email validator, remove localStorage |
| `frontend/.../auth/components/register/register.component.ts` | Fix register sequence, replace alerts, add validators |
| `frontend/.../auth/components/recover-password/.../recover-password.component.ts` | Replace alert |
| `frontend/.../app/admin.guard.ts` | Restore CanActivate interface |
| `backend/.../projects_api/views.py` | Add auth to `UserPlatformViewSet` |
| `backend/.../profiles_api/views.py` | Add `IsAuthenticated` to `UserProfileViewSet` |

---

## Verification

1. **Login flow**: Log in with a valid account → should navigate to home; log in with bad credentials → MatSnackBar error (not alert).
2. **Guard**: Navigate directly to `/home-evamed` without being logged in → redirects to `/auth/login`.
3. **Register flow**: Register a new user → verify Django user is created first, then Firebase; if email already exists in Firebase, Django record should not be duplicated.
4. **API auth**: Open browser network tab, make any app API call → confirm `Authorization: Bearer <token>` header is present.
5. **Logout**: Call logout → `email-login` key removed from localStorage, Firebase session cleared.
6. **Form validation**: Try to submit login with invalid email format → submit button disabled. 