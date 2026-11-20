"""
Import ECO Portal EPDs as EN 15804+A2 materials in the 'ECO Platform' database.

Reads the ILCD+EPD JSON files downloaded from the ECO Portal (never committed:
they are licensed data) and the family list in ecoplatform/data/families.json.
Makes no API call. Rows are matched by EPD UUID, so re-running updates values
and never duplicates. Dry run by default.

    python manage.py ecoplatform_import --dir /opt/evamed/data/ecoplatform
    python manage.py ecoplatform_import --dir /opt/evamed/data/ecoplatform --apply
"""
import json
import os
from collections import Counter
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from projects_api import methods, models
from projects_api.ecoplatform import ilcd

FAMILIES_PATH = os.path.join(os.path.dirname(ilcd.__file__), 'data', 'families.json')
DATABASE = 'ECO Platform'
MODULE_STANDARDS = {'A1-A3': 1, 'A1': 2, 'A2': 3, 'A3': 4}


def material_name(family, record):
    return '{}_{} marca {}_{}'.format(family, record.name, record.owner, record.geo)


def description(record):
    text = record.description[:500].rstrip()
    unit = '{:g} {}'.format(record.declared_amount, record.unit or '?')
    return '{}\n\nUnidad declarada: {}. EPD: {}'.format(text, unit, ilcd.portal_url(record)).strip()


class Command(BaseCommand):
    help = 'Import ECO Portal EPDs (ILCD JSON) as EN 15804+A2 materials.'

    def add_arguments(self, parser):
        parser.add_argument('--dir', required=True, help='Folder with <uuid>.json EPD files.')
        parser.add_argument('--families', default=FAMILIES_PATH)
        parser.add_argument('--apply', action='store_true', help='Write (default is a dry run).')

    def handle(self, *args, **options):
        folder = Path(options['dir'])
        if not folder.is_dir():
            raise CommandError('No folder at {}'.format(folder))
        with open(options['families']) as handle:
            families = json.load(handle)

        records, skipped = [], []
        for path in sorted(folder.glob('*.json')):
            if path.name == Path(options['families']).name:
                continue
            record = ilcd.parse(json.loads(path.read_text()))
            reason = ilcd.skip_reason(record)
            if reason is None and record.uuid not in families:
                reason = 'no family in {}'.format(options['families'])
            if reason:
                skipped.append((record, reason))
            else:
                records.append(record)

        self._report(records, skipped, families)
        if not options['apply']:
            self.stdout.write('Dry run: nothing written. Re-run with --apply.')
            return
        self._write(records, families)

    def _report(self, records, skipped, families):
        self.stdout.write('{} to import, {} skipped'.format(len(records), len(skipped)))
        for family, count in sorted(Counter(families[r.uuid] for r in records).items()):
            self.stdout.write('    {:<40} {}'.format(family, count))
        for record, reason in skipped:
            self.stdout.write('  skip: {} ({})'.format(record.name, reason))
        for record in records:
            if record.unit_inferred:
                self.stdout.write('  inferred unit {:<4} {}'.format(record.unit, record.name))
        for record in records:
            if record.mass_tonnes is None:
                self.stdout.write('  no mass (A4 transport left out): {}'.format(record.name))
        for record in records:
            missing = [short for short, _f, _u in methods.A2_INDICATORS
                       if (short, 'A1-A3') not in record.values
                       and not all((short, m) in record.values for m in ('A1', 'A2', 'A3'))]
            if missing:
                self.stdout.write('  missing indicators {}: {}'.format(', '.join(missing), record.name))

    def _write(self, records, families):
        types = {p.name_potential_type: p for p in models.PotentialType.objects.filter(method=methods.A2)}
        standards = {s.id: s for s in models.Standard.objects.filter(id__in=MODULE_STANDARDS.values())}
        units = {}
        for record in records:
            if record.unit not in units:
                units[record.unit] = models.Unit.objects.filter(name_unit=record.unit).order_by('id').first()
                if units[record.unit] is None:
                    raise CommandError('No Unit row named {!r}.'.format(record.unit))
        with transaction.atomic():
            for record in records:
                material, _ = models.Material.objects.update_or_create(
                    eco_epd_uuid=record.uuid,
                    defaults={
                        'name_material': material_name(families[record.uuid], record),
                        'description': description(record),
                        'unit_id': units[record.unit],
                        'database_from': DATABASE,
                        'provider_code': 'eco_platform',
                        'eco_epd_version': record.version,
                        'eco_reg_authority': record.reg_authority,
                    })
                models.MaterialSchemeData.objects.filter(
                    material_id=material, potential_type_id__method=methods.A2).delete()
                models.MaterialSchemeData.objects.bulk_create([
                    models.MaterialSchemeData(
                        material_id=material, standard_id=standards[MODULE_STANDARDS[module]],
                        potential_type_id=types[short], value=value)
                    for (short, module), value in record.values.items() if short in types])
                models.Conversions.objects.filter(material_id=material).delete()
                if record.mass_tonnes is not None:
                    models.Conversions.objects.create(material_id=material, value=record.mass_tonnes)
        imported = models.Material.objects.filter(eco_epd_uuid__in=[r.uuid for r in records])
        current = methods.current_material_ids(imported, method=methods.A2)
        self.stdout.write(self.style.SUCCESS('Imported {} EPD(s).'.format(len(records))))
        self.stdout.write('{} of {} imported materials have every A2 indicator.'.format(
            len(current), imported.count()))
