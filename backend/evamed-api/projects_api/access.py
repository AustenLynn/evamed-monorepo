"""Who may read and change what through the projects API.

* Catalogue tables (materials, units, transports, ...) are public to read;
  only admins may change them. An admin is a Django UserProfile with is_staff,
  which FirebaseAuthentication only returns for a verified email.
* Project data belongs to the UserPlatform whose email matches the caller's
  Firebase token.
"""
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from projects_api import models

PROJECT_OWNER = 'project_id__user_platform_id__email'


def is_admin(user):
    return bool(getattr(user, 'is_authenticated', False) and getattr(user, 'is_staff', False))


def claimed_email(user):
    return (getattr(user, 'email', '') or '').strip().lower()


def caller_email(user):
    """The identity used for data ownership.

    A `UserProfile` has no `email_trusted` attribute, so it defaults to
    trusted; it's only ever bridged from a Firebase token for a verified
    email (see FirebaseAuthentication). A `FirebaseUser` may carry an
    untrusted claimed email (any sign-in Firebase reports unverified) which
    must not be treated as an owned identity.
    """
    if not getattr(user, 'email_trusted', True):
        return ''
    return claimed_email(user)


def owned_projects(user):
    email = caller_email(user)
    if not email:
        return models.Project.objects.none()
    return models.Project.objects.filter(user_platform_id__email__iexact=email)


def owns_project(user, project_id):
    try:
        project_id = int(project_id)
    except (TypeError, ValueError):
        return False
    return owned_projects(user).filter(id=project_id).exists()


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or is_admin(request.user)


class OwnedByCallerMixin:
    """Limit a ModelViewSet to rows whose owner email is the caller's.

    `owner_email_path` is the ORM path from the model to the owner's email,
    e.g. PROJECT_OWNER. Its first segment must be a serializer field.

    `require_trusted_email` (default True) picks which identity counts as
    "the caller's": the trusted one (`caller_email`) normally, or the merely
    claimed one (`claimed_email`) when a viewset sets this False. Users-platform
    sets it False in a later task so an unverified user can still register
    their own profile.
    """
    permission_classes = (permissions.IsAuthenticated,)
    owner_email_path = None
    require_trusted_email = True

    def _owner_email(self):
        if self.require_trusted_email:
            return caller_email(self.request.user)
        return claimed_email(self.request.user)

    def get_queryset(self):
        email = self._owner_email()
        queryset = super().get_queryset()
        if not email:
            return queryset.none()
        return queryset.filter(**{self.owner_email_path + '__iexact': email})

    def perform_create(self, serializer):
        self._require_ownership(serializer.validated_data, required=True)
        serializer.save()

    def perform_update(self, serializer):
        self._require_ownership(serializer.validated_data, required=False)
        serializer.save()

    def _require_ownership(self, validated_data, required):
        first, *rest = self.owner_email_path.split('__')
        if first not in validated_data and not required:
            return  # partial update that doesn't move the row; the row is already scoped
        value = validated_data.get(first)
        for attr in rest:
            value = getattr(value, attr, None)
        if not value or value.strip().lower() != self._owner_email():
            raise PermissionDenied('That record does not belong to you.')
