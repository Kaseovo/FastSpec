from django.contrib import admin
from .models import OpenAPISpec


@admin.register(OpenAPISpec)
class OpenAPISpecAdmin(admin.ModelAdmin):
    list_display = ["name", "title", "version", "created_at", "updated_at"]
    list_filter = ["created_at", "updated_at"]
    search_fields = ["name", "title"]
    readonly_fields = ["created_at", "updated_at"]
