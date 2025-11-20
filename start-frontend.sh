#!/bin/bash

# Start only the Vue.js frontend

echo "🚀 Starting Vue.js frontend..."

# Check if node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Start frontend
echo "Starting Vite dev server on port 3000..."
cd frontend && npm run dev
