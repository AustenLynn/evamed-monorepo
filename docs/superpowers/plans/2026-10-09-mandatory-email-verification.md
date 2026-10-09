# Mandatory Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user with an unverified email can't use any platform page. They land on `/auth/verify-email` until they click the link Firebase emailed them.

**Architecture:**
- **`AdminGuard`,** which protects every platform route, also requires `emailVerified`. Before redirecting, it re-checks once, so a verification made in another tab counts.
- **A new `VerifyEmailComponent`** in the auth module lets the user resend the email, confirm ("Ya verifiqué mi correo"), or sign out.
- **Two `AuthService` helpers** make sure the ID token says `email_verified=true` once the user is verified.
- **Sign-up** sends new users to the new page.
- **The old in-app banner** is removed.

**Tech Stack:** Angular 22 (NgModule components, `standalone: false`), Firebase Auth JS SDK v12 (`firebase/auth`), RxJS, Vitest via `ng test`.

**Spec:** `docs/superpowers/specs/2026-10-09-mandatory-email-verification-design.md`

## Global Constraints

- **Route:** `/auth/verify-email`, inside the existing lazy `AuthModule`. **`/auth/*` stays unguarded,** because social users finish `/auth/complete-profile` before verifying.
- **Guard outcomes:**
  - no user → `UrlTree` `/auth/login`;
  - unverified after one re-check → `UrlTree` `/auth/verify-email`;
  - verified → `true`.
  - The guard never throws: a failed re-check counts as unverified, and a failed token refresh still lets a verified user in.
