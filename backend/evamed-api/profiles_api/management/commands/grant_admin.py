"""Grant or revoke EVAmed admin rights (catalogue editing) for an email.

The person signs in with Firebase as usual. FirebaseAuthentication maps a
*verified* token email to this UserProfile, whose is_staff makes them admin.
"""
from django.core.management.base import BaseCommand

from profiles_api.models import UserProfile


class Command(BaseCommand):
    help = 'Grant (or --revoke) admin rights for the Firebase account with this email.'

    def add_arguments(self, parser):
        parser.add_argument('email')
        parser.add_argument('--revoke', action='store_true')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        profile = UserProfile.objects.filter(email__iexact=email).first()

        if options['revoke']:
            if profile is not None:
                profile.is_staff = False
                profile.save(update_fields=['is_staff'])
            self.stdout.write('revoked admin: %s' % email)
            return

        if profile is None:
            profile = UserProfile(email=email, name=email.split('@')[0])
            profile.set_unusable_password()
        profile.is_staff = True
        profile.save()
        self.stdout.write('granted admin: %s' % email)
