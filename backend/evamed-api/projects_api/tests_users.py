from django.core.exceptions import FieldDoesNotExist
from rest_framework.test import APITestCase

from projects_api import models
from projects_api.testing import admin_user, firebase_user, platform_user

PROFILE = {'name': 'Alice', 'institution': 'UNAM', 'sector': 'Academia', 'country': 'México'}


class UserPlatformTests(APITestCase):

    def setUp(self):
        self.alice = platform_user('alice@example.com')
        self.bob = platform_user('bob@example.com')

    def test_anonymous_cannot_register_a_profile(self):
        response = self.client.post('/api-projects/users-platform/', dict(PROFILE, email='x@example.com'), format='json')
        self.assertEqual(response.status_code, 401)

    def test_signed_in_user_registers_own_profile_without_password(self):
        self.client.force_authenticate(user=firebase_user('carol@example.com'))
        response = self.client.post('/api-projects/users-platform/', dict(PROFILE, email='Carol@example.com'), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertNotIn('password', response.data)

    def test_cannot_register_a_profile_for_another_email(self):
        self.client.force_authenticate(user=firebase_user('carol@example.com'))
        response = self.client.post('/api-projects/users-platform/', dict(PROFILE, email='bob@example.com'), format='json')
        self.assertEqual(response.status_code, 403)

    def test_search_only_finds_yourself(self):
        self.client.force_authenticate(user=firebase_user('alice@example.com'))
        own = self.client.get('/api-projects/users-platform/', {'search': 'alice@example.com'}).data
        other = self.client.get('/api-projects/users-platform/', {'search': 'bob@example.com'}).data
        self.assertEqual([row['id'] for row in own], [self.alice.id])
        self.assertEqual(other, [])

    def test_admin_lists_everyone(self):
        self.client.force_authenticate(user=admin_user())
        ids = {row['id'] for row in self.client.get('/api-projects/users-platform/').data}
        self.assertEqual(ids, {self.alice.id, self.bob.id})

    def test_password_is_gone_from_model_and_api(self):
        with self.assertRaises(FieldDoesNotExist):
            models.UserPlatform._meta.get_field('password')
        self.client.force_authenticate(user=admin_user())
        for row in self.client.get('/api-projects/users-platform/').data:
            self.assertNotIn('password', row)

    def test_unverified_password_user_can_register_and_read_own_profile(self):
        # Registration and the email-verification banner depend on an
        # unverified email/password user still being able to register and
        # read their own profile; only project data needs a trusted email.
        self.client.force_authenticate(user=firebase_user('dave@example.com', verified=False))
        response = self.client.post('/api-projects/users-platform/', dict(PROFILE, email='dave@example.com'), format='json')
        self.assertEqual(response.status_code, 201)
        rows = self.client.get('/api-projects/users-platform/', {'search': 'dave@example.com'}).data
        self.assertEqual([row['id'] for row in rows], [response.data['id']])

    def bob_row(self):
        return '/api-projects/users-platform/%s/' % self.bob.id

    def test_unverified_claimant_cannot_change_or_delete_the_real_profile(self):
        project = models.Project.objects.create(name_project='Bob', user_platform_id=self.bob)
        self.client.force_authenticate(user=firebase_user('bob@example.com', verified=False))
        patch = self.client.patch(self.bob_row(), {'name': 'Mallory'}, format='json')
        delete = self.client.delete(self.bob_row())
        self.assertEqual(patch.status_code, 404)
        self.assertEqual(delete.status_code, 405)
        self.bob.refresh_from_db()
        self.assertEqual(self.bob.name, 'bob')
        self.assertTrue(models.Project.objects.filter(id=project.id).exists())

    def test_verified_user_updates_own_profile_but_cannot_delete_it(self):
        self.client.force_authenticate(user=firebase_user('bob@example.com'))
        patch = self.client.patch(self.bob_row(), {'name': 'Robert'}, format='json')
        delete = self.client.delete(self.bob_row())
        self.assertEqual(patch.status_code, 200)
        self.assertEqual(delete.status_code, 405)
        self.bob.refresh_from_db()
        self.assertEqual(self.bob.name, 'Robert')

    def test_admin_reads_but_cannot_change_or_delete_another_profile(self):
        self.client.force_authenticate(user=admin_user())
        self.assertEqual(self.client.get(self.bob_row()).status_code, 200)
        self.assertEqual(self.client.patch(self.bob_row(), {'name': 'X'}, format='json').status_code, 404)
        self.assertEqual(self.client.delete(self.bob_row()).status_code, 405)
        self.assertTrue(models.UserPlatform.objects.filter(id=self.bob.id).exists())

    def test_unverified_user_cannot_register_an_email_that_already_has_a_profile(self):
        self.client.force_authenticate(user=firebase_user('Bob@example.com', verified=False))
        response = self.client.post('/api-projects/users-platform/', dict(PROFILE, email='BOB@example.com'), format='json')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(models.UserPlatform.objects.filter(email__iexact='bob@example.com').count(), 1)


class MeTests(APITestCase):

    def test_anonymous_gets_401(self):
        self.assertEqual(self.client.get('/api-projects/me/').status_code, 401)

    def test_regular_user(self):
        self.client.force_authenticate(user=firebase_user('Alice@example.com', verified=False))
        self.assertEqual(self.client.get('/api-projects/me/').data,
                         {'email': 'alice@example.com', 'is_admin': False, 'email_verified': False})

    def test_admin(self):
        self.client.force_authenticate(user=admin_user('boss@example.com'))
        self.assertEqual(self.client.get('/api-projects/me/').data,
                         {'email': 'boss@example.com', 'is_admin': True, 'email_verified': True})
