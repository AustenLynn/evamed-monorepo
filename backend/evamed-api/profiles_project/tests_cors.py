from django.test import SimpleTestCase

LOCAL = ('http://localhost', 'http://localhost:4200', 'http://localhost:8080', 'http://localhost:8000')
RETIRED = ('http://54.224.175.163', 'http://172.16.3.134:8080', 'http://172.16.3.136', 'http://0.0.0.0:8080')


class CorsTests(SimpleTestCase):

    def preflight(self, origin):
        return self.client.options(
            '/api-projects/units/', HTTP_ORIGIN=origin, HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET')

    def test_local_frontends_are_allowed(self):
        for origin in LOCAL:
            with self.subTest(origin=origin):
                self.assertEqual(self.preflight(origin)['Access-Control-Allow-Origin'], origin)

    def test_retired_hosts_are_not(self):
        for origin in RETIRED:
            with self.subTest(origin=origin):
                self.assertFalse(self.preflight(origin).has_header('Access-Control-Allow-Origin'))
