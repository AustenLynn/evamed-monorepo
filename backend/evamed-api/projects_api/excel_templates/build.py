"""Build the EVAMED Excel templates with the current catalogue in the hidden BD sheet.

The .xlsm package is rewritten with zipfile: only the data rows of the BaseDatos table, its
refs and the workbook's recalculation settings change. Every other part is copied byte for byte
(macros, ActiveX controls, slicers and the other sheets must survive).
"""
import io
import re
import unicodedata
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple
from xml.sax.saxutils import escape

from projects_api import models
from projects_api.explorer.derive import category, region

TEMPLATE_DIR = Path(__file__).resolve().parent

# kind -> (file, most materials the template's Registro sheet can mirror)
TEMPLATES = {'windows': ('EVAMED_WINDOWS.xlsm', 992), 'mac': ('EVAMED_MAC.xlsm', 996)}

FIRST_ROW = 6
MARKER_NAME = 'EVAMED_CATALOGO'
CALC_CHAIN = 'xl/calcChain.xml'
MAX_CELL_CHARS = 32767  # Excel's limit for one cell
NOT_XML = re.compile('[^\t\n\r\u0020-\ud7ff\ue000-\ufffd\U00010000-\U0010ffff]')  # XML 1.0 forbids these

# BD column -> CatalogueRow field, for the columns that carry text
TEXT_COLUMNS = {'B': 'base', 'C': 'categoria', 'D': 'tipo', 'E': 'material', 'F': 'unidad',
                'K': 'administrador', 'L': 'region', 'M': 'descripcion'}

# Row-relative formulas ({r} is the row number)
FORMULAS = {
    'A': 'BaseDatos[[#This Row],[Material]]',
    'AF': '--ISNUMBER(IFERROR(SEARCH($AH$2,BaseDatos[[#This Row],[Material]],1),""))',
    'AG': 'IF(AF{r}=1,COUNTIF($AF$6:AF{r},1),"")',
    'AH': 'IFERROR(INDEX(BaseDatos[Material],MATCH(ROWS($AG$6:AG{r}),BaseDatos[Aux2],0)),"")',
}
STRING_FORMULAS = {'A', 'AH'}  # these return text, the others numbers or "" (no cached value anyway)


class CatalogueRow(NamedTuple):
    base: str
    categoria: str
    tipo: str
    material: str
    unidad: str
    administrador: str
    region: str
    descripcion: str


class TooManyMaterials(Exception):
    """The catalogue has more materials than the template's Registro sheet can list."""


def catalogue_rows() -> list:
    """Every material with a name, A to Z, as the template's catalogue rows."""
    materials = models.Material.objects.select_related('unit_id').exclude(name_material__isnull=True)
    named = [m for m in materials if m.name_material.strip()]
    named.sort(key=lambda m: _sort_key(m.name_material))
    return [CatalogueRow(
        base=m.database_from or '', categoria=category(m.name_material) or '', tipo='',
        material=m.name_material, unidad=(m.unit_id.name_unit if m.unit_id else '') or '',
        administrador='', region=region(m.name_material) or '-', descripcion=m.description or '')
        for m in named]


def _sort_key(name):
    """A to Z ignoring case and accents ('Ángulo' sorts with the As); ties keep a stable order."""
    plain = ''.join(c for c in unicodedata.normalize('NFD', name) if not unicodedata.combining(c))
    return plain.casefold(), name.casefold(), name


def build_template(kind: str, rows: list, built_at: datetime) -> bytes:
    """Return the template `kind` ('windows' or 'mac') with `rows` as its catalogue."""
    filename, limit = TEMPLATES[kind]
    if len(rows) > limit:
        raise TooManyMaterials('%d materials, the %s template holds %d' % (len(rows), kind, limit))
    with zipfile.ZipFile(TEMPLATE_DIR / filename) as source:
        items = source.infolist()
        files = {item.filename: source.read(item.filename) for item in items}

    last_row = FIRST_ROW + max(len(rows), 1) - 1
    sheet_name = _bd_sheet_part(files)
    table_name = _table_part(files)
    files[sheet_name] = _rewrite_sheet(files[sheet_name].decode('utf-8'), rows, last_row).encode('utf-8')
    table = files[table_name].decode('utf-8')
    table = re.sub(r'(<table [^>]*?\bref=")[^"]*"', r'\g<1>A5:AH%d"' % last_row, table, count=1)
    table = re.sub(r'(<autoFilter ref=")[^"]*"', r'\g<1>A5:AH%d"' % last_row, table, count=1)
    # The Mac template saves a filter on Base (EPiC); the catalogue has every base, so drop it.
    table = re.sub(r'<filterColumn\b[^>]*?/>|<filterColumn\b.*?</filterColumn>', '', table, flags=re.S)
    files[table_name] = table.encode('utf-8')
    files['xl/workbook.xml'] = _rewrite_workbook(files['xl/workbook.xml'].decode('utf-8'), built_at).encode('utf-8')
    files['xl/_rels/workbook.xml.rels'] = re.sub(
        r'<Relationship [^>]*Target="calcChain\.xml"[^>]*/>', '',
        files['xl/_rels/workbook.xml.rels'].decode('utf-8')).encode('utf-8')
    files['[Content_Types].xml'] = re.sub(
        r'<Override PartName="/xl/calcChain\.xml"[^>]*/>', '',
        files['[Content_Types].xml'].decode('utf-8')).encode('utf-8')
    del files[CALC_CHAIN]

    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as target:
        for item in items:
            if item.filename not in files:
                continue
            info = zipfile.ZipInfo(item.filename, item.date_time)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = item.external_attr
            target.writestr(info, files[item.filename])
    return out.getvalue()


