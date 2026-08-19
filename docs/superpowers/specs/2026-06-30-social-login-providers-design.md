# Social Login Providers (Apple, Facebook, Microsoft, Twitter)

**Date:** 2026-06-30
**Status:** Approved design, pending implementation

## Goal

Add Apple, Facebook, Microsoft, and Twitter (X) sign-in to the login page,
alongside the existing Google sign-in. Wire the frontend fully now so the
buttons authenticate as soon as each provider is enabled in the Firebase
Console — no further frontend work required to "flip them on".

## Decisions (from brainstorming)

- **Scope:** Wire the frontend now, ready to flip on. Code is complete; buttons
  function once each provider is enabled in Firebase Console + its provider-side
  app exists.
- **Layout:** Single icon-only row under an "O continúa con" divider. Google
  moves into the row (replacing the current full-width Google button).
- **Apple deferred:** Apple requires a paid ($99/yr) Apple Developer account, so
  it is **not shown** for now. `AuthService` still supports `'apple'` so it can
  be enabled later by adding one entry to the providers array — no other code
  change. Visible buttons: Google, Facebook, Microsoft, Twitter.
- **Page:** Login page. Register page has the same Google button and can get the
  same row as a trivial follow-up (out of scope here).

## Architecture

### 1. `AuthService` (`core/services/auth.service.ts`)

Replace the single-purpose `loginWithGoogle()` with a generic method:

```ts
type SocialProvider = 'google' | 'apple' | 'facebook' | 'microsoft' | 'twitter';

loginWithProvider(provider: SocialProvider): Promise<UserCredential>;
```

It maps the key to the correct Firebase provider and calls `signInWithPopup`:

| Key        | Firebase provider                |
|------------|----------------------------------|
| google     | `GoogleAuthProvider`             |
| facebook   | `FacebookAuthProvider`           |
| twitter    | `TwitterAuthProvider`            |
| apple      | `new OAuthProvider('apple.com')` |
| microsoft  | `new OAuthProvider('microsoft.com')` |

`loginWithGoogle()` is kept as a thin alias (`loginWithProvider('google')`) so
no existing caller breaks.

### 2. Flow service — rename + generalize

Rename `GoogleAuthFlowService` → `SocialAuthFlowService`
(`core/services/social-auth-flow.service.ts`). Signature:

```ts
signIn(provider: SocialProvider): Promise<void>;
```

Same routing logic as today: sign in → record `email-login` → `searchUser` →
route to `/` (existing user) or `/auth/complete-profile` (first time).

Update both consumers: `login.component.ts` and `register.component.ts`.

### 3. UI (`login.component.html` + `.scss`)

Remove the full-width "Continuar con Google" button. Add:

- A divider line with centered text "O continúa con".
- A horizontal row of circular icon buttons rendered from a **data-driven
  providers array** in `login.component.ts`. Active entries: Google, Facebook,
  Microsoft, Twitter. Apple is omitted from the array (deferred) but supported
  by `AuthService` — re-enable by adding one entry.
- Brand marks are **inline SVGs** (no external image URLs — replaces the current
  gstatic Google icon so the row is self-contained and offline-safe).
- Each button has an `aria-label` (e.g. "Continuar con Facebook") and calls
  `loginWith(provider.key)`.

`login.component.ts` exposes one handler:

```ts
loginWith(provider: SocialProvider) { ... }
```

It calls `socialFlow.signIn(provider)`, swallows popup-closed/cancelled errors,
and shows a generic snackbar on real failures (reusing the current pattern).

## Error handling — no-email edge case

The app identifies users by the `email-login` localStorage key and
`searchUser(email)`. Apple (hide-my-email / private relay) and Twitter often
return **no email**. The flow service must guard this: if the credential has no
email, abort with a snackbar ("Este proveedor no proporcionó un correo
electrónico") instead of writing `null`/`undefined` into `email-login` and
corrupting the app's user lookup.

## Out of scope

- Register page icon row (trivial follow-up using the same service/markup).
- Account linking when the same email arrives from a different provider
  (Firebase's default `auth/account-exists-with-different-credential`).

## Required configuration (not code — buttons render but won't authenticate until done)

Enable each provider in **Firebase Console → Authentication → Sign-in method**,
and create the backing provider app:

- **Facebook:** Facebook app (App ID + App Secret) at developers.facebook.com;
  add the Firebase OAuth redirect URI to Valid OAuth Redirect URIs.
- **Microsoft:** Azure AD app registration (Application/client ID + secret);
  add Firebase callback URL as a redirect URI.
- **Twitter / X:** X developer app (API key + secret); set the Firebase callback
  URL. Email is not returned unless "Request email from users" is enabled.
- **Apple:** Apple Developer account (paid), an App ID + a Services ID with
  "Sign in with Apple" enabled, a private key, and the Firebase return URL
  registered. Email may still be hidden via private relay (handled above).

Also relevant: Email/Password is not yet enabled on the new Firebase project
(`evamed-ac3f8-599c8`) per project notes — same Console screen.
