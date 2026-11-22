export type EquipmentStage = 'construction' | 'end-life';
export interface EquipmentSource { id: number; name: string; type: string; displayName?: string; database?: string | null; region?: string | null; }
export interface EquipmentUnit { id: number; name: string; }
export interface EquipmentRow {
  key: string; id: number; sectionId: number;
  sourceId: number | null; quantity: string | number | null; unitId: number | null;
}
export interface EquipmentDraft { sourceId: number | null; quantity: unknown; unitId: number | null; }
export interface EquipmentInput { sourceId: number; quantity: number | string; unitId: number | null; }
export interface EquipmentCatalogue {
  sources: EquipmentSource[]; units: EquipmentUnit[]; unitLabels: EquipmentUnit[];
  /**
   * Every machinery factor is per hour of operation (ecoinvent "machine operation"
   * datasets), so quantities are hours and rows save this unit (audit A-12).
   * Null when the unit catalogue has no hours entry.
   */
  hourUnitId?: number | null;
  constructionEnergyProcessId: number | null;
}
export interface EquipmentSnapshot { rows: EquipmentRow[]; rawTotal: number; }
