"""
Configuration for the ecoinvent API client.

Read here rather than in settings.py deliberately: these values are irrelevant
to every web request, and a missing credential must not be able to break
`manage.py migrate` in the container entrypoint.
"""
import os

from projects_api.ecoinvent.errors import EcoinventConfigError

DEFAULT_TOKEN_URL = (
    'https://sso.ecoinvent.org/realms/ecoinvent/protocol/openid-connect/token'
)
DEFAULT_API_BASE = 'https://api.ecoinvent.org'


class EcoinventConfig(object):
    """Immutable-ish view of the ECOINVENT_* environment."""

    def __init__(self, client_id, client_secret, token_url, api_base,
                 version, system_model, organization_id, allow_production,
                 timeout, max_retries):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = token_url
        self.api_base = api_base.rstrip('/')
        self.version = version
        self.system_model = system_model
        self.organization_id = organization_id
        self.allow_production = allow_production
        self.timeout = timeout
        self.max_retries = max_retries

    @property
    def is_sandbox(self):
        return 'sandbox' in (self.version or '').lower()

    def __repr__(self):
        # Never let the secret reach a log line or a traceback.
        return (
            'EcoinventConfig(version={!r}, system_model={!r}, api_base={!r}, '
            'client_id={!r}, secret=***)'
        ).format(self.version, self.system_model, self.api_base, self.client_id)


def _env_bool(name, default=False):
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ('1', 'true', 'yes', 'on')


def load_config():
    """Build an EcoinventConfig from the environment, or raise."""
    client_id = os.getenv('ECOINVENT_CLIENT_ID', '').strip()
    client_secret = os.getenv('ECOINVENT_CLIENT_SECRET', '').strip()

    missing = [
        name for name, value in (
            ('ECOINVENT_CLIENT_ID', client_id),
            ('ECOINVENT_CLIENT_SECRET', client_secret),
        ) if not value
    ]
    if missing:
        raise EcoinventConfigError(
            'Missing required environment variable(s): {}. '
            'See .env.example.'.format(', '.join(missing))
        )

    try:
        timeout = float(os.getenv('ECOINVENT_TIMEOUT', '30'))
        max_retries = int(os.getenv('ECOINVENT_MAX_RETRIES', '3'))
    except ValueError as exc:
        raise EcoinventConfigError('Invalid ECOINVENT_TIMEOUT/MAX_RETRIES: {}'.format(exc))

    return EcoinventConfig(
        client_id=client_id,
        client_secret=client_secret,
        token_url=os.getenv('ECOINVENT_TOKEN_URL', DEFAULT_TOKEN_URL),
        api_base=os.getenv('ECOINVENT_API_BASE', DEFAULT_API_BASE),
        version=os.getenv('ECOINVENT_VERSION', '3.12-sandbox'),
        system_model=os.getenv('ECOINVENT_SYSTEM_MODEL', 'cutoff'),
        organization_id=os.getenv('ECOINVENT_ORGANIZATION_ID', '').strip(),
        allow_production=_env_bool('ECOINVENT_ALLOW_PRODUCTION', False),
        timeout=timeout,
        max_retries=max_retries,
    )
