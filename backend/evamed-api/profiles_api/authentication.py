import json
import os

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


def _get_firebase_app():
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        return firebase_admin.get_app()

    cred_json = os.environ.get('FIREBASE_CREDENTIALS_JSON')
    if cred_json:
        cred = credentials.Certificate(json.loads(cred_json))
        return firebase_admin.initialize_app(cred)

    # Fall back to Application Default Credentials (Google Cloud / Render with workload identity)
    return firebase_admin.initialize_app()


class FirebaseUser:
    """Lightweight user returned when no Django UserProfile matches the token.

    `id`/`pk` are None so object-level permission checks such as
    `obj.id == request.user.id` fail closed instead of raising.
    """

    def __init__(self, uid: str, email: str, email_verified: bool = False, sign_in_provider: str = ''):
        self.uid = uid
        self.email = email
        self.email_verified = email_verified
        self.sign_in_provider = sign_in_provider
        # An unverified *password* account only proves someone typed the
        # address; OAuth providers (google.com, facebook.com, microsoft.com,
        # twitter.com, ...) take the email from the provider account, so it
        # is trustworthy even when Firebase reports email_verified=False.
        self.email_trusted = bool(email_verified) or sign_in_provider not in ('', 'password')
        self.id = None
        self.pk = None
        self.is_authenticated = True
        self.is_active = True
        # Admin rights only ever come from a Django UserProfile (see below).
        self.is_staff = False

    def __str__(self):
        return self.email


class FirebaseAuthentication(BaseAuthentication):
    """Verify Firebase ID tokens sent as `Authorization: Bearer <token>`."""

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        id_token = auth_header[len('Bearer '):]
        try:
            from firebase_admin import auth
            app = _get_firebase_app()
            decoded = auth.verify_id_token(id_token, app=app)
        except Exception:
            raise AuthenticationFailed('Invalid or expired Firebase token.')

        email = decoded.get('email', '')
        email_verified = bool(decoded.get('email_verified', False))
        sign_in_provider = decoded.get('firebase', {}).get('sign_in_provider', '')
        # Bridge to the Django user (which may carry is_staff) only for a
        # verified address: an unverified token just proves someone typed it.
        if email and email_verified:
            from profiles_api.models import UserProfile
            profile = UserProfile.objects.filter(email__iexact=email, is_active=True).first()
            if profile is not None:
                return (profile, None)

        return (
            FirebaseUser(
                uid=decoded['uid'], email=email, email_verified=email_verified,
                sign_in_provider=sign_in_provider,
            ),
            None,
        )

    def authenticate_header(self, request):
        # Lets DRF answer 401 (not 403) when credentials are missing.
        return 'Bearer'
