export interface UsageType {
  id: number; name: string; display_name: string;
  family: 'electric' | 'fuel' | null; database: string | null; region: string | null;
}
export interface UsageAnnual {id: number; quantity: number; unit_id: number | null}
export interface UsageSource {
  id: number; annual_consumption_required_id: number; percentage: number | null;
  quantity: string | null; unit_id: number | null; type: number | null;
  source: string | null; issues: string[];
}
export interface UsageState {
  project_id: number; project_name: string; annual: UsageAnnual | null; annuals: UsageAnnual[];
  sources: UsageSource[]; catalogue: UsageType[]; units: {id: number; name_unit: string}[];
  canonical_unit_id: number | null; revision: string; issues: string[];
  replayed?: boolean; operation_applied?: boolean;
}
export interface UsageAddition {client_id: string; type: number | null; source: string}
export interface UsageChange {
  revision: string; operation_id: string;
  annual?: {quantity: number; repair_unit?: boolean};
  edits?: {id: number; percentage?: number; type?: number | null; source?: string; repair_unit?: boolean}[];
  removals?: number[]; additions?: UsageAddition[];
}
export type UsageIntent = Omit<UsageChange, 'revision' | 'operation_id'>;
