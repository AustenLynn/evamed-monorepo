"""Seed the 13 EN 15804+A2 core indicators and their units.

By data migration, not fixture: entrypoint.sh loads fixtures with `|| true`
(same reasoning as 0080). The list is copied here so later edits to
projects_api.methods can't change what this migration did.
"""
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


def seed(apps, schema_editor):
    PotentialType = apps.get_model('projects_api', 'PotentialType')
    Unit = apps.get_model('projects_api', 'Unit')
    for short, full, unit in A2_INDICATORS:
        if not Unit.objects.filter(name_unit=unit).exists():
            Unit.objects.create(name_unit=unit)
        PotentialType.objects.update_or_create(
            name_potential_type=short, method=A2,
            defaults={'name_complete_potential_type': full, 'unit_potential_type': unit})


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
