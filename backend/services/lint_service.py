"""
LintService — ADR-0004.

Owns lint orchestration: fetches the User Lint Ruleset via
LintRulesetRepository, builds the ruleset YAML, calls the injected
SpectralClient, and returns a LintResponse.

SpectralClient is injected via the constructor so unit tests can pass a
FakeSpectralClient directly without a subprocess or sidecar.

LintService.lint() raises SpectralError — not HTTPException. The router
catches SpectralError and converts it to a 502. This keeps the service
layer free of HTTP semantics.
"""

from sqlalchemy.orm import Session

from schemas import LintResponse, LintSummary
from validation.spectral_client import SpectralClient, SpectralError
from validation.spectral_linter import build_ruleset_yaml
from services.lint_ruleset_repository import LintRulesetRepository


class LintService:
    def __init__(self, db: Session, spectral_client: SpectralClient) -> None:
        self._db = db
        self._spectral_client = spectral_client
        self._ruleset_repo = LintRulesetRepository(db)

    def lint(self, spec_json: dict, user_id: int) -> LintResponse:
        """
        Lint *spec_json* for *user_id*.

        Fetches the user's custom Lint Ruleset (if any), builds the ruleset
        YAML, and delegates to the injected SpectralClient.

        Returns:
            LintResponse with score, summary, and results.

        Raises:
            SpectralError: on any transport or process failure.
        """
        row = self._ruleset_repo.get(user_id)
        user_ruleset = (
            {"rules_json": row.rules_json, "raw_yaml": row.raw_yaml}
            if row is not None
            else None
        )
        ruleset_yaml = build_ruleset_yaml(user_ruleset)
        raw = self._spectral_client.lint(spec_json, ruleset_yaml)
        return LintResponse(
            score=raw["score"],
            summary=LintSummary(**raw["summary"]),
            results=raw["results"],
        )
