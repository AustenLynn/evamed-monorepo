# EVAmed Email Action Page and Password Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Firebase's email links (verify, password reset, email-change undo) open EVAmed's own Spanish page at `/auth/action`, which takes users straight into the platform.
- Sign-up and password reset enforce Firebase's password policy with a live checklist: at least 12 characters, with uppercase, lowercase and a number.

**Architecture:**
- **A shared `PasswordRequirementsComponent`** renders the policy from `validatePassword()`. Sign-up and the reset form use it.
- **A container, `EmailActionComponent`, on the unguarded route `auth/action`,** reads `mode` and `oobCode` and renders one of three handlers: `VerifyEmailActionComponent`, `ResetPasswordActionComponent`, `RecoverEmailActionComponent`.
- **Firebase calls go through thin `AuthService` wrappers,** so every component is tested against a mocked service.

**Tech Stack:** Angular 22 (NgModule components, `standalone: false`, control flow `@if`/`@switch`), Firebase Auth JS SDK v12 (`firebase/auth`), RxJS, Vitest via `ng test` (fake timers via `vi.useFakeTimers()`).

**Spec:** `docs/superpowers/specs/2026-10-09-email-action-handler-design.md`

## Global Constraints

- **Route:** `/auth/action`, inside the existing lazy `AuthModule` (`frontend/evamed/src/app/auth/`), **unguarded**.
- **SDK functions,** confirmed in `node_modules/@firebase/auth/dist/auth-public.d.ts`:
  - `applyActionCode(auth, oobCode): Promise<void>`
  - `checkActionCode(auth, oobCode): Promise<ActionCodeInfo>` (`info.data.email` is the restored email)
  - `verifyPasswordResetCode(auth, code): Promise<string>`
  - `confirmPasswordReset(auth, oobCode, newPassword): Promise<void>`
  - `validatePassword(auth, password): Promise<PasswordValidationStatus>`. Its flags are `meetsMinPasswordLength`, `containsUppercaseLetter`, `containsLowercaseLetter`, `containsNumericCharacter` and `containsNonAlphanumericCharacter`; `undefined` means not required. The minimum length is at `passwordPolicy.customStrengthOptions.minPasswordLength`.
- **Error codes:**
  - unusable link: `auth/invalid-action-code`, `auth/expired-action-code`, `auth/user-disabled`, `auth/user-not-found`
  - password: `auth/weak-password`, `auth/password-does-not-meet-requirements`
- **Spanish copy, exactly:**

  | Where | Text |
  |---|---|
  | Verify | `Verificando tu correo…`, `¡Correo verificado!`, `Te llevamos a EVAmed…`, `Entrar ahora`, `Ya puedes iniciar sesión.`, `Iniciar sesión` |
  | Unusable link | `Este enlace ya no es válido.`, `Reenviar correo de verificación` |
  | Firebase unreachable | `No pudimos completar la acción. Intenta nuevamente.`, `Reintentar` |
  | Reset | `Comprobando el enlace…`, `Restablecer contraseña`, `Elige una nueva contraseña para`, `Nueva contraseña`, `Confirmar contraseña`, `Guardar`, `Las contraseñas no coinciden`, `La contraseña no cumple los requisitos.`, `No se pudo guardar. Intenta nuevamente.`, `Contraseña actualizada`, `Este enlace para restablecer la contraseña ya no es válido.`, `Solicitar otro enlace` |
  | Recover | `Restaurando tu correo…`, `Restauramos tu correo`, `Tu cuenta vuelve a usar`, `Si no pediste este cambio, restablece tu contraseña.`, `Te enviamos un correo para restablecer tu contraseña.`, `No se pudo enviar el correo. Intenta nuevamente.` |
  | Checklist | `Al menos {n} caracteres`, `Una letra mayúscula`, `Una letra minúscula`, `Un número`, `Un símbolo` |

  Snackbars are `('…', 'OK', { duration: 4000 })`.
- **Values:** `AUTO_ENTER_MS = 2_000`. After a successful reset sign-in, set `localStorage['email-login']`, as `LoginComponent` does.
- **Login is not changed.** It must accept existing, older passwords.
- **No Firebase console changes in this plan.** They come after deploy (see "After this plan").
- **Commands run from `frontend/evamed`:**
  - one spec: `npx -y -p node@22 -- npx ng test --watch=false --include <path>`;
  - all: `npx -y -p node@22 -- npm test -- --watch=false`;
  - build: `npx -y -p node@22 -- npm run build -- --configuration production`.

## Review Focus

- **Firebase is still restoring a saved session when the verify link opens in a fresh tab.** The handler must wait for it and treat the user as signed in. Tested in Task 3.
- **The same verification link is clicked twice.** The second visit, by a now-verified user, goes straight in instead of showing an error. Tested in Task 3.
- **Typing fast in a password field.** Out-of-order `validatePassword` answers must not leave the checklist showing an older password's result. Tested in Task 1.
- **Leaving the verify page before the 2-second auto-entry.** It must not navigate afterwards. Tested in Task 3.
- **Pressing Guardar twice, or with mismatched passwords.** The password is saved at most once, and never with a mismatch. Tested in Task 4.

---

## File Structure

All paths are under `frontend/evamed/src/app/`.

| Path | Status | Responsibility |
|---|---|---|
| `core/services/auth.service.ts` | Modify | Wrappers: `checkPassword`, `applyActionCode`, `checkActionCode`, `verifyPasswordResetCode`, `confirmPasswordReset` |
| `auth/components/password-requirements/password-requirements.component.{ts,html,scss,spec.ts}` | Create | Live policy checklist |
| `auth/components/register/register.component.{ts,html}`, `register.component.spec.ts` | Modify | Checklist; policy error message |
| `auth/components/email-action/action-errors.ts` | Create | `isUnusableLink(error)` |
| `auth/components/email-action/verify-email-action.component.{ts,html,spec.ts}` | Create | `mode=verifyEmail` |
| `auth/components/email-action/reset-password-action.component.{ts,html,spec.ts}` | Create | `mode=resetPassword` |
| `auth/components/email-action/recover-email-action.component.{ts,html,spec.ts}` | Create | `mode=recoverEmail` |
| `auth/components/email-action/email-action.component.{ts,html,spec.ts}` | Create | Container, layout and routing test |
| `auth/auth.module.ts`, `auth/auth-routing.module.ts` | Modify | Declarations, route |

---

### Task 1: The password-policy checklist

**Files:**
- Modify: `core/services/auth.service.ts`
- Create: `auth/components/password-requirements/password-requirements.component.ts`, `.html`, `.scss`, `.spec.ts`
- Modify: `auth/auth.module.ts`

**Interfaces:**
- Produces:
  - `AuthService.checkPassword(password: string): Promise<PasswordValidationStatus>`;
  - `PasswordRequirementsComponent`, selector `app-password-requirements`, with `@Input() password: string` and `@Output() validityChange: EventEmitter<boolean | null>`. It emits `isValid`, or `null` when the policy can't be fetched;
  - `toRequirements(status): Requirement[]` and `interface Requirement { label: string; met: boolean | null }`.

