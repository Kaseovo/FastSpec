# 🔥 FastSpec — Code Roasting & Improvement Plan

> A frank, prioritized critique of the FastSpec codebase with actionable improvements organized into Quick Wins, Targeted Refactors, and Architectural Moves. Each item is labeled **High / Medium / Low** priority.

---

## 📐 Architecture Overview (For Context)

```
FastSpec/
├── backend/         FastAPI + SQLAlchemy + OAuth2 + JWT + Redis
│   ├── main.py      App bootstrap, middleware, debug endpoints
│   ├── database.py  SQLAlchemy engine + session factory
│   ├── models.py    ORM models (User, OpenAPISpec, SpecVersion, AuthToken, APIKey)
│   ├── schemas.py   Pydantic request/response schemas
│   ├── routers/     HTTP route handlers (specs, auth)
│   ├── auth/        JWT, OAuth, Redis-based auth helpers
│   ├── validation/  OpenAPI spec validation
│   └── fastmcp_server/  MCP server integration
└── frontend/        Vue 3 + PrimeVue + Monaco Editor + Axios
    ├── src/App.vue      God component (state, save, diff, auth, dialogs)
    ├── src/stores/      Manual composable store (no Pinia)
    ├── src/api/         Axios API clients
    ├── src/components/  UI components
    └── src/utils/       Diff + Markdown utilities
```

---

## 🚀 Quick Wins
> Small, low-risk improvements that can be done immediately with high impact.

### 🔴 HIGH Priority

#### QW-1 — [`backend/main.py`](backend/main.py:82): Remove/gate debug endpoints in production
The `/debug/openapi` and custom `/openapi.json` endpoints are wide open and expose internal info.
```python
# PROBLEM: publicly accessible debug route
@app.get("/debug/openapi")
async def debug_openapi():
    ...

# FIX: Add a guard
import os
if os.getenv("DEBUG", "false").lower() == "true":
    @app.get("/debug/openapi")
    async def debug_openapi():
        ...
```
**Risk if ignored:** Information leakage in production.

---

#### QW-2 — [`backend/main.py`](backend/main.py:14): Dead/confusing env variable read
```python
# PROBLEM: reads env var into a throwaway variable — this does nothing useful
_ = int(os.getenv("SHORT_LIVED_JWT_EXP_SECONDS", "30000"))
```
This has zero effect on anything. The actual `SHORT_JWT_TTL_SECONDS` is read in [`backend/auth/jwt.py`](backend/auth/jwt.py:28). Remove the dead line.

---

#### QW-3 — [`backend/main.py`](backend/main.py:38): Hardcoded weak JWT fallback secret
```python
# PROBLEM: fallback to weak secret — silence is never good here
secret_key=os.getenv("JWT_SECRET_KEY", "your-super-secret-jwt-key-change-in-production")
```
If the env var is missing, the app silently starts with a known insecure key. **Fail loudly** at startup instead:
```python
secret_key = os.environ["JWT_SECRET_KEY"]  # raises KeyError on missing
```

---

#### QW-4 — [`backend/auth/jwt.py`](backend/auth/jwt.py:21): Duplicated JWT key resolution
The signing key is resolved again in `jwt.py` independently from `main.py`. This creates two places where a misconfiguration can occur silently.

---

#### QW-5 — [`frontend/src/api/specs.js`](frontend/src/api/specs.js:1): `updateSpecVersion` declared before imports
The first 5 lines of `specs.js` define `updateSpecVersion` *before* the `import` statements and before the `api` Axios instance is created. This works only because of ES module hoisting quirks but is confusing and fragile.
```js
// PROBLEM: function referencing `api` defined before `api` exists
export const updateSpecVersion = async (specId, versionId, payload) => {
  const response = await api.put(...);  // `api` not yet defined here!
};
import axios from "axios";
...
const api = axios.create(...);
```
Move all functions to AFTER the imports and `api` instance creation.

---

