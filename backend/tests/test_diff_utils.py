"""
Pure unit tests for validation/diff_utils.py

No database, no HTTP client, no external fixtures — all inputs are plain dicts.
"""

import pytest

from validation.diff_utils import (
    compare_schema,
    compare_endpoint,
    compare_specs,
    generate_markdown_report,
)


# ---------------------------------------------------------------------------
# Helpers / shared fixtures
# ---------------------------------------------------------------------------

def _make_schema(properties=None, required=None):
    """Build a bare JSON Schema dict."""
    schema = {}
    if properties is not None:
        schema["properties"] = properties
    if required is not None:
        schema["required"] = required
    return schema


def _make_op(summary=None, request_body=None, responses=None):
    """Build a minimal OpenAPI operation dict."""
    op = {}
    if summary is not None:
        op["summary"] = summary
    if request_body is not None:
        op["requestBody"] = request_body
    if responses is not None:
        op["responses"] = responses
    return op


def _make_json_request_body(schema):
    return {"content": {"application/json": {"schema": schema}}}


def _make_json_response(schema):
    return {"content": {"application/json": {"schema": schema}}}


def _minimal_spec(title="My API", paths=None, servers=None, extra_info=None):
    spec = {
        "openapi": "3.0.0",
        "info": {"title": title, "version": "1.0.0"},
        "paths": paths or {},
    }
    if servers is not None:
        spec["servers"] = servers
    if extra_info:
        spec["info"].update(extra_info)
    return spec


# ===========================================================================
# compare_schema
# ===========================================================================

class TestCompareSchema:

    def test_compare_schema_no_changes(self):
        schema = _make_schema({"name": {"type": "string"}}, ["name"])
        result = compare_schema(schema, schema)
        assert result["has_changes"] is False
        assert result["added_fields"] == []
        assert result["removed_fields"] == []
        assert result["modified_fields"] == []

    def test_compare_schema_field_added(self):
        previous = _make_schema({"name": {"type": "string"}})
        current = _make_schema({"name": {"type": "string"}, "email": {"type": "string"}})
        result = compare_schema(current, previous)
        assert result["has_changes"] is True
        names = [f["name"] for f in result["added_fields"]]
        assert "email" in names

    def test_compare_schema_field_removed(self):
        previous = _make_schema({"name": {"type": "string"}, "age": {"type": "integer"}})
        current = _make_schema({"name": {"type": "string"}})
        result = compare_schema(current, previous)
        assert result["has_changes"] is True
        names = [f["name"] for f in result["removed_fields"]]
        assert "age" in names

    def test_compare_schema_type_changed(self):
        previous = _make_schema({"count": {"type": "string"}})
        current = _make_schema({"count": {"type": "integer"}})
        result = compare_schema(current, previous)
        assert result["has_changes"] is True
        mod = result["modified_fields"]
        assert len(mod) == 1
        assert mod[0]["name"] == "count"
        assert "type" in mod[0]["changes"]
        assert mod[0]["changes"]["type"]["old"] == "string"
        assert mod[0]["changes"]["type"]["new"] == "integer"

    def test_compare_schema_required_changed(self):
        previous = _make_schema({"name": {"type": "string"}}, [])
        current = _make_schema({"name": {"type": "string"}}, ["name"])
        result = compare_schema(current, previous)
        assert result["has_changes"] is True
        mod = result["modified_fields"]
        assert len(mod) == 1
        assert "required" in mod[0]["changes"]
        assert mod[0]["changes"]["required"]["old"] is False
        assert mod[0]["changes"]["required"]["new"] is True

    def test_compare_schema_constraint_changed(self):
        previous = _make_schema({"bio": {"type": "string", "maxLength": 100}})
        current = _make_schema({"bio": {"type": "string", "maxLength": 500}})
        result = compare_schema(current, previous)
        assert result["has_changes"] is True
        mod = result["modified_fields"]
        assert len(mod) == 1
        assert "maxLength" in mod[0]["changes"]
        assert mod[0]["changes"]["maxLength"]["old"] == 100
        assert mod[0]["changes"]["maxLength"]["new"] == 500

    def test_compare_schema_pattern_changed(self):
        previous = _make_schema({"code": {"type": "string", "pattern": "^[a-z]+$"}})
        current = _make_schema({"code": {"type": "string", "pattern": "^[A-Z]+$"}})
        result = compare_schema(current, previous)
        assert result["has_changes"] is True
        mod = result["modified_fields"]
        assert "pattern" in mod[0]["changes"]


# ===========================================================================
# compare_endpoint
# ===========================================================================

