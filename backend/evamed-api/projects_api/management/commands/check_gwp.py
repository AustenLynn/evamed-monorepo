"""
List stored impact factors whose GWP-total is not fossil + biogenic + land use.

    python manage.py check_gwp

Read-only. Covers materials (summed over their modules), energy types, construction
and end-of-life processes and transports (audit A-11, 2026-11-22).
"""
from collections import defaultdict

from django.core.management.base import BaseCommand

from projects_api import gwp_check, models

SOURCES = (
    ('material', models.MaterialSchemeData, 'material_id', 'name_material'),
    ('energía', models.TypeEnergyData, 'type_energy_id', 'name_type_energy'),
    ('proceso', models.SourceInformationData, 'sourceInformarion_id', 'name_source_information'),
    ('transporte', models.PotentialTransport, 'transport_id', 'name_transport'),
)


class Command(BaseCommand):
    help = 'List impact factors whose GWP-total is not the sum of its parts.'

    def handle(self, *args, **options):
        names = (gwp_check.TOTAL,) + gwp_check.PARTS
        checked = 0
        found = []
        for kind, model, owner, name_field in SOURCES:
            values = defaultdict(lambda: defaultdict(float))
            labels = {}
            rows = model.objects.filter(
                potential_type_id__name_potential_type__in=names,
                potential_type_id__method='EN15804+A2', value__isnull=False,
            ).values_list(owner, '{}__{}'.format(owner, name_field), 'potential_type_id__name_potential_type', 'value')
            for owner_id, label, short, value in rows:
                values[owner_id][short] += float(value)
                labels[owner_id] = label
            for owner_id, by_type in values.items():
                if gwp_check.TOTAL not in by_type:
                    continue
                checked += 1
                bad = gwp_check.mismatch(by_type)
                if bad:
                    found.append((kind, owner_id, labels[owner_id], bad))
        self.stdout.write('tipo,id,nombre,gwp_total,suma_fosil_biogenico_uso_de_suelo,diferencia_pct')
        for kind, owner_id, label, bad in found:
            self.stdout.write('{},{},"{}",{:.6g},{:.6g},{:.1f}'.format(
                kind, owner_id, (label or '').replace('"', "'"), bad['total'], bad['suma'], bad['diferencia'] * 100))
        self.stdout.write('{} de {} no cuadran.'.format(len(found), checked))
