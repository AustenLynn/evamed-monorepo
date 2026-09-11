# UserPlatform.password held plaintext Firebase passwords. Dropping it is
# deliberate and irreversible.
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0082_ecoinvent_usage_report'),
    ]

    operations = [
        migrations.RemoveField(model_name='userplatform', name='password'),
    ]
