# FastSpec — Backend Guide

> **Purpose:** This skill teaches an AI agent exactly how the FastSpec backend works — its structure, patterns, and conventions — so it can implement new features or fix bugs safely.

---

## Architecture Summary

| Aspect | Details |
|--------|---------|
| Framework | FastAPI (Python 3.10+) |
| ORM | SQLAlchemy (declarative base) |
| Database | SQLite (dev default) / PostgreSQL (prod) |
| Auth | OAuth2 (Google, GitHub via Authlib) + JWT (python-jose) + API Keys (passlib pbkdf2) |
| Cache | Redis (for short JWT session cache) |
| Validation | openapi-spec-validator |
| MCP | FastMCP server on port 9000 |
| Entry point | `backend/main.py` |

---

## File Map

```
backend/
├── main.py                  # FastAPI app creation, middleware, lifespan, health check
├── database.py              # Engine, SessionLocal, Base, get_db dependency
├── models.py                # ORM: User, OpenAPISpec, SpecVersion, AuthToken, APIKey
├── schemas.py               # Pydantic: request/response models
├── requirements.txt         # Python dependencies
├── Dockerfile               # Backend container
├── Dockerfile-MCP           # MCP server container
│
├── routers/
│   ├── __init__.py
│   ├── specs.py             # /specs/* CRUD + versioning + diff + validate
│   └── auth.py              # /auth/* OAuth flows + JWT + API keys
│
├── auth/
│   ├── __init__.py
│   ├── jwt.py               # create_access_token, verify_token, API key helpers, short JWT
│   ├── oauth.py             # Authlib OAuth registry (Google, GitHub)
│   ├── dependencies.py      # get_current_user FastAPI dependency
│   └── redis_client.py      # Redis singleton
│
├── validation/
│   ├── __init__.py
│   ├── validator.py          # validate_openapi_spec() → (is_valid, errors, warnings)
│   └── diff_utils.py         # compare_specs(), generate_markdown_report()
│
├── fastmcp_server/
│   ├── __init__.py
│   ├── server.py             # FastMCP tools: greet, who_am_i, get_saved_specs, get_spec_details
│   ├── middleware.py          # LoggingMiddleware, AuthenticationMiddleware
│   └── authentication.py     # get_current_user for MCP (short JWT)
│
└── tests/
    └── test_specs_api.py     # 2 test cases for version conflict scenarios
```

---

## App Bootstrap — `main.py`

```python
# Lifespan creates DB tables on startup
@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="FastSpec API", version="2.0.0", lifespan=lifespan)

# Middleware stack (order matters):
# 1. SessionMiddleware (required by Authlib for OAuth state)
# 2. CORSMiddleware (CORS_ORIGINS from env)

# Routers:
# /auth/* → auth.router
# /specs/* → specs.router (note: frontend proxies /api/specs → /specs)
```

**⚠️ Important**: The frontend proxy strip `/api` prefix. Frontend calls `/api/specs/...` which Vite proxies to `backend:8000/specs/...`. The backend router is mounted at `/specs`.

Actually — looking at the code more carefully:
- `app.include_router(specs.router, prefix="/specs")` 
- Frontend Axios `baseURL: "/api/specs"`
- Vite proxy: `/api` → `http://backend:8000`
- So frontend `/api/specs/...` → backend `/api/specs/...`

Wait — the Vite proxy target is `http://backend:8000` with no rewrite. So `/api/specs/...` stays as-is. But the backend mounts specs at `/specs`, not `/api/specs`. This means there's likely a Docker/Traefik routing layer that handles this.

Looking at `docker-compose.yml`:
```yaml
labels:
  - "traefik.http.routers.backend.rule=PathPrefix(`/api`) || PathPrefix(`/auth`)"
```

So Traefik routes `/api/*` and `/auth/*` to backend:8000. The backend must handle `/api/specs/*` — but the router is at `/specs`. This suggests the frontend Vite proxy in dev mode differs from production Traefik routing. In dev, the proxy sends `/api/specs/` to the backend which doesn't have that path... unless there's a `ROOT_PATH` or additional path handling.

**Resolution**: The `ROOT_PATH` env var in `FastAPI(root_path=os.getenv("ROOT_PATH", ""))` is likely unused in dev. In the Docker setup the Traefik label passes `/api` prefix to the backend. The specs router prefix is `/specs` so the full path in production is `/api` (via Traefik) but wait — Traefik just routes, it doesn't strip by default unless configured. Looking at the labels, there's no strip-prefix middleware for the backend.

