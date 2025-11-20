from django.db import models


class OpenAPISpec(models.Model):
    name = models.CharField(max_length=255, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    version = models.CharField(max_length=50)
    spec_json = models.TextField()
    previous_spec_json = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "openapi_specs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.title} v{self.version})"
