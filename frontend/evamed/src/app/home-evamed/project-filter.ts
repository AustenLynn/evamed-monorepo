/** Projects of one use, in their original order; 0 ("Todos") or no choice keeps them all. */
export function filtrarProyectos<T extends { use_id?: number | null }>(lista: T[], uso: number | null | undefined): T[] {
  return uso ? lista.filter(p => p.use_id === uso) : [...lista];
}
