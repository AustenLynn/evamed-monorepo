from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework import filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Q

from projects_api import methods, models
from projects_api import serializers
from projects_api import access
from projects_api import results


class CatalogueViewSet(viewsets.ModelViewSet):
    """Reference data: anyone may read it, only admins may change it."""
    permission_classes = (access.IsAdminOrReadOnly,)

    def get_queryset(self):
        queryset = super().get_queryset()
        if queryset.model is models.Material:
            return queryset.filter(pk__in=access.visible_materials(self.request.user).values('pk'))
        if any(field.name == 'material_id' for field in queryset.model._meta.fields):
            return queryset.filter(Q(material_id__isnull=True) | Q(material_id__in=access.visible_materials(self.request.user)))
        if queryset.model is models.DataBaseMaterial:
            return access.visible_databases(self.request.user, queryset)
        return queryset

    def _check_provider(self, serializer):
        access.require_visible_references(self.request.user, serializer.validated_data)
        if serializer.Meta.model is models.Material and not access.can_access_ecoplatform(self.request.user):
            if serializer.validated_data.get('provider_code') == 'eco_platform':
                raise PermissionDenied('ECO Platform requires a verified institutional email.')

    def perform_create(self, serializer):
        self._check_provider(serializer)
        serializer.save()

    def perform_update(self, serializer):
        self._check_provider(serializer)
        serializer.save()

class UserPlatformViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):
    """A user's own profile. Admins can read everyone's.

    Profiles can't be deleted through the API (deleting one cascades to its
    projects); Django admin still can.
    """
    serializer_class = serializers.UserPlatformSerializer
    queryset = models.UserPlatform.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=email', )
    owner_email_path = 'email'
    http_method_names = ('get', 'post', 'put', 'patch', 'head', 'options')
    # An unverified user can still register and read their own profile;
    # changing it, like project data, needs a trusted email.
    claimed_email_actions = ('list', 'retrieve', 'create')

    def get_queryset(self):
        if self.action in ('list', 'retrieve') and access.is_admin(self.request.user):
            return models.UserPlatform.objects.all()
        return super().get_queryset()

    def perform_create(self, serializer):
        # An unverified claim must not add a second profile for an email that
        # already has one: the real owner's projects hang off the first.
        email = access.claimed_email(self.request.user)
        if not access.caller_email(self.request.user) and \
                models.UserPlatform.objects.filter(email__iexact=email).exists():
            raise PermissionDenied('Verify your email to use this profile.')
        super().perform_create(serializer)


