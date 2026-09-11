from unittest import mock

from django.test import TestCase
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory

from profiles_api.authentication import FirebaseAuthentication, FirebaseUser
from profiles_api.models import UserProfile


def bearer_request(token='valid-token'):
    return APIRequestFactory().get('/', HTTP_AUTHORIZATION='Bearer ' + token)


@mock.patch('profiles_api.authentication._get_firebase_app', return_value=None)
class FirebaseAuthenticationTests(TestCase):

    def setUp(self):
        self.admin = UserProfile.objects.create_user(email='admin@example.com', name='Admin')
        self.admin.is_staff = True
        self.admin.save()

    def authenticate(self, claims):
        with mock.patch('firebase_admin.auth.verify_id_token', return_value=claims):
            return FirebaseAuthentication().authenticate(bearer_request())

    def test_no_bearer_header_is_anonymous(self, _app):
        self.assertIsNone(FirebaseAuthentication().authenticate(APIRequestFactory().get('/')))

    def test_invalid_token_is_rejected(self, _app):
        with mock.patch('firebase_admin.auth.verify_id_token', side_effect=ValueError('bad')):
            with self.assertRaises(AuthenticationFailed):
                FirebaseAuthentication().authenticate(bearer_request())

    def test_verified_email_bridges_to_django_user(self, _app):
        user, _ = self.authenticate({'uid': 'u1', 'email': 'Admin@Example.com', 'email_verified': True})
        self.assertEqual(user, self.admin)
        self.assertTrue(user.is_staff)

    def test_unverified_email_never_bridges(self, _app):
        user, _ = self.authenticate({'uid': 'u1', 'email': 'admin@example.com', 'email_verified': False})
        self.assertIsInstance(user, FirebaseUser)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.email_verified)

    def test_inactive_django_user_is_not_bridged(self, _app):
        self.admin.is_active = False
        self.admin.save()
        user, _ = self.authenticate({'uid': 'u1', 'email': 'admin@example.com', 'email_verified': True})
        self.assertIsInstance(user, FirebaseUser)

    def test_unknown_verified_email_is_plain_firebase_user(self, _app):
        user, _ = self.authenticate({'uid': 'u2', 'email': 'someone@example.com', 'email_verified': True})
        self.assertIsInstance(user, FirebaseUser)
        self.assertEqual(user.email, 'someone@example.com')
        self.assertTrue(user.email_verified)
        self.assertFalse(user.is_staff)

    def test_missing_credentials_answer_401(self, _app):
        self.assertEqual(FirebaseAuthentication().authenticate_header(None), 'Bearer')