def _bd_sheet_part(files):
    workbook = files['xl/workbook.xml'].decode('utf-8')
    rid = re.search(r'<sheet [^>]*name="BD"[^>]*r:id="([^"]+)"', workbook).group(1)
    rels = files['xl/_rels/workbook.xml.rels'].decode('utf-8')
    target = re.search(r'<Relationship [^>]*Id="%s"[^>]*/>' % rid, rels).group(0)
    return 'xl/' + re.search(r'Target="([^"]+)"', target).group(1).lstrip('/').removeprefix('xl/')


def _table_part(files):
    for name, data in files.items():
        if name.startswith('xl/tables/') and b' name="BaseDatos"' in data:
            return name
    raise ValueError('BaseDatos table not found')


def _rewrite_sheet(xml, rows, last_row):
    start = xml.index('<row r="%d"' % FIRST_ROW)
    end = xml.index('</sheetData>')
    row6 = xml[start:xml.index('</row>', start) + len('</row>')]
    head = re.match(r'<row r="%d"([^>]*)>' % FIRST_ROW, row6).group(1)
    styles = {m.group(1): m.group(2) or '' for m in
              re.finditer(r'<c r="([A-Z]+)%d"((?: s="\d+")?)' % FIRST_ROW, row6)}
    spill = re.search(r'<c r="AJ%d"[^>]*>.*?</c>' % FIRST_ROW, row6)
    if spill:  # Mac: the FILTER array formula spills over the whole table
        spill = re.sub(r'<v>.*?</v>|<v/>', '', spill.group(0))
        spill = re.sub(r'ref="AJ6:AJ\d+"', 'ref="AJ6:AJ%d"' % last_row, spill)

    data = ''.join(_row_xml(FIRST_ROW + i, head, styles, row, spill) for i, row in
                   enumerate(rows or [None]))
    xml = xml[:start] + data + xml[end:]
    last_col = 'AJ' if spill else 'AH'
    xml = re.sub(r'<dimension ref="[^"]*"/>', '<dimension ref="A1:%s%d"/>' % (last_col, last_row), xml, count=1)
    for ref in ('AH2', 'AJ4'):
        xml = re.sub(r'<c r="%s"((?: s="\d+")?)[^>]*?(?:/>|>.*?</c>)' % ref, r'<c r="%s"\1/>' % ref, xml, count=1)
    return xml


def _clean(text):
    """Drop characters XML cannot hold and cut to what a cell can, or Excel 'repairs' the file."""
    return NOT_XML.sub('', text)[:MAX_CELL_CHARS]


def _row_xml(r, head, styles, row, spill):
    cells = []
    for col, style in styles.items():
        ref = '%s%d' % (col, r)
        if col in FORMULAS:
            t = ' t="str"' if col in STRING_FORMULAS else ''
            cells.append('<c r="%s"%s%s><f>%s</f></c>' % (ref, style, t, escape(FORMULAS[col].format(r=r))))
        elif col in TEXT_COLUMNS:
            value = _clean(getattr(row, TEXT_COLUMNS[col])) if row else ''
            if value:
                cells.append('<c r="%s"%s t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>'
                             % (ref, style, escape(value)))
            else:
                cells.append('<c r="%s"%s/>' % (ref, style))
        elif col == 'AJ':
            continue  # the Mac spill formula is written once, on the first row
        else:
            cells.append('<c r="%s"%s/>' % (ref, style))
    if r == FIRST_ROW and spill:
        cells.append(spill)
    return '<row r="%d"%s>%s</row>' % (r, head, ''.join(cells))


def _rewrite_workbook(xml, built_at):
    """Recalculate on open, and mark the file with the time its catalogue was written."""
    if built_at.tzinfo is None:
        built_at = built_at.replace(tzinfo=timezone.utc)
    stamp = built_at.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    if 'fullCalcOnLoad' not in xml:
        xml = re.sub(r'<calcPr\b', '<calcPr fullCalcOnLoad="1"', xml, count=1)
    return xml.replace('</definedNames>',
                       '<definedName name="%s">"%s"</definedName></definedNames>' % (MARKER_NAME, stamp), 1)
