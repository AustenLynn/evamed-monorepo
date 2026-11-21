# Vista "Solo carbono" en Resultados: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un selector "Completo / Solo carbono" en Resultados que muestra solo GWP-total sin cambiar ningún número.

**Architecture:** El cálculo sigue recibiendo la lista **completa** de indicadores (`potentialTypesList`), porque `buildA2Rules` (`calculos/a2-rules.ts`) la necesita para la regla de "material vigente" (los 13 indicadores) y para la liberación biogénica (usa el id de GWP-biogenic). Lo que se filtra es la **salida**: el objeto `Datos`, cuyas claves son `ajustarNombre(name_complete_potential_type)`, y el catálogo de la página (`catologoImpactoAmbiental`). Al cambiar de vista se reutiliza `ajusteUsoBaseDatos(...)`, que ya recalcula y redibuja las tres secciones.

**Tech Stack:** Angular 22 (NgModules), Angular Material, Vitest a través de `ng test`.

**Spec:** `docs/superpowers/specs/2026-11-21-solo-carbono-view-design.md`

## Global Constraints

- No debe cambiar ningún número: Solo carbono muestra el mismo GWP-total que Completo.
- El indicador se busca por `name_potential_type`: primero `'GWP-total'` (A2) y si no existe `'PCG 100'` (CML).
- Por defecto, Completo. Se guarda en `localStorage` con la clave `'evamed.resultados.vista'` (valores `'completo'` | `'carbono'`), con cada lectura y escritura en try/catch.
- Etiquetas: "Completo" y "Solo carbono". El botón "Exportar" no se toca.
- El selector se oculta si no hay indicador de carbono.
- Comandos (desde `frontend/evamed`): pruebas `npx -y -p node@22 node node_modules/@angular/cli/bin/ng.js test --watch=false [--include <spec>]`; build `... ng.js build`; lint `npx -y -p node@22 npx eslint <files>`.
- Un fallo intermitente que ya existe en `equipment-stage/equipment-picker.service.spec.ts` ("prevents stacked pickers") no tiene relación con este cambio. Si aparece, vuelve a correr la suite.

## Review Focus

1. **Cambiar de vista con una barra o indicador seleccionado en la sección 1 o 2.** No debe quedar el ID de un indicador que ya no existe (`selector`, `impactoSeleccionadoElementoConstructivo`). Se espera que el cambio de vista limpie la selección. Prueba en Task 2.
2. **Varios proyectos comparados.** El filtro aplica a todos los proyectos de `proyect_active`, no solo al activo. Prueba en Task 2.
3. **Valores por defecto que usan `potentialTypesList[0]`** (líneas ~1324, 1352 y 1393 de `comparar.component.ts`). Bajo Solo carbono deben usar el primer indicador mostrado. Prueba en Task 2.
4. **Gráfica radial con un solo eje.** Hay que revisarla en el navegador (Task 3). Si se ve rota, en Solo carbono se oculta y se anota.
5. **`localStorage` bloqueado o con un valor desconocido:** se abre en Completo sin errores. Prueba en Task 1.

---

### Task 1: Funciones de la vista (módulo puro)

**Files:**
- Create: `frontend/evamed/src/app/comparar/component/comparar/vista-carbono.ts`
- Test: `frontend/evamed/src/app/comparar/component/comparar/vista-carbono.spec.ts`
- Commit también: el spec y este plan.

**Interfaces:**
- Produces:
  - `type VistaResultados = 'completo' | 'carbono'`
  - `carbonType(types: any[]): any | undefined`: el primer tipo con `name_potential_type === 'GWP-total'`; si no hay, el de `'PCG 100'`.
  - `keepIndicators<T>(datos: Record<string, T>, names: Set<string>): Record<string, T>`: un objeto nuevo solo con esas claves. Si `names` es `null`, devuelve `datos` tal cual.
  - `loadVista(): VistaResultados` y `saveVista(v: VistaResultados): void` (clave `'evamed.resultados.vista'`).

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
it('prefers GWP-total, falls back to PCG 100', () => {
  expect(carbonType([{ id: 1, name_potential_type: 'PCG 100' }, { id: 2, name_potential_type: 'GWP-total' }]).id).toBe(2);
  expect(carbonType([{ id: 1, name_potential_type: 'PCG 100' }]).id).toBe(1);
  expect(carbonType([{ id: 3, name_potential_type: 'ODP' }])).toBeUndefined();
});
it('keeps only the named indicators', () => {
  expect(keepIndicators({ a: 1, b: 2 }, new Set(['b']))).toEqual({ b: 2 });
  const all = { a: 1 };
  expect(keepIndicators(all, null)).toBe(all);
});
it('defaults to completo and survives storage errors and junk', () => {
  expect(loadVista()).toBe('completo');
  saveVista('carbono'); expect(loadVista()).toBe('carbono');
  localStorage.setItem('evamed.resultados.vista', 'x'); expect(loadVista()).toBe('completo');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(loadVista()).toBe('completo');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(() => saveVista('carbono')).not.toThrow();
});
```

- [ ] **Step 2: Correr con `--include src/app/comparar/component/comparar/vista-carbono.spec.ts`.** Esperado: FAIL, porque el módulo no existe.
- [ ] **Step 3: Implementar `vista-carbono.ts`** con las firmas de arriba.
- [ ] **Step 4: Correr de nuevo.** Esperado: PASS.
- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-11-21-solo-carbono-view-design.md docs/superpowers/plans/2026-11-21-solo-carbono-view.md frontend/evamed/src/app/comparar/component/comparar/vista-carbono*.ts
git commit -m "feat(resultados): helpers for the carbon-only view"
```

