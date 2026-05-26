# Handoff — SpectralClient seam (design complete, ready to implement)

## Context

All design decisions for the `SpectralClient` seam have been finalised in a grilling session. The design is fully locked. The next agent should implement it directly — no further design discussion needed.

## Relevant artifacts

- [`CONTEXT.md`](../CONTEXT.md) — domain glossary (Spectral Sidecar term)
- [`docs/adr/0002-spectral-sidecar.md`](../docs/adr/0002-spectral-sidecar.md) — why the sidecar exists
- [`docs/adr/0003-spectral-client-seam.md`](../docs/adr/0003-spectral-client-seam.md) — **new ADR written this session; full design rationale lives here**
- [`backend/validation/spectral_linter.py`](../backend/validation/spectral_linter.py) — current implementation to refactor
- [`backend/routers/lint.py`](../backend/routers/lint.py) — call site; must remain untouched in this phase
- [`backend/tests/conftest.py`](../backend/tests/conftest.py) — receives the new `fake_spectral_client` fixture

## All decisions — locked

| # | Topic | Decision |
|---|-------|----------|
| 1 | **Interface** | `SpectralClient(Protocol)` with `lint(self, spec_json: dict, ruleset_yaml: str) -> dict`. `timeout` is a constructor arg per adapter, not on the interface. |
| 2 | **Module location** | New file `backend/validation/spectral_client.py`. `spectral_linter.py` retains `build_ruleset_yaml()`, `_parse_result()`, and the `run_spectral()` shim only. |
| 3 | **Adapter selection** | `SPECTRAL_MODE=subprocess\|http` env var. Factory function `get_spectral_client(mode: str \| None = None) -> SpectralClient` — plain function, no module-level singleton. DI-ready: a future `Depends(get_spectral_client)` requires no structural changes. |
| 4 | **Error contract** | `SpectralError(RuntimeError)`. Subclasses `RuntimeError` so existing `except RuntimeError` in `lint.py` requires no change during the transition. Both adapters raise only `SpectralError`. |
| 5 | **Test doubles** | `FakeSpectralClient` in `backend/tests/fakes.py`. `fake_spectral_client` pytest fixture in `conftest.py` returns default instance with `score: 100`, empty results. Tests needing specific results construct `FakeSpectralClient({...})` directly. |
| 6 | **Backward compat** | `run_spectral()` becomes a 4-line shim in `spectral_linter.py`. `lint.py` is **untouched** in this PR. Shim is removed in a follow-up DI PR. |
| 7 | **ADR** | `docs/adr/0003-spectral-client-seam.md` — written and saved. |

## Implementation todo list

```
[ ] Create backend/validation/spectral_client.py with:
    - SpectralError(RuntimeError)
    - SpectralClient Protocol
    - SubprocessSpectralClient (timeout: int constructor arg)
    - HttpSpectralClient (base_url: str constructor arg)
    - get_spectral_client(mode: str | None = None) -> SpectralClient factory

[ ] Move subprocess invocation logic from spectral_linter.py into
    SubprocessSpectralClient.lint() — raise SpectralError instead of RuntimeError

[ ] Implement HttpSpectralClient.lint() — POST { spec: object, ruleset: string }
    to SPECTRAL_SIDECAR_URL, raise SpectralError on non-2xx or network failure

[ ] Replace run_spectral() body in spectral_linter.py with 4-line shim:
    call get_spectral_client(), build_ruleset_yaml(), then client.lint()

[ ] Create backend/tests/fakes.py with FakeSpectralClient class

[ ] Add fake_spectral_client fixture to backend/tests/conftest.py
    (score 100, empty results default)

[ ] Write unit tests for SubprocessSpectralClient and HttpSpectralClient
    (new backend/tests/test_spectral_client.py recommended)

[ ] Verify all existing tests pass with the shim in place
```

## Factory shape (exact, locked)

```python
def get_spectral_client(mode: str | None = None) -> SpectralClient:
    resolved = mode or os.environ.get("SPECTRAL_MODE", "subprocess")
    if resolved == "http":
        return HttpSpectralClient(base_url=os.environ["SPECTRAL_SIDECAR_URL"])
    return SubprocessSpectralClient(
        timeout=int(os.environ.get("SPECTRAL_TIMEOUT", "60"))
    )
```

## Shim shape (exact, locked)

```python
# backend/validation/spectral_linter.py
def run_spectral(spec_json, ruleset="spectral:oas", timeout=60, user_ruleset=None):
    from validation.spectral_client import get_spectral_client
    client = get_spectral_client()
    ruleset_yaml = build_ruleset_yaml(user_ruleset)
    return client.lint(spec_json, ruleset_yaml)
```

## FakeSpectralClient shape (exact, locked)

```python
# backend/tests/fakes.py
class FakeSpectralClient:
    def __init__(self, result: dict):
        self.result = result

    def lint(self, spec_json: dict, ruleset_yaml: str) -> dict:
        return self.result
```

## conftest.py fixture (exact, locked)

```python
@pytest.fixture
def fake_spectral_client():
    return FakeSpectralClient({
        "score": 100,
        "summary": {"error": 0, "warn": 0, "info": 0, "hint": 0},
        "results": [],
    })
```

## Suggested skills

- `tdd` — implement the seam using red-green-refactor; the interface and fakes are fully specified above
- `validation-loop` — after implementation, verify all existing tests still pass and the new adapter tests cover both happy path and `SpectralError` cases
