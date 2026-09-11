"""Tests for ProjectResultsView's production-stage aggregation."""
from rest_framework import status
from rest_framework.test import APITestCase

from projects_api import models
from projects_api.testing import firebase_user, owned_project


RESULTS_URL = '/api-projects/projects/{}/results/'

# Impact category rendered by these tests. 'PCG 100' (global warming) is not in
# ProjectResultsView._IMPACTOS_IGNORAR, so it appears in the response.
GWP_NAME = 'Calentamiento Global'


class ProductionStageAggregationTests(APITestCase):
    """
    Materials whose source database only publishes a combined cradle-to-gate
    value must contribute under the 'A1-A3' key; materials with a per-module
    split must keep contributing under 'A1'/'A2'/'A3'.
    """

    def setUp(self):
        self.unit = models.Unit.objects.create(name_unit='Kg')
        self.gwp = models.PotentialType.objects.create(
            name_potential_type='PCG 100',
            name_complete_potential_type=GWP_NAME,
            unit_potential_type='kg CO2 eq',
        )
        # Standard ids are seeded data in production; create them explicitly so
        # the test does not depend on auto-increment starting at 1.
        self.std_agg = models.Standard.objects.create(id=1, name_standard='A1-A3')
        self.std_a1 = models.Standard.objects.create(id=2, name_standard='A1')
        self.std_a2 = models.Standard.objects.create(id=3, name_standard='A2')
        self.std_a3 = models.Standard.objects.create(id=4, name_standard='A3')

        for name in ('EPiC', 'EPDs', 'mexicaniuh', 'ECOINVENT 3'):
            models.DataBaseMaterial.objects.create(name=name)

        self.project = owned_project('owner@example.com', name='test project')
        self.client.force_authenticate(user=firebase_user('owner@example.com'))

    def _material(self, database_from):
        return models.Material.objects.create(
            name_material='material from {}'.format(database_from),
            unit_id=self.unit,
            database_from=database_from,
        )

    def _impact(self, material, standard, value):
        models.MaterialSchemeData.objects.create(
            material_id=material,
            standard_id=standard,
            potential_type_id=self.gwp,
            unit_id=self.unit,
            value=value,
        )

    def _use_in_project(self, material, quantity, replaces=None):
        return models.MaterialSchemeProject.objects.create(
            material_id=material,
            project_id=self.project,
            quantity=quantity,
            replaces=replaces,
        )

    def _production(self):
        response = self.client.get(RESULTS_URL.format(self.project.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data['datos'][GWP_NAME]['Producción']

    def test_aggregate_only_material_contributes_to_production(self):
        """Regression: ecoinvent materials silently computed to zero."""
        material = self._material('ECOINVENT 3')
        self._impact(material, self.std_agg, 100)
        self._use_in_project(material, quantity=2)

        produccion = self._production()

        self.assertEqual(produccion.get('A1-A3'), 200)
        self.assertEqual(produccion.get('A1', 0), 0)

    def test_epic_material_still_contributes_under_aggregate_key(self):
        material = self._material('EPiC')
        self._impact(material, self.std_agg, 10)
        self._use_in_project(material, quantity=3)

        self.assertEqual(self._production().get('A1-A3'), 30)

    def test_staged_material_still_uses_individual_stages(self):
        material = self._material('EPDs')
        self._impact(material, self.std_a1, 1)
        self._impact(material, self.std_a2, 2)
        self._impact(material, self.std_a3, 3)
        self._use_in_project(material, quantity=10)

        produccion = self._production()

        self.assertEqual(produccion.get('A1'), 10)
        self.assertEqual(produccion.get('A2'), 20)
        self.assertEqual(produccion.get('A3'), 30)
        self.assertNotIn('A1-A3', produccion)

    def test_material_with_both_shapes_prefers_the_staged_split(self):
        """
        All 21 mexicaniuh materials carry an A1-A3 row alongside A1/A2/A3.
        The aggregate row must stay ignored, exactly as before this change,
        or their impacts would be double counted.
        """
        material = self._material('mexicaniuh')
        self._impact(material, self.std_agg, 999)
        self._impact(material, self.std_a1, 1)
        self._impact(material, self.std_a2, 2)
        self._impact(material, self.std_a3, 3)
        self._use_in_project(material, quantity=1)

        produccion = self._production()

        self.assertEqual(produccion.get('A1'), 1)
        self.assertNotIn('A1-A3', produccion)

    def test_aggregate_and_staged_materials_coexist_in_one_project(self):
        ecoinvent = self._material('ECOINVENT 3')
        self._impact(ecoinvent, self.std_agg, 5)
        self._use_in_project(ecoinvent, quantity=2)

        epd = self._material('EPDs')
        self._impact(epd, self.std_a1, 7)
        self._use_in_project(epd, quantity=1)

        produccion = self._production()

        self.assertEqual(produccion.get('A1-A3'), 10)
        self.assertEqual(produccion.get('A1'), 7)

    def test_b4_replacements_use_the_aggregate_value(self):
        material = self._material('ECOINVENT 3')
        self._impact(material, self.std_agg, 100)
        self._use_in_project(material, quantity=2, replaces=3)

        response = self.client.get(RESULTS_URL.format(self.project.id))

        # 100 * quantity 2 * replaces 3; no transport configured.
        self.assertEqual(response.data['datos'][GWP_NAME]['Uso']['B4'], 600)

    def test_databases_query_param_still_excludes_ecoinvent(self):
        material = self._material('ECOINVENT 3')
        self._impact(material, self.std_agg, 100)
        self._use_in_project(material, quantity=2)

        response = self.client.get(RESULTS_URL.format(self.project.id), {'databases': 'EPiC'})

        self.assertEqual(response.data['datos'][GWP_NAME]['Producción'].get('A1-A3', 0), 0)
