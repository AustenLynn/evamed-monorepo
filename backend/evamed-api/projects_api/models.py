"""Projects Django"""
from django.db import models
from django.contrib.auth.models import User

class UserPlatform(models.Model):
    """UserPlatform model"""
    name = models.CharField(max_length=255, null=True)
    email = models.CharField(max_length=255, null=True, db_index=True)
    institution = models.CharField(max_length=255, null=True)
    sector = models.CharField(max_length=255, null=True)
    country = models.CharField(max_length=255, null=True)
    password = models.CharField(max_length=255, null=True)

    def __str__(self):
        """Return string representation of user"""
        return self.email

class Transport(models.Model):
    """Transport model"""
    name_transport = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of transport"""
        return self.name_transport

class State(models.Model):
    """State model"""
    name_state = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of state"""
        return self.name_state

class City(models.Model):
    """City model"""
    name_city = models.CharField(max_length=255)
    state_id = models.ForeignKey(State, on_delete=models.CASCADE, null=True)

    def __str__(self):
        """Return string representation of city"""
        return self.name_city

class LocalDistance(models.Model):
    """Local distance model"""
    distance = models.DecimalField(max_digits=45, decimal_places=35, null=True)
    city_id_origin = models.ForeignKey(City, on_delete=models.CASCADE, null=True)
    city_id_end = models.ForeignKey(City, related_name='%(class)s_requests_created',on_delete=models.CASCADE, null=True)

    def __str__(self):
        """Return string representation of state"""
        return str(distance)

class Use(models.Model):
    """Construction use model"""
    name_use = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name_material"""
        return self.name_use

class TypeProject(models.Model):
    """Construction type project model"""
    name_type_project = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of type project model"""
        return self.name_type_project

class Country(models.Model):
    """Construction type country model"""
    name_country = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of country model"""
        return self.name_country

class ExternalDistance(models.Model):
    """Local distance model"""
    distance = models.DecimalField(max_digits=45, decimal_places=35, null=True)
    country_id_origin = models.ForeignKey(Country, on_delete=models.CASCADE, null=True)
    region = models.CharField(max_length=255, null=True)

    def __str__(self):
        """Return string representation of state"""
        return str(distance)

class UsefulLife(models.Model):
    """Construction useful life model"""
    name_useful_life = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of useful life model"""
        return self.name_useful_life

class HousingScheme(models.Model):
    """Construction housing scheme model"""
    name_housing_scheme = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of housing scheme model"""
        return self.name_housing_scheme

class Project(models.Model):
    """Project model"""
    name_project = models.CharField(max_length=255)
    use_id = models.ForeignKey(Use, on_delete=models.CASCADE, null=True)
    type_id = models.ForeignKey(TypeProject, on_delete=models.CASCADE, null=True)
    country_id = models.ForeignKey(Country, on_delete=models.CASCADE, null=True)
    builded_surface = models.IntegerField(null=True)
    living_area = models.IntegerField(null=True)
    tier = models.IntegerField(null=True)
    useful_life_id = models.ForeignKey(UsefulLife, on_delete=models.CASCADE, null=True)
    housing_scheme_id = models.ForeignKey(HousingScheme, on_delete=models.CASCADE, null=True)
    user_platform_id = models.ForeignKey(UserPlatform, on_delete=models.CASCADE, null=True)
    city_id_origin = models.ForeignKey(City, on_delete=models.CASCADE, null=True)
    distance = models.DecimalField(max_digits=45, decimal_places=35, null=True)

    def __str__(self):
        """Return string representation of project"""
        return str(self.name_project)

class Section(models.Model):
    """Section model"""
    name_section = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name_section"""
        return self.name_section

class Origin(models.Model):
    """Origin model"""
    name_origin = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name_origin"""
        return self.name_origin

class Unit(models.Model):
    """Construction unit model"""
    name_unit = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name unit"""
        return self.name_unit

class Standard(models.Model):
    """Construction standard model"""
    name_standard = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name standard"""
        return self.name_standard


class PotentialType(models.Model):
    """Construction potential type model"""
    name_potential_type = models.CharField(max_length=255, null=True)
    name_complete_potential_type = models.CharField(max_length=255, null=True)
    unit_potential_type = models.CharField(max_length=255, null=True)

    def __str__(self):
        """Return string representation of name potential type"""
        return self.name_potential_type

class Material(models.Model):
    """Construction material model"""
    name_material = models.CharField(max_length=255, null=True)
    unit_id = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True)
    database_from = models.CharField(max_length=255, null=True)
    description = models.TextField(null=True)

    def __str__(self):
        """Return string representation of name_material"""
        return self.name_material

class VolumeUnit(models.Model):
    """Construction volume unit model"""
    name_volume_unit = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name volume unit"""
        return self.name_volume_unit

class EnergyUnit(models.Model):
    """Construction energy unit model"""
    name_energy_unit = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name volume unit"""
        return self.name_energy_unit

class BulkUnit(models.Model):
    """Construction bulk unit model"""
    name_bulk_unit = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name bulk unit"""
        return self.name_bulk_unit

