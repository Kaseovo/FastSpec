# FastSpec

A full-stack application for creating, editing, validating, and managing OpenAPI 3.0 specifications with OAuth2 authentication.

## Architecture

- **Backend**: FastAPI + SQLAlchemy ORM, running on ECS Fargate
- **Frontend**: Vue.js 3 + PrimeVue, served via S3/CloudFront (prod) or Vite dev server (local)
- **Landing page**: Static nginx container served at `/`
- **Authentication**: OAuth2 (Google & GitHub) with JWT tokens
- **Editor**: Monaco Editor
- **Preview**: Swagger UI
- **Database**: PostgreSQL (RDS in AWS, emulated via floci locally)
- **Infrastructure**: AWS CDK — `DataStack` (RDS + ElastiCache) and `ComputeStack` (ECS + ALB)

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
   # Fill in OAuth credentials (Google, GitHub) and JWT secret key
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
| 3 | `make infra` | CDK deploys `DataStack` (Postgres + Redis) and `ComputeStack` (ECS + ALB) against floci |
| 4 | `make migrate` | Runs the database migration ECS task inside floci |
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
# Start Postgres and Redis locally (without floci)
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
make db        # Start Postgres + Redis (for make backend)
make secrets   # Seed .env into floci SSM
make infra     # CDK deploy all stacks against floci
make migrate   # Run database migrations in floci
make landing   # Build and run landing page on port 3000
make backend   # Start FastAPI dev server (requires make db first)
make frontend  # Start Vite dev server
make logs      # Tail backend ECS container logs from floci
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
├── backend/                  # FastAPI backend
│   ├── main.py               # FastAPI application entry
│   ├── database.py           # Database configuration
│   ├── models.py             # SQLAlchemy models
│   ├── schemas.py            # Pydantic schemas
│   ├── routers/              # API route handlers
│   │   ├── auth.py
│   │   ├── lint.py
│   │   └── specs.py
│   ├── auth/                 # authentication helpers (jwt, oauth, dependencies)
│   │   ├── __init__.py
│   │   ├── jwt.py
│   │   ├── oauth.py
│   │   └── dependencies.py
│   ├── validation/           # OpenAPI validation and diff utilities
│   │   ├── __init__.py
│   │   ├── validator.py
│   │   └── diff_utils.py
│   └── fastmcp_server/       # MCP server integration
│       ├── __init__.py
│       ├── server.py
│       └── authentication.py
├── frontend/                 # Vue.js frontend
│   ├── src/
│   │   ├── App.vue
│   │   ├── main.js
│   │   ├── components/       # Vue components
│   │   ├── api/              # API client (auth.js, specs.js)
│   │   ├── stores/           # Pinia/Vuex stores (e.g. auth.js)
│   │   └── utils/            # frontend utilities (diffUtils.js, markdownGenerator.js)
│   ├── package.json
│   └── vite.config.js
├── docs/                     # Project documentation
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── ...
```

Notes:

- validator.py and diff_utils.py live under `backend/validation/` (not at repository root).
- Frontend stores live under `frontend/src/stores/` and utilities under `frontend/src/utils/`.
- Authentication helpers are in `backend/auth/` and MCP server code is in `backend/fastmcp_server/`.

## API Endpoints

### Authentication

- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - Handle Google OAuth callback
- `GET /auth/github` - Initiate GitHub OAuth flow
- `GET /auth/github/callback` - Handle GitHub OAuth callback
- `GET /auth/me` - Get current user information (requires JWT)
- `POST /auth/logout` - Logout

### Specifications (All require authentication)

- `GET /api/specs` - List user's specifications
- `GET /api/specs/{id}` - Get specific specification
- `POST /api/specs` - Create new specification
- `PUT /api/specs/{id}` - Update specification
- `DELETE /api/specs/{id}` - Delete specification

### Validation & Diff

- `POST /api/validate` - Validate OpenAPI spec (requires auth)
- `GET /api/specs/{id}/diff?format=json|markdown` - Get version diff (requires auth)

### Documentation

- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation (ReDoc)

## Environment Variables

Create a `.env` file at the repo root (see `.env.example`):

```env
# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=3600

# OAuth2 - Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback

# OAuth2 - GitHub
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=http://localhost:5173/auth/callback

# App
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
```

## License

See LICENSE file for details.

## Contributing

Pull requests welcome! Please ensure code follows project conventions.

## Need Help?

1. Check [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md:1) for quick setup
2. Review [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md:1) for detailed info
3. Check API documentation at http://localhost:8000/docs
4. Open an issue on GitHub
