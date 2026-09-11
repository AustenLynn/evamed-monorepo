"""
Refresh EVAmed impact factors from the ecoinvent API.

Reads the dataset ids pinned by `ecoinvent_resolve`, fetches impact scores in
one batch call, and upserts them into the existing impact tables. Nothing in
the request path changes: ProjectResultsView keeps reading the same rows.

Materials are always written against standard_id=1 (A1-A3). ecoinvent returns a
single aggregated cradle-to-gate score and does not decompose into EN 15804
A1/A2/A3 modules, which is exactly the shape the existing ecoinvent rows have.

This command spends unique-dataset quota. Always dry-run first.

    python manage.py ecoinvent_refresh --dry-run
    python manage.py ecoinvent_refresh --only type_energy
    python manage.py ecoinvent_refresh --apply
"""
import json

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from projects_api import models
from projects_api.ecoinvent.client import EcoinventClient
from projects_api.ecoinvent.matching import units_compatible

AGGREGATE_STANDARD_ID = 1  # A1-A3

# entity_type -> (model, name field, impact model, FK to the entity, extra defaults)
TARGETS = {
    'material': (
        models.Material, 'name_material',
        models.MaterialSchemeData, 'material_id', True),
    'transport': (
        models.Transport, 'name_transport',
        models.PotentialTransport, 'transport_id', False),
    'type_energy': (
        models.TypeEnergy, 'name_type_energy',
        models.TypeEnergyData, 'type_energy_id', False),
    'source_information': (
        models.SourceInformation, 'name_source_information',
        models.SourceInformationData, 'sourceInformarion_id', False),
}


