from rest_framework import status
from rest_framework.test import APITestCase

from projects_api import models
from projects_api.testing import firebase_user, owned_project


class MaterialSchemeReplaceTests(APITestCase):
    def setUp(self):
        self.project = owned_project('alice@example.com')
        self.section = models.Section.objects.create(name_section='Cimentación')
        self.revit = models.Origin.objects.create(name_origin='Modelo de Revit')
        self.dynamo = models.Origin.objects.create(name_origin='Opciones EVAMED')
        self.user_origin = models.Origin.objects.create(name_origin='Usuario_Plataforma')
        self.concreto = models.Material.objects.create(name_material='Concreto')
        self.url = '/api-projects/projects/%d/material-scheme/' % self.project.id
        self.client.force_authenticate(user=firebase_user('alice@example.com'))

    def item(self, origin, system='Muro A', quantity='12.5'):
        return {
            'construction_system': system,
            'comercial_name': 'Concreto',
            'quantity': quantity,
            'provider_distance': 0,
            'material_id': self.concreto.id,
            'origin_id': origin.id,
            'section_id': self.section.id,
            'value': None,
            'distance_init': 0,
            'distance_end': 0,
            'replaces': 0,
            'city_id_origin': None,
            'state_id_origin': None,
            'city_id_end': None,
            'transport_id_origin': None,
            'transport_id_end': None,
            'unit_text': 'm3',
            'description_material': '',
        }

    def rows(self, origin):
        return models.MaterialSchemeProject.objects.filter(project_id=self.project, origin_id=origin)

    def put(self, items, origins=None, sections=None):
        origins = origins or [self.revit.id, self.dynamo.id]
        sections = sections or [self.section.id]
        return self.client.put(self.url, {'origins': origins, 'sections': sections, 'items': items}, format='json')

    def test_replaces_rows_of_the_given_origins_and_is_idempotent(self):
        models.MaterialSchemeProject.objects.create(project_id=self.project, origin_id=self.revit, section_id=self.section, construction_system='Viejo')
        items = [self.item(self.revit), self.item(self.dynamo, system='Losa')]

        for _ in range(3):
            response = self.put(items)
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(list(self.rows(self.revit).values_list('construction_system', flat=True)), ['Muro A'])
        self.assertEqual(list(self.rows(self.dynamo).values_list('construction_system', flat=True)), ['Losa'])
        self.assertEqual(len(response.data['items']), 2)

    def test_keeps_rows_of_other_origins(self):
        models.MaterialSchemeProject.objects.create(project_id=self.project, origin_id=self.user_origin, construction_system='Propio')

        self.put([self.item(self.revit)])

        self.assertEqual(self.rows(self.user_origin).count(), 1)

    def test_keeps_legitimate_duplicates_sent_by_the_page(self):
        self.put([self.item(self.revit), self.item(self.revit)])

        self.assertEqual(self.rows(self.revit).count(), 2)

    def test_accepts_empty_text_cells_from_the_excel(self):
        row = dict(self.item(self.revit), comercial_name='', unit_text='', description_material='', construction_system='')

        response = self.put([row])

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.rows(self.revit).count(), 1)

    def test_an_empty_list_clears_the_given_origins(self):
        models.MaterialSchemeProject.objects.create(project_id=self.project, origin_id=self.revit, section_id=self.section)

        response = self.put([])

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.rows(self.revit).count(), 0)

    def test_rejects_an_item_outside_the_given_origins_and_changes_nothing(self):
        models.MaterialSchemeProject.objects.create(project_id=self.project, origin_id=self.revit, construction_system='Viejo')

        response = self.put([self.item(self.revit), self.item(self.user_origin)])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(list(self.rows(self.revit).values_list('construction_system', flat=True)), ['Viejo'])

    def test_another_users_project_is_not_found(self):
        self.client.force_authenticate(user=firebase_user('mallory@example.com'))

        response = self.put([self.item(self.revit)])

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.rows(self.revit).count(), 0)

    def test_unverified_email_is_not_the_owner(self):
        self.client.force_authenticate(user=firebase_user('alice@example.com', verified=False))

        self.assertEqual(self.put([self.item(self.revit)]).status_code, status.HTTP_404_NOT_FOUND)

    def test_only_the_given_sections_are_replaced(self):
        # A page that has only loaded some sheets must not clear the others.
        other = models.Section.objects.create(name_section='Techos')
        models.MaterialSchemeProject.objects.create(project_id=self.project, origin_id=self.revit, section_id=other, construction_system='Techo')

        self.put([self.item(self.revit)])

        self.assertEqual(self.rows(self.revit).filter(section_id=other).count(), 1)
        self.assertEqual(self.rows(self.revit).filter(section_id=self.section).count(), 1)

    def test_rejects_an_item_outside_the_given_sections_and_changes_nothing(self):
        other = models.Section.objects.create(name_section='Techos')
        models.MaterialSchemeProject.objects.create(project_id=self.project, origin_id=self.revit, section_id=self.section, construction_system='Viejo')

        response = self.put([dict(self.item(self.revit), section_id=other.id)])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(list(self.rows(self.revit).values_list('construction_system', flat=True)), ['Viejo'])

    def test_saves_the_valid_rows_and_reports_the_invalid_ones(self):
        # One bad Excel cell used to lose only its own row; it must not block the rest.
        bad_replaces = dict(self.item(self.revit, system='Malo 1'), replaces='2.5')
        bad_transport = dict(self.item(self.revit, system='Malo 2'), transport_id_origin=999999)

        response = self.put([self.item(self.revit), bad_replaces, bad_transport])

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(list(self.rows(self.revit).values_list('construction_system', flat=True)), ['Muro A'])
        self.assertEqual([s['index'] for s in response.data['skipped']], [1, 2])

    def test_rounds_quantities_longer_than_the_column(self):
        response = self.put([self.item(self.revit, quantity='0.000012345678901234567891')])

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # The response holds the value written; SQLite (local runs) stores decimals as floats.
        self.assertEqual(response.data['items'][0]['quantity'], '0.00001234567890123457')

    def test_anonymous_is_rejected(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(self.put([]).status_code, status.HTTP_401_UNAUTHORIZED)
