#!/usr/bin/env bash
# run-migrate.sh — run Alembic migrations for local development.
# For local env, Alembic is invoked directly (no ECS task).
# In CI prod this would be replaced by an ECS run-task invocation.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ALEMBIC="${REPO_ROOT}/.venv/bin/alembic"
ALEMBIC_INI="${REPO_ROOT}/backend/alembic.ini"

if [[ ! -x "$ALEMBIC" ]]; then
  echo "ERROR: alembic not found — run: pip install -r backend/requirements.txt" >&2
  exit 1
fi

if [[ ! -f "$ALEMBIC_INI" ]]; then
  echo "⚠  Alembic not yet initialised (no backend/alembic.ini) — skipping migrations"
  exit 0
fi

echo "→ Running Alembic migrations…"
cd "$REPO_ROOT/backend"
"$ALEMBIC" upgrade head

echo "✓ Migrations applied"
