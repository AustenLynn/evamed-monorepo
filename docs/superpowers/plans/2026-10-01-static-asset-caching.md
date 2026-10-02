# Static Asset Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browsers cache Angular's fingerprinted files for a year and never re-request them, while `index.html` and unfingerprinted assets are always revalidated, so a deploy still takes effect immediately.

**Architecture:** The SPA is served by `frontend/evamed/server.js` (Express, `express.static`, default `max-age=0`). The server logic moves into `server/app.js`:
- a pure `cacheControlFor(relativePath)` function;
- a `createApp(distDir)` factory that applies it, including to the SPA fallback.

`server.js` keeps only `listen`. Node's built-in test runner tests both pieces, and the frontend CI job runs those tests.

**Tech Stack:** Express 4, `node:test`, Node 22 (`fetch` built in), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-01-security-performance-audit.md`, finding 4.

## Global Constraints

- **Immutable files** get `Cache-Control: public, max-age=31536000, immutable`. These are files **not** under `assets/` whose name matches `/-[A-Za-z0-9_-]{8}\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|eot)$/`.
  - Checked against the current production build: 45 of 137 files match, all of them Angular-fingerprinted (`main-*`, `chunk-*`, `polyfills-*`, `styles-*`, `media/*`).
- **Everything else** gets `Cache-Control: no-cache`: `index.html`, the SPA fallback for client routes, `favicon.ico`, everything under `assets/`, and the licence and route JSON files.
- **The `assets/` exclusion is required:** `assets/images/Icon awesome-file-download.png` matches the hash pattern by coincidence.
- **No change to what is served or how routes fall back.** Only headers change.
- **Commands run from `frontend/evamed`:** server tests with `npx -y -p node@22 -- node --test "server/*.test.js"`, frontend tests with `npx -y -p node@22 -- npm test -- --watch=false`.

## Review Focus

- **A deploy right after a user loaded the page:** their next navigation must get the new `index.html`. `index.html` and the fallback are `no-cache`; tested in Task 1.
- **An unfingerprinted file whose name happens to look hashed** (the `Icon awesome-file-download.png` case) must not become immutable. Tested in Task 1.
- **A deep link** such as `/materials-stage/update` must still return `index.html`, now with `no-cache`. Tested in Task 1.
- **`assets/files/*.xlsm` downloads after a template update:** they must not be stuck in caches. They're under `assets/`, so `no-cache`; tested in Task 1.
- **The production image starts.** `server.js` must still work as the container `CMD`; checked in the Task 1 deploy step.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `frontend/evamed/server/app.js` | Create | `cacheControlFor()`, `createApp()` |
| `frontend/evamed/server/app.test.js` | Create | `node:test` tests |
| `frontend/evamed/server.js` | Modify | Only `listen` |
| `.github/workflows/tests.yml` | Modify | Run the server tests in the `frontend` job |

---

### Task 1: Cache headers by file type

**Files:**
- Create: `frontend/evamed/server/app.js`, `frontend/evamed/server/app.test.js`
- Modify: `frontend/evamed/server.js`, `.github/workflows/tests.yml`

**Interfaces:**
- Produces, from `server/app.js` (CommonJS):
  - `cacheControlFor(relativePath: string): string`
  - `createApp(distDir: string): express.Application`

- [ ] **Step 1: Write the failing tests**

`frontend/evamed/server/app.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { cacheControlFor, createApp } = require('./app');

const IMMUTABLE = 'public, max-age=31536000, immutable';

test('fingerprinted build files are immutable', () => {
  for (const file of ['main-XKXL4GGQ.js', 'chunk-2wA4XfdU.js', 'chunk-a_b-CdE1.js', 'styles-EZC76LTV.css', 'media/Uso_-AB12cd34.png']) {
    assert.equal(cacheControlFor(file), IMMUTABLE, file);
  }
});

test('everything else is revalidated', () => {
  for (const file of ['index.html', 'favicon.ico', '3rdpartylicenses.txt', 'assets/map/2.jpg', 'assets/files/EVAMED_WINDOWS.xlsm', 'assets/images/Icon awesome-file-download.png']) {
    assert.equal(cacheControlFor(file), 'no-cache', file);
  }
});

test('the server sends those headers, including for the SPA fallback', async t => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'evamed-dist-'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<html>app</html>');
  fs.writeFileSync(path.join(dist, 'main-ABCD1234.js'), 'console.log(1)');
  fs.mkdirSync(path.join(dist, 'assets', 'images'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'assets', 'images', 'Icon awesome-file-download.png'), 'png');

  const server = createApp(dist).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const js = await fetch(`${base}/main-ABCD1234.js`);
  assert.equal(js.status, 200);
  assert.equal(js.headers.get('cache-control'), IMMUTABLE);

  for (const route of ['/', '/materials-stage/update']) {
    const page = await fetch(`${base}${route}`);
    assert.equal(page.status, 200, route);
    assert.equal(await page.text(), '<html>app</html>', route);
    assert.equal(page.headers.get('cache-control'), 'no-cache', route);
  }

  const asset = await fetch(`${base}/assets/images/Icon%20awesome-file-download.png`);
  assert.equal(asset.headers.get('cache-control'), 'no-cache');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run `npx -y -p node@22 -- node --test "server/*.test.js"`. Expected: FAIL with `Cannot find module './app'`.

- [ ] **Step 3: Implement**

`frontend/evamed/server/app.js`:

```javascript
// Serves the built Angular app. Angular fingerprints its bundles and media
// (main-XKXL4GGQ.js, media/Uso-AB12cd34.png), so those never change under the
// same name and can be cached for good. index.html and assets/ keep their
// names across deploys, so browsers must revalidate them.
const express = require('express');
const path = require('path');

const IMMUTABLE = 'public, max-age=31536000, immutable';
const FINGERPRINTED = /-[A-Za-z0-9_-]{8}\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|eot)$/;

function cacheControlFor(relativePath) {
  const file = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  // assets/ is copied as-is; a name like "Icon awesome-file-download.png" only looks hashed.
  if (!file.startsWith('assets/') && FINGERPRINTED.test(file)) {
    return IMMUTABLE;
  }
  return 'no-cache';
}

function createApp(distDir) {
  const app = express();
  app.use(
    express.static(distDir, {
      setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', cacheControlFor(path.relative(distDir, filePath)));
      },
    })
  );
  app.get('/*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'index.html'));
  });
  return app;
}

module.exports = { cacheControlFor, createApp };
```

Replace `frontend/evamed/server.js` with:

```javascript
const path = require('path');
const { createApp } = require('./server/app');

createApp(path.join(__dirname, 'dist', 'evamed')).listen(process.env.PORT || 8080);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run `npx -y -p node@22 -- node --test "server/*.test.js"`. Expected: `# pass 3`, `# fail 0`.

- [ ] **Step 5: Run them in CI**

In `.github/workflows/tests.yml`, add to the `frontend` job, after `Run the unit tests`:

```yaml
      - name: Test the production web server
        run: node --test "server/*.test.js"
```

- [ ] **Step 6: Check the real build locally**

Run:

```bash
npx -y -p node@22 -- npm run build -- --configuration production
PORT=8099 npx -y -p node@22 -- node server.js & sleep 2
curl -sI "http://127.0.0.1:8099/$(ls dist/evamed | grep '^main-')" | grep -i cache-control
curl -sI http://127.0.0.1:8099/ | grep -i cache-control
kill %1
```

Expected:
- the `main-*.js` request shows `cache-control: public, max-age=31536000, immutable`;
- `/` shows `cache-control: no-cache`.

- [ ] **Step 7: Commit**

```bash
git add frontend/evamed/server/app.js frontend/evamed/server/app.test.js frontend/evamed/server.js .github/workflows/tests.yml
git commit -m "perf(web): cache fingerprinted bundles for a year, revalidate the rest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Verify after deploy**

After the PR merges and the deploy job passes, run:

```bash
H=https://dev.evamediber.click
JS=$(curl -sS $H/ | grep -oE 'main-[A-Za-z0-9_-]{8}\.js' | head -1)
curl -sSI $H/$JS | grep -i cache-control
curl -sSI $H/ | grep -i cache-control
```

Expected: the first prints `public, max-age=31536000, immutable`, the second `no-cache`. Caddy passes the header through unchanged; if it doesn't, stop and report.
