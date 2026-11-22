# Auditoría nocturna EVAmed: 2026-11-22

Revisión sin supervisión pedida por el dueño el 2026-11-21 por la noche: encontrar problemas y
documentarlos, sin corregirlos. Entorno: dev (`https://dev.evamediber.click`), cuenta de prueba
del dueño, Chrome headless vía DevTools MCP (modo slim: navigate, evaluate y screenshot), código en
`main` @ 7946df1.

Severidad: **Alta** = datos incorrectos, pérdida de datos o bloqueo; **Media** = función rota o
engañosa con salida; **Baja** = detalle visual, texto o deuda.

## Resumen (lo más importante primero)

1. **A-11 · Alta · Los datos A2 de ecoinvent no son coherentes: GWP-total ≠ fósil + biogénico +
   uso de suelo en 55 de 58 materiales**, con diferencias de hasta 231 %. Afecta a todo resultado
   de carbono con materiales de ecoinvent, incluidas la vista Solo carbono y la barra de carbono.
2. **A-13 · Alta · Uso ofrece fuentes sin datos A2 (mexicaniuh) y las cuenta como 0 sin
   avisar** en la página donde se eligen: 10,000 kWh/año durante 50 años aportan 0 kg CO2 eq.
3. **A-12 · Media · En Construcción la unidad del equipo no cambia el cálculo:** 10 Hrs = 10 kWh
   = 10 MJ = 10 "Sin unidad".
4. **A-16 · Alta · Al comparar proyectos en la tabla de Resultados, la fila Total sale con los
   totales de otro proyecto** cuando el proyecto abierto tiene un id mayor que el comparado.
5. **A-09 · Alta · "Por m²" muestra Infinity/NaN** cuando la superficie construida es 0, y el alta
   del proyecto lo permite (A-07).

## Hallazgos

### Página de inicio (`/home-evamed`)

**A-01 · Media · Cuatro botones sin acción.** "Exportar" y "Generar reporte" de cada tarjeta de
proyecto, "Exportar" en Resultados (sección 3, tabla de materiales) y "Exportar" en la sección 3 de
Resultados (`graficas-tercer-seccion`, con ícono de cámara) no tienen `(click)`. En dev: al hacer
clic no hay petición, descarga ni diálogo. Código: `home-evamed.component.html:285` y `:316`,
`comparar.component.html:219`, `graficas-tercer-seccion.component.html:9`. El dueño decidió el
2026-11-21 no hacer reporte por ahora; mientras tanto, conviene ocultarlos o deshabilitarlos con una
nota ("Próximamente") para que no parezcan rotos.

**A-02 · Baja · Proyectos sin datos sin mensaje.** Las tarjetas de proyectos sin materiales
muestran "0% / 0.00e+0 kg CO2 eq" en las cuatro fases, una gráfica vacía y "Dispersión de impactos
por subetapa" vacía. Un mensaje del tipo "Agrega materiales para ver resultados" sería más claro.
Lo mismo con el filtro por tipo de proyecto ("Oficinas"): si no hay proyectos, la lista queda en
blanco, sin mensaje.

**A-03 · Baja · Peticiones duplicadas al cargar.** `/api-projects/me/`, `/useful-life/` y
`/potential-types/` se piden dos veces cada una al cargar la página (21 llamadas a la API en total).
No rompe nada, pero suma latencia.

**A-04 · Baja · Color del pie de la tarjeta.** En la tarjeta, Producción usa verde #4DBE89 en el
botón y un verde más brillante en el pie. Las etiquetas del pie son diminutas ("98.3") y la de la
porción de 1.68 % se encima. Solo visual.


### Alta de proyecto (diálogo "Crear nuevo proyecto")

**A-05 · Media · Errores al crear un proyecto se pierden en silencio, junto con lo capturado.**
"Siguiente" no valida nada en el navegador y está siempre habilitado. Con el formulario vacío envía
`POST /api-projects/projects/`, el servidor responde **400** y el diálogo ya se cerró: no hay
mensaje y todo lo capturado se pierde. `home-evamed.component.ts:1376-1385` solo muestra un aviso
para 403 (correo sin verificar); cualquier otro error se ignora.

**A-06 · Baja · Cerrar con la "X" envía un alta.** La "X" cierra el diálogo con `true`
(`add-new-project.component.html:5`, `[mat-dialog-close]="true"`) y `afterClosed` llama
`addProject` con `result.nombre` = `undefined` → `POST /projects/` → 400. Comprobado en dev. Hoy
falla siempre, así que no crea nada, pero es una petición basura y un riesgo si el servidor relaja
la validación. Con Escape o clic fuera, `result` es `undefined` y la excepción se traga en el
`try/catch` con `console.log('close modal')`.

