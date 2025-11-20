#!/bin/bash

# Start FastSpec with FastAPI backend and Vue.js frontend

echo "🚀 Starting FastSpec..."

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

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Start backend in background
echo "Starting FastAPI backend on port 8000..."
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "Starting Vue.js frontend on port 3000..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ FastSpec is running!"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