class MeView(APIView):
    """Who the caller is, as the API sees it. Drives admin-only UI."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response({
            'email': access.claimed_email(request.user),
            'is_admin': access.is_admin(request.user),
            'can_access_ecoplatform': access.can_access_ecoplatform(request.user),
            # Django (admin) users are only ever bridged for verified emails.
            'email_verified': getattr(request.user, 'email_verified', True),
        })

class TransportsViewSet(CatalogueViewSet):
    """Handle creating and updating transports"""
    serializer_class = serializers.TransportsSerializer
    queryset = models.Transport.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class UsesViewSet(CatalogueViewSet):
    """Handle creating and updating uses"""
    serializer_class = serializers.UsesSerializer
    queryset = models.Use.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_use', )

class TypeProjectsViewSet(CatalogueViewSet):
    """Handle creating and updating type projects"""
    serializer_class = serializers.TypeProjectsSerializer
    queryset = models.TypeProject.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_type_project', )

class CountriesViewSet(CatalogueViewSet):
    """Handle creating and updating countries"""
    serializer_class = serializers.CountriesSerializer
    queryset = models.Country.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_country', )

class ExternalDistanceViewSet(CatalogueViewSet):
    """Handle creating and updating countries"""
    serializer_class = serializers.ExternalDistanceSerializer
    queryset = models.ExternalDistance.objects.select_related('country_id_origin')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class UsefulLifeViewSet(CatalogueViewSet):
    """Handle creating and updating useful life"""
    serializer_class = serializers.UsefulLifeSerializer
    queryset = models.UsefulLife.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_useful_life', )

class HousingSchemeViewSet(CatalogueViewSet):
    """Handle creating and updating housing Scheme"""
    serializer_class = serializers.HousingSchemeSerializer
    queryset = models.HousingScheme.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_housing_scheme', )

class ProjectsViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):
    """Handle creating and updating profiles"""
    owner_email_path = 'user_platform_id__email'
    serializer_class = serializers.ProjectsSerializer
    queryset = models.Project.objects.select_related(
        'use_id', 'type_id', 'country_id', 'useful_life_id',
        'housing_scheme_id', 'user_platform_id', 'city_id_origin',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id',)

class MaterialsViewSet(CatalogueViewSet):
    """Handle creating and updating materials"""
    serializer_class = serializers.MaterialsSerializer
    queryset = models.Material.objects.select_related('unit_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ['=id', 'name_material']

class SectionsViewSet(CatalogueViewSet):
    """Handle creating and updating sections"""
    serializer_class = serializers.SectionsSerializer
    queryset = models.Section.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_section', )

class OriginsViewSet(CatalogueViewSet):
    """Handle creating and updating origins"""
    serializer_class = serializers.OriginsSerializer
    queryset = models.Origin.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_origin', )

class UnitsViewSet(CatalogueViewSet):
    """Handle creating and updating units"""
    serializer_class = serializers.UnitsSerializer
    queryset = models.Unit.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_unit', )

class StandardsViewSet(CatalogueViewSet):
    """Handle creating and updating standards"""
    serializer_class = serializers.StandardsSerializer
    queryset = models.Standard.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_standard', )

class PotentialTypesViewSet(CatalogueViewSet):
    """Handle creating and updating potential types"""
    serializer_class = serializers.PotentialTypesSerializer
    queryset = models.PotentialType.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_potential_type', )

    def get_queryset(self):
        # Everyone gets the active method's indicators (results pages use this list);
        # admin screens ask for every method with ?method=all.
        if access.is_admin(self.request.user) and (
                self.request.query_params.get('method') == 'all' or self.request.method != 'GET'):
            return super().get_queryset()
        return super().get_queryset().filter(pk__in=methods.active_potential_types().values('pk'))

class VolumeUnitsViewSet(CatalogueViewSet):
    """Handle creating and updating volume units"""
    serializer_class = serializers.VolumeUnitsSerializer
    queryset = models.VolumeUnit.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_volume_unit', )

class EnergyUnitsViewSet(CatalogueViewSet):
    """Handle creating and updating energy units"""
    serializer_class = serializers.EnergyUnitsSerializer
    queryset = models.EnergyUnit.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_energy_unit', )

class BulkUnitsViewSet(CatalogueViewSet):
    """Handle creating and updating bulk units"""
    serializer_class = serializers.BulkUnitsSerializer
    queryset = models.BulkUnit.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_bulk_unit', )

class SourceInformationViewSet(CatalogueViewSet):
    """Handle creating and updating source information"""
    serializer_class = serializers.SourceInformationSerializer
    queryset = models.SourceInformation.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_source_information', )

class ConstructiveProcessViewSet(CatalogueViewSet):
    """Handle creating and updating source information"""
    serializer_class = serializers.ConstructiveProcessSerializer
    queryset = models.ConstructiveProcess.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_constructive_process', )

class MaterialSchemeProjectViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):
    """Handle creating and updating material scheme project"""
    owner_email_path = access.PROJECT_OWNER
    serializer_class = serializers.MaterialSchemeProjectSerializer
    queryset = models.MaterialSchemeProject.objects.select_related(
        'material_id', 'project_id', 'origin_id', 'section_id',
        'city_id_origin', 'state_id_origin', 'city_id_end',
        'transport_id_origin', 'transport_id_end',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=material_id', )

class MaterialSchemeProjectOriginalViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):
    """Handle creating and updating material scheme project"""
    owner_email_path = access.PROJECT_OWNER
    serializer_class = serializers.MaterialSchemeProjectOriginalSerializer
    queryset = models.MaterialSchemeProjectOrigianal.objects.select_related(
        'material_id', 'project_id', 'origin_id', 'section_id',
        'city_id_origin', 'city_id_end', 'transport_id_origin', 'transport_id_end',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=material_id', )

class MaterialSchemeDataViewSet(CatalogueViewSet):
    """Handle creating and updating material scheme data"""
    serializer_class = serializers.MaterialSchemeDataSerializer
    queryset = models.MaterialSchemeData.objects.select_related(
        'material_id', 'standard_id', 'potential_type_id', 'unit_id',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('value', )

class ConstructiveSystemElementViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):
    """Handle creating and updating CSE"""
    owner_email_path = access.PROJECT_OWNER
    serializer_class = serializers.ConstructiveSystemElementSerializer
    queryset = models.ConstructiveSystemElement.objects.select_related(
        'project_id', 'section_id', 'constructive_process_id',
        'volume_unit_id', 'energy_unit_id', 'bulk_unit_id', 'source_information_id',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=project_id', )


class ProjectResultsView(APIView):
    """
    Python port of the frontend OperacionesDeFase computation.
    Returns pre-computed lifecycle impact results for a project so the
    browser does not have to download ~12 full datasets and run the
    calculation in JavaScript.

    GET /api-projects/projects/<id>/results/
    Optional query param:  ?databases=EPiC,EPD   (comma-separated; omit = all)
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, project_id):
        databases_param = request.query_params.get('databases', None)

        try:
            project = access.visible_projects(request.user).select_related('useful_life_id').get(id=project_id)
        except models.Project.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        # --- active databases ---
        all_db_names = set(models.DataBaseMaterial.objects.values_list('name', flat=True))
        if databases_param:
            active_databases = set(databases_param.split(',')) & all_db_names
        else:
            active_databases = all_db_names

        return Response(results.compute(
            project, active_databases, detalle=request.query_params.get('detalle') == '1'))


