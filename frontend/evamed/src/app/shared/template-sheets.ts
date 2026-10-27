import { BUILDING_SECTIONS } from './building-sections';

/** An uploaded EVAMED workbook as sessionStorage['dataProject'] holds it: one row array per sheet. */
export interface TemplateUpload {
  sheetNames: string[];
  data: Record<string, unknown>[][];
}

// The templates' own sheets, not building elements.
const HELPER_SHEETS = ['murosinterioresbis', 'inicio', 'registro', 'listaelementos', 'bd', 'parametros'],
  // 'Muros Interiores', 'muros interiores' and 'Inst especiales' name the same sheet.
  sheetKey = (name: unknown): string =>
    String(name ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''),
  SECTION_KEYS = BUILDING_SECTIONS.map(sheetKey),
  // The Mac template repeats its header row under the real one.
  isHeaderRow = (row: Record<string, unknown>): boolean =>
    row?.['Material'] === 'Material' && row?.['Sistema_constructivo'] === 'Sistema_constructivo',
  hasMaterial = (row: Record<string, unknown>): boolean =>
    row?.['Material'] !== null && row?.['Material'] !== undefined && String(row['Material']).trim() !== '';

/**
 * The upload's rows by building section, in section_id order, matched by sheet
 * name: the Windows template lacks the Mac one's hidden first sheet, so a
 * sheet's position doesn't say which section it is. Safe to apply twice.
 * `unknownSheets` lists sheets with materials that match no section;
 * `sectionSheets` counts the sheets that do match one.
 */
export function bySection(
  upload: TemplateUpload
): TemplateUpload & { unknownSheets: string[]; sectionSheets: number } {
  const data: Record<string, unknown>[][] = BUILDING_SECTIONS.map(() => []),
    unknownSheets: string[] = [];
  let sectionSheets = 0;
  upload.sheetNames.forEach((name, index) => {
    const rows = (upload.data[index] ?? []).filter(row => !isHeaderRow(row)),
      section = SECTION_KEYS.indexOf(sheetKey(name));
    if (section >= 0) {
      data[section] = data[section].concat(rows);
      sectionSheets++;
    } else if (!HELPER_SHEETS.includes(sheetKey(name)) && rows.some(hasMaterial)) {
      unknownSheets.push(name);
    }
  });
  return { sheetNames: [...BUILDING_SECTIONS], data, unknownSheets, sectionSheets };
}
