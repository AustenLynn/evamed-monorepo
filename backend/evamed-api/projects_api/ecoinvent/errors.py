"""Exceptions raised by the ecoinvent API integration."""


class EcoinventError(Exception):
    """Base class for every ecoinvent integration failure."""


class EcoinventConfigError(EcoinventError):
    """Required configuration is missing or malformed."""


class EcoinventAuthError(EcoinventError):
    """Token request failed, or the API rejected our credentials."""


class EcoinventGeographyError(EcoinventError):
    """A geography filter was passed in a form the API silently ignores."""


class EcoinventLicenceError(EcoinventError):
    """Refusing to run against a non-sandbox version without an explicit opt-in."""


class EcoinventQuotaError(EcoinventError):
    """The licence's unique-dataset quota has been exhausted."""


class EcoinventNotFound(EcoinventError):
    """The requested dataset does not exist in this version/system model."""
