from unittest import mock

from django.core.cache.backends.locmem import LocMemCache
from rest_framework.test import APITestCase
from rest_framework.throttling import SimpleRateThrottle

from projects_api.testing import admin_user, firebase_user

URL = '/api-projects/units/'   # public catalogue read: 200 for anyone


class ThrottleTests(APITestCase):

    def setUp(self):
        # The suite's runner switches throttling off; give each test a real,
        # private cache and tiny rates.
        for patcher in (
            mock.patch.object(SimpleRateThrottle, 'cache', LocMemCache(self.id(), {})),
            mock.patch.object(SimpleRateThrottle, 'THROTTLE_RATES', {'anon': '3/minute', 'user': '3/minute'}),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def statuses(self, n, **extra):
        return [self.client.get(URL, **extra).status_code for _ in range(n)]

    def test_anonymous_callers_are_throttled(self):
        self.assertEqual(self.statuses(4), [200, 200, 200, 429])

    def test_anonymous_address_comes_from_the_proxy_header(self):
        self.assertEqual(self.statuses(4, HTTP_X_FORWARDED_FOR='203.0.113.1'), [200, 200, 200, 429])
        self.assertEqual(self.statuses(1, HTTP_X_FORWARDED_FOR='203.0.113.2'), [200])

    def test_each_signed_in_user_has_their_own_allowance(self):
        self.client.force_authenticate(firebase_user('alice@example.com'))
        self.assertEqual(self.statuses(4), [200, 200, 200, 429])
        self.client.force_authenticate(firebase_user('bob@example.com'))
        self.assertEqual(self.statuses(1), [200])

    def test_admins_are_throttled_by_profile(self):
        self.client.force_authenticate(admin_user())
        self.assertEqual(self.statuses(4), [200, 200, 200, 429])

    def test_health_check_is_never_throttled(self):
        for _ in range(5):
            self.assertEqual(self.client.get('/api/health/').status_code, 200)
