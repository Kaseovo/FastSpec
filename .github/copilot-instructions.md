# GitHub Copilot Instructions for FastSpec

## Project Overview

FastSpec is a **Django full-stack web application** for creating, editing, validating, and managing OpenAPI 3.0 specifications. It features an integrated web-based editor with Monaco Editor and Swagger UI preview.

## Architecture

- **Framework**: Django 5.0 + Django REST Framework
- **Database**: SQLite with Django ORM
- **Frontend**: Server-side Django templates (no separate frontend framework)
- **UI Components**: Monaco Editor (JSON editing), Swagger UI (API preview)
- **Validation**: openapi-spec-validator library

## Project Structure

```
FastSpec/
├── manage.py              # Django management script
├── requirements.txt       # Python dependencies
├── fastspec/              # Django project configuration
│   ├── settings.py        # Django settings (database, apps, middleware)
│   ├── urls.py            # URL routing (main routes)
│   ├── wsgi.py            # WSGI entry point for production
│   └── asgi.py            # ASGI entry point (async support)
├── specs/                 # Main Django app for OpenAPI specs
│   ├── models.py          # OpenAPISpec model (database schema)
│   ├── views.py           # API views + HTML page rendering
│   ├── serializers.py     # DRF serializers for API
│   ├── admin.py           # Django admin configuration
│   ├── templates/         # HTML templates
│   │   ├── base.html      # Base template with CDN resources
│   │   └── editor.html    # Main editor UI with JavaScript
│   └── migrations/        # Database migrations
├── static/                # Static files (CSS, JS, images)
├── validator.py           # OpenAPI validation logic
├── diff_utils.py          # Spec comparison and diff generation
└── fastspec.db           # SQLite database file
```

## Key Models

### OpenAPISpec (specs/models.py)

- `name`: Unique identifier for the spec
- `title`: API title (extracted from spec)
- `version`: API version (extracted from spec)
- `spec_json`: Full OpenAPI JSON (stored as text)
- `previous_spec_json`: Previous version for comparison
- `created_at`, `updated_at`: Timestamps

## API Endpoints

All endpoints follow REST conventions:

- `GET /` - Home page (editor UI)
- `GET /api/specs` - List all specs (JSON)
- `GET /api/specs/{id}` - Get specific spec (JSON)
- `POST /api/specs` - Create new spec (requires name + spec_json)
- `PUT /api/specs/{id}` - Update spec
- `DELETE /api/specs/{id}` - Delete spec
- `GET /api/specs/{id}/diff` - Get diff between current and previous version
- `POST /api/validate` - Validate OpenAPI spec without saving
- `GET /admin` - Django admin panel

## Code Conventions

### When writing Python code:

- Follow PEP 8 style guide
- Use type hints for function parameters and return values
- Import Django/DRF modules at the top
- Use Django ORM for all database operations
- Handle errors with appropriate HTTP status codes (400, 404, 500)

### When working with views:

- Use DRF `@api_view` decorator for API endpoints
- Use Django's `render()` for HTML pages
- Return `Response()` objects for API endpoints
- Use `get_object_or_404()` for database lookups

### When working with serializers:

- Override `create()` and `update()` methods to handle spec_json parsing
- Use `to_representation()` to convert stored JSON strings to dicts
- Validate spec_json is a dict in `validate_spec_json()`

### When working with templates:

- Base template includes Monaco Editor and Swagger UI via CDN
- Use vanilla JavaScript (no Vue/React frameworks)
- Fetch API for AJAX requests to `/api/` endpoints
- Handle CSRF tokens for POST/PUT/DELETE requests

## Common Tasks

### Adding a new API endpoint:

1. Add view function in `specs/views.py`
2. Add URL pattern in `fastspec/urls.py`
3. Create serializer if needed in `specs/serializers.py`
4. Test with Django's built-in test client

### Modifying the database schema:

1. Update model in `specs/models.py`
2. Run `python manage.py makemigrations`
3. Run `python manage.py migrate`
4. Update serializers if fields changed

### Adding frontend functionality:

1. Edit `specs/templates/editor.html`
2. Add JavaScript functions at the bottom
3. Use `fetch()` to call API endpoints
4. Update DOM with vanilla JavaScript

## Validation Logic (validator.py)

The `validate_openapi_spec()` function:

- Takes a dict (OpenAPI spec JSON)
- Returns tuple: (is_valid: bool, errors: List[ValidationError], warnings: List[str])
- Checks required fields (openapi, info.title, info.version, paths)
- Uses `openapi-spec-validator` library for comprehensive validation
- ValidationError is a NamedTuple with `field` and `message`

## Diff Logic (diff_utils.py)

Functions for comparing OpenAPI specs:

- `compare_specs()`: Compares two specs, returns dict with changes
- `generate_markdown_report()`: Converts diff to readable markdown
- Tracks: added/removed/modified endpoints, schema changes, info changes

## Environment Variables

Defined in `.env.example`:

- `DJANGO_SECRET_KEY`: Secret key for Django (required in production)
- `DEBUG`: Enable/disable debug mode (default: True)
- `ALLOWED_HOSTS`: Comma-separated list of allowed hosts

## Testing

Run tests with:

```bash
python manage.py test
```

Check code with:

```bash
python manage.py check
```

## Important Notes

1. **No separate frontend build**: Everything is served by Django
2. **CORS is enabled**: For potential API-only usage
3. **SQLite database**: `fastspec.db` file in root directory
4. **Monaco Editor & Swagger UI**: Loaded via CDN, not bundled
5. **REST API + Web UI**: Same app serves both HTML and JSON

## When Suggesting Code

- Prefer Django's built-in features over third-party packages
- Use DRF serializers for validation instead of Pydantic
- Don't suggest creating separate frontend projects (Vue, React, etc.)
- Keep templates simple with vanilla JavaScript
- Follow Django best practices (use ORM, don't write raw SQL)
- Remember this is a full-stack Django app, not microservices

## Development Workflow

1. Activate virtual environment: `source .venv/bin/activate`
2. Install dependencies: `pip install -r requirements.txt`
3. Run migrations: `python manage.py migrate`
4. Start server: `python manage.py runserver`
5. Access at: http://localhost:8000

## Production Deployment

Uses Gunicorn as WSGI server:

```bash
python manage.py collectstatic
gunicorn fastspec.wsgi:application --bind 0.0.0.0:8000
```
