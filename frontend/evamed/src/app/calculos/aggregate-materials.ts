/**
 * Identifies materials whose impact data only exists as a combined A1-A3 value.
 *
 * Some source databases publish a per-module A1/A2/A3 split (EPDs, mexicaniuh);
 * others publish only a combined cradle-to-gate value (EPiC, ECOINVENT 3 —
 * ecoinvent 'Cut-off, S' system processes structurally cannot be decomposed).
 *
 * Deciding per material from the data it actually has, rather than from a
 * hardcoded database name, keeps this correct when a new source is added.
 * Mirrors `_aggregate_material_ids` in backend `projects_api/views.py`.
 */

export const AGGREGATE_STANDARD = 1;          // A1-A3
export const PRODUCTION_STAGES = [2, 3, 4];   // A1, A2, A3

export function buildAggregateMaterialSet(
  materialSchemeDataList: any[]
): Set<number> {
  const stagesByMaterial = new Map<number, Set<number>>();

  (materialSchemeDataList || []).forEach(msd => {
    const materialId = msd['material_id'];
    if (!stagesByMaterial.has(materialId)) {
      stagesByMaterial.set(materialId, new Set<number>());
    }
    stagesByMaterial.get(materialId).add(Number(msd['standard_id']));
  });

  const aggregateMaterials = new Set<number>();
  stagesByMaterial.forEach((stages, materialId) => {
    const hasAggregate = stages.has(AGGREGATE_STANDARD);
    const hasSplit = PRODUCTION_STAGES.some(stage => stages.has(stage));
    if (hasAggregate && !hasSplit) {
      aggregateMaterials.add(materialId);
    }
  });

  return aggregateMaterials;
}
