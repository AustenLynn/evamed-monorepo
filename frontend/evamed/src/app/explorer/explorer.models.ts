import { StageKey } from './stage-config';

export type ImpactLevel = 'bajo' | 'medio' | 'alto' | 'credito' | null;

/** One catalogue item, as GET /explorer/<stage>/ returns it. */
export interface ExplorerItem {
  id: number;
  stage: StageKey;
  name: string;
  display_name: string;
  category: string | null;
  description: string | null;
  source: string | null;
  /** Construcción and Uso only. */
  type?: string;
  /** null when the data has no reference unit (Construcción, Uso). */
  unit: string | null;
  gwp: number | null;
  impact_level: ImpactLevel;
}

/** facet name → value → count. */
export type Facets = Record<string, Record<string, number>>;

export interface ExplorerPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: ExplorerItem[];
  facets: Facets;
}

/** How the API orders a stage: by name, by unit then lowest or highest GWP, or by category then as impacto. */
export type SortKey = 'nombre' | 'impacto' | 'mayor-impacto' | 'categoria';

export const SORTS: readonly { value: SortKey; label: string }[] = [
  { value: 'nombre', label: 'Nombre (A→Z)' },
  { value: 'impacto', label: 'Menor impacto' },
  { value: 'mayor-impacto', label: 'Mayor impacto' },
  { value: 'categoria', label: 'Categoría' },
];

/** What narrows the list: the search text and, per query parameter, the chosen values; and its order. */
export interface ExplorerQuery {
  search: string;
  filters: Record<string, string[]>;
  /** Absent means 'nombre'. */
  sort?: SortKey;
}

export const PAGE_SIZE = 24;

export interface Indicator {
  code: string;
  name: string;
  unit: string;
  a1: number | null;
  a2: number | null;
  a3: number | null;
  a1_a3: number | null;
}

/** The material within its category and unit (HANDOFF §5.3); null below 5 materials. */
export interface Comparison {
  group: string;
  unit: string;
  n: number;
  mean: number;
  p25: number;
  value: number;
}

/** GET /explorer/produccion/<id>/ */
export interface MaterialDetail extends ExplorerItem {
  ecoinvent: { dataset_id: number; version: string | null; system_model: string | null } | null;
  indicators: Indicator[];
  comparison: Comparison | null;
}