**Practical implication**: The Vite proxy in dev works because `/api` → `http://backend:8000` maps to `/api/specs/` → `http://backend:8000/api/specs/...`. But `specs.router` is mounted at prefix `/specs`. So the actual backend path would be `/specs/...`. There appears to be a mismatch unless another middleware handles this. The most likely resolution: in development, the backend URL receives `/api/specs/...` but the router is at `/specs`.

**For agents**: Check that new endpoints follow the existing pattern. The frontend always calls `/api/specs/...` via Axios.

---

## Database Layer — `database.py`

```python
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:////app/data/fastspec.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite"...)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Tables are created TWICE:
# 1. At module import time: Base.metadata.create_all(bind=engine)   ← line 38
# 2. In lifespan startup: Base.metadata.create_all(bind=engine)     ← main.py line 22
```

**Dependency**:
```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Used as `db: Session = Depends(get_db)` in every route handler.

---

## ORM Models — `models.py`

### `User`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `email` | String(255) | Indexed, not unique alone |
| `name` | String(255) | Nullable |
| `avatar_url` | String(512) | Nullable |
| `provider` | String(50) | `'google'` or `'github'` |
| `provider_user_id` | String(255) | OAuth provider's user ID |
| `session_version` | Integer | Default 0 |
| `created_at` / `updated_at` | DateTime(tz) | Auto-managed |

Unique constraint: `(email, provider)` — same email can exist with different providers.

Relationships: `specs`, `auth_tokens`, `api_keys` (all cascade delete-orphan)

### `OpenAPISpec`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `name` | String(255) | Indexed, user-given name |
| `title` | String(255) | Extracted from `spec_json.info.title` |
| `version` | String(50) | Extracted from `spec_json.info.version` |
| `spec_json` | **Text** | ⚠️ JSON stored as string, manually `json.dumps()`/`json.loads()` |
| `previous_spec_json` | Text | Nullable, for diff comparison |
| `user_id` | Integer FK → users.id | Indexed |
| `created_at` / `updated_at` | DateTime(tz) | Auto-managed |

Relationships: `owner` (User), `versions` (SpecVersion, ordered by created_at desc)

### `SpecVersion`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) PK | UUID4 |
| `spec_id` | Integer FK → openapi_specs.id | Indexed |
| `version` | String(50) | Semver string like "1.0.0" |
| `content` | **JSON** | ✅ Proper JSON column |
| `created_by` | Integer FK → users.id | Nullable |
| `meta` | JSON | Nullable metadata |
| `is_published` | Boolean | Default false |
| `created_at` | DateTime(tz) | Auto-managed |

Unique constraint: `(spec_id, version)` — no duplicate version strings per spec.

### `AuthToken`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) PK | UUID4 |
| `jti` | String(64) | JWT ID, unique, indexed |
| `user_id` | Integer FK → users.id | |
| `token` | Text | Full JWT string |
| `expires_at` | DateTime(tz) | |
| `revoked` | Boolean | Default false |

### `APIKey`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) PK | UUID4 |
| `token_hash` | String(255) | pbkdf2_sha256 hash |
| `user_id` | Integer FK → users.id | |
| `actions` | Text | JSON array stored as string, e.g. `'["A","B"]'` |
| `expires_at` | DateTime(tz) | |
| `revoked` | Boolean | Default false |
| `last_used_at` | DateTime(tz) | Nullable |

---

## Pydantic Schemas — `schemas.py`

| Schema | Purpose |
|--------|---------|
| `ValidationError` | `{field, message}` |
| `ValidationResponse` | `{valid, errors[], warnings[]}` |
| `UserBase` / `UserResponse` | User data (with `from_attributes = True`) |
| `Token` | `{access_token, token_type, user}` |
| `TokenData` | JWT payload decode |
| `ApiKeyActionsUpdateRequest` | `{actions: string[]}` |
| `ApiKeyActionsResponse` | `{message, actions}` |
| `OpenAPISpecBase` / `OpenAPISpecCreate` | `{name, spec_json}` with dict validator |
| `OpenAPISpecUpdate` | `{version (required), name?, spec_json?}` |
| `OpenAPISpecResponse` | Full spec with id, timestamps |
| `DiffResponse` / `MarkdownDiffResponse` | Diff results |
| `SpecVersionCreate` | `{version, content, meta?}` |
| `SpecVersionResponse` | Full version with id, timestamps |

---

## Router Patterns

### Specs Router — `routers/specs.py`

Mounted at `/specs` prefix.

**Pattern for every handler:**
1. `current_user: User = Depends(get_current_user)` — auth required
2. `db: Session = Depends(get_db)` — DB session
3. Query filters always include `user_id == current_user.id` (data isolation)
4. Response is a manually built `dict` (not ORM model directly)

Helper functions:
- `_resolve_spec_or_404(db, spec_id, user)` — get spec or raise 404
- `_serialize_version(version)` — convert SpecVersion to dict
- `_resolve_version(db, spec_id, version_or_id)` — lookup by UUID or version string
- `_check_can_modify_version(user, spec, version)` — permission check

### Auth Router — `routers/auth.py`

Mounted at `/auth` prefix.

OAuth flow:
1. `GET /auth/google` → redirect to Google consent
2. `GET /auth/google/callback` → exchange code, upsert user, create JWT, redirect to frontend
3. Same for GitHub

Token management:
- `POST /auth/refresh` — create API key
- `GET /auth/refresh` — list API keys
- `DELETE /auth/refresh/{id}` — revoke by ID
- `PUT /auth/refresh/{id}/actions` — update allowed actions
- `POST /auth/refresh/exchange` — API key → short JWT
- `POST /auth/refresh/revoke` — revoke by raw key value

---

## Validation — `validation/validator.py`

```python
def validate_openapi_spec(spec_json: dict) -> tuple[bool, list[ValidationError], list[str]]:
```

1. Basic structure checks (is dict, has `openapi`, `info`, `paths`)
2. Required field checks (`info.title`, `info.version`)
3. Warning for missing `servers`
4. Full validation via `openapi_spec_validator.validate()`

---

## Diff Utils — `validation/diff_utils.py`

```python
def compare_specs(current_spec, previous_spec) -> dict:
```

Returns: `{added, removed, modified, infoAdded, infoModified, infoRemoved, serverAdded, serverRemoved, serverModified, schemaAdded, schemaModified, schemaRemoved, has_changes}`

Note: This is a **backend** diff utility. The frontend has its own parallel implementation in `utils/diffUtils.js`.

---

## MCP Server — `fastmcp_server/server.py`

Runs on port 9000, accessible via Traefik at `/mcp`.

**Tools:**
| Tool | Auth Required | Description |
|------|---------------|-------------|
| `greet()` | No | Returns "Hello !" |
| `who_am_i(user)` | Yes (actions: A, B) | Returns user info from short JWT |
| `get_saved_specs_for_user(user)` | Yes (actions: A, B) | Lists user's specs |
| `get_spec_details(spec_id, user)` | Yes (actions: A, B) | Returns spec with full content |

Auth: Uses `AuthenticationMiddleware` that verifies short JWTs (obtained by exchanging API keys).

**⚠️ Issue:** MCP tools create their own `SessionLocal()` DB sessions instead of using dependency injection.

---

## How to Add a New Feature

### Adding a new API endpoint
1. Add the route handler in `routers/specs.py` or `routers/auth.py`
2. Use the pattern: `Depends(get_current_user)`, `Depends(get_db)`, filter by `user_id`
3. Add Pydantic request/response schemas in `schemas.py` if needed
4. Return a manually built dict (current pattern) or proper Pydantic model

### Adding a new MCP tool
1. Add in `fastmcp_server/server.py`
2. Decorate with `@mcp.tool(tags={"authentication"}, meta={"actions": ["A", "B"]})`
3. Use `user: TokenPayload = Depends(get_current_user)` for auth
4. Create/close `SessionLocal()` manually for DB access

### Adding a new model
1. Add SQLAlchemy model in `models.py`
2. Add Pydantic schema in `schemas.py`
3. **⚠️ No Alembic** — tables are created via `create_all()` which only creates new tables, never alters existing ones. Schema changes require manual DB intervention or a migration setup.

### Adding a new OAuth provider
1. Register in `auth/oauth.py` using Authlib
2. Add `GET /auth/{provider}` and `GET /auth/{provider}/callback` routes in `routers/auth.py`
3. Add user info extraction function

---

## Known Technical Debt

- `spec_json` stored as `Text` instead of `JSON` column (requires manual serialization everywhere)
- No Alembic migrations — `create_all()` can only create tables, not modify them
- Route handlers contain business logic (no service layer)
- Manual dict serialization instead of returning ORM objects with Pydantic `from_attributes`
- Hardcoded weak JWT fallback secret
- `find_api_key_by_raw()` does O(n) scan with bcrypt verification — DoS risk at scale
- Debug endpoints (`/debug/openapi`) exposed in all environments
- Tables created twice (module import + lifespan)
- Dead env var read in `main.py` line 15
- `format` parameter shadows Python built-in in diff endpoint

See [`plans/code_roast_plan.md`](plans/code_roast_plan.md) for the full improvement plan.
