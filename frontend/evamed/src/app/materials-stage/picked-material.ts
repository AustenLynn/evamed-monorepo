import { PickedMaterial, PickerInitial } from '../explorer/picker.models';

// The API rejects a blank description ("Este campo no puede estar en blanco");
// empty comments must go as null, or the row is refused (R-37).
const comments = (text: string): string | null => text.trim() || null,
  numberOrNull = (value: unknown): number | null => {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

/**
 * A material chosen in the explorer, as a row of the new-project page's
 * imported Excel (listData). saveStepOne matches it to the catalogue through
 * materialSelectedDB, so the commercial name can differ from the catalogue's.
 */
export const toExcelRow = (picked: PickedMaterial, system: string, origin: string): Record<string, unknown> => {
  const blank = (value: number | null) => (value === null ? '' : value);
  return {
    Material: picked.comercialName,
    name_material_db: picked.material.name,
    materialSelectedDB: picked.material.name,
    materialDB: { name_material: picked.material.name },
    'Base de datos': picked.material.source,
    Cantidad: picked.quantity,
    Unidad: picked.material.unit,
    'Descripción de Material': comments(picked.comments),
    'Administrador EPDs': '-',
    'Objetivo Geográfico': '-',
    Origen: origin,
    Sistema_constructivo: system,
    // The keys saveStepOne reads (the old dialog's transport fields never reached it).
    transporte_1: blank(picked.transportOrigin),
    distancia_1: blank(picked.distanceOrigin),
    transporte_2: blank(picked.transportEnd),
    distancia_2: blank(picked.distanceEnd),
    reemplazos: picked.replaces,
    vidaUtil: picked.lifeYears,
  };
};

/** Origin "Usuario": a material the user added by hand (R-02). */
export const USER_ORIGIN = 3;

/** A material chosen in the explorer, as a new MaterialSchemeProject row of an existing project. */
export const toSchemeProject = (
  picked: PickedMaterial,
  where: { projectId: number; sectionId: number; system: string; originId?: number }
): Record<string, unknown> => ({
  comercial_name: picked.comercialName,
  construction_system: where.system,
  provider_distance: 0,
  quantity: picked.quantity,
  value: null,
  distance_init: picked.distanceOrigin ?? 0,
  distance_end: picked.distanceEnd ?? 0,
  replaces: picked.replaces,
  unit_text: picked.material.unit,
  description_material: comments(picked.comments),
  material_id: picked.material.id,
  project_id: where.projectId,
  origin_id: where.originId ?? USER_ORIGIN,
  section_id: where.sectionId,
  // As "Duplicar" writes them for rows without a city.
  state_id_origin: 1,
  city_id_origin: 2,
  city_id_end: 1,
  transport_id_origin: picked.transportOrigin,
  transport_id_end: picked.transportEnd,
});

/** A row of the new-project page's Excel, as the edit form's starting values. */
export const fromExcelRow = (row: Record<string, any>): PickerInitial => ({
  comercialName: String(row['Material'] ?? ''),
  quantity: numberOrNull(row['Cantidad']),
  comments: row['Descripción de Material'] && row['Descripción de Material'] !== '-' ? String(row['Descripción de Material']) : '',
  transportOrigin: numberOrNull(row['transporte_1']),
  distanceOrigin: numberOrNull(row['distancia_1']),
  transportEnd: numberOrNull(row['transporte_2']),
  distanceEnd: numberOrNull(row['distancia_2']),
  replaces: numberOrNull(row['reemplazos']),
  rowUnit: row['Unidad'] ? String(row['Unidad']) : null,
});

/** A saved project row, as the existing-project page lists it, as the edit form's starting values. */
export const fromSchemeRow = (row: Record<string, any>): PickerInitial => ({
  comercialName: String(row['comercial_name'] ?? ''),
  quantity: numberOrNull(row['quantity']),
  comments: row['description_material'] && row['description_material'] !== '-' ? String(row['description_material']) : '',
  transportOrigin: numberOrNull(row['transporte_1']),
  distanceOrigin: numberOrNull(row['distancia_1']),
  transportEnd: numberOrNull(row['transporte_2']),
  distanceEnd: numberOrNull(row['distancia_2']),
  replaces: numberOrNull(row['reemplazos']),
  rowUnit: row['unit_text'] ? String(row['unit_text']) : null,
});
