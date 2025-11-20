from rest_framework import serializers
from .models import OpenAPISpec
import json


class OpenAPISpecSerializer(serializers.ModelSerializer):
    spec_json = serializers.JSONField()

    class Meta:
        model = OpenAPISpec
        fields = [
            "id",
            "name",
            "title",
            "version",
            "spec_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "title", "version", "created_at", "updated_at"]

    def validate_spec_json(self, value):
        """Ensure spec_json is a valid dict"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("spec_json must be a JSON object")
        return value

    def create(self, validated_data):
        # Extract title and version from spec_json
        spec_json = validated_data["spec_json"]
        validated_data["title"] = spec_json.get("info", {}).get("title", "Untitled")
        validated_data["version"] = spec_json.get("info", {}).get("version", "1.0.0")
        validated_data["spec_json"] = json.dumps(spec_json)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Store current spec as previous before updating
        if "spec_json" in validated_data:
            instance.previous_spec_json = instance.spec_json

            spec_json = validated_data["spec_json"]
            validated_data["title"] = spec_json.get("info", {}).get(
                "title", instance.title
            )
            validated_data["version"] = spec_json.get("info", {}).get(
                "version", instance.version
            )
            validated_data["spec_json"] = json.dumps(spec_json)

        return super().update(instance, validated_data)

    def to_representation(self, instance):
        """Convert spec_json from string to dict for response"""
        representation = super().to_representation(instance)
        representation["spec_json"] = json.loads(instance.spec_json)
        return representation


class OpenAPISpecCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    spec_json = serializers.JSONField()

    def validate_spec_json(self, value):
        """Ensure spec_json is a valid dict"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("spec_json must be a JSON object")
        return value


class OpenAPISpecUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    spec_json = serializers.JSONField(required=False)

    def validate_spec_json(self, value):
        """Ensure spec_json is a valid dict"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("spec_json must be a JSON object")
        return value


class ValidationErrorSerializer(serializers.Serializer):
    field = serializers.CharField()
    message = serializers.CharField()


class ValidationResponseSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    errors = ValidationErrorSerializer(many=True)
    warnings = serializers.ListField(child=serializers.CharField())
