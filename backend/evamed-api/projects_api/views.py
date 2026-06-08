from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework import filters
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.settings import api_settings
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from projects_api import models
from projects_api import serializers
from profiles_api import permissions

class UserPlatformViewSet(viewsets.ModelViewSet):
    """Handle creating and updating user"""
    serializer_class = serializers.UserPlatformSerializer
    queryset = models.UserPlatform.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=email', )

class TransportsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating transports"""
    serializer_class = serializers.TransportsSerializer
    queryset = models.Transport.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class UsesViewSet(viewsets.ModelViewSet):
    """Handle creating and updating uses"""
    serializer_class = serializers.UsesSerializer
    queryset = models.Use.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_use', )

class TypeProjectsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating type projects"""
    serializer_class = serializers.TypeProjectsSerializer
    queryset = models.TypeProject.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_type_project', )

class CountriesViewSet(viewsets.ModelViewSet):
    """Handle creating and updating countries"""
    serializer_class = serializers.CountriesSerializer
    queryset = models.Country.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_country', )

class ExternalDistanceViewSet(viewsets.ModelViewSet):
    """Handle creating and updating countries"""
    serializer_class = serializers.ExternalDistanceSerializer
    queryset = models.ExternalDistance.objects.select_related('country_id_origin')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class UsefulLifeViewSet(viewsets.ModelViewSet):
    """Handle creating and updating useful life"""
    serializer_class = serializers.UsefulLifeSerializer
    queryset = models.UsefulLife.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_useful_life', )

class HousingSchemeViewSet(viewsets.ModelViewSet):
    """Handle creating and updating housing Scheme"""
    serializer_class = serializers.HousingSchemeSerializer
    queryset = models.HousingScheme.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_housing_scheme', )

class ProjectsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating profiles"""
    serializer_class = serializers.ProjectsSerializer
    queryset = models.Project.objects.select_related(
        'use_id', 'type_id', 'country_id', 'useful_life_id',
        'housing_scheme_id', 'user_platform_id', 'city_id_origin',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id',)

class MaterialsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating materials"""
    serializer_class = serializers.MaterialsSerializer
    queryset = models.Material.objects.select_related('unit_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ['=id', 'name_material']

class SectionsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating sections"""
    serializer_class = serializers.SectionsSerializer
    queryset = models.Section.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_section', )

class OriginsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating origins"""
    serializer_class = serializers.OriginsSerializer
    queryset = models.Origin.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_origin', )

class UnitsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating units"""
    serializer_class = serializers.UnitsSerializer
    queryset = models.Unit.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_unit', )

class StandardsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating standards"""
    serializer_class = serializers.StandardsSerializer
    queryset = models.Standard.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_standard', )

class PotentialTypesViewSet(viewsets.ModelViewSet):
    """Handle creating and updating potential types"""
    serializer_class = serializers.PotentialTypesSerializer
    queryset = models.PotentialType.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_potential_type', )

class VolumeUnitsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating volume units"""
    serializer_class = serializers.VolumeUnitsSerializer
    queryset = models.VolumeUnit.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_volume_unit', )

class EnergyUnitsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating energy units"""
    serializer_class = serializers.EnergyUnitsSerializer
    queryset = models.EnergyUnit.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_energy_unit', )

class BulkUnitsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating bulk units"""
    serializer_class = serializers.BulkUnitsSerializer
    queryset = models.BulkUnit.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_bulk_unit', )

class SourceInformationViewSet(viewsets.ModelViewSet):
    """Handle creating and updating source information"""
    serializer_class = serializers.SourceInformationSerializer
    queryset = models.SourceInformation.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_source_information', )

class ConstructiveProcessViewSet(viewsets.ModelViewSet):
    """Handle creating and updating source information"""
    serializer_class = serializers.ConstructiveProcessSerializer
    queryset = models.ConstructiveProcess.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_constructive_process', )

class MaterialSchemeProjectViewSet(viewsets.ModelViewSet):
    """Handle creating and updating material scheme project"""
    serializer_class = serializers.MaterialSchemeProjectSerializer
    queryset = models.MaterialSchemeProject.objects.select_related(
        'material_id', 'project_id', 'origin_id', 'section_id',
        'city_id_origin', 'state_id_origin', 'city_id_end',
        'transport_id_origin', 'transport_id_end',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=material_id', )

class MaterialSchemeProjectOriginalViewSet(viewsets.ModelViewSet):
    """Handle creating and updating material scheme project"""
    serializer_class = serializers.MaterialSchemeProjectOriginalSerializer
    queryset = models.MaterialSchemeProjectOrigianal.objects.select_related(
        'material_id', 'project_id', 'origin_id', 'section_id',
        'city_id_origin', 'city_id_end', 'transport_id_origin', 'transport_id_end',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=material_id', )

class MaterialSchemeDataViewSet(viewsets.ModelViewSet):
    """Handle creating and updating material scheme data"""
    serializer_class = serializers.MaterialSchemeDataSerializer
    queryset = models.MaterialSchemeData.objects.select_related(
        'material_id', 'standard_id', 'potential_type_id', 'unit_id',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('value', )

class ConstructiveSystemElementViewSet(viewsets.ModelViewSet):
    """Handle creating and updating CSE"""
    serializer_class = serializers.ConstructiveSystemElementSerializer
    queryset = models.ConstructiveSystemElement.objects.select_related(
        'project_id', 'section_id', 'constructive_process_id',
        'volume_unit_id', 'energy_unit_id', 'bulk_unit_id', 'source_information_id',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=project_id', )


_IMPACTOS_IGNORAR = frozenset([
    'PARNR', 'POT', 'Human toxicity',
    'Fresh water aquatic ecotox.', 'Marine aquatic ecotoxicity',
    'Terrestrial ecotoxicity',
])

_PRODUCTION_STAGES = [2, 3, 4]  # standard_id: A1, A2, A3


class ProjectResultsView(APIView):
    """
    Python port of the frontend OperacionesDeFase computation.
    Returns pre-computed lifecycle impact results for a project so the
    browser does not have to download ~12 full datasets and run the
    calculation in JavaScript.

    GET /api-projects/projects/<id>/results/
    Optional query param:  ?databases=EPiC,EPD   (comma-separated; omit = all)
    """

    def get(self, request, project_id):
        databases_param = request.query_params.get('databases', None)

        try:
            project = models.Project.objects.select_related('useful_life_id').get(id=project_id)
        except models.Project.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        # --- active databases ---
        all_db_names = set(models.DataBaseMaterial.objects.values_list('name', flat=True))
        if databases_param:
            active_databases = set(databases_param.split(',')) & all_db_names
        else:
            active_databases = all_db_names

        # --- project-scoped data ---
        scheme_project = list(
            models.MaterialSchemeProject.objects.filter(project_id=project_id)
            .select_related('material_id')
        )
        material_ids = [ps.material_id_id for ps in scheme_project]

        # MaterialSchemeData: (material_id, standard_id, potential_type_id) → summed value
        msd_lookup = {}
        for msd in models.MaterialSchemeData.objects.filter(material_id__in=material_ids):
            key = (msd.material_id_id, msd.standard_id_id, msd.potential_type_id_id)
            msd_lookup[key] = msd_lookup.get(key, 0) + float(msd.value or 0)

        # Conversions: material_id → weight factor
        conv_lookup = {
            c.material_id_id: float(c.value or 0)
            for c in models.Conversions.objects.filter(material_id__in=material_ids)
        }

        cse_list = list(models.ConstructiveSystemElement.objects.filter(project_id=project_id))
        ecdp_list = list(
            models.ElectricityConsumptionDeconstructiveProcess.objects.filter(project_id=project_id)
        )

        # SourceInformationData filtered to sources used by CSE + ECDP
        source_ids = list({
            cse.source_information_id_id for cse in cse_list if cse.source_information_id_id
        } | {
            ecdp.source_information_id_id for ecdp in ecdp_list if ecdp.source_information_id_id
        })
        sid_lookup = {}
        if source_ids:
            for sid in models.SourceInformationData.objects.filter(sourceInformarion_id__in=source_ids):
                sid_lookup[(sid.sourceInformarion_id_id, sid.potential_type_id_id)] = float(sid.value or 0)

        acr_list = list(models.AnnualConsumptionRequired.objects.filter(project_id=project_id))
        ecd_list = list(
            models.ElectricityConsumptionData.objects.filter(
                annual_consumption_required_id=acr_list[0].id
            )
        ) if acr_list else []

        # TypeEnergyData: (type_energy_id, potential_type_id) → value
        ecd_type_ids = [ecd.type_id for ecd in ecd_list if ecd.type_id]
        ted_lookup = {}
        if ecd_type_ids:
            for ted in models.TypeEnergyData.objects.filter(type_energy_id__in=ecd_type_ids):
                ted_lookup[(ted.type_energy_id_id, ted.potential_type_id_id)] = float(ted.value or 0)

        # PotentialTransport: (potential_type_id, transport_id) → value
        pt_lookup = {
            (pt.potential_type_id_id, pt.transport_id_id): float(pt.value or 0)
            for pt in models.PotentialTransport.objects.all()
        }

        # Standards: id → name
        standards = {s.id: s.name_standard for s in models.Standard.objects.all()}

        # Useful life
        useful_life = 1.0
        if project.useful_life_id:
            try:
                useful_life = float(project.useful_life_id.name_useful_life)
            except (ValueError, TypeError):
                pass

        potential_types = [
            pt for pt in models.PotentialType.objects.all()
            if pt.name_potential_type not in _IMPACTOS_IGNORAR
        ]

        datos = {}
        error_calculos = False

        for impacto in potential_types:
            name = impacto.name_complete_potential_type
            datos[name] = {}

            # ---- Producción ----
            produccion = {}
            suma_transport = {}  # material_id → transport contribution (reused in B4)

            for subetapa in _PRODUCTION_STAGES:
                subproceso = standards.get(subetapa, str(subetapa))
                total = 0
                for ps in scheme_project:
                    mat = ps.material_id
                    db = mat.database_from or ''
                    if db not in active_databases or db == 'EPiC':
                        continue
                    total += msd_lookup.get((mat.id, subetapa, impacto.id), 0) * float(ps.quantity or 0)
                produccion[subproceso] = produccion.get(subproceso, 0) + total

            epic_key = standards.get(1, 'EPiC')
            epic_total = 0
            for ps in scheme_project:
                mat = ps.material_id
                if (mat.database_from or '') not in active_databases:
                    continue
                if mat.database_from == 'EPiC':
                    epic_total += msd_lookup.get((mat.id, 1, impacto.id), 0) * float(ps.quantity or 0)
            if epic_total:
                produccion[epic_key] = produccion.get(epic_key, 0) + epic_total

            datos[name]['Producción'] = produccion

            # ---- Construcción ----
            transport_seen = set()
            a4_total = 0
            for ps in scheme_project:
                mat = ps.material_id
                db = mat.database_from or ''
                if db not in active_databases:
                    continue

                intl = (
                    pt_lookup.get((impacto.id, ps.transport_id_origin_id or 1), 0)
                    * float(ps.distance_init)
                ) if ps.distance_init is not None else 0

                natl = (
                    pt_lookup.get((impacto.id, ps.transport_id_end_id or 4), 0)
                    * float(ps.distance_end)
                ) if ps.distance_end is not None else 0

                peso = conv_lookup.get(mat.id, 1)
                tv = peso * float(ps.quantity or 0) * (intl + natl)
                a4_total += tv

                if mat.id not in transport_seen:
                    suma_transport[mat.id] = 0
                    transport_seen.add(mat.id)
                suma_transport[mat.id] += tv

            a5_total = sum(
                sid_lookup.get((cse.source_information_id_id, impacto.id), 0) * float(cse.quantity or 0)
                for cse in cse_list
            )
            datos[name]['Construccion'] = {'A4': a4_total, 'A5': a5_total}

            # ---- Uso ----
            b4_total = 0
            for ps in scheme_project:
                mat = ps.material_id
                db = mat.database_from or ''
                if db not in active_databases:
                    continue
                replaces = ps.replaces or 0
                b4_total += suma_transport.get(mat.id, 0) * replaces
                if db != 'EPiC':
                    for subetapa in _PRODUCTION_STAGES:
                        b4_total += (
                            msd_lookup.get((mat.id, subetapa, impacto.id), 0)
                            * float(ps.quantity or 0) * replaces
                        )
                else:
                    b4_total += (
                        msd_lookup.get((mat.id, 1, impacto.id), 0)
                        * float(ps.quantity or 0) * replaces
                    )

            b6_total = sum(
                useful_life * ted_lookup.get((ecd.type_id, impacto.id), 0) * float(ecd.quantity or 0)
                for ecd in ecd_list
            )
            datos[name]['Uso'] = {'B4': b4_total, 'B6': b6_total}

            # ---- Fin de vida ----
            c1_total = 0
            for ecdp in ecdp_list:
                ev = sid_lookup.get((ecdp.source_information_id_id, impacto.id))
                if ev is not None:
                    c1_total += float(ecdp.quantity or 0) * ev
                else:
                    error_calculos = True
            datos[name]['FinDeVida'] = {'C1': c1_total, 'C2': 0, 'C3': 0, 'C4': 0}

        return Response({'project_id': project_id, 'datos': datos, 'error': error_calculos})


class MaterialStageView(APIView):
    """Handle materials-stage checkbox options"""

    def get(self, request):
        project_id = request.query_params.get('project_id')
        if project_id is None:
            return Response(
                {'detail': 'project_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

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
        if not models.Project.objects.filter(id=project_id).exists():
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
        if not models.Project.objects.filter(id=project_id).exists():
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

class SourcesElectricityConsumptionViewSet(viewsets.ModelViewSet):
    """Handle creating and updating create source electricity consumption"""
    serializer_class = serializers.SourcesElectricityConsumptionSerializer
    queryset = models.SourcesElectricityConsumption.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('name_source_electricity_consumption', )

class AnnualConsumptionRequiredViewSet(viewsets.ModelViewSet):
    """Handle creating and updating create ACR"""
    serializer_class = serializers.AnnualConsumptionRequiredSerializer
    queryset = models.AnnualConsumptionRequired.objects.select_related('project_id', 'unit_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=project_id', )

class ElectricityConsumptionDataViewSet(viewsets.ModelViewSet):
    """Handle creating and updating create ECD"""
    serializer_class = serializers.ElectricityConsumptionDataSerializer
    queryset = models.ElectricityConsumptionData.objects.select_related(
        'annual_consumption_required_id', 'unit_id', 'type',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=annual_consumption_required_id', )

class StageSchemeDataViewSet(viewsets.ModelViewSet):
    """Handle creating and updating create SSD"""
    serializer_class = serializers.StageSchemeDataSerializer
    queryset = models.StageSchemeData.objects.select_related('unit_stage_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class TypeEnergyViewSet(viewsets.ModelViewSet):
    """Handle creating and updating create TypeEnergy"""
    serializer_class = serializers.TypeEnergySerializer
    queryset = models.TypeEnergy.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class ElectricityConsumptionDeconstructiveProcessViewSet(viewsets.ModelViewSet):
    """Handle creating and updating create ECDP"""
    serializer_class = serializers.ElectricityConsumptionDeconstructiveProcessSerializer
    queryset = models.ElectricityConsumptionDeconstructiveProcess.objects.select_related(
        'unit_id', 'source_information_id', 'section_id', 'project_id',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class TreatmentOfGeneratedWasteViewSet(viewsets.ModelViewSet):
    """Handle creating and updating create TOGW"""
    serializer_class = serializers.TreatmentOfGeneratedWasteSerializer
    queryset = models.TreatmentOfGeneratedWaste.objects.select_related('section_id', 'project_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class SourceInformationDataViewSet(viewsets.ModelViewSet):
    """Handle creating and updating Source information data"""
    serializer_class = serializers.SourceInformationDataSerializer
    queryset = models.SourceInformationData.objects.select_related(
        'sourceInformarion_id', 'potential_type_id', 'unit_id',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('value', )

class TypeEnergyDataViewSet(viewsets.ModelViewSet):
    """Handle creating and updating Type Energy Data"""
    serializer_class = serializers.TypeEnergyDataSerializer
    queryset = models.TypeEnergyData.objects.select_related(
        'type_energy_id', 'potential_type_id', 'unit_id',
    )
    filter_backends = (filters.SearchFilter,)
    search_fields = ('value', )

class StatesViewSet(viewsets.ModelViewSet):
    """Handle creating and updating states"""
    serializer_class = serializers.StatesSerializer
    queryset = models.State.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class CitiesViewSet(viewsets.ModelViewSet):
    """Handle creating and updating cities"""
    serializer_class = serializers.CitiesSerializer
    queryset = models.City.objects.select_related('state_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class LocalDistancesViewSet(viewsets.ModelViewSet):
    """Handle creating and updating local distances"""
    serializer_class = serializers.LocalDistancesSerializer
    queryset = models.LocalDistance.objects.select_related('city_id_origin', 'city_id_end')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class PotentialTransportViewSet(viewsets.ModelViewSet):
    """Handle creating and updating potential transports"""
    serializer_class = serializers.PotentialTransportSerializer
    queryset = models.PotentialTransport.objects.select_related('transport_id', 'potential_type_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class ConversionsViewSet(viewsets.ModelViewSet):
    """Handle creating and updating conversions"""
    serializer_class = serializers.ConversionsSerializer
    queryset = models.Conversions.objects.select_related('material_id', 'unit_id')
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )

class DataBaseMaterialViewSet(viewsets.ModelViewSet):
    """Handle creating and updating DataBaseMaterial"""
    serializer_class = serializers.DataBaseMaterialSerializer
    queryset = models.DataBaseMaterial.objects.all()
    filter_backends = (filters.SearchFilter,)
    search_fields = ('=id', )