class TestCompareEndpoint:

    def test_compare_endpoint_no_changes(self):
        op = _make_op(summary="Get user")
        result = compare_endpoint(op, op, "/users/{id}", "get")
        assert result["has_changes"] is False
        assert result["summary_changed"] is False

    def test_compare_endpoint_summary_changed(self):
        previous = _make_op(summary="Get user")
        current = _make_op(summary="Fetch user")
        result = compare_endpoint(current, previous, "/users/{id}", "get")
        assert result["has_changes"] is True
        assert result["summary_changed"] is True
        assert result["summary_old"] == "Get user"
        assert result["summary_new"] == "Fetch user"

    def test_compare_endpoint_request_body_changed(self):
        previous_schema = _make_schema({"name": {"type": "string"}})
        current_schema = _make_schema({"name": {"type": "string"}, "email": {"type": "string"}})
        previous = _make_op(request_body=_make_json_request_body(previous_schema))
        current = _make_op(request_body=_make_json_request_body(current_schema))
        result = compare_endpoint(current, previous, "/users", "post")
        assert result["has_changes"] is True
        assert result["request_body_changes"]["has_changes"] is True
        names = [f["name"] for f in result["request_body_changes"]["added_fields"]]
        assert "email" in names

    def test_compare_endpoint_response_changed(self):
        previous_schema = _make_schema({"id": {"type": "integer"}, "name": {"type": "string"}})
        current_schema = _make_schema({"id": {"type": "integer"}})
        previous = _make_op(responses={"200": _make_json_response(previous_schema)})
        current = _make_op(responses={"200": _make_json_response(current_schema)})
        result = compare_endpoint(current, previous, "/users/{id}", "get")
        assert result["has_changes"] is True
        assert "200" in result["response_changes"]
        assert result["response_changes"]["200"]["has_changes"] is True
        names = [f["name"] for f in result["response_changes"]["200"]["removed_fields"]]
        assert "name" in names


# ===========================================================================
# compare_specs
# ===========================================================================

class TestCompareSpecs:

    def test_compare_specs_identical(self):
        spec = _minimal_spec(paths={"/health": {"get": {"summary": "Health check"}}})
        result = compare_specs(spec, spec)
        assert result["has_changes"] is False
        assert result["added"] == []
        assert result["removed"] == []
        assert result["modified"] == []

    def test_compare_specs_endpoint_added(self):
        previous = _minimal_spec()
        current = _minimal_spec(paths={"/users": {"get": {"summary": "List users"}}})
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        paths = [e["path"] for e in result["added"]]
        assert "/users" in paths

    def test_compare_specs_endpoint_removed(self):
        previous = _minimal_spec(paths={"/users": {"get": {"summary": "List users"}}})
        current = _minimal_spec()
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        paths = [e["path"] for e in result["removed"]]
        assert "/users" in paths

    def test_compare_specs_endpoint_modified(self):
        previous = _minimal_spec(paths={"/users": {"get": {"summary": "Old summary"}}})
        current = _minimal_spec(paths={"/users": {"get": {"summary": "New summary"}}})
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        assert len(result["modified"]) == 1
        assert result["modified"][0]["summary_changed"] is True

    def test_compare_specs_info_added(self):
        previous = _minimal_spec()
        current = _minimal_spec(extra_info={"description": "A new description"})
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        keys = [i["key"] for i in result["infoAdded"]]
        assert "description" in keys

    def test_compare_specs_info_modified(self):
        previous = _minimal_spec(title="Old Title")
        current = _minimal_spec(title="New Title")
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        mods = {i["key"]: i for i in result["infoModified"]}
        assert "title" in mods
        assert mods["title"]["old"] == "Old Title"
        assert mods["title"]["new"] == "New Title"

    def test_compare_specs_info_removed(self):
        previous = _minimal_spec(extra_info={"description": "Going away"})
        current = _minimal_spec()
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        keys = [i["key"] for i in result["infoRemoved"]]
        assert "description" in keys

    def test_compare_specs_server_added(self):
        previous = _minimal_spec(servers=[{"url": "https://api.example.com"}])
        current = _minimal_spec(
            servers=[
                {"url": "https://api.example.com"},
                {"url": "https://sandbox.example.com"},
            ]
        )
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        assert len(result["serverAdded"]) == 1

    def test_compare_specs_server_removed(self):
        previous = _minimal_spec(
            servers=[
                {"url": "https://api.example.com"},
                {"url": "https://sandbox.example.com"},
            ]
        )
        current = _minimal_spec(servers=[{"url": "https://api.example.com"}])
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        assert len(result["serverRemoved"]) == 1

    def test_compare_specs_server_modified(self):
        previous = _minimal_spec(servers=[{"url": "https://old.example.com"}])
        current = _minimal_spec(servers=[{"url": "https://new.example.com"}])
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        assert len(result["serverModified"]) == 1
        assert result["serverModified"][0]["old"] == {"url": "https://old.example.com"}
        assert result["serverModified"][0]["new"] == {"url": "https://new.example.com"}

    def test_compare_specs_schema_added(self):
        previous = _minimal_spec()
        current = _minimal_spec()
        current["components"] = {"schemas": {"Post": {"type": "object"}}}
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        names = [s["name"] for s in result["schemaAdded"]]
        assert "Post" in names
        assert result["schemaRemoved"] == []
        assert result["schemaModified"] == []

    def test_compare_specs_schema_removed(self):
        previous = _minimal_spec()
        previous["components"] = {"schemas": {"User": {"type": "object"}}}
        current = _minimal_spec()
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        names = [s["name"] for s in result["schemaRemoved"]]
        assert "User" in names
        assert result["schemaAdded"] == []
        assert result["schemaModified"] == []

    def test_compare_specs_schema_modified(self):
        previous = _minimal_spec()
        previous["components"] = {"schemas": {"User": {"type": "object", "properties": {"id": {"type": "integer"}}}}}
        current = _minimal_spec()
        current["components"] = {
            "schemas": {
                "User": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"},
                        "email": {"type": "string"},
                    },
                }
            }
        }
        result = compare_specs(current, previous)
        assert result["has_changes"] is True
        names = [s["name"] for s in result["schemaModified"]]
        assert "User" in names
        mod = next(s for s in result["schemaModified"] if s["name"] == "User")
        assert mod["changes"]["has_changes"] is True
        added_fields = [f["name"] for f in mod["changes"]["added_fields"]]
        assert "email" in added_fields
        assert result["schemaAdded"] == []
        assert result["schemaRemoved"] == []


