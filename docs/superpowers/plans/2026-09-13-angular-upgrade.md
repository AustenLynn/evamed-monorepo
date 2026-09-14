# Angular Upgrade (19 → 22) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the EVAmed frontend from Angular 19.2.1 (out of support) to Angular 22.1.6, remove the `@angular/fire` wrapper that caps the app at Angular 20, and leave the project with a working unit-test setup.

**Architecture:** `@angular/fire` goes first, because its newest stable release (20.0.1) requires `@angular/core@^20` and no release supports 21 or 22. It is used in 5 files, all for Firebase Auth, and the Firebase SDK exports the same function names, so the migration is mostly import swaps plus one DI token. Then one `ng update` hop per major (20 → 21 → 22), each gated by a production build and a manual click-through, because the app has no meaningful automated coverage. Test tooling is rebuilt last, on the final version, with specs for the logic added most recently.

**Tech Stack:** Angular 22.1.6 (`@angular/cli`, `@angular/material`, `@angular/cdk`), TypeScript 6.0, `firebase` SDK (modular), ng2-charts 10, `@angular/build:unit-test` with Vitest, Node 22 (`node:22-alpine`), Docker Compose.

**Spec:** None separate. The Decisions section below is the spec.

## Global Constraints

- **Run every frontend command in a container**, so the toolchain matches the build image and does not depend on the host (the host has npm 9.2.0, below this project's `engines.npm >= 10`). From the repo root, the canonical form:
  ```bash
  docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine sh -lc '<command>'
  ```
  `node:22-alpine` currently provides Node 22.23.2, which satisfies every hop's floor (Angular 20/21 need `^20.19 || ^22.12 || >=24`; Angular 22 needs `^22.22.3 || ^24.15 || >=26`).
- **Version floors, verified against `@angular/compiler-cli`'s published peers** — TypeScript `>=5.8 <5.9` for Angular 20, `>=5.9 <6.0` for 21, `>=6.0 <6.1` for 22. Never leave TypeScript outside the current hop's range.
- **One major per task.** Never run `ng update @angular/core@22` from 19; Angular's schematics only migrate one major at a time.
- `package-lock.json` is committed and must stay in sync: every task that changes dependencies commits the lockfile too.
- The backend is untouched by this plan. Do not edit anything under `backend/`.
- Do not push. Do not merge. Work on the branch named in Task 1.
- **The app is NgModule-based** (45 modules, 89 components, 84 files with `standalone: false`). NgModules remain supported through Angular 22; do **not** start a standalone migration as part of this work.
- **Smoke checklist (referred to as S1–S8 below).** After each hop, with `docker compose up -d --build web` running, a human checks all of it in a browser at `http://localhost:8080`:
  - **S1** The login page renders; the browser console shows no errors.
  - **S2** Sign in with Google as the `grant_admin` account; the home page lists projects.
  - **S3** Hard-refresh home; DevTools → Network shows no `401` responses (the auth interceptor attaches the token).
  - **S4** Open a project → materials-stage: checkboxes load, toggling one persists across a refresh.
  - **S5** Open that project's results page: charts render (ng2-charts) with numbers, not blank boxes.
  - **S6** Open `/admin-units` as the admin: the table renders; add a unit and delete it again.
  - **S7** In a private window, register a new email/password account: success snackbar, the verification banner appears and cannot be dismissed, and the project list is empty.
  - **S8** Trigger a file export (the XLSX/file-saver action in the results or do-files screens): the file downloads.
- A hop is **not done** until S1–S8 all pass. If one fails, fix it inside that hop rather than deferring.

---

## Decisions

| # | Decision | Choice | Why / alternative |
|---|---|---|---|
| A1 | Target version | **Angular 22.1.6** (current release) | 19 is out of support. Verified from npm: `latest` is 22.1.6, with 21.2.23 and 20.3.31 as the LTS lines. |
| A2 | `@angular/fire` | **Removed**, replaced by the `firebase` SDK directly | Its newest stable (20.0.1) pins `@angular/core@^20`; Angular 21 exists only as `21.0.0-rc.0` and nothing supports 22. It is used in 5 files for Auth only, and the SDK's function names are identical (`@angular/fire/auth` re-exports them), so the change is small and removes the ceiling permanently. Alternative (stopping at Angular 20) buys months, not years; the RC is not acceptable for an auth library in production. |
| A3 | Firestore provider | **Deleted** | `provideFirestore(() => getFirestore())` is wired in `app.module.ts` but no code imports Firestore. |
| A4 | Firebase SDK version | Stay on **11.4.0** through the hops (what `@angular/fire` already installs), then bump to **12.x** as its own step in Task 7 | Keeps "drop the wrapper" and "upgrade the SDK" as separate, separately verifiable changes. |
| A5 | DI for Auth | `FIREBASE_AUTH` injection token with a root factory | The old code injected `Auth` as a class token supplied by `provideAuth`. A token keeps constructor injection working with the smallest diff, with no NgModule provider needed. |
| A6 | Test tooling | Delete Protractor and Karma; adopt `@angular/build:unit-test` (Vitest) in Task 6 with three real specs | Protractor has been unsupported since Angular 12 and the `e2e` folder is dead. `@angular/build@22` ships both `karma` and `unit-test` builders; `unit-test` (default runner `vitest`) is the current path. The repo has exactly one trivial spec today, so nothing of value is lost. |
| A7 | Hop gating | Production build + S1–S8 by a human | There is no automated frontend coverage to lean on until Task 6, and pretending otherwise would be worse than saying it plainly. |
| A8 | Material theme | Keep the prebuilt `indigo-pink.css` | Verified present in `@angular/material@22.1.6`'s package (`prebuilt-themes/indigo-pink.css`), so no theme migration is forced. Switching to an M3 theme or the `mat.theme()` mixin is a separate design decision. |
| A9 | `::ng-deep` rules | Left in place, checked at each hop | 26 rules across the SCSS reach into Material's internal DOM, which is the most likely source of visual regressions between majors. Rewriting them is out of scope; noticing breakage is in scope (S1–S8). |
| A10 | Standalone/signals migrations | **Out of scope** | `ng update` offers optional schematics (standalone components, control flow, signal inputs). Decline them: they would multiply the diff and the regression surface. This plan only gets the app current. |

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `frontend/evamed/src/app/core/firebase.ts` | Create | Creates the Firebase app + auth once; exports the `FIREBASE_AUTH` token |
| `frontend/evamed/src/app/app.module.ts` | Modify | Drop the three `@angular/fire` providers |
| `frontend/evamed/src/app/core/services/auth.service.ts` | Modify | Import from `firebase/auth`; inject the token; replace `authState()` |
| `frontend/evamed/src/app/core/interceptors/auth.interceptor.ts` | Modify | Import `Auth` from `firebase/auth`; inject the token |
| `frontend/evamed/src/app/shared/components/email-verification-banner/email-verification-banner.component.ts` | Modify | Same two changes |
| `frontend/evamed/src/app/core/services/social-auth-flow.service.ts` | Modify | Import `sendEmailVerification` from `firebase/auth` |
| `frontend/evamed/src/main.ts` | Modify | `platformBrowserDynamic()` → `platformBrowser()` (Angular 20 hop) |
| `frontend/evamed/tsconfig.json` | Modify | `moduleResolution: "bundler"` (needed for `firebase/*` subpaths); TypeScript floors per hop |
| `frontend/evamed/package.json`, `package-lock.json` | Modify | Dependency versions each hop |
| `frontend/evamed/angular.json` | Modify | Remove `test`/`e2e` targets (Task 1), add the `unit-test` target (Task 6), drop the stale `stag` configuration (Task 7) |
| `frontend/evamed/e2e/`, `karma.conf.js`, `src/test.ts`, `src/app/app.component.spec.ts` | Delete | Dead Protractor/Karma tooling |
| `frontend/evamed/src/app/core/interceptors/auth.interceptor.spec.ts` | Create | Task 6: token attaches only to our API |
| `frontend/evamed/src/app/core/services/auth.service.spec.ts` | Create | Task 6: `hasUser()` emits auth-state changes |
| `frontend/evamed/src/app/core/services/user/user.service.spec.ts` | Create | Task 6: `getMe()` calls the configured URL |
| `frontend/evamed/src/app/core/services/materials/materials.service.ts` | Modify | Task 7: delete the dead `*Fake` methods |
| `frontend/evamed/Dockerfile` | Modify | Task 7 only if a hop needs a newer Node floor |

---

### Task 1: Branch, baseline, and remove the dead test tooling

**Files:**
- Delete: `frontend/evamed/e2e/` (whole folder), `frontend/evamed/karma.conf.js`, `frontend/evamed/src/test.ts`, `frontend/evamed/src/app/app.component.spec.ts`
- Modify: `frontend/evamed/package.json`, `frontend/evamed/package-lock.json`, `frontend/evamed/angular.json`

**Interfaces:**
- Produces: a repo where `ng build` and `ng lint` work and `ng test`/`ng e2e` no longer exist as targets (Task 6 adds `test` back). Records the baseline bundle sizes later tasks compare against.

- [ ] **Step 1: Branch and record the baseline**

```bash
cd /home/maikolkali/evamed-monorepo
git switch -c feat/angular-22
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npm ci >/dev/null 2>&1 && npx ng version && npm run build -- --configuration production' 2>&1 | tail -30
```

Expected: Angular CLI 19.2.x, then a successful build ending with the bundle table. Save that table into the report: the `Initial total` figure is the baseline for every later hop. Pre-existing warnings (SCSS budget warnings and CommonJS-dependency notes) are expected; note them so later hops can tell new warnings from old.

- [ ] **Step 2: Delete the Protractor and Karma tooling**

```bash
cd /home/maikolkali/evamed-monorepo/frontend/evamed
git rm -r --quiet e2e karma.conf.js src/test.ts src/app/app.component.spec.ts
```

- [ ] **Step 3: Drop the `test` and `e2e` targets from `angular.json`**

Remove the whole `"test": { ... }` and `"e2e": { ... }` objects from `projects.evamed.architect`, leaving `build`, `serve`, `extract-i18n` and `lint`. Check it parses and the targets are gone:

```bash
python3 -c "import json;a=json.load(open('angular.json'))['projects']['evamed']['architect'];print(sorted(a))"
```

Expected: `['build', 'extract-i18n', 'lint', 'serve']`.

- [ ] **Step 4: Remove the now-unused dependencies**

In `frontend/evamed/package.json`, delete these entries:
- `dependencies`: `"rxjs-compat"` (an RxJS 5→6 shim; nothing imports it or `rxjs/Rx`)
- `devDependencies`: `"protractor"`, `"ts-node"`, `"@types/jasmine"`, `"@types/jasminewd2"`, `"jasmine-core"`, `"jasmine-spec-reporter"`, `"karma"`, `"karma-chrome-launcher"`, `"karma-coverage-istanbul-reporter"`, `"karma-jasmine"`, `"karma-jasmine-html-reporter"`, `"@typescript-eslint/eslint-plugin-tslint"` (a TSLint bridge; TSLint is long dead)

Also move `"@angular/cli"` from `dependencies` to `devDependencies` (keep the same `^19.2.1` range for now), and change `"@types/node": "^12.20.7"` to `"^22.13.0"`.

Delete the `"test"` and `"e2e"` scripts from the `scripts` block, and the `"heroku-postbuild"` script (Heroku is long gone; Render was retired on 2026-09-13).

- [ ] **Step 5: Reinstall and verify the build still works**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npm install && npm run build -- --configuration production && npx ng lint' 2>&1 | tail -25
```

Expected: install succeeds, the build's `Initial total` matches Step 1's baseline (byte-identical is normal; a small change is acceptable and worth noting), and lint reports the same findings as before. `npm install` (not `ci`) is deliberate: it rewrites `package-lock.json` for the removed packages.

- [ ] **Step 6: Confirm the app still runs**

```bash
cd /home/maikolkali/evamed-monorepo && docker compose up -d --build web
curl -s http://localhost:8080/ | grep -c '<app-root'
```

Expected: `1`.

- [ ] **Step 7: Commit**

```bash
cd /home/maikolkali/evamed-monorepo
git add -A frontend/evamed
git commit -m "chore(frontend): remove dead Protractor/Karma tooling before the Angular upgrade"
```

---

### Task 2: Replace `@angular/fire` with the Firebase SDK (still on Angular 19)

**Files:**
- Create: `frontend/evamed/src/app/core/firebase.ts`
- Modify: `frontend/evamed/src/app/app.module.ts`, `frontend/evamed/src/app/core/services/auth.service.ts`, `frontend/evamed/src/app/core/interceptors/auth.interceptor.ts`, `frontend/evamed/src/app/shared/components/email-verification-banner/email-verification-banner.component.ts`, `frontend/evamed/src/app/core/services/social-auth-flow.service.ts`, `frontend/evamed/tsconfig.json`, `frontend/evamed/package.json`, `frontend/evamed/package-lock.json`

**Interfaces:**
- Produces: `FIREBASE_AUTH: InjectionToken<Auth>` and the helpers `firebaseApp(): FirebaseApp` / `firebaseAuth(): Auth` from `src/app/core/firebase.ts`. Task 6's specs override `FIREBASE_AUTH` with a fake, so the token name must be exactly this.
- Consumes: `environment.firebaseConfig` (already present in both environment files).
- `AuthService`'s public API does not change: `createUser`, `login`, `logout`, `resetPassword`, `verifyEmail`, `resendVerification`, `reloadCurrentUser`, `isEmailVerified`, `loginWithProvider`, `currentUser`, `hasUser()`, `deleteCurrentUser()` keep their names and signatures, with `hasUser()` still returning an `Observable<User | null>`.

- [ ] **Step 1: Add `firebase` as a direct dependency, drop `@angular/fire`**

In `frontend/evamed/package.json` `dependencies`: remove `"@angular/fire": "^19.0.0"` and add `"firebase": "^11.4.0"` (the version `@angular/fire` already installs, so the SDK itself does not change here). Keep the entry list alphabetical.

- [ ] **Step 2: Let TypeScript resolve `firebase/*` subpaths**

In `frontend/evamed/tsconfig.json`, change `"moduleResolution": "node"` to `"moduleResolution": "bundler"`. The Firebase SDK publishes its subpaths (`firebase/app`, `firebase/auth`) through an `exports` map, which the legacy `node` resolution cannot follow; `@angular/fire` hid this behind its own typings.

- [ ] **Step 3: Create `frontend/evamed/src/app/core/firebase.ts`**

```ts
import { InjectionToken } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

import { environment } from './../../environments/environment';

// One Firebase app and one Auth instance for the whole SPA. @angular/fire used
// to do this through provideFirebaseApp/provideAuth; it pinned us to Angular 20,
// so we call the SDK directly.
let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function firebaseApp(): FirebaseApp {
  return (app ??= initializeApp(environment.firebaseConfig));
}

export function firebaseAuth(): Auth {
  return (auth ??= getAuth(firebaseApp()));
}

// Injected wherever the code used to inject `Auth` from '@angular/fire/auth'.
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH', {
  providedIn: 'root',
  factory: firebaseAuth,
});
```

- [ ] **Step 4: Remove the `@angular/fire` providers from `app.module.ts`**

Delete these three import lines:

```ts
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {getAuth, provideAuth} from '@angular/fire/auth';
import {getFirestore, provideFirestore} from '@angular/fire/firestore';
```

and these three entries from the `providers` array (leave `provideCharts`, `provideHttpClient` and the `HTTP_INTERCEPTORS` entry):

```ts
        provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
        provideFirestore(() => getFirestore()),
        provideAuth(() => getAuth()),
```

If `environment` becomes unused in this file afterwards, remove its import too; check with `grep -n "environment" src/app/app.module.ts`.

- [ ] **Step 5: Update `auth.service.ts`**

Replace the import block at the top:

```ts
import { Injectable, inject } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  UserCredential, signOut, sendPasswordResetEmail, sendEmailVerification,
  GoogleAuthProvider, FacebookAuthProvider, TwitterAuthProvider, OAuthProvider,
  AuthProvider, signInWithPopup, deleteUser, onAuthStateChanged, User } from 'firebase/auth';
import { Observable } from 'rxjs';

import { FIREBASE_AUTH } from './../firebase';
```

(keep the existing `SocialProvider` type and its comment as they are). Replace the constructor:

```ts
  constructor(
    private auth: Auth,
  ) { }
```

with a field injection:

```ts
  private auth = inject(FIREBASE_AUTH);
```

and replace `hasUser()`:

```ts
  hasUser() {
    return authState(this.auth);
  }
```

with:

```ts
  // Replaces @angular/fire's authState(): emits the current user immediately
  // and again on every sign-in/sign-out.
  hasUser(): Observable<User | null> {
    return new Observable<User | null>(subscriber =>
      onAuthStateChanged(this.auth, subscriber));
  }
```

Check the import path is right for this file's depth: `src/app/core/services/auth.service.ts` → `./../firebase` resolves to `src/app/core/firebase.ts`.

- [ ] **Step 6: Update the interceptor**

In `frontend/evamed/src/app/core/interceptors/auth.interceptor.ts`, change

```ts
import { Auth } from '@angular/fire/auth';
```

to

```ts
import { Auth } from 'firebase/auth';
```

and add `FIREBASE_AUTH` to the imports plus `inject`:

```ts
import { Injectable, inject } from '@angular/core';
...
import { FIREBASE_AUTH } from './../firebase';
```

then replace the constructor `constructor(private auth: Auth) {}` with:

```ts
  private auth = inject(FIREBASE_AUTH);
```

Leave the URL-matching logic and the `authStateReady()` wait exactly as they are.

- [ ] **Step 7: Update the verification banner**

In `frontend/evamed/src/app/shared/components/email-verification-banner/email-verification-banner.component.ts`, change `import { Auth } from '@angular/fire/auth';` to `import { Auth } from 'firebase/auth';`, add the token import `import { FIREBASE_AUTH } from './../../../core/firebase';`, add `inject` to the `@angular/core` import, and remove `private auth: Auth,` from the constructor (keeping `authService` and `snackBar`), adding instead the field:

```ts
  private auth = inject(FIREBASE_AUTH);
```

- [ ] **Step 8: Update the social-auth flow**

In `frontend/evamed/src/app/core/services/social-auth-flow.service.ts`, change

```ts
import { sendEmailVerification } from '@angular/fire/auth';
```

to

```ts
import { sendEmailVerification } from 'firebase/auth';
```

- [ ] **Step 9: Prove `@angular/fire` is gone and the app builds**

```bash
cd /home/maikolkali/evamed-monorepo
grep -rn "@angular/fire" frontend/evamed/src frontend/evamed/package.json || echo "NO ANGULAR_FIRE REFERENCES"
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npm install && npm run build -- --configuration production' 2>&1 | tail -20
```

Expected: `NO ANGULAR_FIRE REFERENCES`, then a successful build. Note the new `Initial total` against Task 1's baseline; dropping the wrapper should reduce it slightly.

- [ ] **Step 10: Verify auth end to end (this is the risky task — do the whole checklist)**

```bash
cd /home/maikolkali/evamed-monorepo && docker compose up -d --build
```

Run **S1–S8** from the Global Constraints. S2, S3 and S7 are the ones that actually exercise this change (sign-in, token attachment, registration + the banner). If sign-in fails, check the browser console for a Firebase initialisation error before touching anything else.

- [ ] **Step 11: Commit**

```bash
cd /home/maikolkali/evamed-monorepo
git add -A frontend/evamed
git commit -m "refactor(frontend): use the Firebase SDK directly instead of @angular/fire"
```

---

### Task 3: Hop to Angular 20

**Files:**
- Modify: `frontend/evamed/package.json`, `package-lock.json`, `frontend/evamed/src/main.ts`, and whatever the build errors point at

**Interfaces:**
- Consumes: the `FIREBASE_AUTH` token from Task 2 (the hop must not reintroduce `@angular/fire`).
- Produces: Angular 20.x with TypeScript in `>=5.8 <5.9`, `ng2-charts@9`, `ngx-filesaver@20`, and `main.ts` bootstrapping through `platformBrowser()`.

- [ ] **Step 1: Run the Angular 20 migration**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npx ng update @angular/core@20 @angular/cli@20 @angular/cdk@20 @angular/material@20' 2>&1 | tail -40
```

`ng update` requires a clean git tree — Task 2 committed, so this works. Record every migration it reports as run.

**Decline optional migrations** (standalone components, control-flow syntax, signal inputs, inject migration) per decision A10. If the CLI prompts, answer no; if it runs one unasked, revert that file group and note it in the report.

- [ ] **Step 2: Bump the dependencies `ng update` does not own**

In `frontend/evamed/package.json`:
- `"ng2-charts": "^9.0.0"` (v9's peer is `@angular/core >=20.0.0`; v8 was for 19)
- `"ngx-filesaver": "^20.0.0"`
- `"typescript"`: whatever `ng update` set — verify it lands inside `>=5.8 <5.9`; if the file still says `^5.5.4`, set `"~5.8.3"`
- `"@angular-eslint/eslint-plugin"`, `"@angular-eslint/eslint-plugin-template"`: `"^20.0.0"`; `"angular-eslint"`: `"^20.7.0"` (its peer accepts the existing `eslint@^8.57.1`)

```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npm install' 2>&1 | tail -5
```

- [ ] **Step 3: Switch the bootstrap off the deprecated dynamic platform**

Replace the top of `frontend/evamed/src/main.ts`:

```ts
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
```

with:

```ts
import { enableProdMode } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
```

and the bootstrap call:

```ts
platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
```

with:

```ts
platformBrowser().bootstrapModule(AppModule)
  .catch(err => console.error(err));
```

Then remove `"@angular/platform-browser-dynamic"` from `package.json` `dependencies` and confirm nothing else imports it:

```bash
grep -rn "platform-browser-dynamic" frontend/evamed/src frontend/evamed/package.json || echo "NO DYNAMIC PLATFORM REFERENCES"
```

- [ ] **Step 4: Build and fix what breaks**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npm install && npm run build -- --configuration production' 2>&1 | tail -40
```

Expected: a successful build. If it fails, work through the errors one file at a time, consulting Angular's own upgrade guide (`https://angular.dev/update-guide?v=19.0-20.0`) for anything you don't recognise. The likely suspects in this codebase, in rough order:
- **Angular Material's internal DOM.** 26 `::ng-deep` rules reach into it (`grep -rn "::ng-deep" frontend/evamed/src --include=*.scss`). These fail silently — they compile, but styling breaks. S1/S4/S6 are how you catch it.
- **Stricter template type-checking** (`fullTemplateTypeCheck` and `strictInjectionParameters` are already on, so this codebase is partly prepared).
- **ng2-charts 9's API**: `provideCharts(withDefaultRegisterables())` in `app.module.ts` and every `baseChart` usage.
- **The prebuilt theme path** in `angular.json` (`./node_modules/@angular/material/prebuilt-themes/indigo-pink.css`). If the build says the file is missing, list the installed themes with `docker run --rm -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine sh -lc 'ls node_modules/@angular/material/prebuilt-themes/'` and pick the closest available name rather than inventing a theme migration.

Do not silence errors with `any` casts or `// @ts-ignore`. If a fix isn't obvious, stop and report rather than guessing.

- [ ] **Step 5: Lint, then run the smoke checklist**

```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npx ng lint' 2>&1 | tail -15
cd /home/maikolkali/evamed-monorepo && docker compose up -d --build
```

Lint findings should be the same set as the baseline (new rules may appear; fix them if they're real, otherwise record them). Then run **S1–S8**.

- [ ] **Step 6: Commit**

```bash
cd /home/maikolkali/evamed-monorepo
git add -A frontend/evamed
git commit -m "chore(frontend): Angular 20"
```

---

### Task 4: Hop to Angular 21

**Files:**
- Modify: `frontend/evamed/package.json`, `package-lock.json`, and whatever the build errors point at

**Interfaces:**
- Produces: Angular 21.x with TypeScript in `>=5.9 <6.0` and `ng2-charts@10`.

- [ ] **Step 1: Run the Angular 21 migration**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npx ng update @angular/core@21 @angular/cli@21 @angular/cdk@21 @angular/material@21' 2>&1 | tail -40
```

Decline optional migrations (A10). Record what ran.

- [ ] **Step 2: Bump the rest**

In `frontend/evamed/package.json`:
- `"ng2-charts": "^10.0.0"` (its peer is `@angular/core >=21.0.0`)
- `"ngx-filesaver": "^21.0.0"`
- `"typescript"`: verify it's inside `>=5.9 <6.0`; if not, set `"~5.9.2"`
- `"@angular-eslint/eslint-plugin"`, `"@angular-eslint/eslint-plugin-template"`, `"angular-eslint"`: `"^21.0.0"`

- [ ] **Step 3: Build and fix what breaks**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npm install && npm run build -- --configuration production' 2>&1 | tail -40
```

Expected: a successful build. Use `https://angular.dev/update-guide?v=20.0-21.0` for unfamiliar errors. Same suspects as Task 3 Step 4: `::ng-deep` against Material's DOM, template type-checking, ng2-charts (this hop changes its major), and the prebuilt theme path.

- [ ] **Step 4: Lint, then run the smoke checklist**

```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npx ng lint' 2>&1 | tail -15
cd /home/maikolkali/evamed-monorepo && docker compose up -d --build
```

Then run **S1–S8**. S5 (charts) deserves extra attention this hop, because ng2-charts crossed a major.

- [ ] **Step 5: Commit**

```bash
cd /home/maikolkali/evamed-monorepo
git add -A frontend/evamed
git commit -m "chore(frontend): Angular 21"
```

---

### Task 5: Hop to Angular 22

**Files:**
- Modify: `frontend/evamed/package.json`, `package-lock.json`, `frontend/evamed/Dockerfile` (only if the Node floor demands it), and whatever the build errors point at

**Interfaces:**
- Produces: Angular 22.1.x, TypeScript in `>=6.0 <6.1`, `eslint@^9`, `angular-eslint@^22`, and a `node:22-alpine` image whose Node satisfies `^22.22.3`.

- [ ] **Step 1: Check the Node floor before starting**

Angular 22 requires Node `^22.22.3 || ^24.15.0 || >=26.0.0`:

```bash
docker run --rm node:22-alpine node -v
```

Expected: `v22.22.3` or newer (it was v22.23.2 when this plan was written). If it is older, pin the frontend `Dockerfile` to a tag that satisfies the floor (e.g. `FROM node:22.23-alpine`) and re-check before continuing.

- [ ] **Step 2: Run the Angular 22 migration**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npx ng update @angular/core@22 @angular/cli@22 @angular/cdk@22 @angular/material@22' 2>&1 | tail -40
```

Decline optional migrations (A10). Record what ran.

- [ ] **Step 3: Bump the rest, including the lint stack**

In `frontend/evamed/package.json`:
- `"typescript"`: verify it's inside `>=6.0 <6.1`; if not, set `"~6.0.2"`
- `"ngx-filesaver": "^22.0.0"`
- `"eslint": "^9.20.0"` (angular-eslint 22 requires `eslint ^9 || ^10`)
- `"angular-eslint": "^22.5.0"`, `"@angular-eslint/eslint-plugin": "^22.5.0"`, `"@angular-eslint/eslint-plugin-template": "^22.5.0"`
- `"typescript-eslint": "^8.21.0"` and `"@typescript-eslint/eslint-plugin"`, `"@typescript-eslint/parser"`: keep `^8`, which angular-eslint 22 expects
- `"ng2-charts"`: stays `^10.0.0` (its peer is `>=21.0.0`, which 22 satisfies)

ESLint 9 uses flat config. This repo already has `eslint.config.js`, so check it still loads (Step 5 does that). If it imports anything from the old `@angular-eslint/builder` style, follow the messages from `ng lint`.

- [ ] **Step 4: Build and fix what breaks**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npm install && npm run build -- --configuration production' 2>&1 | tail -40
```

Expected: a successful build. Use `https://angular.dev/update-guide?v=21.0-22.0` for unfamiliar errors. TypeScript 6.0 is the notable part of this hop: it is a major compiler release, so expect stricter inference. This codebase's `UntypedFormGroup`/`UntypedFormBuilder` usage (`grep -rln "Untyped" frontend/evamed/src`) is the most likely place to need small type annotations.

- [ ] **Step 5: Lint, then run the smoke checklist**

```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npx ng lint' 2>&1 | tail -20
cd /home/maikolkali/evamed-monorepo && docker compose up -d --build
```

Then run **S1–S8**.

- [ ] **Step 6: Record the final versions and commit**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npx ng version' 2>&1 | tail -20
git add -A frontend/evamed
git commit -m "chore(frontend): Angular 22"
```

Put the `ng version` table in the report: it is the evidence that Angular, the CLI, Material, CDK and TypeScript all landed on the intended majors.

---

### Task 6: Unit tests with Vitest

**Files:**
- Modify: `frontend/evamed/angular.json`, `frontend/evamed/package.json`, `package-lock.json`
- Create: `frontend/evamed/src/app/core/interceptors/auth.interceptor.spec.ts`, `frontend/evamed/src/app/core/services/auth.service.spec.ts`, `frontend/evamed/src/app/core/services/user/user.service.spec.ts`

**Interfaces:**
- Consumes: `FIREBASE_AUTH` (Task 2), `AuthInterceptor`, `AuthService.hasUser()`, `UserService.getMe()`.
- Produces: a working `npm test` (the `test` target removed in Task 1), with three specs covering the auth logic added most recently.

- [ ] **Step 1: Add the `test` target**

In `frontend/evamed/angular.json`, inside `projects.evamed.architect`, add:

```json
"test": {
  "builder": "@angular/build:unit-test",
  "options": {
    "buildTarget": "::development",
    "tsConfig": "tsconfig.spec.json",
    "runner": "vitest",
    "browsers": ["chromium"]
  }
}
```

`@angular/build@22` ships this builder (verified: its builders are `application`, `dev-server`, `extract-i18n`, `karma`, `ng-packagr`, `unit-test`), and `vitest` is its default runner. Add the script back to `package.json`: `"test": "ng test"`.

- [ ] **Step 2: Install the runner**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npm install --save-dev vitest jsdom' 2>&1 | tail -5
```

If `ng test` later reports a missing peer (for example a browser provider), install exactly what the message names and nothing else. If the builder insists on a real browser and none is available in the container, switch the target's `"browsers"` option to `["jsdom"]` (or drop the option so the runner's default applies) rather than installing a browser stack — these three specs need no real browser.

Check `tsconfig.spec.json` exists and its `types` no longer mention jasmine (Task 1 deleted the jasmine packages). It should read roughly:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["vitest/globals", "node"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"]
}
```

- [ ] **Step 3: Write the interceptor spec (the most valuable one)**

`frontend/evamed/src/app/core/interceptors/auth.interceptor.spec.ts`:

```ts
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from './../../../environments/environment';
import { FIREBASE_AUTH } from './../firebase';
import { AuthInterceptor } from './auth.interceptor';

// A stand-in for Firebase Auth: a signed-in user whose token we can assert on.
const fakeAuth = {
  currentUser: { getIdToken: () => Promise.resolve('test-token') },
  authStateReady: () => Promise.resolve(),
};

describe('AuthInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: FIREBASE_AUTH, useValue: fakeAuth },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches the Firebase token to our API', async () => {
    http.get(environment.api_projects).subscribe();
    await Promise.resolve();
    const request = httpMock.expectOne(environment.api_projects);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([]);
  });

  it('does not attach it to another host', async () => {
    const foreign = 'https://evamed-rest-api.herokuapp.com/api-projects/material-scheme-data/';
    http.get(foreign).subscribe();
    await Promise.resolve();
    const request = httpMock.expectOne(foreign);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });

  it('does not attach it to a same-origin path outside the API', async () => {
    http.get('/assets/images/logo.png').subscribe();
    await Promise.resolve();
    const request = httpMock.expectOne('/assets/images/logo.png');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
```

- [ ] **Step 4: Write the auth-service spec**

`frontend/evamed/src/app/core/services/auth.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { FIREBASE_AUTH } from './../firebase';
import { AuthService } from './auth.service';

describe('AuthService.hasUser', () => {
  it('emits the user that Firebase reports', async () => {
    const user = { email: 'alice@example.com', emailVerified: true };
    const fakeAuth = {
      // onAuthStateChanged(auth, observer) is called with our subscriber.
      currentUser: user,
      onAuthStateChanged: undefined,
    } as any;

    TestBed.configureTestingModule({
      providers: [{ provide: FIREBASE_AUTH, useValue: fakeAuth }],
    });

    // The SDK's onAuthStateChanged is a free function, so stub it on the fake
    // auth object the service passes in: Firebase reads it from the instance.
    fakeAuth._onAuthStateChanged = (observer: any) => {
      observer.next(user);
      return () => undefined;
    };

    const service = TestBed.inject(AuthService);
    const emitted = await firstValueFrom(service.hasUser());
    expect(emitted).toEqual(user);
  });
});
```

**Note for the implementer:** `onAuthStateChanged` is imported as a free function from `firebase/auth`, so the fake above only works if Vitest mocks the module. Do it with `vi.mock` at the top of the file instead of the `_onAuthStateChanged` hack:

```ts
import { vi } from 'vitest';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, observer: any) => {
    observer.next({ email: 'alice@example.com', emailVerified: true });
    return () => undefined;
  },
}));
```

and then assert `emitted?.email === 'alice@example.com'`. Keep whichever version actually passes, delete the other, and say in your report which one you kept and why.

- [ ] **Step 5: Write the user-service spec**

`frontend/evamed/src/app/core/services/user/user.service.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from './../../../../environments/environment';
import { UserService } from './user.service';

describe('UserService.getMe', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads the admin flag from the configured /me endpoint', () => {
    let isAdmin: boolean | undefined;
    service.getMe().subscribe(me => (isAdmin = me.is_admin));

    const request = httpMock.expectOne(environment.api_me);
    expect(request.request.method).toBe('GET');
    request.flush({ email: 'boss@example.com', is_admin: true, email_verified: true });

    expect(isAdmin).toBe(true);
  });
});
```

- [ ] **Step 6: Run the suite**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npm test -- --watch=false' 2>&1 | tail -25
```

Expected: 5 passing tests (3 interceptor, 1 auth service, 1 user service). If the interceptor's async token attachment needs more than one microtask, replace `await Promise.resolve()` with `await new Promise(resolve => setTimeout(resolve, 0))` — and if a spec still can't observe the request, report it rather than weakening the assertion to something that would pass with no token at all.

- [ ] **Step 7: Prove the specs actually fail when the behaviour breaks**

Temporarily change the interceptor's guard `if (target.origin !== apiOrigin || !target.pathname.startsWith(apiPath))` to `if (false)`, re-run the suite, and confirm the "another host" and "outside the API" specs fail. Then revert the change and confirm they pass again. Put both outputs in the report — a test that cannot fail is worse than no test.

- [ ] **Step 8: Commit**

```bash
cd /home/maikolkali/evamed-monorepo
git add -A frontend/evamed
git commit -m "test(frontend): Vitest unit tests for the auth interceptor, auth service and /me"
```

---

### Task 7: Tidy-up, Firebase 12, and documentation

**Files:**
- Modify: `frontend/evamed/src/app/core/services/materials/materials.service.ts`, `frontend/evamed/angular.json`, `frontend/evamed/package.json`, `package-lock.json`, `frontend/evamed/README.md`
- Modify: `docs/superpowers/plans/2026-09-11-runtime-upgrade.md`

**Interfaces:**
- Consumes: everything above.
- Produces: no dead code paths pointing at abandoned hosts, no build configuration referencing a missing file, Firebase SDK 12.x, and documentation that matches reality.

- [ ] **Step 1: Delete the dead `*Fake` methods**

`frontend/evamed/src/app/core/services/materials/materials.service.ts` has `getfake()`, `deleteFake()` and `addFake()` pointing at `http://127.0.0.1:8000` and `https://evamed-rest-api.herokuapp.com` — an abandoned Heroku hostname anyone could register. Confirm they're unused, then delete all three methods:

```bash
cd /home/maikolkali/evamed-monorepo/frontend/evamed
grep -rn "getfake\|deleteFake\|addFake" src --include=*.ts --include=*.html | grep -v "materials.service.ts"
```

Expected: no output (if there is any, stop and report — they're in use).

- [ ] **Step 2: Remove the stale `stag` build configuration**

`angular.json` has a `stag` configuration whose `fileReplacements` points at `src/environments/environment.stag.ts`, which does not exist, so `ng build --configuration stag` fails. Confirm and delete the whole `"stag": { ... }` object from `projects.evamed.architect.build.configurations`:

```bash
ls src/environments/
python3 -c "import json;print(sorted(json.load(open('angular.json'))['projects']['evamed']['architect']['build']['configurations']))"
```

Expected: the directory holds only `environment.ts` and `environment.prod.ts`; after the edit the configuration list is `['docker', 'production']`.

- [ ] **Step 3: Bump the Firebase SDK to 12**

In `package.json`, change `"firebase": "^11.4.0"` to `"^12.19.0"`, then:

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npm install && npm run build -- --configuration production && npm test -- --watch=false' 2>&1 | tail -25
```

Expected: build succeeds and the 5 tests pass. Then `docker compose up -d --build` and run **S2, S3 and S7** specifically — they are the sign-in, token and registration paths this bump can affect.

- [ ] **Step 4: Update the frontend README**

`frontend/evamed/README.md` is the Angular CLI's generated text and mentions commands this plan removed (`ng e2e`, Protractor) and an old CLI version. Replace its "Running unit tests" and "Running end-to-end tests" sections with:

```markdown
## Running unit tests

`npm test` runs the Vitest suite through `ng test` (`@angular/build:unit-test`).
In this repo the container form avoids host Node/npm drift:

```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:/app" -w /app node:22-alpine sh -lc 'npm test -- --watch=false'
```

## End-to-end tests

There are none. The Protractor setup was removed in 2026-09 (unsupported since
Angular 12). The frontend's gates are the production build plus a manual
click-through; see `docs/superpowers/plans/2026-09-13-angular-upgrade.md`.
```

Also update the CLI version line at the top of the file to the version `ng version` reported in Task 5.

- [ ] **Step 5: Close the Angular gap in the runtime-upgrade plan**

In `docs/superpowers/plans/2026-09-11-runtime-upgrade.md`, the "Out of scope, but also end-of-life" note says Angular 19 needs its own plan. Replace that paragraph with:

```markdown
**Angular:** was end-of-life at 19 when this plan was written; upgraded to 22
separately — see `docs/superpowers/plans/2026-09-13-angular-upgrade.md`.
```

- [ ] **Step 6: Final verification**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend/evamed:/app" -w /app node:22-alpine \
  sh -lc 'npx ng version && npm run build -- --configuration production && npm test -- --watch=false && npx ng lint' 2>&1 | tail -30
docker compose up -d --build
curl -s http://localhost:8080/ | grep -c '<app-root'
grep -rn "@angular/fire\|onrender\|herokuapp" frontend/evamed/src frontend/evamed/package.json || echo "NO STALE REFERENCES"
```

Expected: Angular 22.1.x across the board, a clean build, 5 passing tests, lint at or below the baseline findings, `1` from the curl, and `NO STALE REFERENCES`. Then run the whole **S1–S8** one last time.

- [ ] **Step 7: Commit**

```bash
cd /home/maikolkali/evamed-monorepo
git add -A frontend/evamed docs/superpowers/plans/2026-09-11-runtime-upgrade.md
git commit -m "chore(frontend): drop dead code, bump Firebase to 12, refresh docs"
```

---

## Self-review notes

- **Decision coverage:** A1 → Tasks 3–5; A2/A3/A5 → Task 2; A4 → Task 2 Step 1 and Task 7 Step 3; A6 → Task 1 Steps 2–3 and Task 6; A7 → the S1–S8 steps in Tasks 2–5 and 7; A8/A9 → the "likely suspects" list in each hop; A10 → the "decline optional migrations" step in Tasks 3–5.
- **Names used across tasks:** `FIREBASE_AUTH`, `firebaseApp()`, `firebaseAuth()`, `AuthService.hasUser()`, `UserService.getMe()`, `environment.api_projects`, `environment.api_me`, the `test` target `@angular/build:unit-test`, and the S1–S8 checklist.
- **Verified against the registry while writing this plan** (2026-09-13): Angular `latest` 22.1.6, LTS lines 21.2.23 / 20.3.31 / 19.2.25; `@angular/fire` `latest` 20.0.1 with `@angular/core@^20`, `next` 21.0.0-rc.0; ng2-charts peers `>=19` (v8), `>=20` (v9), `>=21` (v10); `ngx-filesaver` majors 19–22 exist and peer only on `file-saver`; `angular-eslint` 22.5.0 requires `eslint ^9 || ^10`; TypeScript floors and Node floors as quoted in Global Constraints; `@angular/material@22.1.6` ships `prebuilt-themes/indigo-pink.css`; `@angular/build@22.1.6` ships the `unit-test` builder with a `vitest` default runner.
- **Known soft spot:** the hops cannot enumerate every compile error in advance, so Tasks 3–5 give a method plus this codebase's specific risk list instead of fabricated error text. The instruction "stop and report rather than guess" is what keeps that honest.
- **Second soft spot:** Task 6 Step 4 offers two ways to fake `onAuthStateChanged` because which one works depends on how Vitest resolves the `firebase/auth` module under the `unit-test` builder. The step requires the implementer to keep the passing version and say which, rather than leaving both.
