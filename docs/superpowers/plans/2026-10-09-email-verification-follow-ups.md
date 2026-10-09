# Email Verification Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the seven minor findings from the review of the mandatory-email-verification branch. Those are: accessible actions, a resend cooldown, mobile re-checks, keeping the requested page, a guard that can't hang, no signed-in session without an email, and stale comments.

**Architecture:** Small, independent changes:
- **`VerifyEmailComponent` and its template:** Tasks 1–4.
- **`AdminGuard`:** Tasks 4–5.
- **`SocialAuthFlowService`:** Task 6.

Each task adds tests to the existing spec files first. No backend change.

**Tech Stack:** Angular 22 (NgModule components), Firebase Auth JS SDK v12, RxJS, Vitest via `ng test` (fake timers via `vi.useFakeTimers()`).

**Spec:** `docs/superpowers/specs/2026-10-09-mandatory-email-verification-design.md`. These are the follow-ups from that branch's final review (2026-10-09), listed under "Source" below.

## Source (review findings, all Minor)

| # | Finding | Task |
|---|---|---|
| M1 | Stale comments in `social-auth-flow.service.ts` still mention the removed banner | 6 |
| M2 | The verify page's "Reenviar correo" and "Cerrar sesión" are `<a tabindex="0" (keypress)>`: any key fires them, and they aren't announced as buttons. "Leer más" has `tabindex="1"` | 1 |
| M3 | Resend has no in-flight guard or cooldown | 2 |
| M4 | The re-check listens to `window:focus` only. On mobile tab switches `visibilitychange` is the reliable signal | 3 |
| M5 | The guard drops the requested page. After verifying, the user lands on `/` | 4 |
| M6 | The guard awaits Firebase calls that can hang (~30 s) when the network is up but Firebase is unreachable | 5 |
| M7 | The social "no-email" path throws but leaves the Firebase session signed in, so the verify page shows an empty address | 6 |

## Global Constraints

- **No new user-visible copy.** Existing strings stay exactly as they are, including:
  - `Te enviamos un nuevo correo de verificación.`
  - `No se pudo enviar el correo. Intenta nuevamente.`
  - `Reenviar correo`
  - `Cerrar sesión`
  - `Leer más`
- **Keep the CSS classes the existing specs select on:** `verify-resend`, `verify-logout`, `verify-pending`, `yellow-button-login`.
- **Values:**
  - resend cooldown `RESEND_COOLDOWN_MS = 60_000` after a successful send;
  - guard Firebase timeout `GUARD_CHECK_TIMEOUT_MS = 5_000`;
  - query parameter name `returnUrl`.
- **A `returnUrl` is used only if it's an in-app path:** it matches `/^\/(?![\/\\])/` (starts with `/` but not `//` or `/\`) and doesn't start with `/auth`. Otherwise the page goes to `/`, as before.
- **Commands run from `frontend/evamed`:**
  - one spec: `npx -y -p node@22 -- npx ng test --watch=false --include <path>`;
  - all: `npx -y -p node@22 -- npm test -- --watch=false`;
  - build: `npx -y -p node@22 -- npm run build -- --configuration production`.
- **Spec files edited:**
  - `src/app/auth/components/verify-email/verify-email.component.spec.ts` (its `setup(user, overrides)` helper and `settle()`/`click()` helpers already exist);
  - `src/app/admin.guard.spec.ts` (its `run(user, overrides)` and `target()` helpers already exist).

## Review Focus

- **Keyboard users:** Enter and Space must still trigger the actions, because native `<button>` handles them, while letter keys must not. Tested in Task 1.
- **A `returnUrl` carrying a query string** (`/home-evamed?tab=2`) must survive verification intact. Tested in Task 4.
- **The page becomes visible while a check is already running.** It must still start only one check: the existing `checking` gate covers it, and Task 3 adds a test.
- **Firebase answers after the guard's timeout already fired.** The navigation decision stands, and the late answer is ignored with no error. Tested in Task 5.
- **The resend cooldown runs out after the user has left the page.** That must cause no error, because the timer only flips a field. It's a code-review item, with no test.

