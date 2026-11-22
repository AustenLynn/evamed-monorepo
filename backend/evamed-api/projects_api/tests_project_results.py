"""Tests for ProjectResultsView's production-stage aggregation."""
import json

from rest_framework import status
from rest_framework.test import APITestCase

from projects_api import models
from projects_api.testing import firebase_user, owned_project


RESULTS_URL = '/api-projects/projects/{}/results/'

# Impact category rendered by these tests. 'PCG 100' (global warming) is a shown CML
# indicator (methods.CML_HIDDEN), so it appears in the response under CML.
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

    def test_view_returns_compute(self):
        # A-32 plan, Task 1: the view only resolves the project and databases; results.compute calculates.
        material = self._material('EPDs')
        self._impact(material, self.std_agg, 3)
        self._use_in_project(material, 2)
        from projects_api import results
        expected = results.compute(self.project, set(models.DataBaseMaterial.objects.values_list('name', flat=True)))
        response = self.client.get(RESULTS_URL.format(self.project.id))
        self.assertEqual(response.json(), json.loads(json.dumps(expected)))

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

    def test_b4_each_row_brings_back_only_its_own_transport(self):
        # The same block in two systems: 10 kg each, 100 km by truck (0.001 per kg·km),
        # one replacement each. Each row's replacement adds its own 1 of transport, not 2.
        truck_id = 4
        truck = models.Transport.objects.create(id=truck_id, name_transport='Camión')
        models.PotentialTransport.objects.create(transport_id=truck, potential_type_id=self.gwp, value=0.001)
        material = self._material('EPiC')
        self._impact(material, self.std_agg, 2)
        for _ in range(2):
            models.MaterialSchemeProject.objects.create(
                material_id=material, project_id=self.project, quantity=10,
                distance_end=100, transport_id_end=truck, replaces=1,
            )

        response = self.client.get(RESULTS_URL.format(self.project.id))
        datos = response.data['datos'][GWP_NAME]

        self.assertAlmostEqual(datos['Construccion']['A4'], 2)
        # Per row: (1 transport + 2·10 production) × 1 replacement; two rows.
        self.assertAlmostEqual(datos['Uso']['B4'], 42)

    def test_databases_query_param_still_excludes_ecoinvent(self):
        material = self._material('ECOINVENT 3')
        self._impact(material, self.std_agg, 100)
        self._use_in_project(material, quantity=2)

        response = self.client.get(RESULTS_URL.format(self.project.id), {'databases': 'EPiC'})

        self.assertEqual(response.data['datos'][GWP_NAME]['Producción'].get('A1-A3', 0), 0)

    def _in_system(self, material, quantity, system, section, origin):
        return models.MaterialSchemeProject.objects.create(
            material_id=material, project_id=self.project, quantity=quantity,
            construction_system=system, section_id=section, origin_id=origin,
        )

    def test_switched_off_system_is_left_out(self):
        """Systems switched off on the Materiales page leave the totals, as on Resultados."""
        walls = models.Section.objects.create(name_section='Muros exteriores')
        revit = models.Origin.objects.create(name_origin='Modelo de Revit')
        user = models.Origin.objects.create(name_origin='Usuario_Plataforma')
        material = self._material('EPiC')
        self._impact(material, self.std_agg, 10)
        self._in_system(material, 1, 'Muro A', walls, revit)
        self._in_system(material, 2, 'Muro B', walls, revit)
        # Same name in another origin: still counted.
        self._in_system(material, 4, 'Muro B', walls, user)
        models.MaterialStageSystemSelection.objects.create(
            project_id=self.project, section_id=walls, origin_id=revit,
            construction_system='Muro B', is_selected=False,
        )
        models.MaterialStageSystemSelection.objects.create(
            project_id=self.project, section_id=walls, origin_id=revit,
            construction_system='Muro A', is_selected=True,
        )

        self.assertEqual(self._production().get('A1-A3'), 50)



from django.test import override_settings  # noqa: E402

A2_SHORT = [
    'GWP-total', 'GWP-fossil', 'GWP-biogenic', 'GWP-luluc', 'ODP', 'AP', 'EP-freshwater',
    'EP-marine', 'EP-terrestrial', 'POCP', 'ADPE', 'ADPF', 'WDP',
]
GWP_TOTAL_NAME = 'Calentamiento global, total'
GWP_BIOGENIC_NAME = 'Calentamiento global, biogénico'


