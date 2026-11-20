"""The 'ECO Platform' database, so the results toggle can list ECO Portal EPDs."""
from django.db import migrations

NAME = 'ECO Platform'


def add(apps, schema_editor):
    DataBaseMaterial = apps.get_model('projects_api', 'DataBaseMaterial')
    if not DataBaseMaterial.objects.filter(name=NAME).exists():
        DataBaseMaterial.objects.create(name=NAME)


def remove(apps, schema_editor):
    apps.get_model('projects_api', 'DataBaseMaterial').objects.filter(name=NAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0088_seed_a2_indicators'),
    ]

    operations = [
        migrations.RunPython(add, remove),
    ]
