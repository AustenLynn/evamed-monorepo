# Ficha de equipos y fuentes en los selectores (diseño corto)

Fecha: 2026-11-27. Aprobado por el dueño («Sí, empieza con la ficha»).

**Intención:** al agregar o cambiar un equipo (Construcción, Fin de vida) o una fuente (Uso), poder ver la información completa del elemento antes de elegirlo, como la ficha de Producción.

**Qué muestra (solo datos que ya tenemos):** nombre completo, base de datos, región, unidad de captura (h, m³, t·km; kWh para electricidad), etapas donde se usa (A5 y C1, o B6), el proceso de ecoinvent (dataset, actividad y geografía, de `pins.json`) cuando lo hay, el GWP por unidad destacado y la tabla de los indicadores del método activo con su valor por unidad. «Descripción: Sin descripción.» hasta que se traigan los textos de ecoinvent (pendiente de renovar la suscripción) y se escriban los de mexicaniuh y la generación fotovoltaica.

**Enfoques:** (1, elegido) un endpoint de detalle por etapa (`/explorer/construccion/<id>/`, `/explorer/uso/<id>/`) y un componente de ficha compartido en `ExplorerUiModule` usado por los dos selectores; (2) armar la ficha en el navegador con los datos del listado, descartado: el listado no trae los indicadores ni el proceso.

**Interacción (decisión del constructor):** en los selectores, un clic en el nombre abre la ficha dentro del mismo diálogo, con «Volver al catálogo» y la acción («Agregar a la selección» / «Quitar de la selección», o «Elegir» al cambiar). La casilla sigue seleccionando sin abrir la ficha. La generación fotovoltaica no tiene ficha: su nombre sigue seleccionando.

**No objetivos:** descripciones nuevas, cambios de cálculo, fichas para Producción (ya existe).
