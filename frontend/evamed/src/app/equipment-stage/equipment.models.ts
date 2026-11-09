export type EquipmentStage = 'construction' | 'end-life';
export interface EquipmentSource { id: number; name: string; type: string; }
export interface EquipmentUnit { id: number; name: string; }
export interface EquipmentRow {
  key: string; id: number; sectionId: number;
  sourceId: number | null; quantity: string | number | null; unitId: number | null;
}
export interface EquipmentDraft { sourceId: number | null; quantity: unknown; unitId: number | null; }
export interface EquipmentInput { sourceId: number; quantity: number | string; unitId: number | null; }
export interface EquipmentCatalogue {
  sources: EquipmentSource[]; units: EquipmentUnit[]; unitLabels: EquipmentUnit[];
  constructionEnergyProcessId: number | null;
}
export interface EquipmentSnapshot { rows: EquipmentRow[]; rawTotal: number; }
