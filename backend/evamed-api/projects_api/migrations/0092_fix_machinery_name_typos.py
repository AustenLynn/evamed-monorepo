"""Fix two machinery names shown in Construcción and Fin de vida (audit A-15, 2026-11-22)."""
from django.db import migrations

RENAMES = [
    ('Generador de energía eléctrica a base de Diesel, potencia potencia entre 18.64 kW y 74.57 kW (GLO)-Ecoinvent 3',
     'Generador de energía eléctrica a base de Diesel, potencia entre 18.64 kW y 74.57 kW (GLO)-Ecoinvent 3'),
    ('Maquinaria de carga pesada a base de Diesel, potencia menor a 18.64kW (GLO)-Ecoinvent 3',
     'Maquinaria de carga pesada a base de Diesel, potencia menor a 18.64 kW (GLO)-Ecoinvent 3'),
]


def rename(apps, pairs):
    SourceInformation = apps.get_model('projects_api', 'SourceInformation')
    for old, new in pairs:
        SourceInformation.objects.filter(name_source_information=old).update(name_source_information=new)


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0091_seed_ecoinvent_a2_indicator_map'),
    ]

    operations = [
        migrations.RunPython(lambda apps, schema: rename(apps, RENAMES),
                             lambda apps, schema: rename(apps, [(new, old) for old, new in RENAMES])),
    ]
