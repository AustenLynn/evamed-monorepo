"""The explorer's catalogue items, built in Python from a fixed number of queries.

The catalogue is small (hundreds of rows) and every item's impact level
depends on its whole group, so each request loads a stage once, then
filters, facets and pages the list in memory.
"""
from collections import Counter, defaultdict

from projects_api import models
from projects_api.explorer import derive

GWP = 'PCG 100'
A1_A3 = 'A1-A3'
SPLIT = ('A1', 'A2', 'A3')
# A category narrows the comparison group only when it has this many items.
MIN_CATEGORY_GROUP = 6
MIN_COMPARISON = 5


def _number(value):
    return float(value) if value is not None else None


def _impact_data():
    """{material_id: {potential_type_id: {standard_name: value}}} and the standards each material has.

    One value per (material, indicator, standard): the catalogue has duplicate
    rows (R-05), and the first one wins.
    """
    values, standards = defaultdict(lambda: defaultdict(dict)), defaultdict(set)
    rows = models.MaterialSchemeData.objects.order_by('id').values_list(
        'material_id_id', 'potential_type_id_id', 'standard_id__name_standard', 'value')
    for material_id, potential_id, standard, value in rows:
        standards[material_id].add(standard)
        values[material_id][potential_id].setdefault(standard, _number(value))
    return values, standards


def _is_aggregate(standards):
    """Only a combined A1-A3 row, as the project calculation decides (R-01)."""
    return A1_A3 in standards and not standards.intersection(SPLIT)


def stage_total(by_standard, aggregate):
    """A1-A3 for one indicator: the A1-A3 row, or the sum of the split rows it has."""
    if aggregate:
        return by_standard.get(A1_A3)
    split = [by_standard[standard] for standard in SPLIT if by_standard.get(standard) is not None]
    return sum(split) if split else None


def _gwp_type_id():
    return models.PotentialType.objects.filter(name_potential_type=GWP).values_list('id', flat=True).first()


def _add_impact_levels(items):
    """Rank each item within its category and unit when that group is big enough,
    else within every item of its unit (HANDOFF §5.4)."""
    by_unit, by_category = defaultdict(dict), defaultdict(dict)
    for item in items:
        if item['gwp'] is not None and item['unit']:
            by_unit[item['unit']][item['id']] = item['gwp']
            if item['category']:
                by_category[(item['category'], item['unit'])][item['id']] = item['gwp']
    unit_levels = {unit: derive.impact_levels(values) for unit, values in by_unit.items()}
    category_levels = {
        key: derive.impact_levels(values)
        for key, values in by_category.items() if len(values) >= MIN_CATEGORY_GROUP}
    for item in items:
        key = (item['category'], item['unit'])
        levels = category_levels.get(key) or unit_levels.get(item['unit'], {})
        item['impact_level'] = levels.get(item['id'])


def production_items():
    """Every material, with A1-A3 GWP and impact level (HANDOFF §5.2, §5.4)."""
    gwp_id = _gwp_type_id()
    values, standards = _impact_data()
    items = []
    for material in models.Material.objects.select_related('unit_id').order_by('id'):
        aggregate = _is_aggregate(standards.get(material.id, set()))
        items.append({
            'id': material.id,
            'stage': 'produccion',
            'name': material.name_material,
            'display_name': derive.display_name(material.name_material),
            'category': derive.category(material.name_material),
            'region': derive.region(material.name_material),
            'description': material.description,
            'source': material.database_from,
            'unit': derive.unit(material.unit_id.name_unit if material.unit_id else None),
            'gwp': stage_total(values[material.id][gwp_id], aggregate),
        })
    _add_impact_levels(items)
    return items


def _named_items(stage, rows, name_field, kind):
    """Construcción and Uso: no reference unit in the data (R-04), so no unit and no level."""
    return [{
        'id': row.id,
        'stage': stage,
        'name': getattr(row, name_field),
        'display_name': derive.display_name(getattr(row, name_field)),
        'category': None,
        'region': derive.region(getattr(row, name_field)),
        'description': None,
        'source': derive.source_from_name(getattr(row, name_field)),
        'type': kind(getattr(row, name_field)),
        'unit': None,
        'gwp': gwp,
        'impact_level': None,
    } for row, gwp in rows]