@override_settings(EVAMED_IMPACT_METHOD='EN15804+A2')
class A2ResultsTests(APITestCase):
    """EN 15804+A2 design (2026-11-20): A2 indicators only, exclusions listed, biogenic release."""

    def setUp(self):
        self.unit = models.Unit.objects.create(name_unit='Kg')
        self.std_agg = models.Standard.objects.create(id=1, name_standard='A1-A3')
        for pk, name in ((2, 'A1'), (3, 'A2'), (4, 'A3')):
            models.Standard.objects.create(id=pk, name_standard=name)
        for name in ('EPDs', 'ECOINVENT 3', 'ECO Platform'):
            models.DataBaseMaterial.objects.get_or_create(name=name)
        self.types = {p.name_potential_type: p for p in models.PotentialType.objects.filter(method='EN15804+A2')}
        self.cml_gwp = models.PotentialType.objects.create(
            name_potential_type='PCG 100', name_complete_potential_type='Calentamiento Global')
        self.project = owned_project('owner@example.com', name='a2 project')
        self.client.force_authenticate(user=firebase_user('owner@example.com'))

    def _a2_material(self, name='Nuevo', values=None, skip=(), mass=None, provider='legacy'):
        material = models.Material.objects.create(
            name_material=name, unit_id=self.unit, database_from='ECO Platform', provider_code=provider)
        for short, ptype in self.types.items():
            if short in skip:
                continue
            models.MaterialSchemeData.objects.create(
                material_id=material, standard_id=self.std_agg, potential_type_id=ptype,
                value=(values or {}).get(short, 1))
        if mass is not None:
            models.Conversions.objects.create(material_id=material, value=mass)
        return material

    def _old_material(self):
        material = models.Material.objects.create(name_material='Viejo', unit_id=self.unit, database_from='EPDs')
        models.MaterialSchemeData.objects.create(
            material_id=material, standard_id=self.std_agg, potential_type_id=self.cml_gwp, value=5)
        return material

    def _use(self, material, quantity=1, distance=None):
        return models.MaterialSchemeProject.objects.create(
            material_id=material, project_id=self.project, quantity=quantity, distance_end=distance)

    def _results(self):
        response = self.client.get(RESULTS_URL.format(self.project.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def test_a2_results_keys_are_thirteen(self):
        self._use(self._a2_material(mass=1))
        datos = self._results()['datos']
        self.assertEqual(len(datos), 13)
        self.assertIn(GWP_TOTAL_NAME, datos)
        self.assertNotIn('Calentamiento Global', datos)

    def test_old_project_under_a2_warns_not_crashes(self):
        row = self._use(self._old_material(), quantity=3)
        body = self._results()
        self.assertEqual(sum(body['datos'][GWP_TOTAL_NAME]['Producción'].values()), 0)
        excluded = body['excluded']['materials']
        self.assertEqual([(e['row_id'], e['reason']) for e in excluded], [(row.id, 'old_method')])

    def test_partial_material_listed(self):
        material = self._a2_material(skip=('WDP',), mass=1)
        self._use(material, quantity=2)
        body = self._results()
        self.assertEqual(sum(body['datos'][GWP_TOTAL_NAME]['Producción'].values()), 0)
        self.assertEqual(body['excluded']['materials'][0]['reason'], 'missing:WDP')

    def test_current_material_counts(self):
        self._use(self._a2_material(values={'GWP-total': 4}, mass=1), quantity=2)
        body = self._results()
        self.assertEqual(sum(body['datos'][GWP_TOTAL_NAME]['Producción'].values()), 8)
        self.assertEqual(body['excluded']['materials'], [])

    def _truck(self):
        transport = models.Transport.objects.create(id=4, name_transport='camión')
        for ptype in self.types.values():
            models.PotentialTransport.objects.create(transport_id=transport, potential_type_id=ptype, value=1)

    def test_no_mass_material_excludes_transport(self):
        self._truck()
        material = self._a2_material()
        material.unit_id = models.Unit.objects.create(name_unit='m²')
        material.save()
        row = self._use(material, quantity=2, distance=100)
        body = self._results()
        self.assertEqual(body['datos'][GWP_TOTAL_NAME]['Construccion']['A4'], 0)
        self.assertEqual([e['row_id'] for e in body['excluded']['no_mass']], [row.id])

    def test_mass_material_includes_transport(self):
        transport = models.Transport.objects.create(id=4, name_transport='camión')
        for ptype in self.types.values():
            models.PotentialTransport.objects.create(transport_id=transport, potential_type_id=ptype, value=1)
        self._use(self._a2_material(mass=0.5), quantity=2, distance=100)
        body = self._results()
        self.assertEqual(body['datos'][GWP_TOTAL_NAME]['Construccion']['A4'], 100)
        self.assertEqual(body['excluded']['no_mass'], [])

    def test_biogenic_release_added_to_c3(self):
        self._use(self._a2_material(values={'GWP-biogenic': -10, 'GWP-total': -3}, mass=1), quantity=2)
        datos = self._results()['datos']
        self.assertEqual(datos[GWP_BIOGENIC_NAME]['FinDeVida']['C3'], 20)
        self.assertEqual(datos[GWP_TOTAL_NAME]['FinDeVida']['C3'], 20)

    def test_positive_biogenic_adds_nothing(self):
        self._use(self._a2_material(values={'GWP-biogenic': 2}, mass=1))
        self.assertEqual(self._results()['datos'][GWP_BIOGENIC_NAME]['FinDeVida']['C3'], 0)

    def test_noncurrent_energy_listed(self):
        energy = models.TypeEnergy.objects.create(name_type_energy='Red vieja')
        acr = models.AnnualConsumptionRequired.objects.create(project_id=self.project, quantity=1)
        models.ElectricityConsumptionData.objects.create(annual_consumption_required_id=acr, type=energy, quantity=1)
        body = self._results()
        self.assertEqual([e['id'] for e in body['excluded']['energy']], [energy.id])

    def test_warning_respects_eco_access(self):
        self._use(self._a2_material(provider='eco_platform', mass=1))
        self._use(self._old_material())
        self.client.force_authenticate(user=firebase_user('owner@example.com'))
        response = self.client.get(RESULTS_URL.format(self.project.id))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_response_names_the_carbon_indicator(self):
        # The stage pages' carbon bar reads GWP-total by this name (2026-11-21).
        self._use(self._a2_material(mass=1))
        carbono = self._results()['carbono']
        self.assertEqual(carbono['name'], GWP_TOTAL_NAME)
        self.assertEqual(carbono['unit'], self.types['GWP-total'].unit_potential_type)

    @override_settings(EVAMED_IMPACT_METHOD='CML')
    def test_cml_carbon_indicator_is_pcg_100(self):
        self._use(self._old_material(), quantity=3)
        self.assertEqual(self._results()['carbono']['name'], 'Calentamiento Global')

    @override_settings(EVAMED_IMPACT_METHOD='CML')
    def test_cml_setting_matches_legacy_results(self):
        self._use(self._old_material(), quantity=3)
        body = self._results()
        self.assertEqual(sum(body['datos']['Calentamiento Global']['Producción'].values()), 15)
        self.assertNotIn(GWP_TOTAL_NAME, body['datos'])
        self.assertEqual(body['excluded']['materials'], [])

    def test_biogenic_release_respects_database_toggle(self):
        self._use(self._a2_material(values={'GWP-biogenic': -10}, mass=1), quantity=2)
        response = self.client.get(RESULTS_URL.format(self.project.id) + '?databases=EPDs')
        self.assertEqual(response.data['datos'][GWP_BIOGENIC_NAME]['FinDeVida']['C3'], 0)

    def test_kg_material_without_conversion_gets_mass_from_unit(self):
        # Review finding 3: ecoinvent materials have no Conversions row; kg and tonnes need none.
        self._truck()
        self._use(self._a2_material(), quantity=2000, distance=100)
        body = self._results()
        self.assertAlmostEqual(body['datos'][GWP_TOTAL_NAME]['Construccion']['A4'], 200)
        self.assertEqual(body['excluded']['no_mass'], [])

    def test_tonne_material_without_conversion_gets_mass_from_unit(self):
        self._truck()
        material = self._a2_material()
        material.unit_id = models.Unit.objects.create(name_unit='Ton')
        material.save()
        self._use(material, quantity=2, distance=100)
        self.assertAlmostEqual(self._results()['datos'][GWP_TOTAL_NAME]['Construccion']['A4'], 200)

    def test_no_mass_listed_only_when_transport_was_entered(self):
        material = self._a2_material()
        material.unit_id = models.Unit.objects.create(name_unit='m²')
        material.save()
        self._use(material, quantity=2)
        self.assertEqual(self._results()['excluded']['no_mass'], [])

    def test_biogenic_release_covers_replacements(self):
        # Review finding 4: B4 brings back the uptake once per replacement, so each must be released.
        material = self._a2_material(values={'GWP-biogenic': -10}, mass=1)
        models.MaterialSchemeProject.objects.create(
            material_id=material, project_id=self.project, quantity=2, replaces=1)
        bio = self._results()['datos'][GWP_BIOGENIC_NAME]
        self.assertEqual(bio['FinDeVida']['C3'], 40)
        total = sum(bio['Producción'].values()) + bio['Uso']['B4'] + bio['FinDeVida']['C3']
        self.assertEqual(total, 0)

    def test_old_project_query_count_does_not_grow_with_materials(self):
        # Review finding 6: no per-material queries for the exclusion list.
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        def count(n):
            models.MaterialSchemeProject.objects.filter(project_id=self.project).delete()
            for _ in range(n):
                self._use(self._old_material())
            with CaptureQueriesContext(connection) as queries:
                self._results()
            return len(queries)

        self.assertEqual(count(3), count(30))

    def test_imported_zero_distance_is_not_transport(self):
        # The materials page saves imported rows with distance 0, not empty: that's no transport.
        material = self._a2_material()
        material.unit_id = models.Unit.objects.create(name_unit='m²')
        material.save()
        models.MaterialSchemeProject.objects.create(
            material_id=material, project_id=self.project, quantity=2, distance_init=0, distance_end=0)
        self.assertEqual(self._results()['excluded']['no_mass'], [])


# A-32 plan, Task 5: ?detalle=1 adds the per-element breakdown that Resultados section 2 draws.
ELEMENT_STAGES = (('Producción', None), ('Construccion', 'A4'), ('Construccion', 'A5'), ('Uso', 'B4'),
                  ('FinDeVida', 'C1'), ('FinDeVida', 'C3'))


def _element_stage_total(datos_indicador):
    total = 0
    for stage, sub in ELEMENT_STAGES:
        values = datos_indicador[stage]
        total += sum(values.values()) if sub is None else values[sub]
    return total


@override_settings(EVAMED_IMPACT_METHOD='EN15804+A2')
class DetailBreakdownTests(APITestCase):
    setUp = A2ResultsTests.setUp
    _a2_material = A2ResultsTests._a2_material
    _old_material = A2ResultsTests._old_material
    _truck = A2ResultsTests._truck

    def _results(self, detalle=True):
        url = RESULTS_URL.format(self.project.id) + ('?detalle=1' if detalle else '')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.json()

    def _full_project(self, types):
        """Two elements with materials (transport, a replacement, biogenic uptake), an A5 machine and a C1 one."""
        self._truck()
        walls, floors = models.Section.objects.create(name_section='Muros'), models.Section.objects.create(name_section='Pisos')
        cement = self._a2_material('Cemento', values={'GWP-biogenic': -2}, mass=1)
        steel = self._a2_material('Acero', mass=1)
        models.MaterialSchemeProject.objects.create(material_id=cement, project_id=self.project, quantity=3,
                                                    section_id=walls, distance_end=10, replaces=1)
        models.MaterialSchemeProject.objects.create(material_id=steel, project_id=self.project, quantity=2,
                                                    section_id=floors, distance_end=5)
        machine = models.SourceInformation.objects.create(name_source_information='Generador')
        for ptype in types:
            models.SourceInformationData.objects.create(sourceInformarion_id=machine, potential_type_id=ptype, value=3)
        models.ConstructiveSystemElement.objects.create(project_id=self.project, section_id=walls,
                                                        source_information_id=machine, quantity=4)
        models.ElectricityConsumptionDeconstructiveProcess.objects.create(
            project_id=self.project, section_id=floors, source_information_id=machine, quantity=2)
        return walls, floors

    def test_without_detalle_the_response_is_unchanged(self):
        self.assertEqual(set(self._results(detalle=False)), {'project_id', 'datos', 'error', 'excluded', 'carbono'})

    def test_per_element_sums_to_the_stage_totals_under_a2(self):
        self._full_project(self.types.values())
        body = self._results()
        for name, datos_indicador in body['datos'].items():
            self.assertAlmostEqual(sum(body['por_elemento'][name].values()), _element_stage_total(datos_indicador),
                                   places=9, msg=name)
        self.assertEqual(len(body['por_elemento'][GWP_BIOGENIC_NAME]), 2)

    @override_settings(EVAMED_IMPACT_METHOD='CML')
    def test_per_element_sums_to_the_stage_totals_under_cml(self):
        cml = models.PotentialType.objects.filter(method='CML')
        self._full_project(list(cml) + list(self.types.values()))
        cement = models.Material.objects.get(name_material='Cemento')
        for ptype in cml:
            models.MaterialSchemeData.objects.create(material_id=cement, standard_id=self.std_agg,
                                                     potential_type_id=ptype, value=2)
        body = self._results()
        self.assertTrue(body['por_elemento'])
        for name, datos_indicador in body['datos'].items():
            self.assertAlmostEqual(sum(body['por_elemento'][name].values()), _element_stage_total(datos_indicador),
                                   places=9, msg=name)

    def test_per_element_leaves_out_switched_off_systems_and_excluded_materials(self):
        walls = models.Section.objects.create(name_section='Muros')
        off = models.Section.objects.create(name_section='Techos')
        kept = self._a2_material('Bueno', mass=1)
        models.MaterialSchemeProject.objects.create(material_id=kept, project_id=self.project, quantity=1,
                                                    section_id=walls, construction_system='A')
        models.MaterialSchemeProject.objects.create(material_id=kept, project_id=self.project, quantity=1,
                                                    section_id=off, construction_system='B')
        models.MaterialStageSystemSelection.objects.create(project_id=self.project, section_id=off,
                                                           construction_system='B', is_selected=False)
        models.MaterialSchemeProject.objects.create(material_id=self._old_material(), project_id=self.project,
                                                    quantity=5, section_id=off)
        body = self._results()
        for name, by_element in body['por_elemento'].items():
            self.assertEqual(by_element.get(str(off.id), 0), 0, name)
            self.assertEqual(by_element[str(walls.id)], 1, name)
            # Same for section 3 (A-32 plan, Task 7).
            self.assertEqual(set(body['por_material']['materiales'][name]['Producción']['A1-A3']), {str(walls.id)})

    def test_project_with_no_rows_has_empty_breakdowns(self):
        body = self._results()
        self.assertEqual(body['por_elemento'], {name: {} for name in body['datos']})

    # A-32 plan, Task 7: per element and material, for Resultados section 3.
    SECTION3 = (('Producción', 'A1'), ('Producción', 'A2'), ('Producción', 'A3'), ('Producción', 'A1-A3'),
                ('Construccion', 'A4'), ('Uso', 'B4'))

    def test_per_material_matches_per_element_and_the_stage_totals(self):
        self._full_project(self.types.values())
        body = self._results()
        calculos, materiales = body['por_material']['Calculos'], body['por_material']['materiales']
        for name, datos_indicador in body['datos'].items():
            for stage, sub in self.SECTION3:
                por_seccion = calculos[name][stage].get(sub, {})
                self.assertAlmostEqual(sum(por_seccion.values()), datos_indicador[stage].get(sub, 0),
                                       places=9, msg=(name, stage, sub))
                for section, value in por_seccion.items():
                    self.assertAlmostEqual(sum(materiales[name][stage][sub][section].values()), value, places=9)
        gwp = body['carbono']['name']
        self.assertEqual(set(calculos[gwp]['Uso']['B4']), {str(models.Section.objects.get(name_section='Muros').id)})

    def test_material_names_only_for_the_project(self):
        self._full_project(self.types.values())
        self._a2_material('Ajeno')
        names = self._results()['nombres_materiales']
        self.assertEqual(sorted(names.values()), ['Acero', 'Cemento'])

    def test_project_with_no_rows_has_empty_per_material(self):
        body = self._results()
        empty = {'Producción': {'A1': {}, 'A2': {}, 'A3': {}}, 'Construccion': {'A4': {}}, 'Uso': {'B4': {}}}
        self.assertEqual(body['por_material']['Calculos'], {name: empty for name in body['datos']})
        self.assertEqual(body['nombres_materiales'], {})
