# FastSpec

A full-stack SaaS for creating, editing, versioning, linting (Spectral), and diffing OpenAPI 3.0 specifications, with Google sign-in, user-scoped API keys, and an MCP server so AI agents can read specs.

## Architecture

- **Backend**: FastAPI + SQLAlchemy ORM, packaged as a Docker-image AWS Lambda
  behind a Lambda Function URL (no ECS/Fargate, no ALB). The FastMCP server is
  mounted into the same ASGI app and Lambda.
- **Frontend**: Vue.js 3 + PrimeVue SPA, served via S3 + CloudFront in every
  deployed environment; the Vite dev server is used locally.
- **Landing page**: A separate static S3 + CloudFront origin (Webstudio
  export); served via nginx locally (`make landing`).
- **Authentication**: Google sign-in via a server-side OAuth 2.0
  Authorization Code redirect flow, plus long-lived API keys that exchange
  for short-lived JWTs (GitHub OAuth was removed — see
  `docs/AUTHENTICATION.md`).
- **Editor**: Monaco Editor
- **Preview**: Swagger UI
- **Database**: PostgreSQL only — RDS in AWS (auto-stopped when idle to save
  cost, see the Wake/AutoStop stack below), a local Postgres container via
  `make db`, or emulated through floci locally. There is no Redis anywhere in
  this stack.
- **Infrastructure**: AWS CDK (`infra/`) — `DataStack` (RDS PostgreSQL),
  `LambdaStack` (the backend Docker-image Lambda + Function URL),
  `CertificateStack` + `FrontendStack` (ACM, S3, CloudFront for the SPA and
  landing page), and `WakeStack` (a Function URL + scheduled Lambda that
  start/stop RDS on demand to keep the environment near-zero-cost when
  idle).

## Local Development

Local dev runs against **floci** — a local AWS emulator (free alternative to LocalStack). CDK deploys the same stacks locally as in production.

### Prerequisites

- Docker (with Compose v2)
- Node.js 18+
- Python 3.11+
- AWS CDK CLI: `npm install -g aws-cdk`

### First-time setup

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/DishWatcher/FastSpec.git
   cd FastSpec
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   cd frontend && npm install && cd ..
   cd infra && npm install && cd ..
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env
   # Fill in the Google OAuth credentials and JWT secret key
   ```

### Starting local dev

Run everything with one command:

```bash
make dev
```

This runs the following steps in order:

| Step | Command | What it does |
|------|---------|-------------|
| 1 | `make up` | Starts the floci container (local AWS emulator) on port 4566 |
| 2 | `make secrets` | Seeds `.env` values into floci SSM as SecureString parameters |
| 3 | `make infra` | CDK deploys `DataStack` (RDS PostgreSQL), `LambdaStack` (backend Lambda), `FrontendStack`, and `WakeStack` against floci |
| 4 | `make migrate` | Runs Alembic migrations locally (in prod this runs inside the backend Lambda — see `docs/adr/` and `backend/lambda_handler.py`, no ECS task) |
| 5 | `make landing` | Builds and runs the landing page container on `http://localhost:3000` |
| 6 | `make frontend` | Starts the Vite dev server (hot-reload) — this step is blocking |

Once running:

- **App (editor)**: `http://localhost:5173/specs`
- **Landing page**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **API docs**: `http://localhost:8000/docs`

Unauthenticated users are redirected to the landing page at `http://localhost:3000`.

### Running backend and frontend separately

If you only need to iterate on the backend or frontend without the full floci stack:

```bash
# Start Postgres locally (without floci) — no Redis, there is none in this stack
make db

# Start the FastAPI backend with hot-reload
make backend

# Start the Vite frontend dev server
make frontend
```

### Individual make targets

```bash
make up        # Start floci container
make down      # Stop and remove floci container
make db        # Start Postgres (for make backend) — no Redis
make secrets   # Seed .env into floci SSM
make infra     # CDK deploy all stacks against floci
make migrate   # Run database migrations locally (Alembic)
make landing   # Build and run landing page on port 3000
make backend   # Start FastAPI dev server (requires make db first)
make frontend  # Start Vite dev server
make logs      # Tail backend Lambda logs from floci
make help      # List all available targets
```

## Testing

```bash
# Backend tests
cd backend && python -m pytest tests --tb=short

# Frontend tests
cd frontend && npm test

# Both
cd backend && python -m pytest tests --tb=short && cd ../frontend && npm test
```

## Project Structure

