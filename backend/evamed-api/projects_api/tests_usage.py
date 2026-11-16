"""Usage aggregate: atomic writes, honest legacy state and retry identity."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import close_old_connections, connections
from decimal import Decimal
from uuid import uuid4

from rest_framework.test import APIClient, APITestCase, APITransactionTestCase
from profiles_api.models import UserProfile
from projects_api import models


class UsageTests(APITestCase):
    def setUp(self):
        self.user = UserProfile.objects.create_user(email='usage@example.com', name='Usage')
        self.client.force_authenticate(self.user)
        owner = models.UserPlatform.objects.create(email=self.user.email, name='Usage')
        self.project = models.Project.objects.create(name_project='Casa', user_platform_id=owner)
        self.unit = models.Unit.objects.create(name_unit='kWh')
        self.piece = models.Unit.objects.create(name_unit='Pz')
        self.electric = models.TypeEnergy.objects.create(
            name_type_energy='Energía eléctrica, Medio voltaje (MX)-ECOINVENT3')
        self.gas = models.TypeEnergy.objects.create(
            name_type_energy='Calefacción doméstica con gas natural (GLO)')
        self.url = f'/api-projects/projects/{self.project.pk}/usage/'

    def state(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, getattr(response, 'data', response.content))
        return response.data

    def put(self, **changes):
        data = {'revision': self.state()['revision'], 'operation_id': str(uuid4()), **changes}
        return self.client.put(self.url, data, format='json')

    def annual(self, quantity=10000, unit=None):
        return models.AnnualConsumptionRequired.objects.create(
            project_id=self.project, quantity=quantity, unit_id=unit or self.unit)

    def row(self, annual, share=60, **changes):
        fields = dict(annual_consumption_required_id=annual, percentage=share,
                      quantity=Decimal(annual.quantity) * Decimal(share or 0) / 100,
                      unit_id=self.unit, source='electric', type=self.electric)
        fields.update(changes)
        return models.ElectricityConsumptionData.objects.create(**fields)

    def test_empty_and_creation_retry_after_lost_response(self):
        self.assertIsNone(self.state()['annual'])
        payload = dict(revision=self.state()['revision'], operation_id=str(uuid4()),
                       annual={'quantity': 10000}, additions=[
                           {'client_id': str(uuid4()), 'type': self.electric.id, 'source': 'electric'}])
        first = self.client.put(self.url, payload, format='json')
        self.assertEqual(first.status_code, 200, first.data)
        second = self.client.put(self.url, payload, format='json')
        self.assertEqual(second.status_code, 200, second.data)
        self.assertTrue(second.data['replayed'])
        self.assertEqual(models.AnnualConsumptionRequired.objects.count(), 1)
        self.assertEqual(models.ElectricityConsumptionData.objects.count(), 1)
        self.assertEqual(second.data['sources'][0]['percentage'], 0)
        payload['annual']['quantity'] = 12000
        self.assertEqual(self.client.put(self.url, payload, format='json').status_code, 409)

    def test_repeated_family_rows_retained_and_total_recalculated_exactly(self):
        annual = self.annual()
        one = self.row(annual)
        two = self.row(annual, 20)
        self.assertEqual(len(self.state()['sources']), 2)
        response = self.put(annual={'quantity': 12000})
        self.assertEqual(response.status_code, 200, response.data)
        one.refresh_from_db(); two.refresh_from_db()
        self.assertEqual((one.percentage, one.quantity), (60, Decimal('7200')))
        self.assertEqual((two.percentage, two.quantity), (20, Decimal('2400')))
        self.assertEqual({r['id'] for r in response.data['sources']}, {one.id, two.id})

    def test_stale_revision_from_legacy_writer_returns_conflict_without_changes(self):
        annual = self.annual()
        revision = self.state()['revision']
        annual.quantity = 8000; annual.save()
        response = self.client.put(self.url, dict(revision=revision, operation_id=str(uuid4()),
                                                annual={'quantity': 12000}), format='json')
        self.assertEqual(response.status_code, 409)
        annual.refresh_from_db(); self.assertEqual(annual.quantity, 8000)

    def test_replace_retains_identity_and_explicit_delete(self):
        row = self.row(self.annual(), 20)
        response = self.put(edits=[{'id': row.id, 'type': self.gas.id, 'source': 'fuel', 'percentage': 20}])
        self.assertEqual(response.status_code, 200, response.data)
        row.refresh_from_db()
        self.assertEqual((row.type_id, row.source, row.quantity), (self.gas.id, 'fuel', Decimal('2000')))
        response = self.put(removals=[row.id])
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(models.ElectricityConsumptionData.objects.filter(pk=row.id).exists())

    def test_replacement_cannot_create_duplicate_but_historic_duplicate_is_editable(self):
        annual = self.annual()
        first = self.row(annual, 20)
        second = self.row(annual, 20, type=self.gas, source='fuel')
        response = self.put(edits=[{'id': second.id, 'type': self.electric.id, 'source': 'electric'}])
        self.assertEqual(response.status_code, 400, response.data)
        second.refresh_from_db()
        self.assertEqual(second.type_id, self.gas.id)
        second.type = self.electric; second.source = 'electric'; second.save()
        response = self.put(edits=[{'id': second.id, 'percentage': 30}])
        self.assertEqual(response.status_code, 200, response.data)
        first.refresh_from_db(); second.refresh_from_db()
        self.assertEqual((first.percentage, second.percentage), (20, 30))

    def test_overallocation_rolls_back_annual_and_every_source(self):
        annual = self.annual(); row = self.row(annual, 80)
        response = self.put(annual={'quantity': 12000}, edits=[{'id': row.id, 'percentage': 101}])
        self.assertEqual(response.status_code, 400)
        annual.refresh_from_db(); row.refresh_from_db()
        self.assertEqual((annual.quantity, row.quantity), (10000, Decimal('8000')))
        self.assertEqual(self.put(additions=[{'client_id': str(uuid4()), 'source': 'panels', 'type': None}],
                                  edits=[{'id': row.id, 'percentage': 100}],
                                  removals=[row.id]).status_code, 400)

    def test_incremental_repair_preserves_unrelated_legacy_rows(self):
        annual = self.annual()
        first = self.row(annual, 40, unit_id=self.piece)
        second = self.row(annual, None, source='unknown', quantity=None, unit_id=None)
        self.assertEqual(self.put(annual={'quantity': 12000}).status_code, 400)
        response = self.put(edits=[{'id': first.id, 'percentage': 40, 'repair_unit': True}])
        self.assertEqual(response.status_code, 200, response.data)
        first.refresh_from_db(); second.refresh_from_db()
        self.assertEqual(first.unit_id_id, self.unit.id)
        self.assertEqual((second.source, second.percentage, second.quantity, second.unit_id_id),
                         ('unknown', None, None, None))
        self.assertEqual(self.put(annual={'quantity': 12000}).status_code, 400)

    def test_missing_ambiguous_unit_and_multiple_annuals_block_writes(self):
        self.unit.delete()
        self.assertIsNone(self.state()['canonical_unit_id'])
        self.assertEqual(self.put(annual={'quantity': 0}).status_code, 400)
        self.unit = models.Unit.objects.create(name_unit='kWh')
        models.Unit.objects.create(name_unit=' KWH ')
        self.assertIsNone(self.state()['canonical_unit_id'])
        self.assertEqual(self.put(annual={'quantity': 0}).status_code, 400)
        self.annual(); self.annual()
        self.assertIn('multiple_annuals', self.state()['issues'])
        self.assertEqual(self.put(removals=[]).status_code, 400)

    def test_numeric_boundaries_and_exact_fractional_quantity(self):
        annual = self.annual(1); row = self.row(annual, 0)
        for value in [-1, 101, 0.5, True, '1.0']:
            self.assertEqual(self.put(edits=[{'id': row.id, 'percentage': value}]).status_code, 400)
        response = self.put(edits=[{'id': row.id, 'percentage': 33}])
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['sources'][0]['quantity'], '0.3300000000')
        self.assertEqual(self.put(annual={'quantity': 0}).status_code, 200)
        row.refresh_from_db(); self.assertEqual(row.quantity, 0)
        for value in [-1, 1.5, True, 2147483648]:
            self.assertEqual(self.put(annual={'quantity': value}).status_code, 400)

    def test_unknown_types_and_duplicate_additions_are_rejected(self):
        self.annual()
        other = models.TypeEnergy.objects.create(name_type_energy='Unknown heating')
        self.assertEqual(self.put(additions=[{'client_id': str(uuid4()), 'type': other.id,
                                             'source': 'electric'}]).status_code, 400)
        row = self.row(models.AnnualConsumptionRequired.objects.get(project_id=self.project), 0)
        self.assertEqual(self.put(additions=[{'client_id': str(uuid4()), 'type': row.type_id,
                                             'source': 'electric'}]).status_code, 400)
        self.assertEqual(self.put(edits=[{'id': row.id, 'quantity': 800}]).status_code, 400)

    def test_foreign_rows_and_untrusted_ownership(self):
        another = models.Project.objects.create(name_project='Other')
        acr = models.AnnualConsumptionRequired.objects.create(project_id=another, quantity=100, unit_id=self.unit)
        row = self.row(acr, 20)
        self.annual()
        self.assertEqual(self.put(removals=[row.id]).status_code, 400)
        self.assertEqual(self.client.get(f'/api-projects/projects/{another.id}/usage/').status_code, 404)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self.url).status_code, (401, 403))

    def test_reconciliation_reports_committed_operation_without_replaying(self):
        operation = str(uuid4())
        response = self.put(operation_id=operation, annual={'quantity': 100})
        self.assertEqual(response.status_code, 200)
        reviewed = self.client.get(self.url, {'operation_id': operation})
        self.assertIs(reviewed.data['operation_applied'], True)
        reviewed = self.client.get(self.url, {'operation_id': str(uuid4())})
        self.assertIs(reviewed.data['operation_applied'], False)

    def test_percentage_total_and_foreign_edit_validation(self):
        annual = self.annual(); one = self.row(annual, 60); self.row(annual, 20)
        self.assertEqual(self.put(edits=[{'id': one.id, 'percentage': 81}]).status_code, 400)
        one.refresh_from_db(); self.assertEqual(one.percentage, 60)
        self.assertEqual(self.put(edits=[{'id': one.id, 'percentage': 80}]).status_code, 200)
        self.assertEqual(self.put(edits=[{'id': 999999, 'percentage': 0}]).status_code, 400)

    def test_negative_legacy_share_cannot_hide_overallocation(self):
        annual = self.annual()
        row = self.row(annual, 60)
        self.row(annual, -40)
        self.row(annual, 40)
        self.assertEqual(self.put(edits=[{'id': row.id, 'percentage': 61}]).status_code, 400)

    def test_photovoltaic_addition_is_not_blocked_by_unrelated_null_type_legacy_row(self):
        annual = self.annual()
        self.row(annual, 0, source='unknown', type=None)
        response = self.put(additions=[{'client_id': str(uuid4()), 'source': 'panels', 'type': None}])
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(models.ElectricityConsumptionData.objects.filter(source='panels', type=None).count(), 1)

    def test_b6_counts_all_typed_rows_and_preserves_photovoltaic_treatment(self):
        life = models.UsefulLife.objects.create(name_useful_life='50')
        self.project.useful_life_id = life; self.project.save()
        impact = models.PotentialType.objects.create(name_potential_type='PCG 100',
            name_complete_potential_type='Calentamiento Global', unit_potential_type='kg CO2 eq')
        models.TypeEnergyData.objects.create(type_energy_id=self.electric, potential_type_id=impact,
                                            unit_id=self.unit, value=Decimal('0.5'))
        annual = self.annual(100)
        self.row(annual, 60); self.row(annual, 20)
        self.row(annual, 20, source='panels', type=None)
        result = self.client.get(f'/api-projects/projects/{self.project.id}/results/')
        self.assertEqual(result.status_code, 200, result.data)
        # (60 + 20) * 0.5 * 50; panels have no catalogue factor.
        self.assertEqual(result.data['datos']['Calentamiento Global']['Uso']['B6'], 2000)

    def test_untrusted_claimed_email_cannot_read_or_write(self):
        from projects_api.testing import firebase_user
        self.client.force_authenticate(firebase_user(self.user.email, verified=False))
        self.assertEqual(self.client.get(self.url).status_code, 404)
        response = self.client.put(self.url, {'revision': 'anything', 'operation_id': str(uuid4())}, format='json')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(models.AnnualConsumptionRequired.objects.count(), 0)

    def test_replay_after_deletion_does_not_resurrect_additions(self):
        data = {'revision': self.state()['revision'], 'operation_id': str(uuid4()),
                'annual': {'quantity': 0}, 'additions': [
                    {'client_id': str(uuid4()), 'type': self.electric.id, 'source': 'electric'}]}
        response = self.client.put(self.url, data, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        row_id = response.data['sources'][0]['id']
        self.assertEqual(self.put(removals=[row_id]).status_code, 200)
        replay = self.client.put(self.url, data, format='json')
        self.assertEqual(replay.status_code, 200)
        self.assertTrue(replay.data['replayed'])
        self.assertEqual(replay.data['sources'], [])


    def test_coordinated_negative_annual_repair_retains_row_ids(self):
        annual = self.annual(-100); row = self.row(annual, 60)
        self.assertEqual(self.put(annual={'quantity': 100}).status_code, 400)
        response = self.put(annual={'quantity': 100}, edits=[{'id': row.id, 'percentage': 60}])
        self.assertEqual(response.status_code, 200, response.data)
        row.refresh_from_db(); annual.refresh_from_db()
        self.assertEqual((annual.quantity, row.quantity, row.percentage), (100, Decimal('60'), 60))
        self.assertEqual(response.data['sources'][0]['id'], row.id)

    def test_incremental_metadata_repair_under_negative_annual_preserves_quantity(self):
        annual = self.annual(-100); row = self.row(annual, 60, unit_id=self.piece)
        response = self.put(edits=[{'id': row.id, 'percentage': 60, 'repair_unit': True}])
        self.assertEqual(response.status_code, 200, response.data)
        row.refresh_from_db()
        self.assertEqual((row.quantity, row.unit_id_id), (Decimal('-60'), self.unit.id))
        self.assertEqual(response.data['sources'][0]['issues'], ['quantity'])


class UsageConcurrencyTests(APITransactionTestCase):
    def test_simultaneous_initial_retry_creates_only_one_aggregate(self):
        owner = models.UserPlatform.objects.create(email='parallel@example.com', name='Parallel')
        project = models.Project.objects.create(name_project='Concurrent', user_platform_id=owner)
        models.Unit.objects.create(name_unit='kWh')
        user = UserProfile.objects.create_user(email=owner.email, name='Parallel')
        client = APIClient(); client.force_authenticate(user)
        url = f'/api-projects/projects/{project.id}/usage/'
        revision = client.get(url).data['revision']
        payload = {'revision': revision, 'operation_id': str(uuid4()), 'annual': {'quantity': 100},
                   'additions': [{'client_id': str(uuid4()), 'type': None, 'source': 'panels'}]}
        barrier = Barrier(2)

        def send():
            close_old_connections()
            try:
                caller = APIClient(); caller.force_authenticate(user)
                barrier.wait(timeout=10)
                response = caller.put(url, payload, format='json')
                return response.status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: send(), range(2)))
        self.assertEqual(results, [200, 200])
        self.assertEqual(models.AnnualConsumptionRequired.objects.filter(project_id=project).count(), 1)
        self.assertEqual(models.ElectricityConsumptionData.objects.count(), 1)
        self.assertEqual(models.UsageSaveReceipt.objects.count(), 1)
