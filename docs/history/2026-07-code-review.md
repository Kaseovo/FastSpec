# FastSpec — Principal Engineer Code Review

> **Historical snapshot.** This review was written in July 2026, before the
> open-source release, and records the state of the code at the time and the
> work that followed. Code comments cite its sections for background; for
> how FastSpec works today, see [ARCHITECTURE.md](../ARCHITECTURE.md).

**Date**: 2026-07-11
**Scope**: Full repository (backend, frontend, infra, CI/CD, docs).

This document is a snapshot review, not a living spec — treat findings as a
backlog to work through and delete/update entries once addressed, rather
than a permanent record.

## Understanding the project

**Purpose**: A SaaS for creating, editing, versioning, linting (Spectral),
and diffing OpenAPI 3.0 specs, with Google sign-in, user-scoped API keys, and
an MCP server so AI agents can read specs.

**Stack**: FastAPI + SQLAlchemy + Alembic + PostgreSQL; Vue 3 + PrimeVue +
Monaco; FastMCP 3 beta mounted into the same ASGI app; deployed as a
Docker-image Lambda behind a Function URL, with S3/CloudFront for the SPA and
a Webstudio-exported landing page; CDK for infra; a Wake/AutoStop stack that
starts/stops RDS on demand to save cost.

**Genuine strengths worth preserving**:
- The **lint subsystem is the best code in the repo**:
  [`SpectralClient` protocol seam](../../backend/validation/spectral_client.py),
  `LintService` free of HTTP semantics, `LintRulesetRepository`, ADR
  references in docstrings, fakes in tests. Textbook
  dependency-injection-for-testability.
- **ADRs and docs exist** (`docs/`, `docs/adr/`) — rare for a project this size.
- The **floci-based local dev story** (`make dev` deploys the same CDK stacks
  locally) is excellent DX in principle.
- The Wake/AutoStop RDS cost optimization is creative and the IAM roles are
  mostly thoughtfully split (start-only vs stop-only).
- Fail-fast `JWT_SECRET_KEY` check in [`config.py`](../../backend/config.py) is
  the right instinct.

---

## Must-fix correctness bugs

Status column reflects what has actually been fixed in this repo as of this
writing — verify against current code before trusting "Fixed".

| # | Bug | Status |
|---|---|---|
| 1 | `DELETE /specs/{id}/versions/{vid}` never deletes — missing `db.commit()` in [routers/specs.py](../../backend/routers/specs.py) `delete_version`. `get_db` rolls back on close, so the row survives. | **Fixed** — version endpoints extracted into [`services/spec_version_service.py`](../../backend/services/spec_version_service.py), which commits in one place; regression tests added in `test_specs_api.py`. |
| 2 | `POST /specs/{id}/versions/{vid}/publish` never persists — same missing-commit bug in `publish_version`. | **Fixed** — same `SpecVersionService.publish`, with a regression test. |
| 3 | Google token verification skipped the audience check when `GOOGLE_CLIENT_ID` was unset (`verify_oauth2_token(..., audience=None)` accepts tokens for *any* Google app). | **Fixed** — `/auth/google/*` now raises 503 via `_google_client_id()` if the client ID is missing, instead of silently passing `None`. |
| 4 | `Depends(get_spectral_client)` used directly as a FastAPI dependency in [routers/lint.py](../../backend/routers/lint.py) — FastAPI exposes its `mode` parameter as a public query param (`?mode=subprocess`), letting callers force the lint transport. | **Fixed** — routes now depend on `spectral_client_dependency` (zero-arg wrapper) in [`validation/spectral_client.py`](../../backend/validation/spectral_client.py). |
| 5 | Silent `except Exception: pass` around `AuthToken` persistence in [auth/jwt.py](../../backend/auth/jwt.py) `create_access_token` — a DB failure returns a JWT that is immediately invalid everywhere (jti lookup fails), with nothing logged. | **Fixed** — logs and raises a 500 instead of returning an unusable token. |
| 6 | MCP `tools/list` crashes unauthenticated: `AuthenticationMiddleware.on_list_tools` raises a bare `PermissionError` (not `ToolError`) when no Authorization header is present. | **Fixed** — `on_list_tools`/`on_call_tool` now catch `PermissionError` and re-raise as `ToolError`. |