class Command(BaseCommand):
    help = 'Refresh impact factors for pinned ecoinvent entities.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--only', default=','.join(sorted(TARGETS)),
            help='Comma-separated subset of: {}'.format(', '.join(sorted(TARGETS))))
        parser.add_argument(
            '--apply', action='store_true',
            help='Write the fetched values (default is a dry run).')
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Show the diff without writing. This is the default.')
        parser.add_argument(
            '--allow-unit-mismatch', action='store_true',
            help='Write material values even where the stored unit disagrees with '
                 "ecoinvent's reference unit. Off by default: a per-kg score "
                 'written against a per-piece quantity is a silent 1000x error.')
        parser.add_argument(
            '--max-datasets', type=int, default=None,
            help='Abort before fetching if more than N distinct datasets would be '
                 'requested. Guards the licence quota.')

    # ------------------------------------------------------------------ entry

    def handle(self, *args, **options):
        entity_types = [t.strip() for t in options['only'].split(',') if t.strip()]
        unknown = set(entity_types) - set(TARGETS)
        if unknown:
            self.stderr.write('Unknown entity types: {}'.format(', '.join(sorted(unknown))))
            return

        client = EcoinventClient()
        indicators = list(models.EcoinventIndicatorMap.objects.filter(
            is_active=True).select_related('potential_type_id', 'unit_id'))
        if not indicators:
            self.stderr.write(
                'No active EcoinventIndicatorMap rows. Run migrations first.')
            return

        pinned = self._collect_pinned(entity_types, client)
        if not pinned:
            self.stderr.write(
                'No pinned entities for {}. Run ecoinvent_resolve --apply first.'
                .format(', '.join(entity_types)))
            return

        dataset_ids = sorted({p['dataset_id'] for p in pinned})
        indicator_ids = [i.indicator_id for i in indicators]

        self.stdout.write('ecoinvent {} / {}'.format(
            client.config.version, client.config.system_model))
        self.stdout.write(
            '{} pinned entities across {} distinct datasets x {} indicators'.format(
                len(pinned), len(dataset_ids), len(indicator_ids)))

        if options['max_datasets'] and len(dataset_ids) > options['max_datasets']:
            self.stderr.write(self.style.ERROR(
                'Would request {} datasets, over the --max-datasets limit of {}. '
                'Aborting before spending quota.'.format(
                    len(dataset_ids), options['max_datasets'])))
            return

        if not options['apply']:
            self.stdout.write(self.style.WARNING(
                'DRY RUN: fetching scores to show the diff. This still counts '
                'against the unique-dataset quota, but writes nothing.'))

        scores = self._fetch(client, dataset_ids, indicator_ids)
        self._apply(pinned, indicators, scores, options, client)

    # ------------------------------------------------------------- collection

    def _collect_pinned(self, entity_types, client):
        pinned = []
        for entity_type in entity_types:
            model, name_field = TARGETS[entity_type][0], TARGETS[entity_type][1]
            queryset = model.objects.filter(
                ecoinvent_dataset_id__isnull=False,
                ecoinvent_version=client.config.version,
                ecoinvent_system_model=client.config.system_model,
            )
            for instance in queryset:
                pinned.append({
                    'entity_type': entity_type,
                    'instance': instance,
                    'name': getattr(instance, name_field),
                    'dataset_id': instance.ecoinvent_dataset_id,
                })
        return pinned

    def _fetch(self, client, dataset_ids, indicator_ids):
        """(dataset_id, indicator_id) -> (score, unit); plus per-dataset unit."""
        scores = {}
        self.dataset_units = {}
        for dataset in client.batch_datasets(dataset_ids, indicator_ids):
            self.dataset_units[int(dataset['id'])] = dataset.get('unit')
            for score in dataset.get('impact_scores', []):
                scores[(int(dataset['id']), int(score['id']))] = (
                    score.get('score'), score.get('unit'))
        self.stdout.write('Fetched scores for {} datasets.'.format(
            len(self.dataset_units)))
        return scores

    # ----------------------------------------------------------------- writes

    def _apply(self, pinned, indicators, scores, options, client):
        changes = []
        skipped_units = []
        missing = []

        for pin in pinned:
            entity_type = pin['entity_type']
            model, name_field, impact_model, fk_name, is_material = TARGETS[entity_type]
            instance = pin['instance']

            if is_material and not options['allow_unit_mismatch']:
                our_unit = instance.unit_id.name_unit if instance.unit_id else None
                eco_unit = self.dataset_units.get(pin['dataset_id'])
                if not units_compatible(our_unit, eco_unit):
                    skipped_units.append((pin['name'], our_unit, eco_unit))
                    continue

            for indicator in indicators:
                key = (pin['dataset_id'], indicator.indicator_id)
                if key not in scores:
                    missing.append((pin['name'], indicator.indicator_id))
                    continue

                value, unit = scores[key]
                if unit != indicator.expected_unit:
                    raise RuntimeError(
                        'Unit drift for indicator {}: expected {!r}, API returned '
                        '{!r}. Refusing to write.'.format(
                            indicator.indicator_id, indicator.expected_unit, unit))

                lookup = {
                    fk_name: instance,
                    'potential_type_id': indicator.potential_type_id,
                }
                if is_material:
                    lookup['standard_id'] = models.Standard.objects.get(
                        id=AGGREGATE_STANDARD_ID)

                existing = impact_model.objects.filter(**lookup).first()
                old_value = float(existing.value) if existing and existing.value is not None else None
                changes.append({
                    'impact_model': impact_model,
                    'lookup': lookup,
                    'value': value,
                    'unit_obj': indicator.unit_id,
                    'name': pin['name'],
                    'indicator': indicator.indicator_name,
                    'old': old_value,
                    'instance': instance,
                })

        self._report(changes, skipped_units, missing)

        if not options['apply']:
            self.stdout.write('Dry run: no rows written.')
            return

        with transaction.atomic():
            now = timezone.now()
            touched = set()
            for change in changes:
                defaults = {'value': change['value']}
                # PotentialTransport has no unit column.
                if change['unit_obj'] is not None and hasattr(
                        change['impact_model'], 'unit_id'):
                    defaults['unit_id'] = change['unit_obj']
                change['impact_model'].objects.update_or_create(
                    defaults=defaults, **change['lookup'])
                touched.add((type(change['instance']), change['instance'].id))

            for model_class, instance_id in touched:
                model_class.objects.filter(id=instance_id).update(
                    ecoinvent_synced_at=now)

        self.stdout.write(self.style.SUCCESS(
            'Wrote {} impact values.'.format(len(changes))))

        # Queue the licence usage report rather than submitting inline, so a
        # reporting outage can never fail an otherwise successful refresh.
        if client.accessed_dataset_ids:
            models.EcoinventUsageReport.objects.create(
                dataset_ids=json.dumps(sorted(client.accessed_dataset_ids)),
                indicator_ids=json.dumps(sorted(i.indicator_id for i in indicators)),
                reason=models.EcoinventUsageReport.REASON_REFRESH,
            )
            self.stdout.write(
                'Queued a licence usage report for {} dataset(s). Submit it with: '
                'python manage.py ecoinvent_report_usage --send'.format(
                    len(client.accessed_dataset_ids)))

    def _report(self, changes, skipped_units, missing):
        self.stdout.write('\n{} impact value(s) to write:'.format(len(changes)))
        for change in changes[:20]:
            old = 'n/a' if change['old'] is None else '{:.6g}'.format(change['old'])
            self.stdout.write('    {:<44} {:<38} {} -> {:.6g}'.format(
                change['name'][:44], change['indicator'][:38], old, change['value']))
        if len(changes) > 20:
            self.stdout.write('    ... and {} more'.format(len(changes) - 20))

        if skipped_units:
            self.stdout.write(self.style.WARNING(
                '\nSkipped {} material(s) on unit mismatch (use '
                '--allow-unit-mismatch to override, but realign the unit '
                'instead):'.format(len(skipped_units))))
            for name, ours, theirs in skipped_units:
                self.stdout.write('    {:<52} {} vs {}'.format(name[:52], ours, theirs))

        if missing:
            self.stdout.write(self.style.WARNING(
                '\n{} (entity, indicator) pair(s) had no score returned.'.format(
                    len(missing))))
