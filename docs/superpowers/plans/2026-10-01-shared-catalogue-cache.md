# Catalogue Caching and Stale Project Caches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- The two big public catalogues (`materials` 348 KB, `material-scheme-data` 331 KB) are downloaded once per session and shared by every service.
- A user's own project rows are never served from a cache.

**Architecture:**
- **A new `CatalogueCacheService`** caches GET responses by URL (`shareReplay`) and drops an entry on error or on `invalidate(url)`.
  - `MaterialsService` and `AnalisisService` route those two catalogues through it.
  - Their admin write methods invalidate it.
- **The per-user caches go:** `AnalisisService._schemeProject$` and `ProjectsService.materialSchemeCache$`.

**Tech Stack:** Angular 22 services, RxJS `shareReplay`, `HttpTestingController`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-security-performance-audit.md`, finding 6, including the stale project-row caches found while planning (see below).

## Global Constraints

- **What's actually uncached today.** These are the only duplicate downloads of large catalogues; the other catalogues are already cached by `AnalisisService`/`CatalogsService` (`shareReplay(1)`), and that stays as it is.
  - `MaterialsService.getMaterials()`: uncached.
  - `AnalisisService.getMaterials()`: has its own separate cache.
  - `AnalisisService.getMaterialSchemeData()`: uncached.
- **Found while planning (correctness/privacy).** Both caches below hold **the signed-in user's own rows** of `material-scheme-project`.
  - `AnalisisService.getMaterialSchemeProyect()` caches them for the whole session and is never invalidated. The results page (`comparar.component.ts:252`) reads it, so results stay stale after editing materials. After a sign-out and sign-in as someone else in the same tab, it would serve the previous user's rows.
  - `ProjectsService.getMaterialSchemeProyect()` caches the same rows. It's cleared on update and delete, but not on add.
  - **Both stop caching.** Per-user data is fetched on every call, like the other per-project methods in `AnalisisService`.
- **Writes that must invalidate:**
  - `materials`: `MaterialsService.addMaterial`, `updateMaterial`, `deleteMaterial`.
  - `material-scheme-data`: `MaterialsService.deleteMaterialSchemeData`, `AnalisisService.addMaterialSchemeData`, `updateMaterialSchemeData`.
- **A failed request must not be cached.** The next call retries.
- **`searchMaterial()` (`?search=`) is not cached.** It's a different URL and a different purpose.
- **Plan interplay:** if `2026-10-01-materials-save-replaces.md` has landed, `ProjectsService.replaceMaterialScheme()` calls `this.clearMaterialSchemeCache()`. Task 1 removes that method, so remove that call too.
- **Frontend commands run from `frontend/evamed`:** `npx -y -p node@22 -- npm test -- --watch=false`. A single file: `npx -y -p node@22 -- npx ng test --watch=false --include <path>`.

## Review Focus

- **Two components on one page ask for `materials` at the same moment,** before the first response. That must be one request, because `shareReplay` subscribes once. Tested in Task 2.
- **The catalogue request fails** (network, 5xx). The error must reach the caller, and the next call must retry. Tested in Task 2.
- **An admin adds a material, then opens a page listing materials in the same session.** The new material is there. Tested in Task 2.
- **The results page opened twice in one session with a materials edit in between** sees the edit. Tested in Task 1: two calls make two requests.
- **A different user signs in in the same tab.** No per-user rows come from memory, since Task 1 removes those caches. Covered by the same Task 1 tests.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `frontend/evamed/src/app/core/services/catalogue-cache/catalogue-cache.service.ts` | Create | URL-keyed GET cache |
| `frontend/evamed/src/app/core/services/catalogue-cache/catalogue-cache.service.spec.ts` | Create | Its tests |
| `frontend/evamed/src/app/core/services/materials/materials.service.ts` | Modify | `getMaterials()` via the cache; writes invalidate |
| `frontend/evamed/src/app/core/services/analisis/analisis.service.ts` | Modify | `getMaterials()`/`getMaterialSchemeData()` via the cache; writes invalidate; `getMaterialSchemeProyect()` uncached |
| `frontend/evamed/src/app/core/services/projects/projects.service.ts` | Modify | `getMaterialSchemeProyect()` uncached; cache field and `clearMaterialSchemeCache()` removed |
| `frontend/evamed/src/app/core/services/catalogue-usage.spec.ts` | Create | Cross-service tests |

---

### Task 1: Never cache a user's own project rows

**Files:**
- Modify: `analisis/analisis.service.ts`, `projects/projects.service.ts` (both under `frontend/evamed/src/app/core/services/`)
- Create: `frontend/evamed/src/app/core/services/catalogue-usage.spec.ts`

- [ ] **Step 1: Write the failing tests**

`frontend/evamed/src/app/core/services/catalogue-usage.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AnalisisService } from './analisis/analisis.service';
import { ProjectsService } from './projects/projects.service';