---

## 1. High-Level Architecture

- **The backend layering is half-migrated.** The lint vertical follows
  Router → Service → Repository. The specs vertical is split-brain:
  `SpecService` handles CRUD, but the six versioning endpoints in
  [routers/specs.py](../../backend/routers/specs.py) do raw ORM queries,
  ownership checks, and commit management inline (400+ lines of business
  logic in the router). **This is the single highest-leverage refactor** — a
  `SpecVersionService` mirroring `LintService` would have prevented bugs #1
  and #2, because commit discipline would live in one place.
- **Flat module namespace**: `from database import ...`,
  `sys.path.insert` in alembic `env.py`, `pythonpath = ["."]` in
  `pyproject.toml`. Make `backend` a real package. Also fixes the
  circular-import dance in `database.py` (imports `models` mid-file, while
  `models` imports `Base` from `database`) — move `Base` to its own
  `base.py`.
- **The MCP server bypasses every abstraction**: [`fastmcp_server/server.py`](../../backend/fastmcp_server/server.py)
  opens `SessionLocal()` manually and duplicates the "derive title from
  current version" logic that also exists in `SpecService._build_response`.
  Route MCP tools through `SpecService`.
- **Docs contradicted the code** (README described ECS Fargate + ALB + Redis;
  real architecture is Lambda + Function URL, no Redis). Needs a doc refresh
  pass — `.env.example`, `Makefile db` target, and docker-compose still carry
  Redis config nothing uses.
- **Frontend**: `FormEditor.vue` at **6,052 lines** and `DiffDrawer.vue` at
  3,464 lines are unmaintainable monoliths (see §13). Diff logic exists
  twice: [`diff_utils.py`](../../backend/validation/diff_utils.py) (433 lines,
  backend) and `frontend/src/utils/diffUtils.js` +
  `markdownGenerator.js` (~1,000 lines) implement the same domain logic in
  two languages — pick one source of truth.

## 2. Code Quality

- **Duplication**: `exchange_api_key` route duplicates
  `exchange_api_key_for_short_jwt` in `auth/jwt.py` — the route should call
  the helper. `_resolve_version` vs. the inline UUID-or-version lookup in
  `get_version` is the same logic written twice, and `delete_version` uses a
  *third* variant (version-string only) — `DELETE` and `GET` accept
  different identifiers for the same resource. The three identical
  `try/except SpectralError → 502` blocks in `lint.py` could be one FastAPI
  exception handler.
- **Dead code**: `auth/oauth.py` (empty), `get_current_active_user`,
  `_serialize_version` (marked deprecated), `Token`/`TokenData`/
  `DiffResponse`/`MarkdownDiffResponse` schemas, `User.session_version`
  column (never read), `LintRequest.ruleset` field (accepted, documented,
  ignored), `greet()` MCP tool, the no-op `lifespan`. Delete all of it.
- **Dead permission logic**: `_check_can_modify_version` grants access to
  "creator of version" — but every caller first passes
  `_resolve_spec_or_404`, which already filters by `user_id ==
  current_user.id`, so a non-owner can never reach the check.
- **Naming**: the API-key endpoints live under `/auth/refresh` with
  functions like `refresh_api_key` that actually *revoke* — rename to
  `/auth/api-keys`.
- **Misleading docstrings**: `OpenAPISpecUpdate` claims optimistic
  concurrency via a required `version` field; the service ignores it.

## 3. Python Best Practices

- **Adopt `pydantic-settings`**. Config is scattered across `config.py` and
  ad-hoc `os.getenv` calls in `main.py`/`auth.py`/`jwt.py`/
  `spectral_client.py`/`database.py`, each with its own default. One
  `Settings` class gives typing, validation, and `.env` parsing — killing the
  `_int_env` hack that strips inline `#` comments from env values.
