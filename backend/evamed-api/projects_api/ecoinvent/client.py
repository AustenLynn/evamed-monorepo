"""
HTTP client for the ecoinvent v3 REST API.

Docs: https://docs.api.ecoinvent.org/
"""
import json
import os
import re
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from projects_api.ecoinvent.config import load_config
from projects_api.ecoinvent.errors import (
    EcoinventAuthError,
    EcoinventGeographyError,
    EcoinventLicenceError,
    EcoinventNotFound,
    EcoinventQuotaError,
    EcoinventError,
)

# Access tokens live 300s; refresh early so a slow batch page cannot straddle
# the expiry boundary.
TOKEN_EXPIRY_SKEW_SECONDS = 30

# Documented API ceilings.
MAX_DATASET_IDS_PER_BATCH = 1000
MAX_INDICATOR_IDS_PER_CALL = 100
MAX_PAGE_LIMIT = 100
MAX_DATASET_IDS_PER_REPORT = 10000

_GEOGRAPHIES_PATH = os.path.join(os.path.dirname(__file__), 'data', 'geographies.json')

# 'GLO', 'MX', 'RoW' — a bare code the API accepts and then silently ignores.
_BARE_CODE_RE = re.compile(r'^[A-Za-z-]{2,6}$')


def load_geography_names():
    """short code -> display name, e.g. 'GLO' -> 'Global (GLO)'."""
    with open(_GEOGRAPHIES_PATH) as handle:
        return json.load(handle)


def _chunk(items, size):
    items = list(items)
    for start in range(0, len(items), size):
        yield items[start:start + size]


