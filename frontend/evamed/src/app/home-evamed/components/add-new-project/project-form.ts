import { HttpErrorResponse } from '@angular/common/http';

/** The fields of the "Nuevo proyecto" dialog that the server needs. */
export interface ProjectFormValues {
  nombre?: string | null;
  usoSeleccionado?: number | null;
  tipoSeleccionado?: number | null;
  paisSeleccionado?: number | null;
  vidaUtilSeleccionado?: number | null;
  esqHabitacionalSeleccionado?: number | string | null;
  ciudadSeleccionada?: number | null;
  superficieConstruida?: string | number | null;
  superficieHabitable?: string | number | null;
  noNiveles?: string | number | null;
}

export type ProjectFormErrors = Partial<Record<keyof ProjectFormValues, string>>;

const ENTERO = 'Escribe un número entero mayor que 0.',
  entero = (valor: unknown): number | null => {
    const texto = String(valor ?? '').trim();
    return /^\d+$/.test(texto) && Number(texto) > 0 ? Number(texto) : null;
  };

/**
 * What is missing or impossible in the form, by field. Per-m² results divide by
 * the surfaces, so they must be whole numbers above 0 (audit A-07, 2026-11-22).
 */
export function validarProyecto(d: ProjectFormValues): ProjectFormErrors {
  const errores: ProjectFormErrors = {};
  if (!d.nombre?.trim()) errores.nombre = 'Escribe un nombre.';
  if (d.usoSeleccionado == null) errores.usoSeleccionado = 'Elige un uso.';
  if (d.paisSeleccionado == null) errores.paisSeleccionado = 'Elige un país.';
  const construida = entero(d.superficieConstruida),
    habitable = entero(d.superficieHabitable);
  if (construida === null) errores.superficieConstruida = ENTERO;
  if (habitable === null) errores.superficieHabitable = ENTERO;
  else if (construida !== null && habitable > construida) {
    errores.superficieHabitable = 'No puede ser mayor que la superficie construida.';
  }
  if (entero(d.noNiveles) === null) errores.noNiveles = ENTERO;
  if (d.vidaUtilSeleccionado == null) errores.vidaUtilSeleccionado = 'Elige la vida útil.';
  return errores;
}

export function payloadProyecto(d: ProjectFormValues, userId: number) {
  return {
    name_project: d.nombre!.trim(),
    builded_surface: entero(d.superficieConstruida),
    living_area: entero(d.superficieHabitable),
    tier: entero(d.noNiveles),
    use_id: d.usoSeleccionado,
    type_id: d.tipoSeleccionado ?? null,
    country_id: d.paisSeleccionado,
    useful_life_id: d.vidaUtilSeleccionado,
    housing_scheme_id: d.esqHabitacionalSeleccionado ?? null,
    user_platform_id: userId,
    city_id_origin: d.ciudadSeleccionada ?? null,
    distance: null,
  };
}

/** A message the user can act on, instead of closing the dialog in silence (audit A-05). */
export function mensajeErrorProyecto(error: HttpErrorResponse): string {
  if (error.status === 403) return 'Verifica tu correo electrónico para crear proyectos.';
  if (error.status === 400 && error.error && typeof error.error === 'object') {
    const primero = Object.values(error.error as Record<string, unknown>)
      .flatMap(valor => (Array.isArray(valor) ? valor : [valor]))
      .find(valor => typeof valor === 'string');
    if (primero) return primero as string;
  }
  return 'No se pudo guardar el proyecto. Revisa tu conexión e inténtalo de nuevo.';
}
