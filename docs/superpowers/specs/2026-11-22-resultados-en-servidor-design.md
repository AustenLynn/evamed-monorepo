# Resultados calculados en el servidor (diseño)

Fecha: 2026-11-22. Hallazgo de origen: A-32 de `docs/audit/2026-11-22-overnight-audit.md`.
Tamaño: proyecto (backend + frontend), entregado en tres fases desplegables.

## Intención

Hoy la página Resultados (`/resultados`, `comparar.component`) descarga 19 catálogos completos
(entre ellos `/material-scheme-data/`, ~700 KB, y `/materials/` dos veces, ~611 KB cada una) y
calcula los resultados en el navegador. Las reglas de cálculo existen cuatro veces: una en el
servidor (`ProjectResultsView`, que ya alimenta la barra de carbono y las tarjetas de inicio) y
tres en el navegador (`calculos.ts`, `calculos-segunda-seccion.ts`, `calculos-tercer-seccion.ts`,
una por sección de Resultados). Cada cambio de reglas, como EN 15804+A2, hay que hacerlo en cuatro
lugares, y nada garantiza que den lo mismo.

El dueño eligió (2026-11-22) que el servidor sea la única fuente de los números, entregado por
fases.

## Objetivos, no objetivos y antiobjetivos

- **Objetivos**
  - Las tres secciones de Resultados toman sus números de `GET /projects/<id>/results/`.
  - Resultados deja de descargar los catálogos de cálculo. Quedan solo los catálogos pequeños que
    la página usa para mostrar cosas (tipos de impacto, secciones, bases de datos) y la lista de
    proyectos del usuario.
  - Al terminar, se eliminan los tres módulos de cálculo del navegador.
- **No objetivos**
  - Cambiar cómo se ven las gráficas, la tabla o los controles (Completo/Solo carbono, %, #,
    total o por m², ocultar etapas o elementos, comparar proyectos).
  - Cambiar las reglas de cálculo.
  - Reactivar el filtro "Bases de datos consideradas" (está comentado en la plantilla). El endpoint
    ya acepta `?databases=`, así que se puede reactivar después sin cambiar este diseño.
- **Antiobjetivos**
  - Que un número cambie sin que el dueño lo sepa. Antes de quitar el cálculo del navegador en
    cada fase se comparan ambos en dev, y toda diferencia se reporta y se explica.
  - Hacer más lentas las tarjetas de inicio o la barra de carbono, que usan el mismo endpoint.

## Enfoques considerados

1. **Servidor como única fuente, por fases (elegido).** Se amplía el endpoint con los desgloses de
   las secciones 2 y 3; `comparar` usa solo el endpoint. Tres fases desplegables por separado.
2. Solo descargar menos (catálogos filtrados por proyecto) y dejar el cálculo en el navegador.
   Descartado: deja la lógica duplicada, que es la razón principal del cambio.
3. Igual que 1, pero en un solo cambio. Descartado: mismo trabajo, más riesgo y nada visible hasta
   el final.

## Cómo funciona hoy (lo que hay que reproducir)

Cada sección produce una estructura, por proyecto e indicador. El nombre del indicador pasa por
`ajustarNombre` en el navegador.

- **Sección 1, por etapa:** `datos[indicador][etapa][subetapa] = valor`, con etapas
  `Producción` (A1, A2, A3 o A1-A3), `Construccion` (A4, A5), `Uso` (B4, B6) y `FinDeVida`
  (C1…C4). **El servidor ya la devuelve igual** (`datos`).
- **Sección 2, por elemento constructivo:** `{[indicador]: {[section_id]: valor}}`, el total por
  elemento de A1-A3, A4, A5, B4, C1 y C3 (B6 no es de ningún elemento). La calcula
  `OperacionesDeFasePorElementoConstructivo`.
- **Sección 3, por elemento y material:** `{Calculos, materiales}`, donde
  - `Calculos[indicador][etapa][subetapa][section_id] = valor`
  - `materiales[indicador][etapa][subetapa][section_id][material_id] = valor`
  - para `Producción` (A1, A2, A3 y A1-A3), `Construccion.A4` y `Uso.B4`. La calcula
    `OperacionesDeFasePorElementoConstructivoCicloVida`. La gráfica de esta sección busca el
    nombre del material en `materiales` (catálogo completo) por id.

