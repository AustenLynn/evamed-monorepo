"""Map the 13 EN 15804+A2 indicators to ecoinvent's EF v3.1 indicators.

Ids verified 2026-11-20 against the free GET /v3/api1/indicators
(3.12-sandbox, cutoff), method 'EF v3.1'. Units are ecoinvent's; EVAmed stores
them as the A2 indicator units (same quantities, no conversion).
"""
from django.db import migrations

A2 = 'EN15804+A2'
# (short name, indicator id, ecoinvent category, ecoinvent unit, EVAmed unit)
EF31 = [
    ('GWP-total', 1183, 'climate change', 'kg CO2-Eq', 'kg CO2 eq'),
    ('GWP-fossil', 1315, 'climate change: fossil', 'kg CO2-Eq', 'kg CO2 eq'),
    ('GWP-biogenic', 1222, 'climate change: biogenic', 'kg CO2-Eq', 'kg CO2 eq'),
    ('GWP-luluc', 1187, 'climate change: land use and land use change', 'kg CO2-Eq', 'kg CO2 eq'),
    ('ODP', 1140, 'ozone depletion', 'kg CFC-11-Eq', 'kg CFC-11 eq'),
    ('AP', 1080, 'acidification', 'mol H+-Eq', 'mol H+ eq'),
    ('EP-freshwater', 1292, 'eutrophication: freshwater', 'kg P-Eq', 'kg P eq'),
    ('EP-marine', 1450, 'eutrophication: marine', 'kg N-Eq', 'kg N eq'),
    ('EP-terrestrial', 1358, 'eutrophication: terrestrial', 'mol N-Eq', 'mol N eq'),
    ('POCP', 1427, 'photochemical oxidant formation: human health', 'kg NMVOC-Eq', 'kg NMVOC eq'),
    ('ADPE', 1147, 'material resources: metals/minerals', 'kg Sb-Eq', 'kg Sb eq'),
    ('ADPF', 1406, 'energy resources: non-renewable', 'MJ, net calorific value', 'MJ'),
    ('WDP', 1230, 'water use', 'm3 world Eq deprived', 'm3 world eq deprived'),
]


def seed(apps, schema_editor):
    PotentialType = apps.get_model('projects_api', 'PotentialType')
    Unit = apps.get_model('projects_api', 'Unit')
    EcoinventIndicatorMap = apps.get_model('projects_api', 'EcoinventIndicatorMap')
    for short, indicator_id, category, eco_unit, evamed_unit in EF31:
        potential_type = PotentialType.objects.filter(method=A2, name_potential_type=short).first()
        if potential_type is None:
            continue
        EcoinventIndicatorMap.objects.update_or_create(
            potential_type_id=potential_type,
            defaults={
                'indicator_id': indicator_id, 'method_name': 'EF v3.1', 'indicator_name': category,
                'expected_unit': eco_unit,
                'unit_id': Unit.objects.filter(name_unit=evamed_unit).order_by('-pk').first(),
                'is_active': True,
            })


def unseed(apps, schema_editor):
    apps.get_model('projects_api', 'EcoinventIndicatorMap').objects.filter(
        indicator_id__in=[row[1] for row in EF31]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0090_material_eco_identity'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
