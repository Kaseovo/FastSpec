"""
Central configuration for FastSpec backend.

This module consolidates JWT secret resolution and fails fast if a secret is not
provided via environment variables. This prevents the application from silently
starting with a known, insecure default secret.
"""

import os
import sys

# Required secret for signing JWTs and session middleware.
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    print("FATAL: JWT_SECRET_KEY environment variable is required", file=sys.stderr)
    sys.exit(1)

# Expose algorithm default (kept here for convenience).
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
