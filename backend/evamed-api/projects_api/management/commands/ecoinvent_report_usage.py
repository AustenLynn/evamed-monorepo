"""
Submit queued ecoinvent licence usage reports.

The licence requires reporting each delivery of a dataset's impact scores to an
organisation, including when they are served from our own cache. `ecoinvent_refresh`
enqueues a report for what it fetched; `--periodic` enqueues one covering the
whole pinned set, which is what covers ongoing cache-served delivery.

Requires ECOINVENT_ORGANIZATION_ID.

    python manage.py ecoinvent_report_usage --dry-run
    python manage.py ecoinvent_report_usage --periodic --send
    python manage.py ecoinvent_report_usage --send --retry-failed
"""
import json

from django.core.management.base import BaseCommand
from django.utils import timezone

from projects_api import models
from projects_api.ecoinvent.client import EcoinventClient

PINNED_MODELS = (
    models.Material,
    models.Transport,
    models.TypeEnergy,
    models.SourceInformation,
)


class Command(BaseCommand):
    help = 'Submit queued ecoinvent licence usage reports.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--send', action='store_true',
            help='Actually submit to the API (default is a dry run).')
        parser.add_argument(
            '--dry-run', action='store_true',
            help='List what would be submitted. This is the default.')
        parser.add_argument(
            '--periodic', action='store_true',
            help='Enqueue a report covering every pinned dataset, for values we '
                 'serve from our own cache.')
        parser.add_argument(
            '--retry-failed', action='store_true',
            help='Include reports that previously failed to submit.')

    def handle(self, *args, **options):
        client = EcoinventClient()

        if not client.config.organization_id:
            self.stderr.write(self.style.ERROR(
                'ECOINVENT_ORGANIZATION_ID is not set. Obtain it from the '
                'ecoinvent account and add it to .env before reporting.'))
            return

        if options['periodic']:
            self._enqueue_periodic(client)

        pending = models.EcoinventUsageReport.objects.filter(reported_at__isnull=True)
        if not options['retry_failed']:
            pending = pending.filter(attempts=0)
        pending = list(pending.order_by('created_at'))

        if not pending:
            self.stdout.write('Nothing to report.')
            return

        self.stdout.write('{} report(s) pending:'.format(len(pending)))
        for report in pending:
            dataset_ids = json.loads(report.dataset_ids)
            indicator_ids = json.loads(report.indicator_ids)
            self.stdout.write('    #{} {:<9} {} datasets x {} indicators'.format(
                report.id, report.reason, len(dataset_ids), len(indicator_ids)))

        if not options['send']:
            self.stdout.write(
                'Dry run: nothing submitted. Re-run with --send to report.')
            return

        sent = failed = 0
        for report in pending:
            report.attempts += 1
            try:
                client.report_usage(
                    json.loads(report.dataset_ids),
                    json.loads(report.indicator_ids),
                )
            except Exception as exc:  # noqa: BLE001 - record and continue
                report.last_error = str(exc)[:1000]
                report.save(update_fields=['attempts', 'last_error'])
                failed += 1
                self.stderr.write(self.style.ERROR(
                    '    #{} failed: {}'.format(report.id, exc)))
                continue

            report.reported_at = timezone.now()
            report.last_error = None
            report.save(update_fields=['attempts', 'reported_at', 'last_error'])
            sent += 1

        self.stdout.write(self.style.SUCCESS('Submitted {} report(s).'.format(sent)))
        if failed:
            self.stderr.write(self.style.ERROR(
                '{} report(s) failed and remain queued.'.format(failed)))

    def _enqueue_periodic(self, client):
        dataset_ids = set()
        for model in PINNED_MODELS:
            dataset_ids.update(
                model.objects.filter(
                    ecoinvent_dataset_id__isnull=False,
                    ecoinvent_version=client.config.version,
                    ecoinvent_system_model=client.config.system_model,
                ).values_list('ecoinvent_dataset_id', flat=True)
            )

        indicator_ids = list(models.EcoinventIndicatorMap.objects.filter(
            is_active=True).values_list('indicator_id', flat=True))

        if not dataset_ids or not indicator_ids:
            self.stdout.write('Nothing pinned yet; no periodic report enqueued.')
            return

        models.EcoinventUsageReport.objects.create(
            dataset_ids=json.dumps(sorted(dataset_ids)),
            indicator_ids=json.dumps(sorted(indicator_ids)),
            reason=models.EcoinventUsageReport.REASON_PERIODIC,
        )
        self.stdout.write('Enqueued periodic report for {} dataset(s).'.format(
            len(dataset_ids)))
