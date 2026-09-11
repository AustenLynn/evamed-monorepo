"""Characterisation tests: pin API behaviour that framework upgrades could change.

They describe what the API does today, not what it ideally should do. If one
fails after an upgrade, the upgrade changed observable behaviour, so decide
deliberately whether to accept it.
"""
from decimal import Decimal

from rest_framework.test import APITestCase

from profiles_api.models import UserProfile
from projects_api import models
from projects_api.urls import router

EMAIL = 'contract@example.com'


class ApiContractTests(APITestCase):

    def setUp(self):
        # An admin who also owns the test data, so these pass with or without
        # the authorization plan applied.
        admin = UserProfile.objects.create_user(email=EMAIL, name='Contract')
        admin.is_staff = True
        admin.save()
        self.client.force_authenticate(user=admin)
        self.owner = models.UserPlatform.objects.create(name='Contract', email=EMAIL)

    def test_every_router_route_lists(self):
        for prefix, _, _ in router.registry:
            with self.subTest(prefix=prefix):
                response = self.client.get('/api-projects/%s/' % prefix)
                self.assertEqual(response.status_code, 200)
                self.assertIsInstance(response.json(), list)

    def test_decimal_fields_render_as_fixed_point_strings(self):
        project = models.Project.objects.create(
            name_project='P', user_platform_id=self.owner, distance=Decimal('1.5'))
        body = self.client.get('/api-projects/projects/%s/' % project.id).json()
        self.assertEqual(body['distance'], '1.' + '5'.ljust(35, '0'))  # decimal_places=35

    def test_foreign_keys_render_as_ids(self):
        project = models.Project.objects.create(name_project='P', user_platform_id=self.owner)
        body = self.client.get('/api-projects/projects/%s/' % project.id).json()
        self.assertEqual(body['user_platform_id'], self.owner.id)
        self.assertIsNone(body['use_id'])

    def test_exact_search_by_email_and_by_id(self):
        project = models.Project.objects.create(name_project='P', user_platform_id=self.owner)
        users = self.client.get('/api-projects/users-platform/', {'search': EMAIL}).json()
        projects = self.client.get('/api-projects/projects/', {'search': str(project.id)}).json()
        self.assertEqual([u['id'] for u in users], [self.owner.id])
        self.assertEqual([p['id'] for p in projects], [project.id])

    def test_validation_errors_are_keyed_by_field(self):
        body = self.client.post('/api-projects/units/', {}, format='json').json()
        self.assertEqual(list(body), ['name_unit'])

    def test_health(self):
        self.assertEqual(self.client.get('/api/health/').json(), {'status': 'ok'})