class SourceInformation(models.Model):
    """Construction source information model"""
    name_source_information = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name source information"""
        return self.name_source_information

class ConstructiveProcess(models.Model):
    """Constructive process"""
    name_constructive_process = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name constructive process"""
        return self.name_constructive_process

class MaterialSchemeProject(models.Model):
    """Material SchemeProject model"""
    material_id = models.ForeignKey(Material, on_delete=models.CASCADE, null=True)
    comercial_name = models.CharField(max_length=255, null=True)
    project_id = models.ForeignKey(Project, on_delete=models.CASCADE, null=True)
    origin_id = models.ForeignKey(Origin, on_delete=models.CASCADE, null=True)
    construction_system = models.CharField(max_length=255, null=True)
    provider_distance = models.IntegerField(null=True)
    quantity = models.DecimalField(max_digits=30, decimal_places=20, null=True)
    section_id = models.ForeignKey(Section, on_delete=models.CASCADE, null=True)
    value = models.DecimalField(max_digits=45, decimal_places=35, null=True)
    distance_init = models.DecimalField(max_digits=45, decimal_places=35, null=True)
    distance_end = models.DecimalField(max_digits=45, decimal_places=35, null=True)
    replaces = models.IntegerField(null=True)
    city_id_origin = models.ForeignKey(City, on_delete=models.CASCADE, null=True)
    state_id_origin = models.ForeignKey(State, on_delete=models.CASCADE, null=True)
    city_id_end = models.ForeignKey(City, related_name='%(class)s_requests_created', on_delete=models.CASCADE, null=True)
    transport_id_origin = models.ForeignKey(Transport, on_delete=models.CASCADE, null=True)
    transport_id_end = models.ForeignKey(Transport, related_name='%(class)s_requests_created_second', on_delete=models.CASCADE, null=True)
    unit_text = models.CharField(max_length=255, null=True)
    description_material = models.TextField(null=True)

    def __str__(self):
        """Return string representation of material"""
        return str(self.material_id)

class MaterialSchemeProjectOrigianal(models.Model):
    """Material SchemeProject model"""
    material_id = models.ForeignKey(Material, on_delete=models.CASCADE, null=True)
    comercial_name = models.CharField(max_length=255, null=True)
    project_id = models.ForeignKey(Project, on_delete=models.CASCADE, null=True)
    origin_id = models.ForeignKey(Origin, on_delete=models.CASCADE, null=True)
    construction_system = models.CharField(max_length=255, null=True)
    provider_distance = models.IntegerField(null=True)
    quantity = models.IntegerField(null=True)
    section_id = models.ForeignKey(Section, on_delete=models.CASCADE, null=True)
    value = models.DecimalField(max_digits=45, decimal_places=35, null=True)
    distance_init = models.DecimalField(max_digits=45, decimal_places=35, null=True)
    distance_end = models.DecimalField(max_digits=45, decimal_places=35, null=True)
    replaces = models.IntegerField(null=True)
    city_id_origin = models.ForeignKey(City, on_delete=models.CASCADE, null=True)
    city_id_end = models.ForeignKey(City, related_name='%(class)s_requests_created',on_delete=models.CASCADE, null=True)
    transport_id_origin = models.ForeignKey(Transport, on_delete=models.CASCADE, null=True)
    transport_id_end = models.ForeignKey(Transport,related_name='%(class)s_requests_created_second', on_delete=models.CASCADE, null=True)

    def __str__(self):
        """Return string representation of material"""
        return str(self.material_id)

class MaterialSchemeData(models.Model):
    """MaterialSchemeData model"""
    material_id = models.ForeignKey(Material, on_delete=models.CASCADE, null=True)
    standard_id = models.ForeignKey(Standard, on_delete=models.CASCADE, null=True)
    potential_type_id = models.ForeignKey(PotentialType, on_delete=models.CASCADE, null=True)
    unit_id = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True)
    value = models.DecimalField(max_digits=45, decimal_places=35, null=True)

    def __str__(self):
        """Return string representation of material"""
        return self.value


class MaterialStageSystemSelection(models.Model):
    """Persist materials-stage checkbox state per system option"""
    project_id = models.ForeignKey(Project, on_delete=models.CASCADE)
    section_id = models.ForeignKey(Section, on_delete=models.CASCADE)
    origin_id = models.ForeignKey(Origin, on_delete=models.CASCADE, null=True)
    construction_system = models.CharField(max_length=255)
    is_selected = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['project_id', 'section_id', 'origin_id', 'construction_system'],
                name='uniq_material_stage_system_selection'
            )
        ]

    def __str__(self):
        """Return string representation of selection"""
        return f"{self.project_id_id}-{self.section_id_id}-{self.construction_system}"

