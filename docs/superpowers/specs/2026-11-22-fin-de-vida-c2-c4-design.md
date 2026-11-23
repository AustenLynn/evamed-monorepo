# Fin de vida C2–C4 (diseño)

Fecha: 2026-11-22. Tamaño: proyecto (backend + frontend + datos), entregado en dos fases desplegables.

## Intención

El dueño quiere calcular el impacto total de cada etapa del ciclo de vida y ver el desglose por
etapa. Eso es lo que piden EN 15978 (edificios) y EN 15804 (productos): resultados por módulo
A1–A3, A4–A5, B1–B7 y C1–C4, más el total. Resultados ya los muestra (sección 1), pero en fin de
vida hoy solo hay C1 (maquinaria de demolición que captura el usuario) y, en A2, la liberación
del carbono biogénico en C3. C2 y C4 valen siempre 0. El fin de vida del edificio casi no pesa en
los resultados, y no porque no tenga impacto.

## Lo que hay hoy

- `projects_api/results.py` calcula `datos[indicador]['FinDeVida'] = {C1, C2: 0, C3, C4: 0}`.
  C1 sale de `ElectricityConsumptionDeconstructiveProcess` (maquinaria × factor). C3 es solo
  `biogenic_release` (A2: la captura biogénica de A1–A3 se libera al final, una vez por el original
  y otra por cada reemplazo).
- Con A2 activo, solo cuentan los materiales con valores A2: **ECO Platform** (125 EPDs) y
  **ecoinvent** (58). EPiC, EPDs antiguas y mexicaniuh solo tienen CML y salen como excluidos.
- **Las EPDs ya traen el fin de vida.** De las 129 descargadas (`~/ecoplatform/search/epds`), 128
  declaran C1, C2, C3, C4 y D (A2 los hace obligatorios). `ecoplatform/ilcd.py` solo lee
  `MODULES = ('A1-A3', 'A1', 'A2', 'A3')`, así que el importador descartó el resto.
