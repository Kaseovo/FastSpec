# FastSpec

A modern full-stack application for creating, editing, validating, and managing OpenAPI 3.0 specifications with OAuth2 authentication.

## Architecture

- **Backend**: FastAPI with SQLAlchemy ORM
- **Frontend**: Vue.js 3 + PrimeVue UI components
- **Authentication**: OAuth2 (Google & GitHub) with JWT tokens
- **Editor**: Monaco Editor (VS Code editor)
- **Preview**: Swagger UI integration
- **Database**: SQLite (default)

## Features

- 🔐 **Authentication** - OAuth2 login with Google and GitHub
- 👤 **Private Specs** - Each user's specifications are private
- 📝 **JSON Editor** - Monaco Editor with syntax highlighting
- 👁️ **Live Preview** - Real-time Swagger UI rendering
- ✅ **Validation** - OpenAPI 3.0 spec validation
- 💾 **Version Control** - Track changes between versions
- 📊 **Diff Viewer** - Compare specification versions
- 🎨 **Modern UI** - Beautiful PrimeVue components

## Quick Start

### Prerequisites

- **Python 3.11+** with pip
- **Node.js 18+** with npm

### Development Setup

> **⚠️ Authentication Required**: FastSpec now requires OAuth2 authentication. See [`AUTHENTICATION_SETUP.md`](AUTHENTICATION_SETUP.md:1) for quick setup.

1. **Clone the repository:**

   ```bash
   git clone https://github.com/DishWatcher/FastSpec.git
   cd FastSpec
   ```

2. **Set up authentication** (Required - 5 minutes):

   Follow the [Authentication Setup Guide](AUTHENTICATION_SETUP.md) to:
   - Get OAuth credentials from Google and GitHub
   - Configure environment variables
   - Run database migration

3. **Start both servers:**

   ```bash
   chmod +x start-dev.sh
   ./start-dev.sh
   ```

   This will:
   - Create a Python virtual environment
   - Install backend dependencies
   - Install frontend dependencies
   - Start FastAPI backend on port 8000
   - Start Vue.js frontend on port 3000

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

5. **Sign in:**
   - Click "Continue with Google" or "Continue with GitHub"
   - Complete OAuth flow
   - Start creating specs!

### Alternative: Start Servers Separately

**Backend only:**

```bash
chmod +x start-backend.sh
./start-backend.sh
```

**Frontend only:**

```bash
chmod +x start-frontend.sh
./start-frontend.sh
```

### Manual Setup

**Backend:**

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn backend.main:app --reload --port 8000
```

**Frontend:**

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

## Project Structure

```
FastSpec/
├── backend/                  # FastAPI backend
│   ├── main.py              # FastAPI application
│   ├── database.py          # Database configuration
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   └── routers/             # API route handlers
│       └── specs.py         # OpenAPI spec endpoints
├── frontend/                # Vue.js frontend
│   ├── src/
│   │   ├── App.vue          # Main application component
│   │   ├── main.js          # Application entry point
│   │   ├── components/      # Vue components
│   │   │   ├── Toolbar.vue
│   │   │   ├── SpecList.vue
│   │   │   ├── EditorPanel.vue
│   │   │   ├── PreviewPanel.vue
│   │   │   │   └── SaveDialog.vue
│   │   └── api/             # API client
│   │       └── specs.js
│   ├── package.json         # Frontend dependencies
│   └── vite.config.js       # Vite configuration
├── validator.py             # OpenAPI validation logic
├── diff_utils.py            # Spec comparison utilities
├── requirements.txt         # Python dependencies
└── fastspec.db             # SQLite database

Legacy Django files (can be removed):
├── fastspec/               # Old Django project
├── specs/                  # Old Django app
└── manage.py              # Old Django management
```

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

Create a `.env` file (see `.env.example` or [`AUTHENTICATION_SETUP.md`](AUTHENTICATION_SETUP.md:1)):

```env
# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=43200

# OAuth2 - Google
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# OAuth2 - GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/callback

