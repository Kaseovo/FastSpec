"""
FastSpec's MCP server: tools that let AI agents read, write, version, lint
and compare the authenticated user's OpenAPI specs.

Every tool is tagged "authentication" and declares the API-key action it
needs (permissions.py); AuthenticationMiddleware hides and refuses tools the
key isn't allowed to use. Tools reuse the same services as the HTTP API, so
the rules (ownership, validation, conflicts) are identical.
"""

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any

import yaml
from fastapi import HTTPException
from fastmcp import FastMCP
from fastmcp.dependencies import Depends
from fastmcp.exceptions import ToolError
from starlette.requests import Request
from starlette.responses import JSONResponse

from database import SessionLocal
from fastmcp_server.authentication import TokenPayload, get_current_user
from fastmcp_server.middleware import AuthenticationMiddleware, LoggingMiddleware
from permissions import Action
from schemas import OpenAPISpecCreate
from services.lint_service import LintService
from services.spec_service import SpecService
from services.spec_version_service import SpecVersionService
from validation.diff_utils import compare_specs, generate_markdown_report
from validation.spectral_client import SpectralError, get_spectral_client
from validation.validator import validate_openapi_spec

logger = logging.getLogger(__name__)

mcp = FastMCP(
    name="FastSpec",
    instructions=(
        "Tools for the OpenAPI specs stored in FastSpec. A spec has a name and "
        "one or more versions; each version holds a full OpenAPI 3 document. "
        "Pass documents as objects or as YAML/JSON text. Typical flow: "
        "get_saved_specs_for_user → get_spec_details → edit → validate_spec / "
        "lint_spec → save_spec_version with a new version number."
    ),
)
mcp.add_middleware(LoggingMiddleware())
mcp.add_middleware(AuthenticationMiddleware())

SpecContent = dict[str, Any] | str


