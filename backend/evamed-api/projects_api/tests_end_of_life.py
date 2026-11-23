"""EVAmed's end-of-life scenario for ecoinvent materials (fin de vida design 2026-11-22, Phase 2)."""
from unittest import mock

from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from projects_api import models
from projects_api.end_of_life import scenario
from projects_api.testing import firebase_user, owned_project

RESULTS_URL = '/api-projects/projects/{}/results/'
GWP_TOTAL_NAME = 'Calentamiento global, total'
TRUCK = 'Vehículo de carga, entre  16 y 32 Ton, tipo EURO 3 (RoW)-Ecoinvent 3'
LANDFILL = 'Concreto a relleno de material inerte (RoW)-Ecoinvent 3'
RECYCLING = 'Concreto sin armar a reciclaje (RoW)-Ecoinvent 3'
CONCRETE_DATASET = 21853  # a 'Concreto' entry of construction_materials.json


def scenario_data(approved=True, density=2400, destinations=None):
    return {
        'approved': approved,
        'truck': TRUCK,
        'families': {
            'Concreto': {'distance_km': 30, 'density_kg_m3': density, 'sources': 'test',
                         'destinations': destinations or [
                             {'treatment': LANDFILL, 'share': 0.8, 'module': 'C4'},
                             {'treatment': RECYCLING, 'share': 0.2, 'module': 'C3'}]},
            'Otros': {'distance_km': 30, 'density_kg_m3': None, 'sources': 'test',
                      'destinations': [{'treatment': LANDFILL, 'share': 1.0, 'module': 'C4'}]},
        },
    }


class LoadTests(TestCase):
    def test_load_rejects_shares_not_summing_to_one(self):
        data = scenario_data(destinations=[{'treatment': LANDFILL, 'share': 0.7, 'module': 'C4'}])
        with self.assertRaises(scenario.ScenarioError):
            scenario.from_dict(data)

    def test_load_rejects_a_module_other_than_c3_or_c4(self):
        data = scenario_data(destinations=[{'treatment': LANDFILL, 'share': 1.0, 'module': 'C2'}])
        with self.assertRaises(scenario.ScenarioError):
            scenario.from_dict(data)

    def test_load_requires_otros(self):
        data = scenario_data()
        del data['families']['Otros']
        with self.assertRaises(scenario.ScenarioError):
            scenario.from_dict(data)

    def test_load_rejects_unknown_treatment(self):
        data = scenario_data(destinations=[{'treatment': 'No existe', 'share': 1.0, 'module': 'C4'}])
        with self.assertRaises(scenario.ScenarioError):
            scenario.check_rows(scenario.from_dict(data))

    def test_shipped_scenario_loads_clean(self):
        # Treatments come from migration 0095; transports come with the catalogue dump, not migrations.
        models.Transport.objects.create(name_transport=TRUCK)
        loaded = scenario.load(check_rows=True)
        self.assertTrue(loaded.approved)  # Owner approved the proposal on 2026-11-23.
        self.assertEqual(scenario.load().truck, TRUCK)

    def test_pinned_treatments_are_exactly_the_ones_the_scenario_uses(self):
        import json as json_module
        from projects_api.management.commands import ecoinvent_resolve
        with open(ecoinvent_resolve.MANUAL_PINS_PATH) as handle:
            pinned = {p['entity_name'] for p in json_module.load(handle)['waste_treatment'] if p.get('dataset_id')}
        self.assertEqual(pinned, scenario.load().treatment_names())

    def test_family_from_construction_materials_else_otros(self):
        loaded = scenario.from_dict(scenario_data())
        self.assertEqual(loaded.family_for(models.Material(ecoinvent_dataset_id=CONCRETE_DATASET)), 'Concreto')
        self.assertEqual(loaded.family_for(models.Material(ecoinvent_dataset_id=1)), 'Otros')
        self.assertEqual(loaded.family_for(models.Material()), 'Otros')


