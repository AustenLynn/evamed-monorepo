export type StageKey = 'produccion' | 'construccion' | 'uso' | 'fin-de-vida';

/** A checkbox filter: the API's query parameter, its name in the page URL, and its facet. */
export interface StageFilter {
  param: 'source' | 'type' | 'region';
  urlParam: 'base' | 'tipo' | 'region';
  facet: 'sources' | 'types' | 'regions';
  label: string;
}

const SOURCE: StageFilter = { param: 'source', urlParam: 'base', facet: 'sources', label: 'Base de datos' },
  TYPE: StageFilter = { param: 'type', urlParam: 'tipo', facet: 'types', label: 'Tipo' },
  // Read from the names (R-44); items whose name doesn't say are 'Sin región'.
  REGION: StageFilter = { param: 'region', urlParam: 'region', facet: 'regions', label: 'Región' };

export interface StageConfig {
  key: StageKey;
  /** Stage tab. */
  tabTitle: string;
  tabSubtitle: string;
  /** The app's stage images: the yellow one marks the current stage. */
  image: { active: string; idle: string };
  /** Page header. */
  title: string;
  subtitle: string;
  /** Filters backed by real data (HANDOFF §6, K-01, K-05, R-44). */
  filters: StageFilter[];
  /** Whether items open a detail page (Producción only). */
  hasDetail: boolean;
  /** Whether the list can be ordered by impact or category: only items with a unit compare (R-04). */
  sortable: boolean;
  /** Shown instead of the explorer when the stage has no catalogue (K-06). */
  emptyMessage?: string;
}

const ETAPAS = 'assets/images/Etapas/';

// The app's four life-cycle stages, in its order. Transport isn't a stage:
// it's set per material in the edit form (HANDOFF §2).
export const STAGES: readonly StageConfig[] = [
  {
    key: 'produccion',
    tabTitle: 'Producción',
    tabSubtitle: 'Materiales y productos',
    image: { active: ETAPAS + 'Produccion.png', idle: ETAPAS + 'Produccion_.png' },
    title: 'Explorador de materiales',
    subtitle: 'Busca, filtra y compara los materiales de las bases de datos de EVAMED.',
    filters: [SOURCE, REGION],
    hasDetail: true,
    sortable: true,
  },
  {
    key: 'construccion',
    tabTitle: 'Construcción',
    tabSubtitle: 'Maquinaria y procesos',
    image: { active: ETAPAS + 'Construcción.png', idle: ETAPAS + 'Construcción_.png' },
    title: 'Explorador de construcción',
    subtitle: 'Maquinaria y procesos de obra.',
    filters: [TYPE, REGION],
    hasDetail: false,
    sortable: false,
  },
  {
    key: 'uso',
    tabTitle: 'Uso',
    tabSubtitle: 'Energía y sistemas',
    image: { active: ETAPAS + 'Uso.png', idle: ETAPAS + 'Uso_.png' },
    title: 'Explorador de uso',
    subtitle: 'Fuentes de energía para la operación del edificio.',
    filters: [SOURCE, TYPE, REGION],
    hasDetail: false,
    sortable: false,
  },
  {
    key: 'fin-de-vida',
    tabTitle: 'Fin de vida',
    tabSubtitle: 'Escenarios y tratamiento',
    // The app's file names swap the underscore for this stage.
    image: { active: ETAPAS + 'Fin_.png', idle: ETAPAS + 'fin.png' },
    title: 'Explorador de fin de vida',
    subtitle: 'Escenarios de fin de vida.',
    filters: [],
    hasDetail: false,
    sortable: false,
    emptyMessage:
      'Aún no hay escenarios de fin de vida con factores de impacto en la base de datos. ' +
      'Por ahora, EVAMED calcula solo el consumo de energía de la deconstrucción (C1), ' +
      'con la maquinaria del explorador de construcción.',
  },
];

export function stageConfig(key: string): StageConfig | undefined {
  return STAGES.find(stage => stage.key === key);
}