```
FastSpec/
├── backend/                  # FastAPI backend (packaged as a Docker-image Lambda)
│   ├── main.py                # FastAPI application entry (merges the MCP ASGI app)
│   ├── lambda_handler.py       # AWS Lambda entry point (Mangum adapter + SSM secret fetch)
│   ├── database.py            # Database configuration
│   ├── models.py               # SQLAlchemy models
│   ├── schemas.py               # Pydantic schemas
│   ├── routers/                # API route handlers
│   │   ├── auth.py              # mounted at /auth
│   │   ├── lint.py              # mounted at /lint
│   │   └── specs.py             # mounted at /specs
│   ├── auth/                   # authentication helpers (jwt, dependencies)
│   │   ├── __init__.py
│   │   ├── jwt.py
│   │   └── dependencies.py
│   ├── validation/             # OpenAPI validation, Spectral lint client, diff utilities
│   │   ├── __init__.py
│   │   ├── spectral_client.py
│   │   └── diff_utils.py
│   └── fastmcp_server/         # FastMCP server, mounted into the same ASGI app
│       ├── __init__.py
│       ├── server.py
│       ├── middleware.py
│       └── authentication.py
├── frontend/                  # Vue.js SPA (built and synced to S3/CloudFront)
│   ├── src/
│   │   ├── App.vue
│   │   ├── main.js
│   │   ├── components/         # Vue components
│   │   ├── api/                 # API client (auth.js, specs.js)
│   │   ├── stores/               # Pinia stores (e.g. auth.js)
│   │   └── utils/                 # frontend utilities (diffUtils.js, markdownGenerator.js)
│   ├── package.json
│   └── vite.config.js
├── landing-page/               # Webstudio-exported static landing page (separate S3/CloudFront origin)
├── infra/                      # AWS CDK (TypeScript) — DataStack, LambdaStack, CertificateStack,
│   ├── lib/                     # FrontendStack, WakeStack
│   └── lambda/                  # wake/ and auto-stop/ Lambda source (RDS on-demand start/stop)
├── docs/                       # Project documentation, including docs/adr/ (architecture decisions)
├── docker-compose.yml           # Legacy local-dev container stack — see docs/adr/0001 for why
├── docker-compose.dev.yml         # floci (local AWS emulator) is the primary local-dev path now
├── docker-compose.floci.yml
├── .env.example
└── ...
```

Notes:

- There is no `backend/mcp/` directory and no `backend/auth/oauth.py`/`redis_client.py` —
  if you see references to those in older docs, they're stale; the FastMCP
  server lives in `backend/fastmcp_server/` and Google OAuth lives in
  `backend/routers/auth.py` + `backend/auth/jwt.py`.
- Routers are mounted directly under `/auth`, `/specs`, and `/lint` (no `/api`
  prefix) — see `backend/main.py`.
- Frontend stores live under `frontend/src/stores/` and utilities under `frontend/src/utils/`.

## API Endpoints

The authoritative reference is the live OpenAPI docs at `/docs` (Swagger UI)
or `/redoc`. Highlights:

### Authentication (`/auth`)

- `GET /auth/google/login` - Start the server-side Google OAuth redirect flow
- `GET /auth/google/callback` - Google's redirect target; issues a JWT and redirects to the SPA
- `POST /auth/google/verify` - Verify a client-obtained Google ID token (programmatic clients)
- `GET /auth/me` - Get current user information (requires JWT)
- `POST /auth/logout` - Logout
- `GET /auth/api-keys`, `POST /auth/api-keys`, `DELETE /auth/api-keys/{id}` - Manage long-lived API keys
- `POST /auth/api-keys/exchange` - Exchange an API key for a short-lived JWT (used by MCP clients)

See `docs/AUTHENTICATION.md` for the full flow.

### Specifications (`/specs`, all require authentication)

- `GET /specs` - List user's specifications
- `GET /specs/{id}` - Get a specific specification
- `POST /specs` - Create a new specification
- `PUT /specs/{id}` - Update a specification
- `DELETE /specs/{id}` - Delete a specification
- `GET /specs/{id}/versions`, `/specs/{id}/versions/{version_id}` - Version history
- `POST /specs/validate` - Validate an OpenAPI spec
- `GET /specs/{id}/diff`, `POST /specs/{id}/compare` - Version diff / comparison

### Linting (`/lint`)

- Spectral-based OpenAPI linting and custom ruleset management — see `backend/validation/spectral_client.py`.

### Documentation

- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation (ReDoc)

## Environment Variables

Create a `.env` file at the repo root (see `.env.example`, which is the
authoritative list):

```env
# Database (local docker-compose Postgres; RDS in deployed environments)
DATABASE_URL=postgresql://fastspec:fastspec@postgres:5432/fastspec

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# OAuth2 - Google (server-side Authorization Code redirect flow)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# App
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost
```

There is no Redis configuration — the app has no Redis dependency in any
environment.

## License

See LICENSE file for details.

## Contributing

Pull requests welcome! Please ensure code follows project conventions.

## Need Help?

1. Check [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md:1) for quick setup
2. Review [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md:1) for detailed info
3. Check API documentation at http://localhost:8000/docs
4. Open an issue on GitHub
