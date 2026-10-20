"""Explorador de recursos: the read-only catalogue API (HANDOFF §5, RECONCILIATION.md)."""
from decimal import Decimal

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from projects_api import models
from projects_api.explorer import derive
from projects_api.testing import admin_user, firebase_user

URL = '/api-projects/explorer/%s/'


class DeriveTests(SimpleTestCase):

    def test_category_is_the_prefix_before_the_first_underscore(self):
        self.assertEqual(derive.category('Concreto_AAC block - 600 mm'), 'Concreto')
        self.assertEqual(derive.category('Arena_Sand_MX_concreto'), 'Arena')

    def test_a_trailing_mx_marker_is_not_a_category(self):
        self.assertIsNone(derive.category('Panel de yeso marca USG tablaroca_MX'))
        self.assertEqual(derive.category('Grava_Gravel_MX'), 'Grava')

    def test_no_underscore_no_category(self):
        self.assertIsNone(derive.category('Panel fotovoltaico, Silicio amorfo (a-Si) (GLO)'))
        self.assertIsNone(derive.category(None))

    def test_display_name_drops_the_category_and_source_suffix(self):
        self.assertEqual(derive.display_name('Concreto_AAC block - 600 mm'), 'AAC block - 600 mm')
        self.assertEqual(derive.display_name('Arena_Sand_MX_concreto'), 'Sand MX concreto')
        self.assertEqual(derive.display_name('Panel de yeso marca USG tablaroca_MX'), 'Panel de yeso marca USG tablaroca MX')
        self.assertEqual(
            derive.display_name('Excavadora hidráulica (GLO)-Ecoinvent 3'), 'Excavadora hidráulica (GLO)')
        self.assertEqual(
            derive.display_name('Energía eléctrica, Alto voltaje (MX)-ECOINVENT3'), 'Energía eléctrica, Alto voltaje (MX)')
        self.assertEqual(
            derive.display_name('Energía eléctrica, Alto voltaje (MX)-MEXICANIUH'), 'Energía eléctrica, Alto voltaje (MX)')

    def test_source_from_the_name_suffix(self):
        self.assertEqual(derive.source_from_name('Excavadora (GLO)-Ecoinvent 3'), 'ECOINVENT 3')
        self.assertEqual(derive.source_from_name('Energía (MX)-ECOINVENT3'), 'ECOINVENT 3')
        self.assertEqual(derive.source_from_name('Energía (MX)-MEXICANIUH'), 'mexicaniuh')
        self.assertIsNone(derive.source_from_name('Calefacción doméstica con gas natural (GLO)'))

    def test_unit_spellings_merge(self):
        self.assertEqual(derive.unit('Kg'), 'kg')
        self.assertEqual(derive.unit('Pza'), 'Pz')
        self.assertEqual(derive.unit('m²'), 'm²')
        self.assertIsNone(derive.unit(None))

    def test_machinery_type(self):
        self.assertEqual(derive.machinery_type('Generador de energía eléctrica a base de Diesel'), 'Generador')
        self.assertEqual(derive.machinery_type('Maquinaria de carga ligera a base de Diesel'), 'Maquinaria ligera')
        self.assertEqual(derive.machinery_type('Maquinaria de carga pesada a base de Diesel'), 'Maquinaria pesada')
        self.assertEqual(derive.machinery_type('Excavadora hidráulica (GLO)'), 'Otros')

    def test_energy_type(self):
        self.assertEqual(derive.energy_type('Energía eléctrica, Bajo voltaje (MX)-ECOINVENT3'), 'Electricidad')
        self.assertEqual(derive.energy_type('Calefacción doméstica con gas natural (GLO)'), 'Gas')

    def test_search_ignores_case_and_accents(self):
        self.assertTrue(derive.matches('Cristal LAMINADO térmico', 'termico laminado'))
        self.assertTrue(derive.matches('Energía eléctrica', 'ENERGIA'))
        self.assertFalse(derive.matches('Concreto', 'acero'))

    def test_impact_levels_split_positive_values_in_thirds(self):
        levels = derive.impact_levels({1: 1.0, 2: 2.0, 3: 3.0, 4: 4.0, 5: 5.0, 6: 6.0})
        self.assertEqual(levels, {1: 'bajo', 2: 'bajo', 3: 'medio', 4: 'medio', 5: 'alto', 6: 'alto'})

    def test_ties_share_the_lower_level(self):
        levels = derive.impact_levels({1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 9.0, 6: 9.0})
        self.assertEqual(levels[1], 'bajo')
        self.assertEqual(levels[4], 'bajo')
        self.assertEqual(levels[5], 'alto')

    def test_negative_values_are_credits(self):
        levels = derive.impact_levels({1: -2.0, 2: 1.0, 3: 2.0, 4: 3.0})
        self.assertEqual(levels[1], 'credito')
        self.assertEqual(levels[2], 'bajo')

    def test_fewer_than_three_values_get_no_level(self):
        self.assertEqual(derive.impact_levels({1: 1.0, 2: 2.0}), {1: None, 2: None})

    def test_percentile(self):
        self.assertAlmostEqual(derive.percentile([1, 2, 3, 4, 5], 25), 2.0)
        self.assertAlmostEqual(derive.percentile([1, 2, 3, 4], 25), 1.75)


