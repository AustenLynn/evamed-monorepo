"""Seed the 13 EN 15804+A2 core indicators and their units.

By data migration, not fixture: entrypoint.sh loads fixtures with `|| true`
(same reasoning as 0080). The list is copied here so later edits to
projects_api.methods can't change what this migration did.
"""
from django.core.management.color import no_style
from django.db import migrations

A2 = 'EN15804+A2'
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

# Seeded rows take ids above SEED_PK_FLOOR: entrypoint.sh loads fixtures/initial_data.json
# after migrate, with explicit low ids (indicators 1-14, units 1-19, databases 1-5) that
# would otherwise overwrite rows created here on a fresh database.
SEED_PK_FLOOR = 1000


def _next_pk(model):
    from django.db.models import Max
    return max(SEED_PK_FLOOR, model.objects.aggregate(top=Max('pk'))['top'] or 0) + 1


def _reset_sequences(schema_editor, *models):
    for sql in schema_editor.connection.ops.sequence_reset_sql(no_style(), list(models)):
        schema_editor.execute(sql)


def seed(apps, schema_editor):
    PotentialType = apps.get_model('projects_api', 'PotentialType')
    Unit = apps.get_model('projects_api', 'Unit')
    for short, full, unit in A2_INDICATORS:
        if not Unit.objects.filter(name_unit=unit, pk__gt=SEED_PK_FLOOR).exists():
            Unit.objects.create(pk=_next_pk(Unit), name_unit=unit)
        defaults = {'name_complete_potential_type': full, 'unit_potential_type': unit}
        if not PotentialType.objects.filter(name_potential_type=short, method=A2).update(**defaults):
            PotentialType.objects.create(pk=_next_pk(PotentialType), name_potential_type=short, method=A2, **defaults)
    _reset_sequences(schema_editor, Unit, PotentialType)


def unseed(apps, schema_editor):
    PotentialType = apps.get_model('projects_api', 'PotentialType')
    PotentialType.objects.filter(method=A2, name_potential_type__in=[r[0] for r in A2_INDICATORS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0087_potentialtype_method'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
