"""ECO authorization: catalog routes, project children and computed/export paths."""
from django.contrib.auth.models import AnonymousUser
from django.test import SimpleTestCase
from rest_framework.test import APITestCase
from projects_api import access, models
from projects_api.testing import admin_user, firebase_user, owned_project


class EcoEligibilityTests(SimpleTestCase):
    def test_exact_verified_domain_only(self):
        for email, verified, allowed in [
            ('ana@correo.uia.mx', True, True),
            ('Ana@CORREO.UIA.MX', True, True),
            ('ana@correo.uia.mx', False, False),
            ('ana@uia.mx', True, False),
            ('ana@sub.correo.uia.mx', True, False),
            ('ana@correo.uia.mx.example.org', True, False),
            ('ana@ibero.mx', True, True),
            ('ANA@IBERO.MX', True, True),
            ('ana@ibero.mx', False, False),
            ('ana@sub.ibero.mx', True, False),
            ('ana@ibero.mx.example.org', True, False),
            ('ana@notibero.mx', True, False),
        ]:
            with self.subTest(email=email, verified=verified):
                self.assertEqual(access.can_access_ecoplatform(firebase_user(email, verified)), allowed)
        self.assertFalse(access.can_access_ecoplatform(AnonymousUser()))


class EcoIdentityTests(APITestCase):
    def test_staff_does_not_bypass_domain(self):
        self.assertFalse(access.can_access_ecoplatform(admin_user()))

    def test_me_reports_capability(self):
        self.client.force_authenticate(firebase_user('ana@correo.uia.mx'))
        response = self.client.get('/api-projects/me/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['can_access_ecoplatform'])
        self.assertTrue(response.data['email_verified'])

    def test_material_provider_identity_is_explicit(self):
        material = models.Material.objects.create(name_material='Legacy EPD', database_from='EPDs')
        self.assertEqual(material.provider_code, 'legacy')


class EcoCatalogTests(APITestCase):
    def setUp(self):
        self.eco = models.Material.objects.create(name_material='ECO secret concrete', provider_code='eco_platform', database_from='ECO Platform')
        self.legacy = models.Material.objects.create(name_material='Ordinary concrete', database_from='EPDs')
        self.factor = models.MaterialSchemeData.objects.create(material_id=self.eco, value=123)
        self.conversion = models.Conversions.objects.create(material_id=self.eco, value=1)

    def test_catalog_detail_and_dependents_are_hidden(self):
        for user in [None, firebase_user('ana@example.com'), firebase_user('ana@correo.uia.mx', False), admin_user()]:
            self.client.force_authenticate(user)
            for route, pk in [('materials', self.eco.id), ('material-scheme-data', self.factor.id), ('conversions', self.conversion.id)]:
                with self.subTest(user=str(user), route=route):
                    response = self.client.get('/api-projects/%s/%d/' % (route, pk))
                    self.assertEqual(response.status_code, 404)
                    data = self.client.get('/api-projects/%s/' % route).data
                    rows = data['results'] if isinstance(data, dict) else data
                    self.assertNotIn(pk, [r['id'] for r in rows])
            self.assertEqual(self.client.get('/api-projects/materials/%d/' % self.legacy.id).status_code, 200)

    def test_database_selector_ignores_null_source_names(self):
        models.Material.objects.create(name_material='Unlabelled')
        hidden = models.DataBaseMaterial.objects.create(name='ECO Platform')
        shown = models.DataBaseMaterial.objects.create(name='EPDs')
        response = self.client.get('/api-projects/database-material/')
        rows = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertNotIn(hidden.id, [row['id'] for row in rows])
        self.assertIn(shown.id, [row['id'] for row in rows])

    def test_eligible_catalog_and_explorer(self):
        self.client.force_authenticate(firebase_user('ana@correo.uia.mx'))
        self.assertEqual(self.client.get('/api-projects/materials/%d/' % self.eco.id).status_code, 200)
        self.assertEqual(self.client.get('/api-projects/explorer/produccion/%d/' % self.eco.id).status_code, 200)

    def test_explorer_filters_before_facets(self):
        response = self.client.get('/api-projects/explorer/produccion/')
        self.assertEqual(response.data['count'], 1)
        self.assertNotIn('ECO Platform', response.data['facets']['sources'])
        self.assertEqual(self.client.get('/api-projects/explorer/produccion/%d/' % self.eco.id).status_code, 404)

    def test_workbook_catalog_defaults_to_non_eco(self):
        from projects_api.excel_templates import build
        self.assertEqual([r.material for r in build.catalogue_rows()], ['Ordinary concrete'])

    def test_private_responses_and_workbook_contents(self):
        from io import BytesIO
        from zipfile import ZipFile
        for eligible in [False, True]:
            self.client.force_authenticate(firebase_user('ana@correo.uia.mx') if eligible else None)
            for url in ['/api-projects/materials/', '/api-projects/explorer/produccion/', '/api-projects/templates/windows.xlsm']:
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertIn('no-store', response.get('Cache-Control', ''))
                self.assertIn('Authorization', response.get('Vary', ''))
                if url.endswith('.xlsm'):
                    with ZipFile(BytesIO(response.content)) as archive:
                        xml = b''.join(archive.read(n) for n in archive.namelist() if n.endswith('.xml'))
                    self.assertEqual(b'ECO secret concrete' in xml, eligible)

    def test_staff_cannot_relabel_eco_or_attach_hidden_factors(self):
        self.client.force_authenticate(admin_user())
        self.assertEqual(self.client.patch('/api-projects/materials/%d/' % self.eco.id, {'provider_code': 'legacy'}, format='json').status_code, 404)
        self.assertEqual(self.client.patch('/api-projects/materials/%d/' % self.legacy.id, {'provider_code': 'eco_platform'}, format='json').status_code, 403)
        response = self.client.post('/api-projects/conversions/', {'material_id': self.eco.id, 'value': 1}, format='json')
        self.assertEqual(response.status_code, 403)


class EcoProjectTests(APITestCase):
    def setUp(self):
        self.email = 'ana@correo.uia.mx'
        self.project = owned_project(self.email, 'Mixed project')
        self.plain = models.Project.objects.create(name_project='Plain', user_platform_id=self.project.user_platform_id)
        self.eco = models.Material.objects.create(name_material='ECO concrete', provider_code='eco_platform')
        self.legacy = models.Material.objects.create(name_material='Ordinary')
        self.row = models.MaterialSchemeProject.objects.create(project_id=self.project, material_id=self.eco)
        self.client.force_authenticate(firebase_user(self.email, False))

    def test_verified_outside_domain_owner_cannot_see_existing_eco_project(self):
        owner = self.project.user_platform_id
        owner.email = 'ana@example.com'
        owner.save(update_fields=['email'])
        self.client.force_authenticate(firebase_user(owner.email))
        self.assertEqual(self.client.get('/api-projects/projects/%d/' % self.project.id).status_code, 404)
        self.assertEqual(self.client.get('/api-projects/projects/%d/' % self.plain.id).status_code, 200)
        self.assertEqual(self.client.get('/api-projects/material-scheme-project/%d/' % self.row.id).status_code, 404)
        owner.email = self.email
        owner.save(update_fields=['email'])
        self.client.force_authenticate(firebase_user(self.email))
        self.assertEqual(self.client.get('/api-projects/projects/%d/' % self.project.id).status_code, 200)

    def test_revocation_and_restoration_preserve_data(self):
        # Same verified ownership identity, with ECO capability revoked and restored.
        from unittest.mock import patch
        self.client.force_authenticate(firebase_user(self.email))
        with patch('projects_api.access.can_access_ecoplatform', return_value=False):
            data = self.client.get('/api-projects/projects/').data
            rows = data['results'] if isinstance(data, dict) else data
            self.assertEqual([r['id'] for r in rows], [self.plain.id])
            self.assertEqual(self.client.get('/api-projects/projects/%d/' % self.project.id).status_code, 404)
            self.assertEqual(self.client.get('/api-projects/material-scheme-project/%d/' % self.row.id).status_code, 404)
            self.assertEqual(self.client.patch('/api-projects/material-scheme-project/%d/' % self.row.id, {'material_id': self.legacy.id}, format='json').status_code, 404)
            for suffix in ['results/', 'usage/']:
                self.assertEqual(self.client.get('/api-projects/projects/%d/%s' % (self.project.id, suffix)).status_code, 404)
            self.assertEqual(self.client.get('/api-projects/materials-stage/?project_id=%d' % self.project.id).status_code, 404)
            self.assertEqual(self.client.put('/api-projects/projects/%d/material-scheme/' % self.project.id, {'origins': [1], 'sections': [1], 'items': []}, format='json').status_code, 404)
        self.assertTrue(models.MaterialSchemeProject.objects.filter(pk=self.row.id).exists())
        self.assertEqual(self.client.get('/api-projects/projects/%d/' % self.project.id).status_code, 200)

    def test_original_rows_restrict_projects_too(self):
        from unittest.mock import patch
        self.row.delete()
        models.MaterialSchemeProjectOrigianal.objects.create(project_id=self.project, material_id=self.eco)
        self.client.force_authenticate(firebase_user(self.email))
        with patch('projects_api.access.can_access_ecoplatform', return_value=False):
            self.assertFalse(access.visible_projects(firebase_user(self.email)).filter(pk=self.project.pk).exists())
        models.MaterialSchemeProjectOrigianal.objects.filter(project_id=self.project).delete()
        with patch('projects_api.access.can_access_ecoplatform', return_value=False):
            self.assertTrue(access.visible_projects(firebase_user(self.email)).filter(pk=self.project.pk).exists())

    def test_all_project_children_follow_project_visibility(self):
        from unittest.mock import patch
        annual = models.AnnualConsumptionRequired.objects.create(project_id=self.project, quantity=1)
        children = [
            ('constructive-system-element', models.ConstructiveSystemElement.objects.create(project_id=self.project)),
            ('annual-consumption-required', annual),
            ('electricity-consumption-data', models.ElectricityConsumptionData.objects.create(annual_consumption_required_id=annual)),
            ('electricity-consumption-deconstructive-process', models.ElectricityConsumptionDeconstructiveProcess.objects.create(project_id=self.project)),
            ('treatment-of-generate-wasted', models.TreatmentOfGeneratedWaste.objects.create(project_id=self.project)),
        ]
        self.client.force_authenticate(firebase_user(self.email))
        with patch('projects_api.access.can_access_ecoplatform', return_value=False):
            for route, obj in children:
                with self.subTest(route=route):
                    self.assertEqual(self.client.get('/api-projects/%s/%d/' % (route, obj.id)).status_code, 404)
                    self.assertEqual(self.client.patch('/api-projects/%s/%d/' % (route, obj.id), {}, format='json').status_code, 404)

    def test_forged_material_and_project_references_rejected_before_write(self):
        from unittest.mock import patch
        self.client.force_authenticate(firebase_user(self.email))
        plain_row = models.MaterialSchemeProject.objects.create(project_id=self.plain, material_id=self.legacy)
        with patch('projects_api.access.can_access_ecoplatform', return_value=False):
            url = '/api-projects/material-scheme-project/%d/' % plain_row.id
            self.assertEqual(self.client.patch(url, {'material_id': self.eco.id}, format='json').status_code, 403)
            self.assertEqual(self.client.patch(url, {'project_id': self.project.id}, format='json').status_code, 403)
        plain_row.refresh_from_db()
        self.assertEqual(plain_row.material_id, self.legacy)
        self.assertEqual(plain_row.project_id, self.plain)

    def test_bulk_eco_assignment_rejected_without_deleting_existing_rows(self):
        self.client.force_authenticate(firebase_user(self.email))
        origin = models.Origin.objects.create(name_origin='User')
        section = models.Section.objects.create(name_section='Wall')
        row = models.MaterialSchemeProject.objects.create(project_id=self.plain, material_id=self.legacy, origin_id=origin, section_id=section)
        from unittest.mock import patch
        with patch('projects_api.access.can_access_ecoplatform', return_value=False):
            response = self.client.put('/api-projects/projects/%d/material-scheme/' % self.plain.id, {
                'origins': [origin.id], 'sections': [section.id],
                'items': [{'material_id': self.eco.id, 'origin_id': origin.id, 'section_id': section.id}],
            }, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(models.MaterialSchemeProject.objects.filter(pk=row.pk).exists())

    def test_visible_project_query_is_bounded_and_ownership_remains(self):
        from unittest.mock import patch
        with patch('projects_api.access.can_access_ecoplatform', return_value=False), self.assertNumQueries(1):
            self.assertEqual(list(access.visible_projects(firebase_user(self.email)).values_list('pk', flat=True)), [self.plain.pk])
        self.assertFalse(access.visible_projects(firebase_user('other@correo.uia.mx')).exists())
