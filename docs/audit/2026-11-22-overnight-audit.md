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


## Método y límites