# ===========================================================================
# generate_markdown_report
# ===========================================================================

class TestGenerateMarkdownReport:

    def _empty_diff(self):
        return {
            "has_changes": False,
            "added": [],
            "removed": [],
            "modified": [],
            "infoAdded": [],
            "infoModified": [],
            "infoRemoved": [],
            "serverAdded": [],
            "serverRemoved": [],
            "serverModified": [],
            "schemaAdded": [],
            "schemaModified": [],
            "schemaRemoved": [],
        }

    def test_markdown_no_changes(self):
        diff = self._empty_diff()
        result = generate_markdown_report(diff)
        assert "No changes" in result

    def test_markdown_info_added(self):
        diff = self._empty_diff()
        diff["has_changes"] = True
        diff["infoAdded"] = [{"key": "description", "value": "New description"}]
        result = generate_markdown_report(diff)
        assert "Added API Information" in result
        assert "description" in result
        assert "New description" in result

    def test_markdown_info_modified(self):
        diff = self._empty_diff()
        diff["has_changes"] = True
        diff["infoModified"] = [{"key": "title", "old": "Old Title", "new": "New Title"}]
        result = generate_markdown_report(diff)
        assert "Modified API Information" in result
        assert "Old Title" in result
        assert "New Title" in result

    def test_markdown_info_removed(self):
        diff = self._empty_diff()
        diff["has_changes"] = True
        diff["infoRemoved"] = [{"key": "description", "value": "Going away"}]
        result = generate_markdown_report(diff)
        assert "Removed API Information" in result
        assert "description" in result

    def test_markdown_added_endpoints(self):
        diff = self._empty_diff()
        diff["has_changes"] = True
        diff["added"] = [{"path": "/users", "method": "get", "summary": "List users"}]
        result = generate_markdown_report(diff)
        assert "Added Endpoints" in result
        assert "/users" in result
        assert "GET" in result

    def test_markdown_removed_endpoints(self):
        diff = self._empty_diff()
        diff["has_changes"] = True
        diff["removed"] = [{"path": "/legacy", "method": "delete", "summary": "Remove legacy"}]
        result = generate_markdown_report(diff)
        assert "Removed Endpoints" in result
        assert "/legacy" in result
        assert "DELETE" in result

    def test_markdown_modified_endpoints(self):
        diff = self._empty_diff()
        diff["has_changes"] = True
        diff["modified"] = [
            {
                "path": "/users/{id}",
                "method": "put",
                "summary_changed": True,
                "summary_old": "Update user",
                "summary_new": "Modify user",
                "request_body_changes": {},
                "response_changes": {},
                "has_changes": True,
            }
        ]
        result = generate_markdown_report(diff)
        assert "Modified Endpoints" in result
        assert "/users/{id}" in result
        assert "Update user" in result
        assert "Modify user" in result

    def test_markdown_bug_regression(self):
        """
        Regression test for the key-name bug in generate_markdown_report.
        Passes real compare_specs() output directly — must not raise KeyError
        and must return a non-empty string.
        """
        previous = _minimal_spec(title="Old API")
        current = _minimal_spec(
            title="New API",
            paths={"/ping": {"get": {"summary": "Ping"}}},
        )
        diff = compare_specs(current, previous)
        assert diff["has_changes"] is True

        result = generate_markdown_report(diff)
        assert isinstance(result, str)
        assert len(result) > 0
