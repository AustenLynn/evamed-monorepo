"""Excel templates that carry the current catalogue (docs/superpowers/specs/2026-10-27-excel-template-catalogue-design.md)."""
import io
import re
import zipfile
from datetime import datetime, timezone
from xml.dom import minidom

from django.test import SimpleTestCase

from projects_api.excel_templates import build
from projects_api.excel_templates.build import CatalogueRow, TooManyMaterials, build_template

KINDS = ('windows', 'mac')
BUILT_AT = datetime(2026, 10, 27, 20, tzinfo=timezone.utc)
MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'


def row(material, **fields):
    values = dict(base='EPiC', categoria='Cat', tipo='', material=material, unidad='kg',
                  administrador='', region='-', descripcion='')
    values.update(fields)
    return CatalogueRow(**values)


def rows(n=3):
    return [row('Material %d' % i) for i in range(n)]


def parts(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return {name: z.read(name) for name in z.namelist()}


def template_parts(kind):
    with zipfile.ZipFile(build.TEMPLATE_DIR / build.TEMPLATES[kind][0]) as z:
        return {name: z.read(name) for name in z.namelist()}


def bd_name(kind):
    return {'windows': 'xl/worksheets/sheet15.xml', 'mac': 'xl/worksheets/sheet16.xml'}[kind]


def cell(xml, ref):
    m = re.search(r'<c r="%s"(?: [^>]*?)?(?:/>|>.*?</c>)' % ref, xml)
    return m.group(0) if m else None


class BuildTemplateTests(SimpleTestCase):

    def built(self, kind, catalogue=None):
        catalogue = rows() if catalogue is None else catalogue
        out = parts(build_template(kind, catalogue, BUILT_AT))
        return out, out[bd_name(kind)].decode('utf-8')

    def test_every_xml_part_is_well_formed(self):
        for kind in KINDS:
            with self.subTest(kind=kind):
                out, _ = self.built(kind)
                for name, data in out.items():
                    if name.endswith(('.xml', '.rels')):
                        minidom.parseString(data)

    def test_other_parts_unchanged(self):
        for kind in KINDS:
            with self.subTest(kind=kind):
                out, _ = self.built(kind)
                original = template_parts(kind)
                for name, data in original.items():
                    if name == bd_name(kind) or not (
                            name == 'xl/vbaProject.bin' or name == 'xl/styles.xml'
                            or name.startswith('xl/activeX/') or name.startswith('xl/worksheets/sheet')):
                        continue
                    self.assertEqual(out[name], data, name)

    def test_rows_written(self):
        for kind in KINDS:
            with self.subTest(kind=kind):
                catalogue = rows(3)
                _, xml = self.built(kind, catalogue)
                for r in (6, 7, 8):
                    self.assertIn('<row r="%d"' % r, xml)
                self.assertNotIn('<row r="9"', xml)
                self.assertRegex(xml, r'<c r="E7"[^>]*t="inlineStr"[^>]*><is><t[^>]*>Material 1</t></is></c>')
                self.assertIn('<f>BaseDatos[[#This Row],[Material]]</f>', cell(xml, 'A8'))
                self.assertIn('<f>--ISNUMBER(IFERROR(SEARCH($AH$2,BaseDatos[[#This Row],[Material]],1),""))</f>',
                              cell(xml, 'AF8'))
                self.assertIn('<f>IF(AF8=1,COUNTIF($AF$6:AF8,1),"")</f>', cell(xml, 'AG8'))
                self.assertIn('<f>IFERROR(INDEX(BaseDatos[Material],MATCH(ROWS($AG$6:AG8),BaseDatos[Aux2],0)),"")</f>',
                              cell(xml, 'AH8'))
                self.assertNotIn('<v>', cell(xml, 'AH8'))

    def test_escapes_text(self):
        name = 'Block 15×20×40 & mortero <"x">'
        for kind in KINDS:
            with self.subTest(kind=kind):
                _, xml = self.built(kind, [row(name)])
                dom = minidom.parseString(xml.encode('utf-8'))
                e6 = [c for c in dom.getElementsByTagName('c') if c.getAttribute('r') == 'E6'][0]
                text = e6.getElementsByTagName('t')[0].firstChild.data
                self.assertEqual(text, name)

    def test_characters_xml_cannot_hold_are_dropped(self):
        for kind in KINDS:
            with self.subTest(kind=kind):
                _, xml = self.built(kind, [row('a\x0bb\x01\x1f')])
                dom = minidom.parseString(xml.encode('utf-8'))
                e6 = [c for c in dom.getElementsByTagName('c') if c.getAttribute('r') == 'E6'][0]
                self.assertEqual(e6.getElementsByTagName('t')[0].firstChild.data, 'ab')

    def test_text_is_cut_to_the_cell_limit(self):
        for kind in KINDS:
            with self.subTest(kind=kind):
                _, xml = self.built(kind, [row('m', descripcion='x' * 40000)])
                dom = minidom.parseString(xml.encode('utf-8'))
                m6 = [c for c in dom.getElementsByTagName('c') if c.getAttribute('r') == 'M6'][0]
                self.assertEqual(len(m6.getElementsByTagName('t')[0].firstChild.data), 32767)

    def test_table_ref_matches(self):
        for kind in KINDS:
            with self.subTest(kind=kind):
                out, _ = self.built(kind)
                table = out['xl/tables/table2.xml'].decode('utf-8')
                self.assertIn('name="BaseDatos"', table)
                self.assertRegex(table, r'<table [^>]*\bref="A5:AH8"')
                self.assertIn('<autoFilter ref="A5:AH8"', table)

    def test_mac_spill_ref(self):
        out, xml = self.built('mac')
        aj6 = cell(xml, 'AJ6')
        self.assertIn('ref="AJ6:AJ8"', aj6)
        self.assertIn('_xlfn._xlws.FILTER(BaseDatos[Material],ISNUMBER(SEARCH(AJ4,BaseDatos[Material])))', aj6)
        self.assertIsNone(cell(xml, 'AJ7'))
        self.assertIn('<dimension ref="A1:AJ8"/>', xml)

    def test_search_cells_cleared(self):
        for kind, refs in (('windows', ['AH2']), ('mac', ['AH2', 'AJ4'])):
            with self.subTest(kind=kind):
                _, xml = self.built(kind)
                for ref in refs:
                    c = cell(xml, ref)
                    self.assertIsNotNone(c, ref)
                    self.assertNotIn('<v>', c)
                    self.assertNotIn('<is>', c)

    def test_recalc_on_open(self):
        for kind in KINDS:
            with self.subTest(kind=kind):
                out, _ = self.built(kind)
                self.assertIn(b'fullCalcOnLoad="1"', out['xl/workbook.xml'])
                self.assertNotIn('xl/calcChain.xml', out)
                self.assertNotIn(b'calcChain', out['xl/_rels/workbook.xml.rels'])
                self.assertNotIn(b'calcChain', out['[Content_Types].xml'])

    def test_marker(self):
        for kind in KINDS:
            with self.subTest(kind=kind):
                out, _ = self.built(kind)
                self.assertIn(
                    '<definedName name="EVAMED_CATALOGO">"2026-10-27T20:00:00Z"</definedName>',
                    out['xl/workbook.xml'].decode('utf-8'))

    def test_limit(self):
        with self.assertRaises(TooManyMaterials):
            build_template('windows', rows(993), BUILT_AT)
        build_template('windows', rows(992), BUILT_AT)
        build_template('mac', rows(996), BUILT_AT)
        with self.assertRaises(TooManyMaterials):
            build_template('mac', rows(997), BUILT_AT)

    def test_empty_catalogue_keeps_one_data_row(self):
        for kind in KINDS:
            with self.subTest(kind=kind):
                out, xml = self.built(kind, [])
                self.assertIn('<row r="6"', xml)
                self.assertNotIn('<row r="7"', xml)
                self.assertIn('ref="A5:AH6"', out['xl/tables/table2.xml'].decode('utf-8'))

    def test_unknown_kind(self):
        with self.assertRaises(KeyError):
            build_template('linux', [], BUILT_AT)
