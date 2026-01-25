#!/bin/bash

# Start only the FastAPI backend

echo "🚀 Starting FastAPI backend..."

# Check if .venv exists
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install/update backend dependencies
echo "Installing backend dependencies..."
pip install -r requirements.txt

# Start backend
echo "Starting FastAPI on port 8000..."
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
