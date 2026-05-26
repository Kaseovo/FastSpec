# ADR 0003 — SpectralClient Seam

## Status

Accepted

## Context

ADR-0002 decided to extract the Spectral CLI into a dedicated sidecar container reachable over HTTP. That decision left an open question: how should the Python backend call Spectral?

Before the sidecar, `spectral_linter.py` called `subprocess.run()` directly. With the sidecar, it needs to make an HTTP call instead. Rather than replacing one hard-coded transport with another, this ADR introduces an abstraction layer — the **SpectralClient seam** — so the backend can work with either transport without the rest of the codebase knowing which one is active.

The seam also needs to be testable without a running Spectral process or sidecar.

## Decision

Introduce a `SpectralClient` Protocol in `backend/validation/spectral_client.py`:

```python
class SpectralClient(Protocol):
    def lint(self, spec_json: dict, ruleset_yaml: str) -> dict: ...
```

Two concrete adapters implement the Protocol:

- **`SubprocessSpectralClient`** — wraps the existing `subprocess.run()` logic, used in the `local` Deployment Environment (developer machines, CI without a sidecar).
- **`HttpSpectralClient`** — calls the Spectral Sidecar via `POST /lint`, used in `dev`, `staging`, and `prod`.

A factory function selects the adapter at runtime based on the `SPECTRAL_MODE=subprocess|http` environment variable. The factory is a plain function (not a module-level singleton) so it can be called with an explicit `mode` argument in tests, and wrapped with `Depends()` in a future FastAPI DI pass without structural changes.

Errors from either adapter are raised as `SpectralError(RuntimeError)`. The `RuntimeError` base class preserves backward compatibility with the existing `except RuntimeError` catch in `lint.py` during the transition period.

`build_ruleset_yaml()` and `_parse_result()` remain in `spectral_linter.py` as pure Python functions. Both adapters call `build_ruleset_yaml()` before dispatching; `_parse_result()` is called after receiving the raw Spectral JSON output. The sidecar receives already-serialised YAML: `{ spec: object, ruleset: string }`.

`run_spectral()` is retained as a shim in `spectral_linter.py` that delegates to `get_spectral_client().lint()`. This keeps `lint.py` untouched during this phase; the shim is removed when `lint.py` is updated to use `Depends()` in a follow-up pass.

A `FakeSpectralClient` is provided in `backend/tests/fakes.py` for use in unit tests. A `fake_spectral_client` fixture in `conftest.py` returns a default instance with `score: 100` and no results.

## Consequences

- `backend/validation/spectral_client.py` becomes the single location for transport logic; `spectral_linter.py` is pure YAML-building and result-parsing.
- Tests that exercise lint behaviour no longer need a live Spectral process — they use `FakeSpectralClient`.
- Switching from subprocess to sidecar in production requires only setting `SPECTRAL_MODE=http` and `SPECTRAL_SIDECAR_URL`; no code changes.
- `lint.py` is unchanged in this phase; one follow-up PR wires `Depends(get_spectral_client)` and removes the shim.

## Alternatives Considered

### Keep the hard-coded subprocess call, add a separate HTTP path
Rejected. Two divergent code paths with no shared contract would drift over time and be impossible to test without a live Spectral process.

### Replace subprocess with HTTP unconditionally
Rejected. The sidecar is not available in the `local` Deployment Environment without extra setup. The subprocess adapter keeps local development zero-friction.

### Use a module-level singleton for the active adapter
Rejected. A singleton is harder to override in tests (requires monkey-patching) and blocks future FastAPI `Depends()` wiring. A factory function is equally cheap and trivially injectable.