class ExplorerApiTests(APITestCase):
    """A small catalogue shaped like the seed data."""

    @classmethod
    def setUpTestData(cls):
        unit = lambda name: models.Unit.objects.create(name_unit=name)
        cls.kg, cls.kg_upper, cls.m2, cls.co2 = unit('kg'), unit('Kg'), unit('m²'), unit('kg CO2 eq')
        std = lambda name: models.Standard.objects.create(name_standard=name)
        cls.a1a3, cls.a1, cls.a2, cls.a3 = std('A1-A3'), std('A1'), std('A2'), std('A3')
        cls.gwp = models.PotentialType.objects.create(
            name_potential_type='PCG 100', name_complete_potential_type='Potencial de calentamiento global',
            unit_potential_type='kg CO2 eq')
        cls.pa = models.PotentialType.objects.create(
            name_potential_type='PA', name_complete_potential_type='Potencial de acidificación',
            unit_potential_type='kg SO2 eq')

        cls.aggregate = []
        for i, value in enumerate(['1', '2', '3', '4', '5', '6']):
            material = cls.material('Concreto_Bloque %s' % i, 'EPiC', cls.kg if i % 2 else cls.kg_upper)
            cls.data(material, cls.a1a3, value)
            cls.aggregate.append(material)
        # Split-only, like the EPDs (R-01): GWP is A1 + A2 + A3.
        cls.split = cls.material('Acero_Viga split', 'EPDs', cls.m2, description='Viga laminada')
        cls.data(cls.split, cls.a1, '1.5')
        cls.data(cls.split, cls.a2, '0.25')
        cls.data(cls.split, cls.a3, '0.25')
        cls.data(cls.split, cls.a3, '0.031', potential=cls.pa)
        # Duplicate rows (R-05): read once.
        cls.duplicated = cls.material('Acero_Alambre', 'EPiC', cls.m2)
        for _ in range(4):
            cls.data(cls.duplicated, cls.a1a3, '13.9')
        cls.no_data = cls.material('Ánfora sin datos', 'EPDs', cls.m2)
        cls.ecoinvent = cls.material('Ladrillo_Clay brick', 'ECOINVENT 3', cls.kg)
        cls.ecoinvent.ecoinvent_dataset_id, cls.ecoinvent.ecoinvent_version = 1234, '3.12'
        cls.ecoinvent.save()
        cls.data(cls.ecoinvent, cls.a1a3, '0.25')

        machinery = [
            ('Generador de energía eléctrica a base de Diesel, potencia menor a 18.64 kW (GLO)-Ecoinvent 3', '0.0012'),
            ('Maquinaria de carga pesada a base de Diesel, potencia mayor a 74.57 kW (GLO)-Ecoinvent 3', '0.0409'),
            ('Excavadora hidráulica (GLO)', '0.527'),
        ]
        for name, value in machinery:
            source = models.SourceInformation.objects.create(name_source_information=name)
            models.SourceInformationData.objects.create(
                sourceInformarion_id=source, potential_type_id=cls.gwp, unit_id=cls.co2, value=Decimal(value))
        energy = [
            ('Energía eléctrica, Bajo voltaje (MX)-ECOINVENT3', '0.182'),
            ('Energía eléctrica, Bajo voltaje (MX)-MEXICANIUH', '0.6286'),
            ('Calefacción doméstica con gas natural (GLO)', '0.0768'),
        ]
        for name, value in energy:
            kind = models.TypeEnergy.objects.create(name_type_energy=name)
            models.TypeEnergyData.objects.create(
                type_energy_id=kind, potential_type_id=cls.gwp, unit_id=cls.co2, value=Decimal(value))

    @classmethod
    def material(cls, name, database, unit, description=None):
        return models.Material.objects.create(
            name_material=name, database_from=database, unit_id=unit, description=description)

    @classmethod
    def data(cls, material, standard, value, potential=None):
        models.MaterialSchemeData.objects.create(
            material_id=material, standard_id=standard, potential_type_id=potential or cls.gwp,
            unit_id=cls.co2, value=Decimal(value))

    def setUp(self):
        self.client.force_authenticate(user=firebase_user('reader@example.com'))

    def get(self, stage, **params):
        response = self.client.get(URL % stage, params)
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def by_name(self, body):
        return {item['name']: item for item in body['results']}

    # Contract

    def test_production_item_shape(self):
        body = self.get('produccion', search='Clay brick')
        self.assertEqual(body['count'], 1)
        self.assertEqual(body['results'], [{
            'id': self.ecoinvent.id,
            'stage': 'produccion',
            'name': 'Ladrillo_Clay brick',
            'display_name': 'Clay brick',
            'category': 'Ladrillo',
            'description': None,
            'source': 'ECOINVENT 3',
            'unit': 'kg',
            'gwp': 0.25,
            # Its category has 1 item, so it's ranked within all 7 'kg' materials.
            'impact_level': 'bajo',
        }])
        self.assertEqual(set(body), {'count', 'next', 'previous', 'results', 'facets'})

    def test_split_only_materials_add_their_stages(self):
        item = self.by_name(self.get('produccion'))['Acero_Viga split']
        self.assertEqual(item['gwp'], 2.0)

    def test_duplicate_rows_are_read_once(self):
        item = self.by_name(self.get('produccion'))['Acero_Alambre']
        self.assertEqual(item['gwp'], 13.9)

    def test_unit_spellings_merge(self):
        units = {item['unit'] for item in self.get('produccion', search='Bloque')['results']}
        self.assertEqual(units, {'kg'})

    # Ordering

    def test_ordered_by_display_name_with_missing_gwp_last(self):
        names = [item['display_name'] for item in self.get('produccion', page_size=100)['results']]
        self.assertEqual(names[-1], 'Ánfora sin datos')
        self.assertEqual(names[:-1], sorted(names[:-1], key=derive.sort_key))

    def test_sort_by_name_is_the_default(self):
        self.assertEqual(self.get('produccion', sort='nombre'), self.get('produccion'))

    def test_sort_by_impact_groups_by_unit_most_materials_first(self):
        names = [item['name'] for item in self.get('produccion', sort='impacto', page_size=100)['results']]
        self.assertEqual(names, [
            'Ladrillo_Clay brick', *('Concreto_Bloque %s' % i for i in range(6)),  # kg: 7 materials
            'Acero_Viga split', 'Acero_Alambre', 'Ánfora sin datos',  # m²: 3, missing GWP last
        ])

    def test_sort_by_category_then_unit_then_impact(self):
        names = [item['name'] for item in self.get('produccion', sort='categoria', page_size=100)['results']]
        self.assertEqual(names, [
            'Acero_Viga split', 'Acero_Alambre',
            *('Concreto_Bloque %s' % i for i in range(6)),
            'Ladrillo_Clay brick',
            'Ánfora sin datos',  # no category: last
        ])

    def test_unit_order_does_not_depend_on_the_filters(self):
        names = [item['name'] for item in self.get(
            'produccion', sort='impacto', source=['EPDs', 'ECOINVENT 3'], page_size=100)['results']]
        self.assertEqual(names, ['Ladrillo_Clay brick', 'Acero_Viga split', 'Ánfora sin datos'])

    def test_unknown_sort(self):
        self.assertEqual(self.client.get(URL % 'produccion', {'sort': 'precio'}).status_code, 400)

    # Filters and facets

    def test_search_ignores_case_and_accents(self):
        self.assertEqual(self.get('produccion', search='ANFORA')['count'], 1)
        self.assertEqual(self.get('produccion', search='laminada')['count'], 1)  # description

    def test_source_filter_takes_several_values(self):
        body = self.get('produccion', source=['EPDs', 'ECOINVENT 3'])
        self.assertEqual({item['source'] for item in body['results']}, {'EPDs', 'ECOINVENT 3'})
        self.assertEqual(body['count'], 3)

    def test_source_facet_ignores_its_own_filter_but_not_search(self):
        facets = self.get('produccion', source='EPDs')['facets']
        self.assertEqual(facets['sources'], {'EPiC': 7, 'EPDs': 2, 'ECOINVENT 3': 1})
        facets = self.get('produccion', search='Acero')['facets']
        self.assertEqual(facets['sources'], {'EPiC': 1, 'EPDs': 1})

    def test_construction_items_and_type_filter(self):
        body = self.get('construccion')
        self.assertEqual(body['count'], 3)
        self.assertEqual(body['facets'], {'types': {'Generador': 1, 'Maquinaria pesada': 1, 'Otros': 1}})
        excavator = self.by_name(body)['Excavadora hidráulica (GLO)']
        self.assertEqual(excavator['type'], 'Otros')
        self.assertIsNone(excavator['source'])
        # No reference unit in the data (R-04): no unit and no badge.
        self.assertIsNone(excavator['unit'])
        self.assertIsNone(excavator['impact_level'])
        self.assertEqual(self.get('construccion', type='Generador')['count'], 1)

    def test_use_items_and_filters(self):
        body = self.get('uso')
        self.assertEqual(body['facets'], {
            'sources': {'ECOINVENT 3': 1, 'mexicaniuh': 1},
            'types': {'Electricidad': 2, 'Gas': 1},
        })
        self.assertEqual(self.get('uso', source='mexicaniuh')['results'][0]['gwp'], 0.6286)
        self.assertEqual(self.get('uso', type='Gas')['count'], 1)

    def test_end_of_life_is_empty(self):
        self.assertEqual(self.get('fin-de-vida'), {
            'count': 0, 'next': None, 'previous': None, 'results': [], 'facets': {}})

    def test_unknown_stage(self):
        self.assertEqual(self.client.get(URL % 'transporte').status_code, 404)

    # Impact level

    def test_impact_level_over_the_whole_group_not_the_page(self):
        levels = {
            item['name']: item['impact_level']
            for item in self.get('produccion', search='Bloque', page_size=2)['results']}
        self.assertEqual(levels, {'Concreto_Bloque 0': 'bajo', 'Concreto_Bloque 1': 'bajo'})

    # Pagination

    def test_pages_of_24_by_default(self):
        for i in range(30):
            self.material('Relleno_%02d' % i, 'EPiC', self.m2)
        body = self.get('produccion', search='Relleno')
        self.assertEqual((body['count'], len(body['results'])), (30, 24))
        self.assertEqual(len(self.get('produccion', search='Relleno', page=2)['results']), 6)

    def test_page_size_is_capped(self):
        for i in range(101):
            self.material('Relleno_%03d' % i, 'EPiC', self.m2)
        self.assertEqual(len(self.get('produccion', page_size=500)['results']), 100)

    def test_page_out_of_range(self):
        self.assertEqual(self.client.get(URL % 'produccion', {'page': 99}).status_code, 404)

    # Detail

    def test_detail(self):
        response = self.client.get(URL % 'produccion' + '%s/' % self.split.id)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['name'], 'Acero_Viga split')
        self.assertIsNone(body['ecoinvent'])
        self.assertEqual(body['indicators'], [
            {'code': 'PCG 100', 'name': 'Potencial de calentamiento global', 'unit': 'kg CO2 eq',
             'a1': 1.5, 'a2': 0.25, 'a3': 0.25, 'a1_a3': 2.0},
            {'code': 'PA', 'name': 'Potencial de acidificación', 'unit': 'kg SO2 eq',
             'a1': None, 'a2': None, 'a3': 0.031, 'a1_a3': 0.031},
        ])

    def test_detail_of_an_aggregate_ecoinvent_material(self):
        body = self.client.get(URL % 'produccion' + '%s/' % self.ecoinvent.id).json()
        self.assertEqual(body['ecoinvent'], {'dataset_id': 1234, 'version': '3.12', 'system_model': None})
        self.assertEqual(body['indicators'][0]['a1_a3'], 0.25)
        self.assertIsNone(body['indicators'][0]['a1'])

    def test_comparison_within_category_and_unit(self):
        body = self.client.get(URL % 'produccion' + '%s/' % self.aggregate[0].id).json()
        self.assertEqual(body['comparison'], {
            'group': 'Concreto', 'unit': 'kg', 'n': 6, 'mean': 3.5, 'p25': 2.25, 'value': 1.0})

    def test_no_comparison_below_five(self):
        body = self.client.get(URL % 'produccion' + '%s/' % self.split.id).json()
        self.assertIsNone(body['comparison'])

    def test_detail_not_found(self):
        self.assertEqual(self.client.get(URL % 'produccion' + '999999/').status_code, 404)

    # Access

    def test_read_only_even_for_admins(self):
        self.client.force_authenticate(user=admin_user())
        for method in ('post', 'put', 'patch', 'delete'):
            with self.subTest(method=method):
                self.assertEqual(getattr(self.client, method)(URL % 'produccion').status_code, 405)

    def test_readable_like_the_other_catalogues(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(URL % 'produccion').status_code, 200)

    # Performance

    def test_query_count_does_not_grow_with_the_catalogue(self):
        with CaptureQueriesContext(connection) as before:
            self.get('produccion')
        for i in range(20):
            material = self.material('Extra_%s' % i, 'EPiC', self.kg)
            self.data(material, self.a1a3, '1')
        with CaptureQueriesContext(connection) as after:
            self.get('produccion')
        self.assertEqual(len(after), len(before))
