"""POST /projects/<id>/duplicate/: one atomic server-side copy (audit A-25, 2026-11-22)."""
from decimal import Decimal

from rest_framework.test import APITestCase

from projects_api import models
from projects_api.testing import firebase_user, owned_project


class DuplicateProjectTests(APITestCase):
    def setUp(self):
        self.project = owned_project('ana@example.com', name='Casa')
        models.Project.objects.filter(pk=self.project.pk).update(builded_surface=120, living_area=100, tier=2)
        section = models.Section.objects.create(name_section='Muros')
        material = models.Material.objects.create(name_material='Cemento')
        models.MaterialSchemeProject.objects.create(project_id=self.project, material_id=material, quantity=10,
                                                    section_id=section, construction_system='Muro A')
        models.MaterialSchemeProjectOrigianal.objects.create(project_id=self.project, material_id=material)
        models.MaterialStageSystemSelection.objects.create(project_id=self.project, section_id=section,
                                                           construction_system='Muro A', is_selected=False)
        models.ConstructiveSystemElement.objects.create(project_id=self.project, quantity=5)
        models.ElectricityConsumptionDeconstructiveProcess.objects.create(project_id=self.project, quantity=3)
        models.TreatmentOfGeneratedWaste.objects.create(project_id=self.project)
        annual = models.AnnualConsumptionRequired.objects.create(project_id=self.project, quantity=10000)
        models.ElectricityConsumptionData.objects.create(annual_consumption_required_id=annual, percentage=60,
                                                         quantity=Decimal(6000), source='electric')
        self.url = '/api-projects/projects/%s/duplicate/' % self.project.pk

    def test_copies_the_project_and_every_stage(self):
        self.client.force_authenticate(firebase_user('ana@example.com'))
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, 201, response.data)
        copy = models.Project.objects.get(pk=response.data['id'])
        self.assertEqual((copy.name_project, copy.builded_surface, copy.living_area, copy.tier),
                         ('Casa - copia', 120, 100, 2))
        self.assertEqual(copy.user_platform_id_id, self.project.user_platform_id_id)
        for model in (models.MaterialSchemeProject, models.MaterialSchemeProjectOrigianal,
                      models.MaterialStageSystemSelection, models.ConstructiveSystemElement,
                      models.ElectricityConsumptionDeconstructiveProcess, models.TreatmentOfGeneratedWaste,
                      models.AnnualConsumptionRequired):
            self.assertEqual(model.objects.filter(project_id=copy).count(), 1, model.__name__)
            self.assertEqual(model.objects.filter(project_id=self.project).count(), 1, model.__name__)
        source = models.ElectricityConsumptionData.objects.get(annual_consumption_required_id__project_id=copy)
        self.assertEqual((source.percentage, source.quantity, source.source), (60, Decimal(6000), 'electric'))
        self.assertFalse(models.MaterialStageSystemSelection.objects.get(project_id=copy).is_selected)
        self.assertEqual(models.MaterialSchemeProject.objects.get(project_id=copy).construction_system, 'Muro A')

    def test_only_the_owner_can_duplicate(self):
        self.client.force_authenticate(firebase_user('bob@example.com'))
        self.assertEqual(self.client.post(self.url).status_code, 404)
        self.assertEqual(models.Project.objects.count(), 1)
