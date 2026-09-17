import json
import os
import subprocess
import sys
from unittest import mock

from django.conf import settings
from django.test import SimpleTestCase

from profiles_project.env import env_bool, env_list


class EnvListTests(SimpleTestCase):
    def test_splits_and_strips_comma_separated_values(self):
        with mock.patch.dict(os.environ, {'X_TEST_LIST': ' a.com, localhost ,,'}):
            self.assertEqual(env_list('X_TEST_LIST'), ['a.com', 'localhost'])

    def test_uses_default_when_unset(self):
        with mock.patch.dict(os.environ):
            os.environ.pop('X_TEST_LIST', None)
            self.assertEqual(env_list('X_TEST_LIST', '*'), ['*'])

    def test_empty_value_gives_empty_list(self):
        with mock.patch.dict(os.environ, {'X_TEST_LIST': ''}):
            self.assertEqual(env_list('X_TEST_LIST', '*'), [])


class EnvBoolTests(SimpleTestCase):
    def test_truthy_spellings(self):
        for raw in ('True', 'true', '1', 'yes', ' on '):
            with mock.patch.dict(os.environ, {'X_TEST_BOOL': raw}):
                self.assertTrue(env_bool('X_TEST_BOOL'), raw)

    def test_other_values_are_false(self):
        for raw in ('False', '0', 'no', ''):
            with mock.patch.dict(os.environ, {'X_TEST_BOOL': raw}):
                self.assertFalse(env_bool('X_TEST_BOOL', default=True), raw)

    def test_uses_default_when_unset(self):
        with mock.patch.dict(os.environ):
            os.environ.pop('X_TEST_BOOL', None)
            self.assertTrue(env_bool('X_TEST_BOOL', default=True))


class SettingsFromEnvTests(SimpleTestCase):
    """Load settings.py in a fresh interpreter so module-level reads see our env."""

    def load_settings(self, **overrides):
        env = {k: v for k, v in os.environ.items() if not k.startswith('DJANGO_')}
        env.update(DJANGO_SETTINGS_MODULE='profiles_project.settings', **overrides)
        code = (
            'import json; from django.conf import settings as s; '
            'print(json.dumps({"key": s.SECRET_KEY, "hosts": s.ALLOWED_HOSTS, '
            '"proxy": getattr(s, "SECURE_PROXY_SSL_HEADER", None)}))'
        )
        out = subprocess.check_output([sys.executable, '-c', code], env=env, cwd=settings.BASE_DIR)
        return json.loads(out)

    def test_defaults_match_previous_behaviour(self):
        loaded = self.load_settings()
        self.assertEqual(loaded['hosts'], ['*'])
        self.assertIsNone(loaded['proxy'])

    def test_secret_key_from_env(self):
        self.assertEqual(self.load_settings(DJANGO_SECRET_KEY='from-env')['key'], 'from-env')

    def test_allowed_hosts_from_env(self):
        loaded = self.load_settings(DJANGO_ALLOWED_HOSTS='dev.example.com,localhost')
        self.assertEqual(loaded['hosts'], ['dev.example.com', 'localhost'])

    def test_trusts_forwarded_proto_behind_tls_proxy(self):
        loaded = self.load_settings(DJANGO_BEHIND_TLS_PROXY='True')
        self.assertEqual(loaded['proxy'], ['HTTP_X_FORWARDED_PROTO', 'https'])