- **Spanish UI copy, exactly:**
  - title: `Verifica tu correo electrónico`;
  - body: `Te enviamos un enlace de verificación a {{ email }}. Ábrelo para activar tu cuenta y vuelve aquí. Revisa también tu carpeta de correo no deseado.`;
  - button: `Ya verifiqué mi correo`;
  - pending: `Aún no vemos la verificación. Abre el enlace del correo e inténtalo de nuevo.`;
  - links: `Reenviar correo`, `Cerrar sesión`;
  - resend snackbars (the banner's, unchanged): `Te enviamos un nuevo correo de verificación.` / `No se pudo enviar el correo. Intenta nuevamente.`;
  - failed check: `No pudimos comprobar la verificación. Intenta nuevamente.`
  - All snackbars are `('…', 'OK', { duration: 4000 })`.
- **No page reload after verification.** `AuthInterceptor` calls `user.getIdToken()` per request, so a forced refresh (`getIdToken(true)`) is enough.
- **No backend change.** The API already trusts only verified emails.
- **Don't rename `AdminGuard`** (out of scope).
- **Commands run from `frontend/evamed`** (local Node 22.22.0 is below Angular's minimum):
  - one spec: `npx -y -p node@22 -- npx ng test --watch=false --include <path>`;
  - all: `npx -y -p node@22 -- npm test -- --watch=false`;
  - build: `npx -y -p node@22 -- npm run build -- --configuration production`.

## Review Focus

- **A user verifies in another tab, then opens a platform page here.** They must get in without pressing anything, because the guard re-checks. Tested in Task 2.
- **Offline (or Firebase unreachable) while the guard or page checks.** The user must see the verify page or a message, never a broken navigation. Tested in Tasks 2 and 3.
- **The token minted before verification** (`email_verified=false`, valid up to an hour). After verification the API must see the user as verified at once, so the token is force-refreshed. Tested in Task 1, and in Task 2 for the verified path.
- **A social user with no profile and an unverified email** must still reach `/auth/complete-profile`. Tested in Task 2: the `auth` route stays unguarded.
- **Pressing "Ya verifiqué mi correo" repeatedly while a check runs** must not start overlapping checks. Tested in Task 3.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `src/app/core/services/auth.service.ts` | Modify | `ensureVerifiedToken()`, `refreshVerification()` |
| `src/app/core/services/auth.service.spec.ts` | Modify | Tests for those |
| `src/app/admin.guard.ts` | Modify | Signed in **and** verified |
| `src/app/admin.guard.spec.ts` | Create | Guard tests, and a check that `/auth` stays unguarded |
| `src/app/auth/components/verify-email/verify-email.component.ts` / `.html` / `.spec.ts` | Create | The page |
| `src/app/auth/auth.module.ts`, `auth-routing.module.ts` | Modify | Declare and route it |
| `src/app/auth/components/register/register.component.ts` | Modify | Sign-up goes to `/auth/verify-email` |
| `src/app/auth/components/register/register.component.spec.ts` | Create | That redirect |
| `src/app/shared/components/email-verification-banner/*` | Delete | Unreachable now |
| `src/app/shared/shared.module.ts`, `src/app/layout/layout.component.html` | Modify | Drop the banner |

All paths are under `frontend/evamed/`.

---

### Task 1: AuthService verification helpers

**Files:**
- Modify: `frontend/evamed/src/app/core/services/auth.service.ts`
- Modify: `frontend/evamed/src/app/core/services/auth.service.spec.ts`

**Interfaces:**
- Produces, on `AuthService`:
  - `ensureVerifiedToken(): Promise<void>`: if the current user is verified but their ID token's `email_verified` claim isn't `true`, it forces a refresh. Otherwise it does nothing.
  - `refreshVerification(): Promise<boolean>`: reloads the current user from Firebase. Returns `false` if nobody is signed in or they're still unverified. If verified, it calls `ensureVerifiedToken()` and returns `true`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/evamed/src/app/core/services/auth.service.spec.ts`:

```typescript
// Firebase keeps the ID token it issued before verification (email_verified
// false) for up to an hour, and the API trusts only the token.
describe('AuthService verification helpers', () => {
  const build = (user: unknown) => {
    TestBed.configureTestingModule({
      providers: [{ provide: FIREBASE_AUTH, useValue: { currentUser: user } }],
    });
    return TestBed.inject(AuthService);
  };

  const fakeUser = (opts: { verifiedAfterReload: boolean; tokenSaysVerified: boolean }) => {
    const user: any = {
      emailVerified: false,
      reload: vi.fn(async () => {
        user.emailVerified = opts.verifiedAfterReload;
      }),
      getIdTokenResult: vi.fn(async () => ({ claims: { email_verified: opts.tokenSaysVerified } })),
      getIdToken: vi.fn(async () => 'fresh-token'),
    };
    return user;
  };

  it('refreshVerification sees a verification made in another tab and refreshes the stale token', async () => {
    const user = fakeUser({ verifiedAfterReload: true, tokenSaysVerified: false });

    expect(await build(user).refreshVerification()).toBe(true);
    expect(user.reload).toHaveBeenCalled();
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });

  it('refreshVerification reports a still-unverified user and leaves the token alone', async () => {
    const user = fakeUser({ verifiedAfterReload: false, tokenSaysVerified: false });

    expect(await build(user).refreshVerification()).toBe(false);
    expect(user.getIdToken).not.toHaveBeenCalled();
  });

  it('refreshVerification is false when nobody is signed in', async () => {
    expect(await build(null).refreshVerification()).toBe(false);
  });

  it('ensureVerifiedToken leaves a token that already says verified alone', async () => {
    const user = fakeUser({ verifiedAfterReload: true, tokenSaysVerified: true });
    user.emailVerified = true;

    await build(user).ensureVerifiedToken();

    expect(user.getIdToken).not.toHaveBeenCalled();
  });

  it('ensureVerifiedToken does nothing for an unverified user', async () => {
    const user = fakeUser({ verifiedAfterReload: false, tokenSaysVerified: false });

    await build(user).ensureVerifiedToken();

    expect(user.getIdTokenResult).not.toHaveBeenCalled();
    expect(user.getIdToken).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/core/services/auth.service.spec.ts`. Expected: a compile error, `Property 'refreshVerification' does not exist on type 'AuthService'` (and the same for `ensureVerifiedToken`).

- [ ] **Step 3: Implement**

In `auth.service.ts`, add after `isEmailVerified()`:

```typescript
  /**
   * Firebase keeps the ID token it issued before verification
   * (email_verified=false) for up to an hour, and the API trusts only the
   * token. Once the user is verified, make sure the token says so too.
   */
  async ensureVerifiedToken(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user?.emailVerified) {
      return;
    }
    const { claims } = await user.getIdTokenResult();
    if (claims['email_verified'] !== true) {
      await user.getIdToken(true);
    }
  }

  /**
   * Re-reads the signed-in user from Firebase, which picks up a click on the
   * verification link in another tab. True once verified (with a fresh token).
   */
  async refreshVerification(): Promise<boolean> {
    if (!this.auth.currentUser) {
      return false;
    }
    await this.auth.currentUser.reload();
    if (!this.auth.currentUser?.emailVerified) {
      return false;
    }
    await this.ensureVerifiedToken();
    return true;
  }
```

- [ ] **Step 4: Run to verify they pass**

Run the Step 2 command. Expected: all tests in the file pass (the existing `hasUser` test and the 5 new ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/core/services/auth.service.ts frontend/evamed/src/app/core/services/auth.service.spec.ts
git commit -m "feat(auth): helpers to confirm verification and refresh a stale token

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The guard requires a verified email

**Files:**
- Modify: `frontend/evamed/src/app/admin.guard.ts`
- Create: `frontend/evamed/src/app/admin.guard.spec.ts`

**Interfaces:**
- Consumes, from Task 1: `AuthService.refreshVerification(): Promise<boolean>` and `AuthService.ensureVerifiedToken(): Promise<void>`, plus the existing `hasUser(): Observable<User | null>`.
- Produces: `AdminGuard.canActivate(next, state): Observable<boolean | UrlTree>`, emitting `true`, `/auth/login` or `/auth/verify-email`.

- [ ] **Step 1: Write the failing tests**

`frontend/evamed/src/app/admin.guard.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';

import { AdminGuard } from './admin.guard';
// Compile LayoutComponent (referenced by the app routes) in its NgModule's context.
import './app.module';
import { AppRoutingModule } from './app-routing.module';
import { AuthService } from './core/services/auth.service';

// AdminGuard protects every platform route (not only admin pages): the user
// must be signed in and have verified their email.
describe('AdminGuard', () => {
  const run = (user: unknown, overrides: Record<string, unknown> = {}) => {
    const auth = {
      hasUser: () => of(user),
      refreshVerification: vi.fn(async () => false),
      ensureVerifiedToken: vi.fn(async () => undefined),
      ...overrides,
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const result = TestBed.inject(AdminGuard).canActivate(null as any, null as any) as Observable<boolean | UrlTree>;
    return { auth, outcome: firstValueFrom(result) };
  };
  const target = (outcome: boolean | UrlTree) =>
    outcome instanceof UrlTree ? TestBed.inject(Router).serializeUrl(outcome) : outcome;

  it('sends a signed-out visitor to the login page', async () => {
    expect(target(await run(null).outcome)).toBe('/auth/login');
  });

  it('lets a verified user in and makes sure their token says so', async () => {
    const { auth, outcome } = run({ emailVerified: true });

    expect(await outcome).toBe(true);
    expect(auth.ensureVerifiedToken).toHaveBeenCalled();
  });

  it('sends an unverified user to the verify page', async () => {
    expect(target(await run({ emailVerified: false }).outcome)).toBe('/auth/verify-email');
  });

  it('lets in a user who has just verified in another tab', async () => {
    const { outcome } = run({ emailVerified: false }, { refreshVerification: vi.fn(async () => true) });

    expect(await outcome).toBe(true);
  });

  it('sends the user to the verify page when the check itself fails (offline)', async () => {
    const { outcome } = run(
      { emailVerified: false },
      { refreshVerification: vi.fn(async () => { throw new Error('auth/network-request-failed'); }) }
    );

    expect(target(await outcome)).toBe('/auth/verify-email');
  });

  it('still lets a verified user in when the token refresh fails', async () => {
    const { outcome } = run(
      { emailVerified: true },
      { ensureVerifiedToken: vi.fn(async () => { throw new Error('auth/network-request-failed'); }) }
    );

    expect(await outcome).toBe(true);
  });
});

// Social users finish /auth/complete-profile before verifying, and the verify
// page itself lives under /auth: that branch must never be guarded.
describe('app routes', () => {
  it('leave /auth unguarded', () => {
    TestBed.configureTestingModule({ imports: [AppRoutingModule] });
    const auth = TestBed.inject(Router).config.find(route => route.path === 'auth');

    expect(auth).toBeDefined();
    expect(auth?.canActivate ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/admin.guard.spec.ts`. Expected:
- **"sends a signed-out visitor"** fails: the old guard emits `false` and navigates, instead of returning a `UrlTree`, so `target` gets `false`.
- **"sends an unverified user"** fails: the old guard lets them in with `true`.
- **"lets a verified user in…"** fails: `ensureVerifiedToken` is never called.
- **The `/auth` route test** already passes. It's a guard against a future change.

- [ ] **Step 3: Implement**

Replace the whole content of `frontend/evamed/src/app/admin.guard.ts`:

```typescript
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';

import { AuthService } from './core/services/auth.service';

// Guards every platform route, not just admin pages: the user must be signed
// in and have verified their email. /auth/* stays outside it.
@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.authService.hasUser().pipe(
      take(1),
      switchMap(async user => {
        if (!user) {
          return this.router.parseUrl('/auth/login');
        }
        if (user.emailVerified) {
          // A token issued before verification still says email_verified=false.
          await this.authService.ensureVerifiedToken().catch(() => undefined);
          return true;
        }
        // They may have just clicked the link in another tab.
        const verified = await this.authService.refreshVerification().catch(() => false);
        return verified ? true : this.router.parseUrl('/auth/verify-email');
      })
    );
  }
}
```

- [ ] **Step 4: Run to verify they pass, then the full suite**

Run the Step 2 command (expected: 7 pass), then `npx -y -p node@22 -- npm test -- --watch=false` (expected: all green).

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/admin.guard.ts frontend/evamed/src/app/admin.guard.spec.ts
git commit -m "feat(auth): platform routes require a verified email

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The verify-email page

**Files:**
- Create: `frontend/evamed/src/app/auth/components/verify-email/verify-email.component.ts`
- Create: `frontend/evamed/src/app/auth/components/verify-email/verify-email.component.html`
- Create: `frontend/evamed/src/app/auth/components/verify-email/verify-email.component.spec.ts`
- Modify: `frontend/evamed/src/app/auth/auth.module.ts`, `frontend/evamed/src/app/auth/auth-routing.module.ts`

**Interfaces:**
- Consumes:
  - from Task 1: `AuthService.refreshVerification()`;
  - existing `AuthService.hasUser()`, `resendVerification(): Promise<void>` and `logout(): Promise<void>`.
- Produces: `VerifyEmailComponent` (selector `app-verify-email`) at route `auth/verify-email`. Its public members are:
  - `email: string | null`, `checking: boolean`, `notYetVerified: boolean`;
  - `confirm()`, `resend()`, `logout()`, `about()`, `onFocus()`.

- [ ] **Step 1: Write the failing tests**

`frontend/evamed/src/app/auth/components/verify-email/verify-email.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthModule } from '../../auth.module';
import { VerifyEmailComponent } from './verify-email.component';

describe('VerifyEmailComponent', () => {
  const unverified = { email: 'ana@example.com', emailVerified: false };

  const setup = (user: unknown, overrides: Record<string, unknown> = {}) => {
    const auth = {
      hasUser: () => of(user),
      refreshVerification: vi.fn(async () => false),
      resendVerification: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
      ...overrides,
    };
    const snackBar = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();
    return { fixture, auth, snackBar, navigate, el: fixture.nativeElement as HTMLElement };
  };

  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  const click = async (el: HTMLElement, selector: string) => {
    (el.querySelector(selector) as HTMLElement).click();
    await settle();
  };

  it('tells the user where the link was sent', () => {
    const { el } = setup(unverified);

    expect(el.textContent).toContain('Verifica tu correo electrónico');
    expect(el.textContent).toContain('ana@example.com');
  });

  it('sends a signed-out visitor to the login page', () => {
    const { navigate } = setup(null);

    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('sends an already verified user into the platform', () => {
    const { navigate } = setup({ email: 'ana@example.com', emailVerified: true });

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('continues into the platform once the check confirms the verification', async () => {
    const { el, navigate } = setup(unverified, { refreshVerification: vi.fn(async () => true) });

    await click(el, 'button.yellow-button-login');

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('says so and stays when the email is not verified yet', async () => {
    const { el, fixture, navigate } = setup(unverified);

    await click(el, 'button.yellow-button-login');
    fixture.detectChanges();

    expect(el.querySelector('.verify-pending')?.textContent).toContain('Aún no vemos la verificación');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a check that fails (offline) instead of breaking', async () => {
    const { el, snackBar, navigate } = setup(unverified, {
      refreshVerification: vi.fn(async () => { throw new Error('auth/network-request-failed'); }),
    });

    await click(el, 'button.yellow-button-login');

    expect(snackBar.open).toHaveBeenCalledWith(
      'No pudimos comprobar la verificación. Intenta nuevamente.', 'OK', { duration: 4000 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('runs one check at a time however often the button is pressed', async () => {
    let finish: (verified: boolean) => void = () => undefined;
    const refreshVerification = vi.fn(() => new Promise<boolean>(resolve => (finish = resolve)));
    const { fixture } = setup(unverified, { refreshVerification });

    fixture.componentInstance.confirm();
    fixture.componentInstance.confirm();
    fixture.componentInstance.confirm();
    finish(false);
    await settle();

    expect(refreshVerification).toHaveBeenCalledTimes(1);
  });

  it('re-checks when the tab regains focus', async () => {
    const { navigate } = setup(unverified, { refreshVerification: vi.fn(async () => true) });

    window.dispatchEvent(new Event('focus'));
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('resends the email and confirms it', async () => {
    const { el, auth, snackBar } = setup(unverified);

    await click(el, '.verify-resend');

    expect(auth.resendVerification).toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith(
      'Te enviamos un nuevo correo de verificación.', 'OK', { duration: 4000 });
  });

  it('reports a failed resend (e.g. too many requests)', async () => {
    const { el, snackBar } = setup(unverified, {
      resendVerification: vi.fn(async () => { throw new Error('auth/too-many-requests'); }),
    });

    await click(el, '.verify-resend');

    expect(snackBar.open).toHaveBeenCalledWith(
      'No se pudo enviar el correo. Intenta nuevamente.', 'OK', { duration: 4000 });
  });

  it('signs out back to the login page', async () => {
    const { el, auth, navigate } = setup(unverified);

    await click(el, '.verify-logout');

    expect(auth.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/auth/components/verify-email/verify-email.component.spec.ts`. Expected: a compile error, `Could not resolve "./verify-email.component"`.

- [ ] **Step 3: Write the component**

`frontend/evamed/src/app/auth/components/verify-email/verify-email.component.ts`:

```typescript
import { Component, HostListener, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';

// Where AdminGuard sends a signed-in user whose email isn't verified yet. They
// stay here until they click the link Firebase emailed them.
@Component({
    selector: 'app-verify-email',
    templateUrl: './verify-email.component.html',
    // Same layout as the other auth pages.
    styleUrls: ['../recover-password/recover-password/recover-password.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  email: string | null = null;
  checking = false;
  notYetVerified = false;
  private sub: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // hasUser() emits once Firebase has restored the session (also after F5).
    this.sub = this.authService.hasUser().pipe(take(1)).subscribe(user => {
      if (!user) {
        this.router.navigate(['/auth/login']);
        return;
      }
      if (user.emailVerified) {
        this.router.navigate(['/']);
        return;
      }
      this.email = user.email;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // Coming back from the verification email in another tab.
  @HostListener('window:focus')
  onFocus(): void {
    this.check(false);
  }

  confirm(): void {
    this.check(true);
  }

  private async check(reportOutcome: boolean): Promise<void> {
    if (this.checking || !this.email) {
      return;
    }
    this.checking = true;
    try {
      if (await this.authService.refreshVerification()) {
        this.router.navigate(['/']);
      } else if (reportOutcome) {
        this.notYetVerified = true;
      }
    } catch {
      if (reportOutcome) {
        this.snackBar.open('No pudimos comprobar la verificación. Intenta nuevamente.', 'OK', { duration: 4000 });
      }
    } finally {
      this.checking = false;
    }
  }

  resend(): void {
    this.authService
      .resendVerification()
      .then(() => {
        this.snackBar.open('Te enviamos un nuevo correo de verificación.', 'OK', { duration: 4000 });
      })
      .catch(() => {
        this.snackBar.open('No se pudo enviar el correo. Intenta nuevamente.', 'OK', { duration: 4000 });
      });
  }

  logout(): void {
    this.authService.logout().then(() => this.router.navigate(['/auth/login']));
  }

  about(): void {
    this.router.navigate(['/auth/about']);
  }
}
```

`frontend/evamed/src/app/auth/components/verify-email/verify-email.component.html`. The side panel and footer are copied from `recover-password.component.html`:

```html
<div class="row">
  <div class="side">
    <div class="background-custom">
      <section class="part-side">
        <div class="container-title-standard">
          <img src="./../../../../assets/relevants/Logo EVAMED Final/Logo EVAMED Final/logo_white.png" class="img-logo" alt="EVAMED logo"/>
        </div>
        <div class="context-evamed">
          <div class="title-context-login">
            Bienvenido
          </div>
          <div class="text-context">
            <strong>EVAMED</strong> es una herramienta para ayudar a los actores interesados en el sector de la
edificación, a tomar decisiones desde las primeras fases de diseño, para lograr edificios
con un menor impacto ambiental durante todo su ciclo de vida <a (click)="about()" (keypress)="about()" tabindex="1">Leer más</a>.
          </div>
        </div>
      </section>
    </div>
  </div>
  <div class="main">
    <section class="form-login">
      <div class="container-label-input">
        <div class="title-context-login">
          Verifica tu correo electrónico
        </div>
        <div class="description-context-login">
          Te enviamos un enlace de verificación a <strong>{{ email }}</strong>.
          Ábrelo para activar tu cuenta y vuelve aquí. Revisa también tu
          carpeta de correo no deseado.
        </div>
        @if (notYetVerified) {
          <div class="description-context-login verify-pending">
            Aún no vemos la verificación. Abre el enlace del correo e inténtalo de nuevo.
          </div>
        }
      </div>
      <div class="container-label-button">
        <button
          mat-raised-button
          type="button"
          class="yellow-button-login"
          [disabled]="checking"
          (click)="confirm()"
        >
          Ya verifiqué mi correo
        </button>
      </div>
      <div class="container-label-button">
        <p class="p-context-login">
          ¿No te llegó el correo?
        </p>
      </div>
      <div class="container-label-button-second">
        <a class="redirect-get-password verify-resend" (click)="resend()" (keypress)="resend()" tabindex="0">Reenviar correo</a>
      </div>
      <div class="container-label-button-second">
        <a class="redirect-get-password verify-logout" (click)="logout()" (keypress)="logout()" tabindex="0">Cerrar sesión</a>
      </div>
      <div class="logos-ibero">
        <img src="./../../../../assets/relevants/DAUIC_Horizontal_Color.jpg" alt="">
        <div class="middle-message">
          Prolongación paseo de la reforma No. 880 <br />
          Col. Lomas Altas, Del. Álvaro Obregón
        </div>
        <div class="phone">
          +(55)5950-4000 <br /> Ext. 7736
        </div>
        <div class="cr">
          evamed&#64;ibero.mx
        </div>
        <div class="ap">
          Aviso de privacidad <br />
          Términos y condiciones
        </div>
      </div>
    </section>
  </div>
</div>
```

- [ ] **Step 4: Declare and route it**

In `auth.module.ts`:
- add `import { VerifyEmailComponent } from './components/verify-email/verify-email.component';` after the `CompleteProfileComponent` import;
- add `VerifyEmailComponent,` to `declarations` after `CompleteProfileComponent,`.

In `auth-routing.module.ts`:
- add `import { VerifyEmailComponent } from './components/verify-email/verify-email.component';` after the `CompleteProfileComponent` import;
- add after the `complete-profile` route:

```typescript
  {
    path: 'verify-email',
    component: VerifyEmailComponent,
  },
```

- [ ] **Step 5: Run to verify they pass, then the full suite**

Run the Step 2 command (expected: 11 pass), then `npx -y -p node@22 -- npm test -- --watch=false` (expected: all green).

- [ ] **Step 6: Commit**

```bash
git add frontend/evamed/src/app/auth/components/verify-email/ frontend/evamed/src/app/auth/auth.module.ts frontend/evamed/src/app/auth/auth-routing.module.ts
git commit -m "feat(auth): a page that holds unverified users until they verify

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Sign-up lands on the verify page; the banner goes

**Files:**
- Modify: `frontend/evamed/src/app/auth/components/register/register.component.ts` (line 69)
- Create: `frontend/evamed/src/app/auth/components/register/register.component.spec.ts`
- Delete: `frontend/evamed/src/app/shared/components/email-verification-banner/` (`.ts`, `.html`, `.scss`)
- Modify: `frontend/evamed/src/app/shared/shared.module.ts`, `frontend/evamed/src/app/layout/layout.component.html` (line 3)
- Modify: `frontend/evamed/src/app/core/services/auth.service.ts` (remove helpers left unused)

**Interfaces:**
- Consumes, from Task 3: the route `/auth/verify-email`.

- [ ] **Step 1: Write the failing test**

`frontend/evamed/src/app/auth/components/register/register.component.spec.ts`:

```typescript
import { of } from 'rxjs';

// Compile the component in its NgModule's context.
import '../../auth.module';
import { RegisterComponent } from './register.component';

describe('RegisterComponent sign-up', () => {
  it('sends the new user to the verify-email page, not to login', async () => {
    // Skip the constructor: it builds the form and loads the country catalogue.
    const component: any = Object.create(RegisterComponent.prototype);
    component.form = {
      valid: true,
      value: {
        name: 'Ana', email: 'ana@example.com', institution: 'Ibero', sector: 'Academia',
        country: 1, password: 'secreto123', password2: 'secreto123',
      },
    };
    component.authService = {
      createUser: vi.fn(async () => ({})),
      verifyEmail: vi.fn(async () => undefined),
      deleteCurrentUser: vi.fn(async () => undefined),
    };
    component.user = { addUser: vi.fn(() => of({})) };
    component.snackBar = { open: vi.fn() };
    component.router = { navigate: vi.fn() };

    component.register(new Event('submit'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(component.authService.verifyEmail).toHaveBeenCalled();
    expect(component.router.navigate).toHaveBeenCalledWith(['/auth/verify-email']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/auth/components/register/register.component.spec.ts`. Expected: FAIL, `expected "vi.fn()" to be called with arguments: [ [ '/auth/verify-email' ] ]`. It's currently called with `['/auth/login']`.

- [ ] **Step 3: Redirect sign-up**

In `register.component.ts`, in `register()`, change:

```typescript
        this.router.navigate(['/auth/login']);
      })
```

to:

```typescript
        // Firebase has already signed the new user in; they verify before using the platform.
        this.router.navigate(['/auth/verify-email']);
      })
```

Only the navigation inside the `createUser(...).then(...)` block changes. The other `navigate(['/auth/login'])` in this file, in `login()` (around line 103), is the "already have an account" link and stays.

- [ ] **Step 4: Run to verify it passes**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Remove the banner**

Delete the component, then edit three files:

```bash
git rm -r frontend/evamed/src/app/shared/components/email-verification-banner
```

- **`frontend/evamed/src/app/layout/layout.component.html`:** delete the line `<app-email-verification-banner></app-email-verification-banner>`.
- **`frontend/evamed/src/app/shared/shared.module.ts`:** delete the `import { EmailVerificationBannerComponent } …` line, and remove `EmailVerificationBannerComponent` from both `declarations` and `exports`, including the comma before it if it's the last entry.
- **Unused `AuthService` helpers:** run `grep -rn "reloadCurrentUser\|isEmailVerified" frontend/evamed/src --include=*.ts`. For each of the two methods that only appears in `auth.service.ts` itself, delete it from `auth.service.ts`.

- [ ] **Step 6: Full suite and build**

Run:

```bash
npx -y -p node@22 -- npm test -- --watch=false
npx -y -p node@22 -- npm run build -- --configuration production
```

Expected:
- all tests pass (the suite count from before plus 1);
- the build succeeds with no reference to `app-email-verification-banner`, and the initial total stays at about 1.66 MB.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/evamed/src/app/auth/components/register frontend/evamed/src/app/shared frontend/evamed/src/app/layout/layout.component.html frontend/evamed/src/app/core/services/auth.service.ts
git commit -m "feat(auth): sign-up lands on the verify page; drop the in-app banner

No unverified user reaches the platform layout any more, so the banner
could never show. Its token-refresh logic lives in AuthService now.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After this plan

Click through on dev after deploying:
1. **Email sign-up:** sign up with a fresh email. You land on "Verifica tu correo electrónico". Typing `/home-evamed` sends you back to it.
2. **Resend:** **Reenviar correo** delivers a second email.
3. **Verify in another tab:** click the link in another tab, then return. The page moves on by itself (focus) or with **Ya verifiqué mi correo**, and your projects load right away, with no hour-long wait.
4. **Social sign-in with an unverified email** (Facebook or Microsoft, if enabled): you complete the profile first, then you're held on the verify page.
5. **Existing unverified accounts:** on their next visit they see the verify page.
