"""Helpers for authenticating API tests as EVAmed users."""
from profiles_api.authentication import FirebaseUser
from profiles_api.models import UserProfile
from projects_api import models


def firebase_user(email, verified=True):
    """What FirebaseAuthentication returns for a signed-in, non-admin user."""
    return FirebaseUser(uid='uid-' + email, email=email, email_verified=verified)


def admin_user(email='admin@example.com'):
    """A Django user with is_staff, as FirebaseAuthentication returns for admins."""
    profile = UserProfile.objects.create_user(email=email, name='Admin')
    profile.is_staff = True
    profile.save()
    return profile


def platform_user(email):
    """The UserPlatform row that owns a user's projects."""
    return models.UserPlatform.objects.create(name=email.split('@')[0], email=email)


def owned_project(email, name='Project'):
    return models.Project.objects.create(name_project=name, user_platform_id=platform_user(email))
