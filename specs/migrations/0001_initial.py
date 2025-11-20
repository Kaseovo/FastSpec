# Generated migration for Django

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="OpenAPISpec",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(db_index=True, max_length=255, unique=True)),
                ("title", models.CharField(max_length=255)),
                ("version", models.CharField(max_length=50)),
                ("spec_json", models.TextField()),
                ("previous_spec_json", models.TextField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "openapi_specs",
                "ordering": ["-created_at"],
            },
        ),
    ]
