# FastSpec — self-hosted image: API + MCP server + web app on one port.
#
#   docker build -t fastspec .
#   docker run -p 127.0.0.1:8080:8080 -v fastspec-data:/data fastspec
#
# (The hosted AWS deployment uses backend/Dockerfile.lambda instead.)

ARG NODE_VERSION=22
ARG PYTHON_VERSION=3.12
ARG SPECTRAL_VERSION=6.16.3

# ── Web app ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── Spectral CLI (linting) ───────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS spectral
ARG SPECTRAL_VERSION
RUN npm install --global --no-audit --no-fund "@stoplight/spectral-cli@${SPECTRAL_VERSION}" \
    && npm cache clean --force

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080 \
    FASTSPEC_DATA_DIR=/data \
    FASTSPEC_STATIC_DIR=/app/static \
    SPECTRAL_PATH=/usr/local/bin/spectral

# Node is only needed to run Spectral; take just the binary and the CLI.
COPY --from=spectral /usr/local/bin/node /usr/local/bin/node
COPY --from=spectral /usr/local/lib/node_modules/@stoplight /usr/local/lib/node_modules/@stoplight
RUN ln -s ../lib/node_modules/@stoplight/spectral-cli/dist/index.js /usr/local/bin/spectral \
    && spectral --version

WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=frontend /src/frontend/dist /app/static

RUN useradd --system --uid 10001 --home-dir /data --shell /usr/sbin/nologin fastspec \
    && mkdir -p /data \
    && chown fastspec:fastspec /data
USER fastspec
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8080\")}/health/ready', timeout=4)"

CMD ["python", "cli.py", "serve"]
