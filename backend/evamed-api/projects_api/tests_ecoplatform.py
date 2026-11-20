"""ECO Platform (ECO Portal) EPD import (EN 15804+A2 design, 2026-11-20). Synthetic ILCD only:
the downloaded EPD files are licensed and never committed."""
import json
import tempfile
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings

from projects_api import methods, models
from projects_api.ecoplatform import ilcd

UUIDS = {
    'GWP-total': 'a7ea142a-9749-11ed-a8fc-0242ac120002', 'GWP-fossil': 'a7ea19c0-9749-11ed-a8fc-0242ac120002',
    'GWP-biogenic': 'a7ea186c-9749-11ed-a8fc-0242ac120002', 'GWP-luluc': 'a7ea1ae2-9749-11ed-a8fc-0242ac120002',
    'ODP': 'b5c629d6-def3-11e6-bf01-fe55135034f3', 'AP': 'b5c611c6-def3-11e6-bf01-fe55135034f3',
    'EP-freshwater': 'b53ec18f-7377-4ad3-86eb-cc3f4f276b2b', 'EP-marine': 'b5c619fa-def3-11e6-bf01-fe55135034f3',
    'EP-terrestrial': 'b5c614d2-def3-11e6-bf01-fe55135034f3', 'POCP': 'b5c610fe-def3-11e6-bf01-fe55135034f3',
    'ADPE': 'b2ad6494-c78d-11e6-9d9d-cec0c932ce01', 'ADPF': 'b2ad6110-c78d-11e6-9d9d-cec0c932ce01',
    'WDP': 'b2ad66ce-c78d-11e6-9d9d-cec0c932ce01',
}
LABELS = {'GWP-total': 'Global Warming Potential - total (GWP-total)',
          'GWP-fossil': 'Global Warming Potential - fossil fuels (GWP-fossil)',
          'GWP-biogenic': 'Global Warming Potential - biogenic (GWP-biogenic)',
          'GWP-luluc': 'Global Warming Potential - land use and land use change (GWP-luluc)'}
EPD_UUID = '11111111-2222-3333-4444-555555555555'
RA_UUID = '5e09bd06-11a1-4292-a56b-47898ad6a691'


def epd(uuid=EPD_UUID, name='CPC 40 Cement', values=None, modules=('A1-A3',), amount=1000, unit='kg',
        flag=True, props=None, compliance='EN 15804+A2 (EF 3.1)', density=None):
    results = []
    for short, method_uuid in UUIDS.items():
        value = (values or {}).get(short, 1)
        anies = [{'module': m, 'value': value if isinstance(value, str) else str(value)} for m in modules]
        results.append({'referenceToLCIAMethodDataSet': {
            'refObjectId': method_uuid, 'shortDescription': [{'value': LABELS.get(short, short), 'lang': 'en'}]},
            'other': {'anies': anies}})
    if props is None:
        props = [{'name': [{'value': {'kg': 'Mass', 'm2': 'Area', 'm3': 'Volume', 'm': 'Length', 'pcs.': 'Number'}[unit]}],
                  'meanValue': amount, 'referenceUnit': unit if flag else None, 'referenceFlowProperty': flag or None}]
    exchange = {'referenceFlow': True, 'meanAmount': 1, 'resultingflowAmount': amount, 'flowProperties': props}
    if density:
        exchange['materialProperties'] = [{'name': 'gross density', 'value': str(density), 'unit': 'kg/m^3'}]
    return {
        'processInformation': {
            'dataSetInformation': {'UUID': uuid, 'name': {'baseName': [{'value': name, 'lang': 'en'}]}},
            'geography': {'locationOfOperationSupplyOrProduction': {'location': 'MX'}},
            'technology': {'technologyDescriptionAndIncludedProcesses': [{'value': 'Cemento compuesto.', 'lang': 'en'}]},
        },
        'administrativeInformation': {'publicationAndOwnership': {
            'dataSetVersion': '07.01.002',
            'referenceToRegistrationAuthority': {'refObjectId': RA_UUID},
            'referenceToOwnershipOfDataSet': {'shortDescription': [{'value': 'Cooperativa La Cruz Azul'}]},
        }},
        'modellingAndValidation': {'complianceDeclarations': {'compliance': [
            {'referenceToComplianceSystem': {'shortDescription': [{'value': compliance}]}}]}},
        'exchanges': {'exchange': [exchange]},
        'LCIAResults': {'LCIAResult': results},
    }


