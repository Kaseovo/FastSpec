#!/usr/bin/env bash
# seed-ssm.sh — Read .env and write every key as a SecureString into floci SSM.
# Parameters are namespaced under /fastspec/local/<KEY>.
# Idempotent: uses --overwrite so running twice produces the same state.

set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_PAGER=""
ENDPOINT=http://localhost:4566

count=0
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip blank lines and comments
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

  # Must contain an = sign
  [[ "$line" != *"="* ]] && continue

  KEY="${line%%=*}"
  VALUE="${line#*=}"

  aws ssm put-parameter \
    --endpoint-url "$ENDPOINT" \
    --name "/fastspec/local/${KEY}" \
    --value "$VALUE" \
    --type SecureString \
    --overwrite \
    > /dev/null

  echo "  ✓ /fastspec/local/${KEY}"
  (( count++ )) || true
done < "$ENV_FILE"

echo "Seeded $count parameter(s) into floci SSM."
