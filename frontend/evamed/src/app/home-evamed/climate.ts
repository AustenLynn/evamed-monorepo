/** Full names of the climate change total under each method (CML, EN 15804+A2). */
const CLIMATE_CHANGE_TOTALS = new Set(['Calentamiento Global', 'Calentamiento global, total']);

/** The indicator that shows the carbon scale option. */
export function isClimateChangeTotal(name: string): boolean {
  return CLIMATE_CHANGE_TOTALS.has(name);
}

/** "Habitacional" in the Use catalogue: the RUV references are for housing only. */
const USO_HABITACIONAL = 1;

/**
 * Carbon reference scales offered on the card. "Promedio del sector vivienda" is
 * hidden until its ranges are confirmed against the RUV source: its steps of
 * 2,867 kg/m²·año put every real home in A or B (audit A-27, 2026-11-22).
 */
export const OPCIONES_CARBONO = ['Vivienda sustentable'];

/** Whether the card offers "Ver referencia" (audit A-28: also on first load, housing only). */
export function muestraReferenciaCarbono(indicador: string, proyecto: { use_id?: number | null } | undefined): boolean {
  return isClimateChangeTotal(indicador) && proyecto?.use_id === USO_HABITACIONAL;
}

/** Use-stage kg CO2 eq per m² per year, or null when there is nothing to compare. */
export function valorReferenciaCarbono(usoTotal: number, superficieHabitable: number, vidaUtil: number): number | null {
  if (!(usoTotal > 0) || !(superficieHabitable > 0) || !(vidaUtil > 0)) return null;
  return usoTotal / superficieHabitable / vidaUtil;
}
