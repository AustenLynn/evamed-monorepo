from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase

from projects_api import access, models
from projects_api.testing import admin_user, firebase_user, owned_project
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


class ProjectOwnershipTests(APITestCase):

    def setUp(self):
        self.alice_project = owned_project('alice@example.com', name='Alice')
        self.bob_project = owned_project('bob@example.com', name='Bob')
        self.rows = {}
        for project, who in ((self.alice_project, 'alice'), (self.bob_project, 'bob')):
            acr = models.AnnualConsumptionRequired.objects.create(project_id=project, quantity=1)
            self.rows[who] = {
                'projects': project.id,
                'material-scheme-project': models.MaterialSchemeProject.objects.create(project_id=project).id,
                'material-scheme-project-original': models.MaterialSchemeProjectOrigianal.objects.create(project_id=project).id,
                'constructive-system-element': models.ConstructiveSystemElement.objects.create(project_id=project).id,
                'annual-consumption-required': acr.id,
                'electricity-consumption-data': models.ElectricityConsumptionData.objects.create(annual_consumption_required_id=acr).id,
                'electricity-consumption-deconstructive-process': models.ElectricityConsumptionDeconstructiveProcess.objects.create(project_id=project).id,
                'treatment-of-generate-wasted': models.TreatmentOfGeneratedWaste.objects.create(project_id=project).id,
            }
        self.assertEqual(set(self.rows['alice']), OWNED_ROUTES)

    def as_alice(self):
        self.client.force_authenticate(user=firebase_user('ALICE@example.com'))  # case-insensitive

    def test_anonymous_gets_401_everywhere(self):
        for prefix in sorted(OWNED_ROUTES):
            with self.subTest(prefix=prefix):
                self.assertEqual(self.client.get('/api-projects/%s/' % prefix).status_code, 401)

    def test_lists_contain_only_own_rows(self):
        self.as_alice()
        for prefix in sorted(OWNED_ROUTES):
            with self.subTest(prefix=prefix):
                ids = {row['id'] for row in self.client.get('/api-projects/%s/' % prefix).data}
                self.assertEqual(ids, {self.rows['alice'][prefix]})

    def test_other_users_rows_are_invisible_and_untouchable(self):
        self.as_alice()
        for prefix in sorted(OWNED_ROUTES):
            url = '/api-projects/%s/%s/' % (prefix, self.rows['bob'][prefix])
            with self.subTest(prefix=prefix):
                self.assertEqual(self.client.get(url).status_code, 404)
                self.assertEqual(self.client.patch(url, {}, format='json').status_code, 404)
                self.assertEqual(self.client.delete(url).status_code, 404)

    def test_cannot_create_rows_in_someone_elses_project(self):
        self.as_alice()
        payload = {'project_id': self.bob_project.id, 'quantity': 1, 'unit_id': None}
        response = self.client.post('/api-projects/annual-consumption-required/', payload, format='json')
        self.assertEqual(response.status_code, 403)

    def test_can_create_rows_in_own_project(self):
        self.as_alice()
        payload = {'project_id': self.alice_project.id, 'quantity': 1, 'unit_id': None}
        response = self.client.post('/api-projects/annual-consumption-required/', payload, format='json')
        self.assertEqual(response.status_code, 201)

    def test_projects_can_only_be_created_for_yourself(self):
        self.as_alice()
        payload = {
            'name_project': 'New', 'use_id': None, 'type_id': None, 'country_id': None,
            'builded_surface': None, 'living_area': None, 'tier': None,
            'useful_life_id': None, 'housing_scheme_id': None, 'city_id_origin': None,
            'distance': None,
        }
        mine = dict(payload, user_platform_id=self.alice_project.user_platform_id.id)
        theirs = dict(payload, user_platform_id=self.bob_project.user_platform_id.id)
        self.assertEqual(self.client.post('/api-projects/projects/', mine, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api-projects/projects/', theirs, format='json').status_code, 403)

    def test_results_are_owner_only(self):
        # The owner's 200 path is covered by tests_project_results (which signs in as the owner).
        self.as_alice()
        self.assertEqual(self.client.get('/api-projects/projects/%s/results/' % self.bob_project.id).status_code, 404)

    def test_materials_stage_is_owner_only(self):
        self.as_alice()
        section = models.Section.objects.create(name_section='S')
        get_theirs = self.client.get('/api-projects/materials-stage/', {'project_id': self.bob_project.id})
        post_theirs = self.client.post('/api-projects/materials-stage/', {
            'project_id': self.bob_project.id,
            'items': [{'section_id': section.id, 'label': 'Muro'}],
        }, format='json')
        patch_theirs = self.client.patch('/api-projects/materials-stage/update/', {
            'project_id': self.bob_project.id, 'selectedIds': [],
        }, format='json')
        self.assertEqual(get_theirs.status_code, 404)
        self.assertEqual(post_theirs.status_code, 400)
        self.assertEqual(patch_theirs.status_code, 400)
        self.assertEqual(self.client.get('/api-projects/materials-stage/', {'project_id': 'abc'}).status_code, 404)

    def test_unverified_password_email_owns_nothing(self):
        # An unverified password account only proves someone typed the address;
        # it must not be trusted to own the real Alice's project data.
        self.client.force_authenticate(user=firebase_user('alice@example.com', verified=False))

        self.assertEqual(list(self.client.get('/api-projects/projects/').data), [])
        self.assertEqual(list(self.client.get('/api-projects/material-scheme-project/').data), [])
        self.assertEqual(
            self.client.get('/api-projects/projects/%s/results/' % self.alice_project.id).status_code, 404
        )

        payload = {
            'name_project': 'New', 'use_id': None, 'type_id': None, 'country_id': None,
            'builded_surface': None, 'living_area': None, 'tier': None,
            'useful_life_id': None, 'housing_scheme_id': None, 'city_id_origin': None,
            'distance': None, 'user_platform_id': self.alice_project.user_platform_id.id,
        }
        response = self.client.post('/api-projects/projects/', payload, format='json')
        self.assertEqual(response.status_code, 403)

    def test_unverified_oauth_email_still_owns_her_project(self):
        # OAuth providers take the email from the provider account, so it's
        # trustworthy even when Firebase reports email_verified=False.
        self.client.force_authenticate(
            user=firebase_user('alice@example.com', verified=False, provider='facebook.com')
        )
        ids = {row['id'] for row in self.client.get('/api-projects/projects/').data}
        self.assertEqual(ids, {self.alice_project.id})
