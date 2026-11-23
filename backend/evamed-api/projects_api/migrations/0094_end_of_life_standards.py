"""C2, C3 and C4: the end-of-life modules EPDs declare (fin de vida design, 2026-11-22).

Fixed ids 5-7 next to A1-A3 (1) and A1-A3 split (2-4); code looks them up by name.
"""
from django.db import migrations

STANDARDS = ((5, 'C2'), (6, 'C3'), (7, 'C4'))


def create(apps, schema_editor):
    Standard = apps.get_model('projects_api', 'Standard')
    for pk, name in STANDARDS:
        if not Standard.objects.filter(name_standard=name).exists():
            Standard.objects.create(id=pk, name_standard=name)
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute(
            "SELECT setval(pg_get_serial_sequence('projects_api_standard', 'id'), "
            "GREATEST((SELECT MAX(id) FROM projects_api_standard), 1))")


def remove(apps, schema_editor):
    apps.get_model('projects_api', 'Standard').objects.filter(
        name_standard__in=[name for _pk, name in STANDARDS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0093_source_calculation_unit'),
    ]

    operations = [
        migrations.RunPython(create, remove),
    ]
