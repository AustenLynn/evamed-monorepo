"""
Seed the EVAmed impact category -> ecoinvent LCIA indicator mapping.

Indicator ids were verified against the live API (3.12-sandbox / cutoff); see
docs/ecoinvent-api-findings.md. Units line up 1:1 with what EVAmed already
stores, so no conversion factors are involved.

Seeded by data migration rather than by fixture because entrypoint.sh loads
fixtures with `|| true` and so cannot be relied on.
"""
from django.db import migrations


# (potential_type name, indicator id, method, indicator name, ecoinvent unit, EVAmed unit)
INDICATOR_MAP = [
    ('PAAe', 990, 'CML v4.8 2016',
     'abiotic depletion potential (ADP): elements (ultimate reserves)',
     'kg Sb-Eq', 'kg SB eq'),
    ('PAAf', 956, 'CML v4.8 2016',
     'abiotic depletion potential (ADP): fossil fuels', 'MJ', 'MJ'),
    ('PCG 100', 882, 'CML v4.8 2016',
     'global warming potential (GWP100)', 'kg CO2-Eq', 'kg CO2 eq'),
    ('PAO', 962, 'CML v4.8 2016',
     'ozone layer depletion (ODP steady state)', 'kg CFC-11-Eq', 'kg CFC-11 eq'),
    ('PFOF', 953, 'CML v4.8 2016',
     'photochemical oxidation (high NOx)', 'kg ethylene-Eq', 'kg C2H4'),
    ('PA', 964, 'CML v4.8 2016',
     'acidification (incl. fate, average Europe total, A&B)',
     'kg SO2-Eq', 'kg SO2 eq'),
    ('PE', 897, 'CML v4.8 2016',
     'eutrophication (fate not incl.)', 'kg PO4-Eq', 'kg CO4 eq'),
    ('EA', 904, 'EF v3.0',
     'user deprivation potential (deprivation-weighted water consumption)',
     'm3 world Eq deprived', 'm3 eq'),
    # Human toxicity is currently in ProjectResultsView._IMPACTOS_IGNORAR, so
    # nothing renders it. Mapped for completeness but inactive, so refreshes do
    # not spend unique-dataset quota on a value no one sees.
    ('Human toxicity', 977, 'CML v4.8 2016',
     'human toxicity (HTP inf)', 'kg 1,4-DCB-Eq', 'kg 1,4-DB eq'),
]

INACTIVE = {'Human toxicity'}


def seed(apps, schema_editor):
    PotentialType = apps.get_model('projects_api', 'PotentialType')
    Unit = apps.get_model('projects_api', 'Unit')
    EcoinventIndicatorMap = apps.get_model('projects_api', 'EcoinventIndicatorMap')

    for name, indicator_id, method, indicator_name, eco_unit, evamed_unit in INDICATOR_MAP:
        potential_type = PotentialType.objects.filter(
            name_potential_type=name).first()
        if potential_type is None:
            # Reference data is seeded separately; skip rather than fail a deploy.
            continue

        unit = Unit.objects.filter(name_unit=evamed_unit).first()

        EcoinventIndicatorMap.objects.update_or_create(
            potential_type_id=potential_type,
            defaults={
                'indicator_id': indicator_id,
                'method_name': method,
                'indicator_name': indicator_name,
                'expected_unit': eco_unit,
                'unit_id': unit,
                'is_active': name not in INACTIVE,
            },
        )


def unseed(apps, schema_editor):
    EcoinventIndicatorMap = apps.get_model('projects_api', 'EcoinventIndicatorMap')
    EcoinventIndicatorMap.objects.filter(
        indicator_id__in=[row[1] for row in INDICATOR_MAP]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0079_ecoinvent_pinning'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
