/**
 * EN 15804+A2 rules shared by the browser calculations (Comparar) and ProjectResultsView
 * (projects_api/views.py, design 2026-11-20). Owner-approved change to calculos/* (2026-11-20).
 *
 * Under CML (no 'GWP-total' among the served indicators) every rule is off and the
 * calculations behave exactly as before.
 */
const A2_MARKER = 'GWP-total',
 BIOGENIC_RELEASE = new Set(['GWP-biogenic', 'GWP-total']),
 AGGREGATE = 1,
 SPLIT = [2, 3, 4],
 UNIT_TONNES: Record<string, number> = { Kg: 0.001, kg: 0.001, Ton: 1 };

export interface A2Inputs {
  potentialTypesList: any[];
  materialSchemeDataList: any[];
  materialList: any[];
  conversionList: any[];
}

export interface A2Rules {
  active: boolean;
  /** Whether a material counts toward the results. */
  counts(materialId: number): boolean;
  /** Tonnes per unit for A4 transport; 0 means its transport is left out. */
  tonnes(materialId: number): number;
  /** Biogenic CO2 released at end of life for these rows (original + replacements). */
  biogenicRelease(rows: { material_id: number; quantity: number; replaces?: number | null }[]): number;
  /** Whether an indicator receives the end-of-life biogenic release. */
  releasesInto(potentialTypeId: number): boolean;
}

export function buildA2Rules(info: A2Inputs): A2Rules {
  const types = info.potentialTypesList ?? [],
   active = types.some(t => t['name_potential_type'] === A2_MARKER),
   conversions = new Map<number, number>();
  (info.conversionList ?? []).forEach(c => {
    if (!conversions.has(c['material_id'])) conversions.set(c['material_id'], Number(c['value']));
  });
  if (!active) {
    return {
      active,
      counts: () => true,
      tonnes: id => conversions.get(id) ?? 1,
      biogenicRelease: () => 0,
      releasesInto: () => false,
    };
  }

  const typeIds = types.map(t => t['id']),
   biogenicId = types.find(t => t['name_potential_type'] === 'GWP-biogenic')?.['id'],
   releaseIds = new Set(types.filter(t => BIOGENIC_RELEASE.has(t['name_potential_type'])).map(t => t['id'])),
   standards = new Map<number, Set<number>>(),
   values = new Map<string, number>();
  (info.materialSchemeDataList ?? []).forEach(row => {
    const id = row['material_id'];
    if (!standards.has(id)) standards.set(id, new Set());
    standards.get(id)!.add(row['standard_id']);
    if (row['value'] !== null && row['value'] !== undefined && typeIds.includes(row['potential_type_id'])) {
      const key = `${id}|${row['standard_id']}|${row['potential_type_id']}`;
      values.set(key, (values.get(key) ?? 0) + Number(row['value']));
    }
  });
  const isSplit = (id: number) => SPLIT.some(s => standards.get(id)?.has(s)),
   has = (id: number, standard: number, type: number) => values.has(`${id}|${standard}|${type}`),
   current = new Map<number, boolean>(),
   counts = (id: number) => {
    if (!current.has(id)) {
      current.set(id, typeIds.every(type => isSplit(id)
        ? SPLIT.every(s => has(id, s, type))
        : has(id, AGGREGATE, type)));
    }
    return current.get(id)!;
  },
   unitOf = new Map<number, string>((info.materialList ?? []).map(m => [m['id'], m['unit_name']])),
   a1a3 = (id: number, type: number) => isSplit(id)
    ? SPLIT.reduce((sum, s) => sum + (values.get(`${id}|${s}|${type}`) ?? 0), 0)
    : values.get(`${id}|${AGGREGATE}|${type}`) ?? 0;

  return {
    active,
    counts,
    tonnes: id => conversions.get(id) ?? UNIT_TONNES[unitOf.get(id) ?? ''] ?? 0,
    biogenicRelease: rows => biogenicId === undefined ? 0 : rows.reduce((total, row) => {
      if (!counts(row.material_id)) return total;
      const uptake = a1a3(row.material_id, biogenicId) * Number(row.quantity ?? 0) * (1 + Number(row.replaces ?? 0));
      return uptake < 0 ? total - uptake : total;
    }, 0),
    releasesInto: id => releaseIds.has(id),
  };
}
