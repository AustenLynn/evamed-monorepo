/**
 * "Solo carbono" view of the results page (design 2026-11-21-solo-carbono-view).
 * It filters what is shown, never what is calculated: the A2 rules need every indicator.
 */
export type VistaResultados = 'completo' | 'carbono';

const STORAGE_KEY = 'evamed.resultados.vista',
 CARBON_NAMES = ['GWP-total', 'PCG 100'];

/** The climate-change indicator: GWP-total under EN 15804+A2, PCG 100 under CML. */
export function carbonType(types: any[]): any | undefined {
  for (const name of CARBON_NAMES) {
    const found = (types ?? []).find(t => t?.['name_potential_type'] === name);
    if (found) return found;
  }
  return undefined;
}

/** A copy of `datos` with only the named indicator keys; `null` keeps everything. */
export function keepIndicators<T>(datos: Record<string, T>, names: Set<string> | null): Record<string, T> {
  if (names === null || datos === null || datos === undefined) return datos;
  const kept: Record<string, T> = {};
  Object.keys(datos).forEach(key => {
    if (names.has(key)) kept[key] = datos[key];
  });
  return kept;
}

export function loadVista(): VistaResultados {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'carbono' ? 'carbono' : 'completo';
  } catch {
    return 'completo';
  }
}

export function saveVista(vista: VistaResultados): void {
  try {
    localStorage.setItem(STORAGE_KEY, vista);
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
}
