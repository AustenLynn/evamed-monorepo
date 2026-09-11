"""
Realign ecoinvent-sourced materials to ecoinvent's reference unit.

22 of the 30 resolvable ecoinvent materials are stored as 'Pz' (pieces) while
ecoinvent's reference unit is kg/m2/m3, and no Conversions row exists to bridge
them. Writing a per-kg impact score against a per-piece quantity would be a
silent error of several orders of magnitude, so the unit is realigned instead.

Safe only because no MaterialSchemeProject row references an ecoinvent material
— there is no user-entered quantity to invalidate. That precondition is
asserted below, so this cannot corrupt data if it runs against a database where
these materials have since been used.

Source of truth is the committed resolve artifact, not a live API call, so this
migration is deterministic and replayable.
"""
import json
import os

from django.db import migrations

ECOINVENT_DATABASE_NAME = 'ECOINVENT 3'

PINS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'ecoinvent', 'data', 'pins.json')

# ecoinvent reference unit -> the EVAmed Unit.name_unit to use.
# NB: the Unit table has both 'Kg' (id 2) and 'kg' (id 19). The existing
# ecoinvent materials use 'Kg', so stay with it rather than introducing a
# second mass unit into this slice.
UNIT_TRANSLATION = {
    'kg': 'Kg',
    'm2': 'm²',
    'm3': 'm³',
}


def _load_realignments():
    if not os.path.exists(PINS_PATH):
        return []
    with open(PINS_PATH) as handle:
        payload = json.load(handle)
    return [
        pin for pin in payload.get('pins', [])
        if pin.get('entity_type') == 'material'
        and pin.get('status') == 'resolved'
        and pin.get('unit_compatible') is False
        and pin.get('reference_unit') in UNIT_TRANSLATION
    ]


def realign(apps, schema_editor):
    Material = apps.get_model('projects_api', 'Material')
    Unit = apps.get_model('projects_api', 'Unit')
    MaterialSchemeProject = apps.get_model('projects_api', 'MaterialSchemeProject')

    in_use = MaterialSchemeProject.objects.filter(
        material_id__database_from=ECOINVENT_DATABASE_NAME).count()
    if in_use:
        raise RuntimeError(
            'Refusing to realign units: {} MaterialSchemeProject row(s) already '
            'reference an ECOINVENT 3 material. Changing the unit would '
            'invalidate those quantities. Resolve by hand.'.format(in_use))

    for pin in _load_realignments():
        unit_name = UNIT_TRANSLATION[pin['reference_unit']]
        unit = Unit.objects.filter(name_unit=unit_name).first()
        if unit is None:
            continue
        Material.objects.filter(
            id=pin['entity_id'],
            database_from=ECOINVENT_DATABASE_NAME,
        ).update(unit_id=unit)


def unrealign(apps, schema_editor):
    """Restore the unit recorded in the artifact at resolve time."""
    Material = apps.get_model('projects_api', 'Material')
    Unit = apps.get_model('projects_api', 'Unit')

    for pin in _load_realignments():
        unit = Unit.objects.filter(name_unit=pin.get('evamed_unit')).first()
        if unit is None:
            continue
        Material.objects.filter(
            id=pin['entity_id'],
            database_from=ECOINVENT_DATABASE_NAME,
        ).update(unit_id=unit)


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0080_seed_ecoinvent_indicator_map'),
    ]

    operations = [
        migrations.RunPython(realign, unrealign),
    ]
