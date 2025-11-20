# FastSpec

A modern full-stack application for creating, editing, validating, and managing OpenAPI 3.0 specifications.

## Architecture

- **Backend**: FastAPI with SQLAlchemy ORM
- **Frontend**: Vue.js 3 + PrimeVue UI components
- **Editor**: Monaco Editor (VS Code editor)
- **Preview**: Swagger UI integration
- **Database**: SQLite (default)

## Features

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

1. **Clone the repository:**

   ```bash
   git clone https://github.com/DishWatcher/FastSpec.git
   cd FastSpec
   ```

2. **Start both servers:**

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

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

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
│   │   │   └── SaveDialog.vue
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

### Specifications

- `GET /api/specs` - List all specifications
- `GET /api/specs/{id}` - Get specific specification
- `POST /api/specs` - Create new specification
- `PUT /api/specs/{id}` - Update specification
- `DELETE /api/specs/{id}` - Delete specification

### Validation & Diff

- `POST /api/validate` - Validate OpenAPI spec
- `GET /api/specs/{id}/diff?format=json|markdown` - Get version diff

### Documentation

- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation (ReDoc)

## Environment Variables

Create a `.env` file (see `.env.example`):

```env
DATABASE_URL=sqlite:///./fastspec.db
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

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

## License

See LICENSE file for details.

## Contributing

Pull requests welcome! Please ensure code follows project conventions.
