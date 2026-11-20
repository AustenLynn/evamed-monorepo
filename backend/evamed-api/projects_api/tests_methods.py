"""The active impact method (EN 15804+A2 design, 2026-11-20)."""
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from projects_api import methods, models
from projects_api.testing import admin_user

A2_SHORT = [
    'GWP-total', 'GWP-fossil', 'GWP-biogenic', 'GWP-luluc', 'ODP', 'AP', 'EP-freshwater',
    'EP-marine', 'EP-terrestrial', 'POCP', 'ADPE', 'ADPF', 'WDP',
]


class IndicatorMethodTests(TestCase):
    def test_existing_types_are_cml(self):
        legacy = models.PotentialType.objects.create(name_potential_type='PCG 100',
                                                     name_complete_potential_type='Calentamiento Global')
        self.assertEqual(legacy.method, 'CML')

    def test_thirteen_a2_types_seeded(self):
        a2 = models.PotentialType.objects.filter(method='EN15804+A2')
        self.assertEqual(sorted(a2.values_list('name_potential_type', flat=True)), sorted(A2_SHORT))
        cml_names = set(models.PotentialType.objects.filter(method='CML')
                        .values_list('name_complete_potential_type', flat=True))
        self.assertFalse(cml_names & set(a2.values_list('name_complete_potential_type', flat=True)))

    def test_a2_units_exist(self):
        for short, _full, unit in methods.A2_INDICATORS:
            self.assertTrue(models.Unit.objects.filter(name_unit=unit).exists(), unit)

    def test_active_types_follow_setting(self):
        models.PotentialType.objects.create(name_potential_type='PCG 100')
        with override_settings(EVAMED_IMPACT_METHOD='CML'):
            self.assertEqual(methods.active_method(), 'CML')
            self.assertEqual({p.method for p in methods.active_potential_types()}, {'CML'})
        with override_settings(EVAMED_IMPACT_METHOD='EN15804+A2'):
            self.assertEqual(methods.active_potential_types().count(), 13)

    def test_gwp_total_type(self):
        models.PotentialType.objects.create(name_potential_type='PCG 100')
        with override_settings(EVAMED_IMPACT_METHOD='EN15804+A2'):
            self.assertEqual(methods.gwp_total_type().name_potential_type, 'GWP-total')
        with override_settings(EVAMED_IMPACT_METHOD='CML'):
            self.assertEqual(methods.gwp_total_type().name_potential_type, 'PCG 100')


class PotentialTypesEndpointTests(APITestCase):
    def setUp(self):
        models.PotentialType.objects.create(name_potential_type='PCG 100')

    @override_settings(EVAMED_IMPACT_METHOD='EN15804+A2')
    def test_potential_types_endpoint_filtered_for_users(self):
        names = {row['name_potential_type'] for row in self.client.get('/api-projects/potential-types/').json()}
        self.assertEqual(names, set(A2_SHORT))

    @override_settings(EVAMED_IMPACT_METHOD='EN15804+A2')
    def test_admin_sees_every_method(self):
        self.client.force_authenticate(admin_user())
        names = {row['name_potential_type'] for row in self.client.get('/api-projects/potential-types/').json()}
        self.assertIn('PCG 100', names)
        self.assertTrue(set(A2_SHORT) <= names)


def _std(pk, name):
    return models.Standard.objects.get_or_create(id=pk, defaults={'name_standard': name})[0]


@override_settings(EVAMED_IMPACT_METHOD='EN15804+A2')
class CurrentRuleTests(TestCase):
    def setUp(self):
        self.a1a3, self.a1, self.a2, self.a3 = _std(1, 'A1-A3'), _std(2, 'A1'), _std(3, 'A2'), _std(4, 'A3')
        self.a2_types = list(models.PotentialType.objects.filter(method='EN15804+A2'))
        self.cml = models.PotentialType.objects.create(name_potential_type='PCG 100')

    def _material(self, standards, skip=(), value=1):
        material = models.Material.objects.create(name_material='m')
        for standard in standards:
            for ptype in self.a2_types:
                if ptype.name_potential_type in skip:
                    continue
                models.MaterialSchemeData.objects.create(
                    material_id=material, standard_id=standard, potential_type_id=ptype, value=value)
        return material

    def test_all_thirteen_aggregate_is_current(self):
        material = self._material([self.a1a3])
        self.assertIn(material.id, methods.current_material_ids())

    def test_split_a1_a2_a3_is_current(self):
        material = self._material([self.a1, self.a2, self.a3])
        self.assertIn(material.id, methods.current_material_ids())

    def test_missing_one_indicator_is_not_current(self):
        material = self._material([self.a1a3], skip=('WDP',))
        self.assertNotIn(material.id, methods.current_material_ids())
        self.assertEqual(methods.missing_indicators(material.id), ['WDP'])

    def test_split_missing_one_module_is_not_current(self):
        material = self._material([self.a1, self.a2])
        self.assertNotIn(material.id, methods.current_material_ids())

    def test_null_value_counts_as_missing(self):
        material = self._material([self.a1a3], value=None)
        self.assertNotIn(material.id, methods.current_material_ids())

    def test_cml_values_do_not_make_a2_current(self):
        material = models.Material.objects.create(name_material='old')
        models.MaterialSchemeData.objects.create(
            material_id=material, standard_id=self.a1a3, potential_type_id=self.cml, value=1)
        self.assertNotIn(material.id, methods.current_material_ids())
        self.assertEqual(len(methods.missing_indicators(material.id)), 13)

    def test_current_ids_restricted_to_queryset(self):
        kept, other = self._material([self.a1a3]), self._material([self.a1a3])
        self.assertEqual(methods.current_material_ids(models.Material.objects.filter(id=kept.id)), {kept.id})
        self.assertIn(other.id, methods.current_material_ids())

    def test_current_ids_query_count(self):
        for _ in range(50):
            self._material([self.a1a3])
        with self.assertNumQueries(2):
            methods.current_material_ids()

    def test_transport_energy_source_rules(self):
        cases = [
            (models.Transport, 'name_transport', models.PotentialTransport, 'transport_id', methods.current_transport_ids),
            (models.TypeEnergy, 'name_type_energy', models.TypeEnergyData, 'type_energy_id', methods.current_energy_ids),
            (models.SourceInformation, 'name_source_information', models.SourceInformationData,
             'sourceInformarion_id', methods.current_source_ids),
        ]
        for model, name_field, data_model, fk, current in cases:
            with self.subTest(model=model.__name__):
                full, partial = model.objects.create(**{name_field: 'full'}), model.objects.create(**{name_field: 'part'})
                for ptype in self.a2_types:
                    data_model.objects.create(**{fk: full, 'potential_type_id': ptype, 'value': 1})
                    if ptype.name_potential_type != 'AP':
                        data_model.objects.create(**{fk: partial, 'potential_type_id': ptype, 'value': 1})
                ids = current()
                self.assertIn(full.id, ids)
                self.assertNotIn(partial.id, ids)
