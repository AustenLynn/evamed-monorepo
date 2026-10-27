"""
Add construction materials from ecoinvent to the EVAmed catalogue.

Reads the hand-picked datasets in ecoinvent/data/construction_materials.json
and creates one Material per dataset, already pinned, so `ecoinvent_refresh`
can fill in its impact values. Rows are matched by dataset id, so running it
again adds only what's missing, and brings existing rows' descriptions up to
date with the file.

This command makes no API call and spends no quota; the refresh does.

    python manage.py ecoinvent_add_materials             # dry run
    python manage.py ecoinvent_add_materials --apply
    python manage.py ecoinvent_refresh --only material --max-datasets 30 --apply
"""
import json
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from projects_api import models
from projects_api.management.commands.ecoinvent_resolve import (
    ECOINVENT_DATABASE_NAME,
    _DATA_DIR,
)

MATERIALS_PATH = os.path.join(_DATA_DIR, 'construction_materials.json')

# ecoinvent reference unit -> the Unit row the existing ecoinvent materials use.
UNIT_NAMES = {'kg': 'Kg', 'm3': 'm³'}


def material_name(entry):
    """'Cemento_Cement, Portland {RoW}| market for cement, Portland | Cut-off, S'"""
    product = entry['product'][:1].upper() + entry['product'][1:]
    return '{}_{} {{{}}}| {} | Cut-off, S'.format(
        entry['category'], product, entry['geography'], entry['activity'])


def load_materials(path=MATERIALS_PATH):
    with open(path) as handle:
        return json.load(handle)


class Command(BaseCommand):
    help = 'Add the ecoinvent construction materials listed in construction_materials.json.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply', action='store_true',
            help='Create the materials (default is a dry run).')
        parser.add_argument('--file', default=MATERIALS_PATH)

    def handle(self, *args, **options):
        data = load_materials(options['file'])
        version, system_model = data['version'], data['system_model']

        units = {}
        for eco_unit, name in UNIT_NAMES.items():
            units[eco_unit] = models.Unit.objects.filter(name_unit=name).order_by('id').first()
        needed = {entry['unit'] for entry in data['materials']}
        missing = sorted(u for u in needed if units.get(u) is None)
        if missing:
            raise CommandError(
                'No Unit row for {}. Load the reference data first.'.format(', '.join(missing)))

        existing = {material.ecoinvent_dataset_id: material for material in models.Material.objects.filter(
            ecoinvent_dataset_id__in=[e['dataset_id'] for e in data['materials']],
            ecoinvent_version=version,
            ecoinvent_system_model=system_model,
        )}

        to_add = [e for e in data['materials'] if e['dataset_id'] not in existing]
        to_describe = [
            (existing[e['dataset_id']], e['description']) for e in data['materials']
            if e['dataset_id'] in existing and existing[e['dataset_id']].description != e['description']]
        self.stdout.write(
            'ecoinvent {} / {}: {} listed, {} already in the catalogue, {} to add, '
            '{} description(s) to update'.format(
                version, system_model, len(data['materials']), len(existing), len(to_add),
                len(to_describe)))
        for entry in to_add:
            self.stdout.write('    {:>6}  {:<4} {}'.format(
                entry['dataset_id'], entry['unit'], material_name(entry)))

        if not options['apply']:
            self.stdout.write('Dry run: nothing written. Re-run with --apply.')
            return

        with transaction.atomic():
            for entry in to_add:
                models.Material.objects.create(
                    name_material=material_name(entry),
                    description=entry['description'],
                    unit_id=units[entry['unit']],
                    database_from=ECOINVENT_DATABASE_NAME,
                    ecoinvent_dataset_id=entry['dataset_id'],
                    ecoinvent_version=version,
                    ecoinvent_system_model=system_model,
                )
            for material, description in to_describe:
                material.description = description
                material.save(update_fields=['description'])

        self.stdout.write(self.style.SUCCESS(
            'Added {} material(s), updated {} description(s). Fill in their impacts with: python manage.py '
            'ecoinvent_refresh --only material --max-datasets {} --apply'.format(
                len(to_add), len(to_describe), len(data['materials']))))
