/** One project's per-stage results, as getAnalisisBarras builds them. */
export interface ProyectoTabla {
  id: number;
  Nombre: string;
  Datos: Record<string, Record<string, number>>;
}

/** A table row: the stage name, and per indicator one formatted value per project, in column order. */
export interface FilaTabla {
  data: Record<string, string | string[]>;
  color: string;
}

const ETAPAS = ['Producción', 'Construccion', 'Uso', 'FinDeVida'],
  COLORES = ['#4DBE89', '#148A93', '#8F5091', '#DEA961', '#767676'],
  formato = (valor: number) => (Number.isFinite(valor) ? valor.toExponential(2) : '—');

/** Project names, with the id added where two projects share a name (audit A-17). */
export function etiquetasProyectos(proyectos: { id: number; Nombre: string }[]): string[] {
  const repetidos = new Set(
    proyectos.map(p => p.Nombre).filter((nombre, i, todos) => todos.indexOf(nombre) !== i)
  );
  return proyectos.map(p => (repetidos.has(p.Nombre) ? `${p.Nombre} (#${p.id})` : p.Nombre));
}

/**
 * Rows of the Resultados table. Every value list follows the order of `proyectos`,
 * so a project's total always sits under its own column (audit A-16).
 */
export function filasTabla(proyectos: ProyectoTabla[], fasesEliminadas: string[]): FilaTabla[] {
  if (!proyectos.length) return [];
  const impactos = Object.keys(proyectos[0].Datos),
    columna = (impacto: string) => impacto.replace(/\n/g, ''),
    etapas = ETAPAS.filter(etapa => !fasesEliminadas.includes(etapa)),
    filas: FilaTabla[] = [];
  if (proyectos.length > 1) {
    const nombres = etiquetasProyectos(proyectos),
      data: FilaTabla['data'] = { 'ciclo de vida': 'Proyecto' };
    impactos.forEach(impacto => (data[columna(impacto)] = nombres));
    filas.push({ data, color: COLORES[4] });
  }
  etapas.forEach(etapa => {
    const data: FilaTabla['data'] = { 'ciclo de vida': etapa };
    impactos.forEach(impacto => (data[columna(impacto)] = proyectos.map(p => formato(p.Datos[impacto]?.[etapa] ?? 0))));
    filas.push({ data, color: COLORES[ETAPAS.indexOf(etapa)] });
  });
  const total: FilaTabla['data'] = { 'ciclo de vida': 'Total' };
  impactos.forEach(impacto => {
    total[columna(impacto)] = proyectos.map(p => formato(etapas.reduce((suma, etapa) => suma + (p.Datos[impacto]?.[etapa] ?? 0), 0)));
  });
  filas.push({ data: total, color: COLORES[4] });
  return filas;
}
