# Vista "Solo carbono" en Resultados (diseño corto)

Fecha: 2026-11-21. Tamaño: cambio pequeño, solo frontend.

## Intención

El dueño quiere ver los resultados de un proyecto con **un solo indicador** de carbono, en lugar de
los 13 indicadores de EN 15804+A2. Esa vista tiene que juntar los datos de ecoinvent (EF 3.1) y de
ECO Platform en el mismo indicador.

## Objetivos, no objetivos y antiobjetivos

- **Objetivo:** un selector en Resultados (`/resultados`, `comparar.component`) con dos opciones,
  **Completo** (todos los indicadores, como hoy) y **Solo carbono** (solo GWP-total). Las tres
  secciones (por etapa, por elemento constructivo y por material) obedecen al selector.
- **No objetivos:** un reporte descargable (decisión del dueño, 2026-11-21: "de momento no"); el
  botón "Exportar", que no tiene acción, se queda como está. Nuevo método IPCC, nuevos datos y
  consultas a ecoinvent.
- **Antiobjetivos:** que cambie cualquier número. Solo carbono muestra exactamente el GWP-total que
  la vista Completo ya muestra, con las mismas reglas A2 (biogénico al final de la vida útil,
  exclusiones, lista sin masa).

## Enfoques considerados

1. **GWP-total de A2 (elegido por el dueño).** Todo material vigente bajo A2 tiene los 13
   indicadores, así que GWP-total cubre el 100% de los materiales de las dos fuentes. Es el
   indicador de la norma y de los EPDs, y no requiere datos nuevos.
2. GWP-fósil + GWP-uso de suelo ("carbono sin biogénico", cercano a GWP-GHG de IPCC AR5).
   Descartado por ahora; se podría agregar después como otra opción del selector.
3. IPCC 2021 (AR6) GWP100. Descartado: ecoinvent lo tiene, pero cuesta cuota, y los EPDs de ECO
   Platform no lo traen, así que las dos fuentes no se pueden juntar.

## Lo decidido

- El indicador se identifica por `name_potential_type`, `GWP-total` bajo A2 y `PCG 100` bajo CML
  (igual que `GWP_TOTAL` en `projects_api/methods.py`), para que el selector funcione con
  cualquiera de los dos métodos del sitio.
- **Completo** es la opción por defecto.
- El cambio se hace filtrando el catálogo de indicadores de la página (`catologoImpactoAmbiental`)
  y redibujando lo que depende de él. Los cálculos no cambian.

## Decisiones del implementador (propuestas, se pueden corregir)

- La elección se recuerda por navegador en `localStorage`, envuelto en try/catch. Si no hay nada
  guardado, se usa Completo.
- El selector es un `mat-button-toggle-group` junto a los controles actuales, con las etiquetas
  "Completo" y "Solo carbono".
- Si el indicador no aparece entre los servidos, el selector se oculta.
- Pruebas en Vitest: el filtro deja un solo indicador; volver a Completo restaura la lista; con
  CML se elige `PCG 100`.
