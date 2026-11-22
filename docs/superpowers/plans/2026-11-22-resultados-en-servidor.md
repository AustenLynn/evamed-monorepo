# Resultados en el servidor: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Las tres secciones de Resultados toman sus números de `GET /projects/<id>/results/` y el navegador deja de descargar catálogos y de calcular.

**Architecture:** El cálculo de `ProjectResultsView` pasa a un módulo propio (`projects_api/results.py`) que, con `?detalle=1`, también produce los desgloses por elemento y por material en la misma pasada. En el frontend, un `ResultadosService` carga y guarda la respuesta por proyecto; `comparar` lee de ahí en lugar de llamar a los módulos `calculos*`. Tres fases desplegables (sección 1, 2, 3); los módulos del navegador se eliminan al final, después de comparar ambos cálculos en dev.

**Tech Stack:** Django 5.2 + DRF (tests: `manage.py test` con Postgres local), Angular 22 + Vitest (`ng test`).

**Spec:** `docs/superpowers/specs/2026-11-22-resultados-en-servidor-design.md`

## Global Constraints

- Sin `?detalle=1` la respuesta de `/results/` queda exactamente como hoy (claves `project_id`, `datos`, `error`, `excluded`, `carbono`).
- Formas (spec): `por_elemento = {[indicador]: {[section_id]: valor}}` con A1-A3, A4, A5, B4, C1 y C3 (sin B6); `por_material = {Calculos, materiales}` con `Calculos[indicador][etapa][subetapa][section_id]` y `materiales[indicador][etapa][subetapa][section_id][material_id]` para `Producción` (A1, A2, A3, A1-A3), `Construccion.A4`, `Uso.B4`; `nombres_materiales = {[material_id]: nombre}` solo de materiales del proyecto.
- Indicadores con su nombre completo en el servidor; el navegador los adapta con `Calculos.ajustarNombre` (la misma función que usan hoy las secciones y `keepIndicators`).
- No se cambian reglas de cálculo. Si la comparación en dev encuentra diferencias > 1e-9 relativo, se reportan al dueño antes de seguir; el servidor es la referencia salvo error del servidor (se corrige con test).
- "Por m²" sigue en el navegador. El filtro de bases de datos sigue apagado.
- Si falla la carga de un proyecto: "No se pudieron cargar los resultados" con botón "Reintentar"; los demás proyectos siguen visibles.
- Cada push a `main` (despliega dev) requiere el visto bueno del dueño.
- Comandos: backend `cd backend/evamed-api && DB_USER=maikolkali DB_HOST=/tmp DB_PORT=55432 /tmp/evamed-usage-py/bin/python manage.py test --noinput` (arrancar antes el cluster: `LD_LIBRARY_PATH=/tmp/evamed-usage-postgres/usr/lib/x86_64-linux-gnu /tmp/evamed-usage-postgres/usr/lib/postgresql/18/bin/pg_ctl -D /tmp/evamed-usage-pg -o "-p 55432 -k /tmp" start`); frontend `cd frontend/evamed && npx -y -p node@22 node node_modules/@angular/cli/bin/ng.js test --watch=false [--include=...]`.

## Review Focus

1. Proyecto sin materiales, o solo con Uso: el servidor devuelve ceros y desgloses vacíos; las secciones muestran sus estados vacíos, sin error. (Task 5, Task 8)
2. Comparar 3 proyectos con uno que falla al cargar: los otros dos se dibujan; "Reintentar" recupera el que falló. (Task 4)
3. Quitar un proyecto mientras su respuesta aún no llega: la respuesta tardía se ignora y no reaparece. (Task 4)
4. Vista Solo carbono con datos del servidor: el nombre adaptado del indicador coincide con el que filtra `keepIndicators`, así que no queda vacía. (Task 3)
5. Sistemas apagados y materiales excluidos bajo A2 no aparecen en `por_elemento` ni en `por_material`. (Task 5, Task 8)

---

