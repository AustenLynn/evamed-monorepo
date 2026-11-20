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
