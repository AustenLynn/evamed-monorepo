/** What the stage page knows when it opens the explorer (R-02, R-20). */
export interface PickerContext {
  /** The constructive system the material goes into. */
  system: string;
  /** The section (Excel sheet) it belongs to, for display. */
  section?: string | null;
  /** The project's useful life, in years. */
  projectLife: number;
}

/** The explorer's answer: a catalogue material with the project data entered for it. */
export interface PickedMaterial {
  material: { id: number; name: string; unit: string | null; source: string | null };
  comercialName: string;
  quantity: number;
  comments: string;
  /** Transporte 1, origen → frontera: transport_id_origin / distance_init (R-03). */
  transportOrigin: number | null;
  distanceOrigin: number | null;
  /** Transporte 2, frontera → obra: transport_id_end / distance_end. */
  transportEnd: number | null;
  distanceEnd: number | null;
  lifeYears: number;
  replaces: number;
}

/** calculos.ts uses these when a distance has no transport type. */
export const DEFAULT_TRANSPORT_ORIGIN = 1,
  DEFAULT_TRANSPORT_END = 4;

/** replaces = ceil(project life / material life) − 1, as the stage pages compute it (K-09). */
export const replacesFor = (projectLife: number, lifeYears: number): number =>
  lifeYears > 0 ? Math.max(0, Math.ceil(projectLife / lifeYears) - 1) : 0;

/** The material life implied by a number of replacements. */
export const lifeFor = (projectLife: number, replaces: number): number =>
  Math.round((projectLife / (Math.max(0, replaces) + 1)) * 10) / 10;