def _first_gwp(queryset, owner_field):
    gwp = {}
    for owner_id, value in queryset.filter(potential_type_id__name_potential_type=GWP) \
            .order_by('id').values_list(owner_field, 'value'):
        gwp.setdefault(owner_id, _number(value))
    return gwp


def construction_items():
    gwp = _first_gwp(models.SourceInformationData.objects, 'sourceInformarion_id_id')
    rows = [(row, gwp.get(row.id)) for row in models.SourceInformation.objects.order_by('id')]
    return _named_items('construccion', rows, 'name_source_information', derive.machinery_type)


def use_items():
    gwp = _first_gwp(models.TypeEnergyData.objects, 'type_energy_id_id')
    rows = [(row, gwp.get(row.id)) for row in models.TypeEnergy.objects.order_by('id')]
    return _named_items('uso', rows, 'name_type_energy', derive.energy_type)


def end_of_life_items():
    """No end-of-life factor catalogue exists yet (K-06)."""
    return []


SORTS = ('nombre', 'impacto', 'mayor-impacto', 'categoria')


def ordered(items, sort='nombre', population=None):
    """Items in one of SORTS; items without GWP last within their group.

    nombre: name A→Z (K-07). impacto: by unit, lowest GWP first, since values
    per kg and per m³ don't compare. mayor-impacto: the same groups, highest GWP
    first. categoria: category A→Z, then as impacto.
    Units go most materials first, counted over the whole stage (population) so
    the order doesn't move as filters change. No unit or category goes last.
    """
    by_name = lambda item: (derive.sort_key(item['display_name']), item['id'])
    if sort == 'nombre':
        return sorted(items, key=lambda item: (item['gwp'] is None, *by_name(item)))
    counts = Counter(item['unit'] for item in (population if population is not None else items))
    unit_key = lambda unit: (unit is None, -counts[unit], derive.sort_key(unit or ''))
    sign = -1 if sort == 'mayor-impacto' else 1
    impact = lambda item: (*unit_key(item['unit']), item['gwp'] is None, sign * (item['gwp'] or 0), *by_name(item))
    if sort in ('impacto', 'mayor-impacto'):
        return sorted(items, key=impact)
    return sorted(items, key=lambda item: (
        item['category'] is None, derive.sort_key(item['category'] or ''), *impact(item)))


def material_detail(material_id):
    """One material with its indicators and category comparison, or None."""
    items = production_items()
    item = next((candidate for candidate in items if candidate['id'] == material_id), None)
    if item is None:
        return None
    material = models.Material.objects.get(pk=material_id)
    rows = models.MaterialSchemeData.objects.filter(material_id=material_id) \
        .select_related('standard_id', 'potential_type_id').order_by('potential_type_id', 'id')
    by_type, types, standards = defaultdict(dict), {}, set()
    for row in rows:
        standard = row.standard_id.name_standard if row.standard_id else None
        standards.add(standard)
        types[row.potential_type_id_id] = row.potential_type_id
        by_type[row.potential_type_id_id].setdefault(standard, _number(row.value))
    aggregate = _is_aggregate(standards)
    indicators = [{
        'code': potential.name_potential_type,
        'name': potential.name_complete_potential_type,
        # The rows' own units are unreliable (R-07).
        'unit': potential.unit_potential_type,
        'a1': by_type[type_id].get('A1'),
        'a2': by_type[type_id].get('A2'),
        'a3': by_type[type_id].get('A3'),
        'a1_a3': stage_total(by_type[type_id], aggregate),
    } for type_id, potential in types.items() if potential is not None]

    return dict(
        item,
        ecoinvent={
            'dataset_id': material.ecoinvent_dataset_id,
            'version': material.ecoinvent_version,
            'system_model': material.ecoinvent_system_model,
        } if material.ecoinvent_dataset_id else None,
        indicators=indicators,
        comparison=_comparison(item, items),
    )


def _comparison(item, items):
    """The item against its category and unit; None below 5 materials."""
    if item['gwp'] is None or not item['category']:
        return None
    peers = [other['gwp'] for other in items if other['gwp'] is not None
             and (other['category'], other['unit']) == (item['category'], item['unit'])]
    if len(peers) < MIN_COMPARISON:
        return None
    return {
        'group': item['category'],
        'unit': item['unit'],
        'n': len(peers),
        'mean': sum(peers) / len(peers),
        'p25': derive.percentile(peers, 25),
        'value': item['gwp'],
    }