### Task 2: El componente aplica la vista

**Files:**
- Modify: `frontend/evamed/src/app/comparar/component/comparar/comparar.component.ts`
- Test: `frontend/evamed/src/app/comparar/component/comparar/comparar.component.spec.ts` (nuevo `describe`; reutiliza el patrón `build()` con mocks que ya tiene el archivo)

**Interfaces:**
- Consumes: todo lo de Task 1.
- Produces (para Task 3):
  - `vista: VistaResultados` (se inicializa con `loadVista()`)
  - `carbonoDisponible: boolean`
  - `cambiarVista(v: VistaResultados): void`

Cambios:
- Guardar el resultado de `FiltradoDeImpactos` en `catalogoCompleto` (privado). Un nuevo `aplicarVista()` privado asigna `catologoImpactoAmbiental` (el tipo de carbono solo, o el catálogo completo), llama `llenarIdsBotonesImpactos`, reinicia `selectedValue` e `impactoAmbientalSeleccionado` al primer indicador mostrado y calcula `nombresMostrados: Set<string> | null` (las claves `ajustarNombre(name_complete_potential_type)`, o `null` en Completo). En la carga inicial (líneas ~297-304) se llama `aplicarVista()` en lugar de asignar a mano.
- Se pasa por `keepIndicators(..., nombresMostrados)` la salida de `llamarCalculos` y de `llamarCalculosTercerSeccion` (antes de devolverla, en cada clave de primer nivel que esté indexada por indicador; revisa la forma real) y `auxDatos` en `getAnalisisBarrasElementosConstructivos`. `DatosCalculos.potentialTypesList` sigue siendo la lista completa.
- Los valores por defecto `this.potentialTypesList[0]['name_complete_potential_type']` (líneas ~1324, 1352 y 1393) pasan a usar `this.catologoImpactoAmbiental[0]`.
- `cambiarVista(v)`: `saveVista(v)`, `aplicarVista()`, limpiar las selecciones de indicador (`selector = null`, `impactoSeleccionadoElementoConstructivo = ' '`, `ID = ' '`) y llamar `ajusteUsoBaseDatos(<bases de datos activas en basesDatos>)`.

- [ ] **Step 1: Escribir las pruebas que fallan.** Se hacen con un `calculos` simulado cuyo `OperacionesDeFase` devuelve `[{ 'Calentamiento\nglobal, total': {...}, 'ODP': {...} }]` y `FiltradoDeImpactos` devuelve dos tipos (GWP-total y ODP). Hay que espiar `ajusteUsoBaseDatos` o simularlo según convenga a cada prueba.
  - `it('passes the full indicator list to the calculation in the carbon view')`: con `vista = 'carbono'`, `llamarCalculos(7)` → el `OperacionesDeFase` simulado recibió `potentialTypesList` con los 2 tipos, y el resultado solo tiene la clave de GWP-total.
  - `it('switching views swaps the catalogue, clears indicator selections and recalculates every compared project')`: con `proyect_active = [7, 8]` y `selector = 'ODP'`, `cambiarVista('carbono')` → `catologoImpactoAmbiental` tiene 1 elemento (GWP-total), `selector` es `null`, `selectedValue` es el nombre de GWP-total y `ajusteUsoBaseDatos` se llamó una vez. Después, `cambiarVista('completo')` restaura los 2 indicadores.
  - `it('hides the switch when no carbon indicator is served')`: un catálogo sin GWP-total ni PCG 100 deja `carbonoDisponible` en `false` y `vista` sin efecto (catálogo completo).
- [ ] **Step 2: Correr con `--include src/app/comparar/component/comparar/comparar.component.spec.ts`.** Esperado: FAIL en las nuevas; la prueba existente sigue en PASS.
- [ ] **Step 3: Implementar los cambios de arriba.**
- [ ] **Step 4: Correr de nuevo.** Esperado: PASS (todas).
- [ ] **Step 5: Commit** `feat(resultados): carbon-only view filters what is shown, not what is calculated`.

### Task 3: Selector en la página, verificación y build

**Files:**
- Modify: `frontend/evamed/src/app/comparar/component/comparar/comparar.component.html` (junto a los grupos de toggles, líneas ~62-80)
- Modify si hace falta: `comparar.component.scss`

**Interfaces:**
- Consumes: `vista`, `carbonoDisponible` y `cambiarVista` de Task 2.

- [ ] **Step 1: Agregar el selector:** `<mat-button-toggle-group *ngIf="carbonoDisponible" [value]="vista" (change)="cambiarVista($event.value)" hideSingleSelectionIndicator>` con dos `mat-button-toggle` (`value="completo"` "Completo" y `value="carbono"` "Solo carbono"), con la clase `button-impactos`. Debe verse en las tres pestañas: si los controles actuales solo aparecen en la pestaña 1, colócalo fuera del `mat-tab-group`, junto al selector de bases de datos (línea ~18).
- [ ] **Step 2: Suite completa, lint y build.** `ng test --watch=false`: todas en PASS. `eslint` sobre los archivos tocados: sin errores nuevos. `ng build`: sin errores.
- [ ] **Step 3: Revisión en el navegador** (skill `run` o Playwright, con un proyecto que tenga materiales). En Solo carbono, cada sección muestra solo GWP-total y sus valores coinciden con los de GWP-total en Completo (tabla de la sección 1). Revisar la gráfica radial (Review Focus 4) y que la elección se mantenga al recargar.
- [ ] **Step 4: Commit** `feat(resultados): Completo / Solo carbono switch`.
