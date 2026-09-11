"""
Pin EVAmed catalogue rows to ecoinvent dataset ids.

Materials keep ecoinvent's own naming (``Clay brick {GLO}| market for |
Cut-off, S``) so they resolve by search. Transports, energy types and machinery
sources use Spanish prose and come from a hand-authored table instead.

Resolution costs no unique-dataset quota: only impact scores do.

    python manage.py ecoinvent_resolve --dry-run
    python manage.py ecoinvent_resolve --apply
    python manage.py ecoinvent_resolve --verify
"""
import json
import os

from django.core.management.base import BaseCommand
from django.utils import timezone

from projects_api import models
from projects_api.ecoinvent.client import EcoinventClient
from projects_api.ecoinvent.matching import (
    iter_candidate_datasets,
    parse_simapro_name,
    pick_best,
)

ECOINVENT_DATABASE_NAME = 'ECOINVENT 3'

_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'ecoinvent', 'data')
MANUAL_PINS_PATH = os.path.join(_DATA_DIR, 'manual_pins.json')
DEFAULT_ARTIFACT_PATH = os.path.join(_DATA_DIR, 'pins.json')

# entity_type -> (model, name field, manual_pins key)
ENTITY_TYPES = {
    'material': (models.Material, 'name_material', None),
    'transport': (models.Transport, 'name_transport', 'transport'),
    'type_energy': (models.TypeEnergy, 'name_type_energy', 'type_energy'),
    'source_information': (
        models.SourceInformation, 'name_source_information', 'source_information'),
}


