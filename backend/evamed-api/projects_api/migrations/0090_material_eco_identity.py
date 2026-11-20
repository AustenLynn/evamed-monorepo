from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects_api', '0089_eco_platform_database'),
    ]

    operations = [
        migrations.AddField(model_name='material', name='eco_epd_uuid',
                            field=models.UUIDField(blank=True, db_index=True, null=True)),
        migrations.AddField(model_name='material', name='eco_epd_version',
                            field=models.CharField(blank=True, max_length=32, null=True)),
        migrations.AddField(model_name='material', name='eco_reg_authority',
                            field=models.UUIDField(blank=True, null=True)),
    ]
