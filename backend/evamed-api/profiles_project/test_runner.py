"""Test runner that switches API throttling off for the suite.

The API tests make hundreds of requests a second from one address, far past
the real rates. profiles_api/tests_throttling.py tests throttling itself with
a real cache.
"""
from django.core.cache.backends.dummy import DummyCache
from django.test.runner import DiscoverRunner
from rest_framework.throttling import SimpleRateThrottle


class NoThrottleTestRunner(DiscoverRunner):

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        # A DummyCache never stores a request history, so nothing is throttled.
        SimpleRateThrottle.cache = DummyCache('throttle-off', {})
