"""
LintService — ADR-0005.

Owns lint orchestration: resolves which LintRuleset applies, builds the
ruleset YAML, calls the injected SpectralClient, and returns a LintResponse.

Ruleset resolution:
    - spec_id given, spec.active_ruleset_id set  -> that ruleset
    - spec_id given, spec.active_ruleset_id null  -> user's is_default ruleset
    - no spec_id (ad-hoc lint with no spec context) -> user's is_default ruleset
    - no ruleset resolved either way -> bare `extends: spectral:oas`

SpectralClient is injected via the constructor so unit tests can pass a
FakeSpectralClient directly without a subprocess or sidecar.

LintService.lint() raises SpectralError — not HTTPException. The router
catches SpectralError and converts it to a 502. This keeps the service
layer free of HTTP semantics.
"""

from typing import Optional

from sqlalchemy.orm import Session

from models import LintRuleset, OpenAPISpec
from schemas import LintResponse, LintSummary, StructuredRule
from validation.spectral_client import SpectralClient
from validation.spectral_linter import build_ruleset_yaml
from services.lint_ruleset_repository import LintRulesetRepository


class LintService:
    def __init__(self, db: Session, spectral_client: SpectralClient) -> None:
        self._db = db
        self._spectral_client = spectral_client
        self._ruleset_repo = LintRulesetRepository(db)

    def _resolve_ruleset(self, user_id: int, spec_id: Optional[str]) -> LintRuleset | None:
        if spec_id is not None:
            spec = (
                self._db.query(OpenAPISpec)
                .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == user_id)
                .first()
            )
            if spec is not None and spec.active_ruleset_id is not None:
                pinned = self._ruleset_repo.get(user_id, spec.active_ruleset_id)
                if pinned is not None:
                    return pinned
        return self._ruleset_repo.get_default(user_id)

    def lint(
        self, spec_json: dict, user_id: int, spec_id: Optional[str] = None
    ) -> LintResponse:
        """
        Lint *spec_json* for *user_id*, optionally scoped to *spec_id*.

        Resolves the applicable ruleset (see module docstring), builds the
        ruleset YAML, and delegates to the injected SpectralClient.

        Returns:
            LintResponse with score, summary, and results.

        Raises:
            SpectralError: on any transport or process failure.
        """
        ruleset = self._resolve_ruleset(user_id, spec_id)
        user_ruleset = (
            {"rules_json": ruleset.rules_json, "raw_yaml": ruleset.raw_yaml}
            if ruleset is not None
            else None
        )
        ruleset_yaml = build_ruleset_yaml(user_ruleset)
        raw = self._spectral_client.lint(spec_json, ruleset_yaml)
        return LintResponse(
            score=raw["score"],
            summary=LintSummary(**raw["summary"]),
            results=raw["results"],
        )

    def preview_rule(self, spec_json: dict, rule: StructuredRule) -> LintResponse:
        """
        Run a single, unsaved draft rule against *spec_json*.

        Used by the ruleset editor's "test against current spec" button —
        deliberately bypasses saved-ruleset resolution and `spectral:oas`
        entirely so the author sees exactly what this one rule matches.

        Raises:
            SpectralError: on any transport or process failure.
        """
        ruleset_yaml = build_ruleset_yaml(
            {"rules_json": [rule.model_dump()], "raw_yaml": None},
            extend_oas=False,
        )
        raw = self._spectral_client.lint(spec_json, ruleset_yaml)
        return LintResponse(
            score=raw["score"],
            summary=LintSummary(**raw["summary"]),
            results=raw["results"],
        )