## Fase 1: sección 1 desde el servidor

### Task 1: Mover el cálculo a `projects_api/results.py`

**Files:**
- Create: `backend/evamed-api/projects_api/results.py`
- Modify: `backend/evamed-api/projects_api/views.py` (`ProjectResultsView.get` y los helpers `_aggregate_material_ids`, `_material_value`, `_apply_a2_exclusions`, `_list_noncurrent_factors`, constantes `_PRODUCTION_STAGES`, `_AGGREGATE_STANDARD`, `_BIOGENIC_RELEASE_TYPES`)
- Test: `backend/evamed-api/projects_api/tests_project_results.py`

**Interfaces:**
- Produces: `results.compute(project: models.Project, active_databases: set[str], detalle: bool = False) -> dict` que devuelve el mismo dict que hoy va en `Response(...)`. La vista: resuelve proyecto (404 igual que hoy) y bases, llama `compute(project, dbs, detalle=request.query_params.get('detalle') == '1')`.

- [ ] **Step 1: Test de que la vista y `compute` coinciden**

```python
def test_view_returns_compute(self):  # en ProductionStageAggregationTests
    self._use_in_project(self._material('EPD'), 2)
    from projects_api import results
    expected = results.compute(self.project, set(models.DataBaseMaterial.objects.values_list('name', flat=True)))
    response = self.client.get('/api-projects/projects/%s/results/' % self.project.id)
    self.assertEqual(response.json(), json.loads(json.dumps(expected)))  # mismas claves tras serializar
```

- [ ] **Step 2: Correrlo:** falla con `ImportError` (no existe `results`).
- [ ] **Step 3: Mover el cuerpo del cálculo y los helpers a `results.py`** sin cambiar lógica; `views.py` importa lo que otros módulos usen de ahí (buscar con `grep -rn "_apply_a2_exclusions\|_aggregate_material_ids" projects_api`).
- [ ] **Step 4: Suite backend completa:** todo en verde (339 + 1).
- [ ] **Step 5: Commit** `refactor(results): compute project results in projects_api/results.py`

### Task 2: `ResultadosService` y comparador de paridad (frontend)

**Files:**
- Create: `frontend/evamed/src/app/comparar/resultados.service.ts`, `.spec.ts`
- Create: `frontend/evamed/src/app/comparar/paridad.ts`, `.spec.ts`
- Modify: `frontend/evamed/src/app/core/services/analisis/analisis.service.ts:142` → `getProjectResults(projectId: number, databases?: string, detalle = false)` (agrega `detalle: '1'` a los params cuando es true)

**Interfaces:**
- Produces:
  - `interface ResultadosProyecto { datos: Record<string, any>; porElemento: Record<string, Record<string, number>> | null; porMaterial: { Calculos: any; materiales: any } | null; nombresMateriales: Record<string, string>; excluded: ResultsExcluded | null; }`
  - `ResultadosService.cargar(projectId: number): Observable<ResultadosProyecto>` (pide con `detalle=true`; guarda en caché; un segundo `cargar` del mismo id no repite la petición; un error no queda en caché), `ResultadosService.obtener(projectId: number): ResultadosProyecto | undefined`, `ResultadosService.olvidar(projectId: number): void`.
  - Las claves de indicador de `datos`, `porElemento`, `porMaterial.Calculos` y `porMaterial.materiales` pasan por `Calculos.ajustarNombre`.
  - `compararResultados(navegador: unknown, servidor: unknown, ruta?: string, tolerancia = 1e-9): { ruta: string; navegador: number | undefined; servidor: number | undefined }[]` recorre hojas numéricas de ambos lados (claves faltantes en un lado cuentan como diferencia salvo que el otro valga 0).

