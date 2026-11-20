"""The 'ECO Platform' database, so the results toggle can list ECO Portal EPDs."""
from django.core.management.color import no_style
from django.db import migrations

NAME = 'ECO Platform'

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


def add(apps, schema_editor):
    DataBaseMaterial = apps.get_model('projects_api', 'DataBaseMaterial')
    if not DataBaseMaterial.objects.filter(name=NAME).exists():
        DataBaseMaterial.objects.create(pk=_next_pk(DataBaseMaterial), name=NAME)
        _reset_sequences(schema_editor, DataBaseMaterial)


def remove(apps, schema_editor):
    apps.get_model('projects_api', 'DataBaseMaterial').objects.filter(name=NAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0088_seed_a2_indicators'),
    ]

    operations = [
        migrations.RunPython(add, remove),
    ]
