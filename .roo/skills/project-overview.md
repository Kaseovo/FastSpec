# FastSpec — Project Overview

> **Purpose:** This skill gives an AI agent a complete mental model of the FastSpec project — what it does, how it's structured, and how the pieces connect.

---

## What is FastSpec?

FastSpec is a full-stack web application for **creating, editing, validating, and versioning OpenAPI 3.0 specifications**. Users authenticate via OAuth2 (Google/GitHub), manage their API specs through a visual form editor or raw JSON code editor, and can compare versions to see diffs.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Vue 3 (Composition API) | ^3.4 |
| UI Library | PrimeVue 4 + PrimeIcons | ^4.4.1 |
| Code Editor | Monaco Editor | ^0.45.0 |
| HTTP Client | Axios | ^1.6.0 |
| Build Tool | Vite 5 | ^5.0.0 |
| Backend | FastAPI (Python) | latest |
| ORM | SQLAlchemy | latest |
| Database | SQLite (dev) / PostgreSQL (prod) | — |
| Auth | OAuth2 (Google, GitHub) + JWT + API Keys | — |
| Cache | Redis | 7-alpine |
| Reverse Proxy | Traefik v2.10 | — |
| Containerization | Docker Compose | — |
| MCP Server | FastMCP (Python) | latest |

---

## Project Structure

```
FastSpec/
├── .env.example              # Environment variable template
├── docker-compose.yml        # Production compose (Traefik + backend + frontend + redis + mcp)
├── docker-compose.dev.yml    # Dev overrides
│
├── backend/                  # FastAPI Python application
│   ├── main.py               # App bootstrap, CORS, middleware, health check
│   ├── database.py           # SQLAlchemy engine, session factory, Base
│   ├── models.py             # ORM models: User, OpenAPISpec, SpecVersion, AuthToken, APIKey
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── routers/
│   │   ├── specs.py          # CRUD + versioning + diff endpoints for specs
│   │   └── auth.py           # OAuth callbacks, JWT, API key management, logout
│   ├── auth/
│   │   ├── jwt.py            # JWT creation/verification, API key hashing, short JWT
│   │   ├── oauth.py          # Google + GitHub OAuth configuration (Authlib)
│   │   ├── dependencies.py   # get_current_user FastAPI dependency
│   │   └── redis_client.py   # Redis connection singleton
│   ├── validation/
│   │   ├── validator.py      # OpenAPI spec validation using openapi-spec-validator
│   │   └── diff_utils.py     # Spec comparison: paths, info, servers, schemas
│   ├── fastmcp_server/
│   │   ├── server.py         # MCP tools: greet, who_am_i, get_saved_specs, get_spec_details
│   │   ├── middleware.py      # Logging + auth middleware for MCP
│   │   └── authentication.py # MCP-specific auth (short JWT verification)
│   └── tests/
│       └── test_specs_api.py # Version conflict test cases
│
├── frontend/                 # Vue 3 SPA
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js        # Dev server with proxy to backend:8000, @ alias
│   └── src/
│       ├── main.js           # App bootstrap (PrimeVue, Toast, Tooltip)
│       ├── App.vue           # Main component (784 lines — God component)
│       ├── stores/
│       │   └── auth.js       # Auth composable (module-level refs, not Pinia)
│       ├── api/
│       │   ├── specs.js      # Axios client for /api/specs endpoints
│       │   ├── auth.js       # Auth API calls
│       │   └── specs.test.js # API test file
│       ├── components/
│       │   ├── Toolbar.vue       # Top bar: New, Save, Manage Tokens, UserProfile
│       │   ├── SpecList.vue      # Sidebar: saved specs, version dropdown, history drawer
│       │   ├── EditorPanel.vue   # Monaco JSON editor
│       │   ├── FormEditor.vue    # Visual form editor (3287 lines)
│       │   ├── PreviewPanel.vue  # Spec preview/documentation view
│       │   ├── DiffDrawer.vue    # Diff visualization (3465 lines)
│       │   ├── SaveDialog.vue    # Save/version dialog
│       │   ├── LoginPage.vue     # OAuth login buttons
│       │   ├── OAuthCallback.vue # Handles OAuth redirect with token
│       │   ├── TokenManager.vue  # API key management UI
│       │   └── UserProfile.vue   # Avatar + logout
│       └── utils/
│           ├── diffUtils.js       # Frontend spec comparison
│           └── markdownGenerator.js # Diff → markdown report
│
├── plans/                    # Architecture plans and improvement roadmaps
│   ├── code_roast_plan.md
│   └── frontend_maintainability_plan.md
│
└── docs/                     # Documentation
    ├── PROJECT_OVERVIEW.md
    ├── ARCHITECTURE.md
    ├── FRONTEND.md
    ├── BACKEND.md
    ├── API.md
    ├── AUTHENTICATION.md
    └── DEPLOYMENT.md
```

