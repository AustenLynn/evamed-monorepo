# Materials Save Replaces Instead of Appending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saving on the new-project materials page sets the project's material rows to exactly what's selected, so autosave can never duplicate rows or keep rows for deselected systems.

**Architecture:** A new owner-scoped endpoint, `PUT /api-projects/projects/<id>/material-scheme/`, atomically replaces the project's rows for the given origins. `MaterialsStageComponent.saveStepOne()` builds the full list locally, resolving material ids from the catalogue it already loaded instead of one `searchMaterial` request per row, and sends one request.

**Tech Stack:** Django 5.2 + DRF 3.16 (APIView, `transaction.atomic`, `bulk_create`), Angular 22, Vitest via `ng test`.

**Spec:** `docs/superpowers/specs/2026-10-01-security-performance-audit.md`, finding 1.

## Global Constraints

- **Only rows with `origin_id` in the request's `origins` are replaced.**
  - The page sends `[1, 2]`: Modelo de Revit / Template EVAMED = 1, Opciones EVAMED = 2.
  - Rows of any other origin (e.g. 3, Usuario_Plataforma) must be untouched.
- **Ownership uses `access.owned_projects(request.user)`** (verified-email owner).
  - A project the caller doesn't own → **404**, the same as `ProjectResultsView`.
  - Unauthenticated → 401.
- **The replace is atomic:** if any item is invalid, nothing changes and the response is 400.
- **Row fields and value conversions must match today's `saveStepOne()` exactly** (listed in Task 2), so results don't change except for removed duplicates.
- **Existing duplicate rows in the database are not cleaned up by this plan** (see "After this plan").
- **Backend tests need Docker or CI.** Use `docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/backend/evamed-api:/app" api python manage.py test projects_api.tests_material_scheme_replace` from the repo root when Docker Desktop's WSL integration is on. Otherwise push the branch and read the `backend` job in GitHub Actions.
- **Frontend tests:** from `frontend/evamed`, run `npx -y -p node@22 -- npm test -- --watch=false`. The local Node 22.22.0 is below Angular's minimum.

## Review Focus

- **Autosave fires before the materials catalogue has loaded.** It must send nothing; sending an empty list would wipe the project's rows. Test in Task 2.
- **The save request fails (network, 5xx).** The next autosave tick must retry rather than consider the state saved. Test in Task 2.
- **A system is deselected after being saved.** Its rows must disappear on the next save. Test in Task 2.
- **The same material appears twice in one system with the same quantity**, a legitimate Excel duplicate. Both rows are kept, as they are today. Test in Task 2.
- **Rows of other origins (3) already exist for the project.** They survive a replace. Test in Task 1.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `backend/evamed-api/projects_api/views.py` | Modify | `ProjectMaterialSchemeView` (PUT replace) |
| `backend/evamed-api/projects_api/serializers.py` | Modify | `MaterialSchemeReplaceSerializer` (request shape) |
| `backend/evamed-api/projects_api/urls.py` | Modify | Route `projects/<int:project_id>/material-scheme/` |
| `backend/evamed-api/projects_api/tests_material_scheme_replace.py` | Create | Endpoint tests |
| `frontend/evamed/src/app/core/services/projects/projects.service.ts` | Modify | `replaceMaterialScheme()` |
| `frontend/evamed/src/app/materials-stage/components/materials-stage/materials-stage.component.ts` | Modify | `saveStepOne()` builds the list and calls replace; autosave retries on error |
| `frontend/evamed/src/app/materials-stage/components/materials-stage/materials-stage-save.spec.ts` | Create | Save behaviour tests |

---

### Task 1: The replace endpoint

**Files:**
- Modify: `backend/evamed-api/projects_api/serializers.py` (append)
- Modify: `backend/evamed-api/projects_api/views.py` (add a class after `ProjectResultsView`)
- Modify: `backend/evamed-api/projects_api/urls.py`
- Create: `backend/evamed-api/projects_api/tests_material_scheme_replace.py`

