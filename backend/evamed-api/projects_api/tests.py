from rest_framework import status
from rest_framework.test import APITestCase

from projects_api import models


class MaterialStageSelectionApiTests(APITestCase):
	"""Tests for materials-stage checkbox persistence APIs"""

	def setUp(self):
		self.project = models.Project.objects.create(name_project='Test Project')
		self.section = models.Section.objects.create(name_section='Cimentación')
		self.origin = models.Origin.objects.create(name_origin='Modelo de Revit')
		self.base_url = '/api-projects/materials-stage/'
		self.update_url = '/api-projects/materials-stage/update/'

	def test_create_defaults_is_selected_true(self):
		response = self.client.post(
			self.base_url,
			{
				'project_id': self.project.id,
				'items': [
					{
						'section_id': self.section.id,
						'origin_id': self.origin.id,
						'label': 'Muro exterior'
					}
				]
			},
			format='json'
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data['items']), 1)
		self.assertTrue(response.data['items'][0]['is_selected'])

		selection = models.MaterialStageSystemSelection.objects.get(
			project_id=self.project,
			section_id=self.section,
			origin_id=self.origin,
			construction_system='Muro exterior'
		)
		self.assertTrue(selection.is_selected)

	def test_update_checkbox_changes_state_without_deleting(self):
		selection = models.MaterialStageSystemSelection.objects.create(
			project_id=self.project,
			section_id=self.section,
			origin_id=self.origin,
			construction_system='Losa',
			is_selected=True
		)

		first_response = self.client.patch(
			self.update_url,
			{
				'project_id': self.project.id,
				'items': [
					{
						'sistemaConstructivoId': selection.id,
						'is_selected': False
					}
				]
			},
			format='json'
		)
		self.assertEqual(first_response.status_code, status.HTTP_200_OK)

		selection.refresh_from_db()
		self.assertFalse(selection.is_selected)
		self.assertEqual(models.MaterialStageSystemSelection.objects.count(), 1)

		second_response = self.client.patch(
			self.update_url,
			{
				'project_id': self.project.id,
				'items': [
					{
						'sistemaConstructivoId': selection.id,
						'is_selected': True
					}
				]
			},
			format='json'
		)
		self.assertEqual(second_response.status_code, status.HTTP_200_OK)

		selection.refresh_from_db()
		self.assertTrue(selection.is_selected)
		self.assertEqual(models.MaterialStageSystemSelection.objects.count(), 1)

	def test_idempotency_and_unique_constraint_behavior(self):
		first = self.client.post(
			self.base_url,
			{
				'project_id': self.project.id,
				'items': [
					{
						'section_id': self.section.id,
						'origin_id': self.origin.id,
						'label': 'Columna',
						'is_selected': True
					}
				]
			},
			format='json'
		)
		self.assertEqual(first.status_code, status.HTTP_200_OK)

		second = self.client.post(
			self.base_url,
			{
				'project_id': self.project.id,
				'items': [
					{
						'section_id': self.section.id,
						'origin_id': self.origin.id,
						'label': 'Columna',
						'is_selected': True
					}
				]
			},
			format='json'
		)
		self.assertEqual(second.status_code, status.HTTP_200_OK)
		self.assertEqual(models.MaterialStageSystemSelection.objects.count(), 1)

		selection_id = second.data['items'][0]['id']
		update_once = self.client.patch(
			self.update_url,
			{
				'project_id': self.project.id,
				'items': [
					{
						'sistemaConstructivoId': selection_id,
						'is_selected': False
					}
				]
			},
			format='json'
		)
		update_twice = self.client.patch(
			self.update_url,
			{
				'project_id': self.project.id,
				'items': [
					{
						'sistemaConstructivoId': selection_id,
						'is_selected': False
					}
				]
			},
			format='json'
		)

		self.assertEqual(update_once.status_code, status.HTTP_200_OK)
		self.assertEqual(update_twice.status_code, status.HTTP_200_OK)
		self.assertEqual(models.MaterialStageSystemSelection.objects.count(), 1)

		selection = models.MaterialStageSystemSelection.objects.get(id=selection_id)
		self.assertFalse(selection.is_selected)

	def test_upsert_without_is_selected_keeps_existing_state(self):
		selection = models.MaterialStageSystemSelection.objects.create(
			project_id=self.project,
			section_id=self.section,
			origin_id=self.origin,
			construction_system='Viga',
			is_selected=False
		)

		response = self.client.post(
			self.base_url,
			{
				'project_id': self.project.id,
				'items': [
					{
						'section_id': self.section.id,
						'origin_id': self.origin.id,
						'label': 'Viga'
					}
				]
			},
			format='json'
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		selection.refresh_from_db()
		self.assertFalse(selection.is_selected)
