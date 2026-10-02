# Security Response Headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `dev.evamediber.click` sends HSTS, anti-framing, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and a Content Security Policy, and CI proves both that the config is valid and that the headers are actually served.

**Architecture:** Caddy, which terminates TLS for both the SPA and the API, sets every header in one `header` block in `deploy/Caddyfile`. A small script, `deploy/check-headers.sh`, asserts the headers against a URL. A new CI job validates the Caddyfile before anything deploys, and the deploy job runs the script after each deploy. The CSP ships as `Content-Security-Policy-Report-Only` first, and is switched to enforcing only after a manual sign-in check (Task 3).

**Tech Stack:** Caddy 2 (`caddy:2-alpine`), GitHub Actions, bash + curl.

**Spec:** `docs/superpowers/specs/2026-10-01-security-performance-audit.md`, finding 2.

## Global Constraints

- **Exact header values:**
  - `Strict-Transport-Security: max-age=31536000`. No `includeSubDomains` and no `preload`: other subdomains of `evamediber.click` aren't ours to commit.
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- **CSP value** (one line in the Caddyfile, broken up here for reading):
  - `default-src 'self'`
  - `script-src 'self' https://apis.google.com 'unsafe-hashes' 'sha256-MhtPZXr7+LpJUY5qtMutB+qWfQtMaPccfe7QXtCcEYc='`
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
  - `font-src 'self' https://fonts.gstatic.com`
  - `img-src 'self' data: https://www.gstatic.com`
  - `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com`
  - `frame-src https://evamed-ac3f8.firebaseapp.com`
  - `frame-ancestors 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
  - `object-src 'none'`
- **Why each CSP source is there:**
  - The `sha256-…` hash is of Angular's inline critical-CSS loader, `onload="this.media='all'"`, in `index.html`.
  - `apis.google.com` and the `firebaseapp.com` frame come from Firebase `signInWithPopup` (`auth.service.ts`).
  - The fonts come from `src/index.html`.
  - `www.gstatic.com` is the Google icon in `register.component.html`.
  - `'unsafe-inline'` styles are required by Angular's component styles.
- **Tasks 1 and 2 never break sign-in.** Only Task 3 enforces the CSP, and only after its manual check passes.
- **The Caddyfile must be validated in CI before it can deploy**, because a broken Caddyfile takes the whole site down.

## Review Focus

- **Sign-in with each provider** (Google, Facebook, Apple, Microsoft, email/password) once the CSP is enforced. Covered by the Task 3 manual checklist; it can't be unit-tested.
- **API responses (`/api-projects/…`)** must carry the headers too, not just the SPA. `check-headers.sh` is run against an API URL in Task 1.
- **A Caddyfile typo** must fail CI before deploy. Task 1 includes a step that proves the validation job fails on a broken file.
- **Excel downloads** (`ngx-filesaver`, blob URLs) must still work under the enforced CSP. Part of the Task 3 checklist.
- **A redeploy** must keep the headers. The deploy job re-runs `check-headers.sh` every time (Task 1).
- **API responses already carry Django's `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`.** Each header must appear once, not twice. `defer` in the `header` block handles it; Task 1 Step 8 checks it.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `deploy/check-headers.sh` | Create | Exit 1 unless a URL serves the required headers |
| `deploy/Caddyfile` | Modify | The `header` block |
| `.github/workflows/tests.yml` | Modify | `caddy` validation job; post-deploy header check |
| `deploy/README.md` | Modify | One paragraph: where headers live, how to change the CSP |

---

### Task 1: Basic headers, with a check that proves them

**Files:**
- Create: `deploy/check-headers.sh`
- Modify: `deploy/Caddyfile`, `.github/workflows/tests.yml`, `deploy/README.md`

**Interfaces:**
- Produces: `deploy/check-headers.sh <url> [--csp report-only|enforce]`. It exits 0 when every required header is present, otherwise 1, listing what's missing. With `--csp`, it also requires that CSP header form.

- [ ] **Step 1: Write the check (it is the test)**

`deploy/check-headers.sh`:

```bash
#!/usr/bin/env bash
# Fail unless a URL is served with the security headers Caddy should add.
#   deploy/check-headers.sh https://dev.evamediber.click/ [--csp report-only|enforce]
set -euo pipefail
URL="${1:?usage: check-headers.sh <url> [--csp report-only|enforce]}"
CSP_MODE="${3:-}"
[ "${2:-}" = "--csp" ] || CSP_MODE=""

