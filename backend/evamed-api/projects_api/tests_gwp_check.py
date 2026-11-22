"""GWP-total must equal fossil + biogenic + land use (audit A-11, 2026-11-22)."""
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from projects_api import gwp_check, models


class GwpRuleTests(TestCase):
    def test_flags_a_total_that_is_not_the_sum_of_its_parts(self):
        # Values the ecoinvent 3.12 sandbox returned for CEM III/C (dataset 8183).
        bad = gwp_check.mismatch({'GWP-total': 0.158, 'GWP-fossil': 0.525, 'GWP-biogenic': 0.0001, 'GWP-luluc': 0.0002})
        self.assertAlmostEqual(bad['suma'], 0.5253, places=4)
        self.assertGreater(bad['diferencia'], 0.5)  # relative to the larger of the two

    def test_accepts_rounding_and_needs_all_four(self):
        self.assertIsNone(gwp_check.mismatch({'GWP-total': 1.04, 'GWP-fossil': 1.0, 'GWP-biogenic': 0, 'GWP-luluc': 0}))
        self.assertIsNone(gwp_check.mismatch({'GWP-total': 1.0, 'GWP-fossil': 5.0}))
        self.assertIsNone(gwp_check.mismatch({'GWP-total': 0, 'GWP-fossil': 0, 'GWP-biogenic': 0, 'GWP-luluc': 0}))


class CheckGwpCommandTests(TestCase):
    def setUp(self):
        self.types = {t.name_potential_type: t for t in models.PotentialType.objects.filter(method='EN15804+A2')}
        standard = models.Standard.objects.create(name_standard='A1-A3')

        def material(name, values):
            m = models.Material.objects.create(name_material=name, database_from='ecoinvent')
            for short, value in values.items():
                models.MaterialSchemeData.objects.create(material_id=m, standard_id=standard,
                                                         potential_type_id=self.types[short], value=Decimal(str(value)))
        material('Cemento bueno', {'GWP-total': 1.0, 'GWP-fossil': 0.9, 'GWP-biogenic': 0.05, 'GWP-luluc': 0.05})
        material('Cemento malo', {'GWP-total': 0.158, 'GWP-fossil': 0.525, 'GWP-biogenic': 0.0001, 'GWP-luluc': 0.0002})
        energy = models.TypeEnergy.objects.create(name_type_energy='Red')
        for short, value in {'GWP-total': 27.4, 'GWP-fossil': 29.7, 'GWP-biogenic': 0.003, 'GWP-luluc': 0.007}.items():
            models.TypeEnergyData.objects.create(type_energy_id=energy, potential_type_id=self.types[short],
                                                 value=Decimal(str(value)))

    def test_lists_only_inconsistent_rows(self):
        out = StringIO()
        call_command('check_gwp', stdout=out)
        text = out.getvalue()
        self.assertIn('Cemento malo', text)
        self.assertIn('Red', text)
        self.assertNotIn('Cemento bueno', text)
        self.assertIn('2 de 3', text)


class RefreshWarningTests(TestCase):
    def test_refresh_groups_fetched_values_per_entity(self):
        from projects_api.management.commands.ecoinvent_refresh import gwp_inconsistencies
        types = {t.name_potential_type: t for t in models.PotentialType.objects.filter(method='EN15804+A2')}
        cement = models.Material.objects.create(name_material='CEM III/C')
        changes = [{'instance': cement, 'name': 'CEM III/C', 'value': v, 'lookup': {'potential_type_id': types[k]}}
                   for k, v in {'GWP-total': 0.158, 'GWP-fossil': 0.525, 'GWP-biogenic': 0.0001,
                                'GWP-luluc': 0.0002, 'ODP': 1e-8}.items()]
        found = gwp_inconsistencies(changes)
        self.assertEqual([name for name, _ in found], ['CEM III/C'])
