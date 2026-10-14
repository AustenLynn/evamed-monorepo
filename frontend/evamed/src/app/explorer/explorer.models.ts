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

/** What narrows the list: the search text and, per query parameter, the chosen values. */
export interface ExplorerQuery {
  search: string;
  filters: Record<string, string[]>;
}

export const PAGE_SIZE = 24;