@mcp.custom_route("/api/health", methods=["GET"])
async def health(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


# ── Helpers ──────────────────────────────────────────────────────────────────


def _owner(user: TokenPayload) -> SimpleNamespace:
    return SimpleNamespace(id=int(user.sub))


@contextmanager
def _session(action: str) -> Iterator[Any]:
    """A DB session whose errors become ToolErrors an agent can act on.

    HTTPExceptions raised by the services carry user-facing messages (not
    found, conflicts, invalid payloads) and are passed through; anything
    else is logged and reported generically.
    """
    db = SessionLocal()
    try:
        yield db
    except ToolError:
        raise
    except HTTPException as exc:
        raise ToolError(_describe(exc.detail)) from None
    except SpectralError as exc:
        raise ToolError(f"Linting failed: {exc}") from None
    except Exception as exc:
        logger.exception("MCP tool failed: %s", action)
        raise ToolError(f"Could not {action}") from exc
    finally:
        db.close()


def _describe(detail: Any) -> str:
    if isinstance(detail, dict):
        message = detail.get("message", "Request failed")
        errors = detail.get("errors") or []
        lines = [f"- {e.get('field')}: {e.get('message')}" for e in errors if isinstance(e, dict)]
        return "\n".join([message, *lines])
    return str(detail)


def _document(content: SpecContent) -> dict[str, Any]:
    """Accept an OpenAPI document as an object or as YAML/JSON text."""
    if isinstance(content, dict):
        return content
    try:
        parsed = yaml.safe_load(content)
    except yaml.YAMLError as exc:
        raise ToolError(f"The document isn't valid YAML or JSON: {exc}") from None
    if not isinstance(parsed, dict):
        raise ToolError("The document must be a mapping (an OpenAPI object).")
    return parsed


def _require_valid(document: dict[str, Any]) -> list[str]:
    """Raise a ToolError listing validation errors; return warnings."""
    is_valid, errors, warnings = validate_openapi_spec(document)
    if not is_valid:
        details = "\n".join(f"- {e.field}: {e.message}" for e in errors)
        raise ToolError(f"Invalid OpenAPI document:\n{details}")
    return warnings


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _version_summary(version) -> dict[str, Any]:
    return {"id": version.id, "version": version.version, "created_at": _iso(version.created_at)}


# ── Reading ──────────────────────────────────────────────────────────────────


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.READ_SPECS]})
def who_am_i(user: TokenPayload = Depends(get_current_user)) -> dict:
    """Returns the authenticated user's ID and the actions the API key allows."""
    return {
        "sub": user.sub,
        "actions": user.actions,
        "token_type": user.token_type,
        "exp": user.exp,
        "iat": user.iat,
    }


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.READ_SPECS]})
def get_saved_specs_for_user(user: TokenPayload = Depends(get_current_user)) -> list:
    """Lists the user's specs: id, name, title and current version."""
    with _session("load specs") as db:
        specs = SpecService(db).list_specs(_owner(user))
        return [
            {
                "id": s.id,
                "name": s.name,
                "title": s.title,
                "version": s.version,
                "created_at": _iso(s.created_at),
                "updated_at": _iso(s.updated_at),
            }
            for s in specs
        ]


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.READ_SPECS]})
def get_spec_details(spec_id: str, user: TokenPayload = Depends(get_current_user)) -> dict:
    """Returns a spec and the OpenAPI document of its current version."""
    with _session("load the spec") as db:
        spec = SpecService(db).get_spec(_owner(user), spec_id)
        return {
            "id": spec.id,
            "name": spec.name,
            "title": spec.title,
            "version": spec.version,
            "created_at": _iso(spec.created_at),
            "updated_at": _iso(spec.updated_at),
            "content": spec.spec_json,
        }


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.READ_SPECS]})
def validate_spec(content: SpecContent, user: TokenPayload = Depends(get_current_user)) -> dict:
    """Checks that a document is a valid OpenAPI 3 specification, without saving it.

    Returns {"valid", "errors", "warnings"}. For style and best-practice
    feedback, use lint_spec.
    """
    is_valid, errors, warnings = validate_openapi_spec(_document(content))
    return {
        "valid": is_valid,
        "errors": [{"field": e.field, "message": e.message} for e in errors],
        "warnings": warnings,
    }


# ── Writing specs ────────────────────────────────────────────────────────────


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.WRITE_SPECS]})
def create_spec(
    name: str,
    content: SpecContent,
    version: str = "1.0.0",
    user: TokenPayload = Depends(get_current_user),
) -> dict:
    """Creates a spec from an OpenAPI 3 document, as its first version.

    `name` must be unique among the user's specs. `version` becomes both the
    version label and the document's info.version.
    """
    document = _document(content)
    warnings = _require_valid(document)
    with _session("create the spec") as db:
        spec = SpecService(db).create_spec(
            _owner(user), OpenAPISpecCreate(name=name, spec_json=document, version=version)
        )
        return {"id": spec.id, "name": spec.name, "version": spec.version, "warnings": warnings}


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.DELETE_SPECS]})
def delete_spec(spec_id: str, user: TokenPayload = Depends(get_current_user)) -> dict:
    """Permanently deletes a spec and all its versions. This can't be undone."""
    with _session("delete the spec") as db:
        SpecService(db).delete_spec(_owner(user), spec_id)
        return {"deleted": spec_id}


