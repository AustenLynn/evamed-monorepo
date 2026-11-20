from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0086_material_provider_identity'),
    ]

    operations = [
        migrations.AddField(
            model_name='potentialtype',
            name='method',
            field=models.CharField(
                choices=[('CML', 'CML (EN 15804+A1)'), ('EN15804+A2', 'EN 15804+A2')],
                db_index=True, default='CML', max_length=16),
        ),
    ]