- [ ] **Step 1: Tests**
  - `resultados.service.spec.ts`: `'adapts indicator names and maps the detail keys'` (respuesta con `'Calentamiento global, total'` → clave `calculos.ajustarNombre('Calentamiento global, total')`; `por_elemento` → `porElemento`, `nombres_materiales` → `nombresMateriales`); `'requests detalle=1 once per project'` (HttpTestingController: dos `cargar(7)` → una petición con `detalle=1`); `'does not cache a failure'` (error 500 → siguiente `cargar` vuelve a pedir).
  - `paridad.spec.ts`: iguales → `[]`; `{a:{b:1}}` vs `{a:{b:1.0000001}}` → una diferencia en `'a.b'`; clave faltante con 0 del otro lado → `[]`; faltante con 5 → diferencia.
- [ ] **Step 2: Correrlos:** fallan por import.
- [ ] **Step 3: Implementar** los dos archivos y el parámetro de `AnalisisService`.
- [ ] **Step 4:** `ng test --include='src/app/comparar/**/*.spec.ts' --include='src/app/core/**/*.spec.ts'` en verde.
- [ ] **Step 5: Commit** `feat(resultados): service that loads server results per project, and a parity comparer`

### Task 3: `comparar` sección 1 desde el servidor

**Files:**
- Modify: `frontend/evamed/src/app/comparar/component/comparar/comparar.component.ts` (`iniciar_graficas` ~l.507, `llamarCalculos` ~l.769, `cargarExcluidos`, `quitarProyecto` ~l.1418), `comparar.component.html`
- Test: `comparar.component.spec.ts`

**Interfaces:**
- Consumes: `ResultadosService` (Task 2), `compararResultados` (Task 2).
- Produces: `comparar.estadoCarga: Record<number, 'cargando' | 'error' | 'listo'>`, `comparar.reintentar(id: number): void`; `llamarCalculos(id)` devuelve `keepIndicators(resultados.obtener(id).datos, this.nombresMostrados)`.

- [ ] **Step 1: Tests** en `comparar.component.spec.ts`:
  - `'draws section 1 from the server results'`: con `cargar` devolviendo `datos` de prueba, `llamarCalculos(7)` devuelve esos datos (nombres adaptados) y no se llama `calculos.OperacionesDeFase`.
  - `'keeps the Solo carbono filter working with server names'` (Review Focus 4): `vista = 'carbono'` → `llamarCalculos` devuelve solo la clave de GWP-total adaptada.
  - `'shows an error and retries a project that failed'` (Review Focus 2): `cargar` falla para 8 → `estadoCarga[8] === 'error'`; `reintentar(8)` con éxito → `'listo'` y el proyecto se agrega.
  - `'ignores a late response for a removed project'` (Review Focus 3): `iniciar_graficas(8)` con `Subject` pendiente, `quitarProyecto(8)`, luego emitir → 8 no está en `proyect_active` ni en `outproyect_bar`.
- [ ] **Step 2: Correrlos:** fallan.
- [ ] **Step 3: Implementar.** `iniciar_graficas` espera `forkJoin([selecciones, resultados.cargar(id)])` antes de dibujar; si el id ya no está en `proyect_active` al llegar, no hace nada. `cargarExcluidos` toma `excluded` del mismo servicio. Plantilla: por proyecto en `'error'`, el texto `No se pudieron cargar los resultados` y un botón `Reintentar`. Paridad: si `localStorage['evamed.paridad'] === '1'`, también calcular con `calculos.OperacionesDeFase` (el código actual de `llamarCalculos`, movido a un método privado `calcularEnNavegador`) y agregar `compararResultados(...)` a `window.evamedParidad` con `{proyecto, seccion: 1}`.
- [ ] **Step 4:** suite frontend completa en verde; `ng build` sin errores.
- [ ] **Step 5: Commit** `feat(resultados): section 1 uses the server results`

### Task 4: Entrega de la fase (se repite en las fases 2 y 3)

