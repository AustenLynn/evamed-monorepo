export type UsageFamily = 'electric' | 'fuel' | 'panels';
export interface UsageUnit {id: number; name_unit: string}
export interface UsageAnnual {id: number; quantity: number; unit_id: number | null}
export interface UsageSource {
  id: number; annual_consumption_required_id: number; percentage: number | null;
  quantity: string | null; unit_id: number | null; type: number | null;
  source: string | null; issues: string[];
}
export interface UsageCatalogueItem {
  id: number; name: string; display_name: string; family: 'electric' | 'fuel' | null;
  database: string | null; region: string | null;
  /** False when the source has no data for the active impact method: kept for saved rows, never offered. */
  offerable?: boolean;
}
export interface UsageState {
  project_id: number; project_name: string; annual: UsageAnnual | null; annuals: UsageAnnual[];
  sources: UsageSource[]; catalogue: UsageCatalogueItem[]; units: UsageUnit[];
  canonical_unit_id: number | null; revision: string; issues: string[];
  replayed?: boolean; operation_applied?: boolean;
}
export interface SourceEdit {
  id: number; percentage?: number; type?: number | null; source?: string | null; repair_unit?: boolean;
}
export interface UsageAddition {client_id: string; type: number | null; source: UsageFamily}
export interface UsageChange {
  revision: string; operation_id: string;
  annual?: {quantity: number; repair_unit?: boolean}; edits?: SourceEdit[];
  removals?: number[]; additions?: UsageAddition[];
}
export type UsageIntent = Omit<UsageChange, 'revision' | 'operation_id'>;
export interface AnnualDraft {quantity: string; repairUnit: boolean; confirmRecalculate: boolean}
export interface SourceDraft {percentage: string; type: number | null; source: string | null; repairUnit: boolean}
export interface UsageOption {
  key: string; selectionId: number; type: number | null; source: UsageFamily | null;
  name: string; rawName: string; database: string | null; region: string | null; supported: boolean;
  /** Undefined means offerable. */
  offerable?: boolean;
}
export type UsageOperationTarget = {kind: 'annual'} | {kind: 'source'; id: number} |
  {kind: 'add'; keys: string[]} | {kind: 'remove'; id: number};
export interface UsageOperation {request: UsageChange; target: UsageOperationTarget}
