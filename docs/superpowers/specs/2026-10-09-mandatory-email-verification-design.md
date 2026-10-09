# Mandatory email verification — design

**Date:** 2026-10-09
**Status:** design approved in chat (2026-10-09). The user asked for a full plan.
**Goal (user):** email verification is obligatory before using the platform.

## Today

- **`AdminGuard`** (`src/app/admin.guard.ts`, on every platform route under the layout) only checks that *someone* is signed in. An unverified user gets in.
- **The layout shows `EmailVerificationBanner`,** which can't be dismissed. The API only trusts verified emails (`access.caller_email`), so the unverified user sees an empty platform.
- **Sign-up** (`RegisterComponent`) creates the Firebase user, which Firebase also signs in, saves the profile, sends the verification email, and navigates to `/auth/login`.
- **Email login** navigates to `/`.
- **Social sign-in** (`SocialAuthFlowService`) sends a verification email if the provider left the email unverified (Facebook, Microsoft, Twitter can). It then navigates to `/` for known users, or `/auth/complete-profile` for new ones.
- **`/auth/*` is outside the guarded layout,** so `complete-profile` works without verification. It must stay that way.

## Design

1. **Guard.** On every platform route:
   - no user → `/auth/login`;
   - signed in but unverified → `/auth/verify-email`;
   - verified → in.

   Before redirecting an unverified user, it reloads the Firebase user once, so someone who just clicked the link in another tab gets in. If the reload fails (offline), the user goes to the verify page rather than an error.
2. **New page, `/auth/verify-email`** (Spanish, styled like the other auth pages):
   - **Text:** "Te enviamos un enlace a **x@y.com**".
   - **Reenviar correo:** uses the existing `resendVerification()`, with the banner's two messages.
   - **Ya verifiqué mi correo:** re-checks. If verified, it goes to `/`; otherwise it shows "Aún no vemos la verificación…".
   - **Focus:** it also re-checks silently when the tab regains focus.
   - **Cerrar sesión:** logs out and goes to `/auth/login`.
   - **Edge cases:** signed out → `/auth/login`; already verified → `/`.
3. **Fresh token after verification.** Firebase keeps the old ID token, with `email_verified=false`, for up to an hour, and the API trusts only the token. Whenever the app learns the user is verified (guard or verify page), it forces a token refresh if the token's claim is still false.
   - The interceptor calls `getIdToken()` per request, so later requests carry the fresh token, and no page reload is needed.
4. **Flows:**
   - **Sign-up** navigates to `/auth/verify-email` instead of `/auth/login`.
   - **Login and social sign-in** are unchanged: they go to `/` or `complete-profile`, and the guard redirects unverified users.
   - **Existing unverified accounts** hit the same gate.
5. **The banner is removed.** No unverified user reaches the layout any more. Its token-refresh logic moves to `AuthService`.
6. **Backend:** no change. It already trusts only verified emails.

## Out of scope

- Renaming `AdminGuard`: it guards every platform route, not just admin pages.
- A configurable grace period.
- Changing email templates (Firebase console).
