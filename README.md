# FastSpec Backend - Django

A Django REST Framework backend for managing OpenAPI specifications.

## Setup

### Local Development

1. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

2. **Run migrations:**

   ```bash
   python manage.py migrate
   ```

3. **Create a superuser (optional, for admin access):**

   ```bash
   python manage.py createsuperuser
   ```

4. **Run the development server:**

   ```bash
   python manage.py runserver
   ```

   The API will be available at `http://localhost:8000`

### Docker Development

From the `docker` directory:

```bash
docker-compose -f docker-compose.dev.yml up
```

### Production

```bash
gunicorn fastspec.wsgi:application --bind 0.0.0.0:8000
```

## API Endpoints

- `GET /` - Root endpoint
- `GET /api/specs` - List all specifications
- `GET /api/specs/{id}` - Get a specific specification
- `POST /api/specs` - Create a new specification
- `PUT /api/specs/{id}` - Update a specification
- `DELETE /api/specs/{id}` - Delete a specification
- `GET /api/specs/{id}/diff` - Get diff between versions
- `POST /api/validate` - Validate a specification
- `GET /admin` - Django admin panel

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `DJANGO_SECRET_KEY` - Django secret key (required in production)
- `DEBUG` - Debug mode (default: True)
- `ALLOWED_HOSTS` - Comma-separated list of allowed hosts

## Django Management Commands

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver

# Collect static files (for production)
python manage.py collectstatic
```

## Database

By default, the application uses SQLite (`fastspec.db`). You can configure other databases in `fastspec/settings.py`.

## Admin Panel

Access the Django admin at `/admin` after creating a superuser account.
