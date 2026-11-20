"""The impact method EVAmed serves (EN 15804+A2 design, 2026-11-20).

Every indicator (PotentialType) belongs to one method. Only the active
method's indicators reach users; the others stay stored.
"""
from django.conf import settings

from projects_api import models

CML = models.PotentialType.METHOD_CML
A2 = models.PotentialType.METHOD_A2

# (short name, full name shown to users, unit) for the 13 EN 15804+A2 core indicators.
A2_INDICATORS = [
    ('GWP-total', 'Calentamiento global, total', 'kg CO2 eq'),
    ('GWP-fossil', 'Calentamiento global, fósil', 'kg CO2 eq'),
    ('GWP-biogenic', 'Calentamiento global, biogénico', 'kg CO2 eq'),
    ('GWP-luluc', 'Calentamiento global, uso y cambio de uso de suelo', 'kg CO2 eq'),
    ('ODP', 'Agotamiento de la capa de ozono (A2)', 'kg CFC-11 eq'),
    ('AP', 'Acidificación, excedencia acumulada', 'mol H+ eq'),
    ('EP-freshwater', 'Eutrofización, agua dulce', 'kg P eq'),
    ('EP-marine', 'Eutrofización, marina', 'kg N eq'),
    ('EP-terrestrial', 'Eutrofización, terrestre', 'mol N eq'),
    ('POCP', 'Formación de ozono fotoquímico', 'kg NMVOC eq'),
    ('ADPE', 'Agotamiento de recursos abióticos, minerales y metales', 'kg Sb eq'),
    ('ADPF', 'Agotamiento de recursos abióticos, combustibles fósiles', 'MJ'),
    ('WDP', 'Escasez de agua, privación', 'm3 world eq deprived'),
]

# The climate-change indicator that drives the default view and the carbon scale.
GWP_TOTAL = {CML: 'PCG 100', A2: 'GWP-total'}

# CML indicators nothing renders (the old _IMPACTOS_IGNORAR list).
CML_HIDDEN = frozenset([
    'PARNR', 'POT', 'Human toxicity', 'Fresh water aquatic ecotox.',
    'Marine aquatic ecotoxicity', 'Terrestrial ecotoxicity',
])


def active_method():
    method = getattr(settings, 'EVAMED_IMPACT_METHOD', CML)
    return method if method in (CML, A2) else CML


def active_potential_types():
    queryset = models.PotentialType.objects.filter(method=active_method())
    if active_method() == CML:
        queryset = queryset.exclude(name_potential_type__in=CML_HIDDEN)
    return queryset.order_by('id')


def gwp_total_type():
    method = active_method()
    return models.PotentialType.objects.filter(
        method=method, name_potential_type=GWP_TOTAL[method]).order_by('id').first()


# ---------------------------------------------------------------- current rule
# Standard ids as ProjectResultsView uses them.
AGGREGATE_STANDARD = 1          # A1-A3
SPLIT_STANDARDS = (2, 3, 4)     # A1, A2, A3


def _active_type_ids():
    return set(active_potential_types().values_list('id', flat=True))


def _material_coverage(materials=None):
    """{material_id: {standard_id: {potential_type_id with a value}}} for active indicators,
    plus the active indicator ids. Two queries."""
    active = _active_type_ids()
    rows = models.MaterialSchemeData.objects.filter(
        potential_type_id__in=active, value__isnull=False)
    if materials is not None:
        rows = rows.filter(material_id__in=materials.values('pk'))
    coverage = {}
    for material_id, standard_id, type_id in rows.values_list(
            'material_id_id', 'standard_id_id', 'potential_type_id_id'):
        coverage.setdefault(material_id, {}).setdefault(standard_id, set()).add(type_id)
    return coverage, active


def _missing_type_ids(by_standard, active):
    """Active indicator ids a material lacks, read the way ProjectResultsView reads it:
    split rows (A1, A2, A3) when it has any, else the single A1-A3 row."""
    if any(standard in by_standard for standard in SPLIT_STANDARDS):
        covered = set(active)
        for standard in SPLIT_STANDARDS:
            covered &= by_standard.get(standard, set())
    else:
        covered = by_standard.get(AGGREGATE_STANDARD, set())
    return active - covered


def current_material_ids(materials=None):
    """Materials with a value for every active indicator (EN 15804+A2 design)."""
    coverage, active = _material_coverage(materials)
    if not active:
        return set()
    return {mid for mid, by_standard in coverage.items() if not _missing_type_ids(by_standard, active)}


def missing_indicators(material_id):
    """Short names of the active indicators a material has no value for."""
    coverage, active = _material_coverage(models.Material.objects.filter(pk=material_id))
    missing = _missing_type_ids(coverage.get(material_id, {}), active)
    return list(models.PotentialType.objects.filter(id__in=missing).order_by('id')
                .values_list('name_potential_type', flat=True))


def _current_owner_ids(data_model, owner_field):
    active = _active_type_ids()
    if not active:
        return set()
    covered = {}
    for owner_id, type_id in data_model.objects.filter(
            potential_type_id__in=active, value__isnull=False).values_list(owner_field, 'potential_type_id_id'):
        covered.setdefault(owner_id, set()).add(type_id)
    return {owner_id for owner_id, types in covered.items() if owner_id is not None and types >= active}


def current_transport_ids():
    return _current_owner_ids(models.PotentialTransport, 'transport_id_id')


def current_energy_ids():
    return _current_owner_ids(models.TypeEnergyData, 'type_energy_id_id')


def current_source_ids():
    return _current_owner_ids(models.SourceInformationData, 'sourceInformarion_id_id')


# ------------------------------------------------------------ offerable catalogue
# Under A2 the pickers, explorer and templates offer only current entities. Under CML
# nothing is filtered, so legacy behaviour (EPiC with GWP only, etc.) is unchanged.

def offerable_materials(materials):
    if active_method() == CML:
        return materials
    return materials.filter(pk__in=current_material_ids(materials))


def offerable(queryset, current_ids):
    """Filter a transport / energy / source queryset by its current ids under A2."""
    if active_method() == CML:
        return queryset
    return queryset.filter(pk__in=current_ids())
