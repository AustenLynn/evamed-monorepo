from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase

from projects_api import access
from projects_api.testing import admin_user, firebase_user
from projects_api.urls import router

CATALOGUE_ROUTES = {
    'transports', 'uses', 'type-project', 'countries', 'external-distance',
    'useful-life', 'housing-scheme', 'materials', 'sections', 'origins',
    'units', 'standards', 'potential-types', 'volume-units', 'energy-units',
    'bulk-units', 'source-information', 'constructive-process',
    'material-scheme-data', 'sources-electricity-consumption',
    'stage-scheme-data', 'type-energy', 'source-information-data',
    'type-energy-data', 'states', 'cities', 'local-distances',
    'potential-transport', 'conversions', 'database-material',
}
OWNED_ROUTES = {
    'projects', 'material-scheme-project', 'material-scheme-project-original',
    'constructive-system-element', 'annual-consumption-required',
    'electricity-consumption-data',
    'electricity-consumption-deconstructive-process',
    'treatment-of-generate-wasted',
}
USER_ROUTES = {'users-platform'}


def viewset_for(prefix):
    return next(viewset for p, viewset, _ in router.registry if p == prefix)


class RouteClassificationTests(SimpleTestCase):
    """New routes must be classified here on purpose, not by accident."""

    def test_every_route_is_classified_exactly_once(self):
        registered = {prefix for prefix, _, _ in router.registry}
        self.assertEqual(registered, CATALOGUE_ROUTES | OWNED_ROUTES | USER_ROUTES)
        self.assertFalse(CATALOGUE_ROUTES & OWNED_ROUTES)

    def test_catalogue_viewsets_are_admin_write(self):
        for prefix in sorted(CATALOGUE_ROUTES):
            with self.subTest(prefix=prefix):
                self.assertIn(access.IsAdminOrReadOnly, viewset_for(prefix).permission_classes)


class CataloguePermissionTests(APITestCase):

    def test_anonymous_can_read_every_catalogue_route(self):
        for prefix in sorted(CATALOGUE_ROUTES):
            with self.subTest(prefix=prefix):
                self.assertEqual(self.client.get('/api-projects/%s/' % prefix).status_code, 200)

    def test_anonymous_cannot_write(self):
        for prefix in sorted(CATALOGUE_ROUTES):
            with self.subTest(prefix=prefix):
                response = self.client.post('/api-projects/%s/' % prefix, {}, format='json')
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_signed_in_non_admin_cannot_write(self):
        self.client.force_authenticate(user=firebase_user('user@example.com'))
        for prefix in sorted(CATALOGUE_ROUTES):
            with self.subTest(prefix=prefix):
                response = self.client.post('/api-projects/%s/' % prefix, {}, format='json')
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_write(self):
        self.client.force_authenticate(user=admin_user())
        response = self.client.post('/api-projects/units/', {'name_unit': 'kWh'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_unverified_email_is_never_admin(self):
        self.assertFalse(access.is_admin(firebase_user('admin@example.com', verified=False)))
