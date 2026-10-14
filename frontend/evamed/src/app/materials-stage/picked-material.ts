import { PickedMaterial } from '../explorer/picker.models';

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
    'Descripción de Material': picked.comments,
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
  where: { projectId: number; sectionId: number; system: string }
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
  description_material: picked.comments,
  material_id: picked.material.id,
  project_id: where.projectId,
  origin_id: USER_ORIGIN,
  section_id: where.sectionId,
  // As "Duplicar" writes them for rows without a city.
  state_id_origin: 1,
  city_id_origin: 2,
  city_id_end: 1,
  transport_id_origin: picked.transportOrigin,
  transport_id_end: picked.transportEnd,
});
