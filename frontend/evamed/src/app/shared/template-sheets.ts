import * as XLSX from 'xlsx';
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

/** The workbook name the server writes into each template it builds. */
export const TEMPLATE_MARKER = 'EVAMED_CATALOGO';

export function isGeneratedTemplate(wb: XLSX.WorkBook): boolean {
  return !!wb.Workbook?.Names?.some(name => name.Name === TEMPLATE_MARKER);
}

/** The materials the file's hidden BD sheet lists (column E under its header row). */
export function fileCatalogue(wb: XLSX.WorkBook): Set<string> {
  const sheet = wb.Sheets['BD'],
    materials = new Set<string>();
  if (!sheet) {
    return materials;
  }
  // Rows above the header hold other cells (search text), so find the header first.
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }),
    header = rows.findIndex(row => row?.[4] === 'Material');
  if (header < 0) {
    return materials;
  }
  rows.slice(header + 1).forEach(row => {
    const name = row?.[4];
    if (name !== null && name !== undefined && String(name).trim() !== '') {
      materials.add(String(name));
    }
  });
  return materials;
}

/**
 * The used names the file's own catalogue lists but the current one doesn't:
 * renamed or removed materials. Hand-typed names aren't in the file's list, so
 * they aren't reported. Distinct, in first-use order.
 */
export function outdatedMaterials(used: Iterable<string>, fileList: Set<string>, current: Set<string>): string[] {
  return [...new Set(used)].filter(name => fileList.has(name) && !current.has(name));
}
