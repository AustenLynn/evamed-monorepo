# Edición en el lugar en Construcción, Fin de vida y Uso (diseño corto)

Fecha: 2026-11-27. Aprobado por el dueño ("Así está bien, empieza").

**Intención:** quitar el formulario que se despliega al editar una tarjeta (nombre, «Cambiar equipo/fuente», cantidad o porcentaje, Guardar/Cancelar) en Construcción, Fin de vida y Uso. Todo se edita en el lugar, como la cantidad en Materiales.

**Enfoques:** (1, elegido) reutilizar la celda de cantidad de Materiales (`app-quantity-cell`: clic, Enter o salir guarda, Esc deshace) en las tres etapas; (2) campos siempre visibles en cada tarjeta, descartado: más ruido y otro comportamiento distinto al de Materiales.

**Diseño:**
- `app-quantity-cell` pasa a `SharedModule` y gana: enteros (`integer`), máximo (`max`), texto mostrado (`display`), y un valor inválido no se descarta en silencio: el campo queda abierto, marcado (`aria-invalid`) y con el error debajo. Materiales gana ese mismo comportamiento.
- **Construcción y Fin de vida (equipos):** la cantidad es una celda en la tarjeta; se guarda al confirmar. Clic en el nombre abre el selector («Cambiar equipo») y el cambio se guarda al elegir. Fin de vida sigue en enteros. Sin formulario, sin Guardar/Cancelar.
- **Uso (fuentes):** el porcentaje es una celda (entero 0–100); al guardar se recalcula la cantidad en kWh que muestra la tarjeta. Clic en el nombre abre «Cambiar fuente» y guarda al elegir. Una unidad guardada distinta de kWh muestra un aviso con el botón «Corregir a kWh» (un clic). El aviso de % asignado / pendiente sigue visible.
- **Uso (consumo anual):** celda entera en el lugar. Unidad distinta de kWh: botón «Corregir a kWh». Consumo guardado negativo: el aviso existente explica que al guardar el nuevo consumo se recalculan las fuentes con sus porcentajes; guardar en el lugar confirma ese recálculo (sin casilla).
- Eliminar sigue en el pie de la tarjeta. Errores del servidor se muestran en la tarjeta.

**No objetivos:** cambiar el cálculo, la API, el selector o Materiales más allá de la celda.

**Al constructor:** nombres y estilos; cómo se reflejan los estados de guardado («Guardando…») en la tarjeta.
