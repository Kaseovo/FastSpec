"""
Test fakes — injectable test doubles for unit tests.

FakeSpectralClient
    A SpectralClient implementation that never spawns a subprocess or calls
    a sidecar. Configured with a fixed response; records calls for assertions.

Usage::

    from tests.fakes import FakeSpectralClient

    client = FakeSpectralClient()                          # score=100, no issues
    client = FakeSpectralClient(score=80, results=[...])   # custom response
    client = FakeSpectralClient(raise_error="boom")        # raises SpectralError

    service = LintService(db=session, spectral_client=client)
    service.lint(spec_json, user_id=1)

    assert client.calls == [(spec_json, "extends: spectral:oas\\n")]
"""

from typing import Any, Dict, List, Optional

from validation.spectral_client import SpectralError


class FakeSpectralClient:
    """
    In-memory SpectralClient for unit tests.

    Records every call in ``.calls`` as ``(spec_json, ruleset_yaml)`` tuples.
    Returns a fixed result or raises ``SpectralError`` on demand.
    """

    def __init__(
        self,
        score: int = 100,
        summary: Optional[Dict[str, int]] = None,
        results: Optional[List[Dict[str, Any]]] = None,
        raise_error: Optional[str] = None,
    ) -> None:
        self._score = score
        self._summary = summary or {"error": 0, "warn": 0, "info": 0, "hint": 0}
        self._results = results or []
        self._raise_error = raise_error
        self.calls: List[tuple] = []

    def lint(self, spec_json: dict, ruleset_yaml: str) -> dict:
        self.calls.append((spec_json, ruleset_yaml))
        if self._raise_error:
            raise SpectralError(self._raise_error)
        return {
            "score": self._score,
            "summary": self._summary,
            "results": self._results,
        }
