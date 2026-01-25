# FastSpec Quick Start Guide

Get FastSpec running locally in under 5 minutes!

## Prerequisites

- **Python 3.11+** with pip
- **Node.js 18+** with npm

## Quick Setup

### Option 1: Automatic Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/DishWatcher/FastSpec.git
cd FastSpec

# Make start script executable
chmod +x start-dev.sh

# Start both servers
./start-dev.sh
```

The script will:

1. Create Python virtual environment
2. Install all dependencies (backend + frontend)
3. Start FastAPI backend on port 8000
4. Start Vue.js frontend on port 3000

✅ **Done!**

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option 2: Manual Setup

**Terminal 1 - Backend:**

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn backend.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```

## Verify Setup

1. Open http://localhost:3000 in your browser
2. You should see the FastSpec editor interface
3. Click "New" to create a specification
4. Edit the JSON in Monaco Editor
5. See live preview in Swagger UI panel
6. Click "Save" to store your spec

## Using the Application

### Create a Spec

1. Click **"New"** button
2. Edit the OpenAPI JSON in the editor
3. Watch the live preview update
4. Click **"Save"** and enter a name
5. Your spec appears in the sidebar

### Validate a Spec

1. Load or create a spec
2. Click **"Validate"**
3. See validation results

### View Saved Specs

- All saved specs appear in the left sidebar
- Click a spec to load it
- Click the trash icon to delete

### Load Template

Click **"Load Template"** to start with a basic OpenAPI 3.0 structure.

## Explore the API

FastAPI provides automatic interactive documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

Try the endpoints directly from the browser!

## Troubleshooting

### Port Already in Use

**Backend (8000):**

```bash
uvicorn backend.main:app --reload --port 8001
```

**Frontend (3000):**

```bash
cd frontend
npm run dev -- --port 3001
```

### Python Module Not Found

Ensure virtual environment is activated:

```bash
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Frontend Not Loading

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Database Issues

Delete and recreate:

```bash
rm fastspec.db
# Will be recreated on next backend start
```

## Next Steps

- 📖 Read the full [README.md](./README.md)
- 🔍 Explore the API at http://localhost:8000/docs
- 💻 Check out the code structure
- 🚀 Deploy to production

## Architecture Overview

```
┌─────────────────┐
│   Vue.js 3      │  Port 3000
│   + PrimeVue    │  (Frontend)
│   + Monaco      │
│   + Swagger UI  │
└────────┬────────┘
         │ HTTP
         │ /api/*
         ▼
┌─────────────────┐
│   FastAPI       │  Port 8000
│   + SQLAlchemy  │  (Backend)
│   + Pydantic    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   SQLite DB     │  fastspec.db
└─────────────────┘
```

## Development Tips

- Backend auto-reloads on code changes
- Frontend hot-reloads on code changes
- Monaco Editor supports Cmd/Ctrl+S to save
- Use browser DevTools for debugging

## Production Deployment

See [README.md](./README.md#production-deployment) for production deployment instructions.