class ParseTests(SimpleTestCase):
    def test_parse_aggregate_values(self):
        record = ilcd.parse(epd(values={'GWP-total': 377}))
        self.assertEqual(record.uuid, EPD_UUID)
        self.assertEqual(record.reg_authority, RA_UUID)
        self.assertEqual(record.owner, 'Cooperativa La Cruz Azul')
        self.assertEqual(record.geo, 'MX')
        self.assertEqual(record.version, '07.01.002')
        self.assertEqual(record.values[('GWP-total', 'A1-A3')], 377.0)
        self.assertEqual(len([k for k in record.values if k[1] == 'A1-A3']), 13)

    def test_parse_split_modules(self):
        record = ilcd.parse(epd(modules=('A1', 'A2', 'A3')))
        self.assertEqual(record.values[('ODP', 'A2')], 1.0)
        self.assertNotIn(('ODP', 'A1-A3'), record.values)

    def test_partial_split_is_dropped_when_a1_a3_is_complete(self):
        # Review finding 7: a stored partial A1/A2/A3 split would make the material read as split and incomplete.
        doc = epd()
        for result in doc['LCIAResults']['LCIAResult'][:3]:
            result['other']['anies'] += [{'module': 'A1', 'value': '0.5'}, {'module': 'A2', 'value': '0.2'},
                                        {'module': 'A3', 'value': '0.3'}]
        record = ilcd.parse(doc)
        self.assertEqual({module for _short, module in record.values}, {'A1-A3'})

    def test_nd_not_stored(self):
        record = ilcd.parse(epd(values={'WDP': 'ND'}))
        self.assertNotIn(('WDP', 'A1-A3'), record.values)

    def test_gwp_subindicators_follow_their_label(self):
        doc = epd(values={'GWP-fossil': 300, 'GWP-biogenic': 3})
        # A publisher that attached the two UUIDs the other way round, labels intact.
        for result in doc['LCIAResults']['LCIAResult']:
            ref = result['referenceToLCIAMethodDataSet']
            if ref['refObjectId'] == UUIDS['GWP-fossil']:
                ref['refObjectId'] = UUIDS['GWP-biogenic']
            elif ref['refObjectId'] == UUIDS['GWP-biogenic']:
                ref['refObjectId'] = UUIDS['GWP-fossil']
        record = ilcd.parse(doc)
        self.assertEqual(record.values[('GWP-fossil', 'A1-A3')], 300.0)
        self.assertEqual(record.values[('GWP-biogenic', 'A1-A3')], 3.0)

    def test_unit_tonne(self):
        record = ilcd.parse(epd(amount=1000, unit='kg'))
        self.assertEqual((record.unit, record.unit_inferred, record.scale), ('Ton', False, 1.0))
        self.assertEqual(record.mass_tonnes, 1.0)

    def test_unit_kg_and_other_amounts(self):
        self.assertEqual(ilcd.parse(epd(amount=1, unit='kg')).unit, 'Kg')
        record = ilcd.parse(epd(amount=10, unit='m2'))
        self.assertEqual((record.unit, record.scale), ('m²', 0.1))

    def test_inferred_area_and_mass(self):
        props = [{'name': [{'value': 'Area'}], 'meanValue': 1}, {'name': [{'value': 'Mass'}], 'meanValue': 8.9}]
        record = ilcd.parse(epd(props=props))
        self.assertEqual((record.unit, record.unit_inferred), ('m²', True))
        self.assertAlmostEqual(record.mass_tonnes, 0.0089)

    def test_inferred_unnamed_thousand_is_tonne(self):
        record = ilcd.parse(epd(props=[{'name': [{'lang': 'no'}], 'meanValue': 1000}]))
        self.assertEqual((record.unit, record.unit_inferred), ('Ton', True))

    def test_inferred_unflagged_mass_of_a_tonne(self):
        props = [{'name': [{'lang': 'no', 'value': 'Innhold av biogent karbon i produkt'}], 'meanValue': 0},
                 {'name': [{'lang': 'en', 'value': 'Mass'}], 'meanValue': 1000, 'referenceFlowProperty': True}]
        record = ilcd.parse(epd(props=props))
        self.assertEqual((record.unit, record.unit_inferred, record.scale), ('Ton', True, 1.0))

    def test_inferred_mass_uses_the_declared_amount(self):
        doc = epd(values={'GWP-total': 2305}, props=[{'name': [{'value': 'Mass'}], 'meanValue': 1}])
        doc['exchanges']['exchange'][0]['resultingflowAmount'] = 1000
        record = ilcd.parse(doc)
        self.assertEqual((record.unit, record.scale), ('Ton', 1.0))
        self.assertEqual(record.values[('GWP-total', 'A1-A3')], 2305.0)

    def test_placeholder_mass_of_one_kg_is_ignored(self):
        props = [{'name': [{'value': 'Volume'}], 'meanValue': 1}, {'name': [{'value': 'Mass'}], 'meanValue': 1}]
        record = ilcd.parse(epd(props=props))
        self.assertEqual(record.unit, 'm³')
        self.assertIsNone(record.mass_tonnes)

    def test_mass_from_density(self):
        record = ilcd.parse(epd(amount=1, unit='m3', density=2400))
        self.assertEqual(record.unit, 'm³')
        self.assertAlmostEqual(record.mass_tonnes, 2.4)

    def test_no_mass_for_pieces(self):
        record = ilcd.parse(epd(amount=1, unit='pcs.'))
        self.assertEqual(record.unit, 'Pz')
        self.assertIsNone(record.mass_tonnes)

    def test_skip_reasons(self):
        self.assertEqual(ilcd.skip_reason(ilcd.parse(epd(name='Steel Slang'))), 'excluded by owner')
        self.assertEqual(ilcd.skip_reason(ilcd.parse(epd(compliance='DIN EN 15804'))), 'not EN 15804+A2')
        self.assertIsNone(ilcd.skip_reason(ilcd.parse(epd())))


