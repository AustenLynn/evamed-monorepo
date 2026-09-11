from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from profiles_api.models import UserProfile


class GrantAdminTests(TestCase):

    def run_command(self, *args):
        out = StringIO()
        call_command('grant_admin', *args, stdout=out)
        return out.getvalue()

    def test_creates_staff_profile_with_unusable_password(self):
        self.assertIn('granted', self.run_command('Boss@Example.com'))
        profile = UserProfile.objects.get(email='boss@example.com')
        self.assertTrue(profile.is_staff)
        self.assertFalse(profile.has_usable_password())

    def test_promotes_existing_profile(self):
        UserProfile.objects.create_user(email='boss@example.com', name='Boss')
        self.run_command('boss@example.com')
        self.assertEqual(UserProfile.objects.filter(email__iexact='boss@example.com').count(), 1)
        self.assertTrue(UserProfile.objects.get(email='boss@example.com').is_staff)

    def test_revoke(self):
        self.run_command('boss@example.com')
        self.assertIn('revoked', self.run_command('boss@example.com', '--revoke'))
        self.assertFalse(UserProfile.objects.get(email='boss@example.com').is_staff)


class ProfilesApiRemovedTests(TestCase):

    def test_api_profiles_is_gone(self):
        for path in ('/api-profiles/login/', '/api-profiles/profile/', '/api-profiles/hello-view/'):
            with self.subTest(path=path):
                self.assertEqual(APIClient().get(path).status_code, 404)
