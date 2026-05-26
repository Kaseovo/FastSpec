# ADR 0004 — LintService and LintRulesetRepository Extraction

## Status

Accepted

## Context

ADR-0003 introduced the `SpectralClient` seam, making the Spectral transport injectable. That seam left `lint.py` untouched via a `run_spectral()` shim. This ADR describes the follow-up pass: extracting the business logic out of `lint.py` into a proper service layer.

`backend/routers/lint.py` (280 lines) currently does three things at once:

1. **User Lint Ruleset persistence** — inline DB queries against `user_lint_rulesets` in every handler
2. **Spec access-control** — ownership checks and version resolution duplicated from `specs.py`
3. **Lint orchestration** — calling `run_spectral()` and shaping `LintResponse`

The module is also the only place that knows how to raise a 502 from a `SpectralError`, mixing HTTP-layer concerns with lint logic.

## Decision

Extract two new modules in the same pass, rather than sequentially, to avoid a half-refactored `lint.py` with residual inline DB queries:

### `LintService` (`backend/services/lint_service.py`)

Owns lint orchestration: fetches the User Lint Ruleset via `LintRulesetRepository`, builds the ruleset YAML, calls the injected `SpectralClient`, and returns a `LintResponse`.

```python
class LintService:
    def __init__(self, db: Session, spectral_client: SpectralClient): ...
    def lint(self, spec_json: dict, user_id: int) -> LintResponse: ...
```

`LintService.lint()` raises `SpectralError` — not `HTTPException`. The router catches `SpectralError` and converts it to a 502. This is a deliberate divergence from `SpecService`, which raises `HTTPException` directly. The reason: lint failure is a transport/infrastructure error, not a client error; the 502 conversion is an HTTP-layer responsibility.

`SpectralClient` is injected via the constructor (not fetched internally via `get_spectral_client()`). This preserves testability: unit tests pass a `FakeSpectralClient` directly.

### `LintRulesetRepository` (`backend/services/lint_ruleset_repository.py`)

Owns persistence of the User Lint Ruleset. Returns ORM objects (`UserLintRuleset | None`); schema conversion stays in the router.

```python
class LintRulesetRepository:
    def __init__(self, db: Session): ...
    def get(self, user_id: int) -> UserLintRuleset | None: ...
    def upsert(self, user_id: int, rules_json, raw_yaml) -> UserLintRuleset: ...
    def delete(self, user_id: int) -> None: ...  # raises HTTPException 404 if absent
```

YAML syntax validation stays in the router (input validation concern, not persistence concern).

### Router responsibility after extraction

The router (`lint.py`) becomes thin:

- Calls `SpecService.get_spec(user, spec_id)` for ownership confirmation on `POST /lint/{spec_id}` and `POST /lint/{spec_id}/lint-draft` — no inline DB queries for spec access
- Calls `LintService.lint(spec_json, user_id)` and catches `SpectralError` → 502
- Calls `LintRulesetRepository` for ruleset CRUD endpoints

### Shim removal

The `run_spectral()` shim introduced in ADR-0003 is removed in this pass. `lint.py` is updated to instantiate `LintService` with `Depends(get_spectral_client)`.

### Test surface

- **`backend/tests/fakes.py`** — `FakeSpectralClient` records calls and returns a configurable response
- **`backend/tests/test_lint_service.py`** — unit tests for `LintService` injecting `FakeSpectralClient` directly
- **`backend/tests/test_lint_api.py`** — router integration tests updated to patch at `services.lint_service` instead of `routers.lint.run_spectral`
- Score calculation tests moved from `test_lint_api.py` to `test_spectral_linter.py`
- Broken `test_adhoc_lint_custom_ruleset` test (tests a non-existent `ruleset` URL parameter) removed

## Consequences

- `lint.py` is reduced to routing + HTTP-layer error conversion only
- `LintService` is testable in isolation without a DB or running Spectral process
- Spec ownership is handled consistently via `SpecService` — no duplicated inline queries
- `SpectralError` (not `HTTPException`) is the canonical error from the lint layer; the router owns the 502 mapping
- `SpecService` continues to raise `HTTPException` directly; this inconsistency is acknowledged and acceptable until a future refactor unifies the service layer error model

## Alternatives Considered

### Extract sequentially — LintRulesetRepository first, then LintService

Rejected. Leaves `lint.py` in a half-refactored state with residual inline DB queries after the first pass. A single cohesive PR is cleaner.

### LintService accepts `spec_id` and resolves the spec internally

Rejected. Mixes lint orchestration with spec access-control. The spec ownership boundary belongs at the router layer, consistent with how `SpecService` is used in `routers/specs.py`.

### LintService raises HTTPException like SpecService

Rejected. `SpectralError` is an infrastructure failure (sidecar unavailable, subprocess crash), not a client input error. Raising `HTTPException(502)` inside the service couples the service to HTTP semantics. The router is the correct place to translate infrastructure errors to HTTP status codes.
