"""EVAmed's end-of-life scenario for materials that declare no C2–C4 (fin de vida design, 2026-11-22).

`data/scenarios.json` gives, per material family, where the waste goes (share per waste treatment
and the module it reports to), the distance to it and, for families sold by volume, a density.
Families come from `ecoinvent/data/construction_materials.json` by ecoinvent dataset id; anything
else is 'Otros'. Nothing applies until the owner approves the numbers ("approved": true).
"""
import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from projects_api import models

DATA_PATH = Path(__file__).resolve().parent / 'data' / 'scenarios.json'
CONSTRUCTION_MATERIALS = Path(__file__).resolve().parent.parent / 'ecoinvent' / 'data' / 'construction_materials.json'
MODULES = ('C3', 'C4')
FALLBACK = 'Otros'


class ScenarioError(ValueError):
    pass


@dataclass(frozen=True)
class Destination:
    treatment: str
    share: float
    module: str


@dataclass(frozen=True)
class Family:
    distance_km: float
    density_kg_m3: float | None
    destinations: tuple
    sources: str = ''


@dataclass(frozen=True)
class Scenario:
    approved: bool
    truck: str
    families: dict = field(default_factory=dict)

    def family(self, material):
        return self.families[self.family_for(material)]

    def family_for(self, material):
        name = _family_by_dataset().get(material.ecoinvent_dataset_id)
        return name if name in self.families else FALLBACK

    def treatment_names(self):
        return {d.treatment for family in self.families.values() for d in family.destinations}


@lru_cache(maxsize=1)
def _family_by_dataset():
    with open(CONSTRUCTION_MATERIALS) as handle:
        return {item['dataset_id']: item['category'] for item in json.load(handle)['materials']}


def from_dict(data):
    families = {}
    for name, raw in data.get('families', {}).items():
        destinations = tuple(Destination(d['treatment'], float(d['share']), d['module']) for d in raw['destinations'])
        if not destinations or abs(sum(d.share for d in destinations) - 1) > 1e-9:
            raise ScenarioError('Shares of {} do not add up to 1.'.format(name))
        for destination in destinations:
            if destination.module not in MODULES:
                raise ScenarioError('{}: module {} is not C3 or C4.'.format(name, destination.module))
        density = raw.get('density_kg_m3')
        families[name] = Family(float(raw['distance_km']), float(density) if density is not None else None,
                                destinations, raw.get('sources', ''))
    if FALLBACK not in families:
        raise ScenarioError('The scenario needs an {} family.'.format(FALLBACK))
    return Scenario(bool(data.get('approved')), data['truck'], families)


def check_rows(loaded):
    """Every treatment and the truck name an existing row."""
    known = set(models.WasteTreatment.objects.filter(name_waste_treatment__in=loaded.treatment_names())
                .values_list('name_waste_treatment', flat=True))
    missing = sorted(loaded.treatment_names() - known)
    if missing:
        raise ScenarioError('Unknown waste treatment(s): {}'.format(', '.join(missing)))
    if not models.Transport.objects.filter(name_transport=loaded.truck).exists():
        raise ScenarioError('Unknown truck: {}'.format(loaded.truck))
    return loaded


def load(path=None, check_rows=False):
    with open(path or DATA_PATH) as handle:
        loaded = from_dict(json.load(handle))
    return globals()['check_rows'](loaded) if check_rows else loaded


def current():
    """The shipped scenario, as results use it."""
    return load()
