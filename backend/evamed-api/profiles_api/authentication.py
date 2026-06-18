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

    def __init__(self, uid: str, email: str):
        self.uid = uid
        self.email = email
        self.id = None
        self.pk = None
        self.is_authenticated = True
        self.is_active = True

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
        # Bridge to the real Django user when one exists, so standard
        # object-level permissions (obj.id == request.user.id) work.
        if email:
            from profiles_api.models import UserProfile
            profile = UserProfile.objects.filter(email=email).first()
            if profile is not None:
                return (profile, None)

        return (FirebaseUser(uid=decoded['uid'], email=email), None)