**Interfaces:**
- Produces: `PUT /api-projects/projects/<project_id>/material-scheme/`.
  - **Request body:** `{"origins": [int, ...], "items": [ <MaterialSchemeProject fields without project_id> ]}`.
  - **Response:** `200 {"items": [<serialized rows created>]}`.
  - **Errors:** 400 invalid body / item origin not in `origins`; 401 unauthenticated; 404 not the caller's project.

- [ ] **Step 1: Write the failing tests**

`backend/evamed-api/projects_api/tests_material_scheme_replace.py`:

```python
from rest_framework import status
from rest_framework.test import APITestCase

from projects_api import models
from projects_api.testing import firebase_user, owned_project


class MaterialSchemeReplaceTests(APITestCase):
    def setUp(self):
        self.project = owned_project('alice@example.com')
        self.section = models.Section.objects.create(name_section='Cimentación')
        self.revit = models.Origin.objects.create(name_origin='Modelo de Revit')
        self.dynamo = models.Origin.objects.create(name_origin='Opciones EVAMED')
        self.user_origin = models.Origin.objects.create(name_origin='Usuario_Plataforma')
        self.concreto = models.Material.objects.create(name_material='Concreto')
        self.url = '/api-projects/projects/%d/material-scheme/' % self.project.id
        self.client.force_authenticate(user=firebase_user('alice@example.com'))

    def item(self, origin, system='Muro A', quantity='12.5'):
        return {
            'construction_system': system,
            'comercial_name': 'Concreto',
            'quantity': quantity,
            'provider_distance': 0,
            'material_id': self.concreto.id,
            'origin_id': origin.id,
            'section_id': self.section.id,
            'value': None,
            'distance_init': 0,
            'distance_end': 0,
            'replaces': 0,
            'city_id_origin': None,
            'state_id_origin': None,
            'city_id_end': None,
            'transport_id_origin': None,
            'transport_id_end': None,
            'unit_text': 'm3',
            'description_material': '',
        }

    def rows(self, origin):
        return models.MaterialSchemeProject.objects.filter(project_id=self.project, origin_id=origin)

    def put(self, items, origins=None):
        origins = origins or [self.revit.id, self.dynamo.id]
        return self.client.put(self.url, {'origins': origins, 'items': items}, format='json')

    def test_replaces_rows_of_the_given_origins_and_is_idempotent(self):
        models.MaterialSchemeProject.objects.create(project_id=self.project, origin_id=self.revit, construction_system='Viejo')
        items = [self.item(self.revit), self.item(self.dynamo, system='Losa')]

        for _ in range(3):
            response = self.put(items)
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(list(self.rows(self.revit).values_list('construction_system', flat=True)), ['Muro A'])
        self.assertEqual(list(self.rows(self.dynamo).values_list('construction_system', flat=True)), ['Losa'])
        self.assertEqual(len(response.data['items']), 2)

    def test_keeps_rows_of_other_origins(self):
        models.MaterialSchemeProject.objects.create(project_id=self.project, origin_id=self.user_origin, construction_system='Propio')

        self.put([self.item(self.revit)])

        self.assertEqual(self.rows(self.user_origin).count(), 1)

    def test_keeps_legitimate_duplicates_sent_by_the_page(self):
        self.put([self.item(self.revit), self.item(self.revit)])

        self.assertEqual(self.rows(self.revit).count(), 2)

    def test_an_empty_list_clears_the_given_origins(self):
        models.MaterialSchemeProject.objects.create(project_id=self.project, origin_id=self.revit)

        response = self.put([])

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.rows(self.revit).count(), 0)

    def test_rejects_an_item_outside_the_given_origins_and_changes_nothing(self):
        models.MaterialSchemeProject.objects.create(project_id=self.project, origin_id=self.revit, construction_system='Viejo')

        response = self.put([self.item(self.revit), self.item(self.user_origin)])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(list(self.rows(self.revit).values_list('construction_system', flat=True)), ['Viejo'])

    def test_another_users_project_is_not_found(self):
        self.client.force_authenticate(user=firebase_user('mallory@example.com'))

        response = self.put([self.item(self.revit)])

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.rows(self.revit).count(), 0)

    def test_unverified_email_is_not_the_owner(self):
        self.client.force_authenticate(user=firebase_user('alice@example.com', verified=False))

        self.assertEqual(self.put([self.item(self.revit)]).status_code, status.HTTP_404_NOT_FOUND)

    def test_anonymous_is_rejected(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(self.put([]).status_code, status.HTTP_401_UNAUTHORIZED)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run the backend command from Global Constraints. Expected: the tests fail with `404` responses (the route doesn't exist yet). The cross-user and unverified tests may pass by accident; the rest must fail.

- [ ] **Step 3: Add the request serializer**

Append to `backend/evamed-api/projects_api/serializers.py`:

```python
class MaterialSchemeReplaceSerializer(serializers.Serializer):
    """Body of PUT projects/<id>/material-scheme/: the full set of rows for some origins."""
    origins = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    items = serializers.ListField(child=serializers.DictField(), allow_empty=True)