- [ ] **Step 1: Write the failing tests**

`auth/components/password-requirements/password-requirements.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthModule } from '../../auth.module';
import { PasswordRequirementsComponent, toRequirements } from './password-requirements.component';

const policy = {
  customStrengthOptions: {
    minPasswordLength: 12,
    containsUppercaseLetter: true,
    containsLowercaseLetter: true,
    containsNumericCharacter: true,
  },
  allowedNonAlphanumericCharacters: '',
  enforcementState: 'ENFORCE',
};

const status = (overrides: Record<string, unknown> = {}): any => ({
  isValid: false,
  meetsMinPasswordLength: false,
  containsUppercaseLetter: false,
  containsLowercaseLetter: true,
  containsNumericCharacter: false,
  passwordPolicy: policy,
  ...overrides,
});

const allMet = { isValid: true, meetsMinPasswordLength: true, containsUppercaseLetter: true, containsNumericCharacter: true };

describe('toRequirements', () => {
  it("lists each rule the policy requires, with Firebase's minimum length", () => {
    expect(toRequirements(status())).toEqual([
      { label: 'Al menos 12 caracteres', met: false },
      { label: 'Una letra mayúscula', met: false },
      { label: 'Una letra minúscula', met: true },
      { label: 'Un número', met: false },
    ]);
  });

  it('leaves out rules the policy does not require', () => {
    const labels = toRequirements(status({ containsUppercaseLetter: undefined, containsNumericCharacter: undefined }))
      .map(requirement => requirement.label);

    expect(labels).toEqual(['Al menos 12 caracteres', 'Una letra minúscula']);
  });
});

describe('PasswordRequirementsComponent', () => {
  const setup = (checkPassword: (password: string) => Promise<unknown>) => {
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [{ provide: AuthService, useValue: { checkPassword } }],
    });
    const fixture = TestBed.createComponent(PasswordRequirementsComponent);
    const emitted: (boolean | null)[] = [];
    fixture.componentInstance.validityChange.subscribe(valid => emitted.push(valid));
    return { fixture, emitted };
  };

  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  const type = async (fixture: ComponentFixture<PasswordRequirementsComponent>, password: string) => {
    fixture.componentRef.setInput('password', password);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
  };

  const items = (fixture: ComponentFixture<PasswordRequirementsComponent>) =>
    Array.from(fixture.nativeElement.querySelectorAll('.requirement')) as HTMLElement[];

  it('ticks the rules a password meets and reports whether it is valid', async () => {
    const { fixture, emitted } = setup(vi.fn(async () => status(allMet)));

    await type(fixture, 'Correcta12345');

    expect(items(fixture).map(item => item.classList.contains('met'))).toEqual([true, true, true, true]);
    expect(emitted.at(-1)).toBe(true);
  });

  it('shows the latest password even when answers arrive out of order', async () => {
    let stale: (answer: unknown) => void = () => undefined;
    const checkPassword = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => (stale = resolve)))
      .mockImplementationOnce(async () => status(allMet));
    const { fixture, emitted } = setup(checkPassword);

    await type(fixture, 'cor');
    await type(fixture, 'Correcta12345');
    stale(status());
    await settle();
    fixture.detectChanges();

    expect(emitted).toEqual([true]);
    expect(items(fixture).every(item => item.classList.contains('met'))).toBe(true);
  });

  it('falls back to the rules as plain text when the policy cannot be fetched', async () => {
    const { fixture, emitted } = setup(vi.fn(async () => { throw new Error('auth/network-request-failed'); }));

    await type(fixture, 'algo');

    expect(items(fixture).map(item => item.querySelector('.label')?.textContent?.trim())).toEqual([
      'Al menos 12 caracteres', 'Una letra mayúscula', 'Una letra minúscula', 'Un número',
    ]);
    expect(items(fixture).some(item => item.classList.contains('met') || item.classList.contains('unmet'))).toBe(false);
    expect(emitted.at(-1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/auth/components/password-requirements/password-requirements.component.spec.ts`. Expected: a compile error, `Could not resolve "./password-requirements.component"`.

- [ ] **Step 3: Add the AuthService wrapper**

In `core/services/auth.service.ts`, add `validatePassword` and `PasswordValidationStatus` to the `firebase/auth` import list, then add this method after `resendVerification()`:

```typescript
  // Checks a password against the policy configured in Firebase
  // (Authentication -> Settings -> Password policy).
  checkPassword(password: string): Promise<PasswordValidationStatus> {
    return validatePassword(this.auth, password);
  }
```

- [ ] **Step 4: Write the component**

`auth/components/password-requirements/password-requirements.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { PasswordValidationStatus } from 'firebase/auth';

import { AuthService } from 'src/app/core/services/auth.service';

export interface Requirement {
  label: string;
  // null: unknown (the policy couldn't be fetched).
  met: boolean | null;
}

// Shown when Firebase can't be reached; Firebase still enforces the policy on submit.
const FALLBACK: Requirement[] = [
  { label: 'Al menos 12 caracteres', met: null },
  { label: 'Una letra mayúscula', met: null },
  { label: 'Una letra minúscula', met: null },
  { label: 'Un número', met: null },
];

// One line per rule the Firebase policy requires (undefined = not required).
export function toRequirements(status: PasswordValidationStatus): Requirement[] {
  const min = status.passwordPolicy?.customStrengthOptions?.minPasswordLength ?? 6;
  const rules: [boolean | undefined, string][] = [
    [status.meetsMinPasswordLength, `Al menos ${min} caracteres`],
    [status.containsUppercaseLetter, 'Una letra mayúscula'],
    [status.containsLowercaseLetter, 'Una letra minúscula'],
    [status.containsNumericCharacter, 'Un número'],
    [status.containsNonAlphanumericCharacter, 'Un símbolo'],
  ];
  return rules.filter(([met]) => met !== undefined).map(([met, label]) => ({ label, met: met as boolean }));
}

@Component({
  selector: 'app-password-requirements',
  templateUrl: './password-requirements.component.html',
  styleUrls: ['./password-requirements.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PasswordRequirementsComponent implements OnChanges {
  @Input() password = '';
  // The password meets the policy; null when the policy couldn't be fetched.
  @Output() validityChange = new EventEmitter<boolean | null>();
  items: Requirement[] = FALLBACK;
  private latest = 0;

  constructor(private authService: AuthService) {}

  ngOnChanges(): void {
    this.check(this.password ?? '');
  }

  private async check(password: string): Promise<void> {
    // Answers can arrive out of order while the user types; keep the newest.
    const request = ++this.latest;
    try {
      const status = await this.authService.checkPassword(password);
      if (request !== this.latest) {
        return;
      }
      this.items = toRequirements(status);
      this.validityChange.emit(status.isValid);
    } catch {
      if (request !== this.latest) {
        return;
      }
      this.items = FALLBACK;
      this.validityChange.emit(null);
    }
  }
}
```

`auth/components/password-requirements/password-requirements.component.html`:

```html
<ul class="password-requirements" aria-live="polite">
  @for (item of items; track item.label) {
    <li class="requirement" [class.met]="item.met === true" [class.unmet]="item.met === false">
      <span class="mark" aria-hidden="true">{{ item.met === true ? '✓' : '•' }}</span>
      <span class="label">{{ item.label }}</span>
    </li>
  }
</ul>
```

`auth/components/password-requirements/password-requirements.component.scss`:

```scss
.password-requirements {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  font-size: 13px;
  color: #767676;
}

.requirement {
  display: flex;
  gap: 6px;
}

.requirement.met {
  color: #7fa20b;
}
```

In `auth/auth.module.ts`, add `import { PasswordRequirementsComponent } from './components/password-requirements/password-requirements.component';` and add `PasswordRequirementsComponent,` to `declarations`.

- [ ] **Step 5: Run to verify they pass**

Run the Step 2 command. Expected: 5 pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/evamed/src/app/core/services/auth.service.ts frontend/evamed/src/app/auth/components/password-requirements/ frontend/evamed/src/app/auth/auth.module.ts
git commit -m "feat(auth): live checklist of Firebase's password policy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Sign-up uses the policy

**Files:**
- Modify: `auth/components/register/register.component.ts`, `register.component.html`, `register.component.spec.ts`