# ── Versions ─────────────────────────────────────────────────────────────────


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.READ_VERSIONS]})
def list_spec_versions(spec_id: str, user: TokenPayload = Depends(get_current_user)) -> dict:
    """Lists a spec's versions, newest first, and which one is current."""
    with _session("list versions") as db:
        service = SpecVersionService(db)
        spec = service.owned_spec_or_404(_owner(user), spec_id)
        return {
            "current": spec.version,
            "versions": [_version_summary(v) for v in service.list_versions(_owner(user), spec_id)],
        }


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.READ_VERSIONS]})
def get_spec_version(
    spec_id: str, version: str, user: TokenPayload = Depends(get_current_user)
) -> dict:
    """Returns the OpenAPI document stored for one version (label or ID)."""
    with _session("load the version") as db:
        found = SpecVersionService(db).get_version(_owner(user), spec_id, version)
        return {**_version_summary(found), "content": found.content}


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.WRITE_VERSIONS]})
def save_spec_version(
    spec_id: str,
    version: str,
    content: SpecContent,
    overwrite: bool = False,
    user: TokenPayload = Depends(get_current_user),
) -> dict:
    """Saves an OpenAPI document as a version of a spec and makes it current.

    Use a new version label (e.g. bump 1.0.0 → 1.1.0) to keep history. An
    existing version is only replaced when `overwrite` is true.
    """
    document = _document(content)
    warnings = _require_valid(document)
    with _session("save the version") as db:
        service = SpecVersionService(db)
        owner = _owner(user)
        service.owned_spec_or_404(owner, spec_id)
        existing = next((v for v in service.list_versions(owner, spec_id) if v.version == version), None)
        if existing and not overwrite:
            raise ToolError(
                f"Version {version} already exists. Use a new version label, "
                "or pass overwrite=true to replace it."
            )
        if existing:
            saved = service.update_version(owner, spec_id, existing.id, version, document, None)
            service.publish(owner, spec_id, saved.id)
        else:
            saved = service.create_version(owner, spec_id, version, document, None)
        return {**_version_summary(saved), "current": True, "replaced": bool(existing), "warnings": warnings}


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.READ_VERSIONS]})
def compare_spec_versions(
    spec_id: str,
    base_version: str,
    compare_version: str | None = None,
    compare_content: SpecContent | None = None,
    user: TokenPayload = Depends(get_current_user),
) -> dict:
    """Compares a stored version with another version, or with an unsaved document.

    Pass either `compare_version` or `compare_content`. Returns a Markdown
    report of added, changed and removed paths, schemas and info fields.
    """
    if (compare_version is None) == (compare_content is None):
        raise ToolError("Pass exactly one of compare_version or compare_content.")
    with _session("compare versions") as db:
        service = SpecVersionService(db)
        owner = _owner(user)
        base = service.get_version(owner, spec_id, base_version)
        if compare_version is not None:
            other = service.get_version(owner, spec_id, compare_version).content
            label = compare_version
        else:
            other = _document(compare_content)
            label = "unsaved document"
        return {
            "base": base.version,
            "compare": label,
            # compare_specs(current, previous): the base is the "before" side.
            "markdown": generate_markdown_report(compare_specs(other, base.content)),
        }


# ── Linting ──────────────────────────────────────────────────────────────────


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.LINT_SPECS]})
def lint_spec(
    spec_id: str | None = None,
    version: str | None = None,
    content: SpecContent | None = None,
    user: TokenPayload = Depends(get_current_user),
) -> dict:
    """Lints with Spectral, using the user's lint ruleset for the spec.

    Lint a stored spec (`spec_id`, optionally `version`; the current version
    by default) or an unsaved document (`content`, optionally with `spec_id`
    to use that spec's ruleset). Returns a 0–100 score and the findings, each
    with a JSON path into the document.
    """
    if content is None and spec_id is None:
        raise ToolError("Pass spec_id, content, or both.")
    owner = _owner(user)
    with _session("lint the spec") as db:
        if content is not None:
            document = _document(content)
        else:
            service = SpecVersionService(db)
            spec = service.owned_spec_or_404(owner, spec_id)
            document = service.get_version(owner, spec_id, version or spec.version).content
        if spec_id is not None:
            SpecVersionService(db).owned_spec_or_404(owner, spec_id)
        result = LintService(db, get_spectral_client()).lint(document, owner.id, spec_id)
        return {
            "score": result.score,
            "summary": result.summary.model_dump(),
            "findings": [
                {
                    "code": r.code,
                    "severity": r.severity,
                    "message": r.message,
                    "path": r.path,
                }
                for r in result.results
            ],
        }


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000, path="/mcp")