headers="$(curl -fsS -o /dev/null -D - "$URL" | tr -d '\r' | tr '[:upper:]' '[:lower:]')"
required=(
  "strict-transport-security: max-age=31536000"
  "x-frame-options: deny"
  "x-content-type-options: nosniff"
  "referrer-policy: strict-origin-when-cross-origin"
  "permissions-policy: camera=(), microphone=(), geolocation=(), payment=()"
)
case "$CSP_MODE" in
  report-only) required+=("content-security-policy-report-only: default-src 'self'") ;;
  enforce)     required+=("content-security-policy: default-src 'self'") ;;
esac

missing=0
for header in "${required[@]}"; do
  if ! grep -qF -- "$header" <<<"$headers"; then
    echo "missing: $header" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] && echo "ok: security headers on $URL"
exit "$missing"
```

Run `chmod +x deploy/check-headers.sh`.

- [ ] **Step 2: Run it against dev to see it fail**

Run:

```bash
deploy/check-headers.sh https://dev.evamediber.click/
deploy/check-headers.sh https://dev.evamediber.click/api/health/
```

Expected: both exit 1, printing five `missing:` lines.

- [ ] **Step 3: Add the headers to the Caddyfile**

In `deploy/Caddyfile`, add after `encode zstd gzip` inside the site block:

```caddy
	# Security headers for both the SPA and the API (check: deploy/check-headers.sh).
	# defer: apply after reverse_proxy copies the upstream headers, so these
	# replace Django's own X-Frame-Options/nosniff instead of duplicating them.
	header {
		defer
		Strict-Transport-Security "max-age=31536000"
		X-Frame-Options "DENY"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
	}
```

- [ ] **Step 4: Validate the Caddyfile in CI**

In `.github/workflows/tests.yml`, add a job after `frontend`:

```yaml
  caddy:
    name: caddy (config validates)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v7

      # A broken Caddyfile takes the whole site down on deploy.
      - name: Validate deploy/Caddyfile
        run: >
          docker run --rm -e SITE_DOMAIN=example.com
          -v "$PWD/deploy/Caddyfile:/etc/caddy/Caddyfile:ro"
          caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Then change the deploy job's `needs:` from `[backend, frontend]` to `[backend, frontend, caddy]`.

- [ ] **Step 5: Check the headers after every deploy**

In the `deploy` job, add after the `Deploy` step and before `Close SSH for this runner`:

```yaml
      - name: Check security headers
        run: |
          deploy/check-headers.sh "https://$EVAMED_DEV_HOST/"
          deploy/check-headers.sh "https://$EVAMED_DEV_HOST/api/health/"
```

- [ ] **Step 6: Document it**

In `deploy/README.md`, add after the `## Deploy` section's first paragraph:

```markdown
Security headers (HSTS, framing, nosniff, referrer, permissions and the CSP) are set in `deploy/Caddyfile`. CI validates that file before every deploy, and the deploy job checks the live headers afterwards with `deploy/check-headers.sh`.
```

- [ ] **Step 7: Prove the validation job fails on a broken file**

Do this on a throwaway branch, which you delete afterwards:

```bash
git switch -c caddy-red-check
printf '\n}\n' >> deploy/Caddyfile
git commit -qam "TEMP: broken Caddyfile"
git push -u origin caddy-red-check
```

Expected: the `caddy (config validates)` job fails in Actions. Then clean up:

```bash
git switch -
git push origin --delete caddy-red-check
git branch -D caddy-red-check
```