describe('per-user project rows', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // The results page reads these; a cached copy hides edits (and, after a
  // sign-in as someone else in the same tab, shows the previous user's rows).
  it('AnalisisService fetches them on every call', () => {
    const analisis = TestBed.inject(AnalisisService);
    analisis.getMaterialSchemeProyect().subscribe();
    http.expectOne(environment.api_scheme_project).flush([]);

    analisis.getMaterialSchemeProyect().subscribe();
    http.expectOne(environment.api_scheme_project).flush([]);
  });

  it('ProjectsService fetches them on every call', () => {
    const projects = TestBed.inject(ProjectsService);
    projects.getMaterialSchemeProyect().subscribe();
    http.expectOne(environment.api_scheme_project).flush([]);

    projects.getMaterialSchemeProyect().subscribe();
    http.expectOne(environment.api_scheme_project).flush([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/core/services/catalogue-usage.spec.ts`. Expected: both fail with `Expected one matching request … found none` on the second `expectOne`.

- [ ] **Step 3: Remove the caches**

In `analisis.service.ts`:
- delete the field `private _schemeProject$: Observable<any>;`;
- replace `getMaterialSchemeProyect()` with the code below;
- move the method into the `// Mutable per-project data — not cached` group.

```typescript
  getMaterialSchemeProyect() {
    // The signed-in user's own rows: never cached.
    return this.http.get<any>(environment.api_scheme_project);
  }
```

In `projects.service.ts`:
- delete the field `private materialSchemeCache$: Observable<any[]> | null = null;` and the whole `clearMaterialSchemeCache()` method;
- replace `getMaterialSchemeProyect()` with the code below;
- in `updateMaterialSchemeProject()` and `deleteSchemeProject()`, delete the `this.clearMaterialSchemeCache();` lines and the comment above the first one;
- if `replaceMaterialScheme()` exists, change its `.pipe(tap(() => this.clearMaterialSchemeCache()))` to nothing, so it just returns the `put(...)`;
- remove `shareReplay` from the `rxjs/operators` import if nothing else uses it.

```typescript
  getMaterialSchemeProyect(): Observable<any[]> {
    // The signed-in user's own rows: never cached.
    return this.http.get<any[]>(environment.api_scheme_project);
  }
```

- [ ] **Step 4: Run to verify they pass, then the full suite**

Run the Step 2 command, then `npx -y -p node@22 -- npm test -- --watch=false`. Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/core/services/analisis/analisis.service.ts frontend/evamed/src/app/core/services/projects/projects.service.ts frontend/evamed/src/app/core/services/catalogue-usage.spec.ts
git commit -m "fix(frontend): stop caching the user's own project rows

The results page read material rows from a session-long cache, so it
computed from stale rows after an edit and could show the previous
user's rows after a sign-in as someone else in the same tab.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: One shared cache for the big catalogues

**Files:**
- Create: `frontend/evamed/src/app/core/services/catalogue-cache/catalogue-cache.service.ts`, `catalogue-cache.service.spec.ts`
- Modify: `materials/materials.service.ts`, `analisis/analisis.service.ts`, `catalogue-usage.spec.ts`

**Interfaces:**
- Produces `CatalogueCacheService` (`providedIn: 'root'`) with:
  - `get<T>(url: string): Observable<T>`
  - `invalidate(url: string): void`

- [ ] **Step 1: Write the failing tests**

`frontend/evamed/src/app/core/services/catalogue-cache/catalogue-cache.service.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CatalogueCacheService } from './catalogue-cache.service';

describe('CatalogueCacheService', () => {
  let cache: CatalogueCacheService,
    http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    cache = TestBed.inject(CatalogueCacheService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('makes one request for simultaneous and later callers', () => {
    const seen: any[] = [];
    cache.get('/c/').subscribe(v => seen.push(v));
    cache.get('/c/').subscribe(v => seen.push(v));
    http.expectOne('/c/').flush([1]);
    cache.get('/c/').subscribe(v => seen.push(v));

    expect(seen).toEqual([[1], [1], [1]]);
  });

  it('refetches after invalidate', () => {
    cache.get('/c/').subscribe();
    http.expectOne('/c/').flush([1]);
    cache.invalidate('/c/');

    let value: any;
    cache.get('/c/').subscribe(v => (value = v));
    http.expectOne('/c/').flush([2]);
    expect(value).toEqual([2]);
  });

  it('passes an error on and retries on the next call', () => {
    let failed = false;
    cache.get('/c/').subscribe({ error: () => (failed = true) });
    http.expectOne('/c/').flush('boom', { status: 500, statusText: 'Server Error' });
    expect(failed).toBe(true);

    let value: any;
    cache.get('/c/').subscribe(v => (value = v));
    http.expectOne('/c/').flush([3]);
    expect(value).toEqual([3]);
  });
});
```

Append to `catalogue-usage.spec.ts`. First add these imports at the top:

```typescript
import { MaterialsService } from './materials/materials.service';
```

Then add this block at the end of the file:

```typescript
describe('shared catalogues', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('MaterialsService and AnalisisService share one materials download', () => {
    TestBed.inject(MaterialsService).getMaterials().subscribe();
    TestBed.inject(AnalisisService).getMaterials().subscribe();
    TestBed.inject(MaterialsService).getMaterials().subscribe();

    http.expectOne(environment.api_materials).flush([]);
  });

  it('an admin edit refreshes materials for everyone', () => {
    const materials = TestBed.inject(MaterialsService);
    materials.getMaterials().subscribe();
    http.expectOne(environment.api_materials).flush([{ id: 1 }]);

    materials.addMaterial({ name_material: 'Nuevo' }).subscribe();
    http.expectOne(r => r.method === 'POST' && r.url === environment.api_materials).flush({ id: 2 });

    let list: any;
    TestBed.inject(AnalisisService).getMaterials().subscribe(v => (list = v));
    http.expectOne(r => r.method === 'GET' && r.url === environment.api_materials).flush([{ id: 1 }, { id: 2 }]);
    expect(list.length).toBe(2);
  });

  it('material-scheme-data is downloaded once and refreshed after a write', () => {
    const analisis = TestBed.inject(AnalisisService);
    analisis.getMaterialSchemeData().subscribe();
    analisis.getMaterialSchemeData().subscribe();
    http.expectOne(environment.api_material_scheme_data).flush([]);

    TestBed.inject(MaterialsService).deleteMaterialSchemeData(5).subscribe();
    http.expectOne(`${environment.api_material_scheme_data}5/`).flush(null);

    analisis.getMaterialSchemeData().subscribe();
    http.expectOne(r => r.method === 'GET' && r.url === environment.api_material_scheme_data).flush([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx -y -p node@22 -- npx ng test --watch=false --include src/app/core/services/catalogue-cache/catalogue-cache.service.spec.ts --include src/app/core/services/catalogue-usage.spec.ts`. Expected:
- the cache spec fails to compile (`Cannot find module './catalogue-cache.service'`);
- the shared-catalogue tests fail with `Expected one matching request … found 2` (or 3).

- [ ] **Step 3: Implement the cache**

`frontend/evamed/src/app/core/services/catalogue-cache/catalogue-cache.service.ts`:

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';

/**
 * Session cache for large public catalogues, shared by every service that
 * reads them. Keyed by URL. Services that change a catalogue invalidate it.
 * Never use it for a user's own data.
 */
@Injectable({ providedIn: 'root' })
export class CatalogueCacheService {
  private entries = new Map<string, Observable<unknown>>();

  constructor(private http: HttpClient) {}

  get<T>(url: string): Observable<T> {
    let entry = this.entries.get(url) as Observable<T> | undefined;
    if (!entry) {
      entry = this.http.get<T>(url).pipe(
        catchError(error => {
          this.entries.delete(url); // don't replay a failure; the next call retries
          return throwError(() => error);
        }),
        shareReplay(1)
      );
      this.entries.set(url, entry);
    }
    return entry;
  }

  invalidate(url: string): void {
    this.entries.delete(url);
  }
}
```

- [ ] **Step 4: Route the services through it**

In `materials.service.ts`:
- add `import { CatalogueCacheService } from '../catalogue-cache/catalogue-cache.service';`;
- change the constructor to `constructor(private http: HttpClient, private catalogueCache: CatalogueCacheService) {}`;
- replace `getMaterials()` with the code below;
- in `addMaterial`, `deleteMaterial` and `updateMaterial`, change the `tap(data => { return data; })` to `tap(() => this.catalogueCache.invalidate(environment.api_materials))`;
- in `deleteMaterialSchemeData`, change it to `tap(() => this.catalogueCache.invalidate(environment.api_material_scheme_data))`.

```typescript
  getMaterials() {
    return this.catalogueCache.get<any>(environment.api_materials);
  }
```

In `analisis.service.ts`:
- add the same import;
- change the constructor to `constructor(private http: HttpClient, private catalogueCache: CatalogueCacheService) {}`;
- delete the `private _materials$: Observable<any>;` field;
- replace the two getters with the code below;
- in `updateMaterialSchemeData` and `addMaterialSchemeData`, change `tap(data => { return data; })` to `tap(() => this.catalogueCache.invalidate(environment.api_material_scheme_data))`.

```typescript
  getMaterialSchemeData() {
    return this.catalogueCache.get<any>(environment.api_material_scheme_data);
  }
```

```typescript
  getMaterials() {
    return this.catalogueCache.get<any>(environment.api_materials);
  }
```

- [ ] **Step 5: Run to verify they pass, then the full suite and build**

Run the Step 2 command, then:

```bash
npx -y -p node@22 -- npm test -- --watch=false
npx -y -p node@22 -- npm run build -- --configuration production
```

Expected:
- 5 new tests pass (3 cache + 2 usage), plus Task 1's 2;
- the full suite is green;
- the build succeeds.

Specs that build `MaterialsService` or `AnalisisService` with `new` and positional arguments must pass a second argument. Search with `grep -rn "new MaterialsService\|new AnalisisService" src`; if there are none, nothing to do.

- [ ] **Step 6: Commit**

```bash
git add frontend/evamed/src/app/core/services/catalogue-cache/ frontend/evamed/src/app/core/services/materials/materials.service.ts frontend/evamed/src/app/core/services/analisis/analisis.service.ts frontend/evamed/src/app/core/services/catalogue-usage.spec.ts
git commit -m "perf(frontend): download the materials catalogues once per session

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After this plan

- **Check on dev.** Open a project's materials edit page with DevTools → Network filtered on `materials/`. Expect one request for `/api-projects/materials/` instead of up to five.
- **Check the results page.** Open it, edit a material, and open it again in the same tab. The results reflect the edit without a reload.