**A-07 · Media · El servidor acepta datos de proyecto imposibles.** Se creó en dev el proyecto
**651 "AUDITORIA 2026-11-22 (borrar)"** con superficie construida **0**, superficie habitable
**500** (mayor que la construida) y **0** niveles: `201 Created`. La superficie construida es el
divisor de los resultados "por m²" (`comparar.component.ts`, `getAnalisisBarras`, y el cálculo del
servidor), así que un 0 da divisiones entre cero (ver A-1x más abajo si se confirma). Además el
alta usa `parseInt`, por lo que 120.75 m² se guarda como 120 sin aviso
(`home-evamed.component.ts:1344-1346`).

**A-08 · Baja · "Todos" aparece como Uso de proyecto.** El selector "Uso" del diálogo ofrece
Habitacional, Comercial, Oficinas, Industrial, Educacional, Hospitalario **y "Todos"**, que es la
opción del filtro de la página de inicio, no un uso válido.

> Dato de prueba: el proyecto 651 se creó en la cuenta del dueño para esta auditoría. Se puede
> borrar desde su menú "⋮ → Eliminar".

### Resultados con superficie 0 (proyecto 651)

**A-09 · Alta · "Por m²" con superficie construida 0 muestra Infinity y NaN.** En Resultados del
proyecto 651 (superficie construida 0, habitable 500), la vista por m² muestra en la tabla
**Producción "Infinity", Construcción "NaN", Fin de vida "NaN", Total "NaN"**. Uso sale bien
porque se divide entre la superficie habitable. En la gráfica (#) queda una barra llena con la
etiqueta "0.00e+0" y un eje de 0 a 0.9, que no significa nada. Causa: A-07 (el alta acepta 0) más
`getAnalisisBarras` (`comparar.component.ts`), que divide sin revisar el divisor. Arreglo
sugerido: exigir superficies > 0 al crear o editar el proyecto y, en Resultados, desactivar "por
m²" con un aviso cuando falte la superficie.

**A-10 · Baja · Botones de icono sin nombre.** Los seis botones de Resultados (tabla, gráfica, %,
#, y los dos de "total / por m²" con iconos `border_all` y `branding_watermark`) no tienen
`aria-label` ni tooltip. Los dos de m² en particular no se entienden sin probarlos, y un lector de
pantalla solo lee "border_all".

### Materiales (proyecto 651)

Funciona: crear sistema, Explorer (183 materiales: 125 ECO Platform + 58 ecoinvent), agregar 2
materiales (`201`), editar cantidades (`200`), y la barra de carbono da 3,760.05 kg CO2 eq =
1000 kg × 1.38 + 2 Ton × 1190, cuadra a mano.


### Datos de impacto (catálogo A2 en dev)

**A-11 · Alta · GWP-total de ecoinvent no cuadra con sus componentes.** En EN 15804+A2, y en EF 3.1
de ecoinvent, el cambio climático total es la suma de fósil + biogénico + uso de suelo
(GWP-total = GWP-fossil + GWP-biogenic + GWP-luluc). Se revisaron por la API los 183 materiales
vigentes (`/explorer/produccion/<id>/` y `/material-scheme-data/`):
- **ECO Platform:** 124 de 125 cuadran al 2 %; el que no, "Steel reinforcing bar" (587), difiere
  3.9 %, lo que es plausible por redondeo del EPD.
- **ecoinvent:** **55 de 58 no cuadran**, y en ambos sentidos. Ejemplos: CEM III/C total 0.158 contra
  suma 0.525 (+231 %); Concrete 25 MPa total 473 contra suma 126 kg/m³ (−73 %); Cement, Portland
  1.380 contra 1.212 (+12 %).
- Los totales tampoco son una permutación de las sumas de otros materiales: solo 8 coincidencias,
  y parecen casuales.
- Varios valores no son plausibles en ninguno de los dos sentidos. Por ejemplo, un concreto de
  25 MPa suele andar en 250–300 kg CO2e/m³, y un acero 100 % chatarra rara vez llega a 0.3.

Lista completa: `docs/audit/2026-11-22-gwp-inconsistencias.csv`.

Impacto: la vista Solo carbono y la barra de carbono muestran GWP-total, así que **cualquier
proyecto con materiales de ecoinvent tiene un carbono dudoso**. Lo mismo para los otros 12
indicadores de esos materiales, que salieron del mismo `ecoinvent_refresh` (2026-11-20) y no se
pueden validar con una regla interna.

El mapeo de indicadores (`migrations/0091`: 1183 climate change, 1315 fossil, 1222 biogenic, 1187
luluc) y `_fetch` (`ecoinvent_refresh.py:155-167`, indexado por `(dataset_id, score.id)`) se ven
bien en lectura. Hipótesis no verificadas:
- (a) en la API de ecoinvent esos ids no corresponden a las categorías que se creen para el
  sandbox 3.12;
- (b) parte de los valores viene de una corrida anterior con otros `ecoinvent_dataset_id`, porque
  `_apply` deja el valor viejo cuando falta un score;
- (c) los datos del sandbox no son los oficiales.

Verificarlo cuesta cuota de ecoinvent (1 dataset), así que no se hizo. Siguiente paso sugerido:
pedir un dataset, por ejemplo Cement, Portland (material 434), con los 4 ids de GWP, y comparar
con la ficha web de ecoinvent.

### Construcción, Uso y Fin de vida (proyecto 651)

**A-12 · Media · La unidad del equipo no afecta el resultado.** Al editar un equipo se elige
Cantidad + Unidad (Sin unidad, Hrs, MJ, kWh). Con "Generador ... menor a 18.64 kW" y cantidad 10,
la barra y el servidor (`Construccion.A5` = 27.44 kg CO2 eq) dan **lo mismo con Hrs, kWh, MJ y
"Sin unidad"**. El factor se aplica a la cantidad sin importar la unidad. Esto ya estaba anotado
como R-04 (`SourceInformation`/`TypeEnergy` no tienen unidad de referencia), pero la pantalla deja
elegir unidades como si importaran. Quien capture "500 MJ" obtiene el impacto de 500 horas. Opción
mínima: mostrar solo la unidad de referencia del factor y quitar el selector (o validarlo); la
completa es R-04 B (tabla de unidades de referencia). Fin de vida usa el mismo panel, así que le
aplica igual.

**A-13 · Alta · Uso ofrece fuentes que no tienen datos del método actual y las cuenta como 0.**
"Agregar fuentes" lista 8 opciones, entre ellas las 3 "Energía eléctrica ..." de **mexicaniuh**.
El diseño A2 (2026-11-20) dice que esas redes dejan de ofrecerse ("drop out of the pickers").
Prueba: 10,000 kWh/año al 100 % con mexicaniuh Medio voltaje → **Uso = 0 kg CO2 eq** (B6 = 0) en
la barra y en Resultados. El servidor sí la pone en `excluded.energy`, y la tarjeta de inicio lo
avisa ("Transporte, energía o procesos sin valores del método actual; no se incluyen: Energía
eléctrica, Medio voltaje (MX)-MEXICANIUH"), pero **ni la página de Uso ni Resultados lo muestran**
(`app-excluded-notice` solo se usa en `home-evamed`). Causa: `projects_api/usage.py:85-93`
(`catalogue()`) devuelve todos los `TypeEnergy` sin `methods.offerable(..., current_energy_ids)`.
Arreglo sugerido: filtrar el catálogo de Uso con `offerable` (las filas viejas siguen editables) y
mostrar `excluded` también en Uso y en Resultados.

**A-14 · Baja · Nombres duplicados en el catálogo de Uso.** "Energía eléctrica, Medio/Alto/Bajo
voltaje" aparece dos veces (ecoinvent y mexicaniuh) con la misma etiqueta y el mismo
`aria-label` ("Seleccionar: Energía eléctrica, Medio voltaje"). Solo el chip de base de datos las
distingue; en la vista Lista y para lectores de pantalla son idénticas.

**A-15 · Baja · Textos.**
- "Agregar **1 equipos**", "**1 equipos** agregados", "Agregar **1 fuentes**", "**1 fuentes**
  agregadas": falta el singular.
- Catálogo de maquinaria: "Generador de energía eléctrica a base de Diesel, **potencia potencia**
  entre 18.64 kW y 74.57 kW" y "Maquinaria de carga pesada ... menor a **18.64kW**" (sin espacio).
- Las tarjetas de equipos y fuentes no muestran ningún valor de impacto, a diferencia de las de
  materiales (relacionado con R-04).

### Comparar proyectos en Resultados

**A-16 · Alta · Totales intercambiados entre proyectos en la tabla.** Proyecto abierto 651
(AUDITORIA) y "Miguel Alvarez" agregado desde "Selecciona una opción a visualizar". La tabla
muestra:

| | 1 (651) | 2 (Miguel Alvarez) |
|---|---|---|
| Producción | 3.76e+3 | 5.58e+3 |
| Construcción | 2.74e+1 | 0 |
| Fin de vida | 0 | 9.52e+1 |
| **Total** | **5.67e+3** ✗ (debería ser 3.79e+3) | **3.79e+3** ✗ (debería ser 5.67e+3) |

Causa: `TablaResultados()` (`comparar.component.ts`) acumula los totales en
`auxtotal[element.id]`, y la fila Total se arma con `Object.keys(auxtotal)`. JavaScript recorre
las llaves numéricas en orden ascendente, no en el de inserción, así que los totales salen
ordenados por id de proyecto mientras las columnas siguen `outproyect_bar`. Pasa cada vez que el
proyecto de la columna 1 tiene un id mayor que algún proyecto comparado; con 3 o más proyectos se
revuelven. Arreglo: recorrer `this.outproyect_bar` para armar la fila Total. Además, el primer total
no lleva el separador de miles que llevan los demás valores (detalle del mismo bloque).

**A-17 · Baja · Columnas de la comparación sin nombre.** Con dos o más proyectos, la tabla agrega
una fila con "1  2" y los valores se separan con espacios duros (` ` × 9) dentro de una sola
celda. No dice qué proyecto es cada número y la alineación depende del ancho del texto. El proyecto
1 no tiene chip. Además, en "Selecciona una opción a visualizar" hay dos proyectos llamados
"Prueba" que no se distinguen.

**A-18 · Descartado · Selector de equipos abierto tras navegar.** Se vio cuando la navegación se
disparó por script haciendo clic a través del panel. Con Atrás y Adelante del navegador el panel sí
se cierra (comprobado), así que un usuario real no llega a este estado.

### Permisos y páginas de administración

**Sin hallazgo · Aislamiento entre usuarios (lectura).** Con la cuenta de prueba (no
administradora), las listas `/material-scheme-project/`, `/projects/`,
`/constructive-system-element/` y `/annual-consumption-required/` solo devuelven sus propios
proyectos (646–651). Pedir proyectos ajenos por id (1, 2, 100, 500, 640, 645) da 404 en
`/projects/<id>/`, `/results/` y `/usage/`; un `PATCH` a un proyecto ajeno da 404. La escritura
cruzada (crear una fila en un proyecto ajeno) **no se probó en vivo** porque el permiso fue denegado
durante la sesión. En el código, `access.py:74-75` y `perform_create` (`access.py:147`) validan que
el proyecto sea visible para el usuario.

**A-19 · Media · Las páginas de administración se abren para cualquier usuario.** `AdminGuard`
(`admin.guard.ts`) solo exige sesión iniciada y correo verificado; el nombre engaña. La cuenta de
prueba (`is_admin: false`) abre `/admin-materials` y ve el catálogo completo con un botón
**"Eliminar"** en cada material y "Agregar material". No se presionó. Las escrituras las protege el
servidor (`CatalogueViewSet` → `IsAdminOrReadOnly`), así que se espera un 403, pero la interfaz
ofrece acciones destructivas que van a fallar, y todo depende de que el servidor nunca relaje ese
permiso. Lo mismo para `/admin`, `/admin-units`, `/admin-db-materials`, `/admin-potential`,
`/admin-transports`, `/admin-machinery`, `/admin-energy` y `/admin-others` (mismas rutas en
`app-routing.module.ts`). Arreglo: un guard que revise `me.is_admin` para las rutas `admin*` y
renombrar el actual (`AuthGuard`).

### Páginas informativas

**A-20 · Media · "Manual de usuario" es la página de ejemplo de Angular.** `/user-manual` muestra
solo **"user-manual works!"**. El enlace está en el encabezado de todas las páginas.

**A-21 · Baja · "Acerca de" desactualizada.** Presenta MEXICANIUH como base de datos de la
herramienta (bajo A2 ya no se ofrece) y no menciona ecoinvent, ECO Platform ni EN 15804+A2, que hoy
son la base de los resultados. Erratas: "¿**Quienes** somos?" (Quiénes) y "Level **lof**
Development". Menciona comparar la huella de uso contra el promedio del RUV: hay que confirmar que
esa función siga existiendo.

**A-22 · Baja · Texto de Fin de vida en el Explorer.** `/explorador/fin-de-vida` dice que "EVAMED
calcula solo el consumo de energía de la deconstrucción (C1)", pero desde A2 también se calcula C3
(liberación del carbono biogénico al final de la vida útil).

### Autenticación

Funciona: "ACCEDE AQUÍ" deshabilitado con el formulario vacío; credenciales incorrectas → aviso
"Correo o contraseña no válidos" (dura 4 s); "Olvidaste tu contraseña" abre `/auth/recover-password`;
"Regístrate aquí" abre el registro con reglas de contraseña visibles y "ENVIAR REGISTRO"
deshabilitado hasta completar. No se envió ningún registro ni correo de recuperación.

**A-23 · Media · "Aviso de privacidad" y "Términos y condiciones" no llevan a ningún lado.** En el
pie de login, registro, recuperar contraseña, verificar correo, completar perfil y acción de correo
son texto plano (`login.component.html:101-102` y equivalentes), no enlaces. El registro pide marcar
"He leído y acepto los términos de referencia del manejo de la información" sin enlace a esos
términos. Como el registro recaba nombre, correo, institución y país, la LFPDPPP pide que el aviso de
privacidad esté disponible: conviene enlazar un documento real.

**A-24 · Baja · Erratas en el registro.** "He **leido**" (leído), en `register.component.html:154`.

## Método y límites
