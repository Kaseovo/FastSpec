# FastSpec Quick Start Guide

Get FastSpec running locally in under 5 minutes!

## Prerequisites

- **Node.js 20+** and **npm**
- **Python 3.11+** and **pip**

## Quick Setup

### 1. Clone & Setup Backend (Terminal 1)

```bash
# Clone the repository
git clone https://github.com/DishWatcher/FastSpec.git
cd FastSpec/backend

# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies and run
pip install -r requirements.txt
python main.py
```

✅ Backend running at **http://localhost:8000**

### 2. Setup Frontend (Terminal 2)

Open a new terminal:

```bash
cd FastSpec/frontend

# Install dependencies
npm install --legacy-peer-deps

# Create environment file
cp .env.local.example .env.local

# Run development server
npm run dev
```

✅ Frontend running at **http://localhost:3000**

## Verify Setup

1. Open http://localhost:3000 in your browser
2. Click "New" to create a specification
3. Fill in some details and click "Save"
4. Your spec should be saved and appear in the sidebar

## API Documentation

Visit http://localhost:8000/docs for interactive API documentation.

## Troubleshooting

### Port Already in Use

If port 8000 or 3000 is already in use:

**Backend**: Edit `backend/main.py` and change the port in the last line
**Frontend**: Run `npm run dev -- -p 3001` to use port 3001

### Module Not Found

**Backend**: Make sure virtual environment is activated and dependencies are installed
**Frontend**: Delete `node_modules` and run `npm install --legacy-peer-deps` again

### CORS Errors

Make sure backend is running on port 8000, or update `NEXT_PUBLIC_API_URL` in `frontend/.env.local`

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Check out the API at http://localhost:8000/docs
- Explore the code structure in the README

---

Need Docker instead? See [docker/README.md](./docker/README.md)
