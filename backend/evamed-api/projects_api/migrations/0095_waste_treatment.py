"""Waste treatments for EVAmed's end-of-life scenario, pinned to ecoinvent (fin de vida design,
2026-11-22, Phase 2). Values arrive with ecoinvent_resolve + ecoinvent_refresh --only waste_treatment.
"""
import django.db.models.deletion
from django.db import migrations, models

NAMES = [
    "Concreto a relleno de material inerte (RoW)-Ecoinvent 3",
    "Concreto armado a reciclaje (RoW)-Ecoinvent 3",
    "Concreto sin armar a reciclaje (RoW)-Ecoinvent 3",
    "Varilla a reciclaje (RoW)-Ecoinvent 3",
    "Acero a relleno de material inerte (RoW)-Ecoinvent 3",
    "Ladrillo a reciclaje (RoW)-Ecoinvent 3",
    "Yeso a relleno de material inerte (RoW)-Ecoinvent 3",
    "Tablaroca a reciclaje (RoW)-Ecoinvent 3",
    "Aplanado mineral a separación (RoW)-Ecoinvent 3",
    "Residuo inerte a relleno (RoW)-Ecoinvent 3",
]


def create(apps, schema_editor):
    WasteTreatment = apps.get_model('projects_api', 'WasteTreatment')
    for name in NAMES:
        WasteTreatment.objects.get_or_create(name_waste_treatment=name)


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0094_end_of_life_standards'),
    ]

    operations = [
        migrations.CreateModel(
            name='WasteTreatment',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ecoinvent_dataset_id', models.IntegerField(blank=True, db_index=True, null=True)),
                ('ecoinvent_version', models.CharField(blank=True, max_length=32, null=True)),
                ('ecoinvent_system_model', models.CharField(blank=True, max_length=32, null=True)),
                ('ecoinvent_synced_at', models.DateTimeField(blank=True, null=True)),
                ('name_waste_treatment', models.CharField(max_length=255, unique=True)),
            ],
            options={'abstract': False},
        ),
        migrations.CreateModel(
            name='WasteTreatmentData',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('value', models.DecimalField(decimal_places=35, max_digits=45, null=True)),
                ('potential_type_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='projects_api.potentialtype')),
                ('unit_id', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to='projects_api.unit')),
                ('waste_treatment_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='projects_api.wastetreatment')),
            ],
        ),
        migrations.RunPython(create, migrations.RunPython.noop),
    ]
