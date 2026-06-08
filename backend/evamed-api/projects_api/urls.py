from django.urls import path, include

from rest_framework.routers import DefaultRouter

from projects_api import views

router = DefaultRouter()
router.register('users-platform', views.UserPlatformViewSet)
router.register('transports', views.TransportsViewSet)
router.register('uses', views.UsesViewSet)
router.register('type-project', views.TypeProjectsViewSet)
router.register('countries', views.CountriesViewSet)
router.register('external-distance', views.ExternalDistanceViewSet)
router.register('useful-life', views.UsefulLifeViewSet)
router.register('housing-scheme', views.HousingSchemeViewSet)
router.register('projects', views.ProjectsViewSet)
router.register('materials', views.MaterialsViewSet)
router.register('sections', views.SectionsViewSet)
router.register('origins', views.OriginsViewSet)
router.register('units', views.UnitsViewSet)
router.register('standards', views.StandardsViewSet)
router.register('potential-types', views.PotentialTypesViewSet)
router.register('volume-units', views.VolumeUnitsViewSet)
router.register('energy-units', views.EnergyUnitsViewSet)
router.register('bulk-units', views.BulkUnitsViewSet)
router.register('source-information', views.SourceInformationViewSet)
router.register('constructive-process', views.ConstructiveProcessViewSet)
router.register('material-scheme-project', views.MaterialSchemeProjectViewSet)
router.register('material-scheme-project-original', views.MaterialSchemeProjectOriginalViewSet)
router.register('material-scheme-data', views.MaterialSchemeDataViewSet)
router.register('constructive-system-element', views.ConstructiveSystemElementViewSet)
router.register('sources-electricity-consumption', views.SourcesElectricityConsumptionViewSet)
router.register('annual-consumption-required', views.AnnualConsumptionRequiredViewSet)
router.register('electricity-consumption-data', views.ElectricityConsumptionDataViewSet)
router.register('stage-scheme-data', views.StageSchemeDataViewSet)
router.register('type-energy', views.TypeEnergyViewSet)
router.register('electricity-consumption-deconstructive-process', views.ElectricityConsumptionDeconstructiveProcessViewSet)
router.register('treatment-of-generate-wasted', views.TreatmentOfGeneratedWasteViewSet)
router.register('source-information-data', views.SourceInformationDataViewSet)
router.register('type-energy-data', views.TypeEnergyDataViewSet)
router.register('states', views.StatesViewSet)
router.register('cities', views.CitiesViewSet)
router.register('local-distances', views.LocalDistancesViewSet)
router.register('potential-transport', views.PotentialTransportViewSet)
router.register('conversions', views.ConversionsViewSet)
router.register('database-material', views.DataBaseMaterialViewSet)

urlpatterns = [
    path('materials-stage/', views.MaterialStageView.as_view()),
    path('materials-stage/update/', views.MaterialStageUpdateView.as_view()),
    path('projects/<int:project_id>/results/', views.ProjectResultsView.as_view()),
    path('', include(router.urls))
]
