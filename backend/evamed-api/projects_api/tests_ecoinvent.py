"""Offline tests for the ecoinvent integration. No test here touches the network."""
import json

from django.test import TestCase

from projects_api.ecoinvent.client import EcoinventClient, load_geography_names
from projects_api.ecoinvent.config import EcoinventConfig
from projects_api.ecoinvent.errors import (
    EcoinventGeographyError,
    EcoinventLicenceError,
)
from projects_api.ecoinvent.matching import (
    MARKET_ACTIVITY,
    MARKET_GROUP,
    TRANSFORMING_ACTIVITY,
    parse_simapro_name,
    pick_best,
    units_compatible,
)


def make_config(**overrides):
    defaults = dict(
        client_id='id', client_secret='secret',
        token_url='https://sso.example/token', api_base='https://api.example',
        version='3.12-sandbox', system_model='cutoff', organization_id='org',
        allow_production=False, timeout=5, max_retries=1,
    )
    defaults.update(overrides)
    return EcoinventConfig(**defaults)


class FakeResponse(object):
    def __init__(self, status_code=200, payload=None, text=''):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text

    def json(self):
        return self._payload


class FakeSession(object):
    """Records calls and replays queued responses."""

    def __init__(self, token_payload=None):
        self.token_payload = token_payload or {
            'access_token': 'tok-1', 'expires_in': 300}
        self.token_calls = 0
        self.requests = []
        self.queued = []

    def post(self, url, data=None, headers=None, timeout=None):
        self.token_calls += 1
        payload = dict(self.token_payload)
        payload['access_token'] = 'tok-{}'.format(self.token_calls)
        return FakeResponse(200, payload)

    def request(self, method, url, **kwargs):
        self.requests.append((method, url, kwargs))
        if self.queued:
            return self.queued.pop(0)
        return FakeResponse(200, {'results': [], 'datasets': [], 'total': 0})


class ParseSimaproNameTests(TestCase):

    def test_parses_market_activity(self):
        parsed = parse_simapro_name('Clay brick {GLO}| market for | Cut-off, S')
        self.assertEqual(parsed.activity, 'Clay brick')
        self.assertEqual(parsed.geography_code, 'GLO')
        self.assertEqual(parsed.activity_type, MARKET_ACTIVITY)

    def test_market_group_is_its_own_activity_type(self):
        """Treating a market group as MARKET_ACTIVITY returns zero results."""
        parsed = parse_simapro_name(
            'Concrete, normal {GLO}| market group for concrete, normal | Cut-off, S')
        self.assertEqual(parsed.activity, 'Concrete, normal')
        self.assertEqual(parsed.activity_type, MARKET_GROUP)

    def test_parses_non_market_activity(self):
        parsed = parse_simapro_name(
            'Refractory material, acid {GLO}| kaolin to generic market for '
            'refractory material, acid | Cut-off, S')
        self.assertEqual(parsed.activity, 'Refractory material, acid')
        self.assertEqual(parsed.activity_type, TRANSFORMING_ACTIVITY)

    def test_parses_swiss_geography(self):
        parsed = parse_simapro_name(
            'Autoclaved aerated concrete block {CH}| market for autoclaved '
            'aerated concrete block | Cut-off, S')
        self.assertEqual(parsed.geography_code, 'CH')

    def test_parses_trailing_parenthesised_geography(self):
        parsed = parse_simapro_name('Panel fotovoltaico, Silicio amorfo (a-Si) (GLO)')
        self.assertEqual(parsed.geography_code, 'GLO')

    def test_name_without_structure_still_parses(self):
        parsed = parse_simapro_name('Banda transportadora')
        self.assertEqual(parsed.activity, 'Banda transportadora')
        self.assertIsNone(parsed.geography_code)
        self.assertIsNone(parsed.activity_type)


class UnitCompatibilityTests(TestCase):

    def test_equivalent_units(self):
        self.assertTrue(units_compatible('Kg', 'kg'))
        self.assertTrue(units_compatible('m²', 'm2'))
        self.assertTrue(units_compatible('m³', 'm3'))

    def test_incompatible_units(self):
        self.assertFalse(units_compatible('Pz', 'kg'))
        self.assertFalse(units_compatible('Kg', 'm3'))

    def test_missing_unit_is_not_compatible(self):
        self.assertFalse(units_compatible(None, 'kg'))


class PickBestTests(TestCase):

    def _candidate(self, product, dataset_id=1, unit='kg', activity=None):
        return {
            'dataset_id': dataset_id,
            'product_name': product,
            'activity_name': activity or 'market for {}'.format(product),
            'unit': unit,
            'geography': 'Global (GLO)',
            'activity_type': MARKET_ACTIVITY,
        }

    def test_exact_product_match_wins(self):
        parsed = parse_simapro_name('Clay brick {GLO}| market for | Cut-off, S')
        best, score, method, _alts = pick_best(
            parsed,
            [self._candidate('light clay brick', 1), self._candidate('clay brick', 2)],
        )
        self.assertEqual(best['dataset_id'], 2)
        self.assertEqual(method, 'exact')
        self.assertEqual(score, 1.0)

    def test_substring_alone_does_not_auto_match(self):
        """
        'clay brick' is a substring of 'light clay brick'. Accepting that would
        map two different EVAmed materials onto one dataset.
        """
        parsed = parse_simapro_name('Clay brick {GLO}| market for | Cut-off, S')
        best, _score, method, _alts = pick_best(
            parsed, [self._candidate('light clay brick', 1)])
        self.assertIsNone(best)
        self.assertEqual(method, 'below-threshold')

    def test_unit_mismatch_is_reported_not_blocking(self):
        """Units are realigned rather than treated as a reason to reject."""
        parsed = parse_simapro_name('Ceramic tile {GLO}| market for | Cut-off, S')
        best, _score, _method, _alts = pick_best(
            parsed, [self._candidate('ceramic tile', 7, unit='kg')],
            evamed_unit='Pz')
        self.assertIsNotNone(best)
        self.assertFalse(best['unit_compatible'])

    def test_no_candidates(self):
        parsed = parse_simapro_name('Nothing {GLO}| market for | Cut-off, S')
        best, score, method, alternatives = pick_best(parsed, [])
        self.assertIsNone(best)
        self.assertEqual(method, 'none')
        self.assertEqual(alternatives, [])


