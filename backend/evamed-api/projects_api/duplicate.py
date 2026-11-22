"""
Server-side project duplication (audit A-25, 2026-11-22).

The home page used to copy a project with dozens of independent requests and
reloaded only after copying an energy row, so a project without Uso data never
refreshed and a failed request left half a copy. Here the whole copy is one
transaction.
"""
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from projects_api import models
from projects_api.access import visible_projects
from projects_api.serializers import ProjectsSerializer

COPY_SUFFIX = ' - copia'

# Rows that belong to a project directly. ElectricityConsumptionData hangs off
# AnnualConsumptionRequired and is copied with it.
PROJECT_ROWS = (
    models.MaterialSchemeProject,
    models.MaterialSchemeProjectOrigianal,
    models.MaterialStageSystemSelection,
    models.ConstructiveSystemElement,
    models.ElectricityConsumptionDeconstructiveProcess,
    models.TreatmentOfGeneratedWaste,
)


def _clone(instance, **changes):
    instance.pk = None
    instance.id = None
    instance._state.adding = True
    for field, value in changes.items():
        setattr(instance, field, value)
    instance.save()
    return instance


def duplicate_project(project):
    name = (project.name_project + COPY_SUFFIX)[:models.Project._meta.get_field('name_project').max_length]
    copy = _clone(models.Project.objects.get(pk=project.pk), name_project=name)
    for model in PROJECT_ROWS:
        for row in model.objects.filter(project_id=project).order_by('pk'):
            _clone(row, project_id=copy)
    for annual in models.AnnualConsumptionRequired.objects.filter(project_id=project).order_by('pk'):
        sources = list(models.ElectricityConsumptionData.objects.filter(
            annual_consumption_required_id=annual).order_by('pk'))
        new_annual = _clone(annual, project_id=copy)
        for source in sources:
            _clone(source, annual_consumption_required_id=new_annual)
    return copy


class DuplicateProjectView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, project_id):
        with transaction.atomic():
            project = get_object_or_404(visible_projects(request.user), pk=project_id)
            copy = duplicate_project(project)
        return Response(ProjectsSerializer(copy).data, status=status.HTTP_201_CREATED)