# Application
DATABASE_URL=sqlite:///./fastspec.db
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
```

**Required for authentication** - See setup guide for obtaining OAuth credentials.

## Production Deployment

### Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Run with Gunicorn
gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend

```bash
cd frontend

# Build for production
npm run build

# Serve the dist/ directory with a web server
# (e.g., nginx, Apache, or a static hosting service)
```

## Development

### Local development with Docker Compose

Two Docker Compose files are provided:

- [`docker-compose.yml`](docker-compose.yml:1) — base composition for running the backend, frontend, and database in a production-like configuration.
- [`docker-compose.dev.yml`](docker-compose.dev.yml:1) — development overrides: mounts local source code into containers, enables hot-reload for backend/frontend, and sets development environment variables (including DEBUG).

To start the application for local development (build images and apply dev overrides):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

This command combines the base compose file with the development overrides so containers use local source and run in watch/reload mode.

### DEBUG mode

Set the environment variable `DEBUG=true` (in your `.env` or via the dev compose file) to enable development behavior:

- Backend: runs with auto-reload (uvicorn --reload) and more verbose logging.
- Frontend: runs the Vite dev server with hot-module replacement.

The `docker-compose.dev.yml` file already configures the containers for DEBUG-friendly development; override or unset DEBUG for production-like runs.

### Backend Development

- **FastAPI** with automatic OpenAPI documentation
- **SQLAlchemy** ORM for database operations
- **Pydantic** for data validation
- **openapi-spec-validator** for OpenAPI validation

### Frontend Development

- **Vue 3** Composition API
- **PrimeVue** UI component library
- **Monaco Editor** for code editing
- **Swagger UI** for API preview
- **Axios** for HTTP requests
- **Vite** for fast builds

### Code Style

Backend follows PEP 8. Frontend uses Vue 3 style guide.

## Database

Default: SQLite (`fastspec.db`)

To use PostgreSQL:

```env
DATABASE_URL=postgresql://user:password@localhost/fastspec
```

## Testing

```bash
# Backend tests (when added)
pytest

# Frontend tests (when added)
cd frontend && npm test
```

## Troubleshooting

### Port Already in Use

Change ports in `.env` or start scripts:

Backend:

```bash
uvicorn backend.main:app --reload --port 8001
```

Frontend:

```bash
cd frontend && npm run dev -- --port 3001
```

### Database Issues

Delete and recreate:

```bash
rm fastspec.db
# Database will be recreated on next backend start
```

### Frontend Build Issues

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Migration from Django

This project was migrated from Django to FastAPI + Vue.js. The old Django code is in:

- `fastspec/` (Django settings)
- `specs/` (Django app)
- `manage.py` (Django CLI)

These can be safely removed once migration is confirmed working.

## Developer Documentation

Detailed project documentation is available under the `docs/` directory. See the following files for scoped, implementation-focused documentation:

- [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md:1) — high-level overview and quick start
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md:1) — data flow, components, and deployment notes
- [`docs/API.md`](docs/API.md:1) — endpoint reference and request/response shapes
- [`docs/FRONTEND.md`](docs/FRONTEND.md:1) — frontend structure and development notes
- [`docs/BACKEND.md`](docs/BACKEND.md:1) — backend routes, auth, validation, and database
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md:1) — docker-compose and local setup instructions
- [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md:1) — detailed authentication setup and security guidance

These files provide implementation details, setup steps, and architectural context for contributors.

## Authentication Documentation

- **Quick Start**: [`AUTHENTICATION_SETUP.md`](AUTHENTICATION_SETUP.md:1) - 5-minute setup guide
- **Full Documentation**: [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md:1) - Complete authentication guide
- **Security**: See authentication docs for production best practices

## License

See LICENSE file for details.

## Contributing

Pull requests welcome! Please ensure code follows project conventions.

## Need Help?

1. Check [`AUTHENTICATION_SETUP.md`](AUTHENTICATION_SETUP.md:1) for quick setup
2. Review [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md:1) for detailed info
3. Check API documentation at http://localhost:8000/docs
4. Open an issue on GitHub
