# FastSpec Quick Start Guide

Get FastSpec running locally in under 5 minutes!

## Prerequisites

- **Python 3.11+** and **pip**

## Quick Setup

### Setup (Single Terminal)

```bash
# Clone the repository
git clone https://github.com/DishWatcher/FastSpec.git
cd FastSpec

# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Run development server
python manage.py runserver
```

✅ Application running at **http://localhost:8000**

## Verify Setup

1. Open http://localhost:8000 in your browser
2. Click "New" to create a specification
3. Fill in some details and click "Save"
4. Your spec should be saved and appear in the sidebar

## Admin Panel (Optional)

To access the Django admin panel:

```bash
python manage.py createsuperuser
```

Then visit http://localhost:8000/admin

## Troubleshooting

### Port Already in Use

If port 8000 is already in use, run on a different port:

```bash
python manage.py runserver 8080
```

### Module Not Found

Make sure virtual environment is activated and dependencies are installed:

```bash
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Explore the Django admin at http://localhost:8000/admin
- Check out the REST API at http://localhost:8000/api/

## Docker (Optional)

```bash
docker build -t fastspec .
docker run -p 8000:8000 fastspec
```
