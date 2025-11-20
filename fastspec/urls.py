"""
URL configuration for fastspec project.
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from specs.views import OpenAPISpecViewSet, validate_spec, root, home

router = DefaultRouter()
router.register(r"specs", OpenAPISpecViewSet, basename="specs")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", home, name="home"),
    path("api/", include(router.urls)),
    path("api/validate", validate_spec, name="validate"),
    path("api-root/", root, name="api-root"),
]