#### QW-6 — [`frontend/src/stores/auth.js`](frontend/src/stores/auth.js:9): Module-level reactive state is a global singleton antipattern
State declared at module scope (`ref(null)`) means **all app instances share the same state**. This breaks SSR, testing, and multi-tab isolation.
```js
// PROBLEM: global module-level state
const user = ref(null);
const token = ref(null);
```
Migrate to [Pinia](https://pinia.vuejs.org/) which handles this correctly.

---

#### QW-7 — [`backend/database.py`](backend/database.py:24): Wildcard import from models
```python
from models import *  # noqa: F401,F403
```
This suppresses linting errors for a reason — it's a code smell. Be explicit:
```python
from models import User, OpenAPISpec, SpecVersion, AuthToken, APIKey
```

---

#### QW-8 — [`backend/database.py`](backend/database.py:38): Tables are created twice
`Base.metadata.create_all(bind=engine)` is called both at module import time in `database.py` **and** inside the `lifespan()` startup event in [`backend/main.py`](backend/main.py:22). Pick one. The `lifespan` approach is the correct FastAPI pattern.

---

### 🟡 MEDIUM Priority

#### QW-9 — [`backend/routers/specs.py`](backend/routers/specs.py:1): `from fastapi import Body` at line 1, before docstring
Module docstring appears after the first import. This is inconsistent Python style and breaks certain doc tools.

---

#### QW-10 — [`frontend/src/components/SpecList.vue`](frontend/src/components/SpecList.vue:240): Dead code — `updateVersionDropdown`, `onVersionChange`, `selectedSpec`, `versionDropdownOptions` are never used
These functions reference undefined variables (`selectedSpec`, `versionDropdownOptions`) and are never called. Delete them.

---

#### QW-11 — [`frontend/src/App.vue`](frontend/src/App.vue:263): Two `onMounted` calls in same `setup()`
```js
onMounted(() => { initAuth(); });   // line 166
onMounted(() => { fetchOpenApiFile(); }); // line 263
```
Merge these into a single `onMounted` block for clarity and predictability.

---

#### QW-12 — [`backend/auth/dependencies.py`](backend/auth/dependencies.py:72): Naive datetime comparison with timezone-unaware datetime
```python
if not token_rec or token_rec.expires_at < datetime.utcnow():
```
`token_rec.expires_at` is stored with `timezone=True` in the model, but `datetime.utcnow()` is timezone-naive. Use `datetime.now(timezone.utc)` instead to avoid subtle bugs.

---

### 🟢 LOW Priority

#### QW-13 — [`README.md`](README.md:144): Project structure diagram is outdated
The diagram still lists `validator.py` and `diff_utils.py` at the root level and references legacy Django files. Update it to match the actual file layout.

---

#### QW-14 — [`backend/requirements.txt`](backend/requirements.txt): Dependency versions should be pinned
Production deployments need pinned versions (`==`) not minimum versions (`>=`) to ensure reproducibility.

---

## 🔧 Targeted Refactors
> Deeper improvements requiring some code surgery, but scoped to single files or modules.

### 🔴 HIGH Priority

#### TR-1 — [`frontend/src/App.vue`](frontend/src/App.vue:1): God component — break it up
`App.vue` is 784 lines and handles: auth state, save logic, spec creation, diff computation, OpenAPI file fetching, alert management, template loading, and view mode switching. This is a classic God Component.

**Extract into composables:**
- `useSpecEditor()` — specContent, parsedSpec, updateFromForm, updatePreview, loadSpec
- `useSpecSave()` — saveSpec, openSaveDialog, saving state
- `useDiff()` — fetchOpenApiFile, openapiFileDiff, formattedOpenapiFileDiff
- `useAlerts()` — showAlert, closeAlert, alert state

**Result:** App.vue template coordination only, <150 lines.

---

#### TR-2 — [`backend/routers/specs.py`](backend/routers/specs.py:1): Route handlers contain too much business logic
Each route handler (e.g. `create_spec`, `update_spec`) does: authorization check → DB query → validation → version management → response serialization. This is all mixed in the router layer.

**Extract a `SpecService` class:**
```python
# backend/services/spec_service.py
class SpecService:
    def __init__(self, db: Session): ...
    def create(self, user: User, data: OpenAPISpecCreate) -> OpenAPISpec: ...
    def update(self, user: User, spec_id: int, data: OpenAPISpecUpdate) -> OpenAPISpec: ...
    def delete(self, user: User, spec_id: int) -> None: ...
```

---

#### TR-3 — [`backend/routers/specs.py`](backend/routers/specs.py:48): Manual dict serialization instead of using Pydantic models
Every endpoint returns a manually built `dict` instead of returning the ORM object and letting Pydantic serialize it:
```python
# PROBLEM: repeated in every handler
return {
    "id": spec.id, "name": spec.name, "title": spec.title,
    "version": spec.version, "spec_json": json.loads(spec.spec_json), ...
}
```
Add `model_config = ConfigDict(from_attributes=True)` in your schemas, return ORM objects directly, and let `response_model` do the work.

---

#### TR-4 — [`backend/models.py`](backend/models.py:67): `spec_json` stored as `Text` instead of `JSON`
`OpenAPISpec.spec_json` is stored as raw `Text` and manually `json.dumps()`/`json.loads()` throughout the codebase. `SpecVersion.content` is correctly `JSON`. Apply the same `JSON` column type to `spec_json` to eliminate all manual serialization.

---

#### TR-5 — [`backend/auth/jwt.py`](backend/auth/jwt.py:177): `find_api_key_by_raw` O(n) linear scan is a security+performance hazard
```python
# PROBLEM: loads ALL active API keys and does full bcrypt hash check on each
candidates = db_session.query(APIKey).filter(
    APIKey.revoked == False, APIKey.expires_at >= now
).all()
for rec in candidates:
    if verify_api_key_raw(raw, rec.token_hash): return rec
```
bcrypt/pbkdf2 is intentionally slow. With many users this is a DoS vector. Consider HMAC-based key prefix lookup (store a non-secret prefix, look up by prefix, then verify hash).

---

#### TR-6 — [`frontend/src/App.vue`](frontend/src/App.vue:404): Dynamic imports inside `saveSpec` on every save
```js
const { createSpecVersion } = await import("./api/specs");
const { updateSpecVersion, listSpecVersions } = await import("./api/specs");
```
Dynamic imports are used for code splitting, not for repeated runtime calls. The module is already imported statically at the top. Remove dynamic imports here and use the static import.

---

### 🟡 MEDIUM Priority

#### TR-7 — [`frontend/src/components/SpecList.vue`](frontend/src/components/SpecList.vue:306): N+1 API calls on spec list load
```js
for (const spec of fetched) {
    await updateSpecVersions(spec);  // 1 API call per spec, sequential!
}
```
If a user has 10 specs, this is 11 API calls (1 list + 10 versions). Add a backend endpoint `GET /specs?include_versions=true` or batch the version fetches with `Promise.all()`.

---

#### TR-8 — [`frontend/src/components/SpecList.vue`](frontend/src/components/SpecList.vue:64): Inline styles in template
```html
<div style="margin: 8px 0 0 0; font-size: 13px; color: #6b7280; ...">
```
There are multiple inline style blocks in the template. Move all to `<style scoped>` CSS classes for consistency, maintainability, and design token usage.

---

#### TR-9 — [`backend/auth/dependencies.py`](backend/auth/dependencies.py:36): Silent Redis failure hides misconfiguration
```python
try:
    cached_user_id = redis_client.get(key)
except Exception:
    cached_user_id = None
```
When Redis is misconfigured or down, this silently falls back. At minimum, log a warning so operators know Redis is not working.

---

#### TR-10 — [`frontend/src/stores/auth.js`](frontend/src/stores/auth.js:31): JWT token stored in `localStorage` — XSS vulnerability
`localStorage` is accessible by any JavaScript on the page. For a security-sensitive app, consider `HttpOnly` cookies for token storage instead.

---

### 🟢 LOW Priority

#### TR-11 — [`backend/validation/validator.py`](backend/validation/validator.py:79): Fragile error message parsing
```python
field=error_msg.split(":")[0] if ":" in error_msg else "spec"
```
Error field extraction relies on string splitting of the validator's error message format, which can change between library versions. Use structured error attributes from `openapi-spec-validator` instead.

---

#### TR-12 — [`backend/routers/specs.py`](backend/routers/specs.py:344): `format` query param shadows Python built-in
```python
format: str = Query("json", regex="^(json|markdown)$"),
```
`format` is a Python built-in. Rename the parameter to `output_format` or `diff_format` to avoid shadowing.

---

## 🏛️ Architectural Moves
> Systemic improvements that require more design work and cross-cutting changes.

### 🔴 HIGH Priority

#### AM-1 — No database migration system (Alembic)
[`backend/database.py`](backend/database.py:38) uses `Base.metadata.create_all()` — this creates tables but **never modifies them**. Adding or changing a column in production requires manual intervention or data loss.

**Action:** Integrate [Alembic](https://alembic.sqlalchemy.org/) for proper schema migrations.

```bash
pip install alembic
alembic init alembic
# Generate migration
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

---

#### AM-2 — No Pinia state management — manual composable pattern is fragile
The `useAuth()` composable in [`frontend/src/stores/auth.js`](frontend/src/stores/auth.js:18) uses module-scope refs as a DIY global store. This causes state sharing issues between tests, SSR, and future features.

**Action:** Replace with [Pinia](https://pinia.vuejs.org/):
```bash
npm install pinia
```
```js
// src/stores/auth.js
import { defineStore } from 'pinia'
export const useAuthStore = defineStore('auth', { ... })
```

---

#### AM-3 — No Vue Router — single-page state machine in one component
All "views" (form editor, code editor, preview) are toggled via a `viewMode` ref in `App.vue`. As features grow, this becomes unmanageable. `vue-router` is already installed in `package.json` but not used.

**Action:** Set up routes:
- `/` — editor (default)
- `/preview` — spec preview
- `/specs/:id` — spec detail
- `/auth/callback` — OAuth callback (already a component)

---

#### AM-4 — SQLite in production without connection pooling
[`backend/database.py`](backend/database.py:12) uses SQLite with `check_same_thread: False`. While Docker support exists for PostgreSQL, the default is SQLite which doesn't support concurrent writes well.

**Action:** 
1. Default `DATABASE_URL` should use PostgreSQL in any production/Docker config.
2. Add `pool_size`, `max_overflow`, and `pool_pre_ping=True` to the `create_engine` call for PostgreSQL.

---

### 🟡 MEDIUM Priority

#### AM-5 — No CI/CD pipeline with automated tests
The `.github/` directory exists but no workflow files are visible. There's no automated test runner on PRs.

**Action:** Add `.github/workflows/ci.yml`:
```yaml
jobs:
  backend-tests:
    steps:
      - run: pytest backend/tests/ -v --cov=backend
  frontend-tests:
    steps:
      - run: cd frontend && npm test
  lint:
    steps:
      - run: cd backend && ruff check .
      - run: cd frontend && npx eslint src/
```

---

#### AM-6 — Test coverage is critically thin
Backend: only 2 test cases in [`backend/tests/test_specs_api.py`](backend/tests/test_specs_api.py:1) covering version conflict scenarios. Auth, validation, and all other routes are untested.  
Frontend: 4 spec files for components but no tests for stores, API layer, or composables.

**Missing test scenarios:**
- Auth flow (JWT creation, expiry, revocation)
- OAuth callback handling
- API key creation and exchange
- Frontend store (`useAuth`) transitions
- Error boundary behavior in frontend components

---

#### AM-7 — No error boundary / global error handler in frontend
There is no Vue `errorCaptured` or global error handler set up. Unhandled promise rejections in components will silently fail or show raw JS errors to users.

**Action:**
```js
// main.js
app.config.errorHandler = (err, instance, info) => {
  console.error('Global error:', err, info)
  // report to error tracking service
}
```

---

#### AM-8 — OpenAPI spec stored as JSON blob, no field-level indexing
Specs are stored as JSON text/blob with no ability to query by path, title, or operation. A future "search" feature would require full table scans.

**Action:** Extract `title` and `version` into indexed columns (partially done) and consider full-text search if needed.

---

### 🟢 LOW Priority

#### AM-9 — No rate limiting on auth or validation endpoints
`POST /validate` and auth endpoints have no rate limiting. An attacker can spam validation or brute-force token exchange endpoints.

**Action:** Add `slowapi` or a reverse-proxy-level rate limiter.

---

#### AM-10 — No structured logging or observability
[`backend/main.py`](backend/main.py:67) uses `logging.info(f"OpenAPI spec keys: ...")` ad-hoc. There's no structured log format (JSON), no correlation IDs, and no integration with observability tools.

**Action:** Configure structured logging with `structlog` or `python-json-logger` and add request ID middleware.

---

#### AM-11 — Legacy Django files still in repo
Per the [`README.md`](README.md:340):
> `fastspec/`, `specs/`, `manage.py` — These can be safely removed once migration is confirmed working.

Confirmed working. Remove them. Dead code in a repo erodes confidence and confuses new contributors.

---

## 🏆 Priority Summary

| ID | Area | Category | Priority |
|----|------|----------|----------|
| QW-3 | Hardcoded weak JWT secret fallback | Quick Win | 🔴 HIGH |
| QW-1 | Debug endpoints open in production | Quick Win | 🔴 HIGH |
| QW-5 | `updateSpecVersion` declared before imports | Quick Win | 🔴 HIGH |
| QW-6 | Global singleton reactive state antipattern | Quick Win | 🔴 HIGH |
| TR-1 | God component `App.vue` — extract composables | Refactor | 🔴 HIGH |
| TR-2 | Business logic mixed into route handlers | Refactor | 🔴 HIGH |
| TR-3 | Manual dict serialization instead of Pydantic | Refactor | 🔴 HIGH |
| TR-4 | `spec_json` stored as Text not JSON column | Refactor | 🔴 HIGH |
| TR-5 | O(n) API key linear scan — DoS risk | Refactor | 🔴 HIGH |
| AM-1 | No database migration system (Alembic) | Architecture | 🔴 HIGH |
| AM-2 | No Pinia — DIY store is fragile | Architecture | 🔴 HIGH |
| AM-3 | No Vue Router — viewMode toggle antipattern | Architecture | 🔴 HIGH |
| QW-8 | Tables created twice (lifespan + module level) | Quick Win | 🟡 MEDIUM |
| QW-12 | Timezone-naive datetime comparison | Quick Win | 🟡 MEDIUM |
| TR-6 | Dynamic imports inside `saveSpec` | Refactor | 🟡 MEDIUM |
| TR-7 | N+1 API calls on spec list load | Refactor | 🟡 MEDIUM |
| TR-10 | JWT in `localStorage` — XSS risk | Refactor | 🟡 MEDIUM |
| AM-5 | No CI/CD pipeline | Architecture | 🟡 MEDIUM |
| AM-6 | Critically thin test coverage | Architecture | 🟡 MEDIUM |
| AM-7 | No global error handler in frontend | Architecture | 🟡 MEDIUM |
| QW-2 | Dead env var read in `main.py` | Quick Win | 🟢 LOW |
| QW-7 | Wildcard import from models | Quick Win | 🟢 LOW |
| QW-10 | Dead code in `SpecList.vue` | Quick Win | 🟢 LOW |
| QW-11 | Two `onMounted` in same `setup()` | Quick Win | 🟢 LOW |
| QW-13 | Outdated README project structure | Quick Win | 🟢 LOW |
| TR-8 | Inline styles in template | Refactor | 🟢 LOW |
| TR-11 | Fragile validation error parsing | Refactor | 🟢 LOW |
| TR-12 | `format` shadows Python built-in | Refactor | 🟢 LOW |
| AM-9 | No rate limiting | Architecture | 🟢 LOW |
| AM-10 | No structured logging | Architecture | 🟢 LOW |
| AM-11 | Legacy Django files still in repo | Architecture | 🟢 LOW |