class ConstructiveSystemElement(models.Model):
    """CSE model"""
    project_id = models.ForeignKey(Project, on_delete=models.CASCADE, null=True)
    section_id = models.ForeignKey(Section, on_delete=models.CASCADE, null=True)
    constructive_process_id = models.ForeignKey(ConstructiveProcess, on_delete=models.CASCADE, null=True)
    quantity = models.DecimalField(max_digits=20, decimal_places=10, null=True)
    volume_unit_id = models.ForeignKey(VolumeUnit, on_delete=models.CASCADE, null=True)
    energy_unit_id = models.ForeignKey(EnergyUnit, on_delete=models.CASCADE, null=True)
    bulk_unit_id = models.ForeignKey(BulkUnit, on_delete=models.CASCADE, null=True)
    source_information_id = models.ForeignKey(SourceInformation, on_delete=models.CASCADE, null=True)

    def __str__(self):
        """Return string representation of ma"""
        return str(self.project_id)

class SourcesElectricityConsumption(models.Model):
    """Sources electricity consumption"""
    name_source_electricity_consumption = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name constructive process"""
        return self.name_source_electricity_consumption

class AnnualConsumptionRequired(models.Model):
    """ACR model"""
    project_id = models.ForeignKey(Project, on_delete=models.CASCADE, null=True)
    quantity =  models.IntegerField()
    unit_id = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True)

    def __str__(self):
        """Return string representation of ACR"""
        return str(self.project_id)

class TypeEnergy(models.Model):
    """Constructive type energy"""
    name_type_energy = models.CharField(max_length=255)

    def __str__(self):
        """Return string representation of name type energy"""
        return self.name_type_energy

class ElectricityConsumptionData(models.Model):
    """ECD model"""
    annual_consumption_required_id = models.ForeignKey(AnnualConsumptionRequired, on_delete=models.CASCADE, null=True)
    unit_id = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True)
    quantity = models.DecimalField(max_digits=20, decimal_places=10, null=True)
    type = models.ForeignKey(TypeEnergy, on_delete=models.CASCADE, null=True)
    percentage = models.IntegerField(null=True)
    source = models.CharField(max_length=255, null=True)

    def __str__(self):
        """Return string representation of ECD"""
        return str(self.annual_consumption_required_id)

class StageSchemeData(models.Model):
    """SSD model"""
    name_stage = models.CharField(max_length=255, null=True)
    abbreviation = models.CharField(max_length=255, null=True)
    unit_stage_id = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True)
    value = models.DecimalField(max_digits=45, decimal_places=23, null=True)
    stage = models.CharField(max_length=255, null=True)

    def __str__(self):
        """Return string representation of ECD"""
        return self.name_stage

class ElectricityConsumptionDeconstructiveProcess(models.Model):
    """"ECDP"""
    unit_id = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True)
    source_information_id = models.ForeignKey(SourceInformation, on_delete=models.CASCADE, null=True)
    quantity = models.IntegerField(null=True)
    section_id = models.ForeignKey(Section, on_delete=models.CASCADE, null=True)
    project_id = models.ForeignKey(Project, on_delete=models.CASCADE, null=True)

    def __str__(self):
        """Return string representation of ECP"""
        return str(self.project_id)

class TreatmentOfGeneratedWaste(models.Model):
    """TOGW"""
    landfill = models.IntegerField(null=True)
    recycling = models.IntegerField(null=True)
    reuse = models.IntegerField(null=True)
    section_id = models.ForeignKey(Section, on_delete=models.CASCADE, null=True)
    project_id = models.ForeignKey(Project, on_delete=models.CASCADE, null=True)

    def __str__(self):
        """Return string representation of TOGW"""
        return str(self.project_id)

class SourceInformationData(models.Model):
    """SourceInformationData model"""
    sourceInformarion_id = models.ForeignKey(SourceInformation, on_delete=models.CASCADE, null=True)
    potential_type_id = models.ForeignKey(PotentialType, on_delete=models.CASCADE, null=True)
    unit_id = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True)
    value = models.DecimalField(max_digits=45, decimal_places=35, null=True )

    def __str__(self):
        """Return string representation of SourceInformationDAta"""
        return self.value

class TypeEnergyData(models.Model):
    """TypeEnergyData model"""
    type_energy_id = models.ForeignKey(TypeEnergy, on_delete=models.CASCADE, null=True)
    potential_type_id = models.ForeignKey(PotentialType, on_delete=models.CASCADE, null=True)
    unit_id = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True)
    value = models.DecimalField(max_digits=45, decimal_places=35, null=True )

    def __str__(self):
        """Return string representation of SourceInformationDAta"""
        return self.value


class PotentialTransport(models.Model):
    """Potential Transport model"""
    transport_id = models.ForeignKey(
        Transport, on_delete=models.CASCADE, null=True)
    potential_type_id = models.ForeignKey(
        PotentialType, on_delete=models.CASCADE, null=True)
    value = models.DecimalField(max_digits=45, decimal_places=35, null=True)

    def __str__(self):
        """Return string representation"""
        return self.value


class Conversions(models.Model):
    """Conversions model"""
    material_id = models.ForeignKey(
        Material, on_delete=models.CASCADE, null=True)
    unit_id = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True)
    value = models.DecimalField(max_digits=45, decimal_places=35, null=True)

    def __str__(self):
        """Return string representation"""
        return self.value


class DataBaseMaterial(models.Model):
    """DataBaseMaterial model"""
    name = models.CharField(max_length=255)

    def __str__(self):
        """Return string"""
        return self.name
