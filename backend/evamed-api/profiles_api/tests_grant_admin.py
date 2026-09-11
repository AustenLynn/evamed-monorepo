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

    def test_revoke_without_a_profile_says_nothing_was_revoked(self):
        out = self.run_command('nobody@example.com', '--revoke')
        self.assertIn('no admin profile for nobody@example.com; nothing revoked', out)
        self.assertNotIn('revoked admin', out)
        self.assertFalse(UserProfile.objects.filter(email__iexact='nobody@example.com').exists())

    def test_granting_twice_with_different_case_keeps_one_profile(self):
        self.run_command('Boss@x.com')
        self.run_command('boss@x.com')
        self.assertEqual(UserProfile.objects.filter(email__iexact='boss@x.com').count(), 1)

    def test_granting_reactivates_an_inactive_profile(self):
        profile = UserProfile.objects.create_user(email='boss@example.com', name='Boss')
        profile.is_active = False
        profile.save()
        self.run_command('boss@example.com')
        profile.refresh_from_db()
        self.assertTrue(profile.is_active)
        self.assertTrue(profile.is_staff)


class ProfilesApiRemovedTests(TestCase):

    def test_api_profiles_is_gone(self):
        for path in ('/api-profiles/login/', '/api-profiles/profile/', '/api-profiles/hello-view/'):
            with self.subTest(path=path):
                self.assertEqual(APIClient().get(path).status_code, 404)
