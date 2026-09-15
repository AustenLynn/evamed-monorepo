import * as XLSX from 'xlsx';

// The to-do-file screen reads an upload with FileReader.readAsArrayBuffer and
// passes the ArrayBuffer to XLSX.read with { type: 'binary' }, then calls
// sheet_to_json with { raw: true, defval: null }. Pin that exact call shape so
// a SheetJS upgrade can't silently break the upload.
describe('SheetJS as the to-do-file screen uses it', () => {
  it('parses an ArrayBuffer passed as type "binary"', () => {
    const sheet = XLSX.utils.aoa_to_sheet([['material', 'cantidad'], ['Concreto', 12], ['Acero', null]]),
      book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Materiales');

    const bytes: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' }),
      wb = XLSX.read(bytes, { type: 'binary' }),
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: true, defval: null });

    expect(wb.SheetNames).toEqual(['Materiales']);
    expect(rows).toEqual([
      { material: 'Concreto', cantidad: 12 },
      { material: 'Acero', cantidad: null },
    ]);
  });
});
