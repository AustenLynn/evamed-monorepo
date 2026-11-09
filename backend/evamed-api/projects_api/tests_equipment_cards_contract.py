"""Pin the nullable-unit, zero-quantity contract used by equipment cards."""
from rest_framework.test import APITestCase

from profiles_api.models import UserProfile
from projects_api import models


class EquipmentCardsContractTests(APITestCase):
    def setUp(self):
        email = 'equipment-contract@example.com'
        user = UserProfile.objects.create_user(email=email, name='Equipment')
        self.client.force_authenticate(user=user)
        owner = models.UserPlatform.objects.create(name='Equipment', email=email)
        self.project = models.Project.objects.create(name_project='Equipment', user_platform_id=owner)
        self.section = models.Section.objects.create(name_section='Equipment')
        self.source = models.SourceInformation.objects.create(name_source_information='Generador')
        self.process = models.ConstructiveProcess.objects.create(
            name_constructive_process='Energía consumida durante el proceso constructivo')

    def test_zero_quantity_and_null_unit_post_patch_reload(self):
        for route, unit_field, model in [
            ('constructive-system-element', 'energy_unit_id', models.ConstructiveSystemElement),
            ('electricity-consumption-deconstructive-process', 'unit_id',
             models.ElectricityConsumptionDeconstructiveProcess),
        ]:
            with self.subTest(route=route):
                url = '/api-projects/%s/' % route
                payload = {
                    'project_id': self.project.id, 'section_id': self.section.id,
                    'source_information_id': self.source.id, 'quantity': 0,
                    unit_field: None,
                }
                if route == 'constructive-system-element':
                    payload['constructive_process_id'] = self.process.id
                    payload['volume_unit_id'] = None
                    payload['bulk_unit_id'] = None
                created = self.client.post(url, payload, format='json')
                self.assertEqual(created.status_code, 201, created.data)
                row_id = created.data['id']
                detail = '%s%s/' % (url, row_id)
                patched = self.client.patch(detail, {'quantity': 0, unit_field: None}, format='json')
                self.assertEqual(patched.status_code, 200, patched.data)
                reloaded = self.client.get(detail)
                self.assertEqual(reloaded.status_code, 200)
                self.assertEqual(reloaded.data['id'], row_id)
                self.assertIsNone(reloaded.data[unit_field])
                row = model.objects.get(pk=row_id)
                self.assertEqual(row.quantity, 0)
                self.assertIsNone(getattr(row, unit_field))

    def test_end_life_fractional_quantity_is_rejected(self):
        response = self.client.post(
            '/api-projects/electricity-consumption-deconstructive-process/',
            {'project_id': self.project.id, 'section_id': self.section.id,
             'source_information_id': self.source.id, 'quantity': 1.2, 'unit_id': None},
            format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('quantity', response.data)
