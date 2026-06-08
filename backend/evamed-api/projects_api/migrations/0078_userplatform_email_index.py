from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0077_materialstagesystemselection'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userplatform',
            name='email',
            field=models.CharField(db_index=True, max_length=255, null=True),
        ),
    ]
