export type StageKey = 'produccion' | 'construccion' | 'uso' | 'fin-de-vida';

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
  },
  {
    key: 'construccion',
    tabTitle: 'Construcción',
    tabSubtitle: 'Maquinaria y procesos',
    image: { active: ETAPAS + 'Construcción.png', idle: ETAPAS + 'Construcción_.png' },
    title: 'Explorador de construcción',
    subtitle: 'Maquinaria y procesos de obra.',
  },
  {
    key: 'uso',
    tabTitle: 'Uso',
    tabSubtitle: 'Energía y sistemas',
    image: { active: ETAPAS + 'Uso.png', idle: ETAPAS + 'Uso_.png' },
    title: 'Explorador de uso',
    subtitle: 'Fuentes de energía para la operación del edificio.',
  },
  {
    key: 'fin-de-vida',
    tabTitle: 'Fin de vida',
    tabSubtitle: 'Escenarios y tratamiento',
    // The app's file names swap the underscore for this stage.
    image: { active: ETAPAS + 'Fin_.png', idle: ETAPAS + 'fin.png' },
    title: 'Explorador de fin de vida',
    subtitle: 'Escenarios de fin de vida.',
  },
];

export function stageConfig(key: string): StageConfig | undefined {
  return STAGES.find(stage => stage.key === key);
}
