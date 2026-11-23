# Escenario de fin de vida de EVAmed (propuesta)

Fecha: 2026-11-22. Estado: **propuesta, pendiente de aprobación del dueño**. Mientras
`projects_api/end_of_life/data/scenarios.json` tenga `"approved": false`, no se aplica.

Se usa solo para materiales de **ecoinvent** que no declaran C2–C4. Los materiales con EPD usan lo
que declaró el fabricante. Diseño: `docs/superpowers/specs/2026-11-22-fin-de-vida-c2-c4-design.md`.

## Cómo se calcula

- **C2 (transporte a disposición):** toneladas × distancia × factor del camión de 16 a 32 t EURO 3
  (RoW, ya ligado a ecoinvent para A4).
- **C3 (tratamiento: reciclaje o separación)** y **C4 (disposición: relleno)**: kg × porcentaje ×
  factor del tratamiento de ecoinvent (por kg de residuo).
- Masa: materiales en kg o t directamente; en m³ con la densidad de la tabla. Sin masa, el material
  sale en el aviso «sin masa para el escenario».

## Propuesta por tipo de material

| Tipo | Destino (módulo) | % | Distancia | Densidad | Fuente |
|---|---|---|---|---|---|
| Concreto | Relleno de material inerte (C4) / reciclaje de concreto sin armar (C3) | 95 / 5 | 30 km | 2400 kg/m³ | Supuesto¹ |
| Block | Relleno de material inerte (C4) / reciclaje de concreto sin armar (C3) | 95 / 5 | 30 km | — | Supuesto¹ |
| Acero | Reciclaje de varilla (C3) / relleno de material inerte (C4) | 72 / 28 | 30 km | — | AISC² |
| Ladrillo | Relleno de residuo inerte (C4) / reciclaje de ladrillo (C3) | 95 / 5 | 30 km | — | Supuesto¹ |
| Panel de yeso | Relleno de yeso (C4) / reciclaje de tablaroca (C3) | 90 / 10 | 30 km | — | Supuesto¹ |
| Yeso | Relleno de yeso (C4) | 100 | 30 km | — | Supuesto¹ |
| Aplanado | Relleno de residuo inerte (C4) | 100 | 30 km | 1800 kg/m³ | Supuesto¹ |
| Mortero, Cemento, Grava, Arena | Relleno de residuo inerte (C4) | 100 | 30 km | — | Supuesto¹ |
| Otros (sin tipo) | Relleno de residuo inerte (C4) | 100 | 30 km | — | Supuesto¹ |

1. No hay una cifra nacional publicada del porcentaje de residuos de construcción y demolición que se
   recicla en México; los trabajos disponibles coinciden en que se trata un porcentaje muy bajo. La
   distancia de 30 km es un supuesto para una zona urbana. El diagnóstico de SEMARNAT y el PGIRS de la
   CDMX son las fuentes a revisar para fijar mejores valores.
2. 72 % de recuperación de varilla al final de vida en Norteamérica (AISC, *More than recycled
   content*). worldsteel usa 95 % en su EPD de varilla y el Reino Unido 98 %; se propone el valor más
   conservador y más cercano a México.

## Datos de ecoinvent

Ocho tratamientos se usan arriba. Los diez ligados en `manual_pins.json` incluyen además «Concreto
armado a reciclaje» y «Aplanado mineral a separación», que esta propuesta no usa; si se aprueba así,
se pueden quitar del pin para no gastar 2 datasets de cuota. El conteo exacto se reporta con
`ecoinvent_refresh --only waste_treatment --count-only` antes de gastar.
