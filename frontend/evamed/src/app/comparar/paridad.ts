/** One numeric leaf where the browser and the server disagree. */
export interface Diferencia {
  ruta: string;
  navegador: number | undefined;
  servidor: number | undefined;
}

const numero = (v: unknown): v is number => typeof v === 'number';

/**
 * Leaves that differ between the browser and the server results (A-32 plan).
 * A key missing on one side counts as 0; relative tolerance absorbs float order.
 * Temporary: removed with the browser calculation (plan Task 9).
 */
export function compararResultados(navegador: unknown, servidor: unknown, ruta = '', tolerancia = 1e-9): Diferencia[] {
  const objeto = (v: unknown) => v !== null && typeof v === 'object';
  if (objeto(navegador) || objeto(servidor)) {
    const a = objeto(navegador) ? (navegador as Record<string, unknown>) : {},
      b = objeto(servidor) ? (servidor as Record<string, unknown>) : {},
      claves = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...claves].flatMap(clave => compararResultados(a[clave], b[clave], ruta ? `${ruta}.${clave}` : clave, tolerancia));
  }
  const a = numero(navegador) ? navegador : undefined,
    b = numero(servidor) ? servidor : undefined,
    x = a ?? 0,
    y = b ?? 0,
    escala = Math.max(Math.abs(x), Math.abs(y), 1e-30);
  return Math.abs(x - y) / escala > tolerancia ? [{ ruta, navegador: a, servidor: b }] : [];
}
