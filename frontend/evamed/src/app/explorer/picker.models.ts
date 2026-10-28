/** A project row's own values, to start the edit form from. */
export interface PickerInitial {
  comercialName: string;
  quantity: number | null;
  comments: string;
  transportOrigin: number | null;
  distanceOrigin: number | null;
  transportEnd: number | null;
  distanceEnd: number | null;
  replaces: number | null;
  /** The unit the row was entered in, when it isn't the catalogue's. */
  rowUnit: string | null;
}

/** What the stage page knows when it opens the explorer (R-02, R-20). */
export interface PickerContext {
  /**
   * 'add' a new material (default), 'edit' a row already in the project, or
   * 'choose' a catalogue material for the Materiales panel's edit form.
   */
  mode?: 'add' | 'edit' | 'choose';
  /**
   * Edit: the row's catalogue material, to open Edición directly; null when it has none.
   * Choose: the material whose Ficha to open first; null starts on the list.
   */
  materialId?: number | null;
  /** Edit: the row's values. */
  initial?: PickerInitial;
  /** The constructive system the material goes into. */
  system: string;
  /** The section (Excel sheet) it belongs to, for display. */
  section?: string | null;
  /** The project's useful life, in years. */
  projectLife: number;
  /**
   * Add: saves the chosen materials and says, per material, whether it was
   * saved. Unsaved ones stay in the picker to retry. Without it, the picker
   * only hands the materials back.
   */
  save?: (materials: PickedMaterial[]) => Promise<boolean[]>;
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

/** A material in the picker's selection: its quantity, and the rest of Edición's values. */
export interface SelectionRow {
  material: PickedMaterial['material'];
  displayName: string;
  /** 0 when ticked: it's filled in afterwards, in the stage page's list (R-43). */
  quantity: number | null;
  values: Omit<PickedMaterial, 'material' | 'quantity'>;
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

/** A selected material starts from Edición's defaults (HANDOFF §4): catalogue name, calculation transports, project life. */
export const selectionRow = (
  item: { id: number; name: string; display_name: string; unit: string | null; source: string | null },
  projectLife: number
): SelectionRow => ({
  material: { id: item.id, name: item.name, unit: item.unit, source: item.source },
  displayName: item.display_name,
  quantity: 0,
  values: {
    comercialName: item.display_name,
    comments: '',
    transportOrigin: DEFAULT_TRANSPORT_ORIGIN,
    distanceOrigin: null,
    transportEnd: DEFAULT_TRANSPORT_END,
    distanceEnd: null,
    lifeYears: projectLife,
    replaces: replacesFor(projectLife, projectLife),
  },
});

/** The row as the material it adds. */
export const pickedFrom = (row: SelectionRow): PickedMaterial => ({
  material: row.material,
  quantity: row.quantity ?? 0,
  ...row.values,
});
