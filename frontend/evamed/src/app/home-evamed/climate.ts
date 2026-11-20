/** Full names of the climate change total under each method (CML, EN 15804+A2). */
const CLIMATE_CHANGE_TOTALS = new Set(['Calentamiento Global', 'Calentamiento global, total']);

/** The indicator that shows the carbon scale option. */
export function isClimateChangeTotal(name: string): boolean {
  return CLIMATE_CHANGE_TOTALS.has(name);
}
