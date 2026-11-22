"""Each machinery source says what its quantity means (2026-11-22).

The excavator and the conveyor belt get ecoinvent factors per m³ excavated and per t·km moved,
not per hour like the rest of the machinery, so the equipment page must ask for that unit.
"""
from django.db import migrations, models

UNITS = {
    'Excavadora hidráulica (GLO)': 'm³',
    'Banda transportadora (GLO)': 't·km',
}


def set_units(apps, schema_editor):
    SourceInformation = apps.get_model('projects_api', 'SourceInformation')
    for name, unit in UNITS.items():
        SourceInformation.objects.filter(name_source_information=name).update(calculation_unit=unit)


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0092_fix_machinery_name_typos'),
    ]

    operations = [
        migrations.AddField(
            model_name='sourceinformation',
            name='calculation_unit',
            field=models.CharField(default='h', max_length=16),
        ),
        migrations.RunPython(set_units, migrations.RunPython.noop),
    ]
