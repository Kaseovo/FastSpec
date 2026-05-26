# Handoff — LintService extraction (Candidate 1)

## Focus for next session

Design and implement the `LintService` + `LintRulesetRepository` extraction from [`backend/routers/lint.py`](../backend/routers/lint.py). This is Candidate 1 from the architecture review.

## Relevant artifacts

- [`CONTEXT.md`](../CONTEXT.md) — domain glossary (Lint Ruleset, User Lint Ruleset, Structured Rules, Raw Ruleset Override)
- [`docs/adr/0001-aws-deployment-architecture.md`](../docs/adr/0001-aws-deployment-architecture.md)
- [`docs/adr/0002-spectral-sidecar.md`](../docs/adr/0002-spectral-sidecar.md)
- [`docs/adr/0003-spectral-client-seam.md`](../docs/adr/0003-spectral-client-seam.md) — SpectralClient seam (prerequisite for LintService)
- [`backend/routers/lint.py`](../backend/routers/lint.py) — the fat module being refactored (280 lines)
- [`backend/services/spec_service.py`](../backend/services/spec_service.py) — pattern to follow for LintRulesetRepository
- [`backend/tests/test_lint_api.py`](../backend/tests/test_lint_api.py) — existing lint endpoint tests (patch `routers.lint.run_spectral`)
- [`backend/tests/test_lint_ruleset_api.py`](../backend/tests/test_lint_ruleset_api.py) — existing ruleset CRUD + forwarding tests

## Problem summary

[`lint.py`](../backend/routers/lint.py) (280 lines) does three things at once:
1. **User Lint Ruleset persistence** — fetch/upsert/delete on `user_lint_rulesets` table (inline DB queries in the router)
2. **Spec access-control** — ownership checks and version resolution (duplicated from `specs.py`)
3. **Lint orchestration** — call `run_spectral()`, shape `LintResponse`

The module is **shallow**: its interface is nearly as complex as the implementation. The *deletion test* passes — removing `_fetch_user_ruleset` concentrates complexity, not just moves it.

Additionally, all existing lint tests patch at `routers.lint.run_spectral` — they will need updating once `LintService` wraps the `SpectralClient`.

## Decisions made this session

- **Extract both in the same pass**: `LintService` (lint orchestration) + `LintRulesetRepository` (ruleset CRUD). Avoids a half-refactored `lint.py` with residual inline DB queries. This was the pending answer to design question 1 — **confirm with user at start of next session**.

## Design questions to resolve (start grilling here)

1. **Scope confirmed?** User was about to answer whether `LintService` + `LintRulesetRepository` are extracted in the same pass or sequentially. Get explicit confirmation.

2. **`LintService` interface** — Proposed:
   ```python
   class LintService:
       def __init__(self, db: Session, spectral_client: SpectralClient): ...
       def lint(self, spec_json: dict, user_id: int) -> LintResponse: ...
   ```
   Should `SpectralClient` be injected (preferred, ADR-0003 compatible) or fetched internally via `get_spectral_client()`?

3. **`LintRulesetRepository` interface** — Mirror `SpecService` pattern:
   ```python
   class LintRulesetRepository:
       def __init__(self, db: Session): ...
       def get(self, user_id: int) -> UserLintRuleset | None: ...
       def upsert(self, user_id: int, rules_json, raw_yaml) -> UserLintRuleset: ...
       def delete(self, user_id: int) -> None: ...  # raises 404 if absent
   ```
   Agree?

4. **Spec ownership check in lint endpoints** — `lint.py` currently re-implements spec ownership checks inline (not via `SpecService`). Should `LintService.lint()` call `SpecService.get_spec()` to resolve the spec, or should the router resolve the spec and pass `spec_json` directly to `LintService`?
   > Recommendation: router resolves spec (calls `SpecService`), passes `spec_json` to `LintService.lint()`. Keeps `LintService` focused on lint — not spec access control.

5. **Test migration** — Existing tests patch `routers.lint.run_spectral`. After extraction, tests should inject `FakeSpectralClient` (from ADR-0003) into `LintService` directly. New `test_lint_service.py` tests the service in isolation. Existing `test_lint_api.py` becomes integration tests against the full router stack. Agree?

6. **Module location** — `backend/services/lint_service.py` (mirrors `spec_service.py`) and `backend/services/lint_ruleset_repository.py`? Or a single `backend/services/lint.py`?

7. **ADR?** Once design is locked, offer ADR-0004 for the LintService seam. Meets all 3 criteria: hard to reverse (changes test surface), surprising without context, real trade-off (service vs inline).

## Suggested skills

- `grill-with-docs` — continue design grilling for LintService
- `tdd` — implement LintService + LintRulesetRepository using red-green-refactor once design is confirmed

## Prerequisite

ADR-0003 (`SpectralClient` seam) must be implemented before `LintService` can inject a `SpectralClient`. Confirm implementation status at start of session.
