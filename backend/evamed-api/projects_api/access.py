"""Who may read and change what through the projects API.

* Catalogue tables are public to read except ECO materials and their factors;
  only admins may change them. An admin is a Django UserProfile with is_staff,
  which FirebaseAuthentication only returns for a verified email.
* Project data belongs to the UserPlatform whose email matches the caller's
  Firebase token.
"""
from django.db.models import Exists, OuterRef, Q
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from projects_api import models

PROJECT_OWNER = 'project_id__user_platform_id__email'

# Exact email domains (no subdomains) whose verified users may see ECO Platform data.
ECO_PLATFORM_DOMAINS = frozenset({'correo.uia.mx', 'ibero.mx'})


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


def can_access_ecoplatform(user):
    """Eligibility follows the verified identity accepted by authentication."""
    email = caller_email(user)
    return bool(
        getattr(user, 'is_authenticated', False)
        and getattr(user, 'email_verified', True)
        and email.count('@') == 1
        and email.partition('@')[2] in ECO_PLATFORM_DOMAINS
    )


def visible_materials(user):
    queryset = models.Material.objects.all()
    if not can_access_ecoplatform(user):
        queryset = queryset.exclude(provider_code='eco_platform')
    return queryset


def visible_databases(user, queryset):
    if can_access_ecoplatform(user):
        return queryset
    restricted_names = models.Material.objects.filter(provider_code='eco_platform').values('database_from')
    public_names = visible_materials(user).values('database_from')
    return queryset.exclude(Q(name__in=restricted_names) & ~Q(name__in=public_names))


def require_visible_references(user, data):
    """Validate supplied model references before any mutation, including bulk rows."""
    for value in data.values():
        project = value if isinstance(value, models.Project) else None
        if isinstance(value, models.AnnualConsumptionRequired):
            project = value.project_id
        if project is not None and not visible_projects(user).filter(pk=project.pk).exists():
            raise PermissionDenied('That project is not available to your account.')
        if isinstance(value, models.Material):
            if not visible_materials(user).filter(pk=value.pk).exists():
                raise PermissionDenied('This material is not available to your account.')


def owned_projects(user):
    email = caller_email(user)
    if not email:
        return models.Project.objects.none()
    return models.Project.objects.filter(user_platform_id__email__iexact=email)


def visible_projects(user):
    queryset = owned_projects(user)
    if can_access_ecoplatform(user):
        return queryset
    current = models.MaterialSchemeProject.objects.filter(
        project_id=OuterRef('pk'), material_id__provider_code='eco_platform')
    original = models.MaterialSchemeProjectOrigianal.objects.filter(
        project_id=OuterRef('pk'), material_id__provider_code='eco_platform')
    return queryset.filter(~Exists(current), ~Exists(original))


def owns_project(user, project_id):
    try:
        project_id = int(project_id)
    except (TypeError, ValueError):
        return False
    return visible_projects(user).filter(id=project_id).exists()


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or is_admin(request.user)


class OwnedByCallerMixin:
    """Limit a ModelViewSet to rows whose owner email is the caller's.

    `owner_email_path` is the ORM path from the model to the owner's email,
    e.g. PROJECT_OWNER. Its first segment must be a serializer field.

    The caller's identity is the trusted one (`caller_email`), except for the
    actions listed in `claimed_email_actions` (default none), which accept the
    merely claimed one (`claimed_email`). Users-platform uses this so an
    unverified user can still register and read their own profile.
    """
    permission_classes = (permissions.IsAuthenticated,)
    owner_email_path = None
    claimed_email_actions = ()

    def _owner_email(self):
        if self.action in self.claimed_email_actions:
            return claimed_email(self.request.user)
        return caller_email(self.request.user)

    def get_queryset(self):
        email = self._owner_email()
        queryset = super().get_queryset()
        if not email:
            return queryset.none()
        queryset = queryset.filter(**{self.owner_email_path + '__iexact': email})
        if queryset.model is models.Project:
            return queryset.filter(pk__in=visible_projects(self.request.user).values('pk'))
        suffix = '__user_platform_id__email'
        if self.owner_email_path.endswith(suffix):
            project_path = self.owner_email_path[:-len(suffix)]
            return queryset.filter(**{project_path + '__in': visible_projects(self.request.user)})
        return queryset

    def perform_create(self, serializer):
        self._require_ownership(serializer.validated_data, required=True)
        require_visible_references(self.request.user, serializer.validated_data)
        serializer.save()

    def perform_update(self, serializer):
        self._require_ownership(serializer.validated_data, required=False)
        require_visible_references(self.request.user, serializer.validated_data)
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