class ProjectMaterialSchemeView(APIView):
    """
    Replace a project's material rows for some origins and sections in one step.

    PUT /api-projects/projects/<id>/material-scheme/
    {"origins": [1, 2], "sections": [1, 4], "items": [<MaterialSchemeProject fields, no project_id>]}

    The new-project materials page autosaves its whole selection; appending
    each time duplicated rows, so it sends the full set and the server swaps it.
    Only the listed origins and sections are replaced: the page lists just the
    sheets it has loaded, so the others are never cleared. An invalid row is
    skipped and reported, as the old per-row saves lost only that row.
    """

    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def put(self, request, project_id):
        # Lock the project so two overlapping saves can't both delete-then-insert.
        project = access.visible_projects(request.user).select_for_update().filter(id=project_id).first()
        if project is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        body = serializers.MaterialSchemeReplaceSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        origins = set(body.validated_data['origins'])
        sections = set(body.validated_data['sections'])

        valid, skipped = [], []
        for index, item in enumerate(body.validated_data['items']):
            row = serializers.MaterialSchemeReplaceRowSerializer(data=dict(item, project_id=project.id))
            if not row.is_valid():
                skipped.append({'index': index, 'errors': row.errors})
                continue
            access.require_visible_references(request.user, row.validated_data)
            origin, section = row.validated_data.get('origin_id'), row.validated_data.get('section_id')
            if origin is None or origin.id not in origins or section is None or section.id not in sections:
                return Response(
                    {'detail': 'Every item must use one of the given origins and sections.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            valid.append(row.validated_data)

        models.MaterialSchemeProject.objects.filter(
            project_id=project, origin_id__in=origins, section_id__in=sections
        ).delete()
        created = models.MaterialSchemeProject.objects.bulk_create(
            [models.MaterialSchemeProject(**row) for row in valid]
        )
        data = serializers.MaterialSchemeProjectSerializer(created, many=True).data
        return Response({'items': data, 'skipped': skipped}, status=status.HTTP_200_OK)


class MaterialStageView(APIView):
    """Handle materials-stage checkbox options"""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        project_id = request.query_params.get('project_id')
        if project_id is None:
            return Response(
                {'detail': 'project_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not access.owns_project(request.user, project_id):
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        queryset = models.MaterialStageSystemSelection.objects.filter(
            project_id_id=project_id
        )
        section_id = request.query_params.get('section_id')
        if section_id is not None:
            queryset = queryset.filter(section_id_id=section_id)

        queryset = queryset.order_by('section_id_id', 'origin_id_id', 'construction_system')
        data = serializers.MaterialStageSystemSelectionSerializer(queryset, many=True).data
        return Response({'items': data}, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request):
        payload = serializers.MaterialStageSelectionUpsertSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        validated = payload.validated_data

        project_id = validated['project_id']
        if not access.owns_project(request.user, project_id):
            return Response(
                {'detail': 'Invalid project_id'},
                status=status.HTTP_400_BAD_REQUEST
            )

        results = []
        for item in validated['items']:
            section_id = item['section_id']
            origin_id = item.get('origin_id')
            has_is_selected = 'is_selected' in item

            if not models.Section.objects.filter(id=section_id).exists():
                return Response(
                    {'detail': f'Invalid section_id: {section_id}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if origin_id is not None and not models.Origin.objects.filter(id=origin_id).exists():
                return Response(
                    {'detail': f'Invalid origin_id: {origin_id}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if has_is_selected:
                selection, _ = models.MaterialStageSystemSelection.objects.update_or_create(
                    project_id_id=project_id,
                    section_id_id=section_id,
                    origin_id_id=origin_id,
                    construction_system=item['label'],
                    defaults={'is_selected': item['is_selected']}
                )
            else:
                selection, _ = models.MaterialStageSystemSelection.objects.get_or_create(
                    project_id_id=project_id,
                    section_id_id=section_id,
                    origin_id_id=origin_id,
                    construction_system=item['label']
                )

            results.append(selection)

        data = serializers.MaterialStageSystemSelectionSerializer(results, many=True).data
        return Response({'items': data}, status=status.HTTP_200_OK)


class MaterialStageUpdateView(APIView):
    """Update materials-stage checkbox state"""

    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def patch(self, request):
        return self._update_selection_state(request)

    @transaction.atomic
    def post(self, request):
        return self._update_selection_state(request)

    def _update_selection_state(self, request):
        payload = serializers.MaterialStageSelectionUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        validated = payload.validated_data

        project_id = validated['project_id']
        if not access.owns_project(request.user, project_id):
            return Response(
                {'detail': 'Invalid project_id'},
                status=status.HTTP_400_BAD_REQUEST
            )

        item_updates = validated.get('items', [])
        selected_ids = validated.get('selectedIds', [])
        unselected_ids = validated.get('unselectedIds', [])

        if selected_ids:
            item_updates.extend([
                {'sistemaConstructivoId': item_id, 'is_selected': True}
                for item_id in selected_ids
            ])
        if unselected_ids:
            item_updates.extend([
                {'sistemaConstructivoId': item_id, 'is_selected': False}
                for item_id in unselected_ids
            ])

        updated_ids = []
        for item in item_updates:
            selection_id = item['sistemaConstructivoId']
            selection = models.MaterialStageSystemSelection.objects.filter(
                id=selection_id,
                project_id_id=project_id
            ).first()
            if selection is None:
                return Response(
                    {'detail': f'Invalid sistemaConstructivoId: {selection_id}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            selection.is_selected = item['is_selected']
            selection.save(update_fields=['is_selected'])
            updated_ids.append(selection.id)

        queryset = models.MaterialStageSystemSelection.objects.filter(
            id__in=updated_ids
        ).order_by('id')
        data = serializers.MaterialStageSystemSelectionSerializer(queryset, many=True).data
        return Response({'items': data}, status=status.HTTP_200_OK)

class SourcesElectricityConsumptionViewSet(CatalogueViewSet):
    """Handle creating and updating create source electricity consumption"""
    serializer_class = serializers.SourcesElectricityConsumptionSerializer
    queryset = models.SourcesElectricityConsumption.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_source_electricity_consumption', )

class AnnualConsumptionRequiredViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):
    """Handle creating and updating create ACR"""
    owner_email_path = access.PROJECT_OWNER
    serializer_class = serializers.AnnualConsumptionRequiredSerializer
    queryset = models.AnnualConsumptionRequired.objects.select_related('project_id', 'unit_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=project_id', )

class ElectricityConsumptionDataViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):
    """Handle creating and updating create ECD"""
    owner_email_path = 'annual_consumption_required_id__' + access.PROJECT_OWNER
    serializer_class = serializers.ElectricityConsumptionDataSerializer
    queryset = models.ElectricityConsumptionData.objects.select_related(
        'annual_consumption_required_id', 'unit_id', 'type',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=annual_consumption_required_id', )

class StageSchemeDataViewSet(CatalogueViewSet):
    """Handle creating and updating create SSD"""
    serializer_class = serializers.StageSchemeDataSerializer
    queryset = models.StageSchemeData.objects.select_related('unit_stage_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class TypeEnergyViewSet(CatalogueViewSet):
    """Handle creating and updating create TypeEnergy"""
    serializer_class = serializers.TypeEnergySerializer
    queryset = models.TypeEnergy.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class ElectricityConsumptionDeconstructiveProcessViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):
    """Handle creating and updating create ECDP"""
    owner_email_path = access.PROJECT_OWNER
    serializer_class = serializers.ElectricityConsumptionDeconstructiveProcessSerializer
    queryset = models.ElectricityConsumptionDeconstructiveProcess.objects.select_related(
        'unit_id', 'source_information_id', 'section_id', 'project_id',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class TreatmentOfGeneratedWasteViewSet(access.OwnedByCallerMixin, viewsets.ModelViewSet):
    """Handle creating and updating create TOGW"""
    owner_email_path = access.PROJECT_OWNER
    serializer_class = serializers.TreatmentOfGeneratedWasteSerializer
    queryset = models.TreatmentOfGeneratedWaste.objects.select_related('section_id', 'project_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class SourceInformationDataViewSet(CatalogueViewSet):
    """Handle creating and updating Source information data"""
    serializer_class = serializers.SourceInformationDataSerializer
    queryset = models.SourceInformationData.objects.select_related(
        'sourceInformarion_id', 'potential_type_id', 'unit_id',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('value', )

class TypeEnergyDataViewSet(CatalogueViewSet):
    """Handle creating and updating Type Energy Data"""
    serializer_class = serializers.TypeEnergyDataSerializer
    queryset = models.TypeEnergyData.objects.select_related(
        'type_energy_id', 'potential_type_id', 'unit_id',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('value', )

class StatesViewSet(CatalogueViewSet):
    """Handle creating and updating states"""
    serializer_class = serializers.StatesSerializer
    queryset = models.State.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class CitiesViewSet(CatalogueViewSet):
    """Handle creating and updating cities"""
    serializer_class = serializers.CitiesSerializer
    queryset = models.City.objects.select_related('state_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class LocalDistancesViewSet(CatalogueViewSet):
    """Handle creating and updating local distances"""
    serializer_class = serializers.LocalDistancesSerializer
    queryset = models.LocalDistance.objects.select_related('city_id_origin', 'city_id_end')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class PotentialTransportViewSet(CatalogueViewSet):
    """Handle creating and updating potential transports"""
    serializer_class = serializers.PotentialTransportSerializer
    queryset = models.PotentialTransport.objects.select_related('transport_id', 'potential_type_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class ConversionsViewSet(CatalogueViewSet):
    """Handle creating and updating conversions"""
    serializer_class = serializers.ConversionsSerializer
    queryset = models.Conversions.objects.select_related('material_id', 'unit_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class DataBaseMaterialViewSet(CatalogueViewSet):
    """Handle creating and updating DataBaseMaterial"""
    serializer_class = serializers.DataBaseMaterialSerializer
    queryset = models.DataBaseMaterial.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )
