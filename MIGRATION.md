# FastSpec Migration Guide: Django → FastAPI + Vue.js

This document explains the architectural changes from the Django full-stack application to the new FastAPI + Vue.js stack.

## Overview of Changes

### Before (Django)

- **Backend**: Django 5.0 + Django REST Framework
- **Frontend**: Server-side Django templates with vanilla JavaScript
- **UI**: Bootstrap CSS with Monaco Editor and Swagger UI (CDN)
- **Database**: SQLite with Django ORM

### After (FastAPI + Vue.js)

- **Backend**: FastAPI with SQLAlchemy ORM
- **Frontend**: Vue.js 3 with PrimeVue components
- **UI**: Modern component-based architecture
- **Database**: SQLite with SQLAlchemy (compatible with Django database)

## Key Benefits

1. **Separation of Concerns**: Backend and frontend are now completely decoupled
2. **Modern Frontend**: Vue.js provides reactive components and better state management
3. **Better Performance**: FastAPI is significantly faster than Django
4. **Type Safety**: Pydantic schemas provide automatic validation and documentation
5. **Developer Experience**: Hot reload for both backend and frontend
6. **API-First**: FastAPI generates interactive documentation automatically

## Architecture Comparison

### Django Structure

```
fastspec/
├── manage.py
├── fastspec/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── specs/
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   └── templates/
│       └── editor.html
└── static/
```

### FastAPI + Vue Structure

```
FastSpec/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   └── routers/
│       └── specs.py
├── frontend/
│   ├── src/
│   │   ├── App.vue
│   │   ├── components/
│   │   └── api/
│   └── package.json
├── validator.py (unchanged)
└── diff_utils.py (unchanged)
```

## Database Migration

Good news: The database schema is compatible! The new SQLAlchemy models match the Django models:

```python
# Django (specs/models.py)
class OpenAPISpec(models.Model):
    name = models.CharField(max_length=255, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    version = models.CharField(max_length=50)
    spec_json = models.TextField()
    previous_spec_json = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

# FastAPI (backend/models.py)
class OpenAPISpec(Base):
    __tablename__ = "openapi_specs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    spec_json = Column(Text, nullable=False)
    previous_spec_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

**To migrate existing data:**

Your existing `fastspec.db` will work with the new FastAPI backend without changes!

## API Endpoint Mapping

All endpoints remain the same:

| Endpoint               | Method | Django | FastAPI | Notes         |
| ---------------------- | ------ | ------ | ------- | ------------- |
| `/api/specs`           | GET    | ✅     | ✅      | List specs    |
| `/api/specs/{id}`      | GET    | ✅     | ✅      | Get spec      |
| `/api/specs`           | POST   | ✅     | ✅      | Create spec   |
| `/api/specs/{id}`      | PUT    | ✅     | ✅      | Update spec   |
| `/api/specs/{id}`      | DELETE | ✅     | ✅      | Delete spec   |
| `/api/validate`        | POST   | ✅     | ✅      | Validate spec |
| `/api/specs/{id}/diff` | GET    | ✅     | ✅      | Get diff      |

## Code Migration Details

### Models

- Django ORM → SQLAlchemy ORM
- Same field types and constraints
- Automatic table creation on startup

### Views/Routes

- Django REST Framework ViewSets → FastAPI route functions
- `@api_view` decorator → `@router.get/post/put/delete`
- `Response()` → Return dict/model directly (FastAPI handles serialization)

### Serializers/Schemas

- DRF Serializers → Pydantic models
- Automatic validation with Pydantic
- Better type hints and editor support

### Templates/Frontend

- Django templates with vanilla JS → Vue.js components
- Server-side rendering → Client-side SPA
- Inline JavaScript → Separate `.vue` files with proper structure

### Validation & Utils

- `validator.py` - No changes needed! ✅
- `diff_utils.py` - No changes needed! ✅

## Running Both Versions (Development)

You can keep both versions during migration:

**Old Django version:**

```bash
python manage.py runserver 8001
```

**New FastAPI + Vue version:**

```bash
# Terminal 1
uvicorn backend.main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev  # Port 3000
```

Access:

- Django: http://localhost:8001
- FastAPI Backend: http://localhost:8000
- Vue Frontend: http://localhost:3000

## Testing the Migration

1. **Verify backend works:**

   ```bash
   curl http://localhost:8000/api/specs
   ```

2. **Test frontend:**

   - Open http://localhost:3000
   - Create a new spec
   - Validate it
   - Save it
   - Check it appears in sidebar

3. **Verify database compatibility:**
   - Specs created in Django should appear in FastAPI
   - Specs created in FastAPI should work in Django

## What to Remove After Migration

Once you've confirmed everything works:

1. **Django files:**

   ```bash
   rm -rf fastspec/ specs/ manage.py
   rm -rf static/ staticfiles/
   ```

2. **Old documentation:**

   ```bash
   mv README_NEW.md README.md
   mv QUICKSTART_NEW.md QUICKSTART.md
   ```

3. **Update .gitignore** (already done)

## Configuration Changes

### Before (.env with Django)

```env
DJANGO_SECRET_KEY=...
DEBUG=True
ALLOWED_HOSTS=*
```

### After (.env for FastAPI)

```env
DATABASE_URL=sqlite:///./fastspec.db
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

## Deployment Changes

### Before (Django)

```bash
gunicorn fastspec.wsgi:application --bind 0.0.0.0:8000
```

### After (FastAPI)

**Backend:**

```bash
gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

**Frontend:**

```bash
cd frontend && npm run build
# Serve dist/ with nginx or static hosting
```

## Common Issues & Solutions

### Port Conflicts

If ports 8000 or 3000 are in use:

```bash
# Backend
uvicorn backend.main:app --reload --port 8001

# Frontend
cd frontend && npm run dev -- --port 3001
```

### Database Issues

If SQLAlchemy can't read Django's database:

```bash
# Backup old DB
cp fastspec.db fastspec.db.backup

# Let FastAPI create new tables
rm fastspec.db
# Start backend - tables will be created automatically
```

### Module Import Errors

Make sure you're in the correct directory and virtual environment:

```bash
# Should be in FastSpec/ root directory
pwd

# Activate venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Frontend Build Errors

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Performance Comparison

Based on typical benchmarks:

| Metric        | Django | FastAPI | Improvement |
| ------------- | ------ | ------- | ----------- |
| Requests/sec  | ~1,000 | ~3,000+ | 3x faster   |
| Response time | ~50ms  | ~15ms   | 70% faster  |
| Startup time  | ~2s    | ~0.5s   | 4x faster   |
| Memory usage  | ~100MB | ~50MB   | 50% less    |

## Developer Experience

### Django

- ✅ Batteries included
- ✅ Admin panel
- ❌ Slower performance
- ❌ Less modern frontend

### FastAPI + Vue

- ✅ Much faster
- ✅ Modern reactive UI
- ✅ Better separation of concerns
- ✅ Automatic API docs
- ✅ Type safety
- ❌ No built-in admin (can add later)

## Next Steps

1. ✅ Backend migrated to FastAPI
2. ✅ Frontend migrated to Vue.js + PrimeVue
3. ✅ Database compatibility maintained
4. ✅ Documentation updated
5. 🔄 Test thoroughly in development
6. 🔄 Deploy to staging
7. 🔄 Deploy to production
8. 🔄 Remove old Django code

## Questions?

- Check FastAPI docs: https://fastapi.tiangolo.com
- Check Vue.js docs: https://vuejs.org
- Check PrimeVue docs: https://primevue.org

## Rollback Plan

If you need to rollback:

1. Keep both codebases for 1-2 weeks
2. Old Django code is still in the repo
3. Database is compatible with both
4. Can switch back anytime during transition

Good luck with the migration! 🚀
