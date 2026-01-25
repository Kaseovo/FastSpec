FROM python:3.11-slim

# Environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    ROOT_PATH="/api"

WORKDIR /app

# Copy requirements file
COPY backend/requirements.txt ./backend/requirements.txt

# Install system build deps, install Python deps, then remove build deps to keep image small
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc libpq-dev \
    && pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r ./backend/requirements.txt \
    && apt-get purge -y --auto-remove build-essential gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend source
COPY backend/ ./backend/

# Expose port and set default command
EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