- **Blocking I/O in `async def` handlers** — every route is `async def` but
  does synchronous SQLAlchemy, `subprocess.run` (up to 60s for Spectral!),
  and sync `httpx.post`. Under uvicorn this blocks the event loop for all
  concurrent requests. On Lambda/Mangum today it's masked (one request per
  container), so this is a landmine for any future server deployment.
  Cheapest fix: declare DB/subprocess-bound handlers as plain `def` (FastAPI
  runs them in a threadpool).
- **Dependency risks**: both `pyjwt` and `python-jose` are in
  `requirements.txt`; `jose` (the one actually used) is unmaintained with
  known CVEs (CVE-2024-33663/33664) — migrate to PyJWT. `passlib` is also
  effectively unmaintained. Almost nothing is pinned and there's no
  lockfile — add `pip-tools`/`uv` with a compiled lock.
- **`datetime.utcnow()`** in `spec_service.py` is deprecated (Python 3.12);
  the naive-vs-aware datetime patchwork elsewhere (SQLite returns naive
  datetimes) should be centralized in one normalization helper or a
  `TZDateTime` type decorator.

## 4. API Design

- `POST /specs/?version=1.0.0` with the spec in the body is awkward —
  version belongs in the create payload.
- Inconsistent status codes: duplicate name → 400 (should be 409, as used
  for duplicate version elsewhere).
- Polymorphic responses on `/specs/{id}/diff` and `/compare` (dict, or
  `{markdown}`, or `{has_changes, message}`) with no `response_model` — your
  own OpenAPI docs can't describe these, which is ironic for an OpenAPI
  tooling product.
- No pagination on `GET /specs` or `/versions`, and `list_specs` returns the
  **full `spec_json` of every spec** for what the UI uses as a list view.
- Optimistic-concurrency field (`version` in `OpenAPISpecUpdate`) is
  unimplemented — either wire it up or remove it from the schema.

## 5. Testing

- **No CI runs any tests.** The only workflows are deploy and RDS
  start/stop. Tests exist (104 backend, 48 frontend, dozens of CDK) and are
  never executed automatically. A ~20-line `test.yml` on PR
  (pytest + vitest + `cdk synth` + infra jest) is the single best investment
  in this repo.
- **Missing tests exactly where the open bugs are**: no test covers
  `delete_version` or `publish_version` persistence (both broken), token
  revocation flow edge cases, or `find_api_key_by_raw` expiry.
- **Two conflicting test DB setups**:
  [`conftest.py`](../../backend/tests/conftest.py) patches a file-backed
  `test.db` engine session-wide, while `test_specs_api.py` builds its own
  in-memory `StaticPool` engine with per-test create/drop. Standardize on
  the in-memory pattern; stop leaving `test.db` files in the repo root.
- Tests run on SQLite, prod is Postgres — JSON columns, timezone behavior,
  and `IntegrityError` semantics differ. At minimum run the
  alembic-migration test against a Postgres service container in CI.
- Frontend: 3 spec files against 19k lines of components; the 6k-line
  `FormEditor` is untestable as-is.
- Property-based opportunity: `compare_specs`/`diff_utils` is pure and
  dict-driven — ideal for Hypothesis (e.g., `compare_specs(x, x)` never
  reports changes).

## 6. Security (ranked)

**Critical**
1. **RDS is publicly accessible with `0.0.0.0/0` on 5432**
   ([data-stack.ts](../../infra/lib/data-stack.ts)), authenticated as the
   **`postgres` superuser** with a code-level default password of
   `"fastspec"`. Fix: dedicated low-privilege app role instead of
   `postgres`, remove the weak fallback default (fail fast like
   `JWT_SECRET_KEY`), enforce `rds.force_ssl=1` server-side, consider IAM DB
   auth or moving the Lambda into a VPC with RDS Proxy.