Las tres ya respetan los sistemas apagados en Materiales y las reglas A2 (exclusiones, sin masa,
liberación biogénica en C3), igual que el servidor.

## Diseño

### Servidor: el endpoint devuelve los desgloses

`GET /projects/<id>/results/?detalle=1` agrega a la respuesta actual:

- `por_elemento`: `{[indicador]: {[section_id]: valor}}`, misma definición que la sección 2.
- `por_material`: `{Calculos, materiales}` con la misma forma que la sección 3.
- `nombres_materiales`: `{[material_id]: nombre}` solo de los materiales del proyecto, para que
  la sección 3 no descargue el catálogo.

Sin `?detalle=1` la respuesta queda exactamente como hoy, para que las tarjetas de inicio y la
barra de carbono no paguen el costo extra. Los indicadores van con el nombre completo, como `datos`;
el navegador los adapta con `ajustarNombre`.

Los desgloses se calculan en la misma pasada que `datos` y con los mismos datos ya cargados (no
hay consultas por fila). Así no pueden aplicar reglas distintas a la sección 1.

**Invariantes que prueban los tests del servidor:**

- La suma de `por_elemento[i]` sobre todos los elementos es igual a la suma de `datos[i]` en A1-A3,
  A4, A5, B4, C1 y C3.
- Para cada etapa y subetapa, la suma de `por_material.Calculos` sobre los elementos es igual a
  `datos`.
- La suma por material es igual al valor del elemento.

Lo de las dos primeras bajo los métodos CML y A2, con sistemas apagados, materiales excluidos y
materiales sin masa.

### Navegador: `comparar` usa solo el endpoint

- Un servicio nuevo (`ResultadosService`) pide `/results/?detalle=1` por proyecto, guarda la
  respuesta mientras la página está abierta y adapta los nombres de indicador.
- `comparar` carga los resultados de cada proyecto cuando se muestra (el activo al abrir; los
  demás al agregarlos con "Comparar con otro proyecto"). Hoy esos cálculos son síncronos;
  `llamarCalculos`, `llamarCalculosTercerSeccion` y el de la sección 2 pasan a leer de lo ya
  cargado, para que el resto del componente (gráficas, % / #, por m², ocultar etapas) cambie lo
  menos posible.
- Si la petición de un proyecto falla, su sección muestra "No se pudieron cargar los resultados"
  con un botón para reintentar, en lugar de gráficas vacías; los demás proyectos siguen visibles.
- "Por m²" sigue dividiéndose en el navegador (es presentación); ya se desactiva cuando falta una
  superficie (A-09).
- El aviso de excluidos (A-13) ya usa este endpoint; se reutiliza la misma respuesta.

### Fases

1. **Sección 1.** `comparar` toma `datos` del servidor. Se quitan de la carga inicial los catálogos
   que solo usaba la sección 1.
2. **Sección 2.** El endpoint gana `por_elemento`; `comparar` lo usa.
3. **Sección 3.** El endpoint gana `por_material` y `nombres_materiales`; `comparar` y
   `graficas-tercer-seccion` lo usan. Se eliminan `calculos.OperacionesDeFase` (si ya nadie más la
   usa), `calculos-segunda-seccion.ts`, `calculos-tercer-seccion.ts` y las descargas restantes.

Cada fase:

- se despliega a dev;
- antes de quitar el cálculo del navegador, se comparan en dev los números del navegador y del
  servidor para todos los proyectos de la cuenta de prueba;
- toda diferencia mayor a redondeo (1e-9 relativo) se reporta al dueño con su causa antes de
  seguir.

## Restricciones

- El acceso ya lo controla el endpoint (`visible_projects`): solo el dueño ve sus resultados.
  Comparar con otro proyecto solo ofrece proyectos propios.
- No se cambian las reglas de cálculo; si la comparación encuentra una diferencia, el servidor es
  la referencia, salvo que la diferencia muestre un error del servidor, que se corrige con test.
- Desplegar a `main` despliega dev; cada fase se sube con el visto bueno del dueño.

## Lo que queda al constructor

- Los nombres internos del servicio y de los métodos auxiliares.
- Cómo mostrar la espera mientras llegan los resultados de un proyecto (un indicador de carga en la
  sección, como en las tarjetas de inicio).
- Qué catálogos dejan de descargarse en cada fase, verificando en el código quién más los usa
  (`materiales` alimenta también la sección 3 hasta la fase 3).