---

## Data Flow

```
User Browser
  │
  ├── OAuth Login ──► /auth/google or /auth/github
  │                      │
  │                      ▼
  │                   Google/GitHub OAuth
  │                      │
  │                      ▼
  │                   /auth/{provider}/callback
  │                      │
  │                      ├── Upsert User in DB
  │                      ├── Create JWT (persisted as AuthToken)
  │                      └── Redirect to frontend with ?token=...
  │
  ├── Spec Operations ──► /api/specs/* (Authorization: Bearer <JWT>)
  │                           │
  │                           ▼
  │                        get_current_user dependency
  │                           │
  │                           ├── Redis cache check (short JWT)
  │                           ├── JWT decode + verify
  │                           └── AuthToken DB lookup (not revoked, not expired)
  │                           │
  │                           ▼
  │                        Spec CRUD / Version CRUD / Diff / Validate
  │                           │
  │                           ▼
  │                        SQLAlchemy → SQLite/PostgreSQL
  │
  └── MCP Tools ──► :9000/ (via Traefik /mcp prefix strip)
                        │
                        ├── AuthenticationMiddleware (short JWT from API key exchange)
                        └── FastMCP tools: greet, who_am_i, get_saved_specs, get_spec_details
```

---

## Key Concepts

### Spec Versioning
- Each `OpenAPISpec` has multiple `SpecVersion` records
- Versions are identified by UUID `id` or semver `version` string
- One version can be `is_published = True` (the live version)
- `PUT /specs/{id}` enforces optimistic concurrency: client must send the current `version` string

### Authentication Model
- **Long-lived JWT**: Issued at OAuth login, stored as `AuthToken` in DB, ~7 day TTL
- **API Key**: User-created, stored as bcrypt hash in `APIKey` table, 30-day TTL
- **Short JWT**: Obtained by exchanging an API key, 5-minute TTL, cached in Redis
- All three token types go through `get_current_user` dependency

### Frontend State
- Auth state: module-level `ref()` composable in `stores/auth.js` (not Pinia)
- Spec editing state: managed in `App.vue` `setup()` function
- Component communication: `provide/inject` pattern (not props for deep children)
- View switching: `viewMode` ref toggles between `form`, `code`, `preview`

---

## Docker Services

| Service | Port | Role |
|---------|------|------|
| `traefik` | 80, 443 | Reverse proxy, routes `/api` and `/auth` to backend, `/mcp` to MCP, `/` to frontend |
| `backend` | 8000 (internal) | FastAPI app |
| `frontend` | 3000 (internal) | Vite dev server (dev) or Nginx (prod) |
| `redis` | 6379 | Short JWT cache |
| `mcp` | 9000 (internal) | FastMCP server |

---

## Environment Variables

See `.env.example` for the full list. Critical ones:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:////app/data/fastspec.db` |
| `JWT_SECRET_KEY` | JWT signing key | ⚠️ Weak default — must override |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | — |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth | — |
| `FRONTEND_URL` | OAuth redirect base URL | `http://localhost` |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection | `localhost:6379` |
| `SHORT_JWT_TTL_SECONDS` | Short JWT lifetime | `300` |
| `API_KEY_TTL_DAYS` | API key lifetime | `30` |

---

## Agent Guidelines

1. **Never hardcode secrets** — always use environment variables
2. **All API endpoints require auth** except `POST /specs/validate` and `GET /health`
3. **Spec data is user-scoped** — every DB query filters by `user_id`
4. **Frontend communicates via Axios** through Vite proxy (`/api` → `backend:8000`)
5. **Use `provide/inject`** for parent→child communication in the frontend (current pattern)
6. **Spec JSON is stored as `Text`** in `OpenAPISpec.spec_json` (manually serialized) but as `JSON` column in `SpecVersion.content`