**Interfaces:**
- Consumes, from Task 1: `<app-password-requirements [password] (validityChange)>`.
- Produces: `RegisterComponent.passwordPolicyMet: boolean | null`.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('RegisterComponent sign-up', …)` block in `register.component.spec.ts`:

```typescript
  const signUp = (createUser: () => Promise<unknown>) => {
    const component: any = Object.create(RegisterComponent.prototype);
    component.form = {
      valid: true,
      value: {
        name: 'Ana', email: 'ana@example.com', institution: 'Ibero', sector: 'Academia',
        country: 1, password: 'Correcta12345', password2: 'Correcta12345',
      },
    };
    component.authService = {
      createUser: vi.fn(createUser),
      verifyEmail: vi.fn(async () => undefined),
      deleteCurrentUser: vi.fn(async () => undefined),
    };
    component.user = { addUser: vi.fn(() => of({})) };
    component.snackBar = { open: vi.fn() };
    component.router = { navigate: vi.fn() };
    return component;
  };

  it('does not sign up while the password misses the policy', async () => {
    const component = signUp(async () => ({}));
    component.passwordPolicyMet = false;

    component.register(new Event('submit'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(component.authService.createUser).not.toHaveBeenCalled();
  });

  it('explains a password Firebase rejects for the policy', async () => {
    const component = signUp(async () => {
      throw Object.assign(new Error('rejected'), { code: 'auth/password-does-not-meet-requirements' });
    });

    component.register(new Event('submit'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(component.snackBar.open).toHaveBeenCalledWith('La contraseña no cumple los requisitos.', 'OK', { duration: 4000 });
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/auth/components/register/register.component.spec.ts`. Expected:
- `does not sign up…` fails, because `createUser` was called;
- `explains a password…` fails, because the snackbar got `Error al registrar el usuario. Intenta nuevamente.`

- [ ] **Step 3: Implement**

In `register.component.ts`:
- add the field `passwordPolicyMet: boolean | null = null;` after `catalogoPaises: any;`;
- in `buildForm()`, change both `password: ['', [Validators.required, Validators.minLength(8)]],` and `password2: ['', [Validators.required, Validators.minLength(8)]],` to `[Validators.required]` (Firebase's policy replaces the length rule);
- in `register()`, change `if (!this.form.valid) {` to `if (!this.form.valid || this.passwordPolicyMet === false) {`;
- in the `.catch(error => {…})` block, replace the `const message = …;` statement with:

```typescript
        const message = error?.code === 'auth/email-already-in-use'
          ? 'El correo ya está registrado, usa otro correo'
          : error?.code === 'auth/password-does-not-meet-requirements' || error?.code === 'auth/weak-password'
            ? 'La contraseña no cumple los requisitos.'
            : 'Error al registrar el usuario. Intenta nuevamente.';
```

In `register.component.html`, replace:

```html
          <div class="input-hint" *ngIf="!(form.get('password').touched && form.get('password').hasError('minlength'))">
            Mínimo 8 caracteres
          </div>
          <div class="input-error" *ngIf="form.get('password').touched && form.get('password').hasError('minlength')">
            La contraseña debe tener al menos 8 caracteres
          </div>
```

with:

```html
          <app-password-requirements
            [password]="form.get('password').value"
            (validityChange)="passwordPolicyMet = $event"
          ></app-password-requirements>
```

and change the submit button's `[disabled]="form.invalid"` to `[disabled]="form.invalid || passwordPolicyMet === false"`.

- [ ] **Step 4: Run to verify they pass, then the full suite**

Run the Step 2 command (expected: 4 pass), then `npx -y -p node@22 -- npm test -- --watch=false` (expected: all green).

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/auth/components/register/
git commit -m "feat(auth): sign-up follows Firebase's password policy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The verification-link handler

**Files:**
- Modify: `core/services/auth.service.ts`
- Create: `auth/components/email-action/action-errors.ts`, `verify-email-action.component.ts`, `.html`, `.spec.ts`
- Modify: `auth/auth.module.ts`

**Interfaces:**
- Produces:
  - `AuthService.applyActionCode(code: string): Promise<void>`
  - `AuthService.checkActionCode(code: string): Promise<{ email: string }>`
  - `AuthService.verifyPasswordResetCode(code: string): Promise<string>`
  - `AuthService.confirmPasswordReset(code: string, newPassword: string): Promise<void>`
  - `isUnusableLink(error: unknown): boolean`
  - `VerifyEmailActionComponent`, selector `app-verify-email-action`, `@Input() oobCode: string`
  - `AUTO_ENTER_MS = 2_000`
- Consumes: the existing `AuthService.hasUser()` and `refreshVerification(): Promise<boolean>`.

- [ ] **Step 1: Write the failing tests**

`auth/components/email-action/verify-email-action.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthModule } from '../../auth.module';
import { VerifyEmailActionComponent } from './verify-email-action.component';

describe('VerifyEmailActionComponent', () => {
  const signedIn = { email: 'ana@example.com' };
  const spent = Object.assign(new Error('spent'), { code: 'auth/invalid-action-code' });

  const setup = (overrides: Record<string, unknown> = {}, user: unknown = signedIn) => {
    const auth = {
      hasUser: () => of(user),
      applyActionCode: vi.fn(async () => undefined),
      refreshVerification: vi.fn(async () => true),
      ...overrides,
    };
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(VerifyEmailActionComponent);
    fixture.componentRef.setInput('oobCode', 'code-123');
    fixture.detectChanges();
    return { fixture, auth, navigate, el: fixture.nativeElement as HTMLElement };
  };

  const settle = async (fixture: { detectChanges(): void }) => {
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
  };

  it('confirms the email with the code from the link', async () => {
    const { fixture, auth } = setup();
    await settle(fixture);

    expect(auth.applyActionCode).toHaveBeenCalledWith('code-123');
  });

  it('takes a signed-in user into the platform 2 s after verifying', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, auth, navigate, el } = setup();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      expect(el.textContent).toContain('¡Correo verificado!');
      expect(auth.refreshVerification).toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2_000);
      expect(navigate).toHaveBeenCalledWith(['/']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('enters at once with Entrar ahora, and only once', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, navigate, el } = setup();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      (el.querySelector('.action-enter') as HTMLButtonElement).click();
      await vi.advanceTimersByTimeAsync(2_000);

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not navigate after the page is left', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, navigate } = setup();
      await vi.advanceTimersByTimeAsync(0);

      fixture.destroy();
      await vi.advanceTimersByTimeAsync(2_000);

      expect(navigate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits for a saved session to be restored before deciding', async () => {
    const user$ = new Subject<unknown>();
    const { fixture, auth, el } = setup({ hasUser: () => user$ });
    await settle(fixture);
    expect(auth.applyActionCode).not.toHaveBeenCalled();

    user$.next(signedIn);
    await settle(fixture);

    expect(el.querySelector('.action-enter')).not.toBeNull();
  });

  it('offers sign-in when nobody is signed in here', async () => {
    const { fixture, auth, navigate, el } = setup({}, null);
    await settle(fixture);

    expect(el.textContent).toContain('¡Correo verificado!');
    expect(auth.refreshVerification).not.toHaveBeenCalled();
    (el.querySelector('.action-login') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('goes straight in when an already verified user reopens a used link', async () => {
    const { fixture, navigate } = setup({ applyActionCode: vi.fn(async () => { throw spent; }) });
    await settle(fixture);

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('offers a new verification email when the link is spent and the user is still unverified', async () => {
    const { fixture, navigate, el } = setup({
      applyActionCode: vi.fn(async () => { throw spent; }),
      refreshVerification: vi.fn(async () => false),
    });
    await settle(fixture);

    expect(el.textContent).toContain('Este enlace ya no es válido.');
    (el.querySelector('.action-resend') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/auth/verify-email']);
  });

  it('offers sign-in for a spent link when nobody is signed in', async () => {
    const expired = Object.assign(new Error('expired'), { code: 'auth/expired-action-code' });
    const { fixture, el } = setup({ applyActionCode: vi.fn(async () => { throw expired; }) }, null);
    await settle(fixture);

    expect(el.textContent).toContain('Este enlace ya no es válido.');
    expect(el.querySelector('.action-login')).not.toBeNull();
  });

  it('lets the user retry when Firebase cannot be reached', async () => {
    const offline = Object.assign(new Error('offline'), { code: 'auth/network-request-failed' });
    const applyActionCode = vi.fn().mockRejectedValueOnce(offline).mockResolvedValue(undefined);
    const { fixture, el } = setup({ applyActionCode }, null);
    await settle(fixture);
    expect(el.textContent).toContain('No pudimos completar la acción. Intenta nuevamente.');

    (el.querySelector('.action-retry') as HTMLButtonElement).click();
    await settle(fixture);

    expect(applyActionCode).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('¡Correo verificado!');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/auth/components/email-action/verify-email-action.component.spec.ts`. Expected: a compile error, `Could not resolve "./verify-email-action.component"`.

- [ ] **Step 3: Add the AuthService wrappers**

In `core/services/auth.service.ts`, add `applyActionCode`, `checkActionCode`, `confirmPasswordReset` and `verifyPasswordResetCode` to the `firebase/auth` import list. Then add these methods after `checkPassword()`:

```typescript
  // Email action links (/auth/action): Firebase's one-time oobCode.
  applyActionCode(code: string): Promise<void> {
    return applyActionCode(this.auth, code);
  }

  // recoverEmail links: the address the account is being restored to.
  async checkActionCode(code: string): Promise<{ email: string }> {
    const info = await checkActionCode(this.auth, code);
    return { email: info.data.email ?? '' };
  }

  // resetPassword links: resolves to the account's email.
  verifyPasswordResetCode(code: string): Promise<string> {
    return verifyPasswordResetCode(this.auth, code);
  }

  confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    return confirmPasswordReset(this.auth, code, newPassword);
  }
```

- [ ] **Step 4: Write the error helper and the component**

`auth/components/email-action/action-errors.ts`:

```typescript
// Codes Firebase returns for an email link that can't be used any more:
// spent, expired, malformed, or for an account that no longer exists.
const UNUSABLE = new Set([
  'auth/invalid-action-code',
  'auth/expired-action-code',
  'auth/user-disabled',
  'auth/user-not-found',
]);

export function isUnusableLink(error: unknown): boolean {
  return UNUSABLE.has((error as { code?: string } | null)?.code ?? '');
}
```

`auth/components/email-action/verify-email-action.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { isUnusableLink } from './action-errors';

export const AUTO_ENTER_MS = 2_000;

// mode=verifyEmail: confirm the address, then straight into the platform.
@Component({
  selector: 'app-verify-email-action',
  templateUrl: './verify-email-action.component.html',
  styleUrls: ['../recover-password/recover-password/recover-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class VerifyEmailActionComponent implements OnInit, OnDestroy {
  @Input() oobCode = '';
  state: 'working' | 'done' | 'invalid' | 'error' = 'working';
  signedIn = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.run();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  async run(): Promise<void> {
    this.state = 'working';
    // hasUser() emits once Firebase has restored a saved session (fresh tab, F5).
    const user = await firstValueFrom(this.authService.hasUser());
    this.signedIn = !!user;
    try {
      await this.authService.applyActionCode(this.oobCode);
    } catch (error) {
      if (isUnusableLink(error)) {
        await this.linkNoLongerValid();
      } else {
        this.state = 'error';
      }
      return;
    }
    this.state = 'done';
    if (this.signedIn) {
      // Make the token say verified first, so their projects load at once.
      await this.authService.refreshVerification().catch(() => false);
      this.timer = setTimeout(() => this.enter(), AUTO_ENTER_MS);
    }
  }

  // A spent link usually means they already verified: then just go in.
  private async linkNoLongerValid(): Promise<void> {
    if (this.signedIn && (await this.authService.refreshVerification().catch(() => false))) {
      this.enter();
      return;
    }
    this.state = 'invalid';
  }

  enter(): void {
    this.stopTimer();
    this.router.navigate(['/']);
  }

  login(): void {
    this.router.navigate(['/auth/login']);
  }

  resend(): void {
    this.router.navigate(['/auth/verify-email']);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
```

`auth/components/email-action/verify-email-action.component.html`:

```html
@switch (state) {
  @case ('working') {
    <div class="container-label-input">
      <div class="title-context-login">Verificando tu correo…</div>
    </div>
  }
  @case ('done') {
    <div class="container-label-input">
      <div class="title-context-login">¡Correo verificado!</div>
      <div class="description-context-login">
        {{ signedIn ? 'Te llevamos a EVAmed…' : 'Ya puedes iniciar sesión.' }}
      </div>
    </div>
    <div class="container-label-button">
      @if (signedIn) {
        <button mat-raised-button type="button" class="yellow-button-login action-enter" (click)="enter()">Entrar ahora</button>
      } @else {
        <button mat-raised-button type="button" class="yellow-button-login action-login" (click)="login()">Iniciar sesión</button>
      }
    </div>
  }
  @case ('invalid') {
    <div class="container-label-input">
      <div class="title-context-login">Este enlace ya no es válido.</div>
    </div>
    <div class="container-label-button">
      @if (signedIn) {
        <button mat-raised-button type="button" class="yellow-button-login action-resend" (click)="resend()">Reenviar correo de verificación</button>
      } @else {
        <button mat-raised-button type="button" class="yellow-button-login action-login" (click)="login()">Iniciar sesión</button>
      }
    </div>
  }
  @case ('error') {
    <div class="container-label-input">
      <div class="title-context-login">No pudimos completar la acción. Intenta nuevamente.</div>
    </div>
    <div class="container-label-button">
      <button mat-raised-button type="button" class="yellow-button-login action-retry" (click)="run()">Reintentar</button>
    </div>
  }
}
```

In `auth/auth.module.ts`, add `import { VerifyEmailActionComponent } from './components/email-action/verify-email-action.component';` and add `VerifyEmailActionComponent,` to `declarations`.

- [ ] **Step 5: Run to verify they pass**

Run the Step 2 command. Expected: 10 pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/evamed/src/app/core/services/auth.service.ts frontend/evamed/src/app/auth/components/email-action/ frontend/evamed/src/app/auth/auth.module.ts
git commit -m "feat(auth): EVAmed's own handler for email verification links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The password-reset handler

**Files:**
- Create: `auth/components/email-action/reset-password-action.component.ts`, `.html`, `.spec.ts`
- Modify: `auth/auth.module.ts`

**Interfaces:**
- Consumes:
  - from Task 3: `AuthService.verifyPasswordResetCode`, `AuthService.confirmPasswordReset`, `isUnusableLink`;
  - from Task 1: `app-password-requirements`;
  - existing: `AuthService.login(email, password)`.
- Produces: `ResetPasswordActionComponent`, selector `app-reset-password-action`, `@Input() oobCode: string`.

- [ ] **Step 1: Write the failing tests**

`auth/components/email-action/reset-password-action.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthModule } from '../../auth.module';
import { ResetPasswordActionComponent } from './reset-password-action.component';

describe('ResetPasswordActionComponent', () => {
  const valid = { isValid: true, meetsMinPasswordLength: true, passwordPolicy: { customStrengthOptions: { minPasswordLength: 12 } } };
  const invalid = { isValid: false, meetsMinPasswordLength: false, passwordPolicy: { customStrengthOptions: { minPasswordLength: 12 } } };
  const failing = (code: string) => async () => { throw Object.assign(new Error(code), { code }); };

  const setup = (overrides: Record<string, unknown> = {}) => {
    const auth = {
      verifyPasswordResetCode: vi.fn(async () => 'ana@example.com'),
      confirmPasswordReset: vi.fn(async () => undefined),
      login: vi.fn(async () => ({})),
      checkPassword: vi.fn(async () => valid),
      ...overrides,
    };
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ResetPasswordActionComponent);
    fixture.componentRef.setInput('oobCode', 'code-123');
    fixture.detectChanges();
    return { fixture, auth, navigate, el: fixture.nativeElement as HTMLElement };
  };

  const settle = async (fixture: ComponentFixture<unknown>) => {
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
  };

  const fill = async (fixture: ComponentFixture<ResetPasswordActionComponent>, password: string, password2 = password) => {
    fixture.componentInstance.form.setValue({ password, password2 });
    fixture.detectChanges();
    await settle(fixture);
  };

  beforeEach(() => localStorage.removeItem('email-login'));
  afterEach(() => localStorage.removeItem('email-login'));

  it("shows the form for the link's account", async () => {
    const { fixture, auth, el } = setup();
    await settle(fixture);

    expect(auth.verifyPasswordResetCode).toHaveBeenCalledWith('code-123');
    expect(el.textContent).toContain('ana@example.com');
    expect(el.querySelector('app-password-requirements')).not.toBeNull();
  });

  it('saves, signs in with the new password and enters the platform', async () => {
    const { fixture, auth, navigate } = setup();
    await settle(fixture);
    await fill(fixture, 'NuevaClave123');

    await fixture.componentInstance.save();

    expect(auth.confirmPasswordReset).toHaveBeenCalledWith('code-123', 'NuevaClave123');
    expect(auth.login).toHaveBeenCalledWith('ana@example.com', 'NuevaClave123');
    expect(localStorage.getItem('email-login')).toBe('ana@example.com');
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('does not save when the passwords differ', async () => {
    const { fixture, auth, el } = setup();
    await settle(fixture);
    await fill(fixture, 'NuevaClave123', 'OtraClave123');

    await fixture.componentInstance.save();

    expect(auth.confirmPasswordReset).not.toHaveBeenCalled();
    expect(el.querySelector('.reset-mismatch')?.textContent).toContain('Las contraseñas no coinciden');
  });

  it('does not save while the password misses the policy', async () => {
    const { fixture, auth, el } = setup({ checkPassword: vi.fn(async () => invalid) });
    await settle(fixture);
    await fill(fixture, 'corta');

    await fixture.componentInstance.save();

    expect(auth.confirmPasswordReset).not.toHaveBeenCalled();
    expect((el.querySelector('.action-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves once however often Guardar is pressed', async () => {
    const confirmPasswordReset = vi.fn(() => new Promise<void>(() => undefined));
    const { fixture } = setup({ confirmPasswordReset });
    await settle(fixture);
    await fill(fixture, 'NuevaClave123');

    fixture.componentInstance.save();
    fixture.componentInstance.save();

    expect(confirmPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('says the password was updated when the automatic sign-in fails', async () => {
    const { fixture, navigate, el } = setup({ login: vi.fn(failing('auth/network-request-failed')) });
    await settle(fixture);
    await fill(fixture, 'NuevaClave123');

    await fixture.componentInstance.save();
    await settle(fixture);

    expect(el.textContent).toContain('Contraseña actualizada');
    (el.querySelector('.action-login') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('explains a password Firebase rejects and keeps it', async () => {
    const { fixture, el } = setup({ confirmPasswordReset: vi.fn(failing('auth/password-does-not-meet-requirements')) });
    await settle(fixture);
    await fill(fixture, 'NuevaClave123');

    await fixture.componentInstance.save();
    await settle(fixture);

    expect(el.querySelector('.reset-password-error')?.textContent).toContain('La contraseña no cumple los requisitos.');
    expect(fixture.componentInstance.form.value.password).toBe('NuevaClave123');
  });

  it('keeps the form and says so when saving fails', async () => {
    const { fixture, el } = setup({ confirmPasswordReset: vi.fn(failing('auth/network-request-failed')) });
    await settle(fixture);
    await fill(fixture, 'NuevaClave123');

    await fixture.componentInstance.save();
    await settle(fixture);

    expect(el.querySelector('.reset-save-error')?.textContent).toContain('No se pudo guardar. Intenta nuevamente.');
    expect(el.querySelector('.action-save')).not.toBeNull();
  });

  it('offers a new link when this one is spent', async () => {
    const { fixture, navigate, el } = setup({ verifyPasswordResetCode: vi.fn(failing('auth/expired-action-code')) });
    await settle(fixture);

    expect(el.textContent).toContain('Este enlace para restablecer la contraseña ya no es válido.');
    (el.querySelector('.action-request') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/auth/recover-password']);
  });

  it('lets the user retry when Firebase cannot be reached', async () => {
    const verifyPasswordResetCode = vi.fn()
      .mockImplementationOnce(failing('auth/network-request-failed'))
      .mockResolvedValue('ana@example.com');
    const { fixture, el } = setup({ verifyPasswordResetCode });
    await settle(fixture);

    (el.querySelector('.action-retry') as HTMLButtonElement).click();
    await settle(fixture);

    expect(verifyPasswordResetCode).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('ana@example.com');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/auth/components/email-action/reset-password-action.component.spec.ts`. Expected: a compile error, `Could not resolve "./reset-password-action.component"`.

- [ ] **Step 3: Write the component**

`auth/components/email-action/reset-password-action.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/services/auth.service';
import { isUnusableLink } from './action-errors';

// mode=resetPassword: choose a new password, then straight into the platform.
@Component({
  selector: 'app-reset-password-action',
  templateUrl: './reset-password-action.component.html',
  styleUrls: ['../recover-password/recover-password/recover-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ResetPasswordActionComponent implements OnInit {
  @Input() oobCode = '';
  state: 'checking' | 'form' | 'saving' | 'saved' | 'invalid' | 'error' = 'checking';
  email = '';
  form: UntypedFormGroup;
  // Firebase's password policy is met; null when it couldn't be fetched.
  policyMet: boolean | null = null;
  passwordError: string | null = null;
  saveError: string | null = null;

  constructor(
    formBuilder: UntypedFormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = formBuilder.group({
      password: ['', [Validators.required]],
      password2: ['', [Validators.required]],
    });
  }

  get mismatch(): boolean {
    const { password, password2 } = this.form.value;
    return !!password2 && password !== password2;
  }

  ngOnInit(): void {
    this.check();
  }

  async check(): Promise<void> {
    this.state = 'checking';
    try {
      this.email = await this.authService.verifyPasswordResetCode(this.oobCode);
      this.state = 'form';
    } catch (error) {
      this.state = isUnusableLink(error) ? 'invalid' : 'error';
    }
  }

  async save(): Promise<void> {
    const { password, password2 } = this.form.value;
    if (this.state !== 'form' || !password || password !== password2 || this.policyMet === false) {
      return;
    }
    this.state = 'saving';
    this.passwordError = null;
    this.saveError = null;
    try {
      await this.authService.confirmPasswordReset(this.oobCode, password);
    } catch (error) {
      if (isUnusableLink(error)) {
        this.state = 'invalid';
        return;
      }
      this.state = 'form';
      const code = (error as { code?: string } | null)?.code;
      if (code === 'auth/password-does-not-meet-requirements' || code === 'auth/weak-password') {
        this.passwordError = 'La contraseña no cumple los requisitos.';
      } else {
        this.saveError = 'No se pudo guardar. Intenta nuevamente.';
      }
      return;
    }
    try {
      await this.authService.login(this.email, password);
      // The platform finds the profile by this key, as after login.
      localStorage.setItem('email-login', this.email);
      this.router.navigate(['/']);
    } catch {
      this.state = 'saved';
    }
  }

  login(): void {
    this.router.navigate(['/auth/login']);
  }

  requestNewLink(): void {
    this.router.navigate(['/auth/recover-password']);
  }
}
```

`auth/components/email-action/reset-password-action.component.html`:

```html
@switch (state) {
  @case ('checking') {
    <div class="container-label-input">
      <div class="title-context-login">Comprobando el enlace…</div>
    </div>
  }
  @case ('invalid') {
    <div class="container-label-input">
      <div class="title-context-login">Este enlace para restablecer la contraseña ya no es válido.</div>
    </div>
    <div class="container-label-button">
      <button mat-raised-button type="button" class="yellow-button-login action-request" (click)="requestNewLink()">Solicitar otro enlace</button>
    </div>
  }
  @case ('error') {
    <div class="container-label-input">
      <div class="title-context-login">No pudimos completar la acción. Intenta nuevamente.</div>
    </div>
    <div class="container-label-button">
      <button mat-raised-button type="button" class="yellow-button-login action-retry" (click)="check()">Reintentar</button>
    </div>
  }
  @case ('saved') {
    <div class="container-label-input">
      <div class="title-context-login">Contraseña actualizada</div>
    </div>
    <div class="container-label-button">
      <button mat-raised-button type="button" class="yellow-button-login action-login" (click)="login()">Iniciar sesión</button>
    </div>
  }
  @default {
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="container-label-input">
        <div class="title-context-login">Restablecer contraseña</div>
        <div class="description-context-login">
          Elige una nueva contraseña para <strong>{{ email }}</strong>.
        </div>
        <div class="label-context-login">Nueva contraseña</div>
        <input class="input-context-login reset-password" formControlName="password" type="password" autocomplete="new-password">
        <app-password-requirements
          [password]="form.value.password"
          (validityChange)="policyMet = $event"
        ></app-password-requirements>
        @if (passwordError) {
          <div class="input-error reset-password-error">{{ passwordError }}</div>
        }
        <div class="label-context-login">Confirmar contraseña</div>
        <input class="input-context-login reset-password2" formControlName="password2" type="password" autocomplete="new-password">
        @if (mismatch) {
          <div class="input-error reset-mismatch">Las contraseñas no coinciden</div>
        }
        @if (saveError) {
          <div class="input-error reset-save-error">{{ saveError }}</div>
        }
      </div>
      <div class="container-label-button">
        <button
          mat-raised-button
          type="submit"
          class="yellow-button-login action-save"
          [disabled]="state === 'saving' || form.invalid || mismatch || policyMet === false"
        >Guardar</button>
      </div>
    </form>
  }
}
```

In `auth/auth.module.ts`, add `import { ResetPasswordActionComponent } from './components/email-action/reset-password-action.component';` and add `ResetPasswordActionComponent,` to `declarations`.

- [ ] **Step 4: Run to verify they pass**

Run the Step 2 command. Expected: 10 pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/auth/components/email-action/ frontend/evamed/src/app/auth/auth.module.ts
git commit -m "feat(auth): EVAmed's own password-reset page with the policy checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The email-change undo handler

**Files:**
- Create: `auth/components/email-action/recover-email-action.component.ts`, `.html`, `.spec.ts`
- Modify: `auth/auth.module.ts`

**Interfaces:**
- Consumes:
  - from Task 3: `AuthService.checkActionCode`, `AuthService.applyActionCode`, `isUnusableLink`;
  - existing: `AuthService.resetPassword(email)`.
- Produces: `RecoverEmailActionComponent`, selector `app-recover-email-action`, `@Input() oobCode: string`.

- [ ] **Step 1: Write the failing tests**

`auth/components/email-action/recover-email-action.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthModule } from '../../auth.module';
import { RecoverEmailActionComponent } from './recover-email-action.component';

describe('RecoverEmailActionComponent', () => {
  const failing = (code: string) => async () => { throw Object.assign(new Error(code), { code }); };

  const setup = (overrides: Record<string, unknown> = {}) => {
    const auth = {
      checkActionCode: vi.fn(async () => ({ email: 'ana@example.com' })),
      applyActionCode: vi.fn(async () => undefined),
      resetPassword: vi.fn(async () => undefined),
      ...overrides,
    };
    const snackBar = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }, { provide: MatSnackBar, useValue: snackBar }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RecoverEmailActionComponent);
    fixture.componentRef.setInput('oobCode', 'code-123');
    fixture.detectChanges();
    return { fixture, auth, snackBar, navigate, el: fixture.nativeElement as HTMLElement };
  };

  const settle = async (fixture: ComponentFixture<unknown>) => {
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
  };

  it('restores the email and says which one', async () => {
    const { fixture, auth, el } = setup();
    await settle(fixture);

    expect(auth.checkActionCode).toHaveBeenCalledWith('code-123');
    expect(auth.applyActionCode).toHaveBeenCalledWith('code-123');
    expect(el.textContent).toContain('Restauramos tu correo');
    expect(el.textContent).toContain('ana@example.com');
  });

  it('sends a password reset to the restored email', async () => {
    const { fixture, auth, snackBar, el } = setup();
    await settle(fixture);

    (el.querySelector('.action-reset') as HTMLButtonElement).click();
    await settle(fixture);

    expect(auth.resetPassword).toHaveBeenCalledWith('ana@example.com');
    expect(snackBar.open).toHaveBeenCalledWith('Te enviamos un correo para restablecer tu contraseña.', 'OK', { duration: 4000 });
  });

  it('reports a reset email that could not be sent', async () => {
    const { fixture, snackBar, el } = setup({ resetPassword: vi.fn(failing('auth/too-many-requests')) });
    await settle(fixture);

    (el.querySelector('.action-reset') as HTMLButtonElement).click();
    await settle(fixture);

    expect(snackBar.open).toHaveBeenCalledWith('No se pudo enviar el correo. Intenta nuevamente.', 'OK', { duration: 4000 });
  });

  it('offers sign-in for a spent link', async () => {
    const { fixture, navigate, el } = setup({ checkActionCode: vi.fn(failing('auth/invalid-action-code')) });
    await settle(fixture);

    expect(el.textContent).toContain('Este enlace ya no es válido.');
    (el.querySelector('.action-login') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('lets the user retry when Firebase cannot be reached', async () => {
    const checkActionCode = vi.fn()
      .mockImplementationOnce(failing('auth/network-request-failed'))
      .mockResolvedValue({ email: 'ana@example.com' });
    const { fixture, el } = setup({ checkActionCode });
    await settle(fixture);

    (el.querySelector('.action-retry') as HTMLButtonElement).click();
    await settle(fixture);

    expect(checkActionCode).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Restauramos tu correo');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/auth/components/email-action/recover-email-action.component.spec.ts`. Expected: a compile error, `Could not resolve "./recover-email-action.component"`.

- [ ] **Step 3: Write the component**

`auth/components/email-action/recover-email-action.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/services/auth.service';
import { isUnusableLink } from './action-errors';

// mode=recoverEmail: undo an email change. EVAmed never changes emails, so
// this is rare; Firebase recommends offering a password reset afterwards.
@Component({
  selector: 'app-recover-email-action',
  templateUrl: './recover-email-action.component.html',
  styleUrls: ['../recover-password/recover-password/recover-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class RecoverEmailActionComponent implements OnInit {
  @Input() oobCode = '';
  state: 'working' | 'done' | 'invalid' | 'error' = 'working';
  email = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.run();
  }

  async run(): Promise<void> {
    this.state = 'working';
    try {
      this.email = (await this.authService.checkActionCode(this.oobCode)).email;
      await this.authService.applyActionCode(this.oobCode);
      this.state = 'done';
    } catch (error) {
      this.state = isUnusableLink(error) ? 'invalid' : 'error';
    }
  }

  sendReset(): void {
    this.authService
      .resetPassword(this.email)
      .then(() => {
        this.snackBar.open('Te enviamos un correo para restablecer tu contraseña.', 'OK', { duration: 4000 });
      })
      .catch(() => {
        this.snackBar.open('No se pudo enviar el correo. Intenta nuevamente.', 'OK', { duration: 4000 });
      });
  }

  login(): void {
    this.router.navigate(['/auth/login']);
  }
}
```

`auth/components/email-action/recover-email-action.component.html`:

```html
@switch (state) {
  @case ('working') {
    <div class="container-label-input">
      <div class="title-context-login">Restaurando tu correo…</div>
    </div>
  }
  @case ('done') {
    <div class="container-label-input">
      <div class="title-context-login">Restauramos tu correo</div>
      <div class="description-context-login">
        Tu cuenta vuelve a usar <strong>{{ email }}</strong>.
        Si no pediste este cambio, restablece tu contraseña.
      </div>
    </div>
    <div class="container-label-button">
      <button mat-raised-button type="button" class="yellow-button-login action-reset" (click)="sendReset()">Restablecer contraseña</button>
    </div>
    <div class="container-label-button">
      <button mat-raised-button type="button" class="yellow-button-login action-login" (click)="login()">Iniciar sesión</button>
    </div>
  }
  @case ('invalid') {
    <div class="container-label-input">
      <div class="title-context-login">Este enlace ya no es válido.</div>
    </div>
    <div class="container-label-button">
      <button mat-raised-button type="button" class="yellow-button-login action-login" (click)="login()">Iniciar sesión</button>
    </div>
  }
  @case ('error') {
    <div class="container-label-input">
      <div class="title-context-login">No pudimos completar la acción. Intenta nuevamente.</div>
    </div>
    <div class="container-label-button">
      <button mat-raised-button type="button" class="yellow-button-login action-retry" (click)="run()">Reintentar</button>
    </div>
  }
}
```

In `auth/auth.module.ts`, add `import { RecoverEmailActionComponent } from './components/email-action/recover-email-action.component';` and add `RecoverEmailActionComponent,` to `declarations`.

- [ ] **Step 4: Run to verify they pass**

Run the Step 2 command. Expected: 5 pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/auth/components/email-action/ frontend/evamed/src/app/auth/auth.module.ts
git commit -m "feat(auth): handle email-change undo links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The `/auth/action` page

**Files:**
- Create: `auth/components/email-action/email-action.component.ts`, `.html`, `.spec.ts`
- Modify: `auth/auth.module.ts`, `auth/auth-routing.module.ts`

**Interfaces:**
- Consumes, from Tasks 3–5: `app-verify-email-action`, `app-reset-password-action`, `app-recover-email-action`, each with `[oobCode]`.
- Produces: the route `auth/action` → `EmailActionComponent`.

- [ ] **Step 1: Write the failing tests**

`auth/components/email-action/email-action.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router, RouterModule, ROUTES } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthRoutingModule } from '../../auth-routing.module';
import { AuthModule } from '../../auth.module';
import { EmailActionComponent } from './email-action.component';

describe('EmailActionComponent', () => {
  const never = () => new Promise<never>(() => undefined);

  const setup = (params: Record<string, string>) => {
    const auth = {
      hasUser: () => of(null),
      applyActionCode: vi.fn(never),
      checkActionCode: vi.fn(never),
      verifyPasswordResetCode: vi.fn(never),
      checkPassword: vi.fn(never),
    };
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(EmailActionComponent);
    fixture.detectChanges();
    return { navigate, el: fixture.nativeElement as HTMLElement };
  };

  it.each([
    ['verifyEmail', 'app-verify-email-action'],
    ['resetPassword', 'app-reset-password-action'],
    ['recoverEmail', 'app-recover-email-action'],
  ])('shows the handler for mode=%s', (mode, selector) => {
    const { el } = setup({ mode, oobCode: 'code-123' });

    expect(el.querySelector(selector)).not.toBeNull();
    expect(el.querySelector('.action-invalid')).toBeNull();
  });

  it.each([
    [{ mode: 'verifyEmail' }],
    [{ oobCode: 'code-123' }],
    [{ mode: 'signIn', oobCode: 'code-123' }],
  ])('says the link is not valid for %o', params => {
    const { el } = setup(params);

    expect(el.querySelector('.action-invalid')?.textContent).toContain('Este enlace ya no es válido.');
  });

  it('offers sign-in from an invalid link', () => {
    const { el, navigate } = setup({});

    (el.querySelector('.action-login') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});

// Firebase's email links must reach this page signed out or unverified.
describe('auth routes', () => {
  it('serve the email action page at /auth/action, unguarded', () => {
    TestBed.configureTestingModule({ imports: [RouterModule.forRoot([]), AuthRoutingModule] });

    const route = TestBed.inject(ROUTES).flat().find(candidate => candidate.path === 'action');

    expect(route?.component).toBe(EmailActionComponent);
    expect(route?.canActivate ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/auth/components/email-action/email-action.component.spec.ts`. Expected: a compile error, `Could not resolve "./email-action.component"`.

- [ ] **Step 3: Write the component**

`auth/components/email-action/email-action.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

const MODES = ['verifyEmail', 'resetPassword', 'recoverEmail'];

// Where Firebase's email links land (custom action URL, set in the Firebase
// console). Firebase appends mode and oobCode; each mode has its own handler.
@Component({
  selector: 'app-email-action',
  templateUrl: './email-action.component.html',
  styleUrls: [
    '../recover-password/recover-password/recover-password.component.scss',
    '../verify-email/verify-email.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EmailActionComponent {
  readonly mode: string | null;
  readonly oobCode: string | null;

  constructor(
    route: ActivatedRoute,
    private router: Router
  ) {
    const params = route.snapshot.queryParamMap;
    this.mode = params.get('mode');
    this.oobCode = params.get('oobCode');
  }

  get handled(): boolean {
    return !!this.oobCode && MODES.includes(this.mode ?? '');
  }

  login(): void {
    this.router.navigate(['/auth/login']);
  }

  about(): void {
    this.router.navigate(['/auth/about']);
  }
}
```

`auth/components/email-action/email-action.component.html`. The side panel and footer are copied from `verify-email.component.html`:

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
con un menor impacto ambiental durante todo su ciclo de vida <button type="button" class="link-button link-button--inline" (click)="about()">Leer más</button>.
          </div>
        </div>
      </section>
    </div>
  </div>
  <div class="main">
    <section class="form-login">
      @if (handled) {
        @switch (mode) {
          @case ('verifyEmail') {
            <app-verify-email-action [oobCode]="oobCode!"></app-verify-email-action>
          }
          @case ('resetPassword') {
            <app-reset-password-action [oobCode]="oobCode!"></app-reset-password-action>
          }
          @case ('recoverEmail') {
            <app-recover-email-action [oobCode]="oobCode!"></app-recover-email-action>
          }
        }
      } @else {
        <div class="container-label-input">
          <div class="title-context-login action-invalid">Este enlace ya no es válido.</div>
        </div>
        <div class="container-label-button">
          <button mat-raised-button type="button" class="yellow-button-login action-login" (click)="login()">Iniciar sesión</button>
        </div>
      }
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

In `auth/auth.module.ts`, add `import { EmailActionComponent } from './components/email-action/email-action.component';` and add `EmailActionComponent,` to `declarations`.

In `auth/auth-routing.module.ts`, add `import { EmailActionComponent } from './components/email-action/email-action.component';` and add this route after the `verify-email` route:

```typescript
  {
    // Firebase's email links (verify, password reset, email-change undo).
    path: 'action',
    component: EmailActionComponent,
  },
```

- [ ] **Step 5: Run to verify they pass, then the full suite and build**

Run:

```bash
npx -y -p node@22 -- npx ng test --watch=false --include src/app/auth/components/email-action/email-action.component.spec.ts
npx -y -p node@22 -- npm test -- --watch=false
npx -y -p node@22 -- npm run build -- --configuration production
```

Expected:
- the first command passes 7;
- the full suite is green;
- the build completes, with the initial total about 1.67 MB (the auth module is lazy, so the new code lands in its chunk).

- [ ] **Step 6: Commit**

```bash
git add frontend/evamed/src/app/auth/components/email-action/ frontend/evamed/src/app/auth/auth.module.ts frontend/evamed/src/app/auth/auth-routing.module.ts
git commit -m "feat(auth): /auth/action receives Firebase's email links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After this plan (order matters)

1. **Merge and deploy to dev.** CI must pass. Then confirm `https://dev.evamediber.click/auth/action` loads and shows "Este enlace ya no es válido." (no code).
2. **Firebase console** (the user; project `evamed-ac3f8`):
   1. Authentication → Templates → (any template) → edit → **Customize action URL** → `https://dev.evamediber.click/auth/action` → Save.
   2. Authentication → Settings → **Password policy**: enforcement **Require**; minimum length **12**; require uppercase, lowercase and numeric; **force upgrade on sign-in OFF**.
   3. Authentication → Settings → Authorized domains: confirm `dev.evamediber.click` is listed.
   4. Optional: Templates → language **Spanish**; sender name "EVAmed".
3. **Click through on dev:**
   - sign up with a fresh email: the checklist works, and a weak password is refused;
   - click the verification link in the same browser (auto-entry), then in another browser (Iniciar sesión);
   - click the link again (straight in);
   - "Recuperar contraseña", then complete the reset: you're signed in automatically.
4. **Rollback:** clear the custom action URL in the console, and Firebase's own page returns.