- [ ] **Step 8: Commit, PR, deploy, verify**

```bash
git add deploy/check-headers.sh deploy/Caddyfile .github/workflows/tests.yml deploy/README.md
git commit -m "feat(deploy): security headers on every response, checked after deploy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Open a PR. After it merges and deploys, expect:
- the deploy job's `Check security headers` step passes;
- `deploy/check-headers.sh https://dev.evamediber.click/` exits 0 locally;
- `curl -sSI https://dev.evamediber.click/api/health/ | grep -ci '^x-frame-options'` prints `1`, not `2`.

---

### Task 2: CSP in report-only mode

**Files:**
- Modify: `deploy/Caddyfile`, `.github/workflows/tests.yml`

**Interfaces:**
- Consumes: `check-headers.sh … --csp report-only` from Task 1.

- [ ] **Step 1: Make the post-deploy check require it (the failing test)**

In `tests.yml`, change the `Check security headers` step's two lines to:

```yaml
          deploy/check-headers.sh "https://$EVAMED_DEV_HOST/" --csp report-only
          deploy/check-headers.sh "https://$EVAMED_DEV_HOST/api/health/" --csp report-only
```

Run `deploy/check-headers.sh https://dev.evamediber.click/ --csp report-only` locally. Expected: exit 1 with `missing: content-security-policy-report-only: default-src 'self'`.

- [ ] **Step 2: Add the header**

In the Caddyfile's `header` block, add one line. This is the full CSP value from Global Constraints, on a single line:

```caddy
		Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' https://apis.google.com 'unsafe-hashes' 'sha256-MhtPZXr7+LpJUY5qtMutB+qWfQtMaPccfe7QXtCcEYc='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.gstatic.com; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com; frame-src https://evamed-ac3f8.firebaseapp.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
```

- [ ] **Step 3: Commit, PR, deploy, verify**

```bash
git add deploy/Caddyfile .github/workflows/tests.yml
git commit -m "feat(deploy): content security policy in report-only mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

After the deploy, expect: the deploy job's header check passes with `--csp report-only`.

---

### Task 3: Enforce the CSP (manual gate first)

**Files:**
- Modify: `deploy/Caddyfile`, `.github/workflows/tests.yml`

- [ ] **Step 1: Manual check under report-only**

Open `https://dev.evamediber.click/` in Chrome with DevTools → Console open, with "Preserve log" on. Do every item below, and look for messages that start with `[Report Only] Refused to …`:

1. Sign in with email/password, then sign out.
2. Sign in with Google; with Facebook; with Apple; with Microsoft. Skip any provider that isn't enabled in the Firebase console.
3. Create a project, download the Windows template, upload it, and click **Continuar** → **Entendido**.
4. Go through Producción, Construcción, Uso and Fin de vida, then **Ir a resultados**.
5. On home, open a project's results tab.

Expected: **no** `[Report Only]` messages. If any appear, add the refused origin to the matching directive in the Caddyfile, redeploy, and repeat this step. Don't continue until it's clean.

- [ ] **Step 2: Require enforcement in the check (the failing test)**

In `tests.yml`, change both `--csp report-only` to `--csp enforce`. Run `deploy/check-headers.sh https://dev.evamediber.click/ --csp enforce`. Expected: exit 1, `missing: content-security-policy: default-src 'self'`.

- [ ] **Step 3: Enforce**

In the Caddyfile, rename the header `Content-Security-Policy-Report-Only` to `Content-Security-Policy`. Keep the value unchanged.

- [ ] **Step 4: Commit, PR, deploy, verify**

```bash
git add deploy/Caddyfile .github/workflows/tests.yml
git commit -m "feat(deploy): enforce the content security policy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

After the deploy, expect:
- the header check passes with `--csp enforce`;
- repeating Step 1's checklist shows no `Refused to …` errors, and every sign-in works.

If sign-in breaks, revert this commit on `main`; that redeploys report-only.