- [ ] **Step 1:** suites backend y frontend completas en verde.
- [ ] **Step 2:** pedir al dueño el visto bueno; merge a `main`, push, esperar el run (`gh run watch`), los 4 jobs en verde.
- [ ] **Step 3: Paridad en dev** con DevTools (página de nivel superior; dev bloquea iframes): `localStorage['evamed.paridad']='1'`; para cada proyecto de la cuenta de prueba, abrir Resultados (sessionStorage `projectID`) y leer `window.evamedParidad`. Esperado: lista vacía. Repetir agregando un segundo proyecto a la comparación.
- [ ] **Step 4:** reportar al dueño: proyectos revisados, diferencias (ruta, navegador, servidor) y su causa. Si hay diferencias por error del servidor: test que la reproduce, corrección, y volver al Step 1. No empezar la fase siguiente sin ese reporte.

## Fase 2: sección 2

### Task 5: `por_elemento` en el servidor

**Files:**
- Modify: `backend/evamed-api/projects_api/results.py`
- Test: `backend/evamed-api/projects_api/tests_project_results.py` (clase nueva `DetailBreakdownTests`)

**Interfaces:**
- Produces: con `detalle=True`, `compute(...)['por_elemento']`; la liberación biogénica (C3) se calcula por fila para poder asignarla al elemento de la fila (el total C3 de `datos` no cambia).

- [ ] **Step 1: Tests**
  - `'without detalle the response is unchanged'`: claves de `/results/` sin parámetro = `{'project_id','datos','error','excluded','carbono'}`.
  - `'per element sums to the stage totals'`: proyecto con materiales en dos secciones, transporte, reemplazos, un equipo A5 y uno C1; bajo CML y bajo A2 (`override_settings(EVAMED_IMPACT_METHOD=...)`): para cada indicador `sum(por_elemento[i].values()) == datos[i]` en A1/A2/A3/A1-A3 + A4 + A5 + B4 + C1 + C3 (`assertAlmostEqual`, places=9).
  - `'per element leaves out switched-off systems and excluded materials'` (Review Focus 5): un sistema apagado y un material sin datos A2 → su sección no aparece o suma 0.
  - `'project with no rows has empty breakdowns'` (Review Focus 1): `por_elemento == {i: {} for i in datos}`.
- [ ] **Step 2: Correrlos:** fallan (`KeyError: 'por_elemento'`).
- [ ] **Step 3: Implementar** en la misma iteración por indicador de `compute`, acumulando por `ps.section_id_id`, `cse.section_id_id` y `ecdp.section_id_id`.
- [ ] **Step 4:** suite backend completa en verde.
- [ ] **Step 5: Commit** `feat(results): per-element breakdown with ?detalle=1`

### Task 6: `comparar` sección 2 desde el servidor

**Files:**
- Modify: `comparar.component.ts` (`getAnalisisBarrasElementosConstructivos` ~l.1194 y cualquier otro uso de `calculosSegunaSeccion.OperacionesDeFasePorElementoConstructivo`), spec

- [ ] **Step 1: Test** `'draws section 2 from the server breakdown'`: con `porElemento` de prueba, `getAnalisisBarrasElementosConstructivos(7).Datos` es `keepIndicators(porElemento, nombresMostrados)` y no se llama `OperacionesDeFasePorElementoConstructivo`.
- [ ] **Step 2:** falla.
- [ ] **Step 3: Implementar**; el cálculo viejo pasa a `calcularSeccion2EnNavegador` solo para el modo paridad (`seccion: 2`).
- [ ] **Step 4:** suite frontend en verde.
- [ ] **Step 5: Commit** `feat(resultados): section 2 uses the server breakdown`
- [ ] **Step 6: Entrega** como Task 4.

## Fase 3: sección 3 y limpieza

### Task 7: `por_material` y `nombres_materiales` en el servidor

**Files:**
- Modify: `backend/evamed-api/projects_api/results.py`
- Test: `DetailBreakdownTests`

