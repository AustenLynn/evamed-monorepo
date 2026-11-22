# Auditoría nocturna EVAmed: 2026-11-22

Revisión sin supervisión pedida por el dueño el 2026-11-21 por la noche: encontrar problemas y
documentarlos, sin corregirlos. Entorno: dev (`https://dev.evamediber.click`), cuenta de prueba
del dueño, Chrome headless vía DevTools MCP (modo slim: navigate, evaluate y screenshot), código en
`main` @ 7946df1.

Severidad: **Alta** = datos incorrectos, pérdida de datos o bloqueo; **Media** = función rota o
engañosa con salida; **Baja** = detalle visual, texto o deuda.

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

## Método y límites
