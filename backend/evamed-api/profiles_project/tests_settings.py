"""Settings-level checks for the proxy/CSRF configuration the admin depends on.

Render terminates TLS in front of gunicorn, so Django only sees an http
request while the browser sends an https `Origin` header. Django 4.0+ compares
the two on every unsafe request, so the admin (login included) 403s unless the
forwarded scheme is trusted and the site's own origin is listed.
"""

import json
import os
import subprocess
import sys

from django.conf import settings
from django.test import SimpleTestCase


def _csrf_trusted_origins_with(value):
    """Load settings in a fresh interpreter and return CSRF_TRUSTED_ORIGINS."""
    env = os.environ.copy()
    env['DJANGO_SETTINGS_MODULE'] = 'profiles_project.settings'
    env.pop('CSRF_TRUSTED_ORIGINS', None)
    if value is not None:
        env['CSRF_TRUSTED_ORIGINS'] = value
    code = (
        'import json\n'
        'from django.conf import settings\n'
        'print(json.dumps(list(settings.CSRF_TRUSTED_ORIGINS)))\n'
    )
    out = subprocess.check_output(
        [sys.executable, '-c', code], env=env, cwd=settings.BASE_DIR
    )
    return json.loads(out.decode().strip().splitlines()[-1])


class ProxyCsrfSettingsTests(SimpleTestCase):
    def test_secure_proxy_ssl_header_trusts_forwarded_scheme(self):
        self.assertEqual(
            settings.SECURE_PROXY_SSL_HEADER,
            ('HTTP_X_FORWARDED_PROTO', 'https'),
        )

    def test_csrf_trusted_origins_parsed_from_environment(self):
        self.assertEqual(
            _csrf_trusted_origins_with('https://a.example.com, https://b.example.com'),
            ['https://a.example.com', 'https://b.example.com'],
        )

    def test_csrf_trusted_origins_empty_when_unset(self):
        self.assertEqual(_csrf_trusted_origins_with(None), [])


class DatabaseEngineSettingsTests(SimpleTestCase):
    def test_uses_modern_postgresql_engine_path(self):
        self.assertEqual(
            settings.DATABASES['default']['ENGINE'],
            'django.db.backends.postgresql',
        )