```

- [ ] **Step 4: Add the view**

In `backend/evamed-api/projects_api/views.py`, add after the `ProjectResultsView` class (`transaction`, `Response`, `status`, `IsAuthenticated`, `models`, `serializers` and `access` are already imported):

```python
class ProjectMaterialSchemeView(APIView):
    """
    Replace a project's material rows for some origins in one step.

    PUT /api-projects/projects/<id>/material-scheme/
    {"origins": [1, 2], "items": [<MaterialSchemeProject fields, no project_id>]}

    The new-project materials page autosaves its whole selection; appending
    each time duplicated rows, so it sends the full set and the server swaps it.
    Rows of origins not listed are left alone.
    """

    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def put(self, request, project_id):
        project = access.owned_projects(request.user).filter(id=project_id).first()
        if project is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        body = serializers.MaterialSchemeReplaceSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        origins = set(body.validated_data['origins'])

        rows = serializers.MaterialSchemeProjectSerializer(
            data=[dict(item, project_id=project.id) for item in body.validated_data['items']],
            many=True,
        )
        rows.is_valid(raise_exception=True)
        outside = [row['origin_id'].id for row in rows.validated_data if row.get('origin_id') is None or row['origin_id'].id not in origins]
        if outside:
            return Response(
                {'detail': 'Every item must use one of the given origins.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        models.MaterialSchemeProject.objects.filter(project_id=project, origin_id__in=origins).delete()
        created = models.MaterialSchemeProject.objects.bulk_create(
            [models.MaterialSchemeProject(**row) for row in rows.validated_data]
        )
        data = serializers.MaterialSchemeProjectSerializer(created, many=True).data
        return Response({'items': data}, status=status.HTTP_200_OK)
```

The `outside` check treats a missing `origin_id` as outside, so a row without an origin can't slip past the replace.

- [ ] **Step 5: Route it**

In `backend/evamed-api/projects_api/urls.py`, add to `urlpatterns`, next to the results route:

```python
    path('projects/<int:project_id>/material-scheme/', views.ProjectMaterialSchemeView.as_view()),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run the backend command from Global Constraints, then the full suite (`python manage.py test`). Expected: the 8 new tests pass, and the full suite stays green (the existing 115+ tests).

- [ ] **Step 7: Commit**

```bash
git add backend/evamed-api/projects_api/serializers.py backend/evamed-api/projects_api/views.py backend/evamed-api/projects_api/urls.py backend/evamed-api/projects_api/tests_material_scheme_replace.py
git commit -m "feat(api): replace a project's material rows per origin in one request

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The materials page saves by replacing

**Files:**
- Modify: `frontend/evamed/src/app/core/services/projects/projects.service.ts`
- Modify: `frontend/evamed/src/app/materials-stage/components/materials-stage/materials-stage.component.ts` (`startAutosave()` around line 232; `saveStepOne()` lines 615–768)
- Create: `frontend/evamed/src/app/materials-stage/components/materials-stage/materials-stage-save.spec.ts`

**Interfaces:**
- Consumes: Task 1's endpoint.
- Produces:
  - `ProjectsService.replaceMaterialScheme(projectId: number, origins: number[], items: object[]): Observable<{ items: any[] }>`, which also clears `materialSchemeCache$`.
  - `MaterialsStageComponent.saveStepOne(): void` (no longer `async`).

**Field mapping that must be preserved.** This is today's `addSchemeProject` payload, with `data` = one Excel row and `key` = the sheet index:

| Field | Value |
|---|---|
| `construction_system` | `data.Sistema_constructivo` |
| `comercial_name` | `data.Material` |
| `quantity` | `data.Cantidad` |
| `provider_distance` | `0` |
| `material_id` | `id` of **each** catalogue material whose `name_material === materialToSearch`. Today, every exact match gets its own row. |
| `origin_id` | 1 for `Origen` of 'Modelo de Revit' / 'Template EVAMED' (from `SOR`); 2 for 'Opciones EVAMED' (from `SOD`) |
| `section_id` | `key + 1` |
| `value` | `null` |
| `distance_init` / `distance_end` | `0` when `distancia_1`/`_2` is `''` or `undefined`, else `parseInt(…, 10)` |
| `replaces` | `0` when `reemplazos` is `''` or `undefined`, else `data.reemplazos` |
| `city_id_origin` | `this.ciudadOrigenSeleccionada` |
| `state_id_origin` | `1` |
| `city_id_end` | `1` |
| `transport_id_origin` / `transport_id_end` | `null` when `transporte_1`/`_2` is `''` or `undefined`. Otherwise `parseInt(…, 10)` for origin 1 and the **raw value** for origin 2. |
| `unit_text` | `data.Unidad` |
| `description_material` | `data['Descripción de Material']` |

Here `materialToSearch` is `data.materialSelectedDB` when `data.name_material_db !== undefined`, else `data.Material`.

- [ ] **Step 1: Write the failing tests**

`frontend/evamed/src/app/materials-stage/components/materials-stage/materials-stage-save.spec.ts`:

```typescript
import { of, throwError } from 'rxjs';

// Compile the component in its NgModule's context.
import '../../materials-stage.module';
import { MaterialsStageComponent } from './materials-stage.component';

// The page autosaves its whole selection every few seconds. Each save must
// set the project's rows to that selection (one replace request), not add to
// what earlier saves stored.
describe('MaterialsStageComponent saving', () => {
  const sheet = [
      { Sistema_constructivo: 'Muro A', Origen: 'Modelo de Revit', Material: 'Concreto', Cantidad: 12.5, Unidad: 'm3',
        distancia_1: '', distancia_2: '30', transporte_1: '2', transporte_2: '', reemplazos: '', 'Descripción de Material': 'c' },
      { Sistema_constructivo: 'Muro A', Origen: 'Modelo de Revit', Material: 'Concreto', Cantidad: 12.5, Unidad: 'm3' },
      { Sistema_constructivo: 'Muro B', Origen: 'Modelo de Revit', Material: 'Acero', Cantidad: 3, Unidad: 'kg' },
      { Sistema_constructivo: 'Losa', Origen: 'Opciones EVAMED', Material: 'Acero', Cantidad: 7, Unidad: 'kg', transporte_1: '4' },
      { Sistema_constructivo: 'Muro A', Origen: 'Modelo de Revit', Material: 'Desconocido', Cantidad: 1 },
    ];

  const replaceMock = () =>
    vi.fn((_projectId: number, _origins: number[], _items: any[]) => of({ items: [] as any[] }));

  const build = (replace: ReturnType<typeof replaceMock> = replaceMock()) => {
    const component: any = Object.create(MaterialsStageComponent.prototype);
    component.projectId = 42;
    component.ciudadOrigenSeleccionada = 9;
    component.materialsList = [{ id: 1, name_material: 'Concreto' }, { id: 2, name_material: 'Acero' }];
    component.contentData = [[], sheet];
    component.SOR = [['Muro A']];
    component.SOD = [['Losa']];
    component.SOU = [];
    component.projectsService = { replaceMaterialScheme: replace, addSchemeProject: vi.fn() };
    component.materialsService = { searchMaterial: vi.fn() };
    return { component, replace };
  };

  it('replaces the project rows with exactly the selected systems', () => {
    const { component, replace } = build();

    component.saveStepOne();

    expect(replace).toHaveBeenCalledTimes(1);
    const [projectId, origins, items] = replace.mock.calls[0];
    expect(projectId).toBe(42);
    expect(origins).toEqual([1, 2]);
    expect(items.map((i: any) => [i.construction_system, i.material_id, i.origin_id])).toEqual([
      ['Muro A', 1, 1],
      ['Muro A', 1, 1], // a legitimate duplicate row in the Excel is kept
      ['Losa', 2, 2],
    ]);
    expect(items[0]).toEqual({
      construction_system: 'Muro A', comercial_name: 'Concreto', quantity: 12.5, provider_distance: 0,
      material_id: 1, origin_id: 1, section_id: 1, value: null, distance_init: 0, distance_end: 30,
      replaces: 0, city_id_origin: 9, state_id_origin: 1, city_id_end: 1,
      transport_id_origin: 2, transport_id_end: null, unit_text: 'm3', description_material: 'c',
    });
    expect(items[2].transport_id_origin).toBe('4'); // origin 2 keeps the raw value, as before
    expect(component.projectsService.addSchemeProject).not.toHaveBeenCalled();
    expect(component.materialsService.searchMaterial).not.toHaveBeenCalled();
  });

  it('drops a deselected system on the next save', () => {
    const { component, replace } = build();
    component.saveStepOne();

    component.SOR = [[]];
    component.saveStepOne();

    expect(replace.mock.calls[1][2].map((i: any) => i.construction_system)).toEqual(['Losa']);
  });

  it('sends nothing until the materials catalogue has loaded', () => {
    const { component, replace } = build();
    component.materialsList = undefined;

    component.saveStepOne();

    expect(replace).not.toHaveBeenCalled();
  });

  it('lets the next autosave retry after a failed save', () => {
    const { component } = build(vi.fn((_p: number, _o: number[], _i: any[]) => throwError(() => new Error('offline'))) as any);
    component.lastAutosaveSignature = 'saved-state';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    component.saveStepOne();

    expect(component.lastAutosaveSignature).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

From `frontend/evamed`, run `npx -y -p node@22 -- npx ng test --watch=false --include src/app/materials-stage/components/materials-stage/materials-stage-save.spec.ts`. Expected: all 4 fail. `replaceMaterialScheme` is never called, and `searchMaterial` is called instead.

- [ ] **Step 3: Add the service method**

In `projects.service.ts`, add after `deleteSchemeProject()`:

```typescript
  /** Sets the project's material rows for `origins` to exactly `items` (server-side, atomically). */
  replaceMaterialScheme(projectId: number, origins: number[], items: object[]): Observable<{ items: any[] }> {
    return this.http
      .put<{ items: any[] }>(`${environment.api_projects}${projectId}/material-scheme/`, { origins, items })
      .pipe(tap(() => this.clearMaterialSchemeCache()));
  }
```

- [ ] **Step 4: Replace `saveStepOne()`**

In `materials-stage.component.ts`, replace the whole `async saveStepOne() { … }` method (lines 615–768) with:

```typescript
  saveStepOne(): void {
    // Material names resolve to ids through the catalogue. Without it every
    // row would be dropped and the replace would wipe the project's materials.
    if (!this.projectId || !this.materialsList) {
      return;
    }

    const items = [
      ...this.buildSchemeItems(this.SOR, 1, ['Modelo de Revit', 'Template EVAMED'], value => parseInt(value, 10)),
      ...this.buildSchemeItems(this.SOD, 2, ['Opciones EVAMED'], value => value),
    ];

    this.projectsService.replaceMaterialScheme(this.projectId, [1, 2], items).subscribe({
      error: error => {
        console.error('No se pudieron guardar los materiales', error);
        // Not saved: let the next autosave tick send it again.
        this.lastAutosaveSignature = null;
      },
    });
  }

  /** One row per selected Excel line and catalogue match, as the old per-row POSTs built them. */
  private buildSchemeItems(
    selections: string[][],
    originId: number,
    origens: string[],
    transport: (value: any) => any
  ): object[] {
    const items = [];
    Object.entries(selections ?? []).forEach(([key, systems]) => {
      const sheetIndex = parseInt(key, 10);
      (this.contentData[sheetIndex + 1] ?? []).forEach(data => {
        if (!(systems ?? []).includes(data.Sistema_constructivo) || !origens.includes(data.Origen)) {
          return;
        }
        const materialToSearch = data.name_material_db !== undefined ? data.materialSelectedDB : data.Material;
        this.materialsList
          .filter(material => material.name_material === materialToSearch)
          .forEach(material => {
            items.push({
              construction_system: data.Sistema_constructivo,
              comercial_name: data.Material,
              quantity: data.Cantidad,
              provider_distance: 0,
              material_id: material.id,
              origin_id: originId,
              section_id: sheetIndex + 1,
              value: null,
              distance_init: this.isBlank(data.distancia_1) ? 0 : parseInt(data.distancia_1, 10),
              distance_end: this.isBlank(data.distancia_2) ? 0 : parseInt(data.distancia_2, 10),
              replaces: this.isBlank(data.reemplazos) ? 0 : data.reemplazos,
              city_id_origin: this.ciudadOrigenSeleccionada,
              state_id_origin: 1,
              city_id_end: 1,
              transport_id_origin: this.isBlank(data.transporte_1) ? null : transport(data.transporte_1),
              transport_id_end: this.isBlank(data.transporte_2) ? null : transport(data.transporte_2),
              unit_text: data.Unidad,
              description_material: data['Descripción de Material'],
            });
          });
      });
    });
    return items;
  }

  private isBlank(value): boolean {
    return value === '' || value === undefined;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run the Step 2 command again, then the full suite: `npx -y -p node@22 -- npm test -- --watch=false`. Expected: 4 new tests pass, and the full suite stays green (25+ tests).

- [ ] **Step 6: Build**

Run `npx -y -p node@22 -- npm run build -- --configuration production`. Expected: `Application bundle generation complete`, with the initial total about 1.65 MB.

- [ ] **Step 7: Commit**

```bash
git add frontend/evamed/src/app/core/services/projects/projects.service.ts frontend/evamed/src/app/materials-stage/components/materials-stage/materials-stage.component.ts frontend/evamed/src/app/materials-stage/components/materials-stage/materials-stage-save.spec.ts
git commit -m "fix(materials): autosave replaces the project's rows instead of appending

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After this plan (not tasks here)

1. **Existing duplicates.** Dev has 50 extra identical rows in 7 projects (441, 458, 460, 505, 506, 577, 582). Some may be legitimate repeated Excel lines, so deleting them is the user's call, project by project. To inspect one project: `SELECT construction_system, comercial_name, quantity, count(*) FROM projects_api_materialschemeproject WHERE project_id_id = <id> GROUP BY 1,2,3 HAVING count(*) > 1;`.
2. **Usuario_Plataforma (origin 3).** `saveStepOne()` never saved `SOU` before this plan, and still doesn't. Whether user-added systems should be saved from this page is a product question.
3. **Click-through on dev.** Create a project, import the template, toggle systems and switch sheets for a minute, then check that the project's row count in the DB equals its selected rows.
