from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404, render, redirect
from django.views.decorators.csrf import ensure_csrf_cookie
import json

from .models import OpenAPISpec
from .serializers import (
    OpenAPISpecSerializer,
    OpenAPISpecCreateSerializer,
    OpenAPISpecUpdateSerializer,
)
from validator import validate_openapi_spec
from diff_utils import compare_specs, generate_markdown_report


def custom_exception_handler(exc, context):
    """Custom exception handler for DRF"""
    from rest_framework.views import exception_handler

    response = exception_handler(exc, context)

    if response is not None:
        # Customize error response format if needed
        pass

    return response


@ensure_csrf_cookie
def home(request):
    """Render the main editor page"""
    return render(request, "editor.html")


@api_view(["GET"])
def root(request):
    """Root endpoint - redirect to home"""
    return redirect("home")


@api_view(["POST"])
def validate_spec(request):
    """Validate an OpenAPI specification without saving it"""
    spec_json = request.data

    if not isinstance(spec_json, dict):
        return Response(
            {
                "valid": False,
                "errors": [
                    {"field": "root", "message": "Request must be a JSON object"}
                ],
                "warnings": [],
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    is_valid, errors, warnings = validate_openapi_spec(spec_json)

    return Response(
        {
            "valid": is_valid,
            "errors": [{"field": e.field, "message": e.message} for e in errors],
            "warnings": warnings,
        }
    )


class OpenAPISpecViewSet(viewsets.ModelViewSet):
    queryset = OpenAPISpec.objects.all()
    serializer_class = OpenAPISpecSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return OpenAPISpecCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return OpenAPISpecUpdateSerializer
        return OpenAPISpecSerializer

    def list(self, request):
        """List all OpenAPI specifications"""
        specs = self.get_queryset()
        serializer = OpenAPISpecSerializer(specs, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """Get a specific OpenAPI specification by ID"""
        spec = get_object_or_404(OpenAPISpec, pk=pk)
        serializer = OpenAPISpecSerializer(spec)
        return Response(serializer.data)

    def create(self, request):
        """Create a new OpenAPI specification"""
        serializer = OpenAPISpecCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        spec_data = serializer.validated_data
        spec_json = spec_data["spec_json"]

        # Validate the spec
        is_valid, errors, warnings = validate_openapi_spec(spec_json)
        if not is_valid:
            return Response(
                {
                    "message": "Invalid OpenAPI specification",
                    "errors": [
                        {"field": e.field, "message": e.message} for e in errors
                    ],
                    "warnings": warnings,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if name already exists
        if OpenAPISpec.objects.filter(name=spec_data["name"]).exists():
            return Response(
                {"detail": f"Spec with name '{spec_data['name']}' already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Extract title and version from spec_json
        title = spec_json.get("info", {}).get("title", "Untitled")
        version = spec_json.get("info", {}).get("version", "1.0.0")

        # Create new spec
        spec = OpenAPISpec.objects.create(
            name=spec_data["name"],
            title=title,
            version=version,
            spec_json=json.dumps(spec_json),
        )

        response_serializer = OpenAPISpecSerializer(spec)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        """Update an existing OpenAPI specification"""
        spec = get_object_or_404(OpenAPISpec, pk=pk)
        serializer = OpenAPISpecUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        update_data = serializer.validated_data

        # Validate if spec_json is being updated
        if "spec_json" in update_data:
            spec_json = update_data["spec_json"]
            is_valid, errors, warnings = validate_openapi_spec(spec_json)
            if not is_valid:
                return Response(
                    {
                        "message": "Invalid OpenAPI specification",
                        "errors": [
                            {"field": e.field, "message": e.message} for e in errors
                        ],
                        "warnings": warnings,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Store current spec as previous version before updating
            spec.previous_spec_json = spec.spec_json

            # Update spec_json and extract title/version
            spec.spec_json = json.dumps(spec_json)
            spec.title = spec_json.get("info", {}).get("title", spec.title)
            spec.version = spec_json.get("info", {}).get("version", spec.version)

        # Update name if provided
        if "name" in update_data:
            new_name = update_data["name"]
            # Check if new name already exists
            if OpenAPISpec.objects.filter(name=new_name).exclude(pk=pk).exists():
                return Response(
                    {"detail": f"Spec with name '{new_name}' already exists"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            spec.name = new_name

        spec.save()

        response_serializer = OpenAPISpecSerializer(spec)
        return Response(response_serializer.data)

    def partial_update(self, request, pk=None):
        """Partial update of an existing OpenAPI specification"""
        return self.update(request, pk)

    def destroy(self, request, pk=None):
        """Delete an OpenAPI specification"""
        spec = get_object_or_404(OpenAPISpec, pk=pk)
        spec.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="diff")
    def diff(self, request, pk=None):
        """
        Get the diff between current and previous version of a specification

        Query params:
        - format: 'json' (default) or 'markdown'
        """
        spec = get_object_or_404(OpenAPISpec, pk=pk)

        if not spec.previous_spec_json:
            return Response(
                {
                    "has_changes": False,
                    "message": "No previous version available for comparison",
                }
            )

        current_spec = json.loads(spec.spec_json)
        previous_spec = json.loads(spec.previous_spec_json)

        diff = compare_specs(current_spec, previous_spec)

        format_param = request.query_params.get("format", "json")
        if format_param == "markdown":
            markdown = generate_markdown_report(diff)
            return Response({"markdown": markdown})

        return Response(diff)