@override_settings(EVAMED_IMPACT_METHOD='EN15804+A2')
class ScenarioResultsTests(APITestCase):
    def setUp(self):
        models.Standard.objects.create(id=1, name_standard='A1-A3')
        models.DataBaseMaterial.objects.get_or_create(name='ECOINVENT 3')
        models.DataBaseMaterial.objects.get_or_create(name='ECO Platform')
        self.types = {p.name_potential_type: p for p in models.PotentialType.objects.filter(method='EN15804+A2')}
        self.gwp = self.types['GWP-total']
        self.project = owned_project('owner@example.com', name='eol project')
        self.client.force_authenticate(user=firebase_user('owner@example.com'))
        truck = models.Transport.objects.create(name_transport=TRUCK)
        for ptype in self.types.values():
            models.PotentialTransport.objects.create(transport_id=truck, potential_type_id=ptype,
                                                     value=0.1 if ptype == self.gwp else 0)
        for name, gwp in ((LANDFILL, 0.01), (RECYCLING, 0.05)):
            treatment = models.WasteTreatment.objects.get(name_waste_treatment=name)
            for ptype in self.types.values():
                models.WasteTreatmentData.objects.create(waste_treatment_id=treatment, potential_type_id=ptype,
                                                         value=gwp if ptype == self.gwp else 0)
        patcher = mock.patch.object(scenario, 'current', lambda: scenario.from_dict(self.data))
        patcher.start()
        self.addCleanup(patcher.stop)
        self.data = scenario_data()

    def _material(self, unit='Kg', dataset=CONCRETE_DATASET, database='ECOINVENT 3'):
        material = models.Material.objects.create(
            name_material='Concreto eco', unit_id=models.Unit.objects.get_or_create(name_unit=unit)[0],
            database_from=database, ecoinvent_dataset_id=dataset)
        for ptype in self.types.values():
            models.MaterialSchemeData.objects.create(material_id=material, standard_id_id=1, potential_type_id=ptype,
                                                     value=1)
        return material

    def _row(self, material, quantity, replaces=0, section=None):
        return models.MaterialSchemeProject.objects.create(material_id=material, project_id=self.project,
                                                          quantity=quantity, replaces=replaces, section_id=section)

    def _results(self, detalle=False):
        response = self.client.get(RESULTS_URL.format(self.project.id) + ('?detalle=1' if detalle else ''))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.json()

    def _fin(self, body):
        fin = body['datos'][GWP_TOTAL_NAME]['FinDeVida']
        return round(fin['C2'], 9), round(fin['C3'], 9), round(fin['C4'], 9)

    def test_scenario_values(self):
        self._row(self._material(), quantity=1000)
        body = self._results()
        # 1 t × 30 km × 0.1; 1000 kg × 0.2 × 0.05; 1000 kg × 0.8 × 0.01.
        self.assertEqual(self._fin(body), (3.0, 10.0, 8.0))
        self.assertEqual(body['excluded']['end_of_life'], [])

    def test_unapproved_scenario_changes_nothing(self):
        self.data = scenario_data(approved=False)
        row = self._row(self._material(), quantity=1000)
        body = self._results()
        self.assertEqual(self._fin(body), (0, 0, 0))
        self.assertEqual([(e['row_id'], e['reason']) for e in body['excluded']['end_of_life']], [(row.id, 'sin_datos')])

    def test_m3_uses_the_family_density(self):
        self._row(self._material(unit='m³'), quantity=0.5)  # 1200 kg
        self.assertEqual(self._fin(self._results()), (3.6, 12.0, 9.6))

    def test_m3_material_without_density_is_listed(self):
        self.data = scenario_data(density=None)
        row = self._row(self._material(unit='m³'), quantity=1)
        body = self._results()
        self.assertEqual(self._fin(body), (0, 0, 0))
        self.assertEqual([(e['row_id'], e['reason']) for e in body['excluded']['end_of_life']], [(row.id, 'sin_masa')])

    def test_treatment_without_values_is_listed(self):
        models.WasteTreatmentData.objects.filter(waste_treatment_id__name_waste_treatment=RECYCLING,
                                                 potential_type_id=self.types['WDP']).delete()
        row = self._row(self._material(), quantity=1000)
        body = self._results()
        self.assertEqual(self._fin(body), (0, 0, 0))
        self.assertEqual([(e['row_id'], e['reason']) for e in body['excluded']['end_of_life']],
                         [(row.id, 'sin_tratamiento')])

    def test_declared_epd_ignores_scenario(self):
        material = self._material(database='ECO Platform')
        c3 = models.Standard.objects.get(name_standard='C3')
        for ptype in self.types.values():
            models.MaterialSchemeData.objects.create(material_id=material, standard_id=c3, potential_type_id=ptype,
                                                     value=7 if ptype == self.gwp else 0)
        self._row(material, quantity=2)
        self.assertEqual(self._fin(self._results()), (0, 14.0, 0))

    def test_non_ecoinvent_material_gets_no_scenario(self):
        row = self._row(self._material(database='ECO Platform'), quantity=1000)
        body = self._results()
        self.assertEqual(self._fin(body), (0, 0, 0))
        self.assertEqual([e['reason'] for e in body['excluded']['end_of_life']], ['sin_datos'])
        self.assertEqual(body['excluded']['end_of_life'][0]['row_id'], row.id)

    def test_scenario_rows_add_to_b4_and_per_element(self):
        walls = models.Section.objects.create(name_section='Muros')
        self._row(self._material(), quantity=1000, replaces=1, section=walls)
        body = self._results(detalle=True)
        datos = body['datos'][GWP_TOTAL_NAME]
        # B4: the replacement's production (1000 × 1) plus its end of life (3 + 10 + 8).
        self.assertAlmostEqual(datos['Uso']['B4'], 1000 + 21, places=9)
        stages = sum(datos['Producción'].values()) + datos['Construccion']['A4'] + datos['Construccion']['A5'] \
            + datos['Uso']['B4'] + sum(datos['FinDeVida'].values())
        self.assertAlmostEqual(sum(body['por_elemento'][GWP_TOTAL_NAME].values()), stages, places=9)

    @override_settings(EVAMED_IMPACT_METHOD='CML')
    def test_cml_lists_nothing(self):
        self._row(self._material(), quantity=1000)
        self.assertEqual(self._results()['excluded']['end_of_life'], [])