2. ~~Google audience-check bypass~~ — **Fixed** (see bug #3 above).

**High**
3. **User-supplied raw Spectral YAML is executed by the Spectral CLI**
   ([validation/spectral_linter.py](../../backend/validation/spectral_linter.py)).
   Spectral rulesets support `extends` with URLs (SSRF) and
   `functions`/`functionsDir` referencing JS on disk. Validate the parsed
   YAML against an allowlist of keys before writing it to the temp file.
4. **Full JWTs stored in plaintext in the DB** (`AuthToken.token`) and never
   read back — the `jti` alone supports revocation. Drop the column; a DB
   leak currently becomes a session-hijack kit. No cleanup job either — the
   table grows one row per login forever.
5. **Access token TTL is `3600` *minutes* (2.5 days)**
   ([auth/jwt.py](../../backend/auth/jwt.py)) stored in `localStorage`
   (XSS-exfiltratable). The name/value mismatch suggests 3600 *seconds* was
   intended.

**Medium**
6. `WAKE_SECRET` is sed-injected into a public static page — not a secret
   once shipped in HTML; treat as a rate-limit token, not auth.
7. No rate limiting on `/auth/google/verify`, `/auth/google/callback`, or
   `/auth/refresh/exchange` — cheap DoS/cost amplification on Lambda.
8. `rds:StartDBInstance`/`StopDBInstance` IAM actions on `resources: ['*']`
   in [wake-stack.ts](../../infra/lib/wake-stack.ts) — scope to the instance
   ARN.
9. Error detail leakage via `detail=str(e)` on several 500 responses.

**Low**: silent SSM cold-start failures in `lambda_handler.py` make missing
secrets invisible in prod; add logging.

## 7. Performance

- **`list_specs` is N+1**: one query for specs + one per spec for its
  current version, returning full JSON content each time. Fix with a join +
  a lightweight summary response model.
- **Event-loop blocking** (§3) — the 60s Spectral subprocess inside
  `async def` is the worst instance.
- **Subprocess-per-lint**: Node + Spectral cold start per request on the
  live-editor path. The HTTP sidecar mode already exists in
  `spectral_client.py` — prefer it wherever lint volume matters; consider
  caching lint results keyed on content hash + ruleset hash.
- API-key exchange runs pbkdf2 verification on every MCP request rather than
  letting clients reuse the 300s short JWT directly.

## 8. AWS / Cloud Infrastructure

The cost-driven architecture (Lambda + stoppable RDS + wake page) is
coherent and documented in an ADR — good. Beyond the security items above:

- **No DLQ / no alarms anywhere**: the auto-stop Lambda, wake Lambda, and
  backend have no CloudWatch alarms, no error metrics, no DLQ on the
  EventBridge target. A failed auto-stop = silent RDS bill.
- **Inline Python as a JS string array** in `wake-stack.ts`'s auto-stop
  Lambda — unreviewable, unlintable, untestable. Move it to a real
  `infra/lambda/auto-stop/index.py` file, matching how the wake Lambda code
  is already organized.
- CI deploy runs `cdk deploy` before any test/synth validation, and
  `bump2version --allow-dirty` + `git push` happens in the same job as
  deploy. Split version-bump and deploy jobs; add `cdk diff` output to the
  run.

## 9. Developer Experience

- **No linting/formatting configured** for Python (no ruff/black config) or
  frontend (no eslint/prettier config). Adopt **ruff** (lint + format) —
  it would have flagged the unused imports, dead code, and bare excepts
  noted above. Add pre-commit with ruff + prettier + `detect-secrets`.
- **No test CI** (§5) — the biggest DX/process gap.
- Repo hygiene: multiple `test.db`/`fastspec.db` files, `.DS_Store` files,
  `backend/package-lock.json` in a Python directory, `.kilo/worktrees` with
  full repo copies — all local-only but noisy.
- `frontend/.env` is git-tracked; rename to `.env.defaults` or fold into
  vite config to avoid inviting accidental secret commits.

## 10. Technical Debt Backlog

**Critical**
| Item | Why | Effort |
|---|---|---|
| Missing commits in `delete_version`/`publish_version` + regression tests | Silent data-loss bugs on `main` | ~1h |
| DB: drop `postgres` superuser + `"fastspec"` default password; force SSL server-side | Publicly reachable DB | 0.5–1d |
| Add CI workflow running pytest + vitest + `cdk synth` on PR | Nothing catches regressions today | 0.5d |

**High**
| Item | Why | Effort |
|---|---|---|
| Validate user `raw_yaml` rulesets against an allowlist | SSRF/exec surface via Spectral | 0.5d |
| Extract `SpecVersionService`; move version-endpoint logic out of the router | Prevents the commit-bug class; consistency with the lint vertical | 1–2d |
| Fix `Depends(get_spectral_client)` query-param leak | Unintended public control | 15min |
| Drop `AuthToken.token` column; add token-cleanup job; shorten access TTL | Session-theft exposure, unbounded growth | 0.5d |
| Migrate `python-jose` → `PyJWT`; pin deps with a lockfile | Known CVEs, unreproducible builds | 0.5d |
| Make DB-bound handlers sync `def` (or async DB) | Event-loop blocking | 0.5d |

**Medium**: `pydantic-settings` consolidation; pagination + summary model for
`list_specs`; README/docs refresh (remove stale Redis/ECS references);
ruff + pre-commit; Pydantic model for `/compare` body; unify error envelope;
route MCP tools through `SpecService`; fix MCP `tools/list` unauthenticated
crash; alarm + DLQ on auto-stop; scope RDS IAM to instance ARN.

**Low**: delete the dead-code inventory in §2; rename `/auth/refresh` →
`/auth/api-keys`; move inline auto-stop Python to a file;
`datetime.utcnow()` deprecation; Hypothesis tests for `diff_utils`.

## 11. Refactoring Opportunity — Version Endpoints

Today every version-endpoint handler repeats resolve-spec →
resolve-version → permission check → mutate → (sometimes) commit. Extracting
a `SpecVersionService` collapses that into one place:

```python
# routers/specs.py — router shrinks to HTTP translation only
@router.post("/{spec_id}/versions/{version_id}/publish", response_model=SpecVersionResponse)
async def publish_version(spec_id: str, version_id: str,
                          svc: SpecVersionService = Depends(get_version_service),
                          user: User = Depends(get_current_user)):
    return svc.publish(user, spec_id, version_id)

# services/spec_version_service.py
def publish(self, user: User, spec_id: str, version_key: str) -> SpecVersion:
    spec = self._owned_spec_or_404(user, spec_id)
    ver = self._version_or_404(spec_id, version_key)
    spec.version = ver.version
    self.db.commit()          # commit discipline lives in ONE place
    return ver
```

This also collapses `_resolve_version`'s three variants into one canonical
lookup used by GET/PUT/DELETE alike, and gives the MCP server a real service
API to call instead of raw sessions.

## 12. Production Readiness

- **Observability is near-zero**: `print()` in MCP middleware (which logs
  full tool inputs/outputs — a PII risk), no structured logging, no request
  IDs, no metrics, no tracing.
- **Resilience**: no retry/backoff on the SSM cold-start fetch (failures are
  swallowed, so the app can run with *missing* secrets); no clear 503
  "waking up" response when RDS is stopped — the first request after
  auto-stop will hang then 500.
- **Health check** `/health` returns static JSON — never touches the DB, so
  it can't detect a stopped-RDS state. Add `/health/ready` doing `SELECT 1`.

## 13. AI Readability

FastSpec explicitly targets AI-assisted development (AGENTS.md,
copilot-instructions, `.kilo/`). The backend is reasonably AI-friendly: small
files, docstrings referencing ADRs, clear seams in the lint vertical. Three
things actively hurt agents:

1. **`FormEditor.vue` (6,052 lines) and `DiffDrawer.vue` (3,464 lines)**
   exceed what an agent can hold alongside the rest of its context; edits
   there degenerate into blind patches. Decompose by concern.
2. **Stale docs are worse than no docs for agents** — an out-of-date README
   causes agents to make confidently wrong changes (e.g., "restoring" Redis
   config that nothing uses).
3. **Dead code and misleading names** (`/auth/refresh` for API keys,
   unimplemented optimistic-concurrency fields, ignored `ruleset` param)
   send agents down false paths.

Conventions that are working: ADR references in module docstrings
("ADR-0004") give agents an authoritative *why* — extend that pattern to the
specs vertical.

## 14. Final Score

Scores below are from the original 2026-07-11 review. See the 2026-07-12
changelog entry for what has since been fixed — most Critical and High items
are now addressed; scores have not been re-derived line-by-line but the
overall posture is materially better (fewer live bugs, no plaintext-JWT/public-superuser
password fallback in backend code, CI now runs tests, docs refreshed).

| Category | Score | Justification |
|---|---|---|
| Architecture | 7 | Clean seams where refactored (lint); split-brain elsewhere; MCP bypasses layers |
| Maintainability | 6 | Small backend files, good docstrings; dead code, duplication, 6k-line Vue components |
| Readability | 7 | Consistent style, well-commented; misleading names/docstrings deduct |
| Scalability | 5 | No pagination, N+1s, blocking I/O in async, subprocess-per-lint |
| Performance | 5 | Fine at current scale; several known landmines |
| Security | 4 → improving | Public RDS + superuser + weak default and plaintext JWTs at rest remain; the audience-check bypass is now fixed |
| Testing | 5 | Solid lint-vertical tests and fakes; zero CI execution, gaps exactly where the open bugs are |
| Developer Experience | 6 | Excellent Makefile/floci story; no linters, no test CI, docs need a refresh pass |
| Documentation | 6 | Unusually rich (ADRs!) but was materially out of date in places |
| Production Readiness | 4 | Data-loss bugs on `main`, no alarms/metrics/structured logs, silent failure modes |

**Overall: 5.5/10 at time of review.** This is a well-conceived project with
genuinely good architectural instincts — the lint vertical and ADR habit
show the team knows what good looks like. The score was dragged down by
three things, all fixable in under two weeks: (1) live correctness bugs that
exist because tests never run in CI, (2) a security posture (public
superuser DB, audience bypass) inconsistent with being on the public
internet, and (3) documentation that described a previous architecture. Work
the Critical backlog first; the High items bring the rest of the codebase up
to the standard its best module (the lint vertical) already sets.

---

## Changelog

- **2026-07-12** — Replaced the Google popup/One-Tap sign-in flow (broken
  under Brave's popup blocker) with a server-side OAuth 2.0 Authorization
  Code redirect flow (`GET /auth/google/login` → Google → `GET
  /auth/google/callback` → redirect with token in the URL fragment). As part
  of that work, fixed the audience-check-bypass bug (#3 in the table above)
  by failing fast with a 503 when `GOOGLE_CLIENT_ID` is unset instead of
  passing `audience=None` to `verify_oauth2_token`. See
  [`docs/AUTHENTICATION.md`](../AUTHENTICATION.md) for the current flow and
  `backend/tests/test_auth_google_redirect.py` (since replaced by `test_auth_oidc.py`)
  for coverage.

- **2026-07-12** — Worked the bulk of this review's backlog in one pass:
  - **Must-fix bugs #1, #2, #4, #5, #6**: all fixed (see table above).
  - **Architecture/refactor**: extracted `SpecVersionService`
    ([`backend/services/spec_version_service.py`](../../backend/services/spec_version_service.py)),
    collapsing the three disagreeing version-lookup variants into one
    canonical `version_or_404`, and removing the dead
    "creator of version" permission branch (unreachable once ownership is
    checked via `owned_spec_or_404`). Router now delegates entirely.
  - **API design**: `version` can now be passed in the `OpenAPISpecCreate`
    body (query param kept as a deprecated fallback); duplicate-name and
    version conflicts now return 409 instead of 400; `OpenAPISpecUpdate.version`
    is now enforced as real optimistic concurrency (409 on mismatch) instead
    of being accepted and ignored; `/specs/{id}/diff` and `/specs/{id}/compare`
    now have real `response_model`s (`SpecDiffResponse`, `SpecCompareResponse`);
    `GET /specs` accepts `skip`/`limit` (additive, backward compatible).
  - **Performance**: `list_specs` N+1 fixed with a single join.
  - **Security**: dropped the plaintext `AuthToken.token` column and the
    dead `User.session_version` column (migration
    `e21196ca7732_drop_dead_columns`); fixed the `ACCESS_TOKEN_EXPIRE_MINUTES`
    name/value mismatch (was 3600 *minutes* ≈ 2.5 days, now defaults to 60);
    added an allowlist check on user-supplied `raw_yaml` lint rulesets
    rejecting `functions`/`functionsDir` (arbitrary JS from disk) and
    non-`spectral:` `extends` targets (SSRF); added best-effort in-memory
    rate limiting on `/auth/google/verify`, `/auth/google/callback` and
    `/auth/api-keys/exchange`; `backend/database.py`'s DB-password fallback
    now fails fast instead of defaulting to `"fastspec"` (mirrors
    `JWT_SECRET_KEY`); migrated `python-jose` → `PyJWT` (drops the
    unmaintained/CVE-affected dependency).
  - **Code quality**: removed duplication (`exchange_api_key` route now
    calls `exchange_api_key_for_short_jwt`; the three `SpectralError`→502
    try/excepts collapsed into one FastAPI exception handler in `main.py`);
    deleted dead code (`auth/oauth.py`, `get_current_active_user`, the
    `greet` MCP tool, `Token`/`TokenData` schemas, the ignored
    `LintRequest.ruleset` field); renamed `/auth/refresh` → `/auth/api-keys`
    (backend, frontend, and docs updated together).
  - **Python best practices**: adopted `pydantic-settings`
    (`backend/config.py`) consolidating JWT/Google/CORS/Spectral env vars
    that were previously scattered `os.getenv` calls with inconsistent
    defaults; DB/subprocess-bound route handlers changed from `async def`
    to plain `def` so FastAPI runs them in the threadpool instead of
    blocking the event loop; fixed the `datetime.utcnow()` deprecation in
    `spec_service.py`.
  - **Testing**: added regression tests for the delete/publish persistence
    bugs and the new ruleset-security validation; consolidated the test DB
    setup onto in-memory SQLite + StaticPool (`conftest.py`), which also
    stops `test.db` files from being left in the repo root.
  - **Production readiness**: added `/health/ready` (does a real `SELECT 1`
    so a stopped/waking RDS instance surfaces as 503 instead of a hung
    request).
  - **Infra/CI**: added `.github/workflows/test.yml` (pytest + vitest +
    infra jest + `cdk synth` on PR); split the deploy workflow into
    version-bump → validate → deploy jobs so `cdk deploy` can't run before
    tests pass; scoped `wake-stack.ts`'s RDS start/stop IAM actions to the
    instance ARN; moved the auto-stop Lambda's inline Python to a real file
    (`infra/lambda/auto-stop/`) with its own tests; added a DLQ + retries on
    its EventBridge target and CloudWatch alarms on Lambda errors; enforced
    `rds.force_ssl=1` via a DB parameter group. The RDS public-ingress /
    superuser-role items are **not** fully resolved — see
    [`docs/adr/0002-rds-public-access-tradeoff.md`](../adr/0002-rds-public-access-tradeoff.md)
    for why (Lambda runs outside a VPC for cost reasons) and what a real fix
    would require.
  - **DX**: added ruff (`backend/pyproject.toml`) and eslint/prettier
    (`frontend/`) configs, plus a pre-commit config; removed stray
    `test.db`/`fastspec.db` files and the misplaced `backend/package-lock.json`.
  - **Docs**: refreshed `README.md`, `docs/ARCHITECTURE.md`,
    `docs/BACKEND.md`, `CONTEXT.md`, `.env.example`, `Makefile` and
    `docker-compose*.yml` to describe the actual Lambda/RDS/no-Redis
    architecture instead of the stale ECS+Redis description.
  - **Frontend**: decomposed `DiffDrawer.vue` (3,464 → 1,231 lines) into
    `frontend/src/components/diff-drawer/*`, `useDiffDrawer.js` and
    `diffDisplay.js`. `FormEditor.vue` (6,052 → 5,311 lines) had its
    smaller tabs/dialogs extracted (`form-editor/*`,
    `openApiFormHelpers.js`); the Paths and Components/schemas tabs
    (~2,500 lines) were deliberately left alone — they share a single
    mutable `formData` ref across dozens of interlinked functions with no
    existing test coverage, so a forced split risked the exact "blind
    patch" failure mode this review warned about. Frontend build and test
    suite (48/48) verified green after each extraction.
  - **Not done in this pass** (tracked, not forgotten): moving MCP tools to
    call `SpecService` instead of opening `SessionLocal()` directly; making
    `backend` a real package (flat `from database import ...` imports);
    unifying the backend/frontend diff-logic duplication; splitting the
    remaining large Vue tabs; migrating off the Postgres `postgres`
    superuser role.

- **2026-07-16** — Worked the "not done in this pass" list above:
  - **MCP → `SpecService`**: `backend/fastmcp_server/server.py`'s
    `get_saved_specs_for_user` and `get_spec_details` now construct a
    `SpecService(db)` and call its `list_specs`/`get_spec` methods instead
    of duplicating the "derive title from current version" query logic.
    Added `backend/tests/test_fastmcp_server.py` (no prior MCP test
    coverage existed) covering per-user isolation and not-found handling.
  - **Circular import**: `Base = declarative_base()` moved out of
    `database.py` into a new `backend/base.py`; `models.py`,
    `database.py`, and `alembic/env.py` now import it from there instead of
    the previous import-order-dependent workaround. `backend`'s flat
    (non-package) import style was deliberately kept as-is —
    `Dockerfile.lambda` copies `backend/`'s contents directly into
    `${LAMBDA_TASK_ROOT}`, so there is no `backend` package at runtime;
    switching to `from backend.x import y` would break the deployed Lambda.
    Making that change would require also restructuring the Docker image
    layout and is out of scope here.
  - **Diff-logic duplication**: investigated rather than blindly merged.
    Traced every frontend call site of `diffUtils.js`/`markdownGenerator.js`
    and found the review's core worry was a false positive — `useSpecEditor.js`
    (unsaved-edit "has changes" flag) and `useSpecDiff.js` (live
    hot-reload drift detection) both diff data the backend has never seen,
    so they can't be replaced by an API call and were left alone (now with
    comments explaining why). The one real duplication — `DiffDrawer.vue`'s
    "copy as markdown" button reformatting a diff client-side that the
    backend had already computed — was fixed: `POST /specs/{id}/compare`
    now always returns `markdown` alongside `diff`, and `DiffDrawer`/
    `useDiffDrawer.js` use that instead of recomputing it.
  - **Postgres superuser role**: added a `fastspec_app` least-privilege
    role (`backend/alembic/versions/b6f1d8c4a9e2_add_fastspec_app_role.py`)
    with `CONNECT`/`USAGE`/`SELECT`/`INSERT`/`UPDATE`/`DELETE` only — no
    `CREATEDB`/`CREATEROLE`/superuser. `backend/database.py` now connects
    as `fastspec_app` at runtime via a new `FASTSPEC_APP_DB_PASSWORD` env
    var; `backend/migrate.py`/`backend/lambda_handler.py` still use the
    admin `postgres` role for `CREATE DATABASE` and `alembic upgrade head`
    (DDL, including creating the app role itself, needs elevated
    privileges). `infra/lib/data-stack.ts` generates a second Secrets
    Manager secret for the new role's password; `infra/lib/lambda-stack.ts`
    wires it through as `SSM_FASTSPEC_APP_DB_PASSWORD`. **Written but not
    applied** — see the updated
    [ADR-0002](../adr/0002-rds-public-access-tradeoff.md) for the exact
    apply order (seed the SSM parameter → run the migration → redeploy
    `LambdaStack`); doing this out of order breaks the app.
  - **`FormEditor.vue` split**: the Paths and Components/schemas tabs
    that the prior pass deliberately left alone (shared mutable state, zero
    test coverage) were split this time — but characterization tests
    (140 new tests) were written and verified green against the
    *original* code first, specifically so the split could be checked
    against pinned-down behavior rather than trusted on faith.
    `FormEditor.vue` went from 5,311 → 1,691 lines; the extracted state/logic
    now lives in `usePathsEditor.js` (1,049 lines) and
    `useComponentsEditor.js` (324 lines), rendered via new
    `form-editor/PathsTab.vue` and `form-editor/ComponentsTab.vue`
    components.
  - **Verification**: backend 115/115, frontend 188/188, `cdk synth`
    (both `local` and `prod` contexts) and the infra Jest suite (60/60)
    all green.
