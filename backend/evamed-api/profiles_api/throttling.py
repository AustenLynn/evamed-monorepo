"""Per-user API throttling that understands Firebase callers.

DRF's UserRateThrottle keys a signed-in user by `user.pk`. A FirebaseUser (any
caller without an admin UserProfile) has pk None, so all of them would share
one bucket. Key them by their Firebase uid instead; admins keep their pk.
Anonymous callers are left to AnonRateThrottle.
"""
from rest_framework.throttling import UserRateThrottle


class FirebaseUserRateThrottle(UserRateThrottle):

    def get_cache_key(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return None
        ident = getattr(user, 'uid', None) or user.pk
        return self.cache_format % {'scope': self.scope, 'ident': ident}