class EcoinventClient(object):
    """
    Thin wrapper over the ecoinvent REST API.

    Tracks every dataset whose impact scores it retrieves in
    ``accessed_dataset_ids`` — that set is the input to usage reporting and to
    unique-dataset quota accounting.
    """

    def __init__(self, config=None, session=None):
        self.config = config or load_config()

        if not self.config.is_sandbox and not self.config.allow_production:
            raise EcoinventLicenceError(
                "Refusing to run against non-sandbox version {!r}. Set "
                "ECOINVENT_ALLOW_PRODUCTION=True once a production licence is "
                "in place — a production run consumes the unique-dataset quota."
                .format(self.config.version)
            )

        self.session = session or self._build_session()
        self._token = None
        self._token_expires_at = 0.0
        self.accessed_dataset_ids = set()
        self._geographies = None

    # ------------------------------------------------------------------ setup

    def _build_session(self):
        session = requests.Session()
        retry = Retry(
            total=self.config.max_retries,
            backoff_factor=1.0,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=frozenset(['GET', 'POST']),
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('https://', adapter)
        session.mount('http://', adapter)
        return session

    # ------------------------------------------------------------------- auth

    def _get_token(self, force_refresh=False):
        if not force_refresh and self._token and time.time() < self._token_expires_at:
            return self._token

        response = self.session.post(
            self.config.token_url,
            data={
                'grant_type': 'client_credentials',
                'client_id': self.config.client_id,
                'client_secret': self.config.client_secret,
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=self.config.timeout,
        )
        if response.status_code != 200:
            raise EcoinventAuthError(
                'Token request failed ({}): {}'.format(
                    response.status_code, response.text[:300])
            )

        payload = response.json()
        self._token = payload['access_token']
        expires_in = int(payload.get('expires_in', 300))
        self._token_expires_at = time.time() + expires_in - TOKEN_EXPIRY_SKEW_SECONDS
        return self._token

    def _request(self, method, path, **kwargs):
        """Issue an authenticated request, re-authenticating once on a 401."""
        url = '{}{}'.format(self.config.api_base, path)
        kwargs.setdefault('timeout', self.config.timeout)

        for attempt in (1, 2):
            headers = dict(kwargs.pop('headers', {}) or {})
            headers['Authorization'] = 'Bearer {}'.format(
                self._get_token(force_refresh=(attempt == 2)))
            response = self.session.request(method, url, headers=headers, **kwargs)

            if response.status_code == 401 and attempt == 1:
                continue  # token may have expired mid-flight; refresh and retry

            if response.status_code == 401:
                raise EcoinventAuthError('Unauthorized: {}'.format(response.text[:300]))
            if response.status_code == 403:
                raise EcoinventQuotaError(
                    'Forbidden — this usually means the licence does not cover the '
                    'requested indicator, or the unique-dataset quota is exhausted: '
                    '{}'.format(response.text[:300])
                )
            if response.status_code == 404:
                raise EcoinventNotFound('Not found: {}'.format(url))
            if response.status_code >= 400:
                raise EcoinventError(
                    'ecoinvent API error {} for {}: {}'.format(
                        response.status_code, url, response.text[:300])
                )
            return response.json()

        # Unreachable: attempt 2 always returns or raises above.
        raise EcoinventAuthError('Exhausted authentication attempts for {}'.format(url))

    # -------------------------------------------------------------- geography

    def normalize_geography(self, geography):
        """
        Map a short code to the display name the API actually filters on.

        `geography=MX` returns HTTP 200 with `total: 0` — a silent wrong answer
        rather than an error — so a bare code must never reach the wire.
        """
        if not geography:
            return None
        if self._geographies is None:
            self._geographies = load_geography_names()

        if geography in self._geographies:
            return self._geographies[geography]
        if geography in self._geographies.values():
            return geography
        if _BARE_CODE_RE.match(geography):
            raise EcoinventGeographyError(
                "Unknown geography code {!r}. The API needs the full display "
                "name (e.g. 'Mexico (MX)'); bare codes return 0 results with "
                "HTTP 200.".format(geography)
            )
        return geography

    # ------------------------------------------------------------------ reads

    def search_datasets(self, query, geography=None, activity_type=None,
                        limit=50, offset=0):
        """Free-text dataset search. Returns the `results` list."""
        params = [
            ('query', query),
            ('limit', min(limit, MAX_PAGE_LIMIT)),
            ('offset', offset),
            ('version', self.config.version),
            ('system_model', self.config.system_model),
        ]
        normalized = self.normalize_geography(geography)
        if normalized:
            params.append(('geography', normalized))
        if activity_type:
            params.append(('activity_type', activity_type))

        return self._request('GET', '/v3/api1/datasets', params=params).get('results', [])

    def get_dataset(self, dataset_id, indicator_ids=()):
        """One dataset, optionally with impact scores. Consumes quota."""
        params = [
            ('version', self.config.version),
            ('system_model', self.config.system_model),
        ]
        # Repeated params — comma-separated values are NOT supported.
        params.extend(('indicator_ids', int(i)) for i in indicator_ids)

        payload = self._request(
            'GET', '/v3/api1/datasets/{}'.format(int(dataset_id)), params=params)
        if indicator_ids:
            self.accessed_dataset_ids.add(int(dataset_id))
        return payload

    def batch_datasets(self, dataset_ids, indicator_ids):
        """
        Impact scores for many datasets. Yields dataset dicts.

        Consumes unique-dataset quota for every id passed in, so callers should
        offer a dry run before invoking this.
        """
        dataset_ids = [int(i) for i in dataset_ids]
        indicator_ids = [int(i) for i in indicator_ids]

        for id_chunk in _chunk(dataset_ids, MAX_DATASET_IDS_PER_BATCH):
            for indicator_chunk in _chunk(indicator_ids, MAX_INDICATOR_IDS_PER_CALL):
                offset = 0
                while True:
                    payload = self._request(
                        'POST', '/v3/api1/datasets/batch',
                        params=[
                            ('limit', MAX_PAGE_LIMIT),
                            ('offset', offset),
                            ('version', self.config.version),
                            ('system_model', self.config.system_model),
                        ],
                        json={
                            'dataset_ids': id_chunk,
                            'indicator_ids': indicator_chunk,
                        },
                    )
                    datasets = payload.get('datasets', [])
                    for dataset in datasets:
                        self.accessed_dataset_ids.add(int(dataset['id']))
                        yield dataset

                    offset += len(datasets)
                    if len(datasets) < MAX_PAGE_LIMIT or offset >= payload.get('total', 0):
                        break

    def list_versions(self):
        return self._request('GET', '/v3/api1/versions').get('results', [])

    # ----------------------------------------------------------------- writes

    def report_usage(self, dataset_ids, indicator_ids, organization_id=None):
        """
        Mandatory licence reporting. Required even when values are served from
        our own cache, so this reports data *delivery*, not API calls.
        """
        organization_id = organization_id or self.config.organization_id
        if not organization_id:
            raise EcoinventError(
                'ECOINVENT_ORGANIZATION_ID is required to submit usage reports.')

        indicator_ids = [int(i) for i in indicator_ids][:MAX_INDICATOR_IDS_PER_CALL]
        for id_chunk in _chunk([int(i) for i in dataset_ids], MAX_DATASET_IDS_PER_REPORT):
            self._request('POST', '/v3/api1/reports', json={
                'organization_id': organization_id,
                'dataset_ids': id_chunk,
                'indicator_ids': indicator_ids,
            })