- [ ] **Step 1: Tests**
  - `'per material matches per element and the stage totals'`: para cada indicador, etapa y subetapa de `Producción` (A1, A2, A3, A1-A3), `Construccion.A4`, `Uso.B4`: `sum(Calculos[i][e][s].values()) == datos[i][e][s]` y para cada sección `sum(materiales[i][e][s][sec].values()) == Calculos[i][e][s][sec]`.
  - `'material names only for the project'`: `set(nombres_materiales) == {ids de materiales del proyecto}`.
  - Review Focus 1 y 5 extendidos a `por_material`.
- [ ] **Step 2:** fallan.
- [ ] **Step 3: Implementar** en la misma pasada.
- [ ] **Step 4:** suite backend en verde.
- [ ] **Step 5: Commit** `feat(results): per-material breakdown and material names with ?detalle=1`

### Task 8: `comparar` y `graficas-tercer-seccion` sección 3 desde el servidor

**Files:**
- Modify: `comparar.component.ts` (`llamarCalculosTercerSeccion` ~l.731, `getAnalisisElementos`, ~l.703 `grafica.instance.materiales`), `component/graficas-tercer-seccion/graficas-tercer-seccion.component.ts` (~l.1140 busca el nombre por id), specs

**Interfaces:**
- Produces: `graficas-tercer-seccion` recibe `@Input() nombresMateriales: Record<string, string>` y busca el nombre como `nombresMateriales[material]`, en lugar de filtrar `materiales`.

- [ ] **Step 1: Tests:** `'draws section 3 from the server breakdown'` (comparar: `llamarCalculosTercerSeccion(7)` devuelve `{Calculos, materiales}` del servidor filtrados con `keepIndicators`); en `graficas-tercer-seccion.component.spec.ts` (crear si no existe) `'names materials from nombresMateriales'`.
- [ ] **Step 2:** fallan.
- [ ] **Step 3: Implementar**; el cálculo viejo, solo en modo paridad (`seccion: 3`).
- [ ] **Step 4:** suite frontend en verde.
- [ ] **Step 5: Commit** `feat(resultados): section 3 uses the server breakdown`
- [ ] **Step 6: Entrega** como Task 4 (paridad de las tres secciones).

### Task 9: Quitar el cálculo del navegador (solo después de la paridad de la fase 3 sin diferencias o con diferencias aprobadas por el dueño)

**Files:**
- Delete: `frontend/evamed/src/app/calculos/calculos-segunda-seccion.ts`, `calculos-tercer-seccion.ts`, `a2-rules.ts` y `aggregate-materials.ts` si ya nadie los importa (y sus specs)
- Modify: `calculos/calculos.ts` (quitar `OperacionesDeFase`, `materiales_EPIC`, `materiales_EPD`; conservar `ajustarNombre`, `ValoresProcentaje*`, `FiltradoDeImpactos` y lo que usen inicio y la referencia de carbono), `comparar.component.ts` (quitar modo paridad, `calcularEnNavegador*`, `getFilteredScheme`, `getMaterialsStageSelections` en `iniciar_graficas` si solo servía al cálculo, `num_epic`/`num_epd`, y del `forkJoin` del constructor los catálogos que ya no use nadie), `comparar/paridad.ts` (+spec)

- [ ] **Step 1:** `grep -rn` de cada símbolo a quitar para confirmar que no tiene otros usos; quitar.
- [ ] **Step 2:** suites backend y frontend completas en verde; `ng build` sin errores.
- [ ] **Step 3:** en dev, contar las peticiones de Resultados (`performance.getEntriesByType('resource')` filtrando `/api-projects/`). Esperado: solo la lista de proyectos, `/me/`, tipos de impacto, secciones, bases de datos y un `/results/` por proyecto mostrado; ninguna de `material-scheme-data`, `materials`, `potential-transport`, `conversions`, `type-energy-data`, `source-information-data`.
- [ ] **Step 4: Commit** `refactor(resultados): remove the browser calculation and the catalogues it needed (audit A-32)`
- [ ] **Step 5: Entrega:** merge y push con visto bueno; verificar en dev que las tres secciones se dibujan para un proyecto con datos y para uno vacío.