class Command(BaseCommand):
    help = 'Resolve EVAmed catalogue rows to ecoinvent dataset ids.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--entity-types', default=','.join(sorted(ENTITY_TYPES)),
            help='Comma-separated subset of: {}'.format(', '.join(sorted(ENTITY_TYPES))))
        parser.add_argument(
            '--apply', action='store_true',
            help='Write resolved pins to the database (default is dry run).')
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Explicitly resolve without writing. This is the default.')
        parser.add_argument(
            '--verify', action='store_true',
            help='Re-check that each pinned id still resolves to the expected activity.')
        parser.add_argument('--artifact', default=DEFAULT_ARTIFACT_PATH)

    # ------------------------------------------------------------------ entry

    def handle(self, *args, **options):
        entity_types = [t.strip() for t in options['entity_types'].split(',') if t.strip()]
        unknown = set(entity_types) - set(ENTITY_TYPES)
        if unknown:
            self.stderr.write('Unknown entity types: {}'.format(', '.join(sorted(unknown))))
            return

        client = EcoinventClient()
        self.stdout.write('ecoinvent {} / {}'.format(
            client.config.version, client.config.system_model))

        manual = self._load_manual_pins()
        records = []
        for entity_type in entity_types:
            if entity_type == 'material':
                records.extend(self._resolve_materials(client))
            else:
                records.extend(self._resolve_manual(client, entity_type, manual))

        if options['verify']:
            self._verify(client, records)

        self._report(records)
        self._write_artifact(records, options['artifact'], client)

        if options['apply']:
            written = self._apply(records, client)
            self.stdout.write(self.style.SUCCESS(
                'Wrote {} pins to the database.'.format(written)))
        else:
            self.stdout.write(
                'Dry run: nothing written. Re-run with --apply to persist pins.')

    # -------------------------------------------------------------- resolvers

    def _load_manual_pins(self):
        with open(MANUAL_PINS_PATH) as handle:
            return json.load(handle)

    def _resolve_materials(self, client):
        materials = models.Material.objects.filter(
            database_from=ECOINVENT_DATABASE_NAME).select_related('unit_id')

        records = []
        for material in materials:
            parsed = parse_simapro_name(material.name_material)
            our_unit = material.unit_id.name_unit if material.unit_id else None

            candidates = self._search_widening(client, parsed)
            best, score, method, alternatives = pick_best(
                parsed, candidates, evamed_unit=our_unit)

            records.append({
                'entity_type': 'material',
                'entity_id': material.id,
                'entity_name': material.name_material,
                'evamed_unit': our_unit,
                'dataset_id': best['dataset_id'] if best else None,
                'activity_name': best['activity_name'] if best else None,
                'product_name': best['product_name'] if best else None,
                'geography': best['geography'] if best else None,
                'reference_unit': best['unit'] if best else None,
                'unit_compatible': best['unit_compatible'] if best else None,
                'match_method': method,
                'match_score': round(score, 3),
                'status': 'resolved' if best else 'unresolved',
                'alternatives': alternatives,
            })
        return records

    def _search_widening(self, client, parsed):
        """
        Search filtered first, then widen. Merged rather than replaced: the
        filtered result is usually the right one, but dropping the filters can
        surface an exact product the activity_type guess excluded.
        """
        seen = {}

        def collect(results):
            for candidate in iter_candidate_datasets(results):
                seen.setdefault(candidate['dataset_id'], candidate)

        collect(client.search_datasets(
            parsed.activity, geography=parsed.geography_code,
            activity_type=parsed.activity_type, limit=50))
        collect(client.search_datasets(
            parsed.activity, geography=parsed.geography_code, limit=50))
        collect(client.search_datasets(parsed.activity, limit=50))

        return list(seen.values())

    def _resolve_manual(self, client, entity_type, manual):
        model, name_field, manual_key = ENTITY_TYPES[entity_type]
        by_name = {row['entity_name']: row for row in manual.get(manual_key, [])}

        records = []
        for instance in model.objects.all():
            name = getattr(instance, name_field)
            pin = by_name.get(name)
            if pin is None:
                continue  # not an ecoinvent-sourced row

            records.append({
                'entity_type': entity_type,
                'entity_id': instance.id,
                'entity_name': name,
                'evamed_unit': None,
                'dataset_id': pin.get('dataset_id'),
                'activity_name': pin.get('expected_activity'),
                'product_name': None,
                'geography': pin.get('geography'),
                'reference_unit': None,
                'unit_compatible': None,
                'match_method': 'manual',
                'match_score': 1.0 if pin.get('dataset_id') else 0.0,
                'status': 'resolved' if pin.get('dataset_id') else 'unresolved',
                'notes': pin.get('notes'),
                'alternatives': [],
            })
        return records

    # ----------------------------------------------------------------- verify

    def _verify(self, client, records):
        """Confirm each pinned id still points at the activity we expect."""
        self.stdout.write('\nVerifying pinned dataset ids...')
        for record in records:
            if not record['dataset_id'] or not record['activity_name']:
                continue
            dataset = client.get_dataset(record['dataset_id'])  # no scores, no quota
            actual = dataset.get('activity')
            if actual != record['activity_name']:
                record['status'] = 'mismatch'
                record['notes'] = 'Expected {!r}, API returned {!r}'.format(
                    record['activity_name'], actual)
                self.stderr.write(self.style.ERROR(
                    '  MISMATCH ds={} {}'.format(record['dataset_id'], record['entity_name'])))
            record['reference_unit'] = dataset.get('unit')

    # ---------------------------------------------------------------- outputs

    def _report(self, records):
        resolved = [r for r in records if r['status'] == 'resolved']
        unresolved = [r for r in records if r['status'] == 'unresolved']
        mismatched = [r for r in records if r['status'] == 'mismatch']
        unit_issues = [r for r in resolved if r['unit_compatible'] is False]

        self.stdout.write('\nResolved   {}/{}'.format(len(resolved), len(records)))
        if unit_issues:
            self.stdout.write(self.style.WARNING(
                'Unit mismatch on {} material(s) - these need unit realignment '
                'before their values can be used:'.format(len(unit_issues))))
            for record in unit_issues:
                self.stdout.write('    {:<52} {} -> {}'.format(
                    record['entity_name'][:52], record['evamed_unit'],
                    record['reference_unit']))
        if unresolved:
            self.stdout.write(self.style.WARNING(
                'Unresolved {} row(s) - left unpinned rather than guessed:'.format(
                    len(unresolved))))
            for record in unresolved:
                top = record['alternatives'][0]['product_name'] if record['alternatives'] else '-'
                self.stdout.write('    {:<52} best candidate: {}'.format(
                    record['entity_name'][:52], top))
        if mismatched:
            self.stderr.write(self.style.ERROR(
                '{} pinned id(s) no longer match their expected activity.'.format(
                    len(mismatched))))

        # A dataset used twice usually means a bad fuzzy match.
        assigned = {}
        for record in records:
            if record['dataset_id']:
                assigned.setdefault(record['dataset_id'], []).append(record['entity_name'])
        duplicates = {k: v for k, v in assigned.items() if len(v) > 1}
        if duplicates:
            self.stderr.write(self.style.ERROR(
                'Duplicate dataset assignments (likely mis-matches): {}'.format(duplicates)))

    def _write_artifact(self, records, path, client):
        payload = {
            'version': client.config.version,
            'system_model': client.config.system_model,
            'generated_at': timezone.now().isoformat(),
            'pins': sorted(records, key=lambda r: (r['entity_type'], r['entity_name'])),
        }
        with open(path, 'w') as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False, sort_keys=False)
            handle.write('\n')
        self.stdout.write('Wrote audit artifact: {}'.format(path))

    def _apply(self, records, client):
        written = 0
        now = timezone.now()
        for record in records:
            if record['status'] != 'resolved' or not record['dataset_id']:
                continue
            model = ENTITY_TYPES[record['entity_type']][0]
            model.objects.filter(id=record['entity_id']).update(
                ecoinvent_dataset_id=record['dataset_id'],
                ecoinvent_version=client.config.version,
                ecoinvent_system_model=client.config.system_model,
                ecoinvent_synced_at=now,
            )
            written += 1
        return written