@override_settings(EVAMED_IMPACT_METHOD='EN15804+A2')
class ImportCommandTests(TestCase):
    def setUp(self):
        models.Standard.objects.get_or_create(id=1, defaults={'name_standard': 'A1-A3'})
        for pk, name in ((2, 'A1'), (3, 'A2'), (4, 'A3')):
            models.Standard.objects.get_or_create(id=pk, defaults={'name_standard': name})
        for name in ('Ton', 'Kg', 'm²', 'm³', 'm', 'Pz'):
            models.Unit.objects.get_or_create(name_unit=name)
        self.dir = Path(tempfile.mkdtemp())
        (self.dir / f'{EPD_UUID}.json').write_text(json.dumps(epd(values={'GWP-total': 377})))
        (self.dir / 'slag.json').write_text(json.dumps(epd(uuid='99999999-2222-3333-4444-555555555555',
                                                           name='Steel Slang')))
        self.families = self.dir / 'families.json'
        self.families.write_text(json.dumps({EPD_UUID: 'Cemento'}))

    def _run(self, *extra):
        out = StringIO()
        call_command('ecoplatform_import', '--dir', str(self.dir), '--families', str(self.families), *extra, stdout=out)
        return out.getvalue()

    def test_dry_run_writes_nothing(self):
        output = self._run()
        self.assertFalse(models.Material.objects.filter(provider_code='eco_platform').exists())
        self.assertIn('1 to import', output)
        self.assertIn('Steel Slang', output)

    def test_imported_rows_are_eco_and_current(self):
        self._run('--apply')
        material = models.Material.objects.get(eco_epd_uuid=EPD_UUID)
        self.assertEqual(material.name_material, 'Cemento_CPC 40 Cement marca Cooperativa La Cruz Azul_MX')
        self.assertEqual(material.provider_code, 'eco_platform')
        self.assertEqual(material.database_from, 'ECO Platform')
        self.assertEqual(material.unit_id.name_unit, 'Ton')
        self.assertIn('https://portal.eco-platform.org/epds/%s/%s' % (RA_UUID, EPD_UUID), material.description)
        self.assertIn(material.id, methods.current_material_ids())
        self.assertEqual(float(models.Conversions.objects.get(material_id=material).value), 1.0)

    def test_apply_reports_how_many_are_current(self):
        self.assertIn('1 of 1 imported materials have every A2 indicator', self._run('--apply'))

    def test_import_idempotent(self):
        self._run('--apply')
        (self.dir / f'{EPD_UUID}.json').write_text(json.dumps(epd(values={'GWP-total': 400})))
        self._run('--apply')
        self.assertEqual(models.Material.objects.filter(eco_epd_uuid=EPD_UUID).count(), 1)
        gwp = models.PotentialType.objects.get(method='EN15804+A2', name_potential_type='GWP-total')
        row = models.MaterialSchemeData.objects.get(material_id__eco_epd_uuid=EPD_UUID, potential_type_id=gwp)
        self.assertEqual(float(row.value), 400.0)
        self.assertEqual(models.MaterialSchemeData.objects.filter(material_id__eco_epd_uuid=EPD_UUID).count(), 13)

    def test_missing_family_is_refused(self):
        self.families.write_text('{}')
        output = self._run()
        self.assertIn('no family', output)

    @override_settings(EVAMED_IMPACT_METHOD='CML')
    def test_apply_reports_a2_coverage_while_cml_is_active(self):
        # Rollout imports while the site still serves CML.
        self.assertIn('1 of 1 imported materials have every A2 indicator', self._run('--apply'))