class GeographyGuardTests(TestCase):

    def setUp(self):
        self.client_obj = EcoinventClient(
            config=make_config(), session=FakeSession())

    def test_short_code_is_expanded_to_display_name(self):
        self.assertEqual(self.client_obj.normalize_geography('MX'), 'Mexico (MX)')
        self.assertEqual(self.client_obj.normalize_geography('GLO'), 'Global (GLO)')

    def test_display_name_passes_through(self):
        self.assertEqual(
            self.client_obj.normalize_geography('Mexico (MX)'), 'Mexico (MX)')

    def test_unknown_bare_code_raises(self):
        """`geography=XX` returns HTTP 200 with 0 results — a silent wrong answer."""
        with self.assertRaises(EcoinventGeographyError):
            self.client_obj.normalize_geography('ZZ')

    def test_none_passes_through(self):
        self.assertIsNone(self.client_obj.normalize_geography(None))

    def test_geographies_file_is_loadable(self):
        geographies = load_geography_names()
        self.assertEqual(geographies['GLO'], 'Global (GLO)')
        self.assertEqual(geographies['MX'], 'Mexico (MX)')


class TokenCachingTests(TestCase):

    def test_token_is_reused_within_its_lifetime(self):
        session = FakeSession()
        client_obj = EcoinventClient(config=make_config(), session=session)
        client_obj.search_datasets('a')
        client_obj.search_datasets('b')
        self.assertEqual(session.token_calls, 1)

    def test_token_is_refreshed_after_expiry(self):
        session = FakeSession(token_payload={'access_token': 'x', 'expires_in': 300})
        client_obj = EcoinventClient(config=make_config(), session=session)
        client_obj.search_datasets('a')
        client_obj._token_expires_at = 0  # simulate expiry
        client_obj.search_datasets('b')
        self.assertEqual(session.token_calls, 2)


class RequestShapeTests(TestCase):

    def test_indicator_ids_are_repeated_params(self):
        """Comma-separated indicator_ids are not supported by the API."""
        session = FakeSession()
        client_obj = EcoinventClient(config=make_config(), session=session)
        session.queued.append(FakeResponse(200, {'id': 5, 'impact_scores': []}))
        client_obj.get_dataset(5, [882, 956])

        _method, _url, kwargs = session.requests[-1]
        indicator_params = [v for k, v in kwargs['params'] if k == 'indicator_ids']
        self.assertEqual(indicator_params, [882, 956])

    def test_fetching_scores_records_quota_usage(self):
        session = FakeSession()
        client_obj = EcoinventClient(config=make_config(), session=session)
        session.queued.append(FakeResponse(200, {'id': 5, 'impact_scores': []}))
        client_obj.get_dataset(5, [882])
        self.assertEqual(client_obj.accessed_dataset_ids, {5})

    def test_metadata_only_fetch_does_not_consume_quota(self):
        session = FakeSession()
        client_obj = EcoinventClient(config=make_config(), session=session)
        session.queued.append(FakeResponse(200, {'id': 5}))
        client_obj.get_dataset(5)
        self.assertEqual(client_obj.accessed_dataset_ids, set())


class ProductionGateTests(TestCase):

    def test_non_sandbox_version_requires_explicit_opt_in(self):
        with self.assertRaises(EcoinventLicenceError):
            EcoinventClient(config=make_config(version='3.12'), session=FakeSession())

    def test_non_sandbox_allowed_when_opted_in(self):
        client_obj = EcoinventClient(
            config=make_config(version='3.12', allow_production=True),
            session=FakeSession())
        self.assertFalse(client_obj.config.is_sandbox)

    def test_config_repr_hides_the_secret(self):
        self.assertNotIn('secret', make_config().__repr__().replace('secret=***', ''))


class ManualPinsFileTests(TestCase):

    def test_manual_pins_file_is_valid_and_covers_the_expected_rows(self):
        import os
        from projects_api.management.commands import ecoinvent_resolve

        with open(ecoinvent_resolve.MANUAL_PINS_PATH) as handle:
            pins = json.load(handle)

        self.assertTrue(os.path.exists(ecoinvent_resolve.MANUAL_PINS_PATH))
        self.assertEqual(len(pins['transport']), 7)
        self.assertEqual(len(pins['type_energy']), 3)
        self.assertEqual(len(pins['source_information']), 11)

        # Every pin either carries an id with an expected activity to verify
        # against, or is explicitly marked unresolved with a reason.
        for key in ('transport', 'type_energy', 'source_information'):
            for pin in pins[key]:
                if pin.get('dataset_id'):
                    self.assertTrue(pin.get('expected_activity'), pin['entity_name'])
                else:
                    self.assertEqual(pin.get('confidence'), 'unresolved')
                    self.assertTrue(pin.get('notes'), pin['entity_name'])