- Los materiales de ecoinvent no traen fin de vida. ecoinvent sí tiene los procesos de tratamiento
  (búsqueda gratuita, 3.12-sandbox, sin geografía MX): por ejemplo concreto a relleno de inertes
  (RoW #2846), concreto armado a reciclaje (RoW #15709), varilla a reciclaje (RoW #15194), ladrillo
  a reciclaje (RoW #14998), yeso a relleno de inertes (RoW #15558), tablaroca a reciclaje
  (RoW #28014), aplanado mineral a separación (RoW #17601), residuo inerte a relleno (RoW #3682).
  El transporte en camión ya está ligado (A4).
- Familias de los 58 materiales de construcción de ecoinvent (`construction_materials.json`):
  Acero 13, Cemento 12, Concreto 11 (m³), Block 7, Aplanado 5 (uno en m³), Ladrillo 2, Grava 2,
  Panel de yeso 2, Yeso 2, Mortero 1, Arena 1. Los 37 de ecoinvent anteriores (chatarras, polvos,
  paneles fotovoltaicos, cerámicos, refractarios…) no tienen familia.

## Objetivos, no objetivos y antiobjetivos

- **Objetivos**
  - C2, C3 y C4 con valor real para todo material que cuente en A2, en la sección 1 de Resultados,
    en el total, en las tarjetas de inicio y en la barra de carbono (todos leen `datos`).
  - Materiales de ECO Platform: los C2–C4 que declaró el fabricante.
  - Materiales de ecoinvent: un escenario fijo de EVAmed por familia de material.
  - B4 incluye el fin de vida de lo reemplazado (EN 15978).
  - Quien vea los resultados sabe de dónde salen los números de fin de vida.
- **No objetivos**
  - Escenarios editables por proyecto (opción B, descartada por ahora; el diseño no la impide).
  - El módulo D (créditos por reciclaje): se reporta aparte y no se suma al total; queda fuera.
  - El C1 de las EPDs: C1 sigue saliendo de la maquinaria que captura el usuario.
  - Fin de vida en la sección 3 de Resultados (por material), que hoy solo muestra Producción,
    A4 y B4.
  - Materiales sin valores A2 (EPiC, EPDs antiguas, mexicaniuh) y el método CML para ECO
    Platform (no tiene valores CML).
- **Antiobjetivos**
  - Contar algo dos veces: la demolición (C1 del usuario y C1 de la EPD) o el carbono biogénico
    (liberación calculada por EVAmed y C3 declarado por la EPD).
  - Un número de fin de vida sin fuente conocida. Toda tasa y distancia del escenario de EVAmed
    lleva su fuente o dice que es un supuesto, y el dueño las aprueba antes de desplegarlas.
  - Que un material quede fuera del fin de vida sin aviso.

## Enfoques considerados

1. **EPDs primero, ecoinvent como respaldo (elegido).** C2–C4 declarados por el fabricante para
   ECO Platform; escenario de EVAmed con procesos de ecoinvent para los materiales sin C.
2. Un solo escenario de EVAmed para todos. Descartado: tira datos del fabricante, gasta más cuota
   y obliga a defender tasas mexicanas para cada material.
3. Solo EPDs. Descartado: el desglose queda incompleto en todo proyecto con materiales de
   ecoinvent.

Para ecoinvent, el dueño eligió un **escenario fijo** (A) sobre uno editable por proyecto (B): sin
pantalla nueva y con proyectos comparables entre sí.

## Diseño

### Regla de cálculo (las dos fases)

Por fila de material del proyecto (`MaterialSchemeProject`, ya filtrada por sistemas apagados,
exclusiones A2 y base de datos activa, como hoy):

- **Fuente del fin de vida del material:**
  1. si el material tiene C2, C3 o C4 declarados (EPD), se usan esos valores por unidad × cantidad;
  2. si no, y su familia tiene escenario de EVAmed (fase 2), se usa el escenario;
  3. si no, el material no tiene fin de vida y sale en el aviso (ver abajo).
- **C1** no cambia (maquinaria del usuario).
- **Carbono biogénico:** la liberación calculada por EVAmed (`release_by_row`) se aplica solo a
  filas cuyo material **no** tiene C declarados. Una EPD A2 ya incluye esa liberación en su C3/C4.
- **B4:** a lo que suma hoy cada fila se agrega `(C2 + C3 + C4 de la fila) × reemplazos`.
- Los desgloses `por_elemento` (sección 2) agregan C2 y C4 por elemento, y C3 incluye lo declarado
  y el escenario. El invariante de los tests pasa a ser: la suma de `por_elemento[i]` es igual a
  `datos[i]` en A1-A3, A4, A5, B4, C1, C2, C3 y C4.

### Fase 1: C2–C4 de las EPDs (sin cuota)

- `Standard` gana tres filas: C2, C3 y C4 (migración). `ilcd.MODULES` incluye C2, C3 y C4; el
  importador guarda sus valores en `MaterialSchemeData` con esos estándares, escalados a la unidad
  de EVAmed igual que A1–A3.
- El importador debe poder volver a correrse sobre los materiales ya importados en dev y agregarles
  solo los C que faltan, sin duplicar materiales ni tocar A1–A3 (`--dry-run` informa cuántos valores
  agregaría).
- `results.py` aplica la regla de arriba con los C declarados.
- Se despliega y se reimporta en dev. Antes de importar se reportan al dueño: cuántas EPDs traen
  C2–C4 completos, y para 3 de ellas el desglose de un proyecto de prueba antes y después.

### Fase 2: escenario de EVAmed para ecoinvent

- **Tratamientos:** un catálogo nuevo de procesos de tratamiento de residuos ligado a ecoinvent con
  el mismo mecanismo que transporte y maquinaria (`EcoinventPinnedModel`, pin manual en
  `manual_pins.json`, `ecoinvent_resolve` y `ecoinvent_refresh` con un `entity_type` nuevo), con
  valores por kg para ambos métodos.
- **Escenario por familia** (archivo de datos versionado, como `construction_materials.json`):
  para cada familia, la lista de destinos con su porcentaje (suma 100 %), el módulo de cada destino
  (reciclaje y separación → C3; relleno, tiradero e incineración sin recuperación → C4), la
  distancia de C2 en km y la fuente de cada número. Una familia **Otros** (residuo inerte a relleno)
  cubre materiales sin familia. Cada material de ecoinvent queda asignado a una familia en el mismo
  archivo.
- **Masa:** C2–C4 se calculan por kg. Kg y Ton se convierten como hoy (`_UNIT_TONNES`). Para m³ el
  escenario de la familia da una densidad (concreto, aplanado). Sin masa → aviso.
- **C2** = masa (t) × distancia (km) × factor del camión de la familia (por defecto el camión de 16
  a 32 t ya ligado).
- **C3/C4** = masa (kg) × porcentaje × factor del tratamiento, sumado por módulo.
- **Cuota:** antes de gastar, `ecoinvent_refresh --count-only` y el visto bueno del dueño con el
  número (se estiman 10–15 datasets nuevos).
- **Tasas y distancias:** el constructor propone valores con fuente (o marcados como supuesto) y el
  dueño los aprueba antes del despliegue. Hasta entonces el escenario no se activa.

### Aviso y explicación en Resultados

- El aviso de excluidos (`excluded`, A-13) gana una categoría `end_of_life`: filas cuyo material no
  tiene C declarados ni escenario, o no tiene masa para el escenario. Texto: «N materiales sin fin
  de vida (C2–C4): no se incluyen en esas etapas».
- Una nota fija junto al desglose de fin de vida en Resultados: «C2–C4: lo declarado en la EPD del
  fabricante cuando existe; si no, el escenario de EVAmed (ver Manual)». El manual describe el
  escenario y sus fuentes.

## Restricciones

- El servidor es la única fuente de los números (A-32): todo el cálculo vive en `results.py`; el
  navegador solo muestra.
- Búsquedas de ecoinvent gratis; cualquier consulta de impactos necesita el OK del dueño con el
  conteo. Los valores del sandbox no son aptos para resultados reales (A-11) hasta tener licencia de
  producción.
- Push a `main` despliega dev; cada fase se sube con el visto bueno del dueño.
- Sin cambios en las plantillas de Excel sin el OK del dueño (este diseño no las necesita).

## Decisiones del diseñador (revisión como constructor)

- **EPD con C incompletos:** si declara al menos uno de C2–C4, se usan los declarados y el que falte
  cuenta 0 (en EN 15804 «no declarado» no se estima). No se mezcla con el escenario de EVAmed.
- **Entre la fase 1 y la 2:** los materiales de ecoinvent no tienen fin de vida y salen en el aviso
  `end_of_life`. Es esperado y temporal.
- **Método CML:** el escenario de la fase 2 se calcula también en CML (los tratamientos se
  actualizan en ambos métodos; repetir datasets no gasta cuota). Las EPDs de ECO Platform no tienen
  CML y en ese modo siguen excluidas, como hoy.
- **Archivos de EPD en dev:** el importador corre contra la copia del servidor
  (`/opt/evamed/data/ecoplatform`); el constructor confirma que siguen ahí antes de la fase 1.

## Lo que queda al constructor

- Los nombres del modelo de tratamientos, del archivo de escenario y de sus campos.
- Cómo guardar en el importador los C de materiales ya existentes (actualizar por material y
  estándar) y la forma exacta del `--dry-run`.
- Qué tratamiento de ecoinvent representa cada destino, dentro de los nombrados arriba o
  equivalentes, con geografía RoW salvo que no exista.
- La redacción final del aviso y de la nota, en el tono de los avisos actuales.