---

## File Structure

All paths are under `frontend/evamed/src/app/`.

| Path | Status | Responsibility |
|---|---|---|
| `auth/components/verify-email/verify-email.component.html` | Modify | Real buttons; no positive tabindex |
| `auth/components/verify-email/verify-email.component.scss` | Create | `.link-button` (buttons that look like the page's links) |
| `auth/components/verify-email/verify-email.component.ts` | Modify | Cooldown, `visibilitychange`, `returnUrl` |
| `auth/components/verify-email/verify-email.component.spec.ts` | Modify | Tests for Tasks 1–4 |
| `admin.guard.ts` | Modify | `returnUrl`, timeout |
| `admin.guard.spec.ts` | Modify | Tests for Tasks 4–5 |
| `core/services/social-auth-flow.service.ts` | Modify | Sign out on no-email; comments |
| `core/services/social-auth-flow.service.spec.ts` | Create | Test for Task 6 |

---

### Task 1: The page's actions are real buttons

**Files:**
- Modify: `auth/components/verify-email/verify-email.component.html`
- Create: `auth/components/verify-email/verify-email.component.scss`
- Modify: `auth/components/verify-email/verify-email.component.ts` (`styleUrls`)
- Modify: `auth/components/verify-email/verify-email.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add inside the `describe('VerifyEmailComponent', …)` block, after the last `it`:

```typescript
  it('offers its actions as real buttons', () => {
    const { el } = setup(unverified);

    for (const selector of ['.verify-resend', '.verify-logout', '.verify-about']) {
      const action = el.querySelector(selector);
      expect(action?.tagName, selector).toBe('BUTTON');
      expect(action?.getAttribute('type'), selector).toBe('button');
    }
  });

  it('does not sign out when a letter is typed on the sign-out action', async () => {
    const { el, auth } = setup(unverified);

    el.querySelector('.verify-logout')!.dispatchEvent(new KeyboardEvent('keypress', { key: 'a', bubbles: true }));
    await settle();

    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('keeps the natural tab order (no positive tabindex)', () => {
    const { el } = setup(unverified);

    const positive = Array.from(el.querySelectorAll('[tabindex]')).filter(
      element => Number(element.getAttribute('tabindex')) > 0
    );
    expect(positive).toEqual([]);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run `npx -y -p node@22 -- npx ng test --watch=false --include src/app/auth/components/verify-email/verify-email.component.spec.ts`. Expected, 3 failures:
- `offers its actions as real buttons`: `expected 'A' to be 'BUTTON'`;
- `does not sign out when a letter is typed`: `logout` was called;
- `keeps the natural tab order`: one element with `tabindex="1"` (Leer más).

- [ ] **Step 3: Make them buttons**

In `verify-email.component.html`, replace the "Leer más" anchor:

```html
con un menor impacto ambiental durante todo su ciclo de vida <a (click)="about()" (keypress)="about()" tabindex="1">Leer más</a>.
```

with:

```html
con un menor impacto ambiental durante todo su ciclo de vida <button type="button" class="link-button link-button--inline verify-about" (click)="about()">Leer más</button>.
```

Then replace the two action anchors:

```html
      <div class="container-label-button-second">
        <a class="redirect-get-password verify-resend" (click)="resend()" (keypress)="resend()" tabindex="0">Reenviar correo</a>
      </div>
      <div class="container-label-button-second">
        <a class="redirect-get-password verify-logout" (click)="logout()" (keypress)="logout()" tabindex="0">Cerrar sesión</a>
      </div>
```

with:

```html
      <div class="container-label-button-second">
        <button type="button" class="link-button redirect-get-password verify-resend" (click)="resend()">Reenviar correo</button>
      </div>
      <div class="container-label-button-second">
        <button type="button" class="link-button redirect-get-password verify-logout" (click)="logout()">Cerrar sesión</button>
      </div>
```

Create `verify-email.component.scss`:

```scss
// Real buttons (announced as buttons; Enter/Space only) that look like the
// auth pages' text links.
.link-button {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  cursor: pointer;
}

.link-button:disabled {
  cursor: default;
  opacity: 0.5;
}

// "Leer más" sits inside the side panel's white paragraph.
.link-button--inline {
  color: inherit;
  font-weight: bold;
  text-decoration: underline;
}
```

In `verify-email.component.ts`, change `styleUrls` to:

```typescript
    // Same layout as the other auth pages, plus link-styled buttons.
    styleUrls: [
      '../recover-password/recover-password/recover-password.component.scss',
      './verify-email.component.scss',
    ],
```

and delete the line `    // Same layout as the other auth pages.` above it.

- [ ] **Step 4: Run to verify they pass**

Run the Step 2 command. Expected: all tests in the file pass. The existing `click(el, '.verify-resend')` and `.verify-logout` tests still pass, because `click()` works on buttons.

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/auth/components/verify-email/
git commit -m "fix(auth): verify page actions are real buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Resend sends once, then waits a minute

**Files:**
- Modify: `auth/components/verify-email/verify-email.component.ts` (`resend()`)
- Modify: `auth/components/verify-email/verify-email.component.html` (the resend button)
- Modify: `auth/components/verify-email/verify-email.component.spec.ts`

**Interfaces:**
- Produces: `VerifyEmailComponent.canResend: boolean` (public, bound to the button's `[disabled]`), and the module constant `RESEND_COOLDOWN_MS = 60_000`.

- [ ] **Step 1: Write the failing tests**

Add inside the `describe` block:

```typescript
  it('sends one email however often Reenviar is pressed', async () => {
    let finish: () => void = () => undefined;
    const resendVerification = vi.fn(() => new Promise<void>(resolve => (finish = resolve)));
    const { fixture } = setup(unverified, { resendVerification });

    fixture.componentInstance.resend();
    fixture.componentInstance.resend();
    finish();
    await settle();

    expect(resendVerification).toHaveBeenCalledTimes(1);
  });

  it('waits a minute after a sent email before allowing another', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, auth } = setup(unverified);

      fixture.componentInstance.resend();
      await vi.advanceTimersByTimeAsync(0);
      fixture.componentInstance.resend();
      fixture.detectChanges();

      expect(auth.resendVerification).toHaveBeenCalledTimes(1);
      expect((fixture.nativeElement.querySelector('.verify-resend') as HTMLButtonElement).disabled).toBe(true);

      await vi.advanceTimersByTimeAsync(60_000);
      fixture.componentInstance.resend();
      expect(auth.resendVerification).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows retrying straight after a failed resend', async () => {
    const resendVerification = vi.fn()
      .mockRejectedValueOnce(new Error('auth/network-request-failed'))
      .mockResolvedValue(undefined);
    const { fixture } = setup(unverified, { resendVerification });

    fixture.componentInstance.resend();
    await settle();
    fixture.componentInstance.resend();
    await settle();

    expect(resendVerification).toHaveBeenCalledTimes(2);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run the Task 1 Step 2 command. Expected, 2 failures:
- `sends one email…`: called 2 times;
- `waits a minute…`: called 2 times before the cooldown, and the button isn't disabled.

`allows retrying…` passes already. It guards that the cooldown applies only after success.

- [ ] **Step 3: Implement**

In `verify-email.component.ts`, add below the imports:

```typescript
// Firebase throttles repeated verification emails (auth/too-many-requests).
export const RESEND_COOLDOWN_MS = 60_000;
```

Add the field after `notYetVerified = false;`:

```typescript
  canResend = true;
```

Replace `resend()` with:

```typescript
  resend(): void {
    if (!this.canResend) {
      return;
    }
    this.canResend = false;
    this.authService
      .resendVerification()
      .then(() => {
        this.snackBar.open('Te enviamos un nuevo correo de verificación.', 'OK', { duration: 4000 });
        setTimeout(() => (this.canResend = true), RESEND_COOLDOWN_MS);
      })
      .catch(() => {
        this.snackBar.open('No se pudo enviar el correo. Intenta nuevamente.', 'OK', { duration: 4000 });
        this.canResend = true;
      });
  }
```

In `verify-email.component.html`, add `[disabled]="!canResend"` to the resend button:

```html
        <button type="button" class="link-button redirect-get-password verify-resend" [disabled]="!canResend" (click)="resend()">Reenviar correo</button>
```

- [ ] **Step 4: Run to verify they pass**

Run the Task 1 Step 2 command. Expected: all pass, including the existing `resends the email and confirms it` and `reports a failed resend` tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/auth/components/verify-email/
git commit -m "fix(auth): resend sends once, then waits a minute

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Re-check when the page becomes visible again

**Files:**
- Modify: `auth/components/verify-email/verify-email.component.ts`
- Modify: `auth/components/verify-email/verify-email.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add inside the `describe` block:

```typescript
  // Mobile browsers often don't fire window focus when switching back to a tab.
  const setVisibility = (state: DocumentVisibilityState) =>
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

  it('re-checks when the page becomes visible again', async () => {
    const { navigate } = setup(unverified, { refreshVerification: vi.fn(async () => true) });
    try {
      setVisibility('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      await settle();

      expect(navigate).toHaveBeenCalledWith(['/']);
    } finally {
      delete (document as any).visibilityState;
    }
  });

  it('does not re-check when the page is being hidden', async () => {
    const refreshVerification = vi.fn(async () => true);
    setup(unverified, { refreshVerification });
    try {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      await settle();

      expect(refreshVerification).not.toHaveBeenCalled();
    } finally {
      delete (document as any).visibilityState;
    }
  });

  it('starts one check when focus and visibility arrive together', async () => {
    let finish: (verified: boolean) => void = () => undefined;
    const refreshVerification = vi.fn(() => new Promise<boolean>(resolve => (finish = resolve)));
    setup(unverified, { refreshVerification });
    try {
      setVisibility('visible');
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      finish(false);
      await settle();

      expect(refreshVerification).toHaveBeenCalledTimes(1);
    } finally {
      delete (document as any).visibilityState;
    }
  });
```

- [ ] **Step 2: Run to verify they fail**

Run the Task 1 Step 2 command. Expected: `re-checks when the page becomes visible again` fails, because `navigate` isn't called. The other two already pass: there's no listener yet, and focus alone is a single check. They pin behaviour once the listener exists.

- [ ] **Step 3: Implement**

In `verify-email.component.ts`, add after `onFocus()`:

```typescript
  // Mobile tab switches often skip window focus; visibility is reliable there.
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.check();
    }
  }
```

- [ ] **Step 4: Run to verify they pass**

Run the Task 1 Step 2 command. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/auth/components/verify-email/
git commit -m "fix(auth): verify page re-checks when it becomes visible again

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: After verifying, continue to the page that was asked for

**Files:**
- Modify: `admin.guard.ts`, `admin.guard.spec.ts`
- Modify: `auth/components/verify-email/verify-email.component.ts`, `verify-email.component.spec.ts`

**Interfaces:**
- Produces:
  - the guard's redirect `/auth/verify-email?returnUrl=<state.url>`, whenever `state.url` is set and isn't `/`;
  - the page navigates with `router.navigateByUrl(returnUrl)` when the `returnUrl` is safe (Global Constraints), else with `router.navigate(['/'])`.

- [ ] **Step 1: Write the failing guard test**

In `admin.guard.spec.ts`, change the `run` helper so it can pass a router state. Replace:

```typescript
  const run = (user: unknown, overrides: Record<string, unknown> = {}) => {
```

with:

```typescript
  const run = (user: unknown, overrides: Record<string, unknown> = {}, url?: string) => {
```

and replace:

```typescript
    const result = TestBed.inject(AdminGuard).canActivate(null as any, null as any) as Observable<boolean | UrlTree>;
```

with:

```typescript
    const result = TestBed.inject(AdminGuard).canActivate(
      null as any,
      (url ? { url } : null) as any
    ) as Observable<boolean | UrlTree>;
```

Then add inside `describe('AdminGuard', …)`:

```typescript
  it('remembers the requested page when it sends a user to verify', async () => {
    const { outcome } = run({ emailVerified: false }, {}, '/resultados');

    expect(target(await outcome)).toBe('/auth/verify-email?returnUrl=%2Fresultados');
  });
```

- [ ] **Step 2: Write the failing page tests**

In `verify-email.component.spec.ts`, extend the imports:

```typescript
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
```

(replacing `import { provideRouter, Router } from '@angular/router';`). Change the `setup` helper's signature and providers so a test can pass query parameters:

```typescript
  const setup = (user: unknown, overrides: Record<string, unknown> = {}, queryParams: Record<string, string> = {}) => {
```

add this provider to its `providers` array:

```typescript
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
```

and replace its two lines:

```typescript
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
```

```typescript
    return { fixture, auth, snackBar, navigate, el: fixture.nativeElement as HTMLElement };
```

with:

```typescript
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
```

```typescript
    return { fixture, auth, snackBar, navigate, navigateByUrl, el: fixture.nativeElement as HTMLElement };
```

Add inside the `describe` block:

```typescript
  it('continues to the page that was asked for', async () => {
    const { el, navigateByUrl } = setup(
      unverified, { refreshVerification: vi.fn(async () => true) }, { returnUrl: '/home-evamed?tab=2' });

    await click(el, 'button.yellow-button-login');

    expect(navigateByUrl).toHaveBeenCalledWith('/home-evamed?tab=2');
  });

  it('sends an already verified user to the page that was asked for', () => {
    const { navigateByUrl } = setup(
      { email: 'ana@example.com', emailVerified: true }, {}, { returnUrl: '/resultados' });

    expect(navigateByUrl).toHaveBeenCalledWith('/resultados');
  });

  for (const unsafe of ['//evil.example', '/\\evil.example', 'https://evil.example', '/auth/login']) {
    it(`ignores a returnUrl that isn't an app page (${unsafe})`, async () => {
      const { el, navigate, navigateByUrl } = setup(
        unverified, { refreshVerification: vi.fn(async () => true) }, { returnUrl: unsafe });

      await click(el, 'button.yellow-button-login');

      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  }
```

- [ ] **Step 3: Run to verify they fail**

Run:

```bash
npx -y -p node@22 -- npx ng test --watch=false --include src/app/admin.guard.spec.ts --include src/app/auth/components/verify-email/verify-email.component.spec.ts
```

Expected failures:
- **Guard:** `expected '/auth/verify-email' to be '/auth/verify-email?returnUrl=%2Fresultados'`.
- **Page:** the two "asked for" tests fail, because `navigateByUrl` isn't called. The four "ignores" tests already pass, because today's page always uses `navigate(['/'])`.

- [ ] **Step 4: Implement in the guard**

In `admin.guard.ts`, replace:

```typescript
        return verified ? true : this.router.parseUrl('/auth/verify-email');
```

with:

```typescript
        return verified ? true : this.verifyPage(state?.url);
```

and add this method below `canActivate`:

```typescript
  // Keep the page they asked for, so they land there once verified.
  private verifyPage(requested?: string): UrlTree {
    const queryParams = requested && requested !== '/' ? { returnUrl: requested } : {};
    return this.router.createUrlTree(['/auth/verify-email'], { queryParams });
  }
```

- [ ] **Step 5: Implement in the page**

In `verify-email.component.ts`:
- change the router import to `import { ActivatedRoute, Router } from '@angular/router';`;
- add `private route: ActivatedRoute,` to the constructor, after `private router: Router,`;
- add these methods after `ngOnDestroy()`:

```typescript
  // Back to the page AdminGuard intercepted, if it's a page of this app.
  private enterPlatform(): void {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const isAppPage = !!requested && /^\/(?![\/\\])/.test(requested) && !requested.startsWith('/auth');
    if (isAppPage) {
      this.router.navigateByUrl(requested);
    } else {
      this.router.navigate(['/']);
    }
  }
```

Then replace the two `this.router.navigate(['/']);` calls with `this.enterPlatform();`. One is in `ngOnInit` (the `user.emailVerified` branch) and one in `check()` (the verified branch).

- [ ] **Step 6: Run to verify they pass, then the full suite**

Run the Step 3 command (expected: all pass), then `npx -y -p node@22 -- npm test -- --watch=false` (expected: all green).

- [ ] **Step 7: Commit**

```bash
git add frontend/evamed/src/app/admin.guard.ts frontend/evamed/src/app/admin.guard.spec.ts frontend/evamed/src/app/auth/components/verify-email/
git commit -m "fix(auth): after verifying, continue to the page that was asked for

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The guard never waits more than 5 seconds on Firebase

**Files:**
- Modify: `admin.guard.ts`, `admin.guard.spec.ts`

**Interfaces:**
- Produces: the module constant `GUARD_CHECK_TIMEOUT_MS = 5_000`, exported from `admin.guard.ts`.

- [ ] **Step 1: Write the failing tests**

Add inside `describe('AdminGuard', …)` in `admin.guard.spec.ts`:

```typescript
  const never = <T>() => new Promise<T>(() => undefined);

  it('sends an unverified user to the verify page when Firebase never answers', async () => {
    vi.useFakeTimers();
    try {
      const { outcome } = run({ emailVerified: false }, { refreshVerification: vi.fn(() => never<boolean>()) });
      let settled = false;
      outcome.then(() => (settled = true));

      await vi.advanceTimersByTimeAsync(4_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(target(await outcome)).toBe('/auth/verify-email');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets a verified user in when the token refresh never answers', async () => {
    vi.useFakeTimers();
    try {
      const { outcome } = run({ emailVerified: true }, { ensureVerifiedToken: vi.fn(() => never<void>()) });

      await vi.advanceTimersByTimeAsync(5_000);

      expect(await outcome).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a Firebase answer that arrives after the timeout', async () => {
    vi.useFakeTimers();
    try {
      let late: (verified: boolean) => void = () => undefined;
      const { outcome } = run(
        { emailVerified: false },
        { refreshVerification: vi.fn(() => new Promise<boolean>(resolve => (late = resolve))) }
      );

      await vi.advanceTimersByTimeAsync(5_000);
      late(true);
      await vi.advanceTimersByTimeAsync(0);

      expect(target(await outcome)).toBe('/auth/verify-email');
    } finally {
      vi.useRealTimers();
    }
  });
```

- [ ] **Step 2: Run to verify they fail**

Run `npx -y -p node@22 -- npx ng test --watch=false --include src/app/admin.guard.spec.ts`. Expected: the first two fail. Without a timeout the outcome never settles, so the test times out after Vitest's 5 s. The third may also hang: once `late(true)` runs, today's guard would return `true`.

- [ ] **Step 3: Implement**

In `admin.guard.ts`, add below the imports:

```typescript
// Firebase calls can take ~30 s to fail when the network is up but Firebase
// isn't reachable; navigation shouldn't wait that long.
export const GUARD_CHECK_TIMEOUT_MS = 5_000;

// `work`'s result, or `fallback` if it fails or takes longer than the limit.
function within<T>(work: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>(resolve => {
    timer = setTimeout(() => resolve(fallback), GUARD_CHECK_TIMEOUT_MS);
  });
  return Promise.race([work.catch(() => fallback), timeout]).finally(() => clearTimeout(timer));
}
```

In `canActivate`, replace:

```typescript
          await this.authService.ensureVerifiedToken().catch(() => undefined);
```

with:

```typescript
          await within(this.authService.ensureVerifiedToken(), undefined);
```

and replace:

```typescript
        const verified = await this.authService.refreshVerification().catch(() => false);
```

with:

```typescript
        const verified = await within(this.authService.refreshVerification(), false);
```

- [ ] **Step 4: Run to verify they pass, then the full suite**

Run the Step 2 command (expected: all pass), then `npx -y -p node@22 -- npm test -- --watch=false` (expected: all green).

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/admin.guard.ts frontend/evamed/src/app/admin.guard.spec.ts
git commit -m "fix(auth): the guard never waits more than 5 s on Firebase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: No signed-in session without an email; current comments

**Files:**
- Modify: `core/services/social-auth-flow.service.ts`
- Create: `core/services/social-auth-flow.service.spec.ts`

- [ ] **Step 1: Write the failing test**

`frontend/evamed/src/app/core/services/social-auth-flow.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from './auth.service';
import { SocialAuthFlowService } from './social-auth-flow.service';
import { UserService } from './user/user.service';

describe('SocialAuthFlowService', () => {
  // A session with no email would sit on the verify page with nothing to verify.
  it('signs out again when the provider gives no email', async () => {
    const auth = {
      loginWithProvider: vi.fn(async () => ({ user: { email: null, emailVerified: false } })),
      logout: vi.fn(async () => undefined),
    };
    const router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: UserService, useValue: { searchUser: vi.fn(() => of([])) } },
        { provide: Router, useValue: router },
      ],
    });

    await expect(TestBed.inject(SocialAuthFlowService).signIn('twitter')).rejects.toThrow('no-email');

    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run `npx -y -p node@22 -- npx ng test --watch=false --include src/app/core/services/social-auth-flow.service.spec.ts`. Expected: FAIL, `expected "vi.fn()" to be called at least once` (`logout`).

- [ ] **Step 3: Implement and fix the comments**

In `social-auth-flow.service.ts`, replace:

```typescript
    // Some providers (Apple private relay, Twitter without email scope) may not
    // return an email. The whole app keys off `email-login` / searchUser(email),
    // so abort rather than corrupt the lookup with a null value.
    if (!email) {
      throw new Error('no-email');
    }
```

with:

```typescript
    // Some providers (Apple private relay, Twitter without email scope) may not
    // return an email. The whole app keys off `email-login` / searchUser(email),
    // so abort rather than corrupt the lookup with a null value, and sign out
    // again: a session without an email would sit on the verify page with
    // nothing to verify.
    if (!email) {
      await this.authService.logout().catch(() => undefined);
      throw new Error('no-email');
    }
```

Then replace:

```typescript
    // email once so the banner has something to point to. Google accounts
```

with:

```typescript
    // email once so the verify page has something to point to. Google accounts
```

and replace:

```typescript
        // e.g. auth/too-many-requests: the banner can resend later.
```

with:

```typescript
        // e.g. auth/too-many-requests: the verify page can resend later.
```

- [ ] **Step 4: Run to verify it passes, then the full suite and build**

Run the Step 2 command (expected: PASS), then:

```bash
npx -y -p node@22 -- npm test -- --watch=false
npx -y -p node@22 -- npm run build -- --configuration production
```

Expected:
- all green;
- `grep -rn "banner" frontend/evamed/src/app --include=*.ts` prints nothing;
- the build completes, with the initial total about 1.67 MB.

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/core/services/social-auth-flow.service.ts frontend/evamed/src/app/core/services/social-auth-flow.service.spec.ts
git commit -m "fix(auth): sign out when a provider gives no email; current comments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After this plan

Click through on dev:
- **Keyboard:** Tab through the verify page. "Leer más", "Ya verifiqué mi correo", "Reenviar correo" and "Cerrar sesión" are each reachable in order, and Enter triggers them.
- **Resend:** press **Reenviar correo** twice. One email arrives, and the button stays disabled for a minute.
- **Phone:** on a phone, switch to the mail app, verify, and switch back. The page moves on by itself.
- **Requested page:** signed in but unverified, open `https://dev.evamediber.click/resultados`. After verifying you land on the results page, not on home.
