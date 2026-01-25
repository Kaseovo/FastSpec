FROM python:3.11-slim

# Environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    ROOT_PATH="/api"

WORKDIR /app

# Copy requirements from repo root (build context is project root)
COPY requirements.txt ./

# Install system build deps, install Python deps, then remove build deps to keep image small
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc libpq-dev \
    && pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend source and start script
COPY backend/ ./backend/
RUN chmod +x ./backend/start-backend.sh

# Expose port and set default command
EXPOSE 8000

CMD ["./backend/start-backend.sh"]
