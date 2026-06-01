FROM python:3.11-slim

# Environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    ROOT_PATH="/api" \
    PYTHONPATH=/app \
    # Pin Node version via n (installed below)
    NODE_VERSION=20

WORKDIR /app

# Install system build deps + Node.js LTS
# We install Node.js via NodeSource so we get a recent LTS in debian-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    curl \
    ca-certificates \
    # NodeSource setup for Node 20 LTS
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    # Pre-cache the Spectral CLI so first lint is fast (avoids cold npx download)
    && npm install -g @stoplight/spectral-cli@6.16.0 \
    && npm install -g @stoplight/spectral-rulesets@1.22.3 \
    # Clean up apt lists and build deps
    && apt-get purge -y --auto-remove build-essential gcc curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY backend/requirements.txt ./requirements.txt

# Install Python deps
RUN pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r ./requirements.txt

# Point SPECTRAL_PATH at the globally installed binary so we skip npx overhead
ENV SPECTRAL_PATH=/usr/bin/spectral

# Copy backend source
COPY backend/ ./

# Expose port and set default command
EXPOSE 8000

CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
