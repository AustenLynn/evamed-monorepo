# EVAmed email action page (custom Firebase action handler) — design

**Date:** 2026-10-09
**Status:** approach A and sections 1–2 approved in chat. Section 3 onward was folded into this spec at the user's request ("let's start planning"), and is reviewed with the spec.
**Goal (user):** the page users see after clicking a Firebase email link should be EVAmed's own, branded and in Spanish, and should take them straight into the platform.

## Context

- **Today:** the links in Firebase's emails open Firebase's hosted page on `evamed-ac3f8.firebaseapp.com`, which we can't style.
- **What changes it:** Firebase's **custom action URL** (Authentication → Templates → Customize action URL) points those links at our app instead. The setting is **one URL for every template** (Firebase docs: custom-email-handler), so our page receives three kinds of link:
  - `mode=verifyEmail`, from sign-up / Reenviar correo;
  - `mode=resetPassword`, from `/auth/recover-password` → `AuthService.resetPassword()` → `sendPasswordResetEmail`;
  - `mode=recoverEmail`, from undoing an email change. The app never changes emails (no `updateEmail`/`verifyBeforeUpdateEmail`), so this is handled gracefully but is expected to be rare.
- **Query parameters:** Firebase appends `mode`, `oobCode` (a one-time code), `apiKey`, optional `continueUrl` and optional `lang`. We use `mode` and `oobCode`. `apiKey` is ignored, because the app already initialises Firebase from `environment.firebaseConfig`.
- **Site:** dev is the only deployed site on Firebase project `evamed-ac3f8`. The action URL will be `https://dev.evamediber.click/auth/action`.

## Design (approach A)

One route, `/auth/action`, inside the lazy `AuthModule`. It's **unguarded**, like all of `/auth/*`: the user may not be signed in, or may not be verified yet.

### Structure

- **`EmailActionComponent`** (container, `auth/components/email-action/`) reads `mode` and `oobCode` from the query string and renders one of three child components. Unknown or missing values render the shared "link not valid" state. It carries no Firebase logic.
- **`VerifyEmailActionComponent`, `ResetPasswordActionComponent`, `RecoverEmailActionComponent`** each handle one mode. Each receives `oobCode` as an `@Input()`.
- **`AuthService` gains four thin wrappers**, so components never touch `FIREBASE_AUTH` and tests mock one service:
  - `applyActionCode(code)`
  - `verifyPasswordResetCode(code): Promise<string>`, returning the email
  - `confirmPasswordReset(code, newPassword)`
  - `checkActionCode(code): Promise<{ email: string }>`, the restored email for recoverEmail
- **Look:** the same layout as the other auth pages (green side panel and logo). Spanish copy. Actions are real `<button>`s, like the verify page after its follow-ups.

### 1. `verifyEmail` (approved)

- Shows "Verificando tu correo…", then calls `applyActionCode`.
- **Success:**
  - **Signed in in this browser:** "¡Correo verificado!". The page calls `AuthService.refreshVerification()` so the token says verified, then enters the platform (`/`) after **2 s**, or at once with **Entrar ahora**.
  - **Not signed in:** "¡Correo verificado!" plus **Iniciar sesión** (`/auth/login`).
- **Invalid or expired code** (`auth/invalid-action-code`, `auth/expired-action-code`, or no code):
  - Signed in and still unverified: "Este enlace ya no es válido." plus **Reenviar correo de verificación** (`/auth/verify-email`).
  - Signed in and already verified: straight into the platform, because a used link just means they're done.
  - Not signed in: the same message plus **Iniciar sesión**.

### 2. `resetPassword` (approved)

- `verifyPasswordResetCode` → the account's email. Form: **Nueva contraseña** and **Confirmar contraseña**, at least 8 characters (sign-up's rule) and matching, validated inline. **Guardar**.
- **Save:** `confirmPasswordReset`, then sign in with the new password (`AuthService.login`), set `localStorage['email-login']` as `LoginComponent` does, and go to `/`. If that sign-in fails, show "Contraseña actualizada" plus **Iniciar sesión**.
- **Errors:**
  - Invalid or expired code: "Este enlace para restablecer la contraseña ya no es válido." plus **Solicitar otro enlace** (`/auth/recover-password`).
  - `auth/weak-password`: an inline message, keeping the input.
  - Network or other failure: "No se pudo guardar. Intenta nuevamente.", keeping the form.
  - Double submit is prevented: the button is disabled while saving.

### 3. `recoverEmail` (folded into this spec)

- `checkActionCode` → the restored email, then `applyActionCode`. Shows: "Restauramos tu correo **x@y**." plus **Restablecer contraseña**, which calls `AuthService.resetPassword(email)` (Firebase's recommendation after an email change was undone) with a "Te enviamos un correo…" snackbar. It also offers **Iniciar sesión**.
- Invalid or expired code: the shared "Este enlace ya no es válido." plus **Iniciar sesión**.

### Shared states and errors

- **Loading:** one spinner line per mode while Firebase answers. The buttons appear only once the outcome is known.
- **Firebase unreachable:** "No pudimos completar la acción. Intenta nuevamente." plus **Reintentar**, which re-runs the same call. The code isn't consumed by a failed request.
- **The one-time code stays in the URL only.** It's never logged, stored, or sent to our API.

## Firebase console (after the page is deployed to dev — order matters)

1. Authentication → Templates → (any template) → edit → **Customize action URL** → `https://dev.evamediber.click/auth/action` → Save. It applies to all templates.
2. Authentication → Settings → Authorized domains: confirm `dev.evamediber.click` is listed. It's likely already there, since social sign-in works on dev.
3. Optional: Templates → template language **Spanish**; sender name "EVAmed".

**Rollback:** clear the custom action URL, and Firebase's hosted page returns. Emails sent before the change keep their old links, which keep working.

## Testing

- **Vitest, test-first, with `AuthService` mocked.** One spec per mode component, covering every row above:
  - verify: success signed in (refresh, 2 s auto-continue, immediate button), success signed out, invalid/expired in each signed-in state, missing code, unreachable then Reintentar;
  - reset: form validation, success then signed in, sign-in fails then login button, invalid code, weak password, double submit;
  - recover: success then resend, invalid code.
- **The container:** each `mode` renders the right child; unknown or missing renders "not valid".
- **`AuthService` wrappers:** each calls the right SDK function with the code (the SDK is faked at `FIREBASE_AUTH`, as in `auth.service.spec.ts`).
- **Routing test:** `/auth/action` exists and is unguarded (with the existing "leave /auth unguarded" test).
- **Manual on dev,** after the console change:
  - sign up, then click the link in the same browser, and in another browser;
  - request a password reset and complete it;
  - click an already-used link.

## Out of scope

- Production or other sites, since dev is the only one. The action URL is a single console value, easy to change later.
- Custom-sent (non-Firebase) HTML emails.
- The `lang` parameter (Spanish only).
- `continueUrl` deep links.
