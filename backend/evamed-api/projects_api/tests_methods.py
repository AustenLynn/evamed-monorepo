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
